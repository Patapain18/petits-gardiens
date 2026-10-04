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
// commande npm run parties (scripts/parties.js) pour rejouer, et l'atelier de
// l'équilibrage pour rejouer les vraies parties avec d'autres chiffres.
// ─────────────────────────────────────────────────────────────
import {
  creerPartie, majPartie, construire, ameliorer, vendre, lancerVague, lancerMeteore, lancerGrandFroid, envoyerHeros,
  ondeDeChoc, sauterHeros, prixAmelioration, PAS,
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

// Rejouer les décisions d'un joueur avec d'AUTRES chiffres : c'est le « et si… ? » de l'atelier de
// l'équilibrage (« avec un Gluant moins solide, ce joueur aurait-il tenu la vague 2 ? »).
// La partie ne se déroule plus exactement pareil : une décision prise au pas 2 400 n'est peut-être
// plus possible à ce moment-là (la vague n'est pas finie, il manque un peu d'or…). Ce lecteur
// « souple » refait donc les décisions DANS L'ORDRE, à leur moment :
// - lancer la vague, ou choisir une bénédiction : si ce n'est pas encore possible, il attend, et
//   décale d'autant toutes les décisions qui suivent (le joueur aurait attendu) ;
// - un achat (poser, améliorer) qui manque d'or est mis de côté et refait dès que l'or arrive
//   (pendant « attenteMax » secondes au plus), sans retenir les décisions suivantes ;
// - le reste (un pouvoir, le héros…) se fait à son moment, ou pas du tout.
// lecteur.reportees compte les décisions qui n'ont pas pu se faire à leur moment, et
// lecteur.abandonnees celles qu'on n'a jamais pu refaire. Quand il n'y a plus de
// décisions et que la partie attend la vague suivante, elle s'arrête là (le vrai joueur avait cessé
// de décider : il avait perdu, ou quitté la partie). Ce n'est qu'une indication : avec d'autres
// chiffres, le vrai joueur aurait peut-être fait d'autres choix (avec plus d'or, il aurait acheté
// plus de gardiens ; ce lecteur, lui, ne refait que ses achats).
export function creerLecteurSouple(niveau, enregistrement, attenteMax = 60) {
  const etat = creerPartie(niveau, enregistrement.graine);
  const { actions } = enregistrement;
  const plusTard = []; // les achats mis de côté : { nom, args, jusqua } (jusqua : le dernier pas où on essaie)
  let a = 0, decalage = 0, attente = 0;
  const lecteur = {
    etat,
    reportees: 0,           // les décisions qui n'ont pas pu se faire à leur moment
    abandonnees: 0,         // les décisions qu'on n'a jamais pu refaire
    plusDeDecisions: false, // la partie s'est arrêtée faute de décisions
    get fini() { return etat.statut === 'perdu' || etat.statut === 'gagne' || lecteur.plusDeDecisions; },
    avancer(n = 1) {
      for (let i = 0; i < n && !lecteur.fini; i++) {
        // d'abord les achats mis de côté, dans l'ordre : l'or est peut-être arrivé
        for (let k = 0; k < plusTard.length; k++) {
          const achat = plusTard[k];
          if (refaire(etat, achat.nom, achat.args)) plusTard.splice(k--, 1);
          else if (etat.pas > achat.jusqua) { plusTard.splice(k--, 1); lecteur.abandonnees++; }
        }
        while (a < actions.length && actions[a][0] + decalage <= etat.pas) {
          const [, nom, ...args] = actions[a];
          if (refaire(etat, nom, args)) { a++; attente = 0; continue; }
          if (achatPossibleBientot(etat, nom, args, plusTard)) {
            plusTard.push({ nom, args, jusqua: etat.pas + attenteMax / PAS });
            lecteur.reportees++;
            a++;
            continue;
          }
          // lancer la vague, choisir une bénédiction : on attend que ce soit possible (et les
          // décisions suivantes avec), pas plus de « attenteMax » secondes
          if (patienter(etat, nom) && attente < attenteMax / PAS) {
            if (attente === 0) lecteur.reportees++;
            attente++;
            decalage++;
            break;
          }
          a++;
          attente = 0;
          lecteur.abandonnees++;
        }
        if (a >= actions.length && etat.statut === 'preparation') { lecteur.plusDeDecisions = true; break; }
        majPartie(etat, PAS);
      }
    },
  };
  return lecteur;
}

// Refait une décision. Une bénédiction qui n'est pas proposée cette fois-ci (les offres dépendent de
// la partie) est remplacée par la première proposée : sans choix, la vague suivante ne partirait pas.
function refaire(etat, nom, args) {
  if (nom === 'choisirBenediction' && etat.offre && !etat.offre.includes(args[0])) return choisirBenediction(etat, etat.offre[0]);
  return Boolean(ACTIONS[nom]?.(etat, ...args));
}

// Un achat qui a échoué, mais qui deviendra possible avec un peu plus d'or : poser un gardien sur un
// socle encore libre, ou améliorer un gardien qui peut l'être (même s'il n'est pas encore posé : son
// achat attend peut-être, lui aussi, dans la liste des achats mis de côté)
function achatPossibleBientot(etat, nom, [socle], plusTard) {
  const prevu = plusTard.some((x) => x.nom === 'construire' && x.args[0] === socle);
  if (nom === 'construire') return !etat.tours.some((t) => t.socle === socle) && !prevu;
  if (nom === 'ameliorer') return prevu || etat.tours.some((t) => t.socle === socle && prixAmelioration(t) !== null);
  return false;
}

// Lancer la vague : possible quand celle d'avant sera finie (et la bénédiction choisie). Choisir une
// bénédiction : quand elle sera proposée (à la fin de la vague en cours).
function patienter(etat, nom) {
  if (nom === 'lancerVague') return etat.statut === 'vague' || Boolean(etat.offre);
  if (nom === 'choisirBenediction') return !etat.offre && etat.statut === 'vague';
  return false;
}
