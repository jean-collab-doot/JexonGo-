import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'output', 'instagram-carousel');
fs.mkdirSync(outDir, { recursive: true });

function dataUri(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  const mime = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : `image/${ext}`;
  return `data:${mime};base64,${fs.readFileSync(path.join(root, file)).toString('base64')}`;
}

const logo = dataUri('assets/menu/JEXONGO.png');
const jet = dataUri('assets/planes/14.png');
const playerJet = dataUri('assets/planes/my-plane.png');
const enemyJet = dataUri('assets/enemies/planes/f15.png');

const slides = [
  {
    kicker: 'NOUVEAU JEU',
    title: 'JEXONGO',
    subtitle: 'Combat mathematique aerien',
    body: ['Pilote ton avion.', 'Reponds aux equations.', 'Gagne la mission.'],
    visual: 'hero',
    cta: 'jexongo.app',
  },
  {
    kicker: 'APPRENDRE EN JOUANT',
    title: 'Les maths deviennent une mission',
    subtitle: 'Chaque bonne reponse attaque les ennemis.',
    body: ['Addition', 'Soustraction', 'Multiplication', 'Division'],
    visual: 'question',
  },
  {
    kicker: 'ECOLE',
    title: 'Pour les grades 1 a 6',
    subtitle: 'La difficulte suit le niveau du joueur.',
    body: ['Debutant', 'Progression', 'Challenge'],
    visual: 'grades',
  },
  {
    kicker: 'CONFIGURATION',
    title: 'Choisis tes operations',
    subtitle: 'Le joueur garde ses symboles pendant toute sa progression.',
    body: ['+', '-', 'x', '÷'],
    visual: 'ops',
  },
  {
    kicker: 'RECOMPENSES',
    title: 'XP, coins et avions',
    subtitle: 'Complete les missions pour debloquer plus.',
    body: ['Mission complete', '+ XP', '+ Coins', 'Chests'],
    visual: 'rewards',
  },
  {
    kicker: 'PARTOUT',
    title: 'Ordinateur et telephone',
    subtitle: 'Joue en francais ou en anglais, sur tous les appareils.',
    body: ['Mobile', 'Desktop', 'FR / EN'],
    visual: 'devices',
  },
  {
    kicker: 'PROGRESSION',
    title: 'Suis tes statistiques',
    subtitle: 'Temps de jeu, niveau, missions et progression sauvegardee.',
    body: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    visual: 'stats',
  },
  {
    kicker: 'PRET AU DECOLLAGE ?',
    title: 'Joue a JexonGO',
    subtitle: 'Un jeu de maths arcade, rapide et motivant.',
    body: ['Combat', 'Maths', 'Progression'],
    visual: 'cta',
    cta: 'jexongo.app',
  },
];

function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&apos;',
  }[c]));
}

function wrapText(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = `${line} ${word}`.trim();
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

function textBlock(lines, x, y, size, fill = '#ffffff', anchor = 'start', weight = '800') {
  return lines.map((line, i) => (
    `<text x="${x}" y="${y + i * size * 1.18}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" class="pixel">${esc(line)}</text>`
  )).join('\n');
}

function panel(x, y, w, h, color = '#08254b', stroke = '#f5a400') {
  return `
    <rect x="${x + 10}" y="${y + 10}" width="${w}" height="${h}" rx="16" fill="#020817" opacity="0.75"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="16" fill="${color}" stroke="${stroke}" stroke-width="6"/>
    <rect x="${x + 18}" y="${y + 18}" width="${w - 36}" height="${h - 36}" rx="8" fill="none" stroke="#73d9ff" stroke-width="3" opacity="0.55"/>
  `;
}

function chips(items, x, y, colors = ['#f5a400', '#21d4fd', '#28e070', '#a855f7']) {
  return items.map((item, i) => {
    const cx = x + i * 150;
    return `
      <g>
        <rect x="${cx}" y="${y}" width="120" height="68" rx="12" fill="#061633" stroke="${colors[i % colors.length]}" stroke-width="5"/>
        <text x="${cx + 60}" y="${y + 45}" text-anchor="middle" font-size="24" font-weight="900" fill="#ffffff" class="pixel">${esc(item)}</text>
      </g>
    `;
  }).join('\n');
}

function visual(slide, i) {
  switch (slide.visual) {
    case 'hero':
      return `
        <image href="${logo}" x="170" y="110" width="740" height="230" preserveAspectRatio="xMidYMid meet"/>
        <g transform="translate(540 570) rotate(-8)">
          <ellipse cx="0" cy="180" rx="260" ry="52" fill="#03142f" opacity="0.42"/>
          <image href="${jet}" x="-190" y="-260" width="380" height="560" preserveAspectRatio="xMidYMid meet"/>
        </g>
      `;
    case 'question':
      return `
        ${panel(125, 190, 830, 250, '#061733', '#18d9ff')}
        <text x="540" y="295" text-anchor="middle" font-size="64" font-weight="900" fill="#ffe24a" class="pixel">24 + 18 = ?</text>
        <g transform="translate(190 520)"><image href="${playerJet}" x="0" y="0" width="210" height="150"/></g>
        <g transform="translate(760 470) rotate(180)"><image href="${enemyJet}" x="0" y="0" width="210" height="150"/></g>
        <path d="M410 585 C510 540 595 520 720 515" fill="none" stroke="#ffdf4d" stroke-width="10" stroke-dasharray="28 18"/>
      `;
    case 'grades':
      return [1, 2, 3, 4, 5, 6].map((g, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const x = 190 + col * 235;
        const y = 250 + row * 170;
        return `${panel(x, y, 170, 120, '#073563', idx === 2 ? '#28e070' : '#f5a400')}
          <text x="${x + 85}" y="${y + 52}" text-anchor="middle" font-size="28" font-weight="900" fill="#fff" class="pixel">GRADE</text>
          <text x="${x + 85}" y="${y + 95}" text-anchor="middle" font-size="52" font-weight="900" fill="#ffe24a" class="pixel">${g}</text>`;
      }).join('\n');
    case 'ops':
      return chips(slide.body, 170, 330, ['#00e84b', '#60a5fa', '#ff8c00', '#a855f7']) + `
        <g transform="translate(540 605)">
          <image href="${jet}" x="-120" y="-170" width="240" height="350"/>
        </g>
      `;
    case 'rewards':
      return `
        ${panel(155, 225, 770, 440, '#061633', '#ffe24a')}
        <text x="540" y="325" text-anchor="middle" font-size="48" font-weight="900" fill="#28e070" class="pixel">MISSION COMPLETE</text>
        <text x="540" y="420" text-anchor="middle" font-size="72" font-weight="900" fill="#ffe24a" class="pixel">★ ★ ★</text>
        ${chips(['+270 XP', '+60 COINS', 'CHEST'], 235, 500, ['#21d4fd', '#f5a400', '#a855f7'])}
      `;
    case 'devices':
      return `
        <rect x="145" y="230" width="360" height="245" rx="18" fill="#061633" stroke="#73d9ff" stroke-width="6"/>
        <rect x="185" y="270" width="280" height="165" rx="8" fill="#0e8bd8"/>
        <image href="${playerJet}" x="250" y="300" width="160" height="105"/>
        <rect x="610" y="205" width="230" height="410" rx="36" fill="#061633" stroke="#f5a400" stroke-width="8"/>
        <rect x="635" y="255" width="180" height="285" rx="14" fill="#0e8bd8"/>
        <image href="${playerJet}" x="650" y="340" width="150" height="95"/>
        ${chips(['FR', 'EN'], 365, 680, ['#18d9ff', '#f5a400'])}
      `;
    case 'stats':
      return `
        ${panel(125, 210, 830, 470, '#061633', '#18d9ff')}
        ${slide.body.map((day, idx) => {
          const x = 190 + idx * 100;
          const h = [90, 135, 70, 180, 155, 110, 60][idx];
          return `<rect x="${x}" y="${570 - h}" width="58" height="${h}" rx="8" fill="${idx === 3 ? '#f5a400' : '#21d4fd'}"/>
            <text x="${x + 29}" y="620" text-anchor="middle" font-size="20" font-weight="900" fill="#fff" class="pixel">${day}</text>`;
        }).join('\n')}
        <text x="540" y="305" text-anchor="middle" font-size="36" font-weight="900" fill="#ffe24a" class="pixel">TEMPS DE JEU</text>
      `;
    case 'cta':
      return `
        <g transform="translate(540 430) rotate(-8)">
          <image href="${jet}" x="-210" y="-280" width="420" height="610"/>
        </g>
        ${panel(185, 690, 710, 130, '#061633', '#f5a400')}
        <text x="540" y="770" text-anchor="middle" font-size="44" font-weight="900" fill="#ffffff" class="pixel">JEXONGO.APP</text>
      `;
    default:
      return '';
  }
}

function makeSlide(slide, index) {
  const titleLines = wrapText(slide.title, 22);
  const subtitleLines = wrapText(slide.subtitle, 40);
  const titleY = index === 0 ? 835 : 790;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0d74da"/>
      <stop offset="0.55" stop-color="#34c5ff"/>
      <stop offset="1" stop-color="#d7f3ff"/>
    </linearGradient>
    <pattern id="scan" width="8" height="8" patternUnits="userSpaceOnUse">
      <rect width="8" height="1.5" fill="#061633" opacity="0.16"/>
    </pattern>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="8" dy="10" stdDeviation="0" flood-color="#03142f" flood-opacity="0.62"/>
    </filter>
  </defs>
  <rect width="1080" height="1080" fill="url(#sky)"/>
  <g opacity="0.88">
    <ellipse cx="165" cy="205" rx="150" ry="42" fill="#ffffff"/>
    <ellipse cx="250" cy="196" rx="110" ry="34" fill="#ffffff"/>
    <ellipse cx="835" cy="180" rx="175" ry="48" fill="#ffffff"/>
    <ellipse cx="930" cy="168" rx="125" ry="38" fill="#ffffff"/>
    <ellipse cx="740" cy="720" rx="210" ry="58" fill="#ffffff" opacity="0.66"/>
  </g>
  <rect width="1080" height="1080" fill="url(#scan)"/>
  <g filter="url(#shadow)">
    <rect x="46" y="42" width="988" height="96" rx="18" fill="#061633" stroke="#f5a400" stroke-width="6"/>
    <text x="82" y="105" font-size="30" font-weight="900" fill="#ffe24a" class="pixel">${esc(slide.kicker)}</text>
    <text x="998" y="105" text-anchor="end" font-size="26" font-weight="900" fill="#73d9ff" class="pixel">${String(index + 1).padStart(2, '0')}/08</text>
  </g>
  <g filter="url(#shadow)">
    ${visual(slide, index)}
  </g>
  <g filter="url(#shadow)">
    <rect x="60" y="${titleY - 72}" width="960" height="${index === 0 ? 198 : 222}" rx="18" fill="#061633" stroke="#f5a400" stroke-width="6"/>
    ${textBlock(titleLines, 540, titleY, titleLines.length > 1 ? 48 : 58, '#ffffff', 'middle')}
    ${textBlock(subtitleLines, 540, titleY + 82, 27, '#d7f3ff', 'middle', '800')}
    ${slide.cta ? `<text x="540" y="${titleY + 150}" text-anchor="middle" font-size="28" font-weight="900" fill="#ffe24a" class="pixel">${esc(slide.cta)}</text>` : ''}
  </g>
  <style>
    .pixel { font-family: Impact, "Arial Black", Arial, sans-serif; letter-spacing: 1.5px; }
  </style>
</svg>`;
}

const files = slides.map((slide, i) => {
  const file = path.join(outDir, `jexongo-carousel-${String(i + 1).padStart(2, '0')}.svg`);
  fs.writeFileSync(file, makeSlide(slide, i), 'utf8');
  return file;
});

const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>JexonGO Instagram Carousel</title>
  <style>
    body { margin: 0; background: #061633; color: white; font-family: Arial, sans-serif; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px; padding: 24px; }
    img { width: 100%; border-radius: 14px; box-shadow: 0 12px 28px rgba(0,0,0,.35); background: white; }
    h1 { padding: 24px 24px 0; margin: 0; }
  </style>
</head>
<body>
  <h1>JexonGO Instagram Carousel</h1>
  <main>
    ${files.map(file => `<img src="${path.basename(file)}" alt="${path.basename(file)}">`).join('\n    ')}
  </main>
</body>
</html>`;
fs.writeFileSync(path.join(outDir, 'preview.html'), html, 'utf8');

console.log(`Created ${files.length} carousel slides in ${outDir}`);
