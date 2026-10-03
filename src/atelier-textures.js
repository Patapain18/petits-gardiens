// ─────────────────────────────────────────────────────────────
// L'ATELIER DES TEXTURES (la page textures.html, un outil d'atelier)
// Les textures des trois styles sont fabriquées d'après des recettes
// (src/rendus/textures.json) :
// - le voxel et le pixel art : des petits carrés de 16 × 16 pixels (voir
//   rendus/recettes.js), posés bloc par bloc ou case par case ;
// - le cartoon : une grande toile peinte au pinceau (voir rendus/peintures.js).
// Ici, on choisit un style et une texture, et on la regarde de trois façons :
// - en gros plan, avant et après les réglages ;
// - en grand (un sol de 4 × 4 blocs ou cases, avec ses variantes tournées, ou un
//   morceau de toile de 6,4 × 6,4 cases) : on voit si elle se répète, si les
//   bords des blocs dessinent un quadrillage ;
// - dans un vrai niveau, sous les quatre ambiances, de loin ou de près.
// Et des mesures, pour ne pas se fier seulement à ses yeux (voir mesurerTexture
// et mesurerPeinture).
//
// « Enregistrer dans le jeu » réécrit textures.json (seulement avec npm run dev).
// Les planches rangent leurs images dans captures/ :
// - la planche des textures : toutes les textures du style en gros plan et en grand ;
// - le banc d'essai : le niveau sous les quatre ambiances, de loin et de près ;
// - avant / après : les mêmes vues, avec les recettes du fichier puis les tiennes.
//
// Dans la console : __textures.choisir({ style, texture, niveau, ambiance, vue }),
// __textures.recettes (les recettes en cours du style), __textures.planche(),
// __textures.banc(), __textures.avantApres(), __textures.capturer(nom).
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import RenduVoxel from './rendus/voxel.js';
import RenduCartoon from './rendus/cartoon.js';
import RenduPixel from './rendus/pixel.js';
import TEXTURES from './rendus/textures.json';
import { COUCHES, TAILLE, fabriquerTexture, assemblerTerrain, mesurerTexture } from './rendus/recettes.js';
import { PINCEAUX, COTE_SCENE, scene, echantillon, mesurerPeinture } from './rendus/peintures.js';
import { formaterTextures, VARIANTES_MAX, COUCHES_MAX, COULEURS_MAX } from './rendus/format-textures.js';
import { chargerNiveau } from './jeu/niveau.js';
import { creerPartie, construire, ameliorer, estDisponible, tourSur } from './jeu/moteur.js';
import { MONDES } from './jeu/campagne.js';
import { compterVisite } from './compteur.js';

compterVisite('textures'); // une visite de plus (voir compteur.js)

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const ficheDe = (id) => FICHES[`./niveaux/${id}.json`];
const NOMS_AMBIANCES = { doree: 'Heure dorée', aube: 'Aube brumeuse', midi: 'Plein midi', nuit: 'Nuit' };
const VUES = {
  jeu: 'Vue de jeu', cinema: 'Cinéma', chemin: 'De près : le chemin', socle: 'De près : un socle',
  chateau: 'De près : le château', arbre: 'De près : un arbre', etang: 'De près : l’étang',
};

// ── Les trois styles ─────────────────────────────────────────
// Pour chacun : son rendu, son niveau de départ, ses textures (rangées par famille, avec leur nom
// affiché), les sols (vus de dessus sur de grandes surfaces : c'est pour eux que le bruit, les
// coutures et la répétition se voient le plus, et que les mesures sonnent l'alerte), ses vues, et
// si ses textures sont peintes (le cartoon) ou faites de petits carrés de 16 × 16 (les deux autres).
const STYLES = {
  voxel: {
    nom: 'Voxel doré', Rendu: RenduVoxel, reglages: { camera: 'haute', qualite: 'complete' }, niveau: 'monde3-1', peint: false,
    noms: {
      herbe: 'Herbe (dessus)', herbeCote: 'Herbe (côté)', terre: 'Terre', chemin: 'Chemin', sable: 'Sable', neige: 'Neige',
      pierre: 'Pierre', mousse: 'Pierre moussue', eau: 'Eau', tronc: 'Tronc', bouleau: 'Bouleau', feuilles: 'Feuilles',
      planches: 'Planches', briques: 'Briques', toit: 'Toit', laine: 'Laine (drapeaux)', lanterne: 'Lanterne',
      sombre: 'Sombre (portes)', grain: 'Grain des personnages',
    },
    familles: [
      ['Le sol', ['herbe', 'herbeCote', 'terre', 'chemin', 'sable', 'neige', 'pierre', 'mousse', 'eau']],
      ['Les arbres et le bois', ['tronc', 'bouleau', 'feuilles', 'planches']],
      ['Le château et les objets', ['briques', 'toit', 'laine', 'lanterne', 'sombre']],
      ['Les personnages', ['grain']],
    ],
    sols: ['herbe', 'terre', 'chemin', 'sable', 'neige', 'pierre', 'mousse'],
    vues: ['jeu', 'cinema', 'chemin', 'socle', 'chateau', 'arbre', 'etang'],
    unite: 'bloc',
  },
  cartoon: {
    nom: 'Diorama cartoon', Rendu: RenduCartoon, reglages: { qualite: 'complete' }, niveau: 'monde2-1', peint: true,
    noms: { herbe: 'Herbe', chemin: 'Chemin', terre: 'Terre (socles)', berge: 'Berge des étangs', cour: 'Cour du château' },
    familles: [['Le sol (une toile peinte au pinceau)', ['herbe', 'chemin', 'terre', 'berge', 'cour']]],
    sols: ['herbe', 'chemin', 'terre', 'berge', 'cour'],
    vues: ['jeu', 'chemin', 'socle', 'chateau', 'arbre', 'etang'],
  },
  pixel: {
    nom: 'Pixel art', Rendu: RenduPixel, reglages: {}, niveau: 'monde1-2', peint: false,
    noms: { herbe: 'Herbe', chemin: 'Chemin', bord: 'Bord du chemin', sable: 'Sable des berges', terre: 'Terre (socles)' },
    familles: [['Le sol (une case = 16 × 16 pixels)', ['herbe', 'chemin', 'bord', 'sable', 'terre']]],
    sols: ['herbe', 'chemin', 'sable', 'terre'],
    vues: ['jeu', 'chemin', 'socle', 'chateau', 'arbre', 'etang'],
    unite: 'case',
  },
};
const LOIN = ['chemin', 'socle', 'chateau', 'arbre', 'etang']; // les vues de près

// Ce que chaque réglage de couche veut dire
const NOMS_REGLAGES = {
  rampe: 'Rampe', part: 'Part des pixels', min: 'Hauteur la plus petite', max: 'Hauteur la plus grande', taille: 'Taille (pixels)',
  seuil: 'Seuil', haut: 'Vers le haut', hauteur: 'Hauteur', largeur: 'Largeur', pas: 'Pas', depart: 'Départ',
  a: 'a (× y)', b: 'b (× x)', epaisseur: 'Épaisseur', seuils: 'Seuils', hasard: 'Hasard', force: 'Force', nombre: 'Nombre', longueur: 'Longueur',
  variantes: 'Variantes', ombre: 'Ombre', nuances: 'Nuances', relief: 'Relief', sens: 'Sens (0 debout, 1 couché)', rayon: 'Rayon',
};
// … et dans les recettes peintes (les longueurs y sont en cases)
const NOMS_REGLAGES_PEINTS = {
  ...NOMS_REGLAGES,
  largeur: 'Largeur (cases)', taille: 'Taille (cases)', ondulation: 'Ondulation (cases)', opacite: 'Opacité', douceur: 'Douceur',
  densite: 'Densité (par case)', min: 'Rayon min (cases)', longueur: 'Longueur (cases)', epaisseur: 'Épaisseur (cases)',
  penche: 'Penche', ecart: 'Écart', rayon: 'Rayon (cases)', trous: 'Trous', joints: 'Rampe des joints', joint: 'Joint (cases)',
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
  ...IDS.filter((id) => !MONDES.some((m) => m.niveaux.includes(id))),
];
const styleDemande = STYLES[params.get('style')] ? params.get('style') : 'voxel';
const choix = {
  style: styleDemande,
  texture: params.get('texture'),
  niveau: IDS.includes(params.get('niveau')) ? params.get('niveau') : STYLES[styleDemande].niveau,
  ambiance: NOMS_AMBIANCES[params.get('ambiance')] ? params.get('ambiance') : null, // null : celle du niveau
  vue: VUES[params.get('vue')] ? params.get('vue') : 'jeu',
};

// ── Les recettes ─────────────────────────────────────────────
// RECETTES : celles en cours du style choisi. C'est le même objet que lit le rendu de ce style :
// quand l'atelier le change, le rendu prend les nouvelles recettes. AVANTS : le fichier, pour
// comparer (tous les styles ; AVANT : celui du style choisi).
let AVANTS = structuredClone(TEXTURES);
let RECETTES, AVANT, NOMS, CONFIG;
function prendreStyle(style) {
  choix.style = style;
  CONFIG = STYLES[style];
  RECETTES = TEXTURES[style];
  AVANT = AVANTS[style];
  NOMS = Object.keys(RECETTES);
  for (const nom of NOMS) if (!CONFIG.familles.some(([, liste]) => liste.includes(nom))) CONFIG.familles.push(['Autres', [nom]]);
  if (!NOMS.includes(choix.texture)) choix.texture = NOMS.includes('herbe') ? 'herbe' : NOMS[0];
  if (!CONFIG.vues.includes(choix.vue)) choix.vue = 'jeu';
}
prendreStyle(choix.style);
const peint = () => CONFIG.peint;

let niveau = null;
let rendu = null;
let etat = null;
let enPause = false;          // pendant une planche, la boucle ne dessine plus
let structureDuRendu = '';    // (voxel) les variantes, tours et miroirs des recettes quand le rendu a été construit
let montreAvant = false;      // la vue montre-t-elle l'avant (les recettes du fichier) ?
let misDeCote = null;         // pendant ce temps, les recettes « après », mises de côté
const ui = { survol: -1, selection: -1, apercuPortee: null };
const vue = $('#vue');

// Les recettes « après » (les tiennes), même pendant qu'on montre l'avant
const recetteApres = (nom) => (montreAvant ? misDeCote[nom] : RECETTES[nom]);
const structure = () => NOMS.map((n) => `${RECETTES[n].variantes}${RECETTES[n].tourner ? 't' : ''}${RECETTES[n].miroir ? 'm' : ''}`).join(',');

// ═════════════════════════════════════════════════════════════
// LE NIVEAU
// Une partie au calme : de l'or à volonté, un gardien sur chaque socle (du
// niveau 1 au niveau 3, pour voir les trois apparences), et pas de vague.
// ═════════════════════════════════════════════════════════════
function nouvellePartie() {
  const partie = creerPartie(niveau, 7);
  partie.or = 1e6;
  const types = Object.keys(partie.niveau.gardiens).filter((type) => estDisponible(partie, type));
  partie.niveau.socles.forEach((socle, i) => {
    if (!types.length || socle.bonus) return;
    construire(partie, i, types[i % types.length]);
    const tour = tourSur(partie, i);
    while (tour && tour.niveau < 1 + (i % 3) && ameliorer(partie, i)) { /* jusqu'à son niveau */ }
  });
  return partie;
}

const ambianceActuelle = () => choix.ambiance || niveau.ambiance;

async function preparerVue() {
  niveau = chargerNiveau(ficheDe(choix.niveau));
  rendu?.detruire();
  vue.replaceChildren();
  rendu = new CONFIG.Rendu(vue, niveau, { ambiance: ambianceActuelle(), ...CONFIG.reglages });
  structureDuRendu = structure();
  etat = nouvellePartie();
  rendu.dessiner(etat, 0, 0, ui);
  placerVue();
  majAdresse();
}

// Un endroit à regarder de près : [x, hauteur, y] dans le monde (une case du jeu = 1)
function pointDeVue(nom) {
  const n = niveau;
  switch (nom) {
    case 'chemin': { const p = n.chemin[Math.floor(n.chemin.length * 0.45)]; return [p.x, 0, p.y]; }
    case 'socle': { const s = n.socles.find((x) => !x.bonus); return s && [s.x, 0.2, s.y]; }
    case 'chateau': return [n.chateau.x, 0.8, n.chateau.y];
    case 'arbre': {
      const arbres = n.decor.filter((d) => ['chene', 'bouleau', 'automne'].includes(d.type));
      const a = arbres.find((d) => d.dedans) || arbres[0]; // de préférence un arbre de la zone de jeu
      return a && [a.x, 1, a.y];
    }
    case 'etang': { const e = n.etangs[0]; return e && [e.x + e.rayon * 0.6, 0, e.y]; }
    default: return null;
  }
}

// Le pixel art n'a pas de caméra : pour voir de près, on agrandit son image (3 fois), autour du
// point regardé. Renvoie { ox, oy, zoom } (le point, en pixels de la page dans la vue) ou null.
const ZOOM_PIXEL = 3;
function cadrePixel() {
  const point = pointDeVue(choix.vue);
  if (choix.style !== 'pixel' || !point) return null;
  const p = rendu.versPixel(point[0], point[2] - point[1]);
  return { ox: (p.x * rendu.echelle) / rendu.dpr, oy: (p.y * rendu.echelle) / rendu.dpr, zoom: ZOOM_PIXEL };
}

// Place la vue : la vue de jeu, le cinéma (voxel), ou de près
function placerVue() {
  if (!rendu) return;
  const point = pointDeVue(choix.vue);
  if (choix.style === 'voxel') {
    rendu.choisirCamera(choix.vue === 'cinema' ? 'cinema' : 'haute');
    if (point) { // plus bas, pour voir aussi le côté des blocs
      const angle = THREE.MathUtils.degToRad(42);
      rendu.dirCamera.set(0, Math.sin(angle), Math.cos(angle));
      rendu.cible.set(...point);
      rendu.distanceCamera = 5.5;
      rendu.tangage = 0;
    }
    rendu.placerCamera();
  } else if (choix.style === 'cartoon') {
    rendu.cadrer(); // le cadre du jeu
    if (point) { // de près : la caméra (sans perspective) regarde le point, avec un cadre de 6 cases de haut
      rendu.cible.set(...point);
      const demi = 3, ratio = rendu.largeur / rendu.hauteur;
      Object.assign(rendu.camera, { left: -demi * ratio, right: demi * ratio, top: demi, bottom: -demi });
      rendu.camera.updateProjectionMatrix();
      rendu.camera.position.copy(rendu.cible).addScaledVector(rendu.dirCamera, 80);
      rendu.camera.updateMatrixWorld();
    }
  } else {
    const cadre = cadrePixel(), canvas = vue.querySelector('canvas');
    canvas.style.transformOrigin = cadre ? `${cadre.ox}px ${cadre.oy}px` : '';
    canvas.style.transform = cadre ? `scale(${cadre.zoom})` : '';
  }
  majInfoVue();
}

// Combien de pixels d'écran fait un pixel de texture, là où l'on regarde
function majInfoVue() {
  let texte;
  if (choix.style === 'pixel') {
    const z = (rendu.echelle / rendu.dpr) * (cadrePixel()?.zoom || 1);
    texte = `Un pixel du jeu (et de ses textures) fait ${nombre(z)} pixels d’écran.`;
  } else {
    const cible = choix.style === 'voxel' ? rendu.cible.clone() : new THREE.Vector3(...(pointDeVue(choix.vue) || [rendu.cible.x, 0, rendu.cible.z]));
    const a = cible.clone().project(rendu.camera);
    const b = cible.clone().add(new THREE.Vector3(choix.style === 'voxel' ? 0.5 : 1, 0, 0)).project(rendu.camera);
    const px = (Math.abs(b.x - a.x) / 2) * vue.clientWidth;
    texte = choix.style === 'voxel'
      ? `Au centre de la vue, un bloc fait ${Math.round(px)} pixels d’écran : un pixel de texture en fait ${nombre(px / TAILLE)}.`
      : `Au centre de la vue, une case fait ${Math.round(px)} pixels d’écran : un pixel de la toile du sol (40 par case) en fait ${nombre(px / 40)}.`;
  }
  $('#info-vue').textContent = texte + (montreAvant ? ' Tu regardes l’AVANT (les recettes du fichier).' : '');
}

function majAdresse() {
  const p = new URLSearchParams({ style: choix.style, texture: choix.texture, niveau: choix.niveau, vue: choix.vue });
  if (choix.ambiance) p.set('ambiance', choix.ambiance);
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

// Après un réglage, on met la texture à jour dans le niveau :
// - voxel : on repeint la texture sur place ; si ses variantes, ses tours ou son miroir ont changé,
//   on reconstruit le niveau (un peu plus tard : pas à chaque cran du curseur) ;
// - pixel et cartoon : le rendu repeint son sol (le cartoon, un peu plus tard : sa toile est grande)
let attente = null;
function majTexture3D(nom) {
  if (!rendu) return;
  clearTimeout(attente);
  if (choix.style === 'cartoon') { attente = setTimeout(() => rendu.majTexture(nom, RECETTES[nom]), 120); return; }
  if ((choix.style !== 'voxel' || structure() === structureDuRendu) && rendu.majTexture(nom, RECETTES[nom])) return;
  dire('Je reconstruis le niveau avec les nouvelles variantes…');
  attente = setTimeout(async () => { await preparerVue(); dire(''); }, 350);
}
// Toutes les textures à la fois (le cartoon repeint sa toile une seule fois)
function majToutes3D() {
  if (choix.style === 'cartoon') rendu.majTexture(NOMS[0], RECETTES[NOMS[0]]);
  else for (const n of NOMS) rendu.majTexture(n, RECETTES[n]);
}

// Montrer l'avant (les recettes du fichier) ou l'après (les tiennes), dans le niveau
async function basculerAvant(oui) {
  if (oui === montreAvant) return;
  if (oui) {
    misDeCote = { ...RECETTES };
    for (const n of NOMS) RECETTES[n] = structuredClone(AVANT[n]);
  } else {
    for (const n of NOMS) RECETTES[n] = misDeCote[n];
    misDeCote = null;
  }
  montreAvant = oui;
  $('#bouton-avant')?.setAttribute('aria-pressed', String(oui));
  if (choix.style === 'voxel' && structure() !== structureDuRendu) await preparerVue();
  else majToutes3D();
  majInfoVue();
}

// ═════════════════════════════════════════════════════════════
// LA TEXTURE EN 2D : gros plans, grand sol, vignettes
// ═════════════════════════════════════════════════════════════
// Peint une image de pixels dans un canvas, agrandie (chaque pixel devient un carré), sur un
// damier gris qui montre les pixels transparents (les trous des feuilles)
function peindre(canvas, { largeur, hauteur, pixels }, zoom) {
  canvas.width = largeur * zoom;
  canvas.height = hauteur * zoom;
  const ctx = canvas.getContext('2d');
  for (let y = 0; y < canvas.height; y += 8) {
    for (let x = 0; x < canvas.width; x += 8) {
      ctx.fillStyle = (x + y) % 16 ? '#5a5a5a' : '#3c3c3c';
      ctx.fillRect(x, y, 8, 8);
    }
  }
  const image = element('canvas');
  image.width = largeur;
  image.height = hauteur;
  image.getContext('2d').putImageData(new ImageData(pixels, largeur, hauteur), 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// Les images d'une texture (r : sa recette) :
// - le gros plan : pour les petits carrés, la texture (variante 0) ; pour une toile peinte, un
//   morceau de 2,4 × 2,4 cases de sa scène, à 40 pixels par case (comme dans le jeu) ;
// - en grand : 4 × 4 blocs ou cases (le côté de l'herbe : un mur, avec la terre dessous, comme
//   dans le jeu), ou toute la scène peinte (6,4 × 6,4 cases).
// L'herbe sous une matière peinte est toujours l'herbe « après » (on ne compare que la matière).
const grosPlan = (nom, r) => (peint() ? echantillon(r, nom, recetteApres('herbe'), scene(nom).grosPlan, 40) : fabriquerTexture(r, nom, 0));
const ZOOM_GROS_PLAN = () => (peint() ? 2 : 12);
function enGrand(nom, r, petit = false) {
  if (peint()) return echantillon(r, nom, recetteApres('herbe'), [0, 0, COTE_SCENE, COTE_SCENE], petit ? 20 : 40);
  return assemblerTerrain(r, nom, 4, nom === 'herbeCote' ? { recette: recetteApres('terre'), nom: 'terre' } : null);
}
const ZOOM_EN_GRAND = (petit = false) => (peint() ? 1 : petit ? 2 : 4);

function majApercus() {
  const nom = choix.texture, apres = recetteApres(nom);
  peindre($('#gros-plan-avant'), grosPlan(nom, AVANT[nom]), ZOOM_GROS_PLAN());
  peindre($('#gros-plan-apres'), grosPlan(nom, apres), ZOOM_GROS_PLAN());
  peindre($('#grand-sol'), enGrand(nom, apres), ZOOM_EN_GRAND());
  $('#legende-grand-sol').textContent = peint() ? 'En grand : 6,4 × 6,4 cases de toile' : `Un grand sol : 4 × 4 ${CONFIG.unite}s`;
}

const vignettes = {};
function dessinerBande() {
  $('#bande-textures').replaceChildren(...CONFIG.familles.map(([famille, noms]) => {
    const groupe = element('div', 'famille');
    groupe.append(element('span', 'nom-famille', famille));
    const boutons = element('div', 'vignettes');
    for (const nom of noms) {
      const bouton = element('button', 'vignette');
      bouton.type = 'button';
      bouton.dataset.texture = nom;
      bouton.setAttribute('aria-pressed', String(nom === choix.texture));
      vignettes[nom] = element('canvas');
      bouton.append(vignettes[nom], element('span', '', CONFIG.noms[nom] || nom));
      bouton.addEventListener('click', () => choisirTexture(nom));
      boutons.append(bouton);
      majVignette(nom);
    }
    groupe.append(boutons);
    return groupe;
  }));
}
function majVignette(nom) {
  if (peint()) peindre(vignettes[nom], echantillon(recetteApres(nom), nom, recetteApres('herbe'), scene(nom).grosPlan, 20), 1);
  else peindre(vignettes[nom], fabriquerTexture(recetteApres(nom), nom, 0), 3);
  vignettes[nom].closest('.vignette').classList.toggle('modifiee', JSON.stringify(recetteApres(nom)) !== JSON.stringify(AVANT[nom]));
}

function choisirTexture(nom) {
  choix.texture = nom;
  document.querySelectorAll('.vignette').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.texture === nom)));
  dessinerRecette();
  majApercus();
  afficherMesures();
  majAdresse();
}

// ═════════════════════════════════════════════════════════════
// LES MESURES
// ═════════════════════════════════════════════════════════════
function afficherMesures() {
  const nom = choix.texture, sol = CONFIG.sols.includes(nom);
  let lignes;
  if (peint()) {
    const m = mesurerPeinture(recetteApres(nom), nom);
    const ecart = Math.abs(mesurerPeinture(recetteApres('chemin'), 'chemin').clarte - mesurerPeinture(recetteApres('herbe'), 'herbe').clarte);
    lignes = [
      ['Contraste', nombre(m.contraste, 3), sol && m.contraste < 0.012 ? 'attention' : 'bien',
        'L’écart moyen de clarté d’un pixel à la moyenne : 0, un aplat tout plat ; plus haut, des taches, des touffes, des cailloux bien visibles. Mesuré au cœur de la matière (le milieu du chemin, pas sa bordure).'],
      ['Clarté moyenne', nombre(m.clarte, 2), 'bien', 'De 0 (noir) à 1 (blanc), au cœur de la matière.'],
      ['Saturation', nombre(m.saturation, 2), 'bien', 'De 0 (du gris) à 1 (la couleur la plus vive), au cœur de la matière.'],
      ['Chemin / herbe', `écart ${nombre(ecart, 2)}`, ecart < 0.06 ? 'trop' : ecart < 0.1 ? 'attention' : 'bien',
        'L’écart de clarté entre le milieu du chemin et l’herbe : le chemin doit se détacher, pour que le joueur le voie d’un coup d’œil.'],
    ];
  } else {
    const m = mesurerTexture(recetteApres(nom), nom);
    const clarte = (n) => mesurerTexture(recetteApres(n), n).clarte;
    const ecart = Math.abs(clarte('chemin') - clarte('herbe'));
    lignes = [
      ['Taches', nombre(m.taches, 2), sol && m.taches < 0.15 ? 'attention' : 'bien',
        'La ressemblance entre un pixel et son voisin : 0, chaque pixel est tiré au hasard (une télé sans signal) ; plus haut, les pixels se regroupent en taches ; 1, un aplat.'],
      ['Coutures', nombre(m.coutures, 2), !sol ? 'bien' : m.coutures > 2 ? 'trop' : m.coutures > 1.5 ? 'attention' : 'bien',
        `Sur un grand sol : l’écart entre deux pixels de part et d’autre du bord d’un ${CONFIG.unite}, comparé à l’écart à l’intérieur. Vers 1, on ne voit pas les bords ; plus haut, un quadrillage.`],
      ['Aspects différents', String(m.aspects), sol && m.aspects < 2 ? 'attention' : 'bien',
        `Combien d’aspects un ${CONFIG.unite} peut prendre : variantes × tours × miroir. À 1, tous sont pareils, et l’œil voit la répétition.`],
      ['Couleurs', String(m.couleurs), 'bien', 'Combien de couleurs différentes, toutes variantes comprises.'],
      ['Clarté moyenne', nombre(m.clarte, 2), 'bien', 'De 0 (noir) à 1 (blanc).'],
      ['Chemin / herbe', `écart ${nombre(ecart, 2)}`, ecart < 0.06 ? 'trop' : ecart < 0.1 ? 'attention' : 'bien',
        'L’écart de clarté entre le chemin et l’herbe : le chemin doit se détacher, pour que le joueur le voie d’un coup d’œil.'],
    ];
  }
  $('#mesures').replaceChildren(...lignes.map(([nomMesure, valeur, alerte, aide]) => {
    const ligne = element('p', `mesure ${alerte}`);
    ligne.title = aide;
    ligne.append(element('span', '', nomMesure), element('strong', '', valeur));
    return ligne;
  }), element('p', 'legende-mesures', 'Survole une mesure pour savoir ce qu’elle veut dire. Les alertes ne concernent que les sols, vus de dessus sur de grandes surfaces.'));
}

// ═════════════════════════════════════════════════════════════
// LA RECETTE : les rampes, les couches, et le grand sol
// ═════════════════════════════════════════════════════════════
// Un réglage vient de changer (redessiner : les champs eux-mêmes changent, il faut les refaire)
async function changer({ redessiner = false } = {}) {
  const nom = choix.texture;
  if (montreAvant) await basculerAvant(false); // on revient à l'après, pour voir son réglage
  if (redessiner) dessinerRecette();
  majApercus();
  majVignette(nom);
  if (peint() && nom === 'herbe') NOMS.forEach(majVignette); // (l'herbe est sous toutes les vignettes)
  afficherMesures();
  majTexture3D(nom);
}

function petitBouton(texte, titre, action) {
  const b = element('button', 'petit', texte);
  b.type = 'button';
  b.title = titre;
  b.setAttribute('aria-label', titre);
  b.addEventListener('click', action);
  return b;
}

// Un réglage de couche : le nom d'une rampe (une liste), une liste de nombres, ou un curseur.
// defaut : la valeur affichée quand la recette n'a pas ce réglage (celle d'une couche neuve)
function reglage(couche, cle, borne, recette, defaut) {
  const ligne = element('label', 'reglage');
  const valeur = couche[cle] ?? defaut;
  ligne.append(element('span', 'nom', (peint() ? NOMS_REGLAGES_PEINTS : NOMS_REGLAGES)[cle] || cle));
  if (borne === 'rampe') {
    const liste = element('select');
    for (const n of Object.keys(recette.rampes)) liste.append(Object.assign(element('option', '', n), { value: n }));
    liste.value = valeur;
    liste.addEventListener('change', () => { couche[cle] = liste.value; changer(); });
    ligne.append(liste, element('output'));
  } else if (borne === 'liste') {
    const champ = element('input');
    champ.value = valeur.join(' ; ');
    champ.addEventListener('change', () => {
      const nombres = champ.value.split(';').map((t) => Number(t.trim().replace(',', '.'))).filter((v) => Number.isFinite(v));
      if (nombres.length && nombres.length <= 8) { couche[cle] = nombres; changer(); }
      champ.value = (couche[cle] ?? defaut).join(' ; ');
    });
    ligne.append(champ, element('output'));
  } else {
    const [min, max, pas] = borne;
    const curseur = element('input');
    Object.assign(curseur, { type: 'range', min, max, step: pas, value: valeur });
    const sortie = element('output', '', String(valeur));
    curseur.addEventListener('input', () => {
      couche[cle] = Number(curseur.value);
      sortie.textContent = curseur.value;
      changer();
    });
    ligne.append(curseur, sortie);
  }
  return ligne;
}

function dessinerRecette() {
  const nom = choix.texture, r = recetteApres(nom), SORTES = peint() ? PINCEAUX : COUCHES;
  $('#titre-recette').textContent = `Recette : ${CONFIG.noms[nom] || nom}`;

  // 1. Les couleurs, rampe par rampe
  const rampes = element('fieldset', 'groupe');
  rampes.append(element('legend', '', 'Les couleurs (les rampes)'));
  rampes.append(element('p', 'aide', 'Chaque rampe est une liste de couleurs, rangées si possible du plus sombre au plus clair. Les couches y piochent.'));
  for (const [n, couleurs] of Object.entries(r.rampes)) {
    const ligne = element('div', 'rampe');
    ligne.append(element('span', 'nom-rampe', n));
    couleurs.forEach((couleur, i) => {
      const champ = element('input');
      Object.assign(champ, { type: 'color', value: couleur, title: couleur });
      champ.setAttribute('aria-label', `Couleur ${i + 1} de la rampe ${n}`);
      champ.addEventListener('input', () => { couleurs[i] = champ.value; champ.title = champ.value; changer(); });
      ligne.append(champ);
    });
    if (couleurs.length < COULEURS_MAX) ligne.append(petitBouton('+', `Ajouter une couleur à la rampe ${n}`, () => { couleurs.push(couleurs.at(-1)); changer({ redessiner: true }); }));
    if (couleurs.length > 1) ligne.append(petitBouton('−', `Retirer la dernière couleur de la rampe ${n}`, () => { couleurs.pop(); changer({ redessiner: true }); }));
    rampes.append(ligne);
  }

  // 2. Les couches, dans l'ordre où elles sont posées
  const couches = element('div', 'couches');
  r.couches.forEach((couche, i) => {
    const sorte = SORTES[couche.type];
    const bloc = element('fieldset', 'groupe couche');
    bloc.append(element('legend', '', `${i + 1}. ${sorte?.nom || couche.type}`));
    const outils = element('div', 'outils-couche');
    if (i > 0) outils.append(petitBouton('↑', 'Poser cette couche plus tôt', () => { [r.couches[i - 1], r.couches[i]] = [r.couches[i], r.couches[i - 1]]; changer({ redessiner: true }); }));
    if (i < r.couches.length - 1) outils.append(petitBouton('↓', 'Poser cette couche plus tard', () => { [r.couches[i + 1], r.couches[i]] = [r.couches[i], r.couches[i + 1]]; changer({ redessiner: true }); }));
    if (r.couches.length > 1) outils.append(petitBouton('✕', 'Retirer cette couche', () => { r.couches.splice(i, 1); changer({ redessiner: true }); }));
    bloc.append(outils);
    if (sorte) {
      bloc.append(element('p', 'aide', sorte.aide));
      for (const [cle, borne] of Object.entries(sorte.reglages)) bloc.append(reglage(couche, cle, borne, r, sorte.neuve[cle]));
    }
    couches.append(bloc);
  });
  const ajout = element('div', 'ajout-couche');
  if (r.couches.length < COUCHES_MAX) {
    const liste = element('select');
    liste.setAttribute('aria-label', 'Sorte de couche à ajouter');
    for (const [type, sorte] of Object.entries(SORTES)) liste.append(Object.assign(element('option', '', sorte.nom), { value: type }));
    const bouton = element('button', '', 'Ajouter cette couche');
    bouton.type = 'button';
    bouton.addEventListener('click', () => {
      const sorte = SORTES[liste.value];
      const couche = { type: liste.value, ...structuredClone(sorte.neuve) };
      for (const [cle, borne] of Object.entries(sorte.reglages)) if (borne === 'rampe') couche[cle] = Object.keys(r.rampes)[0];
      r.couches.push(Object.fromEntries([['type', couche.type], ...Object.keys(sorte.reglages).map((cle) => [cle, couche[cle]])]));
      changer({ redessiner: true });
    });
    ajout.append(liste, bouton);
  }

  const morceaux = [rampes, element('h3', '', 'Les couches (posées de haut en bas)'), couches, ajout];
  // 3. Sur un grand sol (les petits carrés) : les variantes, les tours, le miroir
  if (!peint()) {
    const sol = element('fieldset', 'groupe');
    sol.append(element('legend', '', 'Sur un grand sol'));
    sol.append(element('p', 'aide', `Des variantes (la même recette, un autre hasard), et le droit de tourner ou de retourner la texture d’un ${CONFIG.unite} à l’autre : l’œil ne voit plus la répétition. À éviter pour ce qui a un sens (le côté de l’herbe, les planches).`));
    sol.append(reglage(r, 'variantes', [1, VARIANTES_MAX, 1], r));
    for (const [cle, texte] of [['tourner', 'Tourner (quarts de tour)'], ['miroir', 'Retourner (miroir)']]) {
      const ligne = element('label', 'choix-case');
      const champ = element('input');
      champ.type = 'checkbox';
      champ.checked = r[cle];
      champ.addEventListener('change', () => { r[cle] = champ.checked; changer(); });
      ligne.append(champ, element('span', '', texte));
      sol.append(ligne);
    }
    morceaux.push(sol);
  } else {
    morceaux.push(element('p', 'aide', 'Les longueurs sont en cases (une case du jeu = 1) : la recette donne la même image dans l’atelier et dans le jeu. « Largeur » : jusqu’à quelle distance de la forme de la matière on peint (la ligne du milieu du chemin, le centre d’un socle, le bord de l’eau d’un étang, le bord de la cour).'));
  }
  $('#recette').replaceChildren(...morceaux);
}

// ═════════════════════════════════════════════════════════════
// LES ACTIONS : annuler, enregistrer, copier, les planches
// ═════════════════════════════════════════════════════════════
function dire(texte, erreur = false) {
  const p = $('#etat');
  p.textContent = texte;
  p.classList.toggle('erreur', erreur);
}

function dessinerActions() {
  const actions = [
    ['Annuler (cette texture)', async () => {
      await basculerAvant(false);
      RECETTES[choix.texture] = structuredClone(AVANT[choix.texture]);
      await changer({ redessiner: true });
      dire('Cette texture est revenue comme dans le fichier.');
    }],
    ['Tout annuler', async () => {
      await basculerAvant(false);
      for (const n of NOMS) RECETTES[n] = structuredClone(AVANT[n]);
      NOMS.forEach(majVignette);
      await changer({ redessiner: true });
      if (choix.style === 'voxel' && structure() !== structureDuRendu) await preparerVue(); else majToutes3D();
      dire(`Toutes les textures du style ${CONFIG.nom} sont revenues comme dans le fichier.`);
    }],
    ['Copier les recettes', async () => {
      try {
        await navigator.clipboard.writeText(formaterTextures({ ...TEXTURES, [choix.style]: Object.fromEntries(NOMS.map((n) => [n, recetteApres(n)])) }));
        dire('Recettes copiées : il n’y a plus qu’à les coller dans src/rendus/textures.json.');
      } catch {
        dire('Le navigateur a refusé de copier.', true);
      }
    }],
    ['Planche des textures', () => planche()],
    ['Banc d’essai', () => banc()],
    ['Avant / après', () => avantApres()],
  ];
  if (import.meta.env.DEV) actions.splice(2, 0, ['Enregistrer dans le jeu', enregistrer]);
  $('#actions').replaceChildren(...actions.map(([texte, action]) => {
    const b = element('button', texte === 'Enregistrer dans le jeu' ? 'principal' : '', texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }));
  if (!import.meta.env.DEV) $('#actions').append(element('p', 'note', 'En ligne, l’atelier ne peut ni enregistrer ni ranger de planche dans le projet : copie les recettes (les planches se téléchargent), ou lance le jeu avec npm run dev.'));
}

async function enregistrer() {
  await basculerAvant(false);
  dire('Enregistrement…');
  try {
    const reponse = await fetch('/__textures', { method: 'POST', body: JSON.stringify(TEXTURES) });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
    AVANTS = structuredClone(TEXTURES); // le fichier, c'est maintenant ça (tous les styles)
    AVANT = AVANTS[choix.style];
    NOMS.forEach(majVignette);
    majApercus();
    dire(`Enregistré dans ${donnees.fichier}. Le jeu prend ces recettes dès maintenant.`);
  } catch (e) {
    dire(`Pas enregistré : ${e.message}`, true);
  }
}

// Range une image dans captures/ (avec npm run dev), ou la fait télécharger (en ligne)
async function ranger(canvas, nom, format = 'image/jpeg') {
  const image = canvas.toDataURL(format, 0.9);
  if (import.meta.env.DEV) {
    const reponse = await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) });
    const fichier = await reponse.text();
    dire(`Rangée dans ${fichier}`);
    return fichier;
  }
  const lien = element('a');
  lien.href = image;
  lien.download = `${nom}.${format === 'image/png' ? 'png' : 'jpg'}`;
  lien.click();
  return lien.download;
}

// La planche des textures du style : chacune en gros plan (avant, après) et en grand, avec ses mesures
async function planche() {
  const zoom = ZOOM_GROS_PLAN(), exemple = grosPlan(NOMS[0], recetteApres(NOMS[0]));
  const Z = peint() ? zoom : 8, CASE = exemple.largeur * Z, SOL = enGrand(NOMS[0], recetteApres(NOMS[0]), true).largeur * ZOOM_EN_GRAND(true);
  const M = 10, TITRE = 34, ENTETE = 34;
  const largeurCase = 2 * CASE + SOL + 4 * M, hauteurCase = TITRE + Math.max(CASE, SOL) + 2 * M, colonnes = Math.min(3, NOMS.length);
  const c = element('canvas');
  c.width = colonnes * largeurCase;
  c.height = ENTETE + Math.ceil(NOMS.length / colonnes) * hauteurCase;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#140e1a';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ffd27a';
  ctx.font = '16px "Pixelify Sans", sans-serif';
  ctx.fillText(`${CONFIG.nom} — pour chaque texture : avant (le fichier), après (tes recettes), et ${peint() ? 'toute sa scène (6,4 × 6,4 cases)' : `un grand sol de 4 × 4 ${CONFIG.unite}s`}`, M, 22);
  const ordre = CONFIG.familles.flatMap(([, noms]) => noms);
  ordre.forEach((nom, i) => {
    const x0 = (i % colonnes) * largeurCase + M, y0 = ENTETE + Math.floor(i / colonnes) * hauteurCase + M;
    const apres = recetteApres(nom);
    const modifiee = JSON.stringify(apres) !== JSON.stringify(AVANT[nom]);
    ctx.drawImage(peindre(element('canvas'), grosPlan(nom, AVANT[nom]), Z), x0, y0 + TITRE);
    ctx.drawImage(peindre(element('canvas'), grosPlan(nom, apres), Z), x0 + CASE + M, y0 + TITRE);
    ctx.drawImage(peindre(element('canvas'), enGrand(nom, apres, true), ZOOM_EN_GRAND(true)), x0 + 2 * (CASE + M), y0 + TITRE);
    ctx.fillStyle = modifiee ? '#ffd27a' : '#e9d6b8';
    ctx.font = '15px "Pixelify Sans", sans-serif';
    ctx.fillText(`${CONFIG.noms[nom] || nom}${modifiee ? ' (modifiée)' : ''}`, x0, y0 + 13);
    ctx.fillStyle = '#c8b8a8';
    ctx.font = '12px "Pixelify Sans", sans-serif';
    if (peint()) {
      const m = mesurerPeinture(apres, nom);
      ctx.fillText(`contraste ${nombre(m.contraste, 3)} · clarté ${nombre(m.clarte, 2)} · saturation ${nombre(m.saturation, 2)}`, x0, y0 + 29);
    } else {
      const m = mesurerTexture(apres, nom);
      ctx.fillText(`taches ${nombre(m.taches, 2)} · coutures ${nombre(m.coutures, 2)} · ${m.aspects} aspect${m.aspects > 1 ? 's' : ''} · ${m.couleurs} couleurs`, x0, y0 + 29);
    }
  });
  return ranger(c, `textures-planche-${choix.style}`, 'image/png');
}

// Photographie la vue (après quelques images, pour que tout soit en place). Le pixel art vu de près :
// le morceau de son image que la vue montre (agrandi sans flou).
function photographier(ctx, x, y, l, h) {
  for (let i = 0; i < 4; i++) rendu.dessiner(etat, 0, 1 / 60, ui);
  const source = vue.querySelector('canvas'), cadre = cadrePixel();
  if (!cadre) { ctx.drawImage(source, x, y, l, h); return; }
  const d = rendu.dpr, z = cadre.zoom;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, cadre.ox * (1 - 1 / z) * d, cadre.oy * (1 - 1 / z) * d, (vue.clientWidth / z) * d, (vue.clientHeight / z) * d, x, y, l, h);
  ctx.imageSmoothingEnabled = true;
}
async function avecPause(fonction) {
  enPause = true;
  const avantChoix = { ...choix };
  try {
    return await fonction();
  } finally {
    Object.assign(choix, avantChoix);
    rendu.choisirAmbiance(ambianceActuelle(), true);
    placerVue();
    majAdresse();
    enPause = false;
  }
}
const vuesDispo = (liste) => liste.filter((v) => CONFIG.vues.includes(v) && (!LOIN.includes(v) || pointDeVue(v)));
const etiquette = (ctx, texte, x, y) => {
  ctx.fillStyle = '#e9d6b8';
  ctx.font = '15px "Pixelify Sans", sans-serif';
  ctx.fillText(texte, x + 6, y + 16);
};
// les vues des planches : le château et les arbres (voxel), l'étang (les deux autres : sa berge est une texture)
const VUES_BANC = () => (choix.style === 'voxel' ? ['jeu', 'chemin', 'socle', 'arbre'] : ['jeu', 'chemin', 'socle', 'etang']);

// Le banc d'essai : le niveau sous les quatre ambiances (en colonnes), de loin et de près (en rangées)
async function banc() {
  return avecPause(async () => {
    const vues = vuesDispo(VUES_BANC()), ambiances = Object.keys(NOMS_AMBIANCES);
    const L = 480, H = Math.round((L * vue.clientHeight) / vue.clientWidth), BANDE = 22;
    const c = element('canvas');
    c.width = L * ambiances.length;
    c.height = (H + BANDE) * vues.length;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#140e1a';
    ctx.fillRect(0, 0, c.width, c.height);
    vues.forEach((v, j) => {
      choix.vue = v;
      placerVue();
      ambiances.forEach((a, i) => {
        rendu.choisirAmbiance(a, true);
        photographier(ctx, i * L, j * (H + BANDE) + BANDE, L, H);
        etiquette(ctx, `${VUES[v]} — ${NOMS_AMBIANCES[a]}`, i * L, j * (H + BANDE));
      });
    });
    return ranger(c, `textures-banc-${choix.style}-${choix.niveau}`);
  });
}

// Avant / après : les mêmes vues, avec les recettes du fichier (à gauche) puis les tiennes (à droite)
async function avantApres() {
  return avecPause(async () => {
    const vues = vuesDispo(choix.style === 'voxel' ? ['jeu', 'chemin', 'socle'] : ['jeu', 'chemin', 'socle', 'etang']);
    const L = 640, H = Math.round((L * vue.clientHeight) / vue.clientWidth), BANDE = 22;
    const c = element('canvas');
    c.width = L * 2;
    c.height = (H + BANDE) * vues.length;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#140e1a';
    ctx.fillRect(0, 0, c.width, c.height);
    for (const [i, version] of ['avant', 'apres'].entries()) {
      await basculerAvant(version === 'avant');
      rendu.choisirAmbiance(ambianceActuelle(), true);
      vues.forEach((v, j) => {
        choix.vue = v;
        placerVue();
        photographier(ctx, i * L, j * (H + BANDE) + BANDE, L, H);
        etiquette(ctx, `${version === 'avant' ? 'Avant (le fichier)' : 'Après (tes recettes)'} — ${VUES[v]}`, i * L, j * (H + BANDE));
      });
    }
    await basculerAvant(false);
    return ranger(c, `textures-avant-apres-${choix.style}-${choix.niveau}`);
  });
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

// Changer de style : ses textures, son niveau de départ, son rendu
async function changerStyle(style) {
  await basculerAvant(false);
  prendreStyle(style);
  choix.niveau = CONFIG.niveau;
  dessinerBande();
  dessinerChoix();
  choisirTexture(choix.texture);
  await preparerVue();
}

function dessinerChoix() {
  const groupes = MONDES.map((m) => ({ groupe: `Monde ${m.numero}`, options: m.niveaux.filter((id) => IDS.includes(id)).map((id) => [id, ficheDe(id).nom]) }));
  const autres = ORDRE.filter((id) => !MONDES.some((m) => m.niveaux.includes(id)));
  if (autres.length) groupes.push({ groupe: 'Défis et essais', options: autres.map((id) => [id, ficheDe(id).nom]) });
  const bouton = element('button', 'bouton-avant', 'Montrer l’avant');
  bouton.type = 'button';
  bouton.id = 'bouton-avant';
  bouton.setAttribute('aria-pressed', String(montreAvant));
  bouton.title = 'Le niveau avec les recettes du fichier, pour comparer avec tes réglages';
  bouton.addEventListener('click', () => basculerAvant(!montreAvant));
  $('#choix').replaceChildren(
    liste('style', 'Style', Object.entries(STYLES).map(([id, s]) => [id, s.nom]), choix.style, (v) => changerStyle(v)),
    liste('niveau', 'Niveau', groupes, choix.niveau, (v) => { choix.niveau = v; preparerVue(); }),
    liste('ambiance', 'Ambiance', [['', 'Celle du niveau'], ...Object.entries(NOMS_AMBIANCES)], choix.ambiance || '', (v) => {
      choix.ambiance = v || null;
      rendu.choisirAmbiance(ambianceActuelle(), true);
      majAdresse();
    }),
    liste('vue', 'Vue', CONFIG.vues.map((v) => [v, VUES[v]]), choix.vue, (v) => { choix.vue = v; placerVue(); majAdresse(); }),
    bouton,
  );
}

addEventListener('resize', () => { rendu?.redimensionner(); placerVue(); });

// ── C'est parti ──
dessinerBande();
dessinerChoix();
dessinerActions();
choisirTexture(choix.texture);
preparerVue().then(() => requestAnimationFrame(boucle));

window.__textures = {
  get rendu() { return rendu; },
  get recettes() { return RECETTES; },
  get avant() { return AVANT; },
  get style() { return choix.style; },
  async choisir({ texture, style, ...autres } = {}) {
    if (style && style !== choix.style) await changerStyle(style);
    if (autres.niveau && autres.niveau !== choix.niveau) { Object.assign(choix, autres); dessinerChoix(); await preparerVue(); } else { Object.assign(choix, autres); dessinerChoix(); }
    if (autres.ambiance !== undefined) rendu.choisirAmbiance(ambianceActuelle(), true);
    placerVue();
    majAdresse();
    if (texture) choisirTexture(texture);
  },
  // après avoir changé une recette à la main (dans la console) : tout se met à jour
  async appliquer(nom = choix.texture) { if (nom === choix.texture) await changer({ redessiner: true }); else { majVignette(nom); majTexture3D(nom); } },
  // remplace les recettes « après » du style par celles d'un objet { nom: recette } (collé dans la console)
  async remplacer(nouvelles) {
    await basculerAvant(false);
    for (const [n, r] of Object.entries(nouvelles)) if (n in RECETTES) RECETTES[n] = structuredClone(r);
    if (choix.style === 'voxel' && structure() !== structureDuRendu) await preparerVue(); else majToutes3D();
    NOMS.forEach(majVignette);
    await changer({ redessiner: true });
  },
  mesurer: (nom) => (peint() ? mesurerPeinture(recetteApres(nom), nom) : mesurerTexture(recetteApres(nom), nom)),
  planche,
  banc,
  avantApres,
  // Range la vue en grand dans captures/nom.jpg
  async capturer(nom) {
    return avecPause(async () => {
      const source = vue.querySelector('canvas');
      const c = element('canvas');
      c.width = source.width;
      c.height = source.height;
      photographier(c.getContext('2d'), 0, 0, c.width, c.height);
      return ranger(c, nom);
    });
  },
};
