// ─────────────────────────────────────────────────────────────
// LES FICHES DES PERSONNAGES
// Tout ce qu'il faut savoir sur un personnage, au même endroit :
// - ses chiffres de jeu (prix, dégâts, vitesse…), lus par le moteur ;
// - son « apparence », lue par les trois styles graphiques. Elle est rangée à
//   part, dans apparences.json (des données, comme les fiches de niveau) : l'atelier
//   des modèles (modeles.html) la règle et l'enregistre.
// Changer une fiche change le personnage dans TOUS les styles.
// Vitesses en cases par seconde, portées et zones en cases, temps en secondes.
//
// L'apparence : (vocabulaire complet dans src/rendus/apparence.js)
// - gabarit    : la silhouette de base (gardien, gelee, rongeur, golem, volant, tortue,
//                taupe, dragon)
// - couleurs   : clair (le dessus éclairé), peau, fonce (l'ombre, les pattes),
//                et parfois yeux, mousse, lave, carapace, museau ou ventre
// - taille     : 1 = taille normale
// - accessoires: flamme, cristaux, echarpe, cornes, mortier, cape, couronne,
//                antennes, moulinet, petits
//                (une couleur peut être précisée : { type: 'flamme', couleur: '#5ab8ff' })
//                L'ordre compte en pixel art : chaque accessoire se peint par-dessus
//                les précédents (la couronne en dernier passe devant la flamme).
// ─────────────────────────────────────────────────────────────
import APPARENCES from './apparences.json' with { type: 'json' };

// Les volants volent à cette hauteur au-dessus du chemin (en cases) : le moteur
// s'en sert pour viser, les styles pour les dessiner là-haut.
export const HAUTEUR_VOL = 0.8;

// Nos petits monstres gentils : les GARDIENS (= les tours).
// Chacun a 3 niveaux. Le « cout » du niveau 1 est le prix d'achat ;
// celui des niveaux 2 et 3 est le prix de l'amélioration.
// Une amélioration rapporte à peu près autant de dégâts par pièce qu'un
// nouveau gardien : améliorer est donc un vrai choix, pas un piège.
// Code visuel : niveau 2 = une cape, niveau 3 = une couronne dorée (la même pour tous,
// pour qu'on reconnaisse un niveau 3 d'un coup d'œil).
// « description » et « conseil » sont lus par le didacticiel, sur la fiche qui
// présente un nouveau personnage.
export const GARDIENS = {
  braise: {
    nom: 'Braise',
    role: 'Crache des boules de feu, rapide et fiable',
    description: 'Une petite boule de feu sur pattes. Elle crache des flammes vite et souvent, toujours sur le monstre le plus avancé.',
    conseil: 'Pas chère et fiable : c’est la base de toute défense. Pose-la près d’un virage, elle aura le temps de tirer plus souvent.',
    projectile: { vitesse: 9, type: 'feu' },
    niveaux: [
      {
        cout: 70, degats: 9, cadence: 0.8, portee: 3.0, // cadence : une attaque toutes les 0,8 s
        apparence: APPARENCES.gardiens.braise[0],
      },
      {
        nom: 'Braise ardente', cout: 70, degats: 14, cadence: 0.62, portee: 3.2,
        apparence: APPARENCES.gardiens.braise[1],
      },
      {
        nom: 'Brasier', cout: 110, degats: 22, cadence: 0.54, portee: 3.4,
        apparence: APPARENCES.gardiens.braise[2],
      },
    ],
  },
  givrine: {
    nom: 'Givrine',
    role: 'Gèle un petit groupe : les monstres avancent deux fois moins vite',
    description: 'Elle souffle de la glace. Les monstres touchés avancent deux fois moins vite, et le froid gagne aussi leurs voisins.',
    conseil: 'Elle fait peu de dégâts : son rôle est de ralentir les monstres, pour que tes autres gardiens aient le temps de les battre.',
    projectile: { vitesse: 8, type: 'glace' },
    niveaux: [
      {
        cout: 75, degats: 7, cadence: 0.8, portee: 3.0,
        // facteur 0,45 = vitesse × 0,45 ; zone = le gel touche aussi les voisins de la cible
        ralentissement: { facteur: 0.45, duree: 2.5, zone: 0.9 },
        apparence: APPARENCES.gardiens.givrine[0],
      },
      {
        nom: 'Givre', cout: 70, degats: 11, cadence: 0.7, portee: 3.2,
        ralentissement: { facteur: 0.4, duree: 3, zone: 1.1 },
        apparence: APPARENCES.gardiens.givrine[1],
      },
      {
        nom: 'Blizzard', cout: 110, degats: 16, cadence: 0.6, portee: 3.4,
        ralentissement: { facteur: 0.35, duree: 3.5, zone: 1.4 },
        apparence: APPARENCES.gardiens.givrine[2],
      },
    ],
  },
  grondin: {
    nom: 'Grondin',
    role: 'Lance des rochers qui touchent tout un petit groupe',
    description: 'Le plus costaud. Il lance des rochers en cloche qui explosent et touchent jusqu’à 5 monstres d’un coup.',
    conseil: 'Il tire lentement mais très fort : parfait contre les groupes serrés et les monstres résistants. Il coûte cher, garde de l’or pour lui.',
    projectile: { vitesse: 7, type: 'rocher', cloche: true }, // tir en cloche : il retombe au sol, les volants passent au-dessus
    niveaux: [
      {
        cout: 120, degats: 24, cadence: 2.3, portee: 3.6,
        zone: 1.2, // rayon de l'explosion
        // l'explosion touche au plus 5 monstres, les plus près du point de chute (voir exploser() dans moteur.js)
        monstresMax: 5,
        apparence: APPARENCES.gardiens.grondin[0], // un peu plus costaud que les autres
      },
      {
        nom: 'Tonnerre', cout: 100, degats: 40, cadence: 2.1, portee: 3.8, zone: 1.4, monstresMax: 6,
        apparence: APPARENCES.gardiens.grondin[1],
      },
      {
        nom: 'Séisme', cout: 150, degats: 62, cadence: 1.9, portee: 4.0, zone: 1.6, monstresMax: 8,
        apparence: APPARENCES.gardiens.grondin[2],
      },
    ],
  },

  // ── Les nouveaux gardiens du monde 2 ──
  etincelle: {
    nom: 'Étincelle',
    role: 'Un éclair qui saute d’un monstre à l’autre, et touche les volants',
    description: 'Une petite pile électrique sur pattes. Son éclair frappe un monstre, puis saute sur ses voisins, un peu moins fort à chaque saut.',
    conseil: 'Parfaite contre les groupes et contre les volants. Mais seule face à un gros monstre, elle tape moins fort qu’une Braise.',
    projectile: { type: 'eclair', instantane: true }, // instantané : l'éclair frappe tout de suite, rien ne voyage
    niveaux: [
      {
        cout: 90, degats: 9, cadence: 1.1, portee: 3.0,
        // rebonds : après sa cible, l'éclair saute sur « nombre » autres monstres, chacun à moins
        // de « saut » cases du précédent ; chaque saut fait « attenuation » × les dégâts du précédent.
        // Réglé pour valoir à peu près une Braise sur un groupe, et bien moins sur un monstre seul
        // (son éclair ne rate jamais : il frappe tout de suite, rien ne se perd en route).
        rebonds: { nombre: 2, saut: 1.6, attenuation: 0.6 },
        apparence: APPARENCES.gardiens.etincelle[0],
      },
      {
        nom: 'Éclair', cout: 75, degats: 14, cadence: 1.0, portee: 3.2,
        rebonds: { nombre: 3, saut: 1.7, attenuation: 0.62 },
        apparence: APPARENCES.gardiens.etincelle[1],
      },
      {
        nom: 'Foudre', cout: 115, degats: 20, cadence: 0.95, portee: 3.4,
        rebonds: { nombre: 3, saut: 1.8, attenuation: 0.65 },
        apparence: APPARENCES.gardiens.etincelle[2],
      },
    ],
  },
  bourrasque: {
    nom: 'Bourrasque',
    role: 'Souffle les monstres en arrière sur le chemin',
    description: 'Un petit coup de vent sur pattes, coiffé d’un moulinet. Son souffle fait reculer les monstres… qui doivent refaire du chemin !',
    conseil: 'Elle fait très peu de dégâts : pose-la près de gardiens qui tapent fort, ils garderont les monstres plus longtemps sous le feu. Les volants, légers, s’envolent plus loin ; les Cuirassés, lourds, reculent à peine.',
    projectile: { vitesse: 10, type: 'vent' },
    niveaux: [
      {
        cout: 75, degats: 3, cadence: 2.6, portee: 3.0,
        // souffle : les monstres à moins de « zone » cases de la cible reculent de « recul » cases
        souffle: { recul: 1.2, zone: 0.9 },
        apparence: APPARENCES.gardiens.bourrasque[0],
      },
      {
        nom: 'Rafale', cout: 75, degats: 5, cadence: 2.3, portee: 3.2,
        souffle: { recul: 1.5, zone: 1.1 },
        apparence: APPARENCES.gardiens.bourrasque[1],
      },
      {
        nom: 'Tornade', cout: 115, degats: 8, cadence: 2.0, portee: 3.4,
        souffle: { recul: 1.9, zone: 1.3 },
        apparence: APPARENCES.gardiens.bourrasque[2],
      },
    ],
  },

  // ── Les nouveaux gardiens du monde 3 ──
  pepite: {
    nom: 'Pépite',
    role: 'Ne tire pas : creuse de l’or, et en rapporte à chaque vague',
    description: 'Une petite mineuse, casque sur la tête et pioche dans le dos. Elle ne se bat pas : pendant chaque vague, elle creuse, et à la fin elle te rapporte de l’or.',
    conseil: 'Pose-la tôt, sur un socle loin du chemin : en quatre vagues, elle est remboursée, et tout le reste est du bonus. Mais une Pépite de trop, et il te manquera des gardiens qui tapent.',
    // pas de projectile : elle ne vise personne. « recolte » = l'or rapporté à la fin de chaque vague
    niveaux: [
      {
        cout: 100, recolte: 25, portee: 0,
        apparence: APPARENCES.gardiens.pepite[0],
      },
      {
        nom: 'Filon', cout: 80, recolte: 45, portee: 0,
        apparence: APPARENCES.gardiens.pepite[1],
      },
      {
        nom: 'Trésor', cout: 120, recolte: 75, portee: 0,
        apparence: APPARENCES.gardiens.pepite[2],
      },
    ],
  },
  prisme: {
    nom: 'Prisme',
    role: 'Un rayon de lumière qui chauffe sur le même monstre, et traverse les carapaces',
    description: 'Un petit gardien rose qui fait flotter un cristal au-dessus de sa tête. Le cristal concentre la lumière en un rayon qui ne lâche plus son monstre : plus il reste dessus, plus il brûle.',
    conseil: 'Parfait contre les gros monstres et contre les carapaces, que son rayon traverse. Mais face à une foule, il reste accroché à un seul monstre pendant que les autres passent.',
    // rayon : un rayon qui ne s'arrête pas (« degats » = par seconde) et reste accroché à sa
    // cible tant qu'il peut la toucher ; il chauffe jusqu'à « max » fois plus fort en « montee » secondes
    projectile: { type: 'rayon' },
    niveaux: [
      {
        cout: 110, degats: 10, portee: 3.2,
        rayon: { montee: 2, max: 3 },
        apparence: APPARENCES.gardiens.prisme[0],
      },
      {
        nom: 'Rayon', cout: 90, degats: 15, portee: 3.4,
        rayon: { montee: 1.8, max: 3.2 },
        apparence: APPARENCES.gardiens.prisme[1],
      },
      {
        nom: 'Arc-en-ciel', cout: 130, degats: 22, portee: 3.6,
        rayon: { montee: 1.6, max: 3.5 },
        apparence: APPARENCES.gardiens.prisme[2],
      },
    ],
  },
};

export const NIVEAU_MAX = 3;

// Les caractéristiques d'un gardien à un niveau donné : ce qui est commun à
// tous ses niveaux (nom, rôle, projectile) + ce qui est propre à ce niveau.
// On garde le résultat en mémoire : le moteur en a besoin à chaque instant.
const memoire = new Map();
export function caracteristiques(type, niveau = 1) {
  const cle = type + ':' + niveau;
  if (!memoire.has(cle)) {
    const { niveaux, ...commun } = GARDIENS[type];
    memoire.set(cle, { ...commun, ...niveaux[niveau - 1], niveau, type });
  }
  return memoire.get(cle);
}

// Les méchants qui suivent le chemin : les MONSTRES
// pv = points de vie ; vitesse en cases par seconde ; prime = l'or gagné quand on le bat.
// Et parfois :
// - volant : il vole au-dessus du chemin (les tirs en cloche ne le touchent pas) ;
// - enfants : quand on le bat, d'autres monstres apparaissent là où il est tombé ;
// - vent : combien il recule quand une Bourrasque souffle (1 = normal, 0 = pas du tout) ;
// - gel : combien le gel le ralentit (1 = normal, 0,5 = deux fois moins) ;
// - armure : sa carapace ; chaque coup perd ces dégâts-là (un rayon la traverse) ;
// - creuse : il passe « dessous » secondes sous terre (personne ne peut le viser), puis
//   « dessus » secondes dehors ; sous terre, il va « vitesse » fois plus vite ;
// - feu : toutes les « toutesLes » secondes, il crache sur le gardien le plus proche
//   (à moins de « portee » cases), qui reste assommé « duree » secondes ;
// - coup : les points de vie qu'il enlève chaque seconde au héros, quand le héros le bloque
//   (sans « coup » : HEROS.coupParDefaut) ;
// - boss : c'est un chef, présenté comme tel par le didacticiel.
export const MONSTRES = {
  gluant: {
    nom: 'Gluant', pv: 44, vitesse: 1.15, prime: 6, coup: 5,
    description: 'Une gelée qui avance en sautillant. Ni rapide, ni très solide : c’est le monstre de base.',
    conseil: 'Une ou deux Braise suffisent pour arrêter un petit groupe de Gluants.',
    apparence: APPARENCES.monstres.gluant,
  },
  filou: {
    nom: 'Filou', pv: 26, vitesse: 2.1, prime: 5, coup: 4,
    description: 'Petit et fragile… mais très rapide ! Il fonce vers le château en profitant de la moindre faille.',
    conseil: 'Une Givrine le ralentit : tes autres gardiens auront le temps de l’attraper.',
    apparence: APPARENCES.monstres.filou,
  },
  cuirasse: {
    nom: 'Cuirassé', pv: 260, vitesse: 0.68, prime: 22, coup: 12,
    vent: 0.5, // lourd : le vent le fait deux fois moins reculer
    description: 'Un golem de pierre couvert de mousse. Il marche lentement, mais il encaisse énormément de coups.',
    conseil: 'Il faut beaucoup de dégâts : les rochers du Grondin et les gardiens améliorés en viennent à bout.',
    apparence: APPARENCES.monstres.cuirasse,
  },

  // ── Les nouveaux monstres du monde 2 ──
  voltigeur: {
    nom: 'Voltigeur', pv: 34, vitesse: 1.55, prime: 7,
    volant: true,
    vent: 1.5, // léger : le vent l'emporte une fois et demie plus loin
    description: 'Une petite chauve-souris qui vole au-dessus du chemin. Les rochers du Grondin retombent par terre sans jamais la toucher.',
    conseil: 'Braise, Givrine et Étincelle l’attrapent en plein vol, le Grondin non. Une Bourrasque l’envoie valser loin en arrière.',
    apparence: APPARENCES.monstres.voltigeur,
  },
  gigogne: {
    nom: 'Gigogne', pv: 120, vitesse: 0.85, prime: 10,
    enfants: { type: 'gluant', nombre: 3 }, // battue, elle libère 3 Gluants
    vent: 0.7,
    description: 'Une grosse maman gelée qui porte ses petits sur le dos. Quand on la bat, trois Gluants sautent par terre et continuent la route !',
    conseil: 'Garde des gardiens derrière elle pour les petits. Un Grondin bien placé les attrape tous les trois d’un seul rocher.',
    apparence: APPARENCES.monstres.gigogne,
  },
  colosse: {
    nom: 'Colosse', pv: 5500, vitesse: 0.42, prime: 100,
    boss: true,
    enfants: { type: 'cuirasse', nombre: 2 }, // battu, il se brise en deux Cuirassés
    vent: 0,  // bien trop lourd : le vent ne le pousse pas
    gel: 0.5, // le gel ne le ralentit qu'à moitié
    description: 'Le chef des monstres : un géant de roche et de lave, qui avance lentement vers le château en faisant trembler le sol. Et quand on le bat, il se brise en deux !',
    conseil: 'Il faut beaucoup de dégâts, tout le long du chemin : des gardiens améliorés, des Grondin, des Étincelle. Et garde de la place derrière lui pour les deux Cuirassés.',
    apparence: APPARENCES.monstres.colosse,
  },

  // ── Les nouveaux monstres du monde 3 ──
  carapace: {
    nom: 'Carapace', pv: 90, vitesse: 0.8, prime: 13,
    armure: 5, // chaque coup perd 5 dégâts sur sa carapace
    vent: 0.7,
    description: 'Une tortue de pierre à la carapace épaisse. Chaque coup perd 5 dégâts sur sa carapace : les petits coups ne lui font presque rien.',
    conseil: 'Il faut de gros coups : le rocher du Grondin, des gardiens améliorés… ou le rayon du Prisme, qui traverse la carapace.',
    apparence: APPARENCES.monstres.carapace,
  },
  taupe: {
    nom: 'Taupe', pv: 50, vitesse: 1.1, prime: 9,
    creuse: { dessous: 1.6, dessus: 2, vitesse: 1.5 }, // 1,6 s sous terre (1,5 fois plus vite), puis 2 s dehors
    description: 'Une taupe à lunettes qui creuse sous le chemin. Sous terre, aucun gardien ne peut la viser : on ne voit qu’un petit tas de terre qui avance.',
    conseil: 'Elle ressort régulièrement : des gardiens tout le long du chemin la cueillent chaque fois qu’elle sort.',
    apparence: APPARENCES.monstres.taupe,
  },
  dragon: {
    nom: 'Dragon', pv: 3500, vitesse: 0.45, prime: 150,
    boss: true,
    volant: true,
    vent: 0,  // bien trop fort : le vent ne le pousse pas
    gel: 0.5, // le gel ne le ralentit qu'à moitié
    feu: { toutesLes: 5, portee: 3.2, duree: 2 },
    description: 'Le chef des monstres d’aujourd’hui : un énorme dragon rouge qui vole au-dessus du chemin. De temps en temps, il crache du feu sur un gardien, qui reste assommé.',
    conseil: 'Les rochers du Grondin ne l’atteignent pas : il faut des Prisme, qui ne le lâchent plus, et des Braise bien améliorées. Et assez de gardiens pour que les autres continuent quand il en assomme un.',
    apparence: APPARENCES.monstres.dragon,
  },
};

// Les POUVOIRS DU CHÂTEAU : c'est le joueur qui les déclenche, pendant une vague, dans les
// niveaux dont la fiche dit « pouvoirs: true » (pour l'instant, l'arène). C'est là que le joueur
// fait la différence : viser au bon endroit, et garder le froid pour le moment où ça craque.
// - le Météore revient au début de chaque vague (« parVague » : combien on en a pour la vague) ;
// - le Grand froid se recharge pendant « recharge » secondes de vague (le temps entre deux
//   vagues ne compte pas : on ne peut pas attendre tranquillement qu'il revienne).
export const POUVOIRS = {
  meteore: {
    nom: 'Météore',
    touche: '1', // la touche du clavier qui le déclenche
    description: 'Un par vague : vise un endroit du chemin, un météore y tombe une seconde plus tard, et les monstres touchés perdent la moitié de la vie qui leur reste (les trois quarts s’ils sont gelés).',
    // Un seul par vague (réglé en octobre 2026, avec une partie enregistrée de 50 vagues). Avant, il
    // revenait toutes les 30 secondes : plus une vague durait, plus on en lançait, et comme il enlève
    // une PART de la vie, il suivait les monstres à l'infini. À la fin de cette partie, il faisait
    // 95 à 100 % des dégâts : les gardiens ne servaient plus à rien, et la partie ne s'arrêtait que
    // quand le joueur se fatiguait.
    parVague: 1,
    chute: 0.9,  // le temps qu'il met à tomber : il faut viser là où les monstres SERONT
    hauteur: 7,  // d'où il tombe, en cases (il traverse l'écran avant d'arriver)
    rayon: 1.6,  // la taille de l'explosion, en cases
    part: 0.5,   // la part de la vie qui leur reste qu'il enlève (la même part à la vague 1 qu'à la vague 30)
    // sur un monstre gelé par le Grand froid (donc fragile) : les trois quarts, pas plus. Avant, le
    // « fragile » doublait la moitié : toute la vie, et le combo battait n'importe quel monstre d'un coup
    partGele: 0.75,
  },
  froid: {
    nom: 'Grand froid',
    touche: '2',
    description: 'Tous les monstres gèlent sur place pendant 4 secondes, et deviennent fragiles : ils prennent deux fois plus de dégâts.',
    recharge: 60,
    duree: 4,    // en secondes (un monstre « gel: 0,5 », comme un chef, gèle moitié moins longtemps)
    // gelés, les monstres prennent deux fois plus de dégâts. Sans ça, le Grand froid ne servait presque
    // à rien avec des Givrine : des monstres déjà ralentis, qu'on arrête tout à fait, n'avancent guère moins
    fragile: 2,
  },
};

// LE HÉROS : un Grand Gardien que le joueur déplace lui-même sur la carte (dans les niveaux dont la
// fiche dit « heros: true »). On clique sur lui, puis sur la carte : il y marche. Arrêté, il frappe
// le sol et touche les monstres tout autour de lui ; posé sur le chemin, il leur barre la route (ils
// passent au ralenti). Pendant qu'il marche, il ne frappe pas et ne barre rien : le déplacer au bon
// moment, c'est tout l'art.
// Il a de la VIE : les monstres qu'il bloque le frappent (« coup » dans leur fiche, plus fort pour un
// monstre renforcé) ; loin des combats, il se soigne ; entre deux vagues, il se repose (toute sa vie).
// À zéro, il est K.O. jusqu'à la vague suivante. Il gagne des niveaux avec les monstres qu'il bat (et
// une part de ceux que battent les gardiens), et certains niveaux lui donnent un POUVOIR.
// (Réglé en octobre 2026 avec deux parties enregistrées : avant, sans vie, il faisait 62 à 99 % des
// dégâts des vagues 2 à 15, et il était au niveau 6 dès la vague 7.)
export const HEROS = {
  nom: 'Grand Gardien',
  touche: 'h',
  description: 'Clique sur lui, puis sur la carte : il y marche. Il frappe le sol et touche les monstres autour de lui ; sur le chemin, il leur barre la route. Les monstres qu’il bloque le frappent : à zéro, il est K.O. jusqu’à la vague suivante.',
  apparence: APPARENCES.heros, // une fois et demie un gardien (en pixel art : le grand gardien, redessiné)
  vitesse: 3,        // en cases par seconde, quand il marche
  rayon: 1.3,        // jusqu'où porte sa frappe, tout autour de lui
  monstresMax: 6,    // une frappe touche au plus 6 monstres, les plus proches
  cadence: 1.1,      // une frappe toutes les 1,1 seconde
  barrage: { rayon: 0.8, facteur: 0.5 }, // les monstres tout près de lui avancent deux fois moins vite… et le frappent
  coupParDefaut: 6,  // les points de vie par seconde que lui enlève un monstre sans « coup » dans sa fiche
  // Un monstre renforcé (mode survie) frappe plus fort : son coup × la racine quatrième de sa force
  // (force 16 : × 2 ; force 1 296 : × 6). Une racine quatrième, c'est deux racines carrées :
  // Math.sqrt donne le même résultat dans tous les navigateurs (voir calcul.js), Math.pow non.
  soin: { attente: 2, part: 0.08 }, // 2 secondes sans monstre à moins de 2 cases : il reprend 8 % de sa vie par seconde
  // L'expérience : toute la prime des monstres qu'il bat lui-même, et cette part (le quart) de la
  // prime des monstres battus par les autres (les gardiens, les pouvoirs). Sans elle, un héros posté
  // là où les gardiens battaient déjà tout ne gagnait rien : la première partie d'un nouveau joueur
  // (Cosmopolite, 26 vagues) a fini au niveau 3, sans jamais voir l'Onde de choc ni le Bond, et même
  // les bons joueurs imaginaires n'avaient presque jamais le niveau 4. Avec le quart : l'Onde de choc
  // vers la vague 10 à 14 pour un bon joueur, vers la 15 pour un héros mal placé ; le Bond reste une
  // récompense de fin de partie ; et l'expert imaginaire tient toujours 34 vagues.
  partage: 0.25,
  // ses niveaux : les dégâts d'une frappe, sa vie, et l'expérience qu'il faut pour y arriver
  niveaux: [
    { degats: 14, vie: 120, xp: 0 },
    { degats: 20, vie: 160, xp: 100 },
    { degats: 28, vie: 210, xp: 350 },
    { degats: 38, vie: 270, xp: 800 },
    { degats: 52, vie: 340, xp: 1400 },
    { degats: 70, vie: 420, xp: 2100 },
  ],
  // les pouvoirs que lui donnent ses niveaux
  pouvoirs: {
    peau: {
      nom: 'Peau de pierre', niveau: 2,
      texte: 'Il encaisse deux fois moins de coups, et se soigne deux fois plus vite.',
      coups: 0.5, soin: 2,
    },
    onde: {
      nom: 'Onde de choc', niveau: 4, touche: 'o',
      texte: 'Il frappe le sol de toutes ses forces : les monstres autour de lui sont assommés 2 secondes.',
      recharge: 20, // secondes de vague (le temps entre deux vagues ne compte pas)
      rayon: 2.2,
      duree: 2,     // assommés : ils ne bougent plus (un chef « gel: 0,5 », moitié moins longtemps)
      degats: 2,    // et ils prennent deux frappes d'un coup
    },
    bond: {
      nom: 'Bond', niveau: 6, touche: 'b',
      texte: 'Il saute d’un coup là où tu cliques, et assomme les monstres où il atterrit.',
      recharge: 25,
      duree: 0.5,   // le temps du saut
      rayon: 1.3,   // à l'atterrissage, les monstres autour sont assommés…
      assomme: 1,   // … pendant 1 seconde
    },
  },
};

export const PART_REVENTE = 0.6; // on récupère 60 % de ce qu'on a dépensé (achat + améliorations)
