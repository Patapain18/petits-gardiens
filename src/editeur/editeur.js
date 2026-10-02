// ─────────────────────────────────────────────────────────────
// L'ÉDITEUR DE NIVEAUX
// On modifie une fiche de niveau (le même format que src/niveaux/*.json)
// en cliquant sur un plan. À chaque changement :
//   1. la fiche est vérifiée (erreurs bloquantes + conseils),
//   2. le plan se redessine,
//   3. un brouillon est gardé dans le navigateur (rien ne se perd au rechargement).
// « Tester » ouvre le jeu avec cette fiche ; « Enregistrer » l'écrit dans le projet.
// ─────────────────────────────────────────────────────────────
import { chargerNiveau, problemesFiche } from '../jeu/niveau.js';
import { analyser } from '../jeu/equilibrage.js';
import { Carte } from './carte.js';
import { Panneau } from './panneau.js';
import { conseilsNiveau } from './conseils.js';
import { arrondir, formaterFiche, nouvelleFiche, placerChateau } from './format.js';

const CLE_BROUILLON = 'pg-editeur-brouillon'; // le travail en cours (fiche + infos d'enregistrement)
const CLE_TEST = 'pg-editeur-fiche';          // la dernière fiche valide, lue par le jeu avec ?niveau=editeur
const DEV = import.meta.env.DEV;              // vrai avec « npm run dev » (on peut alors écrire dans le projet)
// Les fiches du projet, rangées dans le site au moment de sa fabrication : en ligne (sans le serveur
// de développement), l'éditeur peut quand même les ouvrir, les modifier et les tester
const FICHES_DU_SITE = import.meta.glob('../niveaux/*.json', { eager: true, import: 'default' });
const ficheDuSite = (id) => FICHES_DU_SITE[`../niveaux/${id}.json`] || null;
const OUTILS = ['chemin', 'socles', 'lanternes', 'etangs'];
const AIDES = {
  chemin: ['Clic : ajouter un point au bout du chemin', 'Clic sur le chemin : insérer un point', 'Glisser un point : le déplacer', 'Clic droit : supprimer'],
  socles: ['Clic : poser un socle', 'Glisser : le déplacer', 'Clic droit : supprimer'],
  lanternes: ['Clic : poser une lanterne', 'Glisser : la déplacer', 'Clic droit : supprimer'],
  etangs: ['Clic : creuser un étang', 'Glisser le bord ou molette : changer sa taille', 'Glisser le centre : le déplacer', 'Clic droit : supprimer'],
};

const $ = (s) => document.querySelector(s);

// Tout ce que l'éditeur sait à un instant donné
const etat = {
  fiche: null,         // la fiche en cours de modification
  niveau: null,        // chargerNiveau(fiche) si la fiche est correcte (pour le décor et les conseils)
  erreurs: [],
  conseils: [],
  outil: 'chemin',
  selection: null,     // l'objet choisi : { type, index }
  survol: null,        // l'objet sous la souris
  surbrillance: null,  // l'objet signalé par un conseil survolé
  curseur: null,       // la position de la souris, en cases (déjà aimantée)
  glisse: null,        // le déplacement en cours
  idManuel: false,     // a-t-on choisi soi-même le nom du fichier ?
  fichierOuvert: null, // l'id du fichier du projet qu'on a ouvert (null pour un nouveau niveau)
  enregistre: null,    // la fiche telle qu'elle est dans le projet (pour savoir s'il y a des changements)
  niveauxDuProjet: [],
  equilibrage: null,   // le dernier test d'équilibrage (et la version de la fiche testée)
  apercuGardiens: null, // les gardiens d'un joueur imaginaire, montrés sur le plan
  equilibrageEnCours: false,
};
const historique = { pile: [], position: -1 };

const carte = new Carte($('#carte'));
const panneau = new Panneau({
  etat,
  modifier,
  montrer: (objet) => { etat.surbrillance = objet; dessiner(); },
  montrerGardiens: (liste) => { etat.apercuGardiens = liste; dessiner(); },
});

// ═════════════════════════════════════════════════════════════
// 1. MODIFIER LA FICHE
// ═════════════════════════════════════════════════════════════

// Applique un changement à la fiche. valider = true : la modification entre
// dans l'historique (on peut l'annuler). Pendant qu'on tape, valider = false.
function modifier(changement, valider = true) {
  changement(etat.fiche);
  placerChateau(etat.fiche); // le château suit toujours le bout du chemin
  if (etat.selection && !objet(etat.selection)) etat.selection = null;
  carte.cadrer(etat.fiche);
  recalculer();
  if (valider) memoriser();
  panneau.afficher(etat.fiche);
  dessiner();
}

// Vérifie la fiche, et si elle est correcte, calcule le niveau (décor) et les conseils
function recalculer() {
  etat.erreurs = problemesFiche(etat.fiche);
  etat.niveau = null;
  etat.conseils = [];
  if (!etat.erreurs.length) {
    try {
      etat.niveau = chargerNiveau(etat.fiche);
      etat.conseils = conseilsNiveau(etat.niveau);
    } catch (erreur) {
      etat.erreurs = [erreur.message];
    }
  }
  panneau.afficherVerification(etat.erreurs, etat.conseils, etat.niveau);
  if (etat.equilibrage) panneau.afficherEquilibrage(etat.equilibrage, etat.equilibrage.version === JSON.stringify(etat.fiche));
  sauverBrouillon();
  majBoutons();
}

// La liste qui contient un type d'objet, et l'objet lui-même
const liste = (type, f = etat.fiche) => ({ chemin: f.chemin, socles: f.socles, lanternes: f.lanternes, etangs: f.etangs })[type];
const objet = (o) => liste(o.type)?.[o.index];

function supprimer(o) {
  if (o.type === 'chemin' && etat.fiche.chemin.length <= 2) return annoncer('Le chemin doit garder au moins 2 points.', true);
  etat.selection = null;
  modifier((f) => liste(o.type, f).splice(o.index, 1));
}

// ── L'historique (Annuler / Refaire) ──
// On garde une copie de la fiche (en texte JSON) après chaque modification validée.
function memoriser() {
  const copie = JSON.stringify(etat.fiche);
  if (historique.pile[historique.position] === copie) return;
  historique.pile = historique.pile.slice(0, historique.position + 1);
  historique.pile.push(copie);
  if (historique.pile.length > 150) historique.pile.shift();
  historique.position = historique.pile.length - 1;
  majBoutons();
}

function revenir(pas) {
  const i = historique.position + pas;
  if (i < 0 || i >= historique.pile.length) return;
  historique.position = i;
  etat.fiche = JSON.parse(historique.pile[i]);
  etat.selection = null;
  carte.cadrer(etat.fiche);
  recalculer();
  panneau.afficher(etat.fiche, true);
  dessiner();
}

// ── Charger une fiche (nouvelle, ouverte depuis le projet, ou brouillon) ──
function charger(fiche, { fichier = null, enregistre = null, idManuel = Boolean(fichier) } = {}) {
  const f = structuredClone(fiche);
  f.etangs ||= [];
  f.lanternes ||= [];
  f.decor ||= { graine: 1 };
  etat.fiche = placerChateau(f);
  etat.fichierOuvert = fichier;
  etat.enregistre = enregistre;
  etat.idManuel = idManuel;
  etat.selection = null;
  etat.equilibrage = null;
  etat.apercuGardiens = null;
  panneau.afficherEquilibrage(null);
  historique.pile = [JSON.stringify(etat.fiche)];
  historique.position = 0;
  carte.redimensionner(etat.fiche);
  recalculer();
  panneau.afficher(etat.fiche, true);
  dessiner();
}

// ═════════════════════════════════════════════════════════════
// 2. AFFICHAGE
// ═════════════════════════════════════════════════════════════
let dessinPrevu = false;
function dessiner() {
  // au plus un dessin par image, même si on demande 10 fois
  if (dessinPrevu) return;
  dessinPrevu = true;
  requestAnimationFrame(() => {
    dessinPrevu = false;
    if (etat.fiche) carte.dessiner(etat);
  });
}

function majBoutons() {
  $('#annuler').disabled = historique.position <= 0;
  $('#refaire').disabled = historique.position >= historique.pile.length - 1;
  const bloque = etat.erreurs.length > 0;
  if (!etat.equilibrageEnCours) $('#equilibrer').disabled = bloque;
  for (const id of ['#tester', '#telecharger', '#copier', '#enregistrer']) {
    $(id).disabled = bloque;
    $(id).title = bloque ? 'Corrige d’abord les erreurs de la fiche' : '';
  }
  if (!DEV) {
    $('#enregistrer').disabled = true;
    $('#enregistrer').title = 'Disponible seulement avec « npm run dev »';
  }
}

function sauverBrouillon() {
  try {
    localStorage.setItem(CLE_BROUILLON, JSON.stringify({
      fiche: etat.fiche, fichierOuvert: etat.fichierOuvert, enregistre: etat.enregistre, idManuel: etat.idManuel,
    }));
    if (!etat.erreurs.length) localStorage.setItem(CLE_TEST, JSON.stringify(etat.fiche));
  } catch { /* navigation privée : pas de brouillon, tant pis */ }
  const el = $('#etat-sauvegarde');
  const modifie = JSON.stringify(etat.fiche) !== etat.enregistre;
  el.dataset.modifie = String(modifie);
  // en ligne, rien ne s'enregistre dans le projet : le travail reste dans ce navigateur
  el.textContent = !DEV ? 'Gardé dans ce navigateur (« Télécharger » pour récupérer la fiche)'
    : !etat.enregistre ? 'Pas encore enregistré dans le projet'
    : modifie ? 'Modifications pas encore enregistrées'
    : `Enregistré dans src/niveaux/${etat.fiche.id}.json`;
}

let minuterieAnnonce;
function annoncer(message, erreur = false) {
  const el = $('#annonce');
  el.textContent = message;
  el.dataset.erreur = String(erreur);
  el.hidden = false;
  clearTimeout(minuterieAnnonce);
  minuterieAnnonce = setTimeout(() => { el.hidden = true; }, 3800);
}

function choisirOutil(nom) {
  etat.outil = nom;
  etat.selection = null;
  etat.survol = null;
  document.querySelectorAll('[data-outil]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.outil === nom)));
  $('#aide').replaceChildren(...[...AIDES[nom], 'Alt : placement fin'].map((texte) => {
    const span = document.createElement('span');
    span.textContent = texte;
    return span;
  }));
  dessiner();
}

// ═════════════════════════════════════════════════════════════
// 3. LA SOURIS SUR LE PLAN
// ═════════════════════════════════════════════════════════════
const canvas = $('#carte');

// « Aimanter » : arrondir à la demi-case (ou au dixième avec Alt) pour placer proprement
function aimanter(p, fin) {
  const pas = fin ? 0.1 : 0.5;
  return { x: arrondir(Math.round(p.x / pas) * pas), y: arrondir(Math.round(p.y / pas) * pas) };
}
function souris(ev) {
  const r = canvas.getBoundingClientRect();
  const brut = carte.versCase(ev.clientX - r.left, ev.clientY - r.top);
  return { brut, aimante: aimanter(brut, ev.altKey) };
}

canvas.addEventListener('pointerdown', (ev) => {
  if (ev.button !== 0) return;
  try { canvas.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà relâché */ }
  const { brut, aimante } = souris(ev);
  const sous = carte.objetSous(etat.fiche, brut, etat.outil);

  if (sous && sous.type !== 'segment') {
    // On attrape un objet existant pour le déplacer (ou changer la taille d'un étang)
    const o = objet(sous);
    etat.selection = { type: sous.type, index: sous.index };
    etat.glisse = { ...etat.selection, partie: sous.partie || 'centre', decalage: { x: o.x - aimante.x, y: o.y - aimante.y }, bouge: false };
    dessiner();
    return;
  }
  // Sinon on pose un nouvel objet, et on peut tout de suite l'ajuster en glissant
  let nouveau;
  modifier((f) => {
    if (etat.outil === 'chemin') {
      if (sous?.type === 'segment') {
        f.chemin.splice(sous.index + 1, 0, aimanter(sous.point, ev.altKey));
        nouveau = { type: 'chemin', index: sous.index + 1 };
      } else {
        f.chemin.push(aimante);
        nouveau = { type: 'chemin', index: f.chemin.length - 1 };
      }
    } else if (etat.outil === 'etangs') {
      f.etangs.push({ ...aimante, rayon: 2 });
      nouveau = { type: 'etangs', index: f.etangs.length - 1 };
    } else {
      liste(etat.outil, f).push(aimante);
      nouveau = { type: etat.outil, index: liste(etat.outil, f).length - 1 };
    }
  }, false);
  etat.selection = nouveau;
  etat.glisse = { ...nouveau, partie: 'centre', decalage: { x: 0, y: 0 }, bouge: true };
  dessiner();
});

canvas.addEventListener('pointermove', (ev) => {
  const { brut, aimante } = souris(ev);
  etat.curseur = aimante;
  $('#coordonnees').textContent = `x ${String(aimante.x).replace('.', ',')}   y ${String(aimante.y).replace('.', ',')}`;
  const g = etat.glisse;
  if (g) {
    const o = objet(g);
    if (g.type === 'etangs' && g.partie === 'bord') {
      o.rayon = Math.max(0.8, Math.min(8, arrondir(Math.hypot(brut.x - o.x, brut.y - o.y))));
    } else {
      o.x = arrondir(aimante.x + g.decalage.x);
      o.y = arrondir(aimante.y + g.decalage.y);
    }
    g.bouge = true;
    placerChateau(etat.fiche);
    dessiner(); // pendant le glisser, on redessine seulement : la vérification se fera au lâcher
    return;
  }
  etat.survol = carte.objetSous(etat.fiche, brut, etat.outil);
  canvas.style.cursor = !etat.survol ? 'crosshair'
    : etat.survol.type === 'segment' ? 'copy'
    : etat.survol.partie === 'bord' ? 'ew-resize' : 'grab';
  dessiner();
});

canvas.addEventListener('pointerup', () => {
  const g = etat.glisse;
  etat.glisse = null;
  if (g?.bouge) modifier(() => {}); // on valide le déplacement (vérification + historique)
});

canvas.addEventListener('pointerleave', () => {
  etat.curseur = null;
  etat.survol = null;
  $('#coordonnees').textContent = '';
  dessiner();
});

canvas.addEventListener('contextmenu', (ev) => {
  ev.preventDefault();
  const sous = carte.objetSous(etat.fiche, souris(ev).brut, etat.outil);
  if (sous && sous.type !== 'segment') supprimer(sous);
});

canvas.addEventListener('wheel', (ev) => {
  if (etat.outil !== 'etangs') return;
  const sous = carte.objetSous(etat.fiche, souris(ev).brut, etat.outil);
  if (sous?.type !== 'etangs') return;
  ev.preventDefault();
  modifier((f) => {
    const e = f.etangs[sous.index];
    e.rayon = Math.max(0.8, Math.min(8, arrondir(e.rayon + (ev.deltaY < 0 ? 0.2 : -0.2))));
  });
}, { passive: false });

// ═════════════════════════════════════════════════════════════
// 4. LES BOUTONS ET LE CLAVIER
// ═════════════════════════════════════════════════════════════
document.querySelectorAll('[data-outil]').forEach((b) => b.addEventListener('click', () => choisirOutil(b.dataset.outil)));
$('#annuler').addEventListener('click', () => revenir(-1));
$('#refaire').addEventListener('click', () => revenir(1));

$('#tester').addEventListener('click', () => {
  sauverBrouillon();
  // Toujours le même onglet de test : il se recharge avec la dernière version.
  // Si le navigateur bloque les nouveaux onglets, on ouvre le jeu ici même
  // (le brouillon est gardé, et le jeu a un bouton pour revenir à l'éditeur).
  const onglet = window.open('./jeu.html?niveau=editeur', 'petits-gardiens-test');
  if (!onglet) location.href = './jeu.html?niveau=editeur';
});

$('#telecharger').addEventListener('click', () => {
  const lien = document.createElement('a');
  lien.href = URL.createObjectURL(new Blob([formaterFiche(etat.fiche)], { type: 'application/json' }));
  lien.download = `${etat.fiche.id}.json`;
  lien.click();
  URL.revokeObjectURL(lien.href);
});

$('#copier').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(formaterFiche(etat.fiche));
    annoncer('Fiche copiée dans le presse-papiers.');
  } catch {
    annoncer('Le navigateur a refusé la copie. Utilise « Télécharger ».', true);
  }
});

$('#enregistrer').addEventListener('click', async () => {
  const f = etat.fiche;
  const existant = etat.niveauxDuProjet.find((n) => n.id === f.id);
  if (existant && etat.fichierOuvert !== f.id &&
      !confirm(`Le fichier src/niveaux/${f.id}.json existe déjà (« ${existant.nom} »). Le remplacer par ce niveau ?`)) return;
  try {
    const reponse = await fetch(`/__niveaux/${encodeURIComponent(f.id)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f),
    });
    const resultat = await reponse.json();
    if (!reponse.ok) return annoncer(resultat.erreur || 'L’enregistrement a échoué.', true);
    etat.fichierOuvert = f.id;
    etat.idManuel = true;
    etat.enregistre = JSON.stringify(f);
    sauverBrouillon();
    annoncer(`Enregistré dans ${resultat.fichier}`);
    listerNiveaux();
  } catch {
    annoncer('Le serveur de développement ne répond pas. Il est bien lancé avec « npm run dev » ?', true);
  }
});

const aDesModifications = () => etat.enregistre !== JSON.stringify(etat.fiche);

// Le test d'équilibrage : les joueurs imaginaires jouent le niveau en cours.
// On laisse respirer la page entre deux parties (pause), pour que la barre avance.
$('#equilibrer').addEventListener('click', async () => {
  if (!etat.niveau || etat.equilibrageEnCours) return;
  const bouton = $('#equilibrer'), barre = $('#progression-equilibrage');
  etat.equilibrageEnCours = true;
  bouton.disabled = true;
  bouton.textContent = 'Les joueurs imaginaires jouent…';
  barre.value = 0;
  barre.hidden = false;
  const version = JSON.stringify(etat.fiche);
  try {
    const analyse = await analyser(etat.niveau, {
      pause: () => new Promise((suite) => setTimeout(suite, 0)),
      progression: (p) => { barre.value = p; },
    });
    etat.equilibrage = { ...analyse, version };
    panneau.afficherEquilibrage(etat.equilibrage, version === JSON.stringify(etat.fiche));
  } finally {
    etat.equilibrageEnCours = false;
    barre.hidden = true;
    bouton.textContent = 'Relancer le test';
    majBoutons();
  }
});

$('#nouveau').addEventListener('click', () => {
  if (aDesModifications() && !confirm('Le niveau en cours a des modifications non enregistrées. Commencer un nouveau niveau quand même ?')) return;
  charger(nouvelleFiche(), { idManuel: false });
});

$('#ouvrir').addEventListener('change', async (ev) => {
  const id = ev.target.value;
  ev.target.value = '';
  if (!id) return;
  if (aDesModifications() && !confirm('Le niveau en cours a des modifications non enregistrées. Ouvrir un autre niveau quand même ?')) return;
  try {
    const fiche = DEV ? await (await fetch(`/__niveaux/${encodeURIComponent(id)}`)).json() : ficheDuSite(id);
    if (!fiche) throw new Error('fiche introuvable');
    charger(fiche, { fichier: id, enregistre: null });
    etat.enregistre = JSON.stringify(etat.fiche);
    sauverBrouillon();
    annoncer(`Niveau « ${fiche.nom} » ouvert.`);
  } catch {
    annoncer('Impossible d’ouvrir ce niveau.', true);
  }
});

// La liste des niveaux du projet : servie par le serveur de développement (elle suit les
// fichiers qu'on enregistre), ou, en ligne, celle des fiches rangées dans le site
async function listerNiveaux() {
  const choix = $('#ouvrir');
  try {
    if (!DEV) throw new Error('en ligne');
    etat.niveauxDuProjet = await (await fetch('/__niveaux')).json();
  } catch {
    etat.niveauxDuProjet = Object.values(FICHES_DU_SITE).map((f) => ({ id: f.id, nom: f.nom, style: f.style }));
  }
  choix.replaceChildren(new Option('Ouvrir un niveau…', ''), ...etat.niveauxDuProjet.map((n) => new Option(`${n.nom} (${n.id}.json)`, n.id)));
}

addEventListener('keydown', (ev) => {
  const dansUnChamp = ev.target.closest?.('input, select, textarea');
  const commande = ev.metaKey || ev.ctrlKey;
  if (commande && ['z', 'y'].includes(ev.key.toLowerCase())) {
    if (dansUnChamp) return; // dans un champ, on laisse le navigateur annuler la frappe
    ev.preventDefault();
    revenir(ev.key.toLowerCase() === 'y' || ev.shiftKey ? 1 : -1);
    return;
  }
  if (dansUnChamp || commande) return;
  const n = Number(ev.key);
  if (n >= 1 && n <= OUTILS.length) choisirOutil(OUTILS[n - 1]);
  if ((ev.key === 'Delete' || ev.key === 'Backspace') && etat.selection) {
    ev.preventDefault();
    supprimer(etat.selection);
  }
  if (ev.key === 'Escape') { etat.selection = null; dessiner(); }
});

addEventListener('resize', () => { carte.redimensionner(etat.fiche); dessiner(); });

// ═════════════════════════════════════════════════════════════
// 5. DÉMARRAGE : on reprend le brouillon, sinon le niveau d'essai
// ═════════════════════════════════════════════════════════════
async function demarrer() {
  choisirOutil('chemin');
  await listerNiveaux();
  let brouillon = null;
  try { brouillon = JSON.parse(localStorage.getItem(CLE_BROUILLON)); } catch { brouillon = null; }
  if (brouillon?.fiche) {
    charger(brouillon.fiche, { fichier: brouillon.fichierOuvert, enregistre: brouillon.enregistre, idManuel: brouillon.idManuel });
    return;
  }
  try {
    const fiche = DEV ? await (await fetch('/__niveaux/essai')).json() : ficheDuSite('essai');
    if (!fiche) throw new Error('pas de niveau d’essai');
    charger(fiche, { fichier: 'essai' });
    etat.enregistre = JSON.stringify(etat.fiche);
    sauverBrouillon();
  } catch {
    charger(nouvelleFiche(), { idManuel: false });
  }
}
demarrer();

// Accès de débogage depuis la console du navigateur (ex. : __editeur.etat.fiche)
window.__editeur = { etat, carte };
