// ─────────────────────────────────────────────────────────────
// LES DESSINS DE L'ATELIER DU SON
// - la forme de l'onde (le son « vu de loin » : sa force au fil du temps) ;
// - le spectrogramme (le temps de gauche à droite, les fréquences de bas en
//   haut, la force en couleur : du violet sombre, presque rien, au jaune,
//   très fort) ;
// - le nuage de tous les bruitages, comparés à la musique ;
// - les courbes « au fil du temps » des situations de jeu.
// Les mêmes règles que les graphiques de l'équilibrage (graphiques.js) : un
// seul axe vertical, des traits fins, un quadrillage discret, le texte jamais
// dans la couleur d'une série, et une forme en plus de la couleur pour
// distinguer les époques (carré, rond, losange).
// ─────────────────────────────────────────────────────────────
import { TEINTES } from './graphiques.js';

const POLICE = '"Pixelify Sans", system-ui, sans-serif';

// Les époques : une couleur et une forme chacune (validées pour les daltoniens, sur le fond sombre)
export const EPOQUES = {
  pixel: { nom: 'Pixel', couleur: '#3987e5', forme: 'carre' },
  cartoon: { nom: 'Cartoon', couleur: '#d95926', forme: 'rond' },
  voxel: { nom: 'Voxel', couleur: '#199e70', forme: 'losange' },
};
export const COULEURS = { musique: '#3987e5', effets: '#d95926', compresseur: '#199e70', empeches: '#6f6475', cible: 'rgba(255, 210, 122, 0.13)', couverte: 'rgba(230, 103, 103, 0.18)' };

// ── Une toile qui suit sa taille (et l'écran : nets sur un écran « Retina ») ──
// dessin(ctx, largeur, hauteur) dessine ; survol(x, y) (facultatif) renvoie le contenu de la bulle,
// ou null. Renvoie { redessiner() }.
export function creerToile(figure, dessin, survol = null) {
  const canvas = figure.querySelector('canvas');
  const bulle = figure.querySelector('.bulle');
  let pointeur = null;
  const taille = () => {
    const largeur = Math.max(120, canvas.clientWidth || 300), hauteur = Math.max(40, canvas.clientHeight || 120);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(largeur * dpr) || canvas.height !== Math.round(hauteur * dpr)) {
      canvas.width = Math.round(largeur * dpr);
      canvas.height = Math.round(hauteur * dpr);
    }
    return { largeur, hauteur, dpr };
  };
  function redessiner() {
    const { largeur, hauteur, dpr } = taille();
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dessin(ctx, largeur, hauteur, pointeur);
    montrerBulle();
  }
  function montrerBulle() {
    if (!bulle) return;
    const contenu = pointeur && survol ? survol(pointeur.x, pointeur.y, taille()) : null;
    if (!contenu) { bulle.hidden = true; return; }
    bulle.replaceChildren();
    const titre = document.createElement('p');
    titre.className = 'titre-bulle';
    titre.textContent = contenu.titre;
    bulle.append(titre);
    for (const l of contenu.lignes) {
      const p = document.createElement('p');
      if (l.couleur) {
        const cle = document.createElement('span');
        cle.className = `cle ${l.forme || 'ligne'}`;
        cle.style.setProperty('--couleur', l.couleur);
        p.append(cle);
      }
      if (l.valeur !== undefined) { const b = document.createElement('b'); b.textContent = l.valeur; p.append(b); }
      const t = document.createElement('span');
      t.textContent = ` ${l.texte}`;
      p.append(t);
      bulle.append(p);
    }
    bulle.hidden = false;
    const { largeur } = taille();
    const aDroite = pointeur.x < largeur / 2;
    bulle.style.left = aDroite ? `${pointeur.x + 14}px` : '';
    bulle.style.right = aDroite ? '' : `${largeur - pointeur.x + 14}px`;
  }
  if (survol) {
    canvas.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect();
      pointeur = { x: e.clientX - r.left, y: e.clientY - r.top };
      redessiner();
    });
    canvas.addEventListener('pointerleave', () => { pointeur = null; redessiner(); });
  }
  new ResizeObserver(() => redessiner()).observe(canvas);
  return { redessiner, get canvas() { return canvas; } };
}

const fond = (ctx, l, h) => {
  ctx.clearRect(0, 0, l, h);
  ctx.fillStyle = TEINTES.fond;
  ctx.fillRect(0, 0, l, h);
};
const texte = (ctx, t, x, y, { taille = 11, couleur = TEINTES.discret, aligne = 'left', base = 'middle' } = {}) => {
  ctx.font = `${taille}px ${POLICE}`;
  ctx.fillStyle = couleur;
  ctx.textAlign = aligne;
  ctx.textBaseline = base;
  ctx.fillText(t, x, y);
};
const virgule = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });

// Les graduations du temps (en secondes) : 0,1 s, 0,25 s, 0,5 s, 1 s… selon la durée
function graduationsTemps(duree, place) {
  const pas = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10].find((p) => duree / p <= place) || 10;
  const g = [];
  for (let t = 0; t <= duree + 1e-9; t += pas) g.push(Math.round(t * 1000) / 1000);
  return g;
}

// Une petite forme (dans les nuages de points et les légendes)
export function forme(ctx, nom, x, y, r, couleur, { creux = false, opacite = 1 } = {}) {
  ctx.save();
  ctx.globalAlpha = opacite;
  ctx.beginPath();
  if (nom === 'carre') ctx.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
  else if (nom === 'losange') { ctx.moveTo(x, y - r * 1.15); ctx.lineTo(x + r * 1.15, y); ctx.lineTo(x, y + r * 1.15); ctx.lineTo(x - r * 1.15, y); ctx.closePath(); }
  else ctx.arc(x, y, r, 0, Math.PI * 2);
  if (creux) { ctx.strokeStyle = couleur; ctx.lineWidth = 1.5; ctx.stroke(); }
  else {
    ctx.fillStyle = couleur;
    ctx.fill();
    ctx.strokeStyle = TEINTES.fond; // un liseré de la couleur du fond : deux points qui se chevauchent restent lisibles
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
}

// ═════════════════════════════════════════════════════════════
// LA FORME DE L'ONDE
// onde : { min, max } (voir formeDOnde dans mesures.js), une valeur par colonne ; avant : la même
// chose pour l'avant (en pâle, derrière), ou null. duree : celle du son (pour l'axe du temps).
// ═════════════════════════════════════════════════════════════
// dureeOnde, dureeAvant : la durée de chacun (ils sont dessinés à la même échelle de temps) ; zoom :
// la forme est agrandie autant de fois (un son faible ne serait qu'un trait plat), et c'est écrit.
export function dessinerOnde(ctx, l, h, { onde, avant = null, couleur, duree, dureeOnde = duree, dureeAvant = duree, zoom = 1 }) {
  fond(ctx, l, h);
  const g = 4, d = l - 4, haut = 4, bas = h - 16, milieu = (haut + bas) / 2, demi = (bas - haut) / 2;
  // l'axe du temps
  for (const t of graduationsTemps(duree, Math.max(2, Math.floor((d - g) / 70)))) {
    const x = g + (t / duree) * (d - g);
    ctx.fillStyle = TEINTES.quadrillage;
    ctx.fillRect(Math.round(x), haut, 1, bas - haut);
    texte(ctx, `${virgule(t, t < 1 && t % 0.5 ? 2 : t % 1 ? 1 : 0)} s`, Math.min(d - 14, Math.max(g + 12, x)), bas + 8, { taille: 10, aligne: 'center' });
  }
  ctx.fillStyle = TEINTES.axe;
  ctx.fillRect(g, Math.round(milieu), d - g, 1);
  const enveloppe = (o, dureeO, style, alpha) => {
    if (!o) return;
    const n = o.min.length, large = ((d - g) * Math.min(1, dureeO / duree));
    ctx.globalAlpha = alpha;
    ctx.fillStyle = style;
    for (let i = 0; i < n; i++) {
      const x = g + (i / n) * large;
      const y1 = milieu - Math.min(1, o.max[i] * zoom) * demi, y2 = milieu - Math.max(-1, o.min[i] * zoom) * demi;
      ctx.fillRect(x, y1, Math.max(1, large / n), Math.max(1, y2 - y1));
    }
    ctx.globalAlpha = 1;
  };
  enveloppe(avant, dureeAvant, TEINTES.encreDouce, 0.32);
  enveloppe(onde, dureeOnde, couleur, 0.95);
  if (zoom > 1) texte(ctx, `agrandie ×${zoom}`, d - 4, haut + 7, { taille: 10, aligne: 'right' });
}

// ═════════════════════════════════════════════════════════════
// LE SPECTROGRAMME
// spectro : voir spectrogramme() dans mesures.js. La force en couleur, de −90 dB (rien) à −10 dB
// (très fort) : une seule teinte chaude qui s'éclaircit (une rampe « séquentielle »).
// ═════════════════════════════════════════════════════════════
const RAMPE = ['#1d1526', '#3b1f3a', '#6a2a3c', '#a2402f', '#d0702a', '#eda646', '#ffd27a', '#fff4e0'].map((c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)));
function couleurRampe(t) {
  const x = Math.max(0, Math.min(1, t)) * (RAMPE.length - 1);
  const i = Math.min(RAMPE.length - 2, Math.floor(x)), f = x - i;
  return RAMPE[i].map((v, k) => Math.round(v + (RAMPE[i + 1][k] - v) * f));
}
const LUT = Array.from({ length: 256 }, (_, i) => couleurRampe(i / 255));
// duree : la durée de l'axe du temps (le spectrogramme d'un son plus court n'en prend qu'une partie)
export function dessinerSpectrogramme(ctx, l, h, spectro, { plage = [-90, -10], duree = spectro?.duree } = {}) {
  fond(ctx, l, h);
  if (!spectro) return;
  const g = 34, haut = 4, bas = h - 4, d = g + (l - 4 - g) * Math.min(1, spectro.duree / duree);
  const { image, colonnes, rangees, fBas, fHaut } = spectro;
  const toile = document.createElement('canvas');
  toile.width = colonnes;
  toile.height = rangees;
  const c2 = toile.getContext('2d');
  const donnees = c2.createImageData(colonnes, rangees);
  for (let c = 0; c < colonnes; c++) {
    for (let r = 0; r < rangees; r++) {
      const v = image[c * rangees + r];
      const [rr, gg, bb] = LUT[Math.round(Math.max(0, Math.min(1, (v - plage[0]) / (plage[1] - plage[0]))) * 255)];
      const k = ((rangees - 1 - r) * colonnes + c) * 4; // les graves en bas
      donnees.data[k] = rr; donnees.data[k + 1] = gg; donnees.data[k + 2] = bb; donnees.data[k + 3] = 255;
    }
  }
  c2.putImageData(donnees, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(toile, g, haut, d - g, bas - haut);
  // l'axe des fréquences (une échelle « musicale » : chaque octave a la même hauteur)
  const yDe = (f) => bas - (Math.log(f / fBas) / Math.log(fHaut / fBas)) * (bas - haut);
  for (const [f, nom] of [[100, '100'], [1000, '1k'], [10000, '10k']]) {
    const y = yDe(f);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.fillRect(g - 4, Math.round(y), 4, 1);
    texte(ctx, nom, g - 6, y, { taille: 10, aligne: 'right' });
  }
  texte(ctx, 'Hz', g - 6, haut + 6, { taille: 9, aligne: 'right' });
}
// La légende du spectrogramme : la rampe, de « rien » à « très fort »
export function dessinerRampe(ctx, l, h) {
  ctx.clearRect(0, 0, l, h);
  for (let x = 0; x < l; x++) {
    const [r, g, b] = couleurRampe(x / (l - 1));
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x, 0, 1, h);
  }
}

// ═════════════════════════════════════════════════════════════
// LE NUAGE DE TOUS LES BRUITAGES
// Une ligne par bruitage : sa bande cible (d'après son rôle), et un point par époque, placé à son
// volume comparé à la musique de l'époque (0 : aussi fort qu'elle). L'avant, s'il a changé : des
// formes creuses et pâles, reliées à l'après par un trait fin.
// spec : { lignes: [{ nom, texte, cible: [a, b], valeurs: { pixel, cartoon, voxel }, avant, choisie }],
// min, max, et pour un autre usage (le volume de la musique) : pas (du quadrillage, 6 par défaut),
// zero (false : pas de « la musique » à 0), axe (le texte sous l'axe), format(v) }. Renvoie la
// géométrie (pour savoir quelle ligne est sous la souris).
// ═════════════════════════════════════════════════════════════
export const NUAGE = { gauche: 170, droite: 14, haut: 26, bas: 26, ligne: 17 };
export function dessinerNuage(ctx, l, h, spec, pointeur = null) {
  fond(ctx, l, h);
  const { gauche, droite, haut, ligne } = NUAGE;
  const d = l - droite, bas = haut + spec.lignes.length * ligne;
  const xDe = (v) => gauche + ((Math.max(spec.min, Math.min(spec.max, v)) - spec.min) / (spec.max - spec.min)) * (d - gauche);
  const survolee = pointeur ? Math.floor((pointeur.y - haut) / ligne) : -1;
  // le quadrillage : tous les 6 LU (6 LU, c'est deux fois plus fort, ou moins fort)
  const pas = spec.pas ?? 6, zero = spec.zero !== false;
  const format = spec.format ?? ((v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`);
  for (let v = Math.ceil(spec.min / pas) * pas; v <= spec.max; v += pas) {
    const x = Math.round(xDe(v)) + 0.5;
    const musique = zero && v === 0;
    ctx.strokeStyle = musique ? 'rgba(255, 210, 122, 0.55)' : TEINTES.quadrillage;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, haut - 4); ctx.lineTo(x, bas); ctx.stroke();
    texte(ctx, musique ? 'la musique' : format(v), x, haut - 12, { taille: 10, aligne: 'center', couleur: musique ? '#ffd27a' : TEINTES.discret });
  }
  texte(ctx, spec.axe ?? 'LU sous (−) ou au-dessus (+) de la musique de l’époque, pendant une vague', d, bas + 10, { taille: 10, aligne: 'right', couleur: TEINTES.discret });
  spec.lignes.forEach((li, k) => {
    const y = haut + k * ligne + ligne / 2;
    if (li.choisie || k === survolee) {
      ctx.fillStyle = li.choisie ? 'rgba(255, 210, 122, 0.12)' : 'rgba(255, 255, 255, 0.05)';
      ctx.fillRect(0, y - ligne / 2, l, ligne);
    }
    // la bande cible
    ctx.fillStyle = COULEURS.cible;
    const x1 = xDe(li.cible[0]), x2 = xDe(li.cible[1]);
    ctx.fillRect(x1, y - ligne / 2 + 2, x2 - x1, ligne - 4);
    texte(ctx, li.texte, gauche - 10, y, { taille: 11, aligne: 'right', couleur: li.choisie ? TEINTES.encre : li.modifie ? '#ffd27a' : TEINTES.encreDouce });
    for (const [epoque, e] of Object.entries(EPOQUES)) {
      const v = li.valeurs[epoque], a = li.avant?.[epoque];
      if (a !== undefined && a !== null && v !== null && Math.abs(a - v) > 0.05) {
        ctx.strokeStyle = TEINTES.encreDouce;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(xDe(a), y); ctx.lineTo(xDe(v), y); ctx.stroke();
        ctx.globalAlpha = 1;
        forme(ctx, e.forme, xDe(a), y, 3.6, e.couleur, { creux: true, opacite: 0.6 });
      }
    }
    for (const [epoque, e] of Object.entries(EPOQUES)) {
      const v = li.valeurs[epoque];
      if (v !== null && v !== undefined) forme(ctx, e.forme, xDe(v), y, 4.2, e.couleur);
    }
  });
  return { haut, ligne, n: spec.lignes.length };
}

// ═════════════════════════════════════════════════════════════
// LES COURBES AU FIL DU TEMPS (les situations de jeu)
// spec : { duree, y: { min, max, graduations, format, unite }, lignes: [{ couleur, valeurs, pas,
// opacite, tirets, epaisseur }], zones: [{ de, a, couleur }] (des tranches de temps, sous tout le
// reste), barres: { pas, series: [{ couleur, valeurs }] } (empilées), reperes: [{ t, texte }],
// seuil: { valeur, texte } }. pointeur : la souris (un trait vertical la suit).
// ═════════════════════════════════════════════════════════════
export const TEMPS = { gauche: 46, droite: 12, haut: 16, bas: 22 };
export function dessinerTemps(ctx, l, h, spec, pointeur = null) {
  fond(ctx, l, h);
  const { gauche, droite, haut } = TEMPS;
  const d = l - droite, bas = h - TEMPS.bas;
  const xDe = (t) => gauche + (t / spec.duree) * (d - gauche);
  const yDe = (v) => bas - Math.max(0, Math.min(1, (v - spec.y.min) / (spec.y.max - spec.y.min))) * (bas - haut);
  for (const z of spec.zones || []) {
    ctx.fillStyle = z.couleur;
    ctx.fillRect(xDe(z.de), haut, Math.max(1, xDe(z.a) - xDe(z.de)), bas - haut);
  }
  // le quadrillage
  for (const v of spec.y.graduations) {
    const y = Math.round(yDe(v)) + 0.5;
    ctx.strokeStyle = v === spec.y.min ? TEINTES.axe : TEINTES.quadrillage;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gauche, y); ctx.lineTo(d, y); ctx.stroke();
    texte(ctx, spec.y.format(v), gauche - 6, y, { taille: 10, aligne: 'right' });
  }
  for (const t of graduationsTemps(spec.duree, Math.max(2, Math.floor((d - gauche) / 60)))) {
    texte(ctx, `${virgule(t, 0)} s`, xDe(t), bas + 11, { taille: 10, aligne: 'center' });
  }
  // les repères (un changement de musique, un grand moment)
  for (const r of spec.reperes || []) {
    const x = Math.round(xDe(r.t)) + 0.5;
    ctx.strokeStyle = 'rgba(255, 210, 122, 0.35)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x, haut); ctx.lineTo(x, bas); ctx.stroke();
    ctx.setLineDash([]);
    texte(ctx, r.texte, Math.min(d - 2, x + 3), haut - 8, { taille: 10, couleur: '#ffd27a', aligne: x > d - 60 ? 'right' : 'left' });
  }
  if (spec.seuil) {
    const y = Math.round(yDe(spec.seuil.valeur)) + 0.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.moveTo(gauche, y); ctx.lineTo(d, y); ctx.stroke();
    ctx.setLineDash([]);
    texte(ctx, spec.seuil.texte, d - 4, y - 7, { taille: 10, aligne: 'right' });
  }
  // les colonnes (empilées), fines, 1 px de vide entre deux
  if (spec.barres) {
    const n = Math.ceil(spec.duree / spec.barres.pas);
    const large = Math.max(2, (d - gauche) / n - 2);
    for (let i = 0; i < n; i++) {
      let pile = 0;
      for (const s of spec.barres.series) {
        const v = s.valeurs[i] || 0;
        if (!v) continue;
        const y0 = yDe(pile), y1 = yDe(pile + v);
        ctx.fillStyle = s.couleur;
        ctx.globalAlpha = s.opacite ?? 1;
        ctx.fillRect(xDe(i * spec.barres.pas) + 1, y1 + (pile ? 1 : 0), large, Math.max(1, y0 - y1 - (pile ? 1 : 0)));
        ctx.globalAlpha = 1;
        pile += v;
      }
    }
  }
  for (const li of spec.lignes || []) {
    ctx.strokeStyle = li.couleur;
    ctx.lineWidth = li.epaisseur ?? 2;
    ctx.globalAlpha = li.opacite ?? 1;
    ctx.lineJoin = 'round';
    ctx.setLineDash(li.tirets ? [4, 3] : []);
    ctx.beginPath();
    let ouvert = false;
    li.valeurs.forEach((v, i) => {
      if (v === null || !Number.isFinite(v)) { ouvert = false; return; }
      const x = xDe(i * li.pas + (li.decalage ?? 0)), y = yDe(v);
      if (ouvert) ctx.lineTo(x, y); else { ctx.moveTo(x, y); ouvert = true; }
    });
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }
  if (pointeur && pointeur.x >= gauche && pointeur.x <= d) {
    ctx.fillStyle = 'rgba(255, 244, 224, 0.5)';
    ctx.fillRect(Math.round(pointeur.x), haut, 1, bas - haut);
  }
}
// Le temps sous la souris (ou null)
export function tempsSous(x, largeur, duree) {
  const { gauche, droite } = TEMPS;
  if (x < gauche || x > largeur - droite) return null;
  return ((x - gauche) / (largeur - droite - gauche)) * duree;
}
