// Build-time version constants injected by vite.config.js.
// Used in Settings → Data to show which commit is currently running.
// Update detection happens via vite-plugin-pwa's useRegisterSW hook,
// not via this module.

// eslint-disable-next-line no-undef
export const APP_COMMIT = typeof __APP_COMMIT__ !== 'undefined' ? __APP_COMMIT__ : 'unknown';
// eslint-disable-next-line no-undef
export const APP_BUILD_DATE = typeof __APP_BUILD_DATE__ !== 'undefined' ? __APP_BUILD_DATE__ : 'unknown';
