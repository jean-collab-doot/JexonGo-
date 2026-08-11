export const AIRCRAFT = {
  f22: {
    id: 'f22', name: 'F-22 Raptor', xpCost: 12000, starter: false,
    type: 'stealth',
    color: '#94a3b8',
    gradeRequired: 16, gradeLabel: 'CAPTAIN',
    ability: { icon: '◈', name: 'STEALTH', description: '+25% missiles · +20% fire', missileSpeed: 1.25, fireRate: 0.8 },
  },
  t6: {
    id: 't6', name: 'T-6 Texan II', xpCost: 0, starter: true,
    type: 'trainer',
    color: '#fbbf24',
    ability: { icon: '✈', name: 'TRAINER', description: 'Balanced aircraft' },
  },
  pc21: {
    id: 'pc21', name: 'Pilatus PC-21', xpCost: 800, starter: false,
    type: 'trainer',
    color: '#60a5fa',
    ability: { icon: '⚡', name: 'SPEED', description: '+10% speed', moveSpeed: 1.1 },
  },
  c130: {
    id: 'c130', name: 'C-130 Hercules', xpCost: 2000, starter: false,
    type: 'transport',
    color: '#6b7280',
    ability: { icon: '♥', name: 'EXTRA HEART', description: '+1 life', extraLives: 1 },
  },
  a10: {
    id: 'a10', name: 'A-10 Thunderbolt II', xpCost: 3800, starter: false,
    type: 'attack',
    color: '#78716c',
    ability: { icon: '✹', name: 'HEAVY GUN', description: '+50% damage', damage: 1.5 },
  },
  f16: {
    id: 'f16', name: 'F-16 Fighting Falcon', xpCost: 6000, starter: false,
    type: 'fighter',
    color: '#64748b',
    ability: { icon: '➤', name: 'MISSILE SPEED', description: '+18% missile speed', missileSpeed: 1.18 },
  },
  f18: {
    id: 'f18', name: 'F/A-18 Hornet', xpCost: 8800, starter: false,
    type: 'fighter',
    color: '#475569',
    ability: { icon: '✦', name: 'MACHINE GUN', description: 'Twin shots · +30% fire', bonusShots: 1, fireRate: 0.7 },
  },
  f35: {
    id: 'f35', name: 'F-35 Lightning II', xpCost: 14400, starter: false,
    type: 'stealth',
    color: '#334155',
    ability: { icon: '⚡', name: 'LASER', description: 'Laser · x2 damage', weapon: 'xray', damage: 2 },
  },
  b2: {
    id: 'b2', name: 'B-2 Spirit', xpCost: 22000, starter: false,
    type: 'bomber',
    color: '#1e293b',
    gradeRequired: 26, gradeLabel: 'MAJOR',
    ability: { icon: '♥', name: 'ARMORED BOMBER', description: '+1 life · x2 damage', extraLives: 1, damage: 2 },
  },
  sr71: {
    id: 'sr71', name: 'SR-71 Blackbird', xpCost: 30000, starter: false,
    type: 'recon',
    color: '#0f172a',
    gradeRequired: 36, gradeLabel: 'COLONEL',
    ability: { icon: '♥', name: 'BLACKBIRD', description: '+1 life · +30% speed · laser x2', extraLives: 1, moveSpeed: 1.3, missileSpeed: 1.35, fireRate: 0.55, weapon: 'xray', damage: 2 },
  },
  f117: {
    id: 'f117', name: 'F-117 Nighthawk', xpCost: 0, starter: false, secret: true,
    type: 'stealth', color: '#111827',
    ability: { icon: '★', name: 'SECRET NIGHTHAWK', description: '+1 life · laser x2', extraLives: 1, moveSpeed: 1.18, missileSpeed: 1.25, fireRate: 0.7, weapon: 'xray', damage: 2 },
  },
};

export const AIRCRAFT_ORDER = ['t6','pc21','c130','a10','f16','f18','f22','f35','b2','sr71','f117'];
