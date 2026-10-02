export const FLUID_TYPE_OPTIONS = Object.freeze([
  { value: 'WB-SW', label: 'Sea Water' },
  { value: 'WB-WB', label: 'Water Base' },
  { value: 'WB-WBH', label: 'Water Base HPWBM' },
  { value: 'OBM-LT', label: 'LT-Oil Base' },
  { value: 'OBM-SB', label: 'Synthetic Base' },
  { value: 'OBM-EN', label: 'Enviromul' }
]);

const WATER_CODES = new Set(['WB-SW', 'WB-WB', 'WB-WBH']);

export function fluidTypeName(code) {
  const match = FLUID_TYPE_OPTIONS.find(item => item.value === String(code || ''));
  return match?.label || String(code || '');
}

export function resolveFluidCode(details = {}) {
  return String(details.mudcheck_type || details.fluidtype || '').trim();
}

export function activeMudCategoryMeta(details = {}) {
  const code = resolveFluidCode(details);
  const water = WATER_CODES.has(code);

  if (water) {
    return {
      code,
      fluidName: fluidTypeName(code),
      water: true,
      primary: { field: 'categories2', label: 'MBT', unit: 'lb/bbl' },
      secondary: { field: 'basefluid', label: 'Base Fluid', unit: '%' },
      hiddenField: 'categories1'
    };
  }

  return {
    code,
    fluidName: fluidTypeName(code),
    water: false,
    primary: { field: 'categories2', label: 'E-Stability', unit: 'Volt' },
    secondary: { field: 'categories1', label: 'Oil / Water Ratio', unit: '' },
    hiddenField: null
  };
}

export function activeMudDisplayValues(details = {}) {
  const meta = activeMudCategoryMeta(details);
  return {
    ...meta,
    primaryValue: details[meta.primary.field] ?? '',
    secondaryValue: details[meta.secondary.field] ?? ''
  };
}
