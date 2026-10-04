// ─────────────────────────────────────────────────────────────
// LES FICHES DES PERSONNAGES
// Tout ce qu'il faut savoir sur un personnage, au même endroit :
// - son nom, son rôle et les textes du didacticiel, écrits ici ;
// - ses chiffres de jeu (prix, dégâts, vitesse…), lus par le moteur. Ils sont
//   rangés à part, dans chiffres.json (une « table d'équilibrage », comme dans
//   les studios de jeu vidéo) : l'atelier de l'équilibrage (equilibrage.html)
//   les règle et les enregistre. Le sens de chaque chiffre, son unité et ses
//   limites sont expliqués dans format-chiffres.js ;
// - son « apparence », lue par les trois styles graphiques. Elle est rangée à
//   part, dans apparences.json : l'atelier des modèles (modeles.html) la règle
//   et l'enregistre.
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
import FICHIER_CHIFFRES from './chiffres.json' with { type: 'json' };

// Les chiffres, rangés comme dans chiffres.json (G : les gardiens, M : les monstres). On en garde
// une copie : l'atelier de l'équilibrage peut les changer sur place (voir appliquerChiffres).
const CHIFFRES = structuredClone(FICHIER_CHIFFRES);
const { gardiens: G, monstres: M } = CHIFFRES;

// Les volants volent à cette hauteur au-dessus du chemin (en cases) : le moteur
// s'en sert pour viser, les styles pour les dessiner là-haut.
export const HAUTEUR_VOL = 0.8;

// Nos petits monstres gentils : les GARDIENS (= les tours).
// Chacun a 3 niveaux. Le « cout » du niveau 1 est le prix d'achat ;
// celui des niveaux 2 et 3 est le prix de l'amélioration.
// Une amélioration rapporte à peu près autant de dégâts par pièce qu'un
// nouveau gardien : améliorer est donc un vrai choix, pas un piège. (Vérifié au
// banc d'essai de l'atelier de l'équilibrage : de 0,83 à 1,21 fois ce que
// rapporterait un nouveau gardien, sauf le Blizzard, à 1,5 fois.)
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
    projectile: { type: 'feu', ...G.braise.projectile },
    // chaque niveau : son nom (sauf le premier, qui garde celui du gardien), ses chiffres
    // (cout, degats, cadence : une attaque toutes les « cadence » secondes, portee…) et son apparence
    niveaux: [
      { ...G.braise.niveaux[0], apparence: APPARENCES.gardiens.braise[0] },
      { nom: 'Braise ardente', ...G.braise.niveaux[1], apparence: APPARENCES.gardiens.braise[1] },
      { nom: 'Brasier', ...G.braise.niveaux[2], apparence: APPARENCES.gardiens.braise[2] },
    ],
  },
  givrine: {
    nom: 'Givrine',
    role: 'Gèle un petit groupe : les monstres avancent deux fois moins vite',
    description: 'Elle souffle de la glace. Les monstres touchés avancent deux fois moins vite, et le froid gagne aussi leurs voisins.',
    conseil: 'Elle fait peu de dégâts : son rôle est de ralentir les monstres, pour que tes autres gardiens aient le temps de les battre.',
    projectile: { type: 'glace', ...G.givrine.projectile },
    // ralentissement : facteur 0,45 = vitesse × 0,45, pendant « duree » secondes ; zone = le gel
    // touche aussi les voisins de la cible
    niveaux: [
      { ...G.givrine.niveaux[0], apparence: APPARENCES.gardiens.givrine[0] },
      { nom: 'Givre', ...G.givrine.niveaux[1], apparence: APPARENCES.gardiens.givrine[1] },
      { nom: 'Blizzard', ...G.givrine.niveaux[2], apparence: APPARENCES.gardiens.givrine[2] },
    ],
  },
  grondin: {
    nom: 'Grondin',
    role: 'Lance des rochers qui touchent tout un petit groupe',
    description: 'Le plus costaud. Il lance des rochers en cloche qui explosent et touchent jusqu’à 5 monstres d’un coup.',
    conseil: 'Il tire lentement mais très fort : parfait contre les groupes serrés et les monstres résistants. Il coûte cher, garde de l’or pour lui.',
    projectile: { type: 'rocher', cloche: true, ...G.grondin.projectile }, // tir en cloche : il retombe au sol, les volants passent au-dessus
    // zone : le rayon de l'explosion ; monstresMax : elle touche au plus ce nombre de monstres, les plus
    // près du point de chute (voir exploser() dans moteur.js)
    niveaux: [
      { ...G.grondin.niveaux[0], apparence: APPARENCES.gardiens.grondin[0] }, // un peu plus costaud que les autres
      { nom: 'Tonnerre', ...G.grondin.niveaux[1], apparence: APPARENCES.gardiens.grondin[1] },
      { nom: 'Séisme', ...G.grondin.niveaux[2], apparence: APPARENCES.gardiens.grondin[2] },
    ],
  },

  // ── Les nouveaux gardiens du monde 2 ──
  etincelle: {
    nom: 'Étincelle',
    role: 'Un éclair qui saute d’un monstre à l’autre, et touche les volants',
    description: 'Une petite pile électrique sur pattes. Son éclair frappe un monstre, puis saute sur ses voisins, un peu moins fort à chaque saut.',
    conseil: 'Parfaite contre les groupes et contre les volants. Mais seule face à un gros monstre, elle tape moins fort qu’une Braise.',
    projectile: { type: 'eclair', instantane: true }, // instantané : l'éclair frappe tout de suite, rien ne voyage
    // rebonds : après sa cible, l'éclair saute sur « nombre » autres monstres, chacun à moins
    // de « saut » cases du précédent ; chaque saut fait « attenuation » × les dégâts du précédent.
    // Réglé pour valoir à peu près une Braise sur un groupe, et bien moins sur un monstre seul
    // (son éclair ne rate jamais : il frappe tout de suite, rien ne se perd en route).
    niveaux: [
      { ...G.etincelle.niveaux[0], apparence: APPARENCES.gardiens.etincelle[0] },
      { nom: 'Éclair', ...G.etincelle.niveaux[1], apparence: APPARENCES.gardiens.etincelle[1] },
      { nom: 'Foudre', ...G.etincelle.niveaux[2], apparence: APPARENCES.gardiens.etincelle[2] },
    ],
  },
  bourrasque: {
    nom: 'Bourrasque',
    role: 'Souffle les monstres en arrière sur le chemin',
    description: 'Un petit coup de vent sur pattes, coiffé d’un moulinet. Son souffle fait reculer les monstres… qui doivent refaire du chemin !',
    conseil: 'Elle fait très peu de dégâts : pose-la près de gardiens qui tapent fort, ils garderont les monstres plus longtemps sous le feu. Les volants, légers, s’envolent plus loin ; les Cuirassés, lourds, reculent à peine.',
    projectile: { type: 'vent', ...G.bourrasque.projectile },
    // souffle : les monstres à moins de « zone » cases de la cible reculent de « recul » cases
    niveaux: [
      { ...G.bourrasque.niveaux[0], apparence: APPARENCES.gardiens.bourrasque[0] },
      { nom: 'Rafale', ...G.bourrasque.niveaux[1], apparence: APPARENCES.gardiens.bourrasque[1] },
      { nom: 'Tornade', ...G.bourrasque.niveaux[2], apparence: APPARENCES.gardiens.bourrasque[2] },
    ],
  },

  // ── Les nouveaux gardiens du monde 3 ──
  pepite: {
    nom: 'Pépite',
    role: 'Ne tire pas : creuse de l’or, et en rapporte à chaque vague',
    description: 'Une petite mineuse, casque sur la tête et pioche dans le dos. Elle ne se bat pas : pendant chaque vague, elle creuse, et à la fin elle te rapporte de l’or.',
    // (Avant : « Pose-la tôt ». L'atelier de l'équilibrage a montré que c'était un piège : un débutant
    // qui l'achète avant ses premiers gardiens ne tient la vague 1 qu'une fois sur dix.)
    conseil: 'Pose-la quand tes premiers gardiens tiennent bon, sur un socle loin du chemin : en quatre vagues, elle est remboursée, et tout le reste est du bonus. Mais une Pépite trop tôt, ou de trop, et il te manquera des gardiens qui tapent.',
    // pas de projectile : elle ne vise personne (une portée de 0 : aucun cercle autour d'elle).
    // « recolte » = l'or rapporté à la fin de chaque vague
    niveaux: [
      { ...G.pepite.niveaux[0], portee: 0, apparence: APPARENCES.gardiens.pepite[0] },
      { nom: 'Filon', ...G.pepite.niveaux[1], portee: 0, apparence: APPARENCES.gardiens.pepite[1] },
      { nom: 'Trésor', ...G.pepite.niveaux[2], portee: 0, apparence: APPARENCES.gardiens.pepite[2] },
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
      { ...G.prisme.niveaux[0], apparence: APPARENCES.gardiens.prisme[0] },
      { nom: 'Rayon', ...G.prisme.niveaux[1], apparence: APPARENCES.gardiens.prisme[1] },
      { nom: 'Arc-en-ciel', ...G.prisme.niveaux[2], apparence: APPARENCES.gardiens.prisme[2] },
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
    nom: 'Gluant', ...M.gluant,
    description: 'Une gelée qui avance en sautillant. Ni rapide, ni très solide : c’est le monstre de base.',
    conseil: 'Une ou deux Braise suffisent pour arrêter un petit groupe de Gluants.',
    apparence: APPARENCES.monstres.gluant,
  },
  filou: {
    nom: 'Filou', ...M.filou,
    description: 'Petit et fragile… mais très rapide ! Il fonce vers le château en profitant de la moindre faille.',
    conseil: 'Une Givrine le ralentit : tes autres gardiens auront le temps de l’attraper.',
    apparence: APPARENCES.monstres.filou,
  },
  cuirasse: {
    nom: 'Cuirassé', ...M.cuirasse, // (vent 0,5 : lourd, le vent le fait deux fois moins reculer)
    description: 'Un golem de pierre couvert de mousse. Il marche lentement, mais il encaisse énormément de coups.',
    conseil: 'Il faut beaucoup de dégâts : les rochers du Grondin et les gardiens améliorés en viennent à bout.',
    apparence: APPARENCES.monstres.cuirasse,
  },

  // ── Les nouveaux monstres du monde 2 ──
  voltigeur: {
    nom: 'Voltigeur', ...M.voltigeur, // (vent 1,5 : léger, le vent l'emporte une fois et demie plus loin)
    volant: true,
    description: 'Une petite chauve-souris qui vole au-dessus du chemin. Les rochers du Grondin retombent par terre sans jamais la toucher.',
    conseil: 'Braise, Givrine et Étincelle l’attrapent en plein vol, le Grondin non. Une Bourrasque l’envoie valser loin en arrière.',
    apparence: APPARENCES.monstres.voltigeur,
  },
  gigogne: {
    nom: 'Gigogne', ...M.gigogne,
    enfants: { type: 'gluant', ...M.gigogne.enfants }, // battue, elle libère 3 Gluants
    description: 'Une grosse maman gelée qui porte ses petits sur le dos. Quand on la bat, trois Gluants sautent par terre et continuent la route !',
    conseil: 'Garde des gardiens derrière elle pour les petits. Un Grondin bien placé les attrape tous les trois d’un seul rocher.',
    apparence: APPARENCES.monstres.gigogne,
  },
  colosse: {
    nom: 'Colosse', ...M.colosse, // (vent 0 : bien trop lourd, le vent ne le pousse pas ; gel 0,5 : le gel ne le ralentit qu'à moitié)
    boss: true,
    enfants: { type: 'cuirasse', ...M.colosse.enfants }, // battu, il se brise en deux Cuirassés
    description: 'Le chef des monstres : un géant de roche et de lave, qui avance lentement vers le château en faisant trembler le sol. Et quand on le bat, il se brise en deux !',
    conseil: 'Il faut beaucoup de dégâts, tout le long du chemin : des gardiens améliorés, des Grondin, des Étincelle. Et garde de la place derrière lui pour les deux Cuirassés.',
    apparence: APPARENCES.monstres.colosse,
  },

  // ── Les nouveaux monstres du monde 3 ──
  carapace: {
    nom: 'Carapace', ...M.carapace, // (armure 5 : chaque coup perd 5 dégâts sur sa carapace)
    description: 'Une tortue de pierre à la carapace épaisse. Chaque coup perd 5 dégâts sur sa carapace : les petits coups ne lui font presque rien.',
    conseil: 'Il faut de gros coups : le rocher du Grondin, des gardiens améliorés… ou le rayon du Prisme, qui traverse la carapace.',
    apparence: APPARENCES.monstres.carapace,
  },
  taupe: {
    nom: 'Taupe', ...M.taupe, // (creuse : 1,6 s sous terre, 1,5 fois plus vite, puis 2 s dehors)
    description: 'Une taupe à lunettes qui creuse sous le chemin. Sous terre, aucun gardien ne peut la viser : on ne voit qu’un petit tas de terre qui avance.',
    conseil: 'Elle ressort régulièrement : des gardiens tout le long du chemin la cueillent chaque fois qu’elle sort.',
    apparence: APPARENCES.monstres.taupe,
  },
  dragon: {
    nom: 'Dragon', ...M.dragon, // (vent 0 : bien trop fort pour le vent ; gel 0,5 : le gel ne le ralentit qu'à moitié)
    boss: true,
    volant: true,
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
    hauteur: 7,  // d'où il tombe, en cases (il traverse l'écran avant d'arriver : c'est du dessin, pas un chiffre de jeu)
    // Ses chiffres (chiffres.json) : parVague (combien on en a pour une vague), chute (le temps qu'il
    // met à tomber : il faut viser là où les monstres SERONT), rayon (la taille de l'explosion), part
    // (la part de la vie qui leur reste qu'il enlève : la même à la vague 1 qu'à la vague 30) et
    // partGele (la part sur un monstre gelé par le Grand froid).
    // Un seul par vague (réglé en octobre 2026, avec une partie enregistrée de 50 vagues). Avant, il
    // revenait toutes les 30 secondes : plus une vague durait, plus on en lançait, et comme il enlève
    // une PART de la vie, il suivait les monstres à l'infini. À la fin de cette partie, il faisait
    // 95 à 100 % des dégâts : les gardiens ne servaient plus à rien, et la partie ne s'arrêtait que
    // quand le joueur se fatiguait. Et sur un monstre gelé (donc fragile) : les trois quarts, pas plus.
    // Avant, le « fragile » doublait la moitié : toute la vie, et le combo battait n'importe quel
    // monstre d'un coup.
    ...CHIFFRES.pouvoirs.meteore,
  },
  froid: {
    nom: 'Grand froid',
    touche: '2',
    description: 'Tous les monstres gèlent sur place pendant 4 secondes, et deviennent fragiles : ils prennent deux fois plus de dégâts.',
    // Ses chiffres : recharge (en secondes de vague), duree (un monstre « gel: 0,5 », comme un chef,
    // gèle moitié moins longtemps) et fragile (gelés, les monstres prennent deux fois plus de dégâts).
    // Sans « fragile », le Grand froid ne servait presque à rien avec des Givrine : des monstres déjà
    // ralentis, qu'on arrête tout à fait, n'avancent guère moins.
    ...CHIFFRES.pouvoirs.froid,
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
//
// Ses chiffres (chiffres.json) : vitesse (en cases par seconde, quand il marche), rayon (jusqu'où
// porte sa frappe), monstresMax (une frappe touche au plus ce nombre de monstres, les plus proches),
// cadence (une frappe toutes les « cadence » secondes), barrage (les monstres à moins de « rayon »
// cases avancent « facteur » fois moins vite… et le frappent), coupParDefaut (les points de vie par
// seconde que lui enlève un monstre sans « coup » dans sa fiche), soin (après « attente » secondes
// sans monstre à moins de 2 cases, il reprend « part » de sa vie par seconde), partage, et ses niveaux.
// Un monstre renforcé (mode survie) frappe plus fort : son coup × la racine quatrième de sa force
// (force 16 : × 2 ; force 1 296 : × 6). Une racine quatrième, c'est deux racines carrées :
// Math.sqrt donne le même résultat dans tous les navigateurs (voir calcul.js), Math.pow non.
// « partage » : il gagne toute la prime des monstres qu'il bat lui-même, et cette part (le quart) de
// la prime des monstres battus par les autres (les gardiens, les pouvoirs). Sans elle, un héros posté
// là où les gardiens battaient déjà tout ne gagnait rien : la première partie d'un nouveau joueur
// (Cosmopolite, 26 vagues) a fini au niveau 3, sans jamais voir l'Onde de choc ni le Bond, et même
// les bons joueurs imaginaires n'avaient presque jamais le niveau 4. Avec le quart : l'Onde de choc
// vers la vague 10 à 14 pour un bon joueur, vers la 15 pour un héros mal placé ; le Bond reste une
// récompense de fin de partie ; et l'expert imaginaire tient toujours 34 vagues.
const H = CHIFFRES.heros;
export const HEROS = {
  nom: 'Grand Gardien',
  touche: 'h',
  description: 'Clique sur lui, puis sur la carte : il y marche. Il frappe le sol et touche les monstres autour de lui ; sur le chemin, il leur barre la route. Les monstres qu’il bloque le frappent : à zéro, il est K.O. jusqu’à la vague suivante.',
  apparence: APPARENCES.heros, // une fois et demie un gardien (en pixel art : le grand gardien, redessiné)
  ...H,
  // ses niveaux : les dégâts d'une frappe, sa vie, et l'expérience qu'il faut pour y arriver
  niveaux: H.niveaux.map((n) => ({ ...n })),
  // les pouvoirs que lui donnent ses niveaux (« niveau » : celui où il le reçoit)
  pouvoirs: {
    peau: {
      nom: 'Peau de pierre',
      texte: 'Il encaisse deux fois moins de coups, et se soigne deux fois plus vite.',
      ...H.pouvoirs.peau, // coups : il encaisse ça des coups ; soin : il se soigne ça fois plus vite
    },
    onde: {
      nom: 'Onde de choc', touche: 'o',
      texte: 'Il frappe le sol de toutes ses forces : les monstres autour de lui sont assommés 2 secondes.',
      // recharge : en secondes de vague (le temps entre deux vagues ne compte pas) ; duree : assommés,
      // ils ne bougent plus (un chef « gel: 0,5 », moitié moins longtemps) ; degats : ils prennent ce
      // nombre de frappes d'un coup
      ...H.pouvoirs.onde,
    },
    bond: {
      nom: 'Bond', touche: 'b',
      texte: 'Il saute d’un coup là où tu cliques, et assomme les monstres où il atterrit.',
      // duree : le temps du saut ; à l'atterrissage, les monstres à moins de « rayon » cases sont
      // assommés « assomme » secondes
      ...H.pouvoirs.bond,
    },
  },
};

// L'ÉCONOMIE : revente (la part de ce qu'on a dépensé pour un gardien, achat et améliorations, qu'on
// récupère en le revendant) ; finDeVague (le bonus d'or à la fin de chaque vague : base + parVague ×
// le numéro de la vague).
export const ECONOMIE = CHIFFRES.economie;
// LE MODE SURVIE (voir survie.js) : croissance (chaque vague fabriquée apporte ça fois plus de
// menace que la précédente) ; maxParGroupe (au-delà, des monstres renforcés plutôt que plus nombreux).
export const SURVIE = CHIFFRES.survie;

// ── Essayer d'autres chiffres (l'atelier de l'équilibrage) ───
// Remplace les chiffres de toutes les fiches par ceux-là (rangés comme dans chiffres.json, avec
// exactement les mêmes champs : voir format-chiffres.js). Sur place : les fiches restent les mêmes
// objets, que le moteur et les styles ont déjà en main. Les niveaux du mode survie se fabriquent
// au chargement : il faut les recharger (chargerNiveau) pour qu'ils suivent la croissance.
export function appliquerChiffres(nouveaux) {
  for (const [type, g] of Object.entries(nouveaux.gardiens)) {
    if (g.projectile) recopier(GARDIENS[type].projectile, g.projectile);
    g.niveaux.forEach((n, i) => recopier(GARDIENS[type].niveaux[i], n));
  }
  for (const [type, m] of Object.entries(nouveaux.monstres)) recopier(MONSTRES[type], m);
  for (const [nom, p] of Object.entries(nouveaux.pouvoirs)) recopier(POUVOIRS[nom], p);
  const { niveaux, pouvoirs, ...heros } = nouveaux.heros;
  recopier(HEROS, heros);
  niveaux.forEach((n, i) => recopier(HEROS.niveaux[i], n));
  for (const [nom, p] of Object.entries(pouvoirs)) recopier(HEROS.pouvoirs[nom], p);
  recopier(ECONOMIE, nouveaux.economie);
  recopier(SURVIE, nouveaux.survie);
  memoire.clear(); // les caractéristiques gardées en mémoire ne sont plus les bonnes
}
// Recopie des chiffres dans une fiche. Un objet (comme « ralentissement ») est refait à neuf, en
// gardant ce qui n'est pas un chiffre (le type des enfants d'un monstre, par exemple).
function recopier(cible, valeurs) {
  for (const [cle, v] of Object.entries(valeurs)) cible[cle] = v && typeof v === 'object' ? { ...cible[cle], ...v } : v;
}
