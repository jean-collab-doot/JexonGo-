import { $ } from '../utils/dom.js';
import { getLevel } from '../data/levels.js';
import { getWeatherForLevel } from '../data/weather.js';
import { getStory } from '../data/story.js';
import { getPilotInfo } from '../data/pilots.js';
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

  const levelCfg = getLevel(levelNum);
  const weather  = getWeatherForLevel(levelNum);
  const story    = getStory(levelNum);
  const pilotInfo = getPilotInfo(G.xp || 0);

  // Mission title & story (use French versions when lang is FR)
  const isFr = getLang() === 'fr';
  $('briefing-mission-title').textContent = isFr ? (story.titleFr || story.title) : story.title;
  $('briefing-story').textContent = isFr ? (story.textFr || story.text) : story.text;

  // Weather
  $('briefing-weather-icon').textContent  = weather.icon;
  $('briefing-weather-label').textContent = weather.label;
  $('briefing-weather-desc').textContent  = weather.desc;

  // Apply weather color to icon
  $('briefing-weather-icon').style.color = weather.color;

  // Time limit (adjusted by weather timeMod)
  const adjustedTime = Math.max(5, levelCfg.timeLimit + (weather.timeMod || 0));
  $('briefing-time').textContent = `${adjustedTime}${t('secPerQ')}`;

  // Static condition labels
  const timeLabelEl = document.querySelector('.briefing-cond-label[data-key="timeLimit"]');
  if (timeLabelEl) timeLabelEl.textContent = t('timeLimit');
  const mathLabelEl = document.querySelector('.briefing-cond-label[data-key="mathType"]');
  if (mathLabelEl) mathLabelEl.textContent = t('mathType');
  const flyBtn = $('btn-briefing-fly');
  if (flyBtn) flyBtn.textContent = t('fly');

  // Math operations
  const opSymbols = { '+': '+', '-': '−', '*': '×', '/': '÷' };
  const opsLabel = levelCfg.ops.map(op => opSymbols[op] || op).join('  ');
  $('briefing-ops').textContent = opsLabel;

  // Pilot avatar & name
  const { tier } = pilotInfo;
  $('briefing-pilot-avatar').textContent = tier.avatar;
  $('briefing-pilot-avatar').style.color = tier.color;
  $('briefing-pilot-avatar').style.textShadow = `0 0 18px ${tier.color}`;
  $('briefing-pilot-name').textContent = tier.name;
  $('briefing-pilot-name').style.color = tier.color;

  // Pilot desc (if element exists)
  const descEl = $('briefing-pilot-desc');
  if (descEl) {
    descEl.textContent = tier.desc;
  }
}
