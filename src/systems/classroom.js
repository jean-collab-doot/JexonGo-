import { G } from '../state.js';

const CLASSROOM_PREFIX = 'jexongo_classroom_';
const MY_CLASSROOMS_KEY = 'jexongo_my_classrooms';

/**
 * Generates a 6-character alphanumeric join code (uppercase).
 * @returns {string}
 */
export function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Creates a new classroom in localStorage, returns the code.
 * @param {string} teacherName
 * @returns {string} classroom code
 */
export function createClassroom(teacherName) {
  const code = generateCode();
  const classroom = {
    code,
    teacherName: teacherName.trim() || 'TEACHER',
    students: [],
    createdAt: Date.now(),
  };
  localStorage.setItem(CLASSROOM_PREFIX + code, JSON.stringify(classroom));

  // Add to my classrooms list
  const myCodes = _getMyClassroomCodes();
  if (!myCodes.includes(code)) {
    myCodes.push(code);
    localStorage.setItem(MY_CLASSROOMS_KEY, JSON.stringify(myCodes));
  }

  return code;
}

/**
 * Joins an existing classroom as a student.
 * @param {string} code - 6-char code
 * @param {string} studentName
 * @returns {{ ok: boolean, error?: string }}
 */
export function joinClassroom(code, studentName) {
  const normalised = (code || '').trim().toUpperCase();
  if (normalised.length !== 6) {
    return { ok: false, error: 'CODE MUST BE 6 CHARACTERS' };
  }

  const raw = localStorage.getItem(CLASSROOM_PREFIX + normalised);
  if (!raw) {
    return { ok: false, error: 'CLASSROOM NOT FOUND — CHECK CODE' };
  }

  const classroom = JSON.parse(raw);
  const name = (studentName || '').trim() || 'PILOT';

  // Check if already joined (by name match or reuse existing)
  const existingIdx = classroom.students.findIndex(s => s.name === name);
  if (existingIdx === -1) {
    classroom.students.push({
      name,
      xp: G.xp || 0,
      lp: G.rankedLP || 0,
      joinedAt: Date.now(),
    });
  } else {
    // Update stats
    classroom.students[existingIdx].xp = G.xp || 0;
    classroom.students[existingIdx].lp = G.rankedLP || 0;
  }

  localStorage.setItem(CLASSROOM_PREFIX + normalised, JSON.stringify(classroom));

  // Track this code in my classrooms
  const myCodes = _getMyClassroomCodes();
  if (!myCodes.includes(normalised)) {
    myCodes.push(normalised);
    localStorage.setItem(MY_CLASSROOMS_KEY, JSON.stringify(myCodes));
  }

  return { ok: true };
}

/**
 * Updates the local player's stats in all joined classrooms.
 */
export function syncPlayerToClassroom() {
  const myCodes = _getMyClassroomCodes();
  const playerName = G.playerName || 'PILOT';

  for (const code of myCodes) {
    const raw = localStorage.getItem(CLASSROOM_PREFIX + code);
    if (!raw) continue;
    const classroom = JSON.parse(raw);
    const idx = classroom.students.findIndex(s => s.name === playerName);
    if (idx !== -1) {
      classroom.students[idx].xp = G.xp || 0;
      classroom.students[idx].lp = G.rankedLP || 0;
      localStorage.setItem(CLASSROOM_PREFIX + code, JSON.stringify(classroom));
    }
  }
}

/**
 * Returns the classroom data for a given code, or null if not found.
 * @param {string} code
 * @returns {object|null}
 */
export function getClassroom(code) {
  const normalised = (code || '').trim().toUpperCase();
  const raw = localStorage.getItem(CLASSROOM_PREFIX + normalised);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/**
 * Returns array of classrooms this player has joined.
 * @returns {object[]}
 */
export function getMyClassrooms() {
  return _getMyClassroomCodes()
    .map(code => getClassroom(code))
    .filter(Boolean);
}

/**
 * Removes a classroom code from my list.
 * @param {string} code
 */
export function leaveClassroom(code) {
  const normalised = (code || '').trim().toUpperCase();
  const myCodes = _getMyClassroomCodes().filter(c => c !== normalised);
  localStorage.setItem(MY_CLASSROOMS_KEY, JSON.stringify(myCodes));
}

// ── PRIVATE HELPERS ──────────────────────────────────────────────────────────

function _getMyClassroomCodes() {
  try {
    return JSON.parse(localStorage.getItem(MY_CLASSROOMS_KEY) || '[]');
  } catch {
    return [];
  }
}
