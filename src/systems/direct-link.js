// Direct link to a class and topics: jexongo.app/?niveau=5e&theme=fractions.
// The first questionnaire (onboarding.js) takes them as answers and skips
// the country, class and topic screens. Capitals, accents, spaces and dashes
// do not matter; anything not recognised gives nothing, so its screen is
// asked as before.
//  - niveau (or level): France cp ... terminale ("5e" is the French 5e),
//    Quebec 1re-annee ... 6e-annee and sec1 ... sec5, USA grade1 ... grade12
//    (or 7th-grade), or the game's own names (fr-5e, qc-prim3, us-7).
//  - theme (or topic): one or more, separated by commas: addition,
//    soustraction, multiplication, division, exposant, fractions,
//    pourcentages, algebre (English names work too).
// Pure (no game state import), so it can be tested on its own.
import { schoolYearOfLevel } from './school-questions.js';

const LINK_PARAMS = ['niveau', 'level', 'theme', 'topic'];

const norm = s => String(s || '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[\s_.-]/g, '');

// The first word of each class is the one the link maker writes.
const FRANCE = {
  cp: 'fr-cp', ce1: 'fr-ce1', ce2: 'fr-ce2', cm1: 'fr-cm1', cm2: 'fr-cm2',
  '6e': 'fr-6e', '6eme': 'fr-6e', '5e': 'fr-5e', '5eme': 'fr-5e', '4e': 'fr-4e', '4eme': 'fr-4e', '3e': 'fr-3e', '3eme': 'fr-3e',
  seconde: 'fr-2nde', '2nde': 'fr-2nde', '2de': 'fr-2nde', premiere: 'fr-1re', '1re': 'fr-1re', '1ere': 'fr-1re',
  terminale: 'fr-term', term: 'fr-term', tle: 'fr-term',
};

const TOPICS = {
  addition: '+', add: '+', plus: '+',
  soustraction: '-', subtraction: '-', moins: '-', minus: '-',
  multiplication: '*', fois: '*', times: '*',
  division: '/', divise: '/',
  exposant: 'exponent', exponent: 'exponent', puissance: 'exponent', power: 'exponent',
  fraction: 'fractions',
  pourcentage: 'percentages', percentage: 'percentages', pourcent: 'percentages', percent: 'percentages',
  algebre: 'algebra', algebra: 'algebra', equation: 'algebra',
};

// The game's class name (fr-5e, qc-sec2, us-7...) or null.
export function levelFromLink(raw) {
  const v = norm(raw);
  if (FRANCE[v]) return FRANCE[v];
  if (v.startsWith('fr') && FRANCE[v.slice(2)]) return FRANCE[v.slice(2)];
  let m = v.match(/^(?:qc)?prim(?:aire)?(\d)$/) || v.match(/^(\d)(?:re|er|e|eme|ere)annee$/);
  if (m && m[1] >= 1 && m[1] <= 6) return `qc-prim${m[1]}`;
  m = v.match(/^(?:qc)?sec(?:ondaire)?(\d)$/);
  if (m && m[1] >= 1 && m[1] <= 5) return `qc-sec${m[1]}`;
  m = v.match(/^(?:us|grade)(\d{1,2})$/) || v.match(/^(\d{1,2})(?:st|nd|rd|th)grade$/);
  if (m && m[1] >= 1 && m[1] <= 12) return `us-${Number(m[1])}`;
  return null;
}

// The topic value of the questionnaire (+, fractions...) or null.
export function topicFromLink(raw) {
  const v = norm(raw);
  return TOPICS[v] || TOPICS[v.replace(/s$/, '')] || null;
}

// { level, country, schoolYear, topics } from the page address; level null
// and topics [] when nothing is recognised.
export function readDirectLink(search = location.search) {
  const params = new URLSearchParams(search);
  const level = levelFromLink(params.get('niveau') ?? params.get('level'));
  const words = [...params.getAll('theme'), ...params.getAll('topic')].flatMap(v => v.split(/[,;|\s]+/));
  return {
    level,
    country: !level ? '' : level.startsWith('fr-') ? 'france' : level.startsWith('us-') ? 'usa' : 'quebec',
    schoolYear: level ? schoolYearOfLevel(level) : 0,
    topics: [...new Set(words.map(topicFromLink).filter(Boolean))],
  };
}

// Link maker (settings, screens/link-maker.js): the word of a class in the
// link (fr-5e → 5e, qc-prim1 → 1re-annee, qc-sec2 → sec2, us-7 → grade7).
export function levelLinkWord(level) {
  const france = Object.keys(FRANCE).find(word => FRANCE[word] === level);
  if (france) return france;
  let m = level.match(/^qc-prim(\d)$/);
  if (m) return `${m[1]}${m[1] === '1' ? 're' : 'e'}-annee`;
  m = level.match(/^qc-sec(\d)$/);
  if (m) return `sec${m[1]}`;
  m = level.match(/^us-(\d+)$/);
  return m ? `grade${m[1]}` : level;
}

const TOPIC_WORDS = {
  '+': ['addition', 'addition'], '-': ['soustraction', 'subtraction'],
  '*': ['multiplication', 'multiplication'], '/': ['division', 'division'],
  fractions: ['fractions', 'fractions'], percentages: ['pourcentages', 'percentages'],
  exponent: ['exposant', 'exponent'], algebra: ['algebre', 'algebra'],
};

// The whole link: origin (https://jexongo.app) + class + topics (none: the
// player picks them in the questionnaire). Topic words in French or English.
export function buildDirectLink(origin, level, topics = [], fr = true) {
  const words = topics.map(t => TOPIC_WORDS[t]?.[fr ? 0 : 1]).filter(Boolean);
  return `${origin}/?niveau=${levelLinkWord(level)}${words.length ? `&theme=${words.join(',')}` : ''}`;
}

// Questionnaire done: the address loses niveau / theme (other parts stay).
export function clearDirectLink() {
  const url = new URL(location.href);
  if (!LINK_PARAMS.some(k => url.searchParams.has(k))) return;
  LINK_PARAMS.forEach(k => url.searchParams.delete(k));
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
}
