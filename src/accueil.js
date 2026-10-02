// ─────────────────────────────────────────────────────────────
// L'ACCUEIL : LA CARTE DES ÉPOQUES (la page index.html)
// Une colonne par monde, chacune dans le style de son époque, avec ses
// niveaux : verrouillés, à jouer, ou déjà gagnés. Cliquer sur un niveau
// ouvert lance le jeu (jeu.html?niveau=…).
// ─────────────────────────────────────────────────────────────
import { MONDES, estDebloque, problemesCampagne } from './jeu/campagne.js';
import { GARDIENS, MONSTRES, caracteristiques } from './jeu/donnees.js';
import { DIFFICULTES } from './jeu/niveau.js';
import { lireProgression, choisirToutDebloque, effacerProgression } from './progression.js';
import { meilleursScores } from './classement.js';
import { imagePersonnage } from './rendus/pixel.js';
import { creerFenetreOptions } from './fenetre-options.js';

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const ficheParId = (id) => FICHES[`./niveaux/${id}.json`] || null;
const $ = (s) => document.querySelector(s);

// Fabrique un élément ; le texte passe par textContent (jamais interprété comme du HTML)
function el(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// ── Un monde : son en-tête, puis ses niveaux ──
function carteMonde(monde, { gagnes, toutDebloque }) {
  const section = el('section', 'monde');
  section.dataset.epoque = monde.style; // le style de son époque (voir accueil.css)
  const entete = el('header', 'entete-monde');
  entete.append(el('p', 'numero-monde', `Monde ${monde.numero}`), el('h2', '', monde.nom), el('p', 'annees', monde.epoque));
  section.append(entete);

  if (!monde.niveaux.length) {
    section.classList.add('bientot');
    section.append(el('p', 'texte-bientot', 'Bientôt'), el('p', 'detail-bientot', 'De nouveaux gardiens et de nouveaux monstres se préparent.'));
    return section;
  }

  // le prochain niveau à jouer : le premier niveau ouvert qui n'est pas encore gagné
  const prochain = monde.niveaux.find((id) => !gagnes.has(id) && estDebloque(id, gagnes));
  const liste = el('ol', 'niveaux');
  monde.niveaux.forEach((id, i) => {
    const fiche = ficheParId(id);
    const gagne = gagnes.has(id);
    const ouvert = toutDebloque || estDebloque(id, gagnes);
    const etat = gagne ? 'gagne' : id === prochain ? 'prochain' : ouvert ? 'ouvert' : 'ferme';
    const li = el('li', 'niveau');
    li.dataset.etat = etat;
    const lien = ouvert ? el('a', 'lien-niveau') : el('span', 'lien-niveau');
    if (ouvert) lien.href = `./jeu.html?niveau=${encodeURIComponent(id)}`;
    const detail = { gagne: 'Gagné', prochain: 'À toi de jouer !', ouvert: 'Ouvert', ferme: 'Gagne le niveau d’avant pour l’ouvrir' }[etat];
    const texte = el('span', 'texte-niveau');
    texte.append(el('span', 'nom-niveau', fiche?.nom || id));
    if (ouvert && fiche?.description) texte.append(el('span', 'description-niveau', fiche.description));
    texte.append(el('span', 'detail-niveau', `${DIFFICULTES[fiche?.difficulte || 'normal']} · ${detail}`));
    lien.append(el('span', 'medaille', gagne ? '✓' : String(i + 1)), texte);
    if (!ouvert) lien.setAttribute('aria-disabled', 'true');
    li.append(lien);
    liste.append(li);
  });
  const nbGagnes = monde.niveaux.filter((id) => gagnes.has(id)).length;
  section.append(liste, el('p', 'bilan-monde', `${nbGagnes} / ${monde.niveaux.length} niveaux gagnés`));
  return section;
}

function dessinerFrise() {
  const progression = lireProgression();
  $('#frise').replaceChildren(...MONDES.map((monde) => carteMonde(monde, progression)));
  $('#tout-debloquer').checked = progression.toutDebloque;
}

// ── Le défi : une carte par arène de survie, avec son classement ──
const vagues = (n) => `${n} vague${n > 1 ? 's' : ''}`;

async function carteArene(fiche) {
  const carte = el('article', 'arene');
  carte.dataset.epoque = fiche.style; // l'arène prend le style de son époque
  const infos = el('div', 'arene-infos');
  const jouer = el('a', 'bouton-jouer', 'Jouer');
  jouer.href = `./jeu.html?niveau=${encodeURIComponent(fiche.id)}`;
  infos.append(el('h3', '', fiche.nom), el('p', 'description-arene', fiche.description || ''), jouer);

  const classement = el('div', 'arene-classement');
  classement.append(el('h4', '', 'Classement'));
  const scores = await meilleursScores(fiche.id, 5);
  if (!scores.length) {
    classement.append(el('p', 'classement-vide', 'Personne n’a encore joué : à toi l’honneur !'));
  } else {
    const liste = el('ol', 'podium');
    for (const score of scores) {
      const li = el('li');
      // textContent : un pseudo est affiché tel quel, jamais interprété comme du HTML
      li.append(el('span', 'pseudo', score.pseudo), el('span', 'vagues-score', vagues(score.vagues)));
      liste.append(li);
    }
    classement.append(liste);
  }
  classement.append(el('p', 'note-classement', 'Scores gardés sur cet ordinateur'));
  carte.append(infos, classement);
  return carte;
}

async function dessinerDefis() {
  const arenes = Object.values(FICHES).filter((fiche) => fiche.survie).sort((a, b) => a.id.localeCompare(b.id));
  $('#defi').hidden = arenes.length === 0;
  $('#arenes').replaceChildren(...await Promise.all(arenes.map(carteArene)));
}

// ── Le défilé des personnages, en haut de la page ──
// (sans le chef des monstres : il reste une surprise)
function dessinerDefile() {
  const persos = [
    ...Object.keys(GARDIENS).map((type) => caracteristiques(type, 1)),
    ...Object.values(MONSTRES).filter((fiche) => !fiche.boss),
  ];
  $('#defile').replaceChildren(...persos.map((fiche) => {
    const image = imagePersonnage(fiche.apparence, 0, 2); // tous agrandis 2 fois : la Gigogne reste plus grosse qu'un Gluant
    image.title = fiche.nom;
    return image;
  }));
}

// ── Les outils de test (seulement avec npm run dev) ──
if (import.meta.env.DEV) {
  // une campagne mal remplie (niveau absent, mauvais style) est signalée dans la console
  const fiches = Object.fromEntries(Object.entries(FICHES).map(([chemin, fiche]) => [chemin.slice('./niveaux/'.length, -'.json'.length), fiche]));
  for (const erreur of problemesCampagne(fiches)) console.warn(`Campagne : ${erreur}`);
  $('#outils-test').hidden = false;
  $('#tout-debloquer').addEventListener('change', (e) => { choisirToutDebloque(e.target.checked); dessinerFrise(); });
}

// ── Les options ──
// La même fenêtre que dans le jeu, avec en plus la section « Progression » (pour tout effacer)
const fenetreOptions = creerFenetreOptions({ effacerProgression: () => { effacerProgression(); dessinerFrise(); } });
$('#bouton-options').addEventListener('click', () => fenetreOptions.ouvrir());

dessinerDefile();
dessinerFrise();
dessinerDefis();
// Si on revient sur la page avec le bouton « retour » du navigateur, la progression
// et le classement ont pu changer
addEventListener('pageshow', () => { dessinerFrise(); dessinerDefis(); });
