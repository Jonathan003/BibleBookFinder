// Settings scope utilities.
//
// Modeled on the VS Code "Settings Sync ignored settings" pattern and Anki's
// "collection syncs, preferences stay local" approach. Each device has its
// own localStorage; settings that depend on the screen (column counts,
// abbreviation modes, OT/NT layout, autoScroll for touch vs mouse) are
// considered device-scoped and stay local. Everything else (language,
// learning pace, study preferences, mastery speed, highlight) follows the
// user across devices via the JSON backup/restore mechanism.
//
// This single source of truth is consumed by:
//   - Settings.handleExport: strips device-scoped fields before exporting
//   - App.handleRestore   : keeps the current device's values for those
//                            same fields when restoring a backup
//
// Keeping ONE list shared by export AND import prevents the asymmetry bug
// where you'd strip a field on export but accept it on import (or vice
// versa), which would silently overwrite device prefs over time.

// Sections of the config that are entirely device-scoped (every field).
const DEVICE_SCOPED_SECTIONS = ['grid'];

// Specific device-scoped fields within other sections.
const DEVICE_SCOPED_FIELDS = {
  display: ['abbreviationsPortrait', 'abbreviationsLandscape', 'testamentsLayout'],
  quiz:    ['autoScroll'],
};

// Helper: is `field` of `section` device-scoped?
function isDeviceScoped(section, field) {
  if (DEVICE_SCOPED_SECTIONS.includes(section)) return true;
  return (DEVICE_SCOPED_FIELDS[section] || []).includes(field);
}

// Return a new config with all device-scoped fields removed.
// Used by handleExport so backups never carry device-specific prefs.
export function stripDeviceScoped(config) {
  if (!config) return config;
  const result = {};
  for (const [section, sectionConfig] of Object.entries(config)) {
    if (DEVICE_SCOPED_SECTIONS.includes(section)) continue;
    if (!sectionConfig || typeof sectionConfig !== 'object') {
      result[section] = sectionConfig;
      continue;
    }
    const fieldsToStrip = DEVICE_SCOPED_FIELDS[section] || [];
    if (fieldsToStrip.length === 0) {
      // Whole section is portable — shallow clone so callers can mutate freely.
      result[section] = { ...sectionConfig };
    } else {
      result[section] = {};
      for (const [field, value] of Object.entries(sectionConfig)) {
        if (!fieldsToStrip.includes(field)) {
          result[section][field] = value;
        }
      }
    }
  }
  return result;
}

// Return a new config containing ONLY the device-scoped fields from `config`.
// Used internally by applyDeviceScoped.
export function pickDeviceScoped(config) {
  if (!config) return {};
  const result = {};
  for (const section of DEVICE_SCOPED_SECTIONS) {
    if (config[section] && typeof config[section] === 'object') {
      result[section] = { ...config[section] };
    }
  }
  for (const [section, fields] of Object.entries(DEVICE_SCOPED_FIELDS)) {
    if (!config[section] || typeof config[section] !== 'object') continue;
    for (const field of fields) {
      if (config[section][field] !== undefined) {
        if (!result[section]) result[section] = {};
        result[section][field] = config[section][field];
      }
    }
  }
  return result;
}

// Take an `incoming` config (e.g. from a backup) and overlay the
// device-scoped fields from `current`. This is the merge step used at
// import time: the backup provides user prefs, but device prefs are
// preserved from the device receiving the backup.
//
// Result shape mirrors `incoming`: any section in incoming is preserved,
// and device-scoped fields from current are layered on top.
export function applyDeviceScoped(incoming, current) {
  const result = {};
  // Start from incoming (deep-ish: clone each section so we don't mutate it).
  for (const [section, sectionConfig] of Object.entries(incoming || {})) {
    result[section] = (sectionConfig && typeof sectionConfig === 'object')
      ? { ...sectionConfig }
      : sectionConfig;
  }
  // Layer device-scoped fields from current on top.
  const devicePart = pickDeviceScoped(current);
  for (const [section, sectionConfig] of Object.entries(devicePart)) {
    if (DEVICE_SCOPED_SECTIONS.includes(section)) {
      // Whole section comes from current device.
      result[section] = { ...sectionConfig };
    } else {
      // Field-level overlay.
      result[section] = { ...(result[section] || {}), ...sectionConfig };
    }
  }
  return result;
}

// Exported for tests / debug introspection.
export const __INTERNAL__ = { DEVICE_SCOPED_SECTIONS, DEVICE_SCOPED_FIELDS, isDeviceScoped };
