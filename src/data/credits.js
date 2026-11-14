// Music and sound credits shown in the RÉGLAGE drawer (CRÉDITS).
// Source: assets/music/CREDITS.md (checked on the source pages, 2026-10-30).

export const LICENSES = {
  cc0: {
    name: 'CC0',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/',
    text: {
      fr: 'Domaine public : utilisation libre, même commerciale.',
      en: 'Public domain: free to use, even commercially.',
    },
  },
  cc0OrBy: {
    name: 'CC0 / CC-BY 4.0',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    text: {
      fr: 'Au choix : domaine public, ou libre en citant l’auteur.',
      en: 'Your choice: public domain, or free with credit to the author.',
    },
  },
  pixabay: {
    name: 'Pixabay',
    url: 'https://pixabay.com/service/license-summary/',
    text: {
      fr: 'Licence de contenu Pixabay : gratuite, même dans un jeu ; interdit de revendre le son seul.',
      en: 'Pixabay Content License: free, even in a game; the sound alone may not be resold.',
    },
  },
};

export const MUSIC_CREDITS = [
  { title: 'Moving Right Along', author: 'Wolfgang_', use: { fr: 'Musique de jeu', en: 'Game music' }, source: 'https://opengameart.org/node/114783', license: 'cc0' },
  { title: 'Ooame', author: 'TAD', use: { fr: 'Musique du menu', en: 'Menu music' }, source: 'https://opengameart.org/content/ooame', license: 'cc0OrBy' },
  { title: 'Stomp Drum Percussion — Power Up', author: 'BombinSound', use: { fr: 'Boss — Océan', en: 'Boss — Ocean' }, source: 'https://pixabay.com/music/id-577425/', license: 'pixabay' },
  { title: 'Dramatic', author: 'bearstockmusic', use: { fr: 'Boss — Désert', en: 'Boss — Desert' }, source: 'https://pixabay.com/music/id-588584/', license: 'pixabay' },
  { title: 'Teaser Dramatic Music', author: '331music', use: { fr: 'Boss — USA', en: 'Boss — USA' }, source: 'https://pixabay.com/music/id-600498/', license: 'pixabay' },
  { title: 'Dark And Sad Epic Dramatic Cinematic', author: 'Emmraan', use: { fr: 'Boss — Arctique', en: 'Boss — Arctic' }, source: 'https://pixabay.com/music/id-254261/', license: 'pixabay' },
  { title: 'Dramatic', author: 'prettyjohn1', use: { fr: 'Boss — Espace', en: 'Boss — Space' }, source: 'https://pixabay.com/music/id-491632/', license: 'pixabay' },
  { title: 'A Dramatic War Film Score', author: 'Alex_Besss', use: { fr: 'Dialogues des boss', en: 'Boss dialogues' }, source: 'https://pixabay.com/music/id-402028/', license: 'pixabay' },
];

export const SOUND_CREDITS = [
  { title: 'Purchase Success', author: 'freesound_gamestudio', use: { fr: 'Achat', en: 'Purchase' }, source: 'https://pixabay.com/sound-effects/id-384963/', license: 'pixabay' },
  { title: 'Error Notification 04', author: 'Universfield', use: { fr: 'Refus', en: 'Refusal' }, source: 'https://pixabay.com/sound-effects/id-199275/', license: 'pixabay' },
  { title: 'Interface Sounds', author: 'Kenney', use: { fr: 'Clics, décollage', en: 'Clicks, take-off' }, source: 'https://kenney.nl/assets/interface-sounds', license: 'cc0' },
  { title: 'Sci-Fi Sounds', author: 'Kenney', use: { fr: 'Tirs, explosions', en: 'Shots, explosions' }, source: 'https://kenney.nl/assets/sci-fi-sounds', license: 'cc0' },];
