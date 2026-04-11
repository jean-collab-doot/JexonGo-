const TIERS = [
  { name: 'STANDARD',  xp: 100,  color: '#94a3b8', weight: 50 },
  { name: 'RARE',      xp: 250,  color: '#60a5fa', weight: 30 },
  { name: 'EPIC',      xp: 500,  color: '#a855f7', weight: 15 },
  { name: 'LEGENDARY', xp: 1000, color: '#fbbf24', weight: 5  },
];

export function rollChest() {
  const roll = Math.random() * 100;
  let acc = 0;
  for (const t of TIERS) {
    acc += t.weight;
    if (roll < acc) return { ...t };
  }
  return { ...TIERS[0] };
}
