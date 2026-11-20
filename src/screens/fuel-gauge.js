// Fuel gauge on screen (rules in game/fuel.js): top right, just under the
// orange top bar (the shot meter is on the left of the same row): a can icon
// and a pixel bar, green above 50 %, yellow down to 25 %, red and blinking
// under 25 %. Picking up a can: the gauge flashes and refills smoothly, a
// small flash where the can was and "+ESSENCE" / "+FUEL" jumping up; rainbow
// letters and glitter for the youngest players.
import { getLang } from '../i18n.js';
import { gentleFx } from '../game/glitter.js';

const CAN_ICON = '/assets/fx/Fuel/bidon.png';
const GLITTER = ['#ff5fa2', '#ffb13b', '#ffe14d', '#5ee87a', '#4cc9ff', '#9b7bff', '#ffffff'];
const isFr = () => getLang() === 'fr';

function gauge() {
  let el = document.getElementById('fuel-gauge');
  if (el) return el;
  const hud = document.getElementById('game-hud');
  if (!hud) return null;
  el = document.createElement('div');
  el.id = 'fuel-gauge';
  el.className = 'fuel-gauge';
  el.setAttribute('role', 'meter');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.innerHTML = `<img class="fuel-gauge-icon" src="${CAN_ICON}" alt="" aria-hidden="true">`
    + '<span class="fuel-gauge-bar" aria-hidden="true"><i class="fuel-gauge-fill"></i></span>';
  hud.appendChild(el);
  return el;
}

function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

let _shownPct = -1;
// share 0..1, or null to hide (no fuel in this mode).
export function setFuelGauge(share) {
  const el = share == null ? document.getElementById('fuel-gauge') : gauge();
  if (!el) return;
  if (share == null) { el.classList.remove('is-on'); _shownPct = -1; return; }
  el.classList.add('is-on');
  const pct = Math.max(0, Math.min(100, share * 100));
  // The bar is redrawn only when it visibly moves (it is updated every frame).
  if (Math.abs(pct - _shownPct) < 0.2) return;
  _shownPct = pct;
  el.querySelector('.fuel-gauge-fill').style.width = `${pct.toFixed(1)}%`;
  el.classList.toggle('is-green', pct > 50);
  el.classList.toggle('is-yellow', pct <= 50 && pct > 25);
  el.classList.toggle('is-red', pct <= 25);
  el.classList.toggle('is-low', pct < 25 && pct > 0);
  el.setAttribute('aria-valuenow', String(Math.round(pct)));
  el.setAttribute('aria-label', isFr() ? `Essence ${Math.round(pct)} %` : `Fuel ${Math.round(pct)}%`);
}

function glitterBits(count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.round((360 / count) * i + Math.random() * 20);
    const dist = 34 + Math.round(Math.random() * 30);
    return `<i style="--a:${angle}deg;--d:${dist}px;--c:${GLITTER[i % GLITTER.length]}"></i>`;
  }).join('');
}

// A can was picked up at (x, y) in page pixels: flash there, "+ESSENCE"
// jumping up, the gauge flashing and refilling smoothly.
export function fuelPickupFx(x, y) {
  const el = document.getElementById('fuel-gauge');
  if (el) {
    restart(el, 'is-refill');
    el.classList.add('is-filling');           // the bar slides up instead of jumping
    setTimeout(() => el.classList.remove('is-filling'), 700);
  }
  const gentle = gentleFx();
  const flash = document.createElement('div');
  flash.className = 'fuel-flash';
  flash.style.left = `${x}px`;
  flash.style.top = `${y}px`;
  const pop = document.createElement('div');
  pop.className = `fuel-pop${gentle ? ' is-gentle' : ''}`;
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  pop.innerHTML = `<span>${isFr() ? '+ESSENCE' : '+FUEL'}</span>${gentle ? glitterBits(12) : ''}`;
  pop.setAttribute('aria-hidden', 'true');
  flash.setAttribute('aria-hidden', 'true');
  document.body.append(flash, pop);
  setTimeout(() => flash.remove(), 500);
  setTimeout(() => pop.remove(), 1300);
}

export function resetFuelGauge() {
  _shownPct = -1;
  document.querySelectorAll('.fuel-pop, .fuel-flash').forEach(el => el.remove());
}
