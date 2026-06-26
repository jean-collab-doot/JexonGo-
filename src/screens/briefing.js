import { $ } from '../utils/dom.js';
import { getLevel } from '../data/levels.js';
import { getStory } from '../data/story.js';
import { getPilotInfo, getPilotGrade } from '../data/pilots.js';
import { G } from '../state.js';
import { t, tOp, getLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';

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
  $('btn-briefing-back').onclick = () => _nav.toMap();
  $('btn-briefing-fly').onclick = () => { SFX.chooseLevel?.(); _nav.toGame(_levelNum); };
}

export function showBriefing(levelNum) {
  _levelNum = levelNum;

  const levelCfg = getLevel(levelNum);
  const story = getStory(levelNum);
  const pilotInfo = getPilotInfo(G.totalXpEarned || G.xp || 0);
  const grade = getPilotGrade(G.highestLevel || 0);
  const isFr = getLang() === 'fr';

  $('briefing-mission-title').textContent = isFr ? (story.titleFr || story.title) : story.title;
  $('briefing-story').textContent = isFr ? (story.textFr || story.text) : story.text;
  $('briefing-time').textContent = `${levelCfg.timeLimit}${t('secPerQ')}`;

  const timeLabelEl = document.querySelector('.briefing-cond-label[data-key="timeLimit"]');
  if (timeLabelEl) timeLabelEl.textContent = t('timeLimit');
  const mathLabelEl = document.querySelector('.briefing-cond-label[data-key="mathType"]');
  if (mathLabelEl) mathLabelEl.textContent = t('mathType');
  const flyBtn = $('btn-briefing-fly');
  if (flyBtn) flyBtn.textContent = t('fly');

  const configuredOps = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  const opsToShow = configuredOps.length ? configuredOps : levelCfg.ops;
  const opSymbols = { '+': '+', '-': '-', '*': 'x', '/': '/' };
  $('briefing-ops').textContent = opsToShow
    .map(op => `${opSymbols[op] || op} ${tOp(op)}`)
    .join('  ');

  $('briefing-pilot-avatar').textContent = grade.emoji;
  $('briefing-pilot-avatar').style.color = grade.color;
  $('briefing-pilot-avatar').style.textShadow = `0 0 18px ${grade.color}`;
  $('briefing-pilot-name').textContent = localizedGradeName(grade);
  $('briefing-pilot-name').style.color = grade.color;

  const descEl = $('briefing-pilot-desc');
  if (descEl) descEl.textContent = t(`pilotTierDesc_${pilotInfo.tier.id}`) || pilotInfo.tier.desc;

  const starCritEl = $('briefing-star-criteria');
  if (starCritEl) {
    const existing = G.levelStars[levelNum] || 0;
    starCritEl.innerHTML = `
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 1 ? 'bsc-earned' : ''}">&#9733;</span>
        <span class="bsc-desc">${t('briefingStarComplete')}</span>
      </div>
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 2 ? 'bsc-earned' : ''}">&#9733;</span>
        <span class="bsc-desc">${t('briefingStarAccuracy')}</span>
      </div>
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 3 ? 'bsc-earned' : ''}">&#9733;</span>
        <span class="bsc-desc">${t('briefingStarPerfect')}</span>
      </div>
    `;
  }
}
