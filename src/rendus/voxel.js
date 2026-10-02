// ─────────────────────────────────────────────────────────────
// STYLE 1 — « VOXEL DORÉ »
// Tout est fait de petits cubes texturés (esprit Minecraft avec shaders),
// éclairé par un soleil bas : ombres longues, brume chaude, halo (bloom)
// et rayons de lumière. Quatre ambiances et deux caméras à tester.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { GARDIENS, MONSTRES, HAUTEUR_VOL, caracteristiques } from '../jeu/donnees.js';
import { lireApparence, melanger, couleursEclats, verifierApparences, verifierStyle } from './apparence.js';
import { creerAleatoire, bruitFractal } from '../jeu/aleatoire.js';
import REGLAGES_AMBIANCES from './ambiances.json';
import {
  Synchro, Particules, creerBarreDeVie, majBarreDeVie, socleProche, versRotationY, liberer, creerAppareilPhoto, photographier,
} from './outils3d.js';

const B = 0.5; // taille d'un bloc : une case du jeu = 2 × 2 blocs
const TAILLE_GARDIEN = 1.6; // les personnages sont un peu agrandis pour bien les voir
const TAILLE_MONSTRE = 1.5;

// ═════════════════════════════════════════════════════════════
// 1. TEXTURES « PIXELISÉES » GÉNÉRÉES PAR LE CODE (16 × 16 pixels)
// ═════════════════════════════════════════════════════════════
const alea = creerAleatoire(7);
const choisir = (liste) => liste[Math.floor(alea() * liste.length)];

// fn(x, y) renvoie une couleur CSS (ou null = pixel transparent)
function texture(fn) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const ctx = c.getContext('2d');
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const couleur = fn(x, y);
      if (!couleur) continue;
      ctx.fillStyle = couleur;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.magFilter = THREE.NearestFilter;            // pixels nets quand on zoome
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const VERT = ['#6fb440', '#64a83a', '#7abd4a', '#5c9e34', '#6aae3f'];
const TERRE = ['#8a5f3c', '#7a5234', '#946a45', '#6e4a2f'];
// petit bruit pour faire des taches (mousse) dans une texture
const bruitTexture = (x, y) => bruitFractal(x * 0.35 + 3, y * 0.35 + 8, 2) + (y < 6 ? 0.15 : -0.1);
const PIERRE = ['#a29c90', '#958f84', '#aea89b', '#8a8479', '#9c968a'];

function creerTextures() {
  // hauteur de la frange d'herbe sur le côté, différente pour chaque colonne
  const frange = Array.from({ length: 16 }, () => 2 + Math.floor(alea() * 3));
  return {
    herbe: texture(() => choisir(VERT)),
    herbeCote: texture((x, y) => (y < frange[x] ? choisir(VERT) : choisir(TERRE))),
    terre: texture(() => choisir(TERRE)),
    chemin: texture(() => (alea() < 0.08 ? choisir(['#d8c08a', '#8a6a3e']) : choisir(['#d6b47a', '#cba86c', '#dfbe86', '#c29f64']))),
    pierre: texture(() => choisir(PIERRE)),
    mousse: texture((x, y) => (bruitTexture(x, y) > 0.45 ? choisir(['#6f9a3a', '#7aa843', '#5f8a32']) : choisir(PIERRE))),
    neige: texture(() => choisir(['#f4f6fa', '#e8ecf2', '#ffffff', '#dfe5ee'])),
    sable: texture(() => choisir(['#e6d29a', '#dcc68c', '#efdcaa', '#d6bf84'])),
    // pierres taillées du château : rangées de briques avec joints
    briques: texture((x, y) => {
      const rangee = Math.floor(y / 4);
      const decale = rangee % 2 ? 4 : 0;
      if (y % 4 === 3 || (x + decale) % 8 === 7) return choisir(['#8a8070', '#958a78']);
      return choisir(['#d8cdb4', '#cfc3a8', '#e0d6bf', '#c6b99c']);
    }),
    tronc: texture((x) => choisir(x % 4 === 0 ? ['#4f3820', '#563d23'] : ['#6b4b2a', '#7a5732', '#634528'])),
    bouleau: texture((x, y) => ((y * 7 + x * 3) % 11 < 2 && alea() < 0.7 ? '#2c2a28' : choisir(['#e8e4dc', '#d8d4cc', '#f0ece4']))),
    // feuilles en gris clair : la couleur vient de chaque arbre (vert, doré, roux…)
    feuilles: texture(() => (alea() < 0.16 ? null : choisir(['#e6e6e6', '#cfcfcf', '#f4f4f4', '#bdbdbd']))),
    planches: texture((x, y) => (y % 4 === 0 ? '#6e4c2c' : choisir(['#a87a48', '#9c6f40', '#b38552']))),
    laine: texture(() => choisir(['#c23a2e', '#b33328', '#cc4436'])),
    toit: texture((x, y) => (y % 4 === 0 ? '#22345e' : choisir(['#3e62b0', '#3658a2', '#4a70c0']))),
    sombre: texture(() => choisir(['#1a1410', '#221a14', '#16110d'])),
    lanterne: texture((x, y) => (x < 2 || x > 13 || y < 2 || y > 13 ? '#3a2a1a' : choisir(['#ffd36a', '#ffe08a', '#ffc548']))),
    // grain léger pour les personnages (sinon ils paraissent en plastique)
    grain: texture(() => choisir(['#ffffff', '#f2f2f2', '#e6e6e6', '#fafafa'])),
  };
}

// ═════════════════════════════════════════════════════════════
// 2. LES AMBIANCES (couleurs du ciel, du soleil, de la brume…)
//    Elles sont rangées dans ambiances.json (partie « voxel »), avec celles des
//    deux autres styles : l'atelier des lumières (lumieres.html) les règle et les
//    enregistre. Pour chacune : le soleil (couleur, force, hauteur et direction en
//    degrés), la lumière du ciel et du sol, la brume, les couleurs du ciel, puis
//    l'image (exposition, halo, chaleur, saturation, contraste, rayons) et les
//    petites lumières (poussière dorée, lucioles, étoiles, lanternes, lueur des fleurs).
// ═════════════════════════════════════════════════════════════
const AMBIANCES = REGLAGES_AMBIANCES.voxel;

// ═════════════════════════════════════════════════════════════
// 3. LE POST-TRAITEMENT « ÉTALONNAGE » (comme un filtre photo)
//    rayons de soleil, chaleur, saturation, contraste, vignette
// ═════════════════════════════════════════════════════════════
const ShaderEtalonnage = {
  uniforms: {
    tDiffuse: { value: null },
    uSoleil: { value: new THREE.Vector2(0.3, 1.4) }, // position du soleil à l'écran (peut être hors écran)
    uRatio: { value: 1 },
    uTemps: { value: 0 },
    uRayons: { value: 0.5 },
    uRayonsCouleur: { value: new THREE.Color('#ffd9a0') },
    uChaleur: { value: 0.5 },
    uSaturation: { value: 1.1 },
    uContraste: { value: 1.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uSoleil;
    uniform float uRatio, uTemps, uRayons, uChaleur, uSaturation, uContraste;
    uniform vec3 uRayonsCouleur;
    varying vec2 vUv;
    void main() {
      vec3 c = texture2D(tDiffuse, vUv).rgb;

      // Rayons : des « rayures » qui partent du soleil et s'estompent avec la distance
      vec2 d = vUv - uSoleil;
      d.x *= uRatio;
      float dist = length(d);
      float angle = atan(d.y, d.x);
      float raies = 0.5 + 0.5 * sin(angle * 23.0 + uTemps * 0.08) * sin(angle * 9.0 - uTemps * 0.05 + 1.7);
      raies = smoothstep(0.25, 1.0, raies);
      float attenuation = exp(-dist * 1.6);
      c += uRayonsCouleur * (raies * 0.3 + 0.7) * attenuation * uRayons * 0.5;
      c += uRayonsCouleur * exp(-dist * 2.4) * uRayons * 0.35; // halo doux du côté du soleil

      // Chaleur : on pousse vers l'orangé (ou vers le bleu si négatif)
      c *= vec3(1.0 + 0.08 * uChaleur, 1.0 + 0.01 * uChaleur, 1.0 - 0.1 * uChaleur);

      // Saturation et contraste
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(lum), c, uSaturation);
      c = (c - 0.5) * uContraste + 0.5;

      // Vignette : les coins un peu plus sombres pour guider l'oeil vers le centre
      vec2 v = vUv - 0.5;
      c *= 1.0 - dot(v, v) * 0.55;

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
};

// ═════════════════════════════════════════════════════════════
// 4. LES PERSONNAGES EN CUBES, FABRIQUÉS À PARTIR DE LEUR FICHE
//    Chaque gabarit construit une silhouette et note ses « ancres » :
//    les endroits où s'accrochent les accessoires (sommet de la tête,
//    ceinture…). Ainsi, un accessoire va sur n'importe quel gabarit.
//    Paramètres : r = le rendu (ses outils boite, matBrillant…),
//    vue = le personnage en construction, app = son apparence complète,
//    m(couleur) = un matériau pour ce personnage.
// ═════════════════════════════════════════════════════════════
const GABARITS_VOXEL = {
  gardien: {
    fabriquer(r, vue, { couleurs: c }, m) {
      const peau = m(c.peau), fonce = m(c.fonce);
      r.boite(vue.corps, 0.6, 0.4, 0.44, 0, 0.36, 0, peau);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) r.boite(vue.corps, 0.1, 0.16, 0.1, sx * 0.19, 0.08, sz * 0.13, fonce); // pattes
        r.boite(vue.corps, 0.1, 0.12, 0.16, sx * 0.35, 0.36, 0.02, peau);                                   // bras
        r.boite(vue.corps, 0.07, 0.11, 0.02, sx * 0.12, 0.42, 0.221, m(c.yeux));                            // oeil
        r.boite(vue.corps, 0.025, 0.025, 0.01, sx * 0.12 + 0.016, 0.455, 0.232, r.matBrillant('#ffffff', 1.2)); // reflet
      }
      vue.ancres = { sommet: 0.56, demiLargeur: 0.3, demiProfondeur: 0.22, ceinture: 0.27, yeux: { ecart: 0.12, y: 0.42, z: 0.221, taille: 0.06 } };
    },
    animer() {}, // un gardien ne marche pas : il respire et s'écrase quand il attaque (voir majVueTour)
  },
  gelee: {
    fabriquer(r, vue, { couleurs: c }, m) {
      r.boite(vue.corps, 0.42, 0.38, 0.42, 0, 0.19, 0, m(c.peau, { transparent: true, opacity: 0.86 }));
      r.boite(vue.corps, 0.2, 0.16, 0.2, 0, 0.16, 0, m(c.fonce));
      for (const sx of [-1, 1]) r.boite(vue.corps, 0.06, 0.08, 0.02, sx * 0.09, 0.25, 0.212, m(c.yeux));
      vue.ancres = { sommet: 0.38, demiLargeur: 0.21, demiProfondeur: 0.21, ceinture: 0.12, yeux: { ecart: 0.09, y: 0.25, z: 0.212, taille: 0.045 } };
    },
    animer(vue, t, lent) { // des sauts, avec un écrasement à chaque atterrissage
      const saut = Math.abs(Math.sin(t * 6 * lent));
      vue.corps.position.y = saut * 0.16;
      vue.corps.scale.set(vue.taille * (1 + (1 - saut) * 0.12), vue.taille * (1 - (1 - saut) * 0.18), vue.taille * (1 + (1 - saut) * 0.12));
    },
  },
  rongeur: {
    fabriquer(r, vue, { couleurs: c }, m) {
      r.boite(vue.corps, 0.26, 0.2, 0.36, 0, 0.2, 0, m(c.peau));                       // corps
      r.boite(vue.corps, 0.22, 0.2, 0.2, 0, 0.28, 0.24, m(melanger(c.peau, c.clair, 0.2))); // tête
      r.boite(vue.corps, 0.1, 0.07, 0.06, 0, 0.24, 0.36, m(c.clair));                  // museau
      const queue = r.boite(vue.corps, 0.05, 0.05, 0.26, 0, 0.26, -0.28, m(c.clair));
      queue.rotation.x = -0.5;
      for (const sx of [-1, 1]) {
        r.boite(vue.corps, 0.06, 0.11, 0.04, sx * 0.07, 0.43, 0.22, m(c.fonce));       // oreille
        r.boite(vue.corps, 0.04, 0.04, 0.02, sx * 0.06, 0.31, 0.341, r.matBrillant(c.yeux, 2));
        for (const sz of [-1, 1]) vue.pattes.push(r.boite(vue.corps, 0.06, 0.1, 0.06, sx * 0.09, 0.05, sz * 0.12, m(c.fonce)));
      }
      vue.ancres = { sommet: 0.38, demiLargeur: 0.11, demiProfondeur: 0.1, ceinture: 0.2, yeux: { ecart: 0.06, y: 0.31, z: 0.341, taille: 0.035 }, zTete: 0.24 };
    },
    animer(vue, t, lent) { // trottine vite, les pattes se lèvent l'une après l'autre
      vue.corps.position.y = Math.abs(Math.sin(t * 14 * lent)) * 0.04;
      vue.pattes.forEach((p, i) => (p.position.y = 0.05 + Math.max(0, Math.sin(t * 14 * lent + i * 1.6)) * 0.05));
    },
  },
  golem: {
    fabriquer(r, vue, { couleurs: c }, m) {
      r.boite(vue.corps, 0.62, 0.5, 0.46, 0, 0.5, 0, m(c.peau));                                  // corps
      r.boite(vue.corps, 0.64, 0.08, 0.48, 0, 0.78, 0, m(c.mousse));                              // mousse
      r.boite(vue.corps, 0.3, 0.24, 0.24, 0, 0.88, 0.06, m(melanger(c.peau, c.fonce, 0.4)));     // tête
      for (const sx of [-1, 1]) {
        r.boite(vue.corps, 0.07, 0.04, 0.02, sx * 0.07, 0.9, 0.181, r.matBrillant(c.yeux, 2.5));
        vue.pattes.push(r.boite(vue.corps, 0.16, 0.42, 0.18, sx * 0.4, 0.44, 0, m(melanger(c.peau, c.fonce, 0.5)))); // bras
        vue.pattes.push(r.boite(vue.corps, 0.18, 0.26, 0.2, sx * 0.15, 0.13, 0, m(c.fonce)));                       // jambe
      }
      if (c.lave) {
        // des fissures de lave sur le devant du corps : de petits cubes qui brillent, en escalier
        const lave = r.matBrillant(c.lave, 2.6);
        for (const [x, y] of FISSURES_VOXEL) r.boite(vue.corps, 0.045, 0.045, 0.02, x, y, 0.232, lave);
        for (const [x, z] of FISSURES_DESSUS_VOXEL) r.boite(vue.corps, 0.05, 0.02, 0.05, x, 0.823, z, lave); // sur les épaules : on les voit d'en haut
      }
      vue.ancres = { sommet: 1.0, demiLargeur: 0.15, demiProfondeur: 0.12, ceinture: 0.6, yeux: { ecart: 0.07, y: 0.9, z: 0.181, taille: 0.035 } };
      vue.hauteurBarre = 1.15;
      vue.largeurBarre = 0.6;
    },
    animer(vue, t, lent) { // marche lourde : il se balance et ses membres vont d'avant en arrière
      vue.corps.rotation.z = Math.sin(t * 3 * lent) * 0.06;
      vue.pattes.forEach((p, i) => (p.rotation.x = Math.sin(t * 3 * lent + (i % 2) * Math.PI) * 0.3));
    },
  },
  volant: {
    fabriquer(r, vue, { couleurs: c }, m) {
      r.boite(vue.corps, 0.3, 0.28, 0.28, 0, 0.3, 0, m(c.peau));        // le corps
      r.boite(vue.corps, 0.16, 0.12, 0.02, 0, 0.26, 0.141, m(c.clair)); // le ventre
      vue.ailes = [];
      for (const sx of [-1, 1]) {
        r.boite(vue.corps, 0.06, 0.12, 0.06, sx * 0.09, 0.49, -0.02, m(c.fonce));                  // oreille
        r.boite(vue.corps, 0.05, 0.05, 0.02, sx * 0.07, 0.35, 0.141, r.matBrillant(c.yeux, 2));    // oeil
        r.boite(vue.corps, 0.025, 0.04, 0.02, sx * 0.04, 0.2, 0.141, m('#ffffff'));                 // croc
        // l'aile : trois plaques en escalier, de plus en plus courtes vers le bout,
        // accrochées à une « épaule » qui pivote quand l'aile bat
        const epaule = new THREE.Group();
        epaule.position.set(sx * 0.15, 0.34, 0);
        epaule.userData.sens = sx;
        const aile = m(c.fonce);
        r.boite(epaule, 0.14, 0.025, 0.24, sx * 0.07, 0, 0, aile);
        r.boite(epaule, 0.12, 0.025, 0.17, sx * 0.2, 0, 0.02, aile);
        r.boite(epaule, 0.08, 0.025, 0.09, sx * 0.3, 0, 0.04, aile);
        vue.corps.add(epaule);
        vue.ailes.push(epaule);
      }
      vue.ancres = { sommet: 0.44, demiLargeur: 0.15, demiProfondeur: 0.14, ceinture: 0.26, yeux: { ecart: 0.07, y: 0.35, z: 0.141, taille: 0.04 } };
      vue.hauteurBarre = 0.66;
    },
    animer(vue, t, lent) { // les ailes battent vite, et il monte et descend un peu
      const battement = Math.sin(t * 16 * lent);
      for (const epaule of vue.ailes) epaule.rotation.z = epaule.userData.sens * (0.15 + battement * 0.55);
      vue.corps.position.y = Math.sin(t * 4) * 0.04;
    },
  },
  tortue: {
    fabriquer(r, vue, { couleurs: c }, m) {
      // la carapace : trois étages de plus en plus petits, avec des plaques plus sombres dessus
      const carapace = m(c.carapace), plaque = m(melanger(c.carapace, '#000000', 0.2));
      r.boite(vue.corps, 0.52, 0.12, 0.58, 0, 0.17, 0, m(melanger(c.carapace, '#000000', 0.3)));
      r.boite(vue.corps, 0.46, 0.1, 0.5, 0, 0.27, 0, carapace);
      r.boite(vue.corps, 0.32, 0.08, 0.36, 0, 0.36, 0, carapace);
      for (const [x, z] of [[0, 0], [0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]]) r.boite(vue.corps, 0.1, 0.02, 0.1, x, x === 0 ? 0.41 : 0.33, z, plaque);
      // la tête devant, la queue derrière, les quatre pattes
      r.boite(vue.corps, 0.17, 0.14, 0.18, 0, 0.18, 0.36, m(c.peau));
      for (const sx of [-1, 1]) r.boite(vue.corps, 0.035, 0.035, 0.02, sx * 0.045, 0.21, 0.451, r.matBrillant(c.yeux, 1));
      r.boite(vue.corps, 0.06, 0.05, 0.1, 0, 0.12, -0.33, m(c.peau));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) vue.pattes.push(r.boite(vue.corps, 0.09, 0.12, 0.09, sx * 0.18, 0.06, sz * 0.16, m(c.peau)));
      vue.ancres = { sommet: 0.4, demiLargeur: 0.16, demiProfondeur: 0.18, ceinture: 0.17, yeux: { ecart: 0.045, y: 0.21, z: 0.451, taille: 0.03 }, zTete: 0.36 };
      vue.hauteurBarre = 0.62;
      vue.largeurBarre = 0.46;
    },
    animer(vue, t, lent) { // elle se dandine, et ses pattes avancent deux par deux
      vue.corps.rotation.z = Math.sin(t * 5 * lent) * 0.05;
      vue.pattes.forEach((p, i) => (p.position.y = 0.06 + Math.max(0, Math.sin(t * 5 * lent + (i % 2) * Math.PI)) * 0.04));
    },
  },
  taupe: {
    fabriquer(r, vue, { couleurs: c }, m) {
      // un corps rond en blocs, un long museau rose, de grosses pattes roses pour creuser
      r.boite(vue.corps, 0.36, 0.28, 0.44, 0, 0.2, 0, m(c.peau));
      r.boite(vue.corps, 0.26, 0.06, 0.3, 0, 0.36, 0, m(c.clair));
      r.boite(vue.corps, 0.1, 0.08, 0.14, 0, 0.2, 0.28, m(c.museau));
      r.boite(vue.corps, 0.05, 0.05, 0.03, 0, 0.21, 0.36, m(melanger(c.museau, '#c04060', 0.4)));
      vue.pattes = [];
      for (const sx of [-1, 1]) {
        vue.pattes.push(r.boite(vue.corps, 0.12, 0.05, 0.14, sx * 0.16, 0.07, 0.17, m(c.museau)));
        r.boite(vue.corps, 0.04, 0.05, 0.02, sx * 0.07, 0.29, 0.221, m(c.yeux));
      }
      r.boite(vue.corps, 0.04, 0.04, 0.05, 0, 0.16, -0.24, m(c.peau)); // la petite queue
      vue.ancres = { sommet: 0.39, demiLargeur: 0.14, demiProfondeur: 0.16, ceinture: 0.18, yeux: { ecart: 0.07, y: 0.29, z: 0.221, taille: 0.03 }, zTete: 0.12 };
      vue.hauteurBarre = 0.6;
    },
    animer(vue, t, lent) { // elle trottine, et ses grosses pattes grattent la terre
      vue.corps.position.y = Math.abs(Math.sin(t * 10 * lent)) * 0.03;
      vue.pattes.forEach((p, i) => (p.rotation.x = Math.sin(t * 10 * lent + i * Math.PI) * 0.5));
    },
  },
  dragon: {
    fabriquer(r, vue, { couleurs: c }, m) {
      const peau = m(c.peau), fonce = m(c.fonce);
      // le corps, le ventre, et le cou en escalier jusqu'à la tête
      r.boite(vue.corps, 0.46, 0.38, 0.66, 0, 0.36, 0, peau);
      r.boite(vue.corps, 0.36, 0.08, 0.5, 0, 0.17, 0.04, m(c.ventre));
      for (const [y, z, l] of [[0.5, 0.36, 0.22], [0.62, 0.48, 0.18], [0.72, 0.56, 0.16]]) r.boite(vue.corps, l, l, l, 0, y, z, peau);
      const tete = new THREE.Group();
      tete.position.set(0, 0.8, 0.68);
      r.boite(tete, 0.26, 0.18, 0.26, 0, 0, 0, peau);
      r.boite(tete, 0.18, 0.1, 0.16, 0, -0.03, 0.2, peau);
      r.boite(tete, 0.16, 0.04, 0.14, 0, -0.09, 0.15, fonce); // la mâchoire
      for (const sx of [-1, 1]) {
        r.boite(tete, 0.05, 0.035, 0.02, sx * 0.08, 0.04, 0.131, r.matBrillant(c.yeux, 2.4));
        r.boite(tete, 0.02, 0.04, 0.02, sx * 0.05, -0.12, 0.2, m('#ffffff')); // croc
      }
      vue.corps.add(tete);
      vue.tete = tete;
      // les ailes : quatre plaques en escalier sur une « épaule » qui pivote
      vue.ailes = [];
      const membrane = m(melanger(c.fonce, c.peau, 0.3));
      for (const sx of [-1, 1]) {
        const epaule = new THREE.Group();
        epaule.position.set(sx * 0.23, 0.55, 0);
        epaule.rotation.z = sx * 0.5; // au repos (sur les portraits), les ailes sont levées
        epaule.userData.sens = sx;
        [[0.16, 0.38, 0.08, 0], [0.15, 0.32, 0.23, 0.03], [0.12, 0.22, 0.36, 0.06], [0.09, 0.12, 0.46, 0.09]].forEach(([l, p, x, z]) => r.boite(epaule, l, 0.03, p, sx * x, 0, z, membrane));
        vue.corps.add(epaule);
        vue.ailes.push(epaule);
      }
      // la queue : des blocs de plus en plus petits vers l'arrière, et une pointe
      const queue = new THREE.Group();
      queue.position.set(0, 0.3, -0.33);
      [[0.18, -0.08, 0], [0.14, -0.24, -0.03], [0.1, -0.38, -0.06], [0.07, -0.5, -0.08]].forEach(([l, z, y]) => r.boite(queue, l, l, 0.16, 0, y, z, peau));
      r.boite(queue, 0.12, 0.03, 0.1, 0, -0.08, -0.6, fonce);
      vue.corps.add(queue);
      vue.queue = queue;
      for (const z of [-0.14, 0.16]) for (const sx of [-1, 1]) r.boite(vue.corps, 0.09, 0.12, 0.09, sx * 0.14, 0.12, z, fonce); // les pattes
      vue.ancres = { sommet: 0.9, demiLargeur: 0.13, demiProfondeur: 0.13, ceinture: 0.36, zTete: 0.66, yeux: { ecart: 0.08, y: 0.84, z: 0.811, taille: 0.03 } };
      vue.hauteurBarre = 1.15;
      vue.largeurBarre = 0.6;
    },
    animer(vue, t, lent) { // les ailes battent lentement, la queue ondule, la tête se balance
      const battement = Math.sin(t * 6 * lent);
      for (const epaule of vue.ailes) epaule.rotation.z = epaule.userData.sens * (0.2 + battement * 0.5);
      vue.corps.position.y = Math.sin(t * 3) * 0.06;
      vue.queue.rotation.y = Math.sin(t * 2.5) * 0.35;
      vue.tete.rotation.x = Math.sin(t * 2) * 0.12;
    },
  },
};

// Les fissures de lave du golem, sur le devant de son corps : la position (x, y) de chaque petit cube
const FISSURES_VOXEL = [
  [-0.2, 0.66], [-0.16, 0.62], [-0.12, 0.58], [-0.14, 0.54], [-0.16, 0.5], [-0.11, 0.46], [-0.07, 0.42], [-0.09, 0.38], [-0.1, 0.33],
  [0.1, 0.63], [0.14, 0.59], [0.18, 0.55], [0.15, 0.51], [0.13, 0.47], [0.17, 0.42], [0.21, 0.38],
  [0, 0.35], [0.04, 0.31], [0.02, 0.27],
];
// … et sur le dessus de ses épaules : la position (x, z) de chaque petit cube
const FISSURES_DESSUS_VOXEL = [
  [-0.28, -0.15], [-0.23, -0.1], [-0.18, -0.05], [-0.21, 0.01], [-0.23, 0.07], [-0.17, 0.12], [-0.12, 0.17],
  [0.07, -0.2], [0.12, -0.15], [0.15, -0.09], [0.12, -0.03], [0.17, 0.03], [0.22, 0.08], [0.2, 0.15],
];

const ACCESSOIRES_VOXEL = {
  flamme(r, vue, acc) {
    const { sommet } = vue.ancres;
    const morceaux = [
      r.boite(vue.corps, 0.17, 0.17, 0.17, 0, sommet + 0.08, 0, r.matBrillant(acc.couleur, 1.35)),
      r.boite(vue.corps, 0.11, 0.11, 0.11, 0.02, sommet + 0.21, 0.01, r.matBrillant(melanger(acc.couleur, '#ffd23a', 0.6), 1.5)),
      r.boite(vue.corps, 0.06, 0.06, 0.06, -0.01, sommet + 0.31, 0, r.matBrillant(melanger(acc.couleur, '#fff4c0', 0.85), 1.6)),
    ];
    morceaux.forEach((f) => (f.castShadow = false));
    vue.animations.push((temps) => morceaux.forEach((f, i) => { // la flamme vacille
      f.scale.setScalar(0.85 + Math.random() * 0.3);
      f.position.x = Math.sin(temps * 9 + i * 2) * 0.02;
    }));
  },
  cristaux(r, vue, acc) {
    const { sommet, demiLargeur } = vue.ancres;
    const glace = new THREE.MeshStandardMaterial({
      color: melanger(acc.couleur, '#ffffff', 0.45), emissive: melanger(acc.couleur, '#1a90ff', 0.4),
      emissiveIntensity: 1.1, transparent: true, opacity: 0.85, roughness: 0.2,
    });
    [[-0.5, 0.2, 0.35], [0, 0.3, 0], [0.5, 0.2, -0.35]].forEach(([fx, h, angle]) => {
      const cristal = r.boite(vue.corps, 0.07, h, 0.07, fx * demiLargeur, sommet + h / 2, 0, glace);
      cristal.rotation.z = angle;
    });
  },
  echarpe(r, vue, acc, m) {
    const { ceinture, demiLargeur, demiProfondeur } = vue.ancres;
    r.boite(vue.corps, demiLargeur * 2 + 0.03, 0.07, demiProfondeur * 2 + 0.03, 0, ceinture, 0, m(acc.couleur));
  },
  cornes(r, vue, acc, m) {
    const { sommet, demiLargeur, zTete = 0.06 } = vue.ancres; // zTete : où est la tête, d'avant en arrière
    const os = m(acc.couleur);
    for (const sx of [-1, 1]) {
      r.boite(vue.corps, 0.08, 0.14, 0.08, sx * demiLargeur * 0.7, sommet + 0.07, zTete, os);
      r.boite(vue.corps, 0.05, 0.08, 0.05, sx * demiLargeur * 0.8, sommet + 0.17, zTete, os);
    }
  },
  mortier(r, vue, acc, m) {
    const { sommet, demiProfondeur } = vue.ancres;
    const mortier = new THREE.Group();
    mortier.position.set(0, sommet + 0.06, -demiProfondeur * 0.55);
    mortier.rotation.x = -0.55; // penché vers l'arrière
    const metal = { metalness: 0.4, roughness: 0.5 };
    r.boite(mortier, 0.22, 0.3, 0.22, 0, 0.1, 0, m(melanger(acc.couleur, '#000000', 0.08), metal));
    r.boite(mortier, 0.26, 0.05, 0.26, 0, 0.26, 0, m(melanger(acc.couleur, '#000000', 0.4), metal));
    r.boite(mortier, 0.12, 0.12, 0.12, 0, 0.22, 0, r.matUnite('#9a7ab8', { emissive: '#6a3aa8', emissiveIntensity: 0.6 })); // le rocher prêt à partir
    vue.corps.add(mortier);
  },
  cape(r, vue, acc, m) {
    // un col relevé en U autour de l'arrière de la tête (c'est lui qu'on voit d'en haut),
    // puis la cape qui pend dans le dos, plus large en bas, et qui flotte un peu au vent
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const tissu = m(acc.couleur);
    const longueur = sommet - 0.06; // elle descend presque jusqu'au sol
    r.boite(vue.corps, demiLargeur * 2 + 0.1, 0.08, 0.06, 0, sommet + 0.02, -demiProfondeur - 0.01, tissu); // le col, derrière
    for (const sx of [-1, 1]) {
      r.boite(vue.corps, 0.06, 0.08, demiProfondeur, sx * (demiLargeur + 0.02), sommet + 0.02, -demiProfondeur / 2, tissu); // le col, sur les côtés
    }
    const cape = new THREE.Group(); // le groupe est placé au bord du haut : la cape pivote autour de ce bord
    cape.position.set(0, sommet, -demiProfondeur - 0.02);
    r.boite(cape, demiLargeur * 2 + 0.04, longueur / 2, 0.035, 0, -longueur / 4, 0, tissu);
    r.boite(cape, demiLargeur * 2 + 0.14, longueur / 2, 0.035, 0, -longueur * 3 / 4, 0, tissu); // le bas, plus large
    vue.corps.add(cape);
    const decalage = Math.random() * 6; // pour que les capes ne flottent pas toutes en même temps
    vue.animations.push((temps) => (cape.rotation.x = 0.14 + Math.sin(temps * 2.2 + decalage) * 0.06));
  },
  couronne(r, vue, acc, m) {
    // quatre petits murs dorés posés sur la tête, des pointes, et une pierre rouge devant
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const or = m(acc.couleur, { emissive: acc.couleur, emissiveIntensity: 0.3 }); // elle brille un peu
    const l = demiLargeur * 0.5, p = demiProfondeur * 0.5, h = 0.06; // demi-largeur, demi-profondeur, hauteur
    const z = demiProfondeur * 0.3; // un peu vers l'avant de la tête (laisse la place au mortier)
    const y = sommet + h / 2;
    r.boite(vue.corps, l * 2, h, 0.035, 0, y, z + p, or); // devant
    r.boite(vue.corps, l * 2, h, 0.035, 0, y, z - p, or); // derrière
    for (const sx of [-1, 1]) r.boite(vue.corps, 0.035, h, p * 2, sx * l, y, z, or); // côtés
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) r.boite(vue.corps, 0.045, 0.05, 0.045, sx * l, sommet + h + 0.025, z + sz * p, or); // pointes des coins
    }
    r.boite(vue.corps, 0.045, 0.08, 0.045, 0, sommet + h + 0.04, z + p, or); // la grande pointe, au milieu devant
    r.boite(vue.corps, 0.05, 0.035, 0.02, 0, y, z + p + 0.02, r.matBrillant('#ff3a4a', 1.4)); // la pierre
  },
  antennes(r, vue, acc, m) {
    // deux tiges un peu écartées, chacune avec un cube lumineux qui palpite (et grossit quand elle tire)
    const { sommet, demiLargeur } = vue.ancres;
    const tige = m('#3a3448'), cubes = [];
    for (const sx of [-1, 1]) {
      const antenne = new THREE.Group();
      antenne.position.set(sx * demiLargeur * 0.6, sommet, 0);
      antenne.rotation.z = -sx * 0.3;
      r.boite(antenne, 0.03, 0.2, 0.03, 0, 0.1, 0, tige);
      cubes.push(r.boite(antenne, 0.08, 0.08, 0.08, 0, 0.22, 0, r.matBrillant(acc.couleur, 2.2)));
      vue.corps.add(antenne);
    }
    vue.animations.push((temps, v) => cubes.forEach((c, i) => c.scale.setScalar(1 + Math.sin(temps * 9 + i * 2) * 0.12 + (v.attaque > 0 ? 0.4 : 0))));
  },
  moulinet(r, vue, acc, m) {
    // un bâton planté sur la tête, et un moulinet à quatre pales qui tourne à plat, comme
    // une hélice (vu d'en haut, on le voit toujours bien). Il tourne plus vite quand elle souffle.
    const { sommet, demiProfondeur } = vue.ancres;
    const z = -demiProfondeur * 0.3;
    r.boite(vue.corps, 0.03, 0.22, 0.03, 0, sommet + 0.1, z, m('#8a6240'));
    const helice = new THREE.Group();
    helice.position.set(0, sommet + 0.22, z);
    for (let i = 0; i < 4; i++) {
      // une pale : une plaque le long d'un bras de l'hélice, décalée d'un côté (c'est ce qui la fait « moulinet »)
      const bras = new THREE.Group();
      bras.rotation.y = (i * Math.PI) / 2;
      r.boite(bras, 0.2, 0.02, 0.09, 0.11, 0, 0.045, m(i % 2 ? '#fff4f0' : acc.couleur));
      helice.add(bras);
    }
    r.boite(helice, 0.05, 0.05, 0.05, 0, 0.01, 0, r.matBrillant('#ffd23a', 1.6)); // l'axe
    vue.corps.add(helice);
    let avant = null;
    vue.animations.push((temps, v) => {
      const dt = avant === null ? 0 : temps - avant;
      avant = temps;
      helice.rotation.y -= dt * (v.attaque > 0 ? 22 : 7);
    });
  },
  petits(r, vue, acc, m) {
    // trois petites gelées en cubes sur le dos, qui sautillent chacune à son tour
    const { sommet } = vue.ancres;
    const yeux = m('#10200c');
    const petits = [[-0.1, -0.05], [0.1, -0.05], [0, 0.07]].map(([x, z]) => {
      const petit = new THREE.Group();
      petit.position.set(x, sommet, z);
      r.boite(petit, 0.1, 0.08, 0.1, 0, 0.04, 0, m(acc.couleur, { transparent: true, opacity: 0.9 }));
      for (const sx of [-1, 1]) r.boite(petit, 0.02, 0.025, 0.01, sx * 0.022, 0.05, 0.051, yeux);
      vue.corps.add(petit);
      return petit;
    });
    vue.animations.push((temps) => petits.forEach((p, i) => (p.position.y = sommet + Math.max(0, Math.sin(temps * 7 + i * 2.1)) * 0.05)));
  },
  casque(r, vue, acc, m) {
    // un casque de mineur en blocs : la calotte, la visière, et la lampe qui brille devant
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const l = demiLargeur * 1.5, p = demiProfondeur * 1.5;
    r.boite(vue.corps, l + 0.06, 0.03, p + 0.06, 0, sommet + 0.015, 0, m(melanger(acc.couleur, '#000000', 0.2)));
    r.boite(vue.corps, l, 0.1, p, 0, sommet + 0.08, 0, m(acc.couleur));
    r.boite(vue.corps, l * 0.6, 0.04, p * 0.6, 0, sommet + 0.15, 0, m(acc.couleur));
    r.boite(vue.corps, 0.07, 0.07, 0.04, 0, sommet + 0.08, p / 2 + 0.02, r.matBrillant('#fff3a0', 2.6)); // la lampe
    vue.ancres.sommet = sommet + 0.17; // ce qui vient après (la couronne) se pose sur le casque
  },
  pioche(r, vue, acc, m) {
    // une pioche dans le dos : un manche en biais, et le fer en trois blocs tout en haut
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const pioche = new THREE.Group();
    pioche.position.set(demiLargeur * 0.4, sommet * 0.6, -demiProfondeur - 0.04);
    pioche.rotation.z = -0.55;
    r.boite(pioche, 0.035, 0.5, 0.035, 0, 0.12, 0, m('#8a6240'));
    const fer = m(acc.couleur, { metalness: 0.5, roughness: 0.4 });
    r.boite(pioche, 0.22, 0.05, 0.05, 0, 0.36, 0, fer);
    for (const sx of [-1, 1]) r.boite(pioche, 0.06, 0.05, 0.05, sx * 0.13, 0.33, 0, fer);
    vue.corps.add(pioche);
  },
  prisme(r, vue, acc) {
    // un cristal (un cube posé sur une pointe) qui flotte, tourne et brille ; plus fort quand le rayon chauffe
    const { sommet } = vue.ancres;
    const cristal = r.boite(vue.corps, 0.12, 0.12, 0.12, 0, sommet + 0.26, 0, r.matBrillant(acc.couleur, 1.6));
    cristal.castShadow = false;
    cristal.rotation.set(Math.PI / 4, 0, Math.PI / 4);
    const blanc = new THREE.Color(acc.couleur);
    vue.animations.push((temps, v) => {
      // sa couleur fait le tour de l'arc-en-ciel, mélangée à la couleur du cristal
      cristal.material.color.setHSL((temps * 0.25) % 1, 0.8, 0.75).lerp(blanc, 0.35).multiplyScalar(1.6 + (v.chauffe || 0));
      cristal.rotation.y = temps * 2.5;
      cristal.position.y = sommet + 0.26 + Math.sin(temps * 3) * 0.03;
      cristal.scale.setScalar(1 + (v.chauffe || 0) * 0.4);
    });
  },
  lunettes(r, vue, acc, m) {
    // deux cadres carrés devant les yeux, avec leurs verres
    const { yeux } = vue.ancres;
    if (!yeux) return;
    const cadre = m(acc.couleur), verre = m('#cfeeff', { transparent: true, opacity: 0.5 });
    const t = yeux.taille * 2.4;
    for (const sx of [-1, 1]) {
      const x = sx * yeux.ecart, z = yeux.z + 0.012;
      r.boite(vue.corps, t, 0.015, 0.02, x, yeux.y + t / 2, z, cadre);
      r.boite(vue.corps, t, 0.015, 0.02, x, yeux.y - t / 2, z, cadre);
      r.boite(vue.corps, 0.015, t, 0.02, x - t / 2, yeux.y, z, cadre);
      r.boite(vue.corps, 0.015, t, 0.02, x + t / 2, yeux.y, z, cadre);
      r.boite(vue.corps, t, t, 0.006, x, yeux.y, z, verre);
    }
  },
};
verifierStyle('voxel', GABARITS_VOXEL, ACCESSOIRES_VOXEL);

// ═════════════════════════════════════════════════════════════
// 5. LE RENDU
// ═════════════════════════════════════════════════════════════
export default class RenduVoxel {
  // niveau = l'objet renvoyé par chargerNiveau(fiche) : tout le décor est construit à partir de lui
  constructor(conteneur, niveau, reglages) {
    verifierApparences(GARDIENS, MONSTRES);
    this.conteneur = conteneur;
    this.niveau = niveau;
    this.temps = 0;
    this.secousse = 0;
    this.modeCamera = reglages?.camera || 'haute';
    // la qualité « économe » (option du joueur, pour les ordinateurs plus lents) : une image moins
    // fine, des ombres moins détaillées, pas de halo de lumière
    this.econome = reglages?.qualite === 'econome';
    this.tex = creerTextures();
    this.cacheMateriaux = new Map();

    // Moteur de rendu WebGL. Sur un écran très fin (Retina), une image « complète » a deux fois plus
    // de pixels en largeur et en hauteur, donc quatre fois plus à calculer : l'économe s'en passe.
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(this.econome ? 1 : Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping; // garde les couleurs vives (ACES les délave)
    conteneur.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(30, 1, 0.5, 600);
    this.raycaster = new THREE.Raycaster();

    this.creerLumieres();
    this.creerCiel();
    this.construireMonde();
    this.creerSocles();
    this.creerLanternes();
    this.creerDrapeaux();
    this.creerPoussieres();
    this.creerFaisceaux();

    this.particules = new Particules(this.scene, 1000);
    this.eclairs = []; // les éclairs d'Étincelle encore visibles
    this.anneau = this.creerAnneauPortee();

    // Synchronisation avec l'état du jeu
    // (clé « id:niveau » : un gardien amélioré est refabriqué avec sa nouvelle apparence)
    this.vuesTours = new Synchro(this.scene, (t) => this.creerVueTour(t), (v, t) => this.majVueTour(v, t), (v) => liberer(v.racine), (t) => t.id + ':' + t.niveau);
    this.vuesEnnemis = new Synchro(this.scene, (e) => this.creerVueEnnemi(e), (v, e) => this.majVueEnnemi(v, e), (v) => liberer(v.racine));
    this.vuesTirs = new Synchro(this.scene, (p) => this.creerVueTir(p), (v, p) => this.majVueTir(v, p));

    this.creerPostTraitement();

    // Ambiance : on part directement sur celle demandée, puis on glissera vers les suivantes
    this.ambianceCible = AMBIANCES[reglages?.ambiance] || AMBIANCES.doree;
    this.ambiance = this.copierAmbiance(this.ambianceCible);
    this.appliquerAmbiance();

    this.redimensionner();
  }

  // ── Lumières ───────────────────────────────────────────────
  creerLumieres() {
    this.hemi = new THREE.HemisphereLight('#c7a8ff', '#7a5230', 1);
    this.scene.add(this.hemi);

    this.soleil = new THREE.DirectionalLight('#ffb874', 3);
    this.soleil.castShadow = true;
    const s = this.soleil.shadow;
    s.mapSize.set(this.econome ? 2048 : 4096, this.econome ? 2048 : 4096); // la finesse des ombres
    s.camera.left = -24; s.camera.right = 24;
    s.camera.top = 24; s.camera.bottom = -24;
    s.camera.near = 1; s.camera.far = 140;
    s.bias = -0.0004;
    s.normalBias = 0.03;
    this.soleil.target.position.set(this.niveau.largeur / 2, 0, this.niveau.hauteur / 2);
    this.scene.add(this.soleil, this.soleil.target);

    // Brume « linéaire » : rien avant la distance near, tout noyé après far
    this.scene.fog = new THREE.Fog('#f0b896', 40, 120);
  }

  // ── Ciel : une grande sphère avec un dégradé, le halo du soleil et des étoiles ──
  creerCiel() {
    this.uniformesCiel = {
      uHaut: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBas: { value: new THREE.Color() },
      uHalo: { value: new THREE.Color() },
      uSoleilDir: { value: new THREE.Vector3(0, 0.3, -1) },
      uEtoiles: { value: 0 },
      uTemps: { value: 0 },
    };
    const ciel = new THREE.Mesh(
      new THREE.SphereGeometry(400, 32, 16),
      new THREE.ShaderMaterial({
        uniforms: this.uniformesCiel,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uHaut, uHorizon, uBas, uHalo, uSoleilDir;
          uniform float uEtoiles, uTemps;
          varying vec3 vDir;
          float hasard(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 45.164))) * 43758.5453); }
          float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
          float bruit(vec2 p) {
            vec2 i = floor(p), f = fract(p);
            f = f * f * (3.0 - 2.0 * f);
            return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
          }
          float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * bruit(p); p *= 2.03; a *= 0.5; } return v; }
          void main() {
            vec3 d = normalize(vDir);
            vec3 c = mix(uHorizon, uHaut, smoothstep(0.0, 0.55, d.y));
            c = mix(c, uBas, smoothstep(0.0, -0.25, d.y));
            float s = max(0.0, dot(d, normalize(uSoleilDir)));
            c += uHalo * (pow(s, 6.0) * 0.45 + pow(s, 60.0) * 0.9 + smoothstep(0.9988, 0.9993, s) * 4.0);
            // nuages : du bruit projeté sur un « plafond » au-dessus de nous, éclairé côté soleil
            if (d.y > 0.0) {
              vec2 p = d.xz / (d.y + 0.12) * 1.4 + vec2(uTemps * 0.012, 0.0);
              float n = fbm(p);
              float nuage = smoothstep(0.5, 0.78, n) * smoothstep(0.0, 0.18, d.y) * (1.0 - smoothstep(0.55, 0.9, d.y));
              vec3 couleurNuage = mix(uHorizon * 1.08, uHalo, pow(s, 3.0) * 0.8 + 0.15);
              c = mix(c, couleurNuage, nuage * 0.75 * (1.0 - uEtoiles * 0.6));
            }
            vec3 cellule = floor(d * 220.0);
            float etoile = step(0.9978, hasard(cellule)) * smoothstep(0.02, 0.3, d.y);
            c += vec3(etoile) * uEtoiles * (0.5 + 0.5 * sin(uTemps * 2.0 + hasard(cellule) * 40.0));
            gl_FragColor = vec4(c, 1.0);
          }`,
      }),
    );
    ciel.position.set(this.niveau.largeur / 2, 0, this.niveau.hauteur / 2);
    ciel.frustumCulled = false;
    this.scene.add(ciel);

  }

  // ── Matériaux ──────────────────────────────────────────────
  // Un matériau par type de bloc (certains blocs ont une texture différente dessus et sur les côtés)
  materiauxBloc(type) {
    const std = (map, extra = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.95, metalness: 0, ...extra });
    const t = this.tex;
    switch (type) {
      case 'herbe': {
        const cote = std(t.herbeCote), dessus = std(t.herbe), dessous = std(t.terre);
        return [cote, cote, dessus, dessous, cote, cote]; // ordre des faces : +x −x +y −y +z −z
      }
      case 'feuilles': return std(t.feuilles, { alphaTest: 0.5, side: THREE.DoubleSide });
      case 'neige': return std(t.neige, { roughness: 0.7 });
      case 'lanterne': return std(t.lanterne, { emissive: '#ffb347', emissiveMap: t.lanterne, emissiveIntensity: 0 });
      default: return std(t[type]);
    }
  }

  // Matériau pour les personnages (couleur unie + grain), mis en cache
  matUnite(couleur, options = {}) {
    const { unique, ...reglages } = options; // unique = un matériau rien qu'à lui (pas partagé)
    const cle = couleur + JSON.stringify(reglages);
    if (!unique && this.cacheMateriaux.has(cle)) return this.cacheMateriaux.get(cle);
    const mat = new THREE.MeshStandardMaterial({ color: couleur, map: this.tex.grain, roughness: 0.85, ...reglages });
    if (!unique) this.cacheMateriaux.set(cle, mat);
    return mat;
  }
  matBrillant(couleur, eclat = 2) {
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(eclat), toneMapped: false });
  }

  // ── Construction du monde en blocs ─────────────────────────
  construireMonde() {
    const blocs = {};   // type → liste de [x, y, z, teinte]
    const occupe = new Set();
    const poser = (type, bx, niveau, bz, teinte = 1) => {
      const cle = bx + ',' + niveau + ',' + bz;
      if (occupe.has(cle)) return;
      occupe.add(cle);
      (blocs[type] ||= []).push([bx, niveau, bz, teinte]);
    };
    const enlever = (bx, niveau, bz) => occupe.add(bx + ',' + niveau + ',' + bz); // réserve la case (= vide)

    // Zone couverte de blocs (plus grande que la zone de jeu, pour le paysage)
    const { largeur, hauteur, hauteurTerrain, distanceAuChemin, distanceEtang } = this.niveau;
    // zone couverte, en blocs : bien plus large que la zone de jeu, pour le paysage
    const X0 = -44, X1 = (largeur + 22) * 2, Z0 = -52, Z1 = (hauteur + 28) * 2;
    this.X0 = X0; this.Z0 = Z0; this.largeurBlocs = X1 - X0;
    const hauteurs = new Int16Array((X1 - X0) * (Z1 - Z0));
    const idx = (bx, bz) => (bx - X0) + (bz - Z0) * (X1 - X0);
    for (let bz = Z0; bz < Z1; bz++) {
      for (let bx = X0; bx < X1; bx++) {
        hauteurs[idx(bx, bz)] = Math.round(hauteurTerrain((bx + 0.5) * B, (bz + 0.5) * B) / B);
      }
    }
    this.hauteurs = hauteurs;
    const h = (bx, bz) => hauteurs[idx(Math.max(X0, Math.min(X1 - 1, bx)), Math.max(Z0, Math.min(Z1 - 1, bz)))];

    // Le château réserve son emplacement (on y aplanit le sol)
    const chateau = this.planChateau();

    for (let bz = Z0; bz < Z1; bz++) {
      for (let bx = X0; bx < X1; bx++) {
        const n = h(bx, bz);
        const x = (bx + 0.5) * B, z = (bz + 0.5) * B;
        const voisinMin = Math.min(h(bx + 1, bz), h(bx - 1, bz), h(bx, bz + 1), h(bx, bz - 1));
        const voisinMax = Math.max(h(bx + 1, bz), h(bx - 1, bz), h(bx, bz + 1), h(bx, bz - 1));
        const bordMonde = bx === X0 || bx === X1 - 1 || bz === Z0 || bz === Z1 - 1;

        // Type du bloc du dessus
        let dessus = 'herbe';
        if (distanceEtang(x, z) < 0.3) dessus = 'sable';
        else if (distanceAuChemin(x, z) < 0.6 && n <= 0) dessus = 'chemin';
        else if (chateau.cour(x, z)) dessus = 'chemin';
        else if (n >= 22) dessus = 'neige';
        else if (voisinMax - n >= 2 || n - voisinMin >= 3 || n >= 15) dessus = 'pierre';

        // Petite variation de teinte : l'herbe jaunit par endroits, ombre au pied des falaises
        let teinte = 0.92 + alea() * 0.12;
        if (dessus === 'herbe') teinte *= 0.95 + bruitFractal(x * 0.3, z * 0.3, 2) * 0.12;
        if (voisinMax > n) teinte *= 0.84; // fausse « occlusion ambiante »

        poser(dessus, bx, n, bz, teinte);
        // On remplit en dessous juste assez pour qu'on ne voie pas de trou sur les côtés
        const fond = bordMonde ? n - 6 : Math.min(n - 1, voisinMin);
        for (let k = n - 1; k >= fond; k--) {
          const sous = n - k > 2 || n >= 12 ? 'pierre' : 'terre';
          poser(dessus === 'neige' || dessus === 'pierre' ? 'pierre' : sous, bx, k, bz, 0.9 + alea() * 0.1);
        }
      }
    }

    chateau.construire(poser, enlever);
    this.planterArbres(poser, h);

    // Création d'un InstancedMesh par type de bloc
    const geo = new THREE.BoxGeometry(B, B, B);
    const geoChemin = new THREE.BoxGeometry(B, B - 0.06, B); // le chemin est un poil plus bas
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (const [type, liste] of Object.entries(blocs)) {
      const mesh = new THREE.InstancedMesh(type === 'chemin' ? geoChemin : geo, this.materiauxBloc(type), liste.length);
      liste.forEach(([bx, niveau, bz, teinte], i) => {
        const y = (niveau - 0.5) * B - (type === 'chemin' ? 0.03 : 0);
        m.makeTranslation((bx + 0.5) * B, y, (bz + 0.5) * B);
        mesh.setMatrixAt(i, m);
        // teinte = un nombre (plus clair / plus sombre) ou une vraie couleur (feuillages)
        mesh.setColorAt(i, teinte.isColor ? teinte : c.setScalar(teinte));
      });
      mesh.castShadow = type !== 'chemin' && type !== 'sable';
      mesh.receiveShadow = true;
      if (type === 'feuilles') this.feuilles = mesh;
      if (type === 'lanterne') this.blocsLanterne = mesh;
      this.scene.add(mesh);
    }
    this.blocsParType = blocs;

    this.creerEau();
    this.creerVegetation(h);
  }

  // Hauteur du sol (en unités 3D) sous un point du jeu
  sol(x, y) {
    const bx = Math.floor(x / B), bz = Math.floor(y / B);
    const i = (bx - this.X0) + (bz - this.Z0) * this.largeurBlocs;
    const n = this.hauteurs[i] ?? 0;
    return n * B;
  }

  // ── Le château ─────────────────────────────────────────────
  planChateau() {
    // Coordonnées en blocs, calculées autour du centre du château donné par la fiche.
    // La porte est à gauche, au bout du chemin.
    const c = this.niveau.chateau;
    const bloc = (v) => Math.floor(v / B + 1e-6); // (le 1e-6 évite qu'un 41,9999… devienne 41)
    const x0 = bloc(c.x - 1.6), x1 = bloc(c.x + 1.3);
    const z0 = bloc(c.y - 2.5), z1 = bloc(c.y + 2.4);
    const porteZ = [bloc(c.y - 0.5), bloc(c.y)]; // deux blocs de large
    const pierre = () => 0.9 + alea() * 0.12;

    // Une tour carrée : murs pleins, puis soit un toit pointu en escalier
    // (qui déborde un peu des murs), soit des créneaux
    const tour = (poser, bxA, bzA, cote, hauteur, toit = 'pointu') => {
      for (let bx = bxA; bx < bxA + cote; bx++) for (let bz = bzA; bz < bzA + cote; bz++) {
        for (let k = 1; k <= hauteur; k++) poser('briques', bx, k, bz, pierre());
      }
      if (!toit) {
        for (let bx = bxA; bx < bxA + cote; bx++) for (let bz = bzA; bz < bzA + cote; bz++) {
          const bord = bx === bxA || bx === bxA + cote - 1 || bz === bzA || bz === bzA + cote - 1;
          if (bord && (bx + bz) % 2 === 0) poser('briques', bx, hauteur + 1, bz, 0.95);
        }
        return;
      }
      // chaque étage du toit rétrécit d'un bloc de chaque côté (pyramide en escalier)
      const deborde = toit === 'large' ? 1 : 0;
      for (let etage = 0; cote + 2 * deborde - etage * 2 > 0; etage++) {
        const a = bxA - deborde + etage, b = bxA + cote - 1 + deborde - etage; // bornes en x (incluses)
        const c = bzA - deborde + etage, d = bzA + cote - 1 + deborde - etage; // bornes en z
        for (let bx = a; bx <= b; bx++) for (let bz = c; bz <= d; bz++) {
          poser('toit', bx, hauteur + 1 + etage, bz, etage === 0 ? 0.85 : 1);
        }
      }
    };

    return {
      cour: (x, z) => x > x0 * B && x < (x1 + 1) * B && z > z0 * B && z < (z1 + 1) * B,
      construire: (poser, enlever) => {
        // 1. Les deux tours qui encadrent la porte (elles avancent d'un bloc vers le chemin)
        tour(poser, x0 - 1, porteZ[0] - 2, 2, 7, false);
        tour(poser, x0 - 1, porteZ[1] + 1, 2, 7, false);
        // 2. La porte : un trou dans le mur, et du noir derrière
        for (const bz of porteZ) {
          for (let k = 1; k <= 3; k++) { enlever(x0, k, bz); poser('sombre', x0 + 1, k, bz); }
          poser('briques', x0, 4, bz, 0.85); // linteau au-dessus de la porte
          poser('briques', x0, 5, bz, 0.9);
        }
        // 3. Le mur d'enceinte avec ses créneaux
        for (let bx = x0; bx <= x1; bx++) for (let bz = z0; bz <= z1; bz++) {
          const bord = bx === x0 || bx === x1 || bz === z0 || bz === z1;
          if (!bord) continue;
          for (let k = 1; k <= 4; k++) poser('briques', bx, k, bz, pierre());
          if ((bx + bz) % 2 === 0) poser('briques', bx, 5, bz, 0.95);
        }
        // 4. Deux tours d'angle à l'arrière
        tour(poser, x1 - 1, z0, 2, 6);
        tour(poser, x1 - 1, z1 - 1, 2, 6);
        // 5. Le donjon, plus haut, au fond de la cour
        tour(poser, x0 + 2, porteZ[0] - 1, 4, 9);
        // Où planter les drapeaux : au sommet du donjon et sur les deux tours de la porte
        this.mats = [
          { x: (x0 + 4) * B, y: 12 * B, z: (porteZ[0] + 1) * B, grand: true },
          { x: x0 * B, y: 7 * B, z: (porteZ[0] - 1) * B },
          { x: x0 * B, y: 7 * B, z: (porteZ[1] + 2) * B },
        ];
        // 6. Bannières rouges sur la façade du donjon
        for (let k = 5; k <= 8; k++) {
          poser('laine', x0 + 1, k, porteZ[0] - 1);
          poser('laine', x0 + 1, k, porteZ[1] + 1);
        }
        // 7. Lanternes devant les tours de la porte
        poser('lanterne', x0 - 2, 3, porteZ[0] - 2);
        poser('lanterne', x0 - 2, 3, porteZ[1] + 2);
        this.torches = [
          new THREE.Vector3((x0 - 2.5) * B, 3 * B, (porteZ[0] - 1.5) * B),
          new THREE.Vector3((x0 - 2.5) * B, 3 * B, (porteZ[1] + 2.5) * B),
        ];
      },
    };
  }

  // ── Arbres (chênes, bouleaux, arbres d'automne) et rochers ──
  planterArbres(poser, h) {
    const teintes = {
      chene: ['#62a33e', '#6fae45', '#5a9838'],
      bouleau: ['#a6cc5c', '#b4d468', '#98c050'],
      automne: ['#ec8a2c', '#f2b23a', '#d9602a', '#f4c64a'],
    };
    for (const d of this.niveau.decor) {
      const bx = Math.floor(d.x / B), bz = Math.floor(d.y / B);
      const n = h(bx, bz);
      if (d.type === 'rocher') {
        const taille = d.taille > 0.8 ? 2 : 1;
        // un rocher moussu : quelques blocs, rarement plus haut qu'un bloc
        for (let i = 0; i < taille; i++) for (let j = 0; j < taille; j++) {
          if (taille === 2 && i + j === 2 && alea() < 0.5) continue;
          poser('mousse', bx + i, n + 1, bz + j, 0.85 + alea() * 0.2);
        }
        if (taille === 2 && alea() < 0.5) poser('mousse', bx, n + 2, bz, 0.95);
        continue;
      }
      if (!['chene', 'bouleau', 'automne'].includes(d.type)) continue;
      const tronc = d.type === 'bouleau' ? 'bouleau' : 'tronc';
      // dans la zone de jeu : des buissons bas (pour ne rien cacher), ailleurs de vrais arbres
      const hTronc = d.dedans ? 1 : Math.round(3 + d.taille * 2);
      for (let k = 1; k <= hTronc; k++) poser(tronc, bx, n + k, bz);
      // Le feuillage : une boule de blocs, plus large au milieu, irrégulière sur les bords
      const grand = d.taille > 1.1 && !d.dedans;
      const profil = grand ? [2, 3, 3, 2, 1] : d.dedans ? [1, 2, 1] : [1, 2, 2, 1, 0]; // rayon de chaque étage, du bas vers le haut
      const teinte = new THREE.Color(teintes[d.type][Math.floor(d.variante * teintes[d.type].length)]);
      profil.forEach((rr, etage) => {
        const dy = etage - 1;
        for (let dx = -rr; dx <= rr; dx++) for (let dz = -rr; dz <= rr; dz++) {
          if (dx * dx + dz * dz > rr * rr + alea() * 1.6) continue; // forme ronde aux bords irréguliers
          if (dx === 0 && dz === 0 && dy < 1) continue; // place du tronc
          // les blocs du haut sont plus clairs (ils prennent le soleil)
          const lumiere = 0.8 + etage * 0.07 + alea() * 0.2;
          poser('feuilles', bx + dx, n + hTronc + dy, bz + dz, teinte.clone().multiplyScalar(lumiere));
        }
      });
    }
  }

  // ── L'eau des étangs ───────────────────────────────────────
  creerEau() {
    this.matEau = new THREE.MeshStandardMaterial({
      color: '#3f8fb0', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.78,
      emissive: '#123848', emissiveIntensity: 0.4,
    });
    this.eaux = this.niveau.etangs.map((etang) => {
      const geo = new THREE.CircleGeometry(etang.rayon + 0.2, 48);
      geo.rotateX(-Math.PI / 2);
      const eau = new THREE.Mesh(geo, this.matEau);
      eau.position.set(etang.x, -0.18, etang.y);
      eau.receiveShadow = true;
      this.scene.add(eau);
      return eau;
    });
  }

  // ── Fleurs dorées et herbes hautes, qui ondulent avec le vent ──
  creerVegetation(h) {
    const niv = this.niveau;
    const ch = niv.chateau;
    // le rectangle du château et de ses abords, où l'on ne met pas de plantes
    const dansChateau = (x, z) => x > ch.x - 1.8 && x < ch.x + 2.4 && z > ch.y - 2.7 && z < ch.y + 2.7;
    const surUnSocle = (x, z) => niv.socles.some((s) => Math.hypot(s.x - x, s.y - z) < 0.65);
    const tiges = [], tetes = [];
    const couleursFleurs = ['#ffe03a', '#ffd21f', '#fff07a', '#fff6e0', '#ffffff', '#ffc832', '#c9a8ff'];
    const ajouterPlante = (x, z, hauteur, avecTete) => {
      const y = this.sol(x, z);
      tiges.push({ x, y, z, h: hauteur, c: avecTete ? '#6f9a38' : choisir(['#9ab84a', '#b5c25a', '#c9c25e', '#88aa40']) });
      if (avecTete) tetes.push({ x, y: y + hauteur, z, c: choisir(couleursFleurs), t: 0.09 + alea() * 0.06 });
    };
    for (const d of niv.decor) {
      if (d.type !== 'fleur') continue;
      if (d.x > 0 && d.x < niv.largeur && d.y > 0 && d.y < niv.hauteur && alea() < 0.5) continue; // moins chargé dans la zone de jeu
      const nb = 2 + Math.floor(alea() * 3);
      for (let i = 0; i < nb; i++) {
        ajouterPlante(d.x + (alea() - 0.5) * 0.6, d.y + (alea() - 0.5) * 0.6, 0.14 + alea() * 0.26 * d.taille, true);
      }
    }
    // Champs de fleurs dorées tout autour de la zone de jeu (la signature de ce style)
    const dorees = ['#ffe02a', '#ffd000', '#ffc21a', '#ffec5a', '#ffe14a', '#ffb31a', '#fff59a'];
    for (let i = 0; i < 42000; i++) {
      const x = -12 + alea() * (niv.largeur + 24), z = -7 + alea() * (niv.hauteur + 16);
      const dedans = x > 0.2 && x < niv.largeur - 0.2 && z > 0.2 && z < niv.hauteur - 0.2;
      const champ = bruitFractal(x * 0.14 + 5, z * 0.14 + 9, 3);
      if (dedans ? alea() > 0.012 : champ < 0.45 && alea() > 0.06) continue;
      if (niv.distanceAuChemin(x, z) < 0.75) continue;
      if (niv.distanceEtang(x, z) < 0.3) continue;
      if (dansChateau(x, z) || surUnSocle(x, z)) continue;
      if (h(Math.floor(x / B), Math.floor(z / B)) > 10) continue;
      const hauteur = 0.22 + alea() * 0.38;
      const y = this.sol(x, z);
      tiges.push({ x, y, z, h: hauteur, c: choisir(['#7a9a34', '#8aa83c', '#6e8e2e']) });
      tetes.push({ x, y: y + hauteur, z, c: choisir(dorees), t: 0.12 + alea() * 0.09 });
    }

    // Herbes hautes un peu partout sur l'herbe
    for (let i = 0; i < 5000; i++) {
      const x = -12 + alea() * (niv.largeur + 24), z = -8 + alea() * (niv.hauteur + 20);
      if (niv.distanceAuChemin(x, z) < 0.7) continue;
      if (niv.distanceEtang(x, z) < 0.3) continue;
      if (dansChateau(x, z) || surUnSocle(x, z)) continue;
      if (h(Math.floor(x / B), Math.floor(z / B)) > 12) continue;
      ajouterPlante(x, z, 0.1 + alea() * 0.18, false);
    }

    // Matériau « vent » : on décale le haut des plantes avec une sinusoïde
    const temps = { value: 0 };
    this.uTempsVent = temps;
    this.uLueur = { value: 0 }; // les fleurs brillent un peu à contre-jour
    const matVent = (tete) => {
      const mat = new THREE.MeshStandardMaterial({ roughness: 0.8, map: this.tex.grain });
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uTemps = temps;
        if (tete) {
          shader.uniforms.uLueur = this.uLueur;
          shader.fragmentShader = 'uniform float uLueur;\n' + shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            '#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * uLueur;',
          );
        }
        shader.vertexShader = 'uniform float uTemps;\n' + shader.vertexShader.replace(
          '#include <project_vertex>',
          /* glsl */ `
          vec4 mvPosition = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            mvPosition = instanceMatrix * mvPosition;
            vec3 pied = instanceMatrix[3].xyz;
          #else
            vec3 pied = vec3(0.0);
          #endif
          float poids = ${tete ? '1.0' : 'position.y + 0.5'};
          float vent = sin(uTemps * 1.7 + pied.x * 0.55 + pied.z * 0.35) * 0.6 + sin(uTemps * 3.1 + pied.x * 1.3) * 0.25;
          mvPosition.x += vent * 0.07 * poids;
          mvPosition.z += vent * 0.03 * poids;
          mvPosition = modelViewMatrix * mvPosition;
          gl_Position = projectionMatrix * mvPosition;`,
        );
      };
      return mat;
    };

    const geo = new THREE.BoxGeometry(1, 1, 1);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    const q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    const meshTiges = new THREE.InstancedMesh(geo, matVent(false), tiges.length);
    tiges.forEach((t, i) => {
      m.compose(v.set(t.x, t.y + t.h / 2, t.z), q, s.set(0.035, t.h, 0.035));
      meshTiges.setMatrixAt(i, m);
      meshTiges.setColorAt(i, c.set(t.c));
    });
    const meshTetes = new THREE.InstancedMesh(geo, matVent(true), tetes.length);
    tetes.forEach((t, i) => {
      m.compose(v.set(t.x, t.y, t.z), q, s.set(t.t, t.t * 0.8, t.t));
      meshTetes.setMatrixAt(i, m);
      meshTetes.setColorAt(i, c.set(t.c));
    });
    for (const mesh of [meshTiges, meshTetes]) {
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  // ── Les socles où l'on pose les gardiens ───────────────────
  creerSocles() {
    this.socles = this.niveau.socles.map((e, i) => {
      const groupe = new THREE.Group();
      groupe.position.set(e.x, this.sol(e.x, e.y), e.y);
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 1.1), new THREE.MeshStandardMaterial({ map: this.tex.pierre, roughness: 0.95 }));
      base.position.y = 0.09;
      const dessus = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.86), new THREE.MeshStandardMaterial({ map: this.tex.briques, roughness: 0.9, emissive: '#ffc260', emissiveIntensity: 0 }));
      dessus.position.y = 0.24;
      for (const mesh of [base, dessus]) { mesh.castShadow = mesh.receiveShadow = true; groupe.add(mesh); }
      // Petit cube doré qui flotte au-dessus des socles libres
      const repere = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), this.matBrillant('#ffcc55', 1.6));
      repere.position.y = 0.7;
      repere.rotation.set(Math.PI / 4, 0, Math.PI / 4);
      groupe.add(repere);
      // Boîte invisible plus grande, pour cliquer facilement (même quand un gardien est dessus)
      const zone = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 1.1), new THREE.MeshBasicMaterial({ visible: false }));
      zone.position.y = 0.7;
      zone.userData.index = i;
      groupe.add(zone);
      this.scene.add(groupe);
      return { groupe, dessus, repere, zone };
    });
  }

  // ── Drapeaux du château (ils ondulent) ─────────────────────
  creerDrapeaux() {
    this.drapeaux = [];
    const bois = new THREE.MeshStandardMaterial({ map: this.tex.planches, roughness: 0.9 });
    const tissu = new THREE.MeshStandardMaterial({ map: this.tex.laine, roughness: 1 });
    for (const m of this.mats) {
      const haut = m.grand ? 1.6 : 1.0;
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.07, haut, 0.07), bois);
      mat.position.set(m.x, m.y + haut / 2, m.z);
      mat.castShadow = true;
      this.scene.add(mat);
      // le drapeau : trois morceaux à la suite, chacun pivote un peu plus que le précédent
      let parent = new THREE.Group();
      parent.position.set(m.x, m.y + haut - 0.18, m.z);
      this.scene.add(parent);
      const morceaux = [];
      const l = m.grand ? 0.22 : 0.15, h = m.grand ? 0.34 : 0.24;
      for (let i = 0; i < 3; i++) {
        const pivot = new THREE.Group();
        pivot.position.x = i === 0 ? 0.035 : l;
        const morceau = new THREE.Mesh(new THREE.BoxGeometry(l, h, 0.03), tissu);
        morceau.position.x = l / 2;
        morceau.castShadow = true;
        pivot.add(morceau);
        parent.add(pivot);
        morceaux.push(pivot);
        parent = pivot;
      }
      this.drapeaux.push(morceaux);
    }
  }

  // ── Lanternes le long du chemin + leur lumière la nuit ─────
  creerLanternes() {
    this.lumieresNuit = [];
    const poteau = new THREE.MeshStandardMaterial({ map: this.tex.planches, roughness: 0.9 });
    this.matLanterne = new THREE.MeshStandardMaterial({ map: this.tex.lanterne, emissive: '#ffb347', emissiveMap: this.tex.lanterne, emissiveIntensity: 0.2 });
    for (const l of this.niveau.lanternes) {
      const y0 = this.sol(l.x, l.y);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), poteau);
      p.position.set(l.x, y0 + 0.45, l.y);
      const bras = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, 0.06), poteau);
      bras.position.set(l.x + 0.12, y0 + 0.88, l.y);
      const lanterne = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.2, 0.18), this.matLanterne);
      lanterne.position.set(l.x + 0.24, y0 + 0.74, l.y);
      for (const o of [p, bras, lanterne]) { o.castShadow = true; this.scene.add(o); }
      const lumiere = new THREE.PointLight('#ffb35a', 0, 5.5, 1.6);
      lumiere.position.copy(lanterne.position);
      this.scene.add(lumiere);
      this.lumieresNuit.push(lumiere);
    }
    for (const t of this.torches) {
      const lumiere = new THREE.PointLight('#ff9a40', 0, 6, 1.6);
      lumiere.position.copy(t);
      this.scene.add(lumiere);
      this.lumieresNuit.push(lumiere);
    }
  }

  // ── Poussières dorées dans la lumière / lucioles la nuit ───
  creerPoussieres() {
    const N = 500;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    this.poussieres = [];
    for (let i = 0; i < N; i++) {
      this.poussieres.push({
        x: -3 + alea() * (this.niveau.largeur + 6), y: 0.2 + alea() * 3.5, z: -2 + alea() * (this.niveau.hauteur + 4),
        phase: alea() * 100, vitesse: 0.2 + alea() * 0.5,
      });
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    // Petite texture ronde et floue
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    const mat = new THREE.PointsMaterial({
      size: 0.13, map: new THREE.CanvasTexture(c), vertexColors: true, transparent: true,
      depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.nuagePoussieres = new THREE.Points(geo, mat);
    this.nuagePoussieres.frustumCulled = false;
    this.scene.add(this.nuagePoussieres);
  }

  majPoussieres(dt) {
    const a = this.ambiance;
    const pos = this.nuagePoussieres.geometry.attributes.position;
    const col = this.nuagePoussieres.geometry.attributes.color;
    const dore = new THREE.Color('#ffd9a0'), luciole = new THREE.Color('#c8ff6a');
    this.poussieres.forEach((p, i) => {
      p.phase += dt * p.vitesse;
      const x = p.x + Math.sin(p.phase * 0.7) * 0.6 + this.temps * 0.05 % 1;
      const y = p.y + Math.sin(p.phase * 1.3) * 0.3;
      const z = p.z + Math.cos(p.phase * 0.5) * 0.6;
      pos.setXYZ(i, x, y, z);
      // la poussière scintille doucement, les lucioles clignotent
      const scint = 0.5 + 0.5 * Math.sin(p.phase * 3);
      const clign = Math.pow(Math.max(0, Math.sin(p.phase * 2.2)), 6);
      const r = dore.r * scint * 0.35 * a.poussiere + luciole.r * clign * 1.6 * a.lucioles;
      const g = dore.g * scint * 0.35 * a.poussiere + luciole.g * clign * 1.6 * a.lucioles;
      const b = dore.b * scint * 0.35 * a.poussiere + luciole.b * clign * 1.6 * a.lucioles;
      col.setXYZ(i, r, g, b);
    });
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }

  // ── Faisceaux de lumière ───────────────────────────────────
  // De longs rubans transparents, alignés sur la direction du soleil, qui
  // s'additionnent à l'image : on dirait des rayons qui traversent l'air.
  creerFaisceaux() {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // l'origine du ruban est au sol, il monte vers le soleil
    this.faisceaux = [];
    for (let i = 0; i < 11; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: { uCouleur: { value: new THREE.Color() }, uForce: { value: 0 } },
        vertexShader: /* glsl */ `
          varying vec2 vUv;
          void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uCouleur;
          uniform float uForce;
          varying vec2 vUv;
          void main() {
            float bords = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x);
            float longueur = smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.35, vUv.y);
            gl_FragColor = vec4(uCouleur * uForce * bords * longueur, 1.0);
          }`,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      mesh.userData = {
        x: -2 + alea() * (this.niveau.largeur + 4), z: -1 + alea() * (this.niveau.hauteur + 2),
        largeur: 0.6 + alea() * 2.2, longueur: 18 + alea() * 14, phase: alea() * 10,
      };
      this.scene.add(mesh);
      this.faisceaux.push(mesh);
    }
  }

  majFaisceaux() {
    const axe = this.dirSoleil;
    const versCamera = new THREE.Vector3(), cote = new THREE.Vector3(), face = new THREE.Vector3();
    const base = new THREE.Vector3(), echelle = new THREE.Vector3();
    for (const f of this.faisceaux) {
      const d = f.userData;
      base.set(d.x, 0, d.z);
      // le ruban tourne autour de son axe pour toujours faire face à la caméra
      versCamera.subVectors(this.camera.position, base).normalize();
      cote.crossVectors(axe, versCamera).normalize();
      face.crossVectors(cote, axe);
      f.matrix.makeBasis(cote, axe, face);
      f.matrix.scale(echelle.set(d.largeur, d.longueur, 1));
      f.matrix.setPosition(base);
      f.matrixWorldNeedsUpdate = true;
      // chaque faisceau « respire » lentement
      const respire = 0.5 + 0.5 * Math.sin(this.temps * 0.35 + d.phase);
      f.material.uniforms.uForce.value = this.ambiance.rayons * 0.075 * respire;
      f.material.uniforms.uCouleur.value.copy(this.ambiance.rayonsCouleur);
    }
  }

  creerAnneauPortee() {
    const groupe = new THREE.Group();
    const anneau = new THREE.Mesh(
      new THREE.RingGeometry(0.96, 1, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }),
    );
    const disque = new THREE.Mesh(
      new THREE.CircleGeometry(0.96, 96).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0.12, depthWrite: false }),
    );
    groupe.add(anneau, disque);
    groupe.visible = false;
    groupe.renderOrder = 5;
    this.scene.add(groupe);
    return groupe;
  }

  // ═══════════════════════════════════════════════════════════
  // LES PERSONNAGES (fabriqués par les gabarits ci-dessus)
  // ═══════════════════════════════════════════════════════════
  boite(parent, l, h, p, x, y, z, mat) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(l, h, p), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Un gardien : petit corps rectangulaire, deux yeux, des bras et quatre pattes,
  // puis un accessoire qui montre son pouvoir.
  // Fabrique un personnage à partir de l'apparence de sa fiche (donnees.js).
  // unique = true pour les monstres : chacun a ses propres matériaux, pour
  // pouvoir clignoter quand il est touché sans faire clignoter les autres.
  fabriquer(apparence, unique = false) {
    const app = lireApparence(apparence);
    const racine = new THREE.Group();
    const corps = new THREE.Group(); // groupe à part pour les animations (écrasement, sauts…)
    racine.add(corps);
    const materiaux = [];
    const m = (couleur, extra = {}) => {
      const mat = this.matUnite(couleur, { ...extra, unique });
      if (unique) materiaux.push(mat);
      return mat;
    };
    const vue = {
      racine, corps, materiaux, pattes: [], animations: [], gabarit: app.gabarit, taille: app.taille,
      apparition: 0, hauteurBarre: 0.6, largeurBarre: 0.4,
    };
    GABARITS_VOXEL[app.gabarit].fabriquer(this, vue, app, m);
    for (const acc of app.accessoires) ACCESSOIRES_VOXEL[acc.type](this, vue, acc, m);
    corps.scale.setScalar(app.taille);
    vue.hauteurBarre *= app.taille;
    vue.largeurBarre *= app.taille; // un gros monstre a une grande barre de vie
    return vue;
  }

  // Le portrait d'un personnage (pour les fiches du didacticiel). La lumière est
  // presque blanche : une lumière dorée tirerait les couleurs vers le vert.
  portrait(apparence) {
    this.appareilPhoto ||= creerAppareilPhoto();
    const soleil = new THREE.DirectionalLight('#fff4e4', 2.8);
    soleil.position.set(-2, 3, 3);
    const vue = this.fabriquer(apparence, true); // true : des matériaux à lui, qu'on peut jeter ensuite
    return photographier(this.appareilPhoto, vue.racine, [new THREE.HemisphereLight('#ffffff', '#8a8494', 1.9), soleil]);
  }

  creerVueTour(tour) {
    const vue = this.fabriquer(caracteristiques(tour.type, tour.niveau).apparence); // l'apparence de SON niveau
    vue.racine.scale.setScalar(0.01);
    vue.racine.rotation.y = versRotationY(tour.angle); // tourné tout de suite vers sa cible
    return vue;
  }

  majVueTour(vue, tour) {
    const e = this.niveau.socles[tour.socle];
    vue.racine.position.set(e.x, this.sol(e.x, e.y) + 0.3, e.y);
    // se tourne doucement vers sa cible
    const cible = versRotationY(tour.angle);
    let diff = cible - vue.racine.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    vue.racine.rotation.y += diff * 0.25;
    // apparition avec un petit rebond
    vue.apparition = Math.min(1, vue.apparition + 1 / 20);
    const t = vue.apparition;
    vue.racine.scale.setScalar(TAILLE_GARDIEN * (t < 1 ? 1 + Math.sin(t * Math.PI) * 0.25 - (1 - t) * 0.9 : 1));
    // respiration + écrasement quand il attaque
    const respire = Math.sin(this.temps * 3 + tour.id) * 0.03;
    const coup = tour.attaque > 0 ? Math.sin((tour.attaque / 0.25) * Math.PI) * 0.18 : 0;
    vue.corps.scale.y = vue.taille * (1 + respire - coup);
    vue.corps.position.y = coup * 0.15;
    vue.attaque = tour.attaque; // les accessoires réagissent quand il attaque (antennes, moulinet)
    vue.chauffe = tour.rayon ? tour.chauffe : 0; // et quand son rayon chauffe (le cristal du Prisme)
    for (const animer of vue.animations) animer(this.temps, vue);
    // assommé par le feu du Dragon : il vacille, et trois étoiles (des cubes dorés) tournent au-dessus de lui
    vue.corps.rotation.z = tour.assomme > 0 ? Math.sin(this.temps * 9) * 0.12 : 0;
    if (tour.assomme > 0 && !vue.etoiles) {
      vue.etoiles = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        this.boite(vue.etoiles, 0.07, 0.07, 0.07, Math.cos((k * Math.PI * 2) / 3) * 0.22, 0, Math.sin((k * Math.PI * 2) / 3) * 0.22, this.matBrillant('#ffe14a', 2.4)).castShadow = false;
      }
      vue.etoiles.position.y = 0.85;
      vue.racine.add(vue.etoiles);
    }
    if (vue.etoiles) {
      vue.etoiles.visible = tour.assomme > 0;
      vue.etoiles.rotation.y = this.temps * 5;
    }
  }

  creerVueEnnemi(ennemi) {
    const fiche = MONSTRES[ennemi.type];
    const vue = this.fabriquer(fiche.apparence, true);
    vue.racine.scale.setScalar(TAILLE_MONSTRE);
    vue.vol = fiche.volant ? HAUTEUR_VOL / TAILLE_MONSTRE : 0; // un volant vole (le soleil dessine son ombre par terre)
    vue.barre = creerBarreDeVie(vue.largeurBarre);
    vue.racine.add(vue.barre);
    vue.barre.position.y = vue.hauteurBarre + vue.vol;
    return vue;
  }

  majVueEnnemi(vue, e) {
    const t = this.temps + e.id;
    const y = this.sol(e.x, e.y) - 0.06;
    vue.racine.position.set(e.x, y, e.y);
    vue.racine.rotation.y = Math.atan2(e.dx, e.dy);
    // sous terre (la Taupe) : on cache le monstre, on montre un tas de terre en blocs qui avance
    vue.corps.visible = !e.cache;
    if (e.cache && !vue.butte) {
      vue.butte = new THREE.Group();
      const terre = this.matUnite('#8a6440'), terreClaire = this.matUnite('#a07a50');
      this.boite(vue.butte, 0.3, 0.1, 0.36, 0, 0.05, 0, terre);
      this.boite(vue.butte, 0.18, 0.08, 0.2, 0, 0.13, 0, terreClaire);
      vue.racine.add(vue.butte);
    }
    if (vue.butte) {
      vue.butte.visible = e.cache;
      if (e.cache) {
        vue.butte.scale.y = 1 + Math.sin(t * 14) * 0.15;
        if (Math.random() < 0.3) this.particules.emettre({ x: e.x, y: y + 0.15, z: e.y, vx: (Math.random() - 0.5) * 1.2, vy: 1.4, vz: (Math.random() - 0.5) * 1.2, couleur: Math.random() < 0.5 ? '#8a6440' : '#a07a50', taille: 0.05, vie: 0.4 });
        vue.barre.visible = false;
        return;
      }
    }
    const lent = e.facteurRalenti < 1 ? 0.5 : 1; // un monstre gelé bouge au ralenti
    vue.corps.position.y = 0;
    GABARITS_VOXEL[vue.gabarit].animer(vue, t, lent);
    // en l'air : la hauteur de vol, et le bond d'un petit qui vient de naître
    vue.corps.position.y += vue.vol + Math.sin(e.bond * Math.PI) * 0.3;
    // soufflé par le vent : il bascule en arrière, et des filets de vent passent autour de lui
    vue.corps.rotation.x = e.recul > 0 ? -0.45 : 0;
    if (e.recul > 0 && Math.random() < 0.6) {
      this.particules.emettre({ x: e.x + (Math.random() - 0.5) * 0.4, y: y + 0.3 + vue.vol * TAILLE_MONSTRE, z: e.y + (Math.random() - 0.5) * 0.4, vx: -e.dx * 3, vz: -e.dy * 3, couleur: '#ffffff', taille: 0.05, vie: 0.3, gravite: 0, eclat: 1.4 });
    }
    vue.attaque = 0;
    for (const animer of vue.animations) animer(this.temps, vue);
    // flash blanc quand il est touché, reflet bleu quand il est gelé
    // (plus léger sur un chef : touché sans arrêt par tous les gardiens, il serait tout blanc)
    const k = MONSTRES[e.type].boss ? 0.35 : 1;
    const flash = e.touche > 0 ? 0.35 * k : 0;
    for (const mat of vue.materiaux) {
      if (flash) mat.emissive.set('#fff2dc');
      else if (lent < 1) mat.emissive.set('#3aa8ff');
      mat.emissiveIntensity = flash || (lent < 1 ? 0.45 * k : 0);
    }
    majBarreDeVie(vue.barre, e.pv / e.pvMax, this.camera);
  }

  creerVueTir(p) {
    let mesh;
    if (p.type === 'feu') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.15), this.matBrillant('#ff9a2a', 2.8));
    else if (p.type === 'glace') mesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.26), this.matBrillant('#bff4ff', 2.2));
    else if (p.type === 'vent') {
      // un petit tourbillon : trois cubes blancs qui tournent autour d'un centre
      mesh = new THREE.Group();
      const blanc = this.matUnite('#ffffff', { transparent: true, opacity: 0.85, emissive: '#c8fff0', emissiveIntensity: 0.6 });
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        this.boite(mesh, 0.08, 0.08, 0.08, Math.cos(a) * 0.12, i * 0.04, Math.sin(a) * 0.12, blanc).castShadow = false;
      }
    } else {
      mesh = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), this.matUnite('#6a5a78', { emissive: '#7a40c0', emissiveIntensity: 0.5 }));
      mesh.castShadow = true;
    }
    return { racine: mesh, ancienne: null };
  }

  majVueTir(vue, p) {
    const y = this.sol(p.x, p.y) + p.z;
    const avant = vue.racine.position.clone();
    vue.racine.position.set(p.x, y, p.y);
    if (p.type === 'glace') vue.racine.lookAt(avant.lerp(vue.racine.position, 2));
    if (p.type === 'rocher') vue.racine.rotation.x += 0.2;
    // traînée de particules
    if (p.type === 'feu' && Math.random() < 0.8) {
      this.particules.emettre({ x: p.x, y, z: p.y, vy: 0.6, couleur: Math.random() < 0.5 ? '#ff7a1a' : '#ffc23a', taille: 0.07, vie: 0.3, gravite: 0, eclat: 2.2 });
    }
    if (p.type === 'glace' && Math.random() < 0.5) {
      this.particules.emettre({ x: p.x, y, z: p.y, couleur: '#dff8ff', taille: 0.04, vie: 0.35, gravite: -1, eclat: 1.8 });
    }
    if (p.type === 'vent') {
      vue.racine.rotation.y -= 0.35;
      if (Math.random() < 0.5) this.particules.emettre({ x: p.x, y, z: p.y, couleur: '#e4fff6', taille: 0.05, vie: 0.3, gravite: 0, eclat: 1.4 });
    }
  }

  // ── Les rayons du Prisme ───────────────────────────────────
  // Un long bloc lumineux tendu entre le cristal et le monstre (le halo du post-traitement
  // le fait briller) ; sa couleur fait le tour de l'arc-en-ciel, et il grossit quand il chauffe.
  majRayons(etat) {
    this.rayons ||= new Map();
    this.blocRayon ||= new THREE.BoxGeometry(0.08, 1, 0.08);
    const vus = new Set(), haut = new THREE.Vector3(0, 1, 0);
    for (const tour of etat.tours) {
      const cible = tour.rayon && etat.ennemis.find((e) => e.id === tour.rayon);
      if (!cible) continue;
      let rayon = this.rayons.get(tour.id);
      if (!rayon) {
        rayon = new THREE.Mesh(this.blocRayon, new THREE.MeshBasicMaterial({ toneMapped: false }));
        this.scene.add(rayon);
        this.rayons.set(tour.id, rayon);
      }
      vus.add(tour.id);
      const a = new THREE.Vector3(tour.x, this.sol(tour.x, tour.y) + 1.45, tour.y);
      const b = new THREE.Vector3(cible.x, this.sol(cible.x, cible.y) + 0.45 + (MONSTRES[cible.type].volant ? HAUTEUR_VOL : 0), cible.y);
      const dir = b.clone().sub(a);
      rayon.position.copy(a).addScaledVector(dir, 0.5);
      rayon.quaternion.setFromUnitVectors(haut, dir.clone().normalize());
      const epaisseur = 0.6 + tour.chauffe * 1.1;
      rayon.scale.set(epaisseur, dir.length(), epaisseur);
      rayon.material.color.setHSL((this.temps * 0.8) % 1, 1, 0.6).multiplyScalar(1.6 + tour.chauffe * 1.4);
      if (Math.random() < 0.5) this.particules.emettre({ x: b.x, y: b.y, z: b.z, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, couleur: '#fff4fa', taille: 0.04, vie: 0.25, eclat: 2.5 });
    }
    for (const [id, rayon] of this.rayons) {
      if (vus.has(id)) continue;
      this.scene.remove(rayon);
      rayon.material.dispose();
      this.rayons.delete(id);
    }
  }

  // ── Les éclairs d'Étincelle ────────────────────────────────
  // Un éclair = une suite de fins bâtons lumineux (le halo du post-traitement les fait
  // briller), en zigzag d'un point touché au suivant. On refait le zigzag plusieurs
  // fois par seconde : il crépite.
  ajouterEclair(points) {
    const groupe = new THREE.Group();
    this.scene.add(groupe);
    // le premier point est le gardien : l'éclair part du bout de ses antennes
    const pts = points.map((q, i) => new THREE.Vector3(q.x, this.sol(q.x, q.y) + (i === 0 ? 1.4 : q.h + 0.1), q.y));
    this.eclairs.push({ groupe, pts, vie: 0.22, refaire: 0 });
  }

  majEclairs(dt) {
    this.batonEclair ||= new THREE.BoxGeometry(0.045, 1, 0.045); // un bâton de 1 de long, étiré ensuite
    this.matEclair ||= this.matBrillant('#fff0a0', 3.2);
    const haut = new THREE.Vector3(0, 1, 0), dir = new THREE.Vector3();
    this.eclairs = this.eclairs.filter((eclair) => {
      eclair.vie -= dt;
      if (eclair.vie <= 0) { this.scene.remove(eclair.groupe); return false; }
      eclair.refaire -= dt;
      if (eclair.refaire > 0) return true;
      eclair.refaire = 0.05;
      eclair.groupe.clear();
      for (let i = 0; i < eclair.pts.length - 1; i++) {
        const a = eclair.pts[i], b = eclair.pts[i + 1];
        const n = Math.max(2, Math.round(a.distanceTo(b) / 0.3));
        let avant = a;
        for (let k = 1; k <= n; k++) {
          // un point sur la ligne droite, décalé au hasard (sauf le dernier, pile sur le monstre)
          const p = a.clone().lerp(b, k / n);
          if (k < n) p.add(new THREE.Vector3((Math.random() - 0.5) * 0.25, (Math.random() - 0.5) * 0.15, (Math.random() - 0.5) * 0.25));
          dir.subVectors(p, avant);
          const baton = new THREE.Mesh(this.batonEclair, this.matEclair);
          baton.position.copy(avant).addScaledVector(dir, 0.5);
          baton.quaternion.setFromUnitVectors(haut, dir.clone().normalize());
          baton.scale.set(1, dir.length() + 0.02, 1);
          eclair.groupe.add(baton);
          avant = p;
        }
      }
      return true;
    });
  }

  // ═══════════════════════════════════════════════════════════
  // 6. LES EFFETS (particules selon ce qui s'est passé dans le jeu)
  // ═══════════════════════════════════════════════════════════
  gerbe(x, y, z, nombre, couleurs, { force = 2, haut = 2.5, taille = 0.08, vie = 0.6, eclat = 1, gravite = -7 } = {}) {
    for (let i = 0; i < nombre; i++) {
      const a = Math.random() * Math.PI * 2, f = force * (0.3 + Math.random() * 0.7);
      this.particules.emettre({
        x, y, z, vx: Math.cos(a) * f, vy: haut * (0.4 + Math.random() * 0.8), vz: Math.sin(a) * f,
        couleur: couleurs[Math.floor(Math.random() * couleurs.length)],
        taille: taille * (0.6 + Math.random() * 0.8), vie: vie * (0.6 + Math.random() * 0.6), eclat, gravite, frein: 0.97,
      });
    }
  }

  traiterEvenements(evenements) {
    for (const ev of evenements) {
      const y = this.sol(ev.x, ev.y);
      switch (ev.type) {
        case 'tir':
          if (ev.quoi === 'grondin') this.gerbe(ev.x, y + 1, ev.y, 6, ['#d8c8b0', '#a89880'], { force: 0.8, haut: 1.2, vie: 0.5 });
          break;
        case 'impact':
          if (ev.quoi === 'feu') this.gerbe(ev.x, y + 0.35, ev.y, 9, ['#ff7a1a', '#ffc23a', '#ffe68a'], { force: 1.6, haut: 1.6, taille: 0.07, vie: 0.35, eclat: 2.4 });
          else if (ev.quoi !== 'vent') this.gerbe(ev.x, y + 0.35, ev.y, 9, ['#e8fbff', '#9fe6ff', '#ffffff'], { force: 1.4, haut: 1.4, taille: 0.06, vie: 0.5, eclat: 1.8 });
          break;
        case 'souffle': // une rafale : des filets de vent qui partent au ras du sol
          this.gerbe(ev.x, y + 0.25, ev.y, 18, ['#ffffff', '#e4fff6', '#c4f0e0'], { force: 3.5, haut: 0.5, taille: 0.07, vie: 0.4, gravite: 0, eclat: 1.3 });
          break;
        case 'eclair':
          this.ajouterEclair(ev.points);
          for (const q of ev.points.slice(1)) this.gerbe(q.x, this.sol(q.x, q.y) + q.h + 0.1, q.y, 6, ['#fff6c0', '#ffe14a', '#a8f0ff'], { force: 1.4, haut: 1.2, taille: 0.05, vie: 0.3, eclat: 2.6 });
          break;
        case 'naissance': // les petits sortent dans une gerbe de leur couleur
          this.gerbe(ev.x, y + 0.3, ev.y, 14, couleursEclats(MONSTRES[ev.quoi].apparence), { force: 1.8, haut: 3, taille: 0.09, vie: 0.6 });
          this.gerbe(ev.x, y + 0.3, ev.y, 10, ['#e8d8b8', '#c8b898'], { force: 2, haut: 0.8, taille: 0.1, vie: 0.5, gravite: -2 });
          break;
        case 'carapace': // le coup ricoche sur la carapace : deux étincelles
          this.gerbe(ev.x, y + 0.35, ev.y, 2, ['#ffffff', '#c8ccd4'], { force: 1.5, haut: 1.2, taille: 0.04, vie: 0.2, eclat: 2.2 });
          break;
        case 'plonge':
        case 'surgit': // la Taupe plonge ou ressort : des blocs de terre qui volent
          this.gerbe(ev.x, y + 0.1, ev.y, 12, ['#8a6440', '#a07a50', '#5a3e26'], { force: 1.6, haut: 2.2, taille: 0.08, vie: 0.5 });
          break;
        case 'recolte': // la Pépite rapporte sa récolte : des pièces d'or qui jaillissent
          this.gerbe(ev.x, y + 0.9, ev.y, 14, ['#ffd24a', '#fff4b0', '#e8a820'], { force: 0.8, haut: 3.5, taille: 0.07, vie: 0.9, eclat: 2.2, gravite: -5 });
          break;
        case 'flamme': { // le Dragon crache du feu sur un gardien
          const depart = new THREE.Vector3(ev.x, y + HAUTEUR_VOL + 1.4, ev.y), arrivee = new THREE.Vector3(ev.vers.x, this.sol(ev.vers.x, ev.vers.y) + 0.7, ev.vers.y);
          for (let k = 0; k < 28; k++) {
            const p = depart.clone().lerp(arrivee, k / 27);
            this.particules.emettre({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5, couleur: ['#ff5a1e', '#ffa83a', '#ffe14a'][k % 3], taille: 0.1, vie: 0.25 + (k / 27) * 0.4, gravite: 0, eclat: 2.4 });
          }
          this.gerbe(ev.vers.x, arrivee.y, ev.vers.y, 10, ['#4a4048', '#7a6a70'], { force: 1, haut: 1.5, taille: 0.1, vie: 0.6, gravite: 1 });
          break;
        }
        case 'explosion':
          this.gerbe(ev.x, y + 0.1, ev.y, 26, ['#8a7a98', '#5e5068', '#a898b8'], { force: 3, haut: 3.2, taille: 0.1, vie: 0.8 });
          this.gerbe(ev.x, y + 0.1, ev.y, 18, ['#d8c8b0', '#b8a890'], { force: 2.4, haut: 0.6, taille: 0.14, vie: 0.7, gravite: 0 });
          this.gerbe(ev.x, y + 0.2, ev.y, 10, ['#c890ff', '#9a5ae8'], { force: 2, haut: 2, taille: 0.06, vie: 0.4, eclat: 2.5 });
          this.secousse = Math.max(this.secousse, 0.12);
          break;
        case 'mort': {
          // les éclats ont les couleurs du monstre ; plus il est gros, plus il y en a
          const fiche = MONSTRES[ev.quoi];
          const gros = fiche.boss ? 3 : fiche.pv >= 200 ? 2 : 1;
          const h = fiche.volant ? HAUTEUR_VOL : 0;
          this.gerbe(ev.x, y + 0.3 + h, ev.y, [16, 30, 80][gros - 1], couleursEclats(fiche.apparence), { force: fiche.boss ? 3.5 : 2, haut: 2.6, taille: 0.1, vie: 0.7 });
          this.gerbe(ev.x, y + 0.5 + h, ev.y, 6 * gros, ['#ffd760', '#fff0a0'], { force: 0.6, haut: 2.5, taille: 0.06, vie: 0.6, eclat: 2.5, gravite: -3 });
          if (fiche.boss) this.secousse = 0.6;
          break;
        }
        case 'construction':
          this.gerbe(ev.x, y + 0.3, ev.y, 22, ['#e8d8b8', '#c8b898'], { force: 2.2, haut: 1, taille: 0.12, vie: 0.6, gravite: -2 });
          this.gerbe(ev.x, y + 0.6, ev.y, 12, ['#ffd760', '#fff4c0'], { force: 1, haut: 3, taille: 0.05, vie: 0.8, eclat: 2.5, gravite: -2 });
          break;
        case 'amelioration': // une fontaine d'étincelles dorées
          this.gerbe(ev.x, y + 0.4, ev.y, 34, ['#ffd760', '#fff4c0', '#ffffff'], { force: 1.3, haut: 4.2, taille: 0.06, vie: 1, eclat: 2.6, gravite: -1.5 });
          this.gerbe(ev.x, y + 0.3, ev.y, 14, ['#e8d8b8', '#c8b898'], { force: 2, haut: 0.8, taille: 0.1, vie: 0.5, gravite: -2 });
          break;
        case 'vente':
          this.gerbe(ev.x, y + 0.3, ev.y, 20, ['#e8d8b8', '#c8b898'], { force: 2, haut: 1.5, taille: 0.1, vie: 0.6 });
          break;
        case 'fuite':
          this.gerbe(ev.x, y + 0.5, ev.y, 40, ['#ff4a3a', '#ff8a6a', '#2a1a1a'], { force: 3, haut: 4, taille: 0.12, vie: 1.2 });
          this.secousse = 0.5;
          break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 7. AMBIANCE, CAMÉRA, POST-TRAITEMENT
  // ═══════════════════════════════════════════════════════════
  copierAmbiance(a) {
    const copie = {};
    for (const [k, v] of Object.entries(a)) copie[k] = typeof v === 'string' ? new THREE.Color(v) : v;
    return copie;
  }

  // immediat : sans glisser doucement de l'ancienne à la nouvelle (l'atelier des lumières s'en sert)
  choisirAmbiance(nom, immediat = false) {
    this.ambianceCible = AMBIANCES[nom] || AMBIANCES.doree;
    if (immediat) this.ambiance = this.copierAmbiance(this.ambianceCible);
  }

  // Glisse doucement de l'ambiance actuelle vers l'ambiance choisie
  glisserAmbiance(dt) {
    const k = 1 - Math.exp(-dt * 2.2);
    for (const [cle, v] of Object.entries(this.ambianceCible)) {
      if (typeof v === 'string') this.ambiance[cle].lerp(new THREE.Color(v), k);
      else this.ambiance[cle] += (v - this.ambiance[cle]) * k;
    }
  }

  appliquerAmbiance() {
    const a = this.ambiance;
    const el = THREE.MathUtils.degToRad(a.elevation), az = THREE.MathUtils.degToRad(a.azimut);
    this.dirSoleil = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    this.soleil.position.copy(this.soleil.target.position).addScaledVector(this.dirSoleil, 60);
    this.soleil.color.copy(a.soleil);
    this.soleil.intensity = a.intensite;
    this.hemi.color.copy(a.ciel);
    this.hemi.groundColor.copy(a.sol);
    this.hemi.intensity = a.hemi;
    this.scene.fog.color.copy(a.brume);
    // La brume commence juste après la carte : la carte reste nette, le paysage lointain s'estompe.
    // densite (réglage de l'ambiance) : plus elle est grande, plus la brume arrive vite.
    const d = this.distanceCamera || 50;
    this.scene.fog.near = d * 0.85;
    this.scene.fog.far = d * 0.85 + 0.35 / a.densite;
    const u = this.uniformesCiel;
    u.uHaut.value.copy(a.haut);
    u.uHorizon.value.copy(a.horizon);
    u.uBas.value.copy(a.bas);
    u.uHalo.value.copy(a.halo);
    u.uSoleilDir.value.copy(this.dirSoleil);
    u.uEtoiles.value = a.etoiles;
    this.renderer.toneMappingExposure = a.expo;
    this.bloom.strength = a.bloom;
    this.bloom.threshold = a.seuil;
    const e = this.etalonnage.uniforms;
    e.uChaleur.value = a.chaleur;
    e.uSaturation.value = a.saturation;
    e.uContraste.value = a.contraste;
    e.uRayons.value = a.rayons;
    e.uRayonsCouleur.value.copy(a.rayonsCouleur);
    // La nuit, les lanternes s'allument
    const nuit = a.nuit;
    for (const l of this.lumieresNuit) l.intensity = nuit * (4 + Math.sin(this.temps * 9 + l.id) * 0.4);
    this.matLanterne.emissiveIntensity = 0.2 + nuit * 2.2;
    if (this.blocsLanterne) this.blocsLanterne.material.emissiveIntensity = 0.2 + nuit * 2.2;
    this.matEau.emissiveIntensity = 0.4 - nuit * 0.3;
    this.uLueur.value = a.lueur;
  }

  choisirCamera(mode) {
    this.modeCamera = mode;
    this.cadrer();
  }

  // Place la caméra pour que toute la zone de jeu tienne à l'écran
  cadrer() {
    const cinema = this.modeCamera === 'cinema';
    const angle = THREE.MathUtils.degToRad(cinema ? 28 : 60);
    this.camera.fov = cinema ? 38 : 24;
    // en cinéma, on relève un peu le regard : la carte descend dans le cadre et le ciel apparaît
    this.tangage = cinema ? THREE.MathUtils.degToRad(10) : 0;
    this.camera.aspect = this.largeur / this.hauteur;
    this.camera.updateProjectionMatrix();
    const { largeur, hauteur, chateau: c } = this.niveau;
    this.cible = new THREE.Vector3(largeur / 2, 0, hauteur / 2 + (cinema ? -0.6 : 0.3));
    this.dirCamera = new THREE.Vector3(0, Math.sin(angle), Math.cos(angle));
    // Les points qui doivent rester visibles : les coins de la carte (+ le château en vue de jeu).
    // En cinéma on accepte de rogner un peu les bords, pour être plus près de l'action.
    const marge = cinema ? -1.2 : 0.2;
    const coins = [[-marge, -marge], [largeur + marge, -marge], [-marge, hauteur + marge], [largeur + marge, hauteur + marge]]
      .map(([x, z]) => new THREE.Vector3(x, 0, z));
    if (!cinema) coins.push(new THREE.Vector3(c.x + 1.6, 0, c.y - 2.5), new THREE.Vector3(c.x + 1.6, 3.5, c.y), new THREE.Vector3(c.x + 1.6, 0, c.y + 2.7));
    let bas = 4, haut = 200;
    for (let i = 0; i < 30; i++) {
      const milieu = (bas + haut) / 2;
      this.camera.position.copy(this.cible).addScaledVector(this.dirCamera, milieu);
      this.camera.lookAt(this.cible);
      this.camera.rotateX(this.tangage);
      this.camera.updateMatrixWorld();
      const tient = coins.every((c) => {
        const p = c.clone().project(this.camera);
        return Math.abs(p.x) < 0.97 && p.y > -0.86 && p.y < 0.86 && p.z < 1;
      });
      if (tient) haut = milieu; else bas = milieu;
    }
    this.distanceCamera = haut;
  }

  placerCamera() {
    const cinema = this.modeCamera === 'cinema';
    const pos = this.dirCamera.clone();
    if (cinema) pos.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(this.temps * 0.08) * 0.09);
    this.camera.position.copy(this.cible).addScaledVector(pos, this.distanceCamera);
    if (this.secousse > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.secousse;
      this.camera.position.y += (Math.random() - 0.5) * this.secousse;
    }
    this.camera.lookAt(this.cible);
    this.camera.rotateX(this.tangage);
    this.camera.updateMatrixWorld();
  }

  creerPostTraitement() {
    // samples : l'anticrénelage (les bords des cubes sans escalier) ; l'économe s'en passe
    const cible = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.econome ? 0 : 4 });
    this.composer = new EffectComposer(this.renderer, cible);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.55, 0.85);
    this.bloom.enabled = !this.econome; // le halo des lumières
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.etalonnage = new ShaderPass(ShaderEtalonnage);
    this.composer.addPass(this.etalonnage);
  }

  // ═══════════════════════════════════════════════════════════
  // 8. API APPELÉE PAR main.js
  // ═══════════════════════════════════════════════════════════
  dessiner(etat, dtJeu, dtReel, ui) {
    // Nouvelle partie ? On repart de zéro côté affichage
    if (etat !== this.partie) {
      this.partie = etat;
      this.vuesTours.vider(); this.vuesEnnemis.vider(); this.vuesTirs.vider();
      this.particules.vider();
      this.majEclairs(Infinity); // les éclairs de la partie d'avant disparaissent
    }
    this.temps += dtReel;
    this.secousse = Math.max(0, this.secousse - dtReel * 1.2);

    this.traiterEvenements(etat.evenements);
    this.vuesTours.appliquer(etat.tours);
    this.vuesEnnemis.appliquer(etat.ennemis);
    this.vuesTirs.appliquer(etat.projectiles);
    this.particules.maj(dtJeu || 0);
    this.majEclairs(dtReel);
    this.majRayons(etat);

    // Socles : surbrillance au survol, petit repère doré sur les socles libres
    const occupes = new Set(etat.tours.map((t) => t.socle));
    this.socles.forEach((s, i) => {
      const actif = i === ui.survol || i === ui.selection;
      s.dessus.material.emissiveIntensity += ((actif ? 0.45 : 0) - s.dessus.material.emissiveIntensity) * 0.3;
      s.repere.visible = !occupes.has(i);
      s.repere.rotation.y = this.temps * 1.5;
      s.repere.position.y = 0.7 + Math.sin(this.temps * 2 + i) * 0.06 + (actif ? 0.1 : 0);
    });

    // Cercle de portée du gardien survolé ou sélectionné
    // (ui.apercuPortee : pendant qu'on survole « Améliorer », la portée du niveau suivant)
    const iPortee = ui.selection >= 0 ? ui.selection : ui.survol;
    const tour = etat.tours.find((t) => t.socle === iPortee);
    const r = tour ? ui.apercuPortee ?? caracteristiques(tour.type, tour.niveau).portee : 0;
    this.anneau.visible = r > 0; // (un gardien qui ne tire pas, comme la Pépite, n'a pas de cercle)
    if (r > 0) {
      this.anneau.scale.set(r, 1, r);
      this.anneau.position.set(tour.x, this.sol(tour.x, tour.y) + 0.05, tour.y);
    }

    this.glisserAmbiance(dtReel);
    this.appliquerAmbiance();
    this.majPoussieres(dtReel);
    this.uTempsVent.value = this.temps;
    this.uniformesCiel.uTemps.value = this.temps;
    for (const eau of this.eaux) eau.position.y = -0.18 + Math.sin(this.temps * 1.2) * 0.01;
    this.drapeaux.forEach((morceaux, j) => morceaux.forEach((p, i) => {
      p.rotation.y = Math.sin(this.temps * 4 - i * 0.9 + j) * (0.18 + i * 0.12) + (i === 0 ? 0.5 : 0);
    }));
    if (this.feuilles) this.feuilles.material.emissiveIntensity = 0;

    this.placerCamera();
    this.majFaisceaux();
    // Position du soleil à l'écran, pour les rayons. En vue de jeu, le vrai soleil est
    // hors champ : on place alors un soleil « virtuel » juste au bord, du bon côté.
    const s = this.camera.position.clone().addScaledVector(this.dirSoleil, 100).project(this.camera);
    if (s.z < 1 && Math.abs(s.x) < 1.4 && Math.abs(s.y) < 1.4) {
      this.etalonnage.uniforms.uSoleil.value.set(s.x * 0.5 + 0.5, s.y * 0.5 + 0.5);
    } else {
      const droite = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0);
      const haut = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 1);
      const dir = new THREE.Vector2(this.dirSoleil.dot(droite), this.dirSoleil.dot(haut)).normalize();
      this.etalonnage.uniforms.uSoleil.value.set(0.5 + dir.x * 0.62, 0.5 + dir.y * 0.62);
    }
    this.etalonnage.uniforms.uTemps.value = this.temps;

    this.composer.render();
  }

  // Quel socle est sous la souris ? (-1 si aucun)
  socleSous(px, py) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const touche = this.raycaster.intersectObjects(this.socles.map((s) => s.zone), false)[0];
    if (touche) return touche.object.userData.index;
    // sinon : point du sol visé, et socle le plus proche
    const plan = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.3);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(plan, p)) return -1;
    return socleProche(this.niveau.socles, p.x, p.z, 0.7);
  }

  // Position à l'écran (en pixels) d'un point du jeu
  versEcran(x, y, hauteur = 0) {
    const p = new THREE.Vector3(x, this.sol(x, y) + hauteur, y).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
  }

  redimensionner() {
    this.largeur = this.conteneur.clientWidth || innerWidth;
    this.hauteur = this.conteneur.clientHeight || innerHeight;
    this.renderer.setSize(this.largeur, this.hauteur);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(this.largeur, this.hauteur);
    this.etalonnage.uniforms.uRatio.value = this.largeur / this.hauteur;
    this.cadrer();
  }

  detruire() {
    this.renderer.setAnimationLoop(null);
    this.appareilPhoto?.dispose();
    liberer(this.scene);
    Object.values(this.tex).forEach((t) => t.dispose());
    this.composer.dispose?.();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
