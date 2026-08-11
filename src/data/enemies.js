export const ENEMY_DEFS = {
  basic: { id: 'basic', hp: 1, speed: 1.3,  color: '#ef4444', size: 26, label: '',     timeMod: 1.0, fireRate: 220 },
  tank:  { id: 'tank',  hp: 2, speed: 0.8,  color: '#f97316', size: 34, label: 'TANK', timeMod: 1.0, fireRate: 260 },
  fast:  { id: 'fast',  hp: 1, speed: 1.6,  color: '#a855f7', size: 20, label: 'FAST', timeMod: 0.6, fireRate: 90  },
  turner: { id: 'turner', hp: 1, speed: 1.45, color: '#e5e7eb', size: 29, label: '', timeMod: 0.8, fireRate: 170 },
  interceptor: { id: 'interceptor', hp: 1, speed: 3.35, color: '#94a3b8', size: 27, label: '', timeMod: 0.5, fireRate: 150 },
  boss:  { id: 'boss',  hp: 5, speed: 0.55, color: '#fbbf24', size: 52, label: 'BOSS', timeMod: 0.8, fireRate: 120 },
};
