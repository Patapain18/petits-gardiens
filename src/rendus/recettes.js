// ─────────────────────────────────────────────────────────────
// LES RECETTES DES TEXTURES
// Une texture de 16 × 16 pixels n'est pas dessinée à la main : elle est
// fabriquée à partir d'une recette (src/rendus/textures.json), un peu comme
// un gâteau. Une recette donne :
// - des RAMPES : des listes de couleurs (« vert » : cinq verts, « terre » :
//   quatre bruns…), si possible rangées du plus sombre au plus clair ;
// - des COUCHES, posées l'une après l'autre : d'abord un fond (chaque pixel
//   prend une couleur au hasard dans une rampe), puis des taches, des joints
//   de briques, des brins d'herbe, la lumière qui vient d'en haut… ;
// - combien de VARIANTES fabriquer (la même recette, avec un autre hasard), et
//   si un bloc a le droit de TOURNER ou de RETOURNER sa texture : sur un grand
//   terrain, l'œil ne voit plus que c'est toujours la même image.
//
// Ce fichier ne connaît ni Three.js ni le navigateur : il remplit un tableau
// de pixels (rouge, vert, bleu, opacité). Le style voxel en fait ses textures ;
// l'atelier des textures (textures.html) les montre en grand et les mesure.
// ─────────────────────────────────────────────────────────────
import { creerAleatoire } from '../jeu/aleatoire.js';

export const TAILLE = 16; // une texture fait 16 × 16 pixels, comme dans Minecraft

const lisser = (t) => t * t * (3 - 2 * t);
const enRVB = (couleur) => [1, 3, 5].map((i) => parseInt(couleur.slice(i, i + 2), 16));
// La clarté d'une couleur, de 0 (noir) à 1 (blanc) : l'œil voit le vert bien plus clair que le bleu
export const clarte = (r, g, b) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

// Le nombre de départ du hasard, tiré du nom de la texture, de sa variante et du numéro de la
// couche : chaque couche a son propre hasard. Changer le réglage d'une couche ne change donc pas
// les autres (sinon, toute la texture bougerait pendant qu'on règle un curseur).
function graine(...morceaux) {
  let h = 2166136261;
  for (const lettre of morceaux.join(':')) h = Math.imul(h ^ lettre.charCodeAt(0), 16777619);
  return h >>> 0;
}

// Un bruit doux qui « fait le tour » : son bord droit se raccorde à son bord gauche, et le haut au
// bas. Une texture qui s'en sert se répète donc sans couture. taille : la taille des bosses, en pixels.
// Le bruit est calculé à partir d'une grille de valeurs au hasard :
// - celles du bord de la grille (la première colonne et la première rangée) viennent d'un hasard
//   commun à TOUTES les variantes (o.hasardBords), et elles sont symétriques (le bord se lit pareil
//   dans les deux sens, et pareil en colonne qu'en rangée). Deux variantes posées côte à côte se
//   raccordent donc, même quand l'une des deux est tournée ou retournée : pas de couture ;
// - celles du milieu changent d'une variante à l'autre (o.hasard).
// On regarde le bruit au centre de chaque pixel (x + 0,5) : tourner la texture d'un quart de tour
// tombe alors juste sur la grille.
function bruitRaccord(o, taille) {
  const n = Math.max(2, Math.round(TAILLE / taille)); // combien de bosses sur la largeur
  const bord = Array.from({ length: Math.floor(n / 2) + 1 }, () => o.hasardBords());
  const milieu = Array.from({ length: n * n }, () => o.hasard());
  const valeur = (i, j) => {
    const ci = ((i % n) + n) % n, cj = ((j % n) + n) % n;
    if (ci === 0) return bord[Math.min(cj, n - cj)];
    if (cj === 0) return bord[Math.min(ci, n - ci)];
    return milieu[cj * n + ci];
  };
  return (x, y) => {
    const gx = ((x + 0.5) / TAILLE) * n, gy = ((y + 0.5) / TAILLE) * n;
    const i = Math.floor(gx), j = Math.floor(gy);
    const fx = lisser(gx - i), fy = lisser(gy - j);
    const haut = valeur(i, j) + (valeur(i + 1, j) - valeur(i, j)) * fx;
    const bas = valeur(i, j + 1) + (valeur(i + 1, j + 1) - valeur(i, j + 1)) * fx;
    return haut + (bas - haut) * fy;
  };
}

// L'image en train d'être fabriquée. x et y « font le tour » eux aussi : un brin d'herbe qui
// dépasse en haut ressort en bas, comme sur le bloc d'à côté.
function nouvelleImage() {
  const pixels = new Uint8ClampedArray(TAILLE * TAILLE * 4); // tout transparent au départ
  const indice = (x, y) => ((((y % TAILLE) + TAILLE) % TAILLE) * TAILLE + (((x % TAILLE) + TAILLE) % TAILLE)) * 4;
  return {
    pixels,
    poser(x, y, [r, g, b]) {
      const i = indice(x, y);
      pixels.set([r, g, b, 255], i);
    },
    effacer(x, y) { pixels[indice(x, y) + 3] = 0; },
    // plus clair (facteur > 1) ou plus sombre (facteur < 1) ; le tableau s'arrête tout seul à 255
    teinter(x, y, facteur) {
      const i = indice(x, y);
      for (let k = 0; k < 3; k++) pixels[i + k] = Math.round(pixels[i + k] * facteur);
    },
  };
}

// ═════════════════════════════════════════════════════════════
// LES SORTES DE COUCHES
// Pour chacune : son nom dans l'atelier, une aide, ses réglages (« rampe » : le nom d'une rampe
// de la recette ; « liste » : une liste de nombres ; [min, max, pas] : un curseur), les réglages
// d'une couche toute neuve, et ce qu'elle fait à l'image.
// Les outils o : o.hasard() (un nombre entre 0 et 1), o.choisir(rampe) (une couleur au hasard
// dans la rampe), o.rampe(rampe) (toutes ses couleurs, dans l'ordre), et o.hasardBords() (le
// hasard commun à toutes les variantes, pour les bords du bruit : voir bruitRaccord).
// ═════════════════════════════════════════════════════════════
const PARTOUT = (fonction) => { for (let y = 0; y < TAILLE; y++) for (let x = 0; x < TAILLE; x++) fonction(x, y); };

export const COUCHES = {
  hasard: {
    nom: 'Couleurs au hasard',
    aide: 'Chaque pixel prend une couleur au hasard dans la rampe. « Part » : la part des pixels touchés (1 = tous).',
    reglages: { rampe: 'rampe', part: [0, 1, 0.01] },
    neuve: { part: 1 },
    fabriquer(img, { rampe, part }, o) {
      PARTOUT((x, y) => { if (o.hasard() < part) img.poser(x, y, o.choisir(rampe)); });
    },
  },
  frange: {
    nom: 'Frange en haut',
    aide: 'Une bande en haut de la texture, plus ou moins haute d’une colonne à l’autre : l’herbe qui déborde sur le côté d’un bloc. « Ombre » assombrit le dernier pixel de chaque colonne (l’herbe fait de l’ombre à la terre).',
    reglages: { rampe: 'rampe', min: [0, 16, 1], max: [0, 16, 1], ombre: [0, 0.6, 0.01] },
    neuve: { min: 2, max: 4, ombre: 0 },
    fabriquer(img, { rampe, min, max, ombre }, o) {
      for (let x = 0; x < TAILLE; x++) {
        const hauteur = min + Math.floor(o.hasard() * (Math.max(min, max) - min + 1));
        for (let y = 0; y < hauteur; y++) img.poser(x, y, o.choisir(rampe));
        if (hauteur > 0 && ombre > 0) img.teinter(x, hauteur - 1, 1 - ombre);
      }
    },
  },
  taches: {
    nom: 'Taches',
    aide: 'Des taches douces, qui se raccordent d’un bloc à l’autre. « Taille » : leur taille en pixels ; plus le « seuil » est haut, moins il y en a ; « vers le haut » les fait monter (ou descendre, si c’est négatif).',
    reglages: { rampe: 'rampe', taille: [2, 8, 1], seuil: [0, 1, 0.01], haut: [-0.5, 0.5, 0.01] },
    neuve: { taille: 4, seuil: 0.55, haut: 0 },
    fabriquer(img, { rampe, taille, seuil, haut }, o) {
      const bruit = bruitRaccord(o, taille);
      PARTOUT((x, y) => { if (bruit(x, y) + haut * (1 - (2 * y) / (TAILLE - 1)) > seuil) img.poser(x, y, o.choisir(rampe)); });
    },
  },
  briques: {
    nom: 'Joints de briques',
    aide: 'Des rangées de briques décalées d’une rangée à l’autre : les joints prennent les couleurs de la rampe. « Nuances » : chaque brique est un peu plus claire ou plus sombre que sa voisine ; « relief » : le haut et la gauche de chaque brique s’éclairent, le bas et la droite s’assombrissent.',
    reglages: { rampe: 'rampe', hauteur: [2, 8, 1], largeur: [2, 16, 1], nuances: [0, 0.4, 0.01], relief: [0, 0.5, 0.01] },
    neuve: { hauteur: 4, largeur: 8, nuances: 0, relief: 0 },
    fabriquer(img, { rampe, hauteur, largeur, nuances, relief }, o) {
      const facteurs = new Map(); // la nuance de chaque brique (rangée, numéro dans la rangée)
      PARTOUT((x, y) => {
        const rangee = Math.floor(y / hauteur);
        const decale = rangee % 2 ? Math.floor(largeur / 2) : 0;
        const dx = (x + decale) % TAILLE % largeur, dy = y % hauteur; // la place du pixel dans sa brique
        if (dy === hauteur - 1 || dx === largeur - 1) { img.poser(x, y, o.choisir(rampe)); return; }
        const brique = `${rangee}:${Math.floor(((x + decale) % TAILLE) / largeur)}`;
        if (!facteurs.has(brique)) facteurs.set(brique, 1 + (o.hasard() - 0.5) * 2 * nuances);
        let facteur = facteurs.get(brique);
        if (dy === 0) facteur *= 1 + relief; else if (dy === hauteur - 2) facteur *= 1 - relief;
        if (dx === 0) facteur *= 1 + relief / 2; else if (dx === largeur - 2) facteur *= 1 - relief / 2;
        img.teinter(x, y, facteur);
      });
    },
  },
  rangees: {
    nom: 'Rangées',
    aide: 'Une ligne toutes les « pas » rangées : les planches, les tuiles du toit.',
    reglages: { rampe: 'rampe', pas: [2, 16, 1], depart: [0, 15, 1] },
    neuve: { pas: 4, depart: 0 },
    fabriquer(img, { rampe, pas, depart }, o) {
      PARTOUT((x, y) => { if (y % pas === depart % pas) img.poser(x, y, o.choisir(rampe)); });
    },
  },
  colonnes: {
    nom: 'Colonnes',
    aide: 'Une ligne toutes les « pas » colonnes : les fibres d’un tronc.',
    reglages: { rampe: 'rampe', pas: [2, 16, 1], depart: [0, 15, 1] },
    neuve: { pas: 4, depart: 0 },
    fabriquer(img, { rampe, pas, depart }, o) {
      PARTOUT((x, y) => { if (x % pas === depart % pas) img.poser(x, y, o.choisir(rampe)); });
    },
  },
  diagonales: {
    nom: 'Traits en biais',
    aide: 'De petits traits en biais, comme l’écorce d’un bouleau : un pixel est touché quand (y × a + x × b), divisé par « pas », a un reste plus petit que « épaisseur ».',
    reglages: { rampe: 'rampe', a: [0, 16, 1], b: [0, 16, 1], pas: [2, 32, 1], epaisseur: [1, 8, 1], part: [0, 1, 0.01] },
    neuve: { a: 7, b: 3, pas: 11, epaisseur: 2, part: 0.7 },
    fabriquer(img, { rampe, a, b, pas, epaisseur, part }, o) {
      PARTOUT((x, y) => { if ((y * a + x * b) % pas < epaisseur && o.hasard() < part) img.poser(x, y, o.choisir(rampe)); });
    },
  },
  bord: {
    nom: 'Cadre',
    aide: 'Un cadre tout autour de la texture (la lanterne).',
    reglages: { rampe: 'rampe', epaisseur: [1, 7, 1] },
    neuve: { epaisseur: 2 },
    fabriquer(img, { rampe, epaisseur }, o) {
      PARTOUT((x, y) => {
        if (x < epaisseur || y < epaisseur || x >= TAILLE - epaisseur || y >= TAILLE - epaisseur) img.poser(x, y, o.choisir(rampe));
      });
    },
  },
  trous: {
    nom: 'Trous',
    aide: 'Des pixels transparents : les feuilles laissent passer la lumière. À poser en dernier. « Taille » 1 : des pixels isolés, au hasard ; plus grand : des trous groupés, en taches de cette taille (« part » est alors le seuil).',
    reglages: { part: [0, 1, 0.01], taille: [1, 8, 1] },
    neuve: { part: 0.16, taille: 1 },
    fabriquer(img, { part, taille }, o) {
      if (taille <= 1) { PARTOUT((x, y) => { if (o.hasard() < part) img.effacer(x, y); }); return; }
      const bruit = bruitRaccord(o, taille);
      PARTOUT((x, y) => { if (bruit(x, y) < part) img.effacer(x, y); });
    },
  },
  vagues: {
    nom: 'Vagues',
    aide: 'Des vaguelettes (l’eau). La rampe va du plus sombre au plus clair ; les « seuils » disent où l’on passe d’une couleur à la suivante (une couleur de plus que de seuils) ; « hasard » brouille les vagues avec des taches douces. Les vagues font un nombre entier d’ondulations sur la largeur : elles se raccordent d’un bloc à l’autre.',
    reglages: { rampe: 'rampe', seuils: 'liste', hasard: [0, 2, 0.05] },
    neuve: { seuils: [-1.2, 0.35, 1.25], hasard: 0.5 },
    fabriquer(img, { rampe, seuils, hasard }, o) {
      const couleurs = o.rampe(rampe), bruit = bruitRaccord(o, 4), tour = (2 * Math.PI) / TAILLE;
      PARTOUT((x, y) => {
        const v = Math.sin(tour * (2 * x + y)) + Math.sin(tour * (x - 2 * y) + 1.7) + (bruit(x, y) - 0.5) * 2 * hasard;
        let k = 0;
        while (k < seuils.length && v > seuils[k]) k++;
        img.poser(x, y, couleurs[Math.min(k, couleurs.length - 1)]);
      });
    },
  },
  lames: {
    nom: 'Planches',
    aide: 'Des planches posées en rangées : chacune a sa nuance (« nuances »), un joint (la rampe) en bas, et un raccord vertical à un endroit au hasard.',
    reglages: { rampe: 'rampe', hauteur: [2, 8, 1], nuances: [0, 0.4, 0.01] },
    neuve: { hauteur: 4, nuances: 0.1 },
    fabriquer(img, { rampe, hauteur, nuances }, o) {
      for (let haut = 0; haut < TAILLE; haut += hauteur) {
        const facteur = 1 + (o.hasard() - 0.5) * 2 * nuances, raccord = Math.floor(o.hasard() * TAILLE);
        for (let y = haut; y < Math.min(TAILLE, haut + hauteur); y++) {
          for (let x = 0; x < TAILLE; x++) {
            if (y === haut + hauteur - 1 || x === raccord) img.poser(x, y, o.choisir(rampe));
            else img.teinter(x, y, facteur);
          }
        }
      }
    },
  },
  traits: {
    nom: 'Traits',
    aide: 'De petits traits droits, debout (« sens » 0) ou couchés (« sens » 1), d’une longueur au hasard jusqu’à « longueur » : les fibres d’une écorce, le fil du bois, les marques du bouleau.',
    reglages: { rampe: 'rampe', nombre: [0, 60, 1], longueur: [1, 16, 1], sens: [0, 1, 1] },
    neuve: { nombre: 10, longueur: 3, sens: 0 },
    fabriquer(img, { rampe, nombre, longueur, sens }, o) {
      for (let i = 0; i < nombre; i++) {
        const x0 = Math.floor(o.hasard() * TAILLE), y0 = Math.floor(o.hasard() * TAILLE);
        const couleur = o.choisir(rampe), l = 1 + Math.floor(o.hasard() * longueur);
        for (let k = 0; k < l; k++) img.poser(sens ? x0 + k : x0, sens ? y0 : y0 + k, couleur);
      }
    },
  },
  degrade: {
    nom: 'Dégradé',
    aide: 'Le haut de la texture s’éclaircit et le bas s’assombrit (ou l’inverse, si la force est négative).',
    reglages: { force: [-0.5, 0.5, 0.01] },
    neuve: { force: 0.1 },
    fabriquer(img, { force }) {
      PARTOUT((x, y) => img.teinter(x, y, 1 + force * (1 - (2 * y) / (TAILLE - 1))));
    },
  },
  halo: {
    nom: 'Halo',
    aide: 'Le centre de la texture s’éclaire, de moins en moins jusqu’au « rayon » : la lumière d’une lanterne.',
    reglages: { force: [0, 1, 0.01], rayon: [2, 12, 0.5] },
    neuve: { force: 0.3, rayon: 7 },
    fabriquer(img, { force, rayon }) {
      const centre = (TAILLE - 1) / 2;
      PARTOUT((x, y) => {
        const d = Math.sqrt((x - centre) ** 2 + (y - centre) ** 2);
        if (d < rayon) img.teinter(x, y, 1 + force * (1 - d / rayon));
      });
    },
  },
  relief: {
    nom: 'Lumière d’en haut',
    aide: 'Le relief : le haut de chaque bosse s’éclaire et le bas s’assombrit, comme sous le soleil. « Taille » : la taille des bosses ; « force » : de combien éclaircir ou assombrir ; « seuil » : à partir de quelle pente.',
    reglages: { taille: [2, 8, 1], force: [0, 0.6, 0.01], seuil: [0, 0.3, 0.01] },
    neuve: { taille: 4, force: 0.12, seuil: 0.04 },
    fabriquer(img, { taille, force, seuil }, o) {
      const hauteur = bruitRaccord(o, taille);
      // la pente vers le bas : positive, le pixel est plus haut que celui du dessus (il regarde le soleil)
      PARTOUT((x, y) => {
        const pente = hauteur(x, y) - hauteur(x, y - 1);
        if (pente > seuil) img.teinter(x, y, 1 + force);
        else if (pente < -seuil) img.teinter(x, y, 1 - force);
      });
    },
  },
  brins: {
    nom: 'Brins',
    aide: 'Des brins d’herbe : un petit trait de la première couleur de la rampe (la plus sombre), et la dernière couleur (la plus claire) à la pointe, éclairée par le soleil.',
    reglages: { rampe: 'rampe', nombre: [0, 60, 1], longueur: [1, 4, 1] },
    neuve: { nombre: 14, longueur: 1 },
    fabriquer(img, { rampe, nombre, longueur }, o) {
      const couleurs = o.rampe(rampe);
      for (let i = 0; i < nombre; i++) {
        const x = Math.floor(o.hasard() * TAILLE), y = Math.floor(o.hasard() * TAILLE);
        for (let k = 0; k < longueur; k++) img.poser(x, y + k, couleurs[0]);
        img.poser(x, y - 1, couleurs[couleurs.length - 1]);
      }
    },
  },
  cailloux: {
    nom: 'Cailloux',
    aide: 'De petits cailloux : la rampe va de l’ombre (posée en bas à droite) à la lumière (le coin en haut à gauche), le caillou lui-même prend la deuxième couleur.',
    reglages: { rampe: 'rampe', nombre: [0, 30, 1], taille: [1, 4, 1] },
    neuve: { nombre: 6, taille: 2 },
    fabriquer(img, { rampe, nombre, taille }, o) {
      const couleurs = o.rampe(rampe);
      const ombre = couleurs[0], corps = couleurs[Math.min(1, couleurs.length - 1)], lumiere = couleurs[couleurs.length - 1];
      for (let i = 0; i < nombre; i++) {
        const x0 = Math.floor(o.hasard() * TAILLE), y0 = Math.floor(o.hasard() * TAILLE);
        for (let dy = 0; dy < taille; dy++) for (let dx = 0; dx < taille; dx++) img.poser(x0 + dx + 1, y0 + dy + 1, ombre);
        for (let dy = 0; dy < taille; dy++) for (let dx = 0; dx < taille; dx++) img.poser(x0 + dx, y0 + dy, corps);
        img.poser(x0, y0, lumiere);
      }
    },
  },
  fissures: {
    nom: 'Fissures',
    aide: 'Des fissures : de petits chemins sombres (la première couleur de la rampe) qui serpentent.',
    reglages: { rampe: 'rampe', nombre: [0, 12, 1], longueur: [2, 16, 1] },
    neuve: { nombre: 3, longueur: 6 },
    fabriquer(img, { rampe, nombre, longueur }, o) {
      const sombre = o.rampe(rampe)[0];
      for (let i = 0; i < nombre; i++) {
        let x = Math.floor(o.hasard() * TAILLE), y = Math.floor(o.hasard() * TAILLE);
        const debout = o.hasard() < 0.5; // une fissure plutôt verticale, ou plutôt horizontale
        for (let k = 0; k < longueur; k++) {
          img.poser(x, y, sombre);
          const ecart = o.hasard() < 0.35 ? (o.hasard() < 0.5 ? -1 : 1) : 0;
          if (debout) { y++; x += ecart; } else { x++; y += ecart; }
        }
      }
    },
  },
};

// ═════════════════════════════════════════════════════════════
// FABRIQUER UNE TEXTURE
// ═════════════════════════════════════════════════════════════
// Renvoie { largeur, hauteur, pixels } : 16 × 16 pixels de 4 nombres (rouge, vert, bleu, opacité).
// nom : le nom de la texture (pour son hasard) ; variante : 0, 1, 2… (la même recette, un autre hasard).
export function fabriquerTexture(recette, nom, variante = 0) {
  const img = nouvelleImage();
  const rampes = Object.fromEntries(Object.entries(recette.rampes).map(([n, couleurs]) => [n, couleurs.map(enRVB)]));
  recette.couches.forEach((couche, i) => {
    const sorte = COUCHES[couche.type];
    if (!sorte) return; // une sorte de couche inconnue : on la passe
    const hasard = creerAleatoire(graine(nom, variante, i));
    const hasardBords = creerAleatoire(graine(nom, 'bords', i)); // le même pour toutes les variantes
    const rampe = (n) => rampes[n] || [[255, 0, 255]]; // une rampe qui manque : du magenta, bien visible
    // un réglage absent (une recette écrite avant qu'il existe) prend la valeur d'une couche neuve
    const reglages = { ...sorte.neuve, ...couche };
    sorte.fabriquer(img, reglages, { hasard, hasardBords, rampe, choisir: (n) => { const r = rampe(n); return r[Math.floor(hasard() * r.length)]; } });
  });
  return { largeur: TAILLE, hauteur: TAILLE, pixels: img.pixels };
}

// L'aspect d'une face de bloc : sa variante, de combien de quarts de tour elle tourne, et si elle
// est retournée (comme dans un miroir). Il est tiré d'un « hachage » de la place de la face : la
// même face a toujours le même aspect, dans le jeu comme dans l'atelier.
export function aspectDeLaFace(recette, bx, by, bz, face = 0) {
  let h = Math.imul(bx, 73856093) ^ Math.imul(by, 19349663) ^ Math.imul(bz, 83492791) ^ Math.imul(face + 1, 2654435761);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return {
    variante: h % (recette.variantes || 1),
    quarts: recette.tourner ? (h >>> 8) % 4 : 0,
    miroir: recette.miroir ? ((h >>> 12) & 1) === 1 : false,
  };
}

// Les coordonnées dans la texture (u, v, de 0 à 1) d'un coin de face, une fois la face
// retournée puis tournée
export function placerUV(u, v, { quarts, miroir }) {
  if (miroir) u = 1 - u;
  for (let q = 0; q < quarts; q++) [u, v] = [v, 1 - u];
  return [u, v];
}

// Un morceau de terrain : blocs × blocs faces, chacune avec son aspect (pour voir dans l'atelier ce
// que donne un grand sol, pour mesurer les coutures, et pour l'eau des étangs). Avec « dessous »
// ({ recette, nom }), c'est un mur : la première rangée a la texture choisie, les autres celle du
// dessous (sous le côté de l'herbe, de la terre). Renvoie { largeur, hauteur, pixels }.
export function assemblerTerrain(recette, nom, blocs = 4, dessous = null) {
  const lesVariantes = (r, n) => Array.from({ length: r.variantes || 1 }, (_, v) => fabriquerTexture(r, n, v).pixels);
  const variantes = lesVariantes(recette, nom), variantesDessous = dessous && lesVariantes(dessous.recette, dessous.nom);
  const cote = blocs * TAILLE;
  const pixels = new Uint8ClampedArray(cote * cote * 4);
  for (let bz = 0; bz < blocs; bz++) {
    for (let bx = 0; bx < blocs; bx++) {
      const enDessous = dessous && bz > 0;
      const aspect = aspectDeLaFace(enDessous ? dessous.recette : recette, bx, 0, bz, 2);
      const source = (enDessous ? variantesDessous : variantes)[aspect.variante];
      for (let y = 0; y < TAILLE; y++) {
        for (let x = 0; x < TAILLE; x++) {
          // le pixel de la texture qui tombe ici, d'après les mêmes calculs que les coins des faces
          const [u, v] = placerUV((x + 0.5) / TAILLE, (y + 0.5) / TAILLE, aspect);
          const s = (Math.floor(v * TAILLE) * TAILLE + Math.floor(u * TAILLE)) * 4;
          const d = ((bz * TAILLE + y) * cote + bx * TAILLE + x) * 4;
          pixels.set(source.subarray(s, s + 4), d);
        }
      }
    }
  }
  return { largeur: cote, hauteur: cote, pixels };
}

// ═════════════════════════════════════════════════════════════
// LES MESURES (pour ne pas se fier seulement à ses yeux)
// - taches : la ressemblance entre un pixel et son voisin (de 0 à 1). 0 : chaque pixel est
//   tiré indépendamment des autres, comme une télé sans signal ; plus haut, les pixels se
//   regroupent en taches ; 1 : un aplat ;
// - coutures : sur un grand terrain, l'écart de clarté entre deux pixels de part et d'autre du
//   bord d'un bloc, comparé à l'écart entre deux pixels voisins à l'intérieur. Vers 1 : on ne
//   voit pas les bords des blocs ; nettement plus : on voit un quadrillage ;
// - aspects : combien d'aspects différents un bloc peut prendre (variantes × tours × miroir) ;
// - couleurs : combien de couleurs différentes ; clarte : la clarté moyenne (de 0 à 1).
// ═════════════════════════════════════════════════════════════
function clartes(pixels) {
  const l = new Float32Array(pixels.length / 4);
  for (let i = 0; i < l.length; i++) l[i] = pixels[i * 4 + 3] ? clarte(pixels[i * 4], pixels[i * 4 + 1], pixels[i * 4 + 2]) : NaN;
  return l;
}

export function mesurerTexture(recette, nom) {
  const images = Array.from({ length: recette.variantes || 1 }, (_, v) => fabriquerTexture(recette, nom, v).pixels);
  // la clarté moyenne, la couleur moyenne et les couleurs différentes (pixels opaques seulement)
  const differentes = new Set();
  let somme = 0, n = 0;
  const moyenne = [0, 0, 0];
  for (const p of images) {
    for (let i = 0; i < p.length; i += 4) {
      if (!p[i + 3]) continue;
      differentes.add((p[i] << 16) | (p[i + 1] << 8) | p[i + 2]);
      somme += clarte(p[i], p[i + 1], p[i + 2]);
      for (let k = 0; k < 3; k++) moyenne[k] += p[i + k];
      n++;
    }
  }
  const m = n ? somme / n : 0;
  // les taches : la corrélation entre chaque pixel et son voisin de droite, puis du dessous
  let covariance = 0, variance = 0;
  for (const p of images) {
    const l = clartes(p);
    for (let y = 0; y < TAILLE; y++) {
      for (let x = 0; x < TAILLE; x++) {
        const a = l[y * TAILLE + x];
        for (const b of [l[y * TAILLE + ((x + 1) % TAILLE)], l[((y + 1) % TAILLE) * TAILLE + x]]) {
          if (Number.isNaN(a) || Number.isNaN(b)) continue;
          covariance += (a - m) * (b - m);
          variance += ((a - m) ** 2 + (b - m) ** 2) / 2;
        }
      }
    }
  }
  // les coutures, sur un terrain de 8 × 8 blocs
  const terrain = assemblerTerrain(recette, nom, 8);
  const l = clartes(terrain.pixels), cote = terrain.largeur;
  let bord = 0, nBord = 0, dedans = 0, nDedans = 0;
  for (let y = 0; y < cote; y++) {
    for (let x = 0; x < cote; x++) {
      const a = l[y * cote + x];
      for (const [voisin, auBord] of [[x + 1 < cote ? l[y * cote + x + 1] : NaN, x % TAILLE === TAILLE - 1], [y + 1 < cote ? l[(y + 1) * cote + x] : NaN, y % TAILLE === TAILLE - 1]]) {
        if (Number.isNaN(a) || Number.isNaN(voisin)) continue;
        if (auBord) { bord += Math.abs(a - voisin); nBord++; } else { dedans += Math.abs(a - voisin); nDedans++; }
      }
    }
  }
  const ecartBord = nBord ? bord / nBord : 0, ecartDedans = nDedans ? dedans / nDedans : 0;
  return {
    taches: variance > 1e-9 ? covariance / variance : 1,
    coutures: ecartDedans > 1e-6 ? ecartBord / ecartDedans : ecartBord > 1e-6 ? 9 : 1,
    aspects: (recette.variantes || 1) * (recette.tourner ? 4 : 1) * (recette.miroir ? 2 : 1),
    couleurs: differentes.size,
    clarte: m,
    couleurMoyenne: moyenne.map((v) => (n ? Math.round(v / n) : 0)),
  };
}
