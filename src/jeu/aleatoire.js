// ─────────────────────────────────────────────────────────────
// Aléatoire « reproductible » et bruit pour générer le décor.
// Pourquoi pas Math.random() ? Parce qu'on veut que les arbres
// soient au MÊME endroit dans tous les styles et à chaque partie.
// Avec une « graine » (seed) fixe, la suite de nombres est toujours la même.
// ─────────────────────────────────────────────────────────────

// Générateur Mulberry32 : prend une graine, renvoie une fonction
// qui donne un nombre entre 0 et 1 à chaque appel.
export function creerAleatoire(graine) {
  let a = graine >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// « Hachage » d'une case entière (x, y) → nombre entre 0 et 1.
// Toujours le même résultat pour la même case.
function hacher(x, y) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Courbe douce entre 0 et 1 (évite les angles dans le bruit)
const lisser = (t) => t * t * (3 - 2 * t);

// Bruit de valeur 2D : des valeurs aléatoires aux coins de chaque case,
// mélangées en douceur entre elles → un relief « ondulé ».
export function bruit2D(x, y) {
  const x0 = Math.floor(x), y0 = Math.floor(y);
  const fx = lisser(x - x0), fy = lisser(y - y0);
  const a = hacher(x0, y0), b = hacher(x0 + 1, y0);
  const c = hacher(x0, y0 + 1), d = hacher(x0 + 1, y0 + 1);
  const haut = a + (b - a) * fx;
  const bas = c + (d - c) * fx;
  return haut + (bas - haut) * fy;
}

// Plusieurs couches de bruit superposées (grandes bosses + petits détails).
export function bruitFractal(x, y, couches = 4) {
  let total = 0, amplitude = 1, frequence = 1, somme = 0;
  for (let i = 0; i < couches; i++) {
    total += bruit2D(x * frequence, y * frequence) * amplitude;
    somme += amplitude;
    amplitude *= 0.5;
    frequence *= 2;
  }
  return total / somme; // entre 0 et 1
}

// Petits outils mathématiques réutilisés partout
export const limiter = (v, min, max) => Math.max(min, Math.min(max, v));
export function transition(bord0, bord1, v) {
  const t = limiter((v - bord0) / (bord1 - bord0), 0, 1);
  return t * t * (3 - 2 * t);
}
