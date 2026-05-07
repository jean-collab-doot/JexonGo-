export const PRESTIGE_TIERS = [
  { level: 0, name: 'RECRUIT',   color: '#e2e8f0', img: null },
  { level: 1, name: 'ACE',       color: '#fbbf24', img: '/assets/prestige/p1-ace.gif',       skinReward: 'prestige-gold', rewardDesc: 'Gold Skin Unlocked' },
  { level: 2, name: 'ELITE',     color: '#60a5fa', img: '/assets/prestige/p2-elite.gif',                                  rewardDesc: 'Blue Profile Border' },
  { level: 3, name: 'LEGENDARY', color: '#a855f7', img: '/assets/prestige/p3-legendary.gif',                              rewardDesc: 'Purple Missile Trail' },
  { level: 4, name: 'MYTHIC',    color: '#ef4444', img: '/assets/prestige/p4-mythic.gif',    skinReward: 'prestige-red',  rewardDesc: 'Exclusive Red Aircraft' },
  { level: 5, name: 'DIVINE',    color: null,       img: '/assets/prestige/p5-divine.gif',                                rewardDesc: 'Rainbow Title' },
];

export function getPrestigeTier(prestige) {
  return PRESTIGE_TIERS[Math.min(Math.max(prestige, 0), PRESTIGE_TIERS.length - 1)];
}

export function getPrestigeBadgeHTML(prestige) {
  if (prestige <= 0) return '';
  const tier = getPrestigeTier(prestige);
  if (!tier.color) {
    return '<span class="prestige-badge prestige-badge-rainbow">✦P5</span>';
  }
  return `<span class="prestige-badge" style="color:${tier.color};border-color:${tier.color}66">✦P${prestige}</span>`;
}
