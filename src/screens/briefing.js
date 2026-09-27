import { $ } from '../utils/dom.js';
import { uiIcon } from '../utils/icons.js';
import { getLevel, equationExampleForLevel } from '../data/levels.js';
import { getPilotInfo, getPilotGrade, getPilotGradeRank } from '../data/pilots.js';
import { rankInsigniaSVG } from '../utils/rank-insignia.js';
import { G } from '../state.js';
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

  const operationNames = levelCfg.ops.map(op => ({ '+': isFr ? 'addition' : 'addition', '-': isFr ? 'soustraction' : 'subtraction', '*': isFr ? 'multiplication' : 'multiplication', '/': isFr ? 'division' : 'division' }[op])).join(', ');
  const enemyNames = [...new Set(levelCfg.enemyTypes)].map(type => ({ basic: isFr ? 'chasseurs' : 'fighters', fast: isFr ? 'avions rapides' : 'fast aircraft', tank: isFr ? 'hélicoptères blindés' : 'armored helicopters', turner: isFr ? 'Mirages' : 'Mirages', interceptor: isFr ? 'intercepteurs F-14' : 'F-14 interceptors', boss: 'boss' }[type] || type)).join(', ');
  const biomeName = isFr ? levelCfg.colors.labelFr : levelCfg.colors.label;
  const locationName = isFr ? levelCfg.location.nameFr : levelCfg.location.name;
  const weather = levelCfg.weather;
  const weatherName = isFr ? weather.labelFr : weather.label;
  const weatherDesc = isFr ? weather.descFr : weather.desc;
  $('briefing-mission-title').textContent = isFr ? `MISSION ${levelNum} · ${biomeName}` : `MISSION ${levelNum} · ${biomeName}`;
  const chestClause = levelCfg.isBossLevel
    ? (isFr ? ' et vaincs le boss pour obtenir le coffre' : ', defeat the boss and earn the chest')
    : levelCfg.isChestLevel
      ? (isFr ? ' et obtiens un coffre en fin de mission' : ', and earn a chest at the end of the mission')
      : '';
  $('briefing-story').textContent = isFr
    ? `Survole ${locationName} sous ${weatherName.toLowerCase()}. ${levelCfg.questionCount} questions de ${operationNames}, ${levelCfg.timeLimit} s chacune. Affronte ${enemyNames}, récupère ${levelCfg.mapCoinCount} pièces${chestClause}.`
    : `Fly over ${locationName} under ${weatherName.toLowerCase()}. ${levelCfg.questionCount} ${operationNames} questions, ${levelCfg.timeLimit}s each. Fight ${enemyNames}, collect ${levelCfg.mapCoinCount} coins${chestClause}.`;
  $('briefing-time').textContent = `${levelCfg.timeLimit}${t('secPerQ')}`;
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

  const configuredOps = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  // The "weak topic" focus can only narrow the level's own operations — it
  // must never show/ask an operation this level hasn't unlocked yet (this
  // mirrors applyGradeToQuestion()/applyOnboardingFocus() in game.js, so the
  // briefing always matches what will actually be asked in-game).
  const focusInLevel = configuredOps.filter(op => levelCfg.ops.includes(op));
  const opsToShow = focusInLevel.length ? focusInLevel : levelCfg.ops;
  const opSymbols = { '+': '+', '-': '-', '*': 'x', '/': '/' };
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
