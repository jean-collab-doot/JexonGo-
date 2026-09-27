import { G, clampCoins } from '../state.js';
import { save } from '../utils/storage.js';

export const BADGES = [
  { id:'first_takeoff', name:'Premier Décollage', rarity:'Commun', image:'/assets/Badges/01_Premier_Decollage_Commun.png', goal:'Terminer le niveau 1', reward:'+50 coins · équipé : +5% vitesse', test:()=>G.highestLevel>=1, progress:()=>[Math.min(G.highestLevel,1),1] },
  { id:'good_student', name:'Bon Élève', rarity:'Commun', image:'/assets/Badges/02_Bon_Eleve_Commun.png', goal:'100 bonnes réponses au total', reward:'Bouclier 10 sec · recharge 30 sec', test:()=>G.totalCorrectAnswers>=100, progress:()=>[Math.min(G.totalCorrectAnswers,100),100] },
  { id:'steady_recruit', name:'Recrue Assidue', rarity:'Commun', image:'/assets/Badges/03_Recrue_Assidue_Commun.png', goal:'Plan de connexion de 5 jours', reward:'Équipé : +1 vie au début de chaque niveau, avec tous les avions', test:()=>G.dailyStreak>=5, progress:()=>[Math.min(G.dailyStreak,5),5] },
  { id:'fortune', name:'Fortune de Guerre', rarity:'Légendaire', image:'/assets/Badges/04_Fortune_de_Guerre_Legendaire.png', goal:'Accumuler 10 000 XP depuis le début', reward:'Équipé : +300 pièces par partie gagnée', test:()=>(G.lifetimeXpEarned||0)>=10000, progress:()=>[Math.min(G.lifetimeXpEarned||0,10000),10000] },
  { id:'lightning_reflex', name:'Réflexe Éclair', rarity:'Rare', image:'/assets/Badges/06_Reflexe_Eclair_Rare.png', goal:'Temps de réponse moyen sous 5 secondes', reward:'+5 secondes par question', test:c=>Number.isFinite(c?.averageResponseTime)&&c.averageResponseTime<=5, progress:()=>[0,5] },
  { id:'collector', name:'Collectionneur', rarity:'Rare', image:'/assets/Badges/07_Collectionneur_Rare.png', goal:'Débloquer 5 avions', reward:'Équipé : -10% coût XP des avions', test:()=>G.acquiredAircraft.length>=5, progress:()=>[Math.min(G.acquiredAircraft.length,5),5] },
  { id:'flawless', name:'Sans-Faute', rarity:'Épique', image:'/assets/Badges/08_Sans_Faute_Epique_Corrige.png', goal:'Terminer 2 niveaux sans perdre de vie', reward:'+250 coins · équipé : +15% dégâts', test:()=>(G.flawlessLevels||0)>=2, progress:()=>[Math.min(G.flawlessLevels||0,2),2] },
  { id:'boss_hunter', name:'Chasseur de Boss', rarity:'Épique', image:'/assets/Badges/10_Chasseur_de_Boss_STS_vs_F16_Eloignes.png', goal:'Vaincre un boss', reward:'Avion secret ??? · équipé : +25% dégâts boss', test:c=>c?.won&&c.isBoss, progress:()=>[0,1] },
];

export function unlockEligibleBadges(context={}) {
  if (G.tutorialMode) return [];
  const owned = new Set(G.unlockedBadges || []);
  const unlocked = [];
  for (const badge of BADGES) {
    if (owned.has(badge.id) || !badge.test(context)) continue;
    owned.add(badge.id); unlocked.push(badge);
    if (badge.id==='first_takeoff') G.coins=clampCoins(G.coins+50);
    if (badge.id==='flawless') G.coins=clampCoins(G.coins+250);
    if (badge.id==='boss_hunter') { G.secretAircraftUnlocked=true; if (!G.unlockedAircraft.includes('f117')) G.unlockedAircraft.push('f117'); if (!G.acquiredAircraft.includes('f117')) G.acquiredAircraft.push('f117'); }
  }
  G.unlockedBadges=[...owned];
  ['unlockedBadges','coins','comboAcePermanent','secretAircraftUnlocked','ownedShootingPlans','unlockedAircraft','acquiredAircraft'].forEach(k=>save(k,G[k]));
  return unlocked;
}

export function badgeXpMultiplier() {
  return 1;
}

// Fortune de Guerre (equipped): +300 coins for every won game.
export const FORTUNE_BONUS_COINS = 300;
export function badgeCoinBonus() {
  return G.activeBadge === 'fortune' ? FORTUNE_BONUS_COINS : 0;
}
