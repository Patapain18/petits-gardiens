// ─────────────────────────────────────────────────────────────
// Petits outils autour des fiches de niveau, partagés par l'éditeur
// (dans le navigateur) et par le serveur de développement (qui écrit
// les fichiers dans src/niveaux/).
// ─────────────────────────────────────────────────────────────

// Arrondi au dixième : évite les nombres du genre 21.200000000000003
export const arrondir = (v) => Math.round(v * 10) / 10;

// Écrit une fiche en JSON lisible : chaque petit objet (un point, un groupe
// de monstres…) et chaque petite liste (des leçons…) tient sur une seule ligne.
export function formaterFiche(fiche) {
  const brut = JSON.stringify(fiche, null, 2);
  const surUneLigne = (contenu) => contenu.replace(/,\n\s+/g, ', ');
  return brut
    // un « petit objet » = des accolades sans aucun tableau ni objet à l'intérieur
    .replace(/\{\n\s+([^{}[\]]*?)\n\s*\}/g, (_, contenu) => '{ ' + surUneLigne(contenu) + ' }')
    // une « petite liste » = des crochets sans aucun tableau ni objet à l'intérieur
    .replace(/\[\n\s+([^{}[\]]*?)\n\s*\]/g, (_, contenu) => '[' + surUneLigne(contenu) + ']') + '\n';
}

// Le château se place tout seul : sa porte (à gauche) est au bout du chemin
export function placerChateau(fiche) {
  const fin = fiche.chemin?.[fiche.chemin.length - 1];
  if (fin && Number.isFinite(fin.x) && Number.isFinite(fin.y)) {
    fiche.chateau = { x: arrondir(fin.x + 1.4), y: fin.y };
  }
  return fiche;
}

// « Le pré du château » → « le-pre-du-chateau » (utilisable comme nom de fichier)
export function versIdentifiant(texte) {
  return String(texte)
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // enlève les accents
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'niveau';
}

// Un niveau tout simple, déjà jouable, pour démarrer
export function nouvelleFiche() {
  return placerChateau({
    id: 'nouveau-niveau',
    nom: 'Nouveau niveau',
    difficulte: 'normal',
    style: 'pixel',
    ambiance: 'doree',
    largeur: 24,
    hauteur: 14,
    or: 230,
    chemin: [{ x: -1.5, y: 7.5 }, { x: 20.5, y: 7.5 }],
    socles: [{ x: 5.5, y: 5.5 }, { x: 9.5, y: 9.5 }, { x: 13.5, y: 5.5 }, { x: 17.5, y: 9.5 }],
    chateau: { x: 0, y: 0 },
    etangs: [],
    lanternes: [],
    decor: { graine: 1 + Math.floor(Math.random() * 9999) },
    gardiens: { braise: 1, givrine: 1, grondin: 1 },
    vagues: [[{ type: 'gluant', nombre: 6, ecart: 1.5, delai: 0 }]],
  });
}
