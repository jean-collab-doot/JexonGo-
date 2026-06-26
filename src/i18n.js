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
    signInGame:      'CONNECT WITH JEXONGO',
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
    briefingStarComplete: 'Complete the level',
    briefingStarAccuracy: '70%+ correct answers',
    briefingStarPerfect:  '100% correct + never hit',
    pilotTierDesc_cadet: 'Training begins...',
    pilotTierDesc_pilot: 'First solo flight!',
    pilotTierDesc_ace: 'A force to reckon with.',
    pilotTierDesc_general: 'Leading the squadron.',
    pilotTierDesc_commander: 'Sky legend.',
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

    // Rarity labels
    rarityCommon:    'COMMON',
    rarityRare:      'RARE',
    rarityEpic:      'EPIC',
    rarityLegendary: 'LEGENDARY',
    rarityExclusive: 'EXCLUSIVE',
    skinLabel:       'SKIN',

    // Chest shop
    chestBronze:     'BRONZE',
    chestSilver:     'SILVER',
    chestGold:       'GOLD',
    chestLegendary:  'LEGENDARY',
    chestDescBronze: 'Common\ndrops',
    chestDescSilver: 'Rare\ndrops',
    chestDescGold:   'Epic\nchance',
    chestDescLegend: 'Best\ndrops',

    // SR-71 challenge card
    challengeReward: '★ CHALLENGE REWARD',
    sr71Sub:         'Full aircraft + Exclusive Skin',
    sr71Cond:        'Answer all questions correctly on level 30',
    claimFree:       '▶ CLAIM FREE',
    notYetEarned:    '— NOT YET EARNED',
    sr71Owned:       '✓ UNLOCKED',

    // Blueprint section
    blueprintParts:  'BLUEPRINT PARTS',
    unlockedShort:   'UNLOCKED',
    needPlane:       '■ Need {name}',
    unlockToEquip:   'Unlock {name} to equip',

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
    regConfirmPasswordPh: 'CONFIRM PASSWORD',
    regAgePh:          '-- SELECT YOUR AGE --',
    regGradePh:        '-- SELECT SCHOOL GRADE --',
    regTos:            'I AGREE TO THE TERMS OF SERVICE',
    regPrivacy:        'I HAVE READ AND ACCEPT THE PRIVACY POLICY.',
    privacyPolicyLink: 'PRIVACY POLICY',
    regSubmit:         '▶ CREATE PILOT',
    regErrName:        'ENTER YOUR CALL SIGN',
    regErrEmail:       'ENTER A VALID EMAIL',
    regErrPassword:    'PASSWORD MUST BE 6+ CHARS',
    regErrPasswordMatch: 'PASSWORDS DO NOT MATCH',
    regErrAge:         'SELECT YOUR AGE',
    regErrGrade:       'SELECT YOUR SCHOOL GRADE',
    regErrTos:         'ACCEPT THE TERMS TO CONTINUE',
    regErrPrivacy:     'ACCEPT THE PRIVACY POLICY',

    // Login toasts & alerts
    welcomeBack:       '✓ WELCOME BACK, {name}!',
    welcomeNew:        '✓ WELCOME, {name}! You start from zero — good luck!',
    syncOffline:       'Account connected - cloud backup is not ready, progress saves on this device.',
    syncOk:            'Progress synced from your account.',
    signInToUnlock:    'Sign in to unlock',
    signInAlert:       'Sign in with your JexonGo account to unlock all 50 levels and save your progress!',
    offlineBanner:     '✈ Sign in with your JexonGo account to save your progress and unlock all 50 levels',
    sr71Unlocked:      '★ SR-71 BLACKBIRD UNLOCKED!',
    promoted:          'PROMOTED',
    googleNotAvail:    '■ Google not available',
    googleNotLoaded:   '■ Sign-In not loaded — try refreshing',
    openInBrowser:     '■ Open in Safari or Chrome to use Google Sign-In',

    // Account deletion
    deleteAccount:      'DELETE ACCOUNT',
    deleteAccountTitle: 'DELETE ACCOUNT',
    deleteAccountWarning: 'This permanently deletes your JexonGO cloud save from this account.',
    deleteReasonLabel:  'WHY ARE YOU DELETING?',
    deleteReasonChoose: 'CHOOSE A REASON',
    deleteReasonPrivacy:'PRIVACY CONCERN',
    deleteReasonBug:    'BUG OR TECHNICAL PROBLEM',
    deleteReasonTooHard:'GAME IS TOO HARD',
    deleteReasonNotFun: 'I DO NOT PLAY ANYMORE',
    deleteReasonOther:  'OTHER',
    deleteImproveLabel: 'WHAT COULD WE IMPROVE?',
    deleteImprovePlaceholder: 'OPTIONAL MESSAGE',
    deleteAccountUnderstand: 'I understand this cannot be undone.',
    deleteTypeDelete:   'TYPE DELETE',
    deleteAccountCancel:'CANCEL',
    deleteAccountConfirm: 'DELETE FOREVER',
    deleteAccountDeleting: 'DELETING...',
    deleteAccountMissingReason: 'CHOOSE A REASON',
    deleteAccountNeedConfirm: 'CHECK THE CONFIRMATION BOX',
    deleteAccountTypeError: 'TYPE DELETE TO CONFIRM',
    deleteAccountFailed: 'DELETE FAILED - CHECK CONNECTION',
    deleteAccountForbidden: 'SECURE SESSION MISSING - SIGN IN WITH JEXONGO',
    deleteAccountDbPolicy: 'DATABASE DELETE POLICY MISSING',
    deleteAccountAuthSkipped: 'GAME DATA DELETED - AUTH DELETE KEY MISSING',

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
    signInGame:      'SE CONNECTER AVEC JEXONGO',
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
    briefingStarComplete: 'Terminer le niveau',
    briefingStarAccuracy: '70%+ de bonnes reponses',
    briefingStarPerfect:  '100% correct + aucun impact',
    pilotTierDesc_cadet: 'L entrainement commence...',
    pilotTierDesc_pilot: 'Premier vol en solo !',
    pilotTierDesc_ace: 'Une force redoutable.',
    pilotTierDesc_general: 'Chef de l escadron.',
    pilotTierDesc_commander: 'Legende du ciel.',
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

    // Rarity labels
    rarityCommon:    'COMMUN',
    rarityRare:      'RARE',
    rarityEpic:      'ÉPIQUE',
    rarityLegendary: 'LÉGENDAIRE',
    rarityExclusive: 'EXCLUSIF',
    skinLabel:       'SKIN',

    // Chest shop
    chestBronze:     'BRONZE',
    chestSilver:     'ARGENT',
    chestGold:       'OR',
    chestLegendary:  'LÉGENDAIRE',
    chestDescBronze: 'Récompenses\ncourantes',
    chestDescSilver: 'Récompenses\nrares',
    chestDescGold:   'Chance\nÉpique',
    chestDescLegend: 'Meilleures\nrécomp.',

    // SR-71 challenge card
    challengeReward: '★ RÉCOMPENSE DU DÉFI',
    sr71Sub:         'Avion complet + Skin Exclusif',
    sr71Cond:        'Toutes les questions du niveau 30 sans faute',
    claimFree:       '▶ OBTENIR GRATUITEMENT',
    notYetEarned:    '— PAS ENCORE GAGNÉ',
    sr71Owned:       '✓ DÉBLOQUÉ',

    // Blueprint section
    blueprintParts:  'PIÈCES AVION',
    unlockedShort:   'DÉBLOQUÉ',
    needPlane:       '■ Besoin de {name}',
    unlockToEquip:   'Débloquez {name} pour équiper',

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
    regConfirmPasswordPh: 'CONFIRMER LE MOT DE PASSE',
    regAgePh:          '-- SÉLECTIONNEZ VOTRE ÂGE --',
    regGradePh:        '-- CHOISIR VOTRE NIVEAU --',
    regTos:            'J\'ACCEPTE LES CONDITIONS D\'UTILISATION',
    regPrivacy:        'J\'AI LU ET J\'ACCEPTE LA POLITIQUE DE CONFIDENTIALITE.',
    privacyPolicyLink: 'POLITIQUE DE CONFIDENTIALITE',
    regSubmit:         '▶ CRÉER MON PILOTE',
    regErrName:        'ENTREZ VOTRE INDICATIF',
    regErrEmail:       'EMAIL INVALIDE',
    regErrPassword:    'MOT DE PASSE 6 CAR. MIN.',
    regErrPasswordMatch: 'LES MOTS DE PASSE NE CORRESPONDENT PAS',
    regErrAge:         'SÉLECTIONNEZ VOTRE ÂGE',
    regErrGrade:       'CHOISISSEZ VOTRE NIVEAU',
    regErrTos:         'ACCEPTEZ LES CONDITIONS',
    regErrPrivacy:     'ACCEPTEZ LA POLITIQUE DE CONFIDENTIALITE',

    // Login toasts & alerts
    welcomeBack:       '✓ BIENVENUE, {name} !',
    welcomeNew:        '✓ BIENVENUE, {name} ! Tu pars de zéro — bonne chance !',
    syncOffline:       'Compte connecte - sauvegarde cloud non prete, progression sur cet appareil.',
    syncOk:            'Progression synchronisée depuis votre compte.',
    signInToUnlock:    'Connectez-vous pour débloquer',
    signInAlert:       'Connectez-vous avec votre compte JexonGo pour débloquer les 50 niveaux et sauvegarder votre progression !',
    offlineBanner:     '✈ Connectez-vous avec votre compte JexonGo pour sauvegarder votre progression et débloquer les 50 niveaux',
    sr71Unlocked:      '★ SR-71 BLACKBIRD DÉBLOQUÉ !',
    promoted:          'PROMU',
    googleNotAvail:    '■ Google non disponible',
    googleNotLoaded:   '■ Connexion non chargée — actualisez',
    openInBrowser:     '■ Ouvrez dans Safari ou Chrome pour vous connecter',

    // Account deletion
    deleteAccount:      'SUPPRIMER LE COMPTE',
    deleteAccountTitle: 'SUPPRIMER LE COMPTE',
    deleteAccountWarning: 'Cela supprime definitivement la sauvegarde cloud JexonGO de ce compte.',
    deleteReasonLabel:  'POURQUOI SUPPRIMEZ-VOUS ?',
    deleteReasonChoose: 'CHOISIR UNE RAISON',
    deleteReasonPrivacy:'CONFIDENTIALITE',
    deleteReasonBug:    'BUG OU PROBLEME TECHNIQUE',
    deleteReasonTooHard:'JEU TROP DIFFICILE',
    deleteReasonNotFun: 'JE NE JOUE PLUS',
    deleteReasonOther:  'AUTRE',
    deleteImproveLabel: 'QUE PEUT-ON AMELIORER ?',
    deleteImprovePlaceholder: 'MESSAGE OPTIONNEL',
    deleteAccountUnderstand: 'Je comprends que cette action est definitive.',
    deleteTypeDelete:   'ECRIRE DELETE',
    deleteAccountCancel:'ANNULER',
    deleteAccountConfirm: 'SUPPRIMER DEFINITIVEMENT',
    deleteAccountDeleting: 'SUPPRESSION...',
    deleteAccountMissingReason: 'CHOISISSEZ UNE RAISON',
    deleteAccountNeedConfirm: 'COCHEZ LA CONFIRMATION',
    deleteAccountTypeError: 'ECRIVEZ DELETE POUR CONFIRMER',
    deleteAccountFailed: 'SUPPRESSION IMPOSSIBLE - VERIFIEZ LA CONNEXION',
    deleteAccountForbidden: 'SESSION SECURISEE MANQUANTE - CONNECTEZ-VOUS AVEC JEXONGO',
    deleteAccountDbPolicy: 'POLITIQUE DELETE MANQUANTE DANS LA BASE',
    deleteAccountAuthSkipped: 'DONNEES SUPPRIMEES - CLE AUTH MANQUANTE',

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

let _lang = localStorage.getItem('jexongo_lang') || 'fr';

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
