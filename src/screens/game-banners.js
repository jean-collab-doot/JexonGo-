// Banners between the countdown and play (moved out of screens/game.js):
// DÉPART / START, ALERTE BOSS on boss levels, MODE PRATIQUE in practice.
// game.js passes its sound proxy (setBannerSounds) so the game's sound rules
// apply, and stillCurrent() so a banner of a game that was left does not go on.
import { $ } from '../utils/dom.js';
import { uiIcon } from '../utils/icons.js';
import { getLang } from '../i18n.js';

let SFX = { startBanner() {}, bossAlert() {}, practiceBanner() {} };
export function setBannerSounds(sfx) { SFX = sfx; }

// "START" banner shown right after the 3-2-1 countdown: letters drop in one by
// one, a light sweep crosses them, speed streaks shoot out, then it zooms away.
export const START_BANNER_MS = 1600;
export function showStartBanner(host) {
  if (!host) return;
  host.querySelector('.level-start-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'level-start-banner';
  const word = getLang() === 'fr' ? 'DÉPART' : 'START';
  const letters = [...word]
    .map((ch, i) => `<span style="--i:${i}">${ch}</span>`).join('');
  SFX.startBanner(word.length);
  const streaks = Array.from({ length: 8 }, (_, i) => `<i style="--s:${i}"></i>`).join('');
  banner.innerHTML = `<div class="lsb-streaks">${streaks}</div><div class="lsb-word">${letters}</div>`;
  host.appendChild(banner);
  setTimeout(() => banner.remove(), 1700);
}

// Boss levels: after START, a red "BOSS ALERT" banner names the boss with a
// line about it (hazard strips slide in, name slams down, screen flashes).
const BOSS_ALERT_MS = 2900;
export const BOSS_ALERT_INFO = {
  10: { name: 'A330', fr: 'Son bouclier bloque tes missiles !', en: 'Its shield blocks your missiles!' },
  20: { name: 'B-52', fr: 'Le géant du désert et ses lasers !', en: 'The desert giant and its lasers!' },
  30: { name: 'KAWASAKI C-2', fr: 'Deux tourelles, zéro répit !', en: 'Two turrets, zero rest!' },
  40: { name: 'C-5 GALAXY', fr: 'Le colosse du blizzard arrive !', en: 'The blizzard colossus is coming!' },
  50: { name: 'NAVETTE STS', nameEn: 'SPACE SHUTTLE', fr: 'Combat final dans l’espace !', en: 'Final battle in space!' },
};
export function showBossAlert(levelNum, done, stillCurrent = () => true) {
  const info = BOSS_ALERT_INFO[levelNum];
  const host = $('tutorial-countdown')?.parentElement;
  if (!info || !host) { done(); return; }
  const fr = getLang() === 'fr';
  host.querySelector('.boss-alert-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'boss-alert-banner';
  const nameText = (!fr && info.nameEn) || info.name;
  const name = [...nameText]
    .map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : ch}</span>`).join('');
  banner.innerHTML = `
    <div class="bab-flash"></div>
    <div class="bab-strip bab-strip-top"></div>
    <div class="bab-strip bab-strip-bottom"></div>
    <div class="bab-content">
      <div class="bab-warning">${uiIcon('warning')} ${fr ? 'ALERTE BOSS' : 'BOSS ALERT'} ${uiIcon('warning')}</div>
      <div class="bab-name" style="--n:${nameText.length}">${name}</div>
      <div class="bab-tagline">${fr ? info.fr : info.en}</div>
    </div>`;
  host.appendChild(banner);
  SFX.bossAlert(nameText.length);
  setTimeout(() => {
    banner.remove();
    if (stillCurrent()) done();
  }, BOSS_ALERT_MS);
}

// Practice games: a "PRACTICE MODE" banner between the countdown and START
// (the practice tag drops in, the words slide in from both sides, a green
// scan line sweeps across, then it all zooms away).
const PRACTICE_BANNER_MS = 1900;
export function showPracticeBanner(done, stillCurrent = () => true) {
  const host = $('tutorial-countdown')?.parentElement;
  if (!host) { done(); return; }
  const fr = getLang() === 'fr';
  host.querySelector('.practice-banner')?.remove();
  const banner = document.createElement('div');
  banner.className = 'practice-banner';
  banner.innerHTML = `
    <div class="pb-band"></div>
    <div class="pb-content">
      <div class="pb-tag">${fr ? 'ENTRAÎNEMENT' : 'TRAINING'}</div>
      <div class="pb-words">
        <span class="pb-w1">${fr ? 'MODE' : 'PRACTICE'}</span>
        <span class="pb-w2">${fr ? 'PRATIQUE' : 'MODE'}</span>
      </div>
      <div class="pb-sub">${fr ? 'Aucune pression : entraîne-toi!' : 'No pressure: just train!'}</div>
    </div>`;
  host.appendChild(banner);
  SFX.practiceBanner();
  setTimeout(() => {
    banner.remove();
    if (stillCurrent()) done();
  }, PRACTICE_BANNER_MS);
}
