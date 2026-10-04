// ─────────────────────────────────────────────────────────────
// DES SITUATIONS DE JEU, POUR ÉCOUTER LE SON « EN VRAI »
// Un bruitage peut sembler parfait tout seul, et se perdre (ou tout couvrir)
// au milieu d'une vague. Ici, le bon joueur imaginaire (jeu/equilibrage.js)
// joue un niveau, et on note chaque événement sonore d'une de ses vagues, à
// son heure, comme le jeu les donne au son : les tirs, les monstres battus,
// les pouvoirs, le héros… et ce que fait la musique (calme avant la vague,
// la batterie pendant, le thème des chefs quand un chef est là), et le
// bourdonnement des rayons du Prisme.
// L'atelier du son les rejoue hors ligne (hors-ligne.js) pour tout mesurer :
// la musique est-elle couverte ? Le compresseur doit-il trop travailler ?
// ─────────────────────────────────────────────────────────────
import { chargerNiveau } from '../jeu/niveau.js';
import { simuler, STRATEGIES, planDe, classerSocles } from '../jeu/equilibrage.js';
import { MONSTRES } from '../jeu/donnees.js';
import { PAS } from '../jeu/moteur.js';
import { reglageBourdon } from './son.js';

export const DUREE_SITUATION = 30; // on écoute 30 secondes de chaque situation
const PREPARATION = 4;             // avant la vague : 4 secondes de calme, où le joueur achète

// Les situations. moment : quelles 30 secondes de la vague on garde :
//   'debut'         : la préparation, puis le début de la vague ;
//   'plusCharge'    : les 30 secondes où il y a le plus de bruitages ;
//   'arriveeDuChef' : à partir de 6 secondes avant l'arrivée du chef ;
//   'finDuChef'     : les 30 secondes qui finissent 6 secondes après la chute du chef.
export const SITUATIONS = [
  { id: 'monde1', nom: 'Une vague du monde 1', niveau: 'monde1-3', vague: 4, moment: 'plusCharge', epoque: 'pixel',
    aide: 'Le bois brumeux, vague 4 : les tirs et les monstres battus, sur le thème avec sa batterie.' },
  { id: 'colosse', nom: 'Le Colosse arrive', niveau: 'monde2-4', vague: 8, moment: 'debut', epoque: 'cartoon',
    aide: 'La vallée du Colosse, dernière vague : on achète au calme, on lance la vague, le Colosse sort aussitôt (tonnerre et thème des chefs).' },
  { id: 'dragon', nom: 'Le Dragon arrive', niveau: 'monde3-4', vague: 8, moment: 'arriveeDuChef', epoque: 'voxel',
    aide: 'Le pic du Dragon, dernière vague : 90 monstres, puis le Dragon (tonnerre, thème des chefs, flammes), et les rayons du Prisme.' },
  { id: 'chute', nom: 'La chute du Dragon', niveau: 'monde3-4', vague: 8, moment: 'finDuChef', epoque: 'voxel',
    aide: 'La fin de la même vague : le Dragon tombe (le plus gros bruitage du jeu), puis le calme revient.' },
  { id: 'foule', nom: 'La foule de la survie', niveau: 'arene-pixel', vague: 18, moment: 'plusCharge', epoque: 'pixel',
    aide: 'L’arène, vague 18 : une foule de monstres, le Météore, le Grand froid et le héros, tout en même temps.' },
];

// Ce qui s'achète avant la vague (les événements du premier pas de la vague : le joueur imaginaire
// achète d'un coup, un vrai joueur clique l'un après l'autre)
const ACHATS = new Set(['construction', 'amelioration', 'vente', 'benediction', 'nouveauSocle']);
// Ceux qu'on achète en ouvrant le menu d'un socle (un « menu » juste avant)
const PAR_LE_MENU = new Set(['construction', 'amelioration', 'vente']);

// Le nom du bruitage d'un événement du moteur (comme son.js) et d'où il vient (de −1, à gauche, à 1)
const nomDe = (ev) => (ev.type === 'tir' ? `tir:${ev.quoi}` : ev.type);
const panDe = (ev, largeur) => (ev.x !== undefined ? Math.max(-1, Math.min(1, (ev.x / largeur) * 2 - 1)) * 0.6 : 0);

// Fait jouer la vague par le bon joueur imaginaire et note tout. fiches : les fiches de niveau, par id.
// Renvoie { situation, duree, evenements: [{ t, nom, ev, pan }], mixages: [{ t, mixage }],
// bourdon: [{ t, volume, frequence }], vagueDuree } : les heures en secondes, depuis le début des
// 30 secondes gardées.
export function enregistrerSituation(situation, fiches) {
  const niveau = chargerNiveau(fiches[situation.niveau]);
  const cible = Math.min(situation.vague, niveau.vagues.length);
  niveau.vagues = niveau.vagues.slice(0, cible); // la partie s'arrête après cette vague
  const strategie = STRATEGIES.find((s) => s.reference);
  const plan = planDe(strategie, classerSocles(niveau));

  const evenements = [], mixages = [{ t: 0, mixage: 'calme' }], bourdon = [];
  const chefsVus = new Set();
  let debut = null, mixage = 'calme', dernierBourdon = -1, arriveeDuChef = null, finDuChef = null, dernierPas = 0;
  simuler(niveau, plan, 1, Boolean(strategie.malin), 'malin', 'malin', (etat) => {
    if (etat.vague !== cible) return;
    const premier = debut === null;
    if (premier) {
      debut = etat.temps - PAS;
      evenements.push({ t: PREPARATION, nom: 'vague', ev: {}, pan: 0 }); // main.js joue « vague » en la lançant
    }
    const t = PREPARATION + etat.temps - debut;
    dernierPas = t;
    const achats = premier ? etat.evenements.filter((ev) => ACHATS.has(ev.type)) : [];
    // les achats, étalés pendant la préparation (un menu ouvert, puis l'achat, une seconde plus tard)
    achats.forEach((ev, k) => {
      const quand = 0.6 + (k * (PREPARATION - 1)) / Math.max(1, achats.length);
      if (PAR_LE_MENU.has(ev.type)) evenements.push({ t: Math.max(0.05, quand - 0.45), nom: 'menu', ev: {}, pan: 0 });
      evenements.push({ t: quand, nom: nomDe(ev), ev, pan: panDe(ev, niveau.largeur) });
    });
    for (const ev of etat.evenements) {
      if (premier && ACHATS.has(ev.type)) continue;
      evenements.push({ t, nom: nomDe(ev), ev, pan: panDe(ev, niveau.largeur) });
      if (ev.type === 'mort' && MONSTRES[ev.quoi]?.boss) finDuChef = t;
    }
    // la musique (comme son.maj) : un chef qui arrive fait le tonnerre, et son thème joue tant qu'il est là
    const chefs = etat.statut === 'vague' ? etat.ennemis.filter((e) => MONSTRES[e.type].boss) : [];
    for (const c of chefs) {
      if (chefsVus.has(c.id)) continue;
      chefsVus.add(c.id);
      evenements.push({ t, nom: 'chef', ev: {}, pan: 0 });
      arriveeDuChef ??= t;
    }
    const voulu = chefs.length ? 'chef' : etat.statut === 'vague' ? 'vague' : 'calme';
    if (voulu !== mixage) { mixages.push({ t, mixage: voulu }); mixage = voulu; }
    // le bourdonnement des rayons du Prisme, dix fois par seconde
    if (t - dernierBourdon >= 0.1) {
      const rayons = etat.tours.filter((tour) => tour.rayon);
      if (rayons.length || bourdon.length) {
        const [volume, frequence] = reglageBourdon(rayons);
        bourdon.push({ t, volume, frequence });
      }
      dernierBourdon = t;
    }
  });
  if (debut === null) throw new Error(`Le joueur imaginaire n’arrive pas à la vague ${cible} de ${situation.niveau}.`);
  // la vague finie, les rayons du Prisme s'éteignent (et le bourdonnement avec eux)
  if (bourdon.length) bourdon.push({ t: dernierPas + PAS, volume: 0, frequence: bourdon[bourdon.length - 1].frequence });
  const vagueDuree = evenements.reduce((m, e) => Math.max(m, e.t), 0);

  // les 30 secondes gardées
  let depart = 0;
  if (situation.moment === 'plusCharge') {
    let meilleur = -1;
    for (let d = 0; d <= Math.max(0, vagueDuree - DUREE_SITUATION); d += 0.5) {
      const n = evenements.filter((e) => e.t >= d && e.t < d + DUREE_SITUATION).length;
      if (n > meilleur) { meilleur = n; depart = d; }
    }
  } else if (situation.moment === 'arriveeDuChef' && arriveeDuChef !== null) {
    depart = Math.max(0, arriveeDuChef - 6);
  } else if (situation.moment === 'finDuChef' && finDuChef !== null) {
    depart = Math.max(0, finDuChef + 6 - DUREE_SITUATION);
  }
  const garder = (liste) => liste.filter((e) => e.t >= depart && e.t < depart + DUREE_SITUATION).map((e) => ({ ...e, t: e.t - depart }));
  const mixageAuDepart = [...mixages].reverse().find((m) => m.t <= depart)?.mixage || 'calme';
  return {
    situation,
    duree: DUREE_SITUATION,
    depart,
    vagueDuree,
    evenements: garder(evenements).sort((a, b) => a.t - b.t),
    mixages: [{ t: 0, mixage: mixageAuDepart }, ...garder(mixages).filter((m) => m.t > 0)],
    bourdon: garder(bourdon),
  };
}

// Le mixage de la musique à une heure donnée (avant le début : celui du début)
export const mixageA = (enregistrement, t) => [...enregistrement.mixages].reverse().find((m) => m.t <= Math.max(0, t))?.mixage || 'calme';
