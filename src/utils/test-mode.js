// Test unlocks (every level and every aircraft) for trying the game on a
// phone: on the local dev server and on Vercel preview deployments (the
// apercu-avant-lancement branch). Never in the published game: its production
// build sets __PREVIEW_TEST__ to false (see vite.config.js).
/* global __PREVIEW_TEST__, __FULL_UNLOCK__ */
export const TEST_UNLOCK = !!import.meta.env?.DEV
  || (typeof __PREVIEW_TEST__ !== 'undefined' && __PREVIEW_TEST__ === true);

// Everything the local dev server gives for testing (max coins and EXP,
// frequent airdrops, keyboard test shortcuts): the dev server and the
// separate "test-debloque" branch deployment only (vite.config.js).
export const FULL_UNLOCK = !!import.meta.env?.DEV
  || (typeof __FULL_UNLOCK__ !== 'undefined' && __FULL_UNLOCK__ === true);

// That deployment shares the real Supabase project: its max coins / EXP must
// never reach a real account's save or the public TOP 20.
export const NO_ACCOUNT_WRITES = FULL_UNLOCK && !import.meta.env?.DEV;
