// ─────────────────────────────────────────────────────────────
// STYLE 2 — « DIORAMA CARTOON »
// L'esprit Kingdom Rush : formes rondes, gros contours sombres,
// ombrage en aplats (toon shading), lumière de plein jour, ombres nettes.
// Caméra orthographique (pas de perspective) : on dirait une maquette.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GARDIENS, MONSTRES, POUVOIRS, HEROS, HAUTEUR_VOL, caracteristiques } from '../jeu/donnees.js';
import { lireApparence, melanger, couleursEclats, verifierApparences, verifierStyle } from './apparence.js';
import { creerAleatoire, bruitFractal } from '../jeu/aleatoire.js';
import REGLAGES_AMBIANCES from './ambiances.json';
import { CarteDesLumieres } from './carte-lumieres.js';
import { Lumieres } from './lumieres.js';
import { ficheDe, ficheDuHeros, socleActif } from '../jeu/benedictions.js';
import {
  Synchro, Particules, creerBarreDeVie, majBarreDeVie, socleProche, versRotationY, liberer, creerAppareilPhoto, photographier, ombrerVue,
} from './outils3d.js';
import TEXTURES from './textures.json';
import { creerToile, peindreSol as peindreSolRecettes, peindreMatiere, FORMES, portee } from './peintures.js';
import { CADRE } from './cadre.js';

// Le hasard du décor (où poussent les arbres, les fleurs…) : il repart de la même graine à chaque
// nouveau rendu (voir le constructeur), pour que le décor soit toujours le même
let alea = creerAleatoire(21);
const choisir = (liste) => liste[Math.floor(alea() * liste.length)];
const TAILLE_GARDIEN = 1.5;
const TAILLE_MONSTRE = 1.45;

// Les ambiances (le moment de la journée), comme dans les deux autres styles. Elles sont
// rangées dans ambiances.json (partie « cartoon ») et se règlent dans l'atelier des lumières :
// le soleil (sa couleur, sa force, et d'où il vient : « depuis » est un décalage par
// rapport au centre de la carte, en cases), la lumière du ciel et du sol, la couleur
// du fond, et la nuit (les lanternes et la porte du château éclairent autour d'elles).
const AMBIANCES_CARTOON = REGLAGES_AMBIANCES.cartoon;
// Les recettes du sol (l'herbe, le chemin, la terre des socles, la berge des étangs, la cour) : rangées
// dans textures.json (partie « cartoon ») et peintes au pinceau (voir peintures.js). L'atelier des
// textures (textures.html) les règle et les voit ici, en direct.
const RECETTES = TEXTURES.cartoon;

// Une forme plate dessinée point par point (vue de dessus), épaissie pour avoir un vrai
// contour. Les points (x, z) sont posés à plat : z > 0 = vers l'avant du personnage.
function formePlate(points, epaisseur = 0.025) {
  const forme = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  return new THREE.ExtrudeGeometry(forme, { depth: epaisseur, bevelEnabled: false }).rotateX(Math.PI / 2);
}
// L'aile d'une chauve-souris, côté droit (sens = 1) ou gauche (sens = -1) : le bord avant,
// la pointe, puis le bord arrière festonné, en revenant vers l'épaule
const AILE = [[0, 0.05], [0.13, 0.11], [0.28, 0.12], [0.42, 0.05], [0.36, -0.03], [0.31, 0], [0.25, -0.07], [0.18, -0.03], [0.11, -0.09], [0.05, -0.05], [0, -0.04]];
const formeAile = (sens) => formePlate(AILE.map(([x, z]) => [x * sens, z]));
// Une pale de moulinet : un triangle qui part du centre
const PALE = [[0, 0], [0.2, -0.03], [0.2, 0.085], [0.04, 0.04]];
// Les fissures de lave du golem : des zigzags de points, sur le devant de son corps (x, y)
// et sur le dessus de ses épaules (x, z), le seul endroit qu'on voit toujours d'en haut
const FISSURES = [
  [[-0.2, 0.66], [-0.12, 0.58], [-0.17, 0.5], [-0.06, 0.4], [-0.1, 0.3]],
  [[0.1, 0.63], [0.18, 0.55], [0.13, 0.47], [0.21, 0.37]],
  [[0, 0.35], [0.06, 0.29], [0.02, 0.24]],
];
const FISSURES_DESSUS = [
  [[-0.3, -0.16], [-0.18, -0.06], [-0.24, 0.06], [-0.1, 0.16], [-0.16, 0.24]],
  [[0.06, -0.24], [0.16, -0.12], [0.1, -0.02], [0.24, 0.08], [0.2, 0.2]],
  [[-0.08, -0.22], [0, -0.12]],
];

// ═════════════════════════════════════════════════════════════
// LES PERSONNAGES, FABRIQUÉS À PARTIR DE LEUR FICHE
// Même principe que dans le style voxel : chaque gabarit construit une
// silhouette (ici en formes rondes avec contour) et note ses « ancres »,
// où viennent s'accrocher les accessoires.
// ═════════════════════════════════════════════════════════════
const GABARITS_CARTOON = {
  gardien: {
    fabriquer(r, vue, { couleurs: c }, m) {
      const peau = m(c.peau), fonce = m(c.fonce);
      // un pavé tout arrondi : la silhouette de la mascotte, version cartoon
      r.piece(vue.corps, new RoundedBoxGeometry(0.62, 0.44, 0.48, 4, 0.14), peau, 0, 0.36, 0);
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) r.piece(vue.corps, new THREE.SphereGeometry(0.075, 10, 8), fonce, sx * 0.19, 0.1, sz * 0.13, { fin: true });
        r.piece(vue.corps, new THREE.SphereGeometry(0.08, 10, 8), peau, sx * 0.34, 0.34, 0.04, { fin: true }); // bras
      }
      vue.yeux = r.yeux(vue.corps, 0.12, 0.42, 0.24, 0.085, c.yeux);
      vue.ancres = { sommet: 0.58, demiLargeur: 0.31, demiProfondeur: 0.24, ceinture: 0.24, yeux: { ecart: 0.12, y: 0.42, z: 0.24, taille: 0.085 } };
      vue.rayonOmbre = 0.45;
    },
    animer() {}, // un gardien ne marche pas (voir majVueTour)
  },
  gelee: {
    fabriquer(r, vue, { couleurs: c }, m) {
      const blob = r.piece(vue.corps, new THREE.SphereGeometry(0.24, 20, 14), m(c.peau), 0, 0.2, 0);
      blob.scale.set(1, 0.82, 1);
      r.piece(vue.corps, new THREE.SphereGeometry(0.07, 10, 8), r.toon(c.clair), -0.1, 0.32, 0.08, { contour: false }); // reflet
      vue.yeux = r.yeux(vue.corps, 0.08, 0.26, 0.19, 0.06, c.yeux);
      vue.ancres = { sommet: 0.4, demiLargeur: 0.24, demiProfondeur: 0.24, ceinture: 0.12, yeux: { ecart: 0.08, y: 0.26, z: 0.19, taille: 0.06 } };
      vue.hauteurBarre = 0.62;
      vue.rayonOmbre = 0.28;
    },
    animer(vue, t, lent) {
      const saut = Math.abs(Math.sin(t * 6 * lent));
      vue.corps.position.y = saut * 0.18;
      vue.corps.scale.set(vue.taille * (1 + (1 - saut) * 0.18), vue.taille * (1 - (1 - saut) * 0.25), vue.taille * (1 + (1 - saut) * 0.18));
      vue.ombre.scale.setScalar(1 - saut * 0.3); // l'ombre rétrécit quand il est en l'air
    },
  },
  rongeur: {
    fabriquer(r, vue, { couleurs: c }, m) {
      r.piece(vue.corps, new THREE.SphereGeometry(0.17, 14, 10), m(c.peau), 0, 0.2, -0.04).scale.set(0.9, 0.85, 1.15);
      r.piece(vue.corps, new THREE.SphereGeometry(0.14, 14, 10), m(melanger(c.peau, c.clair, 0.15)), 0, 0.3, 0.16); // tête
      r.piece(vue.corps, new THREE.SphereGeometry(0.05, 8, 6), m(melanger(c.fonce, '#000000', 0.55)), 0, 0.28, 0.3, { contour: false }); // truffe
      for (const sx of [-1, 1]) {
        const oreille = r.piece(vue.corps, new THREE.ConeGeometry(0.05, 0.16, 6), m(c.fonce), sx * 0.08, 0.46, 0.14, { fin: true });
        oreille.rotation.z = -sx * 0.3;
        for (const sz of [-1, 1]) vue.pattes.push(r.piece(vue.corps, new THREE.SphereGeometry(0.045, 8, 6), m(c.fonce), sx * 0.08, 0.05, sz * 0.1 - 0.02, { fin: true }));
      }
      const queue = r.piece(vue.corps, new THREE.SphereGeometry(0.09, 10, 8), m(c.clair), 0, 0.28, -0.26);
      queue.scale.set(0.8, 0.8, 1.5);
      vue.yeux = r.yeux(vue.corps, 0.06, 0.36, 0.26, 0.045, c.yeux);
      vue.ancres = { sommet: 0.44, demiLargeur: 0.12, demiProfondeur: 0.12, ceinture: 0.2, yeux: { ecart: 0.06, y: 0.36, z: 0.26, taille: 0.045 }, zTete: 0.16 };
      vue.hauteurBarre = 0.66;
      vue.rayonOmbre = 0.28;
    },
    animer(vue, t, lent) {
      vue.corps.position.y = Math.abs(Math.sin(t * 14 * lent)) * 0.05;
      vue.pattes.forEach((p, i) => (p.position.y = 0.05 + Math.max(0, Math.sin(t * 14 * lent + i * 1.6)) * 0.05));
    },
  },
  golem: {
    fabriquer(r, vue, { couleurs: c }, m) {
      r.piece(vue.corps, new RoundedBoxGeometry(0.62, 0.52, 0.48, 3, 0.12), m(c.peau), 0, 0.48, 0);
      r.piece(vue.corps, new RoundedBoxGeometry(0.66, 0.12, 0.52, 2, 0.05), m(c.mousse), 0, 0.76, 0);
      r.piece(vue.corps, new RoundedBoxGeometry(0.32, 0.24, 0.26, 2, 0.06), m(melanger(c.peau, c.fonce, 0.4)), 0, 0.86, 0.06);
      for (const sx of [-1, 1]) {
        r.piece(vue.corps, new THREE.SphereGeometry(0.035, 8, 6), r.brillant(c.yeux, 1.6), sx * 0.07, 0.88, 0.2, { contour: false });
        vue.pattes.push(r.piece(vue.corps, new RoundedBoxGeometry(0.16, 0.42, 0.18, 2, 0.05), m(melanger(c.peau, c.fonce, 0.5)), sx * 0.4, 0.42, 0));
        vue.pattes.push(r.piece(vue.corps, new RoundedBoxGeometry(0.18, 0.26, 0.2, 2, 0.05), m(c.fonce), sx * 0.15, 0.13, 0));
      }
      if (c.lave) {
        // des fissures de lave sur le devant : de petits bâtons qui brillent, bout à bout en zigzag
        const lave = r.brillant(c.lave, 1.5);
        for (const trace of FISSURES) {
          for (let i = 0; i < trace.length - 1; i++) {
            const [x0, y0] = trace[i], [x1, y1] = trace[i + 1];
            const morceau = r.piece(vue.corps, new THREE.BoxGeometry(Math.hypot(x1 - x0, y1 - y0) + 0.02, 0.032, 0.02), lave, (x0 + x1) / 2, (y0 + y1) / 2, 0.245, { contour: false });
            morceau.rotation.z = Math.atan2(y1 - y0, x1 - x0);
          }
        }
        for (const trace of FISSURES_DESSUS) {
          for (let i = 0; i < trace.length - 1; i++) {
            const [x0, z0] = trace[i], [x1, z1] = trace[i + 1];
            const morceau = r.piece(vue.corps, new THREE.BoxGeometry(Math.hypot(x1 - x0, z1 - z0) + 0.02, 0.02, 0.036), lave, (x0 + x1) / 2, 0.823, (z0 + z1) / 2, { contour: false });
            morceau.rotation.y = -Math.atan2(z1 - z0, x1 - x0);
          }
        }
      }
      vue.ancres = { sommet: 0.98, demiLargeur: 0.16, demiProfondeur: 0.13, ceinture: 0.6, yeux: { ecart: 0.07, y: 0.88, z: 0.2, taille: 0.035 } };
      vue.hauteurBarre = 1.15;
      vue.largeurBarre = 0.6;
      vue.rayonOmbre = 0.45;
    },
    animer(vue, t, lent) {
      vue.corps.rotation.z = Math.sin(t * 3 * lent) * 0.07;
      vue.pattes.forEach((p, i) => (p.rotation.x = Math.sin(t * 3 * lent + (i % 2) * Math.PI) * 0.35));
    },
  },
  volant: {
    fabriquer(r, vue, { couleurs: c }, m) {
      // une boule pour le corps, deux oreilles pointues, deux crocs, et deux ailes qui battent
      r.piece(vue.corps, new THREE.SphereGeometry(0.17, 18, 14), m(c.peau), 0, 0.3, 0);
      r.piece(vue.corps, new THREE.SphereGeometry(0.1, 12, 10), m(c.clair), 0, 0.25, 0.1, { contour: false }).scale.set(1, 0.8, 0.7); // le ventre
      vue.ailes = [];
      for (const sx of [-1, 1]) {
        const oreille = r.piece(vue.corps, new THREE.ConeGeometry(0.05, 0.15, 8), m(c.fonce), sx * 0.09, 0.47, -0.01, { fin: true });
        oreille.rotation.z = -sx * 0.35;
        // l'aile est accrochée à une « épaule » : c'est elle qui pivote quand l'aile bat
        const epaule = new THREE.Group();
        epaule.position.set(sx * 0.13, 0.33, -0.02);
        epaule.userData.sens = sx;
        r.piece(epaule, formeAile(sx), m(c.fonce), 0, 0, 0, { fin: true });
        vue.corps.add(epaule);
        vue.ailes.push(epaule);
        r.piece(vue.corps, new THREE.ConeGeometry(0.016, 0.045, 6).rotateX(Math.PI), r.toon('#ffffff'), sx * 0.04, 0.215, 0.15, { contour: false });
      }
      vue.yeux = r.yeux(vue.corps, 0.065, 0.34, 0.135, 0.055, c.yeux);
      vue.ancres = { sommet: 0.47, demiLargeur: 0.15, demiProfondeur: 0.15, ceinture: 0.26, yeux: { ecart: 0.065, y: 0.34, z: 0.135, taille: 0.055 } };
      vue.hauteurBarre = 0.66;
      vue.rayonOmbre = 0.26;
    },
    animer(vue, t, lent) {
      const battement = Math.sin(t * 16 * lent); // les ailes battent vite
      for (const epaule of vue.ailes) epaule.rotation.z = epaule.userData.sens * (0.15 + battement * 0.55);
      vue.corps.position.y = Math.sin(t * 4) * 0.04;
    },
  },
  tortue: {
    fabriquer(r, vue, { couleurs: c }, m) {
      // la carapace : une demi-sphère aplatie, avec un bord roulé et quelques plaques en relief
      const dome = new THREE.SphereGeometry(0.26, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.85, 1.15);
      r.piece(vue.corps, dome, m(c.carapace), 0, 0.1, 0);
      r.piece(vue.corps, new THREE.TorusGeometry(0.26, 0.035, 8, 24).rotateX(Math.PI / 2).scale(1, 1, 1.15), m(melanger(c.carapace, '#000000', 0.3)), 0, 0.1, 0, { fin: true });
      const plaque = m(melanger(c.carapace, '#000000', 0.18));
      for (const [x, z] of [[0, 0], [0.12, 0.1], [-0.12, 0.1], [0.12, -0.12], [-0.12, -0.12]]) {
        r.piece(vue.corps, new THREE.SphereGeometry(0.075, 10, 6), plaque, x, 0.27 - (Math.abs(x) + Math.abs(z)) * 0.25, z, { fin: true }).scale.set(1, 0.35, 1);
      }
      // la tête, qui sort devant, et la petite queue
      r.piece(vue.corps, new THREE.SphereGeometry(0.1, 14, 10), m(c.peau), 0, 0.16, 0.32);
      r.piece(vue.corps, new THREE.ConeGeometry(0.04, 0.12, 6).rotateX(-Math.PI / 2), m(c.peau), 0, 0.1, -0.33, { fin: true });
      vue.yeux = r.yeux(vue.corps, 0.045, 0.2, 0.39, 0.035, c.yeux);
      // quatre pattes courtes
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        vue.pattes.push(r.piece(vue.corps, new THREE.CylinderGeometry(0.045, 0.055, 0.12, 8), m(c.peau), sx * 0.17, 0.06, sz * 0.15, { fin: true }));
      }
      vue.ancres = { sommet: 0.32, demiLargeur: 0.2, demiProfondeur: 0.22, ceinture: 0.14, yeux: { ecart: 0.045, y: 0.2, z: 0.39, taille: 0.035 }, zTete: 0.32 };
      vue.hauteurBarre = 0.6;
      vue.largeurBarre = 0.46;
      vue.rayonOmbre = 0.36;
    },
    animer(vue, t, lent) { // elle se dandine, et ses pattes avancent deux par deux
      vue.corps.rotation.z = Math.sin(t * 5 * lent) * 0.06;
      vue.pattes.forEach((p, i) => (p.position.y = 0.06 + Math.max(0, Math.sin(t * 5 * lent + (i % 2) * Math.PI)) * 0.04));
    },
  },
  taupe: {
    fabriquer(r, vue, { couleurs: c }, m) {
      // un corps tout rond et velouté, un long museau rose, de grosses pattes roses pour creuser
      r.piece(vue.corps, new THREE.SphereGeometry(0.21, 18, 14), m(c.peau), 0, 0.2, 0).scale.set(0.95, 0.82, 1.2);
      r.piece(vue.corps, new THREE.ConeGeometry(0.06, 0.16, 10).rotateX(Math.PI / 2), m(c.museau), 0, 0.2, 0.3, { fin: true });
      r.piece(vue.corps, new THREE.SphereGeometry(0.035, 8, 6), m(melanger(c.museau, '#c04060', 0.4)), 0, 0.2, 0.38, { contour: false });
      vue.pattes = [];
      for (const sx of [-1, 1]) {
        const patte = r.piece(vue.corps, new THREE.SphereGeometry(0.075, 10, 8), m(c.museau), sx * 0.15, 0.08, 0.16, { fin: true });
        patte.scale.set(1, 0.45, 1.1);
        vue.pattes.push(patte);
      }
      r.piece(vue.corps, new THREE.SphereGeometry(0.035, 8, 6), m(c.peau), 0, 0.17, -0.27, { contour: false }); // la petite queue
      vue.yeux = r.yeux(vue.corps, 0.07, 0.27, 0.19, 0.04, c.yeux);
      vue.ancres = { sommet: 0.37, demiLargeur: 0.14, demiProfondeur: 0.16, ceinture: 0.18, yeux: { ecart: 0.07, y: 0.27, z: 0.19, taille: 0.04 }, zTete: 0.12 };
      vue.hauteurBarre = 0.6;
      vue.rayonOmbre = 0.3;
    },
    animer(vue, t, lent) { // elle trottine, et ses grosses pattes grattent la terre
      vue.corps.position.y = Math.abs(Math.sin(t * 10 * lent)) * 0.03;
      vue.pattes.forEach((p, i) => (p.rotation.x = Math.sin(t * 10 * lent + i * Math.PI) * 0.5));
    },
  },
  dragon: {
    fabriquer(r, vue, { couleurs: c }, m) {
      // le corps et le ventre plus clair
      r.piece(vue.corps, new THREE.SphereGeometry(0.3, 20, 14), m(c.peau), 0, 0.35, 0).scale.set(0.9, 0.75, 1.25);
      r.piece(vue.corps, new THREE.SphereGeometry(0.25, 16, 12), m(c.ventre), 0, 0.28, 0.05, { contour: false }).scale.set(0.8, 0.6, 1.1);
      // le cou en trois morceaux, de plus en plus haut et en avant, puis la tête
      for (const [y, z, rayon] of [[0.5, 0.32, 0.12], [0.62, 0.44, 0.1], [0.72, 0.54, 0.09]]) r.piece(vue.corps, new THREE.SphereGeometry(rayon, 12, 10), m(c.peau), 0, y, z);
      const tete = new THREE.Group();
      tete.position.set(0, 0.8, 0.66);
      r.piece(tete, new RoundedBoxGeometry(0.24, 0.17, 0.26, 3, 0.06), m(c.peau), 0, 0, 0);
      r.piece(tete, new RoundedBoxGeometry(0.17, 0.1, 0.16, 3, 0.04), m(c.peau), 0, -0.03, 0.17);
      r.piece(tete, new RoundedBoxGeometry(0.15, 0.04, 0.14, 2, 0.015), m(c.fonce), 0, -0.085, 0.13, { fin: true }); // la mâchoire
      for (const sx of [-1, 1]) {
        r.piece(tete, new THREE.SphereGeometry(0.035, 8, 6), r.brillant(c.yeux, 1.4), sx * 0.08, 0.04, 0.1, { contour: false });
        r.piece(tete, new THREE.SphereGeometry(0.014, 6, 4), r.brillant('#2a0e10', 1), sx * 0.04, -0.01, 0.255, { contour: false }); // narine
        r.piece(tete, new THREE.ConeGeometry(0.014, 0.04, 6).rotateX(Math.PI), r.toon('#ffffff'), sx * 0.05, -0.1, 0.22, { contour: false }); // croc
      }
      vue.corps.add(tete);
      vue.tete = tete;
      // les ailes : la forme de la chauve-souris, en bien plus grand, qui battent lentement
      vue.ailes = [];
      for (const sx of [-1, 1]) {
        const epaule = new THREE.Group();
        epaule.position.set(sx * 0.2, 0.55, 0);
        epaule.rotation.z = sx * 0.5; // au repos (sur les portraits), les ailes sont levées
        epaule.userData.sens = sx;
        r.piece(epaule, formePlate(AILE.map(([x, z]) => [x * sx * 1.5, z * 1.5]), 0.03), m(melanger(c.fonce, c.peau, 0.3)), 0, 0, 0, { fin: true });
        vue.corps.add(epaule);
        vue.ailes.push(epaule);
      }
      // la queue : des boules de plus en plus petites vers l'arrière, et une pointe
      const queue = new THREE.Group();
      queue.position.set(0, 0.3, -0.3);
      [[0.11, -0.05, 0], [0.09, -0.2, -0.03], [0.07, -0.33, -0.06], [0.05, -0.44, -0.08]].forEach(([rayon, z, y]) => r.piece(queue, new THREE.SphereGeometry(rayon, 10, 8), m(c.peau), 0, y, z));
      r.piece(queue, new THREE.ConeGeometry(0.06, 0.12, 4).rotateX(-Math.PI / 2), m(c.fonce), 0, -0.08, -0.53, { fin: true });
      vue.corps.add(queue);
      vue.queue = queue;
      // deux petites pattes repliées sous le ventre
      for (const z of [-0.12, 0.14]) for (const sx of [-1, 1]) r.piece(vue.corps, new THREE.SphereGeometry(0.06, 8, 6), m(c.fonce), sx * 0.13, 0.1, z, { fin: true });
      vue.ancres = { sommet: 0.9, demiLargeur: 0.12, demiProfondeur: 0.13, ceinture: 0.35, zTete: 0.62, yeux: { ecart: 0.08, y: 0.84, z: 0.76, taille: 0.035 } };
      vue.hauteurBarre = 1.15;
      vue.largeurBarre = 0.6;
      vue.rayonOmbre = 0.6;
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

const ACCESSOIRES_CARTOON = {
  flamme(r, vue, acc) {
    const { sommet } = vue.ancres;
    const f1 = r.piece(vue.corps, new THREE.ConeGeometry(0.11, 0.3, 10), r.brillant(acc.couleur, 1.25), 0, sommet + 0.14, 0, { fin: true, ombre: false });
    const f2 = r.piece(vue.corps, new THREE.ConeGeometry(0.06, 0.18, 8), r.brillant(melanger(acc.couleur, '#ffe066', 0.8), 1.3), 0, sommet + 0.12, 0.04, { contour: false, ombre: false });
    vue.animations.push((temps) => [f1, f2].forEach((f, i) => {
      f.scale.set(1, 0.8 + Math.random() * 0.45, 1);
      f.rotation.z = Math.sin(temps * 10 + i) * 0.15;
    }));
  },
  cristaux(r, vue, acc) {
    const { sommet, demiLargeur } = vue.ancres;
    const glace = r.toon(melanger(acc.couleur, '#ffffff', 0.55), { emissive: melanger(acc.couleur, '#40b0ff', 0.3), emissiveIntensity: 0.6 });
    [[-0.42, 0.22, 0.4], [0, 0.3, 0], [0.42, 0.22, -0.4]].forEach(([fx, h, angle]) => {
      const cristal = r.piece(vue.corps, new THREE.ConeGeometry(0.055, h, 6), glace, fx * demiLargeur, sommet + h / 2, 0, { fin: true });
      cristal.rotation.z = angle;
    });
  },
  echarpe(r, vue, acc, m) {
    const { ceinture, demiLargeur } = vue.ancres;
    r.piece(vue.corps, new THREE.TorusGeometry(demiLargeur * 0.87, 0.05, 8, 20).rotateX(Math.PI / 2).scale(1.1, 1, 0.85), m(acc.couleur), 0, ceinture, 0, { fin: true });
  },
  cornes(r, vue, acc, m) {
    const { sommet, demiLargeur, zTete = 0.05 } = vue.ancres; // zTete : où est la tête, d'avant en arrière
    const os = m(acc.couleur);
    for (const sx of [-1, 1]) {
      const corne = r.piece(vue.corps, new THREE.ConeGeometry(0.055, 0.2, 8), os, sx * demiLargeur * 0.65, sommet + 0.08, zTete, { fin: true });
      corne.rotation.z = -sx * 0.4;
    }
  },
  mortier(r, vue, acc, m) {
    const { sommet, demiProfondeur } = vue.ancres;
    const mortier = new THREE.Group();
    mortier.position.set(0, sommet + 0.04, -demiProfondeur * 0.58);
    mortier.rotation.x = -0.6;
    r.piece(mortier, new THREE.CylinderGeometry(0.11, 0.13, 0.3, 14), m(acc.couleur), 0, 0.12, 0);
    r.piece(mortier, new THREE.TorusGeometry(0.11, 0.03, 6, 14).rotateX(Math.PI / 2), m(melanger(acc.couleur, '#000000', 0.3)), 0, 0.27, 0, { fin: true });
    vue.corps.add(mortier);
  },
  cape(r, vue, acc, m) {
    // une moitié de cône ouvert qui entoure le dos, plus large en bas,
    // avec un col roulé en haut et une doublure plus foncée à l'intérieur
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const aplati = (demiProfondeur / demiLargeur) * 1.1; // la cape suit la forme du corps (plus large que profond)
    const longueur = sommet - 0.08;
    // CylinderGeometry(rayon en haut, rayon en bas, hauteur, côtés, étages, ouvert, angle de départ, angle couvert) :
    // de PI/2 à 3PI/2, c'est la moitié arrière
    const forme = new THREE.CylinderGeometry(demiLargeur * 1.12, demiLargeur * 1.45, longueur, 18, 1, true, Math.PI / 2, Math.PI)
      .scale(1, 1, aplati)
      .translate(0, -longueur / 2, 0); // accrochée par le haut : le groupe pivote autour du col
    const cape = new THREE.Group();
    cape.position.set(0, sommet - 0.03, 0);
    // pas de contour sur la cape elle-même : sur une forme ouverte, il ferait des traits sombres sur les bords
    r.piece(cape, forme, m(acc.couleur), 0, 0, 0, { contour: false });
    r.piece(cape, forme, m(melanger(acc.couleur, '#000000', 0.35), { side: THREE.BackSide }), 0, 0, 0, { contour: false }); // la doublure
    const col = new THREE.TorusGeometry(demiLargeur * 1.1, 0.05, 8, 18, Math.PI).rotateX(-Math.PI / 2).scale(1, 1, aplati);
    r.piece(cape, col, m(acc.couleur), 0, 0, 0, { fin: true });
    vue.corps.add(cape);
    const decalage = Math.random() * 6; // pour que les capes ne flottent pas toutes en même temps
    vue.animations.push((temps) => (cape.rotation.x = 0.05 + Math.sin(temps * 2.2 + decalage) * 0.05));
  },
  couronne(r, vue, acc, m) {
    // un anneau doré ouvert, cinq pointes tout autour et une pierre rouge devant
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const or = m(acc.couleur, { emissive: acc.couleur, emissiveIntensity: 0.25, side: THREE.DoubleSide }); // DoubleSide : on voit aussi l'intérieur
    const rayon = demiLargeur * 0.46, h = 0.08;
    const couronne = new THREE.Group();
    couronne.position.set(0, sommet - 0.015, demiProfondeur * 0.3); // un peu vers l'avant (laisse la place au mortier)
    r.piece(couronne, new THREE.CylinderGeometry(rayon, rayon * 0.9, h, 18, 1, true), or, 0, h / 2, 0, { fin: true });
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2; // une pointe tous les cinquièmes de tour, la première devant
      r.piece(couronne, new THREE.ConeGeometry(0.032, 0.08, 6), or, Math.sin(angle) * rayon, h + 0.035, Math.cos(angle) * rayon, { fin: true });
    }
    r.piece(couronne, new THREE.SphereGeometry(0.03, 10, 8), r.brillant('#ff3a4a', 1.2), 0, h / 2, rayon + 0.012, { contour: false }); // la pierre
    vue.corps.add(couronne);
  },
  antennes(r, vue, acc) {
    // deux tiges un peu écartées, chacune avec une boule lumineuse qui palpite (et gonfle quand elle tire)
    const { sommet, demiLargeur } = vue.ancres;
    const tige = r.toon('#3a3448'), boules = [];
    for (const sx of [-1, 1]) {
      const antenne = new THREE.Group();
      antenne.position.set(sx * demiLargeur * 0.6, sommet - 0.02, 0);
      antenne.rotation.z = -sx * 0.3;
      r.piece(antenne, new THREE.CylinderGeometry(0.012, 0.016, 0.2, 6), tige, 0, 0.1, 0, { fin: true });
      boules.push(r.piece(antenne, new THREE.SphereGeometry(0.045, 12, 10), r.brillant(acc.couleur, 1.3), 0, 0.22, 0, { fin: true }));
      vue.corps.add(antenne);
    }
    vue.animations.push((temps, v) => boules.forEach((b, i) => b.scale.setScalar(1 + Math.sin(temps * 9 + i * 2) * 0.12 + (v.attaque > 0 ? 0.4 : 0))));
  },
  moulinet(r, vue, acc, m) {
    // un bâton planté sur la tête, et un moulinet à quatre pales qui tourne à plat, comme une hélice
    // (vu d'en haut, on le voit toujours bien). Il tourne plus vite quand elle souffle.
    const { sommet, demiProfondeur } = vue.ancres;
    const z = -demiProfondeur * 0.3;
    r.piece(vue.corps, new THREE.CylinderGeometry(0.014, 0.014, 0.22, 6), m('#8a6240'), 0, sommet + 0.1, z, { fin: true });
    const helice = new THREE.Group();
    helice.position.set(0, sommet + 0.22, z);
    for (let i = 0; i < 4; i++) {
      const pale = r.piece(helice, formePlate(PALE, 0.014), m(i % 2 ? '#fff4f0' : acc.couleur), 0, 0, 0, { fin: true });
      pale.rotation.y = (i * Math.PI) / 2;
    }
    r.piece(helice, new THREE.SphereGeometry(0.026, 8, 6), r.brillant('#ffd23a', 1.2), 0, 0.005, 0, { fin: true }); // l'axe
    vue.corps.add(helice);
    let avant = null;
    vue.animations.push((temps, v) => {
      const dt = avant === null ? 0 : temps - avant;
      avant = temps;
      helice.rotation.y -= dt * (v.attaque > 0 ? 22 : 7);
    });
  },
  petits(r, vue, acc, m) {
    // trois petites gelées sur le dos, qui sautillent chacune à son tour
    const { sommet } = vue.ancres;
    const petits = [[-0.1, -0.04], [0.1, -0.04], [0, 0.07]].map(([x, z]) => {
      const petit = new THREE.Group();
      petit.position.set(x, sommet - 0.03, z);
      r.piece(petit, new THREE.SphereGeometry(0.06, 12, 10), m(acc.couleur), 0, 0.045, 0, { fin: true }).scale.set(1, 0.8, 1);
      for (const sx of [-1, 1]) r.piece(petit, new THREE.SphereGeometry(0.011, 6, 4), r.brillant('#10200c', 1), sx * 0.022, 0.06, 0.05, { contour: false });
      vue.corps.add(petit);
      return petit;
    });
    vue.animations.push((temps) => petits.forEach((p, i) => (p.position.y = sommet - 0.03 + Math.max(0, Math.sin(temps * 7 + i * 2.1)) * 0.05)));
  },
  casque(r, vue, acc, m) {
    // un casque de mineur : une calotte, une petite visière, et la lampe qui brille devant
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const rayon = demiLargeur * 0.72;
    const calotte = new THREE.SphereGeometry(rayon, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.75, demiProfondeur / demiLargeur);
    r.piece(vue.corps, calotte, m(acc.couleur), 0, sommet - 0.02, 0);
    r.piece(vue.corps, new THREE.CylinderGeometry(rayon * 1.12, rayon * 1.12, 0.02, 18).scale(1, 1, demiProfondeur / demiLargeur), m(melanger(acc.couleur, '#000000', 0.25)), 0, sommet - 0.02, 0.01, { fin: true });
    const lampe = r.piece(vue.corps, new THREE.CylinderGeometry(0.035, 0.04, 0.05, 10).rotateX(Math.PI / 2), m('#5a5a64'), 0, sommet + 0.06, demiProfondeur * 0.85, { fin: true });
    r.piece(lampe, new THREE.CircleGeometry(0.03, 12), r.brillant('#fff3a0', 1.5), 0, 0, 0.026, { contour: false });
    vue.ancres.sommet = sommet + rayon * 0.7; // ce qui vient après (la couronne) se pose sur le casque
  },
  pioche(r, vue, acc, m) {
    // une pioche dans le dos : un manche de bois en biais, et le fer en arc tout en haut
    const { sommet, demiLargeur, demiProfondeur } = vue.ancres;
    const pioche = new THREE.Group();
    pioche.position.set(demiLargeur * 0.4, sommet * 0.6, -demiProfondeur - 0.03);
    pioche.rotation.z = -0.55;
    r.piece(pioche, new THREE.CylinderGeometry(0.016, 0.018, 0.5, 6), m('#8a6240'), 0, 0.12, 0, { fin: true });
    r.piece(pioche, new THREE.TorusGeometry(0.13, 0.025, 6, 14, Math.PI * 0.8).rotateZ(Math.PI * 0.1), m(acc.couleur), 0, 0.26, 0, { fin: true });
    vue.corps.add(pioche);
  },
  prisme(r, vue, acc) {
    // un cristal à huit faces qui flotte et tourne au-dessus de la tête ; il brille plus fort quand le rayon chauffe
    const { sommet } = vue.ancres;
    const cristal = r.piece(vue.corps, new THREE.OctahedronGeometry(0.085, 0).scale(1, 1.45, 1), r.toon(acc.couleur, { unique: true, emissive: '#ffb8f0', emissiveIntensity: 0.55 }), 0, sommet + 0.24, 0, { fin: true });
    vue.animations.push((temps, v) => {
      cristal.material.emissive.setHSL((temps * 0.25) % 1, 0.9, 0.7); // ses reflets font le tour de l'arc-en-ciel
      cristal.rotation.y = temps * 2.5;
      cristal.position.y = sommet + 0.24 + Math.sin(temps * 3) * 0.03;
      cristal.scale.setScalar(1 + (v.chauffe || 0) * 0.35);
    });
  },
  lunettes(r, vue, acc, m) {
    // deux anneaux devant les yeux, avec leurs verres
    const { yeux } = vue.ancres;
    if (!yeux) return;
    const cadre = m(acc.couleur);
    for (const sx of [-1, 1]) {
      const anneau = r.piece(vue.corps, new THREE.TorusGeometry(yeux.taille * 1.15, yeux.taille * 0.32, 6, 16), cadre, sx * yeux.ecart, yeux.y, yeux.z + yeux.taille * 0.55, { fin: true });
      r.piece(anneau, new THREE.CircleGeometry(yeux.taille * 1.05, 16), new THREE.MeshBasicMaterial({ color: '#cfeeff', transparent: true, opacity: 0.45 }), 0, 0, 0.004, { contour: false });
    }
  },
};
verifierStyle('cartoon', GABARITS_CARTOON, ACCESSOIRES_CARTOON);

export default class RenduCartoon {
  // niveau = l'objet renvoyé par chargerNiveau(fiche) ;
  // reglages.ambiance = le moment de la journée (sinon celui de la fiche du niveau)
  constructor(conteneur, niveau, reglages = {}) {
    verifierApparences(GARDIENS, MONSTRES);
    alea = creerAleatoire(21);
    this.conteneur = conteneur;
    this.niveau = niveau;
    this.temps = 0;
    this.secousse = 0;

    // la qualité « économe » (option du joueur) : sans anticrénelage, une image moins fine, des ombres plus simples
    this.econome = reglages.qualite === 'econome';
    this.renderer = new THREE.WebGLRenderer({ antialias: !this.econome });
    this.renderer.setPixelRatio(this.econome ? 1 : Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    conteneur.append(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#4f8f34');
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 300);
    this.raycaster = new THREE.Raycaster();

    // Le dégradé du « toon shading » : 3 tons seulement (ombre, mi-teinte, lumière)
    const tons = new Uint8Array([110, 185, 255]);
    this.degrade = new THREE.DataTexture(tons, 3, 1, THREE.RedFormat);
    this.degrade.minFilter = this.degrade.magFilter = THREE.NearestFilter;
    this.degrade.needsUpdate = true;

    // Les lumières du jeu (lanternes, feu, explosions…), peintes dans la carte des lumières
    this.lumieres = new Lumieres(niveau);
    this.carte = new CarteDesLumieres(niveau);
    // Des réglages partagés par plusieurs matériaux : changer la valeur les change tous
    this.uTemps = { value: 0 };                                // le temps, pour le vent et l'eau
    this.uVent = { value: 1 };                                 // la force du vent (selon l'ambiance)
    this.uNuages = { value: 0 };                               // les ombres des nuages sur le sol
    this.uRim = { value: 0.2 };                                // le liseré de lumière au bord des personnages
    this.uRimCouleur = { value: new THREE.Color('#ffffff') };

    // Matériau des contours : on « gonfle » l'objet le long de ses normales
    // et on n'affiche que l'arrière → un trait sombre tout autour.
    this.matContour = this.creerMatContour(0.028);
    this.matContourFin = this.creerMatContour(0.016);
    // (le contour des feuillages bouge avec eux, dans le vent)
    this.matContourVent = this.venter(this.creerMatContour(0.028), 'position.y + 0.5');
    this.cache = new Map();
    // les personnages cachés le temps d'une photo (l'atelier des modèles photographie la scène avec,
    // puis sans eux, pour mesurer s'ils se détachent du sol) : 'tour:3' (le gardien du socle 3),
    // 'ennemi:12' (le monstre numéro 12), 'heros', 'socle:3' (le socle 3, libre)
    this.masques = new Set();
    // les personnages photographiés sans leur ombre (même clés) : la photo « avec lui » de l'atelier
    this.sansOmbre = new Set();

    this.creerLumieres();
    this.creerTerrain();
    this.creerEau();
    this.creerDecor();
    this.creerChateau();
    this.creerSocles();
    this.creerLanternes();
    this.creerVie();

    this.particules = new Particules(this.scene, 700, new THREE.IcosahedronGeometry(0.5, 0));
    this.bouffees = []; // petits nuages blancs « pouf » (morts, constructions)
    this.eclairs = [];  // les éclairs d'Étincelle encore visibles
    this.anneau = this.creerAnneauPortee();
    this.anneauMeteore = this.creerAnneauMeteore();
    // le cercle du Bond du héros : là où il va atterrir (doré)
    this.anneauBond = this.creerAnneauMeteore();
    this.anneauBond.userData.trait.material.color.set('#ffcf3a');
    this.anneauBond.children[1].material.color.set('#ffd860');

    // (clé « id:niveau » : un gardien amélioré est refabriqué avec sa nouvelle apparence)
    this.vuesTours = new Synchro(this.scene, (t) => this.creerVueTour(t), (v, t) => this.majVueTour(v, t), (v) => liberer(v.racine), (t) => t.id + ':' + t.niveau);
    this.vuesEnnemis = new Synchro(this.scene, (e) => this.creerVueEnnemi(e), (v, e) => this.majVueEnnemi(v, e), (v) => liberer(v.racine));
    this.vuesEnnemis.sortie = (vue, t) => this.sortieEnnemi(vue, t); // un monstre battu s'écrase avant de disparaître
    this.vuesTirs = new Synchro(this.scene, (p) => this.creerVueTir(p), (v, p) => this.majVueTir(v, p));

    this.choisirAmbiance(reglages.ambiance || niveau.ambiance);
    this.redimensionner();
  }

  // ── Matériaux ──────────────────────────────────────────────
  // rim : avec un liseré de lumière sur les bords (les personnages, les feuillages)
  toon(couleur, extra = {}) {
    const cle = couleur + JSON.stringify(extra);
    if (!extra.unique && this.cache.has(cle)) return this.cache.get(cle);
    const { unique, rim, ...reglages } = extra;
    const m = new THREE.MeshToonMaterial({ color: couleur, gradientMap: this.degrade, ...reglages });
    this.eclairer(m, { rim });
    if (!unique) this.cache.set(cle, m);
    return m;
  }

  // Branche un matériau sur les lumières du jeu (la carte des lumières, en aplats comme
  // le reste du dessin) et lui ajoute, s'il le faut, un liseré de lumière sur les bords (le
  // « rim light » des dessins animés) : là où la surface tourne le dos à la caméra, c'est-à-dire
  // sur le contour de la forme, on ajoute un trait de la couleur du ciel.
  eclairer(m, { rim = false } = {}) {
    this.carte.brancher(m, { paliers: 5 });
    if (!rim) return m;
    const avant = m.onBeforeCompile, cle = m.customProgramCacheKey();
    m.onBeforeCompile = (shader, renderer) => {
      avant.call(m, shader, renderer);
      shader.uniforms.uRim = this.uRim;
      shader.uniforms.uRimCouleur = this.uRimCouleur;
      shader.fragmentShader = 'uniform float uRim;\nuniform vec3 uRimCouleur;\n' + shader.fragmentShader.replace('#include <opaque_fragment>', /* glsl */ `
        {
          float bordure = 1.0 - max(dot(normal, geometryViewDir), 0.0);
          outgoingLight += mix(vec3(1.0), diffuseColor.rgb, 0.4) * uRimCouleur * uRim * step(0.62, bordure);
        }
        #include <opaque_fragment>`);
    };
    m.customProgramCacheKey = () => `${cle}|rim`;
    return m;
  }

  // Le vent : le haut d'un feuillage (ou d'une touffe d'herbe) bouge, le bas reste en place.
  // poids : la formule (en GLSL) qui dit, pour un sommet, à quel point il bouge (0 en bas, 1 en haut).
  // Des rafales traversent la carte de gauche à droite, avec un petit frisson en plus.
  venter(m, poids) {
    const avant = m.onBeforeCompile, cle = m.customProgramCacheKey();
    m.onBeforeCompile = (shader, renderer) => {
      avant?.call(m, shader, renderer);
      shader.uniforms.uTemps = this.uTemps;
      shader.uniforms.uVent = this.uVent;
      shader.vertexShader = 'uniform float uTemps;\nuniform float uVent;\n' + shader.vertexShader.replace('#include <project_vertex>', /* glsl */ `
        vec4 mvPosition = vec4(transformed, 1.0);
        vec3 pied = vec3(0.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          pied = instanceMatrix[3].xyz;
        #endif
        float poids = clamp(${poids}, 0.0, 1.0);
        float rafale = max(0.0, sin(uTemps * 1.1 - pied.x * 0.35 - pied.z * 0.12));
        float frisson = sin(uTemps * 3.3 + pied.x * 1.7 + pied.z * 1.3);
        mvPosition.x += (rafale * 0.75 + frisson * 0.18) * 0.13 * uVent * poids;
        mvPosition.z += frisson * 0.035 * uVent * poids;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`);
    };
    m.customProgramCacheKey = () => `${cle}|vent:${poids}`;
    m.needsUpdate = true;
    return m;
  }
  brillant(couleur, eclat = 1.4) {
    return new THREE.MeshBasicMaterial({ color: new THREE.Color(couleur).multiplyScalar(eclat), toneMapped: false });
  }
  creerMatContour(epaisseur) {
    const m = new THREE.MeshBasicMaterial({ color: '#2b1b14', side: THREE.BackSide });
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>\n transformed += normalize(normal) * ${epaisseur.toFixed(3)};`,
      );
    };
    // La « clé » du programme dit l'épaisseur. Sans elle, Three.js croirait que les deux
    // contours (normal et fin) sont le même programme (le texte de la fonction est le même)
    // et donnerait la même épaisseur à tous.
    m.customProgramCacheKey = () => `contour${epaisseur}`;
    return m;
  }
  // Ajoute un objet avec son contour
  piece(parent, geometrie, materiau, x = 0, y = 0, z = 0, { contour = true, fin = false, ombre = true } = {}) {
    const mesh = new THREE.Mesh(geometrie, materiau);
    mesh.position.set(x, y, z);
    mesh.castShadow = ombre;
    mesh.receiveShadow = true;
    if (contour) mesh.add(new THREE.Mesh(geometrie, fin ? this.matContourFin : this.matContour));
    parent.add(mesh);
    return mesh;
  }

  // ── Lumières ───────────────────────────────────────────────
  // (leurs couleurs, leur force et la position du soleil viennent de l'ambiance)
  creerLumieres() {
    this.hemi = new THREE.HemisphereLight('#cfeaff', '#8a7448', 1.1);
    this.scene.add(this.hemi);
    const soleil = new THREE.DirectionalLight('#fff3dc', 2.6);
    this.soleil = soleil;
    const { largeur, hauteur } = this.niveau;
    soleil.position.set(largeur / 2 - 14, 24, hauteur / 2 + 6);
    soleil.target.position.set(largeur / 2, 0, hauteur / 2);
    soleil.castShadow = true;
    const s = soleil.shadow;
    s.mapSize.set(this.econome ? 1024 : 2048, this.econome ? 1024 : 2048);
    s.camera.left = -22; s.camera.right = 22; s.camera.top = 22; s.camera.bottom = -22;
    s.camera.near = 1; s.camera.far = 80;
    s.bias = -0.0006;
    s.normalBias = 0.02;
    this.scene.add(soleil, soleil.target);
  }

  // ── Le sol : un grand drap ondulé + une texture peinte au pinceau (canvas 2D) ──
  creerTerrain() {
    const x0 = -14, x1 = this.niveau.largeur + 14, z0 = -12, z1 = this.niveau.hauteur + 12;
    const parCase = 4;
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, (x1 - x0) * parCase, (z1 - z0) * parCase);
    geo.rotateX(-Math.PI / 2);
    geo.translate((x0 + x1) / 2, 0, (z0 + z1) / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let y = this.sol(x, z);
      if (this.niveau.distanceAuChemin(x, z) < 0.5) y -= 0.04; // le chemin est un peu tassé
      pos.setY(i, y);
    }
    geo.computeVertexNormals();
    const texture = this.peindreSol(x0, x1, z0, z1);
    texture.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.texSol = texture;
    const matSol = this.eclairer(new THREE.MeshToonMaterial({ map: texture, gradientMap: this.degrade }));
    this.ombresDeNuages(matSol);
    const sol = new THREE.Mesh(geo, matSol);
    sol.receiveShadow = true;
    this.scene.add(sol);
  }

  // Les ombres des nuages qui glissent sur le sol : un « bruit » (des valeurs au hasard,
  // mélangées en douceur) calculé dans le programme du sol, à partir de sa place dans le monde.
  // Là où le bruit dépasse un seuil, le sol s'assombrit, avec un bord assez net (cartoon).
  ombresDeNuages(m) {
    const avant = m.onBeforeCompile, cle = m.customProgramCacheKey();
    m.onBeforeCompile = (shader, renderer) => {
      avant.call(m, shader, renderer); // (après la carte des lumières : vPgMonde existe déjà)
      shader.uniforms.uTemps = this.uTemps;
      shader.uniforms.uNuages = this.uNuages;
      shader.fragmentShader = /* glsl */ `uniform float uTemps;
        uniform float uNuages;
        float pgHasard(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float pgBruit(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(pgHasard(i), pgHasard(i + vec2(1.0, 0.0)), f.x), mix(pgHasard(i + vec2(0.0, 1.0)), pgHasard(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        ` + shader.fragmentShader.replace('#include <map_fragment>', /* glsl */ `#include <map_fragment>
        {
          vec2 p = vPgMonde.xz * 0.11 + vec2(uTemps * 0.045, uTemps * 0.016);
          float n = pgBruit(p) * 0.6 + pgBruit(p * 2.1 + 3.7) * 0.3 + pgBruit(p * 4.3 + 9.1) * 0.1;
          diffuseColor.rgb *= 1.0 - smoothstep(0.56, 0.6, n) * uNuages;
        }`);
    };
    m.customProgramCacheKey = () => `${cle}|nuages`;
  }

  // On peint le sol comme une illustration (l'herbe tachetée, le chemin avec sa bordure et ses
  // cailloux…), d'après ses recettes : 40 pixels par case, sur une grande toile (voir peintures.js)
  peindreSol(x0, x1, z0, z1) {
    const ppc = 40; // pixels par case
    const c = document.createElement('canvas');
    c.width = (x1 - x0) * ppc;
    c.height = (z1 - z0) * ppc;
    const ctx = c.getContext('2d');
    const X = (x) => (x - x0) * ppc, Z = (z) => (z - z0) * ppc; // case → pixel
    this.toileSol = { ctx, X, Z, ppc, x0, z0 };
    this.repeindreSol();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Peint (ou repeint) toute la toile du sol d'après les recettes, puis l'ombre douce au pied des
  // arbres (une fois qu'ils sont plantés) ; la terre des socles bonus déjà débloqués sera repeinte
  // au prochain dessin (voir majTerreSocles)
  repeindreSol() {
    const { ctx, ppc, x0, z0 } = this.toileSol;
    const toile = creerToile(ctx.canvas.width, ctx.canvas.height, ppc, x0, z0);
    peindreSolRecettes(toile, this.niveau, RECETTES);
    ctx.putImageData(new ImageData(toile.pixels, toile.largeur, toile.hauteur), 0, 0);
    if (this.pieds) this.peindrePieds();
    this.terresSocles = new Map();
    this.cleSocles = '';
    if (this.texSol) this.texSol.needsUpdate = true;
  }

  // Une recette a changé (dans l'atelier des textures) : on repeint le sol. Renvoie false si cette
  // texture n'est pas une texture du style cartoon.
  majTexture(nom) {
    if (!(nom in RECETTES)) return false;
    this.repeindreSol();
    return true;
  }

  // Hauteur du sol, adoucie : dans ce style on ne veut pas de grande montagne, juste des collines
  sol(x, y) {
    const h = this.niveau.hauteurTerrain(x, y);
    return Math.min(h, 1.6 + Math.max(0, h - 1.6) * 0.15);
  }

  // ── L'eau des étangs ───────────────────────────────────────
  // Un programme à elle (un « ShaderMaterial »), dessinée comme dans un dessin animé : deux
  // aplats de bleu (plus sombre au milieu), des traits de vaguelettes qui ondulent et glissent,
  // une bande d'écume au bord dont la largeur ondule, des reflets qui scintillent, et la
  // lumière des lanternes la nuit (la carte des lumières). Plus quelques nénuphars.
  creerEau() {
    this.uniformesEau = {
      uTemps: this.uTemps,
      uEau: { value: new THREE.Color('#2fa0dc') },
      uEauBord: { value: new THREE.Color('#6cd0f4') },
      uEcume: { value: new THREE.Color('#ffffff') },
      ...this.carte.uniforms,
    };
    const programme = {
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vMonde;
        void main() {
          vUv = uv;
          vec4 monde = modelMatrix * vec4(position, 1.0);
          vMonde = monde.xyz;
          gl_Position = projectionMatrix * viewMatrix * monde;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTemps, uRayon;
        uniform vec3 uEau, uEauBord, uEcume;
        uniform sampler2D uCarteLumieres;
        uniform vec4 uCarteZone;
        uniform float uCarteForce;
        varying vec2 vUv;
        varying vec3 vMonde;
        float hasard(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float bruit(vec2 p) {
          vec2 i = floor(p), f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hasard(i), hasard(i + vec2(1.0, 0.0)), f.x), mix(hasard(i + vec2(0.0, 1.0)), hasard(i + vec2(1.0, 1.0)), f.x), f.y);
        }
        void main() {
          vec2 c = vUv - 0.5;
          float angle = atan(c.y, c.x);
          // la distance au centre, en cases ; le bord visible est un peu avant le bord du disque :
          // la berge (le sol) recouvre l'eau sur le dernier petit bout (voir hauteurTerrain)
          float d = length(c) * 2.0 * (uRayon + 0.12);
          float bord = uRayon * 0.93;
          // deux aplats : le bord clair, le milieu plus sombre (plus profond)
          vec3 couleur = mix(uEau, uEauBord, step(bord - 0.55, d));
          // des traits de vaguelettes : des lignes qui ondulent et glissent, coupées par endroits
          float onde = sin(vMonde.z * 3.2 + sin(vMonde.x * 1.3 + uTemps * 1.3) * 1.5 - uTemps * 1.6);
          float trait = step(0.93, onde) * step(bruit(vMonde.xz * 1.7 + uTemps * 0.2), 0.55) * step(d, bord - 0.3);
          couleur = mix(couleur, uEcume, trait * 0.7);
          // l'écume au bord : une bande blanche dont la largeur ondule tout autour
          float largeur = 0.11 + 0.05 * sin(angle * 7.0 + uTemps * 1.8) + 0.03 * sin(angle * 13.0 - uTemps * 2.3);
          couleur = mix(couleur, uEcume, step(bord - largeur, d));
          // des reflets ronds qui s'allument et s'éteignent
          vec2 cellule = floor(vMonde.xz * 6.0);
          float reflet = step(0.97, hasard(cellule + floor(uTemps * 2.0))) * step(length(fract(vMonde.xz * 6.0) - 0.5), 0.18);
          couleur += uEcume * reflet * 0.5 * step(d, bord - 0.25);
          // la lumière des lanternes, la nuit
          vec2 uvCarte = (vMonde.xz - uCarteZone.xy) * uCarteZone.zw;
          couleur += couleur * texture2D(uCarteLumieres, clamp(uvCarte, 0.0, 1.0)).rgb * uCarteForce;
          gl_FragColor = vec4(couleur, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    };
    this.nenuphars = [];
    const feuille = this.toon('#5cae3a'), fleur = this.toon('#ff9ac0');
    for (const etang of this.niveau.etangs) {
      // un matériau par étang (avec son rayon), qui partage tous les autres réglages
      const mat = new THREE.ShaderMaterial({ ...programme, uniforms: { ...this.uniformesEau, uRayon: { value: etang.rayon } } });
      const eau = new THREE.Mesh(new THREE.CircleGeometry(etang.rayon + 0.12, 64).rotateX(-Math.PI / 2), mat);
      eau.position.set(etang.x, -0.1, etang.y);
      this.scene.add(eau);
      // des nénuphars : un disque vert avec une encoche, et parfois une fleur rose
      const nombre = 2 + Math.floor(etang.rayon);
      for (let i = 0; i < nombre; i++) {
        const angle = alea() * Math.PI * 2, distance = (0.25 + alea() * 0.45) * etang.rayon;
        const n = new THREE.Group();
        n.position.set(etang.x + Math.cos(angle) * distance, -0.075, etang.y + Math.sin(angle) * distance);
        n.rotation.y = alea() * Math.PI * 2;
        this.piece(n, new THREE.CircleGeometry(0.17 + alea() * 0.07, 18, 0.35, Math.PI * 2 - 0.7).rotateX(-Math.PI / 2), feuille, 0, 0, 0, { fin: true, ombre: false });
        if (alea() < 0.4) this.piece(n, new THREE.SphereGeometry(0.05, 10, 8), fleur, 0.04, 0.03, 0.02, { fin: true, ombre: false });
        n.userData.phase = alea() * 6;
        this.scene.add(n);
        this.nenuphars.push(n);
      }
    }
  }

  // ── Arbres ronds, rochers, fleurs, touffes d'herbe ─────────
  creerDecor() {
    const niv = this.niveau;
    const sphere = new THREE.IcosahedronGeometry(0.5, 2);
    const listeFeuillage = [], listeTroncs = [], listeRochers = [];
    const couleursArbres = {
      chene: ['#4fa83a', '#5cb840', '#45992f'],
      bouleau: ['#8fd04e', '#9ed85c'],
      automne: ['#f29a2e', '#e8762a', '#f6bd3a'],
    };
    // Un arbre = un tronc + une grosse boule de feuillage + deux plus petites
    const pieds = []; // le pied de chaque arbre, pour y peindre une ombre douce
    this.arbresAutomne = [];
    const planter = (x, z, t, type, buisson) => {
      const y = this.sol(x, z);
      pieds.push({ x, z, r: (buisson ? 0.5 : 0.75) * t });
      if (type === 'automne' && !buisson) this.arbresAutomne.push({ x, y: y + 0.55 * t + 0.35 * t, z, t });
      const couleur = new THREE.Color(choisir(couleursArbres[type]));
      const hTronc = buisson ? 0.12 : 0.55 * t;
      if (!buisson) listeTroncs.push({ x, y: y + hTronc / 2, z, h: hTronc, r: 0.09 * t, c: type === 'bouleau' ? '#efe8dc' : '#7a4f2c' });
      const base = y + hTronc + 0.35 * t;
      listeFeuillage.push({ x, y: base, z, s: 1.0 * t, c: couleur });
      listeFeuillage.push({ x: x - 0.32 * t, y: base - 0.12 * t, z: z + 0.12 * t, s: 0.68 * t, c: couleur.clone().offsetHSL(0, 0, -0.04) });
      listeFeuillage.push({ x: x + 0.3 * t, y: base - 0.08 * t, z: z + 0.2 * t, s: 0.62 * t, c: couleur.clone().offsetHSL(0, 0, 0.04) });
    };
    const places = [];
    for (const d of niv.decor) {
      const y = this.sol(d.x, d.y);
      if (d.type === 'rocher') {
        listeRochers.push({ x: d.x, y: y + 0.1, z: d.y, s: d.taille * 0.7, r: d.variante * 6 });
        pieds.push({ x: d.x, z: d.y, r: d.taille * 0.5 });
        continue;
      }
      if (!couleursArbres[d.type]) continue;
      planter(d.x, d.y, d.dedans ? d.taille * 0.75 : d.taille, d.type, d.dedans);
      places.push(d);
    }
    // Des moulins à vent dans les coins libres (le monde 2, c'est le pays des moulins)
    this.creerMoulins(places);
    // Dans ce style vu presque de dessus, les arbres cachent peu le jeu : on en ajoute
    // tout autour de la carte, et quelques buissons à l'intérieur.
    const libre = (x, z, marge) =>
      niv.distanceAuChemin(x, z) > 1.3 + marge &&
      !niv.socles.some((e) => Math.hypot(e.x - x, e.y - z) < 1.3 + marge) &&
      Math.hypot(x - niv.chateau.x, z - niv.chateau.y) > 3.4 &&
      niv.distanceEtang(x, z) > 0.8 &&
      !places.some((d) => Math.hypot(d.x - x, d.y - z) < 1.1);
    for (let i = 0; i < 1400; i++) {
      const x = -9 + alea() * (niv.largeur + 18), z = -7 + alea() * (niv.hauteur + 14);
      const dedans = x > 0.5 && x < niv.largeur - 0.5 && z > 0.5 && z < niv.hauteur - 0.5;
      if (dedans && alea() > 0.06) continue;
      if (!libre(x, z, dedans ? 0.2 : 0.4)) continue;
      const type = choisir(['chene', 'chene', 'bouleau', 'automne']);
      planter(x, z, dedans ? 0.55 + alea() * 0.2 : 0.8 + alea() * 0.5, type, dedans);
      places.push({ x, y: z });
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3();
    // contour : le matériau du contour (ou null : pas de contour) ; ombre : projette une ombre ;
    // profondeur : le matériau qui dessine son ombre (pour un feuillage qui bouge au vent)
    const instancier = (geo, liste, materiau, regler, { contour = this.matContour, ombre = true, profondeur = null } = {}) => {
      const mesh = new THREE.InstancedMesh(geo, materiau, liste.length);
      liste.forEach((e, i) => {
        regler(e, v, q, s);
        m.compose(v, q, s);
        mesh.setMatrixAt(i, m);
        if (e.c) mesh.setColorAt(i, new THREE.Color(e.c));
      });
      mesh.castShadow = ombre;
      mesh.receiveShadow = true;
      if (profondeur) mesh.customDepthMaterial = profondeur;
      this.scene.add(mesh);
      if (contour) {
        const bord = new THREE.InstancedMesh(geo, contour, liste.length);
        bord.instanceMatrix = mesh.instanceMatrix;
        this.scene.add(bord);
      }
      return mesh;
    };
    // les feuillages bougent au vent (avec leur contour, et leur ombre)
    const poidsFeuillage = 'position.y + 0.5'; // le bas de la boule ne bouge pas, le haut bouge le plus
    instancier(sphere, listeFeuillage, this.venter(this.toon('#ffffff', { rim: true, unique: true }), poidsFeuillage), (e, v, q, s) => { v.set(e.x, e.y, e.z); q.identity(); s.set(e.s, e.s * 0.9, e.s); }, {
      contour: this.matContourVent,
      profondeur: this.venter(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), poidsFeuillage),
    });
    instancier(new THREE.CylinderGeometry(1, 1.2, 1, 8), listeTroncs, this.toon('#ffffff'), (e, v, q, s) => { v.set(e.x, e.y, e.z); q.identity(); s.set(e.r, e.h, e.r); });
    instancier(new THREE.DodecahedronGeometry(0.5, 0), listeRochers, this.toon('#a7a39a'), (e, v, q, s) => {
      v.set(e.x, e.y, e.z); q.setFromEuler(new THREE.Euler(0, e.r, 0)); s.set(e.s, e.s * 0.6, e.s * 0.85);
    });

    // Fleurs (petites boules colorées) et touffes d'herbe (petits cônes)
    const fleurs = [], touffes = [];
    for (const d of niv.decor) {
      if (d.type !== 'fleur') continue;
      if (d.x > 0 && d.x < niv.largeur && d.y > 0 && d.y < niv.hauteur && alea() < 0.4) continue;
      const couleur = choisir(['#ffffff', '#ffe14a', '#ff8fb0', '#b98cff', '#fff4c8']);
      for (let i = 0; i < 3; i++) {
        const x = d.x + (alea() - 0.5) * 0.5, z = d.y + (alea() - 0.5) * 0.5;
        fleurs.push({ x, y: this.sol(x, z) + 0.05, z, c: couleur });
      }
    }
    for (let i = 0; i < 1600; i++) {
      const x = -8 + alea() * (niv.largeur + 16), z = -6 + alea() * (niv.hauteur + 12);
      if (niv.distanceAuChemin(x, z) < 0.8 || niv.distanceEtang(x, z) < 0.4) continue;
      const c = niv.chateau;
      if (x > c.x - 2.0 && x < c.x + 1.7 && z > c.y - 2.9 && z < c.y + 2.9) continue;
      if (niv.socles.some((e) => Math.hypot(e.x - x, e.y - z) < 0.75)) continue;
      touffes.push({ x, y: this.sol(x, z), z, s: 0.7 + alea() * 0.6, c: choisir(['#5aa236', '#4e9430', '#68b03e']) });
    }
    instancier(new THREE.IcosahedronGeometry(0.055, 0), fleurs, this.toon('#ffffff'), (e, v, q, s) => { v.set(e.x, e.y, e.z); q.identity(); s.setScalar(1); }, { contour: null, ombre: false });
    const cone = new THREE.ConeGeometry(0.05, 0.22, 4);
    cone.translate(0, 0.11, 0);
    // les touffes d'herbe bougent au vent (le bout plus que le pied)
    instancier(cone, touffes, this.venter(this.toon('#ffffff', { unique: true }), 'position.y / 0.22'), (e, v, q, s) => {
      v.set(e.x, e.y, e.z); q.setFromEuler(new THREE.Euler((alea() - 0.5) * 0.5, alea() * 3, (alea() - 0.5) * 0.5)); s.setScalar(e.s);
    }, { contour: null, ombre: false });
    this.fleursPourPapillons = fleurs.filter((f, i) => i % 3 === 0);

    this.pieds = pieds;
    this.peindrePieds();
    this.texSol.needsUpdate = true;
  }

  // Une ombre douce au pied de chaque arbre et de chaque rocher, peinte dans la texture du sol :
  // sous un feuillage, la lumière du ciel arrive moins (les dessinateurs appellent ça
  // l'« occlusion ambiante »). Ça pose les arbres sur le sol.
  peindrePieds() {
    const { ctx, X, Z, ppc } = this.toileSol;
    for (const pied of this.pieds) {
      const r = pied.r * ppc;
      const g = ctx.createRadialGradient(X(pied.x), Z(pied.z), 0, X(pied.x), Z(pied.z), r);
      g.addColorStop(0, 'rgba(20,44,12,0.4)');
      g.addColorStop(0.6, 'rgba(20,44,12,0.18)');
      g.addColorStop(1, 'rgba(20,44,12,0)');
      ctx.fillStyle = g;
      ctx.fillRect(X(pied.x) - r, Z(pied.z) - r, r * 2, r * 2);
    }
  }

  // ── Les moulins à vent ─────────────────────────────────────
  // Au plus deux, dans des coins libres de la carte : loin du chemin, des socles, du château
  // et des étangs, près du bord haut ou bas (là où ils ne gênent pas). Leurs ailes tournent
  // plus vite quand le vent souffle fort.
  creerMoulins(places) {
    this.moulins = [];
    const niv = this.niveau;
    const libre = (x, z) => niv.distanceAuChemin(x, z) > 2.2 && !niv.socles.some((e) => Math.hypot(e.x - x, e.y - z) < 2)
      && Math.hypot(x - niv.chateau.x, z - niv.chateau.y) > 4.5 && niv.distanceEtang(x, z) > 1.6
      && !places.some((d) => Math.hypot(d.x - x, d.y - z) < 1.3);
    const candidats = [];
    for (let x = 1; x < niv.largeur - 1; x += 0.5) {
      for (const z of [0.9, 1.5, niv.hauteur - 1.5, niv.hauteur - 0.9]) if (libre(x, z)) candidats.push({ x, z });
    }
    if (!candidats.length) return;
    // le premier candidat, puis celui qui est le plus loin de lui
    const premier = candidats[Math.floor(candidats.length * 0.3)];
    const choisis = [premier];
    const second = candidats.reduce((loin, c) => (Math.hypot(c.x - premier.x, c.z - premier.z) > Math.hypot(loin.x - premier.x, loin.z - premier.z) ? c : loin));
    if (Math.hypot(second.x - premier.x, second.z - premier.z) > 5) choisis.push(second);
    for (const { x, z } of choisis) {
      this.moulins.push(this.fabriquerMoulin(x, z));
      places.push({ x, y: z }); // les arbres ajoutés ensuite ne pousseront pas dessus
    }
  }

  fabriquerMoulin(x, z) {
    const g = new THREE.Group();
    g.position.set(x, this.sol(x, z), z);
    const pierre = this.toon('#efe6d2', { rim: true }), toit = this.toon('#b8452f', { rim: true }), bois = this.toon('#7a5230'), sombre = this.toon('#4a2e1c');
    const toile = this.toon('#f4e8d4', { side: THREE.DoubleSide });
    this.piece(g, new THREE.CylinderGeometry(0.28, 0.42, 1.3, 16), pierre, 0, 0.65, 0);           // la tour
    this.piece(g, new THREE.ConeGeometry(0.38, 0.5, 16), toit, 0, 1.55, 0);                       // le toit
    this.piece(g, new RoundedBoxGeometry(0.16, 0.26, 0.06, 2, 0.03), sombre, 0, 0.14, 0.4, { fin: true }); // la porte
    this.piece(g, new THREE.CircleGeometry(0.06, 12), sombre, 0, 0.85, 0.345, { contour: false }); // une fenêtre ronde
    // les ailes : quatre bras de bois, chacun avec sa toile, autour d'un moyeu (elles regardent la caméra)
    const ailes = new THREE.Group();
    ailes.position.set(0, 1.32, 0.42);
    this.piece(ailes, new THREE.SphereGeometry(0.06, 10, 8), bois, 0, 0, 0, { fin: true });
    for (let i = 0; i < 4; i++) {
      const aile = new THREE.Group();
      aile.rotation.z = (i * Math.PI) / 2;
      this.piece(aile, new THREE.BoxGeometry(0.04, 0.8, 0.03), bois, 0, 0.42, 0, { fin: true });
      this.piece(aile, new THREE.BoxGeometry(0.2, 0.55, 0.015), toile, 0.11, 0.5, 0.012, { fin: true });
      ailes.add(aile);
    }
    g.add(ailes);
    this.scene.add(g);
    return { ailes, vitesse: 0.7 + alea() * 0.5 };
  }

  // ── Le château : tours rondes, toits pointus, drapeaux ─────
  creerChateau() {
    const g = new THREE.Group();
    const pierre = this.toon('#ddd2bc'), pierreSombre = this.toon('#b9ad96'), toit = this.toon('#3f6fd0'), bois = this.toon('#6a4428');
    const cx = this.niveau.chateau.x, cz = this.niveau.chateau.y;
    // mur d'enceinte
    const mur = (l, p, x, z) => this.piece(g, new RoundedBoxGeometry(l, 0.9, p, 2, 0.06), pierre, x, 0.45, z);
    mur(0.35, 4.2, cx - 1.35, cz); // façade (avec la porte)
    mur(0.35, 4.2, cx + 1.25, cz);
    mur(2.9, 0.35, cx - 0.05, cz - 2.1);
    mur(2.9, 0.35, cx - 0.05, cz + 2.1);
    // créneaux sur les murs
    for (let i = 0; i < 7; i++) {
      for (const [x, z] of [[cx - 1.35, cz - 1.8 + i * 0.6], [cx + 1.25, cz - 1.8 + i * 0.6]]) {
        this.piece(g, new RoundedBoxGeometry(0.36, 0.2, 0.26, 2, 0.04), pierreSombre, x, 1.0, z, { fin: true });
      }
    }
    // porte : un arc sombre avec une herse en bois
    this.piece(g, new RoundedBoxGeometry(0.2, 0.62, 0.86, 2, 0.08), this.toon('#2a1c14'), cx - 1.5, 0.31, cz, { contour: false });
    for (let i = -1; i <= 1; i++) this.piece(g, new THREE.BoxGeometry(0.04, 0.6, 0.05), bois, cx - 1.6, 0.3, cz + i * 0.25, { contour: false });
    // quatre tours rondes + le donjon
    const tourRonde = (x, z, r, h, couleurToit = toit) => {
      this.piece(g, new THREE.CylinderGeometry(r, r * 1.08, h, 20), pierre, x, h / 2, z);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.piece(g, new RoundedBoxGeometry(0.16, 0.18, 0.16, 2, 0.03), pierreSombre, x + Math.cos(a) * r, h + 0.06, z + Math.sin(a) * r, { fin: true });
      }
      this.piece(g, new THREE.ConeGeometry(r * 1.25, r * 2.2, 20), couleurToit, x, h + 0.15 + r * 1.1, z);
      return h + 0.15 + r * 2.2;
    };
    tourRonde(cx - 1.4, cz - 2.1, 0.5, 1.7);
    tourRonde(cx - 1.4, cz + 2.1, 0.5, 1.7);
    tourRonde(cx + 1.3, cz - 2.1, 0.42, 1.4);
    tourRonde(cx + 1.3, cz + 2.1, 0.42, 1.4);
    const sommet = tourRonde(cx + 0.2, cz, 0.75, 2.6, this.toon('#d8452f'));
    // drapeaux
    this.drapeaux = [];
    for (const [x, y, z] of [[cx + 0.2, sommet, cz], [cx - 1.4, 3.0, cz - 2.1], [cx - 1.4, 3.0, cz + 2.1]]) {
      this.piece(g, new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), bois, x, y + 0.3, z, { contour: false });
      const drapeau = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26, 6, 1), this.toon('#e8402e', { side: THREE.DoubleSide }));
      drapeau.geometry.translate(0.21, 0, 0);
      drapeau.position.set(x + 0.02, y + 0.5, z);
      drapeau.castShadow = true;
      g.add(drapeau);
      this.drapeaux.push(drapeau);
    }
    this.scene.add(g);
  }

  // ── Socles : plateformes de pierre rondes ──────────────────
  creerSocles() {
    this.socles = this.niveau.socles.map((e, i) => {
      const g = new THREE.Group();
      g.position.set(e.x, this.sol(e.x, e.y), e.y);
      const base = this.piece(g, new THREE.CylinderGeometry(0.56, 0.62, 0.2, 24), this.toon('#b7ae9e', { unique: true, emissive: '#ffd060', emissiveIntensity: 0 }), 0, 0.1, 0);
      this.piece(g, new THREE.CylinderGeometry(0.44, 0.48, 0.08, 24), this.toon('#d9d1c0'), 0, 0.23, 0, { fin: true });
      // un « + » doré qui flotte au-dessus des socles libres
      const plus = new THREE.Group();
      const or = this.brillant('#ffd24a', 1.1);
      for (const [l, h] of [[0.36, 0.11], [0.11, 0.36]]) {
        const barre = new THREE.Mesh(new RoundedBoxGeometry(l, h, 0.1, 2, 0.03), or);
        barre.add(new THREE.Mesh(barre.geometry, this.matContourFin));
        plus.add(barre);
      }
      plus.position.y = 0.75;
      g.add(plus);
      const zone = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.4, 12), new THREE.MeshBasicMaterial({ visible: false }));
      zone.position.y = 0.7;
      zone.userData.index = i;
      g.add(zone);
      this.scene.add(g);
      return { groupe: g, base, plus, zone };
    });
  }

  // Les lanternes. Leur lumière, la nuit, vient de la carte des lumières (voir lumieres.js),
  // comme celle de la porte du château.
  creerLanternes() {
    for (const l of this.niveau.lanternes) {
      const y = this.sol(l.x, l.y);
      this.piece(this.scene, new THREE.CylinderGeometry(0.04, 0.05, 0.8, 6), this.toon('#6a4428'), l.x, y + 0.4, l.y, { fin: true });
      this.piece(this.scene, new RoundedBoxGeometry(0.2, 0.22, 0.2, 2, 0.04), this.brillant('#ffd36a', 1.2), l.x, y + 0.9, l.y, { fin: true });
    }
  }

  // ── Les ambiances ──────────────────────────────────────────
  choisirAmbiance(nom) {
    this.ambiance = AMBIANCES_CARTOON[nom] || AMBIANCES_CARTOON.midi;
    const a = this.ambiance;
    this.hemi.color.set(a.ciel);
    this.hemi.groundColor.set(a.sol);
    this.hemi.intensity = a.hemi;
    this.soleil.color.set(a.soleil);
    this.soleil.intensity = a.intensite;
    const [dx, dy, dz] = a.depuis;
    this.soleil.position.copy(this.soleil.target.position).add(new THREE.Vector3(dx, dy, dz));
    this.scene.background.set(a.fond);
    this.carte.uniforms.uCarteForce.value = a.lumieres; // à quel point on voit les lumières du jeu
    this.uRim.value = a.rim;
    this.uRimCouleur.value.set(a.rimCouleur);
    this.uNuages.value = a.nuages;
    this.uVent.value = a.vent;
    if (this.uniformesEau) {
      this.uniformesEau.uEau.value.set(a.eau);
      this.uniformesEau.uEauBord.value.set(a.eauBord);
      this.uniformesEau.uEcume.value.set(a.ecume);
    }
  }

  creerAnneauPortee() {
    const g = new THREE.Group();
    const trait = new THREE.Mesh(new THREE.RingGeometry(0.95, 1, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false }));
    const fond = new THREE.Mesh(new THREE.CircleGeometry(0.95, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.15, depthWrite: false }));
    g.add(trait, fond);
    g.visible = false;
    this.scene.add(g);
    return g;
  }

  // ── Le héros (le Grand Gardien) ────────────────────────────
  // Fabriqué la première fois qu'on en a besoin, puis placé à chaque image. Un cercle doré à ses
  // pieds (blanc quand on l'a choisi), et un petit drapeau là où il va.
  majHeros(etat, ui) {
    const h = etat.heros;
    if (!h) {
      if (this.vueHeros) this.vueHeros.racine.visible = this.anneauHeros.visible = this.marqueHeros.visible = false;
      return;
    }
    if (!this.vueHeros) {
      // (ses matériaux sont à lui : il s'éclaire en rouge quand il prend des coups)
      this.vueHeros = this.fabriquer(HEROS.apparence, true);
      this.vueHeros.barre = creerBarreDeVie(this.vueHeros.largeurBarre);
      this.vueHeros.barre.position.y = this.vueHeros.hauteurBarre + 0.15;
      this.vueHeros.racine.add(this.vueHeros.barre);
      this.scene.add(this.vueHeros.racine);
      this.anneauHeros = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.58, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffcf3a', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false }));
      this.scene.add(this.anneauHeros);
      this.marqueHeros = new THREE.Group();
      const or = new THREE.MeshBasicMaterial({ color: '#ffcf3a', toneMapped: false });
      this.marqueHeros.add(new THREE.Mesh(new THREE.RingGeometry(0.22, 0.3, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffcf3a', transparent: true, opacity: 0.9, depthWrite: false, toneMapped: false })));
      const hampe = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), or);
      hampe.position.y = 0.3;
      const drapeau = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.02), or);
      drapeau.position.set(0.11, 0.53, 0);
      this.marqueHeros.add(hampe, drapeau);
      this.scene.add(this.marqueHeros);
    }
    const vue = this.vueHeros;
    vue.racine.visible = this.anneauHeros.visible = !this.masques.has('heros');
    ombrerVue(vue, !this.sansOmbre.has('heros'));
    const y = this.sol(h.x, h.y);
    vue.racine.position.set(h.x, y + h.z, h.y); // (h.z : en l'air, pendant un Bond)
    // il se tourne vers où il va (ou vers le monstre qu'il frappe), mais sans jamais tourner le dos
    // à la caméra (au plus de trois quarts) : de dos, on ne voyait que sa grande cape rouge
    let vise = versRotationY(h.angle);
    vise = Math.max(-1.1, Math.min(1.1, Math.atan2(Math.sin(vise), Math.cos(vise))));
    let diff = vise - vue.racine.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    vue.racine.rotation.y += diff * 0.25;
    vue.racine.scale.setScalar(TAILLE_GARDIEN * 0.82); // (sa taille 1,5 le rendait plus large qu'un socle)
    // il respire ; il s'écrase quand il frappe ; il sautille quand il marche
    const coup = h.attaque > 0 ? Math.sin((h.attaque / 0.3) * Math.PI) * 0.25 : 0;
    const respire = Math.sin(this.temps * 3) * 0.04;
    vue.corps.scale.set(vue.taille * (1 + coup * 0.5), vue.taille * (1 + respire - coup), vue.taille * (1 + coup * 0.5));
    vue.corps.position.y = h.cible ? Math.abs(Math.sin(this.temps * 12)) * 0.12 : 0;
    // K.O. : couché sur le côté, les yeux fermés, et trois étoiles qui tournent au-dessus de lui
    vue.corps.rotation.z = h.ko ? 1.35 : 0;
    if (this.joie > 0) vue.racine.position.y += Math.abs(Math.sin((1 - this.joie) * Math.PI * 3)) * 0.3 * this.joie;
    vue.attaque = h.attaque;
    for (const animer of vue.animations) animer(this.temps, vue);
    const cligne = h.ko || this.temps % 3.7 < 0.12 ? 0.1 : 1;
    vue.yeux.forEach((o) => (o.scale.y = cligne));
    if (h.ko && !vue.etoiles) {
      vue.etoiles = new THREE.Group();
      for (let k = 0; k < 3; k++) this.piece(vue.etoiles, new THREE.OctahedronGeometry(0.05, 0), this.brillant('#ffe14a', 1.3), Math.cos((k * Math.PI * 2) / 3) * 0.22, 0, Math.sin((k * Math.PI * 2) / 3) * 0.22, { contour: false }).scale.set(1, 0.5, 1);
      vue.racine.add(vue.etoiles);
    }
    if (vue.etoiles) {
      vue.etoiles.visible = h.ko;
      vue.etoiles.position.set(-0.45, 0.45, 0); // au-dessus de sa tête, couchée
      vue.etoiles.rotation.y = this.temps * 5;
    }
    // il prend des coups : il clignote en rouge
    const rouge = h.touche > 0 && !h.ko && Math.floor(this.temps * 8) % 2 === 0;
    for (const mat of vue.materiaux) {
      mat.emissive.set('#ff4a3a');
      mat.emissiveIntensity = rouge ? 0.4 : 0;
    }
    // sa barre de vie, quand il est blessé (rien quand il est K.O. : il est couché)
    majBarreDeVie(vue.barre, h.ko ? 1 : h.vie / ficheDuHeros(etat).vie, this.camera);
    this.anneauHeros.position.set(h.x, y + 0.05, h.y);
    this.anneauHeros.material.color.set(h.ko ? '#8a8a96' : ui.herosChoisi ? '#ffffff' : '#ffcf3a');
    const cible = ui.herosChoisi ? ui.viseeHeros : h.cible;
    this.marqueHeros.visible = Boolean(cible);
    if (cible) this.marqueHeros.position.set(cible.x, this.sol(cible.x, cible.y) + 0.03, cible.y);
  }

  // Un socle bonus vient d'être débloqué (bénédiction « Nouveau socle ») : on peint sa terre sur la
  // toile du sol, un peu plus petite que celle des autres (elle ne doit pas mordre sur le chemin),
  // en gardant ce qu'il y avait dessous : si une nouvelle partie commence, on remet l'herbe.
  majTerreSocles(etat) {
    const cle = etat.soclesDebloques.join(',');
    if (cle === (this.cleSocles ?? '')) return;
    this.cleSocles = cle;
    const { ctx, X, Z, ppc } = this.toileSol;
    this.terresSocles ||= new Map();
    for (const [i, dessous] of this.terresSocles) {
      if (etat.soclesDebloques.includes(i)) continue;
      ctx.putImageData(dessous.pixels, dessous.x, dessous.y);
      this.terresSocles.delete(i);
    }
    for (const i of etat.soclesDebloques) {
      if (this.terresSocles.has(i)) continue;
      const e = this.niveau.socles[i];
      // la terre de la recette, un peu plus petite (0,85) : un socle bonus est souvent plus près du chemin
      const r = Math.ceil(portee(RECETTES.terre) * 0.85 * ppc) + 2, x = Math.round(X(e.x)) - r, y = Math.round(Z(e.y)) - r;
      const dessous = ctx.getImageData(x, y, r * 2, r * 2); // gardé, pour le remettre si le socle se rendort
      this.terresSocles.set(i, { x, y, pixels: dessous });
      const morceau = new ImageData(new Uint8ClampedArray(dessous.data), r * 2, r * 2); // une copie, peinte puis reposée
      const toile = { largeur: r * 2, hauteur: r * 2, ppc, x0: this.toileSol.x0 + x / ppc, z0: this.toileSol.z0 + y / ppc, pixels: morceau.data };
      peindreMatiere(toile, RECETTES.terre, 'terre', FORMES.disques([e], 0.85));
      ctx.putImageData(morceau, x, y);
    }
    this.texSol.needsUpdate = true;
  }

  // Le cercle du Météore : là où il va tomber (sa couleur change dans dessiner())
  creerAnneauMeteore() {
    const g = new THREE.Group();
    const trait = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb46a', transparent: true, opacity: 0.95, depthWrite: false }));
    const fond = new THREE.Mesh(new THREE.CircleGeometry(0.92, 80).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ff8a3a', transparent: true, opacity: 0.18, depthWrite: false }));
    g.add(trait, fond);
    g.visible = false;
    g.userData = { trait };
    this.scene.add(g);
    return g;
  }

  ombreRonde(parent, rayon) {
    if (!this.texOmbre) {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const ctx = c.getContext('2d');
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(30,20,10,0.45)');
      grad.addColorStop(0.7, 'rgba(30,20,10,0.25)');
      grad.addColorStop(1, 'rgba(30,20,10,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
      this.texOmbre = new THREE.CanvasTexture(c);
    }
    const o = new THREE.Mesh(new THREE.PlaneGeometry(rayon * 2, rayon * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: this.texOmbre, transparent: true, depthWrite: false }));
    o.position.y = 0.02;
    parent.add(o);
    return o;
  }

  // ═══════════════════════════════════════════════════════════
  // LES PERSONNAGES
  // ═══════════════════════════════════════════════════════════
  // Deux grands yeux de dessin animé (blanc + pupille + reflet)
  yeux(parent, ecart, y, z, taille = 0.085, couleurPupille = '#1a1210') {
    const blanc = this.toon('#ffffff'), noir = this.brillant(couleurPupille, 1);
    const pupilles = [];
    for (const sx of [-1, 1]) {
      const oeil = this.piece(parent, new THREE.SphereGeometry(taille, 16, 12), blanc, sx * ecart, y, z, { fin: true });
      oeil.scale.z = 0.6;
      const pupille = new THREE.Mesh(new THREE.SphereGeometry(taille * 0.55, 12, 8), noir);
      pupille.position.set(0, 0, taille * 0.75);
      oeil.add(pupille);
      const reflet = new THREE.Mesh(new THREE.SphereGeometry(taille * 0.2, 8, 6), this.brillant('#ffffff', 1.2));
      reflet.position.set(taille * 0.25, taille * 0.25, taille * 1.05);
      oeil.add(reflet);
      pupilles.push(oeil);
    }
    return pupilles;
  }

  // Fabrique un personnage à partir de l'apparence de sa fiche (donnees.js).
  // unique = true pour les monstres : leurs matériaux leur sont propres (pour le flash).
  fabriquer(apparence, unique = false) {
    const app = lireApparence(apparence);
    const racine = new THREE.Group();
    const corps = new THREE.Group();
    racine.add(corps);
    const materiaux = [];
    const m = (couleur, extra = {}) => {
      if (!unique) return this.toon(couleur, { rim: true, ...extra });
      const mat = this.toon(couleur, { unique: true, rim: true, emissive: '#000000', ...extra });
      materiaux.push(mat);
      return mat;
    };
    const vue = {
      racine, corps, materiaux, pattes: [], animations: [], yeux: [], gabarit: app.gabarit, taille: app.taille,
      apparition: 0, hauteurBarre: 0.62, largeurBarre: 0.4, rayonOmbre: 0.3,
    };
    GABARITS_CARTOON[app.gabarit].fabriquer(this, vue, app, m);
    for (const acc of app.accessoires) ACCESSOIRES_CARTOON[acc.type](this, vue, acc, m);
    corps.scale.setScalar(app.taille);
    vue.ombre = this.ombreRonde(racine, vue.rayonOmbre * app.taille);
    vue.hauteurBarre *= app.taille;
    vue.largeurBarre *= app.taille; // un gros monstre a une grande barre de vie
    return vue;
  }

  // Le portrait d'un personnage, avec la lumière franche du diorama (pour les fiches du didacticiel)
  portrait(apparence) {
    this.appareilPhoto ||= creerAppareilPhoto();
    const soleil = new THREE.DirectionalLight('#fff3dc', 2.6);
    soleil.position.set(-2, 4, 3);
    const vue = this.fabriquer(apparence, true); // true : des matériaux à lui, qu'on peut jeter ensuite
    return photographier(this.appareilPhoto, vue.racine, [new THREE.HemisphereLight('#cfeaff', '#8a7448', 1.4), soleil]);
  }

  creerVueTour(tour) {
    const vue = this.fabriquer(caracteristiques(tour.type, tour.niveau).apparence); // l'apparence de SON niveau
    vue.racine.scale.setScalar(0.01);
    vue.racine.rotation.y = versRotationY(tour.angle); // tourné tout de suite vers sa cible
    return vue;
  }

  majVueTour(vue, tour) {
    const e = this.niveau.socles[tour.socle];
    vue.racine.visible = !this.masques.has('tour:' + tour.socle);
    ombrerVue(vue, !this.sansOmbre.has('tour:' + tour.socle));
    vue.racine.position.set(e.x, this.sol(e.x, e.y) + 0.27, e.y);
    let diff = versRotationY(tour.angle) - vue.racine.rotation.y;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    vue.racine.rotation.y += diff * 0.25;
    vue.apparition = Math.min(1, vue.apparition + 1 / 18);
    const t = vue.apparition;
    // apparition « élastique » (dépasse un peu puis se stabilise)
    const elastique = t < 1 ? 1 - Math.cos(t * Math.PI * 2.5) * Math.pow(1 - t, 2) : 1;
    vue.racine.scale.setScalar(TAILLE_GARDIEN * elastique);
    const respire = Math.sin(this.temps * 3 + tour.id) * 0.04;
    const coup = tour.attaque > 0 ? Math.sin((tour.attaque / 0.25) * Math.PI) * 0.22 : 0;
    const base = vue.taille;
    vue.corps.scale.set(base * (1 + coup * 0.5), base * (1 + respire - coup), base * (1 + coup * 0.5));
    // il recule un peu quand il tire (à l'opposé de là où il regarde : son avant, c'est +Z)
    vue.racine.position.x -= Math.sin(vue.racine.rotation.y) * coup * 0.25;
    vue.racine.position.z -= Math.cos(vue.racine.rotation.y) * coup * 0.25;
    // une vague vient d'être repoussée : tout le monde saute de joie (chacun à son rythme)
    if (this.joie > 0) vue.racine.position.y += Math.abs(Math.sin((1 - this.joie) * Math.PI * 3 + tour.id)) * 0.28 * this.joie;
    vue.attaque = tour.attaque; // les accessoires réagissent quand il attaque (antennes, moulinet)
    vue.chauffe = tour.rayon ? tour.chauffe : 0; // et quand son rayon chauffe (le cristal du Prisme)
    for (const animer of vue.animations) animer(this.temps, vue);
    // clignement des yeux de temps en temps (et yeux fermés quand il est assommé)
    const cligne = tour.assomme > 0 || (this.temps + tour.id * 1.7) % 4 < 0.12 ? 0.1 : 1;
    vue.yeux.forEach((o) => (o.scale.y = cligne));
    // assommé par le feu du Dragon : il vacille, et trois étoiles tournent au-dessus de sa tête
    vue.corps.rotation.z = tour.assomme > 0 ? Math.sin(this.temps * 9) * 0.12 : 0;
    if (tour.assomme > 0 && !vue.etoiles) {
      vue.etoiles = new THREE.Group();
      for (let k = 0; k < 3; k++) {
        const etoile = this.piece(vue.etoiles, new THREE.OctahedronGeometry(0.05, 0), this.brillant('#ffe14a', 1.3), Math.cos((k * Math.PI * 2) / 3) * 0.22, 0, Math.sin((k * Math.PI * 2) / 3) * 0.22, { fin: true });
        etoile.scale.set(1, 0.5, 1);
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
    vue.vol = fiche.volant ? HAUTEUR_VOL / TAILLE_MONSTRE : 0; // un volant vole (son ombre, elle, reste par terre)
    vue.barre = creerBarreDeVie(vue.largeurBarre);
    vue.barre.position.y = vue.hauteurBarre + vue.vol;
    vue.racine.add(vue.barre);
    return vue;
  }

  majVueEnnemi(vue, e) {
    const t = this.temps + e.id;
    const y = this.sol(e.x, e.y) - 0.04;
    vue.racine.position.set(e.x, y, e.y);
    vue.racine.visible = !this.masques.has('ennemi:' + e.id);
    vue.racine.rotation.y = Math.atan2(e.dx, e.dy);
    // il arrive avec un petit « pop » élastique (il grandit, dépasse un peu, puis se pose)
    vue.apparition = Math.min(1, vue.apparition + this.dtReel * 3.5);
    const a = vue.apparition;
    vue.racine.scale.setScalar(TAILLE_MONSTRE * (a < 1 ? 1 - Math.cos(a * Math.PI * 2.5) * Math.pow(1 - a, 2) : 1));
    // sous terre (la Taupe) : on cache le monstre, on montre un tas de terre qui avance
    vue.corps.visible = vue.ombre.visible = !e.cache;
    ombrerVue(vue, !this.sansOmbre.has('ennemi:' + e.id));
    if (e.cache && !vue.butte) {
      vue.butte = this.piece(vue.racine, new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).scale(1, 0.5, 1.3), this.toon('#8a6440'), 0, 0, 0);
    }
    if (vue.butte) {
      vue.butte.visible = e.cache;
      if (e.cache) {
        vue.butte.scale.y = 1 + Math.sin(t * 14) * 0.15;
        if (Math.random() < 0.3) this.particules.emettre({ x: e.x, y: y + 0.12, z: e.y, vx: (Math.random() - 0.5) * 1.2, vy: 1.4, vz: (Math.random() - 0.5) * 1.2, couleur: Math.random() < 0.5 ? '#8a6440' : '#a07a50', taille: 0.06, vie: 0.4 });
        vue.barre.visible = false;
        return;
      }
    }
    const lent = e.facteurRalenti < 1 ? 0.5 : 1;
    // gelé par le Grand froid : son animation s'arrête net (on garde l'instant où il a gelé)
    if (e.gele > 0 || e.assomme > 0) vue.gel ??= { t, lent }; else vue.gel = null; // (assommé par le héros aussi)
    vue.corps.position.y = 0;
    GABARITS_CARTOON[vue.gabarit].animer(vue, vue.gel?.t ?? t, vue.gel?.lent ?? lent);
    // en l'air : la hauteur de vol, et le bond d'un petit qui vient de naître
    vue.corps.position.y += vue.vol + Math.sin(e.bond * Math.PI) * 0.3;
    // soufflé par le vent : il bascule en arrière, et des filets de vent passent autour de lui
    vue.corps.rotation.x = e.recul > 0 ? -0.45 : 0;
    // assommé par le héros : il vacille, et trois étoiles tournent au-dessus de sa tête
    vue.corps.rotation.z = e.assomme > 0 ? Math.sin(this.temps * 9 + e.id) * 0.15 : 0;
    if (e.assomme > 0 && !vue.etoiles) {
      vue.etoiles = new THREE.Group();
      for (let k = 0; k < 3; k++) this.piece(vue.etoiles, new THREE.OctahedronGeometry(0.045, 0), this.brillant('#ffe14a', 1.3), Math.cos((k * Math.PI * 2) / 3) * 0.2, 0, Math.sin((k * Math.PI * 2) / 3) * 0.2, { contour: false }).scale.set(1, 0.5, 1);
      vue.racine.add(vue.etoiles);
    }
    if (vue.etoiles) {
      vue.etoiles.visible = e.assomme > 0;
      vue.etoiles.position.y = vue.hauteurBarre + 0.12 + vue.vol;
      vue.etoiles.rotation.y = this.temps * 5;
    }
    if (e.recul > 0 && Math.random() < 0.6) {
      this.particules.emettre({ x: e.x + (Math.random() - 0.5) * 0.4, y: y + 0.3 + vue.vol * TAILLE_MONSTRE, z: e.y + (Math.random() - 0.5) * 0.4, vx: -e.dx * 3, vz: -e.dy * 3, couleur: '#ffffff', taille: 0.06, vie: 0.3, gravite: 0 });
    }
    // pris dans la glace du Grand froid : un glaçon transparent autour de lui (à lui seul :
    // il disparaît avec lui)
    if (e.gele > 0 && !vue.glacon) {
      const l = (vue.largeurBarre ?? 0.5) * 1.3, h = vue.hauteurBarre;
      vue.glacon = new THREE.Mesh(new THREE.BoxGeometry(l, h, l), this.toon('#dff6ff', { unique: true, transparent: true, opacity: 0.42, depthWrite: false }));
      vue.racine.add(vue.glacon);
    }
    if (vue.glacon) {
      vue.glacon.visible = e.gele > 0;
      vue.glacon.position.y = vue.hauteurBarre / 2 + vue.vol;
    }
    vue.attaque = 0;
    for (const animer of vue.animations) animer(this.temps, vue);
    // flash blanc quand il est touché, reflet bleu quand il est gelé (plus léger sur un chef :
    // touché sans arrêt par tous les gardiens, il serait tout blanc)
    const k = MONSTRES[e.type].boss ? 0.35 : 1;
    for (const mat of vue.materiaux) {
      // touché : un flash blanc, ou bleu clair s'il est gelé (pour qu'on voie toujours qu'il l'est)
      if (e.touche > 0) { mat.emissive.set(e.gele > 0 || lent < 1 ? '#bfe6ff' : '#ffffff'); mat.emissiveIntensity = 0.5 * k; }
      else if (e.gele > 0) { mat.emissive.set('#d8f4ff'); mat.emissiveIntensity = 0.45 * k; } // pris dans la glace
      else if (lent < 1) { mat.emissive.set('#3aa0ff'); mat.emissiveIntensity = 0.35 * k; }
      else mat.emissiveIntensity = 0;
    }
    majBarreDeVie(vue.barre, e.pv / e.pvMax, this.camera);
  }

  // Un monstre battu (ou entré dans le château) : il s'écrase en 0,2 seconde, puis disparaît
  sortieEnnemi(vue, t) {
    const duree = 0.2;
    if (t >= duree) return false;
    const k = t / duree;
    vue.corps.scale.set(vue.taille * (1 + k * 0.6), vue.taille * Math.max(0.05, 1 - k), vue.taille * (1 + k * 0.6));
    vue.barre.visible = false;
    vue.ombre.scale.setScalar(Math.max(0.01, 1 - k));
    return true;
  }

  creerVueTir(p) {
    let mesh;
    if (p.type === 'feu') {
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), this.brillant('#ffa23a', 1.3));
      mesh.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), this.matContourFin));
    } else if (p.type === 'glace') {
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.26, 6).rotateX(Math.PI / 2), this.toon('#dff8ff', { emissive: '#8ae0ff', emissiveIntensity: 0.6 }));
      mesh.add(new THREE.Mesh(mesh.geometry, this.matContourFin));
    } else if (p.type === 'meteore') {
      // le Météore : une grosse boule de feu, avec un cœur jaune
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), this.brillant('#ff6a2a', 1.6));
      mesh.add(new THREE.Mesh(mesh.geometry, this.matContourFin));
      const coeur = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), this.brillant('#ffe14a', 1.8));
      coeur.position.set(0.07, 0.09, 0.12);
      mesh.add(coeur);
    } else if (p.type === 'vent') {
      // un petit tourbillon : deux anneaux ouverts, blancs, qui tournent
      mesh = new THREE.Group();
      for (let i = 0; i < 2; i++) {
        const anneau = this.piece(mesh, new THREE.TorusGeometry(0.09 + i * 0.05, 0.022, 6, 16, Math.PI * 1.4).rotateX(Math.PI / 2), this.toon('#ffffff'), 0, i * 0.05, 0, { fin: true, ombre: false });
        anneau.rotation.y = i * 2.2;
      }
    } else {
      mesh = this.piece(new THREE.Group(), new THREE.DodecahedronGeometry(0.13, 0), this.toon('#8f8496'), 0, 0, 0);
      mesh.removeFromParent();
    }
    return { racine: mesh };
  }

  majVueTir(vue, p) {
    const y = this.sol(p.x, p.y) + p.z;
    const avant = vue.racine.position.clone();
    vue.racine.position.set(p.x, y, p.y);
    if (p.type === 'glace') vue.racine.lookAt(avant.lerp(vue.racine.position, 2));
    if (p.type === 'rocher') { vue.racine.rotation.x += 0.15; vue.racine.rotation.z += 0.1; }
    if (p.type === 'meteore') {
      // il tourne sur lui-même et laisse une traînée de feu
      vue.racine.rotation.x += 0.2; vue.racine.rotation.y += 0.13;
      for (let k = 0; k < 3; k++) {
        this.particules.emettre({ x: p.x + (Math.random() - 0.5) * 0.3, y: y + 0.2 + Math.random() * 0.4, z: p.y + (Math.random() - 0.5) * 0.3, vx: (Math.random() - 0.5) * 0.8, vy: 1.5 + Math.random(), vz: (Math.random() - 0.5) * 0.8, couleur: ['#ff5a1e', '#ffa83a', '#ffe14a'][k], taille: 0.14, vie: 0.35, gravite: 0, eclat: 1.4 });
      }
    }
    if (p.type === 'feu' && Math.random() < 0.7) {
      this.particules.emettre({ x: p.x, y, z: p.y, vy: 0.5, couleur: Math.random() < 0.5 ? '#ff8a1e' : '#ffd23a', taille: 0.08, vie: 0.3, gravite: 0, eclat: 1.2 });
    }
    if (p.type === 'vent') {
      vue.racine.rotation.y -= 0.35;
      if (Math.random() < 0.5) this.particules.emettre({ x: p.x, y, z: p.y, couleur: '#e4fff6', taille: 0.06, vie: 0.3, gravite: 0 });
    }
  }

  // ── Les rayons du Prisme ───────────────────────────────────
  // Un bâton lumineux tendu entre le cristal et le monstre, avec contour ; sa couleur fait
  // le tour de l'arc-en-ciel, et il grossit quand il chauffe. Un rayon par Prisme qui tire.
  majRayons(etat) {
    this.rayons ||= new Map();
    this.batonRayon ||= new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const vus = new Set(), haut = new THREE.Vector3(0, 1, 0);
    for (const tour of etat.tours) {
      const cible = tour.rayon && etat.ennemis.find((e) => e.id === tour.rayon);
      if (!cible) continue;
      let rayon = this.rayons.get(tour.id);
      if (!rayon) {
        rayon = new THREE.Mesh(this.batonRayon, new THREE.MeshBasicMaterial({ toneMapped: false }));
        rayon.add(new THREE.Mesh(this.batonRayon, this.matContourFin));
        this.scene.add(rayon);
        this.rayons.set(tour.id, rayon);
      }
      vus.add(tour.id);
      const a = new THREE.Vector3(tour.x, this.sol(tour.x, tour.y) + 1.35, tour.y);
      const b = new THREE.Vector3(cible.x, this.sol(cible.x, cible.y) + 0.45 + (MONSTRES[cible.type].volant ? HAUTEUR_VOL : 0), cible.y);
      const dir = b.clone().sub(a);
      rayon.position.copy(a).addScaledVector(dir, 0.5);
      rayon.quaternion.setFromUnitVectors(haut, dir.clone().normalize());
      const epaisseur = 0.6 + tour.chauffe * 0.9;
      rayon.scale.set(epaisseur, dir.length(), epaisseur);
      rayon.material.color.setHSL((this.temps * 0.8) % 1, 1, 0.6 + tour.chauffe * 0.25).multiplyScalar(1.3);
      if (Math.random() < 0.5) this.particules.emettre({ x: b.x, y: b.y, z: b.z, vx: (Math.random() - 0.5) * 2, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 2, couleur: '#fff4fa', taille: 0.05, vie: 0.25, eclat: 1.4 });
    }
    for (const [id, rayon] of this.rayons) {
      if (vus.has(id)) continue;
      this.scene.remove(rayon);
      rayon.material.dispose();
      this.rayons.delete(id);
    }
  }

  // ── Les éclairs d'Étincelle ────────────────────────────────
  // Un éclair = une suite de petits bâtons lumineux, avec contour, en zigzag d'un point
  // touché au suivant. On refait le zigzag plusieurs fois par seconde : il crépite.
  ajouterEclair(points) {
    const groupe = new THREE.Group();
    this.scene.add(groupe);
    // le premier point est le gardien : l'éclair part du bout de ses antennes
    const pts = points.map((q, i) => new THREE.Vector3(q.x, this.sol(q.x, q.y) + (i === 0 ? 1.3 : q.h + 0.1), q.y));
    this.eclairs.push({ groupe, pts, vie: 0.22, refaire: 0 });
  }

  majEclairs(dt) {
    this.batonEclair ||= new THREE.CylinderGeometry(0.045, 0.045, 1, 5); // un bâton de 1 de long, étiré ensuite
    this.matEclair ||= this.brillant('#ffe45a', 1.25);
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
          baton.add(new THREE.Mesh(this.batonEclair, this.matContourFin));
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
  // LA VIE AUTOUR : oiseaux, papillons, feuilles qui tombent, lucioles
  // ═══════════════════════════════════════════════════════════
  creerVie() {
    const niv = this.niveau;
    this.outilsVie = { m: new THREE.Matrix4(), q: new THREE.Quaternion(), v: new THREE.Vector3(), s: new THREE.Vector3() };
    // les oiseaux : une petite volée traverse la carte de temps en temps (le jour)
    this.oiseaux = [];
    this.prochainsOiseaux = 6;
    this.matOiseau = this.toon('#3a2a30');
    // les papillons volettent d'une fleur à l'autre (le jour)
    this.papillons = [];
    const aile = new THREE.PlaneGeometry(0.1, 0.08).translate(0.05, 0, 0).rotateX(-Math.PI / 2); // l'aile tourne autour du corps
    ['#ffffff', '#ffe14a', '#ff9ab8', '#9ad0ff', '#ffb04a'].forEach((couleur, i) => {
      const fleur = this.fleursPourPapillons[Math.floor(alea() * this.fleursPourPapillons.length)];
      if (!fleur) return;
      const objet = new THREE.Group();
      const mat = this.toon(couleur, { side: THREE.DoubleSide });
      const ailes = [1, -1].map((sens) => {
        const m = new THREE.Mesh(aile, mat);
        m.scale.x = sens; // l'aile gauche est le reflet de la droite
        objet.add(m);
        return m;
      });
      objet.position.set(fleur.x, fleur.y + 0.3, fleur.z);
      this.scene.add(objet);
      this.papillons.push({ objet, ailes, cible: null, pause: 0, phase: i * 1.7 });
    });
    // les feuilles d'automne : quelques petites feuilles qui servent et resservent
    this.arbresAutomne = this.arbresAutomne.filter((a) => a.x > -2 && a.x < niv.largeur + 2 && a.z > -2 && a.z < niv.hauteur + 2);
    this.feuilles = [];
    const geoFeuille = new THREE.PlaneGeometry(0.08, 0.06);
    for (let i = 0; i < 18; i++) {
      const objet = new THREE.Mesh(geoFeuille, this.toon(['#f29a2e', '#e8762a', '#f6bd3a'][i % 3], { side: THREE.DoubleSide }));
      objet.visible = false;
      this.scene.add(objet);
      this.feuilles.push({ objet, actif: false, vie: 0, posee: 0, sol: 0 });
    }
    this.prochaineFeuille = 0;
    // les lucioles (la nuit) : de petites boules qui clignotent, toutes dans un seul InstancedMesh
    this.lucioles = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color('#d8ff7a').multiplyScalar(1.5), toneMapped: false }), 30);
    this.lucioles.frustumCulled = false;
    this.lucioles.visible = false;
    this.positionsLucioles = Array.from({ length: 30 }, () => ({ x: alea() * niv.largeur, z: alea() * niv.hauteur, y: 0.3 + alea() * 0.8, phase: alea() * 10 }));
    this.scene.add(this.lucioles);
  }

  // Une volée de 3 à 5 oiseaux, en V, qui traverse la carte (haut dans le ciel : leur ombre passe sur le sol)
  envoyerOiseaux() {
    const niv = this.niveau, sens = Math.random() < 0.5 ? 1 : -1, z = niv.hauteur * (0.15 + Math.random() * 0.7);
    const n = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const objet = new THREE.Group();
      this.piece(objet, new THREE.SphereGeometry(0.07, 10, 8), this.matOiseau, 0, 0, 0, { fin: true }).scale.set(1, 0.8, 1.6);
      const ailes = [1, -1].map((cote) => {
        const e = new THREE.Group();
        this.piece(e, new THREE.BoxGeometry(0.22, 0.02, 0.09), this.matOiseau, cote * 0.11, 0, 0, { fin: true });
        objet.add(e);
        return e;
      });
      const rang = Math.ceil(i / 2), cote = i % 2 ? 1 : -1; // le premier devant, les autres de chaque côté
      objet.position.set(sens > 0 ? -8 - rang * 0.7 : niv.largeur + 8 + rang * 0.7, 5 + Math.random() * 0.4, z + cote * rang * 0.5);
      objet.rotation.y = sens * Math.PI / 2; // ils regardent là où ils vont
      this.scene.add(objet);
      this.oiseaux.push({ objet, ailes, vx: sens * 2.6, phase: Math.random() * 6 });
    }
  }

  majVie(dt) {
    const niv = this.niveau, jour = this.ambiance.nuit < 0.5;
    const { m, q, v, s } = this.outilsVie;
    // les oiseaux (ils planent de temps en temps)
    this.prochainsOiseaux -= dt;
    if (this.prochainsOiseaux <= 0) {
      this.prochainsOiseaux = 18 + Math.random() * 20;
      if (jour) this.envoyerOiseaux();
    }
    this.oiseaux = this.oiseaux.filter((o) => {
      o.objet.position.x += o.vx * dt;
      const battement = Math.sin(this.temps * 0.8 + o.phase) > 0.5 ? 0.15 : Math.sin(this.temps * 12 + o.phase) * 0.7;
      o.ailes[0].rotation.z = battement;
      o.ailes[1].rotation.z = -battement;
      const parti = o.vx > 0 ? o.objet.position.x > niv.largeur + 10 : o.objet.position.x < -10;
      if (parti) {
        this.scene.remove(o.objet);
        o.objet.traverse((x) => x.geometry?.dispose()); // (le matériau, lui, sert aux autres oiseaux)
      }
      return !parti;
    });
    // les papillons : ils volent jusqu'à une fleur proche, s'y posent un moment, puis repartent
    for (const pap of this.papillons) {
      pap.objet.visible = jour;
      if (!jour) continue;
      const battement = pap.pause > 0 ? 0.3 + Math.abs(Math.sin(this.temps * 2 + pap.phase)) * 0.6 : 0.2 + Math.abs(Math.sin(this.temps * 18 + pap.phase)) * 1.1;
      pap.ailes[0].rotation.z = battement;
      pap.ailes[1].rotation.z = -battement;
      if (pap.pause > 0) { pap.pause -= dt; continue; }
      if (!pap.cible) {
        const f = this.fleursPourPapillons[Math.floor(Math.random() * this.fleursPourPapillons.length)];
        if (Math.hypot(f.x - pap.objet.position.x, f.z - pap.objet.position.z) < 4) pap.cible = f;
        continue;
      }
      const p = pap.objet.position, dx = pap.cible.x - p.x, dz = pap.cible.z - p.z, dist = Math.hypot(dx, dz);
      if (dist < 0.05) { pap.cible = null; pap.pause = 1 + Math.random() * 2.5; p.y = pap.objet.userData.sol ?? p.y; continue; }
      const pas = Math.min(dist, 0.9 * dt);
      p.x += (dx / dist) * pas + Math.sin(this.temps * 9 + pap.phase) * 0.004;
      p.z += (dz / dist) * pas + Math.cos(this.temps * 7 + pap.phase) * 0.004;
      p.y = pap.cible.y + 0.04 + Math.min(1, dist) * (0.35 + Math.sin(this.temps * 5 + pap.phase) * 0.08); // il descend en arrivant
      pap.objet.rotation.y = Math.atan2(dx, dz);
    }
    // les feuilles d'automne : elles tombent en tournoyant, se posent, puis rapetissent et disparaissent
    this.prochaineFeuille -= dt * this.uVent.value;
    if (this.prochaineFeuille <= 0 && this.arbresAutomne.length && jour) {
      this.prochaineFeuille = 0.5 + Math.random() * 0.8;
      const f = this.feuilles.find((x) => !x.actif);
      if (f) {
        const a = this.arbresAutomne[Math.floor(Math.random() * this.arbresAutomne.length)];
        f.actif = true; f.vie = 0; f.posee = 0;
        f.objet.visible = true;
        f.objet.scale.setScalar(1);
        f.objet.position.set(a.x + (Math.random() - 0.5) * 0.6 * a.t, a.y + 0.1, a.z + 0.2 + (Math.random() - 0.5) * 0.5 * a.t);
        f.sol = this.sol(f.objet.position.x, f.objet.position.z) + 0.02;
      }
    }
    for (const f of this.feuilles) {
      if (!f.actif) continue;
      f.vie += dt;
      const o = f.objet;
      if (o.position.y > f.sol) {
        o.position.y = Math.max(f.sol, o.position.y - dt * 0.65);
        o.position.x += (this.uVent.value * 0.45 + Math.sin(f.vie * 3) * 0.5) * dt;
        o.rotation.set(f.vie * 3.1, f.vie * 2.3, f.vie * 1.3);
      } else {
        f.posee += dt;
        o.rotation.set(-Math.PI / 2, 0, f.vie);
        if (f.posee > 1.5) o.scale.setScalar(Math.max(0.01, 1 - (f.posee - 1.5)));
        if (f.posee > 2.5) { f.actif = false; o.visible = false; }
      }
    }
    // les lucioles (la nuit) : elles se promènent doucement et clignotent
    this.lucioles.visible = !jour;
    if (!jour) {
      this.positionsLucioles.forEach((l, i) => {
        const eclat = Math.max(0, Math.sin(this.temps * (0.9 + (i % 5) * 0.15) + l.phase));
        v.set(l.x + Math.sin(this.temps * 0.5 + l.phase) * 0.6, this.sol(l.x, l.z) + l.y + Math.sin(this.temps * 0.8 + l.phase) * 0.15, l.z + Math.cos(this.temps * 0.4 + l.phase) * 0.6);
        m.compose(v, q.identity(), s.setScalar(eclat ** 3 + 0.001));
        this.lucioles.setMatrixAt(i, m);
      });
      this.lucioles.instanceMatrix.needsUpdate = true;
    }
  }

  // ═══════════════════════════════════════════════════════════
  // EFFETS
  // ═══════════════════════════════════════════════════════════
  gerbe(x, y, z, nombre, couleurs, { force = 2, haut = 2.5, taille = 0.1, vie = 0.6, eclat = 1, gravite = -8 } = {}) {
    for (let i = 0; i < nombre; i++) {
      const a = Math.random() * Math.PI * 2, f = force * (0.3 + Math.random() * 0.7);
      this.particules.emettre({
        x, y, z, vx: Math.cos(a) * f, vy: haut * (0.4 + Math.random() * 0.8), vz: Math.sin(a) * f,
        couleur: couleurs[Math.floor(Math.random() * couleurs.length)],
        taille: taille * (0.6 + Math.random() * 0.8), vie: vie * (0.6 + Math.random() * 0.6), eclat, gravite, frein: 0.97,
      });
    }
  }

  // Un « pouf » de dessin animé : quelques boules blanches qui gonflent et disparaissent
  pouf(x, y, z, taille = 1) {
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.16 * taille, 12, 8), new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: this.degrade, transparent: true }));
      const a = (i / 6) * Math.PI * 2;
      b.position.set(x + Math.cos(a) * 0.15 * taille, y + 0.2, z + Math.sin(a) * 0.15 * taille);
      b.userData = { vx: Math.cos(a) * 0.9 * taille, vz: Math.sin(a) * 0.9 * taille, vie: 0.45 };
      this.scene.add(b);
      this.bouffees.push(b);
    }
  }

  majBouffees(dt) {
    this.bouffees = this.bouffees.filter((b) => {
      const d = b.userData;
      d.vie -= dt;
      if (d.vie <= 0) { this.scene.remove(b); b.geometry.dispose(); b.material.dispose(); return false; }
      b.position.x += d.vx * dt; b.position.z += d.vz * dt; b.position.y += dt * 0.6;
      b.scale.setScalar(1 + (0.45 - d.vie) * 3);
      b.material.opacity = Math.min(1, d.vie * 4);
      return true;
    });
  }

  traiterEvenements(evenements) {
    this.lumieres.evenements(evenements);
    for (const ev of evenements) {
      const y = this.sol(ev.x, ev.y);
      switch (ev.type) {
        case 'impact':
          if (ev.quoi === 'feu') this.gerbe(ev.x, y + 0.4, ev.y, 8, ['#ff8a1e', '#ffd23a', '#fff0a0'], { force: 1.6, haut: 1.8, taille: 0.09, vie: 0.35, eclat: 1.2 });
          else if (ev.quoi !== 'vent') this.gerbe(ev.x, y + 0.4, ev.y, 8, ['#e8fbff', '#9fe6ff', '#ffffff'], { force: 1.4, haut: 1.6, taille: 0.08, vie: 0.45 });
          break;
        case 'souffle': // une rafale : un nuage, et des filets de vent qui partent au ras du sol
          this.pouf(ev.x, y, ev.y, 0.8);
          this.gerbe(ev.x, y + 0.25, ev.y, 14, ['#ffffff', '#e4fff6', '#c4f0e0'], { force: 3.5, haut: 0.5, taille: 0.08, vie: 0.35, gravite: 0 });
          break;
        case 'eclair':
          this.ajouterEclair(ev.points);
          for (const q of ev.points.slice(1)) this.gerbe(q.x, this.sol(q.x, q.y) + q.h + 0.1, q.y, 5, ['#fff6c0', '#ffe14a', '#a8f0ff'], { force: 1.4, haut: 1.2, taille: 0.07, vie: 0.3, eclat: 1.4 });
          break;
        case 'naissance': // les petits sortent dans un nuage
          this.pouf(ev.x, y, ev.y, 1);
          this.gerbe(ev.x, y + 0.3, ev.y, 10, couleursEclats(MONSTRES[ev.quoi].apparence), { force: 1.8, haut: 3, taille: 0.1, vie: 0.6 });
          break;
        case 'carapace': // le coup ricoche sur la carapace : deux étincelles grises
          this.gerbe(ev.x, y + 0.35, ev.y, 2, ['#ffffff', '#c8ccd4'], { force: 1.5, haut: 1.2, taille: 0.05, vie: 0.2, eclat: 1.3 });
          break;
        case 'plonge':
        case 'surgit': // la Taupe plonge ou ressort : de la terre qui vole
          this.gerbe(ev.x, y + 0.1, ev.y, 10, ['#8a6440', '#a07a50', '#5a3e26'], { force: 1.6, haut: 2.2, taille: 0.09, vie: 0.5 });
          break;
        case 'recolte': // la Pépite rapporte sa récolte : des pièces d'or qui jaillissent
          this.gerbe(ev.x, y + 0.9, ev.y, 12, ['#ffd24a', '#fff4b0', '#e8a820'], { force: 0.8, haut: 3.5, taille: 0.08, vie: 0.9, eclat: 1.3, gravite: -5 });
          break;
        case 'flamme': { // le Dragon crache du feu sur un gardien
          const depart = new THREE.Vector3(ev.x, y + HAUTEUR_VOL + 1.4, ev.y), arrivee = new THREE.Vector3(ev.vers.x, this.sol(ev.vers.x, ev.vers.y) + 0.7, ev.vers.y);
          for (let k = 0; k < 24; k++) {
            const p = depart.clone().lerp(arrivee, k / 23);
            this.particules.emettre({ x: p.x, y: p.y, z: p.z, vx: (Math.random() - 0.5) * 1.5, vy: Math.random() * 1.5, vz: (Math.random() - 0.5) * 1.5, couleur: ['#ff5a1e', '#ffa83a', '#ffe14a'][k % 3], taille: 0.12, vie: 0.25 + (k / 23) * 0.4, gravite: 0, eclat: 1.3 });
          }
          this.pouf(ev.vers.x, arrivee.y - 0.4, ev.vers.y, 0.8);
          break;
        }
        case 'explosion':
          if (ev.quoi === 'meteore') {
            // le Météore s'écrase : une gerbe de feu, des cailloux, un gros nuage, et la caméra tremble
            this.gerbe(ev.x, y + 0.2, ev.y, 44, ['#ff5a1e', '#ff9a2a', '#ffd23a', '#fff0a0'], { force: 4.2, haut: 4.5, taille: 0.15, vie: 0.9, eclat: 1.5 });
            this.gerbe(ev.x, y + 0.1, ev.y, 16, ['#5a4a52', '#8f8496', '#3a2e34'], { force: 3.2, haut: 3.6, taille: 0.14, vie: 1 });
            this.pouf(ev.x, y, ev.y, 2.4);
            this.secousse = Math.max(this.secousse, 0.4);
            break;
          }
          this.gerbe(ev.x, y + 0.1, ev.y, 20, ['#8f8496', '#6e6478', '#b8acc0'], { force: 3, haut: 3.4, taille: 0.13, vie: 0.8 });
          this.pouf(ev.x, y, ev.y, 1.3);
          this.secousse = Math.max(this.secousse, 0.1);
          break;
        case 'mort': {
          // les éclats ont les couleurs du monstre ; plus il est gros, plus ça fait « pouf »
          const fiche = MONSTRES[ev.quoi];
          const gros = fiche.boss ? 3 : fiche.pv >= 200 ? 2 : 1;
          const h = fiche.volant ? HAUTEUR_VOL : 0;
          this.gerbe(ev.x, y + 0.3 + h, ev.y, [12, 22, 60][gros - 1], couleursEclats(fiche.apparence), { force: fiche.boss ? 3.8 : 2.2, haut: 3, taille: 0.12, vie: 0.7 });
          this.pouf(ev.x, y + h, ev.y, [0.9, 1.4, 2.6][gros - 1]);
          this.gerbe(ev.x, y + 0.5 + h, ev.y, 5 * gros, ['#ffd24a', '#fff2a0'], { force: 0.6, haut: 2.8, taille: 0.08, vie: 0.6, eclat: 1.3, gravite: -4 });
          if (fiche.boss) this.secousse = 0.5;
          break;
        }
        case 'construction':
          this.pouf(ev.x, y + 0.1, ev.y, 1.4);
          this.gerbe(ev.x, y + 0.6, ev.y, 10, ['#ffd24a', '#fff4c0'], { force: 1.2, haut: 3, taille: 0.07, vie: 0.8, eclat: 1.3, gravite: -3 });
          break;
        case 'amelioration': // un nuage, puis une fontaine d'étincelles dorées
          this.pouf(ev.x, y + 0.1, ev.y, 1.2);
          this.gerbe(ev.x, y + 0.6, ev.y, 22, ['#ffd24a', '#fff4c0', '#ffffff'], { force: 1.1, haut: 4.2, taille: 0.08, vie: 1, eclat: 1.4, gravite: -2 });
          break;
        case 'vente':
          this.pouf(ev.x, y + 0.1, ev.y, 1.2);
          break;
        case 'frappe': // le héros frappe le sol : un nuage de poussière tout autour, et ça tremble un peu
          this.pouf(ev.x, y, ev.y, 1.4);
          this.gerbe(ev.x, y + 0.1, ev.y, 14, ['#d8c8b0', '#b8a890', '#fff4d0'], { force: 2.6, haut: 1.2, taille: 0.1, vie: 0.5 });
          this.secousse = Math.max(this.secousse, 0.06);
          break;
        case 'herosNiveau': // le héros gagne un niveau : une fontaine d'étincelles dorées
          this.gerbe(ev.x, y + 1, ev.y, 30, ['#ffd24a', '#fff4c0', '#ffffff'], { force: 1.2, haut: 4.5, taille: 0.09, vie: 1.1, eclat: 1.4, gravite: -2 });
          break;
        case 'ondeDeChoc': // l'Onde de choc : un grand nuage de poussière en cercle, et ça tremble fort
          this.pouf(ev.x, y, ev.y, 2.4);
          this.gerbe(ev.x, y + 0.1, ev.y, 34, ['#d8c8b0', '#b8a890', '#fff4d0', '#ffcf3a'], { force: 4.5, haut: 1.6, taille: 0.12, vie: 0.7 });
          this.secousse = Math.max(this.secousse, 0.2);
          break;
        case 'bond': // le héros saute : un petit nuage là où il décolle
          this.pouf(ev.depart.x, this.sol(ev.depart.x, ev.depart.y), ev.depart.y, 1);
          break;
        case 'atterrissage': // il retombe : un nuage de poussière tout autour, et ça tremble
          this.pouf(ev.x, y, ev.y, 1.8);
          this.gerbe(ev.x, y + 0.1, ev.y, 20, ['#d8c8b0', '#b8a890', '#fff4d0'], { force: 3.2, haut: 1.4, taille: 0.1, vie: 0.6 });
          this.secousse = Math.max(this.secousse, 0.14);
          break;
        case 'herosKO': // le héros tombe K.O. : un petit nuage gris et des étoiles
          this.gerbe(ev.x, y + 0.8, ev.y, 18, ['#9a9aa8', '#d8d8e0', '#ffe14a'], { force: 1.4, haut: 2.4, taille: 0.08, vie: 0.8 });
          break;
        case 'herosDebout': // il se relève : des étincelles dorées
          this.gerbe(ev.x, y + 1, ev.y, 24, ['#ffd24a', '#fff4c0', '#ffffff'], { force: 1.2, haut: 4, taille: 0.09, vie: 1, eclat: 1.4, gravite: -2 });
          break;
        case 'nouveauSocle': // un nouveau socle sort de terre : un nuage et des étincelles dorées
          this.pouf(ev.x, y + 0.1, ev.y, 1.6);
          this.gerbe(ev.x, y + 0.5, ev.y, 24, ['#ffd24a', '#fff4c0', '#ffffff'], { force: 1.3, haut: 4.2, taille: 0.08, vie: 1, eclat: 1.4, gravite: -2 });
          break;

        case 'fuite':
          this.gerbe(ev.x, y + 0.5, ev.y, 30, ['#ff4a3a', '#ff9a8a', '#2a1a1a'], { force: 3, haut: 4, taille: 0.14, vie: 1.2 });
          this.secousse = 0.4;
          break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════
  // CAMÉRA + API
  // ═══════════════════════════════════════════════════════════
  cadrer() {
    const angle = THREE.MathUtils.degToRad(57);
    const { largeur, hauteur, chateau: c } = this.niveau;
    this.cible = new THREE.Vector3(largeur / 2, 0, hauteur / 2 + 0.2);
    this.dirCamera = new THREE.Vector3(0, Math.sin(angle), Math.cos(angle));
    this.camera.position.copy(this.cible).addScaledVector(this.dirCamera, 80);
    this.camera.lookAt(this.cible);
    this.camera.updateMatrixWorld();
    // On mesure la carte vue depuis la caméra, puis on règle le cadre pour qu'elle tienne
    const points = [[-0.3, 0, -0.3], [largeur + 0.3, 0, -0.3], [-0.3, 0, hauteur + 0.3], [largeur + 0.3, 0, hauteur + 0.3],
      [c.x + 2.1, 3.5, c.y], [c.x + 2.1, 0, c.y - 2.5], [c.x + 2.1, 0, c.y + 2.7]]
      .map(([x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(this.camera.matrixWorldInverse));
    let demiL = Math.max(...points.map((p) => Math.abs(p.x)));
    // de la place pour les barres du haut et du bas (sauf sur un téléphone couché : voir cadre.js)
    let demiH = Math.max(...points.map((p) => Math.abs(p.y))) / (CADRE.plein ? 0.97 : 0.86);
    const ratio = this.largeur / this.hauteur;
    if (demiL / demiH > ratio) demiH = demiL / ratio; else demiL = demiH * ratio;
    Object.assign(this.camera, { left: -demiL, right: demiL, top: demiH, bottom: -demiH });
    this.camera.updateProjectionMatrix();
  }

  dessiner(etat, dtJeu, dtReel, ui) {
    if (etat !== this.partie) {
      this.partie = etat;
      this.vuesTours.vider(); this.vuesEnnemis.vider(); this.vuesTirs.vider();
      this.particules.vider();
      this.majEclairs(Infinity); // les éclairs de la partie d'avant disparaissent
    }
    this.temps += dtReel;
    this.dtReel = dtReel;
    this.uTemps.value = this.temps;
    this.secousse = Math.max(0, this.secousse - dtReel);
    // une vague vient d'être repoussée : les gardiens vont sauter de joie
    if (this.statutAvant === 'vague' && etat.statut === 'preparation') this.joie = 1;
    this.statutAvant = etat.statut;
    this.joie = Math.max(0, (this.joie || 0) - dtReel * 1.1);
    this.majTerreSocles(etat);
    this.traiterEvenements(etat.evenements);
    if (etat.evenements.some((ev) => ev.type === 'benediction')) {
      // une bénédiction : une fontaine d'étincelles dorées sur chaque gardien
      for (const t of etat.tours) this.gerbe(t.x, this.sol(t.x, t.y) + 0.8, t.y, 16, ['#ffd24a', '#fff4c0', '#ffffff'], { force: 1, haut: 4, taille: 0.08, vie: 1, eclat: 1.4, gravite: -2 });
    }
    if (etat.evenements.some((ev) => ev.type === 'grandFroid')) {
      // le Grand froid : une bouffée de flocons sur chaque monstre gelé
      for (const e of etat.ennemis) {
        if (e.gele > 0) this.gerbe(e.x, this.sol(e.x, e.y) + 0.5, e.y, 8, ['#ffffff', '#dff6ff', '#9fe0ff'], { force: 1.2, haut: 2.2, taille: 0.08, vie: 0.8 });
      }
    }
    this.vuesTours.appliquer(etat.tours);
    this.vuesEnnemis.appliquer(etat.ennemis);
    this.vuesEnnemis.majSortants(dtReel);
    this.vuesTirs.appliquer(etat.projectiles);
    this.majHeros(etat, ui);
    this.particules.maj(dtJeu || 0);
    this.majBouffees(dtJeu || 0);
    this.majEclairs(dtReel);
    this.majRayons(etat);
    // les lumières du jeu : la liste du moment, peinte dans la carte des lumières
    this.lumieres.maj(dtReel);
    this.carte.dessiner(this.lumieres.liste(etat, this.ambiance.nuit), 1);

    const occupes = new Set(etat.tours.map((t) => t.socle));
    this.socles.forEach((s, i) => {
      // un socle bonus n'existe qu'une fois débloqué (bénédiction « Nouveau socle ») : il sort alors
      // de terre avec un petit « pop » élastique
      const existe = socleActif(etat, i);
      s.groupe.visible = existe && !this.masques.has('socle:' + i);
      if (!existe) { s.apparition = 0; return; }
      if (s.apparition !== undefined && s.apparition < 1) {
        s.apparition = Math.min(1, s.apparition + dtReel * 2.5);
        const a = s.apparition;
        s.groupe.scale.setScalar(1 - Math.cos(a * Math.PI * 2.5) * Math.pow(1 - a, 2));
      }
      const actif = i === ui.survol || i === ui.selection;
      s.base.material.emissiveIntensity += ((actif ? 0.5 : 0) - s.base.material.emissiveIntensity) * 0.3;
      s.plus.visible = !occupes.has(i);
      s.plus.position.y = 0.75 + Math.sin(this.temps * 2.5 + i) * 0.06;
      s.plus.rotation.y = Math.sin(this.temps * 1.5 + i) * 0.5;
      s.plus.scale.setScalar(actif ? 1.25 : 1);
    });
    // cercle de portée (ui.apercuPortee : pendant qu'on survole « Améliorer », la portée du niveau suivant ;
    // sur un socle vide, celle du gardien qu'on regarde dans la roue, au doigt)
    const iPortee = ui.selection >= 0 ? ui.selection : ui.survol;
    const tour = etat.tours.find((t) => t.socle === iPortee);
    const ici = tour || (ui.apercuPortee && this.niveau.socles[iPortee]);
    const r = tour ? ui.apercuPortee ?? ficheDe(etat, tour.type, tour.niveau).portee : ici ? ui.apercuPortee : 0; // (avec les bénédictions)
    this.anneau.visible = r > 0; // (un gardien qui ne tire pas, comme la Pépite, n'a pas de cercle)
    if (r > 0) {
      this.anneau.scale.set(r, 1, r);
      this.anneau.position.set(ici.x, this.sol(ici.x, ici.y) + 0.06, ici.y);
    }
    // le héros choisi : la portée de sa frappe
    if (ui.herosChoisi && etat.heros) {
      const rh = ficheDuHeros(etat).rayon, h = etat.heros;
      this.anneau.visible = true;
      this.anneau.scale.set(rh, 1, rh);
      this.anneau.position.set(h.x, this.sol(h.x, h.y) + 0.06, h.y);
    }

    // le cercle du Météore : pendant qu'on vise (orange), puis pendant sa chute (rouge, qui clignote)
    const meteore = etat.projectiles.find((t) => t.type === 'meteore');
    const visee = ui.viseeMeteore || (meteore && { x: meteore.x, y: meteore.y, rayon: meteore.rayon });
    this.anneauMeteore.visible = Boolean(visee) && (!meteore || Math.floor(this.temps * 10) % 2 === 1);
    if (visee) {
      this.anneauMeteore.scale.set(visee.rayon, 1, visee.rayon);
      this.anneauMeteore.position.set(visee.x, this.sol(visee.x, visee.y) + 0.07, visee.y);
      this.anneauMeteore.userData.trait.material.color.set(meteore ? '#ff5a3a' : '#ffb46a');
    }
    // le cercle du Bond du héros, pendant qu'on vise (doré)
    this.anneauBond.visible = Boolean(ui.viseeBond);
    if (ui.viseeBond) {
      this.anneauBond.scale.set(ui.viseeBond.rayon, 1, ui.viseeBond.rayon);
      this.anneauBond.position.set(ui.viseeBond.x, this.sol(ui.viseeBond.x, ui.viseeBond.y) + 0.07, ui.viseeBond.y);
    }

    // drapeaux qui ondulent (on déforme les sommets du plan)
    for (const d of this.drapeaux) {
      const pos = d.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setZ(i, Math.sin(this.temps * 6 - x * 9) * 0.05 * (x / 0.42));
      }
      pos.needsUpdate = true;
    }
    for (const moulin of this.moulins) moulin.ailes.rotation.z -= dtReel * moulin.vitesse * (0.4 + this.uVent.value);
    for (const n of this.nenuphars) {
      n.position.y = -0.075 + Math.sin(this.temps * 1.6 + n.userData.phase) * 0.008;
      n.rotation.y += dtReel * 0.05;
    }
    this.majVie(dtReel);

    // petite secousse de caméra
    this.camera.position.copy(this.cible).addScaledVector(this.dirCamera, 80);
    if (this.secousse > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.secousse;
      this.camera.position.z += (Math.random() - 0.5) * this.secousse;
    }
    this.camera.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  socleSous(px, py) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    // (pas les socles bonus encore endormis)
    const existe = (i) => !this.partie || socleActif(this.partie, i);
    const touche = this.raycaster.intersectObjects(this.socles.filter((s, i) => existe(i)).map((s) => s.zone), false)[0];
    if (touche) return touche.object.userData.index;
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.25), p)) return -1;
    const i = socleProche(this.niveau.socles, p.x, p.z, 0.7);
    return i >= 0 && existe(i) ? i : -1;
  }

  // Le point du sol (en cases) sous un point de l'écran (pour viser le Météore)
  versSol(px, py) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const p = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p)) return null;
    return { x: p.x, y: p.z };
  }

  versEcran(x, y, hauteur = 0) {
    const p = new THREE.Vector3(x, this.sol(x, y) + hauteur, y).project(this.camera);
    const r = this.renderer.domElement.getBoundingClientRect();
    return { x: r.left + (p.x * 0.5 + 0.5) * r.width, y: r.top + (-p.y * 0.5 + 0.5) * r.height };
  }

  redimensionner() {
    this.largeur = this.conteneur.clientWidth || innerWidth;
    this.hauteur = this.conteneur.clientHeight || innerHeight;
    this.renderer.setSize(this.largeur, this.hauteur);
    this.cadrer();
  }

  // Les apparences ont changé (dans l'atelier des modèles) : chaque personnage sera refabriqué au
  // prochain dessin (les gardiens et les monstres, en repartant de zéro côté affichage ; le héros aussi)
  oublierPersonnages() {
    this.partie = null;
    if (this.vueHeros) {
      for (const objet of [this.vueHeros.racine, this.anneauHeros, this.marqueHeros]) { this.scene.remove(objet); liberer(objet); }
      this.vueHeros = null;
    }
  }

  detruire() {
    this.appareilPhoto?.dispose();
    this.carte.dispose();
    liberer(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
