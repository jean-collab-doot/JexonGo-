// Pilot names are shown to other players (leaderboard, arena, co-op), many of
// them children. This module keeps those names clean. It has no browser
// dependency so the multiplayer server (server.js) uses the same rules.

const FALLBACK_NAME = 'PILOTE';

// Blocked when the whole word matches (short words that also appear inside
// normal names, e.g. CON in CONNOR, ASS in PASSION, DICK in DICKSON).
const BLOCKED_WORDS = new Set([
  // English
  'ass', 'arse', 'cum', 'fag', 'fags', 'tit', 'tits', 'nazi', 'sex', 'sexy',
  'porn', 'porno', 'rape', 'kkk', 'hoe', 'hoes', 'wtf', 'stfu', 'fu', 'fck',
  'dick', 'negro',
  // French
  'con', 'cons', 'conne', 'pd', 'nique', 'fdp', 'ntm', 'tg', 'bite', 'zob',
  'cul', 'pute', 'putes', 'caca', 'crisse', 'calice', 'osti', 'ostie',
]);

// Blocked anywhere in the name, even glued to other letters. Kept to parts
// that never hide inside normal names (no 'nique': MONIQUE, no 'pedo':
// TORPEDO, no 'esti': CELESTINE).
const BLOCKED_PARTS = [
  // English
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'penis', 'vagina', 'nigger',
  'nigga', 'faggot', 'whore', 'slut', 'bastard', 'asshole', 'motherf',
  'retard', 'hitler', 'porn', 'rapist', 'jizz', 'boob',
  // French
  'connard', 'conard', 'connasse', 'salope', 'putain', 'encule', 'batard',
  'merde', 'niquer', 'niquez', 'pedale', 'tapette', 'bougnoul', 'bicot',
  'couille', 'branle', 'tabarnak', 'tabarnac', 'ciboire', 'sacrament',
  'pedophile',
];

// Undo the usual tricks: accents and digits/symbols used for letters.
function normalize(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[0]/g, 'o')
    .replace(/[@4]/g, 'a')
    .replace(/[1!|]/g, 'i')
    .replace(/3/g, 'e')
    .replace(/[5$]/g, 's')
    .replace(/7/g, 't');
}

function hasBlockedWord(clean) {
  const words = clean.split(/[^a-z]+/).filter(Boolean);
  if (words.some(word => BLOCKED_WORDS.has(word))) return true;
  const squashed = clean.replace(/[^a-z]/g, '');
  // Spelled-out letters (C U L) form one word once joined.
  if (words.length > 1 && words.every(word => word.length === 1) && BLOCKED_WORDS.has(squashed)) return true;
  return BLOCKED_PARTS.some(part => squashed.includes(part));
}

/** True when the name contains no blocked word. */
export function isPilotNameAllowed(name) {
  const clean = normalize(name);
  // Also test with stretched letters squeezed back (FUUUCK -> FUCK), without
  // squeezing real double letters out of normal names (BOB stays allowed).
  const squeezed = clean.replace(/(.)\1+/g, '$1');
  return !hasBlockedWord(clean) && !hasBlockedWord(squeezed);
}

/** The name as other players may see it: cleaned, capped, never offensive. */
export function publicPilotName(name, maxLength = 16) {
  const cleaned = String(name || '')
    .replace(/<[^>]*>/g, '')
    .toUpperCase()
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
    .trim();
  if (!cleaned || !isPilotNameAllowed(cleaned)) return FALLBACK_NAME;
  return cleaned;
}
