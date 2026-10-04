// ─────────────────────────────────────────────────────────────
// LES CALCULS DE L'ATELIER DE L'ÉQUILIBRAGE (un « worker »)
// Ce fichier tourne à part de la page, dans un Web Worker : les joueurs
// imaginaires peuvent jouer des centaines de parties sans que la page se fige.
// La page lui envoie un message (des chiffres, un niveau, des parties
// enregistrées), il joue tout, et répond avec les relevés vague par vague
// (voir jeu/releve.js).
//
// L'atelier en fait tourner deux à la fois : l'un garde les chiffres du
// fichier (l'AVANT), l'autre prend ceux des curseurs (l'APRÈS).
//
// Les messages :
// - { quoi: 'niveau', chiffres, fiche, parties, graines, souple } : les joueurs
//   imaginaires et les vraies parties d'un niveau ;
// - { quoi: 'banc', chiffres } : le banc d'essai (voir jeu/banc.js) ;
// - { quoi: 'tour', chiffres, fiches, parties, graines, souple } : tous les
//   niveaux, l'un après l'autre (un message par niveau fini).
// souple : rejouer les vraies parties avec le lecteur « souple » (pour des
// chiffres qui ne sont plus ceux de la partie : voir jeu/enregistrement.js).
// ─────────────────────────────────────────────────────────────
import { appliquerChiffres } from './jeu/donnees.js';
import { chargerNiveau } from './jeu/niveau.js';
import { analyser, texteResultat } from './jeu/equilibrage.js';
import { creerLecteur, creerLecteurSouple } from './jeu/enregistrement.js';
import { vaguesTerminees } from './jeu/moteur.js';
import { creerReleve, menaceDeVague } from './jeu/releve.js';
import { mesurerTout } from './jeu/banc.js';

const PAS_MAX = 60 * 60 * 180; // garde-fou : on ne rejoue jamais plus de 3 heures de jeu

// ── Les chiffres, et le banc d'essai qui va avec ──
let chiffresPris = null;
let banc = null;
function prendreChiffres(chiffres) {
  const texte = JSON.stringify(chiffres);
  if (texte === chiffresPris) return;
  appliquerChiffres(chiffres);
  chiffresPris = texte;
  banc = null; // d'autres chiffres : le banc d'essai est à refaire
}
const leBanc = () => (banc ??= mesurerTout());

// La force de la défense contre une vague : les dégâts par seconde de ses gardiens (mesurés au banc
// d'essai) contre chaque sorte de monstre de la vague, comptée selon sa part de la menace. Un Grondin
// ne compte donc pour rien contre une vague de Voltigeurs.
function puissance(defense, parType) {
  const total = Object.values(parType).reduce((a, b) => a + b, 0);
  if (!total) return 0;
  let p = 0;
  for (const g of defense) {
    const mesures = leBanc()[g.type]?.[g.niveau - 1];
    if (!mesures) continue;
    for (const [type, menace] of Object.entries(parType)) p += (mesures[type]?.dps || 0) * (menace / total);
  }
  return p;
}

// Ajoute à chaque vague relevée sa menace, ses points de vie et la force de la défense contre elle
function completer(vagues, niveau) {
  for (const v of vagues) {
    const m = menaceDeVague(niveau.vagues[v.numero - 1]);
    v.menace = m.menace;
    v.pv = m.pv;
    v.puissance = puissance(v.defense, m.parType);
  }
  return vagues;
}

// ── Une vraie partie, rejouée ──
function rejouer(niveau, p, souple) {
  const lecteur = souple ? creerLecteurSouple(niveau, p) : creerLecteur(niveau, p);
  const releve = creerReleve(niveau);
  for (let pas = 0; !lecteur.fini && pas < PAS_MAX; pas++) {
    lecteur.avancer(1);
    releve.regarder(lecteur.etat);
    lecteur.etat.evenements.length = 0;
  }
  const e = lecteur.etat;
  return {
    id: p.id,
    pseudo: p.pseudo || '',
    version: p.version,
    navigateur: p.navigateur || '',
    date: p.date || p.debut || 0,
    statut: p.statut,                         // comment la vraie partie a fini : 'perdu', 'gagne', 'abandon'
    vaguesEnregistrees: p.vagues,             // les vagues tenues, d'après le jeu
    exact: souple ? null : lecteur.ecarts.length === 0, // rejouée à l'identique ? (sinon : d'autres règles à l'époque)
    fin: e.statut,                            // comment le rejeu a fini ('preparation' : plus de décisions, ou quittée)
    vaguesTenues: vaguesTerminees(e),
    plusDeDecisions: Boolean(lecteur.plusDeDecisions),
    abandonnees: lecteur.abandonnees || 0,
    reportees: lecteur.reportees || 0,
    vagues: completer(releve.vagues, niveau),
  };
}

// ── Un niveau : les joueurs imaginaires, puis les vraies parties ──
async function analyserNiveau({ fiche, parties = [], graines = [1, 2, 3], souple = false }, progression = () => {}) {
  const niveau = chargerNiveau(fiche);
  const analyse = await analyser(niveau, { graines, suivre: () => creerReleve(niveau), progression: (k) => progression(k * 0.85) });
  const joueurs = analyse.resultats.map((r) => ({
    id: r.strategie.id,
    nom: r.strategie.nom,
    reference: Boolean(r.strategie.reference),
    naif: Boolean(r.strategie.naif),
    sansVarier: Boolean(r.strategie.sansVarier),
    texte: texteResultat(r),
    victoires: r.victoires,
    total: r.total,
    vaguesTenues: r.vaguesTenues,
    vaguesTypiques: r.vaguesTypiques,
    vagueTypique: r.vagueTypique,
    marge: r.marge,
    orFinal: r.orFinal,
    gardiens: r.gardiens,
    parties: r.parties.map((p, i) => ({ graine: graines[i], gagne: p.gagne, vagueAtteinte: p.vagueAtteinte, marge: p.marge, vagues: completer(p.suivi.vagues, niveau) })),
  }));
  const vraies = [];
  for (const [i, p] of parties.entries()) {
    vraies.push(rejouer(niveau, p, souple));
    progression(0.85 + (0.15 * (i + 1)) / parties.length);
  }
  return {
    niveau: {
      id: niveau.id, nom: niveau.nom, survie: niveau.survie, difficulte: niveau.difficulte, style: niveau.style,
      vagues: niveau.survie ? null : niveau.vagues.length, longueur: niveau.longueurChemin, or: niveau.or, socles: niveau.socles.length,
      gardiens: niveau.gardiens,
    },
    joueurs,
    verdict: analyse.verdict,
    vraies,
    debutant: analyse.debutant, // le débutant qui pose ses gardiens au hasard (voir equilibrage.js)
    banc: leBanc(), // le banc d'essai de ces chiffres (le panneau des curseurs l'affiche)
  };
}

onmessage = async ({ data }) => {
  const { id, quoi } = data;
  try {
    prendreChiffres(data.chiffres);
    if (quoi === 'banc') {
      postMessage({ id, fait: true, resultat: leBanc() });
    } else if (quoi === 'niveau') {
      const resultat = await analyserNiveau(data, (progression) => postMessage({ id, progression }));
      postMessage({ id, fait: true, resultat });
    } else if (quoi === 'tour') {
      const { fiches, parties = {}, graines, souple } = data;
      for (const [i, fiche] of fiches.entries()) {
        const resultat = await analyserNiveau({ fiche, parties: parties[fiche.id] || [], graines, souple },
          (k) => postMessage({ id, progression: (i + k) / fiches.length, niveau: fiche.id }));
        postMessage({ id, niveau: fiche.id, resultat });
      }
      postMessage({ id, fait: true });
    }
  } catch (erreur) {
    postMessage({ id, erreur: erreur.message || String(erreur) });
  }
};
