import { cpSync, existsSync, mkdirSync } from 'fs';

const ASSET_DIRS = [
  'skins', 'music', 'ships', 'enemies', 'fx', 'bg',
  'chest', 'hangar', 'menu', 'planes', 'prestige', 'pilots',
];

const copyGameAssets = {
  name: 'copy-game-assets',
  closeBundle() {
    mkdirSync('dist/assets', { recursive: true });
    for (const dir of ASSET_DIRS) {
      const src = `assets/${dir}`;
      if (existsSync(src)) cpSync(src, `dist/assets/${dir}`, { recursive: true });
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
  plugins: [copyGameAssets],
};
