// ─────────────────────────────────────────────────────────────
// LES RECETTES PEINTES (le sol du style cartoon)
// Le sol du style cartoon n'est pas fait de petits carrés de 16 × 16 pixels,
// comme celui du voxel et du pixel art (voir recettes.js) : c'est une grande
// toile peinte au pinceau. Elle est peinte, elle aussi, d'après des recettes
// (src/rendus/textures.json, partie « cartoon ») :
// - des RAMPES : des listes de couleurs ;
// - des COUCHES, des coups de pinceau posés l'un après l'autre : un aplat,
//   des taches, des touffes d'herbe, des cailloux avec leur ombre…
//
// Chaque matière (l'herbe, le chemin, la terre des socles, la berge des
// étangs, la cour du château) a une FORME, donnée par le niveau : le chemin
// suit sa ligne, la terre fait un disque sous chaque socle… Une couche peint
// « jusqu'à une certaine distance » de cette forme : la moitié de la largeur
// du chemin, le rayon du disque… Son bord peut onduler, comme tracé à la main.
//
// Tout se mesure en cases (une case du jeu = 1), jamais en pixels : la même
// recette donne la même image en petit (dans l'atelier) et en grand (dans le
// jeu). Et le hasard vient de la place des choses dans le monde : repeindre
// un petit morceau de la toile donne exactement la même chose que repeindre
// toute la toile.
//
// Ce fichier ne connaît ni Three.js ni le navigateur : il remplit un tableau
// de pixels (rouge, vert, bleu, opacité). Le style cartoon en fait la texture
// de son sol ; l'atelier des textures (textures.html) le montre et le mesure.
// ─────────────────────────────────────────────────────────────
import { creerAleatoire } from '../jeu/aleatoire.js';
import { graine, enRVB, clarte } from './recettes.js';

const lisser = (t) => t * t * (3 - 2 * t);
const LOIN = 1e9; // « très loin de la forme » : rien n'y est peint
// Une recette ne peint jamais à plus de 3,6 cases de sa forme (3 cases de largeur au plus, 0,5
// d'ondulation, et un peu de marge) : les distances ne sont calculées que près de la forme
const PORTEE = 3.6;

// « Hachage » de trois nombres entiers → un nombre entre 0 et 1, toujours le même
function hacher(a, b, c) {
  let h = Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// La toile : un tableau de pixels qui couvre le monde de (x0, z0) à (x0 + largeur / ppc,
// z0 + hauteur / ppc) ; ppc : combien de pixels par case. Le pixel (i, j) a son centre en
// x = x0 + (i + 0,5) / ppc, z = z0 + (j + 0,5) / ppc. (z, comme dans le monde 3D : vers le bas de l'écran.)
export function creerToile(largeur, hauteur, ppc, x0 = 0, z0 = 0) {
  return { largeur, hauteur, ppc, x0, z0, pixels: new Uint8ClampedArray(largeur * hauteur * 4) };
}

// Pose une couleur sur un pixel avec une opacité a (de 0 à 1), comme un coup de pinceau un peu
// transparent. Sur un pixel encore vide (transparent), la couleur est posée telle quelle.
function poser(px, k, couleur, a) {
  if (a <= 0) return;
  const r = couleur[0], g = couleur[1], b = couleur[2]; // (sans « [r, g, b] » dans les paramètres : bien plus rapide, ici appelé des millions de fois)
  if (a >= 1) { px[k] = r; px[k + 1] = g; px[k + 2] = b; px[k + 3] = 255; return; }
  const fond = px[k + 3] / 255;
  const total = a + fond * (1 - a);         // l'opacité du résultat
  const avant = (fond * (1 - a)) / total;   // la part de la couleur d'avant
  px[k] = r + (px[k] - r) * avant;
  px[k + 1] = g + (px[k + 1] - g) * avant;
  px[k + 2] = b + (px[k + 2] - b) * avant;
  px[k + 3] = total * 255;
}
const teinte = ([r, g, b], f) => [r * f, g * f, b * f];

// ═════════════════════════════════════════════════════════════
// LE BRUIT : des bosses douces, pour les taches et les bords qui ondulent
// Des valeurs au hasard aux coins d'une grille (une grille de « taille » cases), mélangées en
// douceur entre les coins. La valeur d'un coin vient de sa place : le même endroit du monde a
// toujours la même valeur. Pour aller vite, les coins qui couvrent le morceau de toile peint sont
// calculés une fois pour toutes (ceux d'à côté, pour un objet qui déborde, sont calculés à la demande).
// ═════════════════════════════════════════════════════════════
function bruitDirect(g, taille, x, z) {
  const gx = x / taille, gz = z / taille, ix = Math.floor(gx), iz = Math.floor(gz);
  const fx = lisser(gx - ix), fz = lisser(gz - iz);
  const a = hacher(ix, iz, g), b = hacher(ix + 1, iz, g), c = hacher(ix, iz + 1, g), d = hacher(ix + 1, iz + 1, g);
  return a + (b - a) * fx + (c - a + (a - b + d - c) * fx) * fz;
}
function bruitSurRectangle(g, taille, [wx0, wz0, wx1, wz1]) {
  const gx0 = Math.floor(wx0 / taille) - 1, gz0 = Math.floor(wz0 / taille) - 1;
  const nx = Math.floor(wx1 / taille) - gx0 + 3, nz = Math.floor(wz1 / taille) - gz0 + 3;
  const coins = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) coins[j * nx + i] = hacher(gx0 + i, gz0 + j, g);
  return (x, z) => {
    const gx = x / taille - gx0, gz = z / taille - gz0, ix = Math.floor(gx), iz = Math.floor(gz);
    if (ix < 0 || iz < 0 || ix >= nx - 1 || iz >= nz - 1) return bruitDirect(g, taille, x, z);
    const fx = lisser(gx - ix), fz = lisser(gz - iz), k = iz * nx + ix;
    const a = coins[k], b = coins[k + 1], c = coins[k + nx], d = coins[k + nx + 1];
    return a + (b - a) * fx + (c - a + (a - b + d - c) * fx) * fz;
  };
}
// Deux bruits l'un sur l'autre : de grandes bosses, plus des détails 2,3 fois plus petits. Les bords
// des taches ne sont plus tout ronds. (Le résultat va de 0 à 1, le plus souvent autour de 0,5.)
function bruitDouble(g, taille, rectangle) {
  const grand = bruitSurRectangle(g, taille, rectangle), petit = bruitSurRectangle(g + 7919, taille / 2.3, rectangle);
  return (x, z) => 0.68 * grand(x, z) + 0.32 * petit(x, z);
}

// ═════════════════════════════════════════════════════════════
// LES FORMES : où se trouve chaque matière
// Une forme sait dire à quelle distance (en cases) un point se trouve de son « squelette » : la
// ligne du milieu du chemin, le centre d'un socle, le bord de l'eau d'un étang (négatif dans l'eau),
// le bord de la cour (négatif dedans). Elle est faite de morceaux (les segments du chemin, les
// socles…), chacun avec sa boîte : la distance n'est calculée que près d'eux.
// ═════════════════════════════════════════════════════════════
function parMorceaux(morceaux) {
  if (!morceaux.length) return { vide: true, distance: () => LOIN };
  return {
    // le rectangle (en cases) qui contient tous les morceaux
    squelette: [
      Math.min(...morceaux.map((m) => m.x0)), Math.min(...morceaux.map((m) => m.z0)),
      Math.max(...morceaux.map((m) => m.x1)), Math.max(...morceaux.map((m) => m.z1)),
    ],
    distance(x, z) {
      let d = LOIN;
      for (const m of morceaux) d = Math.min(d, m.distance(x, z));
      return d;
    },
    // La distance de chaque pixel du rectangle [i0, j0, i1, j1] de la toile, rangée dans champ
    // (déjà rempli de LOIN) : morceau par morceau, seulement les pixels à moins de « marge » cases
    // de sa boîte (plus loin, aucune couche ne peint)
    remplir(champ, { ppc, x0, z0 }, [i0, j0, i1, j1], marge) {
      const l = i1 - i0;
      for (const m of morceaux) {
        const a = Math.max(i0, Math.floor((m.x0 - marge - x0) * ppc)), b = Math.min(i1, Math.ceil((m.x1 + marge - x0) * ppc));
        const c = Math.max(j0, Math.floor((m.z0 - marge - z0) * ppc)), d = Math.min(j1, Math.ceil((m.z1 + marge - z0) * ppc));
        for (let j = c; j < d; j++) {
          const z = z0 + (j + 0.5) / ppc;
          for (let i = a, k = (j - j0) * l + (a - i0); i < b; i++, k++) {
            const v = m.distance(x0 + (i + 0.5) / ppc, z);
            if (v < champ[k]) champ[k] = v;
          }
        }
      }
    },
  };
}

export const FORMES = {
  // l'herbe : partout (la distance est « moins l'infini » : on est toujours dedans)
  partout: () => ({ partout: true, distance: () => -Infinity }),
  // le chemin : une ligne brisée ([{ x, y }…], comme niveau.cheminVisuel) ; la distance à sa ligne du milieu
  chemin(points) {
    const morceaux = [];
    for (let n = 1; n < points.length; n++) {
      const a = points[n - 1], b = points[n], dx = b.x - a.x, dz = b.y - a.y, l2 = dx * dx + dz * dz || 1;
      morceaux.push({
        x0: Math.min(a.x, b.x), z0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), z1: Math.max(a.y, b.y),
        distance(x, z) {
          const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.y) * dz) / l2)); // le point du segment le plus proche
          return Math.hypot(x - a.x - dx * t, z - a.y - dz * t);
        },
      });
    }
    return parMorceaux(morceaux);
  },
  // des disques ([{ x, y }…], comme les socles) : la distance au centre du plus proche. Avec une
  // échelle de 0,85, tous les rayons de la recette sont 0,85 fois plus petits.
  disques: (centres, echelle = 1) => parMorceaux(centres.map((c) => ({
    x0: c.x, z0: c.y, x1: c.x, z1: c.y, distance: (x, z) => Math.hypot(x - c.x, z - c.y) / echelle,
  }))),
  // des étangs ([{ x, y, rayon }…]) : la distance au bord de l'eau (négative dans l'eau)
  etangs: (etangs) => parMorceaux(etangs.map((e) => ({
    x0: e.x - e.rayon, z0: e.y - e.rayon, x1: e.x + e.rayon, z1: e.y + e.rayon, distance: (x, z) => Math.hypot(x - e.x, z - e.y) - e.rayon,
  }))),
  // un rectangle (la cour) : la distance à son bord (négative dedans)
  rectangle(xa, za, xb, zb) {
    const cx = (xa + xb) / 2, cz = (za + zb) / 2, demiX = (xb - xa) / 2, demiZ = (zb - za) / 2;
    return parMorceaux([{
      x0: xa, z0: za, x1: xb, z1: zb,
      distance(x, z) {
        const qx = Math.abs(x - cx) - demiX, qz = Math.abs(z - cz) - demiZ;
        return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0);
      },
    }]);
  },
};

// ═════════════════════════════════════════════════════════════
// LES SORTES DE COUCHES (les pinceaux)
// Pour chacune : son nom dans l'atelier, une aide, ses réglages (« rampe » : le nom d'une rampe ;
// [min, max, pas] : un curseur ; les longueurs sont en cases), les réglages d'une couche toute
// neuve, jusqu'où elle peut peindre autour de la forme (son étendue, en cases), et ce qu'elle peint.
// « largeur » : jusqu'à quelle distance de la forme on peint (pour l'herbe, qui est partout, ça ne change rien).
// Les outils o : o.rampe(nom) (ses couleurs), o.chaquePixel(fonction), o.poser(k, couleur, opacité),
// o.teinter(k, facteur), o.ondulation(amplitude, taille), o.bruit(taille), o.semer(…), o.distance(x, z),
// et pour dessiner un objet : o.disque, o.trait, o.ovale (voir peindreMatiere).
// ═════════════════════════════════════════════════════════════
const BORNE_LARGEUR = [-1, 3, 0.01];

export const PINCEAUX = {
  aplat: {
    nom: 'Aplat',
    aide: 'Une couleur (la première de la rampe) posée jusqu’à « largeur » cases de la forme : la moitié de la largeur du chemin, le rayon d’un disque… « Ondulation » fait onduler le bord, comme tracé à la main ; « taille » : la taille des ondulations. Deux aplats d’une même matière qui ondulent pareil (même ondulation, même taille) gardent des bords parallèles : une bordure toujours aussi large.',
    reglages: { rampe: 'rampe', largeur: BORNE_LARGEUR, ondulation: [0, 0.5, 0.01], taille: [0.2, 4, 0.05], opacite: [0, 1, 0.01] },
    neuve: { largeur: 0.5, ondulation: 0, taille: 1, opacite: 1 },
    etendue: (r) => r.largeur + r.ondulation,
    peindre(o, { rampe, largeur, ondulation, taille, opacite }) {
      const couleur = o.rampe(rampe)[0];
      if (o.partout && opacite >= 1) { o.remplir(couleur); return; } // (l'herbe : toute la toile d'un coup, bien plus vite)
      const onde = o.ondulation(ondulation, taille), marge = ondulation + 1 / o.ppc;
      o.chaquePixel((x, z, d, k) => {
        if (d - marge > largeur) return;                                 // trop loin
        if (d + marge < largeur) { o.poser(k, couleur, opacite); return; } // bien dedans
        const couverture = (largeur - d - onde(x, z)) * o.ppc + 0.5;      // près du bord : le bord qui ondule
        if (couverture > 0) o.poser(k, couleur, Math.min(1, couverture) * opacite);
      });
    },
  },
  taches: {
    nom: 'Taches',
    aide: 'Des taches aux formes libres, là où un bruit dépasse le « seuil » : plus il est haut, moins il y a de taches. « Taille » : leur taille, en cases ; « douceur » : un bord net (0) ou fondu (1). Avec plusieurs couleurs dans la rampe, chaque tache a un cœur : la première couleur au bord, les suivantes de plus en plus vers le milieu.',
    reglages: { rampe: 'rampe', taille: [0.1, 6, 0.05], seuil: [0, 1, 0.01], douceur: [0, 1, 0.01], opacite: [0, 1, 0.01], largeur: BORNE_LARGEUR },
    neuve: { taille: 1.5, seuil: 0.6, douceur: 0.1, opacite: 1, largeur: 3 },
    etendue: (r) => r.largeur,
    peindre(o, { rampe, taille, seuil, douceur, opacite, largeur }) {
      const couleurs = o.rampe(rampe), bruit = o.bruit(taille);
      // la largeur du bord, dans les unités du bruit : un pixel (douceur 0), jusqu'à un tiers de tache (douceur 1)
      const unPixel = 1.6 / (taille * o.ppc), bord = unPixel + douceur * 0.12;
      o.chaquePixel((x, z, d, k) => {
        if (d > largeur) return;
        const n = bruit(x, z);
        if (n < seuil - bord) return;
        for (let etage = 0; etage < couleurs.length; etage++) {
          const couverture = (n - seuil - etage * 0.055) / bord + 0.5; // chaque couleur un peu plus haut que la précédente
          if (couverture > 0) o.poser(k, couleurs[etage], Math.min(1, couverture) * opacite);
        }
      });
    },
  },
  ronds: {
    nom: 'Ronds',
    aide: 'Des ronds semés au hasard : « densité » ronds par case, d’un rayon entre « rayon min » et « taille » cases, chacun d’une couleur de la rampe au hasard. Avec une opacité faible, ils se fondent en grandes taches douces.',
    reglages: { rampe: 'rampe', densite: [0, 12, 0.01], min: [0.01, 3, 0.01], taille: [0.01, 3, 0.01], opacite: [0, 1, 0.01], largeur: BORNE_LARGEUR },
    neuve: { densite: 0.5, min: 0.5, taille: 2, opacite: 0.2, largeur: 3 },
    etendue: (r) => r.largeur + Math.max(r.min, r.taille),
    peindre(o, { rampe, densite, min, taille, opacite, largeur }) {
      const couleurs = o.rampe(rampe);
      o.semer(densite, Math.max(min, taille), (x, z, hasard) => {
        const rayon = min + hasard() * Math.max(0, taille - min), couleur = couleurs[Math.floor(hasard() * couleurs.length)];
        if (o.distance(x, z) <= largeur) o.disque(x, z, rayon, couleur, opacite);
      });
    },
  },
  traits: {
    nom: 'Traits',
    aide: 'De petits coups de pinceau semés au hasard, debout et un peu penchés (des brins d’herbe) : « densité » par case, « longueur » et « épaisseur » en cases, penchés au hasard jusqu’à « penche » (1 : presque couchés). Chaque trait prend une couleur de la rampe au hasard.',
    reglages: { rampe: 'rampe', densite: [0, 30, 0.1], longueur: [0.02, 0.6, 0.01], epaisseur: [0.01, 0.2, 0.005], penche: [0, 1, 0.01], opacite: [0, 1, 0.01], largeur: BORNE_LARGEUR },
    neuve: { densite: 4, longueur: 0.18, epaisseur: 0.05, penche: 0.35, opacite: 0.55, largeur: 3 },
    etendue: (r) => r.largeur + r.longueur + r.epaisseur,
    peindre(o, { rampe, densite, longueur, epaisseur, penche, opacite, largeur }) {
      const couleurs = o.rampe(rampe);
      o.semer(densite, longueur, (x, z, hasard) => {
        const couleur = couleurs[Math.floor(hasard() * couleurs.length)];
        const l = longueur * (0.6 + 0.4 * hasard()), angle = (hasard() - 0.5) * 2 * penche;
        if (o.distance(x, z) <= largeur) o.trait(x, z, x + Math.sin(angle) * l, z - Math.cos(angle) * l, epaisseur, couleur, opacite);
      });
    },
  },
  touffes: {
    nom: 'Touffes',
    aide: 'Des touffes d’herbe : trois brins qui partent d’un même pied, en éventail (celui du milieu plus long). « Densité » par case, « taille » : la longueur d’un brin, « épaisseur », et « écart » : l’ouverture de l’éventail. Chaque touffe prend une couleur de la rampe au hasard.',
    reglages: { rampe: 'rampe', densite: [0, 20, 0.1], taille: [0.03, 0.5, 0.01], epaisseur: [0.01, 0.15, 0.005], ecart: [0, 1, 0.01], opacite: [0, 1, 0.01], largeur: BORNE_LARGEUR },
    neuve: { densite: 2, taille: 0.14, epaisseur: 0.03, ecart: 0.45, opacite: 1, largeur: 3 },
    etendue: (r) => r.largeur + r.taille * 1.25 + r.epaisseur,
    peindre(o, { rampe, densite, taille, epaisseur, ecart, opacite, largeur }) {
      const couleurs = o.rampe(rampe);
      o.semer(densite, taille * 1.3, (x, z, hasard) => {
        const couleur = couleurs[Math.floor(hasard() * couleurs.length)], t = taille * (0.75 + 0.5 * hasard()), penche = (hasard() - 0.5) * 0.4;
        if (o.distance(x, z) > largeur) return;
        for (const [angle, l] of [[-ecart, 0.75], [0, 1], [ecart, 0.7]]) {
          const a = angle + penche;
          o.trait(x, z, x + Math.sin(a) * t * l, z - Math.cos(a) * t * l, epaisseur, couleur, opacite);
        }
      });
    },
  },
  cailloux: {
    nom: 'Cailloux',
    aide: 'De petits cailloux ovales, chacun d’une couleur de la rampe au hasard, avec (« relief ») une ombre en bas à droite et un reflet en haut à gauche, comme sous la lumière. « Densité » par case, « taille » : leur plus grand rayon, en cases. Seulement là où ils tiennent entiers, jusqu’à « largeur » cases de la forme.',
    reglages: { rampe: 'rampe', densite: [0, 30, 0.1], taille: [0.02, 0.4, 0.005], relief: [0, 1, 0.01], largeur: BORNE_LARGEUR },
    neuve: { densite: 4, taille: 0.1, relief: 0.7, largeur: 0.4 },
    etendue: (r) => r.largeur + r.taille * 0.5, // (l'ombre dépasse un peu du caillou)
    peindre(o, { rampe, densite, taille, relief, largeur }) {
      const couleurs = o.rampe(rampe);
      o.semer(densite, taille * 1.5, (x, z, hasard) => {
        const rx = taille * (0.45 + 0.55 * hasard()), rz = rx * (0.55 + 0.35 * hasard()), angle = (hasard() - 0.5) * 1.2;
        const couleur = couleurs[Math.floor(hasard() * couleurs.length)];
        if (o.distance(x, z) > largeur - rx) return;
        if (relief > 0) o.ovale(x + rx * 0.22, z + rz * 0.42, rx, rz, angle, teinte(couleur, 1 - 0.38 * relief), 1); // l'ombre
        o.ovale(x, z, rx, rz, angle, couleur, 1);
        if (relief > 0) o.ovale(x - rx * 0.3, z - rz * 0.32, rx * 0.42, rz * 0.38, angle, teinte(couleur, 1 + 0.3 * relief), 0.9); // le reflet
      });
    },
  },
  lisere: {
    nom: 'Liseré',
    aide: 'Un trait qui suit la forme, à « rayon » cases d’elle : les ornières du chemin, un cercle autour d’un disque, la bande mouillée au bord de l’eau. « Épaisseur » en cases ; « trous » : la part du trait effacée par endroits (il va et vient).',
    reglages: { rampe: 'rampe', rayon: BORNE_LARGEUR, epaisseur: [0.01, 0.6, 0.005], ondulation: [0, 0.5, 0.01], taille: [0.2, 4, 0.05], trous: [0, 1, 0.01], opacite: [0, 1, 0.01] },
    neuve: { rayon: 0.2, epaisseur: 0.04, ondulation: 0.03, taille: 0.8, trous: 0.3, opacite: 0.6 },
    etendue: (r) => r.rayon + r.ondulation + r.epaisseur / 2,
    peindre(o, { rampe, rayon, epaisseur, ondulation, taille, trous, opacite }) {
      const couleur = o.rampe(rampe)[0], onde = o.ondulation(ondulation, taille), coupe = trous > 0 && o.bruit(1.1);
      const marge = ondulation + epaisseur / 2 + 1 / o.ppc, seuil = 0.32 + 0.36 * trous;
      o.chaquePixel((x, z, d, k) => {
        if (Math.abs(d - rayon) > marge) return; // (pour l'herbe, d vaut « moins l'infini » : pas de bord, pas de liseré)
        const couverture = (epaisseur / 2 - Math.abs(d + onde(x, z) - rayon)) * o.ppc + 0.5;
        if (couverture <= 0) return;
        const garde = coupe ? Math.max(0, Math.min(1, (coupe(x, z) - seuil) / 0.04 + 0.5)) : 1;
        o.poser(k, couleur, Math.min(1, couverture) * opacite * garde);
      });
    },
  },
  ombre: {
    nom: 'Ombre du bord',
    aide: 'Assombrit (force négative) ou éclaircit (force positive) en dégradé, depuis le bord de la forme (à « largeur » cases d’elle) vers l’intérieur, sur « épaisseur » cases : le chemin un peu creusé, plus sombre sur ses bords. Ondule comme un aplat de même ondulation et de même taille.',
    reglages: { largeur: BORNE_LARGEUR, epaisseur: [0.01, 2, 0.01], force: [-0.6, 0.6, 0.01], ondulation: [0, 0.5, 0.01], taille: [0.2, 4, 0.05] },
    neuve: { largeur: 0.45, epaisseur: 0.15, force: -0.12, ondulation: 0, taille: 1 },
    etendue: (r) => r.largeur + r.ondulation,
    peindre(o, { largeur, epaisseur, force, ondulation, taille }) {
      const onde = o.ondulation(ondulation, taille);
      o.chaquePixel((x, z, d, k) => {
        if (d > largeur + ondulation || d < largeur - epaisseur - ondulation) return;
        const t = (largeur - d - onde(x, z)) / epaisseur; // 0 au bord, 1 à « épaisseur » cases vers l'intérieur
        if (t > 0 && t < 1) o.teinter(k, 1 + force * (1 - lisser(t)));
      });
    },
  },
  dalles: {
    nom: 'Dalles',
    aide: 'Des dalles de pierre aux formes irrégulières (la cour du château), chacune d’une couleur de la rampe, plus ou moins claire (« nuances »), séparées par des joints (la rampe « joints »). « Taille » : la taille d’une dalle, en cases ; « joint » : l’épaisseur des joints, en cases.',
    reglages: { rampe: 'rampe', joints: 'rampe', taille: [0.15, 2, 0.01], joint: [0.005, 0.2, 0.005], nuances: [0, 0.3, 0.01], largeur: BORNE_LARGEUR },
    neuve: { taille: 0.6, joint: 0.04, nuances: 0.08, largeur: 0 },
    etendue: (r) => r.largeur,
    peindre(o, { rampe, joints, taille, joint, nuances, largeur }) {
      const couleurs = o.rampe(rampe), couleurJoint = o.rampe(joints)[0], g = o.graine;
      // chaque case d'une grille de « taille » cases a une pierre, son centre un peu au hasard dans la case ;
      // un pixel appartient à la pierre la plus proche (on cherche dans les cases voisines), et il est dans
      // un joint s'il est presque aussi près d'une autre pierre (des « cellules de Voronoï »)
      const centre = (i, j) => [(i + 0.2 + 0.6 * hacher(i, j, g)) * taille, (j + 0.2 + 0.6 * hacher(i, j, g + 1)) * taille];
      o.chaquePixel((x, z, d, k) => {
        if (d > largeur + 1 / o.ppc) return;
        const ci = Math.floor(x / taille), cj = Math.floor(z / taille);
        let d1 = Infinity, d2 = Infinity, p1 = null, p2 = null, cellule = null;
        for (let j = cj - 1; j <= cj + 1; j++) {
          for (let i = ci - 1; i <= ci + 1; i++) {
            const p = centre(i, j), dd = (x - p[0]) ** 2 + (z - p[1]) ** 2;
            if (dd < d1) { d2 = d1; p2 = p1; d1 = dd; p1 = p; cellule = [i, j]; } else if (dd < d2) { d2 = dd; p2 = p; }
          }
        }
        // la distance au joint : la moitié de l'écart entre les deux pierres les plus proches, le long de la ligne qui les joint
        const versJoint = (d2 - d1) / (2 * Math.hypot(p2[0] - p1[0], p2[1] - p1[1]));
        const h = hacher(cellule[0], cellule[1], g + 2);
        const pierre = teinte(couleurs[Math.floor(h * couleurs.length)], 1 + (hacher(cellule[0], cellule[1], g + 3) - 0.5) * 2 * nuances);
        const dedans = Math.min(1, (largeur - d) * o.ppc + 0.5);
        o.poser(k, pierre, dedans);
        const couverture = (joint / 2 - versJoint) * o.ppc + 0.5;
        if (couverture > 0) o.poser(k, couleurJoint, Math.min(1, couverture) * dedans);
      });
    },
  },
};

// ═════════════════════════════════════════════════════════════
// PEINDRE UNE MATIÈRE
// ═════════════════════════════════════════════════════════════
// Peint sur la toile les couches d'une recette, l'une après l'autre, autour de sa forme.
// nom : le nom de la matière (pour son hasard) ; zone : [i0, j0, i1, j1] pour ne repeindre qu'un
// rectangle de la toile, en pixels (le reste ne bouge pas).
export function peindreMatiere(toile, recette, nom, forme, zone = null) {
  if (forme.vide) return;
  const { largeur, hauteur, ppc, x0, z0, pixels } = toile;
  // jusqu'où la recette peut peindre autour de sa forme (plus un pixel de marge pour les bords adoucis)
  const marge = portee(recette) + 2 / ppc;
  // le rectangle de pixels à peindre : la zone (ou toute la toile), et seulement près de la forme
  let [i0, j0, i1, j1] = zone || [0, 0, largeur, hauteur];
  if (forme.squelette) {
    const [sx0, sz0, sx1, sz1] = forme.squelette;
    i0 = Math.max(i0, Math.floor((sx0 - marge - x0) * ppc)); j0 = Math.max(j0, Math.floor((sz0 - marge - z0) * ppc));
    i1 = Math.min(i1, Math.ceil((sx1 + marge - x0) * ppc)); j1 = Math.min(j1, Math.ceil((sz1 + marge - z0) * ppc));
  }
  if (i1 <= i0 || j1 <= j0) return;
  const l = i1 - i0;
  // le même rectangle, en cases (pour le bruit et pour semer les objets)
  const rectangle = [x0 + i0 / ppc, z0 + j0 / ppc, x0 + i1 / ppc, z0 + j1 / ppc];
  // la distance de chaque pixel à la forme, calculée une seule fois pour toutes les couches, et la
  // liste des pixels assez près de la forme pour qu'une couche les peigne (les autres sont sautés :
  // un chemin ne touche qu'une petite partie de son grand rectangle)
  let champ = null, pres = null;
  if (!forme.partout) {
    champ = new Float32Array(l * (j1 - j0)).fill(LOIN);
    forme.remplir(champ, toile, [i0, j0, i1, j1], marge);
    let n = 0;
    for (let c = 0; c < champ.length; c++) if (champ[c] <= marge) n++;
    pres = new Int32Array(n);
    for (let c = 0, m = 0; c < champ.length; c++) if (champ[c] <= marge) pres[m++] = c;
  }
  const rampes = {};
  for (const [n, couleurs] of Object.entries(recette.rampes)) rampes[n] = couleurs.map(enRVB);

  // Peint un objet (un rond, un trait, un ovale) : chaque pixel de sa boîte reçoit sa couleur, d'autant
  // plus que le pixel est dedans. bord(x, z) : la distance (en cases) du pixel au bord de l'objet, négative dedans.
  const objet = (xa, za, xb, zb, couleur, opacite, bord) => {
    const a = Math.max(i0, Math.floor((xa - x0) * ppc)), b = Math.min(i1, Math.ceil((xb - x0) * ppc));
    const c = Math.max(j0, Math.floor((za - z0) * ppc)), d = Math.min(j1, Math.ceil((zb - z0) * ppc));
    for (let j = c; j < d; j++) {
      const z = z0 + (j + 0.5) / ppc;
      for (let i = a; i < b; i++) {
        const couverture = 0.5 - bord(x0 + (i + 0.5) / ppc, z) * ppc;
        if (couverture > 0) poser(pixels, (j * largeur + i) * 4, couleur, Math.min(1, couverture) * opacite);
      }
    }
  };

  recette.couches.forEach((couche, n) => {
    const sorte = PINCEAUX[couche.type];
    if (!sorte) return; // une sorte de couche inconnue : on la passe
    const g = graine(nom, n);
    const o = {
      ppc,
      graine: g,
      partout: Boolean(forme.partout),
      // toute la zone d'une seule couleur, rangée par rangée (une rangée toute prête, recopiée)
      remplir([r, v, b]) {
        const rangee = new Uint8ClampedArray(l * 4);
        for (let i = 0; i < rangee.length; i += 4) { rangee[i] = r; rangee[i + 1] = v; rangee[i + 2] = b; rangee[i + 3] = 255; }
        for (let j = j0; j < j1; j++) pixels.set(rangee, (j * largeur + i0) * 4);
      },
      rampe: (r) => rampes[r] || [[255, 0, 255]], // une rampe qui manque : du magenta, bien visible
      distance: (x, z) => forme.distance(x, z),
      poser: (k, couleur, a) => poser(pixels, k, couleur, a),
      teinter(k, f) { pixels[k] *= f; pixels[k + 1] *= f; pixels[k + 2] *= f; },
      // chaque pixel du rectangle : fonction(x, z, d, k) — x, z : son centre (en cases) ; d : sa distance
      // à la forme ; k : sa place dans le tableau des pixels
      chaquePixel(fonction) {
        if (pres) {
          for (const c of pres) {
            const i = i0 + (c % l), j = j0 + Math.floor(c / l);
            fonction(x0 + (i + 0.5) / ppc, z0 + (j + 0.5) / ppc, champ[c], (j * largeur + i) * 4);
          }
          return;
        }
        for (let j = j0; j < j1; j++) {
          const z = z0 + (j + 0.5) / ppc;
          for (let i = i0, k = (j * largeur + i0) * 4; i < i1; i++, k += 4) fonction(x0 + (i + 0.5) / ppc, z, -Infinity, k);
        }
      },
      bruit: (taille) => bruitDouble(g, taille, rectangle),
      // le décalage du bord, de -amplitude à +amplitude : le même pour toutes les couches de la matière
      // qui ont la même taille d'ondulation (leurs bords restent parallèles)
      ondulation(amplitude, taille) {
        if (!amplitude) return () => 0;
        const bruit = bruitDouble(graine(nom, 'ondulation', taille), taille, rectangle);
        return (x, z) => amplitude * Math.max(-1, Math.min(1, (2 * bruit(x, z) - 1) * 1.6));
      },
      // Sème des objets : « densite » par case, au hasard, mais toujours aux mêmes endroits (le hasard
      // de chaque case vient de sa place dans le monde et du numéro de la couche). portee : jusqu'où un
      // objet dépasse de son pied, pour ne pas oublier ceux des cases voisines qui débordent jusqu'ici.
      semer(densite, portee, poserObjet) {
        if (densite <= 0) return;
        const entier = Math.floor(densite), reste = densite - entier;
        for (let cz = Math.floor(rectangle[1] - portee); cz <= Math.floor(rectangle[3] + portee); cz++) {
          for (let cx = Math.floor(rectangle[0] - portee); cx <= Math.floor(rectangle[2] + portee); cx++) {
            const hasard = creerAleatoire(Math.floor(hacher(cx, cz, g) * 4294967296));
            const nombre = entier + (hasard() < reste ? 1 : 0);
            for (let m = 0; m < nombre; m++) poserObjet(cx + hasard(), cz + hasard(), hasard);
          }
        }
      },
      disque: (x, z, r, couleur, a) => objet(x - r, z - r, x + r, z + r, couleur, a, (px, pz) => Math.hypot(px - x, pz - z) - r),
      // un trait de A à B, aux bouts arrondis
      trait(xa, za, xb, zb, epaisseur, couleur, a) {
        const dx = xb - xa, dz = zb - za, l2 = dx * dx + dz * dz || 1e-9, e = epaisseur / 2;
        objet(Math.min(xa, xb) - e, Math.min(za, zb) - e, Math.max(xa, xb) + e, Math.max(za, zb) + e, couleur, a, (px, pz) => {
          const t = Math.max(0, Math.min(1, ((px - xa) * dx + (pz - za) * dz) / l2));
          return Math.hypot(px - xa - dx * t, pz - za - dz * t) - e;
        });
      },
      // un ovale de rayons rx (en long) et rz (en large), tourné de « angle »
      ovale(x, z, rx, rz, angle, couleur, a) {
        const cos = Math.cos(angle), sin = Math.sin(angle), r = Math.max(rx, rz);
        objet(x - r, z - r, x + r, z + r, couleur, a, (px, pz) => {
          const u = ((px - x) * cos + (pz - z) * sin) / rx, v = (-(px - x) * sin + (pz - z) * cos) / rz;
          return (Math.sqrt(u * u + v * v) - 1) * Math.min(rx, rz);
        });
      },
    };
    sorte.peindre(o, { ...PINCEAUX[couche.type].neuve, ...couche });
  });
}

// Jusqu'où une recette peut peindre autour de sa forme (en cases) : la plus grande étendue de ses
// couches. Sert à ne regarder que les pixels assez près de la forme, et à savoir quel morceau de
// toile repeindre quand on ajoute un disque de terre sous un nouveau socle.
export function portee(recette) {
  let p = 0;
  for (const c of recette.couches) {
    const sorte = PINCEAUX[c.type];
    if (sorte) p = Math.max(p, sorte.etendue({ ...sorte.neuve, ...c }));
  }
  return Math.min(PORTEE, p);
}

// ═════════════════════════════════════════════════════════════
// LE SOL DU STYLE CARTOON
// Matière par matière : l'herbe partout, la terre sous les socles (pas sous les socles bonus encore
// endormis : leur terre est peinte au déblocage), la cour du château, la berge des étangs, et le
// chemin par-dessus tout le reste.
// ═════════════════════════════════════════════════════════════
export function peindreSol(toile, niveau, recettes) {
  const c = niveau.chateau;
  peindreMatiere(toile, recettes.herbe, 'herbe', FORMES.partout());
  peindreMatiere(toile, recettes.terre, 'terre', FORMES.disques(niveau.socles.filter((s) => !s.bonus)));
  peindreMatiere(toile, recettes.cour, 'cour', FORMES.rectangle(c.x - 1.9, c.y - 2.7, c.x + 1.7, c.y + 2.7));
  peindreMatiere(toile, recettes.berge, 'berge', FORMES.etangs(niveau.etangs));
  peindreMatiere(toile, recettes.chemin, 'chemin', FORMES.chemin(niveau.cheminVisuel));
}

// ═════════════════════════════════════════════════════════════
// POUR L'ATELIER : des échantillons et des mesures
// La « scène » d'une matière : un morceau de sol de 6,4 × 6,4 cases où elle a sa forme habituelle
// (un chemin qui tourne, des socles, un étang, la cour), son « cœur » (ce qu'on mesure : le milieu du
// chemin, pas sa bordure), et le cadre du gros plan [x, z, largeur, hauteur].
// ═════════════════════════════════════════════════════════════
export const COTE_SCENE = 6.4;
export function scene(nom) {
  switch (nom) {
    case 'chemin': return { forme: FORMES.chemin([{ x: -2, y: 1.7 }, { x: 3.4, y: 1.7 }, { x: 3.4, y: 4.7 }, { x: 9, y: 4.7 }]), coeur: (d) => d < 0.3, grosPlan: [2.3, 0.5, 2.4, 2.4] };
    case 'terre': return { forme: FORMES.disques([{ x: 1.6, y: 1.6 }, { x: 4.8, y: 1.6 }, { x: 3.2, y: 3.2 }, { x: 1.6, y: 4.8 }, { x: 4.8, y: 4.8 }]), coeur: (d) => d < 0.5, grosPlan: [2, 2, 2.4, 2.4] };
    case 'berge': return { forme: FORMES.etangs([{ x: 3.2, y: 3.2, rayon: 1.7 }]), eau: { x: 3.2, y: 3.2, rayon: 1.7 }, coeur: (d) => d > 0.15 && d < 0.35, grosPlan: [3.9, 2, 2.4, 2.4] };
    case 'cour': return { forme: FORMES.rectangle(1.1, 1.1, 5.3, 5.3), coeur: (d) => d < -0.2, grosPlan: [0.5, 0.5, 2.4, 2.4] };
    default: return { forme: FORMES.partout(), coeur: () => true, grosPlan: [2, 2, 2.4, 2.4] };
  }
}

// L'eau d'un étang, à peu près comme dans le jeu (pour voir la berge avec son eau) : deux bleus et
// une bande d'écume au bord
function peindreEau(toile, { x, y, rayon }) {
  peindreMatiere(toile, {
    rampes: { eau: ['#2fa0dc'], bord: ['#6cd0f4'], ecume: ['#ffffff'] },
    couches: [
      { type: 'aplat', rampe: 'ecume', largeur: 0.12, ondulation: 0.03, taille: 0.5, opacite: 1 },
      { type: 'aplat', rampe: 'bord', largeur: 0.01, ondulation: 0, taille: 1, opacite: 1 },
      { type: 'aplat', rampe: 'eau', largeur: -0.55, ondulation: 0, taille: 1, opacite: 1 },
    ],
  }, 'eau', FORMES.etangs([{ x, y, rayon }]));
}

// Un échantillon peint : le morceau [x, z, largeur, hauteur] de la scène d'une matière, à « ppc »
// pixels par case, avec l'herbe dessous (sauf pour l'herbe elle-même) et l'eau de l'étang par-dessus.
// Renvoie { largeur, hauteur, pixels }, comme fabriquerTexture.
export function echantillon(recette, nom, herbe, [x, z, l, h], ppc) {
  const toile = creerToile(Math.round(l * ppc), Math.round(h * ppc), ppc, x, z);
  const s = scene(nom);
  if (nom !== 'herbe' && herbe) peindreMatiere(toile, herbe, 'herbe', FORMES.partout());
  peindreMatiere(toile, recette, nom, s.forme);
  if (s.eau) peindreEau(toile, s.eau);
  return { largeur: toile.largeur, hauteur: toile.hauteur, pixels: toile.pixels };
}

// Les mesures d'une matière peinte, sur sa scène (la matière seule), dans son cœur :
// - clarte : la clarté moyenne, de 0 (noir) à 1 (blanc) ;
// - contraste : l'écart moyen de clarté d'un pixel à la moyenne (0 : un aplat ; plus haut : des
//   taches, des touffes, des cailloux bien visibles) ;
// - saturation : de 0 (gris) à 1 (couleur la plus vive) ;
// - couleurMoyenne : [rouge, vert, bleu].
export function mesurerPeinture(recette, nom) {
  const ppc = 20, s = scene(nom), cote = Math.round(COTE_SCENE * ppc);
  const toile = creerToile(cote, cote, ppc, 0, 0);
  peindreMatiere(toile, recette, nom, s.forme);
  const p = toile.pixels, clartes = [], moyenne = [0, 0, 0];
  let saturation = 0;
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) {
      const k = (j * cote + i) * 4;
      if (p[k + 3] < 250 || !s.coeur(s.forme.distance((i + 0.5) / ppc, (j + 0.5) / ppc))) continue;
      clartes.push(clarte(p[k], p[k + 1], p[k + 2]));
      const max = Math.max(p[k], p[k + 1], p[k + 2]), min = Math.min(p[k], p[k + 1], p[k + 2]);
      saturation += max ? (max - min) / max : 0;
      for (let c = 0; c < 3; c++) moyenne[c] += p[k + c];
    }
  }
  const n = clartes.length || 1, m = clartes.reduce((t, v) => t + v, 0) / n;
  return {
    clarte: m,
    contraste: clartes.reduce((t, v) => t + Math.abs(v - m), 0) / n,
    saturation: saturation / n,
    couleurMoyenne: moyenne.map((v) => Math.round(v / n)),
  };
}
