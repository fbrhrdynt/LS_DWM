import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const args = process.argv.slice(2);
const force = args.includes('--force');
const inputArg = args.find(arg => !arg.startsWith('--'));

if (!inputArg) {
  console.error('Usage: npm run db:import -- /path/to/hrdynt_stepoil.sql [--force]');
  process.exit(1);
}

const inputPath = path.resolve(process.cwd(), inputArg);
const configuredPath = process.env.SQLITE_PATH || 'data/dwm.sqlite';
const outputPath = path.isAbsolute(configuredPath)
  ? configuredPath
  : path.join(rootDir, configuredPath);

if (!fs.existsSync(inputPath)) {
  console.error(`Legacy SQL file not found: ${inputPath}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });

if (fs.existsSync(outputPath)) {
  if (!force) {
    console.error(`SQLite database already exists: ${outputPath}`);
    console.error('Use --force only when you intentionally want to replace it.');
    process.exit(1);
  }

  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${outputPath}${suffix}`, { force: true }); } catch {}
  }
}

const rawSql = fs.readFileSync(inputPath, 'utf8');

const SKIP_TABLES = new Set([
  'cache',
  'cache_locks',
  'migrations',
  'sessions'
]);

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function splitSqlStatements(sql) {
  const statements = [];
  let buffer = '';
  let quote = null;
  let lineComment = false;
  let blockComment = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    const next = sql[i + 1];

    if (lineComment) {
      if (ch === '\n') {
        lineComment = false;
        buffer += '\n';
      }
      continue;
    }

    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i++;
      }
      continue;
    }

    if (!quote && ch === '-' && next === '-' && (i === 0 || /\s/.test(sql[i - 1]))) {
      lineComment = true;
      i++;
      continue;
    }

    if (!quote && ch === '/' && next === '*') {
      blockComment = true;
      i++;
      continue;
    }

    if (quote) {
      buffer += ch;

      if (ch === '\\') {
        if (i + 1 < sql.length) {
          buffer += sql[++i];
        }
        continue;
      }

      if (ch === quote) {
        if (sql[i + 1] === quote && quote === "'") {
          buffer += sql[++i];
          continue;
        }
        quote = null;
      }

      continue;
    }

    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      buffer += ch;
      continue;
    }

    if (ch === ';') {
      const statement = buffer.trim();
      if (statement) statements.push(statement);
      buffer = '';
      continue;
    }

    buffer += ch;
  }

  const tail = buffer.trim();
  if (tail) statements.push(tail);

  return statements;
}

function mysqlStringValue(source, startIndex) {
  let i = startIndex + 1;
  let value = '';

  const escapeMap = {
    '0': '\0',
    b: '\b',
    n: '\n',
    r: '\r',
    t: '\t',
    Z: '\x1a',
    "'": "'",
    '"': '"',
    '\\': '\\'
  };

  while (i < source.length) {
    const ch = source[i];

    if (ch === '\\') {
      const next = source[++i];
      value += escapeMap[next] ?? next ?? '';
      i++;
      continue;
    }

    if (ch === "'") {
      if (source[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }

      return { value, nextIndex: i + 1 };
    }

    value += ch;
    i++;
  }

  throw new Error('Unterminated SQL string in INSERT statement.');
}

function parseInsertValues(source) {
  const rows = [];
  let i = 0;

  const skipSpaceAndCommas = () => {
    while (i < source.length && (/\s/.test(source[i]) || source[i] === ',')) i++;
  };

  while (i < source.length) {
    skipSpaceAndCommas();
    if (i >= source.length) break;

    if (source[i] !== '(') {
      throw new Error(`Expected "(" near: ${source.slice(i, i + 50)}`);
    }

    i++;
    const row = [];

    while (i < source.length) {
      while (i < source.length && /\s/.test(source[i])) i++;

      let value;

      if (source[i] === "'") {
        const parsed = mysqlStringValue(source, i);
        value = parsed.value;
        i = parsed.nextIndex;
      } else {
        const start = i;
        while (i < source.length && source[i] !== ',' && source[i] !== ')') i++;

        const token = source.slice(start, i).trim();

        if (/^NULL$/i.test(token)) {
          value = null;
        } else if (/^-?\d+(?:\.\d+)?(?:e[+-]?\d+)?$/i.test(token)) {
          value = Number(token);
        } else {
          value = token;
        }
      }

      row.push(value);

      while (i < source.length && /\s/.test(source[i])) i++;

      if (source[i] === ',') {
        i++;
        continue;
      }

      if (source[i] === ')') {
        i++;
        break;
      }

      throw new Error(`Expected "," or ")" near: ${source.slice(i, i + 50)}`);
    }

    rows.push(row);
  }

  return rows;
}

function mysqlDefault(rest) {
  const match = rest.match(/\bDEFAULT\s+(NULL|'(?:\\.|[^'])*'|"(?:\\.|[^"])*"|CURRENT_TIMESTAMP(?:\(\))?|[-+]?\d+(?:\.\d+)?)/i);
  if (!match) return '';

  const value = match[1];
  if (/^NULL$/i.test(value)) return ' DEFAULT NULL';
  if (/^CURRENT_TIMESTAMP/i.test(value)) return ' DEFAULT CURRENT_TIMESTAMP';

  if (value.startsWith("'") || value.startsWith('"')) {
    const inner = value.slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/''/g, "'")
      .replace(/"/g, '"')
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "''");
    return ` DEFAULT '${inner}'`;
  }

  return ` DEFAULT ${value}`;
}

function sqliteType(rest) {
  const type = rest.trim().toLowerCase();

  if (/^(tinyint|smallint|mediumint|int|integer|bigint)\b/.test(type)) return 'INTEGER';
  if (/^(double|float|real|decimal|numeric)\b/.test(type)) return 'REAL';
  if (/^(blob|binary|varbinary)\b/.test(type)) return 'BLOB';

  return 'TEXT';
}

const statements = splitSqlStatements(rawSql);

const primaryKeys = new Map();
const autoIncrement = new Map();
const foreignKeys = new Map();
const indexes = [];

for (const statement of statements) {
  const alter = statement.match(/^ALTER\s+TABLE\s+`([^`]+)`\s+([\s\S]+)$/i);
  if (!alter) continue;

  const table = alter[1];
  const body = alter[2];

  const pk = body.match(/ADD\s+PRIMARY\s+KEY\s+\(([^)]+)\)/i);
  if (pk) {
    const columns = [...pk[1].matchAll(/`([^`]+)`/g)].map(match => match[1]);
    primaryKeys.set(table, columns);
  }

  const modify = body.match(/MODIFY\s+`([^`]+)`[\s\S]*?\bAUTO_INCREMENT\b/i);
  if (modify) {
    autoIncrement.set(table, modify[1]);
  }

  for (const match of body.matchAll(/ADD\s+(UNIQUE\s+)?KEY\s+`([^`]+)`\s+\(([^)]+)\)/gi)) {
    const columns = [...match[3].matchAll(/`([^`]+)`/g)].map(item => item[1]);
    indexes.push({
      table,
      unique: Boolean(match[1]),
      name: match[2],
      columns
    });
  }

  for (const match of body.matchAll(
    /ADD\s+CONSTRAINT\s+`([^`]+)`\s+FOREIGN\s+KEY\s+\(`([^`]+)`\)\s+REFERENCES\s+`([^`]+)`\s+\(`([^`]+)`\)([^,]*)/gi
  )) {
    const rules = match[5] || '';
    const onDelete = rules.match(/ON\s+DELETE\s+(CASCADE|SET NULL|RESTRICT|NO ACTION)/i)?.[1];
    const onUpdate = rules.match(/ON\s+UPDATE\s+(CASCADE|SET NULL|RESTRICT|NO ACTION)/i)?.[1];

    const list = foreignKeys.get(table) || [];
    list.push({
      name: match[1],
      column: match[2],
      refTable: match[3],
      refColumn: match[4],
      onDelete,
      onUpdate
    });
    foreignKeys.set(table, list);
  }
}

const database = new DatabaseSync(outputPath);
database.exec('PRAGMA foreign_keys = OFF;');
database.exec('PRAGMA journal_mode = WAL;');
database.exec('PRAGMA synchronous = NORMAL;');

const createdTables = [];

try {
  database.exec('BEGIN IMMEDIATE');

  for (const statement of statements) {
    const create = statement.match(/^CREATE\s+TABLE\s+`([^`]+)`\s*\(([\s\S]+)\)\s+ENGINE=/i);
    if (!create) continue;

    const table = create[1];
    if (SKIP_TABLES.has(table)) continue;

    const body = create[2];
    const pkColumns = primaryKeys.get(table) || [];
    const autoColumn = autoIncrement.get(table);
    const columnDefinitions = [];

    for (const rawLine of body.split('\n')) {
      const line = rawLine.trim().replace(/,$/, '');
      if (!line.startsWith('`')) continue;

      const column = line.match(/^`([^`]+)`\s+([\s\S]+)$/);
      if (!column) continue;

      const name = column[1];
      const rest = column[2];
      const type = sqliteType(rest);
      const isSinglePk = pkColumns.length === 1 && pkColumns[0] === name;
      const isAuto = autoColumn === name;
      const notNull = /\bNOT\s+NULL\b/i.test(rest);
      const defaultSql = mysqlDefault(rest);

      let definition = `${quoteIdentifier(name)} ${type}`;

      if (isSinglePk && isAuto) {
        definition = `${quoteIdentifier(name)} INTEGER PRIMARY KEY AUTOINCREMENT`;
      } else if (isSinglePk) {
        definition += ' PRIMARY KEY';
      } else if (notNull) {
        definition += ' NOT NULL';
      }

      if (!(isSinglePk && isAuto)) definition += defaultSql;
      columnDefinitions.push(definition);
    }

    if (pkColumns.length > 1) {
      columnDefinitions.push(
        `PRIMARY KEY (${pkColumns.map(quoteIdentifier).join(', ')})`
      );
    }

    for (const fk of foreignKeys.get(table) || []) {
      if (SKIP_TABLES.has(fk.refTable)) continue;

      let definition =
        `FOREIGN KEY (${quoteIdentifier(fk.column)}) ` +
        `REFERENCES ${quoteIdentifier(fk.refTable)} (${quoteIdentifier(fk.refColumn)})`;

      if (fk.onDelete) definition += ` ON DELETE ${fk.onDelete.toUpperCase()}`;
      if (fk.onUpdate) definition += ` ON UPDATE ${fk.onUpdate.toUpperCase()}`;

      columnDefinitions.push(definition);
    }

    if (!columnDefinitions.length) continue;

    database.exec(
      `CREATE TABLE ${quoteIdentifier(table)} (\n  ${columnDefinitions.join(',\n  ')}\n);`
    );
    createdTables.push(table);
  }

  const inserted = new Map();

  for (const statement of statements) {
    const insert = statement.match(
      /^INSERT\s+INTO\s+`([^`]+)`\s+\(([\s\S]*?)\)\s+VALUES\s+([\s\S]+)$/i
    );
    if (!insert) continue;

    const table = insert[1];
    if (SKIP_TABLES.has(table) || !createdTables.includes(table)) continue;

    const columns = [...insert[2].matchAll(/`([^`]+)`/g)].map(match => match[1]);
    const rows = parseInsertValues(insert[3]);

    if (!columns.length || !rows.length) continue;

    const placeholders = columns.map(() => '?').join(', ');
    const prepared = database.prepare(
      `INSERT INTO ${quoteIdentifier(table)} ` +
      `(${columns.map(quoteIdentifier).join(', ')}) VALUES (${placeholders})`
    );

    let count = inserted.get(table) || 0;

    for (const row of rows) {
      if (row.length !== columns.length) {
        throw new Error(
          `Column/value mismatch for ${table}: expected ${columns.length}, got ${row.length}`
        );
      }
      prepared.run(...row);
      count++;
    }

    inserted.set(table, count);
  }

  for (const index of indexes) {
    if (
      SKIP_TABLES.has(index.table) ||
      !createdTables.includes(index.table) ||
      !index.columns.length
    ) continue;

    const unique = index.unique ? 'UNIQUE ' : '';
    database.exec(
      `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(index.name)} ` +
      `ON ${quoteIdentifier(index.table)} (${index.columns.map(quoteIdentifier).join(', ')});`
    );
  }

  database.exec('COMMIT');
  database.exec('PRAGMA foreign_keys = ON;');

  const violations = database.prepare('PRAGMA foreign_key_check').all();

  console.log(`Created SQLite database: ${outputPath}`);
  console.log(`Tables migrated: ${createdTables.length}`);

  for (const table of createdTables) {
    const row = database.prepare(
      `SELECT COUNT(*) AS total FROM ${quoteIdentifier(table)}`
    ).get();
    console.log(`${table}: ${row.total} row(s)`);
  }

  if (violations.length) {
    console.warn(`Foreign key check: ${violations.length} violation(s) found.`);
    console.warn('Review the legacy dump before using this database in production.');
    process.exitCode = 2;
  } else {
    console.log('Foreign key check: OK');
  }

  console.log('');
  console.log('Legacy Laravel cache/session tables were intentionally not migrated.');
} catch (error) {
  try { database.exec('ROLLBACK'); } catch {}
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.rmSync(`${outputPath}${suffix}`, { force: true }); } catch {}
  }
  console.error(`Import failed: ${error.message}`);
  process.exit(1);
} finally {
  database.close();
}
