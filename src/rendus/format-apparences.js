// ─────────────────────────────────────────────────────────────
// L'APPARENCE DES PERSONNAGES (src/jeu/apparences.json) : la vérifier, l'écrire
// Le fichier range l'apparence de chaque personnage (le vocabulaire : voir
// apparence.js) : les gardiens (une par niveau), les monstres et le héros.
// Les fiches des personnages (donnees.js) la lisent au démarrage ; l'atelier
// des modèles (modeles.html) la modifie et l'enregistre.
// Ce petit module sert aux deux côtés : l'atelier, et le serveur de
// développement (vite.config.js), qui revérifie tout avant d'écrire le fichier.
// ─────────────────────────────────────────────────────────────
import { problemesApparence } from './apparence.js';

const COULEUR = /^#[0-9a-f]{6}$/i;
export const TAILLE_MIN = 0.5;
export const TAILLE_MAX = 3;
// Les couleurs qu'une apparence peut donner (voir les gabarits dans apparence.js)
export const NOMS_COULEURS = ['clair', 'peau', 'fonce', 'yeux', 'mousse', 'lave', 'carapace', 'museau', 'ventre'];

// Les problèmes d'une apparence : ceux du vocabulaire (un gabarit et des accessoires connus, les trois
// couleurs de base), plus une taille raisonnable, des couleurs bien écrites, et rien d'inconnu.
// gabarit : celui qu'elle doit garder (sa silhouette, ses animations et ses accessoires en dépendent :
// ce n'est pas un réglage comme une couleur)
function problemesUne(chemin, a, gabarit) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return [`${chemin} : il faut une apparence`];
  const problemes = problemesApparence(chemin, a);
  if (a.gabarit !== gabarit) problemes.push(`${chemin} : le gabarit doit rester « ${gabarit} »`);
  if (a.taille !== undefined && (typeof a.taille !== 'number' || !(a.taille >= TAILLE_MIN && a.taille <= TAILLE_MAX))) {
    problemes.push(`${chemin}.taille : il faut un nombre entre ${TAILLE_MIN} et ${TAILLE_MAX}`);
  }
  for (const [nom, couleur] of Object.entries(a.couleurs || {})) {
    if (!NOMS_COULEURS.includes(nom)) problemes.push(`${chemin}.couleurs.${nom} : couleur inconnue`);
    else if (typeof couleur !== 'string' || !COULEUR.test(couleur)) problemes.push(`${chemin}.couleurs.${nom} : il faut une couleur comme #ffcc88`);
  }
  if (a.accessoires !== undefined && !Array.isArray(a.accessoires)) problemes.push(`${chemin}.accessoires : il faut une liste`);
  for (const acc of Array.isArray(a.accessoires) ? a.accessoires : []) {
    if (acc && typeof acc === 'object') {
      if (acc.couleur !== undefined && !COULEUR.test(String(acc.couleur))) problemes.push(`${chemin} : la couleur de l’accessoire « ${acc.type} » doit être écrite comme #a1b2c3`);
      for (const cle of Object.keys(acc)) if (!['type', 'couleur'].includes(cle)) problemes.push(`${chemin} : réglage d’accessoire inconnu « ${cle} »`);
    } else if (typeof acc !== 'string') problemes.push(`${chemin} : un accessoire est un nom, ou { type, couleur }`);
  }
  for (const cle of Object.keys(a)) if (!['gabarit', 'taille', 'couleurs', 'accessoires'].includes(cle)) problemes.push(`${chemin}.${cle} : réglage inconnu`);
  return problemes;
}

// Compare des apparences proposées au modèle (le fichier actuel) : les mêmes personnages, avec
// autant de niveaux, chacun avec une apparence correcte et le même gabarit. Renvoie les problèmes.
export function problemesApparences(proposees, modele) {
  if (!proposees || typeof proposees !== 'object' || Array.isArray(proposees)) return ['apparences : il faut un objet'];
  const problemes = [];
  for (const groupe of Object.keys(proposees)) if (!(groupe in modele)) problemes.push(`${groupe} : groupe inconnu`);
  for (const groupe of ['gardiens', 'monstres']) {
    const p = proposees[groupe], m = modele[groupe];
    if (!p || typeof p !== 'object') { problemes.push(`${groupe} manque`); continue; }
    for (const id of Object.keys(m)) if (!(id in p)) problemes.push(`${groupe}.${id} manque (le jeu s’en sert)`);
    for (const [id, apparence] of Object.entries(p)) {
      if (!(id in m)) { problemes.push(`${groupe}.${id} : personnage inconnu`); continue; }
      if (groupe === 'gardiens') {
        if (!Array.isArray(apparence) || apparence.length !== m[id].length) { problemes.push(`${groupe}.${id} : il faut ${m[id].length} apparences (une par niveau)`); continue; }
        apparence.forEach((a, i) => problemes.push(...problemesUne(`${groupe}.${id}[${i}]`, a, m[id][i].gabarit)));
      } else {
        problemes.push(...problemesUne(`${groupe}.${id}`, apparence, m[id].gabarit));
      }
    }
  }
  problemes.push(...problemesUne('heros', proposees.heros, modele.heros.gabarit));
  return problemes;
}

// Écrit les apparences en JSON lisible : ce qui tient sur une ligne y reste (une apparence entière,
// le plus souvent), le reste passe à la ligne.
export function formaterApparences(donnees) {
  const uneLigne = (v) => {
    if (Array.isArray(v)) return `[${v.map(uneLigne).join(', ')}]`;
    if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${uneLigne(x)}`).join(', ')} }`;
    return JSON.stringify(v);
  };
  const ecrire = (v, retrait) => {
    const court = uneLigne(v);
    if (retrait.length + court.length <= 150 || !v || typeof v !== 'object') return court;
    const dedans = retrait + '  ';
    if (Array.isArray(v)) return `[\n${v.map((x) => dedans + ecrire(x, dedans)).join(',\n')}\n${retrait}]`;
    return `{\n${Object.entries(v).map(([k, x]) => `${dedans}${JSON.stringify(k)}: ${ecrire(x, dedans)}`).join(',\n')}\n${retrait}}`;
  };
  return ecrire(donnees, '') + '\n';
}
