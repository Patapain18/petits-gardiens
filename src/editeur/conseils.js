// ─────────────────────────────────────────────────────────────
// CONSEILS DE CONCEPTION
// Ce ne sont pas des erreurs : le niveau se charge quand même.
// Ce sont des choses qui marcheraient mal en jeu (un socle posé sur
// le chemin, un château qui dépasse de la carte…).
// Chaque conseil indique l'objet concerné, pour le montrer sur le plan.
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, caracteristiques } from '../jeu/donnees.js';
import { ORDRE } from '../jeu/campagne.js';

// La plus petite portée parmi les gardiens (au niveau 1) : au-delà, aucun ne peut tirer
// (sans compter les gardiens qui ne tirent pas, comme la Pépite)
const PORTEE_MIN = Math.min(...Object.keys(GARDIENS).filter((type) => GARDIENS[type].projectile).map((type) => caracteristiques(type, 1).portee));

// Toutes les fiches du projet, pour savoir ce que le joueur a déjà vu dans la campagne
const FICHES = import.meta.glob('../niveaux/*.json', { eager: true, import: 'default' });

// Les personnages qu'un joueur connaît déjà en arrivant dans ce niveau : ceux des niveaux
// joués avant lui dans la campagne (gardiens proposés, monstres des vagues et leurs petits).
// Un niveau hors campagne (l'essai, une arène, un nouveau niveau) : tous ceux de la campagne.
function dejaConnus(id) {
  const connus = new Set();
  for (const autre of ORDRE) {
    if (autre === id) break;
    const fiche = FICHES[`../niveaux/${autre}.json`];
    if (!fiche) continue;
    Object.keys(fiche.gardiens || GARDIENS).forEach((type) => connus.add(type));
    for (const groupe of fiche.vagues.flat()) {
      connus.add(groupe.type);
      if (MONSTRES[groupe.type]?.enfants) connus.add(MONSTRES[groupe.type].enfants.type);
    }
  }
  return connus;
}

export function conseilsNiveau(niveau) {
  const conseils = [];
  const ajouter = (texte, objet = null) => conseils.push({ texte, objet });
  const { chemin, socles, lanternes, etangs, largeur, hauteur, chateau, distanceAuChemin } = niveau;
  const dansLaCarte = (p) => p.x > 0 && p.y > 0 && p.x < largeur && p.y < hauteur;

  // ── Le chemin ──
  const depart = chemin[0], fin = chemin[chemin.length - 1], avantFin = chemin[chemin.length - 2];
  if (dansLaCarte(depart)) {
    ajouter('Le chemin commence dans la carte : fais-le partir de l’extérieur, pour que les monstres arrivent de loin.', { type: 'chemin', index: 0 });
  }
  if (!(fin.x > avantFin.x && Math.abs(fin.y - avantFin.y) < 0.01)) {
    ajouter('Le dernier morceau du chemin doit arriver au château par la gauche, à l’horizontale (la porte est de ce côté).', { type: 'chemin', index: chemin.length - 1 });
  }
  if (chateau.x + 1.7 > largeur + 0.5 || chateau.y - 2.7 < -0.5 || chateau.y + 2.8 > hauteur + 0.5) {
    ajouter('Le château dépasse de la carte : rapproche la fin du chemin du centre.', { type: 'chemin', index: chemin.length - 1 });
  }
  if (niveau.longueurChemin < 16) {
    ajouter(`Le chemin est très court (${niveau.longueurChemin.toFixed(0)} cases) : les monstres arriveront vite au château.`);
  }

  // ── Les socles ──
  socles.forEach((s, i) => {
    const n = i + 1;
    const d = distanceAuChemin(s.x, s.y);
    if (d < 0.9) ajouter(`Le socle ${n} touche le chemin.`, { type: 'socles', index: i });
    else if (d > PORTEE_MIN) ajouter(`Le socle ${n} est trop loin du chemin : un gardien posé là ne pourrait tirer sur personne.`, { type: 'socles', index: i });
    if (!dansLaCarte(s)) ajouter(`Le socle ${n} est hors de la carte.`, { type: 'socles', index: i });
    if (Math.hypot(s.x - chateau.x, s.y - chateau.y) < 2.6) ajouter(`Le socle ${n} est posé sur le château.`, { type: 'socles', index: i });
    for (let j = i + 1; j < socles.length; j++) {
      if (Math.hypot(s.x - socles[j].x, s.y - socles[j].y) < 1.1) {
        ajouter(`Les socles ${n} et ${j + 1} se chevauchent.`, { type: 'socles', index: j });
      }
    }
    etangs.forEach((e, k) => {
      if (Math.hypot(s.x - e.x, s.y - e.y) < e.rayon + 0.4) ajouter(`Le socle ${n} est dans l’étang ${k + 1}.`, { type: 'socles', index: i });
    });
  });

  // ── Les lanternes et les étangs ──
  lanternes.forEach((l, i) => {
    if (distanceAuChemin(l.x, l.y) < 0.55) ajouter(`La lanterne ${i + 1} est au milieu du chemin.`, { type: 'lanternes', index: i });
  });
  etangs.forEach((e, i) => {
    if (distanceAuChemin(e.x, e.y) < e.rayon + 0.5) ajouter(`L’étang ${i + 1} déborde sur le chemin.`, { type: 'etangs', index: i });
    if (Math.hypot(e.x - chateau.x, e.y - chateau.y) < e.rayon + 2.6) ajouter(`L’étang ${i + 1} touche le château.`, { type: 'etangs', index: i });
  });

  // ── Les volants ──
  // Un tir en cloche (le Grondin) ne les touche pas : il faut au moins un autre gardien
  // qui tire (la Pépite, elle, ne tire pas du tout)
  const volants = [...new Set(niveau.vagues.flat().map((g) => g.type))].filter((type) => MONSTRES[type].volant);
  const contreVolants = Object.keys(niveau.gardiens).filter((type) => GARDIENS[type].projectile && !GARDIENS[type].projectile.cloche);
  if (volants.length && !contreVolants.length) {
    ajouter(`Les ${volants.map((type) => MONSTRES[type].nom + 's').join(', ')} volent, mais aucun gardien proposé ne peut les toucher : le Grondin tire en cloche. Ajoute une Braise, une Givrine, une Étincelle ou un Prisme.`);
  }

  // ── Le didacticiel ──
  const { lecons, presenter } = niveau.didacticiel;
  const estDidacticiel = lecons.length > 0 || presenter.length > 0;
  if (niveau.difficulte === 'didacticiel' && !estDidacticiel) {
    ajouter('Ce niveau vise la difficulté « Didacticiel » mais n’apprend rien : coche des leçons ou des personnages à présenter.');
  }
  // un personnage que le joueur n'a encore jamais croisé dans la campagne, sans fiche de présentation
  const connus = dejaConnus(niveau.id);
  const monstres = new Set(niveau.vagues.flat().flatMap((g) => [g.type, MONSTRES[g.type].enfants?.type].filter(Boolean)));
  for (const type of monstres) {
    if (!connus.has(type) && !presenter.includes(type)) ajouter(`Le monstre « ${MONSTRES[type].nom} » n’a encore été vu dans aucun niveau d’avant, et il n’a pas de fiche de présentation : coche-le dans « Didacticiel ».`);
  }
  for (const type of Object.keys(niveau.gardiens)) {
    if (!connus.has(type) && !presenter.includes(type)) ajouter(`Le gardien « ${GARDIENS[type].nom} » est nouveau, mais il n’a pas de fiche de présentation : coche-le dans « Didacticiel ».`);
  }
  return conseils;
}
