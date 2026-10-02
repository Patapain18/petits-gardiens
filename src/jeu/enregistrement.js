// ─────────────────────────────────────────────────────────────
// LES PARTIES ENREGISTRÉES
// Pour revoir une partie après coup, on ne la filme pas (une vidéo serait
// bien trop lourde) : on note chaque décision du joueur avec le moment où il
// l'a prise, comme on note une partie d'échecs.
//
//   [7830, 'lancerMeteore', 8.21, 11.4]   au pas 7 830 : Météore en (8,21 ; 11,4)
//   [7902, 'envoyerHeros', 12, 7]          au pas 7 902 : le héros part en (12 ; 7)
//
// Le moteur avance toujours par pas de 1/60 s (PAS), son hasard part d'une
// graine, et il calcule pareil sur tous les ordinateurs (calcul.js) : en
// refaisant les mêmes décisions aux mêmes pas, on retrouve EXACTEMENT la même
// partie. Une partie de trente minutes tient en quelques dizaines de Ko.
//
// Pour le vérifier, on note aussi des « contrôles » : à la fin de chaque
// vague, l'or et les monstres battus. Si le rejeu ne les retrouve pas, c'est
// que le jeu a changé depuis la partie (ou qu'il y a un bug) : on le signale.
//
// Ce fichier ne dessine rien et ne parle pas à Internet : le jeu (main.js)
// s'en sert pour noter, la page « Revoir la partie » (revoir.js) et la
// commande npm run parties (scripts/parties.js) pour rejouer.
// ─────────────────────────────────────────────────────────────
import {
  creerPartie, majPartie, construire, ameliorer, vendre, lancerVague, lancerMeteore, lancerGrandFroid, envoyerHeros,
  ondeDeChoc, sauterHeros, PAS,
} from './moteur.js';
import { choisirBenediction } from './benedictions.js';

export const FORMAT = 1; // la façon de noter (si elle change un jour, les vieux enregistrements le diront)

// Les décisions du joueur qu'on note : leur nom → la fonction du moteur qui les fait
export const ACTIONS = {
  construire, ameliorer, vendre, lancerVague, lancerMeteore, lancerGrandFroid, envoyerHeros, ondeDeChoc, sauterHeros, choisirBenediction,
};

// Un enregistrement tout neuf, pour la partie qui commence.
// version : la version du jeu (le commit), pour rejouer avec les mêmes règles.
export function nouvelEnregistrement(etat, version) {
  return { format: FORMAT, version, niveau: etat.niveau.id, graine: etat.graine, debut: Date.now(), actions: [], controles: [] };
}

// Le joueur décide quelque chose : le moteur le fait et, si ça a marché, on le note.
// (enregistrement peut être null : la partie n'est pas enregistrée, on fait juste l'action.)
export function agir(enregistrement, etat, nom, ...args) {
  const fait = ACTIONS[nom](etat, ...args);
  if (fait && enregistrement) enregistrement.actions.push([etat.pas, nom, ...args]);
  return fait;
}

// Un contrôle : où en est la partie (noté à la fin de chaque vague, et à la fin de la partie)
const releve = (etat) => [etat.pas, etat.vague, etat.or, etat.battus];
export function noterControle(enregistrement, etat) {
  enregistrement?.controles.push(releve(etat));
}

// Rejouer une partie : renvoie un « lecteur », qui la fait avancer pas à pas.
// Avant chaque pas, il refait les décisions notées à ce pas-là ; après, il compare les
// contrôles. lecteur.ecarts liste ceux qui ne correspondent pas (vide : la partie revue
// est exactement la vraie).
export function creerLecteur(niveau, enregistrement) {
  const etat = creerPartie(niveau, enregistrement.graine);
  const { actions, controles } = enregistrement;
  const fin = enregistrement.fin ?? Infinity; // une partie abandonnée s'arrête là où le joueur est parti
  let a = 0, c = 0;
  const lecteur = {
    etat,
    ecarts: [], // [{ pas, attendu, trouve }] : attendu et trouve = [pas, vague, or, battus]
    get fini() { return etat.statut === 'perdu' || etat.statut === 'gagne' || etat.pas >= fin; },
    // fait n pas (moins si la partie se termine avant)
    avancer(n = 1) {
      for (let i = 0; i < n && !lecteur.fini; i++) {
        while (a < actions.length && actions[a][0] <= etat.pas) {
          const [, nom, ...args] = actions[a++];
          ACTIONS[nom]?.(etat, ...args);
        }
        majPartie(etat, PAS);
        while (c < controles.length && controles[c][0] <= etat.pas) {
          const attendu = controles[c++], trouve = releve(etat);
          if (attendu.some((v, k) => v !== trouve[k])) lecteur.ecarts.push({ pas: etat.pas, attendu, trouve });
        }
      }
      // la partie revue s'arrête avant la vraie : les contrôles restants ne seront jamais retrouvés
      if (lecteur.fini && c < controles.length) {
        lecteur.ecarts.push({ pas: etat.pas, attendu: controles[c], trouve: releve(etat) });
        c = controles.length;
      }
    },
  };
  return lecteur;
}
