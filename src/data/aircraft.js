export const AIRCRAFT = {
  f22:  { id: 'f22',  name: 'F-22 Raptor',       xpCost: 12000, starter: false, type: 'stealth',   ability: 'stealth',     abilityDesc: '10s stealth / 5 answers', color: '#94a3b8' },
  t6:   { id: 't6',   name: 'T-6 Texan II',       xpCost: 0,     starter: true,  type: 'trainer',   ability: null,          abilityDesc: 'Balanced',       color: '#fbbf24' },
  pc21: { id: 'pc21', name: 'Pilatus PC-21',       xpCost: 800,   starter: false, type: 'trainer',   ability: null,          abilityDesc: 'Balanced',       color: '#60a5fa' },
  c130: { id: 'c130', name: 'C-130 Hercules',      xpCost: 2000,  starter: false, type: 'transport', ability: 'extraLife',   abilityDesc: '+1 life/level',  color: '#6b7280' },
  a10:  { id: 'a10',  name: 'A-10 Thunderbolt II', xpCost: 3800,  starter: false, type: 'attack',    ability: 'doubleDamage',abilityDesc: 'Double damage',  color: '#78716c' },
  f16:  { id: 'f16',  name: 'F-16 Fighting Falcon',xpCost: 6000,  starter: false, type: 'fighter',   ability: 'nuke',        abilityDesc: 'Nuke / 10 answers', color: '#64748b' },
  f18:  { id: 'f18',  name: 'F/A-18 Hornet',       xpCost: 8800,  starter: false, type: 'fighter',   ability: 'machineGun',  abilityDesc: 'Machine gun 5s / 5 answers', color: '#475569' },
  f35:  { id: 'f35',  name: 'F-35 Lightning II',   xpCost: 14400, starter: false, type: 'stealth',   ability: 'heavyMissile', abilityDesc: '+40% damage',   color: '#334155' },
  b2:   { id: 'b2',   name: 'B-2 Spirit',          xpCost: 20000, starter: false, type: 'bomber',    ability: 'multiStealth', abilityDesc: 'Multi-shot / stealth 3 shots / +1 life', color: '#1e293b', lives: 4 },
  sr71: { id: 'sr71', name: 'SR-71 Blackbird',      xpCost: 27000, starter: false, type: 'recon',     ability: 'tripleShot',  abilityDesc: 'Triple shot +25% dmg / +2 lives', color: '#0f172a', lives: 5 },
};

export const AIRCRAFT_ORDER = ['t6','pc21','c130','a10','f16','f18','f22','f35','b2','sr71'];
