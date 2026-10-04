// ─────────────────────────────────────────────────────────────
// LE RELEVÉ D'UNE PARTIE, VAGUE APRÈS VAGUE
// L'atelier de l'équilibrage (equilibrage.html) dessine des courbes : où les
// joueurs perdent, l'or gagné et dépensé, la force des monstres contre celle
// des gardiens, qui fait les dégâts. Pour ça, on regarde une partie se jouer
// (un joueur imaginaire, ou une vraie partie rejouée) et on note, pour chaque
// vague :
// - marge : au plus près du château qu'un monstre est arrivé (en cases) ;
// - front : là où tombent les monstres (9 sur 10 tombent avant ce point, en
//   part du chemin : 0 = le départ, 1 = le château) ;
// - l'or : au début de la vague (les achats sont faits), à la fin, ce qui a
//   été dépensé avant, et ce qui a été gagné (les primes des monstres, le
//   bonus de fin de vague, la récolte des Pépites) ;
// - la défense au début de la vague (les gardiens posés, et ce qu'ils valent) ;
// - les dégâts faits pendant la vague, par qui ;
// - sa durée, les monstres battus, et si elle a été tenue.
// Ce fichier ne dessine rien : il ne fait que compter.
// ─────────────────────────────────────────────────────────────
import { MONSTRES, ECONOMIE, caracteristiques } from './donnees.js';

// La menace d'une vague (la même mesure que le mode survie, voir survie.js) : les points de vie qui
// arrivent, multipliés par la vitesse des monstres (un monstre rapide reste moins longtemps sous le
// feu). Avec les petits qui naissent quand leur parent tombe (les Gluants de la Gigogne, les deux
// Cuirassés du Colosse). parType : la menace de chaque sorte de monstre (pour le banc d'essai).
export function menaceDeVague(vague) {
  const parType = {};
  let menace = 0, pv = 0;
  const compter = (type, nombre, force) => {
    const m = MONSTRES[type];
    menace += nombre * m.pv * force * m.vitesse;
    pv += nombre * m.pv * force;
    parType[type] = (parType[type] || 0) + nombre * m.pv * force * m.vitesse;
    if (m.enfants) compter(m.enfants.type, nombre * m.enfants.nombre, force);
  };
  for (const g of vague) compter(g.type, g.nombre, g.force || 1);
  return { menace, pv, parType };
}

const mediane90 = (liste) => {
  if (!liste.length) return null;
  const triee = [...liste].sort((a, b) => a - b);
  return triee[Math.min(triee.length - 1, Math.floor(triee.length * 0.9))];
};

// Un relevé tout neuf, pour une partie qui commence sur ce niveau.
// releve.regarder(etat) : à appeler après chaque pas de jeu, AVANT d'effacer les événements (et
// aussi, pour une vraie partie rejouée, pendant la préparation : les achats sont des événements).
// releve.vagues : une ligne par vague jouée.
export function creerReleve(niveau) {
  const vagues = [];
  let v = null;                 // la vague en cours (ou la dernière jouée)
  let depense = 0;              // l'or dépensé depuis la fin de la vague d'avant
  let orFin = niveau.or;        // l'or à la fin de la vague d'avant (au départ : celui du niveau)
  let chutes = [];
  return {
    vagues,
    regarder(etat) {
      // une nouvelle vague commence : on note où on en est
      if (etat.statut === 'vague' && (!v || v.numero !== etat.vague)) {
        // (les primes de ce tout premier pas sont déjà dans l'or : on les retire)
        let primes = 0;
        for (const ev of etat.evenements) if (ev.type === 'mort') primes += ev.prime || 0;
        for (const ev of etat.evenements) depense += coutDe(ev);
        const orDebut = etat.or - primes;
        v = {
          numero: etat.vague,
          statut: 'en cours',
          debut: etat.pas,
          duree: 0,
          marge: niveau.longueurChemin,
          front: null,
          orAvant: orFin,                          // l'or à la fin de la vague d'avant
          depense,                                  // dépensé en gardiens avant cette vague
          orDebut,                                  // ce qu'il reste au lancement
          autre: orDebut - (orFin - depense),       // le reste (une revente, le Coffre au trésor…)
          gagne: { primes: 0, bonus: 0, recolte: 0 },
          orFin: null,
          defense: etat.tours.map((t) => ({ type: t.type, niveau: t.niveau })),
          investi: etat.tours.reduce((n, t) => n + t.investi, 0),
          degatsAvant: { ...etat.degatsPar },
          degats: {},
          battus: 0,
          heros: etat.heros ? etat.heros.niveau : null,
        };
        vagues.push(v);
        depense = 0;
        chutes = [];
      } else if (etat.statut === 'preparation') {
        // pendant la préparation : les achats (une vraie partie rejouée les fait pas à pas)
        for (const ev of etat.evenements) depense += coutDe(ev);
      }
      if (!v || v.orFin !== null) return;
      for (const ev of etat.evenements) {
        if (ev.type === 'mort') {
          v.gagne.primes += ev.prime || 0;
          v.battus++;
          if (ev.d !== undefined) chutes.push(ev.d / niveau.longueurChemin);
        } else if (ev.type === 'recolte') v.gagne.recolte += ev.or || 0;
      }
      for (const e of etat.ennemis) v.marge = Math.min(v.marge, niveau.longueurChemin - e.d);
      if (etat.statut === 'vague') return;
      // la vague vient de finir : tenue (ou gagnée), ou perdue
      v.statut = etat.statut === 'perdu' ? 'perdue' : 'tenue';
      if (etat.statut === 'perdu') v.marge = 0;
      if (etat.statut === 'preparation') v.gagne.bonus = ECONOMIE.finDeVague.base + etat.vague * ECONOMIE.finDeVague.parVague;
      v.duree = (etat.pas - v.debut) / 60;
      v.orFin = etat.or;
      v.front = mediane90(chutes);
      for (const [qui, d] of Object.entries(etat.degatsPar)) {
        const pendant = d - (v.degatsAvant[qui] || 0);
        if (pendant > 0) v.degats[qui] = pendant;
      }
      delete v.degatsAvant;
      orFin = etat.or;
    },
  };
}

// L'or d'un achat (un gardien posé, ou amélioré), d'après son événement
function coutDe(ev) {
  if (ev.type === 'construction') return caracteristiques(ev.quoi, 1).cout;
  if (ev.type === 'amelioration') return caracteristiques(ev.quoi, ev.niveau).cout;
  return 0;
}
