import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { applyI18n, t, getLang } from '../i18n.js';
import { save } from '../utils/storage.js';
import { updateSelectedPlaneShowcase, cyclePlane } from './menu.js';
import { makeBottomSheet } from '../utils/bottomsheet.js';
import { BIOMES, BIOME_META } from '../data/levels.js';
import { weatherOptionsForBiome } from '../data/weather.js';

// Same 4 operations/colors the old standalone "PRATIQUE" popup
// (#practice-select in index.html, now retired) used to show.
// Practice "numbers from 1 to N" field limits.
const PRACTICE_NUMBER_MIN = 5;
const PRACTICE_NUMBER_MAX = 1000;

const PRACTICE_OPS = [
  { op: '+', symbol: '+', color: '#00e84b', labelKey: 'add' },
  { op: '-', symbol: '−', color: '#60a5fa', labelKey: 'sub' },
  { op: '*', symbol: '×', color: '#ff8c00', labelKey: 'mul' },
  { op: '/', symbol: '÷', color: '#a855f7', labelKey: 'div' },
  { op: '^', symbol: 'x²', color: '#f43f5e', labelKey: 'expo' },
  { op: 'alg', symbol: 'x=?', color: '#14b8a6', labelKey: 'algebra' },
];

// Difficulty picks which level of the chosen world practice plays: early,
// middle or late (enemy speed/count/fire rate scale with the level). Boss
// levels (x0) are skipped.
const PRACTICE_DIFFICULTIES = [
  { id: 'easy',   labelKey: 'diffEasy',   levelOffset: 1 },
  { id: 'normal', labelKey: 'diffNormal', levelOffset: 5 },
  { id: 'hard',   labelKey: 'diffHard',   levelOffset: 9 },
];

export function practiceLevelNumber() {
  const biomeIdx = Math.max(0, BIOMES.indexOf(G.practiceBiome));
  const diff = PRACTICE_DIFFICULTIES.find(d => d.id === G.practiceDifficulty) || PRACTICE_DIFFICULTIES[1];
  return biomeIdx * 10 + diff.levelOffset;
}

let _nav = null;

export function initTraining(nav) {
  _nav = nav;

  const sheet = $('training-sheet');
  const sheetApi = sheet ? makeBottomSheet(sheet, { onOpen: renderTrainingSheet }) : null;
  // The drawer's own grip is an invisible hit-area (see the lobby/shop
  // drawers' grip treatment), so this button is the one visible, discoverable
  // way to reach practice setup - it just opens the drawer now instead of
  // the old separate full-screen popup.
  $('btn-training-practice')?.addEventListener('click', () => sheetApi?.open());

  // Carousel: Lobby › Shop › Training — Training is the end of the line now,
  // no forward arrow into Hangar (Hangar is still reachable via the lobby's
  // pull-up drawer).
  $('btn-training-page-left')?.addEventListener('click', () => nav.toShop('prev'));

  $('btn-training-plane-prev')?.addEventListener('click', () => cyclePlane(-1, { ownedOnly: true }));
  $('btn-training-plane-next')?.addEventListener('click', () => cyclePlane(1, { ownedOnly: true }));
}

// Full practice-session setup (operations, difficulty, biome, weather,
// lives, timer, start) lives right
// in this drawer - the standalone "PRATIQUE" button + its full-screen
// popup were retired in favor of this single spot, so there's only one
// place to configure and launch a practice session instead of two.
function renderTrainingSheet() {
  const body = $('training-sheet-body');
  if (!body) return;
  if (!G.practiceOps?.length) G.practiceOps = ['+', '-', '*', '/'];

  body.innerHTML = `
    <div class="practice-subtitle">${t('chooseOps')}</div>
    <div class="practice-ops-grid" id="training-ops"></div>
    <button class="practice-all-btn" id="btn-training-all">${t('selectAll')}</button>

    <div class="practice-hearts-row">
      <span class="practice-hearts-label">${t('heartsLives')}</span>
      <button id="btn-training-hearts" class="practice-hearts-btn" type="button"></button>
    </div>

    <div class="practice-timer-row">
      <span class="practice-timer-label">${t('practiceDifficulty')}</span>
      <div class="practice-timer-btns" id="training-diff-btns">
        ${PRACTICE_DIFFICULTIES.map(d => `<button class="practice-timer-btn" type="button" data-value="${d.id}">${t(d.labelKey)}</button>`).join('')}
      </div>
    </div>

    <div class="practice-timer-row">
      <span class="practice-timer-label">${getLang() === 'fr' ? 'NOMBRES' : 'NUMBERS'}</span>
      <label class="practice-number-field">
        <span>${getLang() === 'fr' ? 'de 1 à' : 'from 1 to'}</span>
        <input id="training-number-max" class="practice-number-input" type="number" inputmode="numeric"
          min="${PRACTICE_NUMBER_MIN}" max="${PRACTICE_NUMBER_MAX}" placeholder="?"
          value="${G.practiceNumberMax || ''}">
      </label>
    </div>

    <div class="practice-timer-row">
      <span class="practice-timer-label">${t('practiceBiome')}</span>
      <div class="practice-timer-btns" id="training-biome-btns">
        ${BIOMES.map(b => `<button class="practice-timer-btn" type="button" data-value="${b}">${getLang() === 'fr' ? BIOME_META[b].labelFr : BIOME_META[b].label}</button>`).join('')}
      </div>
    </div>

    <div class="practice-timer-row">
      <span class="practice-timer-label">${t('practiceWeather')}</span>
      <div class="practice-timer-btns" id="training-weather-btns"></div>
    </div>

    <div class="practice-timer-row">
      <span class="practice-timer-label">⏱ TIMER</span>
      <div class="practice-timer-btns" id="training-timer-btns">
        ${[5, 10, 15, 30, 0].map(s => `<button class="practice-timer-btn" type="button" data-time="${s}">${s === 0 ? '∞' : s + 's'}</button>`).join('')}
      </div>
    </div>

    <button id="btn-training-start" class="btn btn-primary practice-start-btn" type="button">${t('start')}</button>
  `;

  const opsGrid = body.querySelector('#training-ops');
  PRACTICE_OPS.forEach(({ op, symbol, color, labelKey }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `practice-op-btn${G.practiceOps.includes(op) ? ' pob-active' : ''}`;
    btn.style.setProperty('--op-color', color);
    btn.innerHTML = `<span class="pob-symbol">${symbol}</span><span class="pob-label">${t(labelKey)}</span>`;
    btn.addEventListener('click', () => {
      const idx = G.practiceOps.indexOf(op);
      if (idx === -1) {
        G.practiceOps.push(op);
        btn.classList.add('pob-active');
      } else {
        if (G.practiceOps.length === 1) return;
        G.practiceOps.splice(idx, 1);
        btn.classList.remove('pob-active');
      }
    });
    opsGrid.appendChild(btn);
  });

  body.querySelector('#btn-training-all').addEventListener('click', () => {
    G.practiceOps = PRACTICE_OPS.map(item => item.op);
    opsGrid.querySelectorAll('.practice-op-btn').forEach(b => b.classList.add('pob-active'));
  });

  const heartsBtn = body.querySelector('#btn-training-hearts');
  const syncHearts = () => {
    heartsBtn.textContent = G.practiceHearts ? t('on') : t('off');
    heartsBtn.classList.toggle('poh-active', G.practiceHearts);
    heartsBtn.classList.toggle('poh-inactive', !G.practiceHearts);
  };
  syncHearts();
  heartsBtn.addEventListener('click', () => { G.practiceHearts = !G.practiceHearts; syncHearts(); });

  const timerBtns = [...body.querySelectorAll('#training-timer-btns .practice-timer-btn')];
  const syncTimerBtns = () => {
    timerBtns.forEach(btn => {
      const val = btn.dataset.time === '0' ? null : Number(btn.dataset.time);
      btn.classList.toggle('ptb-active', val === G.practiceTimeLimit);
    });
  };
  syncTimerBtns();
  timerBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      G.practiceTimeLimit = btn.dataset.time === '0' ? null : Number(btn.dataset.time);
      save('practiceTimeLimit', G.practiceTimeLimit);
      syncTimerBtns();
    });
  });

  // Difficulty / biome / weather: one active button per row.
  const bindChoiceRow = (rowId, getValue, setValue) => {
    const row = body.querySelector(rowId);
    const sync = () => row.querySelectorAll('.practice-timer-btn').forEach(btn => {
      btn.classList.toggle('ptb-active', btn.dataset.value === String(getValue() ?? ''));
    });
    row.onclick = e => {
      const btn = e.target.closest('.practice-timer-btn');
      if (!btn) return;
      setValue(btn.dataset.value || null);
      sync();
    };
    sync();
  };

  bindChoiceRow('#training-diff-btns', () => G.practiceDifficulty, v => {
    G.practiceDifficulty = v;
    save('practiceDifficulty', v);
  });

  const renderWeatherBtns = () => {
    const options = weatherOptionsForBiome(G.practiceBiome);
    // A weather picked for another biome falls back to AUTO.
    if (G.practiceWeather && !options.some(w => w.id === G.practiceWeather)) {
      G.practiceWeather = null;
      save('practiceWeather', null);
    }
    const fr = getLang() === 'fr';
    body.querySelector('#training-weather-btns').innerHTML =
      `<button class="practice-timer-btn" type="button" data-value="">${t('weatherAuto')}</button>`
      + options.map(w => `<button class="practice-timer-btn" type="button" data-value="${w.id}">${w.icon} ${fr ? w.labelFr : w.label}</button>`).join('');
    bindChoiceRow('#training-weather-btns', () => G.practiceWeather, v => {
      G.practiceWeather = v;
      save('practiceWeather', v);
    });
  };

  bindChoiceRow('#training-biome-btns', () => G.practiceBiome, v => {
    G.practiceBiome = v;
    save('practiceBiome', v);
    renderWeatherBtns();
  });
  renderWeatherBtns();

  // Typed number range: empty = the difficulty's usual numbers; otherwise
  // whole numbers from 5 to 1000 (anything else blocks START until fixed).
  const numberInput = body.querySelector('#training-number-max');
  const readNumberMax = () => {
    const raw = numberInput.value.trim();
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isInteger(n) && n >= PRACTICE_NUMBER_MIN && n <= PRACTICE_NUMBER_MAX ? n : null;
  };
  numberInput.addEventListener('input', () => {
    const n = readNumberMax();
    numberInput.classList.toggle('pni-invalid', n === null);
    if (n === null) return;
    G.practiceNumberMax = n;
    save('practiceNumberMax', n);
  });

  body.querySelector('#btn-training-start').addEventListener('click', () => {
    if (G.practiceOps.length === 0) return;
    if (readNumberMax() === null) {
      numberInput.classList.add('pni-invalid');
      numberInput.focus();
      return;
    }
    _nav?.toGame(practiceLevelNumber(), true);
  });
}

export function renderTraining() {
  const coinsEl = $('training-coins');
  const xpEl = $('training-xp');
  if (coinsEl) coinsEl.textContent = (G.coins || 0).toLocaleString();
  if (xpEl) xpEl.textContent = (G.xp || 0).toLocaleString();
  updateSelectedPlaneShowcase($('training-selected-plane'), null);
  const sheet = $('training-sheet');
  if (sheet) { sheet.style.transform = ''; sheet.classList.add('is-collapsed'); sheet.classList.remove('is-open'); }
  applyI18n();
}
