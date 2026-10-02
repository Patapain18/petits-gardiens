// ─────────────────────────────────────────────────────────────
// LE DIDACTICIEL
// Le premier niveau de chaque monde apprend à jouer. Sa fiche dit quoi
// faire, dans « didacticiel » :
// - les leçons (poser un gardien, lancer la vague, améliorer) : un encart
//   explique quoi faire et une flèche montre où cliquer ;
// - les personnages à présenter : une fiche s'ouvre, et le jeu attend,
//   quand un gardien arrive ou quand un monstre se montre pour la première fois.
// Ce module ne change pas les règles du jeu : à chaque image, il regarde
// l'état de la partie et affiche ce qu'il faut.
// Avec l'option « seulement la première fois », les fiches et les leçons déjà
// vues dans une partie d'avant (gardées par progression.js) sont sautées.
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, HAUTEUR_VOL, caracteristiques } from './jeu/donnees.js';
import { estDisponible, prixAmelioration } from './jeu/moteur.js';
import { classerSocles } from './jeu/equilibrage.js';
import { lireProgression, noterVu } from './progression.js';
import { lireOptions, quandOptionsChangent } from './options.js';

const $ = (s) => document.querySelector(s);

// Le gardien qu'on peut améliorer pour le moins cher (null si on n'a pas assez d'or)
function gardienAmeliorable(etat) {
  const prix = (t) => prixAmelioration(t) ?? Infinity;
  return etat.tours.filter((t) => prix(t) <= etat.or).sort((a, b) => prix(a) - prix(b))[0] || null;
}

// Les leçons. Pour chacune : son texte, quand on peut la donner, quand elle
// est finie, et ce que montre la flèche (un socle ou un bouton).
const LECONS = {
  poser: {
    titre: 'Pose ton premier gardien',
    texte: 'Clique sur le socle de pierre que montre la flèche, puis choisis un gardien dans le menu.',
    possible: (etat) => etat.statut === 'preparation',
    finie: (etat) => etat.tours.length > 0,
    indice: (etat, didacticiel) => ({ socle: didacticiel.meilleurSocleLibre(etat) }),
  },
  lancer: {
    titre: 'Lance la vague',
    texte: 'Quand tu es prêt, clique sur « Lancer la vague », en bas de l’écran (ou appuie sur Espace). Les monstres vont suivre le chemin jusqu’au château.',
    possible: (etat) => etat.statut === 'preparation',
    finie: (etat) => etat.vague > 0,
    indice: () => ({ bouton: '#lancer' }),
  },
  ameliorer: {
    titre: 'Améliore un gardien',
    texte: 'Tu as assez d’or : clique sur un gardien déjà posé, puis sur « Améliorer ». Il devient plus fort… et gagne une cape !',
    possible: (etat) => etat.statut === 'preparation' && gardienAmeliorable(etat) !== null,
    finie: (etat) => etat.tours.some((t) => t.niveau > 1),
    indice: (etat) => ({ socle: gardienAmeliorable(etat)?.socle ?? null }),
  },
};

// Les chiffres d'un monstre, dits avec des mots
const motVitesse = (v) => (v < 0.9 ? 'lente' : v < 1.5 ? 'normale' : 'très rapide');
const motSolidite = (pv) => (pv < 35 ? 'fragile' : pv < 100 ? 'moyen' : pv < 1000 ? 'très résistant' : 'énorme');
const virgule = (n) => String(n).replace('.', ',');

// Ce qu'un personnage a de spécial, en une petite phrase par pouvoir
// (des tournures qui vont aussi bien à « il » qu'à « elle » : la Gigogne est une maman)
function pouvoirs(fiche) {
  const liste = [];
  if (fiche.recolte) liste.push(`Rapporte ${fiche.recolte} pièces à chaque vague`);
  if (fiche.rayon) liste.push(`Son rayon chauffe : jusqu’à ×${virgule(fiche.rayon.max)}`);
  if (fiche.rebonds) liste.push(`Touche jusqu’à ${fiche.rebonds.nombre + 1} monstres`);
  if (fiche.souffle) liste.push(`Fait reculer de ${virgule(fiche.souffle.recul)} case${fiche.souffle.recul >= 2 ? 's' : ''}`);
  if (fiche.volant) liste.push('Vole : les rochers passent dessous');
  if (fiche.enfants) {
    const { type, nombre } = fiche.enfants;
    liste.push(`Libère ${nombre} ${MONSTRES[type].nom}${nombre > 1 ? 's' : ''} en tombant`);
  }
  if (fiche.armure) liste.push(`Carapace : chaque coup perd ${fiche.armure} dégâts`);
  if (fiche.creuse) liste.push('Creuse sous terre : on ne peut pas l’y viser');
  if (fiche.feu) liste.push(`Crache du feu : assomme un gardien ${virgule(fiche.feu.duree)} s`);
  if (fiche.vent === 0) liste.push('Insensible au vent');
  if (fiche.gel !== undefined && fiche.gel < 1) liste.push('Presque insensible au gel');
  return liste;
}

export class Didacticiel {
  constructor(niveau) {
    this.niveau = niveau;
    this.lecons = niveau.didacticiel.lecons;
    this.aPresenter = niveau.didacticiel.presenter;
    this.presentes = new Set();   // les personnages déjà présentés
    this.faites = new Set();      // les leçons terminées (même si on recommence la partie)
    this.vus = lireProgression().vus; // les fiches et les leçons vues dans les parties d'avant
    this.premiereFois = lireOptions().fiches === 'premiere-fois';
    quandOptionsChangent((o) => { this.premiereFois = o.fiches === 'premiere-fois'; });
    this.socles = classerSocles(niveau).map((c) => c.socle); // du socle qui voit le plus de chemin au moins bon
    this.bloque = false;          // une fiche est ouverte : le jeu attend qu'on la ferme
    this.enCours = null;          // le personnage présenté en ce moment
    this.leconAffichee = null;
    this.cible = null;            // ce que montre la flèche : { socle }, { ennemi } ou { bouton }
    $('#presentation-ok').addEventListener('click', () => this.fermerFiche());
  }

  // Ce niveau a-t-il un didacticiel ?
  get actif() {
    return this.lecons.length > 0 || this.aPresenter.length > 0;
  }

  // Appelé à chaque image par main.js, pendant la partie
  maj(etat, rendu) {
    if (!this.bloque) {
      const perso = this.personnageAPresenter(etat);
      if (perso) this.ouvrirFiche(perso, rendu);
      else this.afficherLecon(this.leconEnCours(etat), etat);
    }
    this.placerFleche(etat, rendu);
  }

  // Avant le début, à la fin de la partie : on range tout
  cacher() {
    this.afficherLecon(null);
    $('#indice').hidden = true;
  }

  // Un gardien qui vient d'arriver, ou un monstre qui se montre pour la première fois ?
  personnageAPresenter(etat) {
    for (const type of this.aPresenter) {
      if (this.presentes.has(type) || (this.premiereFois && this.vus.has(type))) continue;
      if (GARDIENS[type] && estDisponible(etat, type)) return { type, monstre: null };
      // on attend que le monstre soit un peu entré sur la carte, pour bien le voir
      // (et qu'il soit hors de terre : une Taupe est présentée quand elle ressort)
      const monstre = MONSTRES[type] ? etat.ennemis.find((e) => e.type === type && e.d > 2 && !e.cache) : null;
      if (monstre) return { type, monstre };
    }
    return null;
  }

  // La première leçon pas encore faite (on les donne dans l'ordre de la fiche).
  // null s'il n'y a rien à apprendre en ce moment.
  leconEnCours(etat) {
    for (const id of this.lecons) {
      if (this.faites.has(id) || (this.premiereFois && this.vus.has(`lecon:${id}`))) continue;
      const lecon = LECONS[id];
      if (lecon.finie(etat)) {
        this.faites.add(id);
        this.noter(`lecon:${id}`);
        continue;
      }
      return lecon.possible(etat) ? lecon : null; // pas encore le moment : on attend
    }
    return null;
  }

  meilleurSocleLibre(etat) {
    return this.socles.find((i) => !etat.tours.some((t) => t.socle === i)) ?? null;
  }

  // ── La fiche qui présente un personnage ──
  ouvrirFiche({ type, monstre }, rendu) {
    const gardien = Boolean(GARDIENS[type]);
    const fiche = gardien ? caracteristiques(type, 1) : MONSTRES[type];
    const sorte = gardien ? 'gardien' : fiche.boss ? 'boss' : 'monstre';
    $('#presentation').dataset.sorte = sorte;
    $('#presentation-sorte').textContent = { gardien: 'Nouveau gardien !', monstre: 'Nouveau monstre !', boss: 'Le chef des monstres !' }[sorte];
    $('#presentation-nom').textContent = fiche.nom;
    $('#presentation-description').textContent = fiche.description;
    $('#presentation-conseil').textContent = fiche.conseil;
    const chiffres = gardien
      ? [`Prix : ${fiche.cout} pièces`, ...(fiche.portee ? [`Portée : ${virgule(fiche.portee)} cases`] : []), ...pouvoirs(fiche)]
      : [`Points de vie : ${fiche.pv} (${motSolidite(fiche.pv)})`, `Vitesse : ${motVitesse(fiche.vitesse)}`, `Rapporte ${fiche.prime} pièces`, ...pouvoirs(fiche)];
    $('#presentation-chiffres').replaceChildren(...chiffres.map((texte) => {
      const li = document.createElement('li');
      li.textContent = texte;
      return li;
    }));
    // le portrait est dessiné par le style graphique actif, dans son époque
    const portrait = rendu.portrait?.(fiche.apparence);
    $('#presentation-portrait').replaceChildren(...(portrait ? [portrait] : []));

    this.afficherLecon(null);
    this.bloque = true;
    this.enCours = type;
    this.cible = monstre ? { ennemi: monstre.id } : null; // la flèche montre le monstre sur la carte
    $('#presentation').hidden = false;
    $('#presentation-ok').focus();
  }

  fermerFiche() {
    if (!this.bloque) return;
    $('#presentation').hidden = true;
    this.presentes.add(this.enCours);
    this.noter(this.enCours);
    this.bloque = false;
    this.cible = null;
  }

  // Retenir qu'une fiche ou une leçon a été vue (ici, et dans le navigateur pour les parties suivantes)
  noter(nom) {
    this.vus.add(nom);
    noterVu(nom);
  }

  // ── L'encart de la leçon en cours ──
  afficherLecon(lecon, etat) {
    if (lecon !== this.leconAffichee) {
      this.leconAffichee = lecon;
      document.querySelectorAll('.indice-bouton').forEach((b) => b.classList.remove('indice-bouton'));
      $('#lecon').hidden = !lecon;
      if (lecon) {
        $('#lecon-titre').textContent = lecon.titre;
        $('#lecon-texte').textContent = lecon.texte;
      }
    }
    if (!lecon) {
      if (!this.bloque) this.cible = null;
      return;
    }
    // la cible peut changer d'une image à l'autre (le meilleur socle libre, par exemple)
    this.cible = lecon.indice(etat, this);
    if (this.cible.bouton) $(this.cible.bouton).classList.add('indice-bouton');
  }

  // ── La flèche qui montre où regarder ──
  placerFleche(etat, rendu) {
    const c = this.cible;
    let point = null;
    if (Number.isInteger(c?.socle)) {
      const s = this.niveau.socles[c.socle];
      point = rendu.versEcran(s.x, s.y, 0.9);
    } else if (c?.ennemi) {
      const e = etat.ennemis.find((m) => m.id === c.ennemi);
      if (e) point = rendu.versEcran(e.x, e.y, 0.9 + (MONSTRES[e.type].volant ? HAUTEUR_VOL : 0)); // un volant est plus haut
    }
    const fleche = $('#indice');
    fleche.hidden = !point;
    if (point) {
      fleche.style.left = point.x + 'px';
      fleche.style.top = point.y + 'px';
    }
  }
}
