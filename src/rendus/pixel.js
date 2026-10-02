// ─────────────────────────────────────────────────────────────
// STYLE 3 — « PIXEL ART »
// Tout est dessiné en vrais pixels (une case = 16 × 16 pixels), à la
// manière des jeux 16 bits, puis agrandi sans flou. Pas de Three.js ici :
// juste le Canvas 2D du navigateur. Une lumière de fin de journée est
// posée par-dessus (dégradé chaud, vignette, rayons).
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, POUVOIRS, HAUTEUR_VOL, caracteristiques } from '../jeu/donnees.js';
import { lireApparence, melanger, couleursEclats, verifierApparences, verifierStyle } from './apparence.js';
import { creerAleatoire, bruit2D } from '../jeu/aleatoire.js';
import { socleProche } from './outils3d.js';
import REGLAGES_AMBIANCES from './ambiances.json';
import { Lumieres } from './lumieres.js';
import { ficheDe, socleActif } from '../jeu/benedictions.js';

const T = 16; // taille d'une case en pixels
const CONTOUR = '#24161c';

// « Hachage » d'un pixel → nombre entre 0 et 1 (pour le grain du sol, toujours identique)
function grain(x, y) {
  let h = Math.imul(x | 0, 73856093) ^ Math.imul(y | 0, 19349663);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const hex = (c) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];

// ═════════════════════════════════════════════════════════════
// 1. PETIT ATELIER DE SPRITES
//    On dessine sur une grille, puis un contour sombre est ajouté
//    automatiquement autour de tout ce qui a été peint.
// ═════════════════════════════════════════════════════════════
// decalageY : on dessine tout plus bas de quelques pixels (une marge en haut,
// pour que les accessoires d'un personnage tiennent dans le sprite).
// couleurContour : la couleur du contour (sombre d'habitude, plus claire pour un nuage).
function sprite(largeur, hauteur, dessin, { contour = true, decalageY = 0, couleurContour = CONTOUR } = {}) {
  const grille = Array.from({ length: hauteur }, () => Array(largeur).fill(null));
  const p = {
    px(x, y, c) {
      y += decalageY;
      if (x >= 0 && y >= 0 && x < largeur && y < hauteur) grille[y][x] = c;
    },
    rect(x, y, l, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < l; i++) p.px(x + i, y + j, c); },
    // comme rect, mais ne peint que les cases encore vides : ce qu'on dessine passe « derrière »
    // ce qui est déjà là (sert à la cape, dessinée après le corps mais vue derrière lui)
    derriere(x, y, l, h, c) {
      for (let j = 0; j < h; j++) {
        for (let i = 0; i < l; i++) {
          const ligne = grille[y + j + decalageY];
          if (ligne?.[x + i] === null) ligne[x + i] = c; // null = case vide (undefined = hors du sprite)
        }
      }
    },
    // une forme à plusieurs côtés (une liste de points [x, y]) : on peint chaque case dont le
    // centre est à l'intérieur (on compte combien de bords on traverse pour sortir : impair = dedans)
    poly(points, c) {
      const xs = points.map(([x]) => x), ys = points.map(([, y]) => y);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.max(...ys); y++) {
        for (let x = Math.floor(Math.min(...xs)); x <= Math.max(...xs); x++) {
          let dedans = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i], [xj, yj] = points[j];
            if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) dedans = !dedans;
          }
          if (dedans) p.px(x, y, c);
        }
      }
    },
    // un trait d'un pixel d'épaisseur, d'un point à un autre
    trait(x0, y0, x1, y1, c) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let k = 0; k <= n; k++) p.px(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), c);
    },
    // disque ombré : clair en haut à gauche, sombre en bas à droite (lumière qui vient de gauche)
    boule(cx, cy, r, [clair, moyen, sombre], bosses = 0) {
      for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y++) {
        for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x++) {
          const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
          const bord = r + (bosses ? (grain(x * 3, y * 7) - 0.5) * bosses : 0);
          if (dx * dx + dy * dy > bord * bord) continue;
          const lumiere = (-dx * 0.6 - dy * 0.8) / r + (grain(x, y) - 0.5) * 0.35; // + un peu de tramage
          p.px(x, y, lumiere > 0.35 ? clair : lumiere > -0.35 ? moyen : sombre);
        }
      }
    },
  };
  dessin(p);
  const c = document.createElement('canvas');
  c.width = largeur;
  c.height = hauteur;
  const ctx = c.getContext('2d');
  for (let y = 0; y < hauteur; y++) {
    for (let x = 0; x < largeur; x++) {
      let couleur = grille[y][x];
      if (!couleur && contour) {
        const voisin = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => grille[y + dy]?.[x + dx]);
        if (voisin) couleur = couleurContour;
      }
      if (couleur) { ctx.fillStyle = couleur; ctx.fillRect(x, y, 1, 1); }
    }
  }
  // la première ligne dessinée (contour compris) : sert à placer la barre de vie juste au-dessus
  c.hautVisible = Math.max(0, grille.findIndex((ligne) => ligne.some(Boolean)) - 1);
  return c;
}

// Le même sprite retourné (pour regarder à gauche)
function miroir(source) {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d');
  ctx.translate(source.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(source, 0, 0);
  c.hautVisible = source.hautVisible;
  return c;
}

// ── Les personnages, fabriqués à partir de leur fiche ──
// Chaque gabarit dessine sa silhouette sur une grille (avec les couleurs de la
// fiche) et renvoie ses « ancres » : le haut de la tête, le centre, les côtés,
// la ceinture, le bas des pieds. Les accessoires se dessinent par rapport à ces ancres.
// image : 0 et 1 = les deux images de l'animation ; 2 = attaque, 3 = il cligne des yeux (gardiens).
// (La taille de la fiche ne sert pas à agrandir : en pixel art, agrandir un sprite
// de 10 % abîmerait ses pixels. Mais un gabarit peut avoir une version « grand »,
// redessinée pixel par pixel, pour les personnages de taille 1,4 ou plus.)
const GABARITS_PIXEL = {
  gardien: {
    largeur: 26, hauteur: 21, marge: 4, images: 4, largeurBarre: 12, // marge : la place du moulinet, au-dessus de la couronne
    dessiner(p, c, image) {
      const b = image === 2 ? 1 : 0; // image 2 = attaque : le corps s'écrase d'un pixel
      p.rect(6, 8 + b, 14, 8 - b, c.peau);     // corps
      p.rect(6, 8 + b, 14, 1, c.clair);        // haut éclairé
      p.rect(19, 9 + b, 1, 7 - b, c.fonce);    // côté droit dans l'ombre
      p.rect(6, 15, 14, 1, c.fonce);           // dessous
      p.rect(3, 11, 3, 2, c.peau); p.rect(3, 13, 3, 1, c.fonce);    // bras gauche
      p.rect(20, 11, 3, 2, c.peau); p.rect(20, 13, 3, 1, c.fonce);  // bras droit
      for (const x of [7, 10, 14, 17]) p.rect(x, 16, 2, 3, c.fonce); // quatre pattes
      for (const x of [9, 15]) {
        if (image === 3) p.rect(x, 12, 2, 1, c.yeux); // il cligne des yeux : un simple trait
        else { p.rect(x, 10 + b, 2, 3, c.yeux); p.px(x, 10 + b, '#f4ecff'); } // yeux + reflet
      }
      return { haut: 8 + b, centre: 13, gauche: 6, droite: 19, ceinture: 14, bas: 18, attaque: image === 2 };
    },
  },
  gelee: {
    largeur: 18, hauteur: 15, marge: 7, images: 2, largeurBarre: 12,
    dessiner(p, c, image) {
      // image 1 = écrasée (au sol), image 0 = étirée (en l'air)
      const lignes = image ? [[5, 5, 12], [6, 3, 14], [7, 1, 16], [8, 1, 16], [9, 1, 16], [10, 1, 16], [11, 1, 16], [12, 1, 16]]
        : [[3, 6, 11], [4, 4, 13], [5, 3, 14], [6, 2, 15], [7, 2, 15], [8, 2, 15], [9, 2, 15], [10, 2, 15], [11, 2, 15], [12, 2, 15]];
      for (const [y, a, b] of lignes) p.rect(a, y, b - a + 1, 1, c.peau);
      const haut = lignes[0][0], bas = lignes[lignes.length - 1];
      p.rect(lignes[1][1] + 1, haut + 1, 2, 2, c.clair); // reflet
      p.rect(bas[1], 12, bas[2] - bas[1] + 1, 1, c.fonce);
      for (const x of [6, 11]) { p.rect(x, haut + 4, 2, 2, c.yeux); p.px(x, haut + 4, '#e8ffe0'); }
      return { haut, centre: 9, gauche: bas[1], droite: bas[2], ceinture: 10, bas: 12 };
    },
    // la grosse gelée (la Gigogne) : un dôme posé sur des côtés droits, calculé ligne par ligne
    grand: {
      largeur: 34, hauteur: 23, marge: 9, images: 2, largeurBarre: 20,
      dessiner(p, c, image) {
        const cx = 17, bas = 21;
        const demi = image ? 14 : 12.5, h = image ? 15 : 18; // image 1 = écrasée, image 0 = étirée
        const haut = bas - h, milieu = bas - Math.round(h * 0.35), ry = milieu - haut;
        const ombre = melanger(c.peau, c.fonce, 0.45);
        for (let y = haut; y <= bas; y++) {
          // au-dessus du milieu : un quart d'ellipse ; en dessous : toute la largeur
          const t = y < milieu ? (milieu - y) / ry : 0;
          const l = Math.round(demi * Math.sqrt(Math.max(0, 1 - t * t)));
          if (l <= 0) continue;
          p.rect(cx - l, y, l * 2, 1, c.peau);
          p.rect(cx + l - 2, y, 2, 1, ombre); // le côté droit, dans l'ombre
        }
        p.rect(cx - Math.round(demi), bas, Math.round(demi) * 2, 1, c.fonce); // le dessous
        // un grand reflet en haut à gauche
        p.rect(cx - 8, haut + 3, 4, 2, c.clair); p.rect(cx - 9, haut + 5, 2, 2, c.clair); p.px(cx - 7, haut + 3, '#ffffff');
        for (const x of [cx - 6, cx + 3]) { p.rect(x, haut + 7, 3, 3, c.yeux); p.px(x, haut + 7, '#e8ffe0'); }
        return { haut, centre: cx, gauche: cx - Math.round(demi), droite: cx + Math.round(demi) - 1, ceinture: bas - 6, bas, echelle: 2 };
      },
    },
  },
  rongeur: {
    largeur: 21, hauteur: 14, marge: 7, images: 2, largeurBarre: 12, profil: true, // vu de profil : on le retourne pour aller à gauche
    dessiner(p, c, image) {
      p.rect(5, 6, 9, 5, c.peau);                                    // corps
      p.rect(6, 10, 7, 1, melanger(c.clair, c.peau, 0.3));           // ventre
      p.rect(13, 4, 5, 6, melanger(c.peau, c.clair, 0.25));          // tête
      const oreille = melanger(c.peau, c.fonce, 0.5);
      p.rect(14, 2, 1, 2, oreille); p.px(17, 3, oreille);            // oreilles
      p.rect(16, 5, 1, 2, c.yeux);                                   // oeil
      p.rect(18, 7, 1, 2, melanger(c.fonce, '#000000', 0.55));       // museau
      p.rect(1, 3, 4, 3, c.clair); p.px(2, 2, c.clair); p.px(4, 6, c.clair); // queue touffue
      const a = image ? 1 : 0;
      p.rect(6 + a, 11, 2, 2, c.fonce); p.rect(11 - a, 11, 2, 2, c.fonce);   // pattes
      return { haut: 4, centre: 15, gauche: 13, droite: 17, ceinture: 8, bas: 12, oeil: { x: 16, y: 5 } };
    },
  },
  tortue: {
    largeur: 24, hauteur: 13, marge: 8, images: 2, largeurBarre: 14, profil: true, // vue de profil, comme le rongeur
    dessiner(p, c, image) {
      const a = image ? 1 : 0;
      const sombre = melanger(c.carapace, '#000000', 0.3), clairCarapace = melanger(c.carapace, '#ffffff', 0.35);
      // les pattes du côté loin (plus sombres), puis la queue et le cou
      p.rect(9 - a, 10, 2, 2, c.fonce); p.rect(16 + a, 10, 2, 2, c.fonce);
      p.px(3, 9, c.peau); p.rect(17, 7, 2, 2, c.peau);
      // la carapace : un dôme, ligne par ligne [y, de x, à x]
      for (const [y, de, a2] of [[2, 9, 13], [3, 7, 15], [4, 6, 16], [5, 5, 17], [6, 5, 17], [7, 5, 17], [8, 4, 18]]) p.rect(de, y, a2 - de + 1, 1, c.carapace);
      p.rect(4, 9, 15, 1, sombre);                                        // le bord, dans l'ombre
      p.rect(8, 3, 3, 1, clairCarapace); p.rect(6, 4, 2, 2, clairCarapace); // la lumière, en haut à gauche
      for (const [x, y] of [[9, 4], [9, 5], [9, 6], [13, 4], [13, 5], [13, 6], [10, 7], [11, 7], [12, 7], [6, 7], [16, 7]]) p.px(x, y, sombre); // les plaques
      // les pattes du côté proche, qui avancent l'une après l'autre
      p.rect(6 + a, 10, 2, 2, c.peau); p.rect(13 - a, 10, 2, 2, c.peau);
      // la tête, qui dépasse devant
      p.rect(18, 5, 4, 4, c.peau); p.rect(18, 5, 4, 1, c.clair);
      p.px(20, 6, c.yeux); p.px(21, 8, c.fonce);
      return { haut: 2, centre: 11, gauche: 6, droite: 16, ceinture: 7, bas: 11, oeil: { x: 20, y: 6 } };
    },
  },
  taupe: {
    largeur: 21, hauteur: 12, marge: 7, images: 2, largeurBarre: 12, profil: true, // vue de profil
    dessiner(p, c, image) {
      const a = image ? 1 : 0;
      p.px(1, 7, c.peau); p.px(2, 7, c.peau); // la toute petite queue
      // le corps tout rond, ligne par ligne [y, de x, à x]
      for (const [y, de, a2] of [[3, 6, 11], [4, 4, 13], [5, 3, 14], [6, 3, 15], [7, 3, 15], [8, 3, 15], [9, 4, 14], [10, 5, 12]]) p.rect(de, y, a2 - de + 1, 1, c.peau);
      p.rect(6, 4, 5, 1, c.clair); p.rect(4, 5, 3, 1, c.clair); // le dessus du pelage, éclairé
      p.rect(5, 10, 8, 1, c.fonce);
      // le long museau rose, et le nez au bout
      p.rect(16, 6, 2, 2, c.museau); p.px(18, 6, melanger(c.museau, '#c04060', 0.4));
      p.px(13, 5, c.yeux);
      // les grosses pattes roses qui creusent (celle de devant avance et recule)
      p.rect(12 + a, 9, 3, 2, c.museau); p.px(15 + a, 10, '#ffffff');
      p.rect(5, 10 + a, 2, 1, melanger(c.museau, '#000000', 0.15));
      return { haut: 3, centre: 9, gauche: 4, droite: 14, ceinture: 7, bas: 10, oeil: { x: 13, y: 5 } };
    },
  },
  dragon: {
    // le Dragon : il n'existe qu'en grand (c'est un chef), vu de profil, en deux images (ailes hautes, ailes basses)
    largeur: 64, hauteur: 40, marge: 8, images: 2, largeurBarre: 32, profil: true,
    dessiner(p, c, image) {
      const sombre = melanger(c.fonce, '#000000', 0.25), membrane = melanger(c.fonce, c.peau, 0.35);
      // l'aile du côté loin, plus sombre, un peu décalée
      const aile = image
        ? [[30, 20], [16, 26], [6, 20], [12, 18], [10, 13], [18, 15], [20, 9], [27, 14]]  // ailes basses, vers l'arrière
        : [[28, 20], [22, 11], [20, 2], [28, 7], [33, 1], [36, 9], [42, 6], [38, 19]];   // ailes hautes
      p.poly(aile.map(([x, y]) => [x + 4, y - 2]), sombre);
      // la queue : des disques de plus en plus petits, puis une pointe
      [[20, 27, 4], [15, 26, 3.4], [10, 24, 2.8], [6, 22, 2.2]].forEach(([x, y, r]) => p.boule(x, y, r, [c.clair, c.peau, c.fonce]));
      p.poly([[4, 19], [1, 21], [4, 24], [6, 21]], c.fonce);
      // les pattes
      for (const x of [24, 36]) { p.rect(x, 31, 3, 4, c.fonce); p.rect(x - 1, 35, 5, 1, sombre); }
      // le corps : une boule allongée, le ventre plus clair dessous
      for (let y = 19; y <= 33; y++) {
        const l = Math.round(12 * Math.sqrt(Math.max(0, 1 - ((y - 26) / 7.5) ** 2)));
        if (l > 0) p.rect(30 - l, y, l * 2, 1, y >= 29 ? c.ventre : c.peau);
      }
      for (let x = 22; x <= 38; x += 3) p.px(x, 30, melanger(c.ventre, c.fonce, 0.4)); // les écailles du ventre
      p.rect(23, 20, 7, 2, c.clair);
      // le cou, en arc, jusqu'à la tête
      [[39, 24, 3.2], [42, 21, 3], [44, 18, 2.8], [46, 15, 2.6]].forEach(([x, y, r]) => p.boule(x, y, r, [c.clair, c.peau, c.fonce]));
      // la tête : le crâne, le museau, la mâchoire, l'œil furieux, les narines et les crocs
      p.rect(47, 9, 8, 7, c.peau); p.rect(47, 9, 8, 1, c.clair);
      p.rect(54, 11, 5, 4, c.peau); p.rect(54, 15, 5, 1, sombre);
      p.rect(51, 11, 2, 2, c.yeux); p.px(52, 12, '#2a0e10');
      p.rect(50, 10, 4, 1, c.fonce);
      p.px(58, 12, '#2a0e10');
      p.px(55, 16, '#ffffff'); p.px(57, 16, '#ffffff');
      // l'aile du côté proche, par-dessus le corps, avec ses nervures
      p.poly(aile, membrane);
      const racine = aile[0];
      for (const bout of image ? [[6, 20], [10, 13], [20, 9]] : [[20, 2], [33, 1], [42, 6]]) p.trait(racine[0], racine[1], bout[0], bout[1], c.fonce);
      return { haut: 9, centre: 51, gauche: 48, droite: 54, ceinture: 26, bas: 35, echelle: 2, oeil: { x: 51, y: 11 } };
    },
  },
  golem: {
    largeur: 26, hauteur: 25, marge: 7, images: 2, largeurBarre: 18,
    dessiner(p, c, image) {
      p.rect(6, 8, 14, 12, c.peau);
      p.rect(6, 8, 5, 4, c.clair);
      p.rect(6, 19, 14, 1, c.fonce); p.rect(19, 9, 1, 10, melanger(c.peau, c.fonce, 0.5));
      p.rect(6, 7, 14, 2, c.mousse); p.px(8, 9, c.mousse); p.px(15, 9, c.mousse); p.px(16, 10, melanger(c.mousse, '#000000', 0.15)); // mousse
      p.rect(10, 3, 6, 5, melanger(c.peau, c.fonce, 0.4));           // tête
      p.rect(11, 5, 1, 1, c.yeux); p.rect(14, 5, 1, 1, c.yeux);
      const fissure = melanger(c.fonce, '#000000', 0.15);
      p.px(13, 12, fissure); p.px(14, 13, fissure); p.px(12, 14, fissure); p.px(13, 15, fissure);
      const a = image ? 1 : 0, bras = melanger(c.peau, c.fonce, 0.55), jambes = melanger(c.peau, c.fonce, 0.75);
      p.rect(2, 9 + a, 4, 8, bras); p.rect(20, 10 - a, 4, 8, bras);
      p.rect(8, 20, 4, 3 - a, jambes); p.rect(14, 20, 4, 2 + a, jambes);
      return { haut: 3, centre: 13, gauche: 10, droite: 15, ceinture: 12, bas: 22 };
    },
    // le golem géant (le Colosse) : redessiné deux fois plus grand, avec plus de détails :
    // des sourcils froncés, des poings, et des fissures de lave si sa fiche a une couleur « lave »
    grand: {
      largeur: 52, hauteur: 47, marge: 7, images: 2, largeurBarre: 30,
      dessiner(p, c, image) {
        const a = image ? 1 : 0;
        const tete = melanger(c.peau, c.fonce, 0.4), bras = melanger(c.peau, c.fonce, 0.55), jambes = melanger(c.peau, c.fonce, 0.75);
        const sombre = melanger(c.fonce, '#000000', 0.35);
        // les jambes et les bras, avec un pixel d'écart avec le corps : le contour automatique les sépare
        p.rect(16, 41, 8, 5 - a * 2, jambes); p.rect(28, 41, 8, 3 + a * 2, jambes);
        p.rect(16, 41, 8, 1, melanger(jambes, c.clair, 0.3)); p.rect(28, 41, 8, 1, melanger(jambes, c.clair, 0.3));
        for (const [x, dy, dehors] of [[3, a * 2, -1], [41, -a * 2, 0]]) {
          p.rect(x, 18 + dy, 8, 13, bras);
          p.rect(x, 18 + dy, 2, 13, melanger(bras, c.clair, 0.35));             // le bord éclairé, à gauche
          p.rect(x + dehors, 31 + dy, 9, 6, melanger(bras, c.fonce, 0.3));       // le poing, un peu plus large, vers l'extérieur
          p.rect(x + dehors, 31 + dy, 3, 1, melanger(bras, c.clair, 0.4));
          p.rect(x + dehors + 2, 34 + dy, 5, 1, melanger(bras, c.fonce, 0.6));  // les doigts repliés
        }
        // le corps, éclairé en haut à gauche, dans l'ombre à droite et en bas
        p.rect(12, 16, 28, 24, c.peau);
        p.rect(12, 16, 10, 6, c.clair); p.rect(12, 22, 5, 3, c.clair);
        p.rect(12, 16, 1, 22, melanger(c.peau, c.clair, 0.6));
        p.rect(36, 18, 4, 21, melanger(c.peau, c.fonce, 0.5));
        p.rect(12, 38, 28, 2, c.fonce);
        // des plaques de roche (deux joints), et du grain
        p.rect(13, 28, 23, 1, melanger(c.peau, c.fonce, 0.45)); p.rect(24, 29, 1, 9, melanger(c.peau, c.fonce, 0.45));
        for (let y = 17; y < 38; y++) for (let x = 13; x < 36; x++) if (grain(x * 5, y * 3) > 0.93) p.px(x, y, melanger(c.peau, c.fonce, 0.3));
        // la mousse (ou la cendre) sur les épaules, qui coule un peu
        p.rect(12, 14, 28, 3, c.mousse);
        for (const [x, l] of [[15, 2], [21, 1], [29, 3], [35, 1]]) p.rect(x, 17, 1, l, c.mousse);
        // la tête, les sourcils froncés, les yeux qui brillent
        p.rect(20, 6, 12, 9, tete);
        p.rect(20, 6, 5, 2, melanger(tete, c.clair, 0.5));
        for (const [x, y] of [[21, 9], [22, 9], [23, 10], [24, 10], [30, 9], [29, 9], [28, 10], [27, 10]]) p.px(x, y, sombre);
        p.rect(22, 11, 2, 2, c.yeux); p.rect(28, 11, 2, 2, c.yeux);
        p.px(22, 11, melanger(c.yeux, '#ffffff', 0.6)); p.px(28, 11, melanger(c.yeux, '#ffffff', 0.6)); // l'éclat des yeux
        p.rect(23, 14, 6, 1, sombre); // la bouche
        if (c.lave) {
          // des fissures de lave : un trait orange au cœur plus clair
          const coeur = melanger(c.lave, '#fff2a0', 0.6);
          p.rect(24, 14, 4, 1, c.lave);
          const fissures = [[[18, 20], [20, 22], [19, 24], [22, 27], [21, 30]], [[31, 23], [33, 25], [32, 28], [34, 31]], [[25, 31], [27, 33], [26, 36]]];
          for (const trace of fissures) {
            for (let i = 0; i < trace.length - 1; i++) {
              const [x0, y0] = trace[i], [x1, y1] = trace[i + 1];
              const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
              for (let k = 0; k <= n; k++) p.px(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), k % 2 ? coeur : c.lave);
            }
          }
        } else {
          const fissure = melanger(c.fonce, '#000000', 0.15);
          for (const [x, y] of [[26, 24], [27, 26], [25, 28], [26, 30]]) p.px(x, y, fissure);
        }
        return { haut: 6, centre: 26, gauche: 20, droite: 31, ceinture: 24, bas: 45, echelle: 2 };
      },
    },
  },
  volant: {
    largeur: 26, hauteur: 15, marge: 7, images: 2, largeurBarre: 12,
    dessiner(p, c, image) {
      // les ailes : la moitié gauche ligne par ligne [y, de x, à x], puis son reflet à droite (x devient 25 - x)
      const aile = image
        ? [[6, 4, 8], [7, 2, 8], [8, 1, 7], [9, 1, 5], [10, 1, 1], [10, 3, 4]] // ailes baissées
        : [[1, 1, 2], [2, 1, 4], [3, 2, 6], [4, 3, 8], [5, 4, 8], [6, 6, 8]]; // ailes levées
      const os = melanger(c.fonce, c.peau, 0.55); // le bord avant de l'aile, un peu plus clair
      aile.forEach(([y, a, b], i) => {
        const couleur = i === 0 ? os : c.fonce;
        p.rect(a, y, b - a + 1, 1, couleur);
        p.rect(25 - b, y, b - a + 1, 1, couleur);
      });
      // le corps rond, les oreilles pointues
      p.boule(13, 8, 4.6, [c.clair, c.peau, c.fonce]);
      for (const x of [9, 15]) p.rect(x, 2, 2, 2, c.fonce);
      p.px(9, 1, c.fonce); p.px(16, 1, c.fonce);
      // les yeux (pupilles vers le milieu : l'air malin), la bouche et deux petits crocs
      p.rect(10, 6, 2, 2, c.yeux); p.rect(14, 6, 2, 2, c.yeux);
      p.px(11, 7, '#2a0e1a'); p.px(14, 7, '#2a0e1a');
      p.rect(11, 9, 4, 1, melanger(c.fonce, '#000000', 0.4));
      p.px(11, 10, '#ffffff'); p.px(14, 10, '#ffffff');
      p.px(11, 13, c.fonce); p.px(14, 13, c.fonce); // les pattes, repliées
      return { haut: 3, centre: 13, gauche: 9, droite: 16, ceinture: 9, bas: 13 };
    },
  },
};

// Les accessoires : a = les ancres du gabarit, couleur = celle de la fiche
const ACCESSOIRES_PIXEL = {
  flamme(p, a, couleur, image) {
    const f = image % 2, c = a.centre, h = a.haut; // f fait vaciller la flamme d'une image à l'autre
    p.rect(c - 3, h - 2, 6, 2, melanger(couleur, '#e05a00', 0.25));
    p.rect(c - 2 + f, h - 4, 4, 2, couleur);
    p.rect(c - 1 - f, h - 6, 2, 2, melanger(couleur, '#ffe040', 0.7));
    p.px(c - 1 + f, h - 7, melanger(couleur, '#fffbe0', 0.9));
    if (a.attaque) { // des étincelles quand il tire
      const etincelle = melanger(couleur, '#ffe040', 0.7);
      p.px(c - 5, h - 5, etincelle); p.px(c + 4, h - 6, etincelle); p.px(c + 3, h - 4, couleur);
    }
  },
  cristaux(p, a, couleur) {
    for (const [dx, l, h] of [[-5, 1, 3], [-1, 2, 5], [3, 1, 3]]) {
      p.rect(a.centre + dx, a.haut - h, l, h, couleur);
      p.rect(a.centre + dx, a.haut - h, l, 1, '#ffffff'); // la pointe brille
    }
  },
  echarpe(p, a, couleur) {
    p.rect(a.gauche, a.ceinture, a.droite - a.gauche + 1, 1, couleur);
    p.rect(a.droite - 2, a.ceinture + 1, 2, 2, couleur); // le bout qui pend
    p.px(a.droite - 1, a.ceinture + 3, melanger(couleur, '#8090a0', 0.15));
  },
  cornes(p, a, couleur) {
    const pointe = melanger(couleur, '#ffffff', 0.55);
    if ((a.echelle || 1) > 1) {
      // sur un grand personnage : de grandes cornes qui se recourbent vers l'extérieur.
      // La corne gauche est décrite [y, de x, à x] depuis le coin de la tête ; la droite est son reflet.
      const ombre = melanger(couleur, '#000000', 0.25);
      const corne = [[-1, -1, 1], [-2, -2, 0], [-3, -3, -1], [-4, -4, -2], [-5, -4, -3]];
      for (const [dy, de, a2] of corne) {
        for (let dx = de; dx <= a2; dx++) {
          const couleurPixel = dx === a2 && dy > -4 ? ombre : couleur; // le bord intérieur, dans l'ombre
          p.px(a.gauche + dx, a.haut + dy, couleurPixel);
          p.px(a.droite - dx, a.haut + dy, couleurPixel);
        }
      }
      p.px(a.gauche - 4, a.haut - 6, pointe); p.px(a.droite + 4, a.haut - 6, pointe);
      return;
    }
    for (const [x, decalage] of [[a.gauche + 1, 0], [a.droite - 2, 1]]) {
      p.rect(x, a.haut - 2, 2, 2, couleur);
      p.px(x + decalage, a.haut - 3, pointe);
    }
  },
  mortier(p, a, couleur) {
    const c = a.centre, h = a.haut, sombre = melanger(couleur, '#000000', 0.25);
    p.rect(c - 2, h - 5, 4, 5, couleur); p.rect(c + 1, h - 4, 1, 4, sombre);
    p.rect(c - 3, h - 6, 6, 1, sombre); p.rect(c - 1, h - 6, 2, 1, melanger(couleur, '#000000', 0.7));
    if (a.attaque) { p.px(c - 1, h - 9, '#d8c8b0'); p.px(c + 1, h - 8, '#d8c8b0'); } // un peu de fumée
  },
  cape(p, a, couleur) {
    // peinte « derrière » : elle ne dépasse du corps que sur les côtés et entre les pattes.
    // Avec p.derriere, le premier qui peint une case la garde : l'ourlet foncé passe donc en premier.
    const l = a.droite - a.gauche + 1;
    p.derriere(a.gauche - 2, a.bas - 1, l + 4, 1, melanger(couleur, '#000000', 0.3)); // l'ourlet, en bas
    p.derriere(a.gauche - 1, a.haut - 1, l + 2, 2, couleur);                          // le col, derrière la tête
    p.derriere(a.gauche - 1, a.haut + 1, l + 2, a.bas - a.haut - 4, couleur);         // le haut, sur les épaules
    p.derriere(a.gauche - 2, a.bas - 3, l + 4, 2, couleur);                           // le bas, plus large
  },
  couronne(p, a, couleur) {
    // un bandeau posé sur la tête, quatre pointes, et une pierre rouge au milieu
    const g = a.centre - 4, h = a.haut;
    p.rect(g, h - 2, 8, 1, couleur);
    p.rect(g, h - 1, 8, 1, melanger(couleur, '#000000', 0.3)); // le bas du bandeau, dans l'ombre
    for (const x of [g, g + 2, g + 5, g + 7]) p.rect(x, h - 4, 1, 2, couleur);
    p.px(g, h - 4, melanger(couleur, '#ffffff', 0.6)); // un reflet à gauche (la lumière vient de la gauche)
    p.rect(g + 3, h - 2, 2, 1, '#e8364a');
  },
  antennes(p, a, couleur, image) {
    // deux tiges aux coins de la tête, chacune avec une boule qui brille
    const h = a.haut, tige = '#3a3448';
    for (const x of [a.gauche + 2, a.droite - 2]) {
      const boule = x < a.centre ? x - 1 : x; // la boule déborde vers l'extérieur
      p.rect(x, h - 3, 1, 3, tige);
      p.rect(boule, h - 5, 2, 2, couleur);
      p.px(boule, h - 5, '#ffffff');
    }
    if (a.attaque) {
      // quand elle tire, l'électricité crépite d'une boule à l'autre
      const arc = melanger(couleur, '#ffffff', 0.5);
      for (let x = a.gauche + 3; x <= a.droite - 3; x++) p.px(x, h - 5 - (x % 3 === 0 ? 1 : 0), arc);
    } else if (image === 1) {
      p.px(a.gauche, h - 6, couleur); p.px(a.droite, h - 7, couleur); // de petites étincelles
    }
  },
  moulinet(p, a, couleur, image) {
    // un bâton planté sur la tête, et le moulinet : un losange en quatre quarts, deux de
    // couleur et deux blancs. D'une image à l'autre, les quarts tournent d'un huitième de tour.
    // Il est assez haut pour passer au-dessus d'une couronne.
    const cx = a.centre, cy = a.haut - 8;
    p.rect(cx, a.haut - 4, 1, 4, '#8a6240');
    for (let dy = -3; dy <= 3; dy++) {
      for (let dx = -3; dx <= 3; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > 3 || (dx === 0 && dy === 0)) continue;
        const angle = Math.atan2(dy, dx) + Math.PI + (image % 2) * (Math.PI / 4);
        const quart = Math.floor(angle / (Math.PI / 2)) % 4;
        p.px(cx + dx, cy + dy, quart % 2 ? couleur : '#fff4f0');
      }
    }
    p.px(cx, cy, '#ffd23a'); // l'axe
  },
  petits(p, a, couleur, image) {
    // trois petites gelées sur le dos, qui sautillent chacune à son tour
    const clair = melanger(couleur, '#ffffff', 0.45), yeux = melanger(couleur, '#000000', 0.6);
    [-7, -2, 3].forEach((dx, i) => {
      const x = a.centre + dx, y = a.haut - 3 - ((image + i) % 2);
      p.rect(x + 1, y, 2, 1, couleur);
      p.rect(x, y + 1, 4, 2, couleur);
      p.px(x + 1, y, clair);
      p.px(x + 1, y + 1, yeux); p.px(x + 2, y + 1, yeux);
    });
  },
  casque(p, a, couleur) {
    // un casque de mineur posé sur la tête, avec sa lampe devant
    const c = a.centre, h = a.haut;
    p.rect(c - 6, h - 1, 12, 1, melanger(couleur, '#000000', 0.25)); // la visière
    p.rect(c - 5, h - 3, 10, 2, couleur);
    p.rect(c - 4, h - 4, 8, 1, couleur);
    p.rect(c - 4, h - 4, 3, 1, melanger(couleur, '#ffffff', 0.6));   // un reflet
    p.rect(c - 1, h - 3, 2, 2, '#ffe27a'); p.px(c - 1, h - 3, '#ffffff'); // la lampe
    a.haut = h - 4; // ce qui vient après (la couronne) se pose sur le casque
  },
  pioche(p, a, couleur) {
    // une pioche dans le dos : le manche dépasse derrière l'épaule droite, le fer en haut
    const x = a.droite, h = a.haut;
    for (let k = 0; k < 7; k++) p.derriere(x - 1 + Math.floor(k / 2), h + 3 - k, 1, 1, '#8a6240'); // le manche (derrière le corps)
    p.derriere(x - 1, h - 4, 6, 1, couleur);                       // le fer, en arc
    p.derriere(x - 2, h - 3, 1, 1, couleur); p.derriere(x + 5, h - 3, 1, 1, couleur);
    p.derriere(x, h - 5, 4, 1, melanger(couleur, '#ffffff', 0.45)); // le dessus du fer, éclairé
  },
  prisme(p, a, couleur, image) {
    // un cristal en losange qui flotte au-dessus de la tête (il monte et descend d'un pixel),
    // assez haut pour passer au-dessus d'une couronne, la moitié gauche éclairée, et des
    // éclats d'arc-en-ciel qui tournent autour
    const cx = a.centre, cy = a.haut - 8 - (image % 2);
    const ombre = melanger(couleur, '#a070d0', 0.45);
    for (let dy = -3; dy <= 3; dy++) {
      const l = 2 - Math.max(0, Math.abs(dy) - 1); // 2, 2, 1, 0… : la largeur de chaque moitié
      if (l < 0) continue;
      p.rect(cx - l, cy + dy, l, 1, couleur);
      p.rect(cx, cy + dy, l + 1, 1, ombre);
    }
    p.px(cx - 1, cy - 1, '#ffffff');
    const arc = ['#ff5a6a', '#ffa83a', '#ffe14a', '#6ad86a', '#5ab4ff', '#a070ff'];
    arc.forEach((teinte, i) => { if ((i + image) % 3 === 0) p.px(cx + [-4, 4, -3, 3, -5, 5][i], cy + [-2, -1, 2, 1, 0, 0][i], teinte); });
  },
  lunettes(p, a, couleur) {
    // de grosses lunettes rondes : un anneau autour de l'œil, avec son verre et la sangle
    const o = a.oeil || { x: a.centre - 3, y: a.haut + 3 };
    p.rect(o.x - 1, o.y - 1, 3, 3, couleur);
    p.px(o.x, o.y, '#cfeeff');
    p.px(o.x - 1, o.y - 1, melanger(couleur, '#ffffff', 0.5));
    p.rect(o.x - 4, o.y, 3, 1, melanger(couleur, '#000000', 0.45));
  },
};
verifierStyle('pixel', GABARITS_PIXEL, ACCESSOIRES_PIXEL);

// Une image d'un personnage, agrandie d'un nombre entier de fois (pour garder des pixels
// bien carrés), sans le vide du haut. Sert aux portraits du didacticiel et à la carte des époques.
// taille : le plus grand agrandissement qui tient dans ce nombre de pixels ;
// echelle : un agrandissement imposé (le même pour tous : les grands restent plus grands)
export function imagePersonnage(apparence, taille = 120, echelle = null) {
  const img = spritesPersonnage(apparence).images[0];
  const haut = img.hautVisible, h = img.height - haut;
  const k = echelle ?? Math.max(1, Math.floor(taille / Math.max(img.width, h)));
  const c = document.createElement('canvas');
  c.width = img.width * k;
  c.height = h * k;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, 0, haut, img.width, h, 0, 0, c.width, c.height);
  return c;
}

// Toutes les images d'un personnage (et leurs versions retournées).
// Un grand personnage (taille 1,4 ou plus) prend la version « grand » de son gabarit, s'il y en a une.
function spritesPersonnage(apparence) {
  const app = lireApparence(apparence);
  const gabarit = GABARITS_PIXEL[app.gabarit];
  const g = app.taille >= 1.4 && gabarit.grand ? gabarit.grand : gabarit;
  const images = Array.from({ length: g.images }, (_, image) => sprite(g.largeur, g.hauteur + g.marge, (p) => {
    const ancres = g.dessiner(p, app.couleurs, image);
    for (const acc of app.accessoires) ACCESSOIRES_PIXEL[acc.type](p, ancres, acc.couleur, image);
  }, { decalageY: g.marge }));
  return { images, miroirs: images.map(miroir), profil: Boolean(gabarit.profil), largeurBarre: g.largeurBarre };
}

// Le petit tas de terre d'un monstre sous terre (la Taupe), en deux images : la terre remue
const BUTTE = [0, 1].map((image) => sprite(12, 6, (p) => {
  p.rect(2, 3, 8, 2, '#8a6440'); p.rect(3, 2, 6, 1, '#a07a50'); p.rect(4, 1 + image, 4, 1, '#b48a5c');
  p.px(3 + image * 4, 3, '#6a4a2e'); p.px(8 - image * 3, 4, '#5a3e26');
}));

// Un petit tourbillon de vent (le tir de Bourrasque), en quatre images qui tournent :
// la forme de base, puis tournée d'un quart de tour à chaque image
const TOURBILLON = (() => {
  const base = [[-1, -2], [0, -2], [1, -2], [2, -1], [2, 0], [1, 1], [0, 1], [-1, 0], [0, 0]];
  const images = [base];
  for (let i = 1; i < 4; i++) images.push(images[i - 1].map(([x, y]) => [-y, x]));
  return images;
})();

// ── Décor ──
// Les couleurs de l'eau qui bouge (voir majEau) : le jour, et la nuit (plus sombre : sinon,
// sous la lumière bleue de la nuit, les étangs brilleraient comme des lampes)
const EAU = {
  fond: hex('#3c8cc8'), bas: hex('#4a9ad4'), clair: hex('#7cc6ee'), sombre: hex('#3480bd'),
  rive: hex('#2a62a0'), ecume: hex('#d4eefc'), reflet: hex('#f0faff'),
};
const EAU_NUIT = {
  fond: hex('#24508a'), bas: hex('#2a5a94'), clair: hex('#4c7cba'), sombre: hex('#1f4880'),
  rive: hex('#183a6c'), ecume: hex('#8aa8d4'), reflet: hex('#dce8ff'),
};

// La silhouette d'un sprite : sa forme, toute d'une couleur sombre (pour les ombres).
// Gardée une fois calculée (un WeakMap l'oublie tout seul si le sprite disparaît).
const COULEUR_OMBRE = '#1a0e24';
const silhouettes = new WeakMap();
function silhouette(img) {
  let s = silhouettes.get(img);
  if (!s) {
    s = document.createElement('canvas');
    s.width = img.width;
    s.height = img.height;
    const ctx = s.getContext('2d');
    ctx.drawImage(img, 0, 0);
    ctx.globalCompositeOperation = 'source-in'; // on ne peint que là où le sprite a des pixels
    ctx.fillStyle = COULEUR_OMBRE;
    ctx.fillRect(0, 0, s.width, s.height);
    silhouettes.set(img, s);
  }
  return s;
}

// ── Les images recolorées ──
// Un monstre ralenti devient bleu, un monstre gelé presque blanc, un monstre touché s'éclaire, un
// gardien assommé s'assombrit. On ne passe pas par les « filtres » du canvas (ctx.filter) : Safari
// ne les connaît pas (les monstres gelés y restaient de leur vraie couleur !), et ils sont lents.
// On prépare plutôt, une fois pour toutes, une copie recolorée de chaque image, pixel par pixel.
// Pour le bleu, chaque pixel prend une couleur de la palette selon sa clarté : les pixels sombres
// restent sombres (le contour reste net), les clairs deviennent presque blancs.
const PALETTES_FROID = {
  gel: [[12, 28, 52], [64, 146, 214], [214, 242, 255]],         // ralenti par une Givrine
  glace: [[34, 64, 92], [150, 208, 238], [242, 252, 255]],      // gelé par le Grand froid
  flashGel: [[44, 86, 124], [164, 218, 250], [255, 255, 255]],  // touché pendant qu'il est ralenti
  flashGlace: [[70, 110, 140], [200, 236, 255], [255, 255, 255]], // touché pendant qu'il est gelé
};
const RECOLORER = {
  flash: (r, v, b) => [r * 2.2, v * 2.2, b * 2.2],               // touché : il s'éclaire un instant
  assomme: (r, v, b, l) => [r, v, b].map((c) => (c + l * 255) * 0.5 * 0.65), // moitié gris, plus sombre
};
for (const [sorte, [sombre, milieu, clair]] of Object.entries(PALETTES_FROID)) {
  RECOLORER[sorte] = (r, v, b, l) => {
    const [de, a, t] = l < 0.5 ? [sombre, milieu, l * 2] : [milieu, clair, (l - 0.5) * 2];
    return de.map((c, i) => c + (a[i] - c) * t);
  };
}
const teintes = new WeakMap();
function teinte(img, sorte) {
  let copies = teintes.get(img);
  if (!copies) teintes.set(img, (copies = new Map()));
  let copie = copies.get(sorte);
  if (!copie) {
    copie = document.createElement('canvas');
    copie.width = img.width;
    copie.height = img.height;
    const ctx = copie.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, copie.width, copie.height), d = image.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue; // pixel transparent
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255; // sa clarté, de 0 à 1
      const [r, v, b] = RECOLORER[sorte](d[i], d[i + 1], d[i + 2], l);
      d[i] = Math.min(255, r); d[i + 1] = Math.min(255, v); d[i + 2] = Math.min(255, b);
    }
    ctx.putImageData(image, 0, 0);
    copie.hautVisible = img.hautVisible;
    copies.set(sorte, copie);
  }
  return copie;
}

// Un « bruit » doux qui se répète sans couture tous les « periode » pixels (pour les nuages) :
// des valeurs au hasard aux coins d'une grille, mélangées en douceur entre les coins,
// à trois tailles de grille (64, 32 et 16 pixels) additionnées.
function bruitPeriodique(x, y, periode) {
  let v = 0, amplitude = 0.5, total = 0;
  for (const cellule of [64, 32, 16]) {
    const n = periode / cellule;
    const gx = x / cellule, gy = y / cellule;
    const ix = Math.floor(gx), iy = Math.floor(gy);
    const fx = gx - ix, fy = gy - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const coin = (a, b) => grain((((a % n) + n) % n) + cellule * 7, (((b % n) + n) % n) + cellule * 13);
    const haut = coin(ix, iy) + (coin(ix + 1, iy) - coin(ix, iy)) * sx;
    const bas = coin(ix, iy + 1) + (coin(ix + 1, iy + 1) - coin(ix, iy + 1)) * sx;
    v += (haut + (bas - haut) * sy) * amplitude;
    total += amplitude;
    amplitude *= 0.5;
  }
  return v / total;
}

const FEUILLAGES = {
  chene: ['#7cc04a', '#4f9a36', '#2f6a2a'],
  bouleau: ['#b4dc6a', '#86bc48', '#5a8e34'],
  automne: ['#ffc85a', '#f08a2e', '#b4501e'],
};
// Le même sprite, le haut penché d'un pixel (dx = -1 ou 1) : le vent dans les feuilles.
// rangees = combien de rangées du haut bougent (le tronc, lui, reste en place).
function pencher(source, dx, rangees) {
  const c = document.createElement('canvas');
  c.width = source.width;
  c.height = source.height;
  const ctx = c.getContext('2d');
  ctx.drawImage(source, 0, rangees, source.width, source.height - rangees, 0, rangees, source.width, source.height - rangees);
  ctx.drawImage(source, 0, 0, source.width, rangees, dx, 0, source.width, rangees);
  c.hautVisible = source.hautVisible;
  return c;
}

// Un arbre en trois images : penché à gauche, droit, penché à droite.
// Deux arbres de la même sorte sont identiques : on ne les dessine qu'une fois (900 arbres
// autour de la carte = seulement 6 dessins).
const ARBRES = new Map();
function spriteArbre(type, petit) {
  const cle = type + (petit ? ':petit' : '');
  if (!ARBRES.has(cle)) {
    const r = petit ? 6 : 10;
    const droit = dessinArbre(type, petit, r);
    const rangees = petit ? 6 : r + 2;
    ARBRES.set(cle, [pencher(droit, -1, rangees), droit, pencher(droit, 1, rangees)]);
  }
  return ARBRES.get(cle);
}
function dessinArbre(type, petit, r) {
  const l = r * 2 + 6, h = r * 2 + (petit ? 6 : 12);
  return sprite(l, h, (p) => {
    const cx = l / 2;
    if (!petit) {
      const bouleau = type === 'bouleau';
      p.rect(cx - 2, r * 2 - 2, 4, 12, bouleau ? '#ece4d8' : '#7a4a2a');
      p.rect(cx + 1, r * 2 - 2, 1, 12, bouleau ? '#b8b0a4' : '#4e2e1a');
      if (bouleau) { p.px(cx - 2, r * 2 + 2, '#2a2420'); p.px(cx, r * 2 + 6, '#2a2420'); }
    }
    p.boule(cx, r + 2, r, FEUILLAGES[type], 2.2);
  });
}
function spriteRocher(taille) {
  const r = 3 + taille * 3;
  return sprite(Math.ceil(r * 2 + 4), Math.ceil(r * 1.4 + 4), (p) => {
    for (let y = 0; y < r * 1.4 + 4; y++) for (let x = 0; x < r * 2 + 4; x++) {
      const dx = (x + 0.5 - (r + 2)) / r, dy = (y + 0.5 - (r * 0.7 + 2)) / (r * 0.7);
      if (dx * dx + dy * dy > 1) continue;
      const l = -dx * 0.6 - dy * 0.8 + (grain(x, y) - 0.5) * 0.3;
      p.px(x, y, l > 0.3 ? '#c8c2b4' : l > -0.4 ? '#9a9488' : '#6a6458');
    }
  });
}
function spriteSocle(surligne) {
  return sprite(26, 15, (p) => {
    for (let y = 1; y < 14; y++) for (let x = 1; x < 25; x++) {
      const dx = (x + 0.5 - 13) / 12, dy = (y + 0.5 - 7.5) / 6.5;
      const d = dx * dx + dy * dy;
      if (d > 1) continue;
      p.px(x, y, d > 0.6 ? (dy > 0.15 ? '#7a7468' : '#b4ac9c') : (grain(x * 5, y) > 0.8 ? '#cfc6b4' : '#c4baa6'));
    }
    if (surligne) for (let y = 0; y < 15; y++) for (let x = 0; x < 26; x++) {
      const dx = (x + 0.5 - 13) / 13, dy = (y + 0.5 - 7.5) / 7.5;
      const d = dx * dx + dy * dy;
      if (d <= 1 && d > 0.8) p.px(x, y, '#ffd24a');
    }
  });
}
const PLUS = sprite(7, 7, (p) => { p.rect(2, 0, 3, 7, '#ffd24a'); p.rect(0, 2, 7, 3, '#ffd24a'); p.rect(3, 1, 1, 5, '#fff4b0'); });

// ── Les petites choses qui bougent ──
// Le tramage (« dithering ») : une grille de seuils de 0 à 1 qui alterne d'un pixel à
// l'autre. Un pixel est peint si sa valeur dépasse le seuil de sa case : on fait ainsi des
// dégradés avec très peu de couleurs, comme les consoles 16 bits.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const tramage = (x, y) => BAYER[(y & 3) * 4 + (x & 3)];

// Une lanterne : le poteau et la lanterne (le bas du poteau est au bas du sprite)
const LANTERNE = sprite(5, 20, (p) => {
  p.rect(2, 7, 1, 12, '#7a4a2a');
  p.rect(1, 2, 3, 4, '#ffd36a');
});

// Les touffes d'herbe : trois formes de brins [x, hauteur], chacune en trois images
// (penchée à gauche, droite, penchée à droite). Le bout des brins est plus clair.
const TOUFFES = [[[0, 2], [1, 3], [2, 2]], [[0, 3], [2, 2]], [[0, 2], [1, 2], [2, 3], [3, 1]]].map((brins) =>
  [-1, 0, 1].map((penche) => sprite(6, 4, (p) => {
    for (const [x, h] of brins) {
      for (let k = 0; k < h; k++) {
        const bout = k === h - 1;
        p.px(x + 1 + (bout && h > 1 ? penche : 0), 3 - k, bout ? '#86c454' : '#3f7e30');
      }
    }
  }, { contour: false })));

// Les fleurs : une tige et quatre pétales autour d'un cœur, en trois images (le vent)
const FLEURS = ['#ffffff', '#ffe14a', '#ff8fb0', '#c09cff', '#ffb04a'].map((couleur) =>
  [-1, 0, 1].map((penche) => sprite(5, 5, (p) => {
    p.px(2, 4, '#3f7e30'); p.px(2, 3, '#4f9a36');
    const x = 2 + penche;
    p.px(x, 1, couleur); p.px(x - 1, 2, couleur); p.px(x + 1, 2, couleur);
    p.px(x, 2, couleur === '#ffe14a' ? '#ff9a3a' : '#ffe680');
  }, { contour: false })));

// Le « pouf » d'un monstre battu : un petit nuage qui gonfle puis se dissout (4 images)
const POUF = [2.5, 4, 5.5, 6.5].map((r, i) => sprite(17, 17, (p) => {
  for (let y = 0; y < 17; y++) {
    for (let x = 0; x < 17; x++) {
      const dx = x + 0.5 - 8.5, dy = y + 0.5 - 8.5;
      const bord = r + (grain(x * 5 + i, y * 3) - 0.5) * 1.6;
      if (dx * dx + dy * dy > bord * bord) continue;
      if (i === 3 && tramage(x, y) > 0.45) continue; // la dernière image se dissout (un pixel sur deux)
      p.px(x, y, dx + dy > r * 0.5 ? '#d8d2e4' : '#ffffff');
    }
  }
}, { couleurContour: '#a89ebc' }));

// Un oiseau vu de loin, en deux images : les ailes en l'air, puis en bas
const OISEAU = [
  [[0, 0], [1, 1], [2, 1], [3, 2], [4, 1], [5, 1], [6, 0]],
  [[0, 2], [1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 2]],
].map((points) => sprite(7, 3, (p) => { for (const [x, y] of points) p.px(x, y, '#2a2030'); }, { contour: false }));

// Un drapeau qui flotte, en trois images : chaque colonne monte ou descend un peu,
// et le bout du drapeau bouge plus que le côté de la hampe
function imagesDrapeau(largeur, hauteur) {
  return [0, 1, 2].map((phase) => sprite(largeur + 2, hauteur + 3, (p) => {
    for (let i = 0; i < largeur; i++) {
      const dy = Math.round(Math.sin(phase * 2.1 - i * 1.1) * (i / (largeur - 1)));
      const h = i >= largeur - 2 ? hauteur - 1 : hauteur; // le bout est un peu plus court
      for (let j = 0; j < h; j++) p.px(1 + i, 1 + j + dy, j === h - 1 ? '#b82e22' : '#e8402e');
    }
  }));
}
const DRAPEAU = imagesDrapeau(6, 4);
const PETIT_DRAPEAU = imagesDrapeau(4, 3);

// ── Le château (vu de trois quarts : on voit le dessus et la face sud) ──
function spriteChateau() {
  const L = 68, H = 112;
  return sprite(L, H, (p) => {
    const briques = (x, y, l, h, clair = '#d6cab0', joint = '#9a8e78') => {
      for (let j = 0; j < h; j++) for (let i = 0; i < l; i++) {
        const yy = y + j, decale = Math.floor(yy / 4) % 2 ? 3 : 0;
        p.px(x + i, yy, yy % 4 === 3 || (x + i + decale) % 6 === 5 ? joint : grain(x + i, yy) > 0.85 ? '#e4dac4' : clair);
      }
    };
    const cour = (x, y, l, h) => p.rect(x, y, l, h, '#bfb39a');
    const creneaux = (x, y, l) => { for (let i = 0; i < l; i += 4) p.rect(x + i, y, 2, 2, '#e8dec8'); };
    // le sol de la cour
    cour(6, 40, 56, 60);
    // mur du fond (nord) : on voit sa face sud
    briques(6, 30, 56, 10); creneaux(6, 28, 56);
    // donjon au centre
    briques(22, 34, 24, 34);
    for (let j = 0; j < 16; j++) p.rect(34 - j - 2, 18 + j, (j + 2) * 2, 1, j % 3 === 0 ? '#2e4a8e' : '#4a72c8'); // toit bleu
    p.rect(33, 6, 1, 13, '#5a3a22'); // la hampe du drapeau (le drapeau, lui, flotte : voir DRAPEAUX)
    p.rect(30, 56, 8, 12, '#2a1c14'); // porte du donjon
    // murs ouest et est (on voit le dessus)
    p.rect(6, 30, 6, 76, '#d6cab0'); p.rect(56, 30, 6, 76, '#d6cab0');
    for (let j = 32; j < 104; j += 4) { p.rect(6, j, 2, 2, '#e8dec8'); p.rect(60, j, 2, 2, '#e8dec8'); }
    // la porte, sur le mur ouest, au bout du chemin
    p.rect(4, 64, 10, 12, '#2a1c14');
    for (let j = 64; j < 76; j += 3) p.rect(4, j, 10, 1, '#5a3a22');
    // mur sud : face visible + créneaux
    briques(6, 96, 56, 12); creneaux(6, 94, 56);
    // quatre tours rondes avec un toit pointu
    const tour = (x, y, h, toit) => {
      briques(x, y, 14, h);
      p.rect(x, y, 2, h, '#b4a88e');
      for (let j = 0; j < 9; j++) p.rect(x + 7 - j - 1, y - 9 + j, (j + 1) * 2, 1, j % 3 === 0 ? '#2e4a8e' : toit);
    };
    tour(0, 26, 16, '#4a72c8'); tour(54, 26, 16, '#4a72c8');
    tour(0, 92, 18, '#4a72c8'); tour(54, 92, 18, '#4a72c8');
    p.rect(6, 2 + 80, 1, 8, '#5a3a22'); // la hampe du petit drapeau, sur la tour sud-ouest
  });
}

// ── Les ambiances (le moment de la journée) ──
// Elles sont rangées dans ambiances.json (partie « pixel ») et se règlent dans l'atelier
// des lumières. voile : les couleurs posées en « lumière douce » sur toute l'image (du coin
// haut-gauche au coin bas-droit), chacune avec sa force ; rayons : la force des rayons de
// soleil ; brume : un voile blanc ; nuit : tout s'assombrit en bleu, et les lanternes s'allument.
const AMBIANCES_PIXEL = REGLAGES_AMBIANCES.pixel;
// « #ffbe6e » et une force de 0,85 → « rgba(255,190,110,0.85) », ce que comprend le Canvas
const rgba = (couleur, force) => `rgba(${hex(couleur).join(',')},${force})`;

// ═════════════════════════════════════════════════════════════
// 2. LE RENDU
// ═════════════════════════════════════════════════════════════
export default class RenduPixel {
  // niveau = l'objet renvoyé par chargerNiveau(fiche) ;
  // reglages.ambiance = le moment de la journée (sinon celui de la fiche du niveau)
  constructor(conteneur, niveau, reglages = {}) {
    verifierApparences(GARDIENS, MONSTRES);
    this.conteneur = conteneur;
    this.niveau = niveau;
    this.ambiance = reglages.ambiance || niveau.ambiance;
    this.canvas = document.createElement('canvas');
    this.canvas.style.imageRendering = 'pixelated';
    conteneur.append(this.canvas);
    this.ctx = this.canvas.getContext('2d');
    this.ecran = document.createElement('canvas'); // image en petite résolution, agrandie ensuite
    this.ectx = this.ecran.getContext('2d');
    this.temps = 0;
    this.particules = [];
    this.eclairs = []; // les éclairs d'Étincelle encore visibles
    this.secousse = 0;
    this.vues = new Map(); // état d'affichage par monstre / gardien (apparition, sens…)

    // Tous les sprites sont fabriqués une seule fois
    this.personnages = new Map(); // les sprites de chaque personnage, fabriqués à la première apparition
    this.sprites = {
      socle: spriteSocle(false),
      socleSurligne: spriteSocle(true),
      chateau: spriteChateau(),
    };
    const aleaDecor = creerAleatoire(99);
    this.decor = [];
    const niv = this.niveau;
    // un arbre garde ses trois images (le vent) ; img = l'image droite (pour son ombre)
    const arbre = (x, y, type, petit) => {
      const images = spriteArbre(type, petit);
      this.decor.push({ x, y, images, img: images[1], type });
    };
    for (const d of niv.decor) {
      if (d.type === 'rocher') this.decor.push({ x: d.x, y: d.y, img: spriteRocher(d.taille) });
      else if (FEUILLAGES[d.type]) arbre(d.x, d.y, d.type, d.dedans);
    }
    // des arbres en plus autour de la carte (en pixel art on voit tout d'en haut, ils ne gênent pas)
    for (let i = 0; i < 900; i++) {
      const x = -8 + aleaDecor() * (niv.largeur + 16), y = -6 + aleaDecor() * (niv.hauteur + 12);
      const dedans = x > 0.4 && x < niv.largeur - 0.4 && y > 0.4 && y < niv.hauteur - 0.4;
      if (dedans) continue;
      if (niv.distanceAuChemin(x, y) < 1.6 || Math.hypot(x - niv.chateau.x, y - niv.chateau.y) < 3.6) continue;
      if (this.decor.some((d) => Math.hypot(d.x - x, d.y - y) < 1.15)) continue;
      const type = ['chene', 'chene', 'bouleau', 'automne'][Math.floor(aleaDecor() * 4)];
      arbre(x, y, type, false);
    }
    // des touffes d'herbe et des fleurs, qui bougent au vent (placées une fois pour toutes)
    this.herbes = [];
    const ch = niv.chateau, aleaHerbe = creerAleatoire(5);
    const nombre = Math.round((niv.largeur + 8) * (niv.hauteur + 6) * 1.2);
    for (let i = 0; i < nombre; i++) {
      const x = -4 + aleaHerbe() * (niv.largeur + 8), y = -3 + aleaHerbe() * (niv.hauteur + 6);
      const fleur = aleaHerbe() < 0.2, sorte = aleaHerbe();
      if (niv.distanceAuChemin(x, y) < 0.75 || niv.distanceEtang(x, y) < 0.45) continue;
      if (x > ch.x - 2 && x < ch.x + 1.9 && y > ch.y - 2.9 && y < ch.y + 3) continue;
      if (niv.socles.some((e) => Math.hypot(e.x - x, e.y - y) < 0.85)) continue;
      const liste = fleur ? FLEURS : TOUFFES;
      this.herbes.push({ x, y, fleur, images: liste[Math.floor(sorte * liste.length)] });
    }
    this.arbresAutomne = this.decor.filter((d) => d.type === 'automne');

    this.lumieres = new Lumieres(niv); // les lanternes, le feu, les explosions… (voir lumieres.js)
    this.halos = new Map();            // les halos de lumière déjà dessinés, par taille et couleur
    this.poufs = [];                   // les petits nuages des monstres battus
    this.oiseaux = [];
    this.feuillesQuiTombent = [];
    this.papillons = null;
    this.flash = 0;                    // l'éclair d'un orage d'Étincelle, la nuit
    this.ondes = [];                   // les ondes de choc du Météore (des cercles qui s'agrandissent)
    // les socles bonus débloqués (bénédiction « Nouveau socle ») : la terre n'est peinte que sous eux
    this.debloques = new Set();
    this.cleSocles = '';
    this.creerNuages();
    this.redimensionner();
  }

  // ── Le sol, peint pixel par pixel une fois pour toutes (à chaque redimensionnement) ──
  peindreSol() {
    const niv = this.niveau, ch = niv.chateau;
    const soclesPeints = niv.socles.filter((s, i) => !s.bonus || this.debloques.has(i)); // (pas les socles bonus endormis)
    const l = this.ecran.width, h = this.ecran.height;
    const fond = document.createElement('canvas');
    fond.width = l;
    fond.height = h;
    const fctx = fond.getContext('2d');
    const image = fctx.createImageData(l, h);
    const px = image.data;
    const C = {
      herbe: hex('#5aa23c'), herbeClair: hex('#78bc4a'), herbeFonce: hex('#3f7e30'), herbeOmbre: hex('#2f6428'),
      chemin: hex('#dcb06c'), cheminClair: hex('#ecca8c'), cheminFonce: hex('#bc8c4c'), bord: hex('#8a5c34'),
      eau: hex('#3c8cc8'), eauClair: hex('#78c4ec'), eauFonce: hex('#2a62a0'), sable: hex('#e8d098'),
      cour: hex('#c4b89c'), terre: hex('#a07c50'),
    };
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < l; i++) {
        const wx = i - this.ox, wy = j - this.oy; // position dans le monde (en pixels)
        const x = wx / T, y = wy / T;             // position en cases
        const g = grain(wx, wy);
        let c;
        const bordEtang = niv.distanceEtang(x, y); // négatif = dans l'eau
        const dChemin = niv.distanceAuChemin(x, y);
        if (bordEtang < 0) {
          c = bordEtang > -0.18 ? C.eauFonce : ((wy + Math.floor(wx / 6)) % 7 === 0 && g > 0.5 ? C.eauClair : C.eau);
        } else if (bordEtang < 0.32) c = C.sable;
        else if (x > ch.x - 1.8 && x < ch.x + 1.7 && y > ch.y - 2.7 && y < ch.y + 2.8) c = C.cour;
        else if (dChemin < 0.43) c = g > 0.93 ? C.cheminFonce : g > 0.85 ? C.cheminClair : C.chemin;
        else if (dChemin < 0.52) c = C.bord;
        else if (dChemin < 0.62) c = C.herbeOmbre;
        else {
          const tache = bruit2D(x * 0.6, y * 0.6);
          c = tache > 0.62 ? C.herbeClair : tache < 0.3 ? C.herbeFonce : C.herbe;
          if (g > 0.965) c = C.herbeFonce;            // brins d'herbe
          else if (g < 0.03) c = C.herbeClair;
          for (const e of soclesPeints) {             // terre sous les socles
            if (Math.hypot(x - e.x, y - e.y) < 0.68) c = C.terre;
          }
        }
        const k = (j * l + i) * 4;
        px[k] = c[0]; px[k + 1] = c[1]; px[k + 2] = c[2]; px[k + 3] = 255;
      }
    }
    fctx.putImageData(image, 0, 0);
    // fleurs : des petits points de couleur
    const couleurs = ['#ffffff', '#ffe14a', '#ff8fb0', '#c09cff', '#ffb04a'];
    for (const d of niv.decor) {
      if (d.type !== 'fleur') continue;
      const x = Math.round(d.x * T + this.ox), y = Math.round(d.y * T + this.oy);
      fctx.fillStyle = couleurs[Math.floor(d.variante * couleurs.length)];
      fctx.fillRect(x, y, 1, 1);
      if (d.taille > 0.9) fctx.fillRect(x + 2, y + 1, 1, 1);
    }
    this.fond = fond;
    this.preparerEau();
    this.cuireOmbres();
  }

  // Le portrait d'un personnage (pour les fiches du didacticiel)
  portrait(apparence) {
    return imagePersonnage(apparence);
  }

  // Les sprites d'un personnage (fabriqués une seule fois, puis gardés)
  spritesDe(fiche) {
    if (!this.personnages.has(fiche)) this.personnages.set(fiche, spritesPersonnage(fiche.apparence));
    return this.personnages.get(fiche);
  }

  // ── Conversions ──
  versPixel(x, y) { return { x: Math.round(x * T + this.ox), y: Math.round(y * T + this.oy) }; }

  dessinerImage(img, x, y, ancrageX = 0.5, ancrageY = 1) {
    this.ectx.drawImage(img, Math.round(x - img.width * ancrageX), Math.round(y - img.height * ancrageY));
  }

  // ── Particules carrées ── (z0 : la hauteur de départ, en pixels)
  emettre(x, y, n, couleurs, force = 40, haut = 50, vie = 0.6, z0 = 4) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, f = force * (0.3 + Math.random() * 0.7);
      this.particules.push({
        x, y, z: z0, vx: Math.cos(a) * f, vy: Math.sin(a) * f * 0.6, vz: haut * (0.4 + Math.random() * 0.8),
        c: couleurs[Math.floor(Math.random() * couleurs.length)], vie: vie * (0.6 + Math.random() * 0.6), taille: Math.random() < 0.3 ? 2 : 1,
      });
    }
  }

  traiterEvenements(evenements) {
    this.lumieres.evenements(evenements);
    for (const ev of evenements) {
      const p = this.versPixel(ev.x, ev.y);
      if (ev.type === 'mort' || ev.type === 'naissance') {
        // un petit nuage « pouf » là où le monstre a été battu (ou d'où sortent les petits)
        const fiche = MONSTRES[ev.quoi];
        this.poufs.push({ x: p.x, y: p.y, haut: ev.type === 'mort' && fiche.volant ? Math.round(HAUTEUR_VOL * T) : 0, t: 0, gros: ev.type === 'mort' && fiche.boss });
      }
      if (ev.type === 'eclair') this.flash = 0.1;
      if (ev.type === 'impact' && ev.quoi !== 'vent') this.emettre(p.x, p.y, 6, ev.quoi === 'feu' ? ['#ff8a1e', '#ffd23a', '#fff0a0'] : ['#e8fbff', '#9fe6ff'], 30, 40, 0.35);
      if (ev.type === 'explosion' && ev.quoi === 'meteore') {
        // le Météore s'écrase : une gerbe de feu, des cailloux, et tout l'écran tremble
        this.emettre(p.x, p.y, 46, ['#ff5a1e', '#ff9a2a', '#ffd23a', '#fff0a0'], 95, 90, 0.8);
        this.emettre(p.x, p.y, 18, ['#5a4a52', '#8f8496', '#3a2e34'], 70, 60, 0.9);
        this.secousse = 0.35;
        this.ondes.push({ x: p.x, y: p.y, rayon: (ev.rayon || 1.6) * T, t: 0 });
      } else if (ev.type === 'explosion') { this.emettre(p.x, p.y, 22, ['#8f8496', '#6e6478', '#d8c8b0'], 60, 70, 0.7); this.secousse = 0.15; }
      if (ev.type === 'mort') {
        // les éclats ont les couleurs du monstre ; plus il est gros, plus il y en a
        const fiche = MONSTRES[ev.quoi];
        const couleurs = couleursEclats(fiche.apparence);
        if (fiche.boss) {
          this.emettre(p.x, p.y, 70, couleurs, 90, 90, 1, 14);
          this.secousse = 0.5;
        } else {
          this.emettre(p.x, p.y, fiche.pv >= 200 ? 24 : 12, couleurs, 50, 60, 0.6, fiche.volant ? 4 + HAUTEUR_VOL * T : 4);
        }
        this.emettre(p.x, p.y, 4, ['#ffd24a', '#fff4b0'], 15, 70, 0.6);
      }
      if (ev.type === 'eclair') {
        // l'éclair reste affiché un court instant (ses zigzags changent à chaque image) ; des étincelles sur chaque monstre touché
        this.eclairs.push({ vie: 0.2, points: ev.points.map((q) => ({ ...this.versPixel(q.x, q.y), h: Math.round(q.h * T) })) });
        for (const q of ev.points.slice(1)) {
          const s = this.versPixel(q.x, q.y);
          this.emettre(s.x, s.y, 4, ['#fff6c0', '#ffe14a', '#a8f0ff'], 30, 30, 0.3, q.h * T);
        }
      }
      if (ev.type === 'souffle') this.emettre(p.x, p.y, 14, ['#ffffff', '#e4fff6', '#b4ecdc'], 80, 12, 0.35); // une rafale au ras du sol
      if (ev.type === 'naissance') this.emettre(p.x, p.y, 12, ['#ffffff', ...couleursEclats(MONSTRES[ev.quoi].apparence)], 40, 70, 0.5);
      if (ev.type === 'carapace') this.emettre(p.x, p.y, 2, ['#ffffff', '#c8ccd4'], 40, 30, 0.2, 6); // le coup ricoche sur la carapace
      if (ev.type === 'plonge' || ev.type === 'surgit') this.emettre(p.x, p.y, 10, ['#8a6440', '#a07a50', '#5a3e26'], 35, 50, 0.45); // de la terre qui vole
      if (ev.type === 'recolte') this.emettre(p.x, p.y - 8, 10, ['#ffd24a', '#fff4b0', '#e8a820'], 20, 80, 0.8, 10); // des pièces qui jaillissent
      if (ev.type === 'flamme') {
        // un jet de feu, de la gueule du dragon jusqu'au gardien
        const v = this.versPixel(ev.vers.x, ev.vers.y), haut = 4 + HAUTEUR_VOL * T + 18;
        for (let k = 0; k < 18; k++) {
          const t = k / 17;
          this.particules.push({
            x: p.x + (v.x - p.x) * t + (Math.random() - 0.5) * 4, y: p.y + (v.y - p.y) * t, z: haut * (1 - t) + 8 * t,
            vx: (Math.random() - 0.5) * 20, vy: (Math.random() - 0.5) * 10, vz: 20,
            c: ['#ff5a1e', '#ffa83a', '#ffe14a'][k % 3], vie: 0.25 + t * 0.35, taille: Math.random() < 0.5 ? 2 : 1,
          });
        }
        this.emettre(v.x, v.y, 10, ['#4a4048', '#7a6a70', '#ff8a2a'], 30, 60, 0.6, 10); // de la fumée sur le gardien
      }
      if (ev.type === 'construction' || ev.type === 'vente') this.emettre(p.x, p.y, 16, ['#e8dcc0', '#c8b898', '#ffd24a'], 45, 40, 0.5);
      if (ev.type === 'nouveauSocle') {
        // un nouveau socle sort de terre : un nuage de poussière et des étincelles dorées
        this.poufs.push({ x: p.x, y: p.y + 4, haut: 0, t: 0, gros: false });
        this.emettre(p.x, p.y, 20, ['#e8dcc0', '#c8b898', '#a08868'], 50, 45, 0.6);
        this.emettre(p.x, p.y - 4, 24, ['#ffd24a', '#fff4b0', '#ffffff'], 25, 110, 0.9, 6);
      }
      if (ev.type === 'amelioration') this.emettre(p.x, p.y - 6, 24, ['#ffd24a', '#fff4b0', '#ffffff'], 25, 110, 0.8); // étincelles dorées
      if (ev.type === 'fuite') { this.emettre(p.x, p.y, 30, ['#ff4a3a', '#2a1a1a'], 70, 80, 1); this.secousse = 0.4; }
    }
  }

  majParticules(dt) {
    this.particules = this.particules.filter((p) => {
      p.vie -= dt;
      if (p.vie <= 0) return false;
      p.vz -= 220 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt);
      if (p.z === 0) { p.vx *= 0.8; p.vy *= 0.8; }
      return true;
    });
  }

  // Cercle de portée en pointillés (pixel par pixel, pour rester net) ; plein = sans trous
  cercle(cx, cy, r, couleur, plein = false) {
    const c = this.ectx;
    c.fillStyle = couleur;
    const n = Math.round(r * 2 * Math.PI);
    for (let i = 0; i < n; i++) {
      if (!plein && Math.floor(i / 3 + this.temps * 4) % 2) continue;
      const a = (i / n) * Math.PI * 2;
      c.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.85), 1, 1);
    }
  }

  dessiner(etat, dtJeu, dtReel, ui) {
    if (etat !== this.partie) {
      this.partie = etat;
      this.vues.clear(); this.particules = []; this.eclairs = []; this.poufs = []; this.ondes = [];
      this.lumieres.vider();
    }
    this.temps += dtReel;
    this.secousse = Math.max(0, this.secousse - dtReel);
    this.flash = Math.max(0, this.flash - dtReel);
    // un socle bonus vient d'être débloqué (ou une nouvelle partie commence) : on repeint le sol
    const cleSocles = etat.soclesDebloques.join(',');
    if (cleSocles !== this.cleSocles) {
      this.cleSocles = cleSocles;
      this.debloques = new Set(etat.soclesDebloques);
      this.peindreSol();
    }
    this.traiterEvenements(etat.evenements);
    if (etat.evenements.some((ev) => ev.type === 'benediction')) {
      // une bénédiction : une fontaine d'étincelles dorées sur chaque gardien
      for (const t of etat.tours) {
        const p = this.versPixel(t.x, t.y);
        this.emettre(p.x, p.y - 6, 14, ['#ffd24a', '#fff4b0', '#ffffff'], 22, 100, 0.9, 10);
      }
    }
    if (etat.evenements.some((ev) => ev.type === 'grandFroid')) {
      // le Grand froid : une bouffée de flocons sur chaque monstre gelé
      for (const e of etat.ennemis) {
        if (!(e.gele > 0)) continue;
        const p = this.versPixel(e.x, e.y);
        this.emettre(p.x, p.y, 7, ['#ffffff', '#dff6ff', '#9fe0ff'], 30, 55, 0.7, 8);
      }
    }
    this.majParticules(dtJeu || 0);
    this.lumieres.maj(dtReel);
    this.majVie(dtReel);
    this.poufs = this.poufs.filter((f) => (f.t += dtJeu || 0) < 0.36);
    const c = this.ectx;
    const image = Math.floor(this.temps * 6) % 2; // animation à 6 images par seconde
    const a = this.reglagesAmbiance();
    const l = this.ecran.width, h = this.ecran.height;
    const occupes = new Map(etat.tours.map((t) => [t.socle, t]));
    const horsEcran = (p, marge) => p.x < -marge || p.y < -marge || p.x > l + marge || p.y > h + marge;

    // 1. Le sol : le fond peint d'avance, l'eau qui bouge, l'herbe et les fleurs au vent, les socles
    c.drawImage(this.fond, 0, 0);
    this.majEau();
    if (this.eau.indices.length) c.drawImage(this.eau.canvas, 0, 0);
    for (const herbe of this.herbes) {
      const p = this.versPixel(herbe.x, herbe.y);
      if (horsEcran(p, 8)) continue;
      const img = this.imageVent(herbe.images, p.x, p.y, 0.5);
      c.drawImage(img, p.x - (img.width >> 1), p.y - img.height + 1);
    }
    this.niveau.socles.forEach((e, i) => {
      if (e.bonus && !this.debloques.has(i)) return; // un socle bonus encore endormi
      const p = this.versPixel(e.x, e.y);
      this.dessinerImage(i === ui.survol || i === ui.selection ? this.sprites.socleSurligne : this.sprites.socle, p.x, p.y + 7);
    });

    // 2. Tout ce qui a de la hauteur : on fait la liste, chaque chose avec son dessin et son ombre
    const objets = [];
    const volants = []; // dessinés à la fin, par-dessus tout le reste : ils sont en l'air
    for (const d of this.decor) {
      const p = this.versPixel(d.x, d.y);
      if (horsEcran(p, 40)) continue;
      const img = d.images ? this.imageVent(d.images, p.x, p.y) : d.img;
      objets.push({ y: p.y, dessin: () => this.dessinerImage(img, p.x, p.y + 2) });
    }
    const pc = this.versPixel(this.niveau.chateau.x, this.niveau.chateau.y);
    objets.push({ y: pc.y + 30, dessin: () => { this.dessinerImage(this.sprites.chateau, pc.x - 2, pc.y + 42); this.dessinerDrapeaux(pc); } });
    for (const lanterne of this.niveau.lanternes) {
      const p = this.versPixel(lanterne.x, lanterne.y);
      objets.push({ y: p.y, dessin: () => this.dessinerImage(LANTERNE, p.x, p.y + 1) });
    }
    // les gardiens (et le « + » doré des socles libres)
    this.niveau.socles.forEach((e, i) => {
      if (e.bonus && !this.debloques.has(i)) return;
      const p = this.versPixel(e.x, e.y);
      const tour = occupes.get(i);
      if (!tour) {
        objets.push({ y: p.y + 4, dessin: () => this.dessinerImage(PLUS, p.x, p.y - 9 + (Math.floor(this.temps * 3 + i) % 2), 0.5, 0.5) });
        return;
      }
      // une vue par gardien ET par niveau : après une amélioration, il refait son petit saut
      const cle = tour.id + ':' + tour.niveau;
      let vue = this.vues.get(cle);
      if (!vue) { vue = { apparition: 0 }; this.vues.set(cle, vue); }
      vue.apparition = Math.min(1, vue.apparition + dtReel * 5);
      const sp = this.spritesDe(caracteristiques(tour.type, tour.niveau)); // les sprites de SON niveau
      // il regarde vers la gauche ou la droite selon sa cible ; image 2 = attaque, image 3 = il cligne
      // des yeux (de temps en temps, chacun à son rythme ; et il les ferme quand il est assommé)
      const versGauche = Math.cos(tour.angle) < -0.2;
      const clin = tour.assomme > 0 || (this.temps + tour.id * 1.73) % 3.4 < 0.14;
      const numero = tour.attaque > 0 ? 2 : clin && sp.images.length > 3 ? 3 : image;
      const img = (versGauche ? sp.miroirs : sp.images)[numero];
      const saut = vue.apparition < 1 ? Math.round(Math.sin(vue.apparition * Math.PI) * 6) : 0;
      const recul = tour.attaque > 0.12 ? (versGauche ? 1 : -1) : 0; // il recule d'un pixel quand il tire
      objets.push({
        y: p.y + 4,
        ombre: { img, x: p.x + recul, y: p.y + 3 },
        dessin: () => {
          // (assommé par le feu du Dragon : plus sombre et un peu gris)
          this.dessinerImage(tour.assomme > 0 ? teinte(img, 'assomme') : img, p.x + recul, p.y + 3 - saut); // les pattes posées au milieu du socle
          if (tour.assomme > 0) {
            // trois petites étoiles qui tournent au-dessus de sa tête
            c.fillStyle = '#ffe14a';
            for (let k = 0; k < 3; k++) {
              const angle = this.temps * 5 + (k * Math.PI * 2) / 3;
              c.fillRect(Math.round(p.x + Math.cos(angle) * 6), Math.round(p.y - 19 + Math.sin(angle) * 2), 1, 1);
            }
          }
        },
      });
    });
    // les monstres
    for (const e of etat.ennemis) {
      const p = this.versPixel(e.x, e.y);
      const fiche = MONSTRES[e.type];
      const sp = this.spritesDe(fiche);
      if (e.cache) {
        // sous terre (la Taupe) : on ne voit qu'un petit tas de terre qui avance
        objets.push({ y: p.y, dessin: () => {
          this.dessinerImage(BUTTE[(Math.floor(this.temps * 8) + e.id) % 2], p.x, p.y + 2);
          if (Math.random() < 0.15) this.particules.push({ x: p.x + (Math.random() - 0.5) * 6, y: p.y, z: 2, vx: (Math.random() - 0.5) * 20, vy: 0, vz: 25, c: '#8a6440', vie: 0.3, taille: 1 });
        } });
        continue;
      }
      // ralenti par une Givrine : il s'anime au ralenti ; gelé par le Grand froid : il ne bouge plus du tout
      const vite = e.gele > 0 ? 0 : e.facteurRalenti < 1 ? Math.floor(this.temps * 3) % 2 : image;
      const img = (sp.profil && e.dx < -0.1 ? sp.miroirs : sp.images)[(vite + e.id) % sp.images.length];
      // à quelle hauteur le dessiner : un volant vole (en montant et descendant un peu),
      // un petit qui vient de naître fait un bond
      const vol = fiche.volant ? Math.round(HAUTEUR_VOL * T + Math.sin(this.temps * 5 + e.id) * 1.5) : 0;
      const bond = e.bond > 0 ? Math.round(Math.sin(e.bond * Math.PI) * 10) : 0;
      const y = p.y + 2 - vol - bond;
      // son ombre reste par terre : plus il est haut, plus elle s'éloigne de lui
      const enAir = vol + bond;
      const ombre = { img, x: p.x + enAir * a.ombre.dx, y: p.y + 2 + enAir * a.ombre.dy };
      const dessin = () => {
        // ralenti par une Givrine : bleu ; pris dans la glace du Grand froid : presque blanc (et un
        // glaçon autour, plus bas) ; touché : il s'éclaire un instant. S'il est gelé, il s'éclaire EN
        // BLEU : sinon, une Blizzard qui le frappe sans arrêt le ferait clignoter de sa vraie couleur,
        // et on ne verrait plus qu'il est gelé
        const froid = e.gele > 0 ? 'Glace' : e.facteurRalenti < 1 ? 'Gel' : '';
        const sorte = e.touche > 0 ? (froid ? 'flash' + froid : 'flash') : froid.toLowerCase();
        this.dessinerImage(sorte ? teinte(img, sorte) : img, p.x, y);
        if (e.gele > 0) {
          // un glaçon autour de lui : un bloc transparent, éclairé en haut à gauche, plus sombre en bas à droite
          const haut = Math.round(y - img.height + (img.hautVisible || 0) - 2), l = img.width - 2;
          const gauche = Math.round(p.x - l / 2), bas = Math.round(y + 1);
          c.fillStyle = 'rgba(200,240,255,0.32)'; c.fillRect(gauche, haut, l, bas - haut);
          c.fillStyle = 'rgba(255,255,255,0.8)'; c.fillRect(gauche, haut, l - 1, 1); c.fillRect(gauche, haut, 1, bas - haut - 1);
          c.fillStyle = 'rgba(110,180,225,0.7)'; c.fillRect(gauche + l - 1, haut + 1, 1, bas - haut - 1); c.fillRect(gauche + 1, bas - 1, l - 1, 1);
          // deux petits éclats de glace qui scintillent autour de lui
          c.fillStyle = '#ffffff';
          for (let k = 0; k < 2; k++) {
            if ((Math.floor(this.temps * 4) + e.id + k) % 3 === 0) continue;
            c.fillRect(p.x + (k ? 5 : -6), y - 4 - ((e.id + k * 5) % 7), 1, 1);
          }
        }
        if (e.recul > 0) {
          // des traits de vent devant lui : il est soufflé en arrière
          c.fillStyle = '#ffffff';
          const horizontal = Math.abs(e.dx) > Math.abs(e.dy);
          for (const k of [-3, 3]) {
            const x = p.x + Math.round(e.dx * 9) + (horizontal ? 0 : k), yy = y - 8 + Math.round(e.dy * 6) + (horizontal ? k : 0);
            if (horizontal) c.fillRect(x - 1, yy, 4, 1); else c.fillRect(x, yy - 1, 1, 4);
          }
        }
        // barre de vie
        if (e.pv < e.pvMax) {
          const lb = sp.largeurBarre, yb = y - img.height + img.hautVisible - 3, r = e.pv / e.pvMax;
          c.fillStyle = CONTOUR; c.fillRect(p.x - lb / 2 - 1, yb - 1, lb + 2, 4);
          c.fillStyle = r > 0.5 ? '#7be04a' : r > 0.25 ? '#f2c230' : '#ec4a3a';
          c.fillRect(p.x - lb / 2, yb, Math.max(1, Math.round(lb * r)), 2);
        }
      };
      if (fiche.volant) {
        objets.push({ y: p.y, ombre, dessin: () => {} });
        volants.push(dessin);
      } else {
        objets.push({ y: p.y, ombre, dessin });
      }
    }
    // les tirs
    for (const t of etat.projectiles) {
      const p = this.versPixel(t.x, t.y);
      const hauteur = Math.round(t.z * T);
      objets.push({ y: p.y, dessin: () => {
        if (t.type === 'meteore') {
          // son ombre grandit à mesure qu'il approche ; la boule de feu laisse une traînée
          const proche = 1 - t.z / POUVOIRS.meteore.hauteur;
          const lo = Math.round(4 + proche * 10);
          c.fillStyle = `rgba(30,16,30,${(0.15 + proche * 0.3).toFixed(2)})`;
          c.fillRect(p.x - lo, p.y - 1, lo * 2 + 1, 3);
          const y = p.y - hauteur;
          // une boule ronde, faite de trois carrés croisés par couleur (du contour au cœur)
          const rond = (couleur, r, coin) => {
            c.fillStyle = couleur;
            c.fillRect(p.x - r, y - r + coin, r * 2 + 1, r * 2 + 1 - coin * 2);
            c.fillRect(p.x - r + coin, y - r, r * 2 + 1 - coin * 2, r * 2 + 1);
            c.fillRect(p.x - r + 1, y - r + 1, r * 2 - 1, r * 2 - 1);
          };
          rond(CONTOUR, 6, 2);
          rond('#e8501e', 5, 2);
          rond('#ff9a2a', 3, 1);
          c.fillStyle = '#ffe14a'; c.fillRect(p.x - 2, y - 3, 3, 2);
          c.fillStyle = '#fff4b0'; c.fillRect(p.x - 2, y - 3, 1, 1);
          for (let k = 0; k < 3; k++) {
            this.particules.push({ x: p.x + (Math.random() - 0.5) * 8, y: p.y, z: hauteur + 4 + Math.random() * 8, vx: (Math.random() - 0.5) * 8, vy: 0, vz: 30 + Math.random() * 30, c: ['#ff5a1e', '#ffb43a', '#ffe14a', '#6e6478'][k + (Math.random() < 0.3 ? 1 : 0)], vie: 0.25 + Math.random() * 0.2, taille: Math.random() < 0.4 ? 2 : 1 });
          }
        } else if (t.type === 'rocher') {
          c.fillStyle = 'rgba(30,16,30,0.3)'; c.fillRect(p.x - 2, p.y - 1, 5, 2);
          c.fillStyle = CONTOUR; c.fillRect(p.x - 2, p.y - hauteur - 2, 5, 5);
          c.fillStyle = '#8f8496'; c.fillRect(p.x - 1, p.y - hauteur - 1, 3, 3);
          c.fillStyle = '#b8acc0'; c.fillRect(p.x - 1, p.y - hauteur - 1, 1, 1);
        } else if (t.type === 'feu') {
          c.fillStyle = '#ff7a1a'; c.fillRect(p.x - 1, p.y - hauteur - 1, 3, 3);
          c.fillStyle = '#fff0a0'; c.fillRect(p.x, p.y - hauteur, 1, 1);
          if (Math.random() < 0.6) this.particules.push({ x: p.x, y: p.y, z: hauteur, vx: 0, vy: 0, vz: 10, c: '#ffb43a', vie: 0.2, taille: 1 });
        } else if (t.type === 'vent') {
          // un petit tourbillon blanc qui tourne sur lui-même, et laisse une traînée
          c.fillStyle = '#ffffff';
          for (const [dx, dy] of TOURBILLON[Math.floor(this.temps * 14) % 4]) c.fillRect(p.x + dx, p.y - hauteur + dy, 1, 1);
          if (Math.random() < 0.5) this.particules.push({ x: p.x, y: p.y, z: hauteur, vx: 0, vy: 0, vz: 4, c: '#c8f4e4', vie: 0.25, taille: 1 });
        } else {
          c.fillStyle = '#e8fbff'; c.fillRect(p.x - 1, p.y - hauteur, 3, 1);
          c.fillStyle = '#7ad0f0'; c.fillRect(p.x - 2, p.y - hauteur, 1, 1);
        }
      } });
    }
    // les « pouf » des monstres battus (trois pour un chef)
    for (const f of this.poufs) {
      const n = Math.min(3, Math.floor(f.t / 0.09));
      const places = f.gros ? [[0, -14], [-12, -2], [12, -4]] : [[0, 0]];
      objets.push({ y: f.y + 1, dessin: () => { for (const [dx, dy] of places) this.dessinerImage(POUF[n], f.x + dx, f.y - f.haut + 4 + dy); } });
    }

    // 3. Les ombres : celles du décor (peintes d'avance), puis celles des personnages et des
    //    oiseaux, dans un même calque posé d'un coup (là où deux ombres se croisent, ce n'est
    //    pas plus sombre)
    const o = this.calqueOmbres.getContext('2d');
    o.clearRect(0, 0, l, h);
    o.drawImage(this.calqueOmbresFixes, 0, 0);
    for (const objet of objets) if (objet.ombre) this.ombrePortee(o, objet.ombre.img, objet.ombre.x, objet.ombre.y);
    for (const oiseau of this.oiseaux) {
      o.drawImage(silhouette(OISEAU[0]), Math.round(oiseau.x + oiseau.haut * a.ombre.dx) - 3, Math.round(oiseau.y + oiseau.haut * a.ombre.dy));
    }
    c.globalAlpha = a.ombre.force;
    c.drawImage(this.calqueOmbres, 0, 0);
    c.globalAlpha = 1;
    // 4. Les ombres des nuages, qui glissent sur le sol
    if (a.nuages > 0) this.dessinerNuages(a.nuages);

    // 5. Tout ce qui a de la hauteur, trié du haut vers le bas de l'écran
    objets.sort((u, v) => u.y - v.y);
    for (const objet of objets) objet.dessin();
    for (const dessin of volants) dessin();
    // 6. La vie autour : les papillons, les feuilles qui tombent, et les oiseaux, tout en haut
    this.dessinerVie();

    // cercle de portée
    const iPortee = ui.selection >= 0 ? ui.selection : ui.survol;
    const tour = occupes.get(iPortee);
    const portee = tour ? ui.apercuPortee ?? ficheDe(etat, tour.type, tour.niveau).portee : 0; // (avec les bénédictions)
    if (portee > 0) { // (un gardien qui ne tire pas, comme la Pépite, n'a pas de cercle)
      const p = this.versPixel(tour.x, tour.y);
      // (ui.apercuPortee : pendant qu'on survole « Améliorer », la portée du niveau suivant)
      this.cercle(p.x, p.y, portee * T, '#fff4d0');
    }
    // le Météore : là où il va tomber, pendant qu'on vise (orange), puis pendant sa chute (rouge, qui clignote)
    const meteore = etat.projectiles.find((t) => t.type === 'meteore');
    const visee = ui.viseeMeteore || (meteore && { x: meteore.x, y: meteore.y, rayon: meteore.rayon });
    if (visee && (!meteore || Math.floor(this.temps * 10) % 2)) {
      const p = this.versPixel(visee.x, visee.y);
      const couleur = meteore ? '#ff5a3a' : '#ffb46a';
      // un voile coloré sur toute la zone touchée, et un bord en pointillés épais
      c.fillStyle = meteore ? 'rgba(255,90,58,0.22)' : 'rgba(255,170,90,0.18)';
      c.beginPath();
      c.ellipse(p.x, p.y, visee.rayon * T, visee.rayon * T * 0.85, 0, 0, Math.PI * 2);
      c.fill();
      this.cercle(p.x, p.y, visee.rayon * T, couleur);
      this.cercle(p.x, p.y, visee.rayon * T - 1, couleur);
      c.fillStyle = couleur;
      c.fillRect(p.x - 2, p.y, 5, 1);
      c.fillRect(p.x, p.y - 2, 1, 5);
    }
    // les ondes de choc du Météore : un cercle qui s'agrandit en 0,3 seconde, du blanc à l'orange
    this.ondes = this.ondes.filter((o) => (o.t += dtReel) < 0.3);
    for (const o of this.ondes) {
      const k = o.t / 0.3;
      this.cercle(o.x, o.y, o.rayon * (0.3 + k * 0.9), k < 0.5 ? '#fff4d0' : '#ff9a4a', true);
      this.cercle(o.x, o.y, o.rayon * (0.3 + k * 0.9) - 1, k < 0.5 ? '#fff4d0' : '#ff9a4a', true);
    }
    // particules par-dessus
    for (const p of this.particules) {
      c.fillStyle = p.c;
      c.fillRect(Math.round(p.x), Math.round(p.y - p.z), p.taille, p.taille);
    }

    this.lumiere();
    this.dessinerEclairs(dtReel); // après la lumière : un éclair brille, même la nuit
    this.dessinerRayons(etat);
    // on agrandit l'image sans lissage : les pixels restent bien carrés
    const k = this.echelle;
    const sx = this.secousse > 0 ? Math.round((Math.random() - 0.5) * this.secousse * 20) : 0;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(this.ecran, sx, 0, this.ecran.width * k, this.ecran.height * k);
  }

  // Les éclairs d'Étincelle : un zigzag entre chaque point touché, refait à chaque
  // image (il crépite), avec un cœur presque blanc et un halo jaune
  dessinerEclairs(dt) {
    this.eclairs = this.eclairs.filter((eclair) => (eclair.vie -= dt) > 0);
    for (const { points } of this.eclairs) {
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const ax = a.x, ay = a.y - a.h, bx = b.x, by = b.y - b.h;
        const n = Math.max(2, Math.round(Math.hypot(bx - ax, by - ay) / 6));
        let x0 = ax, y0 = ay;
        for (let k = 1; k <= n; k++) {
          const ecart = k < n ? Math.round((Math.random() - 0.5) * 6) : 0; // le dernier point tombe pile sur le monstre
          const x1 = Math.round(ax + ((bx - ax) * k) / n) + ecart, y1 = Math.round(ay + ((by - ay) * k) / n) + Math.round(ecart * 0.6);
          this.ligne(x0 + 1, y0, x1 + 1, y1, '#ffc83a'); // le halo
          this.ligne(x0, y0, x1, y1, '#fffbe6');         // le cœur
          x0 = x1; y0 = y1;
        }
      }
    }
  }

  // Les rayons du Prisme : du cristal jusqu'au monstre, aux couleurs de l'arc-en-ciel qui
  // défilent ; plus le rayon chauffe, plus il est épais et blanc au cœur
  dessinerRayons(etat) {
    const arc = ['#ff5a6a', '#ffa83a', '#ffe14a', '#6ad86a', '#5ab4ff', '#a070ff'];
    for (const tour of etat.tours) {
      if (!tour.rayon) continue;
      const cible = etat.ennemis.find((e) => e.id === tour.rayon);
      if (!cible) continue;
      const a = this.versPixel(tour.x, tour.y), b = this.versPixel(cible.x, cible.y);
      const ax = a.x, ay = a.y - 17, bx = b.x, by = b.y - 6 - (MONSTRES[cible.type].volant ? Math.round(HAUTEUR_VOL * T) : 0);
      const teinte = arc[Math.floor(this.temps * 12) % arc.length];
      this.ligne(ax, ay + 1, bx, by + 1, teinte);
      if (tour.chauffe > 0.5) this.ligne(ax + 1, ay, bx + 1, by, arc[(Math.floor(this.temps * 12) + 2) % arc.length]);
      this.ligne(ax, ay, bx, by, tour.chauffe > 0.8 ? '#ffffff' : '#fff0f8');
      this.ectx.fillStyle = '#ffffff'; this.ectx.fillRect(bx - 1, by - 1, 3, 3); // le point qui brûle
    }
  }

  // Une ligne d'un pixel d'épaisseur (l'algorithme de Bresenham : on avance pixel par pixel
  // dans la direction la plus longue, et on décale d'un cran quand l'erreur devient trop grande)
  ligne(x0, y0, x1, y1, couleur) {
    const c = this.ectx;
    c.fillStyle = couleur;
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let erreur = dx + dy;
    for (;;) {
      c.fillRect(x0, y0, 1, 1);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * erreur;
      if (e2 >= dy) { erreur += dy; x0 += sx; }
      if (e2 <= dx) { erreur += dx; y0 += sy; }
    }
  }

  // La lumière de l'ambiance choisie : un voile de couleur en « lumière douce », la nuit,
  // les lumières du jeu (lanternes, feu, explosions…), des rayons, de la brume, puis une
  // vignette sur les bords
  lumiere() {
    const c = this.ectx, l = this.ecran.width, h = this.ecran.height;
    const a = this.reglagesAmbiance();
    c.globalCompositeOperation = 'soft-light';
    const g = c.createLinearGradient(0, 0, l, h);
    a.voile.forEach(({ couleur, force }, i) => g.addColorStop(i / (a.voile.length - 1), rgba(couleur, force)));
    c.fillStyle = g;
    c.fillRect(0, 0, l, h);
    if (a.nuit > 0) {
      // la nuit : tout s'assombrit en bleu (« multiply » multiplie chaque couleur par celle-ci)
      c.globalCompositeOperation = 'multiply';
      c.fillStyle = melanger('#ffffff', '#5a68b0', Math.min(1, a.nuit));
      c.fillRect(0, 0, l, h);
    }
    c.globalCompositeOperation = 'source-over';
    this.lumieresDynamiques(a);
    if (a.nuit > 0) this.lucioles(a.nuit);
    if (a.rayons) {
      c.globalCompositeOperation = 'screen';
      // trois rayons de soleil en diagonale (en bandes nettes, pas floues)
      for (let i = 0; i < 3; i++) {
        const x = ((i * 0.31 + 0.08) * l + Math.sin(this.temps * 0.2 + i) * 6) | 0;
        c.fillStyle = `rgba(255,220,160,${(0.05 + 0.03 * Math.sin(this.temps * 0.5 + i * 2)) * a.rayons})`;
        c.beginPath();
        c.moveTo(x, 0); c.lineTo(x + 26 + i * 10, 0); c.lineTo(x + 26 + i * 10 + h * 0.7, h); c.lineTo(x + h * 0.7, h);
        c.fill();
      }
    }
    if (a.brume) {
      // un voile blanc, plus épais en haut et en bas de l'image
      c.globalCompositeOperation = 'screen';
      const b = c.createLinearGradient(0, 0, 0, h);
      b.addColorStop(0, `rgba(225,228,255,${a.brume})`);
      b.addColorStop(0.45, 'rgba(225,228,255,0)');
      b.addColorStop(1, `rgba(225,228,255,${a.brume * 0.8})`);
      c.fillStyle = b;
      c.fillRect(0, 0, l, h);
    }
    c.globalCompositeOperation = 'source-over';
    const v = c.createRadialGradient(l / 2, h / 2, Math.min(l, h) * 0.35, l / 2, h / 2, Math.max(l, h) * 0.75);
    v.addColorStop(0, 'rgba(20,10,30,0)');
    v.addColorStop(1, `rgba(20,10,30,${a.vignette})`);
    c.fillStyle = v;
    c.fillRect(0, 0, l, h);
    if (this.flash > 0 && a.nuit > 0) {
      // l'éclair d'Étincelle illumine un instant toute la nuit
      c.globalCompositeOperation = 'screen';
      c.fillStyle = `rgba(190,210,255,${(this.flash / 0.1) * 0.2 * a.nuit})`;
      c.fillRect(0, 0, l, h);
      c.globalCompositeOperation = 'source-over';
    }
  }

  // Les lumières du jeu (voir lumieres.js) : chacune pose un halo de pixels, « ajouté » à
  // l'image (« lighter » additionne les couleurs). La force dépend de l'ambiance : en
  // plein midi on les voit à peine, la nuit elles éclairent tout autour d'elles.
  lumieresDynamiques(a) {
    const k = a.lumieres ?? 0.3;
    if (k <= 0.01 || !this.partie) return;
    const c = this.ectx;
    c.globalCompositeOperation = 'lighter';
    for (const lum of this.lumieres.liste(this.partie, a.nuit)) {
      const force = Math.min(1, lum.force * k);
      if (force < 0.03) continue;
      const p = this.versPixel(lum.x, lum.y);
      const rayon = Math.max(4, Math.round(lum.rayon * T));
      c.globalAlpha = force;
      c.drawImage(this.halo(rayon, lum.couleur), p.x - rayon, p.y - Math.round(lum.hauteur * T * 0.5) - rayon);
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
  }

  // Un halo de lumière en pixels : quatre paliers de plus en plus pâles vers le bord, avec du
  // tramage entre eux (comme dans les jeux 16 bits), un peu aplati (on le voit de biais).
  // Gardé une fois dessiné, pour chaque taille et chaque couleur.
  halo(rayon, couleur) {
    const cle = rayon + ':' + couleur.join(',');
    let img = this.halos.get(cle);
    if (!img) {
      const taille = rayon * 2 + 1;
      img = document.createElement('canvas');
      img.width = img.height = taille;
      const ctx = img.getContext('2d');
      const pixels = ctx.createImageData(taille, taille);
      for (let y = 0; y < taille; y++) {
        for (let x = 0; x < taille; x++) {
          const d = Math.hypot(x - rayon, (y - rayon) * 1.3) / rayon;
          if (d >= 1) continue;
          const v = (1 - d) ** 1.5;                                    // forte au centre, douce au bord
          const palier = Math.floor(v * 4 + tramage(x, y) * 0.9) / 4; // 4 paliers, tramés
          if (palier <= 0) continue;
          const i = (y * taille + x) * 4;
          pixels.data[i] = couleur[0] * 255; pixels.data[i + 1] = couleur[1] * 255; pixels.data[i + 2] = couleur[2] * 255;
          pixels.data[i + 3] = palier * 0.6 * 255;
        }
      }
      ctx.putImageData(pixels, 0, 0);
      this.halos.set(cle, img);
    }
    return img;
  }

  // La nuit : des lucioles (toujours aux mêmes endroits, elles s'allument et s'éteignent
  // doucement), et le cœur des lanternes, qui reste bien lumineux
  lucioles(nuit) {
    const c = this.ectx, l = this.ecran.width, h = this.ecran.height;
    c.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const x = Math.round(grain(i, 3) * l), y = Math.round(grain(i, 7) * h);
      const eclat = Math.max(0, Math.sin(this.temps * (1 + grain(i, 11)) + i * 2.3));
      c.fillStyle = `rgba(210,255,140,${eclat * 0.8 * nuit})`;
      c.fillRect(x + Math.round(Math.sin(this.temps * 0.7 + i) * 3), y + Math.round(Math.cos(this.temps * 0.5 + i) * 2), 1, 1);
    }
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = '#ffe9a0';
    for (const lanterne of this.niveau.lanternes) {
      const p = this.versPixel(lanterne.x, lanterne.y);
      c.fillRect(p.x - 1, p.y - 17, 3, 4);
    }
  }

  // Changer le moment de la journée (les boutons « Ambiance », ou l'atelier des lumières) :
  // les ombres du décor changent de direction, on les repeint
  choisirAmbiance(nom) {
    this.ambiance = nom;
    this.cuireOmbres();
  }

  // ═══════════════════════════════════════════════════════════
  // CE QUI REND LE DÉCOR VIVANT
  // ═══════════════════════════════════════════════════════════
  // Les réglages de l'ambiance affichée (dans ambiances.json)
  reglagesAmbiance() {
    return AMBIANCES_PIXEL[this.ambiance] || AMBIANCES_PIXEL.doree;
  }

  // ── Le vent ──
  // Des rafales qui traversent la carte de gauche à droite : quand une rafale passe sur un
  // arbre, il penche à droite, puis revient un peu à gauche en se redressant. Un petit
  // frisson en plus, pour que deux arbres voisins ne bougent pas tout à fait ensemble.
  // x, y en pixels ; renvoie la force du vent à cet endroit (0 : rien).
  vent(x, y) {
    const force = this.reglagesAmbiance().vent ?? 0.6;
    const onde = Math.sin(this.temps * 1.1 - x * 0.025 - y * 0.008);
    const frisson = Math.sin(this.temps * 4.3 + x * 0.7 + y * 0.31) * 0.22;
    return ((onde > 0 ? onde : onde * 0.45) + frisson) * force;
  }
  // L'image qui va avec le vent : [penchée à gauche, droite, penchée à droite]
  imageVent(images, x, y, seuil = 0.55) {
    const v = this.vent(x, y);
    return images[v > seuil ? 2 : v < -seuil * 0.55 ? 0 : 1];
  }

  // ── L'eau qui bouge ──
  // On repère une fois les pixels d'eau (à chaque redimensionnement), avec leur distance au
  // bord et leur angle autour de l'étang. Ensuite on les repeint 8 fois par seconde : des
  // vaguelettes qui avancent, un liseré d'écume qui tourne le long du bord, et de petits
  // reflets qui s'allument au hasard.
  preparerEau() {
    const l = this.ecran.width, h = this.ecran.height;
    const vus = new Set(), indices = [], bords = [], angles = [], xs = [], ys = [];
    for (const e of this.niveau.etangs) {
      const x0 = Math.max(0, Math.floor((e.x - e.rayon - 1) * T + this.ox)), x1 = Math.min(l - 1, Math.ceil((e.x + e.rayon + 1) * T + this.ox));
      const y0 = Math.max(0, Math.floor((e.y - e.rayon - 1) * T + this.oy)), y1 = Math.min(h - 1, Math.ceil((e.y + e.rayon + 1) * T + this.oy));
      for (let j = y0; j <= y1; j++) {
        for (let i = x0; i <= x1; i++) {
          const wx = i - this.ox, wy = j - this.oy;
          const bord = this.niveau.distanceEtang(wx / T, wy / T); // négatif = dans l'eau
          if (bord >= 0 || vus.has(j * l + i)) continue;
          vus.add(j * l + i);
          indices.push(j * l + i); bords.push(bord); xs.push(wx); ys.push(wy);
          angles.push(Math.atan2(wy / T - e.y, wx / T - e.x));
        }
      }
    }
    const canvas = document.createElement('canvas');
    canvas.width = l;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    this.eau = {
      canvas, ctx, image: ctx.createImageData(l, h), etape: -1,
      indices: Int32Array.from(indices), bords: Float32Array.from(bords), angles: Float32Array.from(angles),
      xs: Int32Array.from(xs), ys: Int32Array.from(ys),
    };
  }

  majEau() {
    const eau = this.eau;
    if (!eau.indices.length) return;
    const etape = Math.floor(this.temps * 8);
    const C = this.reglagesAmbiance().nuit >= 0.5 ? EAU_NUIT : EAU;
    if (etape === eau.etape && C === eau.couleurs) return; // 8 fois par seconde suffisent (c'est du pixel art)
    eau.etape = etape;
    eau.couleurs = C;
    const t = etape / 8, d = eau.image.data;
    for (let k = 0; k < eau.indices.length; k++) {
      const bord = eau.bords[k], wx = eau.xs[k], wy = eau.ys[k];
      let c;
      if (bord > -0.1) c = C.rive; // le bord, plus sombre
      else if (bord > -0.2 && Math.sin(eau.angles[k] * 9 + t * 2.4) > 0.55) c = C.ecume; // l'écume qui tourne
      else {
        // des vaguelettes : des lignes ondulées qui descendent doucement
        const onde = Math.sin(wy * 0.85 + Math.sin(wx * 0.16 + t * 1.2) * 2.4 - t * 2.2);
        c = onde > 0.94 ? C.clair : onde < -0.96 ? C.sombre : bord > -0.32 ? C.bas : C.fond;
        if (grain(wx * 3 + etape * 17, wy * 5) > 0.997) c = C.reflet; // un reflet qui s'allume
      }
      const i = eau.indices[k] * 4;
      d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
    }
    eau.ctx.putImageData(eau.image, 0, 0);
  }

  // ── Les ombres ──
  // Une ombre portée : la silhouette du sprite, couchée sur le sol du côté opposé au soleil.
  // Le « transform » du Canvas fait le travail : un pixel à la hauteur h au-dessus du pied du
  // sprite se retrouve décalé de h × dx vers la droite et de h × dy vers le bas (dx, dy :
  // l'ombre de l'ambiance). Le sprite est donc retourné, penché et écrasé sur le sol.
  ombrePortee(o, img, x, y, ancrageX = 0.5) {
    const { dx, dy } = this.reglagesAmbiance().ombre;
    const bx = Math.round(x), by = Math.round(y);
    o.setTransform(1, 0, -dx, -dy, bx, by);
    o.drawImage(silhouette(img), Math.round(x - img.width * ancrageX) - bx, -img.height);
    o.setTransform(1, 0, 0, 1, 0, 0);
  }

  // L'ombre d'un bâtiment vu de trois quarts (le château) : sa silhouette « balayée »,
  // pixel après pixel, dans la direction de l'ombre, sur toute sa hauteur.
  // zone = [x, y, largeur, hauteur] : seulement une partie du sprite (le donjon, plus haut)
  ombreBalayee(o, img, x, y, hauteur, zone = null) {
    const { dx, dy } = this.reglagesAmbiance().ombre;
    const sil = silhouette(img);
    const [zx, zy, zl, zh] = zone || [0, 0, img.width, img.height];
    const x0 = Math.round(x - img.width * 0.5), y0 = Math.round(y - img.height);
    for (let k = 1; k <= hauteur; k++) o.drawImage(sil, zx, zy, zl, zh, x0 + zx + Math.round(k * dx), y0 + zy + Math.round(k * dy), zl, zh);
  }

  // Les ombres de ce qui ne bouge pas (arbres, rochers, château, lanternes) : peintes une fois
  // pour toutes dans un calque. À refaire quand l'ambiance (donc le soleil) change.
  cuireOmbres() {
    const l = this.ecran.width, h = this.ecran.height;
    this.calqueOmbresFixes ||= document.createElement('canvas');
    this.calqueOmbres ||= document.createElement('canvas');
    for (const calque of [this.calqueOmbresFixes, this.calqueOmbres]) {
      calque.width = l;
      calque.height = h;
      calque.getContext('2d').imageSmoothingEnabled = false; // (changer la taille remet ce réglage à zéro)
    }
    const o = this.calqueOmbresFixes.getContext('2d');
    for (const d of this.decor) {
      const p = this.versPixel(d.x, d.y);
      if (p.x < -60 || p.y < -60 || p.x > l + 60 || p.y > h + 60) continue;
      this.ombrePortee(o, d.img, p.x, p.y + 2);
    }
    const pc = this.versPixel(this.niveau.chateau.x, this.niveau.chateau.y);
    this.ombreBalayee(o, this.sprites.chateau, pc.x - 2, pc.y + 42, 14);                  // les murs
    this.ombreBalayee(o, this.sprites.chateau, pc.x - 2, pc.y + 42, 34, [20, 0, 28, 70]); // le donjon, plus haut
    for (const lanterne of this.niveau.lanternes) {
      const p = this.versPixel(lanterne.x, lanterne.y);
      this.ombrePortee(o, LANTERNE, p.x, p.y + 1);
    }
  }

  // ── Les ombres des nuages ──
  // Un motif de taches sombres, au bord tramé (16 bits oblige), qui se répète sans couture
  // tous les 256 pixels : il suffit de le faire glisser avec le vent.
  creerNuages() {
    const P = 256;
    const c = document.createElement('canvas');
    c.width = c.height = P;
    const ctx = c.getContext('2d');
    const pixels = ctx.createImageData(P, P);
    for (let y = 0; y < P; y++) {
      for (let x = 0; x < P; x++) {
        const n = (bruitPeriodique(x, y, P) - 0.56) / 0.06; // au-dessus de 1 : plein ; entre 0 et 1 : tramé
        if (n <= 0 || (n < 1 && tramage(x, y) > n)) continue;
        const i = (y * P + x) * 4;
        pixels.data[i] = 26; pixels.data[i + 1] = 30; pixels.data[i + 2] = 64; pixels.data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    this.motifNuages = c;
  }

  dessinerNuages(force) {
    const c = this.ectx;
    this.patternNuages ||= c.createPattern(this.motifNuages, 'repeat');
    const dx = Math.round(this.temps * 6) % 256, dy = Math.round(this.temps * 2) % 256;
    c.save();
    c.globalAlpha = force;
    c.translate(dx, dy);
    c.fillStyle = this.patternNuages;
    c.fillRect(-dx, -dy, this.ecran.width, this.ecran.height);
    c.restore();
  }

  // ── Les drapeaux du château, qui flottent ──
  dessinerDrapeaux(pc) {
    const x0 = Math.round(pc.x - 2 - this.sprites.chateau.width / 2), y0 = pc.y + 42 - this.sprites.chateau.height; // le coin du château
    const i = Math.floor(this.temps * 5) % 3;
    this.ectx.drawImage(DRAPEAU[i], x0 + 33, y0 + 5);
    this.ectx.drawImage(PETIT_DRAPEAU[(i + 1) % 3], x0 + 6, y0 + 81);
  }

  // ── La vie autour : des oiseaux qui passent, des papillons, des feuilles qui tombent ──
  majVie(dt) {
    const a = this.reglagesAmbiance(), jour = 1 - Math.min(1, a.nuit);
    const l = this.ecran.width, h = this.ecran.height;
    // de temps en temps, une petite volée d'oiseaux traverse la carte (le jour seulement)
    this.prochainsOiseaux = (this.prochainsOiseaux ?? 5) - dt;
    if (this.prochainsOiseaux <= 0) {
      this.prochainsOiseaux = 16 + Math.random() * 20;
      if (jour > 0.5) {
        const sens = Math.random() < 0.5 ? 1 : -1, y = h * (0.15 + Math.random() * 0.6), n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
          const rang = Math.ceil(i / 2), cote = i % 2 ? 1 : -1; // en V : le premier devant, les autres de chaque côté
          this.oiseaux.push({ x: (sens > 0 ? -12 : l + 12) - sens * rang * 8, y: y + cote * rang * 5, vx: sens * 24, haut: 38 + Math.random() * 6, phase: Math.random() * 6, sens });
        }
      }
    }
    for (const oiseau of this.oiseaux) oiseau.x += oiseau.vx * dt;
    this.oiseaux = this.oiseaux.filter((oiseau) => oiseau.x > -60 && oiseau.x < l + 60);

    // les papillons volettent d'une fleur à l'autre (le jour)
    const fleurs = this.herbes.filter((herbe) => herbe.fleur);
    if (!this.papillons && fleurs.length) {
      this.papillons = ['#ffffff', '#ffe14a', '#ff9ab8', '#9ad0ff', '#ffffff', '#ffb04a'].map((couleur, i) => {
        const fleur = fleurs[Math.floor(grain(i, 41) * fleurs.length)];
        return { x: fleur.x * T, y: fleur.y * T, cible: null, couleur, phase: i * 1.3, pause: 0 };
      });
    }
    for (const pap of this.papillons || []) {
      if (pap.pause > 0) { pap.pause -= dt; continue; }  // posé sur une fleur
      if (!pap.cible) {
        const fleur = fleurs[Math.floor(Math.random() * fleurs.length)];
        if (Math.hypot(fleur.x * T - pap.x, fleur.y * T - pap.y) < 90) pap.cible = { x: fleur.x * T, y: fleur.y * T - 3 };
        continue;
      }
      const dx = pap.cible.x - pap.x, dy = pap.cible.y - pap.y, dist = Math.hypot(dx, dy);
      if (dist < 2) { pap.cible = null; pap.pause = 1 + Math.random() * 2.5; continue; }
      const v = 16 * dt;
      pap.x += (dx / dist) * v + Math.sin(this.temps * 9 + pap.phase) * 0.5;
      pap.y += (dy / dist) * v + Math.cos(this.temps * 7 + pap.phase) * 0.4;
    }

    // les feuilles des arbres d'automne tombent en se balançant, puis restent un peu par terre
    this.prochaineFeuille = (this.prochaineFeuille ?? 0) - dt * (a.vent ?? 0.6);
    if (this.prochaineFeuille <= 0 && this.arbresAutomne.length && jour > 0.3) {
      this.prochaineFeuille = 0.3 + Math.random() * 0.5;
      const arbre = this.arbresAutomne[Math.floor(Math.random() * this.arbresAutomne.length)];
      const p = this.versPixel(arbre.x, arbre.y);
      if (p.x > -20 && p.y > -20 && p.x < l + 20 && p.y < h + 30 && this.feuillesQuiTombent.length < 40) {
        this.feuillesQuiTombent.push({
          x: p.x + (Math.random() - 0.5) * 14, y: p.y + 2 + Math.random() * 4, z: 12 + Math.random() * 12,
          couleur: FEUILLAGES.automne[Math.floor(Math.random() * 3)], vie: Math.random() * 6, posee: 0,
        });
      }
    }
    for (const f of this.feuillesQuiTombent) {
      f.vie += dt;
      if (f.z > 0) {
        f.z = Math.max(0, f.z - dt * 8);
        f.x += ((a.vent ?? 0.6) * 7 + Math.sin(f.vie * 3.5) * 9) * dt;
      } else {
        f.posee += dt;
      }
    }
    this.feuillesQuiTombent = this.feuillesQuiTombent.filter((f) => f.posee < 2.5);
  }

  dessinerVie() {
    const c = this.ectx;
    const nuit = Math.min(1, this.reglagesAmbiance().nuit);
    // les feuilles (une fois posées, elles clignotent avant de disparaître)
    for (const f of this.feuillesQuiTombent) {
      if (f.posee > 1.6 && Math.floor(f.posee * 10) % 2) continue;
      c.fillStyle = f.couleur;
      c.fillRect(Math.round(f.x), Math.round(f.y - f.z), 1, 1);
    }
    // les papillons : les ailes ouvertes (3 pixels), puis fermées (1 pixel)
    if (nuit < 0.5) {
      for (const pap of this.papillons || []) {
        const ouvert = pap.pause > 0 ? Math.floor(this.temps * 2 + pap.phase) % 2 : Math.floor(this.temps * 12 + pap.phase) % 2;
        const x = Math.round(pap.x), y = Math.round(pap.y - (pap.pause > 0 ? 1 : 4 + Math.sin(this.temps * 5 + pap.phase) * 2));
        c.fillStyle = pap.couleur;
        if (ouvert) { c.fillRect(x - 1, y, 1, 1); c.fillRect(x + 1, y, 1, 1); c.fillStyle = '#3a2a30'; c.fillRect(x, y, 1, 1); }
        else c.fillRect(x, y, 1, 1);
      }
    }
    // les oiseaux, tout en haut (ils planent de temps en temps)
    for (const oiseau of this.oiseaux) {
      const plane = Math.sin(this.temps * 0.9 + oiseau.phase) > 0.4;
      const img = OISEAU[plane ? 0 : Math.floor(this.temps * 7 + oiseau.phase) % 2];
      c.drawImage(img, Math.round(oiseau.x) - 3, Math.round(oiseau.y - oiseau.haut));
    }
  }

  // ── API ──
  socleSous(px, py) {
    const r = this.canvas.getBoundingClientRect();
    const ix = ((px - r.left) * this.dpr) / this.echelle, iy = ((py - r.top) * this.dpr) / this.echelle;
    const i = socleProche(this.niveau.socles, (ix - this.ox) / T, (iy - this.oy - 2) / T, 0.75);
    return i >= 0 && (!this.partie || socleActif(this.partie, i)) ? i : -1; // (pas un socle bonus endormi)
  }

  // Le point du sol (en cases) sous un point de l'écran (pour viser le Météore)
  versSol(px, py) {
    const r = this.canvas.getBoundingClientRect();
    const ix = ((px - r.left) * this.dpr) / this.echelle, iy = ((py - r.top) * this.dpr) / this.echelle;
    return { x: (ix - this.ox) / T, y: (iy - this.oy) / T };
  }

  versEcran(x, y, hauteur = 0) {
    const r = this.canvas.getBoundingClientRect();
    const p = this.versPixel(x, y - hauteur);
    return { x: r.left + (p.x * this.echelle) / this.dpr, y: r.top + (p.y * this.echelle) / this.dpr };
  }

  redimensionner() {
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    const l = (this.conteneur.clientWidth || innerWidth) * this.dpr;
    const h = (this.conteneur.clientHeight || innerHeight) * this.dpr;
    this.canvas.width = l;
    this.canvas.height = h;
    // le plus grand agrandissement entier qui fait tenir la carte (avec de la place pour les barres)
    const { largeur, hauteur } = this.niveau;
    this.echelle = Math.max(1, Math.floor(Math.min(l / (largeur * T + 8), h / (hauteur * T / 0.82))));
    // (au moins 1 pixel : une page encore cachée peut avoir une taille nulle, et une image de 0 pixel plante)
    this.ecran.width = Math.max(1, Math.ceil(l / this.echelle));
    this.ecran.height = Math.max(1, Math.ceil(h / this.echelle));
    this.ox = Math.round((this.ecran.width - largeur * T) / 2);
    this.oy = Math.round((this.ecran.height - hauteur * T) / 2);
    this.ectx.imageSmoothingEnabled = false;
    this.peindreSol();
  }

  detruire() {
    this.canvas.remove();
  }
}
