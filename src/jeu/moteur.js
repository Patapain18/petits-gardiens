// ─────────────────────────────────────────────────────────────
// LE MOTEUR : les règles du jeu, sans aucun dessin.
// Il tient « l'état » de la partie (or, monstres, gardiens, tirs…)
// et le fait avancer d'un petit pas de temps à chaque appel.
// Les styles graphiques ne font que LIRE cet état pour le dessiner.
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, POUVOIRS, HEROS, PART_REVENTE, NIVEAU_MAX, HAUTEUR_VOL, caracteristiques } from './donnees.js';
import { creerAleatoire } from './aleatoire.js';
import { distance } from './calcul.js';
import { ficheDe, ficheDuHeros, pouvoirDe, socleActif, bonusDeDepart, proposerBenedictions, TOUTES_LES } from './benedictions.js';

// Le vent de Bourrasque : le monstre poussé glisse en arrière à VITESSE_RECUL cases
// par seconde, puis s'accroche au sol pendant ACCROCHE secondes (un autre coup de
// vent ne le pousse pas). Et un monstre ne peut être soufflé que SOUFFLES_MAX fois :
// ensuite, il s'agrippe pour de bon. Sans ça, des Bourrasques pourraient le renvoyer
// au départ du chemin pour toujours, et la vague ne finirait jamais.
const VITESSE_RECUL = 8;
const ACCROCHE = 2.5;
const SOUFFLES_MAX = 3;
const DUREE_BOND = 0.4; // le petit saut d'un monstre qui vient de naître (les petits de la Gigogne)

// Le jeu avance toujours par pas de 1/60 de seconde, dans le navigateur comme chez les joueurs
// imaginaires. Des pas toujours égaux, et un hasard qui part d'une graine : rejouer les mêmes
// décisions aux mêmes pas redonne exactement la même partie (voir enregistrement.js).
export const PAS = 1 / 60;

// niveau = l'objet renvoyé par chargerNiveau(fiche) : la partie se joue sur ce niveau.
// graine = le point de départ du hasard de la partie. Avec la même graine, une
// simulation se rejoue exactement pareil (pratique pour tester l'équilibrage).
export function creerPartie(niveau, graine = Math.floor(Math.random() * 1e9)) {
  return {
    niveau,
    graine,                   // le point de départ du hasard (les bénédictions proposées en dépendent)
    alea: creerAleatoire(graine),
    or: niveau.or,
    vague: 0,                 // nombre de vagues déjà lancées
    statut: 'preparation',    // 'preparation' | 'vague' | 'perdu' | 'gagne'
    temps: 0,
    pas: 0,                   // le nombre de pas de jeu déjà faits (l'horloge des parties enregistrées)
    ennemis: [],
    tours: [],                // les gardiens posés
    projectiles: [],
    aApparaitre: [],          // monstres en attente d'entrer sur le chemin
    evenements: [],           // ce qui vient de se passer (pour les effets visuels)
    battus: 0,                // monstres battus depuis le début (départage le classement de la survie)
    degatsPar: {},            // les dégâts faits par chacun (type de gardien, 'heros' ou 'meteore') : pour les statistiques des parties enregistrées
    prochainId: 1,
    // les pouvoirs du château (si la fiche du niveau en donne) : le temps qu'il reste avant
    // que chacun soit prêt (0 = prêt). Voir POUVOIRS dans donnees.js.
    pouvoirs: niveau.pouvoirs ? { meteore: 0, froid: 0 } : null,
    // les bénédictions (voir benedictions.js) : les bonus de la partie, celles déjà choisies,
    // les 3 proposées en ce moment (null s'il n'y a rien à choisir), et les socles bonus débloqués
    bonus: niveau.benedictions ? bonusDeDepart() : null,
    benedictions: [],
    offre: null,
    soclesDebloques: [],
    fiches: new Map(),        // les chiffres des gardiens avec les bonus (calculés une fois)
    heros: niveau.heros ? creerHeros(niveau) : null, // le Grand Gardien, que le joueur déplace (voir HEROS)
  };
}

// Le héros commence sur le chemin, juste devant le château : la dernière ligne de défense
function creerHeros(niveau) {
  const p = niveau.pointSurChemin(niveau.longueurChemin - 2);
  return {
    x: p.x, y: p.y,
    cible: null,      // là où le joueur l'envoie (null : il est arrêté)
    niveau: 1, xp: 0, // il gagne des niveaux en battant des monstres
    recharge: 0.5,    // le temps avant sa prochaine frappe
    attaque: 0,       // compte à rebours de l'animation de frappe
    angle: Math.PI,   // il regarde vers le début du chemin (à gauche)
  };
}

// ── Actions du joueur ────────────────────────────────────────

// indexSocle = numéro du socle dans la liste « socles » de la fiche du niveau
export function tourSur(etat, indexSocle) {
  return etat.tours.find((t) => t.socle === indexSocle) || null;
}

const partieFinie = (etat) => etat.statut === 'perdu' || etat.statut === 'gagne';

// Le nombre de vagues déjà terminées (celle en cours, ou celle où un monstre est entré, ne compte pas)
export const vaguesTerminees = (etat) => (etat.statut === 'vague' || etat.statut === 'perdu' ? etat.vague - 1 : etat.vague);

// La fiche du niveau dit à partir de quelle vague chaque gardien arrive :
// « givrine: 2 » = on peut la poser dès que la vague 1 est terminée (pour préparer la 2).
// Un gardien absent de la liste n'est pas proposé dans ce niveau.
export function estDisponible(etat, type) {
  const arrivee = etat.niveau.gardiens[type];
  return arrivee !== undefined && vaguesTerminees(etat) >= arrivee - 1;
}

export function construire(etat, indexSocle, type) {
  if (!GARDIENS[type] || !estDisponible(etat, type)) return false;
  const { cout } = caracteristiques(type, 1);
  const socle = etat.niveau.socles[indexSocle];
  if (!socle || !socleActif(etat, indexSocle) || etat.or < cout || tourSur(etat, indexSocle) || partieFinie(etat)) return false;
  etat.or -= cout;
  etat.tours.push({
    id: etat.prochainId++,
    type,
    niveau: 1,
    investi: cout,      // tout ce qu'on a dépensé pour lui (achat + améliorations)
    socle: indexSocle,
    x: socle.x,
    y: socle.y,
    recharge: 0.3,      // petit délai avant le premier tir
    angle: Math.PI / 2, // regarde vers le bas de l'écran au départ
    attaque: 0,         // compte à rebours de l'animation d'attaque
  });
  etat.evenements.push({ type: 'construction', x: socle.x, y: socle.y, quoi: type });
  return true;
}

// Le prix de la prochaine amélioration d'un gardien (null s'il est déjà au maximum)
export function prixAmelioration(tour) {
  return tour.niveau < NIVEAU_MAX ? caracteristiques(tour.type, tour.niveau + 1).cout : null;
}

export function ameliorer(etat, indexSocle) {
  const tour = tourSur(etat, indexSocle);
  if (!tour || partieFinie(etat)) return false;
  const prix = prixAmelioration(tour);
  if (prix === null || etat.or < prix) return false;
  etat.or -= prix;
  tour.investi += prix;
  tour.niveau++;
  etat.evenements.push({ type: 'amelioration', x: tour.x, y: tour.y, quoi: tour.type, niveau: tour.niveau });
  return true;
}

// Ce qu'on récupère en revendant : une part de tout ce qu'on a dépensé pour ce gardien
export const prixRevente = (tour) => Math.floor(tour.investi * PART_REVENTE);

export function vendre(etat, indexSocle) {
  const tour = tourSur(etat, indexSocle);
  if (!tour) return false;
  etat.or += prixRevente(tour);
  etat.tours = etat.tours.filter((t) => t !== tour);
  etat.evenements.push({ type: 'vente', x: tour.x, y: tour.y, quoi: tour.type });
  return true;
}

export function lancerVague(etat) {
  const { vagues } = etat.niveau;
  if (etat.statut !== 'preparation' || etat.vague >= vagues.length) return false;
  if (etat.offre) return false; // une bénédiction attend d'être choisie
  // On transforme la description de la vague en une liste d'apparitions datées.
  // force : les points de vie sont multipliés (des monstres renforcés, en mode survie)
  for (const groupe of vagues[etat.vague]) {
    for (let i = 0; i < groupe.nombre; i++) {
      etat.aApparaitre.push({ type: groupe.type, force: groupe.force || 1, quand: etat.temps + groupe.delai + i * groupe.ecart });
    }
  }
  etat.aApparaitre.sort((a, b) => a.quand - b.quand);
  etat.vague++;
  etat.statut = 'vague';
  return true;
}

// ── Les pouvoirs du château ──────────────────────────────────
// Un pouvoir se déclenche seulement pendant une vague, et s'il est rechargé.
export const pouvoirPret = (etat, nom) => Boolean(etat.pouvoirs) && etat.statut === 'vague' && etat.pouvoirs[nom] <= 0;

// Le Météore : il tombe en (x, y) au bout de « chute » secondes (c'est un tir comme les
// autres, rangé avec eux : les styles le dessinent pendant sa chute)
export function lancerMeteore(etat, x, y) {
  if (!pouvoirPret(etat, 'meteore')) return false;
  const { recharge, chute, hauteur, rayon, part } = pouvoirDe(etat, 'meteore'); // (avec les bénédictions)
  etat.pouvoirs.meteore = recharge;
  etat.projectiles.push({ id: etat.prochainId++, type: 'meteore', x, y, z: hauteur, reste: chute, chute, rayon, part });
  etat.evenements.push({ type: 'meteore', x, y });
  return true;
}

// Le Grand froid : tous les monstres sur le chemin gèlent sur place (pas ceux qui sont sous terre)
export function lancerGrandFroid(etat) {
  if (!pouvoirPret(etat, 'froid')) return false;
  const { recharge, duree } = pouvoirDe(etat, 'froid');
  etat.pouvoirs.froid = recharge;
  for (const e of etat.ennemis) {
    if (e.pv > 0 && !e.cache) e.gele = duree * (MONSTRES[e.type].gel ?? 1);
  }
  etat.evenements.push({ type: 'grandFroid' });
  return true;
}

// ── Le héros ─────────────────────────────────────────────────
// Le joueur l'envoie en (x, y) : il y marche (sans sortir de la carte, ni entrer dans un étang)
export function envoyerHeros(etat, x, y) {
  const h = etat.heros;
  if (!h || partieFinie(etat)) return false;
  const { largeur, hauteur } = etat.niveau;
  x = Math.max(0.4, Math.min(largeur - 0.4, x));
  y = Math.max(0.4, Math.min(hauteur - 0.4, y));
  if (etat.niveau.distanceEtang(x, y) < 0.3) return false;
  h.cible = { x, y };
  etat.evenements.push({ type: 'herosEnvoye', x, y });
  return true;
}

// Il marche vers l'endroit choisi ; arrêté, il frappe le sol quand des monstres sont à portée
function majHeros(etat, dt) {
  const h = etat.heros;
  h.attaque = Math.max(0, h.attaque - dt);
  if (h.cible) {
    const dx = h.cible.x - h.x, dy = h.cible.y - h.y, d = distance(dx, dy);
    const pas = HEROS.vitesse * dt;
    h.angle = Math.atan2(dy, dx);
    if (d <= pas) { h.x = h.cible.x; h.y = h.cible.y; h.cible = null; h.recharge = Math.max(h.recharge, 0.2); }
    else { h.x += (dx / d) * pas; h.y += (dy / d) * pas; }
    return; // il marche : il ne frappe pas
  }
  h.recharge -= dt;
  if (h.recharge > 0) return;
  const f = ficheDuHeros(etat);
  // les monstres à portée, les plus proches d'abord (pas ceux qui volent, ni ceux qui sont sous terre)
  const autour = [];
  for (const e of etat.ennemis) {
    if (e.pv <= 0 || e.cache || MONSTRES[e.type].volant) continue;
    const d = distance(e.x - h.x, e.y - h.y);
    if (d <= f.rayon) autour.push({ e, d });
  }
  if (!autour.length) { h.recharge = 0; return; }
  autour.sort((a, b) => a.d - b.d);
  h.recharge = f.cadence;
  h.attaque = 0.3;
  h.angle = Math.atan2(autour[0].e.y - h.y, autour[0].e.x - h.x);
  let xp = 0;
  for (const { e } of autour.slice(0, f.monstresMax)) {
    blesser(etat, e, f.degats, { par: 'heros' });
    if (e.pv <= 0) xp += MONSTRES[e.type].prime; // il gagne la prime de chaque monstre qu'il bat
  }
  etat.evenements.push({ type: 'frappe', x: h.x, y: h.y, rayon: f.rayon });
  h.xp += xp;
  while (h.niveau < HEROS.niveaux.length && h.xp >= HEROS.niveaux[h.niveau].xp) {
    h.niveau++;
    etat.evenements.push({ type: 'herosNiveau', x: h.x, y: h.y, niveau: h.niveau });
  }
}

// ── La mise à jour (appelée ~60 fois par seconde) ────────────

export function majPartie(etat, dt) {
  if (etat.statut === 'perdu' || etat.statut === 'gagne') return;
  etat.pas++;
  etat.temps += dt;
  // les pouvoirs se rechargent pendant les vagues seulement
  if (etat.pouvoirs && etat.statut === 'vague') {
    for (const nom in etat.pouvoirs) etat.pouvoirs[nom] = Math.max(0, etat.pouvoirs[nom] - dt);
  }
  faireApparaitre(etat);
  deplacerEnnemis(etat, dt);
  if (etat.statut === 'perdu') return;
  cracherLeFeu(etat, dt);
  if (etat.heros) majHeros(etat, dt);
  faireTirerLesTours(etat, dt);
  deplacerProjectiles(etat, dt);
  // On retire les monstres morts
  etat.ennemis = etat.ennemis.filter((e) => e.pv > 0);
  verifierFinDeVague(etat);
}

function faireApparaitre(etat) {
  while (etat.aApparaitre.length && etat.aApparaitre[0].quand <= etat.temps) {
    // d : où il apparaît sur le chemin (0 = au départ ; les petits naissent là où leur parent est tombé)
    const { type, force, d = 0, petit = false } = etat.aApparaitre.shift();
    const fiche = MONSTRES[type];
    etat.ennemis.push({
      id: etat.prochainId++,
      type,
      force,                                 // ses points de vie ont été multipliés par ce nombre
      pv: fiche.pv * force,
      pvMax: fiche.pv * force,
      d,                                     // distance parcourue sur le chemin
      decalage: (etat.alea() - 0.5) * 0.5,  // petit écart sur le côté, pour faire plus vivant
      x: 0, y: 0, dx: 1, dy: 0,
      ralenti: 0,                            // temps restant de ralentissement
      facteurRalenti: 1,
      gele: 0,                               // temps restant où il est gelé sur place (le Grand froid)
      touche: 0,                             // flash quand il prend un coup
      recul: 0,                              // ce qu'il doit encore reculer, poussé par le vent
      reculTotal: 0,                         // tout ce que le vent l'a fait reculer (les rochers en vol s'en servent)
      accroche: 0,                           // temps restant pendant lequel le vent ne le pousse plus
      souffles: 0,                           // combien de fois le vent l'a déjà poussé
      bond: petit ? 1 : 0,                   // de 1 à 0 : le petit saut d'un monstre qui vient de naître
      cache: false,                          // sous terre (la Taupe) : personne ne peut le viser
      creuse: fiche.creuse ? fiche.creuse.dessus : 0, // temps avant de replonger (ou de ressortir)
      feu: fiche.feu ? fiche.feu.toutesLes : 0,       // temps avant de cracher du feu (le Dragon)
    });
  }
}

function deplacerEnnemis(etat, dt) {
  const { pointSurChemin, longueurChemin } = etat.niveau;
  for (const e of etat.ennemis) {
    const fiche = MONSTRES[e.type];
    if (e.ralenti > 0) e.ralenti -= dt; else e.facteurRalenti = 1;
    e.touche = Math.max(0, e.touche - dt);
    e.accroche = Math.max(0, e.accroche - dt);
    e.bond = Math.max(0, e.bond - dt / DUREE_BOND);
    if (e.gele > 0) {
      // gelé par le Grand froid : il ne bouge plus du tout, jusqu'au dégel
      e.gele = Math.max(0, e.gele - dt);
      continue;
    }
    if (fiche.creuse) {
      // la Taupe plonge sous terre, puis ressort, et ainsi de suite
      e.creuse -= dt;
      if (e.creuse <= 0) {
        e.cache = !e.cache;
        e.creuse = e.cache ? fiche.creuse.dessous : fiche.creuse.dessus;
        etat.evenements.push({ type: e.cache ? 'plonge' : 'surgit', x: e.x, y: e.y, quoi: e.type });
      }
    }
    if (e.recul > 0) {
      // poussé par le vent : il glisse en arrière (sans jamais repasser avant le départ)
      const pas = Math.min(e.recul, VITESSE_RECUL * dt, e.d);
      e.recul = e.d > pas ? e.recul - pas : 0;
      e.d -= pas;
      e.reculTotal += pas;
    } else {
      // sous terre, la Taupe file plus vite (« vitesse » de sa fiche creuse)
      let vitesse = e.cache ? fiche.vitesse * fiche.creuse.vitesse : fiche.vitesse;
      // le héros, arrêté tout près, leur barre la route (pas à ceux qui volent ou creusent dessous)
      const h = etat.heros;
      if (h && !h.cible && !e.cache && !fiche.volant && distance(e.x - h.x, e.y - h.y) < HEROS.barrage.rayon) vitesse *= HEROS.barrage.facteur;
      e.d += vitesse * e.facteurRalenti * dt;
    }

    const p = pointSurChemin(e.d);
    // Le décalage latéral est perpendiculaire à la direction de marche
    e.x = p.x - p.dy * e.decalage;
    e.y = p.y + p.dx * e.decalage;
    e.dx = p.dx;
    e.dy = p.dy;

    // Arrivé au bout du chemin = il entre dans le château = défaite !
    if (e.d >= longueurChemin) {
      etat.statut = 'perdu';
      etat.evenements.push({ type: 'fuite', x: e.x, y: e.y, quoi: e.type });
      return;
    }
  }
}

// Peut-on viser ce monstre ? Pas s'il est sous terre (la Taupe) ; et un tir en cloche
// retombe au sol : il ne touche pas un monstre qui vole.
const peutViser = (fiche, ennemi) => !ennemi.cache && !(fiche.projectile.cloche && MONSTRES[ennemi.type].volant);

// La hauteur où l'on vise un monstre (en cases) : son corps, plus haut s'il vole
export const hauteurDe = (ennemi) => 0.35 + (MONSTRES[ennemi.type].volant ? HAUTEUR_VOL : 0);

function faireTirerLesTours(etat, dt) {
  for (const tour of etat.tours) {
    const fiche = ficheDe(etat, tour.type, tour.niveau); // les chiffres de son niveau actuel (avec les bénédictions)
    tour.attaque = Math.max(0, tour.attaque - dt);
    tour.rayon = null; // le monstre que touche son rayon en ce moment (le Prisme)
    if (!fiche.projectile) continue; // un gardien qui ne tire pas (la Pépite)
    if (tour.assomme > 0) {
      // assommé par le feu du Dragon : il attend, sans recharger
      tour.assomme -= dt;
      tour.chauffe = 0;
      continue;
    }
    tour.recharge -= dt;

    // Cible : le monstre le plus avancé qui est à portée (et qu'il peut toucher).
    // Un rayon, lui, reste accroché à sa cible tant qu'il peut la toucher : c'est
    // comme ça qu'il chauffe (et pendant ce temps, les autres monstres passent).
    const aPortee = (e) => e.pv > 0 && peutViser(fiche, e) && distance(e.x - tour.x, e.y - tour.y) <= fiche.portee;
    let cible = fiche.rayon ? etat.ennemis.find((e) => e.id === tour.cibleRayon && aPortee(e)) || null : null;
    if (!cible) {
      for (const e of etat.ennemis) if (aPortee(e) && (!cible || e.d > cible.d)) cible = e;
    }
    if (!cible) { tour.chauffe = 0; continue; }

    // Le gardien se tourne vers sa cible
    tour.angle = Math.atan2(cible.y - tour.y, cible.x - tour.x);

    if (fiche.rayon) { tirerRayon(etat, tour, fiche, cible, dt); continue; } // un rayon tire sans arrêt

    if (tour.recharge <= 0) {
      tour.recharge = fiche.cadence;
      tour.attaque = 0.25;
      if (fiche.projectile.instantane) foudroyer(etat, tour, fiche, cible); // l'éclair frappe tout de suite
      else etat.projectiles.push(creerProjectile(etat, tour, fiche, cible));
      etat.evenements.push({ type: 'tir', x: tour.x, y: tour.y, quoi: tour.type, id: tour.id });
    }
  }
}

// Le rayon du Prisme : il brûle sa cible sans arrêt (« degats » = par seconde), et il chauffe
// tant qu'il reste sur le même monstre : jusqu'à « max » fois plus fort au bout de « montee »
// secondes. S'il change de cible, il repart de zéro. Il traverse les carapaces.
function tirerRayon(etat, tour, fiche, cible, dt) {
  const { montee, max } = fiche.rayon;
  if (tour.cibleRayon !== cible.id) { tour.cibleRayon = cible.id; tour.chauffe = 0; }
  tour.chauffe = Math.min(1, (tour.chauffe || 0) + dt / montee);
  tour.rayon = cible.id;
  blesser(etat, cible, fiche.degats * (1 + (max - 1) * tour.chauffe) * dt, { perce: true, flash: false, par: tour.type });
}

// Le feu du Dragon : de temps en temps, il crache sur le gardien le plus proche à sa portée,
// qui reste assommé un moment (il ne tire plus). S'il n'y a personne, il réessaie bientôt.
function cracherLeFeu(etat, dt) {
  for (const e of etat.ennemis) {
    const feu = MONSTRES[e.type].feu;
    if (!feu || e.pv <= 0 || e.gele > 0) continue; // gelé, il ne crache plus
    e.feu -= dt;
    if (e.feu > 0) continue;
    let cible = null, plusPres = feu.portee;
    for (const tour of etat.tours) {
      const d = distance(tour.x - e.x, tour.y - e.y);
      if (d <= plusPres && !(tour.assomme > 0) && caracteristiques(tour.type, tour.niveau).projectile) { plusPres = d; cible = tour; }
    }
    if (!cible) { e.feu = 0.5; continue; }
    cible.assomme = feu.duree;
    e.feu = feu.toutesLes;
    etat.evenements.push({ type: 'flamme', x: e.x, y: e.y, vers: { x: cible.x, y: cible.y }, quoi: e.type, socle: cible.socle });
  }
}

// L'éclair d'Étincelle : il frappe sa cible, puis saute sur le monstre le plus proche
// qu'il n'a pas encore touché (s'il est assez près), et ainsi de suite.
// Chaque saut fait un peu moins mal que le précédent.
function foudroyer(etat, tour, fiche, cible) {
  const { nombre, saut, attenuation } = fiche.rebonds;
  const touches = [];
  const points = [{ x: tour.x, y: tour.y, h: 0.9 }]; // le trajet de l'éclair, pour le dessiner
  let degats = fiche.degats;
  let actuel = cible;
  while (actuel && touches.length <= nombre) {
    touches.push(actuel);
    points.push({ x: actuel.x, y: actuel.y, h: hauteurDe(actuel) });
    blesser(etat, actuel, degats, { par: tour.type });
    degats *= attenuation;
    // le suivant : le plus proche des monstres encore debout et pas encore touchés
    let suivant = null, plusPres = saut;
    for (const e of etat.ennemis) {
      if (e.pv <= 0 || e.cache || touches.includes(e)) continue;
      const d = distance(e.x - actuel.x, e.y - actuel.y);
      if (d <= plusPres) { plusPres = d; suivant = e; }
    }
    actuel = suivant;
  }
  etat.evenements.push({ type: 'eclair', x: cible.x, y: cible.y, quoi: tour.type, points });
}

function creerProjectile(etat, tour, fiche, cible) {
  const p = {
    id: etat.prochainId++,
    type: fiche.projectile.type,
    gardien: tour.type,
    fiche,                            // les chiffres du gardien au moment du tir (dégâts, zone…)
    x: tour.x, y: tour.y, z: 0.6,     // z = hauteur au-dessus du sol
    cibleId: cible.id,
    vitesse: fiche.projectile.vitesse,
  };
  if (fiche.projectile.cloche) {
    // Tir en cloche : on vise l'endroit où sera le monstre (approximativement)
    const temps = distance(cible.x - tour.x, cible.y - tour.y) / p.vitesse;
    const enMarche = Math.max(0, temps - cible.gele); // gelé, il ne repart qu'au dégel
    p.dVisee = cible.d + MONSTRES[cible.type].vitesse * cible.facteurRalenti * enMarche; // là où il sera, sur le chemin
    p.reculVu = cible.reculTotal; // si le vent le repousse pendant le vol, le point de chute reculera d'autant
    const futur = etat.niveau.pointSurChemin(p.dVisee);
    p.departX = tour.x; p.departY = tour.y;
    p.arriveeX = futur.x; p.arriveeY = futur.y;
    p.progression = 0;
    p.duree = Math.max(0.35, temps);
  }
  return p;
}

function deplacerProjectiles(etat, dt) {
  const restants = [];
  for (const p of etat.projectiles) {
    const { fiche } = p;

    if (p.type === 'meteore') {
      // le Météore tombe tout droit, de plus en plus bas, puis s'écrase
      p.reste -= dt;
      p.z = POUVOIRS.meteore.hauteur * Math.max(0, p.reste / p.chute) ** 2; // il accélère en tombant
      if (p.reste <= 0) meteoreTombe(etat, p);
      else restants.push(p);
      continue;
    }

    if (p.duree) {
      // Si une Bourrasque a repoussé la cible pendant le vol, le point de chute recule avec elle
      // (sinon le vent ferait rater tous les rochers du Grondin : ils se gêneraient)
      const cible = etat.ennemis.find((e) => e.id === p.cibleId && e.pv > 0);
      if (cible && cible.reculTotal !== p.reculVu) {
        const futur = etat.niveau.pointSurChemin(p.dVisee - (cible.reculTotal - p.reculVu));
        p.arriveeX = futur.x; p.arriveeY = futur.y;
      }
      // Trajectoire en cloche : on avance de 0 à 1, la hauteur suit une parabole
      p.progression += dt / p.duree;
      const t = Math.min(1, p.progression);
      p.x = p.departX + (p.arriveeX - p.departX) * t;
      p.y = p.departY + (p.arriveeY - p.departY) * t;
      p.z = 0.6 + Math.sin(t * Math.PI) * 2.2;
      if (t >= 1) { exploser(etat, p, fiche); continue; }
    } else {
      // Tir direct : il poursuit sa cible
      const cible = etat.ennemis.find((e) => e.id === p.cibleId && e.pv > 0 && !e.cache);
      if (!cible) continue; // la cible est morte (ou a plongé sous terre) entre-temps : le tir disparaît
      const dx = cible.x - p.x, dy = cible.y - p.y;
      const dist = distance(dx, dy);
      const pas = p.vitesse * dt;
      if (dist <= pas) { toucher(etat, cible, fiche, p); continue; }
      p.x += (dx / dist) * pas;
      p.y += (dy / dist) * pas;
      p.z += (hauteurDe(cible) - p.z) * Math.min(1, dt * 6); // va doucement à la hauteur du monstre
    }
    restants.push(p);
  }
  etat.projectiles = restants;
}

function toucher(etat, ennemi, fiche, projectile) {
  blesser(etat, ennemi, fiche.degats, { par: projectile.gardien });
  if (fiche.ralentissement) {
    // le gel touche la cible et les monstres tout proches d'elle.
    // « gel » (fiche du monstre) : 0,5 = le gel ne lui fait que la moitié de l'effet
    const { facteur, duree, zone = 0 } = fiche.ralentissement;
    for (const e of etat.ennemis) {
      if (e.pv <= 0 || e.cache || distance(e.x - ennemi.x, e.y - ennemi.y) > zone + 0.01) continue;
      const gel = MONSTRES[e.type].gel ?? 1;
      e.ralenti = duree;
      e.facteurRalenti = gel === 1 ? facteur : 1 - (1 - facteur) * gel;
    }
  }
  if (fiche.souffle) souffler(etat, ennemi, fiche.souffle);
  etat.evenements.push({ type: 'impact', x: ennemi.x, y: ennemi.y, quoi: projectile.type });
}

// Le souffle de Bourrasque : les monstres autour de la cible reculent sur le chemin.
// « vent » (fiche du monstre) : un volant léger recule plus loin, un lourd moins, et un
// monstre à 0 pas du tout. Un monstre qui vient d'être poussé est encore accroché au sol,
// et celui qui a déjà été soufflé SOUFFLES_MAX fois ne bouge plus.
function souffler(etat, cible, { recul, zone }) {
  for (const e of etat.ennemis) {
    if (e.pv <= 0 || e.cache || e.accroche > 0 || e.souffles >= SOUFFLES_MAX) continue;
    if (distance(e.x - cible.x, e.y - cible.y) > zone + 0.01) continue;
    const vent = MONSTRES[e.type].vent ?? 1;
    if (vent <= 0) continue;
    e.recul = recul * vent;
    e.accroche = ACCROCHE;
    e.souffles++;
  }
  etat.evenements.push({ type: 'souffle', x: cible.x, y: cible.y, rayon: zone });
}

// L'explosion d'un rocher touche les monstres autour du point de chute, mais au plus
// « monstresMax » : les plus proches d'abord. Sans cette limite, des monstres gelés par une
// Givrine, tassés les uns contre les autres, prenaient tous le même rocher (jusqu'à 75 d'un
// coup dans l'arène !), et Givrine + Grondin rendait le mode survie bien trop facile.
function exploser(etat, p, fiche) {
  const autour = [];
  for (const e of etat.ennemis) {
    const d = distance(e.x - p.x, e.y - p.y);
    if (e.pv > 0 && peutViser(fiche, e) && d <= fiche.zone) autour.push({ e, d });
  }
  autour.sort((a, b) => a.d - b.d);
  for (const { e } of autour.slice(0, fiche.monstresMax ?? Infinity)) blesser(etat, e, fiche.degats, { par: p.gardien });
  etat.evenements.push({ type: 'explosion', x: p.x, y: p.y, quoi: p.type, rayon: fiche.zone });
}

// Le Météore s'écrase : tous les monstres autour (même ceux qui volent, il vient du ciel ;
// pas ceux qui sont sous terre) perdent une part de la vie QUI LEUR RESTE. Une part plutôt
// qu'un nombre de dégâts : en survie, les monstres deviennent de plus en plus solides, et le
// Météore reste utile jusqu'au bout. Mais une part de ce qui reste, jamais tout : seul, il
// ne bat aucun monstre, il faut des gardiens pour finir le travail. (Essayé avec une part de
// la vie maximale : deux Météores battaient n'importe quel monstre, et une défense de
// Givrine seules tenait les 150 vagues de l'arène !)
function meteoreTombe(etat, p) {
  let touches = 0;
  for (const e of etat.ennemis) {
    if (e.pv > 0 && !e.cache && distance(e.x - p.x, e.y - p.y) <= p.rayon) { blesser(etat, e, e.pv * p.part, { perce: true, par: 'meteore' }); touches++; }
  }
  etat.evenements.push({ type: 'explosion', x: p.x, y: p.y, quoi: 'meteore', rayon: p.rayon, touches });
}

// perce : le coup traverse les carapaces ; flash : le monstre clignote (pas pour un rayon
// continu, il clignoterait sans arrêt). Le rayon du Prisme fait les deux.
// par : qui frappe (un type de gardien, 'heros' ou 'meteore'). Ses dégâts s'ajoutent à
// etat.degatsPar, et l'événement « mort » le répète, avec gele (était-il gelé par le Grand
// froid ?) : les statistiques des parties enregistrées s'en servent (qui fait le plus de
// dégâts, qui donne le dernier coup, combien de combos…).
function blesser(etat, ennemi, degats, { perce = false, flash = true, par = null } = {}) {
  if (ennemi.pv <= 0) return;
  const armure = MONSTRES[ennemi.type].armure;
  if (armure && !perce) {
    // la carapace : chaque coup perd « armure » dégâts (mais fait toujours au moins 1)
    degats = Math.max(1, degats - armure);
    etat.evenements.push({ type: 'carapace', x: ennemi.x, y: ennemi.y, quoi: ennemi.type });
  }
  if (ennemi.gele > 0) degats *= POUVOIRS.froid.fragile; // gelé par le Grand froid, il est fragile
  if (par) etat.degatsPar[par] = (etat.degatsPar[par] || 0) + Math.min(degats, ennemi.pv); // (ce qu'il lui enlève vraiment)
  ennemi.pv -= degats;
  if (flash) ennemi.touche = 0.12;
  if (ennemi.pv <= 0) {
    const fiche = MONSTRES[ennemi.type];
    etat.battus++;
    const prime = Math.round(fiche.prime * (etat.bonus?.primes ?? 1)); // (la bénédiction « Butin »)
    etat.or += prime;
    etat.evenements.push({ type: 'mort', x: ennemi.x, y: ennemi.y, d: ennemi.d, quoi: ennemi.type, prime, par, gele: ennemi.gele > 0 });
    if (fiche.enfants) faireNaitre(etat, ennemi, fiche.enfants);
  }
}

// Les petits d'un monstre qui vient d'être battu (la Gigogne, le Colosse) : ils naissent
// là où il est tombé, un peu en arrière les uns des autres, puis repartent vers le château.
// On les range dans la liste d'attente plutôt que directement sur le chemin : ainsi,
// l'explosion qui a battu leur parent ne les touche pas.
function faireNaitre(etat, parent, { type, nombre }) {
  for (let i = 0; i < nombre; i++) {
    etat.aApparaitre.unshift({ type, force: parent.force, quand: etat.temps, d: Math.max(0, parent.d - i * 0.35), petit: true });
  }
  etat.evenements.push({ type: 'naissance', x: parent.x, y: parent.y, quoi: type, nombre });
}

function verifierFinDeVague(etat) {
  if (etat.statut !== 'vague') return;
  if (etat.aApparaitre.length || etat.ennemis.length) return;
  etat.statut = etat.vague >= etat.niveau.vagues.length ? 'gagne' : 'preparation';
  if (etat.statut !== 'preparation') return;
  etat.or += 20 + etat.vague * 10; // bonus de fin de vague
  // les gardiens qui creusent (la Pépite) rapportent leur récolte
  for (const tour of etat.tours) {
    const recolte = caracteristiques(tour.type, tour.niveau).recolte;
    if (!recolte) continue;
    etat.or += recolte;
    etat.evenements.push({ type: 'recolte', x: tour.x, y: tour.y, quoi: tour.type, or: recolte });
  }
  // toutes les 5 vagues tenues, le joueur choisit une bénédiction (avant de lancer la suivante)
  if (etat.niveau.benedictions && etat.vague % TOUTES_LES === 0) {
    const offre = proposerBenedictions(etat);
    if (offre.length) etat.offre = offre;
  }
}
