// Test unlocks (every level and every aircraft) for trying the game on a
// phone: on the local dev server and on Vercel preview deployments (the
// apercu-avant-lancement branch). Never in the published game: its production
// build sets __PREVIEW_TEST__ to false (see vite.config.js).
/* global __PREVIEW_TEST__ */
export const TEST_UNLOCK = !!import.meta.env?.DEV
  || (typeof __PREVIEW_TEST__ !== 'undefined' && __PREVIEW_TEST__ === true);
