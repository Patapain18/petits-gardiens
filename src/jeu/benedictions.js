// ─────────────────────────────────────────────────────────────
// LES BÉNÉDICTIONS (dans les arènes dont la fiche dit « benedictions: true »)
// Toutes les 5 vagues tenues, le joueur choisit 1 bonus parmi 3, et le garde
// jusqu'à la fin de la partie. Chaque partie se construit donc autrement :
// on choisit les bonus qui vont avec sa défense, ou on change sa défense
// pour profiter d'un bonus.
//
// Les 3 propositions sont tirées au hasard… avec une graine fixe : à la même
// vague, tout le monde voit les mêmes (s'il a fait les mêmes choix avant).
// C'est ce qui garde le classement juste.
//
// Les bonus de la partie sont rangés dans etat.bonus (voir bonusDeDepart) :
// le moteur les lit à travers ficheDe() pour les gardiens, et pouvoirDe()
// pour les pouvoirs du château.
// ─────────────────────────────────────────────────────────────
import { GARDIENS, POUVOIRS, caracteristiques } from './donnees.js';
import { creerAleatoire } from './aleatoire.js';

export const TOUTES_LES = 5; // une bénédiction toutes les 5 vagues tenues

// Le gardien est-il proposé dans ce niveau ?
const propose = (type) => (etat) => type in etat.niveau.gardiens;

// Les bénédictions. sorte : sa famille (pour sa couleur, et pour ne pas proposer deux
// bonus d'or à la fois) ; effet(b, etat) : ce qu'elle change ; max : combien de fois on
// peut la choisir (sans max : à volonté) ; quand(etat) : si elle peut être proposée.
export const BENEDICTIONS = {
  feu: {
    nom: 'Feu de joie', sorte: 'gardien', quand: propose('braise'),
    texte: 'Les Braise font 35 % de dégâts en plus.',
    effet: (b) => { b.degats.braise = (b.degats.braise ?? 1) * 1.35; },
  },
  hiver: {
    nom: 'Hiver éternel', sorte: 'gardien', quand: propose('givrine'), max: 2,
    texte: 'Le gel des Givrine dure 1,5 seconde de plus, et ralentit encore plus.',
    effet: (b) => { b.gel.duree += 1.5; b.gel.facteur *= 0.8; },
  },
  rochers: {
    nom: 'Rochers géants', sorte: 'gardien', quand: propose('grondin'), max: 2,
    texte: 'Les rochers des Grondin touchent 2 monstres de plus, et leur explosion est plus large.',
    effet: (b) => { b.rochers.monstres += 2; b.rochers.zone += 0.25; },
  },
  lynx: {
    nom: 'Œil de lynx', sorte: 'gardiens', max: 2,
    texte: 'Tous les gardiens voient 0,5 case plus loin.',
    effet: (b) => { b.portee += 0.5; },
  },
  entrainement: {
    nom: 'Entraînement', sorte: 'gardiens',
    texte: 'Tous les gardiens font 15 % de dégâts en plus.',
    effet: (b) => { for (const type in GARDIENS) b.degats[type] = (b.degats[type] ?? 1) * 1.15; },
  },
  furie: {
    nom: 'Furie', sorte: 'gardiens',
    texte: 'Tous les gardiens tirent 12 % plus vite.',
    effet: (b) => { b.cadence *= 0.88; },
  },
  etoiles: {
    nom: 'Pluie d’étoiles', sorte: 'pouvoir', quand: (etat) => Boolean(etat.pouvoirs), max: 2,
    texte: 'Le Météore se recharge 30 % plus vite.',
    effet: (b) => { b.meteore.recharge *= 0.7; },
  },
  comete: {
    nom: 'Comète', sorte: 'pouvoir', quand: (etat) => Boolean(etat.pouvoirs), max: 2,
    texte: 'Le Météore est plus gros et plus fort : il touche 0,4 case plus loin, et enlève 10 % de vie en plus.',
    effet: (b) => { b.meteore.rayon += 0.4; b.meteore.part += 0.1; },
  },
  polaire: {
    nom: 'Froid polaire', sorte: 'pouvoir', quand: (etat) => Boolean(etat.pouvoirs), max: 2,
    texte: 'Le Grand froid dure 1 seconde de plus, et se recharge 10 secondes plus vite.',
    effet: (b) => { b.froid.duree += 1; b.froid.recharge -= 10; },
  },
  // l'or ne sert plus à grand-chose quand la défense est complète : ces deux-là ne sont
  // proposés que jusqu'à la vague 15
  tresor: {
    nom: 'Coffre au trésor', sorte: 'or', quand: (etat) => etat.vague <= 15,
    texte: '400 pièces d’or, tout de suite.',
    effet: (b, etat) => { etat.or += 400; },
  },
  butin: {
    nom: 'Butin', sorte: 'or', quand: (etat) => etat.vague <= 15, max: 1,
    texte: 'Les monstres rapportent 50 % d’or en plus.',
    effet: (b) => { b.primes *= 1.5; },
  },
  socle: {
    nom: 'Nouveau socle', sorte: 'socle', quand: (etat) => prochainSocle(etat) >= 0,
    texte: 'Un socle de plus apparaît sur la carte : une place pour un gardien de plus.',
    effet: (b, etat) => {
      const i = prochainSocle(etat);
      etat.soclesDebloques.push(i);
      const s = etat.niveau.socles[i];
      etat.evenements.push({ type: 'nouveauSocle', x: s.x, y: s.y, socle: i });
    },
  },
};

// Les bonus d'une partie qui commence : rien ne change encore
export function bonusDeDepart() {
  return {
    degats: {},                       // par type de gardien : 1,35 = 35 % de dégâts en plus
    cadence: 1,                       // 0,88 = ils tirent 12 % plus vite (le temps entre deux tirs × 0,88)
    portee: 0,                        // en cases, en plus
    gel: { duree: 0, facteur: 1 },    // le gel des Givrine : secondes en plus, et vitesse des gelés × facteur
    rochers: { monstres: 0, zone: 0 }, // les rochers des Grondin : monstres touchés en plus, rayon en plus
    meteore: { recharge: 1, rayon: 0, part: 0 },
    froid: { duree: 0, recharge: 0 },
    primes: 1,                        // l'or rapporté par chaque monstre battu
  };
}

// Un socle « bonus » (dans la liste soclesBonus de la fiche) n'existe pour le joueur
// qu'une fois débloqué par la bénédiction « Nouveau socle »
export const socleActif = (etat, i) => !etat.niveau.socles[i]?.bonus || etat.soclesDebloques.includes(i);

// Le prochain socle bonus encore endormi (-1 s'il n'y en a plus)
export function prochainSocle(etat) {
  return etat.niveau.socles.findIndex((s, i) => s.bonus && !etat.soclesDebloques.includes(i));
}

// Les chiffres d'un gardien dans CETTE partie : ceux de sa fiche, avec les bénédictions.
// Gardés une fois calculés (on les recalcule après chaque nouvelle bénédiction).
export function ficheDe(etat, type, niveau) {
  const base = caracteristiques(type, niveau);
  const b = etat.bonus;
  if (!b) return base;
  const cle = type + ':' + niveau;
  let f = etat.fiches.get(cle);
  if (f) return f;
  f = { ...base };
  if (base.degats !== undefined) f.degats = base.degats * (b.degats[type] ?? 1);
  if (base.cadence) f.cadence = base.cadence * b.cadence;
  if (base.portee) f.portee = base.portee + b.portee;
  if (base.ralentissement) {
    f.ralentissement = { ...base.ralentissement, duree: base.ralentissement.duree + b.gel.duree, facteur: base.ralentissement.facteur * b.gel.facteur };
  }
  if (base.zone) {
    f.zone = base.zone + b.rochers.zone;
    if (base.monstresMax) f.monstresMax = base.monstresMax + b.rochers.monstres;
  }
  etat.fiches.set(cle, f);
  return f;
}

// Les chiffres d'un pouvoir du château dans cette partie
export function pouvoirDe(etat, nom) {
  const base = POUVOIRS[nom];
  const b = etat.bonus?.[nom];
  if (!b) return base;
  if (nom === 'meteore') return { ...base, recharge: base.recharge * b.recharge, rayon: base.rayon + b.rayon, part: base.part + b.part };
  return { ...base, duree: base.duree + b.duree, recharge: Math.max(10, base.recharge + b.recharge) };
}

// Combien de fois cette bénédiction a déjà été choisie
const dejaPrises = (etat, id) => etat.benedictions.filter((x) => x === id).length;

// Les 3 bénédictions proposées après la vague en cours (toujours les mêmes à la même étape,
// pour les mêmes choix d'avant). Jamais deux bonus d'or à la fois.
export function proposerBenedictions(etat) {
  const etape = etat.vague / TOUTES_LES;
  const alea = creerAleatoire((etat.graine ?? 1) * 7919 + etape * 104729);
  const pioche = Object.keys(BENEDICTIONS).filter((id) => {
    const { quand, max } = BENEDICTIONS[id];
    return (!quand || quand(etat)) && (max === undefined || dejaPrises(etat, id) < max);
  });
  const choix = [];
  while (choix.length < 3 && pioche.length) {
    const id = pioche.splice(Math.floor(alea() * pioche.length), 1)[0];
    if (BENEDICTIONS[id].sorte === 'or' && choix.some((c) => BENEDICTIONS[c].sorte === 'or')) continue;
    choix.push(id);
  }
  return choix;
}

// Le joueur choisit l'une des bénédictions proposées
export function choisirBenediction(etat, id) {
  if (!etat.offre?.includes(id)) return false;
  BENEDICTIONS[id].effet(etat.bonus, etat);
  etat.benedictions.push(id);
  etat.fiches.clear(); // les chiffres des gardiens ont peut-être changé
  etat.offre = null;
  etat.evenements.push({ type: 'benediction', quoi: id });
  return true;
}
