// ─────────────────────────────────────────────────────────────
// L'ATELIER DES MODÈLES (la page modeles.html, un outil d'atelier)
// Les personnages (les gardiens à leurs trois niveaux, les monstres, le héros)
// et le socle libre, posés sur les vrais sols d'un niveau, dans le style choisi :
// un « défilé », où chaque monstre attend sur le chemin et chaque gardien sur
// son socle (le gardien choisi est toujours sur le socle le plus près du milieu
// de la carte).
//
// Pour le modèle choisi, sous les quatre ambiances :
// - se détache-t-il du sol ? L'atelier photographie la scène avec lui, puis
//   sans lui (caché le temps d'une photo), et compare ses pixels au sol qu'ils
//   cachent (voir rendus/lisibilite.js) ;
// - et pour un joueur daltonien ? (sa vue est simulée) ;
// - est-il assez grand à l'écran ?
// Et, pour un monstre : lequel lui ressemble le plus ?
// On règle ses couleurs, sa taille et celles de ses accessoires ; « Enregistrer
// dans le jeu » réécrit src/jeu/apparences.json (seulement avec npm run dev).
// Les planches rangent leurs images dans captures/ :
// - le tour complet : tous les modèles du style, sous les quatre ambiances ;
// - avant / après : le modèle choisi avec l'apparence du fichier, puis la tienne.
//
// Dans la console : __modeles.choisir({ style, modele, niveau, ambiance, vue }),
// __modeles.mesurer(), __modeles.tourComplet(), __modeles.avantApres().
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RenduVoxel from './rendus/voxel.js';
import RenduCartoon from './rendus/cartoon.js';
import RenduPixel, { imagePersonnage } from './rendus/pixel.js';
import { GARDIENS, MONSTRES, HEROS, HAUTEUR_VOL } from './jeu/donnees.js';
import { lireApparence } from './rendus/apparence.js';
import { TAILLE_MIN, TAILLE_MAX } from './rendus/format-apparences.js';
import { DALTONISMES, matriceSVG, mesurerPersonnage, ressemblance } from './rendus/lisibilite.js';
import { chargerNiveau } from './jeu/niveau.js';
import { creerPartie } from './jeu/moteur.js';
import { MONDES } from './jeu/campagne.js';
import { compterVisite } from './compteur.js';

compterVisite('modeles'); // une visite de plus (voir compteur.js)

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const ficheDe = (id) => FICHES[`./niveaux/${id}.json`];
const NOMS_AMBIANCES = { doree: 'Heure dorée', aube: 'Aube brumeuse', midi: 'Plein midi', nuit: 'Nuit' };
const AMBIANCES = Object.keys(NOMS_AMBIANCES);
const VUES = { jeu: 'Vue de jeu', pres: 'De près : le modèle' };
const STYLES = {
  voxel: { nom: 'Voxel doré', Rendu: RenduVoxel, reglages: { camera: 'haute', qualite: 'complete' }, niveau: 'monde3-1' },
  cartoon: { nom: 'Diorama cartoon', Rendu: RenduCartoon, reglages: { qualite: 'complete' }, niveau: 'monde2-1' },
  pixel: { nom: 'Pixel art', Rendu: RenduPixel, reglages: {}, niveau: 'monde1-2' },
};
const NOMS_COULEURS = {
  clair: 'Clair (le dessus)', peau: 'Peau', fonce: 'Foncé (l’ombre)', yeux: 'Yeux', mousse: 'Mousse', lave: 'Lave',
  carapace: 'Carapace', museau: 'Museau', ventre: 'Ventre',
};

// Les seuils des mesures : en dessous du premier, « trop » ; du second, « attention ».
// - detache : l'écart médian entre le modèle et le sol qu'il cache (voir lisibilite.js) ;
// - taille : sa hauteur à l'écran, en pixels, dans une fenêtre de jeu de 1280 × 720.
const SEUILS = { detache: [14, 22], taille: [18, 26] };
const alerte = (v, [trop, attention]) => (v < trop ? 'trop' : v < attention ? 'attention' : 'bien');

const $ = (s) => document.querySelector(s);
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}
const nombre = (v, chiffres = 0) => v.toLocaleString('fr-FR', { maximumFractionDigits: chiffres, minimumFractionDigits: chiffres });

// ═════════════════════════════════════════════════════════════
// LES MODÈLES
// Chacun garde l'objet « apparence » de sa fiche (donnees.js, qui le lit dans apparences.json) :
// le changer change le personnage dans le jeu (et dans les trois styles) dès qu'il est refabriqué.
// ═════════════════════════════════════════════════════════════
const MODELES = [
  ...Object.entries(MONSTRES).map(([type, m]) => ({ id: `monstre:${type}`, nom: m.nom, famille: 'monstres', type, apparence: m.apparence })),
  ...Object.entries(GARDIENS).flatMap(([type, g]) => g.niveaux.map((n, i) => ({
    id: `gardien:${type}:${i + 1}`, nom: n.nom || g.nom, detail: `${g.nom}, niveau ${i + 1}`, famille: 'gardiens', type, niveau: i + 1, apparence: n.apparence,
  }))),
  { id: 'heros', nom: HEROS.nom, famille: 'heros', apparence: HEROS.apparence },
  { id: 'socle', nom: 'Socle libre', famille: 'decor', apparence: null },
];
const modeleDe = (id) => MODELES.find((m) => m.id === id);
const FAMILLES = [['Les monstres', 'monstres'], ['Les gardiens (niveaux 1, 2, 3)', 'gardiens'], ['Le héros', 'heros'], ['Le décor', 'decor']];

// Toutes les apparences du jeu, rangées comme dans apparences.json
const apparencesDuJeu = () => ({
  gardiens: Object.fromEntries(Object.entries(GARDIENS).map(([type, g]) => [type, g.niveaux.map((n) => n.apparence)])),
  monstres: Object.fromEntries(Object.entries(MONSTRES).map(([type, m]) => [type, m.apparence])),
  heros: HEROS.apparence,
});
// AVANT : le fichier, pour comparer. (Les apparences sont changées « sur place » : les fiches gardent
// les mêmes objets, il faut donc recopier leurs valeurs plutôt que remplacer les objets.)
let AVANT = structuredClone(apparencesDuJeu());
const avantDe = (m) => (m.famille === 'monstres' ? AVANT.monstres[m.type] : m.famille === 'gardiens' ? AVANT.gardiens[m.type][m.niveau - 1] : m.famille === 'heros' ? AVANT.heros : null);
function recopier(objet, valeurs) {
  for (const cle of Object.keys(objet)) delete objet[cle];
  Object.assign(objet, structuredClone(valeurs));
}
const modifie = (m) => m.apparence && JSON.stringify(m.apparence) !== JSON.stringify(avantDe(m));

// ── Ce qu'on regarde (lu dans l'adresse, pour pouvoir y revenir) ──
const params = new URLSearchParams(location.search);
const IDS = Object.keys(FICHES).map((chemin) => chemin.slice('./niveaux/'.length, -'.json'.length));
const ORDRE = [...MONDES.flatMap((m) => m.niveaux).filter((id) => IDS.includes(id)), ...IDS.filter((id) => !MONDES.some((m) => m.niveaux.includes(id)))];
const styleDemande = STYLES[params.get('style')] ? params.get('style') : 'voxel';
const choix = {
  style: styleDemande,
  modele: modeleDe(params.get('modele')) ? params.get('modele') : 'monstre:gluant',
  niveau: IDS.includes(params.get('niveau')) ? params.get('niveau') : STYLES[styleDemande].niveau,
  ambiance: NOMS_AMBIANCES[params.get('ambiance')] ? params.get('ambiance') : null, // null : celle du niveau
  vue: VUES[params.get('vue')] ? params.get('vue') : 'jeu',
  daltonisme: DALTONISMES[params.get('daltonisme')] ? params.get('daltonisme') : '',
};

let niveau = null;
let rendu = null;
let etat = null;
let temoin = 0;          // le socle du milieu : celui du gardien choisi (ou le socle libre mesuré)
let enPause = false;     // pendant une mesure ou une planche, la boucle ne dessine plus
let montreAvant = false; // la vue montre-t-elle l'avant (l'apparence du fichier) ?
let misDeCote = null;    // pendant ce temps, les apparences « après », mises de côté
let derniere = null;     // la dernière mesure du modèle choisi (pour la silhouette)
const ui = { survol: -1, selection: -1, apercuPortee: null };
const vue = $('#vue');
const ambianceActuelle = () => choix.ambiance || niveau.ambiance;
const modele = () => modeleDe(choix.modele);

// ═════════════════════════════════════════════════════════════
// LE DÉFILÉ
// Une partie qui n'avance pas : chaque monstre attend sur le chemin (tous, en file, du début vers
// la fin), chaque socle porte un gardien (tous les gardiens à tour de rôle, niveaux 1 à 3), le
// héros attend devant le château. Le socle du milieu porte le gardien choisi, ou reste libre.
// ═════════════════════════════════════════════════════════════
function poserGardien(partie, socle, type, niv) {
  const s = niveau.socles[socle];
  partie.tours.push({ id: partie.prochainId++, type, niveau: niv, investi: 0, socle, x: s.x, y: s.y, recharge: 1, angle: Math.PI / 2, attaque: 0 });
}
function poserMonstre(partie, type, d) {
  const fiche = MONSTRES[type], p = niveau.pointSurChemin(d);
  partie.ennemis.push({
    id: partie.prochainId++, type, force: 1, pv: fiche.pv, pvMax: fiche.pv, d, decalage: 0, x: p.x, y: p.y, dx: p.dx, dy: p.dy,
    ralenti: 0, facteurRalenti: 1, gele: 0, assomme: 0, touche: 0, recul: 0, reculTotal: 0, accroche: 0, souffles: 0, bond: 0,
    cache: false, creuse: 0, feu: 0,
  });
}
function monterDefile() {
  niveau.heros ||= true; // (le héros vient dans tous les niveaux de l'atelier, pour qu'on le voie partout)
  const partie = creerPartie(niveau, 7);
  const socles = niveau.socles.map((s, i) => ({ s, i })).filter(({ s }) => !s.bonus);
  const cx = niveau.largeur / 2, cy = niveau.hauteur / 2;
  temoin = socles.reduce((a, b) => (Math.hypot(b.s.x - cx, b.s.y - cy) < Math.hypot(a.s.x - cx, a.s.y - cy) ? b : a)).i;
  const m = modele(), types = Object.keys(GARDIENS);
  socles.forEach(({ i }, k) => {
    if (i === temoin) { if (m.famille === 'gardiens') poserGardien(partie, i, m.type, m.niveau); return; }
    poserGardien(partie, i, types[k % types.length], 1 + (k % 3));
  });
  const monstres = Object.keys(MONSTRES), debut = 1.5, fin = niveau.longueurChemin - 3.5;
  monstres.forEach((type, n) => poserMonstre(partie, type, debut + ((fin - debut) * n) / (monstres.length - 1)));
  partie.evenements.length = 0;
  return partie;
}

// Où se trouve un modèle dans le défilé : sa clé (pour le cacher le temps d'une photo), sa place
// dans le monde [x, y], sa hauteur (en cases, pour la caméra), et sa taille (pour la zone de mesure)
function placeDe(m) {
  const taille = m.apparence ? lireApparence(m.apparence).taille : 1;
  if (m.famille === 'monstres') {
    const e = etat.ennemis.find((x) => x.type === m.type);
    return { cle: `ennemi:${e.id}`, x: e.x, y: e.y, hauteur: MONSTRES[m.type].volant ? HAUTEUR_VOL : 0.3, taille };
  }
  if (m.famille === 'heros') return { cle: 'heros', x: etat.heros.x, y: etat.heros.y, hauteur: 0.5, taille };
  const s = niveau.socles[temoin];
  return { cle: m.famille === 'gardiens' ? `tour:${temoin}` : `socle:${temoin}`, x: s.x, y: s.y, hauteur: m.famille === 'gardiens' ? 0.5 : 0.1, taille };
}

async function preparerVue() {
  niveau = chargerNiveau(ficheDe(choix.niveau));
  rendu?.detruire();
  for (const c of vue.querySelectorAll('canvas:not(.silhouette)')) c.remove();
  rendu = new STYLES[choix.style].Rendu(vue, niveau, { ambiance: ambianceActuelle(), ...STYLES[choix.style].reglages });
  vue.append($('#silhouette')); // la silhouette reste par-dessus la nouvelle vue
  etat = monterDefile();
  rechauffer(40);
  placerVue();
  majAdresse();
  await mesurerEtAfficher();
}

// Quelques images sans faire avancer la partie : les personnages finissent leur petit « pop »
// d'apparition, les gardiens se tournent
function rechauffer(images) {
  for (let i = 0; i < images; i++) rendu.dessiner(etat, 0, 1 / 60, ui);
}

// ═════════════════════════════════════════════════════════════
// LA VUE : de loin, de près, et vue par un daltonien
// ═════════════════════════════════════════════════════════════
// Un point du monde (x, y, à « h » cases du sol) → les pixels de l'image du rendu
function versToile(x, y, h) {
  const canvas = vue.querySelector('canvas:not(.silhouette)');
  if (choix.style === 'pixel') {
    const p = rendu.versPixel(x, y - h);
    return { x: p.x * rendu.echelle, y: p.y * rendu.echelle };
  }
  const v = new THREE.Vector3(x, (rendu.sol?.(x, y) ?? 0) + h, y).project(rendu.camera);
  return { x: ((v.x + 1) / 2) * canvas.width, y: ((1 - v.y) / 2) * canvas.height };
}

// Le pixel art n'a pas de caméra : de près, on agrandit son image (3 fois) autour du modèle
const ZOOM_PIXEL = 3;
function cadrePixel() {
  if (choix.style !== 'pixel' || choix.vue !== 'pres') return null;
  const p = placeDe(modele()), q = rendu.versPixel(p.x, p.y - p.hauteur);
  return { ox: (q.x * rendu.echelle) / rendu.dpr, oy: (q.y * rendu.echelle) / rendu.dpr, zoom: ZOOM_PIXEL };
}

function placerVue() {
  if (!rendu) return;
  const p = choix.vue === 'pres' ? placeDe(modele()) : null;
  if (choix.style === 'voxel') {
    rendu.choisirCamera('haute');
    if (p) { // plus bas et plus près, pour voir le modèle de trois quarts
      const angle = THREE.MathUtils.degToRad(42);
      rendu.dirCamera.set(0, Math.sin(angle), Math.cos(angle));
      rendu.cible.set(p.x, p.hauteur, p.y);
      rendu.distanceCamera = 4.5 + p.taille * 1.5;
      rendu.tangage = 0;
    }
    rendu.placerCamera();
  } else if (choix.style === 'cartoon') {
    rendu.cadrer();
    if (p) {
      rendu.cible.set(p.x, p.hauteur, p.y);
      const demi = 1.6 + p.taille, ratio = rendu.largeur / rendu.hauteur;
      Object.assign(rendu.camera, { left: -demi * ratio, right: demi * ratio, top: demi, bottom: -demi });
      rendu.camera.updateProjectionMatrix();
      rendu.camera.position.copy(rendu.cible).addScaledVector(rendu.dirCamera, 80);
      rendu.camera.updateMatrixWorld();
    }
  }
  // (le pixel art : l'image, et la silhouette par-dessus, agrandies ensemble)
  const cadre = cadrePixel();
  for (const c of vue.querySelectorAll('canvas')) {
    c.style.transformOrigin = cadre ? `${cadre.ox}px ${cadre.oy}px` : '';
    c.style.transform = cadre ? `scale(${cadre.zoom})` : '';
  }
  vue.style.filter = choix.daltonisme ? `url(#${choix.daltonisme})` : '';
  dessinerSilhouette();
  majInfoVue();
}

function majInfoVue() {
  const m = modele();
  $('#info-vue').textContent = `${m.nom}${m.detail ? ` (${m.detail})` : ''}, ${choix.vue === 'pres' ? 'de près' : 'en vue de jeu'}, ${STYLES[choix.style].nom}.`
    + (choix.daltonisme ? ` Tu vois comme un joueur atteint de ${DALTONISMES[choix.daltonisme].nom.toLowerCase()}.` : '')
    + (montreAvant ? ' Tu regardes l’AVANT (l’apparence du fichier).' : '')
    + (derniere?.[ambianceActuelle()] ? ' En doré : les pixels mesurés (ceux qui changent quand on le cache).' : '');
}

function majAdresse() {
  const p = new URLSearchParams({ style: choix.style, modele: choix.modele, niveau: choix.niveau, vue: choix.vue });
  if (choix.ambiance) p.set('ambiance', choix.ambiance);
  if (choix.daltonisme) p.set('daltonisme', choix.daltonisme);
  history.replaceState(null, '', `?${p}`);
}

let avant = performance.now();
function boucle(maintenant) {
  const dt = Math.min(0.05, (maintenant - avant) / 1000);
  avant = maintenant;
  if (rendu && !enPause) {
    rendu.dessiner(etat, 0, dt, ui); // la partie n'avance pas (0) ; le vent, l'eau et les feuilles, si
    etat.evenements.length = 0;
  }
  requestAnimationFrame(boucle);
}

// ═════════════════════════════════════════════════════════════
// LA MESURE
// ═════════════════════════════════════════════════════════════
const toilePhoto = document.createElement('canvas');
const ctxPhoto = toilePhoto.getContext('2d', { willReadFrequently: true });

// Le rectangle de l'image où chercher le modèle : autour de sa place, assez grand pour lui
function zoneDe(p) {
  const canvas = vue.querySelector('canvas:not(.silhouette)');
  const r = 0.75 + 0.55 * p.taille, haut = p.hauteur + 0.9 * p.taille + 0.4;
  const points = [];
  for (const [dx, dy] of [[-r, -r], [r, -r], [-r, r], [r, r]]) for (const h of [0, haut]) points.push(versToile(p.x + dx, p.y + dy, h));
  const x0 = Math.max(0, Math.floor(Math.min(...points.map((q) => q.x)))), x1 = Math.min(canvas.width, Math.ceil(Math.max(...points.map((q) => q.x))));
  const y0 = Math.max(0, Math.floor(Math.min(...points.map((q) => q.y)))), y1 = Math.min(canvas.height, Math.ceil(Math.max(...points.map((q) => q.y))));
  return [x0, y0, Math.max(x0 + 1, x1), Math.max(y0 + 1, y1)];
}

// Pendant une photo, le hasard (Math.random : la flamme d'une Braise qui vacille, à chaque image) repart
// toujours du même nombre : les photos avec et sans le modèle sont identiques, sauf lui
function avecHasardFixe(fonction) {
  const vrai = Math.random;
  let graine = 12345;
  Math.random = () => (graine = (graine * 16807) % 2147483647) / 2147483647;
  try {
    return fonction();
  } finally {
    Math.random = vrai;
  }
}

// Photographie un rectangle de la vue (juste après l'avoir dessinée : l'image WebGL est encore là)
function photo([x0, y0, x1, y1]) {
  avecHasardFixe(() => rendu.dessiner(etat, 0, 0, ui));
  const source = vue.querySelector('canvas:not(.silhouette)');
  toilePhoto.width = x1 - x0;
  toilePhoto.height = y1 - y0;
  ctxPhoto.drawImage(source, x0, y0, x1 - x0, y1 - y0, 0, 0, x1 - x0, y1 - y0);
  return ctxPhoto.getImageData(0, 0, x1 - x0, y1 - y0).data;
}

// Mesure un modèle sous l'ambiance affichée. Un monstre est mesuré à trois places du chemin (la sienne,
// et à mi-chemin de ses deux voisins), et on garde la valeur du milieu : passer à l'ombre d'un arbre
// ne doit pas tout changer. Renvoie la mesure (voir mesurerUneFois), ou null.
function mesurerIci(m) {
  if (m.famille !== 'monstres') return mesurerUneFois(m);
  const e = etat.ennemis.find((x) => x.type === m.type), depart = e.d;
  const pas = (niveau.longueurChemin - 5) / (Object.keys(MONSTRES).length - 1);
  const mesures = [];
  for (const d of [depart, depart - pas / 2, depart + pas / 2]) {
    const p = niveau.pointSurChemin(Math.max(0.5, Math.min(niveau.longueurChemin - 1, d)));
    Object.assign(e, { d, x: p.x, y: p.y, dx: p.dx, dy: p.dy });
    const mesure = mesurerUneFois(m);
    if (mesure) mesures.push(mesure);
  }
  const p = niveau.pointSurChemin(depart);
  Object.assign(e, { d: depart, x: p.x, y: p.y, dx: p.dx, dy: p.dy });
  if (!mesures.length) return null;
  const milieu = (cle) => mesures.map((x) => x[cle]).sort((a, b) => a - b)[Math.floor(mesures.length / 2)];
  // la photo et la silhouette : celles de sa propre place (la première)
  return { ...mesures[0], detache: milieu('detache'), daltoniens: milieu('daltoniens'), tritan: milieu('tritan'), taille: milieu('taille') };
}

// Une mesure, à la place où il est : une photo avec lui (mais sans son ombre : on ne mesure que lui,
// face au sol), une sans lui. Renvoie la mesure (voir mesurerPersonnage), avec en plus sa taille dans
// une fenêtre de 1280 × 720, sa zone, et une photo normale de son coin (pour les planches).
function mesurerUneFois(m) {
  const p = placeDe(m), zone = zoneDe(p);
  photo(zone);
  const image = element('canvas');
  image.width = zone[2] - zone[0];
  image.height = zone[3] - zone[1];
  image.getContext('2d').drawImage(toilePhoto, 0, 0);
  rendu.sansOmbre.add(p.cle);
  const avec = photo(zone);
  rendu.sansOmbre.delete(p.cle);
  rendu.masques.add(p.cle);
  const sans = photo(zone);
  rendu.masques.delete(p.cle);
  const mesure = mesurerPersonnage(avec, sans, zone[2] - zone[0], [0, 0, zone[2] - zone[0], zone[3] - zone[1]]);
  if (!mesure) return null;
  const canvas = vue.querySelector('canvas:not(.silhouette)');
  mesure.taille = ((mesure.boite[3] - mesure.boite[1]) / canvas.height) * 720;
  mesure.zone = zone;
  mesure.image = image;
  return mesure;
}

// Mesure un modèle sous les quatre ambiances (ou une seule), puis remet l'ambiance choisie
function mesurerModele(m, ambiances = AMBIANCES) {
  const resultats = {};
  for (const a of ambiances) {
    rendu.choisirAmbiance(a, true);
    rechauffer(4);
    resultats[a] = mesurerIci(m);
  }
  rendu.choisirAmbiance(ambianceActuelle(), true);
  return resultats;
}

// Les monstres qui ressemblent le plus au monstre choisi (sous l'ambiance affichée)
function ressemblances(m) {
  if (m.famille !== 'monstres') return [];
  const lui = mesurerIci(m);
  if (!lui) return [];
  return MODELES.filter((x) => x.famille === 'monstres' && x !== m)
    .map((x) => ({ modele: x, mesure: mesurerIci(x) }))
    .filter((x) => x.mesure)
    .map((x) => ({ modele: x.modele, ...ressemblance(lui, x.mesure) }))
    .sort((a, b) => a.couleurs - b.couleurs);
}

async function mesurerEtAfficher() {
  enPause = true;
  try {
    rechauffer(30);
    const m = modele();
    derniere = mesurerModele(m);
    const proches = ressemblances(m);
    afficherMesures(derniere, proches);
  } finally {
    enPause = false;
  }
  dessinerSilhouette();
  majInfoVue();
}

function afficherMesures(mesures, proches) {
  const table = element('table');
  const tete = element('tr');
  for (const t of ['Ambiance', 'Se détache du sol', 'Daltoniens (rouge-vert)', 'Tritanopie (bleu-jaune)', 'Taille (fenêtre 1280 × 720)']) tete.append(element('th', '', t));
  table.append(tete);
  for (const a of AMBIANCES) {
    const ligne = element('tr');
    ligne.append(element('td', '', NOMS_AMBIANCES[a] + (a === ambianceActuelle() ? ' (affichée)' : '')));
    const m = mesures[a];
    if (!m) {
      ligne.append(element('td', 'trop', 'introuvable'), element('td'), element('td'), element('td'));
    } else {
      ligne.append(
        element('td', alerte(m.detache, SEUILS.detache), nombre(m.detache)),
        element('td', alerte(m.daltoniens, SEUILS.detache), nombre(m.daltoniens)),
        element('td', alerte(m.tritan, SEUILS.detache), nombre(m.tritan)),
        element('td', alerte(m.taille, SEUILS.taille), `${nombre(m.taille)} px`),
      );
    }
    table.append(ligne);
  }
  const morceaux = [table];
  if (proches.length) {
    const p = proches[0], niveauAlerte = p.tailles < 1.3 ? alerte(Math.min(p.couleurs, p.daltoniens * 1.3), [10, 16]) : 'bien';
    morceaux.push(element('p', `ressemble ${niveauAlerte}`, `Le monstre qui lui ressemble le plus : ${p.modele.nom} — écart de couleur ${nombre(p.couleurs)} (pour un daltonien : ${nombre(p.daltoniens)}), ${p.tailles < 1.15 ? 'à peu près la même taille' : `${nombre(p.tailles, 1)} fois plus grand ou plus petit`}.`));
  }
  morceaux.push(element('p', 'legende-mesures', `« Se détache du sol » : l’écart moyen (ΔE) entre ses pixels et le sol qu’ils cachent ; vers 2, on voit tout juste une différence, au-delà de 30, deux couleurs qui n’ont rien à voir. Alerte sous ${SEUILS.detache[1]}, rouge sous ${SEUILS.detache[0]}. Pour les daltoniens, la même mesure avec leur vue simulée.`));
  $('#mesures').replaceChildren(...morceaux);
}

// La silhouette mesurée (sous l'ambiance affichée), dessinée en doré par-dessus la vue
function dessinerSilhouette() {
  const toile = $('#silhouette'), source = vue.querySelector('canvas:not(.silhouette)');
  if (!source) return;
  toile.width = source.width;
  toile.height = source.height;
  const ctx = toile.getContext('2d');
  ctx.clearRect(0, 0, toile.width, toile.height);
  const m = derniere?.[ambianceActuelle()];
  if (!m || choix.vue === 'pres' && choix.style !== 'pixel') return; // (de près, la caméra a bougé : la silhouette ne tombe plus juste)
  const [x0, y0, x1] = m.zone, l = x1 - x0, dedans = new Set(m.masque);
  ctx.fillStyle = 'rgba(255, 210, 90, 0.95)';
  for (const n of m.masque) {
    const x = n % l, y = Math.floor(n / l);
    // le bord de la silhouette : un pixel à lui dont un voisin n'est pas à lui
    if (!dedans.has(n - 1) || !dedans.has(n + 1) || !dedans.has(n - l) || !dedans.has(n + l)) ctx.fillRect(x0 + x, y0 + y, 1, 1);
  }
}

// ═════════════════════════════════════════════════════════════
// LES MODÈLES, EN HAUT : la bande des vignettes
// ═════════════════════════════════════════════════════════════
const vignettes = {};
function dessinerBande() {
  $('#bande-modeles').replaceChildren(...FAMILLES.map(([titre, famille]) => {
    const groupe = element('div', 'famille');
    groupe.append(element('span', 'nom-famille', titre));
    const boutons = element('div', 'vignettes');
    const liste = MODELES.filter((m) => m.famille === famille);
    // les trois niveaux d'un gardien ensemble
    const paquets = famille === 'gardiens' ? Object.keys(GARDIENS).map((type) => liste.filter((m) => m.type === type)) : liste.map((m) => [m]);
    for (const paquet of paquets) {
      const conteneur = paquet.length > 1 ? element('div', 'trio') : boutons;
      for (const m of paquet) {
        const bouton = element('button', 'vignette');
        bouton.type = 'button';
        bouton.dataset.modele = m.id;
        bouton.setAttribute('aria-pressed', String(m.id === choix.modele));
        bouton.title = m.detail || m.nom;
        vignettes[m.id] = m.apparence ? element('canvas') : element('span', 'socle-icone');
        bouton.append(vignettes[m.id], element('span', '', m.famille === 'gardiens' ? `${m.nom}` : m.nom));
        bouton.addEventListener('click', () => choisirModele(m.id));
        conteneur.append(bouton);
        majVignette(m);
      }
      if (conteneur !== boutons) boutons.append(conteneur);
    }
    groupe.append(boutons);
    return groupe;
  }));
}
function majVignette(m) {
  if (m.apparence) {
    const image = imagePersonnage(m.apparence, 40);
    const c = vignettes[m.id];
    c.width = image.width;
    c.height = image.height;
    c.getContext('2d').drawImage(image, 0, 0);
  }
  vignettes[m.id].closest('.vignette').classList.toggle('modifiee', Boolean(modifie(m)));
}

async function choisirModele(id) {
  const ancien = modele();
  choix.modele = id;
  document.querySelectorAll('.bande-modeles .vignette').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.modele === id)));
  const m = modele();
  // un autre gardien (ou plus de gardien) sur le socle du milieu : on remonte le défilé
  if (ancien.famille === 'gardiens' || m.famille === 'gardiens' || ancien.famille === 'decor' || m.famille === 'decor') {
    etat = monterDefile();
    rechauffer(30);
  }
  derniere = null;
  dessinerApparence();
  placerVue();
  majAdresse();
  await mesurerEtAfficher();
}

// ═════════════════════════════════════════════════════════════
// L'APPARENCE : couleurs, taille, accessoires
// ═════════════════════════════════════════════════════════════
let attente = null;
function changer() {
  const m = modele();
  majVignette(m);
  clearTimeout(attente);
  attente = setTimeout(async () => {
    rendu.oublierPersonnages(); // (chaque personnage sera refabriqué avec sa nouvelle apparence)
    await mesurerEtAfficher();
  }, 250);
}

function ligneCouleur(texte, valeur, quandChange, defaut = false) {
  const ligne = element('label', 'reglage');
  ligne.append(element('span', 'nom', texte));
  const champ = element('input');
  Object.assign(champ, { type: 'color', value: valeur, title: valeur });
  const sortie = element('output', defaut ? 'defaut' : '', defaut ? 'défaut' : valeur);
  champ.addEventListener('input', () => { champ.title = champ.value; sortie.textContent = champ.value; sortie.className = ''; quandChange(champ.value); });
  ligne.append(champ, sortie);
  return ligne;
}

async function basculerAvant(oui) {
  if (oui === montreAvant) return;
  const actuelles = apparencesDuJeu();
  if (oui) {
    misDeCote = structuredClone(actuelles);
    recopierTout(AVANT);
  } else {
    recopierTout(misDeCote);
    misDeCote = null;
  }
  montreAvant = oui;
  $('#bouton-avant')?.setAttribute('aria-pressed', String(oui));
  rendu.oublierPersonnages();
  MODELES.forEach((m) => m.apparence && majVignette(m));
  dessinerApparence();
  await mesurerEtAfficher();
}
// Recopie toutes les apparences (rangées comme dans apparences.json) dans les fiches
function recopierTout(toutes) {
  for (const m of MODELES) {
    if (!m.apparence) continue;
    const source = m.famille === 'monstres' ? toutes.monstres[m.type] : m.famille === 'gardiens' ? toutes.gardiens[m.type][m.niveau - 1] : toutes.heros;
    recopier(m.apparence, source);
  }
}

function dessinerApparence() {
  const m = modele();
  $('#titre-apparence').textContent = `Apparence : ${m.nom}`;
  if (!m.apparence) {
    $('#apparence').replaceChildren(element('p', 'aide', 'Le socle libre : ses couleurs sont dessinées par chaque style, dans son code (une pierre ronde, et le « + » doré qui dit « construis ici »). On mesure seulement s’il se voit bien : c’est là que le joueur pose ses gardiens.'));
    return;
  }
  const app = lireApparence(m.apparence);
  const couleurs = element('fieldset', 'groupe');
  couleurs.append(element('legend', '', 'Les couleurs'));
  couleurs.append(element('p', 'aide', 'Chaque style s’en sert à sa façon : le clair sur le dessus éclairé, le foncé dans l’ombre et sur les pattes. « défaut » : la couleur que le gabarit donne quand la fiche n’en dit rien.'));
  for (const [nom, couleur] of Object.entries(app.couleurs)) {
    const defaut = !(m.apparence.couleurs && nom in m.apparence.couleurs);
    couleurs.append(ligneCouleur(NOMS_COULEURS[nom] || nom, couleur, (v) => {
      m.apparence.couleurs ||= {};
      m.apparence.couleurs[nom] = v;
      changer();
    }, defaut));
  }
  const taille = element('fieldset', 'groupe');
  taille.append(element('legend', '', 'La taille'));
  const ligne = element('label', 'reglage');
  ligne.append(element('span', 'nom', 'Taille (1 = normale)'));
  const curseur = element('input');
  Object.assign(curseur, { type: 'range', min: TAILLE_MIN, max: TAILLE_MAX, step: 0.01, value: app.taille });
  const sortie = element('output', '', String(app.taille));
  curseur.addEventListener('input', () => { m.apparence.taille = Number(curseur.value); sortie.textContent = curseur.value; changer(); });
  ligne.append(curseur, sortie);
  taille.append(ligne);
  const morceaux = [couleurs, taille];
  if (app.accessoires.length) {
    const accessoires = element('fieldset', 'groupe');
    accessoires.append(element('legend', '', 'Les accessoires'));
    app.accessoires.forEach((acc, i) => {
      const defaut = typeof m.apparence.accessoires[i] === 'string' || !m.apparence.accessoires[i].couleur;
      accessoires.append(ligneCouleur(acc.type, acc.couleur, (v) => { m.apparence.accessoires[i] = { type: acc.type, couleur: v }; changer(); }, defaut));
    });
    morceaux.push(accessoires);
  }
  $('#apparence').replaceChildren(...morceaux);
}

// ═════════════════════════════════════════════════════════════
// LES ACTIONS : annuler, enregistrer, le tour complet, avant / après
// ═════════════════════════════════════════════════════════════
function dire(texte, erreur = false) {
  const p = $('#etat');
  p.textContent = texte;
  p.classList.toggle('erreur', erreur);
}

function dessinerActions() {
  const actions = [
    ['Annuler (ce modèle)', async () => {
      await basculerAvant(false);
      const m = modele();
      if (!m.apparence) return;
      recopier(m.apparence, avantDe(m));
      majVignette(m);
      dessinerApparence();
      changer();
      dire('Ce modèle est revenu comme dans le fichier.');
    }],
    ['Tout annuler', async () => {
      await basculerAvant(false);
      recopierTout(AVANT);
      MODELES.forEach((m) => m.apparence && majVignette(m));
      dessinerApparence();
      changer();
      dire('Tous les modèles sont revenus comme dans le fichier.');
    }],
    ['Mesurer tout le style', () => tourComplet()],
    ['Avant / après (ce modèle)', () => avantApres()],
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
  await basculerAvant(false);
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__apparences', { method: 'POST', body: JSON.stringify(apparencesDuJeu()) });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
    AVANT = structuredClone(apparencesDuJeu()); // le fichier, c'est maintenant ça
    MODELES.forEach((m) => m.apparence && majVignette(m));
    dire(`Enregistré dans ${donnees.fichier}. Le jeu prend ces apparences dès maintenant.`);
  } catch (e) {
    dire(`Pas enregistré : ${e.message}`, true);
  }
}

// Range une image dans captures/ (avec npm run dev), ou la fait télécharger (en ligne)
async function ranger(canvas, nom) {
  const image = canvas.toDataURL('image/jpeg', 0.9);
  if (import.meta.env.DEV) {
    const fichier = await (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
    dire(`Rangée dans ${fichier}`);
    return fichier;
  }
  const lien = element('a');
  lien.href = image;
  lien.download = `${nom}.jpg`;
  lien.click();
  return lien.download;
}

// Une case de planche : le modèle dans son coin de niveau (sa zone, agrandie), et ses mesures en dessous
const CASE = 150, TEXTE = 34;
function caseDePlanche(ctx, x, y, mesure) {
  ctx.fillStyle = '#241a2e';
  ctx.fillRect(x, y, CASE, CASE + TEXTE);
  if (!mesure) { ctx.fillStyle = '#ffb0a0'; ctx.fillText('introuvable', x + 8, y + 20); return; }
  const { image } = mesure, k = Math.min(CASE / image.width, CASE / image.height);
  ctx.imageSmoothingEnabled = choix.style !== 'pixel';
  ctx.drawImage(image, x + (CASE - image.width * k) / 2, y + (CASE - image.height * k) / 2, image.width * k, image.height * k);
  ctx.imageSmoothingEnabled = true;
  const couleur = (v, s) => ({ trop: '#ff8a7a', attention: '#ffd08a', bien: '#cde8b0' })[alerte(v, s)];
  ctx.font = '12px "Pixelify Sans", sans-serif';
  ctx.fillStyle = couleur(mesure.detache, SEUILS.detache);
  ctx.fillText(`sol ${nombre(mesure.detache)}`, x + 6, y + CASE + 14);
  ctx.fillStyle = couleur(mesure.daltoniens, SEUILS.detache);
  ctx.fillText(`dalt. ${nombre(mesure.daltoniens)}`, x + 58, y + CASE + 14);
  ctx.fillStyle = couleur(mesure.taille, SEUILS.taille);
  ctx.fillText(`${nombre(mesure.taille)} px`, x + 6, y + CASE + 29);
  ctx.fillStyle = couleur(mesure.tritan, SEUILS.detache);
  ctx.fillText(`trit. ${nombre(mesure.tritan)}`, x + 58, y + CASE + 29);
}

// Le tour complet : tous les modèles du style affiché, sous les quatre ambiances. Un tableau dans la
// page, et une planche (une ligne par modèle, une colonne par ambiance) dans captures/.
async function tourComplet() {
  enPause = true;
  const avantChoix = choix.modele, lignes = [];
  try {
    for (const [i, m] of MODELES.entries()) {
      dire(`Tour complet : ${m.nom} (${i + 1} sur ${MODELES.length})…`);
      choix.modele = m.id;
      // (le défilé ne change que pour un gardien ou le socle libre : le socle du milieu change)
      if (i === 0 || m.famille === 'gardiens' || m.famille === 'decor') {
        etat = monterDefile();
        rechauffer(30);
      }
      lignes.push({ modele: m, mesures: mesurerModele(m) });
      if (!document.hidden) await new Promise((r) => setTimeout(r)); // (on laisse la page afficher où on en est)
    }
  } finally {
    choix.modele = avantChoix;
    etat = monterDefile();
    rechauffer(30);
    enPause = false;
  }
  afficherTableau(lignes);
  // la planche
  const MARGE = 170, ENTETE = 30;
  const c = element('canvas');
  c.width = MARGE + AMBIANCES.length * (CASE + 6);
  c.height = ENTETE + lignes.length * (CASE + TEXTE + 6);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '15px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#ffd27a';
  AMBIANCES.forEach((a, j) => ctx.fillText(NOMS_AMBIANCES[a], MARGE + j * (CASE + 6) + 6, 20));
  lignes.forEach(({ modele: m, mesures }, i) => {
    const y = ENTETE + i * (CASE + TEXTE + 6);
    ctx.font = '15px "Pixelify Sans", sans-serif';
    ctx.fillStyle = '#fff4e0';
    ctx.fillText(m.nom, 8, y + 24);
    ctx.font = '12px "Pixelify Sans", sans-serif';
    ctx.fillStyle = '#c8b8a8';
    ctx.fillText(m.detail || ({ monstres: 'monstre', heros: 'le héros', decor: 'le décor' })[m.famille] || '', 8, y + 42);
    AMBIANCES.forEach((a, j) => caseDePlanche(ctx, MARGE + j * (CASE + 6), y, mesures[a]));
  });
  await ranger(c, `modeles-tour-${choix.style}-${choix.niveau}`);
  await mesurerEtAfficher();
  return lignes.map(({ modele: m, mesures }) => ({
    modele: m.id,
    ...Object.fromEntries(AMBIANCES.map((a) => [a, mesures[a] && { detache: +mesures[a].detache.toFixed(1), daltoniens: +mesures[a].daltoniens.toFixed(1), tritan: +mesures[a].tritan.toFixed(1), taille: Math.round(mesures[a].taille) }])),
  }));
}

function afficherTableau(lignes) {
  const conteneur = $('#tableau-tour') || element('div', 'tableau-tour');
  conteneur.id = 'tableau-tour';
  const table = element('table');
  const tete = element('tr');
  tete.append(element('th', '', 'Modèle'));
  for (const a of AMBIANCES) tete.append(element('th', '', `${NOMS_AMBIANCES[a]} : sol / dalt. / px`));
  table.append(tete);
  for (const { modele: m, mesures } of lignes) {
    const ligne = element('tr');
    ligne.append(element('td', '', m.detail ? `${m.nom} (${m.detail})` : m.nom));
    for (const a of AMBIANCES) {
      const x = mesures[a];
      const pire = x ? [alerte(x.detache, SEUILS.detache), alerte(x.daltoniens, SEUILS.detache), alerte(x.taille, SEUILS.taille)] : ['trop'];
      const classe = pire.includes('trop') ? 'trop' : pire.includes('attention') ? 'attention' : '';
      ligne.append(element('td', classe, x ? `${nombre(x.detache)} / ${nombre(x.daltoniens)} / ${nombre(x.taille)}` : '—'));
    }
    table.append(ligne);
  }
  conteneur.replaceChildren(element('h3', '', `Tour complet : ${STYLES[choix.style].nom}, ${ficheDe(choix.niveau).nom}`), table);
  $('#mesures').after(conteneur);
}

// Avant / après : le modèle choisi avec l'apparence du fichier (en haut), puis la tienne (en bas),
// sous les quatre ambiances
async function avantApres() {
  const m = modele();
  const versions = [];
  for (const oui of [true, false]) {
    await basculerAvant(oui);
    enPause = true;
    rechauffer(30);
    versions.push(mesurerModele(m));
    enPause = false;
  }
  const MARGE = 120, c = element('canvas');
  c.width = MARGE + AMBIANCES.length * (CASE + 6);
  c.height = 30 + 2 * (CASE + TEXTE + 6);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.font = '15px "Pixelify Sans", sans-serif';
  ctx.fillStyle = '#ffd27a';
  AMBIANCES.forEach((a, j) => ctx.fillText(NOMS_AMBIANCES[a], MARGE + j * (CASE + 6) + 6, 20));
  versions.forEach((mesures, i) => {
    const y = 30 + i * (CASE + TEXTE + 6);
    ctx.fillStyle = '#fff4e0';
    ctx.font = '15px "Pixelify Sans", sans-serif';
    ctx.fillText(i ? 'Après' : 'Avant', 8, y + 24);
    AMBIANCES.forEach((a, j) => caseDePlanche(ctx, MARGE + j * (CASE + 6), y, mesures[a]));
  });
  return ranger(c, `modeles-avant-apres-${choix.style}-${m.id.replaceAll(':', '-')}`);
}

// ═════════════════════════════════════════════════════════════
// LE FORMULAIRE DES CHOIX
// ═════════════════════════════════════════════════════════════
function liste(nom, etiquetteTexte, options, valeur, quandChange) {
  const label = element('label', 'choix-liste');
  label.append(element('span', '', etiquetteTexte));
  const select = element('select');
  select.name = nom;
  for (const opt of options) {
    if (opt.groupe) {
      const groupe = element('optgroup');
      groupe.label = opt.groupe;
      for (const [v, t] of opt.options) groupe.append(Object.assign(element('option', '', t), { value: v }));
      select.append(groupe);
    } else {
      select.append(Object.assign(element('option', '', opt[1]), { value: opt[0] }));
    }
  }
  select.value = valeur;
  select.addEventListener('change', () => quandChange(select.value));
  label.append(select);
  return label;
}

function dessinerChoix() {
  const groupes = MONDES.map((m) => ({ groupe: `Monde ${m.numero}`, options: m.niveaux.filter((id) => IDS.includes(id)).map((id) => [id, ficheDe(id).nom]) }));
  const autres = ORDRE.filter((id) => !MONDES.some((m) => m.niveaux.includes(id)));
  if (autres.length) groupes.push({ groupe: 'Défis et essais', options: autres.map((id) => [id, ficheDe(id).nom]) });
  const bouton = element('button', 'bouton-avant', 'Montrer l’avant');
  bouton.type = 'button';
  bouton.id = 'bouton-avant';
  bouton.setAttribute('aria-pressed', String(montreAvant));
  bouton.title = 'Les modèles avec l’apparence du fichier, pour comparer avec tes réglages';
  bouton.addEventListener('click', () => basculerAvant(!montreAvant));
  $('#choix').replaceChildren(
    liste('style', 'Style', Object.entries(STYLES).map(([id, s]) => [id, s.nom]), choix.style, async (v) => {
      choix.style = v;
      choix.niveau = STYLES[v].niveau;
      dessinerChoix();
      await preparerVue();
    }),
    liste('niveau', 'Niveau', groupes, choix.niveau, (v) => { choix.niveau = v; preparerVue(); }),
    liste('ambiance', 'Ambiance', [['', 'Celle du niveau'], ...Object.entries(NOMS_AMBIANCES)], choix.ambiance || '', (v) => {
      choix.ambiance = v || null;
      rendu.choisirAmbiance(ambianceActuelle(), true);
      dessinerSilhouette();
      majAdresse();
      afficherMesures(derniere || {}, []);
    }),
    liste('vue', 'Vue', Object.entries(VUES), choix.vue, (v) => { choix.vue = v; placerVue(); majAdresse(); }),
    liste('daltonisme', 'Vue d’un daltonien', [['', 'Non (vue normale)'], ...Object.entries(DALTONISMES).map(([id, d]) => [id, d.nom])], choix.daltonisme, (v) => {
      choix.daltonisme = v;
      placerVue();
      majAdresse();
    }),
    bouton,
  );
}

addEventListener('resize', () => { rendu?.redimensionner(); placerVue(); });

// ── C'est parti ──
for (const sorte of Object.keys(DALTONISMES)) document.querySelector(`#${sorte} feColorMatrix`).setAttribute('values', matriceSVG(sorte));
dessinerBande();
dessinerChoix();
dessinerActions();
dessinerApparence();
preparerVue().then(() => requestAnimationFrame(boucle));

window.__modeles = {
  get rendu() { return rendu; },
  get etat() { return etat; },
  get derniere() { return derniere; },
  async choisir({ modele: id, style, ...autres } = {}) {
    if (style && style !== choix.style) { choix.style = style; choix.niveau = autres.niveau || STYLES[style].niveau; dessinerChoix(); await preparerVue(); }
    if (autres.niveau && autres.niveau !== choix.niveau) { Object.assign(choix, autres); dessinerChoix(); await preparerVue(); } else { Object.assign(choix, autres); dessinerChoix(); }
    if (autres.ambiance !== undefined) rendu.choisirAmbiance(ambianceActuelle(), true);
    if (id) await choisirModele(id); else { placerVue(); majAdresse(); }
  },
  mesurer: () => mesurerEtAfficher(),
  tourComplet,
  avantApres,
  // remplace l'apparence « après » de quelques modèles ({ 'monstre:gluant': { … } }) et met tout à jour
  async remplacer(nouvelles) {
    await basculerAvant(false);
    for (const [id, apparence] of Object.entries(nouvelles)) { const m = modeleDe(id); if (m?.apparence) { recopier(m.apparence, apparence); majVignette(m); } }
    dessinerApparence();
    rendu.oublierPersonnages();
    await mesurerEtAfficher();
  },
  apparences: apparencesDuJeu,
};
