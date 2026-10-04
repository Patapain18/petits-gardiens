// ─────────────────────────────────────────────────────────────
// LES BRUITAGES
// Une recette par événement du jeu, écrite une seule fois, dans sons.json :
// des données, que l'atelier du son (son.html) mesure et règle. Elle utilise
// les instruments de l'époque en cours (src/son/orchestres.js). Le même tir
// de Braise sonne donc « console » en pixel, « dessin animé » en cartoon, et
// feutré avec de l'écho en voxel.
//
// Une recette, c'est une liste de « couches », qui partent ensemble (chacune
// peut attendre un peu : son « retard », en secondes). Les outils :
//   bip     : un petit son avec le « timbre » de l'époque ; frequence en hertz
//             (440 = le La du diapason) ; glisse : la note part « glisse » fois
//             plus haut (2 = une octave) et glisse vers sa fréquence ;
//   grave   : un son grave qui gronde (les mêmes réglages) ;
//   arpege  : plusieurs notes (des numéros : 72 = Do5, chaque demi-ton ajoute 1),
//             l'une après l'autre, toutes les « ecart » secondes ;
//   coup    : la grosse caisse de l'époque (un « boum ») ;
//   bruit   : du bruit filtré (vent, feu, explosion…) ; filtre : 'lowpass' garde
//             les graves, 'highpass' les aigus, 'bandpass' une bande au milieu ;
//             de → a : la fréquence du filtre glisse de « de » à « a » ; q : la
//             finesse de la bande.
// Et pour toutes : duree (en secondes) et volume.
// ─────────────────────────────────────────────────────────────
import { MONSTRES } from '../jeu/donnees.js';
import { REGLAGES_SON } from './reglages-son.js';

// Les recettes (lues dans sons.json, réglables par l'atelier)
export const BRUITAGES = REGLAGES_SON.bruitages;

// Plus un monstre est solide, plus le son de sa défaite est grave (une couche « selonLesPV » :
// sa fréquence est celle des monstres les plus fragiles, et descend pour les autres)
const hauteurDefaite = (pv) => (pv < 40 ? 880 : pv < 100 ? 620 : pv < 1000 ? 380 : 220);

// La recette d'un événement : le Météore qui s'écrase et les chefs qui tombent ont la leur
export function recetteDe(nom, ev = {}) {
  if (nom === 'explosion' && ev.quoi === 'meteore') return 'explosion:meteore';
  if (nom === 'mort' && MONSTRES[ev.quoi]?.boss) return 'mort:chef';
  return nom;
}

// Joue une recette avec les outils d'une époque (voir outilsBruitages dans son.js),
// couche après couche, dans l'ordre de la recette
export function jouerRecette(recette, o, ev = {}) {
  for (const c of recette.couches) {
    const retard = c.retard ?? 0;
    if (c.outil === 'bip' || c.outil === 'grave') {
      const f = c.selonLesPV ? (c.frequence * hauteurDefaite(MONSTRES[ev.quoi]?.pv ?? 50)) / 880 : c.frequence;
      o[c.outil](f, { duree: c.duree, volume: c.volume, de: c.glisse, retard });
    } else if (c.outil === 'arpege') {
      o.arpege(c.notes, { ecart: c.ecart, duree: c.duree, volume: c.volume, retard });
    } else if (c.outil === 'coup') {
      o.coup({ volume: c.volume, retard });
    } else if (c.outil === 'bruit') {
      o.bruit({ duree: c.duree, volume: c.volume, type: c.filtre, de: c.de, a: c.a, q: c.q, retard });
    }
  }
}

// Combien de fois un même bruitage peut jouer en même temps (max), et l'écart minimum entre deux
// départs (en secondes) : la « limite » de sa recette, ou celle par défaut. Sans ça, vingt Gluants
// battus d'un seul rocher feraient vingt sons d'un coup : un vacarme… et le navigateur aurait du
// mal à suivre. (Les recettes à part, comme celle du chef battu, comptent avec leur événement.)
export const limiteDe = (nom) => REGLAGES_SON.bruitages[nom]?.limite || REGLAGES_SON.limiteParDefaut;

// Un gardien des limites : garde(nom, heure) dit si ce bruitage a le droit de partir à cette
// heure-là (et, si oui, note son départ). Le jeu lui donne l'heure du son ; l'atelier du son,
// celle de chaque événement d'une partie rejouée hors ligne.
export function creerGarde() {
  const departs = new Map();
  return (nom, heure) => {
    const { max, ecart } = limiteDe(nom);
    const recents = (departs.get(nom) || []).filter((h) => h > heure - 0.3);
    if (recents.length >= max || recents.some((h) => h > heure - ecart)) return false;
    recents.push(heure);
    departs.set(nom, recents);
    return true;
  };
}
