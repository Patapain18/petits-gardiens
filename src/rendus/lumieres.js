// ─────────────────────────────────────────────────────────────
// LES LUMIÈRES DU JEU (partagées par les trois styles)
// Les lanternes et la porte du château la nuit, les boules de feu, les rayons
// du Prisme, la flamme sur la tête de Braise, la lave du Colosse… et des
// « éclats » qui ne durent qu'un instant : une explosion, un éclair, un
// monstre battu, une amélioration.
//
// À chaque image, on fait la liste des lumières allumées. Chaque style les
// dessine à sa façon : des halos de pixels en pixel art, une « carte des
// lumières » posée sur le sol et les personnages dans les styles 3D.
//
// Une lumière : { x, y, hauteur, rayon, couleur, force }
//   x, y : sa place, en cases (comme dans le moteur du jeu) ; hauteur : en cases
//   rayon : jusqu'où elle éclaire, en cases ; couleur : [rouge, vert, bleu], de 0 à 1
//   force : de 0 (éteinte) à 1 (et un peu plus pour les éclats les plus vifs)
// ─────────────────────────────────────────────────────────────
import { MONSTRES, caracteristiques } from '../jeu/donnees.js';
import { lireApparence } from './apparence.js';

export const COULEURS_LUMIERE = {
  lanterne: [1, 0.68, 0.32],
  feu: [1, 0.52, 0.14],
  explosion: [1, 0.66, 0.32],
  eclair: [0.72, 0.86, 1],
  or: [1, 0.84, 0.38],
  lave: [1, 0.38, 0.08],
  glace: [0.55, 0.85, 1],
  rose: [1, 0.55, 0.9],
  alerte: [1, 0.25, 0.15],
};

// Les accessoires qui éclairent un peu autour d'eux (surtout visibles la nuit)
const ACCESSOIRES_LUMINEUX = {
  flamme: { couleur: COULEURS_LUMIERE.feu, rayon: 1.5, force: 0.6, hauteur: 0.9 },
  prisme: { couleur: COULEURS_LUMIERE.rose, rayon: 1.1, force: 0.35, hauteur: 1.2 },
  antennes: { couleur: [0.6, 0.95, 1], rayon: 1, force: 0.3, hauteur: 1 },
  casque: { couleur: [1, 0.95, 0.7], rayon: 0.9, force: 0.35, hauteur: 0.8 },
};

// La lumière d'un gardien d'un type et d'un niveau donnés (ou null), gardée une fois calculée
const lumiereGardien = new Map();
function lumiereDe(type, niveau) {
  const cle = type + ':' + niveau;
  if (!lumiereGardien.has(cle)) {
    const { accessoires } = lireApparence(caracteristiques(type, niveau).apparence);
    const lumineux = accessoires.map((a) => ACCESSOIRES_LUMINEUX[a.type]).find(Boolean) || null;
    lumiereGardien.set(cle, lumineux);
  }
  return lumiereGardien.get(cle);
}

export class Lumieres {
  constructor(niveau) {
    this.niveau = niveau;
    this.eclats = [];  // les lumières brèves (une explosion, un éclair…)
    this.temps = 0;
  }

  // Une lumière brève, qui s'éteint toute seule en « duree » secondes
  eclat(x, y, hauteur, rayon, couleur, force, duree) {
    this.eclats.push({ x, y, hauteur, rayon, couleur, force, duree, vie: duree });
    if (this.eclats.length > 48) this.eclats.shift(); // jamais trop à la fois
  }

  // Les événements du moteur (ce qui vient de se passer) : certains allument un éclat
  evenements(liste) {
    for (const ev of liste) {
      switch (ev.type) {
        case 'explosion':
          if (ev.quoi === 'meteore') this.eclat(ev.x, ev.y, 0.4, 3.6, COULEURS_LUMIERE.feu, 1.6, 0.6); // le Météore s'écrase
          else this.eclat(ev.x, ev.y, 0.3, 2.4, COULEURS_LUMIERE.explosion, 1.3, 0.35);
          break;
        case 'impact':
          if (ev.quoi === 'feu') this.eclat(ev.x, ev.y, 0.4, 1.3, COULEURS_LUMIERE.feu, 0.8, 0.2);
          else if (ev.quoi === 'glace') this.eclat(ev.x, ev.y, 0.4, 1, COULEURS_LUMIERE.glace, 0.5, 0.2);
          break;
        case 'eclair': for (const q of ev.points) this.eclat(q.x, q.y, q.h ?? 0.4, 1.6, COULEURS_LUMIERE.eclair, 1, 0.18); break;
        case 'mort': {
          const chef = MONSTRES[ev.quoi]?.boss;
          this.eclat(ev.x, ev.y, 0.4, chef ? 4 : 1.2, COULEURS_LUMIERE.or, chef ? 1.5 : 0.5, chef ? 0.9 : 0.25);
          break;
        }
        case 'flamme': // le feu du Dragon, de sa gueule jusqu'au gardien
          for (let k = 1; k <= 4; k++) {
            const t = k / 4;
            this.eclat(ev.x + (ev.vers.x - ev.x) * t, ev.y + (ev.vers.y - ev.y) * t, 1.2 * (1 - t) + 0.5, 1.6, COULEURS_LUMIERE.feu, 0.9, 0.45);
          }
          break;
        case 'amelioration': this.eclat(ev.x, ev.y, 0.8, 1.8, COULEURS_LUMIERE.or, 1, 0.6); break;
        case 'construction': this.eclat(ev.x, ev.y, 0.5, 1.4, COULEURS_LUMIERE.or, 0.5, 0.35); break;
        case 'recolte': this.eclat(ev.x, ev.y, 0.8, 1.3, COULEURS_LUMIERE.or, 0.6, 0.5); break;
        case 'fuite': this.eclat(ev.x, ev.y, 0.5, 2.6, COULEURS_LUMIERE.alerte, 1.2, 0.6); break;
      }
    }
  }

  maj(dt) {
    this.temps += dt;
    this.eclats = this.eclats.filter((e) => (e.vie -= dt) > 0);
  }

  // Une flamme vacille : sa force bouge un peu, chacune à son rythme
  vacille(i) {
    return 0.9 + Math.sin(this.temps * 7.3 + i * 1.7) * 0.06 + Math.sin(this.temps * 12.1 + i * 3.1) * 0.04;
  }

  // La liste des lumières allumées. nuit : de 0 (jour) à 1 (nuit) ; les lanternes ne
  // s'allument que la nuit (le jour, on ne verrait pas leur lumière de toute façon)
  liste(etat, nuit = 0) {
    const l = [];
    if (nuit > 0) {
      this.niveau.lanternes.forEach((lanterne, i) => {
        l.push({ x: lanterne.x, y: lanterne.y, hauteur: 0.9, rayon: 2.3, couleur: COULEURS_LUMIERE.lanterne, force: nuit * this.vacille(i) });
      });
      const porte = this.niveau.chateau.porte;
      l.push({ x: porte.x + 0.5, y: porte.y, hauteur: 1, rayon: 2.3, couleur: COULEURS_LUMIERE.lanterne, force: nuit * 0.9 * this.vacille(99) });
    }
    // les gardiens qui portent une lumière (la flamme de Braise, le cristal du Prisme…)
    for (const tour of etat.tours) {
      const lum = lumiereDe(tour.type, tour.niveau);
      if (lum) l.push({ x: tour.x, y: tour.y, hauteur: lum.hauteur, rayon: lum.rayon, couleur: lum.couleur, force: lum.force * (lum === ACCESSOIRES_LUMINEUX.flamme ? this.vacille(tour.id) : 1) });
      // le rayon du Prisme éclaire sa cible (de plus en plus fort quand il chauffe)
      if (tour.rayon) {
        const cible = etat.ennemis.find((e) => e.id === tour.rayon);
        if (cible) l.push({ x: cible.x, y: cible.y, hauteur: 0.5, rayon: 1.4, couleur: COULEURS_LUMIERE.rose, force: 0.5 + (tour.chauffe || 0) * 0.6 });
      }
    }
    // les boules de feu de Braise, et le Météore qui tombe (sa lumière grandit à mesure qu'il approche)
    for (const t of etat.projectiles) {
      if (t.type === 'feu') l.push({ x: t.x, y: t.y, hauteur: t.z, rayon: 1.2, couleur: COULEURS_LUMIERE.feu, force: 0.75 });
      if (t.type === 'meteore') l.push({ x: t.x, y: t.y, hauteur: t.z, rayon: 2.6, couleur: COULEURS_LUMIERE.feu, force: 0.4 + 0.6 * (1 - t.reste / t.chute) });
    }
    // les monstres de lave (le Colosse) rougeoient
    for (const e of etat.ennemis) {
      if (!e.cache && MONSTRES[e.type].apparence.couleurs?.lave) l.push({ x: e.x, y: e.y, hauteur: 0.8, rayon: 2.2, couleur: COULEURS_LUMIERE.lave, force: 0.55 * this.vacille(e.id) });
    }
    for (const e of this.eclats) {
      const k = e.vie / e.duree; // de 1 (tout juste allumé) à 0 (éteint) : il s'éteint vite, puis doucement
      l.push({ x: e.x, y: e.y, hauteur: e.hauteur, rayon: e.rayon, couleur: e.couleur, force: e.force * k * k });
    }
    return l;
  }

  vider() { this.eclats = []; }
}
