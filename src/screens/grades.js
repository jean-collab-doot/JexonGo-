// Lobby GRADES button and page: the pilot grades (CADET → AIR ACE, reached
// with the highest level won), the player's grade and the way to the next one,
// and the reward of each grade to claim once (systems/grade-rewards.js):
// coins, EXP, free hangar upgrades. A badge on the button counts the rewards
// waiting.
import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { getLang, numLocale } from '../i18n.js';
import { SFX } from '../audio/sound.js';
import { coinIcon, expIcon, uiIcon } from '../utils/icons.js';
import { rankInsigniaSVG } from '../utils/rank-insignia.js';
import { getPilotGradeRank } from '../data/pilots.js';
import {
  gradesAscending, gradeName, gradeReward, gradeReached, gradeClaimed,
  currentGrade, claimableGrades, claimGrade, freeUpgradesLeft,
} from '../systems/grade-rewards.js';

const fr = () => getLang() === 'fr';
const num = n => Number(n || 0).toLocaleString(numLocale());

function rewardChips(reward) {
  if (!reward) return `<span class="gr-chip is-start">${fr() ? 'LE DÉBUT !' : 'THE START!'}</span>`;
  const out = [];
  if (reward.coins) out.push(`<span class="gr-chip">${coinIcon('gr-ico')}<b>${num(reward.coins)}</b></span>`);
  if (reward.xp) out.push(`<span class="gr-chip">${expIcon('gr-ico')}<b>${num(reward.xp)}</b></span>`);
  if (reward.freeUpgrades) {
    const n = reward.freeUpgrades;
    out.push(`<span class="gr-chip is-upgrade">${uiIcon('upgrade')}<b>${n} ${fr()
      ? (n > 1 ? 'AMÉLIORATIONS GRATUITES' : 'AMÉLIORATION GRATUITE')
      : (n > 1 ? 'FREE UPGRADES' : 'FREE UPGRADE')}</b></span>`);
  }
  return out.join('');
}

function render() {
  const body = $('grades-body');
  if (!body) return;
  const F = fr();
  const level = G.highestLevel || 0;
  const cur = currentGrade();
  const list = gradesAscending();
  const next = list.find(g => g.minLevel > level) || null;
  const from = cur.minLevel;
  const pct = next ? Math.max(0, Math.min(100, ((level - from) / (next.minLevel - from)) * 100)) : 100;
  const free = freeUpgradesLeft();

  const rows = list.map(g => {
    const reward = gradeReward(g);
    const reached = gradeReached(g);
    const claimed = gradeClaimed(g);
    let action;
    if (!reward) action = reached ? `<span class="gr-state is-done">${uiIcon('check')}</span>` : '';
    else if (claimed) action = `<span class="gr-state is-done">${uiIcon('check')}<small>${F ? 'REÇU' : 'CLAIMED'}</small></span>`;
    else if (reached) action = `<button class="gr-claim" type="button" data-grade="${g.name}">${F ? 'RÉCLAMER' : 'CLAIM'}</button>`;
    else action = `<span class="gr-state is-locked">${uiIcon('lock')}<small>${F ? 'NIV' : 'LV'} ${g.minLevel}</small></span>`;
    return `
      <li class="gr-row${g === cur ? ' is-current' : ''}${reached ? '' : ' is-locked'}">
        <span class="gr-badge" style="--c:${g.color}">${rankInsigniaSVG(getPilotGradeRank(g), g.color)}</span>
        <div class="gr-copy">
          <strong>${gradeName(g)}${g === cur ? `<em>${F ? 'TOI' : 'YOU'}</em>` : ''}</strong>
          <small>${g.minLevel ? `${F ? 'Niveau' : 'Level'} ${g.minLevel}` : (F ? 'Dès le départ' : 'From the start')}</small>
          <div class="gr-chips">${rewardChips(reward)}</div>
        </div>
        ${action}
      </li>`;
  }).join('');

  body.innerHTML = `
    <div class="gr-head">
      <span class="gr-head-badge">${rankInsigniaSVG(getPilotGradeRank(cur), cur.color)}</span>
      <small>${F ? 'TON GRADE' : 'YOUR GRADE'}</small>
      <strong>${gradeName(cur)}</strong>
      <div class="gr-progress"><i style="width:${pct}%"></i></div>
      <p>${next
        ? (F ? `Gagne le niveau ${next.minLevel} pour devenir ${gradeName(next)} !` : `Win level ${next.minLevel} to become ${gradeName(next)}!`)
        : (F ? 'Tu as le plus haut grade. Bravo, pilote !' : 'You have the highest grade. Well done, pilot!')}</p>
      ${free ? `<p class="gr-free">${uiIcon('upgrade')} ${F
        ? `${free} amélioration${free > 1 ? 's' : ''} gratuite${free > 1 ? 's' : ''} à utiliser dans HANGAR › AMÉLIORER`
        : `${free} free upgrade${free > 1 ? 's' : ''} to use in HANGAR › UPGRADE`}</p>` : ''}
    </div>
    <ul class="gr-list">${rows}</ul>`;

  body.querySelectorAll('[data-grade]').forEach(btn => btn.addEventListener('click', () => {
    const g = list.find(x => x.name === btn.dataset.grade);
    const reward = g && claimGrade(g);
    if (!reward) return;
    SFX.promoted?.();
    const parts = [];
    if (reward.coins) parts.push(`+${num(reward.coins)} ${F ? 'PIÈCES' : 'COINS'}`);
    if (reward.xp) parts.push(`+${num(reward.xp)} EXP`);
    if (reward.freeUpgrades) parts.push(F ? `+${reward.freeUpgrades} AMÉLIORATION${reward.freeUpgrades > 1 ? 'S' : ''} GRATUITE${reward.freeUpgrades > 1 ? 'S' : ''}` : `+${reward.freeUpgrades} FREE UPGRADE${reward.freeUpgrades > 1 ? 'S' : ''}`);
    window._showToast?.(`${gradeName(g)} : ${parts.join(' · ')}`);
    render();
    updateGradesButton();
  }));
}

function openGrades() {
  SFX.click?.();
  render();
  $('lobby-grades')?.classList.remove('hidden');
  $('grades-body')?.scrollTo?.(0, 0);
}
function closeGrades() { $('lobby-grades')?.classList.add('hidden'); }

export function initGrades() {
  $('btn-lobby-grades')?.addEventListener('click', openGrades);
  $('btn-grades-close')?.addEventListener('click', closeGrades);
}

// Lobby shown (menu.js renderMenu): the player's insignia on the button and
// the number of rewards waiting on the badge.
export function updateGradesButton() {
  const btn = $('btn-lobby-grades');
  if (!btn) return;
  const cur = currentGrade();
  const ico = $('jx-grades-ico');
  // CADET's slate grey hardly shows on the blue button: a light grey there.
  if (ico) ico.innerHTML = rankInsigniaSVG(getPilotGradeRank(cur), cur.name === 'CADET' ? '#e2e8f0' : cur.color);
  const label = $('jx-grades-label');
  if (label) label.textContent = 'GRADES';
  // Grades need an account (menu.js lock): no waiting badge for a guest.
  const waiting = G.playerRegistered ? claimableGrades().length : 0;
  const badge = $('jx-grades-count');
  if (badge) { badge.textContent = String(waiting); badge.classList.toggle('hidden', !waiting); }
  btn.setAttribute('aria-label', fr() ? `Grades : ${gradeName(cur)}` : `Grades: ${gradeName(cur)}`);
}
