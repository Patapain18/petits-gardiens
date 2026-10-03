// ─────────────────────────────────────────────────────────────
// LE VOCABULAIRE DES APPARENCES
// Chaque personnage a, dans sa fiche (src/jeu/donnees.js), une
// « apparence » : un gabarit (sa silhouette de base), des couleurs,
// une taille et des accessoires. Chaque style sait dessiner chaque
// gabarit et chaque accessoire à sa façon : on décrit un personnage
// une seule fois, et il existe dans les trois styles.
// ─────────────────────────────────────────────────────────────

// Les silhouettes de base que les trois styles savent fabriquer
export const GABARITS = {
  gardien: 'petit corps rectangulaire, deux yeux en barres, bras et quatre pattes (la mascotte)',
  gelee: 'une gelée qui avance en sautillant',
  rongeur: 'un petit animal rapide à quatre pattes, avec oreilles et queue',
  golem: 'un gros bloc de pierre avec bras, jambes et mousse sur le dos (avec la couleur « lave » : des fissures de lave qui brillent)',
  volant: 'une petite bête ronde qui vole en battant des ailes, comme une chauve-souris',
  tortue: 'une tortue vue de profil : une carapace bombée (couleur « carapace »), une tête, quatre pattes',
  taupe: 'une taupe toute ronde, avec un long museau et de grosses pattes pour creuser (couleur « museau »)',
  dragon: 'un grand dragon qui vole : un long cou, des ailes immenses, une queue (couleur « ventre » pour le dessous)',
};

// Les accessoires, avec leur couleur par défaut (une fiche peut en donner une autre)
export const ACCESSOIRES = {
  flamme: '#ff8a1e',   // une flamme sur la tête
  cristaux: '#a8e8ff', // trois cristaux de glace sur la tête
  echarpe: '#f4f8ff',  // une écharpe autour du corps
  cornes: '#f0e2c0',   // deux petites cornes
  mortier: '#b8843a',  // un mortier (canon court) sur le dos
  cape: '#c8343a',     // une cape dans le dos (les gardiens de niveau 2 et 3)
  couronne: '#ffcf3a', // une couronne sur la tête (les gardiens de niveau 3)
  antennes: '#6ae8ff', // deux antennes qui crépitent d'électricité
  moulinet: '#ff5a7a', // un moulinet (petit moulin à vent) qui tourne sur la tête
  petits: '#a6ee4c',   // trois petites gelées qui voyagent sur le dos (des Gluants : leur couleur)
  casque: '#f2efe6',   // un casque de mineur avec sa lampe (il relève le haut de la tête : ce qui suit se pose dessus)
  pioche: '#9aa4b4',   // une pioche dans le dos (la couleur : celle de son fer)
  prisme: '#ffffff',   // un cristal qui flotte au-dessus de la tête et fait des arcs-en-ciel
  lunettes: '#ffa040', // de grosses lunettes rondes sur les yeux
};

// Les couleurs qu'un gabarit utilise, quand la fiche ne les précise pas
// (la lave du golem n'a pas de couleur par défaut : sans elle, pas de fissures)
const COULEURS_PAR_DEFAUT = {
  gardien: { yeux: '#1a1014' },
  gelee: { yeux: '#10200c' },
  rongeur: { yeux: '#ff4a3a' },
  golem: { yeux: '#ff5a2a', mousse: '#5fa03a' },
  volant: { yeux: '#2a0e1a' },
  tortue: { yeux: '#1a1014', carapace: '#6a7a5a' },
  taupe: { yeux: '#1a1014', museau: '#f2a2b4' },
  dragon: { yeux: '#ffe14a', ventre: '#ffd27a' },
};

// Complète une apparence : couleurs par défaut, taille 1, accessoires sous forme d'objets
export function lireApparence(apparence) {
  return {
    gabarit: apparence.gabarit,
    taille: apparence.taille ?? 1,
    couleurs: { ...COULEURS_PAR_DEFAUT[apparence.gabarit], ...apparence.couleurs },
    accessoires: (apparence.accessoires || []).map((a) => {
      const acc = typeof a === 'string' ? { type: a } : a;
      return { ...acc, couleur: acc.couleur || ACCESSOIRES[acc.type] };
    }),
  };
}

// Les couleurs d'un personnage, pour les petits morceaux qui volent quand il est battu
export function couleursEclats(apparence) {
  const c = lireApparence(apparence).couleurs;
  return [c.peau, c.clair, c.fonce, c.mousse, c.lave, c.carapace, c.ventre].filter(Boolean);
}

// Mélange deux couleurs : t = 0 → a, t = 1 → b (sert à créer des nuances)
export function melanger(a, b, t) {
  const lire = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const [ca, cb] = [lire(a), lire(b)];
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// Les problèmes d'une apparence (gabarit inconnu, accessoire inconnu, couleur manquante…)
export function problemesApparence(nom, apparence) {
  const erreurs = [];
  if (!apparence) return [`${nom} : pas d’apparence dans sa fiche`];
  if (!GABARITS[apparence.gabarit]) erreurs.push(`${nom} : gabarit « ${apparence.gabarit} » inconnu (possibles : ${Object.keys(GABARITS).join(', ')})`);
  for (const cle of ['clair', 'peau', 'fonce']) {
    if (!/^#[0-9a-f]{6}$/i.test(apparence.couleurs?.[cle] || '')) erreurs.push(`${nom} : la couleur « ${cle} » doit être écrite comme #a1b2c3`);
  }
  for (const a of apparence.accessoires || []) {
    const type = typeof a === 'string' ? a : a?.type;
    if (!ACCESSOIRES[type]) erreurs.push(`${nom} : accessoire « ${type} » inconnu (possibles : ${Object.keys(ACCESSOIRES).join(', ')})`);
  }
  return erreurs;
}

// Vérifie toutes les fiches d'un coup (appelé au démarrage de chaque style).
// Un gardien a une apparence par niveau : on les vérifie toutes.
export function verifierApparences(...groupes) {
  const erreurs = groupes.flatMap((groupe) =>
    Object.entries(groupe).flatMap(([cle, fiche]) => (fiche.niveaux
      ? fiche.niveaux.flatMap((n, i) => problemesApparence(`${n.nom || fiche.nom || cle} (niveau ${i + 1})`, n.apparence))
      : problemesApparence(fiche.nom || cle, fiche.apparence))));
  if (erreurs.length) throw new Error('Apparence de personnage incorrecte :\n- ' + erreurs.join('\n- '));
}

// Vérifie qu'un style sait bien dessiner tout le vocabulaire (sinon, message clair)
export function verifierStyle(style, gabarits, accessoires) {
  const manque = [
    ...Object.keys(GABARITS).filter((g) => !gabarits[g]).map((g) => `le gabarit « ${g} »`),
    ...Object.keys(ACCESSOIRES).filter((a) => !accessoires[a]).map((a) => `l’accessoire « ${a} »`),
  ];
  if (manque.length) throw new Error(`Le style ${style} ne sait pas encore dessiner ${manque.join(', ')}.`);
}
