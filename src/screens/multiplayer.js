// MULTI screen (MULTI button in the hangar / lobby): CO-OP. The player's
// plane ("YOU") and a second plane ("Player 2") on the hangar background, and
// a big "Multi" button that opens the choices:
//   - WITH A BOT: an allied plane joins you in your current level;
//   - WITH A REAL PLAYER: CREATE a game (the server gives a 6-character code to
//     share) or JOIN one by typing a friend's code (5 to 7 letters / digits).
//     Both then play the host's level together: each sees the other's plane
//     and each one's shots help destroy the other's enemies (game.js, "CO-OP
//     TEAMMATE").
import { SFX } from '../audio/sound.js';
import { G } from '../state.js';
import { getLang } from '../i18n.js';
// Co-op runs over Supabase Realtime (no game server to host).
import { coopConnect as wsConnect, coopSend as wsSend, coopOn as wsOn, coopDisconnect as wsDisconnect } from '../online/coop-realtime.js';
import { highestUnlockedLevel } from '../systems/progression.js';
import { TOTAL_LEVELS } from '../data/levels.js';
import { publicPilotName } from '../utils/pilot-name.js';
import { AIRCRAFT, AIRCRAFT_ORDER } from '../data/aircraft.js';
import { save } from '../utils/storage.js';
import { paintPlaneInfoFisheye } from './plane-info-fisheye.js';
import { coinIcon, uiIcon } from '../utils/icons.js';
import { TYPE_LABELS } from './hangar.js';

// Bot UPGRADE costs (coins) to reach each level.
const BOT_FIRE_MAX = 5;
const BOT_HP_MIN = 3;
const BOT_HP_MAX = 6;
const BOT_FIRE_COST = { 2: 300, 3: 600, 4: 1000, 5: 1500 };
const BOT_HP_COST = { 4: 400, 5: 800, 6: 1200 };
const COIN_IMG = '/assets/fx/Caisse/JexonGo_Coin_frame_01.png';
const XP_IMG = '/assets/fx/Caisse/JexonGo_EXP_frame_01.png';
// Bot planes are bought with EXP like the hangar's, but cheaper.
const BOT_PLANE_PRICE = 0.5;
const botPlanePrice = id => Math.ceil((AIRCRAFT[id]?.xpCost || 0) * BOT_PLANE_PRICE);
let _botView = null;           // plane shown in TON BOT (may not be bought yet)

const CODE_MIN = 5;
const CODE_MAX = 7;

let _nav = null;
let _waiting = false;          // waiting for a teammate (created or joining)
let _handlersReady = false;
let _hostLevel = 1;            // level chosen for the game we create
let _hostCode = '';            // its code (shown while waiting)

// Highest level this player has unlocked (the same rule as the level map).
function maxUnlockedLevel() {
  return Math.max(1, Math.min(TOTAL_LEVELS,
    highestUnlockedLevel(G.levelStars || {}, G.highestLevel, G.tutorialPlan?.startLevel || 1)));
}

const $ = id => document.getElementById(id);
const fr = () => getLang() === 'fr';

export function initMultiplayer(nav) {
  _nav = nav;
}

// MULTI mode is the lobby itself (#s-menu.is-multi): same hangar, top bar,
// arrows, minutes tab and HANGAR sheet, plus "Player 2" beside the player's
// plane. JOUER opens the multiplayer choices; the MULTI button reads SOLO.
export function isMultiLobby() {
  return !!$('s-menu')?.classList.contains('is-multi');
}

// Player 2 always matches the size of the player's own lobby plane (its width
// varies per device and per aircraft), so the formation reads as two equals.
let _sizeObserver = null;
function syncPartnerSize() {
  const own = $('menu-selected-plane');
  const p2 = $('mp-lobby-p2');
  if (!own || !p2) return;
  const w = own.getBoundingClientRect().width;
  if (w > 0) p2.style.width = `${Math.round(w)}px`;
}

export function enterMultiplayer() {
  $('s-menu')?.classList.add('is-multi');
  if (!_sizeObserver && window.ResizeObserver && $('menu-selected-plane')) {
    _sizeObserver = new ResizeObserver(syncPartnerSize);
    _sizeObserver.observe($('menu-selected-plane'));
  }
  requestAnimationFrame(syncPartnerSize);
  setPartner(fr() ? 'Joueur 2' : 'Player 2', 'f18');
  const youTag = $('mp-you-name');
  if (youTag) youTag.textContent = fr() ? 'TOI' : 'YOU';
  const label = $('jx-multi-label');
  if (label) label.textContent = 'SOLO';
  hideSheet();
  document.querySelector('#lobby-sheet [data-hangar-tab="bot"]')?.click();
}

export function exitMultiplayer() {
  if (!isMultiLobby()) return;
  cancelWaiting();
  hideSheet();
  $('s-menu')?.classList.remove('is-multi');
  const label = $('jx-multi-label');
  if (label) label.textContent = 'MULTI';
  const botTab = document.querySelector('#lobby-sheet [data-hangar-tab="bot"]');
  if (botTab?.classList.contains('is-active')) document.querySelector('#lobby-sheet [data-hangar-tab="planes"]')?.click();
}

export function openMultiChoices() {
  showChoices();
}

function setPartner(name, aircraft, locked = false) {
  const tag = $('mp-p2-name');
  if (tag) tag.textContent = name;
  const img = $('mp-p2-plane');
  if (img) {
    img.src = `/assets/hangar/${aircraft || 'f18'}.webp`;
    img.classList.toggle('is-locked', locked);
  }
}

function hideSheet() {
  $('mp-sheet')?.classList.add('hidden');
}

function openSheet(html, { closable = true } = {}) {
  const sheet = $('mp-sheet');
  if (!sheet) return null;
  sheet.innerHTML = `<div class="mp-card">${html}</div>`;
  sheet.classList.remove('hidden');
  sheet.onclick = e => { if (closable && e.target === sheet) hideSheet(); };
  return sheet;
}

// Step 1: bot teammate or real teammate.
function showChoices() {
  const f = fr();
  const sheet = openSheet(`
    <div class="mp-title">${f ? 'MULTIJOUEUR' : 'MULTIPLAYER'}</div>
    <div class="mp-sub">${f ? 'Joue en équipe dans la même partie!' : 'Play as a team in the same game!'}</div>
    <button class="mp-choice" type="button" data-mp="bot">
      <span class="mp-ico"><img src="/assets/hangar/${botUpgrades().aircraft}.webp" alt=""><i class="mp-ico-tag">BOT</i></span>
      <span><b>${f ? 'AVEC UN BOT' : 'WITH A BOT'}</b><small>${f ? 'Un avion allié vole et tire avec toi' : 'An allied plane flies and shoots with you'}</small></span>
    </button>
    <button class="mp-choice" type="button" data-mp="real">
      <span class="mp-ico mp-ico-duo"><img src="/assets/hangar/t6.webp" alt=""><img src="/assets/hangar/f18.webp" alt=""></span>
      <span><b>${f ? 'AVEC UN VRAI JOUEUR' : 'WITH A REAL PLAYER'}</b><small>${f ? 'Ton ami te rejoint avec un code' : 'Your friend joins with a code'}</small></span>
    </button>
    <button class="mp-cancel" type="button">${f ? 'Annuler' : 'Cancel'}</button>`);
  sheet.querySelector('[data-mp="bot"]').onclick = () => showLevelPicker(startWithBot, showChoices);
  sheet.querySelector('[data-mp="real"]').onclick = showRealPlayer;
  sheet.querySelector('.mp-cancel').onclick = hideSheet;
}

function botUpgrades() {
  const up = G.botUpgrades || (G.botUpgrades = { aircraft: 't6', planes: ['t6'], fire: 1, hp: BOT_HP_MIN });
  if (!Array.isArray(up.planes)) up.planes = ['t6'];
  if (!up.planes.includes('t6')) up.planes.unshift('t6');
  if (!up.planes.includes(up.aircraft)) up.aircraft = 't6';
  return up;
}

// Every plane the bot can fly (the secret F-117 is not for sale).
function botPlaneList() {
  return Object.keys(AIRCRAFT).filter(id => !AIRCRAFT[id].secret);
}

function refreshCoinsHud() {
  const coins = $('menu-hud-coins');
  if (coins) coins.textContent = (G.coins || 0).toLocaleString();
  const xp = $('menu-hud-xp');
  if (xp) xp.textContent = (G.xp || 0).toLocaleString();
}

// BOT tab of the lobby HANGAR sheet (MULTI mode), laid out like the UPGRADE
// tab: radar screen with ◀︎ ▶︎ to browse the bot's planes (bought with EXP,
// cheaper than the hangar), EQUIP / BUY button, then one bar + row for the
// plane's ability, the bot's LIVES and its FIRE POWER (coins). While it is
// open, "Player 2" on the hangar floor shows the bot's plane.
const HEART_IMG = '/assets/fx/Iteam/heart-full.png';
const SHOT_DEMO_ICON = '<span class="upg-shot-demo" aria-hidden="true"><i class="upg-shot-missile"></i><i class="upg-shot-plane"></i></span>';
const BOT_FIRE_TEXT = {
  fr: ['1 missile', '1 missile, tir +20 %', '2 missiles, tir +20 %', '2 missiles, tir +35 %', '3 missiles, tir +40 %'],
  en: ['1 missile', '1 missile, +20% fire rate', '2 missiles, +20% fire rate', '2 missiles, +35% fire rate', '3 missiles, +40% fire rate'],
};

export function renderBotPanel(body) {
  const f = fr();
  const lang = f ? 'fr' : 'en';
  const up = botUpgrades();
  const planes = botPlaneList();
  if (!planes.includes(_botView)) _botView = up.aircraft;
  const id = _botView;
  const plane = AIRCRAFT[id];
  const owned = up.planes.includes(id);
  const equipped = up.aircraft === id;
  const price = botPlanePrice(id);
  const ability = plane?.ability;
  const coins = G.coins || 0;
  const tier = Math.max(1, Math.ceil(((AIRCRAFT_ORDER.indexOf(id) + 1) / AIRCRAFT_ORDER.length) * 5));
  const typeLabel = TYPE_LABELS[plane.type]?.[lang] || (plane.type || '').toUpperCase();
  const pips = (level, max) =>
    `<span class="upg-pips">${Array.from({ length: max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</span>`;
  const coinPrice = amount => `${amount.toLocaleString()} ${coinIcon('jg-coin-icon-small')}`;
  const levelRow = (kind, icon, name, desc, level, max, cost) => {
    const maxed = cost === undefined;
    return `
      <div class="pi-ability upg-row">
        <span class="pi-ability-icon upg-icon upg-icon-${kind}">${icon}</span>
        <div class="upg-copy">
          <strong>${name}</strong>
          <p>${desc}</p>
          ${pips(level, max)}
        </div>
        <button class="upg-buy ${maxed ? 'is-max' : ''}" type="button" data-buy="${kind}" ${!maxed && coins >= cost ? '' : 'disabled'}>
          ${maxed ? 'MAX' : coinPrice(cost)}
        </button>
      </div>`;
  };

  let actionLabel, actionDisabled = false;
  if (equipped)   { actionLabel = f ? 'BOT ÉQUIPÉ' : 'BOT EQUIPPED'; actionDisabled = true; }
  else if (owned) actionLabel = f ? 'ÉQUIPER LE BOT' : 'EQUIP THE BOT';
  else {
    actionLabel = `${f ? 'ACHETER' : 'BUY'} · ${price.toLocaleString()} <img class="upg-exp-mini" src="${XP_IMG}" alt="EXP">`;
    actionDisabled = (G.xp || 0) < price;
  }
  const nextFire = BOT_FIRE_TEXT[lang][Math.min(up.fire, BOT_FIRE_MAX - 1)];

  body.className = 'jx-panel-body upg-body';
  body.innerHTML = `
    <div class="pi-card upg-card">
      <div class="pi-head">
        <h2 class="pi-title">BOT</h2>
      </div>
      <div class="upg-left">
      <div class="pi-stars" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => `<span class="${i < tier ? 'on' : ''}">${uiIcon('star')}</span>`).join('')}</div>
      <div class="pi-stage">
        <button class="pi-arrow pi-arrow-left" type="button" data-cycle="-1" aria-label="${f ? 'Avion précédent' : 'Previous plane'}">&#9664;&#65038;</button>
        <div class="pi-screen">
          <canvas class="pi-img" data-bot-canvas role="img" aria-label="${plane.name}"></canvas>
          <div class="pi-scanlines" aria-hidden="true"></div>
          <span class="pi-corner pi-corner-tl">${typeLabel}</span>
          <span class="pi-corner pi-corner-bl"><img class="upg-heart-mini" src="${HEART_IMG}" alt=""> ${up.hp} · ${uiIcon('plus')} ${up.fire}</span>
          <span class="pi-corner pi-corner-br">BOT</span>
        </div>
        <button class="pi-arrow pi-arrow-right" type="button" data-cycle="1" aria-label="${f ? 'Avion suivant' : 'Next plane'}">&#9654;&#65038;</button>
      </div>
      <h3 class="pi-bar pi-name">${plane.name}</h3>
      ${owned ? '' : `<p class="pi-text upg-locked">${f
        ? `Prix du hangar : ${(plane.xpCost || 0).toLocaleString()} EXP. Le bot volera en ${AIRCRAFT[up.aircraft]?.name || up.aircraft} en attendant.`
        : `Hangar price: ${(plane.xpCost || 0).toLocaleString()} XP. The bot flies the ${AIRCRAFT[up.aircraft]?.name || up.aircraft} meanwhile.`}</p>`}
      <div class="pi-actions">
        <button class="pi-btn ${equipped ? 'is-equipped' : ''}" type="button" data-bot-action ${actionDisabled ? 'disabled' : ''}>${actionLabel}</button>
      </div>
      </div>
      <div class="upg-scroll">
        <h4 class="pi-bar">${f ? 'CAPACITÉ' : 'ABILITY'}</h4>
        <div class="pi-ability upg-row">
          <span class="pi-ability-icon upg-icon upg-icon-ability">${uiIcon(ability?.icon || 'plane')}</span>
          <div class="upg-copy">
            <strong>${ability?.name?.[lang] || ''}</strong>
            <p>${ability?.description?.[lang] || ''}</p>
          </div>
        </div>
        <h4 class="pi-bar">${f ? 'VIES DU BOT' : 'BOT LIVES'}</h4>
        ${levelRow('hp', `<img class="upg-heart" src="${HEART_IMG}" alt="">`,
          f ? `+1 VIE (${up.hp - BOT_HP_MIN}/${BOT_HP_MAX - BOT_HP_MIN})` : `+1 LIFE (${up.hp - BOT_HP_MIN}/${BOT_HP_MAX - BOT_HP_MIN})`,
          f ? `Le bot a ${up.hp} cœurs. 3 bonnes réponses lui rendent toutes ses vies.`
            : `The bot has ${up.hp} hearts. 3 correct answers refill them all.`,
          up.hp - BOT_HP_MIN, BOT_HP_MAX - BOT_HP_MIN, BOT_HP_COST[up.hp + 1])}
        <h4 class="pi-bar">${f ? 'PUISSANCE DE FEU' : 'FIRE POWER'}</h4>
        ${levelRow('fire', SHOT_DEMO_ICON,
          f ? `PUISSANCE (${up.fire - 1}/${BOT_FIRE_MAX - 1})` : `POWER (${up.fire - 1}/${BOT_FIRE_MAX - 1})`,
          up.fire < BOT_FIRE_MAX
            ? (f ? `Prochain niveau : ${nextFire}.` : `Next level: ${nextFire}.`)
            : BOT_FIRE_TEXT[lang][BOT_FIRE_MAX - 1] + '.',
          up.fire - 1, BOT_FIRE_MAX - 1, BOT_FIRE_COST[up.fire + 1])}
      </div>
    </div>`;

  const canvas = body.querySelector('[data-bot-canvas]');
  if (canvas) paintPlaneInfoFisheye(canvas, `/assets/hangar/${id}.webp`, !owned);

  const rerender = () => renderBotPanel(body);
  body.querySelectorAll('[data-cycle]').forEach(btn => {
    btn.onclick = () => {
      const i = planes.indexOf(_botView);
      _botView = planes[(i + Number(btn.dataset.cycle) + planes.length) % planes.length];
      rerender();
    };
  });
  body.querySelectorAll('[data-buy]').forEach(btn => {
    btn.onclick = () => {
      const key = btn.dataset.buy;
      const next = up[key] + 1;
      const cost = (key === 'fire' ? BOT_FIRE_COST : BOT_HP_COST)[next];
      if (cost === undefined) return;
      if ((G.coins || 0) < cost) { SFX.noMoney(); return; }
      SFX.buy();
      G.coins -= cost;
      up[key] = next;
      save('coins', G.coins);
      save('botUpgrades', up);
      refreshCoinsHud();
      rerender();
    };
  });
  body.querySelector('[data-bot-action]')?.addEventListener('click', () => {
    if (!up.planes.includes(id)) {
      if ((G.xp || 0) < price) { SFX.noMoney(); return; }
      SFX.buy();
      G.xp -= price;
      up.planes.push(id);
      save('xp', G.xp);
    }
    up.aircraft = id;
    save('botUpgrades', up);
    refreshCoinsHud();
    rerender();
  });
  setPartner('BOT', id, !owned);
}

// Called by hangar.js after each tab render: "Player 2" goes back to the
// generic teammate when another tab is shown.
export function onHangarTabShown(tab) {
  if (tab !== 'bot' && isMultiLobby()) setPartner(fr() ? 'Joueur 2' : 'Player 2', 'f18');
}

function startWithBot(level) {
  hideSheet();
  const up = botUpgrades();
  G.coopSession = {
    mode: 'bot', partnerName: 'BOT', partnerAircraft: up.aircraft,
    fireLevel: up.fire, maxHp: up.hp,
  };
  _nav.toGame(level);
}

// Pick the level on the solo level map (same worlds, same unlocked levels).
// Back returns to the MULTI lobby with the given sheet reopened.
function showLevelPicker(onPick, onBack) {
  hideSheet();
  _nav.toMapPicker(onPick, () => { _nav.toMulti(); onBack?.(); });
}

// Step 2: create a game (get a code) or join with a code.
function showRealPlayer() {
  const f = fr();
  const sheet = openSheet(`
    <div class="mp-title">${f ? 'VRAI JOUEUR' : 'REAL PLAYER'}</div>
    <button class="mp-choice" type="button" data-mp="host">
      <span class="mp-ico mp-ico-plus" aria-hidden="true"></span>
      <span><b>${f ? 'CRÉER UNE PARTIE' : 'CREATE A GAME'}</b><small>${f ? 'Tu reçois un code à donner à ton ami' : 'You get a code to give your friend'}</small></span>
    </button>
    <div class="mp-join">
      <label for="mp-code">${f ? 'REJOINDRE AVEC UN CODE' : 'JOIN WITH A CODE'}</label>
      <div class="mp-join-row">
        <input id="mp-code" class="mp-code" type="text" autocomplete="off" autocapitalize="characters"
          spellcheck="false" maxlength="${CODE_MAX}" placeholder="4KNDJW">
        <button class="mp-go" type="button" disabled>${f ? 'REJOINDRE' : 'JOIN'}</button>
      </div>
      <small class="mp-hint">${f ? `Code de ${CODE_MIN} à ${CODE_MAX} caractères` : `${CODE_MIN} to ${CODE_MAX} characters`}</small>
    </div>
    <button class="mp-cancel" type="button">${f ? '← Retour' : '← Back'}</button>`);
  const input = sheet.querySelector('#mp-code');
  const go = sheet.querySelector('.mp-go');
  const valid = () => input.value.length >= CODE_MIN && input.value.length <= CODE_MAX;
  input.addEventListener('input', () => {
    input.value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_MAX);
    go.disabled = !valid();
  });
  const join = () => { if (valid()) joinGame(input.value); };
  go.onclick = join;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') join(); });
  sheet.querySelector('[data-mp="host"]').onclick = () => showLevelPicker(createGame, showRealPlayer);
  sheet.querySelector('.mp-cancel').onclick = showChoices;
}

/* global __BUILD_ID__ */
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev';

// Live connection status under the waiting text (coop-realtime.js steps).
function coopStatusText(step, info = {}) {
  const f = fr();
  switch (step) {
    case 'connecting': return f ? 'Connexion au réseau…' : 'Connecting…';
    case 'connected': return f ? 'Connecté ✓' : 'Connected ✓';
    case 'searching': return f
      ? `Connecté ✓ · partie pas encore trouvée (${info.seconds} s)`
      : `Connected ✓ · game not found yet (${info.seconds}s)`;
    case 'host_seen': return f
      ? `Partie trouvée ✓ · en attente de la réponse de ton ami (${info.seconds} s)`
      : `Game found ✓ · waiting for your friend to answer (${info.seconds}s)`;
    case 'join_request': return f ? `${info.name} essaie de te rejoindre…` : `${info.name} is trying to join…`;
    default: return '';
  }
}

function showWaiting(title, text, code = '', note = '') {
  const f = fr();
  const sheet = openSheet(`
    <div class="mp-title">${title}</div>
    ${code ? `<div class="mp-bigcode">${code}</div>` : ''}
    <div class="mp-wait"><span class="mp-dots"><i></i><i></i><i></i></span>${text}</div>
    <div class="mp-status" aria-live="polite">${_lastStatus}</div>
    <div class="mp-build">v ${BUILD_ID}</div>
    ${note ? `<div class="mp-error">${note}</div>
      <button class="mp-choice mp-choice-small" type="button" data-mp="relevel">${f ? 'CHANGER DE NIVEAU' : 'CHANGE LEVEL'}</button>` : ''}
    <button class="mp-cancel" type="button">${f ? 'Annuler' : 'Cancel'}</button>`, { closable: false });
  sheet.querySelector('.mp-cancel').onclick = () => { cancelWaiting(); showRealPlayer(); };
  sheet.querySelector('[data-mp="relevel"]')?.addEventListener('click', () => {
    cancelWaiting();
    showLevelPicker(createGame, showRealPlayer);
  });
}

function showHostCode(note = '') {
  showWaiting(fr() ? 'TON CODE' : 'YOUR CODE',
    fr() ? `Niveau ${_hostLevel}. Donne ce code à ton ami, puis reviens ici : garde JexonGo ouvert à l’écran. En attente de ton coéquipier...`
      : `Level ${_hostLevel}. Give this code to your friend, then come back here: keep JexonGo open on screen. Waiting for your teammate...`, _hostCode, note);
}

function showError(text) {
  const f = fr();
  const sheet = openSheet(`
    <div class="mp-title">${f ? 'OUPS!' : 'OOPS!'}</div>
    <div class="mp-error">${text}</div>
    <button class="mp-choice mp-choice-small" type="button">${f ? 'RÉESSAYER' : 'TRY AGAIN'}</button>`);
  sheet.querySelector('.mp-choice').onclick = showRealPlayer;
}

let _lastStatus = '';
function ensureHandlers() {
  if (_handlersReady) return;
  _handlersReady = true;
  wsOn('coop_progress', ({ step, ...info }) => {
    if (!_waiting) return;
    _lastStatus = coopStatusText(step, info);
    const el = document.querySelector('#mp-sheet .mp-status');
    if (el) el.textContent = _lastStatus;
  });
  wsOn('coop_created', ({ code }) => {
    if (!_waiting) return;
    _hostCode = code;
    showHostCode();
  });
  // A friend tried our code but hasn't unlocked our level: the game stays open.
  wsOn('coop_join_refused', ({ name, level, maxLevel }) => {
    if (!_waiting || !_hostCode) return;
    showHostCode(fr()
      ? `${name} n'a pas encore débloqué le niveau ${level} (il est rendu au niveau ${maxLevel}). Les 2 joueurs doivent avoir débloqué le niveau.`
      : `${name} hasn't unlocked level ${level} yet (reached level ${maxLevel}). Both players need the level unlocked.`);
  });
  wsOn('coop_locked', ({ level, hostName }) => {
    if (!_waiting) return;
    _waiting = false;
    wsDisconnect();
    showError(fr()
      ? `${hostName || 'Ton ami'} joue au niveau ${level}, mais tu ne l'as pas encore débloqué. Vous devez avoir débloqué le même niveau pour jouer ensemble.`
      : `${hostName || 'Your friend'} is playing level ${level}, but you haven't unlocked it yet. You both need that level unlocked to play together.`);
  });
  // Supabase Realtime could not be reached (offline, blocked network).
  wsOn('coop_unavailable', () => {
    if (!_waiting) return;
    _waiting = false;
    showError(fr() ? 'Connexion impossible. Vérifie Internet et réessaie.' : 'Could not connect. Check your Internet and try again.');
  });
  wsOn('coop_invalid', () => {
    if (!_waiting) return;
    _waiting = false;
    wsDisconnect();
    showError(fr()
      ? 'Aucune partie trouvée avec ce code. Vérifie chaque caractère, et que ton ami a JexonGo ouvert sur l’écran du code.'
      : 'No game found with this code. Check each character, and that your friend has JexonGo open on the code screen.');
  });
  wsOn('coop_start', msg => {
    if (!_waiting) return;
    _waiting = false;
    setPartner(msg.partnerName || 'PILOT', msg.partnerAircraft);
    G.coopSession = { mode: 'online', partnerName: msg.partnerName, partnerAircraft: msg.partnerAircraft };
    showWaiting(fr() ? "C'EST PARTI!" : "LET'S GO!",
      fr() ? `${msg.partnerName} est ton coéquipier!` : `${msg.partnerName} is your teammate!`);
    setTimeout(() => { hideSheet(); _nav.toGame(Number(msg.level) || 1); }, 1400);
  });
}

async function connect() {
  ensureHandlers();
  try {
    await wsConnect();
    return true;
  } catch (_) {
    _waiting = false;
    showError(fr() ? 'Serveur indisponible. Réessaie plus tard.' : 'Server unavailable. Try again later.');
    return false;
  }
}

async function createGame(level) {
  _lastStatus = '';
  _hostLevel = level;
  _hostCode = '';
  if ($('s-menu')?.classList.contains('hidden')) _nav.toMulti();   // back from the level map
  _waiting = true;
  showWaiting(fr() ? 'CRÉATION...' : 'CREATING...', fr() ? 'Connexion au serveur' : 'Connecting to the server');
  if (!(await connect()) || !_waiting) return;
  wsSend({ type: 'coop_create', name: publicPilotName(G.playerName, 14), aircraft: G.activeAircraft, level: _hostLevel });
}

async function joinGame(code) {
  _lastStatus = '';
  _waiting = true;
  showWaiting(fr() ? 'CONNEXION...' : 'JOINING...', fr()
    ? 'Recherche de la partie. Ton ami doit avoir JexonGo ouvert à l’écran.'
    : 'Looking for the game. Your friend must have JexonGo open on screen.');
  if (!(await connect()) || !_waiting) return;
  wsSend({ type: 'coop_join', code, name: publicPilotName(G.playerName, 14), aircraft: G.activeAircraft, maxLevel: maxUnlockedLevel() });
}

function cancelWaiting() {
  if (!_waiting) return;
  _waiting = false;
  wsSend({ type: 'coop_leave' });
  wsDisconnect();
}
