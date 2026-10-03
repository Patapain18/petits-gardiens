// ─────────────────────────────────────────────────────────────
// LA LISIBILITÉ : UN PERSONNAGE SE VOIT-IL BIEN SUR LE SOL ?
// L'atelier des modèles (modeles.html) photographie la même scène deux fois :
// avec le personnage, puis sans lui (caché le temps d'une photo). Les pixels qui
// changent, c'est lui. On compare alors chacun de ses pixels avec le pixel du sol
// qu'il cache : plus ils sont différents, mieux il se détache.
//
// « Différents » se mesure comme l'œil le voit : les couleurs passent d'abord
// dans l'espace « Lab » (L : la clarté, a : du vert au rouge, b : du bleu au
// jaune), où la distance entre deux couleurs suit à peu près ce que l'œil perçoit.
// Cette distance s'appelle l'écart ΔE (« delta E ») : vers 2, on voit tout juste
// une différence ; vers 10, deux couleurs nettement différentes ; au-delà de 30,
// deux couleurs qui n'ont rien à voir.
//
// On simule aussi la vue des joueurs daltoniens : près d'un garçon sur douze
// confond plus ou moins le rouge et le vert (deutéranopie, protanopie) ; la
// tritanopie (bleu et jaune) est bien plus rare.
//
// Ce fichier ne connaît ni Three.js ni le navigateur : il travaille sur des
// tableaux de pixels (rouge, vert, bleu, opacité).
// ─────────────────────────────────────────────────────────────

// ── Des couleurs de l'écran (sRGB) à l'espace Lab ──
// Une valeur d'écran (0 à 255) n'est pas proportionnelle à la lumière : on la « linéarise » d'abord
const LINEAIRE = Float32Array.from({ length: 256 }, (_, v) => {
  const c = v / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});
const versEcran = (l) => {
  const c = l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(c * 255)));
};
const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);

// De la lumière (rouge, vert, bleu linéaires) à Lab (le blanc de référence : celui d'un écran, « D65 »)
function lineaireVersLab(r, g, b) {
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  const z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const fx = f(x), fy = f(y), fz = f(z);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export const versLab = ([r, g, b]) => lineaireVersLab(LINEAIRE[r], LINEAIRE[g], LINEAIRE[b]);
// L'écart entre deux couleurs Lab (la distance « à vol d'oiseau » : ΔE de 1976)
export const ecart = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const ecartCouleurs = (c1, c2) => ecart(versLab(c1), versLab(c2));

// ── La vue des daltoniens ──
// Les matrices de Machado, Oliveira et Fernandes (2009), pour un daltonisme complet : elles
// transforment la lumière (rouge, vert, bleu linéaires) en celle que voit un œil daltonien.
export const DALTONISMES = {
  deuteranopie: { nom: 'Deutéranopie (vert)', matrice: [0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182, 0.04294, 0.968881] },
  protanopie: { nom: 'Protanopie (rouge)', matrice: [0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882, -0.048116, 1.051998] },
  tritanopie: { nom: 'Tritanopie (bleu)', matrice: [1.255528, -0.076749, -0.178779, -0.078411, 0.930809, 0.147602, 0.004733, 0.691367, 0.3039] },
};
function simulerLineaire(m, r, g, b) {
  return [
    Math.max(0, Math.min(1, m[0] * r + m[1] * g + m[2] * b)),
    Math.max(0, Math.min(1, m[3] * r + m[4] * g + m[5] * b)),
    Math.max(0, Math.min(1, m[6] * r + m[7] * g + m[8] * b)),
  ];
}
// Une couleur d'écran, telle que la voit un joueur daltonien (sorte : une clé de DALTONISMES)
export function vueDaltonienne([r, g, b], sorte) {
  return simulerLineaire(DALTONISMES[sorte].matrice, LINEAIRE[r], LINEAIRE[g], LINEAIRE[b]).map(versEcran);
}
// La même matrice, écrite pour un filtre SVG (feColorMatrix), qui travaille lui aussi sur la lumière
// linéaire : pour voir tout l'écran du jeu comme un joueur daltonien
export function matriceSVG(sorte) {
  const m = DALTONISMES[sorte].matrice;
  return [m[0], m[1], m[2], 0, 0, m[3], m[4], m[5], 0, 0, m[6], m[7], m[8], 0, 0, 0, 0, 0, 1, 0].join(' ');
}

// ── La mesure ──
// avec, sans : les pixels de deux photos identiques, sauf le personnage (présent, puis caché) ;
// largeur : leur largeur en pixels ; zone : [x0, y0, x1, y1], le rectangle où le chercher.
// La photo « avec » est prise sans son ombre (les styles savent la retirer) : un pixel est à lui s'il
// change d'une photo à l'autre. Par prudence, ce qui n'est que le sol en plus sombre (le rouge, le
// vert et le bleu baissent tous d'à peu près la même proportion) reste compté comme une ombre.
// Renvoie null s'il n'y a rien (le personnage est hors de la zone), sinon :
// - pixels : combien de pixels sont à lui ;
// - detache : l'écart médian entre ses pixels et le sol qu'ils cachent (la moitié de ses pixels font
//   mieux, l'autre moitié moins bien) ;
// - daltoniens : le même écart, vu par un œil daltonien (rouge-vert : le pire des deux) ;
// - tritan : le même, pour la tritanopie (bleu-jaune) ;
// - couleur : sa couleur moyenne à l'écran [r, g, b] ; couleurSol : celle du sol qu'il cache ;
// - boite : [x0, y0, x1, y1] (ses pixels) ;
// - masque : ses pixels (leurs numéros dans la photo), pour dessiner sa silhouette.
const SEUIL = 14; // en dessous, deux pixels sont « les mêmes » (l'antialiasing, les arrondis…)
function estOmbre(avec, sans, k) {
  let mini = Infinity, maxi = 0;
  for (let c = 0; c < 3; c++) {
    if (avec[k + c] > sans[k + c] + 3) return false; // plus clair que le sol : pas une ombre
    if (sans[k + c] < 24) continue;                  // (trop sombre pour calculer une proportion)
    const r = avec[k + c] / sans[k + c];
    mini = Math.min(mini, r); maxi = Math.max(maxi, r);
  }
  return maxi > 0 && maxi - mini < 0.1 && maxi < 0.97;
}
const mediane = (liste) => {
  if (!liste.length) return 0;
  const triee = Float32Array.from(liste).sort();
  return triee[Math.floor(triee.length / 2)];
};

export function mesurerPersonnage(avec, sans, largeur, [x0, y0, x1, y1]) {
  const l = x1 - x0, h = y1 - y0;
  // 1. les pixels qui changent d'une photo à l'autre (sauf ce qui n'est que le sol en plus sombre)
  const marque = new Uint8Array(l * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < l; x++) {
      const k = ((y0 + y) * largeur + x0 + x) * 4;
      const d = Math.max(Math.abs(avec[k] - sans[k]), Math.abs(avec[k + 1] - sans[k + 1]), Math.abs(avec[k + 2] - sans[k + 2]));
      if (d >= SEUIL && !estOmbre(avec, sans, k)) marque[y * l + x] = 1;
    }
  }
  // 2. ses morceaux : des pixels marqués qui se touchent (même par un coin). On garde le plus gros, et
  //    ceux d'au moins 15 % de sa taille (un accessoire qui flotte au-dessus de sa tête) ; les petits
  //    points isolés (un reflet, la lueur d'une lanterne qui bouge à peine) ne sont pas à lui.
  const morceau = new Int32Array(l * h).fill(-1), tailles = [], pile = [];
  for (let depart = 0; depart < l * h; depart++) {
    if (!marque[depart] || morceau[depart] >= 0) continue;
    const numero = tailles.length;
    let taille = 0;
    morceau[depart] = numero;
    pile.push(depart);
    while (pile.length) {
      const n = pile.pop(), x = n % l, y = (n - x) / l;
      taille++;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const vx = x + dx, vy = y + dy, v = vy * l + vx;
          if (vx < 0 || vy < 0 || vx >= l || vy >= h || !marque[v] || morceau[v] >= 0) continue;
          morceau[v] = numero;
          pile.push(v);
        }
      }
    }
    tailles.push(taille);
  }
  if (!tailles.length) return null;
  const plusGros = Math.max(...tailles), garder = tailles.map((t) => t >= Math.max(12, plusGros * 0.15));
  // 3. les mesures, sur ses pixels
  const masque = [], ecarts = [], ecartsD = [], ecartsP = [], ecartsT = [];
  const somme = [0, 0, 0], sommeSol = [0, 0, 0];
  let bx0 = Infinity, by0 = Infinity, bx1 = -1, by1 = -1;
  for (let n = 0; n < l * h; n++) {
    if (morceau[n] < 0 || !garder[morceau[n]]) continue;
    const x = x0 + (n % l), y = y0 + Math.floor(n / l), k = (y * largeur + x) * 4;
    masque.push(y * largeur + x);
    const lui = [avec[k], avec[k + 1], avec[k + 2]], sol = [sans[k], sans[k + 1], sans[k + 2]];
    ecarts.push(ecartCouleurs(lui, sol));
    ecartsD.push(ecartCouleurs(vueDaltonienne(lui, 'deuteranopie'), vueDaltonienne(sol, 'deuteranopie')));
    ecartsP.push(ecartCouleurs(vueDaltonienne(lui, 'protanopie'), vueDaltonienne(sol, 'protanopie')));
    ecartsT.push(ecartCouleurs(vueDaltonienne(lui, 'tritanopie'), vueDaltonienne(sol, 'tritanopie')));
    for (let c = 0; c < 3; c++) { somme[c] += lui[c]; sommeSol[c] += sol[c]; }
    bx0 = Math.min(bx0, x); by0 = Math.min(by0, y); bx1 = Math.max(bx1, x); by1 = Math.max(by1, y);
  }
  if (masque.length < 12) return null;
  return {
    pixels: masque.length,
    detache: mediane(ecarts),
    daltoniens: Math.min(mediane(ecartsD), mediane(ecartsP)),
    tritan: mediane(ecartsT),
    couleur: somme.map((v) => Math.round(v / masque.length)),
    couleurSol: sommeSol.map((v) => Math.round(v / masque.length)),
    boite: [bx0, by0, bx1 + 1, by1 + 1],
    masque,
  };
}

// À quel point deux personnages se ressemblent : l'écart entre leurs couleurs moyennes à l'écran,
// vues normalement et par un œil daltonien (rouge-vert), et le rapport de leurs tailles (1 : la même)
export function ressemblance(a, b) {
  const daltonien = (sorte) => ecartCouleurs(vueDaltonienne(a.couleur, sorte), vueDaltonienne(b.couleur, sorte));
  const ha = a.boite[3] - a.boite[1], hb = b.boite[3] - b.boite[1];
  return {
    couleurs: ecartCouleurs(a.couleur, b.couleur),
    daltoniens: Math.min(daltonien('deuteranopie'), daltonien('protanopie')),
    tailles: Math.max(ha, hb) / Math.max(1, Math.min(ha, hb)),
  };
}
