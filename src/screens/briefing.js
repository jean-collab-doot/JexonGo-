import { $ } from '../utils/dom.js';
import { uiIcon } from '../utils/icons.js';
import { getLevel, equationExampleForLevel } from '../data/levels.js';
import { getPilotInfo, getPilotGrade, getPilotGradeRank } from '../data/pilots.js';
import { rankInsigniaSVG } from '../utils/rank-insignia.js';
import { G } from '../state.js';
import { chosenBasicOpsForLevel, chosenExtraOps } from '../systems/question-topics.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { t, tOp, getLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';
import { getLevelMapPicker, setLevelMapPicker } from './levelmap.js';

let _nav = null;
let _levelNum = 1;

function localizedGradeName(grade) {
  const keyByName = {
    'AIR ACE': 'pilotAirAce',
    GENERAL: 'pilotGeneral',
    COLONEL: 'pilotColonel',
    MAJOR: 'pilotMajor',
    CAPTAIN: 'pilotCaptain',
    LIEUTENANT: 'pilotLt',
    '2ND LT': 'pilot2ndLt',
    CADET: 'pilotCadet',
  };
  return t(keyByName[grade.name] || '') || grade.name;
}

export function initBriefing(nav) {
  _nav = nav;
  // MULTI (level map in pick mode): back returns to that map, fly starts the
  // co-op game (bot, or creates the code for a real teammate).
  $('btn-briefing-back').onclick = () => {
    const picker = getLevelMapPicker();
    if (picker) _nav.toMapPicker(picker.onPick, picker.onBack);
    else _nav.toMap();
  };
  $('btn-briefing-fly').onclick = () => {
    SFX.takeoff?.();
    const picker = getLevelMapPicker();
    if (picker) { setLevelMapPicker(null); picker.onPick(_levelNum); return; }
    _nav.toGame(_levelNum);
  };
}

export function showBriefing(levelNum) {
  _levelNum = levelNum;

  const levelCfg = getLevel(levelNum);
  const pilotInfo = getPilotInfo(G.totalXpEarned || G.xp || 0);
  const grade = getPilotGrade(G.highestLevel || 0);
  const isFr = getLang() === 'fr';

  const biomeName = isFr ? levelCfg.colors.labelFr : levelCfg.colors.label;
  const locationName = isFr ? levelCfg.location.nameFr : levelCfg.location.name;
  const weather = levelCfg.weather;
  const weatherName = isFr ? weather.labelFr : weather.label;
  const weatherDesc = isFr ? weather.descFr : weather.desc;
  $('briefing-mission-title').textContent = `MISSION ${levelNum} · ${biomeName}`;

  // Equations really asked (same rule as the game, systems/question-topics.js):
  // only the pilot's chosen ones (+ - x / inside this level's set when some
  // are in it, plus exponent / algebra); nothing chosen = the level's set
  // limited by school grade.
  const chosenBasics = chosenBasicOpsForLevel(levelCfg.ops);
  const extras = chosenExtraOps();
  const gradeOps = GRADE_OPS[G.playerGrade];
  const byGrade = gradeOps ? levelCfg.ops.filter(op => gradeOps.includes(op)) : levelCfg.ops;
  const opsToShow = chosenBasics.length || extras.length
    ? [...chosenBasics, ...extras]
    : (byGrade.length ? byGrade : ['+']);

  $('briefing-story').innerHTML = briefingStory(levelNum, levelCfg, opsToShow, locationName, weatherName, isFr);
  $('briefing-time').textContent = `${answerSeconds(levelCfg)}${t('secPerQ')}`;
  $('briefing-location').textContent = locationName;
  $('briefing-weather-icon').innerHTML = uiIcon(weather.icon);
  $('briefing-weather-icon').style.color = weather.color;
  $('briefing-weather').textContent = `${weatherName} — ${weatherDesc}`;

  const timeLabelEl = document.querySelector('.briefing-cond-label[data-key="timeLimit"]');
  if (timeLabelEl) timeLabelEl.textContent = t('timeLimit');
  const mathLabelEl = document.querySelector('.briefing-cond-label[data-key="mathType"]');
  if (mathLabelEl) mathLabelEl.textContent = t('mathType');
  const flyBtn = $('btn-briefing-fly');
  if (flyBtn) flyBtn.textContent = t('fly');

  const opSymbols = { '+': '+', '-': '-', '*': 'x', '/': '/', '^': 'x²', alg: 'x=?' };
  $('briefing-ops').textContent = opsToShow
    .map(op => `${opSymbols[op] || op} ${tOp(op)}`)
    .join('  ');

  // The sample equation must use the same operations actually shown above
  // (and actually asked in-game) — not the level's raw default ops — so it
  // never contradicts the MATH TYPE row when a focus operation is active.
  const example = equationExampleForLevel(levelNum, opsToShow, levelCfg.mathCap, levelCfg.mathMultCap);
  $('briefing-example').textContent = example.text;

  $('briefing-pilot-avatar').innerHTML = rankInsigniaSVG(getPilotGradeRank(grade), grade.color);
  $('briefing-pilot-avatar').style.color = grade.color;
  $('briefing-pilot-name').textContent = localizedGradeName(grade);
  $('briefing-pilot-name').style.color = grade.color;

  const descEl = $('briefing-pilot-desc');
  if (descEl) descEl.textContent = t(`pilotTierDesc_${pilotInfo.tier.id}`) || pilotInfo.tier.desc;

  const starCritEl = $('briefing-star-criteria');
  if (starCritEl) {
    const existing = G.levelStars[levelNum] || 0;
    starCritEl.innerHTML = `
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 1 ? 'bsc-earned' : ''}">${uiIcon('star')}</span>
        <span class="bsc-desc">${t('briefingStarComplete')}</span>
      </div>
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 2 ? 'bsc-earned' : ''}">${uiIcon('star')}</span>
        <span class="bsc-desc">${t('briefingStarAccuracy')}</span>
      </div>
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 3 ? 'bsc-earned' : ''}">${uiIcon('star')}</span>
        <span class="bsc-desc">${t('briefingStarPerfect')}</span>
      </div>
    `;
  }
}

// ── Mission text ────────────────────────────────────────────────────────────
// Written from what the level really does in game.js, so keep them in sync:
// enemy mix (RANDOM_ENEMY_TYPES: every type on every level), answer time
// (level time + weather + player bonuses), boss attacks, chests, airdrops.

const BOSS_BRIEF = {
  10: { name: 'A330',
    fr: 'Son bouclier bloque tes missiles 5 secondes sur 10. Quand il tombe, il tire 3 missiles : esquive, puis frappe.',
    en: 'Its shield blocks your missiles 5 seconds out of 10. When it drops, it fires 3 missiles: dodge, then strike.' },
  20: { name: 'B-52',
    fr: 'Sa tourelle laser suit ton avion pendant 5 secondes, puis se repose 10 secondes. Profite de la pause.',
    en: 'Its laser turret tracks your plane for 5 seconds, then rests for 10. Use the pause.' },
  30: { name: 'KAWASAKI C-2',
    fr: 'Ses tourelles laser te suivent 5 secondes, puis se reposent 10 secondes. Reste en mouvement.',
    en: 'Its laser turrets track you for 5 seconds, then rest for 10. Keep moving.' },
  40: { name: 'C-5 GALAXY',
    fr: 'Sa tourelle arrière te suit dans le blizzard 5 secondes, puis se repose 10 secondes.',
    en: 'Its rear turret tracks you through the blizzard for 5 seconds, then rests for 10.' },
  50: { name: 'NAVETTE STS', nameEn: 'SPACE SHUTTLE',
    fr: 'Combat final : sa tourelle verrouille ta position 5 secondes, puis se repose 10 secondes.',
    en: 'Final battle: its turret locks onto you for 5 seconds, then rests for 10.' },
};

// Same operations per school grade as game.js REASONABLE_GRADE_PROFILES.
const GRADE_OPS = { 1: ['+'], 2: ['+', '-'], 3: ['+', '-', '*'], 4: ['+', '-', '*', '/'], 5: ['+', '-', '*', '/'], 6: ['+', '-', '*', '/'] };

const OP_NAMES = {
  '+': ['addition', 'addition'], '-': ['soustraction', 'subtraction'],
  '*': ['multiplication', 'multiplication'], '/': ['division', 'division'],
  '^': ['exposant', 'exponent'], alg: ['algèbre', 'algebra'],
};
// Level where each operation first appears (data/levels.js opsForLevel).
const OP_FIRST_LEVEL = { '-': 16, '*': 26, '/': 36 };

// Seconds per question as the game sets them (game.js startTimer).
function answerSeconds(levelCfg) {
  let s = levelCfg.timeLimit + (levelCfg.weather?.timeMod || 0);
  if (G.likesMath === false) s += 4;
  if (G.pendingPlacement) s += 2;
  if (G.activeBadge === 'lightning_reflex') s += 5;
  s += AIRCRAFT[G.activeAircraft]?.ability?.extraAnswerTime || 0;
  return Math.max(3, s);
}

// Questions in a normal level (game.js applyOnboardingLevelLength).
function questionCount(levelCfg) {
  if (G.onboardingLevelLength === 'short') return Math.max(3, levelCfg.questionCount - 2);
  if (G.onboardingLevelLength === 'long') return levelCfg.questionCount + 2;
  return levelCfg.questionCount;
}

// "de" before a French word, elided before a vowel (d’addition).
function deFr(word) {
  return /^[aeiouyhéè]/i.test(word) ? `d’${word}` : `de ${word}`;
}

function listJoin(items, isFr) {
  if (items.length < 2) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${isFr ? 'et' : 'and'} ${items[items.length - 1]}`;
}

function briefingStory(n, cfg, ops, locationName, weatherName, isFr) {
  const L = isFr ? 0 : 1;
  const opText = listJoin(ops.map(op => OP_NAMES[op]?.[L] || op), isFr);
  // French: "d’addition et d’algèbre" ("de" before each word).
  const opTextDe = isFr ? listJoin(ops.map(op => deFr(OP_NAMES[op]?.[0] || op)), true) : opText;
  const secs = answerSeconds(cfg);
  const sky = weatherName.toLowerCase();
  const lines = [];

  // 1. Where, what to answer, who to fight.
  if (cfg.isBossLevel) {
    const boss = BOSS_BRIEF[n];
    const bossName = isFr ? boss.name : (boss.nameEn || boss.name);
    lines.push(isFr
      ? `Destination : ${locationName}, météo : ${sky}. Le boss <b>${bossName}</b> t’attend. ${boss.fr}`
      : `Destination: ${locationName}, weather: ${sky}. The boss <b>${bossName}</b> is waiting. ${boss.en}`);
    lines.push(isFr
      ? `Questions ${opTextDe}, ${secs} s chacune : chaque bonne réponse ouvre une fenêtre de tir. Elles continuent jusqu’à ce qu’il tombe, avec des escortes autour de lui.`
      : `${opText.charAt(0).toUpperCase()}${opText.slice(1)} questions, ${secs}s each: every right answer opens a firing window. They keep coming until it falls, with escorts around it.`);
  } else {
    lines.push(isFr
      ? `Destination : ${locationName}, météo : ${sky}. ${questionCount(cfg)} questions ${opTextDe}, ${secs} s chacune : chaque bonne réponse ouvre une fenêtre de tir.`
      : `Destination: ${locationName}, weather: ${sky}. ${questionCount(cfg)} ${opText} questions, ${secs}s each: every right answer opens a firing window.`);
    lines.push(isFr
      ? `Ennemis : F-15 (certains avec missile à tête chercheuse), F-5 en formations et kamikazes${n >= 20 ? ' (jusqu’à deux à la fois)' : ''}, Eurofighter, F-14 au laser et hélicoptères Apache.`
      : `Enemies: F-15s (some with homing missiles), F-5 formations and kamikazes${n >= 20 ? ' (up to two at once)' : ''}, Eurofighters, laser F-14s and Apache helicopters.`);
  }

  // 2. What is new on this level.
  const news = [];
  for (const [op, lvl] of Object.entries(OP_FIRST_LEVEL)) {
    if (n === lvl && ops.includes(op)) news.push(isFr ? `première mission avec la ${OP_NAMES[op][0]}` : `first mission with ${OP_NAMES[op][1]}`);
  }
  if (n > 1 && n % 10 === 1) news.push(isFr ? 'nouveau territoire' : 'new territory');
  if (n === 20) news.push(isFr ? 'les F-5 kamikazes peuvent arriver à deux' : 'kamikaze F-5s can come in pairs');
  if (news.length) {
    const txt = news.join(', ');
    lines.push(`<span class="briefing-new">${isFr ? 'NOUVEAU' : 'NEW'}</span> ${txt.charAt(0).toUpperCase()}${txt.slice(1)}.`);
  }

  // 3. Rewards.
  const reward = cfg.isBossLevel
    ? (isFr ? 'un coffre en battant le boss' : 'a chest for beating the boss')
    : cfg.isChestLevel ? (isFr ? 'un coffre à la fin' : 'a chest at the end') : '';
  lines.push(isFr
    ? `Ramasse ${cfg.mapCoinCount} pièces${reward ? ` et gagne ${reward}` : ''}. Un largage peut tomber du ciel : tire dessus pour obtenir un gadget.`
    : `Collect ${cfg.mapCoinCount} coins${reward ? ` and win ${reward}` : ''}. An airdrop may fall from the sky: shoot it to get a gadget.`);

  return lines.map(line => `<p>${line}</p>`).join('');
}
