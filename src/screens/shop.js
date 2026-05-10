import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SFX } from '../audio/sound.js';
import { SKINS, RARITY_META } from '../data/skins.js';
import { AIRCRAFT } from '../data/aircraft.js';
import { drawFrame } from '../game/sprites.js';
import { AIRCRAFT_SPRITE } from '../game/sprites.js';
import { t } from '../i18n.js';

// Card gradient backgrounds per rarity (skins grid)
const CARD_GRAD = {
  common:    'linear-gradient(160deg,#6b7a8d 0%,#2d3748 100%)',
  rare:      'linear-gradient(160deg,#3b82f6 0%,#1e3a8a 100%)',
  epic:      'linear-gradient(160deg,#a855f7 0%,#4c1d95 100%)',
  legendary: 'linear-gradient(160deg,#f59e0b 0%,#92400e 100%)',
  exclusive: 'linear-gradient(160deg,#ff2277 0%,#7f1d45 100%)',
};

// Brawl Stars card gradients per rarity
const CARD_GRAD_BS = {
  legendary: 'linear-gradient(175deg,#fde68a 0%,#f59e0b 28%,#c45d00 65%,#7c2d00 100%)',
  epic:      'linear-gradient(175deg,#fca5a5 0%,#ef4444 30%,#b91c1c 65%,#7f1d1d 100%)',
  rare:      'linear-gradient(175deg,#93c5fd 0%,#3b82f6 40%,#1d4ed8 80%,#1e3a8a 100%)',
  common:    'linear-gradient(175deg,#94a3b8 0%,#475569 50%,#1e293b 100%)',
  exclusive: 'linear-gradient(175deg,#ff6eb4 0%,#ff2277 40%,#7f1d45 100%)',
};

// Discount metadata per rarity (shown on offer cards)
const OFFER_DISCOUNT = {
  legendary: { pct: '30%', origMult: 1.43 },
  epic:      { pct: '20%', origMult: 1.25 },
  rare:      { pct: '10%', origMult: 1.11 },
};

// Which skins appear in OFFERS tab
const FEATURED_ID = 'legendary';
const OFFER_IDS   = ['epic'];

// ── SPRITE PREVIEW ────────────────────────────────────────────────────────────
function makePreview(skin, size, offerMode = false) {
  // Pick the right image: offerImg for the featured/offer card, skinImg for the skins grid
  const imgSrc = offerMode ? skin.offerImg : (skin.skinImg || skin.offerImg);
  if (imgSrc) {
    const img = document.createElement('img');
    img.src = imgSrc;
    img.className = 'sc-preview sc-offer-art';
    img.style.width  = size + 'px';
    img.style.height = size + 'px';
    img.style.objectFit = 'contain';
    // Apply CSS filter for filter-based skins (e.g. SR-71 exclusive)
    if (skin.filter && !skin.skinImg) img.style.filter = skin.filter;
    return img;
  }

  // Fallback: canvas sprite preview — skin filter applied to the aircraft sprite
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'sc-preview';
  const half   = size / 2;
  const sprKey = AIRCRAFT_SPRITE[skin.aircraft] ?? AIRCRAFT_SPRITE[G.activeAircraft] ?? 'ship-t6';
  function draw() {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, size, size);
    ctx.filter = skin.filter || 'none';
    try { drawFrame(ctx, sprKey, 0, half, half, size, size); } catch (_) {}
    ctx.filter = 'none';
  }
  draw();
  setTimeout(draw, 400);
  return c;
}

// ── PRICE BUTTON (skins grid) ─────────────────────────────────────────────────
function makePriceBtn(skin, onBuy, onEquip) {
  const owned      = G.ownedSkins.includes(skin.id);
  const planeOwned = !skin.aircraft || G.unlockedAircraft.includes(skin.aircraft);
  const btn        = document.createElement('button');
  btn.className = 'sc-price-btn';

  if (!owned) {
    // Not bought yet — always show price, anyone can buy
    btn.innerHTML        = `◎ <strong>${skin.price.toLocaleString()}</strong>`;
    btn.classList.add('sc-btn-buy');
    btn.style.background = RARITY_META[skin.rarity]?.color || '#f59e0b';
    btn.onclick          = () => onBuy(skin);
  } else if (planeOwned) {
    // Owned + plane available → can equip
    btn.textContent = t('equip').replace(' ▶', '');
    btn.classList.add('sc-btn-equip');
    btn.onclick     = () => onEquip(skin);
  } else {
    // Owned but plane locked → can't equip yet
    const planeName = AIRCRAFT[skin.aircraft]?.name ?? skin.aircraft;
    btn.textContent = `■ Need ${planeName}`;
    btn.classList.add('sc-btn-locked');
    btn.disabled    = true;
    btn.title       = `Unlock ${planeName} to equip`;
  }
  return btn;
}

// ── OFFER CARD (featured big or small) ───────────────────────────────────────
function makeCard(skin, size = 'small', onBuy, onEquip, offerMode = false) {
  const meta  = RARITY_META[skin.rarity];
  const owned = G.ownedSkins.includes(skin.id);

  const card = document.createElement('div');
  card.className = `sc-card sc-card-${size}`;
  card.style.background = CARD_GRAD[skin.rarity] || CARD_GRAD.common;

  // Shine
  const shine = document.createElement('div');
  shine.className = 'sc-shine';

  // "SPECIAL OFFER" banner
  const banner = document.createElement('div');
  banner.className   = 'sc-banner';
  banner.textContent = owned ? t('owned') : t('specialOffer');
  banner.style.color = meta.color;

  // Aircraft preview — larger for featured card
  const previewSize = size === 'featured' ? 350 : 200;
  const preview = makePreview(skin, previewSize, offerMode);

  // Name
  const name = document.createElement('div');
  name.className   = 'sc-name';
  name.textContent = skin.name;

  // Rarity stars row
  const stars = document.createElement('div');
  stars.className   = 'sc-stars';
  const starCount   = { common: 1, rare: 2, epic: 3, legendary: 4, exclusive: 5 }[skin.rarity] || 1;
  stars.textContent = '★'.repeat(starCount) + '☆'.repeat(5 - starCount);
  stars.style.color = meta.color;

  // Price button
  const btn = makePriceBtn(skin, onBuy, onEquip);

  card.appendChild(shine);
  card.appendChild(banner);
  card.appendChild(preview);
  card.appendChild(name);
  card.appendChild(stars);
  card.appendChild(btn);
  return { card, btn };
}

// ── PIXEL ART GOLD OFFER CARD ─────────────────────────────────────────────────
function makePixelCard(skin, size, onBuy, onEquip) {
  const meta   = RARITY_META[skin.rarity];
  const owned  = G.ownedSkins.includes(skin.id);
  const disc   = OFFER_DISCOUNT[skin.rarity];
  const isFeat = size === 'featured';

  const card = document.createElement('div');
  card.className = `sc-card-px sc-card-px-${size}`;

  // Decorative layers
  const shine    = document.createElement('div'); shine.className = 'sc-px-shine';
  const sparkles = document.createElement('div'); sparkles.className = 'sc-px-sparkles';
  card.appendChild(shine);
  card.appendChild(sparkles);

  // "BEST VALUE!" / rarity badge top-left
  const badge = document.createElement('div');
  badge.className = 'sc-px-badge';
  badge.textContent = isFeat ? t('bestValue') : meta.label + '!';
  if (!isFeat) badge.style.background = 'linear-gradient(135deg,' + meta.color + ',' + meta.color + '99)';
  card.appendChild(badge);

  // Skin name label (top-left, under badge)
  const label = document.createElement('div');
  label.className = 'sc-px-label';
  label.textContent = skin.name.toUpperCase();
  card.appendChild(label);

  // Rarity sub-label
  const rarityEl = document.createElement('div');
  rarityEl.className = 'sc-px-rarity';
  rarityEl.textContent = meta.label + ' SKIN';
  rarityEl.style.color = meta.color;
  card.appendChild(rarityEl);

  // Art
  const artWrap = document.createElement('div');
  artWrap.className = 'sc-px-art-wrap';
  const artEl = makePreview(skin, isFeat ? 190 : 150, true);
  artEl.className = 'sc-px-art';
  artWrap.appendChild(artEl);
  card.appendChild(artWrap);

  // Blue price button at bottom
  const btn = document.createElement('button');
  btn.className = 'sc-px-price-btn';

  if (owned) {
    btn.textContent = t('equip');
    btn.classList.add('sc-px-equip');
    btn.onclick = () => onEquip(skin);
  } else {
    const origPrice = disc ? Math.round(skin.price * disc.origMult) : null;
    if (origPrice) {
      btn.innerHTML = `<s style="opacity:0.55;font-size:6px">◎${origPrice.toLocaleString()}</s>&nbsp;◎ <strong>${skin.price.toLocaleString()}</strong>`;
    } else {
      btn.innerHTML = `◎ <strong>${skin.price.toLocaleString()}</strong>`;
    }
    btn.onclick = () => onBuy(skin);
  }
  card.appendChild(btn);

  return card;
}

// ── BUY / EQUIP HANDLERS ─────────────────────────────────────────────────────
function makeHandlers() {
  function onBuy(skin) {
    const errEl = $('shop-error');
    if (G.coins < skin.price) {
      errEl.textContent = `${t('needMoreCoins')} ${(skin.price - G.coins).toLocaleString()} ${t('moreCoins')}`;
      errEl.classList.remove('shop-err-anim');
      requestAnimationFrame(() => errEl.classList.add('shop-err-anim'));
      SFX.noMoney?.();
      // Flash coin counter red
      const coinBadge = $('shop-coins');
      if (coinBadge) {
        coinBadge.classList.add('coins-insufficient');
        setTimeout(() => coinBadge.classList.remove('coins-insufficient'), 700);
      }
      return;
    }
    errEl.textContent = '';
    SFX.buy?.();
    G.coins -= skin.price;
    G.ownedSkins.push(skin.id);
    save('coins', G.coins);
    save('ownedSkins', G.ownedSkins);
    updateCoinDisplay();
    redrawContent();
  }

  function onEquip(skin) {
    G.activeSkin   = skin.id;
    G.activeLivery = skin.id;
    save('activeSkin',   G.activeSkin);
    save('activeLivery', G.activeLivery);
    updateCoinDisplay();
    redrawContent();
  }

  return { onBuy, onEquip };
}

// ── TAB RENDERERS ─────────────────────────────────────────────────────────────

function renderOffers(content, handlers) {
  const { onBuy, onEquip } = handlers;
  _resetContentStyle(content);

  const featured   = SKINS.find(s => s.rarity === FEATURED_ID) || SKINS[6];
  const offerSkins = SKINS.filter(s => OFFER_IDS.includes(s.rarity)).slice(0, 2);

  const grid = document.createElement('div');
  grid.className = 'sc-offers-grid';

  // Featured card spans both columns
  const featCard = makePixelCard(featured, 'featured', onBuy, onEquip);
  featCard.classList.add('sc-card-px-featured');
  grid.appendChild(featCard);

  // Smaller cards side by side on second row
  offerSkins.forEach(skin => grid.appendChild(makePixelCard(skin, 'small', onBuy, onEquip)));

  content.appendChild(grid);

  // ── SR-71 CHALLENGE OFFER ──────────────────────────────────────────────────
  content.appendChild(_makeSr71ChallengeCard());
}

function _makeSr71ChallengeCard() {
  const unlocked  = G.unlockedAircraft.includes('sr71');
  const earned    = G.sr71Earned || unlocked;
  const sr71Skin  = SKINS.find(s => s.id === 'exclusive');

  const card = document.createElement('div');
  card.className = 'sr71-challenge-card';

  // Plane preview — plain aircraft image (no filter)
  const imgWrap = document.createElement('div');
  imgWrap.className = 'sr71-ch-img-wrap';
  const img = document.createElement('img');
  img.src = '/assets/hangar/sr71.png';
  img.className = 'sr71-ch-img';
  imgWrap.appendChild(img);
  card.appendChild(imgWrap);

  // Text side
  const info = document.createElement('div');
  info.className = 'sr71-ch-info';

  const tag = document.createElement('div');
  tag.className   = 'sr71-ch-tag';
  tag.textContent = '★ CHALLENGE REWARD';
  info.appendChild(tag);

  const name = document.createElement('div');
  name.className   = 'sr71-ch-name';
  name.textContent = 'SR-71 BLACKBIRD';
  info.appendChild(name);

  const sub = document.createElement('div');
  sub.className   = 'sr71-ch-sub';
  sub.textContent = 'Full aircraft + Exclusive Skin';
  info.appendChild(sub);

  const cond = document.createElement('div');
  cond.className   = 'sr71-ch-cond';
  cond.textContent = 'Answer all questions correctly on level 30';
  info.appendChild(cond);

  const btn = document.createElement('button');
  btn.className = 'sr71-ch-btn';
  if (unlocked) {
    btn.textContent = '✓ UNLOCKED';
    btn.classList.add('sr71-ch-btn-owned');
    btn.disabled = true;
  } else if (earned) {
    btn.textContent = '▶ CLAIM FREE';
    btn.classList.add('sr71-ch-btn-claim');
    btn.onclick = () => {
      if (!G.unlockedAircraft.includes('sr71')) {
        G.unlockedAircraft.push('sr71');
        save('unlockedAircraft', G.unlockedAircraft);
      }
      if (!G.ownedSkins.includes('exclusive')) {
        G.ownedSkins.push('exclusive');
        save('ownedSkins', G.ownedSkins);
      }
      redrawContent();
    };
  } else {
    btn.textContent = '— NOT YET EARNED';
    btn.classList.add('sr71-ch-btn-locked');
    btn.disabled = true;
  }
  info.appendChild(btn);

  card.appendChild(info);
  return card;
}


function _resetContentStyle(content) {
  content.style.overflowX = '';
  content.style.overflowY = '';
  content.style.padding   = '';
  content.style.display   = '';
  content.style.height    = '';
  content.style.boxSizing = '';
}

function renderSkins(content, handlers) {
  _resetContentStyle(content);
  const { onBuy, onEquip } = handlers;
  const grid = document.createElement('div');
  grid.className = 'sc-skins-grid';
  SKINS.filter(s => !s.prestige && !s.offerOnly && (s.aircraft || s.filter || s.skinImg)).forEach(skin => {
    const { card, btn } = makeCard(skin, 'small', onBuy, onEquip);
    btn.dataset.skin = skin.id;
    grid.appendChild(card);
  });
  content.appendChild(grid);
}

const BUYABLE_CHESTS = [
  { name: 'BRONZE',    emoji: '◈', color: '#cd7f32', price: 100,  desc: 'Common\ndrops',    tier: 0 },
  { name: 'SILVER',    emoji: '◆', color: '#c0c0c0', price: 400,  desc: 'Rare\ndrops',      tier: 1 },
  { name: 'GOLD',      emoji: '★', color: '#fbbf24', price: 1200, desc: 'Epic\nchance',     tier: 2 },
  { name: 'LEGENDARY', emoji: '♛', color: '#7a2ac5', price: 3500, desc: 'Best\ndrops',      tier: 4 },
];

function renderMore(content) {
  _resetContentStyle(content);

  const title = document.createElement('div');
  title.className   = 'sc-more-section-title';
  title.textContent = t('buyChests');
  content.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'sc-chest-shop-grid';

  BUYABLE_CHESTS.forEach(ch => {
    const card = document.createElement('div');
    card.className = 'sc-chest-shop-card';
    card.style.borderColor = ch.color;
    card.style.boxShadow   = `0 0 0 1px #5a3200, 0 0 16px ${ch.color}33, 0 6px 18px rgba(0,0,0,0.7)`;

    card.innerHTML = `
      <div class="csc-img" style="filter:drop-shadow(0 0 8px ${ch.color})">${ch.emoji}</div>
      <div class="csc-name" style="color:${ch.color}">${ch.name}</div>
      <div class="csc-desc">${ch.desc.replace('\n', '<br>')}</div>
    `;

    const btn = document.createElement('button');
    btn.className   = 'csc-buy-btn';
    btn.innerHTML   = `◎ ${ch.price.toLocaleString()}`;
    btn.onclick = () => {
      const errEl = $('shop-error');
      if (G.coins < ch.price) {
        errEl.textContent = `${t('needMoreCoins')} ${(ch.price - G.coins).toLocaleString()} ${t('moreCoins')}`;
        errEl.classList.remove('shop-err-anim');
        requestAnimationFrame(() => errEl.classList.add('shop-err-anim'));
        SFX.noMoney?.();
        const coinBadge = $('shop-coins');
        if (coinBadge) {
          coinBadge.classList.add('coins-insufficient');
          setTimeout(() => coinBadge.classList.remove('coins-insufficient'), 700);
        }
        return;
      }
      SFX.buy?.();
      G.coins -= ch.price;
      save('coins', G.coins);
      updateCoinDisplay();
      // Redirect to chest screen with tier-appropriate rewards
      const savedLevel   = G.currentLevel;
      G.currentLevel     = (ch.tier + 1) * 10;
      const { rollChest } = _chestSystem;
      const chestData    = rollChest();
      G.currentLevel     = savedLevel;
      window._nav?.toChest(chestData, 'shop');
    };

    card.appendChild(btn);
    grid.appendChild(card);
  });

  content.appendChild(grid);

  // ── Blueprint progress ──────────────────────────────────────────────────────
  const bpTitle = document.createElement('div');
  bpTitle.className   = 'sc-more-section-title';
  bpTitle.textContent = 'BLUEPRINT PARTS';
  content.appendChild(bpTitle);

  const bpList = document.createElement('div');
  bpList.className = 'sc-bp-list';

  const BP_ORDER = ['pc21', 'c130', 'a10', 'f16', 'f18', 'f22', 'f35', 'b2', 'sr71'];
  BP_ORDER.forEach(id => {
    const needed   = _blueprintCost[id] || 0;
    const have     = (G.blueprints || {})[id] || 0;
    const unlocked = G.unlockedAircraft.includes(id);
    const name     = AIRCRAFT[id]?.name ?? id;
    const pct      = unlocked ? 100 : (needed > 0 ? Math.min(100, Math.round((have / needed) * 100)) : 0);
    const hasAny   = have > 0;

    const row = document.createElement('div');
    row.className = 'sc-bp-row'
      + (unlocked ? ' sc-bp-unlocked' : '')
      + (!unlocked && hasAny ? ' sc-bp-progress' : '')
      + (!unlocked && !hasAny ? ' sc-bp-empty' : '');

    const iconEl = unlocked ? '✓' : hasAny ? '■' : '□';
    row.innerHTML = `
      <div class="sc-bp-icon">${iconEl}</div>
      <div class="sc-bp-name">${name}</div>
      <div class="sc-bp-bar-wrap"><div class="sc-bp-bar-fill" style="width:${pct}%"></div></div>
      <div class="sc-bp-count">${unlocked ? 'UNLOCKED' : `${have}/${needed}`}</div>
    `;
    bpList.appendChild(row);
  });

  content.appendChild(bpList);
}

// Lazy-imported to avoid circular dep — resolved at call time
const _chestSystem = { get rollChest() { return _rollChest; } };
let _rollChest      = null;
let _blueprintCost  = {};
import('../systems/chest.js').then(m => {
  _rollChest     = m.rollChest;
  _blueprintCost = m.BLUEPRINT_COST || {};
});

// ── PUBLIC API ────────────────────────────────────────────────────────────────

let _activeTab = 'offers';

export function initShop(nav) {
  $('btn-shop-back').onclick = () => nav.toMenu();

  document.addEventListener('click', e => {
    const tab = e.target.closest('.shop-tab');
    if (!tab) return;
    const id = tab.dataset.tab;
    if (!id || id === _activeTab) return;
    _activeTab = id;
    document.querySelectorAll('.shop-tab').forEach(t =>
      t.classList.toggle('shop-tab-active', t.dataset.tab === id)
    );
    redrawContent();
  });
}

function redrawContent() {
  const content = $('shop-content');
  content.innerHTML = '';
  const handlers = makeHandlers();
  if (_activeTab === 'offers') renderOffers(content, handlers);
  else if (_activeTab === 'skins') renderSkins(content, handlers);
  else renderMore(content);
}

export function renderShop() {
  _activeTab = 'offers';
  document.querySelectorAll('.shop-tab').forEach(t =>
    t.classList.toggle('shop-tab-active', t.dataset.tab === 'offers')
  );
  $('shop-error').textContent = '';
  updateCoinDisplay();
  redrawContent();
}

function updateCoinDisplay() {
  const el = $('shop-coins-val');
  if (el) el.textContent = G.coins.toLocaleString();
}
