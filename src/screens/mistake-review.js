// End-of-game report (win screen result.js, game over gameover.js) and the
// mistake notebook replay: a few missed questions asked again, with the tip
// and the calculation after a wrong answer (systems/session-report.js).
// No rewards and nothing saved: it is only for learning.
import { getLang, tOp } from '../i18n.js';
import { uiIcon } from '../utils/icons.js';
import { SFX } from '../audio/sound.js';
import { fmt } from '../game/negatives.js';
import { tipFor, tipLines } from '../game/tips.js';
import { sessionReport, mistakesToReplay, markReplayed, REPLAY_COUNT } from '../systems/session-report.js';

const isFr = () => getLang() === 'fr';
// Numbers as in the game: real minus sign, decimal comma in French.
const show = v => {
  const s = typeof v === 'number' ? fmt(v) : String(v);
  return isFr() ? s.replace(/(\d)\.(\d)/g, '$1,$2') : s;
};
const questionText = q => show(isFr() ? q.text : (q.textEn || q.text));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The three numbers of the report: [label, value].
export function reportTiles(report = sessionReport()) {
  const fr = isFr();
  const avg = report.avgSeconds == null ? '—' : `${show(Math.round(report.avgSeconds * 10) / 10)} s`;
  return [
    ['QUESTIONS', String(report.total)],
    [fr ? 'RÉUSSITE' : 'SUCCESS', `${report.successPct} %`],
    [fr ? 'TEMPS MOYEN' : 'AVG TIME', avg],
  ];
}

// Best theme / theme to work on again, and the replay button.
export function reportDetailsHTML(report = sessionReport()) {
  const fr = isFr();
  const theme = t => `<b>${esc(tOp(t.op))}</b> <span>(${t.correct}/${t.total})</span>`;
  const lines = [];
  if (report.best) lines.push(`<div class="jx-report-line is-best">${uiIcon('star')}<span>${fr ? 'Meilleur thème :' : 'Best topic:'} ${theme(report.best)}</span></div>`);
  if (report.rework) lines.push(`<div class="jx-report-line is-rework">${uiIcon('target')}<span>${fr ? 'À retravailler :' : 'To work on:'} ${theme(report.rework)}</span></div>`);
  else if (report.total) lines.push(`<div class="jx-report-line is-best">${uiIcon('check')}<span>${fr ? 'Aucune erreur, bravo !' : 'No mistakes, well done!'}</span></div>`);
  const replay = Math.min(REPLAY_COUNT, report.mistakes);
  const button = replay
    ? `<button type="button" class="jx-report-replay">${uiIcon('rotate')}<span>${fr ? 'REVOIR MES ERREURS' : 'REVIEW MY MISTAKES'} (${replay})</span></button>`
    : '';
  return lines.join('') + button;
}

// Fills `el` with the details and wires the replay button; `afterReplay`
// redraws the report when the review closes (fewer mistakes left).
export function mountReportDetails(el, afterReplay) {
  if (!el) return;
  el.innerHTML = reportDetailsHTML();
  el.querySelector('.jx-report-replay')?.addEventListener('click', () => {
    SFX.click?.();
    openMistakeReview(() => (afterReplay ? afterReplay() : mountReportDetails(el)));
  });
}

// Win screen: "CE QUE TU AS TRAVAILLÉ" — good answers for each type of
// calculation, this game's mistakes to review and the replay button.
export function workedOnHTML(report = sessionReport()) {
  const fr = isFr();
  const ops = (report.themes || []).map(t =>
    `<span class="jx-worked-op ${t.correct === t.total ? 'is-perfect' : ''}"><b>${esc(tOp(t.op))}</b><span>${t.correct}/${t.total}</span></span>`).join('');
  const missed = Math.max(0, report.total - report.correct);
  const mistakesLine = missed
    ? (fr ? `${missed} erreur${missed > 1 ? 's' : ''} à revoir` : `${missed} mistake${missed > 1 ? 's' : ''} to review`)
    : (report.total ? (fr ? 'Aucune erreur, bravo !' : 'No mistakes, well done!') : '');
  const replay = Math.min(REPLAY_COUNT, report.mistakes);
  return `
    <div class="jx-worked">
      <div class="jx-worked-title">${fr ? 'CE QUE TU AS TRAVAILLÉ' : 'WHAT YOU PRACTISED'}</div>
      ${ops ? `<div class="jx-worked-ops">${ops}</div>` : ''}
      ${mistakesLine ? `<div class="jx-worked-mistakes">${mistakesLine}</div>` : ''}
      ${replay ? `<button type="button" class="jx-report-replay">${uiIcon('rotate')}<span>${fr ? 'REVOIR MES ERREURS' : 'REVIEW MY MISTAKES'} (${replay})</span></button>` : ''}
    </div>`;
}

export function mountWorkedOn(el) {
  if (!el) return;
  el.innerHTML = workedOnHTML();
  el.querySelector('.jx-report-replay')?.addEventListener('click', () => {
    SFX.click?.();
    openMistakeReview(() => mountWorkedOn(el));
  });
}

// ── Replay ────────────────────────────────────────────────────────────────
export function openMistakeReview(onClose) {
  const questions = mistakesToReplay();
  if (!questions.length) return;
  const fr = isFr();
  let index = 0;
  let right = 0;
  const overlay = document.createElement('div');
  overlay.className = 'mr-overlay';
  overlay.innerHTML = `<div class="mr-card" role="dialog" aria-modal="true" aria-label="${fr ? 'Carnet d’erreurs' : 'Mistake notebook'}"></div>`;
  document.body.appendChild(overlay);
  const card = overlay.querySelector('.mr-card');
  requestAnimationFrame(() => overlay.classList.add('show'));

  const close = () => {
    overlay.classList.remove('show');
    setTimeout(() => { overlay.remove(); onClose?.(); }, 220);
  };

  const renderQuestion = () => {
    const q = questions[index];
    const choices = [...(q.choices || [q.answer])].sort(() => Math.random() - 0.5);
    card.innerHTML = `
      <div class="mr-head"><span>${fr ? 'CARNET D’ERREURS' : 'MISTAKE NOTEBOOK'}</span><em>${index + 1}/${questions.length}</em></div>
      <div class="mr-question">${esc(questionText(q))}</div>
      <div class="mr-choices">${choices.map((c, i) => `<button type="button" class="mr-choice" data-i="${i}">${esc(show(c))}</button>`).join('')}</div>
      <div class="mr-feedback"></div>`;
    card.querySelectorAll('.mr-choice').forEach(btn => btn.addEventListener('click', () => {
      const picked = choices[Number(btn.dataset.i)];
      const ok = picked === q.answer;
      if (ok) right++;
      markReplayed(q, ok);
      ok ? SFX.correct?.() : SFX.wrong?.();
      card.querySelectorAll('.mr-choice').forEach(b => {
        b.disabled = true;
        if (choices[Number(b.dataset.i)] === q.answer) b.classList.add('is-right');
      });
      if (!ok) btn.classList.add('is-wrong');
      const tip = tipFor(q);
      const lines = q.steps || tipLines(q) || [];
      const last = index === questions.length - 1;
      card.querySelector('.mr-feedback').innerHTML = `
        <div class="mr-verdict ${ok ? 'is-ok' : 'is-miss'}">${ok ? (fr ? 'Bravo, c’est juste !' : 'Right, well done!') : `${fr ? 'Bonne réponse :' : 'Correct answer:'} ${esc(show(q.answer))}`}</div>
        ${ok ? '' : `${tip ? `<div class="mr-tip">${esc(fr ? tip.fr : tip.en)}</div>` : ''}${lines.length ? `<div class="mr-lines">${lines.map(l => esc(show(l))).join('<br>')}</div>` : ''}`}
        <button type="button" class="mr-next">${last ? (fr ? 'TERMINER' : 'FINISH') : (fr ? 'SUIVANTE' : 'NEXT')}</button>`;
      card.querySelector('.mr-next').addEventListener('click', () => {
        index++;
        if (index < questions.length) renderQuestion();
        else renderEnd();
      });
    }));
  };

  const renderEnd = () => {
    card.innerHTML = `
      <div class="mr-head"><span>${fr ? 'CARNET D’ERREURS' : 'MISTAKE NOTEBOOK'}</span></div>
      <div class="mr-question">${right}/${questions.length}</div>
      <div class="mr-verdict ${right === questions.length ? 'is-ok' : 'is-miss'}">${right === questions.length
        ? (fr ? 'Toutes réussies ! Elles sortent du carnet.' : 'All right! They leave the notebook.')
        : (fr ? 'Les questions réussies sortent du carnet. Les autres reviendront.' : 'The right ones leave the notebook. The others will come back.')}</div>
      <button type="button" class="mr-next">${fr ? 'FERMER' : 'CLOSE'}</button>`;
    card.querySelector('.mr-next').addEventListener('click', close);
  };

  renderQuestion();
}
