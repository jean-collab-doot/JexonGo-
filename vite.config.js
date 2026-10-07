import { cpSync, existsSync, mkdirSync } from 'fs';

const ASSET_DIRS = [
  'skins', 'music', 'ships', 'enemies', 'fx',
  'chest', 'hangar', 'menu', 'planes', 'pilots', 'Maps',
  'Badges', 'levels', 'Image intro',
];

const copyGameAssets = {
  name: 'copy-game-assets',
  closeBundle() {
    mkdirSync('dist/assets', { recursive: true });
    for (const dir of ASSET_DIRS) {
      const src = `assets/${dir}`;
      if (!existsSync(src)) continue;
      cpSync(src, `dist/assets/${dir}`, {
        recursive: true,
        // assets/music also holds the raw sound packs (kenney_*) and their
        // zips, used only to pick sounds: the game doesn't load them.
        filter: from => dir !== 'music' || !/kenney_|\.zip$|desktop\.ini$/i.test(from),
      });
    }
    if (existsSync('assets/email.min.js')) {
      cpSync('assets/email.min.js', 'dist/assets/email.min.js');
    }
  },
};

// The "test-debloque" deployment always starts as a brand-new player: every
// page load wipes this site's saved data (save, settings, sign-in) before the
// game's scripts run. Only that branch's build gets this script.
const FRESH_PLAYER_BRANCH = process.env.VERCEL_ENV === 'preview'
  && process.env.VERCEL_GIT_COMMIT_REF === 'test-debloque';
const freshPlayerEveryLoad = {
  name: 'fresh-player-every-load',
  transformIndexHtml() {
    if (!FRESH_PLAYER_BRANCH) return [];
    return [{
      tag: 'script',
      injectTo: 'head-prepend',
      children: 'try{localStorage.clear();sessionStorage.clear();}catch(e){}',
    }];
  },
};

export default {
  base: './',
  // Vercel preview deployments (not production) unlock every level and
  // aircraft for testing on a phone: src/utils/test-mode.js.
  define: {
    __PREVIEW_TEST__: JSON.stringify(process.env.VERCEL_ENV === 'preview'),
    // The separate "test-debloque" branch deployment: everything unlocked, as
    // on the local dev server (max coins / EXP, test shortcuts).
    __FULL_UNLOCK__: JSON.stringify(process.env.VERCEL_ENV === 'preview'
      && process.env.VERCEL_GIT_COMMIT_REF === 'test-debloque'),
    // Short commit id of this build, shown on the MULTI waiting screen so a
    // phone still running an older cached version is easy to spot.
    __BUILD_ID__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 7)),
  },
  plugins: [copyGameAssets, freshPlayerEveryLoad],
  server: {
    watch: {
      // Browser downloads in progress (.crdownload, .part, .tmp) are locked by
      // Windows: watching them crashes the dev server with EBUSY.
      ignored: ['**/*.crdownload', '**/*.part', '**/*.tmp', '**/*.zip'],
    },
  },
  build: {
    target: 'es2020',
    // Inline small assets (<4 KB) to save HTTP round-trips on mobile
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        // Keep a single JS bundle — avoids extra round-trips on slow mobile networks
        manualChunks: undefined,
      },
    },
  },
};
