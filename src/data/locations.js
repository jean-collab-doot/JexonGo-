// Real-world (or, for Space, planet/moon) location shown for each level in the
// mission briefing. Index 0 = level 1 ... index 49 = level 50. Keep in sync
// with the level-node placements in screens/levelmap-territories.js.
export const LOCATION_NAMES = [
  // Pacifique (1-10)
  { name: 'South of New Zealand', nameFr: 'Sud de la Nouvelle-Zélande' },
  { name: 'North of New Zealand', nameFr: 'Nord de la Nouvelle-Zélande' },
  { name: 'Sydney, Australia', nameFr: 'Sydney, Australie' },
  { name: 'Brisbane, Australia', nameFr: 'Brisbane, Australie' },
  { name: 'Port Moresby, Papua New Guinea', nameFr: 'Port Moresby, Papouasie-Nouvelle-Guinée' },
  { name: 'Manila, Philippines', nameFr: 'Manille, Philippines' },
  { name: 'Shanghai, China', nameFr: 'Shanghaï, Chine' },
  { name: 'Tokyo, Japan', nameFr: 'Tokyo, Japon' },
  { name: 'Hawaii, USA', nameFr: 'Hawaï, États-Unis' },
  { name: 'Santiago, Chile', nameFr: 'Santiago, Chili' },

  // Sahara (11-20)
  { name: 'Western Sahara', nameFr: 'Sahara occidental' },
  { name: 'Casablanca, Morocco', nameFr: 'Casablanca, Maroc' },
  { name: 'Marrakesh, Morocco', nameFr: 'Marrakech, Maroc' },
  { name: 'Algiers, Algeria', nameFr: 'Alger, Algérie' },
  { name: 'Tamanrasset, Algeria', nameFr: 'Tamanrasset, Algérie' },
  { name: 'Tripoli, Libya', nameFr: 'Tripoli, Libye' },
  { name: 'Cairo, Egypt', nameFr: 'Le Caire, Égypte' },
  { name: 'Hurghada, Egypt', nameFr: 'Hurghada, Égypte' },
  { name: 'Alexandria, Egypt', nameFr: 'Alexandrie, Égypte' },
  { name: 'Western Desert, Egypt', nameFr: 'Désert occidental, Égypte' },

  // New York / USA (21-30)
  { name: 'New York City, USA', nameFr: 'New York, États-Unis' },
  { name: 'Washington D.C., USA', nameFr: 'Washington D.C., États-Unis' },
  { name: 'Outer Banks, North Carolina', nameFr: 'Outer Banks, Caroline du Nord' },
  { name: 'Charleston, South Carolina', nameFr: 'Charleston, Caroline du Sud' },
  { name: 'Miami, Florida', nameFr: 'Miami, Floride' },
  { name: 'Dallas, Texas', nameFr: 'Dallas, Texas' },
  { name: 'San Diego, California', nameFr: 'San Diego, Californie' },
  { name: 'Los Angeles, California', nameFr: 'Los Angeles, Californie' },
  { name: 'San Francisco, California', nameFr: 'San Francisco, Californie' },
  { name: 'Seattle, Washington', nameFr: 'Seattle, État de Washington' },

  // Arctique (31-40) - real Antarctic locations, south from the peninsula to the pole
  { name: 'Antarctic Peninsula', nameFr: 'Péninsule Antarctique' },
  { name: 'King George Island', nameFr: 'Île du Roi-George' },
  { name: 'Deception Island', nameFr: 'Île de la Déception' },
  { name: 'Ross Sea', nameFr: 'Mer de Ross' },
  { name: 'McMurdo Station', nameFr: 'Station McMurdo' },
  { name: 'Weddell Sea', nameFr: 'Mer de Weddell' },
  { name: 'Vostok Station', nameFr: 'Station Vostok' },
  { name: 'Transantarctic Mountains', nameFr: 'Monts Transantarctiques' },
  { name: 'Amundsen-Scott South Pole Station', nameFr: 'Station Amundsen-Scott (Pôle Sud)' },
  { name: 'Geographic South Pole', nameFr: 'Pôle Sud géographique' },

  // Espace (41-50) - two levels per planet/moon
  { name: 'Io', nameFr: 'Io' },
  { name: 'Io', nameFr: 'Io' },
  { name: 'Jupiter', nameFr: 'Jupiter' },
  { name: 'Jupiter', nameFr: 'Jupiter' },
  { name: 'Ganymede', nameFr: 'Ganymède' },
  { name: 'Ganymede', nameFr: 'Ganymède' },
  { name: 'Neptune', nameFr: 'Neptune' },
  { name: 'Neptune', nameFr: 'Neptune' },
  { name: 'Saturn', nameFr: 'Saturne' },
  { name: 'Saturn', nameFr: 'Saturne' },
];

export function getLocation(n) {
  return LOCATION_NAMES[n - 1] || LOCATION_NAMES[0];
}
