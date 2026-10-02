// ─────────────────────────────────────────────────────────────
// L'ATELIER DES LUMIÈRES (la page lumieres.html, un outil d'atelier)
// On y regarde un niveau dans un style et une ambiance, pendant qu'une partie
// se joue toute seule (les gardiens sont posés et améliorés automatiquement,
// les vagues s'enchaînent), et on règle la lumière avec des curseurs.
//
// Deux contrôles, pour ne pas se fier seulement à ses yeux :
// - les « zébrures » : des rayures rouges sur les zones brûlées (presque
//   blanches), comme sur l'écran d'un appareil photo ;
// - les mesures : la part de l'image brûlée, la part bouchée (presque noire),
//   la luminosité moyenne, et le temps de calcul d'une image.
//
// Les réglages viennent de src/rendus/ambiances.json : « Enregistrer dans le jeu »
// réécrit ce fichier (seulement avec npm run dev). La « planche » range les quatre
// ambiances côte à côte dans captures/ ; le « tour complet » fait une planche par
// niveau et un tableau des mesures.
//
// Dans la console : __atelier.choisir({ niveau, style, ambiance }), __atelier.planche(),
// __atelier.tourComplet({ styles: 'tous' }), __atelier.mesure (la dernière mesure).
// ─────────────────────────────────────────────────────────────
import { chargerNiveau } from './jeu/niveau.js';
import { creerPartie, majPartie, construire, ameliorer, lancerVague, estDisponible, tourSur } from './jeu/moteur.js';
import { MONDES } from './jeu/campagne.js';
import AMBIANCES from './rendus/ambiances.json';
import { formaterAmbiances } from './rendus/format-ambiances.js';
import { compterVisite } from './compteur.js';

compterVisite('lumieres'); // une visite de plus (voir compteur.js)

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const ficheDe = (id) => FICHES[`./niveaux/${id}.json`];
const STYLES = {
  pixel: () => import('./rendus/pixel.js'),
  cartoon: () => import('./rendus/cartoon.js'),
  voxel: () => import('./rendus/voxel.js'),
};
const NOMS_STYLES = { pixel: 'Pixel', cartoon: 'Cartoon', voxel: 'Voxel' };
const NOMS_AMBIANCES = { doree: 'Heure dorée', aube: 'Aube brumeuse', midi: 'Plein midi', nuit: 'Nuit' };
const LISTE_AMBIANCES = Object.keys(NOMS_AMBIANCES);

// Les seuils des mesures (luminosité de 0 = noir à 1 = blanc)
const SEUIL_BRULE = 0.93;   // au-dessus : presque blanc, on ne voit plus de détail
const SEUIL_BOUCHE = 0.035; // en dessous : presque noir
const ALERTE_BRULE = [1.5, 4];    // en % de l'image : « attention », puis « trop »
const ALERTE_BOUCHE = [35, 60];

// Ce que chaque réglage veut dire (affiché à côté de son curseur)
const NOMS_REGLAGES = {
  soleil: 'Couleur du soleil', intensite: 'Force du soleil', elevation: 'Hauteur du soleil (degrés)',
  azimut: 'Direction du soleil (degrés)', depuis: 'Position du soleil (côté, hauteur, avant)',
  ciel: 'Lumière du ciel', sol: 'Lumière renvoyée par le sol', hemi: 'Force du ciel et du sol',
  densite: 'Épaisseur de la brume', haut: 'Ciel : en haut', horizon: 'Ciel : à l’horizon', bas: 'Ciel : sous l’horizon',
  halo: 'Halo autour du soleil', expo: 'Exposition (clarté de toute l’image)', bloom: 'Halo des lumières',
  seuil: 'Halo : à partir de quelle clarté', chaleur: 'Chaleur (bleu ← → orangé)', saturation: 'Saturation des couleurs',
  contraste: 'Contraste', rayons: 'Rayons de soleil', rayonsCouleur: 'Couleur des rayons', poussiere: 'Poussière dorée',
  lucioles: 'Lucioles', etoiles: 'Étoiles', nuit: 'Nuit (lanternes allumées)', lueur: 'Lueur des fleurs à contre-jour',
  fond: 'Couleur du fond', voile: 'Voile de couleur (du coin en haut à gauche au coin en bas à droite)',
  couleur: 'Couleur', force: 'Force', vignette: 'Vignette (bords assombris)',
  ombre: 'Ombres portées (direction et force)', dx: 'Vers la droite (par pixel de hauteur)', dy: 'Vers le bas (par pixel de hauteur)',
  lumieres: 'Lumières du jeu (lanternes, feu…)', nuages: 'Ombres des nuages', vent: 'Vent (arbres, herbes, feuilles)',
  rim: 'Liseré de lumière (bord des personnages)', rimCouleur: 'Couleur du liseré', eau: 'Eau (au milieu)', eauBord: 'Eau (près du bord)', ecume: 'Écume',
};
// Les bornes des curseurs : [minimum, maximum, pas]
const BORNES = {
  intensite: [0, 6, 0.05], hemi: [0, 3, 0.05], elevation: [0, 90, 1], azimut: [0, 360, 1], densite: [0, 0.03, 0.0005],
  expo: [0.4, 2, 0.01], bloom: [0, 2, 0.01], seuil: [0, 1, 0.01], chaleur: [-1, 1, 0.01], saturation: [0, 2, 0.01],
  contraste: [0.5, 1.5, 0.01], rayons: [0, 1.5, 0.01], poussiere: [0, 1.5, 0.01], lucioles: [0, 1.5, 0.01],
  etoiles: [0, 1, 0.01], nuit: [0, 1, 0.01], lueur: [0, 1, 0.01], force: [0, 1, 0.01], brume: [0, 1, 0.01],
  vignette: [0, 1, 0.01], depuis: [-40, 40, 0.5],
  dx: [-2, 2, 0.05], dy: [-1, 1, 0.02], lumieres: [0, 2, 0.01], nuages: [0, 0.5, 0.01], vent: [0, 2, 0.05], rim: [0, 1, 0.01],
};

const $ = (s) => document.querySelector(s);
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}
const nombre = (v, chiffres = 1) => v.toLocaleString('fr-FR', { maximumFractionDigits: chiffres, minimumFractionDigits: chiffres });

// ── Ce qu'on regarde (lu dans l'adresse, pour pouvoir y revenir) ──
const params = new URLSearchParams(location.search);
const IDS = Object.keys(FICHES).map((chemin) => chemin.slice('./niveaux/'.length, -'.json'.length));
const ORDRE = [
  ...MONDES.flatMap((m) => m.niveaux).filter((id) => IDS.includes(id)),
  ...IDS.filter((id) => ficheDe(id).survie),
  ...IDS.filter((id) => !ficheDe(id).survie && !MONDES.some((m) => m.niveaux.includes(id))),
];
const choix = {
  niveau: IDS.includes(params.get('niveau')) ? params.get('niveau') : ORDRE[0],
  style: STYLES[params.get('style')] ? params.get('style') : null, // null : le style du niveau
  ambiance: NOMS_AMBIANCES[params.get('ambiance')] ? params.get('ambiance') : null,
  scene: params.get('scene') === 'calme' ? 'calme' : 'bataille',
  qualite: params.get('qualite') === 'econome' ? 'econome' : 'complete',
  camera: params.get('camera') === 'cinema' ? 'cinema' : 'haute',
  zebrures: params.get('zebrures') !== 'non',
};
const AVANT = structuredClone(AMBIANCES); // pour « Annuler mes changements »

let niveau = null;
let rendu = null;
let etat = null;
let enPause = false; // pendant une planche ou le tour complet, la boucle ne dessine plus
const ui = { survol: -1, selection: -1, apercuPortee: null };
const vue = $('#vue');
const zebrures = $('#zebrures');

// ═════════════════════════════════════════════════════════════
// LA PARTIE QUI SE JOUE TOUTE SEULE
// De l'or à volonté : chaque socle reçoit un gardien (à tour de rôle parmi
// ceux du niveau), et les vagues s'enchaînent. Les gardiens sont au niveau
// 1, 2 ou 3 selon leur socle : on voit les trois apparences, et des monstres
// arrivent à passer un moment devant eux (au niveau 3 partout, ils
// disparaîtraient trop vite pour qu'on voie la bataille).
// ═════════════════════════════════════════════════════════════
function equiper(partie) {
  partie.or = 1e6;
  const types = Object.keys(partie.niveau.gardiens).filter((type) => estDisponible(partie, type));
  if (!types.length) return;
  partie.niveau.socles.forEach((socle, i) => {
    if (!tourSur(partie, i)) construire(partie, i, types[i % types.length]);
    const tour = tourSur(partie, i);
    while (tour && tour.niveau < 1 + (i % 3) && ameliorer(partie, i)) { /* jusqu'à son niveau */ }
  });
}

function avancer(partie, dt) {
  partie.or = 1e6;
  if (partie.statut === 'preparation') { equiper(partie); lancerVague(partie); }
  let reste = dt;
  while (reste > 0 && partie.statut === 'vague') {
    const pas = Math.min(reste, 1 / 60);
    majPartie(partie, pas);
    reste -= pas;
  }
}

// Une partie avancée jusqu'au moment le plus rempli de ses deux premières minutes :
// un premier passage cherche quand il y a le plus de monstres visibles, puis on rejoue
// la même partie (même graine, donc exactement pareil) et on s'arrête à ce moment-là.
// Ainsi les planches se comparent d'une fois sur l'autre.
const visibles = (partie) => partie.ennemis.filter((e) => !e.cache).length;
function simuler(niv, arreter) {
  const partie = creerPartie(niv, 7);
  for (let i = 0; i < 120 * 60; i++) {
    avancer(partie, 1 / 60);
    if (partie.statut === 'gagne' || partie.statut === 'perdu') break;
    if (arreter(partie, i / 60)) break;
    partie.evenements.length = 0; // pendant l'avance rapide, pas d'effets
  }
  return partie;
}
function partieAnimee(niv) {
  let record = -1, quand = 0;
  simuler(niv, (partie, t) => {
    const n = visibles(partie);
    if (n > record) { record = n; quand = t; }
    return false;
  });
  return simuler(niv, (partie, t) => t >= quand);
}

const nouvellePartie = () => (choix.scene === 'bataille' ? partieAnimee(niveau) : creerPartie(niveau, 7));

// ═════════════════════════════════════════════════════════════
// LE STYLE AFFICHÉ
// ═════════════════════════════════════════════════════════════
const styleActuel = () => choix.style || niveau.style;
const ambianceActuelle = () => choix.ambiance || niveau.ambiance;

async function preparerVue() {
  niveau = chargerNiveau(ficheDe(choix.niveau));
  const style = styleActuel();
  const module = await STYLES[style]();
  rendu?.detruire();
  rendu = new module.default(vue, niveau, { ambiance: ambianceActuelle(), camera: choix.camera, qualite: choix.qualite });
  etat = nouvellePartie();
  ajusterZebrures();
  dessinerReglages();
  majAdresse();
}

function majAdresse() {
  const p = new URLSearchParams({ niveau: choix.niveau });
  if (choix.style) p.set('style', choix.style);
  if (choix.ambiance) p.set('ambiance', choix.ambiance);
  if (choix.scene === 'calme') p.set('scene', 'calme');
  if (choix.qualite === 'econome') p.set('qualite', 'econome');
  if (choix.camera === 'cinema') p.set('camera', 'cinema');
  if (!choix.zebrures) p.set('zebrures', 'non');
  history.replaceState(null, '', `?${p}`);
}

// Appliquer tout de suite les réglages modifiés (les curseurs, « Annuler »…)
function appliquerAmbiance() {
  rendu.choisirAmbiance(ambianceActuelle(), true);
}

// ═════════════════════════════════════════════════════════════
// LA BOUCLE
// ═════════════════════════════════════════════════════════════
const temps = []; // le temps des dernières images (en millisecondes)
let derniereMesure = 0;
let avant = performance.now();
function boucle(maintenant) {
  const dt = Math.min(0.05, (maintenant - avant) / 1000);
  avant = maintenant;
  if (rendu && !enPause) {
    if (choix.scene === 'bataille') {
      avancer(etat, dt);
      if (etat.statut === 'gagne' || etat.statut === 'perdu') etat = partieAnimee(niveau);
    }
    const t0 = performance.now();
    rendu.dessiner(etat, choix.scene === 'bataille' ? dt : 0, dt, ui);
    etat.evenements.length = 0;
    temps.push(performance.now() - t0);
    if (temps.length > 60) temps.shift();
    // la mesure se fait juste après le dessin (l'image est encore là)
    if (maintenant - derniereMesure > 400) {
      derniereMesure = maintenant;
      afficherMesure(mesurer(rendu.canvasDuRendu?.() || vue.querySelector('canvas:not(.zebrures)'), 640));
    }
  }
  requestAnimationFrame(boucle);
}

// ═════════════════════════════════════════════════════════════
// LES MESURES ET LES ZÉBRURES
// On réduit l'image (640 pixels de large), puis on calcule la luminosité de
// chaque pixel : 0,21 × rouge + 0,72 × vert + 0,07 × bleu (l'œil voit le vert
// bien plus clair que le bleu). On compte aussi les « points brûlés » : les
// taches presque blanches d'au moins 4 pixels (une lanterne trop forte, par
// exemple), même quand elles sont trop petites pour peser dans le pourcentage.
// ═════════════════════════════════════════════════════════════
const mesureCanvas = document.createElement('canvas');
const mesureCtx = mesureCanvas.getContext('2d', { willReadFrequently: true });

function mesurer(source, largeur) {
  const hauteur = Math.round(largeur * (source.height / source.width));
  mesureCanvas.width = largeur;
  mesureCanvas.height = hauteur;
  mesureCtx.drawImage(source, 0, 0, largeur, hauteur);
  const { data } = mesureCtx.getImageData(0, 0, largeur, hauteur);
  const marques = new Uint8Array(largeur * hauteur);
  const histo = new Uint32Array(64);
  let brules = 0, bouches = 0, clairs = 0, somme = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
    somme += l;
    histo[Math.min(63, Math.floor(l * 64))]++;
    if (l >= 0.8) clairs++;
    if (l >= SEUIL_BRULE) { brules++; marques[p] = 1; } else if (l <= SEUIL_BOUCHE) bouches++;
  }
  const n = largeur * hauteur;
  return {
    brule: (brules / n) * 100, bouche: (bouches / n) * 100, clair: (clairs / n) * 100, moyenne: somme / n,
    points: compterTaches(marques, largeur, hauteur, 4),
    histo, marques, largeur, hauteur,
    ms: temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : 0,
  };
}

// Combien de taches d'au moins « taille » pixels marqués qui se touchent ?
// (on part de chaque pixel marqué pas encore visité, et on « remplit » sa tache)
function compterTaches(marques, largeur, hauteur, taille) {
  const vu = new Uint8Array(marques.length);
  let taches = 0;
  const pile = [];
  for (let depart = 0; depart < marques.length; depart++) {
    if (!marques[depart] || vu[depart]) continue;
    let n = 0;
    pile.push(depart);
    vu[depart] = 1;
    while (pile.length) {
      const p = pile.pop();
      n++;
      const x = p % largeur, y = (p - x) / largeur;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, q = ny * largeur + nx;
        if (nx >= 0 && ny >= 0 && nx < largeur && ny < hauteur && marques[q] && !vu[q]) { vu[q] = 1; pile.push(q); }
      }
    }
    if (n >= taille) taches++;
  }
  return taches;
}

const alerte = (valeur, [attention, trop]) => (valeur >= trop ? 'trop' : valeur >= attention ? 'attention' : 'bien');

// Le motif des zébrures : une rayure rouge en diagonale
const motif = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 8;
  const ctx = c.getContext('2d');
  ctx.strokeStyle = 'rgba(255,40,40,0.9)';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-2, 10); ctx.lineTo(10, -2); ctx.moveTo(-2, 2); ctx.lineTo(2, -2); ctx.moveTo(6, 10); ctx.lineTo(10, 6); ctx.stroke();
  return c;
})();

// Peint les zébrures d'une mesure sur un canvas (par rangées : les pixels marqués côte à côte d'un seul coup)
function peindreZebrures(ctx, m, l, h) {
  ctx.fillStyle = ctx.createPattern(motif, 'repeat');
  const sx = l / m.largeur, sy = h / m.hauteur;
  for (let y = 0; y < m.hauteur; y++) {
    for (let x = 0; x < m.largeur; x++) {
      if (!m.marques[y * m.largeur + x]) continue;
      let fin = x;
      while (fin + 1 < m.largeur && m.marques[y * m.largeur + fin + 1]) fin++;
      ctx.fillRect(x * sx, y * sy, (fin - x + 1) * sx, sy + 0.5);
      x = fin;
    }
  }
}

function ajusterZebrures() {
  const r = vue.getBoundingClientRect();
  zebrures.width = Math.round(r.width);
  zebrures.height = Math.round(r.height);
}

let derniere = null;
function afficherMesure(m) {
  derniere = m;
  const ctx = zebrures.getContext('2d');
  ctx.clearRect(0, 0, zebrures.width, zebrures.height);
  if (choix.zebrures) peindreZebrures(ctx, m, zebrures.width, zebrures.height);

  const lignes = [
    ['Zones brûlées', `${nombre(m.brule)} %`, alerte(m.brule, ALERTE_BRULE)],
    ['Points brûlés', String(m.points), m.points >= 6 ? 'trop' : m.points >= 2 ? 'attention' : 'bien'],
    ['Très clair (plus de 0,8)', `${nombre(m.clair)} %`, 'bien'],
    ['Zones bouchées', `${nombre(m.bouche, 0)} %`, alerte(m.bouche, ALERTE_BOUCHE)],
    ['Luminosité moyenne', nombre(m.moyenne, 2), m.moyenne < 0.12 ? 'attention' : 'bien'],
    ['Une image', `${nombre(m.ms)} ms`, m.ms > 14 ? 'attention' : 'bien'],
  ];
  const info = rendu?.renderer?.info?.render;
  if (info) lignes.push(['Dessins par image', `${info.calls} (${nombre(info.triangles / 1000, 0)} k triangles)`, 'bien']);
  const histo = element('canvas', 'histogramme');
  histo.width = 256;
  histo.height = 56;
  const hctx = histo.getContext('2d');
  const max = Math.max(...m.histo);
  m.histo.forEach((v, i) => {
    hctx.fillStyle = i / 64 >= SEUIL_BRULE ? '#ff5a4a' : i / 64 <= SEUIL_BOUCHE ? '#5a6aff' : '#e9d6b8';
    const hh = Math.round((v / max) * 54);
    hctx.fillRect(i * 4, 56 - hh, 3, hh);
  });
  $('#mesures').replaceChildren(
    ...lignes.map(([nom, valeur, niveauAlerte]) => {
      const ligne = element('p', `mesure ${niveauAlerte}`);
      ligne.append(element('span', '', nom), element('strong', '', valeur));
      return ligne;
    }),
    histo,
    element('p', 'legende-histo', 'Combien de pixels de chaque clarté, du noir (à gauche) au blanc (à droite)'),
  );
}

// ═════════════════════════════════════════════════════════════
// LES CURSEURS (fabriqués à partir des réglages de l'ambiance affichée)
// ═════════════════════════════════════════════════════════════
const estCouleur = (v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

function dessinerReglages() {
  const style = styleActuel(), ambiance = ambianceActuelle();
  $('#titre-reglages').textContent = `Réglages : ${NOMS_STYLES[style]}, ${NOMS_AMBIANCES[ambiance].toLowerCase()}`;
  const reglages = AMBIANCES[style][ambiance];
  $('#reglages').replaceChildren(...Object.keys(reglages).map((cle) => reglage(reglages, cle, cle)));
}

// Un réglage : un curseur (nombre), une pastille (couleur), ou un petit groupe (liste, objet)
function reglage(objet, cle, nom) {
  const valeur = objet[cle];
  const titre = NOMS_REGLAGES[nom] || nom;
  if (Array.isArray(valeur) || (valeur && typeof valeur === 'object')) {
    const groupe = element('fieldset', 'groupe');
    groupe.append(element('legend', '', titre));
    for (const sous of Object.keys(valeur)) groupe.append(reglage(valeur, sous, Array.isArray(valeur) && typeof valeur[sous] !== 'object' ? nom : sous));
    return groupe;
  }
  const ligne = element('label', 'reglage');
  ligne.append(element('span', 'nom', Array.isArray(objet) && typeof valeur === 'number' ? `${titre.split(' (')[0]} ${Number(cle) + 1}` : titre));
  if (estCouleur(valeur)) {
    const champ = element('input');
    champ.type = 'color';
    champ.value = valeur;
    champ.addEventListener('input', () => { objet[cle] = champ.value; appliquerAmbiance(); });
    ligne.append(champ, element('output', '', valeur));
    champ.addEventListener('input', () => { ligne.querySelector('output').textContent = champ.value; });
  } else {
    const [min, max, pas] = BORNES[nom] || [0, Math.max(1, Math.abs(valeur) * 2), 0.01];
    const champ = element('input');
    champ.type = 'range';
    Object.assign(champ, { min: Math.min(min, valeur), max: Math.max(max, valeur), step: pas, value: valeur });
    const sortie = element('output', '', String(valeur));
    champ.addEventListener('input', () => {
      objet[cle] = Number(champ.value);
      sortie.textContent = champ.value;
      appliquerAmbiance();
    });
    ligne.append(champ, sortie);
  }
  return ligne;
}

function dire(texte, erreur = false) {
  const p = $('#etat');
  p.textContent = texte;
  p.classList.toggle('erreur', erreur);
}

function dessinerActions() {
  const actions = [
    ['Annuler mes changements', () => {
      for (const style of Object.keys(AVANT)) for (const amb of Object.keys(AVANT[style])) AMBIANCES[style][amb] = structuredClone(AVANT[style][amb]);
      appliquerAmbiance();
      dessinerReglages();
      dire('Les réglages sont revenus comme dans le fichier.');
    }],
    ['Copier les réglages', async () => {
      try {
        await navigator.clipboard.writeText(formaterAmbiances(AMBIANCES));
        dire('Réglages copiés : il n’y a plus qu’à les coller dans src/rendus/ambiances.json.');
      } catch {
        dire('Le navigateur a refusé de copier.', true);
      }
    }],
    ['Planche des 4 ambiances', () => planche()],
  ];
  if (import.meta.env.DEV) {
    actions.splice(2, 0, ['Enregistrer dans le jeu', enregistrer]);
    actions.push(['Tour complet (tous les niveaux)', () => tourComplet()]);
  }
  $('#actions').replaceChildren(...actions.map(([texte, action], i) => {
    const b = element('button', i === 2 && import.meta.env.DEV ? 'principal' : '', texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }));
  if (!import.meta.env.DEV) $('#actions').append(element('p', 'note', 'En ligne, l’atelier ne peut pas enregistrer : copie les réglages, ou lance le jeu avec npm run dev.'));
}

async function enregistrer() {
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__ambiances', { method: 'POST', body: JSON.stringify(AMBIANCES) });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
    dire(`Enregistré dans ${donnees.fichier}. Le jeu prend ces réglages dès maintenant.`);
  } catch (e) {
    dire(`Pas enregistré : ${e.message}`, true);
  }
}

// ═════════════════════════════════════════════════════════════
// LA PLANCHE (les 4 ambiances côte à côte) ET LE TOUR COMPLET
// ═════════════════════════════════════════════════════════════
// Dessine quelques images sans faire avancer la partie (les effets restent en place),
// puis mesure le temps moyen d'une image (en relisant l'image à la fin : on attend
// que la carte graphique ait vraiment tout dessiné)
function photographier(source, largeur) {
  for (let i = 0; i < 3; i++) rendu.dessiner(etat, 0, 1 / 60, ui);
  const t0 = performance.now();
  for (let i = 0; i < 12; i++) rendu.dessiner(etat, 0, 1 / 60, ui);
  const m = mesurer(source, largeur);
  m.ms = (performance.now() - t0) / 12;
  return m;
}

async function planche({ enregistrer = import.meta.env.DEV } = {}) {
  enPause = true;
  const L = 640, H = Math.round(640 * (vue.clientHeight / vue.clientWidth)), BANDE = 26;
  const c = element('canvas');
  c.width = L * 2;
  c.height = (H + BANDE) * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  const resultats = [];
  const source = rendu.canvasDuRendu?.() || vue.querySelector('canvas:not(.zebrures)');
  LISTE_AMBIANCES.forEach((ambiance, i) => {
    rendu.choisirAmbiance(ambiance, true);
    const m = photographier(source, L);
    const x = (i % 2) * L, y = Math.floor(i / 2) * (H + BANDE);
    ctx.drawImage(source, x, y + BANDE, L, H);
    ctx.save();
    ctx.translate(x, y + BANDE);
    peindreZebrures(ctx, m, L, H);
    ctx.restore();
    ctx.fillStyle = m.brule >= ALERTE_BRULE[1] ? '#ff6a5a' : m.brule >= ALERTE_BRULE[0] ? '#ffc04a' : '#e9d6b8';
    ctx.font = '16px "Pixelify Sans", sans-serif';
    ctx.fillText(`${NOMS_AMBIANCES[ambiance]} — brûlé ${nombre(m.brule)} % (${m.points} points) · bouché ${nombre(m.bouche, 0)} % · moyenne ${nombre(m.moyenne, 2)} · ${nombre(m.ms)} ms`, x + 8, y + 18);
    resultats.push({ niveau: choix.niveau, style: styleActuel(), ambiance, brule: m.brule, points: m.points, clair: m.clair, bouche: m.bouche, moyenne: m.moyenne, ms: m.ms });
  });
  rendu.choisirAmbiance(ambianceActuelle(), true);
  enPause = false;
  const nom = `atelier-${choix.niveau}-${styleActuel()}`;
  if (enregistrer) {
    await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image: c.toDataURL('image/jpeg', 0.86) }) });
    dire(`Planche rangée dans captures/${nom}.jpg`);
  } else {
    const lien = element('a');
    lien.href = c.toDataURL('image/jpeg', 0.86);
    lien.download = `${nom}.jpg`;
    lien.click();
  }
  return resultats;
}

// Tous les niveaux, dans leur style (ou dans les trois styles), avec une planche chacun
async function tourComplet({ styles = 'niveau', niveaux = ORDRE } = {}) {
  const tous = [];
  const avantChoix = { ...choix };
  $('#tour').hidden = false;
  for (const id of niveaux) {
    const fiche = ficheDe(id);
    for (const style of styles === 'tous' ? Object.keys(STYLES) : [fiche.style]) {
      Object.assign(choix, { niveau: id, style, scene: 'bataille' });
      dire(`Tour complet : ${fiche.nom} (${NOMS_STYLES[style]})…`);
      await preparerVue();
      tous.push(...await planche({ enregistrer: true }));
      afficherTableau(tous);
    }
  }
  Object.assign(choix, avantChoix);
  await preparerVue();
  dire(`Tour complet terminé : ${tous.length} images mesurées, planches dans captures/.`);
  return tous;
}

function afficherTableau(lignes) {
  const table = $('#resultats');
  const tete = element('tr');
  for (const t of ['Niveau', 'Style', 'Ambiance', 'Brûlé', 'Points brûlés', 'Bouché', 'Moyenne', 'Une image']) tete.append(element('th', '', t));
  table.replaceChildren(tete, ...lignes.map((l) => {
    const tr = element('tr');
    tr.append(
      element('td', '', ficheDe(l.niveau).nom), element('td', '', NOMS_STYLES[l.style]), element('td', '', NOMS_AMBIANCES[l.ambiance]),
      element('td', alerte(l.brule, ALERTE_BRULE), `${nombre(l.brule)} %`), element('td', l.points >= 6 ? 'trop' : l.points >= 2 ? 'attention' : '', String(l.points)),
      element('td', alerte(l.bouche, ALERTE_BOUCHE), `${nombre(l.bouche, 0)} %`),
      element('td', l.moyenne < 0.12 ? 'attention' : '', nombre(l.moyenne, 2)), element('td', l.ms > 14 ? 'attention' : '', `${nombre(l.ms)} ms`),
    );
    return tr;
  }));
}

// ═════════════════════════════════════════════════════════════
// LE FORMULAIRE DES CHOIX
// ═════════════════════════════════════════════════════════════
function liste(nom, etiquette, options, valeur, quandChange) {
  const label = element('label', 'choix-liste');
  label.append(element('span', '', etiquette));
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
  const groupes = MONDES.map((m) => ({ groupe: `Monde ${m.numero} (${NOMS_STYLES[m.style]})`, options: m.niveaux.filter((id) => IDS.includes(id)).map((id) => [id, ficheDe(id).nom]) }));
  const autres = ORDRE.filter((id) => !MONDES.some((m) => m.niveaux.includes(id)));
  if (autres.length) groupes.push({ groupe: 'Défis et essais', options: autres.map((id) => [id, ficheDe(id).nom]) });
  const zebre = element('label', 'choix-case');
  const caseZebre = element('input');
  caseZebre.type = 'checkbox';
  caseZebre.checked = choix.zebrures;
  caseZebre.addEventListener('change', () => { choix.zebrures = caseZebre.checked; majAdresse(); });
  zebre.append(caseZebre, element('span', '', 'Zébrures'));
  $('#choix').replaceChildren(
    liste('niveau', 'Niveau', groupes, choix.niveau, (v) => { choix.niveau = v; preparerVue(); }),
    liste('style', 'Style', [['', 'Celui du niveau'], ...Object.entries(NOMS_STYLES)], choix.style || '', (v) => { choix.style = v || null; preparerVue(); }),
    liste('ambiance', 'Ambiance', [['', 'Celle du niveau'], ...Object.entries(NOMS_AMBIANCES)], choix.ambiance || '', (v) => {
      choix.ambiance = v || null;
      appliquerAmbiance();
      dessinerReglages();
      majAdresse();
    }),
    liste('scene', 'Scène', [['bataille', 'Une bataille'], ['calme', 'Le calme']], choix.scene, (v) => { choix.scene = v; etat = nouvellePartie(); majAdresse(); }),
    liste('qualite', 'Qualité', [['complete', 'Complète'], ['econome', 'Économe']], choix.qualite, (v) => { choix.qualite = v; preparerVue(); }),
    liste('camera', 'Caméra (voxel)', [['haute', 'Vue de jeu'], ['cinema', 'Cinéma']], choix.camera, (v) => { choix.camera = v; rendu.choisirCamera?.(v); majAdresse(); }),
    zebre,
  );
}

addEventListener('resize', () => { rendu?.redimensionner(); ajusterZebrures(); });

// ── C'est parti ──
dessinerChoix();
dessinerActions();
preparerVue().then(() => requestAnimationFrame(boucle));

window.__atelier = {
  get etat() { return etat; },
  get rendu() { return rendu; },
  get mesure() { return derniere && { brule: derniere.brule, bouche: derniere.bouche, moyenne: derniere.moyenne, ms: derniere.ms }; },
  async choisir(nouveaux) { Object.assign(choix, nouveaux); dessinerChoix(); await preparerVue(); },
  planche,
  tourComplet,
  AMBIANCES,
  // Enregistre la vue en grand dans captures/nom.jpg (zone = [x, y, largeur, hauteur], de 0 à 1, pour un gros plan)
  async capturer(nom, { ambiance = null, zone = null, avancer: secondes = 0 } = {}) {
    enPause = true;
    if (ambiance) rendu.choisirAmbiance(ambiance, true);
    for (let t = 0; t < secondes; t += 1 / 30) { avancer(etat, 1 / 30); rendu.dessiner(etat, 1 / 30, 1 / 30, ui); etat.evenements.length = 0; }
    rendu.dessiner(etat, 0, 1 / 60, ui);
    const source = vue.querySelector('canvas:not(.zebrures)');
    const [zx, zy, zl, zh] = zone || [0, 0, 1, 1];
    const c = element('canvas');
    c.width = Math.round(source.width * zl);
    c.height = Math.round(source.height * zh);
    c.getContext('2d').drawImage(source, source.width * zx, source.height * zy, c.width, c.height, 0, 0, c.width, c.height);
    if (ambiance) rendu.choisirAmbiance(ambianceActuelle(), true);
    enPause = false;
    await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image: c.toDataURL('image/jpeg', 0.9) }) });
    return `captures/${nom}.jpg`;
  },
};
