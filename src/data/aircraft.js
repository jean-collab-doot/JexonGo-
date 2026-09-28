export const AIRCRAFT = {
  t6: {
    id: 't6', name: 'T-6 Texan II', xpCost: 0, starter: true,
    type: 'trainer',
    color: '#fbbf24',
    ability: {
      icon: 'plane',
      name: { en: 'TRAINER', fr: 'ENTRAÎNEUR' },
      description: { en: 'Balanced aircraft, no special ability', fr: 'Avion équilibré, sans capacité spéciale' },
    },
    description: {
      en: 'Turboprop trainer used to teach new pilots the basics of flight.',
      fr: "Avion-école à turbopropulseur utilisé pour former les nouveaux pilotes.",
    },
  },
  pc21: {
    id: 'pc21', name: 'Pilatus PC-21', xpCost: 800, starter: false,
    type: 'trainer',
    color: '#60a5fa',
    ability: {
      icon: 'heart',
      name: { en: 'REGEN', fr: 'RÉGÉNÉRATION' },
      description: { en: 'Continuously recovers a little health', fr: 'Récupère un peu de vie en continu' },
      regen: true,
    },
    description: {
      en: 'Swiss-built advanced trainer, fast and agile for its class.',
      fr: "Avion-école avancé suisse, rapide et agile pour sa catégorie.",
    },
  },
  c130: {
    id: 'c130', name: 'C-130 Hercules', xpCost: 2000, starter: false,
    type: 'transport',
    color: '#6b7280',
    ability: {
      icon: 'magnet',
      name: { en: 'MAGNET', fr: 'AIMANT' },
      description: { en: 'Pulls in nearby coins and chests', fr: 'Attire les pièces et coffres à proximité' },
      magnet: true,
    },
    description: {
      en: 'Rugged four-engine transport that hauls troops and cargo anywhere.',
      fr: "Robuste transporteur quadrimoteur capable d'emporter troupes et cargaison partout.",
    },
  },
  a10: {
    id: 'a10', name: 'A-10 Thunderbolt II', xpCost: 3800, starter: false,
    type: 'attack',
    color: '#78716c',
    ability: {
      icon: 'burst',
      name: { en: 'GAU-8 CANNON', fr: 'CANON GAU-8' },
      description: { en: 'Fires bursts of heavy cannon shells', fr: 'Tire des rafales d’obus de canon puissants' },
      weapon: 'gau8',
    },
    description: {
      en: 'Armored "Warthog" built around a massive cannon for close air support.',
      fr: "« Warthog » blindé conçu autour d'un énorme canon pour l'appui aérien rapproché.",
    },
  },
  f16: {
    id: 'f16', name: 'F-16 Fighting Falcon', xpCost: 6000, starter: false,
    type: 'fighter',
    color: '#64748b',
    ability: {
      icon: 'rotate',
      name: { en: 'EVASION', fr: 'ESQUIVE' },
      description: { en: 'Dodges enemy missiles automatically for 10 s (30 s recharge)', fr: 'Évite les missiles ennemis automatiquement pendant 10 s (recharge 30 s)' },
      skill: 'evade',
    },
    description: {
      en: 'Lightweight, highly maneuverable multirole fighter flown worldwide.',
      fr: "Chasseur polyvalent léger et très maniable, utilisé dans le monde entier.",
    },
  },
  f18: {
    id: 'f18', name: 'F/A-18 Hornet', xpCost: 8800, starter: false,
    type: 'fighter',
    color: '#475569',
    ability: {
      icon: 'sparkle',
      name: { en: 'BURST', fr: 'RAFALE' },
      description: { en: 'Briefly fires two shots instead of one', fr: 'Tire deux projectiles au lieu d’un, brièvement' },
      burst: true,
    },
    description: {
      en: 'Carrier-based strike fighter, equally at home in air combat or bombing.',
      fr: "Chasseur d'attaque embarqué, à l'aise aussi bien en combat aérien qu'en bombardement.",
    },
  },
  f22: {
    id: 'f22', name: 'F-22 Raptor', xpCost: 12000, starter: false,
    type: 'stealth',
    color: '#94a3b8',
    gradeRequired: 16, gradeLabel: 'CAPTAIN',
    ability: {
      icon: 'target',
      name: { en: 'PRECISION', fr: 'PRÉCISION' },
      description: { en: 'Shots can never miss', fr: 'Les tirs ne peuvent jamais manquer' },
      homing: true,
    },
    description: {
      en: 'US Air Force stealth air-superiority fighter, nearly invisible to radar.',
      fr: "Chasseur furtif de supériorité aérienne de l'US Air Force, quasi invisible au radar.",
    },
  },
  f35: {
    id: 'f35', name: 'F-35 Lightning II', xpCost: 14400, starter: false,
    type: 'stealth',
    color: '#334155',
    ability: {
      icon: 'clock',
      name: { en: 'GENIUS', fr: 'GÉNIE' },
      description: { en: 'A little more time to answer questions', fr: 'Un peu plus de temps pour répondre aux questions' },
      extraAnswerTime: 4,
    },
    description: {
      en: 'Fifth-generation stealth fighter packed with advanced sensors.',
      fr: "Chasseur furtif de cinquième génération bardé de capteurs de pointe.",
    },
  },
  b2: {
    id: 'b2', name: 'B-2 Spirit', xpCost: 22000, starter: false,
    type: 'bomber',
    color: '#1e293b',
    gradeRequired: 26, gradeLabel: 'MAJOR',
    ability: {
      icon: 'radiation',
      name: { en: 'STEALTH + NUKE', fr: 'FURTIF + NUCLÉAIRE' },
      description: { en: 'Stealth for 10 s (30 s recharge). A nuclear bomb every 5 correct answers', fr: 'Furtif pendant 10 s (recharge 30 s). Une bombe nucléaire toutes les 5 bonnes réponses' },
      skill: 'stealth',
      nukeEveryCorrect: import.meta.env?.DEV ? 1 : 5, // every 5 correct answers (every one on the local dev server, for testing)
    },
    description: {
      en: 'Flying-wing stealth bomber able to slip past enemy radar undetected.',
      fr: "Bombardier furtif en aile volante capable de traverser les radars ennemis sans être détecté.",
    },
  },
  sr71: {
    id: 'sr71', name: 'SR-71 Blackbird', xpCost: 30000, starter: false,
    type: 'recon',
    color: '#0f172a',
    gradeRequired: 36, gradeLabel: 'COLONEL',
    ability: {
      icon: 'bolt',
      name: { en: 'TURBO + HACK', fr: 'TURBO + PIRATAGE' },
      description: {
        en: 'Activatable speed boost. Every 3 correct answers, 3 enemy planes switch sides and fire at their teammates for 10 s, then explode',
        fr: 'Boost de vitesse activable. Toutes les 3 bonnes réponses, 3 avions ennemis changent de camp et tirent sur leurs coéquipiers pendant 10 s, puis explosent',
      },
      turbo: true,
      skill: 'turbo',
      turncoatEveryCorrect: 3,
    },
    description: {
      en: 'Legendary Mach 3+ spy plane, still the fastest jet ever built.',
      fr: "Avion espion légendaire à plus de Mach 3, toujours le jet le plus rapide jamais construit.",
    },
  },
  f117: {
    id: 'f117', name: 'F-117 Nighthawk', xpCost: 0, starter: false, secret: true,
    type: 'stealth', color: '#111827',
    ability: {
      icon: 'stealth',
      name: { en: 'JAMMING', fr: 'BROUILLAGE' },
      description: { en: 'Slightly slows nearby enemies', fr: 'Ralentit légèrement les ennemis proches' },
      jam: true,
    },
    description: {
      en: 'The first operational stealth jet, with faceted panels that deflect radar.',
      fr: "Premier avion furtif opérationnel, avec des panneaux facettés qui déjouent les radars.",
    },
  },
};

export const AIRCRAFT_ORDER = ['t6','pc21','c130','a10','f16','f18','f22','f35','b2','sr71','f117'];
