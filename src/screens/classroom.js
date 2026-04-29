import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { t } from '../i18n.js';
import {
  generateCode,
  createClassroom,
  joinClassroom,
  getClassroom,
  getMyClassrooms,
  syncPlayerToClassroom,
  leaveClassroom,
} from '../systems/classroom.js';

let _nav = null;
let _activeCode = null; // code of currently-displayed classroom

export function initClassroom(nav) {
  _nav = nav;

  $('btn-classroom-back').onclick = () => nav.toMenu();

  $('btn-classroom-refresh').onclick = () => {
    syncPlayerToClassroom();
    renderClassroom();
  };

  $('btn-classroom-join').onclick = () => {
    const code = ($('classroom-code-input').value || '').trim().toUpperCase();
    const name = ($('classroom-name-input').value || '').trim() || (G.playerName || 'PILOT');
    const result = joinClassroom(code, name);
    if (result.ok) {
      _activeCode = code;
      $('classroom-error').textContent = '';
      renderClassroom();
    } else {
      $('classroom-error').textContent = result.error;
    }
  };

  $('btn-classroom-create').onclick = () => {
    const teacherName = ($('classroom-name-input').value || '').trim() || 'TEACHER';
    const code = createClassroom(teacherName);
    _activeCode = code;
    $('classroom-error').textContent = '';
    renderClassroom();
  };

  $('btn-classroom-leave').onclick = () => {
    if (_activeCode) leaveClassroom(_activeCode);
    _activeCode = null;
    renderClassroom();
  };
}

export function renderClassroom() {
  syncPlayerToClassroom();

  const myClassrooms = getMyClassrooms();

  // Decide which classroom to show
  if (!_activeCode && myClassrooms.length > 0) {
    _activeCode = myClassrooms[0].code;
  }

  const classroom = _activeCode ? getClassroom(_activeCode) : null;

  if (classroom) {
    _showBoard(classroom);
  } else {
    _showLanding(myClassrooms);
  }
}

// ── PRIVATE VIEWS ────────────────────────────────────────────────────────────

function _showLanding(myClassrooms) {
  $('classroom-landing').classList.remove('hidden');
  $('classroom-board').classList.add('hidden');

  // Show list of previously-joined rooms
  const myRoomsEl = $('classroom-my-rooms');
  if (myClassrooms.length > 0) {
    myRoomsEl.innerHTML = `<div class="classroom-my-rooms-title">${t('myClassrooms')}</div>` +
      myClassrooms.map(c => `
        <div class="classroom-my-room-row" data-code="${c.code}">
          <span class="classroom-my-room-code">${c.code}</span>
          <span class="classroom-my-room-teacher">${c.teacherName}</span>
        </div>
      `).join('');

    myRoomsEl.querySelectorAll('.classroom-my-room-row').forEach(row => {
      row.addEventListener('click', () => {
        _activeCode = row.dataset.code;
        renderClassroom();
      });
    });
  } else {
    myRoomsEl.innerHTML = '';
  }
}

function _showBoard(classroom) {
  $('classroom-landing').classList.add('hidden');
  $('classroom-board').classList.remove('hidden');

  $('classroom-code-display').textContent = classroom.code;

  // Sort students by XP descending
  const sorted = [...classroom.students].sort((a, b) => (b.xp || 0) - (a.xp || 0));

  const listEl = $('classroom-leaderboard');
  listEl.innerHTML = '';

  if (sorted.length === 0) {
    listEl.innerHTML = `<div class="classroom-empty">${t('noStudents')}</div>`;
    return;
  }

  sorted.forEach((student, idx) => {
    const rank = idx + 1;
    const isTeacher = student.name === classroom.teacherName;
    const isMe = student.name === (G.playerName || 'PILOT');

    const maxXp = sorted[0].xp || 1;
    const pct = Math.max(4, Math.round((student.xp / maxXp) * 100));

    const row = document.createElement('div');
    row.className = 'classroom-lb-row' + (isMe ? ' classroom-lb-row-me' : '');
    row.innerHTML = `
      <span class="classroom-lb-rank">${_rankLabel(rank)}</span>
      <div class="classroom-lb-info">
        <div class="classroom-lb-name">
          ${isTeacher ? '<span class="classroom-crown">♛</span>' : ''}
          ${student.name}
          ${isMe ? '<span class="classroom-me-tag">YOU</span>' : ''}
        </div>
        <div class="classroom-lb-bar-wrap">
          <div class="classroom-lb-bar" style="width:${pct}%"></div>
        </div>
      </div>
      <span class="classroom-lb-xp">${(student.xp || 0).toLocaleString()} XP</span>
    `;
    listEl.appendChild(row);
  });
}

function _rankLabel(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
