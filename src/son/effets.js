// ─────────────────────────────────────────────────────────────
// LES BRUITAGES
// Une recette par événement du jeu, écrite une seule fois : elle utilise
// les instruments de l'époque en cours (src/son/orchestres.js). Le même
// tir de Braise sonne donc « console » en pixel, « dessin animé » en
// cartoon, et feutré avec de l'écho en voxel.
//
// Chaque recette reçoit des outils (o) :
//   o.bip(frequence, options)    : un petit son avec le « timbre » de l'époque
//   o.note(numero, options)      : pareil, mais avec une note (72 = Do5…)
//   o.arpege([numeros], options) : plusieurs notes, l'une après l'autre
//   o.grave(frequence, options)  : un son grave qui gronde
//   o.bruit(options)             : du bruit filtré (vent, feu, explosion…)
//   o.coup(options)              : la grosse caisse de l'époque (un « boum »)
// Les options : duree et retard (en secondes), volume, et :
//   de     : la note part « de » fois plus haut (2 = une octave) et glisse vers sa fréquence ;
//   type   : le filtre du bruit ('lowpass' garde les graves, 'highpass' les aigus,
//            'bandpass' une bande au milieu) ; de → a : sa fréquence glisse de « de » à « a ».
// Les fréquences sont en hertz (vibrations par seconde) : 440 = le La du diapason.
// ─────────────────────────────────────────────────────────────
import { MONSTRES } from '../jeu/donnees.js';

// Plus un monstre est solide, plus le son de sa défaite est grave
const hauteurDefaite = (pv) => (pv < 40 ? 880 : pv < 100 ? 620 : pv < 1000 ? 380 : 220);

export const RECETTES = {
  // ── Les gardiens tirent ──
  // Braise : un souffle de feu qui part (du bruit qui descend) et un petit « piou »
  'tir:braise': (o) => {
    o.bruit({ duree: 0.12, volume: 0.18, type: 'bandpass', de: 2400, a: 700, q: 1.2 });
    o.bip(330, { duree: 0.07, volume: 0.15, de: 2 });
  },
  // Givrine : deux notes très aiguës, comme du verre
  'tir:givrine': (o) => {
    o.bip(1568, { duree: 0.05, volume: 0.22 });
    o.bip(2093, { duree: 0.06, volume: 0.18, retard: 0.04 });
  },
  // Grondin : le mortier fait « boum » en lançant son rocher
  'tir:grondin': (o) => {
    o.coup({ volume: 0.25 });
    o.bruit({ duree: 0.15, volume: 0.12, type: 'lowpass', de: 600, a: 200 });
  },
  // Bourrasque : un « fffff » de vent qui monte
  'tir:bourrasque': (o) => o.bruit({ duree: 0.2, volume: 0.3, type: 'bandpass', de: 500, a: 1600, q: 1.5 }),
  // Étincelle : son éclair (l'événement « eclair ») grésille et claque
  eclair: (o) => {
    o.bruit({ duree: 0.16, volume: 0.05, type: 'highpass', de: 3000, a: 5000 });
    o.bip(1800, { duree: 0.1, volume: 0.12, de: 0.5 });
    o.bip(2600, { duree: 0.06, volume: 0.08, retard: 0.05 });
  },

  // ── Ce que font les tirs ──
  souffle: (o) => o.bruit({ duree: 0.45, volume: 0.3, type: 'bandpass', de: 400, a: 1400, q: 1 }),
  explosion: (o, ev) => {
    if (ev.quoi === 'meteore') {
      // le Météore s'écrase : un très gros « boum », qui gronde longtemps
      o.coup({ volume: 0.9 });
      o.bruit({ duree: 1.1, volume: 0.5, type: 'lowpass', de: 1600, a: 70 });
      o.grave(58, { duree: 0.7, volume: 0.6, de: 1.6 });
      return;
    }
    o.coup({ volume: 0.4 });
    o.bruit({ duree: 0.5, volume: 0.3, type: 'lowpass', de: 1200, a: 120 });
  },
  // un coup qui ricoche sur une carapace : « tink » (deux notes métalliques)
  carapace: (o) => {
    o.bip(2400, { duree: 0.04, volume: 0.25 });
    o.bip(3600, { duree: 0.03, volume: 0.15 });
  },

  // ── Les monstres ──
  mort: (o, ev) => {
    const fiche = MONSTRES[ev.quoi];
    if (fiche?.boss) {
      o.coup({ volume: 1 });
      o.bruit({ duree: 1.4, volume: 0.6, type: 'lowpass', de: 1500, a: 80 });
      o.arpege([72, 76, 79, 84, 88, 91], { ecart: 0.07, duree: 0.2, volume: 0.35, retard: 0.3 });
      return;
    }
    o.bip(hauteurDefaite(fiche?.pv ?? 50), { duree: 0.12, volume: 0.2, de: 0.6 });
    o.bruit({ duree: 0.08, volume: 0.1, type: 'bandpass', de: 1500, a: 600 });
  },
  // la Taupe plonge (« floump ») et ressort (« pop »)
  plonge: (o) => {
    o.bruit({ duree: 0.22, volume: 0.15, type: 'lowpass', de: 900, a: 200 });
    o.bip(300, { duree: 0.1, volume: 0.1, de: 1.6 });
  },
  surgit: (o) => {
    o.bruit({ duree: 0.18, volume: 0.12, type: 'lowpass', de: 250, a: 900 });
    o.bip(420, { duree: 0.08, volume: 0.12, de: 0.6 });
  },
  // des petits qui sortent : trois bulles qui montent
  naissance: (o) => o.arpege([72, 76, 79], { ecart: 0.06, duree: 0.07, volume: 0.3 }),
  // le feu du Dragon : un grand souffle et un grognement grave
  flamme: (o) => {
    o.bruit({ duree: 0.75, volume: 0.45, type: 'bandpass', de: 900, a: 250, q: 0.7 });
    o.grave(82, { duree: 0.6, volume: 0.6, de: 1.3 });
  },

  // ── Les pouvoirs du château ──
  // le Météore part : un sifflement qui descend pendant toute sa chute
  meteore: (o) => {
    o.bip(420, { duree: 0.85, volume: 0.13, de: 4.5 });
    o.bruit({ duree: 0.85, volume: 0.16, type: 'bandpass', de: 3200, a: 500, q: 1.4 });
  },
  // le Grand froid : des notes de cristal qui montent, et un souffle glacé
  grandFroid: (o) => {
    o.arpege([88, 91, 95, 100, 103], { ecart: 0.05, duree: 0.3, volume: 0.24 });
    o.bruit({ duree: 1, volume: 0.18, type: 'highpass', de: 3500, a: 7000 });
    o.bruit({ duree: 0.8, volume: 0.14, type: 'bandpass', de: 1600, a: 400, q: 0.8 });
  },

  // ── Le héros ──
  // il frappe le sol : un « boum » sourd et un peu de poussière
  frappe: (o) => {
    o.coup({ volume: 0.3 });
    o.bruit({ duree: 0.25, volume: 0.14, type: 'lowpass', de: 700, a: 150 });
  },
  // il gagne un niveau : une petite fanfare qui monte
  herosNiveau: (o) => o.arpege([67, 72, 76, 79, 84], { ecart: 0.08, duree: 0.22, volume: 0.32 }),
  // on l'envoie quelque part : un petit « hop »
  herosEnvoye: (o) => o.bip(520, { duree: 0.07, volume: 0.15, de: 0.7 }),
  // l'Onde de choc : un énorme « boum », la terre qui gronde, et un sifflement qui retombe
  ondeDeChoc: (o) => {
    o.coup({ volume: 0.75 });
    o.grave(52, { duree: 0.6, volume: 0.55, de: 2 });
    o.bruit({ duree: 0.7, volume: 0.32, type: 'lowpass', de: 1200, a: 90 });
    o.bip(880, { duree: 0.3, volume: 0.08, de: 0.5, retard: 0.05 });
  },
  // le Bond : un « whoosh » qui monte (il décolle)…
  bond: (o) => {
    o.bruit({ duree: 0.35, volume: 0.22, type: 'bandpass', de: 400, a: 2200, q: 1.2 });
    o.bip(300, { duree: 0.3, volume: 0.12, de: 0.5 });
  },
  // … et il retombe : un gros « boum » sourd
  atterrissage: (o) => {
    o.coup({ volume: 0.55 });
    o.bruit({ duree: 0.35, volume: 0.2, type: 'lowpass', de: 900, a: 120 });
  },
  // il tombe K.O. : trois notes qui descendent, tristes
  herosKO: (o) => o.arpege([67, 63, 60, 55], { ecart: 0.13, duree: 0.3, volume: 0.3 }),
  // il se relève (au début de la vague suivante) : trois notes qui remontent
  herosDebout: (o) => o.arpege([60, 64, 67, 72], { ecart: 0.09, duree: 0.22, volume: 0.26 }),

  // ── Les bénédictions ──
  // une bénédiction choisie : un arpège magique qui monte, et un scintillement
  benediction: (o) => {
    o.arpege([72, 76, 79, 84, 88, 91, 96], { ecart: 0.06, duree: 0.28, volume: 0.26 });
    o.bruit({ duree: 0.9, volume: 0.08, type: 'highpass', de: 5000, a: 8000 });
  },
  // un nouveau socle sort de terre : un « boum » sourd, puis trois notes qui montent
  nouveauSocle: (o) => {
    o.coup({ volume: 0.35 });
    o.arpege([67, 72, 76, 79], { ecart: 0.07, duree: 0.12, volume: 0.28, retard: 0.1 });
  },

  // ── L'or et les gardiens ──
  // la Pépite rapporte sa récolte : « ding-ding » comme des pièces
  recolte: (o) => o.arpege([88, 93], { ecart: 0.08, duree: 0.14, volume: 0.4 }),
  construction: (o) => o.arpege([72, 76, 79], { ecart: 0.05, duree: 0.09, volume: 0.3 }),
  amelioration: (o) => o.arpege([72, 76, 79, 84, 88], { ecart: 0.05, duree: 0.1, volume: 0.3 }),
  vente: (o) => o.arpege([79, 72], { ecart: 0.07, duree: 0.1, volume: 0.28 }),

  // ── L'interface et les grands moments ──
  clic: (o) => o.bip(1200, { duree: 0.02, volume: 0.1 }),
  menu: (o) => o.bip(660, { duree: 0.05, volume: 0.18, de: 0.8 }),
  // une fiche du didacticiel s'ouvre : un petit carillon (ou un grondement pour un chef)
  fiche: (o) => o.arpege([84, 88, 91], { ecart: 0.07, duree: 0.25, volume: 0.3 }),
  chef: (o) => {
    o.coup({ volume: 1 });
    o.bruit({ duree: 1.2, volume: 0.4, type: 'lowpass', de: 400, a: 60 });
    o.grave(55, { duree: 1, volume: 0.7, de: 1.5 });
  },
  // une vague est lancée : un « boum » et un souffle qui monte
  vague: (o) => {
    o.coup({ volume: 0.6 });
    o.bruit({ duree: 0.6, volume: 0.12, type: 'bandpass', de: 300, a: 2500, q: 0.8 });
  },
};

// Combien de fois un même bruitage peut jouer en même temps (max), et l'écart
// minimum entre deux départs (en secondes). Sans ça, vingt Gluants battus
// d'un seul rocher feraient vingt sons d'un coup : un vacarme… et le navigateur
// aurait du mal à suivre.
export const LIMITES = {
  defaut: { max: 3, ecart: 0.04 },
  'tir:braise': { max: 3, ecart: 0.06 },
  'tir:givrine': { max: 2, ecart: 0.08 },
  'tir:grondin': { max: 3, ecart: 0.08 },
  'tir:bourrasque': { max: 2, ecart: 0.1 },
  eclair: { max: 2, ecart: 0.08 },
  carapace: { max: 2, ecart: 0.07 },
  mort: { max: 4, ecart: 0.05 },
  explosion: { max: 3, ecart: 0.08 },
  plonge: { max: 2, ecart: 0.1 },
  surgit: { max: 2, ecart: 0.1 },
  souffle: { max: 2, ecart: 0.12 },
  flamme: { max: 1, ecart: 0.3 },
  recolte: { max: 4, ecart: 0.09 },
  meteore: { max: 1, ecart: 0.5 },
  benediction: { max: 1, ecart: 0.5 },
  frappe: { max: 2, ecart: 0.2 },
  ondeDeChoc: { max: 1, ecart: 0.5 },
  atterrissage: { max: 1, ecart: 0.3 },
  herosKO: { max: 1, ecart: 1 },
  herosNiveau: { max: 1, ecart: 0.5 },
  nouveauSocle: { max: 1, ecart: 0.5 },
  grandFroid: { max: 1, ecart: 0.5 },
};
