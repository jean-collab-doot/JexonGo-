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
    if (existsSync('retropix.otf')) {
      cpSync('retropix.otf', 'dist/retropix.otf');
    }
  },
};

export default {
  base: './',
  // Vercel preview deployments (not production) unlock every level and
  // aircraft for testing on a phone: src/utils/test-mode.js.
  define: {
    __PREVIEW_TEST__: JSON.stringify(process.env.VERCEL_ENV === 'preview'),
  },
  plugins: [copyGameAssets],
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
