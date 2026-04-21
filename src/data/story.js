// Story entries for all 50 levels
// Narrative arc: Rookie → Desert → City → Arctic → Space
const STORIES = [
  // Levels 1–10: Rookie recruit, ocean biome, training arc
  {
    title: 'MISSION 1',  titleFr: 'MISSION 1',
    text: 'Cadet, welcome to JexonGO! Your first patrol over the ocean begins. Solve fast — enemies won\'t wait!',
    textFr: 'Cadet, bienvenue dans JexonGO ! Votre première patrouille au-dessus de l\'océan commence. Résolvez vite — les ennemis n\'attendent pas !'
  },
  {
    title: 'MISSION 2',  titleFr: 'MISSION 2',
    text: 'Enemy drones spotted near the coast! Your math skills are the only weapon that matters out here.',
    textFr: 'Des drones ennemis repérés près de la côte ! Vos compétences en maths sont la seule arme qui compte ici.'
  },
  {
    title: 'MISSION 3',  titleFr: 'MISSION 3',
    text: 'Storm warning on the radar. Keep your head up and your equations sharp, rookie!',
    textFr: 'Alerte tempête sur le radar. Gardez la tête haute et vos équations précises, recrue !'
  },
  {
    title: 'MISSION 4',  titleFr: 'MISSION 4',
    text: 'Pirate signal detected over the bay! Blast them with correct answers and send them packing.',
    textFr: 'Signal pirate détecté au-dessus de la baie ! Éliminez-les avec de bonnes réponses et chassez-les.'
  },
  {
    title: 'MISSION 5',  titleFr: 'MISSION 5',
    text: 'Your squadron is counting on you. Hold the ocean skies and prove you\'re worth your wings!',
    textFr: 'Votre escadron compte sur vous. Tenez le ciel de l\'océan et prouvez que vous méritez vos ailes !'
  },
  {
    title: 'MISSION 6',  titleFr: 'MISSION 6',
    text: 'Enemy patrols are doubling. The faster you calculate, the faster they fall. Don\'t freeze up!',
    textFr: 'Les patrouilles ennemies doublent. Plus vite vous calculez, plus vite ils tombent. Ne vous figez pas !'
  },
  {
    title: 'MISSION 7',  titleFr: 'MISSION 7',
    text: 'A mystery aircraft is tailing you! Outthink it — every correct answer fires a missile!',
    textFr: 'Un avion mystérieux vous suit ! Surpassez-le en intelligence — chaque bonne réponse tire un missile !'
  },
  {
    title: 'MISSION 8',  titleFr: 'MISSION 8',
    text: 'HQ says more enemies inbound. Gear up, stay sharp, and show them what a cadet can do!',
    textFr: 'Le QG signale plus d\'ennemis en approche. Préparez-vous, restez alerte, et montrez-leur ce que sait faire un cadet !'
  },
  {
    title: 'MISSION 9',  titleFr: 'MISSION 9',
    text: 'The ocean is getting choppy. Your plane is rattling — but your brain never stops working!',
    textFr: 'L\'océan devient agité. Votre avion tremble — mais votre cerveau ne s\'arrête jamais !'
  },
  {
    title: 'MISSION 10', titleFr: 'MISSION 10',
    text: 'BOSS ALERT! The Ocean Warlord rises. Defeat this giant to earn your first real pilot badge!',
    textFr: 'ALERTE BOSS ! Le Seigneur de l\'Océan surgit. Battez ce géant pour gagner votre premier vrai badge de pilote !'
  },

  // Levels 11–20: Desert battles, subtraction unlocks, first real enemies
  {
    title: 'MISSION 11', titleFr: 'MISSION 11',
    text: 'New biome: the scorching desert! Sand and enemies everywhere. Subtraction time — buckle up!',
    textFr: 'Nouveau biome : le désert brûlant ! Sable et ennemis partout. L\'heure de la soustraction — accrochez-vous !'
  },
  {
    title: 'MISSION 12', titleFr: 'MISSION 12',
    text: 'Desert raiders are circling! They\'re faster than ocean drones — you\'ll need faster answers too.',
    textFr: 'Des raiders du désert encerclent ! Ils sont plus rapides que les drones de l\'océan — il vous faudra des réponses plus rapides aussi.'
  },
  {
    title: 'MISSION 13', titleFr: 'MISSION 13',
    text: 'Heat is rising. So are the stakes. Tanks on the ground, fighters in the sky — clear them out!',
    textFr: 'La chaleur monte. Tout comme les enjeux. Chars au sol, chasseurs dans le ciel — éliminez-les tous !'
  },
  {
    title: 'MISSION 14', titleFr: 'MISSION 14',
    text: 'A sand storm\'s blowing in! Enemies love chaos. Keep calculating and cut through the noise.',
    textFr: 'Une tempête de sable arrive ! Les ennemis adorent le chaos. Continuez à calculer et percez à travers le bruit.'
  },
  {
    title: 'MISSION 15', titleFr: 'MISSION 15',
    text: 'Command says a rogue ace is hunting your squad. Solve every equation before they close in!',
    textFr: 'Le commandement signale qu\'un as renégat chasse votre escouade. Résolvez chaque équation avant qu\'ils ne se rapprochent !'
  },
  {
    title: 'MISSION 16', titleFr: 'MISSION 16',
    text: 'Oil refineries under attack! Protect them with rapid-fire correct answers and fast reflexes.',
    textFr: 'Les raffineries de pétrole sont attaquées ! Protégez-les avec des réponses rapides et des réflexes fulgurants.'
  },
  {
    title: 'MISSION 17', titleFr: 'MISSION 17',
    text: 'Enemy tanks are armored — takes multiple hits! Stay in the zone, chain those correct answers!',
    textFr: 'Les chars ennemis sont blindés — il faut plusieurs coups ! Restez dans la zone, enchaînez les bonnes réponses !'
  },
  {
    title: 'MISSION 18', titleFr: 'MISSION 18',
    text: 'Night mission over the dunes. Visibility is low but your math skills shine in the dark!',
    textFr: 'Mission nocturne au-dessus des dunes. La visibilité est faible mais vos compétences en maths brillent dans le noir !'
  },
  {
    title: 'MISSION 19', titleFr: 'MISSION 19',
    text: 'Reinforcements are incoming — theirs! You\'re outnumbered. Accuracy and speed are your edge.',
    textFr: 'Des renforts arrivent — les leurs ! Vous êtes en infériorité numérique. La précision et la vitesse sont vos atouts.'
  },
  {
    title: 'MISSION 20', titleFr: 'MISSION 20',
    text: 'BOSS ALERT! Desert Colossus emerges from the sand! This titan won\'t go down easily. Fire!',
    textFr: 'ALERTE BOSS ! Le Colosse du Désert émerge du sable ! Ce titan ne tombera pas facilement. Feu !'
  },

  // Levels 21–30: City warfare, enemy factions, multiplication introduced
  {
    title: 'MISSION 21', titleFr: 'MISSION 21',
    text: 'Welcome to the city front! Enemy factions have taken the skyline. Multiplication unlocked!',
    textFr: 'Bienvenue sur le front urbain ! Les factions ennemies ont pris la ligne d\'horizon. Multiplication débloquée !'
  },
  {
    title: 'MISSION 22', titleFr: 'MISSION 22',
    text: 'Skyscrapers make great cover — for them! Navigate tight corridors and blast enemies fast.',
    textFr: 'Les gratte-ciels offrent une excellente couverture — pour eux ! Naviguez dans les couloirs étroits et éliminez les ennemis vite.'
  },
  {
    title: 'MISSION 23', titleFr: 'MISSION 23',
    text: 'Three enemy factions fighting each other AND you. Use multiplication to triple your firepower!',
    textFr: 'Trois factions ennemies se battant entre elles ET contre vous. Utilisez la multiplication pour tripler votre puissance de feu !'
  },
  {
    title: 'MISSION 24', titleFr: 'MISSION 24',
    text: 'City communications tower under siege! Hold the air and protect HQ at all costs.',
    textFr: 'La tour de communications de la ville est assiégée ! Tenez le ciel et protégez le QG à tout prix.'
  },
  {
    title: 'MISSION 25', titleFr: 'MISSION 25',
    text: 'Halfway there, cadet! The city\'s neon lights flicker as enemy volleys light up the night.',
    textFr: 'À mi-chemin, cadet ! Les néons de la ville clignotent pendant que les volées ennemies illuminent la nuit.'
  },
  {
    title: 'MISSION 26', titleFr: 'MISSION 26',
    text: 'A rival ace pilot has joined the enemy! They\'re smart — you\'ll need to be smarter.',
    textFr: 'Un as rival a rejoint les ennemis ! Ils sont intelligents — il vous faudra être plus intelligent.'
  },
  {
    title: 'MISSION 27', titleFr: 'MISSION 27',
    text: 'Power grid attack! The city goes dark. Your instruments still work — your math must too!',
    textFr: 'Attaque sur le réseau électrique ! La ville s\'éteint. Vos instruments fonctionnent encore — vos maths aussi !'
  },
  {
    title: 'MISSION 28', titleFr: 'MISSION 28',
    text: 'Urban canyon run! Enemies fire from every rooftop. Chain your answers and don\'t slow down.',
    textFr: 'Course dans le canyon urbain ! Les ennemis tirent de chaque toiture. Enchaînez vos réponses et ne ralentissez pas.'
  },
  {
    title: 'MISSION 29', titleFr: 'MISSION 29',
    text: 'The enemy faction leader is broadcasting live! Show the world how it\'s done. Destroy them!',
    textFr: 'Le chef de faction ennemi diffuse en direct ! Montrez au monde comment c\'est fait. Détruisez-le !'
  },
  {
    title: 'MISSION 30', titleFr: 'MISSION 30',
    text: 'BOSS ALERT! The City Overlord commands a massive warship. Division is coming — bring it!',
    textFr: 'ALERTE BOSS ! Le Seigneur de la Ville commande un énorme vaisseau de guerre. La division arrive — préparez-vous !'
  },

  // Levels 31–40: Arctic, major battles, division unlocks
  {
    title: 'MISSION 31', titleFr: 'MISSION 31',
    text: 'Arctic theatre! Sub-zero temps, icy crosswinds, and division math. Welcome to the big leagues.',
    textFr: 'Théâtre arctique ! Températures négatives, vents de travers glacials, et maths de division. Bienvenue dans la cour des grands.'
  },
  {
    title: 'MISSION 32', titleFr: 'MISSION 32',
    text: 'Glaciers hide enemy subs below. Keep the air clear with precise, lightning-fast division!',
    textFr: 'Les glaciers cachent des sous-marins ennemis en dessous. Gardez l\'air libre avec une division précise et rapide comme l\'éclair !'
  },
  {
    title: 'MISSION 33', titleFr: 'MISSION 33',
    text: 'Blizzard incoming! Visibility drops to near-zero. Your brain is the only radar you\'ve got.',
    textFr: 'Blizzard en approche ! La visibilité chute à presque zéro. Votre cerveau est le seul radar dont vous disposez.'
  },
  {
    title: 'MISSION 34', titleFr: 'MISSION 34',
    text: 'Enemy supply lines crossing the frozen sea. Cut them off — one correct answer at a time.',
    textFr: 'Les lignes d\'approvisionnement ennemies traversent la mer gelée. Coupez-les — une bonne réponse à la fois.'
  },
  {
    title: 'MISSION 35', titleFr: 'MISSION 35',
    text: 'Arctic Station Alpha is under attack! Defend it or lose the northern corridor for good.',
    textFr: 'La Station Arctique Alpha est attaquée ! Défendez-la ou perdez le couloir nord définitivement.'
  },
  {
    title: 'MISSION 36', titleFr: 'MISSION 36',
    text: 'An armored wing of elite enemy fighters scrambles! Full math suite needed. You\'ve got this.',
    textFr: 'Une escadrille blindée de chasseurs ennemis d\'élite est en alerte ! Suite mathématique complète nécessaire. Vous y arrivez.'
  },
  {
    title: 'MISSION 37', titleFr: 'MISSION 37',
    text: 'The northern lights paint the sky red — enemy signals everywhere. Stay locked in, cadet!',
    textFr: 'Les aurores boréales peignent le ciel en rouge — signaux ennemis partout. Restez concentré, cadet !'
  },
  {
    title: 'MISSION 38', titleFr: 'MISSION 38',
    text: 'Ice shelf collapsing beneath enemy troops. Deliver the final blow from above. Swift and precise.',
    textFr: 'La banquise s\'effondre sous les troupes ennemies. Portez le coup fatal d\'en haut. Rapide et précis.'
  },
  {
    title: 'MISSION 39', titleFr: 'MISSION 39',
    text: 'Final Arctic push! Elite squads converge on your position. Answer fast — lives are on the line.',
    textFr: 'Dernière offensive arctique ! Les escouades d\'élite convergent sur votre position. Répondez vite — des vies sont en jeu.'
  },
  {
    title: 'MISSION 40', titleFr: 'MISSION 40',
    text: 'BOSS ALERT! Ice Titan rises from a frozen lake! This is the biggest threat yet. Destroy it!',
    textFr: 'ALERTE BOSS ! Le Titan de Glace surgit d\'un lac gelé ! C\'est la plus grande menace jusqu\'ici. Détruisez-le !'
  },

  // Levels 41–50: Space frontier, final boss arc, legendary status
  {
    title: 'MISSION 41', titleFr: 'MISSION 41',
    text: 'You\'ve reached SPACE! Zero gravity, alien signals, and the hardest math of your career. Go!',
    textFr: 'Vous avez atteint L\'ESPACE ! Gravité zéro, signaux extraterrestres, et les maths les plus dures de votre carrière. Allez !'
  },
  {
    title: 'MISSION 42', titleFr: 'MISSION 42',
    text: 'Satellite network hacked by enemy AI! Solve equations to reclaim control of the grid.',
    textFr: 'Réseau satellite piraté par une IA ennemie ! Résolvez des équations pour reprendre le contrôle du réseau.'
  },
  {
    title: 'MISSION 43', titleFr: 'MISSION 43',
    text: 'Alien drone swarms detected! They calculate faster than any human — prove them wrong!',
    textFr: 'Des essaims de drones extraterrestres détectés ! Ils calculent plus vite que n\'importe quel humain — prouvez-leur le contraire !'
  },
  {
    title: 'MISSION 44', titleFr: 'MISSION 44',
    text: 'A black hole event horizon ahead. Navigate with pure math precision — no room for error.',
    textFr: 'Un horizon d\'événement de trou noir devant. Naviguez avec une précision mathématique pure — pas de place pour l\'erreur.'
  },
  {
    title: 'MISSION 45', titleFr: 'MISSION 45',
    text: 'Space pirates raiding the last fuel depot! Protect it or the whole fleet strands in orbit.',
    textFr: 'Des pirates de l\'espace attaquent le dernier dépôt de carburant ! Protégez-le ou toute la flotte reste coincée en orbite.'
  },
  {
    title: 'MISSION 46', titleFr: 'MISSION 46',
    text: 'Enemy flagship detected. Bigger than anything you\'ve faced. Your math is your warp drive!',
    textFr: 'Vaisseau amiral ennemi détecté. Plus grand que tout ce que vous avez affronté. Vos maths sont votre moteur de distorsion !'
  },
  {
    title: 'MISSION 47', titleFr: 'MISSION 47',
    text: 'Cosmic storm raging! Your instruments flicker but your equations never fail. Hold the line!',
    textFr: 'Tempête cosmique en furie ! Vos instruments vacillent mais vos équations ne faillissent jamais. Tenez la ligne !'
  },
  {
    title: 'MISSION 48', titleFr: 'MISSION 48',
    text: 'The enemy AI reveals itself — intelligent, fast, ruthless. Show it humans never give up!',
    textFr: 'L\'IA ennemie se révèle — intelligente, rapide, impitoyable. Montrez-lui que les humains n\'abandonnent jamais !'
  },
  {
    title: 'MISSION 49', titleFr: 'MISSION 49',
    text: 'FINAL APPROACH! Every faction, every enemy, every boss — all aligned against you. This is it!',
    textFr: 'APPROCHE FINALE ! Chaque faction, chaque ennemi, chaque boss — tous alignés contre vous. C\'est le moment !'
  },
  {
    title: 'MISSION 50', titleFr: 'MISSION 50',
    text: 'FINAL BOSS! The Galactic Overlord — supreme commander of all enemies! Become a legend NOW!',
    textFr: 'BOSS FINAL ! Le Seigneur Galactique — commandant suprême de tous les ennemis ! Devenez une légende MAINTENANT !'
  },
];

/**
 * Returns the story entry for a given level number.
 * @param {number} levelNum - 1-indexed level number
 * @returns {{ title: string, text: string, titleFr: string, textFr: string }}
 */
export function getStory(levelNum) {
  const idx = Math.max(0, Math.min(levelNum - 1, STORIES.length - 1));
  return STORIES[idx] || {
    title: `MISSION ${levelNum}`,
    titleFr: `MISSION ${levelNum}`,
    text: 'New skies, new challenges. Fly true and aim sharp!',
    textFr: 'De nouveaux cieux, de nouveaux défis. Volez droit et visez juste !'
  };
}
