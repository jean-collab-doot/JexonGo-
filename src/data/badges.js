import { G, clampCoins } from '../state.js';
import { save } from '../utils/storage.js';

export const BADGES = [
  { id:'first_takeoff', name:'Premier Décollage', rarity:'Commun', image:'/assets/Badges/01_Premier_Decollage_Commun.png', goal:'Terminer le niveau 1', reward:'+50 coins · équipé : +5% vitesse', test:()=>G.highestLevel>=1, progress:()=>[Math.min(G.highestLevel,1),1] },
  { id:'good_student', name:'Bon Élève', rarity:'Commun', image:'/assets/Badges/02_Bon_Eleve_Commun.png', goal:'100 bonnes réponses au total', reward:'Bouclier 10 sec · recharge 30 sec', test:()=>G.totalCorrectAnswers>=100, progress:()=>[Math.min(G.totalCorrectAnswers,100),100] },
  { id:'steady_recruit', name:'Recrue Assidue', rarity:'Commun', image:'/assets/Badges/03_Recrue_Assidue_Commun.png', goal:'Plan de connexion de 7 jours', reward:'+1 vie au début de chaque niveau', test:()=>G.dailyStreak>=7, progress:()=>[Math.min(G.dailyStreak,7),7] },
  { id:'fortune', name:'Fortune de Guerre', rarity:'Légendaire', image:'/assets/Badges/04_Fortune_de_Guerre_Legendaire.png', goal:'Accumuler 10 000 XP', reward:'Équipé : +15% XP', test:()=>G.totalXpEarned>=10000, progress:()=>[Math.min(G.totalXpEarned,10000),10000] },
  { id:'elite_shooter', name:"Tireur d'Élite", rarity:'Rare', image:'/assets/Badges/05_Tireur_d_Elite_Rare.png', goal:'95%+ de précision sur un niveau', reward:'Équipé : +5% XP', test:c=>c?.accuracy>=95, progress:c=>[Math.min(c?.accuracy||0,95),95] },
  { id:'lightning_reflex', name:'Réflexe Éclair', rarity:'Rare', image:'/assets/Badges/06_Reflexe_Eclair_Rare.png', goal:'Temps de réponse moyen sous 5 secondes', reward:'+5 secondes par question', test:c=>Number.isFinite(c?.averageResponseTime)&&c.averageResponseTime<=5, progress:()=>[0,5] },
  { id:'collector', name:'Collectionneur', rarity:'Rare', image:'/assets/Badges/07_Collectionneur_Rare.png', goal:'Débloquer 5 avions', reward:'Équipé : -10% coût XP des avions', test:()=>G.acquiredAircraft.length>=5, progress:()=>[Math.min(G.acquiredAircraft.length,5),5] },
  { id:'flawless', name:'Sans-Faute', rarity:'Épique', image:'/assets/Badges/08_Sans_Faute_Epique_Corrige.png', goal:'Terminer un niveau sans perdre de vie', reward:'+250 coins · équipé : +15% dégâts', test:c=>c?.won&&c.livesLost===0, progress:()=>[0,1] },
  { id:'combo_master', name:'Maître du Combo', rarity:'Épique', image:'/assets/Badges/09_Maitre_du_Combo_Epique_Corrige.png', goal:'20 bonnes réponses consécutives', reward:'Équipé : 2 alliés + tir sur 5 cibles', test:()=>G.bestAnswerStreak>=20, progress:()=>[Math.min(G.bestAnswerStreak,20),20] },
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
    if (badge.id==='combo_master') { G.comboAcePermanent=true; if (!G.ownedShootingPlans.includes('squadron_plus')) G.ownedShootingPlans.push('squadron_plus'); }
    if (badge.id==='boss_hunter') { G.secretAircraftUnlocked=true; if (!G.unlockedAircraft.includes('f117')) G.unlockedAircraft.push('f117'); if (!G.acquiredAircraft.includes('f117')) G.acquiredAircraft.push('f117'); }
  }
  G.unlockedBadges=[...owned];
  ['unlockedBadges','coins','comboAcePermanent','secretAircraftUnlocked','ownedShootingPlans','unlockedAircraft','acquiredAircraft'].forEach(k=>save(k,G[k]));
  return unlocked;
}

export function badgeXpMultiplier() {
  return 1 + (G.activeBadge === 'fortune' ? .15 : 0) + (G.activeBadge === 'elite_shooter' ? .05 : 0);
}
