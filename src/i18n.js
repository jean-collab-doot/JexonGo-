const STRINGS = {
  en: {
    // Menu
    subtitle:        'AERIAL MATH COMBAT',
    play:            '▶ PLAY',
    hangar:          '✈ HANGAR',
    shop:            '◆ SHOP',
    practice:        '⚡ PRACTICE',
    missions:        '≡ MISSIONS',
    ranked:          '⚔ RANKED',
    classroom:       '# CLASSROOM',
    signIn:          '— SIGN IN —',
    signInGoogle:    'SIGN IN WITH GOOGLE',
    signInApple:     'SIGN IN WITH APPLE',
    signOut:         '× SIGN OUT',
    signUp:          '✦ SIGN UP',
    logIn:           '▶ LOG IN',
    loginTitle:      'LOG IN',
    loginErrEmail:   'ENTER A VALID EMAIL',
    loginErrPw:      'ENTER YOUR PASSWORD',
    loginErrNone:    'NO ACCOUNT — SIGN UP FIRST',
    loginErrWrong:   'WRONG EMAIL OR PASSWORD',

    // Briefing
    briefingTitle:   'MISSION BRIEFING',
    fly:             '✈ FLY!',
    timeLimit:       'TIME LIMIT',
    mathType:        'MATH TYPE',
    secPerQ:         's per question',
    ops: {
      '+': 'Addition',
      '-': 'Subtraction',
      '*': 'Multiplication',
      '/': 'Division',
    },

    // Game HUD
    lives:           'LIVES',
    streak:          'STREAK',
    level:           'LEVEL',
    score:           'SCORE',
    practice_label:  'PRACTICE',
    bossLevel:       '⚠ BOSS LV',
    loading:         'LOADING...',
    wrongReveal:     '✗ Wrong — let\'s see how to solve it',
    answerReveal:    '✓ Answer:',
    explainAdd:      'Start at {a}, then add {b}  →  {a} + {b} = {answer}',
    explainSub:      'Start at {a}, then subtract {b}  →  {a} − {b} = {answer}',
    explainMul:      '{a} groups of {b}  →  {a} × {b} = {answer}',
    explainDiv:      'How many {b}s fit in {a}?  →  {a} ÷ {b} = {answer}',
    quit:            '✕ QUIT',

    // Result screen
    missionComplete: 'MISSION COMPLETE',
    practiceComplete:'PRACTICE COMPLETE',
    noXpPractice:    'No XP in practice',
    correct:         'correct',
    continueBtn:     'CONTINUE',
    retry:           'RETRY',

    // Game over screen
    keepGoing:       'KEEP GOING!',
    youCanDoIt:      'YOU CAN DO IT!',
    almostThere:     'ALMOST THERE!',
    neverGiveUp:     'NEVER GIVE UP!',
    tryAgain:        'TRY AGAIN!',
    believeInYourself: 'BELIEVE IN YOURSELF!',
    correctKeepPracticing: 'correct — keep practising!',
    gameOver:        'GAME OVER',
    backToMenu:      'LOBBY',

    // Level map
    selectMission:   'SELECT MISSION',
    locked:          'LOCKED',
    completed:       'COMPLETED',
    boss:            'BOSS',

    // Hangar
    hangarTitle:     'HANGAR',
    starter:         'STARTER',
    active:          'ACTIVE',
    unlock:          'UNLOCK',
    liveries:        'LIVERIES',

    // Shop
    shop_title:      'SHOP',
    offers:          'OFFERS',
    skins:           'SKINS',
    more:            'MORE',
    buy:             'BUY',
    owned:           'OWNED',
    equipped:        '✓ EQUIPPED',
    equip:           'EQUIP ▶',
    specialOffer:    'SPECIAL OFFER',
    bestValue:       'BEST VALUE!',
    buyChests:       '◈ BUY CHESTS',
    needMoreCoins:   '✗ NEED',
    moreCoins:       'MORE COINS',

    // Chest screen
    chestReward:     'CHEST REWARD',
    chestSuffix:     'CHEST',
    openChest:       'OPEN CHEST',
    convertedToCoins:'CONVERTED TO COINS',
    duplicate:       'DUPLICATE',
    unlocked:        '✈ UNLOCKED:',

    // Settings
    settings:        '⚙ SETTINGS',
    volume:          'VOLUME',
    effects:         'EFFECTS',
    controls:        '► CONTROLS',
    move:            'MOVE',
    on:              'ON',
    off:             'OFF',

    // Practice panel
    chooseOps:       'CHOOSE OPERATIONS',
    add:             'ADD',
    sub:             'SUB',
    mul:             'MUL',
    div:             'DIV',
    selectAll:       'SELECT ALL',
    heartsLives:     '♥ LIVES',
    start:           '▶ START',

    // Missions panel (in menu.js)
    dailyMissions:   'DAILY MISSIONS',
    claim:           'CLAIM',
    claimed:         'CLAIMED ✓',
    resetsIn:        'RESETS IN',

    // Daily reward popup
    dailyReward:     '✦ DAILY REWARD',
    claimReward:     'CLAIM REWARD',
    todayReward:     'TODAY\'S REWARD',

    // Ranked
    findMatch:       '⚔ FIND MATCH',
    matchHistory:    '≡ MATCH HISTORY',
    findingOpp:      'FINDING OPPONENT',
    searching:       'SEARCHING FOR MATCH',
    victory:         'VICTORY!',
    defeat:          'DEFEAT',
    draw:            'DRAW',
    rematch:         '⚔ REMATCH',
    lobby:           'LOBBY',
    placementLabel:  'PLACEMENT',
    seasonEnds:      'SEASON ENDS',
    dailyBonus:      '⚡ DAILY WIN BONUS +10 LP',
    dailyClaimed:    '✓ DAILY BONUS CLAIMED',
    dailyFirstWin:   'DAILY FIRST WIN',
    winStreak:       'WIN STREAK',
    promotedTo:      'PROMOTED TO',
    demotedTo:       'DEMOTED TO',

    // Duel HUD
    you:             'YOU',
    opp:             'OPP',

    // Classroom
    classroomTitle:  '# CLASSROOM',
    joinYourClass:   'JOIN YOUR CLASS',
    joinClass:       'JOIN CLASS',
    createClass:     'CREATE CLASSROOM',
    leaveClass:      'LEAVE CLASS',
    enterCode:       'ENTER CODE',
    teacherName:     'TEACHER NAME',
    classCode:       'CLASS CODE',
    myClassrooms:    'MY CLASSROOMS',
    noStudents:      'NO STUDENTS YET',

    // Grade selection
    gradeSelectTitle:  'WELCOME, PILOT!',
    gradeSelectSub:    'SELECT YOUR SCHOOL GRADE',
    gradeSelectHint:   'Math difficulty adapts to your grade',
    gradeLabel:        'GRADE',

    // Pilot grades
    pilotCadet:        'CADET',
    pilot2ndLt:        '2ND LIEUTENANT',
    pilotLt:           'LIEUTENANT',
    pilotCaptain:      'CAPTAIN',
    pilotMajor:        'MAJOR',
    pilotColonel:      'COLONEL',
    pilotGeneral:      'GENERAL',
    pilotAirAce:       'AIR ACE',

    // Registration screen
    regTitle:          'CREATE YOUR PILOT',
    regNamePh:         'CALL SIGN / NAME',
    regEmailPh:        'EMAIL ADDRESS',
    regPasswordPh:     'PASSWORD (6+ CHARS)',
    regAgePh:          '-- SELECT YOUR AGE --',
    regGradePh:        '-- SELECT SCHOOL GRADE --',
    regTos:            'I AGREE TO THE TERMS OF SERVICE',
    regSubmit:         '▶ CREATE PILOT',
    regErrName:        'ENTER YOUR CALL SIGN',
    regErrEmail:       'ENTER A VALID EMAIL',
    regErrPassword:    'PASSWORD MUST BE 6+ CHARS',
    regErrAge:         'SELECT YOUR AGE',
    regErrGrade:       'SELECT YOUR SCHOOL GRADE',
    regErrTos:         'ACCEPT THE TERMS TO CONTINUE',

    // Login toasts & alerts
    welcomeBack:       '✓ WELCOME BACK, {name}!',
    welcomeNew:        '✓ WELCOME, {name}! You start from zero — good luck!',
    signInToUnlock:    'Sign in to unlock',
    signInAlert:       'Sign in with Google to unlock all 50 levels and save your progress!',
    offlineBanner:     '✈ Sign in with Google to save your progress and unlock all 50 levels',
    sr71Unlocked:      '★ SR-71 BLACKBIRD UNLOCKED!',
    promoted:          'PROMOTED',
    googleNotAvail:    '■ Google not available',
    googleNotLoaded:   '■ Sign-In not loaded — try refreshing',
    openInBrowser:     '■ Open in Safari or Chrome to use Google Sign-In',

    // Feedback
    feedbackTitle:     'HOW DO YOU LIKE JEXONGO ?',
    feedbackSub:       '★ DAILY FEEDBACK ★',
    feedbackCommentPh: 'YOUR COMMENT (OPTIONAL)...',
    feedbackSubmit:    '▶ SEND FEEDBACK',
    feedbackSending:   'SENDING...',
    feedbackSkip:      'SKIP',
    feedbackThanks:    '✓ THANK YOU, PILOT !\nYOUR FEEDBACK HELPS US FLY HIGHER.',
    feedbackErrRating: 'PLEASE SELECT A STAR RATING',
    feedbackErrConn:   'SEND FAILED — CHECK CONNECTION',
    feedbackBtn:       '★ FEEDBACK',
  },

  fr: {
    // Menu
    subtitle:        'COMBAT MATHÉMATIQUE AÉRIEN',
    play:            '▶ JOUER',
    hangar:          '✈ HANGAR',
    shop:            '◆ BOUTIQUE',
    practice:        '⚡ ENTRAÎNEMENT',
    missions:        '≡ MISSIONS',
    ranked:          '⚔ CLASSÉ',
    classroom:       '# CLASSE',
    signIn:          '— CONNEXION —',
    signInGoogle:    'SE CONNECTER AVEC GOOGLE',
    signInApple:     'SE CONNECTER AVEC APPLE',
    signOut:         '× DÉCONNEXION',
    signUp:          '✦ S\'INSCRIRE',
    logIn:           '▶ SE CONNECTER',
    loginTitle:      'CONNEXION',
    loginErrEmail:   'EMAIL INVALIDE',
    loginErrPw:      'MOT DE PASSE REQUIS',
    loginErrNone:    'AUCUN COMPTE — INSCRIVEZ-VOUS D\'ABORD',
    loginErrWrong:   'EMAIL OU MOT DE PASSE INCORRECT',

    // Briefing
    briefingTitle:   'BRIEFING DE MISSION',
    fly:             '✈ DÉCOLLER !',
    timeLimit:       'LIMITE DE TEMPS',
    mathType:        'TYPE DE CALCUL',
    secPerQ:         's par question',
    ops: {
      '+': 'Addition',
      '-': 'Soustraction',
      '*': 'Multiplication',
      '/': 'Division',
    },

    // Game HUD
    lives:           'VIES',
    streak:          'SÉRIE',
    level:           'NIVEAU',
    score:           'SCORE',
    practice_label:  'ENTRAÎNEMENT',
    bossLevel:       '⚠ BOSS NIV.',
    loading:         'CHARGEMENT...',
    wrongReveal:     '✗ Faux — voyons comment résoudre',
    answerReveal:    '✓ Réponse :',
    explainAdd:      'Part de {a}, ajoute {b}  →  {a} + {b} = {answer}',
    explainSub:      'Part de {a}, soustrait {b}  →  {a} − {b} = {answer}',
    explainMul:      '{a} groupes de {b}  →  {a} × {b} = {answer}',
    explainDiv:      'Combien de {b} dans {a} ?  →  {a} ÷ {b} = {answer}',
    quit:            '✕ QUITTER',

    // Result screen
    missionComplete: 'MISSION ACCOMPLIE',
    practiceComplete:'ENTRAÎNEMENT TERMINÉ',
    noXpPractice:    'Pas d\'XP en entraînement',
    correct:         'correctes',
    continueBtn:     'CONTINUER',
    retry:           'RÉESSAYER',

    // Game over screen
    keepGoing:       'CONTINUEZ !',
    youCanDoIt:      'VOUS POUVEZ LE FAIRE !',
    almostThere:     'PRESQUE !',
    neverGiveUp:     'NE LÂCHEZ PAS !',
    tryAgain:        'RÉESSAYEZ !',
    believeInYourself: 'CROYEZ EN VOUS !',
    correctKeepPracticing: 'correctes — continuez à pratiquer !',
    gameOver:        'PARTIE TERMINÉE',
    backToMenu:      'ACCUEIL',

    // Level map
    selectMission:   'CHOISIR UNE MISSION',
    locked:          'VERROUILLÉ',
    completed:       'TERMINÉ',
    boss:            'BOSS',

    // Hangar
    hangarTitle:     'HANGAR',
    starter:         'DÉBUTANT',
    active:          'ACTIF',
    unlock:          'DÉBLOQUER',
    liveries:        'LIVRÉES',

    // Shop
    shop_title:      'BOUTIQUE',
    offers:          'OFFRES',
    skins:           'SKINS',
    more:            'PLUS',
    buy:             'ACHETER',
    owned:           'POSSÉDÉ',
    equipped:        '✓ ÉQUIPÉ',
    equip:           'ÉQUIPER ▶',
    specialOffer:    'OFFRE SPÉCIALE',
    bestValue:       'MEILLEUR PRIX !',
    buyChests:       '◈ ACHETER DES COFFRES',
    needMoreCoins:   '✗ BESOIN DE',
    moreCoins:       'PIÈCES DE PLUS',

    // Chest screen
    chestReward:     'RÉCOMPENSE DU COFFRE',
    chestSuffix:     'COFFRE',
    openChest:       'OUVRIR LE COFFRE',
    convertedToCoins:'CONVERTI EN PIÈCES',
    duplicate:       'DOUBLON',
    unlocked:        '✈ DÉBLOQUÉ :',

    // Settings
    settings:        '⚙ PARAMÈTRES',
    volume:          'VOLUME',
    effects:         'EFFETS',
    controls:        '► CONTRÔLES',
    move:            'DÉPLACER',
    on:              'ACT.',
    off:             'DÉS.',

    // Practice panel
    chooseOps:       'CHOISIR LES OPÉRATIONS',
    add:             'ADD',
    sub:             'SOL',
    mul:             'MUL',
    div:             'DIV',
    selectAll:       'TOUT SÉLECTIONNER',
    heartsLives:     '♥ VIES',
    start:           '▶ DÉMARRER',

    // Missions panel (in menu.js)
    dailyMissions:   'MISSIONS DU JOUR',
    claim:           'RÉCLAMER',
    claimed:         'RÉCLAMÉ ✓',
    resetsIn:        'RÉINITIALISE DANS',

    // Daily reward popup
    dailyReward:     '✦ RÉCOMPENSE QUOTIDIENNE',
    claimReward:     'RÉCLAMER LA RÉCOMPENSE',
    todayReward:     'RÉCOMPENSE DU JOUR',

    // Ranked
    findMatch:       '⚔ TROUVER UN MATCH',
    matchHistory:    '≡ HISTORIQUE',
    findingOpp:      'RECHERCHE ADVERSAIRE',
    searching:       'RECHERCHE EN COURS',
    victory:         'VICTOIRE !',
    defeat:          'DÉFAITE',
    draw:            'ÉGALITÉ',
    rematch:         '⚔ REVANCHE',
    lobby:           'ACCUEIL',
    placementLabel:  'CLASSEMENT',
    seasonEnds:      'FIN DE SAISON',
    dailyBonus:      '⚡ BONUS QUOTIDIEN +10 LP',
    dailyClaimed:    '✓ BONUS DU JOUR RÉCLAMÉ',
    dailyFirstWin:   'PREMIÈRE VICTOIRE',
    winStreak:       'SÉRIE DE VICTOIRES',
    promotedTo:      'PROMU EN',
    demotedTo:       'RÉTROGRADÉ EN',

    // Duel HUD
    you:             'TOI',
    opp:             'ADV',

    // Classroom
    classroomTitle:  '# CLASSE',
    joinYourClass:   'REJOINDRE MA CLASSE',
    joinClass:       'REJOINDRE',
    createClass:     'CRÉER UNE CLASSE',
    leaveClass:      'QUITTER LA CLASSE',
    enterCode:       'ENTRER LE CODE',
    teacherName:     'NOM DU PROF',
    classCode:       'CODE DE CLASSE',
    myClassrooms:    'MES CLASSES',
    noStudents:      'AUCUN ÉLÈVE',

    // Grade selection
    gradeSelectTitle:  'BIENVENUE, PILOTE !',
    gradeSelectSub:    'CHOISISSEZ VOTRE NIVEAU SCOLAIRE',
    gradeSelectHint:   'La difficulté s\'adapte à votre niveau',
    gradeLabel:        'NIVEAU',

    // Pilot grades
    pilotCadet:        'CADET',
    pilot2ndLt:        '2E LIEUTENANT',
    pilotLt:           'LIEUTENANT',
    pilotCaptain:      'CAPITAINE',
    pilotMajor:        'COMMANDANT',
    pilotColonel:      'COLONEL',
    pilotGeneral:      'GÉNÉRAL',
    pilotAirAce:       'AS DE L\'AIR',

    // Registration screen
    regTitle:          'CRÉER VOTRE PILOTE',
    regNamePh:         'INDICATIF / NOM',
    regEmailPh:        'ADRESSE EMAIL',
    regPasswordPh:     'MOT DE PASSE (6+ CAR.)',
    regAgePh:          '-- SÉLECTIONNEZ VOTRE ÂGE --',
    regGradePh:        '-- CHOISIR VOTRE NIVEAU --',
    regTos:            'J\'ACCEPTE LES CONDITIONS D\'UTILISATION',
    regSubmit:         '▶ CRÉER MON PILOTE',
    regErrName:        'ENTREZ VOTRE INDICATIF',
    regErrEmail:       'EMAIL INVALIDE',
    regErrPassword:    'MOT DE PASSE 6 CAR. MIN.',
    regErrAge:         'SÉLECTIONNEZ VOTRE ÂGE',
    regErrGrade:       'CHOISISSEZ VOTRE NIVEAU',
    regErrTos:         'ACCEPTEZ LES CONDITIONS',

    // Login toasts & alerts
    welcomeBack:       '✓ BIENVENUE, {name} !',
    welcomeNew:        '✓ BIENVENUE, {name} ! Tu pars de zéro — bonne chance !',
    signInToUnlock:    'Connectez-vous pour débloquer',
    signInAlert:       'Connectez-vous avec Google pour débloquer les 50 niveaux et sauvegarder votre progression !',
    offlineBanner:     '✈ Connectez-vous avec Google pour sauvegarder votre progression et débloquer les 50 niveaux',
    sr71Unlocked:      '★ SR-71 BLACKBIRD DÉBLOQUÉ !',
    promoted:          'PROMU',
    googleNotAvail:    '■ Google non disponible',
    googleNotLoaded:   '■ Connexion non chargée — actualisez',
    openInBrowser:     '■ Ouvrez dans Safari ou Chrome pour vous connecter',

    // Feedback
    feedbackTitle:     'COMMENT TROUVEZ-VOUS JEXONGO ?',
    feedbackSub:       '★ AVIS QUOTIDIEN ★',
    feedbackCommentPh: 'VOTRE COMMENTAIRE (OPTIONNEL)...',
    feedbackSubmit:    '▶ ENVOYER',
    feedbackSending:   'ENVOI...',
    feedbackSkip:      'PASSER',
    feedbackThanks:    '✓ MERCI, PILOTE !\nVOTRE AVIS NOUS AIDE À NOUS AMÉLIORER.',
    feedbackErrRating: 'VEUILLEZ SÉLECTIONNER UNE NOTE',
    feedbackErrConn:   'ÉCHEC D\'ENVOI — VÉRIFIEZ LA CONNEXION',
    feedbackBtn:       '★ AVIS',
  },
};

let _lang = localStorage.getItem('jexongo_lang') || 'en';

export function getLang() { return _lang; }

export function setLang(lang) {
  _lang = lang;
  localStorage.setItem('jexongo_lang', lang);
  applyI18n();
}

export function t(key) {
  return (STRINGS[_lang] || STRINGS.en)[key] ?? (STRINGS.en[key] ?? key);
}

export function tOp(op) {
  return ((STRINGS[_lang] || STRINGS.en).ops || STRINGS.en.ops)[op] ?? op;
}

// Translates all elements with data-i18n or data-i18n-placeholder attributes
export function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const val = t(key);
    if (val !== key) el.textContent = val;
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    const val = t(key);
    if (val !== key) el.placeholder = val;
  });
}
