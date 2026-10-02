// ─────────────────────────────────────────────────────────────
// LE PLAN DE L'ÉDITEUR
// Dessine la fiche vue de dessus (comme un plan d'architecte) et sait
// dire quel objet se trouve sous la souris. Tout est en « cases » :
// versPixel() et versCase() font la conversion avec l'écran.
// ─────────────────────────────────────────────────────────────
import { GARDIENS, caracteristiques } from '../jeu/donnees.js';

// La couleur du terrain rappelle l'époque du niveau
const TEINTES = { pixel: '#2e4f34', cartoon: '#386636', voxel: '#4b5730' };
const COULEURS = {
  fond: '#14181c', horsCarte: '#1b2126', grille: 'rgba(255,255,255,0.05)', grilleForte: 'rgba(255,255,255,0.13)',
  bordChemin: '#6e4b2c', sable: '#cfa86a', point: '#fff4e0', trait: '#24160e',
  socle: '#8f897e', socleDessus: '#d9d1c0', lanterne: '#ffd36a', eau: '#2f6f9e', berge: '#7dbbe0',
  murs: '#c2b59c', donjon: '#8f8573', drapeau: '#e8402e', selection: '#ffb547', alerte: '#ff6a5a',
  chene: '#244f28', bouleau: '#5b8a3c', automne: '#a8601f', rocher: '#7a766e', fleur: '#e8d36a',
};
// Les portées des gardiens au niveau 1 (3 et 3,6 cases), dessinées autour du socle survolé
const PORTEES = [...new Set(Object.keys(GARDIENS).map((type) => caracteristiques(type, 1).portee))].filter((p) => p > 0).sort((a, b) => a - b);

// Distance d'un point au segment [a, b], et l'endroit le plus proche sur ce segment
function surSegment(p, a, b) {
  const l2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2)) : 0;
  const q = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  return { distance: Math.hypot(p.x - q.x, p.y - q.y), point: q };
}

export class Carte {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.marge = 4; // nombre de cases visibles autour de la carte (pour le départ du chemin)
  }

  // ── Taille et cadrage ──
  redimensionner(fiche) {
    const zone = this.canvas.parentElement.getBoundingClientRect();
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.largeurEcran = zone.width;
    this.hauteurEcran = zone.height;
    this.canvas.width = Math.round(zone.width * this.dpr);
    this.canvas.height = Math.round(zone.height * this.dpr);
    this.canvas.style.width = zone.width + 'px';
    this.canvas.style.height = zone.height + 'px';
    this.cadrer(fiche);
  }

  cadrer(fiche) {
    const l = fiche.largeur + this.marge * 2, h = fiche.hauteur + this.marge * 2;
    this.s = Math.min(this.largeurEcran / l, this.hauteurEcran / h); // pixels par case
    this.ox = (this.largeurEcran - fiche.largeur * this.s) / 2;
    this.oy = (this.hauteurEcran - fiche.hauteur * this.s) / 2;
  }

  versPixel(x, y) { return { x: this.ox + x * this.s, y: this.oy + y * this.s }; }
  versCase(px, py) { return { x: (px - this.ox) / this.s, y: (py - this.oy) / this.s }; }

  // ── Qu'y a-t-il sous la souris ? (seulement les objets de l'outil choisi) ──
  objetSous(fiche, p, outil) {
    const pres = (o, r) => Math.hypot(o.x - p.x, o.y - p.y) < r;
    if (outil === 'chemin') {
      const i = fiche.chemin.findIndex((q) => pres(q, 0.45));
      if (i >= 0) return { type: 'chemin', index: i };
      for (let k = 0; k < fiche.chemin.length - 1; k++) {
        const { distance, point } = surSegment(p, fiche.chemin[k], fiche.chemin[k + 1]);
        if (distance < 0.4) return { type: 'segment', index: k, point };
      }
      return null;
    }
    if (outil === 'socles') {
      const i = fiche.socles.findIndex((q) => pres(q, 0.6));
      return i >= 0 ? { type: 'socles', index: i } : null;
    }
    if (outil === 'lanternes') {
      const i = (fiche.lanternes || []).findIndex((q) => pres(q, 0.4));
      return i >= 0 ? { type: 'lanternes', index: i } : null;
    }
    if (outil === 'etangs') {
      const etangs = fiche.etangs || [];
      // d'abord les bords (pour changer la taille), puis l'intérieur (pour déplacer)
      for (let i = etangs.length - 1; i >= 0; i--) {
        const d = Math.hypot(etangs[i].x - p.x, etangs[i].y - p.y);
        if (Math.abs(d - etangs[i].rayon) < 0.35) return { type: 'etangs', index: i, partie: 'bord' };
      }
      for (let i = etangs.length - 1; i >= 0; i--) {
        if (pres(etangs[i], etangs[i].rayon)) return { type: 'etangs', index: i, partie: 'centre' };
      }
    }
    return null;
  }

  // ── Le dessin ──
  dessiner(e) {
    const { ctx, s } = this;
    const f = e.fiche;
    const P = (x, y) => this.versPixel(x, y);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = COULEURS.fond;
    ctx.fillRect(0, 0, this.largeurEcran, this.hauteurEcran);

    // 1. hors de la carte : un peu plus clair que le fond, pour voir où l'on peut placer le départ
    const coin = P(-this.marge, -this.marge);
    ctx.fillStyle = COULEURS.horsCarte;
    ctx.fillRect(coin.x, coin.y, (f.largeur + this.marge * 2) * s, (f.hauteur + this.marge * 2) * s);

    // 2. la carte et sa grille (un trait plus marqué toutes les 5 cases)
    const o = P(0, 0);
    ctx.fillStyle = TEINTES[f.style] || TEINTES.pixel;
    ctx.fillRect(o.x, o.y, f.largeur * s, f.hauteur * s);
    ctx.lineWidth = 1;
    for (let x = 0; x <= f.largeur; x++) {
      ctx.strokeStyle = x % 5 === 0 ? COULEURS.grilleForte : COULEURS.grille;
      ctx.beginPath(); ctx.moveTo(o.x + x * s, o.y); ctx.lineTo(o.x + x * s, o.y + f.hauteur * s); ctx.stroke();
    }
    for (let y = 0; y <= f.hauteur; y++) {
      ctx.strokeStyle = y % 5 === 0 ? COULEURS.grilleForte : COULEURS.grille;
      ctx.beginPath(); ctx.moveTo(o.x, o.y + y * s); ctx.lineTo(o.x + f.largeur * s, o.y + y * s); ctx.stroke();
    }

    // 3. le décor généré (arbres, rochers, fleurs), seulement si la fiche est valide
    if (e.niveau) {
      for (const d of e.niveau.decor) {
        const p = P(d.x, d.y);
        if (d.type === 'fleur') {
          ctx.fillStyle = COULEURS.fleur;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
          ctx.globalAlpha = 1;
          continue;
        }
        const rayon = (d.type === 'rocher' ? 0.28 : d.dedans ? 0.3 : 0.45) * d.taille * s;
        ctx.fillStyle = COULEURS[d.type] || COULEURS.chene;
        ctx.beginPath(); ctx.arc(p.x, p.y, rayon, 0, Math.PI * 2); ctx.fill();
      }
    }

    // 4. les étangs
    (f.etangs || []).forEach((etang, i) => {
      const p = P(etang.x, etang.y);
      ctx.fillStyle = COULEURS.eau;
      ctx.strokeStyle = COULEURS.berge;
      ctx.lineWidth = Math.max(2, s * 0.12);
      ctx.beginPath(); ctx.arc(p.x, p.y, etang.rayon * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      this.etiquette(`${i + 1}`, p.x, p.y, '#d8f0ff');
    });

    // 5. le chemin : prolongement hors écran (pointillés), bordure, sable, puis l'axe
    const chemin = f.chemin;
    const traceChemin = (points) => {
      ctx.beginPath();
      points.forEach((q, i) => { const p = P(q.x, q.y); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
    };
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (e.niveau) {
      ctx.setLineDash([s * 0.3, s * 0.25]);
      ctx.strokeStyle = 'rgba(207,168,106,0.45)';
      ctx.lineWidth = s * 0.5;
      traceChemin(e.niveau.cheminVisuel.slice(0, 2));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.strokeStyle = COULEURS.bordChemin; ctx.lineWidth = s * 1.08; traceChemin(chemin); ctx.stroke();
    ctx.strokeStyle = COULEURS.sable; ctx.lineWidth = s * 0.9; traceChemin(chemin); ctx.stroke();
    ctx.setLineDash([s * 0.18, s * 0.22]);
    ctx.strokeStyle = 'rgba(90,60,30,0.45)'; ctx.lineWidth = Math.max(1, s * 0.05); traceChemin(chemin); ctx.stroke();
    ctx.setLineDash([]);

    // 6. le château (sa porte est au bout du chemin, côté gauche)
    if (f.chateau) {
      const c = f.chateau;
      const a = P(c.x - 1.6, c.y - 2.5);
      ctx.fillStyle = COULEURS.murs;
      ctx.strokeStyle = COULEURS.trait;
      ctx.lineWidth = 2;
      ctx.fillRect(a.x, a.y, 2.9 * s, 4.9 * s);
      ctx.strokeRect(a.x, a.y, 2.9 * s, 4.9 * s);
      // le donjon (pierre plus sombre) et son drapeau rouge
      const donjon = P(c.x - 0.75, c.y - 1);
      ctx.fillStyle = COULEURS.donjon;
      ctx.fillRect(donjon.x, donjon.y, 2 * s, 2 * s);
      ctx.strokeRect(donjon.x, donjon.y, 2 * s, 2 * s);
      ctx.fillStyle = COULEURS.drapeau;
      ctx.beginPath();
      ctx.moveTo(donjon.x + s, donjon.y + s * 0.2);
      ctx.lineTo(donjon.x + s * 1.7, donjon.y + s * 0.5);
      ctx.lineTo(donjon.x + s, donjon.y + s * 0.8);
      ctx.fill();
      const porte = P(c.x - 1.6, c.y - 0.5);
      ctx.fillStyle = '#2a1c14';
      ctx.fillRect(porte.x - s * 0.15, porte.y, s * 0.4, s);
      this.etiquette('Château', a.x + 1.45 * s, a.y - s * 0.45, '#fff4e0', true);
    }

    // 7. les lanternes
    (f.lanternes || []).forEach((l) => {
      const p = P(l.x, l.y);
      ctx.fillStyle = 'rgba(255,211,106,0.18)';
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COULEURS.lanterne;
      ctx.strokeStyle = COULEURS.trait;
      ctx.lineWidth = 2;
      ctx.fillRect(p.x - s * 0.14, p.y - s * 0.14, s * 0.28, s * 0.28);
      ctx.strokeRect(p.x - s * 0.14, p.y - s * 0.14, s * 0.28, s * 0.28);
    });

    // 8. la portée autour du socle survolé ou choisi (aide à bien placer les socles)
    const focus = [e.survol, e.selection].find((x) => x?.type === 'socles' && f.socles[x.index]);
    if (focus) {
      const p = P(f.socles[focus.index].x, f.socles[focus.index].y);
      PORTEES.forEach((r, i) => {
        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = i ? 'rgba(200,170,255,0.55)' : 'rgba(255,244,214,0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * s, 0, Math.PI * 2); ctx.stroke();
      });
      ctx.setLineDash([]);
    }

    // 9. les socles, numérotés. Si l'on survole un joueur imaginaire du test
    //    d'équilibrage, chaque socle prend la couleur du gardien qu'il y a posé.
    const gardienSur = new Map((e.apercuGardiens || []).map((g) => [g.socle, g]));
    f.socles.forEach((socle, i) => {
      const p = P(socle.x, socle.y);
      const pose = gardienSur.get(i);
      const gardien = pose && caracteristiques(pose.type, pose.niveau || 1);
      ctx.fillStyle = COULEURS.socle;
      ctx.strokeStyle = COULEURS.trait;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = gardien ? gardien.apparence.couleurs.peau : COULEURS.socleDessus;
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.36, 0, Math.PI * 2); ctx.fill();
      if (gardien) {
        ctx.stroke();
        this.etiquette(GARDIENS[pose.type].nom.slice(0, 2), p.x, p.y, '#1a1014'); // « Br », « Gi », « Gr »
        this.etiquette(`${i + 1}`, p.x + s * 0.45, p.y - s * 0.45, '#fff4e0', true);
        if (pose.niveau > 1) this.etiquette(`niv. ${pose.niveau}`, p.x, p.y + s * 0.66, '#ffd24a', true); // amélioré : son niveau, en doré
      } else {
        this.etiquette(`${i + 1}`, p.x, p.y, e.apercuGardiens ? 'rgba(42,28,20,0.4)' : '#2a1c14');
      }
    });

    // 10. les points du chemin, numérotés, avec « Départ » sur le premier
    chemin.forEach((q, i) => {
      const p = P(q.x, q.y);
      ctx.fillStyle = COULEURS.point;
      ctx.strokeStyle = COULEURS.trait;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      this.etiquette(`${i + 1}`, p.x, p.y, '#2a1c14');
      if (i === 0) this.etiquette('Départ', p.x, p.y - s * 0.75, '#fff4e0', true);
    });

    // 11. objet survolé, objet choisi, objet signalé par un conseil
    this.entourer(f, e.survol, 'rgba(255,255,255,0.7)');
    this.entourer(f, e.selection, COULEURS.selection);
    this.entourer(f, e.surbrillance, COULEURS.alerte, true);

    // 12. le « fantôme » : ce qui sera posé si on clique ici
    if (e.curseur && !e.glisse) this.dessinerFantome(e);

    // 13. le cadre de la carte et sa taille
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(o.x, o.y, f.largeur * s, f.hauteur * s);
    this.etiquette(`${f.largeur} × ${f.hauteur} cases`, o.x + 4, o.y - 10, 'rgba(255,255,255,0.6)', true, 'left');
  }

  dessinerFantome(e) {
    const { ctx, s } = this;
    const f = e.fiche, c = e.curseur, p = this.versPixel(c.x, c.y);
    ctx.globalAlpha = 0.5;
    if (e.outil === 'chemin') {
      if (e.survol?.type === 'segment') {
        const q = this.versPixel(e.survol.point.x, e.survol.point.y);
        ctx.fillStyle = COULEURS.point;
        ctx.beginPath(); ctx.arc(q.x, q.y, s * 0.3, 0, Math.PI * 2); ctx.fill();
      } else if (!e.survol) {
        const fin = f.chemin[f.chemin.length - 1], q = this.versPixel(fin.x, fin.y);
        ctx.setLineDash([s * 0.25, s * 0.2]);
        ctx.strokeStyle = COULEURS.sable;
        ctx.lineWidth = s * 0.5;
        ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = COULEURS.point;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.3, 0, Math.PI * 2); ctx.fill();
      }
    } else if (!e.survol) {
      if (e.outil === 'socles') {
        ctx.fillStyle = COULEURS.socleDessus;
        ctx.beginPath(); ctx.arc(p.x, p.y, s * 0.5, 0, Math.PI * 2); ctx.fill();
      } else if (e.outil === 'lanternes') {
        ctx.fillStyle = COULEURS.lanterne;
        ctx.fillRect(p.x - s * 0.14, p.y - s * 0.14, s * 0.28, s * 0.28);
      } else if (e.outil === 'etangs') {
        ctx.fillStyle = COULEURS.eau;
        ctx.beginPath(); ctx.arc(p.x, p.y, 2 * s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Un anneau autour d'un objet (survol, sélection ou alerte)
  entourer(f, objet, couleur, epais = false) {
    if (!objet) return;
    const { ctx, s } = this;
    let o = null, r = 0.5;
    if (objet.type === 'chemin') { o = f.chemin[objet.index]; r = 0.42; }
    else if (objet.type === 'socles') { o = f.socles[objet.index]; r = 0.66; }
    else if (objet.type === 'lanternes') { o = f.lanternes?.[objet.index]; r = 0.36; }
    else if (objet.type === 'etangs') { o = f.etangs?.[objet.index]; r = (o?.rayon || 1) + 0.15; }
    if (!o) return;
    const p = this.versPixel(o.x, o.y);
    ctx.strokeStyle = couleur;
    ctx.lineWidth = epais ? 4 : 2.5;
    ctx.beginPath(); ctx.arc(p.x, p.y, r * s, 0, Math.PI * 2); ctx.stroke();
  }

  // Un petit texte centré (numéros, « Départ »…), avec un contour sombre si besoin
  etiquette(texte, x, y, couleur, contour = false, aligne = 'center') {
    const { ctx } = this;
    ctx.font = `700 ${Math.max(10, Math.round(this.s * 0.34))}px system-ui, sans-serif`;
    ctx.textAlign = aligne;
    ctx.textBaseline = 'middle';
    if (contour) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(10,12,14,0.85)';
      ctx.strokeText(texte, x, y);
    }
    ctx.fillStyle = couleur;
    ctx.fillText(texte, x, y);
  }
}
