// ─────────────────────────────────────────────────────────────
// LA CAMPAGNE
// Les mondes, dans l'ordre. Chaque monde est une époque du jeu vidéo,
// avec son style graphique, et contient des niveaux rangés par leur id
// (le nom de leur fiche dans src/niveaux/, sans « .json »).
// Un monde sans niveau est affiché « bientôt » sur la carte des époques.
//
// Le premier niveau de chaque monde est un didacticiel : il présente les
// nouveaux personnages du monde (c'est sa fiche qui le dit, voir README).
// ─────────────────────────────────────────────────────────────

export const MONDES = [
  {
    numero: 1,
    nom: 'L’époque pixel',
    epoque: 'Années 1990',
    style: 'pixel',
    niveaux: ['monde1-1', 'monde1-2', 'monde1-3', 'monde1-4'],
  },
  {
    numero: 2,
    nom: 'L’époque cartoon',
    epoque: 'Années 2000',
    style: 'cartoon',
    niveaux: ['monde2-1', 'monde2-2', 'monde2-3', 'monde2-4'],
  },
  {
    numero: 3,
    nom: 'L’époque voxel',
    epoque: 'Aujourd’hui',
    style: 'voxel',
    niveaux: ['monde3-1', 'monde3-2', 'monde3-3', 'monde3-4'],
  },
];

// Tous les niveaux de la campagne, dans l'ordre où on les joue
export const ORDRE = MONDES.flatMap((monde) => monde.niveaux);

// Où est ce niveau dans la campagne ? null s'il n'en fait pas partie (le niveau d'essai, par exemple)
export function placeDuNiveau(id) {
  for (const monde of MONDES) {
    const i = monde.niveaux.indexOf(id);
    if (i >= 0) return { monde, numero: i + 1, dernierDuMonde: i === monde.niveaux.length - 1 };
  }
  return null;
}

// Le niveau qui vient après celui-ci (null à la fin de la campagne)
export function niveauSuivant(id) {
  const i = ORDRE.indexOf(id);
  return i >= 0 && i + 1 < ORDRE.length ? ORDRE[i + 1] : null;
}

// Un niveau est débloqué si c'est le tout premier, ou si on a gagné celui d'avant.
// gagnes : l'ensemble (Set) des ids des niveaux déjà gagnés
export function estDebloque(id, gagnes) {
  const i = ORDRE.indexOf(id);
  return i === 0 || (i > 0 && gagnes.has(ORDRE[i - 1]));
}

// Vérifie la campagne : chaque niveau doit exister et être dans l'époque de son monde.
// fiches : { id: fiche } pour toutes les fiches de src/niveaux/
export function problemesCampagne(fiches) {
  const erreurs = [];
  for (const monde of MONDES) {
    for (const id of monde.niveaux) {
      const fiche = fiches[id];
      if (!fiche) erreurs.push(`Monde ${monde.numero} : le niveau « ${id} » n’existe pas (src/niveaux/${id}.json).`);
      else if (fiche.style !== monde.style) erreurs.push(`Monde ${monde.numero} : « ${fiche.nom} » est en style ${fiche.style}, alors que le monde est en ${monde.style}.`);
    }
  }
  return erreurs;
}
