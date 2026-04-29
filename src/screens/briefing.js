import { $ } from '../utils/dom.js';
import { getLevel } from '../data/levels.js';
import { getStory } from '../data/story.js';
import { getPilotInfo, getPilotGrade } from '../data/pilots.js';
import { G } from '../state.js';
import { t, tOp, getLang } from '../i18n.js';

let _nav = null;
let _levelNum = 1;

export function initBriefing(nav) {
  _nav = nav;
  $('btn-briefing-back').onclick = () => _nav.toMap();
  $('btn-briefing-fly').onclick  = () => _nav.toGame(_levelNum);
}

export function showBriefing(levelNum) {
  _levelNum = levelNum;

  const levelCfg  = getLevel(levelNum);
  const story      = getStory(levelNum);
  const pilotInfo  = getPilotInfo(G.totalXpEarned || G.xp || 0);
  const grade      = getPilotGrade(G.highestLevel || 0);

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

  const opSymbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const opsLabel  = levelCfg.ops.map(op => opSymbols[op] || op).join('  ');
  $('briefing-ops').textContent = opsLabel;

  // Pilot avatar & grade
  $('briefing-pilot-avatar').textContent  = grade.emoji;
  $('briefing-pilot-avatar').style.color  = grade.color;
  $('briefing-pilot-avatar').style.textShadow = `0 0 18px ${grade.color}`;
  $('briefing-pilot-name').textContent    = grade.name;
  $('briefing-pilot-name').style.color    = grade.color;

  const descEl = $('briefing-pilot-desc');
  if (descEl) descEl.textContent = pilotInfo.tier.desc;

  // ── Star achievement criteria ─────────────────────────────────────────────
  const starCritEl = $('briefing-star-criteria');
  if (starCritEl) {
    const existing = G.levelStars[levelNum] || 0;
    starCritEl.innerHTML = `
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 1 ? 'bsc-earned' : ''}">★</span>
        <span class="bsc-desc">Complete the level</span>
      </div>
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 2 ? 'bsc-earned' : ''}">★</span>
        <span class="bsc-desc">70%+ correct answers</span>
      </div>
      <div class="bsc-row">
        <span class="bsc-star ${existing >= 3 ? 'bsc-earned' : ''}">★</span>
        <span class="bsc-desc">100% correct + never hit</span>
      </div>
    `;
  }
}
