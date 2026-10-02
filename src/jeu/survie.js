// ─────────────────────────────────────────────────────────────
// LE MODE SURVIE : DES VAGUES SANS FIN
// Une arène commence par les vagues écrites dans sa fiche. Ensuite, les
// vagues sont fabriquées ici, chacune un peu plus dure que la précédente.
//
// Pour mesurer « dur », on calcule la menace d'une vague : les points de
// vie qui arrivent, multipliés par la vitesse des monstres (un monstre
// rapide reste moins longtemps devant les gardiens). Chaque vague
// fabriquée apporte CROISSANCE fois plus de menace que la précédente.
// Au-delà de MAX_PAR_GROUPE monstres, on ne les rend plus plus nombreux
// mais plus résistants (« force » multiplie leurs points de vie) : l'écran
// reste lisible, et l'or gagné ne suit plus. C'est ce qui finit toujours
// par faire tomber le château.
//
// Réglé en octobre 2026 (avant : 17 % et 40 monstres par groupe). Givrine +
// Grondin tenait alors 35 vagues, plus d'une demi-heure, et toute la défense
// était achetée dès la vague 13 : il ne restait plus rien à décider. Avec
// moins de monstres par groupe, on gagne moins d'or et la foule est moins
// serrée pour les rochers ; avec 20 %, le danger arrive plus tôt.
// Puis 25 %, quand l'arène a reçu les pouvoirs du château, les bénédictions
// et le héros : avec 20 %, un très bon joueur repartait vers 35 vagues.
// Puis 22 %, quand le Météore est passé à un par vague (une partie enregistrée
// de 50 vagues montrait qu'il suivait les monstres à l'infini). Avec 25 %, le
// bon joueur imaginaire ne tenait plus que 22 vagues ; avec 22 %, il en tient
// 26, et un « expert » qui copie la technique de cette partie s'arrête vers 35.
// ─────────────────────────────────────────────────────────────
import { MONSTRES } from './donnees.js';

export const CROISSANCE = 1.22;   // chaque vague fabriquée : 22 % de menace en plus
const MAX_PAR_GROUPE = 15;        // au-delà, des monstres renforcés plutôt que plus nombreux
const VAGUES_EN_TOUT = 150;       // bien plus que ce qu'on peut tenir

// La menace d'un groupe de monstres
export const menace = (g) => g.nombre * MONSTRES[g.type].pv * (g.force || 1) * MONSTRES[g.type].vitesse;

// Les thèmes des vagues fabriquées, à tour de rôle. part = la part de la menace
// portée par chaque type de monstre.
const THEMES = [
  [{ type: 'gluant', part: 1 }],                                                                   // une marée de Gluants
  [{ type: 'filou', part: 0.7 }, { type: 'gluant', part: 0.3 }],                                    // une ruée de Filous
  [{ type: 'cuirasse', part: 0.75 }, { type: 'filou', part: 0.25 }],                                // une colonne de Cuirassés
  [{ type: 'gluant', part: 0.4 }, { type: 'filou', part: 0.3 }, { type: 'cuirasse', part: 0.3 }],   // tout à la fois
];

// Toutes les vagues d'une arène : celles de la fiche, puis les vagues fabriquées
export function vaguesDeSurvie(vaguesEcrites) {
  const vagues = [...vaguesEcrites];
  // on part de la menace de la dernière vague écrite
  let budget = vaguesEcrites[vaguesEcrites.length - 1].reduce((total, g) => total + menace(g), 0);
  // des monstres de plus en plus serrés : 0,6 s entre deux monstres, × 0,97 à chaque vague. On
  // multiplie à la main plutôt qu'avec Math.pow, qui peut différer d'un navigateur à l'autre au
  // dernier chiffre (voir calcul.js) : les vagues sont ainsi les mêmes pour tout le monde.
  let serrage = 0.6;
  for (let n = 0; n < vagues.length; n++) serrage *= 0.97;
  for (let n = vagues.length; n < VAGUES_EN_TOUT; n++) {
    budget *= CROISSANCE;
    const ecart = Math.max(0.2, serrage);
    serrage *= 0.97;
    vagues.push(THEMES[n % THEMES.length].map(({ type, part }, i) => {
      const m = MONSTRES[type];
      let nombre = Math.max(1, Math.round((budget * part) / (m.pv * m.vitesse)));
      let force = 1;
      if (nombre > MAX_PAR_GROUPE) {
        force = nombre / MAX_PAR_GROUPE;
        nombre = MAX_PAR_GROUPE;
      }
      // les Cuirassés, lents et costauds, arrivent plus espacés ; chaque groupe part 4 s après le précédent
      const groupe = { type, nombre, ecart: Math.round((type === 'cuirasse' ? ecart * 4 : ecart) * 100) / 100, delai: i * 4 };
      if (force > 1) groupe.force = Math.round(force * 100) / 100;
      return groupe;
    }));
  }
  return vagues;
}
