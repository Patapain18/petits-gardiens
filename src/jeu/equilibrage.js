// ─────────────────────────────────────────────────────────────
// L'ÉQUILIBRAGE AUTOMATIQUE
// Le moteur joue tout seul, sans dessin, avec plusieurs « joueurs
// imaginaires » (les stratégies). En regardant qui gagne et qui perd,
// on sait si un niveau est trop facile, trop dur, ou bien réglé.
//
// Ce fichier sert à deux endroits :
// - dans le terminal : npm run equilibrage (scripts/equilibrage.js)
// - dans l'éditeur de niveaux : le bouton « Tester l'équilibrage »
// ─────────────────────────────────────────────────────────────
import { creerPartie, majPartie, lancerVague, construire, ameliorer, tourSur, prixAmelioration, estDisponible } from './moteur.js';
import { caracteristiques, NIVEAU_MAX } from './donnees.js';
import { DIFFICULTES } from './niveau.js';

// Le mélange du bon joueur. Les gardiens des mondes 2 (Étincelle, Bourrasque) et 3 (Prisme,
// Pépite) sont glissés entre ceux du monde 1 : dans un niveau qui ne les propose pas, ils
// disparaissent du motif, et il reste exactement le mélange d'avant (les résultats des
// mondes précédents ne bougent pas).
const MELANGE = ['braise', 'prisme', 'braise', 'etincelle', 'pepite', 'givrine', 'grondin', 'braise', 'prisme', 'grondin', 'givrine', 'braise', 'etincelle', 'grondin', 'braise', 'bourrasque'];

// Les joueurs imaginaires. « motif » = les gardiens qu'ils achètent, dans l'ordre
// (le motif se répète s'il y a plus de socles) ; « bien » = ils prennent d'abord
// les meilleurs socles, sinon les pires ; « ameliore » = ils améliorent leurs gardiens.
// « naif » = un joueur maladroit ; « sansVarier » = un joueur qui pose partout le même
// gardien à tout faire (la Braise, l'Étincelle au monde 2, le Prisme au monde 3) : s'il
// gagne, le niveau est facile.
export const STRATEGIES = [
  { id: 'melange-bien', nom: 'Mélange bien placé', motif: MELANGE, bien: true, ameliore: true, malin: true, reference: true },
  { id: 'sans-amelioration', nom: 'Mélange bien placé, sans améliorer', motif: MELANGE, bien: true, ameliore: false },
  { id: 'braise-bien', nom: 'Que des Braise, bien placées', motif: ['braise'], bien: true, ameliore: true, sansVarier: true },
  { id: 'braise-mal', nom: 'Que des Braise, mal placées', motif: ['braise'], bien: false, ameliore: true, naif: true },
  { id: 'melange-mal', nom: 'Mélange mal placé', motif: MELANGE, bien: false, ameliore: true, naif: true },
  { id: 'grondin', nom: 'Que des Grondin', motif: ['grondin'], bien: true, ameliore: true, naif: true },
  { id: 'givrine', nom: 'Que des Givrine', motif: ['givrine'], bien: true, ameliore: true, naif: true },
  { id: 'etincelle', nom: 'Que des Étincelle, bien placées', motif: ['etincelle'], bien: true, ameliore: true, sansVarier: true },
  { id: 'prisme', nom: 'Que des Prisme, bien placés', motif: ['prisme'], bien: true, ameliore: true, sansVarier: true },
];

// Ce gardien tire-t-il ? (La Pépite, non : elle rapporte de l'or.)
const tire = (type) => Boolean(caracteristiques(type, 1).projectile);

const PAS = 1 / 60;            // pas de temps de la simulation : le même que dans le vrai jeu
const DUREE_MAX_VAGUE = 900;   // garde-fou : une vague ne dure jamais plus de 15 minutes de jeu
const PORTEE_CLASSEMENT = 3;   // la portée qui sert à juger un socle (celle de Braise et Givrine)

// ── Classer les socles ───────────────────────────────────────
// Un bon socle voit beaucoup de chemin : on mesure la longueur de chemin
// à portée, en avançant sur le chemin par petits pas de 0,1 case.
function cheminVu(niveau, s, portee) {
  let vue = 0;
  for (let d = 0; d < niveau.longueurChemin; d += 0.1) {
    const p = niveau.pointSurChemin(d);
    if (Math.hypot(p.x - s.x, p.y - s.y) <= portee) vue += 0.1;
  }
  return vue;
}
export function classerSocles(niveau, portee = PORTEE_CLASSEMENT) {
  return niveau.socles
    .map((s, i) => ({ socle: i, vue: cheminVu(niveau, s, portee) }))
    .sort((a, b) => b.vue - a.vue || a.socle - b.socle);
}

// ── Le jugement du bon joueur ────────────────────────────────
// La « puissance » d'un gardien : ses dégâts par seconde, avec un bonus pour
// le gel (les autres gardiens tirent plus longtemps) et pour les explosions
// (elles touchent plusieurs monstres). Ce sont des estimations, pas des règles.
function puissance(type, niveau) {
  const c = caracteristiques(type, niveau);
  if (!c.projectile) return 0; // la Pépite ne tire pas (ce qu'elle rapporte ne se compte pas en dégâts)
  // un rayon chauffe en moyenne à moitié (il change souvent de cible)
  let p = c.rayon ? c.degats * (1 + (c.rayon.max - 1) * 0.5) : c.degats / c.cadence;
  if (c.ralentissement) p *= 1 + (1 - c.ralentissement.facteur) * 1.2;
  if (c.zone) p *= 1 + c.zone;
  if (c.rebonds) p *= 1 + c.rebonds.nombre * c.rebonds.attenuation * 0.5; // l'éclair touche souvent plusieurs monstres
  if (c.souffle) p += (c.souffle.recul * (1 + c.souffle.zone) * 8) / c.cadence; // faire reculer = les autres tirent plus longtemps
  return p;
}
// Ce que rapporte un gardien à un niveau, sur un socle : sa puissance × le chemin qu'il voit
function apport(niveau, socle, type, n, vues) {
  const portee = caracteristiques(type, n).portee;
  const cle = socle + ':' + portee;
  if (!vues.has(cle)) vues.set(cle, cheminVu(niveau, niveau.socles[socle], portee));
  return puissance(type, n) * vues.get(cle);
}
// La Pépite ne se juge pas en dégâts mais en or. Le bon joueur l'achète (ou l'améliore)
// seulement si, d'ici la fin du niveau, elle rapportera au moins une fois et demie ce
// qu'elle coûte. Elle récolte à la fin de chaque vague, sauf la dernière (le niveau est gagné).
function rentable(etat, type, niveau) {
  const { recolte, cout } = caracteristiques(type, niveau);
  const avant = niveau > 1 ? caracteristiques(type, niveau - 1).recolte : 0; // ce qu'elle récoltait déjà
  const recoltes = etat.niveau.vagues.length - etat.vague - 1;
  return (recolte - avant) * recoltes >= 1.5 * cout;
}

// Le bon joueur commence par mettre un gardien sur chaque « bon » socle
// (ceux qui voient au moins la moitié de ce que voit le meilleur) : sans ça,
// les monstres qui échappent à ses premiers gardiens ne croisent plus personne.
// La Pépite de son plan passe à son tour (elle prend un mauvais socle, voir planDe),
// si elle est encore rentable ; il l'améliore dès que c'est rentable aussi.
// Ensuite, il choisit parmi ce qu'il peut payer l'achat le plus rentable :
// poser le prochain gardien de son plan, ou améliorer un gardien déjà posé.
function acheterMalin(etat, poses, vues, bons) {
  // une Pépite qui n'a plus le temps d'être rentable laisse sa place au premier
  // gardien de son plan (un gardien qui tire) : pas question de laisser un socle vide
  const remplacant = poses.find((p) => tire(p.type))?.type;
  for (;;) {
    const options = [];
    // les socles encore vides, dont le gardien prévu est déjà arrivé dans ce niveau
    const vides = poses
      .map((p) => (tire(p.type) || rentable(etat, p.type, 1) ? p : { ...p, type: remplacant }))
      .filter((p) => !tourSur(etat, p.socle) && estDisponible(etat, p.type));
    const bonsVides = vides.filter((p) => bons.has(p.socle) || !tire(p.type));
    if (bonsVides.length) {
      // le premier bon socle vide qu'il peut payer (sinon il attend la vague suivante)
      const payable = bonsVides.find((p) => caracteristiques(p.type, 1).cout <= etat.or);
      if (!payable || !construire(etat, payable.socle, payable.type)) return;
      continue;
    }
    const pepite = etat.tours.find((t) => !tire(t.type) && t.niveau < NIVEAU_MAX && rentable(etat, t.type, t.niveau + 1));
    if (pepite && prixAmelioration(pepite) <= etat.or) {
      ameliorer(etat, pepite.socle);
      continue;
    }
    const prochaine = vides[0];
    if (prochaine) {
      const gain = apport(etat.niveau, prochaine.socle, prochaine.type, 1, vues);
      options.push({ gain, prix: caracteristiques(prochaine.type, 1).cout, faire: () => construire(etat, prochaine.socle, prochaine.type) });
    }
    for (const tour of etat.tours) {
      if (tour.niveau >= NIVEAU_MAX || !tire(tour.type)) continue;
      const gain = apport(etat.niveau, tour.socle, tour.type, tour.niveau + 1, vues) - apport(etat.niveau, tour.socle, tour.type, tour.niveau, vues);
      options.push({ gain, prix: prixAmelioration(tour), faire: () => ameliorer(etat, tour.socle) });
    }
    const payables = options.filter((o) => o.prix <= etat.or).sort((a, b) => b.gain / b.prix - a.gain / a.prix);
    if (!payables.length || !payables[0].faire()) return;
  }
}

// Le plan d'un joueur imaginaire : une liste d'actions, dans l'ordre.
// Il remplit d'abord tous les socles (dans son ordre de préférence), puis
// améliore ses gardiens : tous au niveau 2, du premier posé au dernier,
// puis tous au niveau 3. (Essayé autrement : améliorer avant d'avoir
// rempli les socles fait perdre, car un gardien de plus couvre un autre
// morceau du chemin.)
// Un gardien qui ne tire pas (la Pépite) n'a pas besoin de voir le chemin : il prend
// le socle du bout de la liste (pour le bon joueur, le pire), et laisse les autres
// à ceux qui tirent.
export function planDe(strategie, classement) {
  const ordre = strategie.bien ? classement : [...classement].reverse();
  const socles = ordre.map(({ socle }) => socle);
  const poses = ordre.map((_, k) => {
    const type = strategie.motif[k % strategie.motif.length];
    return { action: 'poser', type, socle: tire(type) ? socles.shift() : socles.pop() };
  });
  if (!strategie.ameliore) return poses;
  const ameliorations = [2, 3].flatMap((niveau) => poses.map(({ socle }) => ({ action: 'ameliorer', socle, niveau })));
  return [...poses, ...ameliorations];
}

// Essaie une action du plan ; renvoie true si elle a pu être faite
function essayer(etat, action) {
  if (action.action === 'poser') return construire(etat, action.socle, action.type);
  const tour = tourSur(etat, action.socle);
  return Boolean(tour && tour.niveau === action.niveau - 1 && ameliorer(etat, action.socle));
}

// ── Jouer une partie entière sans écran ──────────────────────
// Avant chaque vague, le joueur imaginaire fait tout ce qu'il peut payer, dans
// l'ordre de son plan (ce qui est trop cher attend la vague suivante), puis
// lance la vague et regarde.
export function simuler(niveau, plan, graine = 1, malin = false) {
  const etat = creerPartie(niveau, graine);
  const aFaire = plan.slice();
  const vues = new Map();
  const poses = plan.filter((a) => a.action === 'poser');
  const classement = classerSocles(niveau);
  const bons = new Set(classement.filter((c) => c.vue >= 0.5 * classement[0].vue).map((c) => c.socle));
  const vagues = [];
  let marge = niveau.longueurChemin; // la plus petite distance entre un monstre et le château

  for (let v = 0; v < niveau.vagues.length; v++) {
    if (malin) {
      acheterMalin(etat, poses, vues, bons);
    } else {
      for (let k = 0; k < aFaire.length; k++) {
        if (essayer(etat, aFaire[k])) {
          aFaire.splice(k, 1);
          k--;
        }
      }
    }
    lancerVague(etat);
    let duree = 0, tues = 0;
    while (etat.statut === 'vague' && duree < DUREE_MAX_VAGUE) {
      majPartie(etat, PAS);
      duree += PAS;
      for (const e of etat.ennemis) marge = Math.min(marge, niveau.longueurChemin - e.d);
      for (const ev of etat.evenements) if (ev.type === 'mort') tues++;
      etat.evenements.length = 0; // dans le vrai jeu, c'est main.js qui vide cette liste
    }
    vagues.push({ numero: v + 1, statut: etat.statut, duree, tues, or: etat.or, gardiens: etat.tours.length });
    if (etat.statut !== 'preparation' && etat.statut !== 'gagne') break; // perdu (ou vague bloquée)
  }
  return {
    gagne: etat.statut === 'gagne',
    vagueAtteinte: vagues.length,
    vagues,
    marge: Math.max(0, marge),
    orFinal: etat.or,
    gardiens: etat.tours.map((t) => ({ socle: t.socle, type: t.type, niveau: t.niveau })),
  };
}

// ── Analyser un niveau ───────────────────────────────────────
// Chaque stratégie joue plusieurs parties (une par graine), car le hasard
// change un peu la position des monstres. pause() permet à l'éditeur de
// rester fluide entre deux parties ; progression(0 → 1) sert à la barre.
export async function analyser(niveau, { graines = [1, 2, 3], pause = async () => {}, progression = () => {} } = {}) {
  const classement = classerSocles(niveau);
  // Chaque joueur n'achète que les gardiens que ce niveau propose. Un joueur
  // qui n'a plus rien à acheter (« Que des Grondin » sans Grondin) ne joue pas.
  const strategies = STRATEGIES
    .map((s) => ({ ...s, motif: s.motif.filter((type) => type in niveau.gardiens) }))
    .filter((s) => s.motif.length);
  const total = strategies.length * graines.length;
  const resultats = [];
  let faites = 0;
  for (const strategie of strategies) {
    const plan = planDe(strategie, classement);
    const parties = [];
    for (const graine of graines) {
      parties.push(simuler(niveau, plan, graine, Boolean(strategie.malin)));
      faites++;
      progression(faites / total);
      await pause();
    }
    resultats.push(resumer(strategie, parties, niveau.survie));
  }
  const verdict = niveau.survie ? jugerSurvie(resultats) : juger(niveau, resultats);
  return { resultats, verdict, parties: total };
}

function resumer(strategie, parties, survie) {
  const victoires = parties.filter((p) => p.gagne).length;
  const vaguesPerdues = parties.filter((p) => !p.gagne).map((p) => p.vagueAtteinte);
  // les vagues tenues jusqu'au bout (celle où un monstre est entré ne compte pas)
  const vaguesTenues = parties.map((p) => (p.gagne ? p.vagueAtteinte : p.vagueAtteinte - 1));
  return {
    strategie,
    survie,
    vaguesTenues,                                    // ex. [31, 29, 33]
    vaguesTypiques: mediane(vaguesTenues),
    victoires,
    total: parties.length,
    vaguesPerdues,                                   // ex. [4, 5, 4]
    vagueTypique: mediane(vaguesPerdues),            // la vague où elle perd le plus souvent
    marge: Math.min(...parties.map((p) => p.marge)), // le moment le plus serré
    orFinal: Math.round(parties.reduce((n, p) => n + p.orFinal, 0) / parties.length),
    gardiens: parties[0].gardiens,                   // où elle avait posé ses gardiens
  };
}

function mediane(liste) {
  if (!liste.length) return null;
  const triee = [...liste].sort((a, b) => a - b);
  return triee[Math.floor(triee.length / 2)];
}

const vagues = (n) => `${n} vague${n > 1 ? 's' : ''}`;

// Le résultat d'une stratégie, en une courte phrase
export function texteResultat(r) {
  if (r.survie) {
    const min = Math.min(...r.vaguesTenues), max = Math.max(...r.vaguesTenues);
    return min === max ? `Tient ${vagues(min)}` : `Tient ${min} à ${vagues(max)}`;
  }
  if (r.victoires === r.total) return 'Gagne';
  if (r.victoires === 0) {
    const vagues = [...new Set(r.vaguesPerdues)].sort((a, b) => a - b);
    if (vagues.length === 1) return `Perd à la vague ${vagues[0]}`;
    if (vagues.length === 2) return `Perd à la vague ${vagues[0]} ou ${vagues[1]}`;
    return `Perd entre les vagues ${vagues[0]} et ${vagues[vagues.length - 1]}`;
  }
  return `Gagne ${r.victoires} fois sur ${r.total}`;
}

// ── Le verdict d'une arène de survie ─────────────────────────
// On ne gagne jamais : on regarde jusqu'où tient chaque joueur. Une bonne
// arène laisse un bon joueur aller assez loin, et sépare bien les bons
// joueurs des maladroits (sinon le classement ne départage personne).
function jugerSurvie(resultats) {
  const bon = resultats.find((r) => r.strategie.reference).vaguesTypiques;
  const maladroit = mediane(resultats.filter((r) => r.strategie.naif).map((r) => r.vaguesTypiques));
  const conseils = [];
  if (bon < 12) conseils.push('Même un bon joueur tombe tôt : commence plus doucement (vagues écrites, or de départ).');
  else if (bon > 50) conseils.push('Un bon joueur tient très longtemps : les parties vont durer. Des vagues écrites plus dures, ou moins de socles.');
  if (bon - maladroit < 5) conseils.push('Peu d’écart entre un bon joueur et un maladroit : le classement départagera mal les joueurs.');
  return {
    niveau: 'survie',
    titre: 'Mode survie',
    explication: `Le bon joueur tient ${vagues(bon)}, un joueur maladroit environ ${vagues(maladroit)}.`,
    objectif: null, // pas de difficulté visée : on ne gagne jamais une arène
    conseils,
  };
}

// ── Le verdict ───────────────────────────────────────────────
// Les verdicts possibles, du plus facile au plus dur
const RANGS = { 'trop-facile': 0, facile: 1, equilibre: 2, 'trop-dur': 3 };
// Le verdict attendu pour chaque difficulté visée par la fiche (« difficulte »)
const ATTENDU = { didacticiel: 'trop-facile', facile: 'facile', normal: 'equilibre' };

function juger(niveau, resultats) {
  const souvent = (r) => r.victoires * 3 >= r.total * 2; // au moins 2 fois sur 3
  const reference = resultats.find((r) => r.strategie.reference);
  const naifsGagnants = resultats.filter((r) => r.strategie.naif && souvent(r));
  // un joueur qui ne varie pas et qui gagne quand même (la Braise, l'Étincelle ou le Prisme partout)
  const sansVarierGagnant = resultats.find((r) => r.strategie.sansVarier && souvent(r));
  const conseils = [];

  // 1. Qui gagne, qui perd ?
  let niveauVerdict, titre, explication;
  if (!souvent(reference)) {
    niveauVerdict = 'trop-dur';
    titre = 'Trop dur';
    explication = `Même un joueur qui mélange bien ses gardiens perd (vague ${reference.vagueTypique}).`;
  } else if (naifsGagnants.length) {
    niveauVerdict = 'trop-facile';
    titre = 'Très facile';
    explication = `On gagne même en jouant mal (« ${naifsGagnants[0].strategie.nom} »).`;
  } else if (sansVarierGagnant) {
    niveauVerdict = 'facile';
    titre = 'Facile';
    explication = `Il suffit de mettre des ${caracteristiques(sansVarierGagnant.strategie.motif[0], 1).nom} partout : les vagues ne forcent pas à varier les gardiens.`;
  } else {
    niveauVerdict = 'equilibre';
    titre = 'Équilibré';
    explication = 'Il faut mélanger les gardiens et bien les placer pour gagner.';
  }

  // 2. Est-ce la difficulté visée ? ecart < 0 : plus facile que prévu ; > 0 : plus dur
  const visee = niveau.difficulte;
  const ecart = RANGS[niveauVerdict] - RANGS[ATTENDU[visee]];
  const objectif = {
    difficulte: visee,
    ecart,
    texte: ecart === 0 ? `Objectif atteint : c’est bien un niveau « ${DIFFICULTES[visee]} ».`
      : `${ecart < 0 ? 'Plus facile' : 'Plus dur'} que prévu (objectif : ${DIFFICULTES[visee]}).`,
  };
  if (ecart > 0) {
    conseils.push(niveauVerdict === 'trop-dur'
      ? 'Pour adoucir : plus d’or au départ, une vague plus courte ou moins de Cuirassés, ou un socle de plus près des virages.'
      : 'Pour adoucir : plus d’or au départ, ou des vagues moins fournies, pour qu’un joueur débutant s’en sorte.');
  } else if (ecart < 0) {
    conseils.push(niveauVerdict === 'trop-facile'
      ? 'Pour durcir : moins d’or au départ, plus de monstres dans les dernières vagues, ou des groupes plus serrés.'
      : 'Des groupes serrés appellent le Grondin, des Filous rapides appellent la Givrine : mélange-les dans les vagues.');
  }

  // 3. Les autres conseils. Pas pour un didacticiel : là, seul compte qu'on gagne sans peine.
  if (visee !== 'didacticiel') {
    // Le bon joueur a-t-il eu peur ?
    if (souvent(reference)) {
      const m = reference.marge;
      if (m > 10 && visee === 'normal') conseils.push(`Le bon joueur n’est jamais inquiété : le monstre le plus proche reste à ${m.toFixed(0)} cases du château. Les dernières vagues peuvent être plus dures.`);
      else if (m < 1.5) conseils.push(`C’est très serré : un monstre est passé à ${m.toFixed(1).replace('.', ',')} case du château. Un joueur un peu moins précis perdra.`);
    }

    // Les améliorations servent-elles à quelque chose dans ce niveau ?
    const sansAmelioration = resultats.find((r) => r.strategie.id === 'sans-amelioration');
    if (visee === 'normal' && sansAmelioration && souvent(reference) && souvent(sansAmelioration) && niveauVerdict !== 'trop-facile') {
      conseils.push('On peut gagner sans jamais améliorer ses gardiens. Pour rendre les améliorations utiles : moins de socles, ou des dernières vagues plus fortes.');
    }

    // Une vague qui arrête beaucoup de stratégies, c'est le « mur » du niveau
    const arrets = new Map();
    for (const r of resultats) if (r.vagueTypique) arrets.set(r.vagueTypique, (arrets.get(r.vagueTypique) || 0) + 1);
    const [vagueMur, combien] = [...arrets.entries()].sort((a, b) => b[1] - a[1])[0] || [];
    if (combien >= 3) {
      conseils.push(vagueMur === 1
        ? `Dès la vague 1, ${combien} stratégies sur ${resultats.length} perdent : le début est peut-être trop raide (or de départ ?).`
        : `La vague ${vagueMur} arrête ${combien} stratégies sur ${resultats.length} : c’est le grand test du niveau.`);
    }
  }
  return { niveau: niveauVerdict, titre, explication, objectif, conseils };
}
