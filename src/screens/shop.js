import { $ } from '../utils/dom.js';
import { G } from '../state.js';
import { save } from '../utils/storage.js';
import { SKINS, RARITY_META } from '../data/skins.js';
import { drawFrame } from '../game/sprites.js';
import { AIRCRAFT_SPRITE } from '../game/sprites.js';

// Card gradient backgrounds per rarity
const CARD_GRAD = {
  common:    'linear-gradient(160deg,#6b7a8d 0%,#2d3748 100%)',
  rare:      'linear-gradient(160deg,#3b82f6 0%,#1e3a8a 100%)',
  epic:      'linear-gradient(160deg,#a855f7 0%,#4c1d95 100%)',
  legendary: 'linear-gradient(160deg,#f59e0b 0%,#92400e 100%)',
  exclusive: 'linear-gradient(160deg,#ff2277 0%,#7f1d45 100%)',
};

// Which skins appear in OFFERS tab as featured (big) vs small
const FEATURED_ID = 'legendary';   // big left card
const OFFER_IDS   = ['epic'];      // two stacked right cards (both epics)

// ── SPRITE PREVIEW ────────────────────────────────────────────────────────────
function makePreview(skin, size, offerMode = false) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  c.className = 'sc-preview';
  const half   = size / 2;
  const sprKey = AIRCRAFT_SPRITE[skin.aircraft] ?? AIRCRAFT_SPRITE[G.activeAircraft] ?? 'ship-t6';

  function drawWithLivery(ctx, liveryImg) {
    ctx.clearRect(0, 0, size, size);
    // Draw plane sprite
    try { drawFrame(ctx, sprKey, 0, half, half, size, size); } catch (_) {}
    // Overlay livery texture only on plane pixels
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.72;
    ctx.drawImage(liveryImg, 0, 0, size, size);
    ctx.restore();
  }

  function draw() {
    const ctx = c.getContext('2d');
    if (offerMode && skin.offerImg) {
      const img = new Image();
      img.onload = () => drawWithLivery(ctx, img);
      img.src = skin.offerImg;
    } else {
      ctx.clearRect(0, 0, size, size);
      ctx.filter = skin.filter || 'none';
      try { drawFrame(ctx, sprKey, 0, half, half, size, size); } catch (_) {}
      ctx.filter = 'none';
    }
  }
  draw();
  setTimeout(draw, 400);
  return c;
}

// ── PRICE BUTTON ──────────────────────────────────────────────────────────────
function makePriceBtn(skin, onBuy, onEquip) {
  const owned  = G.ownedSkins.includes(skin.id);
  const active = G.activeSkin === skin.id;
  const btn    = document.createElement('button');
  btn.className = 'sc-price-btn';

  if (active) {
    btn.textContent      = '✓ EQUIPPED';
    btn.classList.add('sc-btn-equipped');
    btn.disabled         = true;
  } else if (owned) {
    btn.textContent      = 'EQUIP';
    btn.classList.add('sc-btn-equip');
    btn.onclick          = () => onEquip(skin, btn);
  } else {
    btn.innerHTML        = `🪙 <strong>${skin.price}</strong>`;
    btn.classList.add('sc-btn-buy');
    btn.style.background = RARITY_META[skin.rarity]?.color || '#f59e0b';
    btn.onclick          = () => onBuy(skin, btn);
  }
  return btn;
}

// ── OFFER CARD (featured big or small) ───────────────────────────────────────
function makeCard(skin, size = 'small', onBuy, onEquip, offerMode = false) {
  const meta  = RARITY_META[skin.rarity];
  const owned = G.ownedSkins.includes(skin.id);
  const active = G.activeSkin === skin.id;

  const card = document.createElement('div');
  card.className = `sc-card sc-card-${size}` + (active ? ' sc-card-active' : '');
  card.style.background = CARD_GRAD[skin.rarity] || CARD_GRAD.common;

  // Shine
  const shine = document.createElement('div');
  shine.className = 'sc-shine';

  // "SPECIAL OFFER" banner
  const banner = document.createElement('div');
  banner.className   = 'sc-banner';
  banner.textContent = owned ? 'OWNED' : 'SPECIAL OFFER';
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

// ── BUY / EQUIP HANDLERS ─────────────────────────────────────────────────────
function makeHandlers() {
  function onBuy(skin, btn) {
    const errEl = $('shop-error');
    if (G.coins < skin.price) {
      errEl.textContent = `✗ NEED ${(skin.price - G.coins).toLocaleString()} MORE COINS`;
      errEl.classList.remove('shop-err-anim');
      requestAnimationFrame(() => errEl.classList.add('shop-err-anim'));
      return;
    }
    errEl.textContent = '';
    G.coins -= skin.price;
    G.ownedSkins.push(skin.id);
    save('coins', G.coins);
    save('ownedSkins', G.ownedSkins);
    updateCoinDisplay();

    // Update ALL instances of this skin's button
    document.querySelectorAll(`[data-skin="${skin.id}"]`).forEach(b => {
      b.textContent   = 'EQUIP';
      b.className     = 'sc-price-btn sc-btn-equip';
      b.style.background = '';
      b.disabled      = false;
      b.onclick       = () => onEquip(skin, b);
    });
  }

  function onEquip(skin, btn) {
    // Reset previous equipped
    document.querySelectorAll('.sc-card-active').forEach(c => c.classList.remove('sc-card-active'));
    document.querySelectorAll('.sc-price-btn.sc-btn-equipped').forEach(b => {
      b.textContent  = 'EQUIP';
      b.className    = 'sc-price-btn sc-btn-equip';
      b.disabled     = false;
    });

    G.activeSkin = skin.id;
    save('activeSkin', G.activeSkin);
    updateCoinDisplay();

    // Mark all cards for this skin
    document.querySelectorAll(`[data-skin="${skin.id}"]`).forEach(b => {
      b.textContent = '✓ EQUIPPED';
      b.className   = 'sc-price-btn sc-btn-equipped';
      b.disabled    = true;
      const card    = b.closest('.sc-card');
      if (card) card.classList.add('sc-card-active');
    });
  }

  return { onBuy, onEquip };
}

// ── TAB RENDERERS ─────────────────────────────────────────────────────────────

function renderOffers(content, handlers) {
  const { onBuy, onEquip } = handlers;
  const featured = SKINS.find(s => s.rarity === FEATURED_ID) || SKINS[6];
  const offerSkins = SKINS.filter(s => OFFER_IDS.includes(s.rarity)).slice(0, 2);

  const row = document.createElement('div');
  row.className = 'sc-offers-row';

  // Featured big card (left)
  const { card: bigCard, btn: bigBtn } = makeCard(featured, 'featured', onBuy, onEquip, true);
  bigBtn.dataset.skin = featured.id;
  row.appendChild(bigCard);

  // Two small cards stacked (right)
  const stack = document.createElement('div');
  stack.className = 'sc-offers-stack';
  offerSkins.forEach(skin => {
    const { card, btn } = makeCard(skin, 'small', onBuy, onEquip, true);
    btn.dataset.skin = skin.id;
    stack.appendChild(card);
  });
  row.appendChild(stack);

  content.appendChild(row);
}

function renderSkins(content, handlers) {
  const { onBuy, onEquip } = handlers;
  const grid = document.createElement('div');
  grid.className = 'sc-skins-grid';
  SKINS.forEach(skin => {
    const { card, btn } = makeCard(skin, 'small', onBuy, onEquip);
    btn.dataset.skin = skin.id;
    grid.appendChild(card);
  });
  content.appendChild(grid);
}

function renderMore(content) {
  const wrap = document.createElement('div');
  wrap.className   = 'sc-more';
  wrap.innerHTML   = `<div class="sc-more-icon">🔒</div><div class="sc-more-text">MORE CONTENT<br>COMING SOON</div>`;
  content.appendChild(wrap);
}

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
