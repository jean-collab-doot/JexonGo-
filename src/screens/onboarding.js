import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { getLang, setLang } from '../i18n.js';
import { SFX } from '../audio/sound.js';

function introLang() {
  return getLang();
}

// Onboarding questions (yellow full-screen design). A step either lists
// `choices`, or groups them in titled `sections` (the answer index runs across
// all sections). `multi` steps need the CONTINUE button; single-choice steps
// move on as soon as an answer is tapped. Steps with `onboarding: false` are
// only used by the equation settings (showEquationConfig).
// Real school levels per country. `grade` is the game difficulty (1-6, by
// age: Quebec 1re annee = France CP = US 1st grade); questions stop at grade 6
// for now. `level` is the exact class, saved as G.schoolLevel.
const lvl = (label, level, grade) => ({ label, level, grade: Math.min(6, grade), schoolYear: grade });
function schoolSections(country, fr) {
  if (country === 'france') {
    return [
      { title: fr ? 'PRIMAIRE' : 'PRIMARY', choices: [
        lvl('CP', 'fr-cp', 1), lvl('CE1', 'fr-ce1', 2), lvl('CE2', 'fr-ce2', 3),
        lvl('CM1', 'fr-cm1', 4), lvl('CM2', 'fr-cm2', 5),
      ] },
      { title: fr ? 'COLLÈGE' : 'MIDDLE SCHOOL', choices: [
        lvl('6e', 'fr-6e', 6), lvl('5e', 'fr-5e', 7), lvl('4e', 'fr-4e', 8), lvl('3e', 'fr-3e', 9),
      ] },
      { title: fr ? 'LYCÉE' : 'HIGH SCHOOL', choices: [
        lvl('Seconde', 'fr-2nde', 10), lvl('Première', 'fr-1re', 11), lvl('Terminale', 'fr-term', 12),
      ] },
    ];
  }
  if (country === 'usa') {
    const us = n => lvl(`${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'} grade`, `us-${n}`, n);
    return [
      { title: 'ELEMENTARY SCHOOL', choices: [1, 2, 3, 4, 5].map(us) },
      { title: 'MIDDLE SCHOOL', choices: [6, 7, 8].map(us) },
      { title: 'HIGH SCHOOL', choices: [9, 10, 11, 12].map(us) },
    ];
  }
  // Quebec (and "other"): primaire 1-6, secondaire 1-5.
  return [
    { title: fr ? 'PRIMAIRE' : 'PRIMARY', choices: [1, 2, 3, 4, 5, 6].map(n =>
      lvl(fr ? `${n}${n === 1 ? 're' : 'e'} année` : `Grade ${n}`, `qc-prim${n}`, n)) },
    { title: fr ? 'SECONDAIRE' : 'SECONDARY', choices: [1, 2, 3, 4, 5].map(n =>
      lvl(fr ? `Secondaire ${n}` : `Secondary ${n}`, `qc-sec${n}`, 6 + n)) },
  ];
}
// Values saved for the topic step, in answer-index order.
// "Which numbers" step: custom range limits for the AUTRE field.
const RANGE_MIN = 5;
const RANGE_MAX = 1000;

// Algebra is offered from the first year of secondary school (Quebec
// secondaire 1, France 5e, US 7th grade = school year 7 and up).
const ALGEBRA_FROM_SCHOOL_YEAR = 7;

function topicSections(answers, fr) {
  const sections = [{
    title: fr ? 'PRIMAIRE' : 'PRIMARY',
    choices: [
      { label: '+', value: '+', symbol: true },
      { label: '−', value: '-', symbol: true },
      { label: '×', value: '*', symbol: true },
      { label: '÷', value: '/', symbol: true },
      { label: fr ? 'Exposant' : 'Exponent', value: 'exponent', wide: true },
    ],
  }];
  if ((answers.ageGroup_schoolYear || 0) >= ALGEBRA_FROM_SCHOOL_YEAR) {
    const country = COUNTRY_VALUES[answers.country];
    sections.push({
      title: country === 'france' ? (fr ? 'COLLÈGE / LYCÉE' : 'MIDDLE / HIGH SCHOOL')
        : country === 'usa' ? 'MIDDLE / HIGH SCHOOL'
        : (fr ? 'SECONDAIRE' : 'SECONDARY'),
      choices: [{ label: fr ? 'Algèbre' : 'Algebra', value: 'algebra', wide: true }],
    });
  }
  return sections;
}
const COUNTRY_VALUES = ['quebec', 'france', 'usa', 'other'];

// Small inline SVG flags for the country buttons (emoji flags do not show on
// Windows). 3:2 ratio; "other" is a globe.
const FLEUR = 'M0 -5c1.3 1.2 1.6 2.6 .9 4.2h1.9c.3-1 1.1-1.5 1.9-1.1.8.5.6 1.7-.4 2.1-.8.3-1.7.1-2.3-.3l-.2.9c.9.3 1.3 1 1 1.8H-2.8c-.3-.8.1-1.5 1-1.8l-.2-.9c-.6.4-1.5.6-2.3.3-1-.4-1.2-1.6-.4-2.1.8-.4 1.6.1 1.9 1.1h1.9C-1.6 -2.4-1.3-3.8 0-5z';
const FLAG_SVG = {
  quebec: `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#003da5"/><rect x="13" width="4" height="20" fill="#fff"/><rect y="8" width="30" height="4" fill="#fff"/>${[[6.5, 4.4], [23.5, 4.4], [6.5, 15.6], [23.5, 15.6]].map(([x, y]) => `<path d="${FLEUR}" fill="#fff" transform="translate(${x} ${y}) scale(.62)"/>`).join('')}</svg>`,
  france: '<svg viewBox="0 0 30 20"><rect width="10" height="20" fill="#0055a4"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ef4135"/></svg>',
  usa: `<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#fff"/>${[0, 2, 4, 6, 8, 10, 12].map(i => `<rect y="${i * 20 / 13}" width="30" height="${20 / 13}" fill="#b22234"/>`).join('')}<rect width="13" height="${20 * 7 / 13}" fill="#3c3b6e"/>${[1.6, 4.2, 6.8, 9.4].flatMap(y => [1.8, 4.6, 7.4, 10.2].map(x => `<circle cx="${x}" cy="${y}" r=".55" fill="#fff"/>`)).join('')}</svg>`,
  other: '<svg viewBox="0 0 30 20"><rect width="30" height="20" fill="#0ea5e9"/><circle cx="15" cy="10" r="7" fill="#22c55e" stroke="#fff" stroke-width="1.2"/><path d="M8 10h14M15 3c-3 3.8-3 10.2 0 14M15 3c3 3.8 3 10.2 0 14" fill="none" stroke="#fff" stroke-width="1"/></svg>',
};

function buildCopy(lang) {
  const fr = lang === 'fr';
  return {
    welcome: fr ? 'Bienvenue dans' : 'Welcome to',
    start: fr ? 'Cliquer commencer!' : 'Click to start!',
    continue: fr ? 'CONTINUER' : 'CONTINUE',
    rangeFrom: fr ? 'De 1 à' : 'From 1 to',
    hudReady: fr ? 'PRET' : 'READY',
    pilotSetup: fr ? 'CONFIG PILOTE' : 'PILOT SETUP',
    steps: [
      {
        key: 'language',
        question: fr ? 'Quelle langue préfères-tu?' : 'Which language do you prefer?',
        choices: fr ? ['FRANÇAIS', 'ANGLAIS'] : ['FRENCH', 'ENGLISH'],
      },
      {
        key: 'country',
        question: fr ? 'Tu vis dans quel pays ou territoire?' : 'Which country or territory do you live in?',
        choices: (fr ? ['QUÉBEC', 'FRANCE', 'USA', 'AUTRES'] : ['QUEBEC', 'FRANCE', 'USA', 'OTHER'])
          .map((label, i) => ({ label, flag: COUNTRY_VALUES[i] })),
      },
      {
        key: 'ageGroup',
        question: fr ? 'Ton niveau scolaire?' : 'Your school level?',
        grid: true,
        // Built from the country answer (see schoolSections).
        sectionsFor: answers => schoolSections(COUNTRY_VALUES[answers.country], fr),
      },
      {
        key: 'hardTopic',
        question: fr ? 'Dans quoi veux-tu travailler le plus?' : 'What do you want to work on the most?',
        multi: true,
        grid: true,
        // Algebra only appears for secondary-school levels (see topicSections).
        sectionsFor: answers => topicSections(answers, fr),
      },
      {
        key: 'numberRange',
        question: fr ? 'Avec quels nombres veux-tu travailler?' : 'Which numbers do you want to work with?',
        choices: [
          { label: '1 - 10', value: 10 },
          { label: '1 - 20', value: 20 },
          { label: '1 - 50', value: 50 },
          { label: '1 - 100', value: 100 },
          { label: fr ? 'AUTRE' : 'OTHER', custom: true },
        ],
      },
      {
        key: 'startMode',
        onboarding: false,
        question: fr ? 'Tu veux commencer où?' : 'Where do you want to start?',
        choices: fr ? ['LES BASES', 'VOIR MON NIVEAU'] : ['THE BASICS', 'SEE MY LEVEL'],
      },
      {
        key: 'dailyGoal',
        question: fr ? 'Combien de temps par jour veux-tu passer dans le jeu?' : 'How much time per day do you want to spend in the game?',
        choices: ['1 min', '5 mins', '+10 mins'],
      },
    ],
  };
}

const INTRO_COPY = { fr: buildCopy('fr'), en: buildCopy('en') };

function introCopy() {
  return INTRO_COPY[introLang()];
}

export function showOnboarding(onComplete, { skipWelcome = false } = {}) {
  if (skipWelcome) showQuestionSteps(onComplete);
  else showWelcome(() => showQuestionSteps(onComplete));
}

export function showEquationConfig(onComplete) {
  showQuestionSteps(onComplete, {
    keys: ['hardTopic', 'startMode'],
    initialAnswers: currentEquationConfigAnswers(),
    apply: applyEquationConfigAnswers,
  });
}

// BRIFING button: change the equations first (topics + number range, same
// yellow screens as the questionnaire), then main.js shows the briefing and
// the beginner practice.
const TOPIC_ORDER = ['+', '-', '*', '/', 'exponent', 'algebra'];
const RANGE_PRESETS = [10, 20, 50, 100];

function schoolYearOfLevel(level = G.schoolLevel || '') {
  const qc = level.match(/^qc-(prim|sec)(\d)/);
  if (qc) return qc[1] === 'sec' ? 6 + Number(qc[2]) : Number(qc[2]);
  const us = level.match(/^us-(\d+)/);
  if (us) return Number(us[1]);
  const frYears = { 'fr-cp': 1, 'fr-ce1': 2, 'fr-ce2': 3, 'fr-cm1': 4, 'fr-cm2': 5, 'fr-6e': 6, 'fr-5e': 7, 'fr-4e': 8, 'fr-3e': 9, 'fr-2nde': 10, 'fr-1re': 11, 'fr-term': 12 };
  return frYears[level] || 0;
}

export function showBriefingEquationOptions(onComplete) {
  // Country / territory pre-selected (the questionnaire's saved answer).
  const savedCountry = COUNTRY_VALUES.indexOf(G.playerCountry);
  const answers = {
    country: Math.max(0, savedCountry),
    ageGroup_schoolYear: schoolYearOfLevel(),
  };
  // Pre-select the saved school level in the list for the player's country.
  const levels = schoolSections(COUNTRY_VALUES[answers.country], getLang() === 'fr').flatMap(sec => sec.choices);
  const levelIndex = levels.findIndex(choice => choice.level === G.schoolLevel);
  if (levelIndex >= 0) {
    answers.ageGroup = levelIndex;
    answers.ageGroup_level = levels[levelIndex].level;
    answers.ageGroup_grade = levels[levelIndex].grade;
  }
  const topics = (G.focusTopics?.length ? G.focusTopics : (G.focusOperations || []));
  answers.hardTopic = topics.map(v => TOPIC_ORDER.indexOf(v)).filter(i => i >= 0 && (i < 5 || answers.ageGroup_schoolYear >= ALGEBRA_FROM_SCHOOL_YEAR));
  const preset = RANGE_PRESETS.indexOf(G.numberRangeMax);
  if (preset >= 0) answers.numberRange = preset;
  showQuestionSteps(onComplete, {
    keys: ['country', 'ageGroup', 'hardTopic', 'numberRange'],
    initialAnswers: answers,
    apply: applyBriefingEquationAnswers,
  });
}

function applyBriefingEquationAnswers(answers) {
  // Country / territory (saved).
  if (COUNTRY_VALUES[answers.country]) {
    G.playerCountry = COUNTRY_VALUES[answers.country];
    save('playerCountry', G.playerCountry);
  }
  // School level (saved): exact class + the game grade it gives.
  if (answers.ageGroup_level) {
    const grade = Math.min(6, Math.max(1, answers.ageGroup_grade || 1));
    G.schoolLevel = answers.ageGroup_level;
    G.playerGrade = grade;
    G.onboardingGrade = grade;
    G.onboardingAgeGroup = grade <= 2 ? 0 : grade <= 4 ? 1 : 2;
    save('schoolLevel', G.schoolLevel);
    save('playerGrade', G.playerGrade);
    save('onboardingGrade', G.onboardingGrade);
    save('onboardingAgeGroup', G.onboardingAgeGroup);
  }
  if (answers.hardTopic_values) {
    G.focusTopics = answers.hardTopic_values;
  } else if (Array.isArray(answers.hardTopic)) {
    G.focusTopics = answers.hardTopic.map(i => TOPIC_ORDER[i]).filter(Boolean);
  }
  // Algebra only stays for secondary-school levels.
  if (schoolYearOfLevel() < ALGEBRA_FROM_SCHOOL_YEAR) {
    G.focusTopics = (G.focusTopics || []).filter(v => v !== 'algebra');
  }
  G.focusOperations = (G.focusTopics || []).filter(v => ['+', '-', '*', '/'].includes(v));
  G.focusOperation = G.focusOperations[0] ?? null;
  if (answers.numberRange_max) G.numberRangeMax = answers.numberRange_max;
  save('focusTopics', G.focusTopics || []);
  save('focusOperations', G.focusOperations);
  save('focusOperation', G.focusOperation ?? '');
  save('numberRangeMax', G.numberRangeMax || 0);
  if (G.playerRegistered) {
    import('../systems/cloud-save.js').then(m => m.pushCloudSave()).catch(() => {});
  }
}

function showWelcome(onNext) {
  const copy = introCopy();
  const overlay = createOverlay();
  overlay.innerHTML = `
    <div class="ob-welcome ob-step">
      <div class="ob-panel ob-welcome-panel">
        <div class="ob-hud">
          <span>${copy.pilotSetup}</span>
          <span>${copy.hudReady}</span>
        </div>
        <img class="ob-welcome-jet" src="/assets/ships/player/f18.webp" alt="">
        <p>${copy.welcome}</p>
        <div class="ob-logo">JEXONGO</div>
        <button class="ob-btn ob-start" id="ob-start" type="button">
          <span class="ob-btn-label">${copy.start}</span>
        </button>
      </div>
    </div>
  `;
  requestAnimationFrame(() => overlay.querySelector('.ob-step')?.classList.add('ob-step-visible'));
  document.getElementById('ob-start')?.addEventListener('click', () => {
    exitCurrentStep(overlay, () => {
      overlay.remove();
      onNext();
    });
  });
}

function stepSections(step, answers) {
  return step.sectionsFor ? step.sectionsFor(answers) : step.sections;
}

function stepChoices(step, answers) {
  const sections = stepSections(step, answers);
  return sections ? sections.flatMap(section => section.choices) : step.choices;
}

function choiceLabel(choice) {
  return typeof choice === 'object' ? choice.label : choice;
}

function showQuestionSteps(onComplete, options = {}) {
  let copy = introCopy();
  const pickSteps = () => (options.keys?.length
    ? copy.steps.filter(s => options.keys.includes(s.key))
    : copy.steps.filter(s => s.onboarding !== false));
  let steps = pickSteps();
  const overlay = createOverlay();
  overlay.classList.add('obn');
  let step = 0;
  let busy = false;
  const answers = { ...(options.initialAnswers || {}) };

  const next = () => {
    step++;
    if (step >= steps.length) {
      (options.apply || applyOnboardingAnswers)(answers);
      exitCurrentStep(overlay, () => {
        overlay.remove();
        onComplete?.();
      });
    } else {
      exitCurrentStep(overlay, render);
    }
  };

  function render() {
    busy = false;
    const current = steps[step];
    const all = stepChoices(current, answers);
    overlay.innerHTML = '';
    const stepWrap = document.createElement('div');
    stepWrap.className = 'ob-step obn-step';
    stepWrap.innerHTML = `
      <div class="obn-progress" aria-hidden="true">
        ${steps.map((_, i) => `<span class="${i <= step ? 'on' : ''}"></span>`).join('')}
      </div>
      <h2 class="obn-question">${current.question}</h2>`;

    const body = document.createElement('div');
    body.className = 'obn-body';
    const continuer = document.createElement('button');
    continuer.type = 'button';
    continuer.className = 'obn-btn obn-continue';
    continuer.textContent = copy.continue;
    const refreshContinue = () => {
      continuer.disabled = !(answers[current.key]?.length);
    };

    const makeButton = (choice, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'obn-btn';
      if (typeof choice === 'object' && choice.symbol) btn.classList.add('obn-symbol');
      if (typeof choice === 'object' && choice.wide) btn.classList.add('obn-wide');
      btn.style.setProperty('--i', index);
      const selected = current.multi ? answers[current.key]?.includes(index) : answers[current.key] === index;
      if (selected) btn.classList.add('obn-selected');
      btn.textContent = choiceLabel(choice);
      if (typeof choice === 'object' && choice.flag) {
        // Country: the flag on both sides of the name.
        const flag = `<span class="obn-flag">${FLAG_SVG[choice.flag]}</span>`;
        btn.classList.add('obn-has-flags');
        btn.innerHTML = `${flag}<span class="obn-btn-text">${choiceLabel(choice)}</span>${flag}`;
      }
      btn.addEventListener('click', () => {
        if (busy) return;
        btn.classList.remove('obn-pop');
        void btn.offsetWidth;
        btn.classList.add('obn-pop');
        if (current.multi) {
          const set = new Set(answers[current.key] || []);
          if (set.has(index)) set.delete(index); else set.add(index);
          answers[current.key] = [...set].sort((a, b) => a - b);
          answers[`${current.key}_value`] = answers[current.key].map(i => choiceLabel(all[i]));
          answers[`${current.key}_values`] = answers[current.key].map(i => all[i]?.value).filter(Boolean);
          btn.classList.toggle('obn-selected', set.has(index));
          refreshContinue();
          return;
        }
        if (typeof choice === 'object' && choice.custom) {
          body.querySelectorAll('.obn-btn').forEach(b => b.classList.remove('obn-selected'));
          btn.classList.add('obn-selected');
          showCustomRange(index);
          return;
        }
        // A different country has other school levels: forget the old class.
        if (current.key === 'country' && answers.country !== index) {
          ['ageGroup', 'ageGroup_value', 'ageGroup_level', 'ageGroup_grade', 'ageGroup_schoolYear']
            .forEach(key => delete answers[key]);
        }
        answers[current.key] = index;
        answers[`${current.key}_value`] = choiceLabel(choice);
        if (typeof choice === 'object' && choice.value !== undefined && !current.multi) {
          answers[`${current.key}_max`] = choice.value;
        }
        if (typeof choice === 'object' && choice.level) {
          answers[`${current.key}_level`] = choice.level;
          answers[`${current.key}_grade`] = choice.grade;
          answers[`${current.key}_schoolYear`] = choice.schoolYear;
        }
        body.querySelectorAll('.obn-btn').forEach(b => b.classList.remove('obn-selected'));
        btn.classList.add('obn-selected');
        if (current.key === 'language') {
          setLang(index === 0 ? 'fr' : 'en');
          copy = introCopy();
          steps = pickSteps();
        }
        busy = true;
        setTimeout(next, 380);
      });
      return btn;
    };

    // AUTRE: the player types the biggest number (5 to 1000).
    const showCustomRange = (index) => {
      body.querySelector('.obn-custom')?.remove();
      const row = document.createElement('div');
      row.className = 'obn-custom';
      row.innerHTML = `
        <label class="obn-custom-label">${copy.rangeFrom}
          <input class="obn-custom-input" type="number" inputmode="numeric" min="${RANGE_MIN}" max="${RANGE_MAX}" placeholder="30">
        </label>
        <button type="button" class="obn-btn obn-custom-ok">OK</button>`;
      body.appendChild(row);
      const input = row.querySelector('input');
      const ok = row.querySelector('button');
      const refresh = () => {
        const n = Number(input.value);
        ok.disabled = !(Number.isInteger(n) && n >= RANGE_MIN && n <= RANGE_MAX);
      };
      refresh();
      input.addEventListener('input', refresh);
      const submit = () => {
        if (busy || ok.disabled) return;
        answers[current.key] = index;
        answers[`${current.key}_max`] = Number(input.value);
        answers[`${current.key}_value`] = `1 - ${input.value}`;
        busy = true;
        next();
      };
      ok.addEventListener('click', submit);
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
      setTimeout(() => input.focus(), 50);
    };

    let index = 0;
    const groups = stepSections(current, answers) || [{ choices: current.choices }];
    for (const section of groups) {
      if (section.title) {
        const title = document.createElement('div');
        title.className = 'obn-section';
        title.textContent = section.title;
        body.appendChild(title);
      }
      const list = document.createElement('div');
      list.className = current.grid ? 'obn-grid' : 'obn-list';
      for (const choice of section.choices) list.appendChild(makeButton(choice, index++));
      body.appendChild(list);
    }
    stepWrap.appendChild(body);
    if (current.multi) {
      refreshContinue();
      continuer.addEventListener('click', () => {
        if (busy || !(answers[current.key]?.length)) return;
        busy = true;
        next();
      });
      stepWrap.appendChild(continuer);
    }
    overlay.appendChild(stepWrap);
    requestAnimationFrame(() => stepWrap.classList.add('ob-step-visible'));
  }

  render();
}

function currentEquationConfigAnswers() {
  const topicIndex = { '+': 0, '-': 1, '*': 2, '/': 3 };
  const selected = Array.isArray(G.focusOperations) && G.focusOperations.length
    ? G.focusOperations
    : G.focusOperation ? [G.focusOperation] : [];
  return {
    hardTopic: selected.map(op => topicIndex[op]).filter(i => i !== undefined),
    startMode: G.onboardingStartMode === 'placement' || G.pendingPlacement ? 1 : 0,
  };
}

function createOverlay() {
  // No music during the questionnaire (sound effects stay).
  SFX.stopMusic();
  document.getElementById('onboarding-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'onboarding-overlay';
  document.body.appendChild(overlay);
  return overlay;
}

function showImpact(root, text) {
  let impact = root.querySelector('.ob-impact');
  if (!impact) {
    impact = document.createElement('div');
    impact.className = 'ob-impact';
    root.appendChild(impact);
  }
  impact.textContent = text;
  impact.classList.remove('ob-impact-show');
  requestAnimationFrame(() => impact.classList.add('ob-impact-show'));
}

function exitCurrentStep(root, done) {
  const current = root.querySelector('.ob-step');
  if (!current) {
    done();
    return;
  }
  current.classList.remove('ob-step-visible');
  current.classList.add('ob-step-leave');
  setTimeout(done, 260);
}

function applyOnboardingAnswers(answers) {
  if (answers.language !== undefined) {
    setLang(answers.language === 0 ? 'fr' : 'en');
    save('onboardingLanguage', answers.language === 0 ? 'fr' : 'en');
  }
  // School level: the real class for the player's country (qc-prim3, fr-ce2,
  // us-3...) and its game grade. Questions only go up to grade 6 for now, so
  // older players get grade-6 content.
  const grade = Math.min(6, Math.max(1, answers.ageGroup_grade || 1));
  G.schoolLevel = answers.ageGroup_level || `qc-prim${grade}`;
  G.playerCountry = COUNTRY_VALUES[answers.country] || '';
  save('schoolLevel', G.schoolLevel);
  save('playerCountry', G.playerCountry);
  const placementMap = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 13, 6: 16 };
  const wantsPlacement = answers.startMode === 1;
  G.onboardingAgeGroup = grade <= 2 ? 0 : grade <= 4 ? 1 : 2;
  G.onboardingGrade = grade;
  G.currentLevel = wantsPlacement ? (placementMap[grade] ?? 1) : 1;
  G.playerGrade = grade;

  // Every chosen topic is remembered; only + - * / exist in the question
  // generator today (exponent / algebra are for later).
  G.focusTopics = answers.hardTopic_values || [];
  G.focusOperations = G.focusTopics.filter(v => ['+', '-', '*', '/'].includes(v));
  G.focusOperation = G.focusOperations[0] ?? null;
  save('focusTopics', G.focusTopics);

  // Biggest number used in + - questions (x / ÷ tables stop at 12).
  G.numberRangeMax = answers.numberRange_max || 0;
  save('numberRangeMax', G.numberRangeMax);

  // "Do you like math?" is no longer asked: normal timer.
  G.likesMath = answers.likesMath === undefined ? true : answers.likesMath === 0;
  G.practiceTimeLimit = G.likesMath ? 10 : 14;
  G.pendingPlacement = wantsPlacement;
  // New players learn in the beginner practice (main.js), so the old
  // training / placement rounds are no longer started on the real levels.
  G.tutorialMode = false;
  G.tutorialCompleted = true;
  G.onboardingStartMode = G.pendingPlacement ? 'placement' : 'bases';
  G.tutorialProgress = null;

  const goalMap = { 0: 1, 1: 5, 2: 10 };
  const lengthMap = { 0: 'short', 1: 'normal', 2: 'long' };
  G.dailyGoalMinutes = goalMap[answers.dailyGoal] ?? 5;
  G.onboardingLevelLength = lengthMap[answers.dailyGoal] ?? 'normal';
  G.hasSeenOnboarding = true;

  save('currentLevel', G.currentLevel);
  save('playerGrade', G.playerGrade);
  save('likesMath', !!G.likesMath);
  save('onboardingAgeGroup', G.onboardingAgeGroup);
  save('onboardingGrade', G.onboardingGrade);
  save('practiceTimeLimit', G.practiceTimeLimit);
  save('focusOperation', G.focusOperation ?? '');
  save('focusOperations', G.focusOperations ?? []);
  save('pendingPlacement', !!G.pendingPlacement);
  save('tutorialMode', !!G.tutorialMode);
  save('tutorialCompleted', true);
  save('tutorialProgress', G.tutorialProgress);
  save('onboardingStartMode', G.onboardingStartMode);
  save('dailyGoalMinutes', G.dailyGoalMinutes);
  save('onboardingLevelLength', G.onboardingLevelLength);
  save('hasSeenOnboarding', true);
  if (G.playerRegistered) {
    import('../systems/cloud-save.js').then(m => m.pushCloudSave()).catch(() => {});
  }
}

function applyEquationConfigAnswers(answers) {
  const grade = Math.min(6, Math.max(1, G.onboardingGrade || G.playerGrade || 1));
  const placementMap = { 1: 1, 2: 4, 3: 7, 4: 10, 5: 13, 6: 16 };
  const topicMap = { 0: '+', 1: '-', 2: '*', 3: '/' };
  const hardTopics = Array.isArray(answers.hardTopic) ? answers.hardTopic : [answers.hardTopic];
  const focusOperations = hardTopics.map(i => topicMap[i]).filter(Boolean);

  G.focusOperations = focusOperations.length ? focusOperations : ['+'];
  G.focusOperation = G.focusOperations[0] ?? null;
  G.pendingPlacement = answers.startMode === 1;
  G.onboardingStartMode = G.pendingPlacement ? 'placement' : 'bases';
  G.currentLevel = G.pendingPlacement ? (placementMap[grade] ?? 1) : 1;
  G.tutorialMode = G.pendingPlacement;
  G.tutorialCompleted = !G.pendingPlacement;
  G.tutorialProgress = G.pendingPlacement ? {
    active: true,
    round: 1,
    questionsAnswered: 0,
    correctAnswers: 0,
    stats: { total: 0, correct: 0, timeouts: 0, ops: {} },
    currentLevel: G.currentLevel,
  } : null;

  save('focusOperation', G.focusOperation ?? '');
  save('focusOperations', G.focusOperations ?? []);
  save('pendingPlacement', !!G.pendingPlacement);
  save('onboardingStartMode', G.onboardingStartMode);
  save('currentLevel', G.currentLevel);
  save('tutorialMode', !!G.tutorialMode);
  save('tutorialCompleted', !!G.tutorialCompleted);
  save('tutorialProgress', G.tutorialProgress);

  if (G.playerRegistered) {
    import('../systems/cloud-save.js').then(m => m.pushCloudSave()).catch(() => {});
  }
}
