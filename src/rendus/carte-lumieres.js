// ─────────────────────────────────────────────────────────────
// LA CARTE DES LUMIÈRES (pour les deux styles 3D)
// Three.js sait éclairer avec des lampes (« PointLight »), mais chacune coûte
// cher : chaque pixel de l'écran refait le calcul pour chaque lampe. Avec dix
// lanternes, des boules de feu et des explosions, tout ralentirait.
//
// L'astuce, puisqu'on regarde la carte d'en haut : on peint toutes les lumières
// (la liste de lumieres.js) comme des taches de couleur dans une petite image
// qui couvre la carte, vue de dessus. Chaque matériau « branché » ajoute à sa
// couleur la lumière de cette image, à l'endroit où il se trouve. Une seule
// lecture d'image par pixel, quel que soit le nombre de lumières.
//
// Les taches s'additionnent, mais une image ne dépasse jamais le blanc : même
// vingt lumières au même endroit ne peuvent pas éblouir.
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

export class CarteDesLumieres {
  // parCase : la finesse de l'image (pixels par case) ; marge : la carte déborde un peu autour du niveau
  constructor(niveau, { parCase = 8, marge = 6 } = {}) {
    this.x0 = -marge;
    this.z0 = -marge;
    this.largeur = niveau.largeur + marge * 2;
    this.profondeur = niveau.hauteur + marge * 2;
    this.parCase = parCase;
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.ceil(this.largeur * parCase);
    this.canvas.height = Math.ceil(this.profondeur * parCase);
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.NoColorSpace; // ce sont des quantités de lumière, pas des couleurs à afficher
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.generateMipmaps = false;
    // Three.js retourne d'habitude les images d'un canvas de haut en bas (comme une photo) ;
    // ici, la première ligne du canvas est le haut de la carte (z le plus petit) : pas de retournement
    this.texture.flipY = false;
    // ce que les matériaux branchés reçoivent (les mêmes objets pour tous : changer une valeur les change tous)
    this.uniforms = {
      uCarteLumieres: { value: this.texture },
      uCarteZone: { value: new THREE.Vector4(this.x0, this.z0, 1 / this.largeur, 1 / this.profondeur) },
      uCarteForce: { value: 1 },
    };
  }

  // Peint les lumières. force : à quel point l'ambiance les montre (presque rien à midi, tout la nuit)
  dessiner(lumieres, force) {
    const c = this.ctx, k = this.parCase;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#000';
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.globalCompositeOperation = 'lighter'; // les lumières s'additionnent
    for (const l of lumieres) {
      const f = Math.min(1, l.force * force);
      if (f < 0.02) continue;
      const x = (l.x - this.x0) * k, y = (l.y - this.z0) * k, r = l.rayon * k;
      const [R, G, B] = l.couleur.map((v) => Math.round(v * 255));
      // forte au centre, puis elle s'éteint vite : une flaque de lumière, pas un disque plat
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${R},${G},${B},${f})`);
      g.addColorStop(0.3, `rgba(${R},${G},${B},${f * 0.55})`);
      g.addColorStop(0.65, `rgba(${R},${G},${B},${f * 0.18})`);
      g.addColorStop(1, `rgba(${R},${G},${B},0)`);
      c.fillStyle = g;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.texture.needsUpdate = true;
  }

  // Branche un matériau sur la carte : on modifie son programme (son « shader ») juste avant
  // qu'il soit fabriqué. paliers : en cartoon, la lumière en aplats (3 paliers, comme le reste
  // du dessin) ; 0 = en dégradé. Plus haut que 1 au-dessus du sol, la lumière faiblit (les
  // lanternes éclairent le bas des arbres, pas leur cime).
  brancher(materiau, { paliers = 0 } = {}) {
    const avant = materiau.onBeforeCompile;
    // Three.js range les programmes déjà fabriqués sous une « clé » : on garde celle d'avant (elle dit
    // déjà ce qu'un autre réglage a changé), et on ajoute la nôtre
    const cleAvant = materiau.customProgramCacheKey();
    materiau.onBeforeCompile = (shader, renderer) => {
      avant?.call(materiau, shader, renderer); // un autre réglage était déjà branché (le vent…) : on le garde
      Object.assign(shader.uniforms, this.uniforms);
      // le sommet : on note sa place dans le monde (avec celle de son exemplaire, pour un InstancedMesh)
      shader.vertexShader = 'varying vec3 vPgMonde;\n' + shader.vertexShader.replace('#include <begin_vertex>', /* glsl */ `#include <begin_vertex>
        {
          vec4 pgMonde = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            pgMonde = instanceMatrix * pgMonde;
          #endif
          vPgMonde = (modelMatrix * pgMonde).xyz;
        }`);
      // le pixel : on lit la carte à sa place, et on ajoute cette lumière à sa couleur
      shader.fragmentShader = 'uniform sampler2D uCarteLumieres;\nuniform vec4 uCarteZone;\nuniform float uCarteForce;\nvarying vec3 vPgMonde;\n'
        + shader.fragmentShader.replace('#include <emissivemap_fragment>', /* glsl */ `#include <emissivemap_fragment>
        {
          vec2 uvCarte = (vPgMonde.xz - uCarteZone.xy) * uCarteZone.zw;
          vec3 lumiere = texture2D(uCarteLumieres, clamp(uvCarte, 0.0, 1.0)).rgb;
          ${paliers ? `
          // en paliers : on découpe la force de la lumière (pas chaque couleur à part, sinon
          // la teinte changerait d'un palier à l'autre), et on garde sa couleur
          float pgForce = max(max(lumiere.r, lumiere.g), lumiere.b);
          lumiere *= (floor(pgForce * ${paliers.toFixed(1)} + 0.35) / ${paliers.toFixed(1)}) / max(pgForce, 0.0001);` : ''}
          float hauteur = clamp(1.0 - max(0.0, vPgMonde.y - 1.0) / 3.0, 0.0, 1.0);
          // la lumière éclaire la couleur de la surface, et ajoute un peu de la sienne
          // (sinon, la lumière orangée d'une lanterne sur de l'herbe verte donnerait du vert-jaune)
          totalEmissiveRadiance += (diffuseColor.rgb + 0.14) * lumiere * uCarteForce * hauteur;
        }`);
    };
    materiau.customProgramCacheKey = () => `${cleAvant}|carte${paliers}`;
    materiau.needsUpdate = true;
    return materiau;
  }

  dispose() {
    this.texture.dispose();
  }
}
