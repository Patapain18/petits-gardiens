// ─────────────────────────────────────────────────────────────
// CHARGEMENT D'UN NIVEAU
// Un niveau est décrit par une « fiche » : un fichier JSON rangé dans
// src/niveaux/ (chemin, socles, château, vagues…). Ce sont des données
// pures, sans aucun calcul.
//
// chargerNiveau(fiche) vérifie la fiche puis calcule tout ce qui en
// découle : longueur du chemin, relief du terrain, décor… Le moteur et
// les styles n'utilisent que l'objet renvoyé, jamais la fiche brute.
//
// Toutes les positions sont en « cases » : x vers la droite, y vers le
// bas (comme sur une feuille). Les styles 3D traduisent (x, y) en (X, Z).
// ─────────────────────────────────────────────────────────────
import { creerAleatoire, bruitFractal, transition } from './aleatoire.js';
import { GARDIENS, MONSTRES } from './donnees.js';
import { vaguesDeSurvie } from './survie.js';

export const STYLES = ['voxel', 'cartoon', 'pixel'];

// La difficulté visée : le test d'équilibrage dit si le niveau la respecte
export const DIFFICULTES = { didacticiel: 'Didacticiel', facile: 'Facile', normal: 'Normal' };

// Les leçons qu'un didacticiel peut donner (leurs textes sont dans src/didacticiel.js)
export const LECONS = { poser: 'Poser un gardien', lancer: 'Lancer une vague', ameliorer: 'Améliorer un gardien' };

export function chargerNiveau(fiche) {
  const erreurs = problemesFiche(fiche);
  if (erreurs.length) {
    throw new Error(`Fiche de niveau « ${fiche?.id || '?'} » incorrecte :\n- ` + erreurs.join('\n- '));
  }
  const { largeur, hauteur, chemin, socles } = fiche;
  const etangs = fiche.etangs || [];
  const fin = chemin[chemin.length - 1];
  // la porte du château est au bout du chemin
  const chateau = { x: fiche.chateau.x, y: fiche.chateau.y, porte: { x: fin.x, y: fin.y } };

  // ── Calculs sur le chemin ──────────────────────────────────
  // Longueur de chaque segment + longueur totale (sert à placer les monstres)
  const segments = [];
  let longueurChemin = 0;
  for (let i = 0; i < chemin.length - 1; i++) {
    const a = chemin[i], b = chemin[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ a, b, l, debut: longueurChemin });
    longueurChemin += l;
  }

  // Position sur le chemin à une distance d depuis le départ.
  // Renvoie aussi la direction (pour orienter le monstre).
  function pointSurChemin(d) {
    for (const s of segments) {
      if (d <= s.debut + s.l) {
        const t = Math.max(0, (d - s.debut) / s.l);
        return {
          x: s.a.x + (s.b.x - s.a.x) * t,
          y: s.a.y + (s.b.y - s.a.y) * t,
          dx: (s.b.x - s.a.x) / s.l,
          dy: (s.b.y - s.a.y) / s.l,
        };
      }
    }
    const dernier = segments[segments.length - 1];
    return { x: dernier.b.x, y: dernier.b.y, dx: 1, dy: 0 };
  }

  // Pour le dessin, le chemin continue hors de l'écran avant son départ
  // (sinon il s'arrêterait net au bord de la carte) : on prolonge le
  // premier segment de 14,5 cases vers l'arrière.
  const premier = segments[0];
  const PROLONGEMENT = 14.5;
  const avant = {
    x: premier.a.x - ((premier.b.x - premier.a.x) / premier.l) * PROLONGEMENT,
    y: premier.a.y - ((premier.b.y - premier.a.y) / premier.l) * PROLONGEMENT,
  };
  const segmentsVisuels = [{ a: avant, b: premier.a, l: PROLONGEMENT }, ...segments];
  const cheminVisuel = [avant, ...chemin];

  // Distance entre un point et le chemin (utile pour le décor et le terrain)
  function distanceAuChemin(x, y) {
    let min = Infinity;
    for (const { a, b, l } of segmentsVisuels) {
      // projection du point sur le segment, bornée entre 0 et 1
      let t = ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / (l * l);
      t = Math.max(0, Math.min(1, t));
      const px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t;
      min = Math.min(min, Math.hypot(x - px, y - py));
    }
    return min;
  }

  // Distance jusqu'au bord de l'étang le plus proche :
  // négative dans l'eau, positive dehors (Infinity s'il n'y a pas d'étang)
  function distanceEtang(x, y) {
    let min = Infinity;
    for (const e of etangs) min = Math.min(min, Math.hypot(x - e.x, y - e.y) - e.rayon);
    return min;
  }

  // ── Relief (pour les styles 3D) ────────────────────────────
  // Hauteur du sol (en cases) à la position (x, y). 0 = niveau du chemin.
  // Dans la zone de jeu c'est plat, autour ça monte en collines,
  // et au fond il y a une grande montagne.
  function hauteurTerrain(x, y) {
    const bosse = bruitFractal(x * 0.18 + 10, y * 0.18 + 4);

    // À quelle distance est-on de la zone de jeu ? (0 si on est dedans)
    const horsX = Math.max(0, -x, x - largeur);
    const horsY = Math.max(0, -y, y - hauteur);
    const dehors = Math.hypot(horsX, horsY);

    // Plus on est loin du chemin / des socles, plus on autorise de relief
    let libre = transition(1.0, 3.0, distanceAuChemin(x, y));
    for (const s of socles) libre = Math.min(libre, transition(0.8, 1.8, Math.hypot(x - s.x, y - s.y)));
    libre = Math.min(libre, transition(2.6, 4.2, Math.hypot(x - chateau.x, y - chateau.y)));

    // dans la zone de jeu le sol reste plat (les buttes faisaient des « trous » sombres vus de biais)
    const versBord = Math.min(x, y, largeur - x, hauteur - y);
    const plat = 1 - transition(-0.5, 1.5, versBord) * 0.92;
    let h = Math.max(0, bosse - 0.5) * 2.2 * libre * plat;    // petites buttes
    h += dehors * (0.25 + bosse * 0.45) * libre;              // collines autour

    // La montagne du fond, un peu à droite du centre
    if (y < 0) {
      const fond = transition(-1, -10, y);
      h += fond * (3 + bruitFractal(x * 0.1, y * 0.1 + 7) * 6);
      const pic = Math.max(0, 1 - Math.hypot((x - (largeur / 2 + 1)) * 0.7, (y + 14) * 0.9) / 11);
      h += Math.pow(pic, 1.3) * 13;
    }

    // Les étangs creusent le sol
    for (const e of etangs) {
      const d = Math.hypot(x - e.x, y - e.y);
      if (d < e.rayon) h = Math.min(h, -0.7 * (1 - d / e.rayon) - 0.05);
    }
    return h;
  }

  // ── Décor partagé par tous les styles ──────────────────────
  // Généré avec une graine fixe → les arbres sont au même endroit dans tous les styles.
  // arbres = combien d'arbres dans la zone de jeu (0 : aucun, 1 : une vraie forêt)
  function genererDecor(graine, arbres) {
    const alea = creerAleatoire(graine);
    const decor = [];
    const occupe = (x, y, marge) =>
      distanceAuChemin(x, y) < 1.1 + marge ||
      socles.some((s) => Math.hypot(x - s.x, y - s.y) < 1.2 + marge) ||
      Math.hypot(x - chateau.x, y - chateau.y) < 3.2 + marge ||
      distanceEtang(x, y) < 0.4 ||
      decor.some((d) => d.solide && Math.hypot(x - d.x, y - d.y) < 1.3);

    // Arbres : peu dans la zone de jeu (pour bien voir), beaucoup autour
    for (let i = 0; i < 900 && decor.length < 170; i++) {
      const x = -7 + alea() * (largeur + 14);
      const y = -9 + alea() * (hauteur + 15);
      const dedans = x > 0 && x < largeur && y > 0 && y < hauteur;
      if (dedans && alea() >= arbres) continue;
      // forêt plus clairsemée juste derrière la carte (pour voir la montagne au loin)
      if (y < 0 && y > -8 && alea() < 0.6) continue;
      // pas d'arbres juste sous la carte : vus de près par la caméra, ils cacheraient le jeu
      if (y > hauteur - 0.5 && y < hauteur + 7 && x > -2 && x < largeur + 2) continue;
      if (occupe(x, y, dedans ? 0.4 : 0.9)) continue; // marge : le feuillage ne doit pas couvrir le chemin
      // Vu de biais, un arbre « monte » vers le haut de l'écran : on regarde donc aussi
      // un peu au-dessus de lui (y plus petit) pour qu'il ne cache ni le chemin ni un socle.
      const masque = [1, 2, 3, 4].some((k) =>
        distanceAuChemin(x, y - k) < 1.0 || socles.some((s) => Math.hypot(x - s.x, y - k - s.y) < 1.0));
      if (masque) continue;
      const r = alea();
      decor.push({
        type: r < 0.55 ? 'chene' : r < 0.8 ? 'bouleau' : 'automne',
        x, y, taille: dedans ? 0.6 + alea() * 0.3 : 0.8 + alea() * 0.5, variante: alea(), solide: true, dedans,
      });
    }
    // Rochers
    for (let i = 0; i < 200 && decor.filter((d) => d.type === 'rocher').length < 22; i++) {
      const x = -4 + alea() * (largeur + 8), y = -3 + alea() * (hauteur + 6);
      if (occupe(x, y, 0.1)) continue;
      decor.push({ type: 'rocher', x, y, taille: 0.5 + alea() * 0.6, variante: alea(), solide: true });
    }
    // Touffes de fleurs (pas « solides » : on peut en mettre partout)
    for (let i = 0; i < 2600; i++) {
      const x = -8 + alea() * (largeur + 16), y = -6 + alea() * (hauteur + 13);
      if (distanceAuChemin(x, y) < 0.75) continue;
      if (distanceEtang(x, y) < 0) continue;
      if (Math.hypot(x - chateau.x, y - chateau.y) < 2.4) continue;
      if (socles.some((s) => Math.hypot(x - s.x, y - s.y) < 0.7)) continue;
      // Les fleurs se regroupent en champs (bruit) plutôt qu'au hasard
      const champ = bruitFractal(x * 0.22 + 50, y * 0.22);
      if (alea() > Math.pow(champ, 2.2) * 2.2) continue;
      decor.push({ type: 'fleur', x, y, taille: 0.6 + alea() * 0.6, variante: alea() });
    }
    return decor;
  }

  return {
    id: fiche.id,
    nom: fiche.nom,
    description: fiche.description || '',
    difficulte: fiche.difficulte || 'normal',
    style: fiche.style,
    ambiance: fiche.ambiance || 'doree',
    largeur,
    hauteur,
    or: fiche.or,
    chemin,
    cheminVisuel,
    socles,
    chateau,
    etangs,
    lanternes: fiche.lanternes || [],
    // en mode survie, les vagues écrites sont suivies de vagues fabriquées, sans fin
    survie: Boolean(fiche.survie),
    vagues: fiche.survie ? vaguesDeSurvie(fiche.vagues) : fiche.vagues,
    // pour chaque gardien proposé, la vague à partir de laquelle on peut le poser
    // (si la fiche ne dit rien : tous les gardiens, dès la vague 1)
    gardiens: fiche.gardiens || Object.fromEntries(Object.keys(GARDIENS).map((type) => [type, 1])),
    // le didacticiel : les leçons à donner et les personnages à présenter (vides = pas de didacticiel)
    didacticiel: { lecons: fiche.didacticiel?.lecons || [], presenter: fiche.didacticiel?.presenter || [] },
    longueurChemin,
    decor: genererDecor(fiche.decor?.graine ?? 1, fiche.decor?.arbres ?? 0.05),
    pointSurChemin,
    distanceAuChemin,
    distanceEtang,
    hauteurTerrain,
  };
}

// ── Vérification de la fiche ─────────────────────────────────
// Une fiche mal remplie doit donner un message clair tout de suite,
// plutôt qu'un bug bizarre au milieu d'une partie.
// Renvoie la liste des problèmes (vide si la fiche est correcte) :
// l'éditeur l'affiche en direct, chargerNiveau() refuse de charger s'il y en a.
export function problemesFiche(fiche) {
  const erreurs = [];
  const nombre = (v, chemin) => {
    if (typeof v !== 'number' || !Number.isFinite(v)) erreurs.push(`"${chemin}" doit être un nombre`);
  };
  const point = (p, chemin) => {
    if (!p || typeof p !== 'object') return erreurs.push(`"${chemin}" doit être un point { "x": …, "y": … }`);
    nombre(p.x, chemin + '.x');
    nombre(p.y, chemin + '.y');
  };
  const listeDePoints = (liste, chemin, minimum) => {
    if (!Array.isArray(liste) || liste.length < minimum) return erreurs.push(`"${chemin}" doit contenir au moins ${minimum} point(s)`);
    liste.forEach((p, i) => point(p, `${chemin}[${i}]`));
  };

  if (!fiche || typeof fiche !== 'object') return ['La fiche de niveau est vide ou illisible.'];
  if (typeof fiche.id !== 'string' || !fiche.id) erreurs.push('"id" doit être un texte (ex. "prairie")');
  if (typeof fiche.nom !== 'string' || !fiche.nom) erreurs.push('"nom" doit être un texte');
  if (!STYLES.includes(fiche.style)) erreurs.push(`"style" doit valoir ${STYLES.map((s) => `"${s}"`).join(', ')}`);
  nombre(fiche.largeur, 'largeur');
  nombre(fiche.hauteur, 'hauteur');
  nombre(fiche.or, 'or');
  listeDePoints(fiche.chemin, 'chemin', 2);
  listeDePoints(fiche.socles, 'socles', 1);
  point(fiche.chateau, 'chateau');
  if (fiche.lanternes !== undefined) listeDePoints(fiche.lanternes, 'lanternes', 0);
  if (fiche.etangs !== undefined) {
    listeDePoints(fiche.etangs, 'etangs', 0);
    (fiche.etangs || []).forEach((e, i) => { if (!(e?.rayon > 0)) erreurs.push(`"etangs[${i}].rayon" doit être un nombre positif`); });
  }
  if (Array.isArray(fiche.chemin)) {
    for (let i = 1; i < fiche.chemin.length; i++) {
      const a = fiche.chemin[i - 1], b = fiche.chemin[i];
      if (a && b && a.x === b.x && a.y === b.y) erreurs.push(`"chemin[${i}]" est au même endroit que le point précédent`);
    }
  }
  if (!Array.isArray(fiche.vagues) || fiche.vagues.length === 0) {
    erreurs.push('"vagues" doit contenir au moins une vague');
  } else {
    fiche.vagues.forEach((vague, i) => {
      if (!Array.isArray(vague) || vague.length === 0) return erreurs.push(`"vagues[${i}]" doit contenir au moins un groupe de monstres`);
      vague.forEach((g, j) => {
        const ici = `vagues[${i}][${j}]`;
        if (!MONSTRES[g?.type]) erreurs.push(`"${ici}.type" doit valoir ${Object.keys(MONSTRES).map((m) => `"${m}"`).join(', ')}`);
        if (!Number.isInteger(g?.nombre) || g.nombre < 1) erreurs.push(`"${ici}.nombre" doit être un entier ≥ 1`);
        nombre(g?.ecart, ici + '.ecart');
        nombre(g?.delai, ici + '.delai');
        if (g?.force !== undefined && !(g.force > 0 && g.force <= 100)) erreurs.push(`"${ici}.force" doit être un nombre positif (les points de vie sont multipliés par ce nombre)`);
      });
    });
  }

  // ── Les champs facultatifs de la campagne et du didacticiel ──
  const liste = (objet) => Object.keys(objet).map((cle) => `"${cle}"`).join(', ');
  if (fiche.decor?.arbres !== undefined && !(fiche.decor.arbres >= 0 && fiche.decor.arbres <= 1)) {
    erreurs.push('"decor.arbres" doit être un nombre entre 0 (aucun arbre dans la zone de jeu) et 1 (une forêt)');
  }
  if (fiche.description !== undefined && (typeof fiche.description !== 'string' || fiche.description.length > 200)) {
    erreurs.push('"description" doit être un texte de 200 caractères au plus');
  }
  if (fiche.survie !== undefined && typeof fiche.survie !== 'boolean') {
    erreurs.push('"survie" doit valoir true (mode survie : des vagues sans fin) ou false');
  }
  if (fiche.difficulte !== undefined && !DIFFICULTES[fiche.difficulte]) {
    erreurs.push(`"difficulte" doit valoir ${liste(DIFFICULTES)}`);
  }
  // « gardiens » : { "braise": 1, "givrine": 2 } = Braise dès la vague 1, Givrine à partir de la vague 2
  if (fiche.gardiens !== undefined) {
    const g = fiche.gardiens;
    if (!g || typeof g !== 'object' || Array.isArray(g)) {
      erreurs.push('"gardiens" doit être un objet, par exemple { "braise": 1, "givrine": 2 }');
    } else {
      for (const [type, vague] of Object.entries(g)) {
        if (!GARDIENS[type]) erreurs.push(`"gardiens.${type}" : gardien inconnu (possibles : ${liste(GARDIENS)})`);
        else if (!Number.isInteger(vague) || vague < 1) erreurs.push(`"gardiens.${type}" doit être un numéro de vague (1 = dès le début)`);
        else if (Array.isArray(fiche.vagues) && vague > fiche.vagues.length) erreurs.push(`"gardiens.${type}" arrive à la vague ${vague}, mais le niveau n’a que ${fiche.vagues.length} vague(s)`);
      }
      if (!Object.values(g).includes(1)) erreurs.push('Au moins un gardien doit être disponible dès la vague 1 : sinon on ne peut rien poser.');
    }
  }
  if (fiche.didacticiel !== undefined) {
    const d = fiche.didacticiel;
    if (!d || typeof d !== 'object' || Array.isArray(d)) {
      erreurs.push('"didacticiel" doit être un objet, par exemple { "lecons": ["poser"], "presenter": ["gluant"] }');
    } else {
      if (d.lecons !== undefined && (!Array.isArray(d.lecons) || d.lecons.some((l) => !LECONS[l]))) {
        erreurs.push(`"didacticiel.lecons" ne peut contenir que ${liste(LECONS)}`);
      }
      if (d.presenter !== undefined && (!Array.isArray(d.presenter) || d.presenter.some((p) => !GARDIENS[p] && !MONSTRES[p]))) {
        erreurs.push(`"didacticiel.presenter" ne peut contenir que des personnages : ${liste({ ...GARDIENS, ...MONSTRES })}`);
      }
    }
  }
  return erreurs;
}
