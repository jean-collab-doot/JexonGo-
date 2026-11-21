// Rewards of the pilot grades (data/pilots.js PILOT_GRADES: reached with the
// highest level won). Each grade reached gives its reward once, claimed in the
// lobby's GRADES page (screens/grades.js): coins, EXP, and free upgrades
// (freeUpgrades: that many levels of any hangar AMÉLIORER upgrade, of any
// owned plane, for free).
export const GRADE_REWARDS = {
  CADET:        null,                                         // the start
  '2ND LT':     { coins: 300,  xp: 150 },
  LIEUTENANT:   { coins: 500,  freeUpgrades: 1 },
  CAPTAIN:      { coins: 800,  xp: 400 },
  MAJOR:        { coins: 1200, freeUpgrades: 1 },
  COLONEL:      { coins: 1500, xp: 800, freeUpgrades: 1 },
  GENERAL:      { coins: 2000, freeUpgrades: 2 },
  'AIR ACE':    { coins: 3000, xp: 1500, freeUpgrades: 2 },
};

// Names shown to the player.
export const GRADE_NAMES = {
  CADET:        { fr: 'CADET',          en: 'CADET' },
  '2ND LT':     { fr: '2E LIEUTENANT',  en: '2ND LIEUTENANT' },
  LIEUTENANT:   { fr: 'LIEUTENANT',     en: 'LIEUTENANT' },
  CAPTAIN:      { fr: 'CAPITAINE',      en: 'CAPTAIN' },
  MAJOR:        { fr: 'COMMANDANT',     en: 'MAJOR' },
  COLONEL:      { fr: 'COLONEL',        en: 'COLONEL' },
  GENERAL:      { fr: 'GÉNÉRAL',        en: 'GENERAL' },
  'AIR ACE':    { fr: 'AS DE L’AIR',    en: 'AIR ACE' },
};
