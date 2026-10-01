import 'dotenv/config';
import { testWebDav } from '../src/services/webdav.service.js';
const result = await testWebDav();
console.log(result.message);
if (result.status) console.log(`HTTP status: ${result.status}`);
process.exit(result.ok ? 0 : 1);
