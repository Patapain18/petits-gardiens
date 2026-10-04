// ─────────────────────────────────────────────────────────────
// LES GRAPHIQUES DE L'ATELIER DE L'ÉQUILIBRAGE
// De petits graphiques « vague après vague », dessinés dans un canvas : des
// courbes, des colonnes (empilées ou côte à côte), des zones et des marques.
// Toujours un seul axe vertical (deux mesures qui n'ont pas la même unité ne
// partagent jamais un graphique : on les ramène à une même base, ×1 à la
// première vague). En survolant (ou au clavier, avec les flèches), un trait
// suit la souris et une bulle donne toutes les valeurs de la vague.
//
// Les règles de dessin viennent d'une méthode de graphiques (traits de 2 px,
// colonnes fines aux coins arrondis côté valeur, 2 px de vide entre deux
// morceaux d'une pile, quadrillage discret, et le texte jamais dans la couleur
// d'une série : la couleur est portée par un petit trait à côté).
// ─────────────────────────────────────────────────────────────

// Les couleurs du dessin (le fond des graphiques, l'encre, le quadrillage)
export const TEINTES = {
  fond: '#1d1526',
  encre: '#fff4e0',
  encreDouce: '#c8b8a8',
  discret: '#a8988c',
  quadrillage: 'rgba(255, 255, 255, 0.08)',
  axe: 'rgba(255, 255, 255, 0.22)',
  eteint: '#6f6475', // les séries « de fond » (les autres joueurs imaginaires)
};
const POLICE = '"Pixelify Sans", system-ui, sans-serif';

// spec : ce qu'il faut dessiner.
//   vagues : combien de vagues sur l'axe horizontal (de 1 à vagues)
//   y : { min, max, log (échelle logarithmique), graduations: [valeurs], format(v), unite }
//   zones : [{ de, a, couleur, texte }] (des bandes horizontales, comme « très serré »)
//   barres : { empile, series: [{ nom, couleur, valeurs: [une par vague, ou null] }] }
//   lignes : [{ nom, couleur, valeurs, epaisseur, opacite, points, fond }]
//   marques : [{ vague, valeur, symbole: 'croix' | 'rond', couleur, texte }]
//   bulle(vague) : les lignes de la bulle pour cette vague : [{ couleur, forme, texte, valeur }]
const MARGE = { haut: 14, droite: 14, bas: 30, gauche: 50 };

export function creerGraphique(figure) {
  const canvas = figure.querySelector('canvas');
  const bulle = figure.querySelector('.bulle');
  let spec = null;
  let survol = null; // la vague survolée (de 1 à spec.vagues), ou null

  function taille() {
    const largeur = Math.max(260, canvas.clientWidth || 480), hauteur = Math.max(160, canvas.clientHeight || 240);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (canvas.width !== Math.round(largeur * dpr) || canvas.height !== Math.round(hauteur * dpr)) {
      canvas.width = Math.round(largeur * dpr);
      canvas.height = Math.round(hauteur * dpr);
    }
    return { largeur, hauteur, dpr };
  }

  function redessiner() {
    if (!spec) return;
    const { largeur, hauteur, dpr } = taille();
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    dessiner(ctx, spec, largeur, hauteur, survol);
  }

  // La vague sous le pointeur (x en pixels CSS, dans le canvas)
  function vagueSous(x) {
    if (!spec) return null;
    const { largeur } = taille();
    const pas = (largeur - MARGE.gauche - MARGE.droite) / spec.vagues;
    const v = Math.floor((x - MARGE.gauche) / pas) + 1;
    return v >= 1 && v <= spec.vagues ? v : null;
  }

  function montrerBulle(v, x) {
    survol = v;
    redessiner();
    if (!v || !spec.bulle) { bulle.hidden = true; return; }
    const lignes = spec.bulle(v);
    bulle.replaceChildren();
    const titre = document.createElement('p');
    titre.className = 'titre-bulle';
    titre.textContent = `Vague ${v}`;
    bulle.append(titre);
    for (const l of lignes) {
      const p = document.createElement('p');
      const cle = document.createElement('span');
      cle.className = `cle ${l.forme || 'ligne'}`;
      cle.style.setProperty('--couleur', l.couleur || TEINTES.eteint);
      const valeur = document.createElement('b');
      valeur.textContent = l.valeur;
      const texte = document.createElement('span');
      texte.textContent = ` ${l.texte}`;
      p.append(cle, valeur, texte);
      bulle.append(p);
    }
    bulle.hidden = false;
    // la bulle se pose à côté du trait, du côté où il y a de la place
    const { largeur } = taille();
    const pas = (largeur - MARGE.gauche - MARGE.droite) / spec.vagues;
    const xTrait = x ?? MARGE.gauche + (v - 0.5) * pas;
    const aDroite = xTrait < largeur / 2;
    bulle.style.left = aDroite ? `${xTrait + 14}px` : '';
    bulle.style.right = aDroite ? '' : `${largeur - xTrait + 14}px`;
  }

  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    const v = vagueSous(e.clientX - r.left);
    if (v !== survol) montrerBulle(v);
  });
  canvas.addEventListener('pointerleave', () => montrerBulle(null));
  // au clavier : les flèches promènent le trait de vague en vague
  figure.addEventListener('keydown', (e) => {
    if (!spec || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const v = survol || 1;
    montrerBulle(e.key === 'Home' ? 1 : e.key === 'End' ? spec.vagues : Math.max(1, Math.min(spec.vagues, v + (e.key === 'ArrowLeft' ? -1 : 1))));
  });
  figure.addEventListener('focus', () => { if (spec && !survol) montrerBulle(1); });
  figure.addEventListener('blur', () => montrerBulle(null));
  new ResizeObserver(() => redessiner()).observe(canvas);

  return {
    maj(nouvelle) {
      spec = nouvelle;
      if (survol && spec && survol > spec.vagues) survol = null;
      if (survol) montrerBulle(survol); else redessiner();
    },
    get spec() { return spec; },
  };
}

// Le dessin lui-même (aussi pour les planches : on lui donne un autre contexte et une autre taille)
export function dessiner(ctx, spec, largeur, hauteur, survol = null) {
  ctx.clearRect(0, 0, largeur, hauteur);
  ctx.fillStyle = TEINTES.fond;
  ctx.fillRect(0, 0, largeur, hauteur);
  const g = MARGE.gauche, d = largeur - MARGE.droite, h = MARGE.haut, b = hauteur - MARGE.bas;
  const pas = (d - g) / spec.vagues;
  const xDe = (v) => g + (v - 0.5) * pas;
  const { min, max, log } = spec.y;
  const yDe = (v) => {
    const t = log ? (Math.log(Math.max(v, min)) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min);
    return b - Math.max(0, Math.min(1, t)) * (b - h);
  };

  // les zones (sous tout le reste)
  for (const z of spec.zones || []) {
    const y1 = yDe(z.a), y2 = yDe(z.de);
    ctx.fillStyle = z.couleur;
    ctx.fillRect(g, Math.min(y1, y2), d - g, Math.abs(y2 - y1));
    if (z.texte) {
      ctx.font = `11px ${POLICE}`;
      ctx.fillStyle = TEINTES.discret;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(z.texte, d - 4, Math.min(y1, y2) - 2 > h + 10 ? Math.min(y1, y2) - 2 : Math.max(y1, y2) - 2);
    }
  }

  // le quadrillage et l'axe vertical (des traits fins, pleins, discrets)
  ctx.font = `11px ${POLICE}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  for (const v of spec.y.graduations) {
    const y = Math.round(yDe(v)) + 0.5;
    ctx.strokeStyle = v === min ? TEINTES.axe : TEINTES.quadrillage;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(g, y);
    ctx.lineTo(d, y);
    ctx.stroke();
    ctx.fillStyle = TEINTES.discret;
    ctx.fillText(spec.y.format(v), g - 6, y);
  }
  // l'axe horizontal : les numéros des vagues (une sur cinq quand il y en a beaucoup)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const tous = spec.vagues <= 16 ? 1 : spec.vagues <= 40 ? 5 : 10;
  for (let v = 1; v <= spec.vagues; v++) {
    if (v !== 1 && v % tous) continue;
    ctx.fillStyle = TEINTES.discret;
    ctx.fillText(String(v), xDe(v), b + 6);
  }
  ctx.textAlign = 'right';
  ctx.fillText('vague', d, b + 18);

  // la vague survolée : un trait vertical
  if (survol) {
    ctx.fillStyle = 'rgba(255, 210, 122, 0.08)';
    ctx.fillRect(xDe(survol) - pas / 2, h, pas, b - h);
  }

  // les colonnes (fines, coin arrondi du côté de la valeur, 2 px de vide entre les morceaux)
  if (spec.barres) {
    const series = spec.barres.series;
    const nb = spec.barres.empile ? 1 : series.length;
    const epaisseur = Math.max(2, Math.min(24, (pas * 0.7) / nb - (nb > 1 ? 2 : 0)));
    for (let v = 1; v <= spec.vagues; v++) {
      let empilePositif = 0, empileNegatif = 0;
      series.forEach((s, k) => {
        const valeur = s.valeurs[v - 1];
        if (!valeur) return;
        const x = spec.barres.empile ? xDe(v) - epaisseur / 2 : xDe(v) - (nb * epaisseur + (nb - 1) * 2) / 2 + k * (epaisseur + 2);
        let depart, arrivee;
        if (spec.barres.empile) {
          if (valeur > 0) { depart = empilePositif; arrivee = empilePositif + valeur; empilePositif = arrivee; }
          else { depart = empileNegatif; arrivee = empileNegatif + valeur; empileNegatif = arrivee; }
        } else { depart = 0; arrivee = valeur; }
        const y0 = yDe(depart), y1 = yDe(arrivee);
        const haut = Math.min(y0, y1), bas = Math.max(y0, y1);
        // le vide de 2 px entre deux morceaux d'une pile
        const vide = spec.barres.empile && depart !== 0 ? 2 : 0;
        const hauteurBarre = bas - haut - vide;
        if (hauteurBarre <= 0.5) return;
        ctx.fillStyle = s.couleur;
        ctx.globalAlpha = s.opacite ?? 1;
        colonne(ctx, x, valeur > 0 ? haut : haut + vide, epaisseur, hauteurBarre, valeur > 0 ? 'haut' : 'bas', estDernier(series, k, v, valeur));
        ctx.globalAlpha = 1;
      });
    }
  }

  // les courbes : d'abord celles du fond (grises), puis les autres
  const lignes = [...(spec.lignes || [])].sort((a, c) => Number(Boolean(c.fond)) - Number(Boolean(a.fond)));
  for (const l of lignes) {
    ctx.strokeStyle = l.couleur;
    ctx.lineWidth = l.epaisseur ?? 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = l.opacite ?? 1;
    ctx.beginPath();
    let ouvert = false;
    l.valeurs.forEach((valeur, i) => {
      if (valeur === null || valeur === undefined) { ouvert = false; return; }
      const x = xDe(i + 1), y = yDe(valeur);
      if (ouvert) ctx.lineTo(x, y); else { ctx.moveTo(x, y); ouvert = true; }
    });
    ctx.stroke();
    if (l.points) {
      l.valeurs.forEach((valeur, i) => {
        if (valeur === null || valeur === undefined) return;
        point(ctx, xDe(i + 1), yDe(valeur), l.couleur, 3.5);
      });
    }
    ctx.globalAlpha = 1;
  }

  // les marques (une croix là où un joueur a perdu, avec « ×10 » si dix joueurs ont perdu là)
  for (const m of spec.marques || []) {
    const x = xDe(m.vague), y = yDe(m.valeur);
    if (m.symbole === 'croix') croix(ctx, x, y, m.couleur);
    else point(ctx, x, y, m.couleur, 4);
    if (m.texte) {
      ctx.font = `12px ${POLICE}`;
      ctx.fillStyle = TEINTES.encre;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(m.texte, x + 7, y - 3);
    }
  }
}

// Le dernier morceau d'une pile (c'est lui qui a le coin arrondi)
function estDernier(series, k, v, valeur) {
  for (let j = k + 1; j < series.length; j++) {
    const autre = series[j].valeurs[v - 1];
    if (autre && Math.sign(autre) === Math.sign(valeur)) return false;
  }
  return true;
}

// Une colonne : coin arrondi (4 px) du côté de la valeur, carrée côté base
function colonne(ctx, x, y, l, h, cote, arrondi) {
  const r = arrondi ? Math.min(4, l / 2, h) : 0;
  ctx.beginPath();
  if (cote === 'haut') {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.lineTo(x + l - r, y);
    ctx.quadraticCurveTo(x + l, y, x + l, y + r);
    ctx.lineTo(x + l, y + h);
  } else {
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + h - r);
    ctx.quadraticCurveTo(x, y + h, x + r, y + h);
    ctx.lineTo(x + l - r, y + h);
    ctx.quadraticCurveTo(x + l, y + h, x + l, y + h - r);
    ctx.lineTo(x + l, y);
  }
  ctx.closePath();
  ctx.fill();
}

// Un point (avec un anneau de la couleur du fond, pour qu'il se détache sur une courbe)
function point(ctx, x, y, couleur, r) {
  ctx.fillStyle = TEINTES.fond;
  ctx.beginPath();
  ctx.arc(x, y, r + 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = couleur;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// Une croix : « ici, un joueur a perdu »
function croix(ctx, x, y, couleur) {
  ctx.strokeStyle = TEINTES.fond;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(x - 5, y - 5 * s); ctx.lineTo(x + 5, y + 5 * s); ctx.stroke(); }
  ctx.strokeStyle = couleur;
  ctx.lineWidth = 2.5;
  for (const s of [1, -1]) { ctx.beginPath(); ctx.moveTo(x - 5, y - 5 * s); ctx.lineTo(x + 5, y + 5 * s); ctx.stroke(); }
}

// Des graduations « rondes » entre 0 et max (une échelle normale)
export function graduations(max, combien = 4) {
  if (!(max > 0)) return [0, 1];
  const brut = max / combien;
  const puissance = 10 ** Math.floor(Math.log10(brut));
  const pas = [1, 2, 2.5, 5, 10].map((k) => k * puissance).find((p) => p >= brut);
  const liste = [];
  for (let v = 0; v <= max + pas * 0.001; v += pas) liste.push(+v.toFixed(6));
  if (liste[liste.length - 1] < max) liste.push(+(liste[liste.length - 1] + pas).toFixed(6));
  return liste;
}

// Des graduations pour une échelle logarithmique (×1, ×2, ×5, ×10…)
export function graduationsLog(min, max) {
  const liste = [];
  for (let p = Math.floor(Math.log10(min)); p <= Math.ceil(Math.log10(max)); p++) {
    for (const k of [1, 2, 5]) {
      const v = k * 10 ** p;
      if (v >= min * 0.999 && v <= max * 1.001) liste.push(v);
    }
  }
  return liste;
}
