// ─────────────────────────────────────────────────────────────
// L'ATELIER DE L'ÉQUILIBRAGE (la page equilibrage.html, un outil d'atelier)
// En courbes, ce que « npm run equilibrage » raconte en texte, avec les
// vraies parties par-dessus. Pour le niveau choisi, vague après vague :
// - jusqu'où vont les monstres (au plus près du château), pour chaque joueur
//   imaginaire et chaque vraie partie enregistrée ;
// - l'or gagné et dépensé ;
// - la force des monstres contre celle des gardiens ;
// - qui fait les dégâts.
// Les chiffres du jeu (src/jeu/chiffres.json) et ceux du niveau (l'or de
// départ, les vagues) se règlent avec des curseurs. L'atelier rejoue alors
// tout avec les nouveaux chiffres : les joueurs imaginaires, et les vraies
// parties avec les mêmes décisions (« et si… ? »). L'avant reste en pâle.
// Le banc d'essai (jeu/banc.js) compare les gardiens face à chaque monstre.
// « Enregistrer dans le jeu » réécrit chiffres.json et les fiches de niveau
// modifiées (seulement avec npm run dev).
//
// Les parties se jouent dans deux « workers » (atelier-equilibrage-calcul.js) :
// l'un avec les chiffres du fichier (l'AVANT), l'autre avec les tiens (l'APRÈS).
//
// Dans la console : __equilibrage.choisir('monde2-4'), __equilibrage.tourComplet(),
// __equilibrage.planche(), __equilibrage.avantApres(), __equilibrage.remplacer(chiffres),
// __equilibrage.resultats.
// ─────────────────────────────────────────────────────────────
import FICHIER_CHIFFRES from './jeu/chiffres.json' with { type: 'json' };
import { GARDIENS, MONSTRES, HEROS, POUVOIRS, NIVEAU_MAX } from './jeu/donnees.js';
import { champDe, problemesChiffres } from './jeu/format-chiffres.js';
import { problemesFiche, DIFFICULTES } from './jeu/niveau.js';
import { MONDES } from './jeu/campagne.js';
import { creerGraphique, dessiner, graduations, graduationsLog, TEINTES } from './graphiques.js';
import { compterVisite } from './compteur.js';

compterVisite('equilibrage'); // une visite de plus (voir compteur.js)

const SERVEUR = 'https://petits-gardiens-classement.vercel.app/api/parties';
const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const IDS = Object.keys(FICHES).map((chemin) => chemin.slice('./niveaux/'.length, -'.json'.length));
const CAMPAGNE = MONDES.flatMap((m) => m.niveaux).filter((id) => IDS.includes(id));
const ORDRE = [...CAMPAGNE, ...IDS.filter((id) => !CAMPAGNE.includes(id)).sort((a, b) => (a === 'essai') - (b === 'essai'))];

// ── Les couleurs ──
// Validées par le calcul (la méthode de graphiques : deux couleurs voisines restent distinctes, même
// pour un daltonien, sur le fond sombre de l'atelier). Les sources de dégâts gardent toujours la même
// couleur et le même ordre dans les piles : Braise orange, Givrine bleue, Bourrasque vert d'eau,
// Étincelle jaune, Prisme rose, Grondin vert, héros violet, Météore rouge.
const BLEU = '#3987e5', ORANGE = '#d95926', AQUA = '#199e70', ROUGE = '#e66767';
const ORANGE_PALE = 'rgba(217, 89, 38, 0.5)'; // les défaites des vraies parties jouées avec d'anciennes règles
const SOURCES = [
  ['braise', '#d95926'], ['givrine', '#3987e5'], ['bourrasque', '#199e70'], ['etincelle', '#c98500'],
  ['prisme', '#d55181'], ['grondin', '#008300'], ['heros', '#9085e9'], ['meteore', '#e66767'],
];
const NOM_SOURCE = (s) => (s === 'heros' ? 'Héros' : s === 'meteore' ? 'Météore' : GARDIENS[s]?.nom || s);
const ZONE_SERREE = 'rgba(208, 59, 59, 0.16)';
const Y_MAX = 20; // « au plus près du château » : au-delà de 20 cases, rien à craindre (le graphique s'arrête là)

const $ = (s) => document.querySelector(s);
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}
const nombre = (v, chiffres = 0) => (v ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: chiffres, minimumFractionDigits: chiffres });
const cases = (v) => `${nombre(v, 1)} case${v >= 2 ? 's' : ''}`;
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;
const vraiesParties = (n) => `${n} vraie${n > 1 ? 's' : ''} partie${n > 1 ? 's' : ''}`;
const dateCourte = (t) => (t ? new Date(t).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '?');
const nomNiveau = (id) => FICHES[`./niveaux/${id}.json`]?.nom || id;

// ═════════════════════════════════════════════════════════════
// LES CHIFFRES : ceux du fichier (l'AVANT), et les tiens (l'APRÈS)
// ═════════════════════════════════════════════════════════════
let AVANT = structuredClone(FICHIER_CHIFFRES);
let chiffres = structuredClone(FICHIER_CHIFFRES);
const fichesAvant = Object.fromEntries(IDS.map((id) => [id, structuredClone(FICHES[`./niveaux/${id}.json`])]));
const fichesApres = {}; // les fiches de niveau que tu as modifiées
const ficheApres = (id) => fichesApres[id] || fichesAvant[id];
const memes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const chiffresModifies = () => !memes(chiffres, AVANT);
const niveauModifie = (id) => Boolean(fichesApres[id]) && !memes(fichesApres[id], fichesAvant[id]);
const aChange = (id) => chiffresModifies() || niveauModifie(id);

// ── Ce qu'on regarde (lu dans l'adresse, pour pouvoir y revenir) ──
const params = new URLSearchParams(location.search);
const choix = {
  niveau: IDS.includes(params.get('niveau')) ? params.get('niveau') : 'monde2-4',
  detail: params.get('detail') || 'melange-bien', // le joueur détaillé : un joueur imaginaire, ou « vraie:<id> »
  graines: 3,
  avant: true,       // montrer l'avant (en pâle) quand quelque chose a changé
  vraies: true,      // les vraies parties
  anciennes: false,  // les vraies parties jouées avec d'anciennes règles
  reglage: params.get('reglage') || 'niveau',
  onglet: 1,         // le niveau de gardien (ou de héros) affiché dans le panneau
};

// ═════════════════════════════════════════════════════════════
// LES CALCULS (dans les workers)
// Une seule demande à la fois par worker : une nouvelle demande arrête l'ancienne (le worker est
// refait). Les résultats sont gardés, rangés par niveau et par « version » (les chiffres et la fiche).
// ═════════════════════════════════════════════════════════════
class Calcul {
  constructor() { this.worker = null; this.numero = 0; this.attente = null; }
  demander(message, surProgres) {
    if (this.attente) {
      this.worker.terminate();
      this.worker = null;
      this.attente.rejeter(Object.assign(new Error('remplacée'), { remplacee: true }));
    }
    this.worker ??= new Worker(new URL('./atelier-equilibrage-calcul.js', import.meta.url), { type: 'module' });
    const id = ++this.numero;
    return new Promise((resoudre, rejeter) => {
      this.attente = { rejeter };
      this.worker.onmessage = ({ data }) => {
        if (data.id !== id) return;
        if (data.erreur) { this.attente = null; rejeter(new Error(data.erreur)); } else if (data.fait) { this.attente = null; resoudre(data.resultat); } else surProgres?.(data);
      };
      this.worker.onerror = (e) => { this.attente = null; rejeter(new Error(e.message || 'le calcul a planté')); };
      this.worker.postMessage({ ...message, id });
    });
  }
}
const calculs = { avant: new Calcul(), apres: new Calcul(), tourAvant: new Calcul(), tourApres: new Calcul() };
const resultats = { avant: {}, apres: {} }; // [niveau] → { version, ...resultat }
const versionDe = (id, cote) => (cote === 'avant' ? `${choix.graines}` : `${choix.graines}|${JSON.stringify(chiffres)}|${JSON.stringify(ficheApres(id))}`);
const resultatDe = (id, cote) => {
  const r = resultats[cote][id];
  return r && r.version === versionDe(id, cote) ? r : null;
};

// ── Les vraies parties (lues sur le serveur du classement, une fois) ──
let listeDesParties = null;    // toutes les parties enregistrées, en bref (sans leurs décisions)
const enregistrements = {};    // [id] → la partie complète
let serveurMuet = false;
async function chargerListe() {
  if (listeDesParties || serveurMuet) return listeDesParties || [];
  try {
    const reponse = await fetch(`${SERVEUR}?combien=1000`);
    if (!reponse.ok) throw new Error(`le serveur répond ${reponse.status}`);
    listeDesParties = (await reponse.json()).parties;
  } catch {
    serveurMuet = true;
    listeDesParties = [];
  }
  return listeDesParties;
}
async function partiesDu(id) {
  const liste = (await chargerListe()).filter((p) => p.niveau === id);
  const manquantes = liste.filter((p) => !enregistrements[p.id]);
  // six téléchargements à la fois
  for (let i = 0; i < manquantes.length; i += 6) {
    await Promise.all(manquantes.slice(i, i + 6).map(async (resume) => {
      try {
        const p = await (await fetch(`${SERVEUR}?id=${encodeURIComponent(resume.id)}`)).json();
        enregistrements[resume.id] = { ...p, id: resume.id };
      } catch { /* une partie illisible : tant pis */ }
    }));
  }
  // de la plus ancienne à la plus récente : on voit un joueur progresser
  return liste.map((p) => enregistrements[p.id]).filter(Boolean).sort((a, b) => (a.debut || 0) - (b.debut || 0));
}

function dire(texte, erreur = false) {
  const p = $('#etat');
  p.textContent = texte;
  p.classList.toggle('erreur', erreur);
}

// Calcule le niveau choisi : l'avant (une fois), puis l'après (si quelque chose a changé)
let attenteCalcul = null;
async function calculer() {
  const id = choix.niveau;
  const vraies = choix.vraies ? await partiesDu(id) : [];
  majBandeComptes();
  const message = (cote) => ({
    quoi: 'niveau', chiffres: cote === 'avant' ? AVANT : chiffres, fiche: cote === 'avant' ? fichesAvant[id] : ficheApres(id),
    parties: vraies, graines: Array.from({ length: choix.graines }, (_, i) => i + 1), souple: cote === 'apres',
  });
  try {
    $('#graphiques').classList.add('calcul');
    if (!resultatDe(id, 'avant')) {
      dire(`Les joueurs imaginaires jouent « ${nomNiveau(id)} »…`);
      const r = await calculs.avant.demander(message('avant'), (d) => dire(`Les joueurs imaginaires jouent « ${nomNiveau(id)} »… ${Math.round(d.progression * 100)} %`));
      resultats.avant[id] = { version: versionDe(id, 'avant'), ...r };
      if (id === choix.niveau) toutDessiner();
    }
    if (aChange(id) && !resultatDe(id, 'apres')) {
      dire('Ils rejouent avec tes chiffres…');
      const r = await calculs.apres.demander(message('apres'), (d) => dire(`Ils rejouent avec tes chiffres… ${Math.round(d.progression * 100)} %`));
      resultats.apres[id] = { version: versionDe(id, 'apres'), ...r };
    }
    majPastille(id);
    if (id !== choix.niveau) return;
    toutDessiner();
    const r = resultatActuel();
    dire(`${pluriel(r.joueurs.reduce((n, j) => n + j.total, 0), 'partie')} de joueurs imaginaires${r.vraies.length ? ` et ${vraiesParties(r.vraies.length)}` : ''}${aChange(id) ? ', avec tes chiffres' : ''}.${serveurMuet ? ' (Le serveur des parties ne répond pas : pas de vraies parties.)' : ''}`);
  } catch (e) {
    if (!e.remplacee) dire(`Le calcul a échoué : ${e.message}`, true);
  } finally {
    $('#graphiques').classList.remove('calcul');
  }
}
function recalculerBientot() {
  clearTimeout(attenteCalcul);
  attenteCalcul = setTimeout(calculer, 350);
}

// Le résultat à montrer (l'après s'il y en a un), et celui d'avant (pour le pâle)
const resultatActuel = () => (aChange(choix.niveau) && resultatDe(choix.niveau, 'apres')) || resultatDe(choix.niveau, 'avant');
const resultatAvant = () => (aChange(choix.niveau) && resultatDe(choix.niveau, 'apres') ? resultatDe(choix.niveau, 'avant') : null);

// ═════════════════════════════════════════════════════════════
// LES SÉRIES : ce qu'on tire des relevés pour dessiner
// ═════════════════════════════════════════════════════════════
// Une vraie partie est-elle montrée ? (une partie jouée avec d'autres règles ne se rejoue plus pareil :
// sa courbe raconterait une autre partie que la vraie)
const montree = (v, avant) => choix.anciennes || (avant ?? v).exact !== false;
// La course d'un joueur imaginaire : vague par vague, le plus près du château parmi ses parties qui
// ont joué cette vague (0 : une partie a perdu là), et combien de ses parties ont perdu à chaque vague
function courseDuJoueur(j) {
  const n = Math.max(...j.parties.map((p) => p.vagues.length));
  const valeurs = [], pertes = [];
  for (let v = 1; v <= n; v++) {
    const ici = j.parties.map((p) => p.vagues[v - 1]).filter(Boolean);
    valeurs.push(Math.min(...ici.map((x) => x.marge)));
    pertes.push(ici.filter((x) => x.statut === 'perdue').length);
  }
  return { valeurs, pertes };
}
const courseVraie = (v) => ({ valeurs: v.vagues.map((x) => x.marge), pertes: v.vagues.map((x) => (x.statut === 'perdue' ? 1 : 0)) });
const plafond = (valeurs) => valeurs.map((m) => Math.min(Y_MAX, m));

// Les vagues du joueur détaillé (la partie de la graine 1, pour un joueur imaginaire)
function detailDans(r) {
  if (!r) return null;
  if (choix.detail.startsWith('vraie:')) {
    const v = r.vraies.find((x) => `vraie:${x.id}` === choix.detail);
    if (v) return { nom: `la partie de ${v.pseudo || 'quelqu’un'} (${dateCourte(v.date)})`, vagues: v.vagues, vraie: v };
  }
  const j = r.joueurs.find((x) => x.id === choix.detail) || r.joueurs.find((x) => x.reference);
  return { nom: j.nom, vagues: j.parties[0].vagues, joueur: j };
}

// ═════════════════════════════════════════════════════════════
// LES QUATRE GRAPHIQUES
// ═════════════════════════════════════════════════════════════
const graphiques = {};
function legende(id, morceaux) {
  $(`#${id} .legende`).replaceChildren(...morceaux.map(([texte, couleur, forme = 'ligne', pale = false]) => {
    const li = element('li');
    const cle = element('span', `cle ${forme}${pale ? ' pale' : ''}`);
    cle.style.setProperty('--couleur', couleur);
    li.append(cle, document.createTextNode(texte));
    return li;
  }));
}

function toutDessiner() {
  const r = resultatActuel();
  if (!r) return;
  const avant = choix.avant ? resultatAvant() : null;
  const detail = detailDans(r), detailAvant = detailDans(avant);
  dessinerCourse(r, avant);
  dessinerOr(detail, detailAvant);
  dessinerForces(detail, detailAvant);
  dessinerDegats(detail);
  dessinerVerdict(r, resultatDe(choix.niveau, 'avant'));
  dessinerVraies(r, resultatDe(choix.niveau, 'avant'));
  dessinerTableau(detail);
  majInfo(r, detail);
  dessinerBanc();
}

function majInfo(r, detail) {
  const n = r.niveau;
  $('#titre-niveau').textContent = n.nom;
  $('#info-niveau').textContent = n.survie
    ? `Mode survie, ${n.or} pièces au départ, ${n.socles} socles. Détails : ${detail.nom}.`
    : `${n.vagues} vagues, ${n.or} pièces au départ, ${n.socles} socles, difficulté visée : ${DIFFICULTES[n.difficulte]}. Détails : ${detail.nom}.`;
}

// 1. Jusqu'où vont les monstres
function dessinerCourse(r, avant) {
  const joueurs = r.joueurs, vraies = choix.vraies ? r.vraies.filter((v) => montree(v, resultatDe(choix.niveau, 'avant')?.vraies.find((x) => x.id === v.id))) : [];
  const courses = joueurs.map((j) => ({ j, ...courseDuJoueur(j) }));
  const coursesVraies = vraies.map((v) => ({ v, ...courseVraie(v) }));
  const refAvant = avant?.joueurs.find((j) => j.reference);
  const vagues = Math.max(r.niveau.vagues || 0, ...courses.map((c) => c.valeurs.length), ...coursesVraies.map((c) => c.valeurs.length), refAvant ? courseDuJoueur(refAvant).valeurs.length : 0);
  // le joueur imaginaire mis en avant : celui qu'on détaille (le bon joueur si on détaille une vraie partie)
  const choisi = courses.some((c) => c.j.id === choix.detail) ? choix.detail : courses.find((c) => c.j.reference).j.id;
  const lignes = [];
  for (const c of courses) {
    const enAvant = c.j.id === choisi;
    lignes.push({ nom: c.j.nom, couleur: enAvant ? BLEU : TEINTES.eteint, valeurs: plafond(c.valeurs), epaisseur: enAvant ? 2.5 : 1.5, fond: !enAvant, opacite: enAvant ? 1 : 0.7 });
  }
  if (refAvant) lignes.push({ nom: 'avant', couleur: BLEU, valeurs: plafond(courseDuJoueur(refAvant).valeurs), opacite: 0.35, epaisseur: 2 });
  for (const c of coursesVraies) {
    const choisie = choix.detail === `vraie:${c.v.id}`;
    lignes.push({ nom: c.v.pseudo, couleur: ORANGE, valeurs: plafond(c.valeurs), epaisseur: choisie ? 2.5 : 1.5, opacite: choisie ? 1 : 0.75, points: choisie });
  }
  // les croix : là où des parties ont perdu (×n si plusieurs au même endroit)
  const marques = [];
  const pertesVraies = new Map();
  for (const c of coursesVraies) c.pertes.forEach((p, i) => { if (p) pertesVraies.set(i + 1, (pertesVraies.get(i + 1) || 0) + 1); });
  for (const [vague, n] of pertesVraies) marques.push({ vague, valeur: 0, symbole: 'croix', couleur: ORANGE, texte: n > 1 ? `×${n}` : '' });
  // les vraies parties jouées avec d'anciennes règles : leur courbe n'est plus la leur, mais là où
  // elles ont perdu, c'est enregistré (une croix pâle)
  const anciennes = choix.vraies && !choix.anciennes ? r.vraies.filter((v) => !montree(v, resultatDe(choix.niveau, 'avant')?.vraies.find((x) => x.id === v.id))) : [];
  const pertesAnciennes = new Map();
  for (const v of anciennes) if (v.statut === 'perdu') pertesAnciennes.set(v.vaguesEnregistrees + 1, (pertesAnciennes.get(v.vaguesEnregistrees + 1) || 0) + 1);
  for (const [vague, n] of pertesAnciennes) marques.push({ vague, valeur: 0.6, symbole: 'croix', couleur: ORANGE_PALE, texte: n > 1 ? `×${n}` : '' });
  const ref = courses.find((c) => c.j.id === choisi);
  ref.pertes.forEach((p, i) => { if (p && !pertesVraies.has(i + 1)) marques.push({ vague: i + 1, valeur: 0, symbole: 'croix', couleur: BLEU }); });
  graphiques.course.maj({
    vagues,
    y: { min: 0, max: Y_MAX, graduations: [0, 5, 10, 15, 20], format: (v) => (v === Y_MAX ? '20+' : String(v)) },
    zones: [{ de: 0, a: 1.5, couleur: ZONE_SERREE, texte: 'très serré' }],
    lignes,
    marques,
    bulle: (v) => {
      const lignesBulle = [];
      for (const c of [ref, ...courses.filter((x) => x !== ref)]) {
        const m = c.valeurs[v - 1];
        if (m === undefined) continue;
        lignesBulle.push({ couleur: c === ref ? BLEU : TEINTES.eteint, valeur: c.pertes[v - 1] ? `perd ${c.pertes[v - 1]}×` : cases(m), texte: c.j.nom });
      }
      if (refAvant) {
        const m = courseDuJoueur(refAvant).valeurs[v - 1];
        if (m !== undefined) lignesBulle.push({ couleur: BLEU, valeur: cases(m), texte: 'le bon joueur, avant tes chiffres' });
      }
      const nAnciennes = pertesAnciennes.get(v);
      if (nAnciennes) lignesBulle.push({ couleur: ORANGE_PALE, valeur: `${nAnciennes} perdue${nAnciennes > 1 ? 's' : ''} ici`, texte: 'vraies parties jouées avec d’anciennes règles' });
      const ici = coursesVraies.filter((c) => c.valeurs[v - 1] !== undefined);
      if (ici.length) {
        const perdues = ici.filter((c) => c.pertes[v - 1]).length, tenues = ici.length - perdues;
        const pres = Math.min(...ici.filter((c) => !c.pertes[v - 1]).map((c) => c.valeurs[v - 1]));
        lignesBulle.push({ couleur: ORANGE, valeur: `${tenues} tenue${tenues > 1 ? 's' : ''}, ${perdues} perdue${perdues > 1 ? 's' : ''}`, texte: tenues ? `vraies parties (au plus près : ${cases(pres)})` : 'vraies parties' });
      }
      return lignesBulle;
    },
  });
  const morceaux = [[ref.j.reference ? 'Le bon joueur' : `Le joueur choisi (${ref.j.nom})`, BLEU], ['Les autres joueurs imaginaires', TEINTES.eteint]];
  if (coursesVraies.length) morceaux.push([`Les vraies parties (${coursesVraies.length})`, ORANGE]);
  if (anciennes.length) morceaux.push([`Leurs défaites, avec d’anciennes règles (${anciennes.length} parties)`, ORANGE_PALE, 'croix']);
  if (refAvant) morceaux.push(['Le bon joueur, avant tes chiffres', BLEU, 'ligne', true]);
  legende('fig-course', morceaux);
}

// 2. L'or
function dessinerOr(detail, detailAvant) {
  const vagues = detail.vagues;
  const gagne = vagues.map((v) => (v.orFin === null ? null : v.gagne.primes + v.gagne.bonus + v.gagne.recolte));
  const depense = vagues.map((v) => v.depense);
  const reserve = vagues.map((v) => v.orDebut);
  const reserveAvant = detailAvant?.vagues.map((v) => v.orDebut);
  const max = Math.max(1, ...gagne.filter(Boolean), ...depense, ...reserve, ...(reserveAvant || []));
  const lignes = [{ nom: 'réserve', couleur: AQUA, valeurs: reserve, points: vagues.length <= 16 }];
  if (reserveAvant) lignes.push({ nom: 'réserve avant', couleur: AQUA, valeurs: reserveAvant, opacite: 0.35 });
  graphiques.or.maj({
    vagues: Math.max(vagues.length, reserveAvant?.length || 0),
    y: { min: 0, max: graduations(max).at(-1), graduations: graduations(max), format: (v) => nombre(v) },
    barres: { empile: false, series: [{ nom: 'gagné', couleur: BLEU, valeurs: gagne }, { nom: 'dépensé', couleur: ORANGE, valeurs: depense }] },
    lignes,
    bulle: (n) => {
      const v = vagues[n - 1];
      if (!v) return [];
      const lignesBulle = [
        { couleur: AQUA, valeur: `${nombre(v.orDebut)} pièces`, texte: 'en réserve au lancement (pas dépensées)' },
        { couleur: ORANGE, forme: 'barre', valeur: `${nombre(v.depense)} pièces`, texte: 'dépensées avant la vague' },
      ];
      if (v.orFin !== null) {
        const detailGagne = [v.gagne.primes && `${nombre(v.gagne.primes)} des monstres`, v.gagne.bonus && `${nombre(v.gagne.bonus)} de bonus`, v.gagne.recolte && `${nombre(v.gagne.recolte)} des Pépites`].filter(Boolean).join(', ');
        lignesBulle.push({ couleur: BLEU, forme: 'barre', valeur: `${nombre(gagne[n - 1])} pièces`, texte: `gagnées${detailGagne ? ` (${detailGagne})` : ''}` });
      }
      if (reserveAvant?.[n - 1] !== undefined) lignesBulle.push({ couleur: AQUA, valeur: `${nombre(reserveAvant[n - 1])} pièces`, texte: 'en réserve, avant tes chiffres' });
      return lignesBulle;
    },
  });
  const morceaux = [['Gagné pendant la vague', BLEU, 'barre'], ['Dépensé avant la vague', ORANGE, 'barre'], ['En réserve au lancement', AQUA]];
  if (reserveAvant) morceaux.push(['En réserve, avant tes chiffres', AQUA, 'ligne', true]);
  legende('fig-or', morceaux);
}

// 3. La force des monstres contre celle des gardiens (les deux ramenées à ×1 à la première vague où
// elles existent toutes les deux : elles n'ont pas la même unité)
function indices(vagues) {
  const base = vagues.find((v) => v.menace > 0 && v.puissance > 0);
  if (!base) return { monstres: vagues.map(() => null), gardiens: vagues.map(() => null), base: null };
  return {
    monstres: vagues.map((v) => (v.menace > 0 ? v.menace / base.menace : null)),
    gardiens: vagues.map((v) => (v.puissance > 0 ? v.puissance / base.puissance : null)),
    base,
  };
}
function dessinerForces(detail, detailAvant) {
  const actuel = indices(detail.vagues), avant = detailAvant ? indices(detailAvant.vagues) : null;
  const tout = [...actuel.monstres, ...actuel.gardiens, ...(avant ? [...avant.monstres, ...avant.gardiens] : [])].filter((x) => x > 0);
  // l'échelle : de la graduation « ronde » (1, 2 ou 5 × une puissance de 10) juste en dessous du plus
  // petit (avec un peu de marge), à celle juste au-dessus du plus grand
  const rond = (v, versLeBas) => {
    const p = 10 ** Math.floor(Math.log10(v));
    const pas = [1, 2, 5, 10].map((k) => k * p);
    return versLeBas ? [...pas].reverse().find((x) => x <= v * 1.0001) : pas.find((x) => x >= v * 0.9999);
  };
  const bas = rond(Math.min(1, ...tout) * 0.8, true), haut = rond(Math.max(2, ...tout), false);
  const lignes = [
    { nom: 'monstres', couleur: ROUGE, valeurs: actuel.monstres, points: detail.vagues.length <= 16 },
    { nom: 'gardiens', couleur: BLEU, valeurs: actuel.gardiens, points: detail.vagues.length <= 16 },
  ];
  if (avant) {
    lignes.push({ nom: 'monstres avant', couleur: ROUGE, valeurs: avant.monstres, opacite: 0.35 });
    lignes.push({ nom: 'gardiens avant', couleur: BLEU, valeurs: avant.gardiens, opacite: 0.35 });
  }
  graphiques.forces.maj({
    vagues: Math.max(detail.vagues.length, detailAvant?.vagues.length || 0),
    y: { min: bas, max: haut, log: true, graduations: graduationsLog(bas, haut), format: (v) => `×${nombre(v, v < 1 ? 1 : 0)}` },
    lignes,
    bulle: (n) => {
      const v = detail.vagues[n - 1];
      if (!v) return [];
      const l = [];
      if (actuel.monstres[n - 1]) l.push({ couleur: ROUGE, valeur: `×${nombre(actuel.monstres[n - 1], 1)}`, texte: `monstres (menace ${nombre(v.menace)} : leurs PV × leur vitesse)` });
      l.push({ couleur: BLEU, valeur: actuel.gardiens[n - 1] ? `×${nombre(actuel.gardiens[n - 1], 1)}` : '0', texte: `gardiens (${nombre(v.puissance)} dégâts/s contre ces monstres, au banc d’essai)` });
      if (avant?.monstres[n - 1]) l.push({ couleur: ROUGE, valeur: `×${nombre(avant.monstres[n - 1], 1)}`, texte: 'monstres, avant tes chiffres' });
      if (avant?.gardiens[n - 1]) l.push({ couleur: BLEU, valeur: `×${nombre(avant.gardiens[n - 1], 1)}`, texte: 'gardiens, avant tes chiffres' });
      return l;
    },
  });
  const morceaux = [['La force des monstres', ROUGE], ['La force des gardiens', BLEU]];
  if (avant) morceaux.push(['Avant tes chiffres', TEINTES.eteint, 'ligne', true]);
  legende('fig-forces', morceaux);
}

// 4. Qui fait les dégâts
function dessinerDegats(detail) {
  const vagues = detail.vagues;
  const presentes = SOURCES.filter(([s]) => vagues.some((v) => v.degats[s] > 0));
  const parts = (v) => {
    const total = Object.values(v.degats).reduce((a, b) => a + b, 0);
    return total ? Object.fromEntries(presentes.map(([s]) => [s, (100 * (v.degats[s] || 0)) / total])) : null;
  };
  graphiques.degats.maj({
    vagues: vagues.length,
    y: { min: 0, max: 100, graduations: [0, 25, 50, 75, 100], format: (v) => `${v} %` },
    barres: { empile: true, series: presentes.map(([s, couleur]) => ({ nom: s, couleur, valeurs: vagues.map((v) => parts(v)?.[s] || null) })) },
    bulle: (n) => {
      const v = vagues[n - 1];
      if (!v) return [];
      const p = parts(v);
      if (!p) return [{ couleur: TEINTES.eteint, valeur: '—', texte: 'aucun dégât' }];
      const total = Object.values(v.degats).reduce((a, b) => a + b, 0);
      return [...presentes].reverse().filter(([s]) => p[s] > 0).map(([s, couleur]) => ({ couleur, forme: 'barre', valeur: `${nombre(p[s])} %`, texte: `${NOM_SOURCE(s)} (${nombre(v.degats[s])} dégâts)` }))
        .concat([{ couleur: 'transparent', valeur: nombre(total), texte: 'dégâts en tout' }]);
    },
  });
  legende('fig-degats', presentes.map(([s, couleur]) => [NOM_SOURCE(s), couleur, 'barre']));
}

// Le tableau des chiffres des courbes (la version « texte » des graphiques, pour le joueur détaillé)
function dessinerTableau(detail) {
  const table = element('table', 'resultats');
  const tete = element('tr');
  for (const t of ['Vague', 'Résultat', 'Au plus près', 'Là où ils tombent', 'Or au lancement', 'Dépensé', 'Gagné', 'Menace', 'Gardiens (dégâts/s)', 'Qui fait les dégâts']) tete.append(element('th', '', t));
  table.append(tete);
  for (const v of detail.vagues) {
    const total = Object.values(v.degats).reduce((a, b) => a + b, 0);
    const qui = Object.entries(v.degats).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([s, d]) => `${NOM_SOURCE(s)} ${nombre((100 * d) / total)} %`).join(', ');
    const ligne = element('tr');
    ligne.append(
      element('td', '', String(v.numero)),
      element('td', v.statut === 'perdue' ? 'issue-mal' : '', { perdue: 'perdue', tenue: 'tenue', 'en cours': 'pas finie' }[v.statut]),
      element('td', v.marge < 1.5 ? 'attention' : '', cases(v.marge)),
      element('td', '', v.front === null ? '—' : `${nombre(v.front * 100)} % du chemin`),
      element('td', '', nombre(v.orDebut)),
      element('td', '', nombre(v.depense)),
      element('td', '', v.orFin === null ? '—' : nombre(v.gagne.primes + v.gagne.bonus + v.gagne.recolte)),
      element('td', '', nombre(v.menace)),
      element('td', '', nombre(v.puissance)),
      element('td', '', qui || '—'),
    );
    table.append(ligne);
  }
  $('#tableau-courbes').replaceChildren(element('p', 'aide', `Les chiffres des courbes, pour ${detail.nom}.`), table);
}

// ═════════════════════════════════════════════════════════════
// LE VERDICT, ET LES VRAIES PARTIES
// ═════════════════════════════════════════════════════════════
function dessinerVerdict(r, avant) {
  const v = r.verdict, change = r !== avant && avant;
  const morceaux = [];
  const titre = element('p', 'verdict-titre');
  const ecart = v.objectif?.ecart ?? 0;
  titre.append(element('b', ecart === 0 ? 'issue-bien' : Math.abs(ecart) === 1 ? 'issue-moyen' : 'issue-mal', v.titre), document.createTextNode(` ${v.explication}`));
  if (change && avant.verdict.titre !== v.titre) titre.append(element('span', 'avant', ` (avant : ${avant.verdict.titre})`));
  morceaux.push(titre);
  if (v.objectif) morceaux.push(element('p', `objectif ${ecart === 0 ? 'issue-bien' : 'issue-moyen'}`, v.objectif.texte));
  if (r.debutant) morceaux.push(element('p', 'debutant', texteDebutant(r.debutant, change ? avant.debutant : null)));
  if (v.conseils.length) {
    const ul = element('ul', 'conseils');
    for (const c of v.conseils) ul.append(element('li', '', c));
    morceaux.push(ul);
  }
  // le tableau des joueurs imaginaires
  const table = element('table', 'resultats joueurs');
  const tete = element('tr');
  for (const t of ['Joueur imaginaire', 'Résultat', 'Au plus près du château', 'Or en trop à la fin']) tete.append(element('th', '', t));
  table.append(tete);
  for (const j of r.joueurs) {
    const a = change ? avant.joueurs.find((x) => x.id === j.id) : null;
    const ligne = element('tr', j.id === choix.detail ? 'choisi' : '');
    ligne.tabIndex = 0;
    ligne.title = 'Voir ses courbes';
    const nom = element('td', j.reference ? 'reference' : '', j.nom);
    const res = element('td', j.victoires === j.total ? 'issue-bien' : j.victoires ? 'issue-moyen' : 'issue-mal', j.texte);
    if (a && a.texte !== j.texte) res.append(element('span', 'avant', ` (avant : ${a.texte})`));
    const marge = element('td', '', j.victoires ? cases(j.marge) : '—');
    if (a && a.victoires && Math.abs(a.marge - j.marge) > 0.05) marge.append(element('span', 'avant', ` (avant : ${nombre(a.marge, 1)})`));
    ligne.append(nom, res, marge, element('td', '', nombre(j.orFinal)));
    const choisir = () => { choix.detail = j.id; majChoixDetail(); toutDessiner(); majAdresse(); };
    ligne.addEventListener('click', choisir);
    ligne.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } });
    table.append(ligne);
  }
  morceaux.push(table);
  $('#verdict').replaceChildren(...morceaux);
}

// Le débutant, en une phrase (voir pardonDuDebutant dans jeu/equilibrage.js)
const NOM_PIEGE = { pepite: 'une Pépite', bourrasque: 'une Bourrasque' };
function texteDebutant(d, avant = null) {
  const nom = GARDIENS[d.gardien].nom;
  const pieges = d.pieges.map((p) => {
    const a = avant?.pieges.find((x) => x.type === p.type);
    return ` ; s’il achète d’abord ${NOM_PIEGE[p.type]} : ${p.part} %${a && a.part !== p.part ? ` (avant : ${a.part} %)` : ''}`;
  }).join('');
  const changeHasard = avant && avant.auHasard !== d.auHasard ? ` (avant : ${avant.auHasard} %)` : '';
  return `Le débutant (qui pose des ${nom} au hasard, avec tout son or) tient la vague 1 dans ${d.auHasard} % des cas${changeHasard}${pieges}.`;
}

function texteVraie(v) {
  const texte = v.fin === 'gagne' ? 'gagne le niveau' : v.fin === 'perdu' ? `perd à la vague ${v.vaguesTenues + 1}`
    : v.plusDeDecisions ? `tient ${pluriel(v.vaguesTenues, 'vague')} (puis plus de décisions)` : `quittée à la vague ${v.vaguesTenues + 1}`;
  // des décisions qui n'étaient plus possibles à leur moment : le vrai joueur aurait sans doute fait autrement
  const n = v.reportees || 0;
  return n ? `${texte} · ${n} décision${n > 1 ? 's' : ''} pas possible${n > 1 ? 's' : ''} à son moment` : texte;
}
function dessinerVraies(r, avant) {
  const zone = $('#vraies');
  if (!choix.vraies) { zone.replaceChildren(); return; }
  const vraiesAvant = avant?.vraies || [];
  const liste = r.vraies;
  if (!liste.length) {
    zone.replaceChildren(element('h3', '', 'Les vraies parties'), element('p', 'aide', serveurMuet ? 'Le serveur des parties ne répond pas.' : 'Personne n’a encore joué ce niveau (ou n’a partagé sa partie).'));
    return;
  }
  const change = aChange(choix.niveau) && r !== avant;
  // ce qui s'est vraiment passé : c'est enregistré (le rejeu, lui, dépend des règles d'aujourd'hui)
  const perdues = new Map();
  for (const v of liste) if (v.statut === 'perdu') perdues.set(v.vaguesEnregistrees + 1, (perdues.get(v.vaguesEnregistrees + 1) || 0) + 1);
  const gagnees = liste.filter((v) => v.statut === 'gagne').length;
  const mur = [...perdues.entries()].sort((a, b) => b[1] - a[1])[0];
  const resume = r.niveau.survie
    ? `${pluriel(liste.length, 'partie')} : ${liste.map((v) => v.vaguesEnregistrees).sort((a, b) => b - a).join(', ')} vagues tenues.`
    : `${pluriel(liste.length, 'partie')} : ${pluriel(gagnees, 'gagnée')}, ${pluriel(liste.length - gagnees, 'perdue')}${mur && mur[1] >= 2 ? ` (dont ${mur[1]} à la vague ${mur[0]})` : ''}.`;
  const table = element('table', 'resultats');
  const tete = element('tr');
  for (const t of ['', 'Joueur', 'Quand', 'Ce qui s’est passé', change ? 'Et si… (mêmes décisions, tes chiffres)' : 'Rejeu']) tete.append(element('th', '', t));
  table.append(tete);
  liste.forEach((v, i) => {
    const a = vraiesAvant.find((x) => x.id === v.id) || v;
    const ligne = element('tr', choix.detail === `vraie:${v.id}` ? 'choisi' : '');
    ligne.tabIndex = 0;
    ligne.title = 'Voir ses courbes';
    const reel = { perdu: `perd à la vague ${v.vaguesEnregistrees + 1}`, gagne: 'gagne le niveau', abandon: `quittée à la vague ${v.vaguesEnregistrees + 1}` }[v.statut] || '?';
    const rejeu = change ? texteVraie(v) : a.exact ? 'exact' : `d’autres règles (version ${v.version})`;
    const classe = change ? (v.fin === 'gagne' || v.vaguesTenues > a.vaguesTenues ? 'issue-bien' : v.vaguesTenues < a.vaguesTenues ? 'issue-mal' : '') : a.exact ? '' : 'issue-moyen';
    ligne.append(element('td', '', String(i + 1)), element('td', '', v.pseudo || 'anonyme'), element('td', '', dateCourte(v.date)),
      element('td', v.statut === 'gagne' ? 'issue-bien' : v.statut === 'perdu' ? 'issue-mal' : '', r.niveau.survie && v.statut !== 'gagne' ? `${pluriel(v.vaguesEnregistrees, 'vague')} tenue${v.vaguesEnregistrees > 1 ? 's' : ''}` : reel),
      element('td', classe, rejeu));
    const choisir = () => { choix.detail = `vraie:${v.id}`; majChoixDetail(); toutDessiner(); majAdresse(); };
    ligne.addEventListener('click', choisir);
    ligne.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choisir(); } });
    table.append(ligne);
  });
  const anciennes = vraiesAvant.filter((v) => v.exact === false).length;
  const notes = [element('h3', '', 'Les vraies parties'), element('p', '', resume)];
  if (anciennes) notes.push(element('p', 'aide', `${pluriel(anciennes, 'partie')} jouée${anciennes > 1 ? 's' : ''} avec d’anciennes règles ne se rejoue${anciennes > 1 ? 'nt' : ''} plus pareil : ${anciennes > 1 ? 'leurs courbes ne sont' : 'sa courbe n’est'} pas dessinée${anciennes > 1 ? 's' : ''} (case « anciennes règles » pour les voir quand même).`));
  if (change) notes.push(element('p', 'aide', 'Et si… : la partie rejouée avec tes chiffres, avec les mêmes décisions, chacune dès qu’elle redevient possible. Ce n’est qu’une indication : avec d’autres chiffres, le joueur aurait peut-être fait d’autres choix (avec plus d’or, il aurait acheté plus de gardiens).'));
  zone.replaceChildren(...notes, table);
}

// ═════════════════════════════════════════════════════════════
// LA BANDE DES NIVEAUX, EN HAUT
// ═════════════════════════════════════════════════════════════
const pastilles = {}; // [niveau] → { verdict, ecart } (rempli par les calculs)
function dessinerBande() {
  const groupes = MONDES.map((m) => [`Monde ${m.numero} · ${m.nom.replace('L’époque ', '')}`, m.niveaux.filter((id) => IDS.includes(id))]);
  const autres = ORDRE.filter((id) => !CAMPAGNE.includes(id));
  if (autres.length) groupes.push(['Défis et essais', autres]);
  $('#bande-niveaux').replaceChildren(...groupes.map(([titre, ids]) => {
    const groupe = element('div', 'famille');
    groupe.append(element('span', 'nom-famille', titre));
    const boutons = element('div', 'vignettes');
    for (const id of ids) {
      const b = element('button', 'carte-niveau');
      b.type = 'button';
      b.dataset.niveau = id;
      b.setAttribute('aria-pressed', String(id === choix.niveau));
      const nom = element('span', 'nom', nomNiveau(id));
      const infos = element('span', 'infos');
      b.append(element('span', 'pastille'), nom, infos);
      b.addEventListener('click', () => choisirNiveau(id));
      boutons.append(b);
    }
    groupe.append(boutons);
    return groupe;
  }));
  majBandeComptes();
}
function majBandeComptes() {
  for (const b of document.querySelectorAll('.carte-niveau')) {
    const id = b.dataset.niveau;
    const n = (listeDesParties || []).filter((p) => p.niveau === id).length;
    const fiche = fichesAvant[id];
    const p = pastilles[id];
    b.querySelector('.infos').textContent = `${fiche.survie ? 'survie' : DIFFICULTES[fiche.difficulte || 'normal']}${n ? ` · ${pluriel(n, 'partie')}` : ''}`;
    const pastille = b.querySelector('.pastille');
    pastille.className = `pastille ${p ? (p.ecart === 0 ? 'bien' : Math.abs(p.ecart) === 1 ? 'attention' : 'trop') : ''}`;
    pastille.title = p ? p.texte : '';
    b.classList.toggle('modifiee', niveauModifie(id));
  }
}
async function choisirNiveau(id) {
  choix.niveau = id;
  choix.detail = 'melange-bien';
  document.querySelectorAll('.carte-niveau').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.niveau === id)));
  majAdresse();
  majChoixDetail();
  if (choix.reglage === 'niveau') dessinerReglages();
  if (resultatActuel()) toutDessiner();
  await calculer();
  majChoixDetail();
}

// ═════════════════════════════════════════════════════════════
// LES CHOIX (au-dessus des graphiques)
// ═════════════════════════════════════════════════════════════
function majChoixDetail() {
  const select = $('#choix-detail');
  if (!select) return;
  const r = resultatActuel();
  select.replaceChildren();
  const groupeBots = element('optgroup');
  groupeBots.label = 'Les joueurs imaginaires';
  for (const j of r?.joueurs || [{ id: 'melange-bien', nom: 'Mélange bien placé' }]) groupeBots.append(Object.assign(element('option', '', j.nom), { value: j.id }));
  select.append(groupeBots);
  if (r?.vraies.length) {
    const groupe = element('optgroup');
    groupe.label = 'Les vraies parties';
    r.vraies.forEach((v, i) => groupe.append(Object.assign(element('option', '', `${i + 1}. ${v.pseudo || 'anonyme'}, ${dateCourte(v.date)}`), { value: `vraie:${v.id}` })));
    select.append(groupe);
  }
  select.value = choix.detail;
  // (un joueur qui n'est pas dans ce niveau : on revient au bon joueur, une fois les résultats arrivés)
  if (select.value !== choix.detail && r) { choix.detail = 'melange-bien'; select.value = 'melange-bien'; }
}
function caseACocher(texte, coche, quandChange, titre = '') {
  const label = element('label', 'choix-case');
  const input = element('input');
  input.type = 'checkbox';
  input.checked = coche;
  input.addEventListener('change', () => quandChange(input.checked));
  label.append(input, document.createTextNode(texte));
  if (titre) label.title = titre;
  return label;
}
function dessinerChoix() {
  const detail = element('label', 'choix-liste');
  detail.append(element('span', '', 'Le joueur détaillé (or, forces, dégâts)'));
  const select = element('select');
  select.id = 'choix-detail';
  select.addEventListener('change', () => { choix.detail = select.value; toutDessiner(); majAdresse(); });
  detail.append(select);
  const graines = element('label', 'choix-liste');
  graines.append(element('span', '', 'Parties par joueur imaginaire'));
  const g = element('select');
  for (const n of [3, 6]) g.append(Object.assign(element('option', '', String(n)), { value: String(n) }));
  g.value = String(choix.graines);
  g.addEventListener('change', () => { choix.graines = Number(g.value); calculer(); });
  graines.append(g);
  $('#choix').replaceChildren(
    detail, graines,
    caseACocher('Montrer l’avant (en pâle)', choix.avant, (oui) => { choix.avant = oui; toutDessiner(); }),
    caseACocher('Les vraies parties', choix.vraies, (oui) => { choix.vraies = oui; calculer(); }),
    caseACocher('Anciennes règles', choix.anciennes, (oui) => { choix.anciennes = oui; toutDessiner(); }, 'Les vraies parties jouées avec d’anciennes règles : elles ne se rejouent plus pareil'),
  );
  majChoixDetail();
}

function majAdresse() {
  const p = new URLSearchParams({ niveau: choix.niveau });
  if (choix.detail !== 'melange-bien') p.set('detail', choix.detail);
  if (choix.reglage !== 'niveau') p.set('reglage', choix.reglage);
  history.replaceState(null, '', `?${p}`);
}

// ═════════════════════════════════════════════════════════════
// LES CURSEURS
// ═════════════════════════════════════════════════════════════
// Une valeur à une place du fichier des chiffres (chemin : ['gardiens', 'braise', 'niveaux', 0, 'degats'])
const lire = (objet, chemin) => chemin.reduce((o, k) => o?.[k], objet);
function ecrire(objet, chemin, valeur) {
  const parent = lire(objet, chemin.slice(0, -1));
  parent[chemin.at(-1)] = valeur;
}
const arrondi = (v, pas) => Math.round(v / pas) * pas;
const propre = (v, pas) => +arrondi(v, pas).toFixed(Math.max(0, -Math.floor(Math.log10(pas)) + 1));

// Une ligne de réglage : le nom, un curseur, la valeur exacte (modifiable au clavier), et l'avant
// s'il a changé. champ : { nom, unite, min, max, pas, entier, aide } ; avant : la valeur du fichier.
function ligneReglage(champ, valeur, avant, quandChange) {
  const ligne = element('div', 'reglage reglage-chiffre');
  const nom = element('span', 'nom', champ.nom);
  if (champ.unite) nom.append(element('small', '', ` (${champ.unite})`));
  nom.title = champ.aide || '';
  // le curseur va du tiers au triple de la valeur du fichier (dans les limites permises)
  const ref = Math.abs(avant) > 0 ? Math.abs(avant) : champ.max / 10;
  const bas = Math.max(champ.min, arrondi(ref / 3, champ.pas)), haut = Math.min(champ.max, Math.max(arrondi(ref * 3, champ.pas), bas + champ.pas * 4));
  const curseur = element('input');
  Object.assign(curseur, { type: 'range', min: String(Math.min(bas, valeur)), max: String(Math.max(haut, valeur)), step: String(champ.pas), value: String(valeur) });
  curseur.setAttribute('aria-label', champ.nom);
  const saisie = element('input');
  Object.assign(saisie, { type: 'number', min: String(champ.min), max: String(champ.max), step: String(champ.pas), value: String(valeur) });
  saisie.setAttribute('aria-label', `${champ.nom} (valeur exacte)`);
  const ancien = element('span', 'ancien');
  const maj = (v) => {
    ligne.classList.toggle('modifie', v !== avant);
    ancien.textContent = v !== avant ? `avant : ${avant.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}` : '';
  };
  const changer = (brut, source) => {
    let v = Number(brut);
    if (!Number.isFinite(v)) return;
    v = Math.max(champ.min, Math.min(champ.max, champ.entier ? Math.round(v) : propre(v, champ.pas)));
    if (source !== curseur) { curseur.min = String(Math.min(Number(curseur.min), v)); curseur.max = String(Math.max(Number(curseur.max), v)); curseur.value = String(v); }
    if (source !== saisie) saisie.value = String(v);
    maj(v);
    quandChange(v);
  };
  curseur.addEventListener('input', () => changer(curseur.value, curseur));
  saisie.addEventListener('change', () => changer(saisie.value, saisie));
  ligne.append(nom, curseur, saisie, ancien);
  if (champ.aide) ligne.append(element('span', 'aide-champ', champ.aide));
  maj(valeur);
  return ligne;
}

// Les réglages d'un objet du fichier des chiffres (tous ses chiffres, dans l'ordre du fichier)
function reglagesDe(chemin, sauf = []) {
  const morceaux = [];
  const parcourir = (objet, ici) => {
    for (const [cle, v] of Object.entries(objet)) {
      if (sauf.includes(cle)) continue;
      if (v && typeof v === 'object') { parcourir(v, [...ici, cle]); continue; }
      const champ = champDe([...ici, cle]);
      if (!champ) continue;
      morceaux.push(ligneReglage(champ, v, lire(AVANT, [...ici, cle]), (nouvelle) => { ecrire(chiffres, [...ici, cle], nouvelle); apresChangement(); }));
    }
  };
  parcourir(lire(chiffres, chemin), chemin);
  return morceaux;
}
function groupe(titre, morceaux, aide = '') {
  const g = element('fieldset', 'groupe');
  g.append(element('legend', '', titre));
  if (aide) g.append(element('p', 'aide', aide));
  g.append(...morceaux);
  return g;
}
function onglets(nombreOnglets, actif, quandChange, nomOnglet = (i) => `Niveau ${i}`) {
  const zone = element('div', 'onglets');
  zone.setAttribute('role', 'tablist');
  for (let i = 1; i <= nombreOnglets; i++) {
    const b = element('button', '', nomOnglet(i));
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(i === actif));
    b.addEventListener('click', () => quandChange(i));
    zone.append(b);
  }
  return zone;
}

function apresChangement() {
  majReglagesModifies();
  majBandeComptes();
  recalculerBientot();
  if (choix.reglage.startsWith('gardien:') || choix.reglage.startsWith('monstre:')) dessinerBanc();
}

function dessinerReglages() {
  const zone = $('#reglages');
  const [famille, quoi] = choix.reglage.split(':');
  const morceaux = [];
  if (famille === 'gardien') {
    const g = GARDIENS[quoi];
    $('#titre-reglages').textContent = `Les chiffres : ${g.nom}`;
    morceaux.push(element('p', 'aide', g.role));
    morceaux.push(onglets(NIVEAU_MAX, choix.onglet, (i) => { choix.onglet = i; dessinerReglages(); }, (i) => (i === 1 ? g.nom : g.niveaux[i - 1].nom)));
    morceaux.push(groupe(choix.onglet === 1 ? 'Niveau 1 (l’achat)' : `Niveau ${choix.onglet} (l’amélioration)`, reglagesDe(['gardiens', quoi, 'niveaux', choix.onglet - 1])));
    if (chiffres.gardiens[quoi].projectile) morceaux.push(groupe('Commun aux trois niveaux', reglagesDe(['gardiens', quoi, 'projectile'])));
  } else if (famille === 'monstre') {
    const m = MONSTRES[quoi];
    $('#titre-reglages').textContent = `Les chiffres : ${m.nom}`;
    morceaux.push(element('p', 'aide', m.description));
    morceaux.push(groupe(m.nom, reglagesDe(['monstres', quoi])));
  } else if (famille === 'heros') {
    $('#titre-reglages').textContent = `Les chiffres : ${HEROS.nom}`;
    morceaux.push(groupe('Le héros (dans l’arène)', reglagesDe(['heros'], ['niveaux', 'pouvoirs'])));
    const n = choix.onglet > chiffres.heros.niveaux.length ? 1 : choix.onglet;
    morceaux.push(groupe('Ses niveaux', [onglets(chiffres.heros.niveaux.length, n, (i) => { choix.onglet = i; dessinerReglages(); }, (i) => String(i)), ...reglagesDe(['heros', 'niveaux', n - 1])]));
    for (const [nom, p] of Object.entries(HEROS.pouvoirs)) morceaux.push(groupe(p.nom, reglagesDe(['heros', 'pouvoirs', nom]), p.texte));
  } else if (famille === 'pouvoirs') {
    $('#titre-reglages').textContent = 'Les chiffres : les pouvoirs du château';
    morceaux.push(groupe(POUVOIRS.meteore.nom, reglagesDe(['pouvoirs', 'meteore'])));
    morceaux.push(groupe(POUVOIRS.froid.nom, reglagesDe(['pouvoirs', 'froid'])));
  } else if (famille === 'economie') {
    $('#titre-reglages').textContent = 'Les chiffres : l’économie et la survie';
    morceaux.push(groupe('L’économie', reglagesDe(['economie'])));
    morceaux.push(groupe('Le mode survie (l’arène)', reglagesDe(['survie']), 'Après les vagues écrites dans la fiche de l’arène, les vagues sont fabriquées : chacune un peu plus dure que la précédente.'));
  } else {
    morceaux.push(...reglagesDuNiveau());
  }
  zone.replaceChildren(...morceaux);
  dessinerBanc();
}

// Les réglages du niveau choisi : son or de départ, l'arrivée des gardiens, et ses vagues
function reglagesDuNiveau() {
  const id = choix.niveau;
  const fiche = ficheApres(id), avant = fichesAvant[id];
  $('#titre-reglages').textContent = `Les chiffres : ${fiche.nom}`;
  const modifier = (changement) => {
    const nouvelle = structuredClone(ficheApres(id));
    changement(nouvelle);
    const problemes = problemesFiche(nouvelle);
    if (problemes.length) { dire(`Pas possible : ${problemes[0]}`, true); return false; }
    fichesApres[id] = nouvelle;
    apresChangement();
    return true;
  };
  const morceaux = [];
  morceaux.push(groupe('Le départ', [ligneReglage({ nom: 'Or de départ', unite: 'pièces', min: 0, max: 5000, pas: 10, entier: true, aide: 'L’or pour poser les premiers gardiens, avant la vague 1.' }, fiche.or, avant.or, (v) => modifier((f) => { f.or = v; }))]));
  // l'arrivée des gardiens (la vague à partir de laquelle on peut le poser)
  const arrivees = Object.entries(fiche.gardiens || {}).map(([type, vague]) => ligneReglage(
    { nom: GARDIENS[type].nom, unite: 'vague', min: 1, max: fiche.vagues.length, pas: 1, entier: true, aide: 'La vague à partir de laquelle on peut poser ce gardien.' },
    vague, avant.gardiens?.[type] ?? vague, (v) => modifier((f) => { f.gardiens[type] = v; }),
  ));
  if (arrivees.length) morceaux.push(groupe('L’arrivée des gardiens', arrivees, 'Chaque gardien peut être posé à partir de cette vague.'));
  // les vagues : pour chaque groupe de monstres, combien, et à quel écart
  const vagues = fiche.vagues.map((vague, i) => groupe(`Vague ${i + 1}`, vague.flatMap((g, j) => {
    const a = avant.vagues[i]?.[j];
    const nomM = MONSTRES[g.type].nom;
    return [
      ligneReglage({ nom: `${nomM} : combien`, unite: 'monstres', min: 1, max: 200, pas: 1, entier: true, aide: `Le nombre de ${nomM} de ce groupe.` }, g.nombre, a?.type === g.type ? a.nombre : g.nombre, (v) => modifier((f) => { f.vagues[i][j].nombre = v; })),
      ligneReglage({ nom: `${nomM} : écart`, unite: 's', min: 0.05, max: 20, pas: 0.05, aide: 'Le temps entre deux monstres du groupe (petit : une foule serrée).' }, g.ecart, a?.type === g.type ? a.ecart : g.ecart, (v) => modifier((f) => { f.vagues[i][j].ecart = v; })),
    ];
  })));
  morceaux.push(element('h3', '', fiche.survie ? 'Les vagues écrites (les suivantes sont fabriquées)' : 'Les vagues'), ...vagues);
  morceaux.push(element('p', 'aide', 'Pour dessiner le chemin, déplacer les socles ou ajouter des monstres : l’éditeur de niveaux.'));
  return morceaux;
}

// Les lignes modifiées (et la pastille dorée du menu des réglages)
function majReglagesModifies() {
  const select = $('#choix-reglage');
  for (const option of select.options) {
    const [famille, quoi] = option.value.split(':');
    const objet = famille === 'gardien' ? ['gardiens', quoi] : famille === 'monstre' ? ['monstres', quoi] : famille === 'heros' ? ['heros'] : famille === 'pouvoirs' ? ['pouvoirs'] : famille === 'economie' ? null : 'niveau';
    let modifie;
    if (objet === 'niveau') modifie = niveauModifie(choix.niveau);
    else if (objet === null) modifie = !memes(chiffres.economie, AVANT.economie) || !memes(chiffres.survie, AVANT.survie);
    else modifie = !memes(lire(chiffres, objet), lire(AVANT, objet));
    option.textContent = option.textContent.replace(/ ●$/, '') + (modifie ? ' ●' : '');
  }
}
function dessinerChoixReglage() {
  const select = $('#choix-reglage');
  const ajout = (parent, valeur, texte) => parent.append(Object.assign(element('option', '', texte), { value: valeur }));
  select.replaceChildren();
  ajout(select, 'niveau', 'Ce niveau (or de départ, vagues)');
  const g = element('optgroup'); g.label = 'Les gardiens';
  for (const [type, f] of Object.entries(GARDIENS)) ajout(g, `gardien:${type}`, f.nom);
  const m = element('optgroup'); m.label = 'Les monstres';
  for (const [type, f] of Object.entries(MONSTRES)) ajout(m, `monstre:${type}`, f.nom);
  const a = element('optgroup'); a.label = 'L’arène';
  ajout(a, 'heros', HEROS.nom);
  ajout(a, 'pouvoirs', 'Les pouvoirs du château');
  ajout(a, 'economie', 'L’économie et la survie');
  select.append(g, m, a);
  select.value = choix.reglage;
  if (select.value !== choix.reglage) { choix.reglage = 'niveau'; select.value = 'niveau'; }
  select.addEventListener('change', () => { choix.reglage = select.value; choix.onglet = 1; dessinerReglages(); majAdresse(); });
  majReglagesModifies();
}

// ═════════════════════════════════════════════════════════════
// LE BANC D'ESSAI (sous les curseurs, pour un gardien ou un monstre)
// ═════════════════════════════════════════════════════════════
const MONDE_DES_MONSTRES = { gluant: 1, filou: 1, cuirasse: 1, voltigeur: 2, gigogne: 2, colosse: 2, carapace: 3, taupe: 3, dragon: 3 };
const MONDE_DES_GARDIENS = { braise: 1, givrine: 1, grondin: 1, etincelle: 2, bourrasque: 2, pepite: 3, prisme: 3 };
const coutDans = (lesChiffres, type, niveau) => lesChiffres.gardiens[type].niveaux.slice(0, niveau).reduce((n, x) => n + x.cout, 0);
// La teinte d'une case du banc : plus le gardien enlève de vie, plus la case est bleue
const teinteBanc = (part) => `rgba(57, 135, 229, ${Math.min(0.55, Math.max(0, part) * 0.5).toFixed(3)})`;

const introBanc = (quoi) => element('p', 'aide', `Le gardien (${GARDIENS[quoi].nom}), seul sur un bout de chemin droit, face à une file de 10 monstres (1 seul pour un chef) : la part de la vie qu’il enlève à chacun en passant. 100 % : il le bat à lui seul. Entre parenthèses : avant tes chiffres.`);

function dessinerBanc() {
  const zone = $('#banc');
  const [famille, quoi] = choix.reglage.split(':');
  const banc = (aChange(choix.niveau) ? resultatDe(choix.niveau, 'apres')?.banc : null) || resultatDe(choix.niveau, 'avant')?.banc;
  const bancAvant = aChange(choix.niveau) ? resultatDe(choix.niveau, 'avant')?.banc : null;
  if (famille !== 'gardien' && famille !== 'monstre') { zone.replaceChildren(); return; }
  if (!banc) { zone.replaceChildren(element('p', 'aide', 'Le banc d’essai arrive avec le premier calcul…')); return; }
  const monstres = Object.keys(MONSTRES);
  const titre = element('h3', '', 'Sur le banc d’essai');
  const pc = (x) => `${nombre(x * 100)} %`;
  if (famille === 'gardien' && quoi === 'pepite') {
    const lignes = chiffres.gardiens.pepite.niveaux.map((n, i) => element('p', '', `Niveau ${i + 1} : ${coutDans(chiffres, 'pepite', i + 1)} pièces en tout, ${n.recolte} pièces par vague : remboursée en ${nombre(coutDans(chiffres, 'pepite', i + 1) / n.recolte, 1)} vagues.`));
    zone.replaceChildren(titre, element('p', 'aide', 'La Pépite ne tire pas : on la juge à ce qu’elle rapporte.'), ...lignes);
    return;
  }
  const table = element('table', 'banc');
  if (famille === 'gardien') {
    const tete = element('tr');
    tete.append(element('th', '', 'Face à…'));
    for (let n = 1; n <= NIVEAU_MAX; n++) tete.append(element('th', '', `niv. ${n} (${coutDans(chiffres, quoi, n)} p.)`));
    table.append(tete);
    for (const m of monstres) {
      const ligne = element('tr');
      ligne.append(element('td', '', MONSTRES[m].nom + (MONSTRES[m].boss ? ' (seul)' : '')));
      for (let n = 1; n <= NIVEAU_MAX; n++) {
        const x = banc[quoi][n - 1][m], a = bancAvant?.[quoi][n - 1][m];
        const td = element('td', '', pc(x.part));
        td.style.background = teinteBanc(x.part);
        td.title = `${nombre(x.parMonstre)} dégâts à chaque ${MONSTRES[m].nom} qui passe, ${nombre(x.dps, 1)} dégâts/s${x.retient > 1.05 ? `, le retient ${nombre(x.retient, 2)} fois plus longtemps` : ''}`;
        if (a && Math.abs(a.part - x.part) > 0.005) td.append(element('span', 'avant', ` (${pc(a.part)})`));
        ligne.append(td);
      }
      table.append(ligne);
    }
    // améliorer, ou acheter un autre gardien ? Les dégâts par pièce face aux monstres de son monde
    // (et des mondes d'avant), d'un niveau à l'autre
    const lesMonstres = monstres.filter((m) => !MONSTRES[m].boss && MONDE_DES_MONSTRES[m] <= MONDE_DES_GARDIENS[quoi]);
    const parPiece = (n) => lesMonstres.reduce((s, m) => s + banc[quoi][n - 1][m].parMonstre, 0) / lesMonstres.length;
    // les gardiens qui retiennent les monstres sous le feu (le gel, le vent) : de combien
    if ([1, 2, 3].some((n) => banc[quoi][n - 1].gluant.retient > 1.05)) {
      const retient = element('tr', 'rentabilite');
      retient.append(element('td', '', 'Retient les Gluants…'));
      for (let n = 1; n <= NIVEAU_MAX; n++) {
        const x = banc[quoi][n - 1].gluant.retient, a = bancAvant?.[quoi][n - 1].gluant.retient;
        const td = element('td', '', `× ${nombre(x, 2)}`);
        td.title = 'Le temps qu’un Gluant reste à portée, comparé au temps qu’il y passerait sans être gêné (2 : deux fois plus longtemps sous le feu de ce gardien… et de ses voisins).';
        if (a && Math.abs(a - x) > 0.005) td.append(element('span', 'avant', ` (× ${nombre(a, 2)})`));
        retient.append(td);
      }
      table.append(retient);
    }
    // améliorer ou acheter : seulement pour un gardien qui compte sur ses dégâts (pas la Bourrasque)
    const ligne = element('tr', 'rentabilite');
    if (chiffres.gardiens[quoi].niveaux[0].souffle) { zone.replaceChildren(titre, introBanc(quoi), table); return; }
    ligne.append(element('td', '', 'Améliorer rapporte…'));
    for (let n = 1; n <= NIVEAU_MAX; n++) {
      if (n === 1) { ligne.append(element('td', '', `${nombre((100 * parPiece(1)) / coutDans(chiffres, quoi, 1), 1)} dégâts / 100 p.`)); continue; }
      const gain = (parPiece(n) - parPiece(n - 1)) / chiffres.gardiens[quoi].niveaux[n - 1].cout;
      const nouveau = parPiece(1) / chiffres.gardiens[quoi].niveaux[0].cout;
      const rapport = gain / nouveau;
      const etat = rapport < 0.6 || rapport > 1.6 ? 'trop' : rapport < 0.8 || rapport > 1.25 ? 'attention' : 'bien';
      const td = element('td', etat, `${etat === 'bien' ? '✓' : '⚠'} ${nombre(rapport, 2)} × un nouveau`);
      td.title = 'Les dégâts gagnés par pièce de l’amélioration, comparés à ceux d’un nouveau gardien de niveau 1 (face aux monstres de son monde et des mondes d’avant, sauf les chefs). Vers 1 : améliorer vaut acheter.';
      ligne.append(td);
    }
    table.append(ligne);
    zone.replaceChildren(titre, introBanc(quoi), table);
  } else {
    const tete = element('tr');
    tete.append(element('th', '', 'Gardien'));
    for (let n = 1; n <= NIVEAU_MAX; n++) tete.append(element('th', '', `niv. ${n}`));
    table.append(tete);
    for (const type of Object.keys(GARDIENS)) {
      if (!banc[type][0][quoi]) continue; // (la Pépite ne tire pas)
      const ligne = element('tr');
      ligne.append(element('td', '', GARDIENS[type].nom));
      for (let n = 1; n <= NIVEAU_MAX; n++) {
        const x = banc[type][n - 1][quoi], a = bancAvant?.[type][n - 1][quoi];
        const td = element('td', '', pc(x.part));
        td.style.background = teinteBanc(x.part);
        td.title = `${nombre(x.parMonstre)} dégâts, ${nombre(x.dps, 1)} dégâts/s`;
        if (a && Math.abs(a.part - x.part) > 0.005) td.append(element('span', 'avant', ` (${pc(a.part)})`));
        ligne.append(td);
      }
      table.append(ligne);
    }
    const c = chiffres.monstres[quoi];
    const infos = element('p', 'aide', `Menace : ${nombre(c.pv * c.vitesse)} (ses PV × sa vitesse). Il rapporte ${nombre(c.prime)} pièces, soit ${nombre(c.pv / Math.max(1, c.prime), 1)} PV à battre par pièce gagnée.`);
    zone.replaceChildren(titre, element('p', 'aide', `La part de la vie de ce monstre (${MONSTRES[quoi].nom}) qu’enlève un gardien seul pendant qu’il passe devant lui (${MONSTRES[quoi].boss ? 'seul, c’est un chef' : 'dans une file de 10'}). Entre parenthèses : avant tes chiffres.`), table, infos);
  }
}

// ═════════════════════════════════════════════════════════════
// LES ACTIONS
// ═════════════════════════════════════════════════════════════
function dessinerActions() {
  const actions = [
    ['Annuler (ceci)', () => {
      const [famille, quoi] = choix.reglage.split(':');
      if (famille === 'gardien') chiffres.gardiens[quoi] = structuredClone(AVANT.gardiens[quoi]);
      else if (famille === 'monstre') chiffres.monstres[quoi] = structuredClone(AVANT.monstres[quoi]);
      else if (famille === 'heros') chiffres.heros = structuredClone(AVANT.heros);
      else if (famille === 'pouvoirs') chiffres.pouvoirs = structuredClone(AVANT.pouvoirs);
      else if (famille === 'economie') { chiffres.economie = structuredClone(AVANT.economie); chiffres.survie = structuredClone(AVANT.survie); } else delete fichesApres[choix.niveau];
      dessinerReglages();
      apresChangement();
      dire('Revenu comme dans le fichier.');
    }],
    ['Tout annuler', () => {
      chiffres = structuredClone(AVANT);
      for (const id of Object.keys(fichesApres)) delete fichesApres[id];
      dessinerReglages();
      apresChangement();
      dire('Tous les chiffres sont revenus comme dans les fichiers.');
    }],
    ['Tour complet', () => tourComplet()],
    ['Planche', () => planche()],
    ['Avant / après', () => avantApres()],
  ];
  if (import.meta.env.DEV) actions.splice(2, 0, ['Enregistrer dans le jeu', enregistrer]);
  $('#actions').replaceChildren(...actions.map(([texte, action]) => {
    const b = element('button', texte === 'Enregistrer dans le jeu' ? 'principal' : '', texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }));
  if (!import.meta.env.DEV) $('#actions').append(element('p', 'note', 'En ligne, l’atelier ne peut pas enregistrer dans le projet : lance le jeu avec npm run dev.'));
}

async function enregistrer() {
  const problemes = problemesChiffres(chiffres, AVANT);
  if (problemes.length) { dire(`Pas enregistré : ${problemes[0]}`, true); return; }
  const fichiers = [];
  try {
    if (chiffresModifies()) {
      const reponse = await fetch('/__chiffres', { method: 'POST', body: JSON.stringify(chiffres) });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
      fichiers.push(donnees.fichier);
    }
    for (const id of Object.keys(fichesApres).filter(niveauModifie)) {
      const reponse = await fetch(`/__niveaux/${id}`, { method: 'POST', body: JSON.stringify(fichesApres[id]) });
      const donnees = await reponse.json();
      if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
      fichiers.push(donnees.fichier);
    }
    if (!fichiers.length) { dire('Rien à enregistrer : les chiffres sont ceux des fichiers.'); return; }
    // les fichiers, c'est maintenant ça : l'avant devient l'après
    AVANT = structuredClone(chiffres);
    for (const id of Object.keys(fichesApres)) { fichesAvant[id] = structuredClone(fichesApres[id]); delete fichesApres[id]; }
    for (const id of Object.keys(resultats.apres)) { resultats.avant[id] = { ...resultats.apres[id], version: versionDe(id, 'avant') }; }
    resultats.apres = {};
    dessinerReglages();
    apresChangement();
    dire(`Enregistré dans ${fichiers.join(', ')}. (Le jeu se recharge avec ces chiffres.)`);
  } catch (e) {
    dire(`Pas enregistré : ${e.message}`, true);
  }
}

// ── Le tour complet : tous les niveaux, avant et après ──
async function tourComplet() {
  const graines = Array.from({ length: choix.graines }, (_, i) => i + 1);
  dire('Tour complet : les vraies parties…');
  const parties = {};
  for (const id of ORDRE) parties[id] = choix.vraies ? await partiesDu(id) : [];
  majBandeComptes();
  const lancer = async (cote) => {
    const calcul = cote === 'avant' ? calculs.tourAvant : calculs.tourApres;
    const aFaire = ORDRE.filter((id) => (cote === 'avant' || aChange(id)) && !resultatDe(id, cote));
    if (!aFaire.length) return;
    await calcul.demander({
      quoi: 'tour', chiffres: cote === 'avant' ? AVANT : chiffres, graines, parties, souple: cote === 'apres',
      fiches: aFaire.map((id) => (cote === 'avant' ? fichesAvant[id] : ficheApres(id))),
    }, (d) => {
      if (d.resultat) { resultats[cote][d.niveau] = { version: versionDe(d.niveau, cote), ...d.resultat }; majPastille(d.niveau); }
      if (d.progression !== undefined) dire(`Tour complet ${cote === 'avant' ? '(avant)' : '(avec tes chiffres)'} : ${nomNiveau(d.niveau)}… ${Math.round(d.progression * 100)} %`);
    });
  };
  try {
    await lancer('avant');
    if (chiffresModifies() || Object.keys(fichesApres).some(niveauModifie)) await lancer('apres');
  } catch (e) {
    if (!e.remplacee) dire(`Le tour complet a échoué : ${e.message}`, true);
    return null;
  }
  const lignes = afficherTour();
  dire(`Tour complet fini : ${ORDRE.length} niveaux.`);
  if (resultatActuel()) toutDessiner();
  return lignes;
}

function majPastille(id) {
  const r = (aChange(id) && resultatDe(id, 'apres')) || resultatDe(id, 'avant');
  if (!r) return;
  pastilles[id] = { ecart: r.verdict.objectif?.ecart ?? 0, texte: `${r.verdict.titre}${r.verdict.objectif ? ` — ${r.verdict.objectif.texte}` : ''}` };
  majBandeComptes();
}

// Une vraie partie se rejoue-t-elle à l'identique avec les règles du fichier ? (Pour un résultat
// « après », rejoué avec le lecteur souple, on regarde ce qu'en disait l'avant.)
function exacteAvant(r, v) {
  if (v.exact !== null) return v.exact;
  const a = resultatDe(r.niveau.id, 'avant')?.vraies.find((x) => x.id === v.id);
  return a ? a.exact : true;
}

// Le résumé d'un niveau pour le tableau du tour
function resumeTour(r) {
  const ref = r.joueurs.find((j) => j.reference);
  // les vrais maladroits : ceux qui posent leurs gardiens sur les pires socles (« Que des Grondin »,
  // lui, perd parfois à la vague 1 d'un didacticiel… parce que le Grondin n'y est pas encore arrivé)
  const naifs = r.joueurs.filter((j) => j.id === 'braise-mal' || j.id === 'melange-mal');
  const arrets = new Map();
  for (const j of r.joueurs) if (j.vagueTypique) arrets.set(j.vagueTypique, (arrets.get(j.vagueTypique) || 0) + 1);
  const mur = [...arrets.entries()].sort((a, b) => b[1] - a[1])[0];
  // les vraies parties jouées avec les règles d'aujourd'hui (une partie quittée avant la fin de la
  // vague 1 ne dit rien) ; celles d'avant sont comptées à part : un mur réparé ne reste pas rouge
  const parlantes = r.vraies.filter((v) => !(v.statut === 'abandon' && v.vaguesEnregistrees === 0));
  const vraies = parlantes.filter((v) => exacteAvant(r, v));
  const anciennes = parlantes.length - vraies.length;
  // l'issue d'une partie : ce qui s'est vraiment passé, ou, rejouée avec d'autres chiffres, le « et si… ? »
  const issue = (v) => (v.exact === null
    ? { gagne: v.fin === 'gagne', perdueA: v.fin === 'perdu' ? v.vaguesTenues + 1 : null, tenues: v.vaguesTenues }
    : { gagne: v.statut === 'gagne', perdueA: v.statut === 'perdu' ? v.vaguesEnregistrees + 1 : null, tenues: v.vaguesEnregistrees });
  const perdues = new Map();
  for (const v of vraies) { const x = issue(v); if (x.perdueA) perdues.set(x.perdueA, (perdues.get(x.perdueA) || 0) + 1); }
  const murVrai = [...perdues.entries()].sort((a, b) => b[1] - a[1])[0];
  return {
    verdict: r.verdict.titre,
    ecart: r.verdict.objectif?.ecart ?? 0,
    bon: r.niveau.survie ? `tient ${ref.vaguesTypiques} vagues` : ref.texte,
    marge: ref.victoires ? ref.marge : null,
    maladroit: r.niveau.survie ? `${naifs.map((j) => j.vaguesTypiques).sort((a, b) => a - b)[Math.floor(naifs.length / 2)]} vagues` : naifs.map((j) => (j.victoires === j.total ? 'gagne' : `v${j.vagueTypique}`)).join(' / '),
    perdDesLe1: !r.niveau.survie && naifs.some((j) => j.vagueTypique === 1),
    mur: mur && mur[1] >= 3 ? `vague ${mur[0]} (${mur[1]} joueurs)` : '—',
    vraies: (vraies.length ? (r.niveau.survie ? vraies.map((v) => issue(v).tenues).sort((a, b) => b - a).join(', ') : `${vraies.filter((v) => issue(v).gagne).length} / ${vraies.length}`) : '—')
      + (anciennes ? ` (+ ${anciennes} avec d’anciennes règles)` : ''),
    murVrai: murVrai ? `vague ${murVrai[0]} (${murVrai[1]}×)` : '—',
    murVraiFort: Boolean(murVrai && murVrai[1] >= 3 && murVrai[0] <= 3),
    debutant: r.debutant ? [`${r.debutant.auHasard} %`, ...r.debutant.pieges.map((p) => `${GARDIENS[p.type].nom} d’abord ${p.part} %`)].join(' · ') : '—',
    piege: r.debutant ? Math.min(r.debutant.auHasard, ...r.debutant.pieges.map((p) => p.part)) : 100,
  };
}

function afficherTour() {
  const table = element('table', 'resultats');
  const tete = element('tr');
  for (const t of ['Niveau', 'Visé', 'Verdict', 'Le bon joueur', 'Au plus près', 'Les maladroits (Braise / mélange mal placés)', 'Le débutant (vague 1 tenue)', 'Le mur', 'Vraies parties gagnées', 'Où elles perdent']) tete.append(element('th', '', t));
  table.append(tete);
  const lignes = [];
  for (const id of ORDRE) {
    const avant = resultatDe(id, 'avant'), apres = aChange(id) ? resultatDe(id, 'apres') : null;
    if (!avant) continue;
    const a = resumeTour(avant), b = apres ? resumeTour(apres) : null;
    const x = b || a;
    const ligne = element('tr');
    const cellule = (cle, texte, classe = '') => {
      const td = element('td', classe, texte);
      if (b && a[cle] !== b[cle]) td.append(element('span', 'avant', ` (avant : ${typeof a[cle] === 'number' ? nombre(a[cle], 1) : a[cle] ?? '—'})`));
      return td;
    };
    const nom = element('td', '', nomNiveau(id));
    nom.addEventListener('click', () => choisirNiveau(id));
    nom.className = 'lien';
    ligne.append(
      nom,
      element('td', '', fichesAvant[id].survie ? 'survie' : DIFFICULTES[fichesAvant[id].difficulte || 'normal']),
      cellule('verdict', x.verdict, x.ecart === 0 ? '' : Math.abs(x.ecart) === 1 ? 'attention' : 'trop'),
      cellule('bon', x.bon),
      cellule('marge', x.marge === null ? '—' : cases(x.marge), x.marge !== null && x.marge < 1.5 ? 'attention' : ''),
      cellule('maladroit', x.maladroit, x.perdDesLe1 && ['didacticiel', 'facile'].includes(fichesAvant[id].difficulte) ? 'attention' : ''),
      cellule('debutant', x.debutant, x.piege < 50 ? (fichesAvant[id].difficulte === 'didacticiel' ? 'trop' : 'attention') : ''),
      cellule('mur', x.mur),
      cellule('vraies', x.vraies),
      cellule('murVrai', x.murVrai, x.murVraiFort ? 'trop' : ''),
    );
    table.append(ligne);
    lignes.push({ id, avant: a, apres: b });
  }
  $('#tour').replaceChildren(element('h2', '', 'Le tour complet'), element('p', 'aide', 'Tous les niveaux, avec les joueurs imaginaires et les vraies parties (rejouées avec les chiffres de chaque colonne). Le débutant pose ses gardiens au hasard, avec tout son or (et parfois, d’abord, un gardien qui ne se bat presque pas). En orange : à regarder ; en rouge : un objectif manqué, un piège dans un didacticiel, ou un mur pour les vrais joueurs (au moins 3 parties perdues à la même vague, dès les 3 premières). Entre parenthèses : avant tes chiffres. Un clic sur un niveau l’ouvre.'), table);
  return lignes;
}

// ── Les planches (rangées dans captures/, ou téléchargées en ligne) ──
async function ranger(canvas, nom) {
  const image = canvas.toDataURL('image/png');
  if (import.meta.env.DEV) {
    const fichier = await (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
    dire(`Rangée dans ${fichier}`);
    return fichier;
  }
  const lien = element('a');
  lien.href = image;
  lien.download = `${nom}.png`;
  lien.click();
  return lien.download;
}
// Dessine un graphique (sa spec actuelle) dans une case de planche, avec son titre et sa légende
function caseDePlanche(ctx, x, y, l, h, figureId) {
  const fig = $(`#${figureId}`);
  const spec = graphiques[figureId.replace('fig-', '')].spec;
  ctx.save();
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(x, y, l, h);
  ctx.font = '18px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#ffd27a';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(fig.querySelector('h3').textContent, x + 8, y + 6);
  // la légende (elle passe à la ligne quand elle n'a plus la place)
  let lx = x + 8, ly = y + 32;
  ctx.font = '13px "Pixelify Sans", sans-serif';
  for (const li of fig.querySelectorAll('.legende li')) {
    const cle = li.querySelector('.cle'), couleur = cle.style.getPropertyValue('--couleur');
    const largeur = 26 + ctx.measureText(li.textContent).width;
    if (lx + largeur > x + l && lx > x + 8) { lx = x + 8; ly += 18; }
    ctx.globalAlpha = cle.classList.contains('pale') ? 0.4 : 1;
    ctx.fillStyle = couleur;
    if (cle.classList.contains('barre') || cle.classList.contains('croix')) ctx.fillRect(lx, ly + 2, 10, 10); else ctx.fillRect(lx, ly + 6, 14, 3);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#e9d6b8';
    ctx.fillText(li.textContent, lx + 18, ly);
    lx += largeur;
  }
  const haut = ly - y + 22;
  ctx.translate(x, y + haut);
  if (spec) dessiner(ctx, spec, l, h - haut);
  ctx.restore();
}
async function planche() {
  if (!resultatActuel()) { dire('Le calcul n’est pas fini : la planche attendra.'); return null; }
  const c = element('canvas');
  c.width = 1600;
  c.height = 940;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '28px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#fff4e0';
  ctx.textBaseline = 'top';
  const r = resultatActuel();
  ctx.fillText(`${r.niveau.nom} — ${r.verdict.titre}${aChange(choix.niveau) ? ' (avec tes chiffres)' : ''}`, 16, 14);
  ctx.font = '15px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#c8b8a8';
  ctx.fillText($('#info-niveau').textContent, 16, 50);
  const ids = ['fig-course', 'fig-or', 'fig-forces', 'fig-degats'];
  ids.forEach((id, k) => caseDePlanche(ctx, 16 + (k % 2) * 792, 80 + Math.floor(k / 2) * 430, 776, 420, id));
  return ranger(c, `equilibrage-${choix.niveau}`);
}
// Avant / après : la course du niveau choisi, avec les chiffres du fichier (à gauche) et les tiens (à droite)
async function avantApres() {
  if (!aChange(choix.niveau)) { dire('Rien n’a changé pour ce niveau : bouge un curseur d’abord.'); return null; }
  if (!resultatDe(choix.niveau, 'apres') || !resultatDe(choix.niveau, 'avant')) { dire('Le calcul n’est pas fini : la planche attendra.'); return null; }
  const avantMontre = choix.avant;
  choix.avant = false;
  const c = element('canvas');
  c.width = 1600;
  c.height = 600;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '26px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#fff4e0';
  ctx.textBaseline = 'top';
  ctx.fillText(`${nomNiveau(choix.niveau)} : avant / après`, 16, 12);
  const apres = resultatActuel(), avant = resultatDe(choix.niveau, 'avant');
  // sous chaque moitié : le verdict, et le débutant (en quelques lignes)
  const legendeBas = (x, quand, r) => {
    ctx.font = '17px "Pixelify Sans", sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.fillText(`${quand} : ${r.verdict.titre}${r.verdict.objectif ? ` (${r.verdict.objectif.ecart === 0 ? 'objectif atteint' : 'objectif manqué'})` : ''}`, x, 514);
    if (!r.debutant) return;
    ctx.font = '14px "Pixelify Sans", sans-serif';
    ctx.fillStyle = '#e9d6b8';
    let ligne = '', y = 540;
    for (const mot of texteDebutant(r.debutant).split(' ')) {
      if (ctx.measureText(`${ligne} ${mot}`).width > 760) { ctx.fillText(ligne, x, y); ligne = mot; y += 19; } else ligne = ligne ? `${ligne} ${mot}` : mot;
    }
    ctx.fillText(ligne, x, y);
  };
  // l'avant : on dessine la course avec le résultat d'avant, comme s'il était l'actuel
  dessinerCourse(avant, null);
  caseDePlanche(ctx, 16, 56, 776, 450, 'fig-course');
  legendeBas(24, 'Avant', avant);
  dessinerCourse(apres, null);
  caseDePlanche(ctx, 808, 56, 776, 450, 'fig-course');
  legendeBas(816, 'Après', apres);
  choix.avant = avantMontre;
  toutDessiner();
  return ranger(c, `equilibrage-avant-apres-${choix.niveau}`);
}

// ═════════════════════════════════════════════════════════════
// C'EST PARTI
// ═════════════════════════════════════════════════════════════
for (const id of ['course', 'or', 'forces', 'degats']) graphiques[id] = creerGraphique($(`#fig-${id}`));
dessinerBande();
dessinerChoix();
dessinerChoixReglage();
dessinerReglages();
dessinerActions();
calculer().then(() => { majChoixDetail(); dessinerBanc(); majPastille(choix.niveau); });

window.__equilibrage = {
  choix,
  get resultats() { return resultats; },
  get chiffres() { return chiffres; },
  choisir: (id) => choisirNiveau(id),
  calculer,
  tourComplet,
  planche,
  avantApres,
  // remplace les chiffres « après » (rangés comme chiffres.json, en entier ou en partie) et recalcule
  async remplacer(nouveaux = {}, fiches = {}) {
    const fusion = (cible, source) => {
      for (const [k, v] of Object.entries(source)) {
        if (v && typeof v === 'object' && !Array.isArray(v) && cible[k] && typeof cible[k] === 'object') fusion(cible[k], v);
        else cible[k] = structuredClone(v);
      }
    };
    fusion(chiffres, nouveaux);
    for (const [id, fiche] of Object.entries(fiches)) fichesApres[id] = structuredClone(fiche);
    dessinerReglages();
    majReglagesModifies();
    majBandeComptes();
    await calculer();
  },
  fiche: (id = choix.niveau) => structuredClone(ficheApres(id)),
};
