// ─────────────────────────────────────────────────────────────
// LES OPTIONS DU JOUEUR
// Toutes les préférences, gardées par le navigateur sous une seule clé.
// N'importe quelle page peut les lire (lireOptions) et les changer
// (changerOptions). Ceux qui veulent savoir quand elles changent
// s'abonnent (quandOptionsChangent) : le son ajuste son volume, le jeu
// sa vitesse ou la taille de son interface…
// Si le navigateur refuse de garder quoi que ce soit (navigation privée),
// les options marchent quand même, le temps de la visite.
// ─────────────────────────────────────────────────────────────
const CLE = 'pg-options';

export const OPTIONS_DE_BASE = {
  musique: 0.5,          // le volume de la musique (de 0 à 1)
  effets: 1,             // le volume des bruitages (de 0 à 1)
  coupe: false,          // tout le son coupé (la touche M, en jeu)
  vitesse: 1,            // la vitesse du jeu : 1, 2 ou 3 (le jeu s'en souvient)
  fiches: 'toujours',    // les fiches des nouveaux personnages : 'toujours' ou 'premiere-fois'
  qualite: 'complete',   // 'complete', ou 'econome' pour les ordinateurs plus lents
  interface: 'normale',  // la taille des boutons et des textes du jeu : 'normale' ou 'grande'
  camera: 'haute',       // la caméra du voxel : 'haute' (la vue de jeu) ou 'cinema'
  partage: true,         // envoyer ses parties enregistrées (pour les revoir, et régler le jeu) : voir parties.js
};

// Les valeurs permises : une valeur inconnue (une vieille version, un fichier modifié
// à la main…) est remplacée par celle de base, pour que le jeu ne casse jamais
const VALEURS = {
  vitesse: [1, 2, 3],
  fiches: ['toujours', 'premiere-fois'],
  qualite: ['complete', 'econome'],
  interface: ['normale', 'grande'],
  camera: ['haute', 'cinema'],
};
const valide = (cle, valeur) => {
  if (cle === 'musique' || cle === 'effets') return typeof valeur === 'number' && valeur >= 0 && valeur <= 1;
  if (cle === 'coupe' || cle === 'partage') return typeof valeur === 'boolean';
  return VALEURS[cle]?.includes(valeur);
};

let enMemoire = null; // si le navigateur refuse de les garder, elles restent ici le temps de la visite

// Un téléphone (un petit écran tactile) : il a moins de force qu'un ordinateur
const petitEcranTactile = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
  && Math.min(screen.width, screen.height) <= 520;

export function lireOptions() {
  let gardees = enMemoire;
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) gardees = JSON.parse(brut);
    // avant l'écran d'options, les volumes étaient gardés à part (« pg-son ») : on les reprend
    else gardees ??= JSON.parse(localStorage.getItem('pg-son') || 'null');
  } catch { /* stockage refusé ou illisible : on garde ce qu'on a */ }
  // sur un téléphone, des graphismes économes par défaut (tant qu'on n'a pas choisi)
  const options = { ...OPTIONS_DE_BASE, ...(petitEcranTactile() ? { qualite: 'econome' } : {}) };
  for (const cle of Object.keys(OPTIONS_DE_BASE)) {
    if (gardees && valide(cle, gardees[cle])) options[cle] = gardees[cle];
  }
  return options;
}

// Change une ou plusieurs options (ex. : changerOptions({ musique: 0.3 })), les garde,
// et prévient les abonnés. Renvoie toutes les options.
export function changerOptions(changements) {
  const options = lireOptions();
  for (const [cle, valeur] of Object.entries(changements)) {
    if (valide(cle, valeur)) options[cle] = valeur;
  }
  enMemoire = options;
  try { localStorage.setItem(CLE, JSON.stringify(options)); } catch { /* tant pis : elles restent en mémoire */ }
  prevenir(options);
  return options;
}

// ── Les abonnés ──
const abonnes = new Set();
export function quandOptionsChangent(fonction) {
  abonnes.add(fonction);
  return () => abonnes.delete(fonction); // pour se désabonner
}
function prevenir(options) {
  for (const fonction of abonnes) fonction(options);
}
// les options ont été changées dans un autre onglet du jeu : on suit
addEventListener('storage', (e) => { if (e.key === CLE) prevenir(lireOptions()); });
