export const $ = id => document.getElementById(id);

const SCREEN_IDS = [
  's-menu', 's-levelmap', 's-game',
  's-hangar', 's-result', 's-chest', 's-gameover', 's-shop',
];

export function showScreen(id) {
  SCREEN_IDS.forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s !== id);
  });
}
