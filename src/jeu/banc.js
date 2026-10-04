// ─────────────────────────────────────────────────────────────
// LE BANC D'ESSAI : CHAQUE GARDIEN FACE À CHAQUE MONSTRE
// Un bout de chemin tout droit, un socle à côté, un gardien dessus, et une
// file de 10 monstres d'une même sorte qui passe devant lui, à une case l'un
// de l'autre (un seul, pour un chef). Les monstres ont une vie infinie : on
// mesure tout ce que le gardien leur enlève pendant qu'ils passent.
//
// C'est le vrai moteur qui joue : le temps de vol des tirs, l'armure de la
// Carapace, les volants que les rochers ne touchent pas, la Taupe qui plonge,
// le Dragon qui assomme le gardien… tout compte. On en tire :
// - parMonstre : les dégâts que prend chaque monstre en passant (en moyenne) ;
// - part : la même chose, en part de sa vie (1 = un gardien seul le bat) ;
// - dps : les dégâts par seconde, pendant qu'un monstre est à portée ;
// - retient : combien de temps chaque monstre reste à portée, comparé au temps
//   qu'il y passerait sans être gêné (2 = deux fois plus longtemps : le gel de
//   la Givrine ou le vent de la Bourrasque le retiennent sous le feu).
// L'atelier de l'équilibrage s'en sert pour comparer les gardiens (et leurs
// améliorations) à prix égal.
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, NIVEAU_MAX, caracteristiques } from './donnees.js';
import { chargerNiveau } from './niveau.js';
import { creerPartie, majPartie, construire, ameliorer, PAS } from './moteur.js';
import { distance } from './calcul.js';

const LONGUEUR = 40;     // le chemin : 40 cases, tout droit, de gauche à droite
const SOCLE = { x: 10, y: 5.2 }; // le socle : à 1,2 case du chemin (qui passe en y = 4)
const FILE = 10;         // les monstres de la file (un seul pour un chef)
const ECART = 1;         // à une case l'un de l'autre
const VIE = 1e9;         // une vie « infinie »
const DUREE_MAX = 240;   // garde-fou : 4 minutes de jeu au plus

// Le niveau du banc, fabriqué une fois (sa vague ne sert pas : on y met nos monstres à la main)
let banc = null;
function niveauDuBanc() {
  banc ??= chargerNiveau({
    id: 'banc', nom: 'Banc d’essai', style: 'pixel', largeur: LONGUEUR + 2, hauteur: 9, or: 0,
    chemin: [{ x: 0, y: 4 }, { x: LONGUEUR, y: 4 }], socles: [SOCLE], chateau: { x: LONGUEUR + 1, y: 4 },
    vagues: [[{ type: 'gluant', nombre: 1, ecart: 1, delai: 0 }]], decor: { arbres: 0 },
  });
  return banc;
}

// Un gardien (son type, à ce niveau) face à une file de ce monstre. null pour un gardien qui ne
// tire pas (la Pépite).
export function mesurer(type, niveauGardien, monstre) {
  const fiche = caracteristiques(type, niveauGardien), m = MONSTRES[monstre];
  if (!fiche.projectile) return null;
  const niveau = niveauDuBanc();
  niveau.gardiens = { [type]: 1 };
  const etat = creerPartie(niveau, 1);
  etat.or = 1e6;
  construire(etat, 0, type);
  while (etat.tours[0].niveau < niveauGardien) ameliorer(etat, 0);
  // la file : des monstres à la vie infinie (leur « force » multiplie leurs points de vie)
  const nombre = m.boss ? 1 : FILE;
  for (let i = 0; i < nombre; i++) etat.aApparaitre.push({ type: monstre, force: VIE / m.pv, quand: (i * ECART) / m.vitesse });
  etat.statut = 'vague';
  etat.vague = 1;
  // on avance jusqu'à ce que toute la file soit passée (au-delà de la portée, et d'une case encore)
  const sortie = SOCLE.x + fiche.portee + 1;
  let pas = 0, aPortee = 0;
  const tempsPres = new Map(); // pour chaque monstre : le temps passé à portée
  while (pas * PAS < DUREE_MAX) {
    majPartie(etat, PAS);
    etat.evenements.length = 0;
    pas++;
    let quelquun = false;
    for (const e of etat.ennemis) {
      if (distance(e.x - SOCLE.x, e.y - SOCLE.y) > fiche.portee) continue;
      quelquun = true;
      tempsPres.set(e.id, (tempsPres.get(e.id) || 0) + PAS);
    }
    if (quelquun) aPortee += PAS;
    if (!etat.aApparaitre.length && etat.ennemis.every((e) => e.d > sortie)) break;
  }
  const degats = etat.degatsPar[type] || 0;
  // le temps qu'un monstre passerait à portée sans être gêné : la corde du cercle de portée
  const corde = 2 * Math.sqrt(Math.max(0, fiche.portee ** 2 - (SOCLE.y - 4) ** 2));
  const naturel = corde / m.vitesse;
  const tempsMoyen = tempsPres.size ? [...tempsPres.values()].reduce((a, b) => a + b, 0) / tempsPres.size : 0;
  return {
    degats,
    monstres: nombre,
    parMonstre: degats / nombre,
    part: degats / nombre / m.pv,
    dps: aPortee ? degats / aPortee : 0,
    retient: naturel ? tempsMoyen / naturel : 1,
  };
}

// Tout le banc : chaque gardien, à chacun de ses niveaux, face à chaque monstre.
// { braise: [ { gluant: mesure, filou: mesure… } (niveau 1), (niveau 2), (niveau 3) ], … }
export function mesurerTout() {
  const tableau = {};
  for (const type of Object.keys(GARDIENS)) {
    tableau[type] = [];
    for (let n = 1; n <= NIVEAU_MAX; n++) {
      tableau[type].push(Object.fromEntries(Object.keys(MONSTRES).map((monstre) => [monstre, mesurer(type, n, monstre)])));
    }
  }
  return tableau;
}

// Ce qu'un gardien a coûté en tout, à ce niveau (l'achat, et les améliorations jusque-là)
export function investi(type, niveau) {
  let total = 0;
  for (let n = 1; n <= niveau; n++) total += caracteristiques(type, n).cout;
  return total;
}
