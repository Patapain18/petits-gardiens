// ─────────────────────────────────────────────────────────────
// LES RÉGLAGES DU SON (src/son/sons.json) : leur sens, les vérifier, les écrire
// sons.json range les recettes des bruitages, les réglages des trois époques
// et le mixage de la musique. Le son du jeu le lit au démarrage ; l'atelier
// du son (son.html) le mesure, le règle et l'enregistre.
//
// Ce module sert aux deux côtés : l'atelier (le nom, l'unité et les limites
// de chaque curseur) et le serveur de développement (vite.config.js), qui
// revérifie tout avant d'écrire le fichier.
// ─────────────────────────────────────────────────────────────

// Les outils des recettes (voir effets.js) : les champs qu'une couche de cet outil doit avoir
// (obligatoires) et ceux qu'elle peut avoir en plus (permis).
export const OUTILS = {
  bip: { nom: 'Bip', aide: 'Un petit son, avec le timbre de l’époque.', obligatoires: ['frequence', 'duree', 'volume'], permis: ['glisse', 'selonLesPV', 'retard'] },
  grave: { nom: 'Grave', aide: 'Un son grave qui gronde.', obligatoires: ['frequence', 'duree', 'volume'], permis: ['glisse', 'retard'] },
  arpege: { nom: 'Arpège', aide: 'Des notes, l’une après l’autre.', obligatoires: ['notes', 'ecart', 'duree', 'volume'], permis: ['retard'] },
  coup: { nom: 'Coup', aide: 'La grosse caisse de l’époque : un « boum ».', obligatoires: ['volume'], permis: ['retard'] },
  bruit: { nom: 'Bruit', aide: 'Du bruit filtré : vent, feu, explosion…', obligatoires: ['duree', 'volume', 'filtre', 'de', 'a'], permis: ['q', 'retard'] },
};
export const FILTRES = {
  lowpass: 'garde les graves (sourd)',
  bandpass: 'garde une bande au milieu',
  highpass: 'garde les aigus (sifflant)',
};
// Le rôle d'un bruitage dit à quel volume il doit sonner, comparé à la musique de son époque
// (pendant une vague) : cible = [au moins, au plus], en LU au-dessus (+) ou en dessous (−) de la
// musique. 6 LU, c'est à peu près deux fois plus fort (ou moins fort) à l'oreille.
export const ROLES = {
  frequent: { nom: 'Fréquent', cible: [-12, -4], aide: 'Il revient sans arrêt (un tir, un monstre battu) : un peu sous la musique, pour ne pas fatiguer.' },
  interface: { nom: 'Interface', cible: [-10, -2], aide: 'La réponse à un clic : il doit s’entendre, sans couvrir la musique.' },
  evenement: { nom: 'Événement', cible: [-6, 2], aide: 'Quelque chose qu’on doit remarquer : à peu près aussi fort que la musique.' },
  important: { nom: 'Important', cible: [-2, 8], aide: 'Un grand moment : il passe devant la musique.' },
};
export const COUCHES_MAX = 8;
export const NOTES_MAX = 12;

// Le sens de chaque nombre, par famille. nom : pour le curseur ; unite : ce qu'il compte ;
// min, max : les limites acceptées ; pas : le pas du curseur ; entier : un nombre entier ;
// log : un curseur « logarithmique » (pour les fréquences : chaque octave a la même place) ;
// aide : une phrase qui l'explique.
export const CHAMPS = {
  couche: {
    frequence: { nom: 'Hauteur', unite: 'Hz', min: 20, max: 8000, pas: 1, log: true, aide: '440 = le La du diapason ; deux fois plus = une octave plus haut.' },
    duree: { nom: 'Durée', unite: 's', min: 0.01, max: 3, pas: 0.01, aide: 'Le temps que le son tient (une note de l’arpège : chacune).' },
    volume: { nom: 'Volume', unite: '', min: 0, max: 1.5, pas: 0.01, aide: 'La force de cette couche.' },
    glisse: { nom: 'Glisse', unite: '×', min: 0.1, max: 8, pas: 0.05, aide: 'La note part … fois plus haut (2 : une octave au-dessus ; 0,5 : une octave en dessous) et glisse vers sa hauteur.' },
    retard: { nom: 'Retard', unite: 's', min: 0, max: 2, pas: 0.01, aide: 'La couche part … secondes après le début du bruitage.' },
    ecart: { nom: 'Écart entre les notes', unite: 's', min: 0, max: 0.5, pas: 0.005, aide: 'Une note toutes les … secondes.' },
    note: { nom: 'Note', unite: '', min: 24, max: 108, pas: 1, entier: true, aide: '60 = le Do du milieu du piano ; chaque demi-ton ajoute 1.' },
    de: { nom: 'Filtre au début', unite: 'Hz', min: 20, max: 16000, pas: 1, log: true, aide: 'La fréquence du filtre au début du bruit.' },
    a: { nom: 'Filtre à la fin', unite: 'Hz', min: 20, max: 16000, pas: 1, log: true, aide: 'Elle glisse jusqu’à celle-ci (vers le bas : le bruit s’assourdit, comme une explosion qui s’éloigne).' },
    q: { nom: 'Finesse de la bande', unite: '', min: 0.1, max: 20, pas: 0.1, aide: 'Plus c’est grand, plus la bande gardée est étroite (un son plus « sifflé »).' },
  },
  limite: {
    max: { nom: 'Au plus en même temps', unite: 'fois', min: 1, max: 12, pas: 1, entier: true, aide: 'Pas plus de … départs de ce bruitage en 0,3 seconde.' },
    ecart: { nom: 'Écart entre deux départs', unite: 's', min: 0, max: 2, pas: 0.01, aide: 'Au moins … secondes entre deux départs.' },
  },
  epoque: {
    volume: { nom: 'Volume de la musique', unite: '×', min: 0, max: 2, pas: 0.01, aide: 'Pour que les trois orchestres sonnent aussi fort.' },
    volumeChef: { nom: 'Thème des chefs', unite: '× le thème', min: 0.5, max: 2.5, pas: 0.01, aide: 'Le thème des chefs, un peu plus fort que le thème principal.' },
    'reverb.envoi': { nom: 'Écho : part du son', unite: '', min: 0, max: 1, pas: 0.01, aide: 'La part du son envoyée dans l’écho de la salle (0 : aucun écho).' },
    'reverb.duree': { nom: 'Écho : longueur', unite: 's', min: 0.1, max: 6, pas: 0.1, aide: 'Plus l’écho dure, plus la salle paraît grande.' },
    brillance: { nom: 'Brillance des bruitages', unite: '×', min: 0.2, max: 2, pas: 0.01, aide: 'Les filtres des bruits (1 : ouverts, un son vif ; moins : plus fermés, feutré).' },
    forceBruit: { nom: 'Force des bruits', unite: '×', min: 0, max: 6, pas: 0.05, aide: 'Le volume des bruits des bruitages (le bruit blanc du cartoon et du voxel est plus faible dans chaque bande que celui de la console).' },
    forceAigus: { nom: 'Force des bruits aigus', unite: '×', min: 0, max: 6, pas: 0.05, aide: 'Le volume des bruits qui ne gardent que les aigus (le souffle glacé, les étincelles) : le bruit blanc en a bien plus que celui de la console.' },
    hauteurAigus: { nom: 'Hauteur des bruits aigus', unite: '×', min: 0.3, max: 3, pas: 0.01, aide: 'Leur filtre (1 : celui de la recette ; plus : on ne garde que les plus aigus, un souffle plus fin).' },
    forceCoup: { nom: 'Force des « boum »', unite: '×', min: 0, max: 3, pas: 0.01, aide: 'Le volume de la grosse caisse dans les bruitages (chaque orchestre a la sienne, plus ou moins forte).' },
  },
  mixage: {
    melodie: { nom: 'Mélodie', unite: '', min: 0, max: 1.5, pas: 0.01 },
    accords: { nom: 'Accords', unite: '', min: 0, max: 1.5, pas: 0.01 },
    basse: { nom: 'Basse', unite: '', min: 0, max: 1.5, pas: 0.01 },
    batterie: { nom: 'Batterie', unite: '', min: 0, max: 1.5, pas: 0.01 },
    chef: { nom: 'Couche des chefs', unite: '', min: 0, max: 1.5, pas: 0.01 },
  },
};

// Les problèmes d'un nombre (rien : il est bon)
function problemeNombre(v, champ, ici) {
  if (typeof v !== 'number' || !Number.isFinite(v)) return `${ici} : il faut un nombre`;
  if (v < champ.min || v > champ.max) return `${ici} : ${champ.nom.toLowerCase()} entre ${champ.min} et ${champ.max}`;
  if (champ.entier && !Number.isInteger(v)) return `${ici} : il faut un nombre entier`;
  return null;
}
const texte = (v, max = 400) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const objet = (v) => v && typeof v === 'object' && !Array.isArray(v);

// Les problèmes d'une couche de recette
export function problemesCouche(c, ici) {
  if (!objet(c)) return [`${ici} : il faut une couche`];
  const outil = OUTILS[c.outil];
  if (!outil) return [`${ici}.outil : ${Object.keys(OUTILS).join(', ')}`];
  const problemes = [];
  for (const cle of outil.obligatoires) if (!(cle in c)) problemes.push(`${ici}.${cle} manque (un ${c.outil} en a besoin)`);
  for (const cle of Object.keys(c)) {
    if (cle === 'outil') continue;
    if (!outil.obligatoires.includes(cle) && !outil.permis.includes(cle)) { problemes.push(`${ici}.${cle} : champ inconnu pour un ${c.outil}`); continue; }
    const v = c[cle];
    if (cle === 'selonLesPV') { if (typeof v !== 'boolean') problemes.push(`${ici}.selonLesPV : true ou false`); continue; }
    if (cle === 'filtre') { if (!(v in FILTRES)) problemes.push(`${ici}.filtre : ${Object.keys(FILTRES).join(', ')}`); continue; }
    if (cle === 'notes') {
      if (!Array.isArray(v) || !v.length || v.length > NOTES_MAX) { problemes.push(`${ici}.notes : de 1 à ${NOTES_MAX} notes`); continue; }
      v.forEach((n, i) => { const p = problemeNombre(n, CHAMPS.couche.note, `${ici}.notes.${i}`); if (p) problemes.push(p); });
      continue;
    }
    const p = problemeNombre(v, CHAMPS.couche[cle], `${ici}.${cle}`);
    if (p) problemes.push(p);
  }
  return problemes;
}

// Les problèmes d'une recette (nom, famille, rôle, description, couches, et sa limite si elle en a une)
export function problemesRecette(r, ici) {
  if (!objet(r)) return [`${ici} : il faut une recette`];
  const problemes = [];
  const CONNUS = ['nom', 'famille', 'role', 'description', 'couches', 'limite'];
  for (const cle of Object.keys(r)) if (!CONNUS.includes(cle)) problemes.push(`${ici}.${cle} : champ inconnu`);
  for (const cle of ['nom', 'famille', 'description']) if (!texte(r[cle])) problemes.push(`${ici}.${cle} : il faut un texte (400 caractères au plus)`);
  if (!(r.role in ROLES)) problemes.push(`${ici}.role : ${Object.keys(ROLES).join(', ')}`);
  if (!Array.isArray(r.couches) || !r.couches.length || r.couches.length > COUCHES_MAX) problemes.push(`${ici}.couches : de 1 à ${COUCHES_MAX} couches`);
  else r.couches.forEach((c, i) => problemes.push(...problemesCouche(c, `${ici}.couches.${i}`)));
  if ('limite' in r) problemes.push(...problemesLimite(r.limite, `${ici}.limite`));
  return problemes;
}

function problemesLimite(l, ici) {
  if (!objet(l)) return [`${ici} : il faut { max, ecart }`];
  const problemes = [];
  for (const cle of Object.keys(l)) if (!(cle in CHAMPS.limite)) problemes.push(`${ici}.${cle} : champ inconnu`);
  for (const [cle, champ] of Object.entries(CHAMPS.limite)) {
    if (!(cle in l)) { problemes.push(`${ici}.${cle} manque`); continue; }
    const p = problemeNombre(l[cle], champ, `${ici}.${cle}`);
    if (p) problemes.push(p);
  }
  return problemes;
}

// Un groupe de nombres rangés comme le modèle (une époque, un mixage) : exactement les mêmes champs
// (« reverb.envoi » : le champ envoi de l'objet reverb), chacun dans ses limites
function problemesGroupe(p, m, champs, ici) {
  if (!objet(p)) return [`${ici} : il faut un objet`];
  const problemes = [];
  const verifier = (a, b, chemin) => {
    for (const cle of Object.keys(a)) if (!(cle in b)) problemes.push(`${ici}.${[...chemin, cle].join('.')} : champ inconnu`);
    for (const cle of Object.keys(b)) {
      const ou = [...chemin, cle];
      if (!(cle in a)) { problemes.push(`${ici}.${ou.join('.')} manque`); continue; }
      if (objet(b[cle])) { if (objet(a[cle])) verifier(a[cle], b[cle], ou); else problemes.push(`${ici}.${ou.join('.')} : il faut un objet`); continue; }
      const champ = champs[ou.join('.')];
      if (!champ) { problemes.push(`${ici}.${ou.join('.')} : réglage inconnu (il manque son sens dans format-sons.js)`); continue; }
      const pb = problemeNombre(a[cle], champ, `${ici}.${ou.join('.')}`);
      if (pb) problemes.push(pb);
    }
  };
  verifier(p, m, []);
  return problemes;
}

// Compare des réglages proposés au modèle (le fichier actuel) : les mêmes époques, les mêmes
// mixages et les mêmes bruitages (leurs noms viennent des événements du jeu : l'atelier change les
// recettes, il n'en invente pas), et chaque recette correcte. Renvoie la liste des problèmes (vide :
// tout va bien).
export function problemesSons(proposes, modele) {
  if (!objet(proposes)) return ['sons : il faut un objet'];
  const problemes = [];
  for (const cle of Object.keys(proposes)) if (!(cle in modele)) problemes.push(`${cle} : champ inconnu`);
  for (const groupe of ['epoques', 'mixages']) {
    const p = proposes[groupe], m = modele[groupe];
    if (!objet(p)) { problemes.push(`${groupe} : il faut un objet`); continue; }
    for (const nom of Object.keys(p)) if (!(nom in m)) problemes.push(`${groupe}.${nom} : inconnu`);
    for (const nom of Object.keys(m)) {
      if (!(nom in p)) problemes.push(`${groupe}.${nom} manque`);
      else problemes.push(...problemesGroupe(p[nom], m[nom], groupe === 'epoques' ? CHAMPS.epoque : CHAMPS.mixage, `${groupe}.${nom}`));
    }
  }
  problemes.push(...problemesLimite(proposes.limiteParDefaut, 'limiteParDefaut'));
  const p = proposes.bruitages, m = modele.bruitages;
  if (!objet(p)) problemes.push('bruitages : il faut un objet');
  else {
    for (const nom of Object.keys(p)) if (!(nom in m)) problemes.push(`bruitages.${nom} : bruitage inconnu (aucun événement du jeu ne porte ce nom)`);
    for (const nom of Object.keys(m)) {
      if (!(nom in p)) problemes.push(`bruitages.${nom} manque`);
      else problemes.push(...problemesRecette(p[nom], `bruitages.${nom}`));
    }
  }
  return problemes;
}

// Écrit les réglages en JSON lisible, rangés comme sons.json : une époque ou un mixage par ligne,
// et pour chaque recette, une ligne pour son nom, une pour sa description, une par couche.
export function formaterSons(donnees) {
  const uneLigne = (v) => {
    if (Array.isArray(v)) return `[${v.map(uneLigne).join(', ')}]`;
    if (objet(v)) return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${uneLigne(x)}`).join(', ')} }`;
    return JSON.stringify(v);
  };
  const bloc = (o, retrait, ecrire) => `{\n${Object.entries(o).map(([k, v]) => `${retrait}  ${JSON.stringify(k)}: ${ecrire(v, retrait + '  ')}`).join(',\n')}\n${retrait}}`;
  const recette = (r, retrait) => {
    const dedans = retrait + '  ';
    const tete = ['nom', 'famille', 'role'].filter((k) => k in r);
    const lignes = [];
    if (tete.length) lignes.push(dedans + tete.map((k) => `${JSON.stringify(k)}: ${JSON.stringify(r[k])}`).join(', '));
    for (const [k, v] of Object.entries(r)) {
      if (tete.includes(k)) continue;
      if (k === 'couches' && Array.isArray(v)) lignes.push(`${dedans}"couches": [\n${v.map((c) => dedans + '  ' + uneLigne(c)).join(',\n')}\n${dedans}]`);
      else lignes.push(`${dedans}${JSON.stringify(k)}: ${uneLigne(v)}`);
    }
    return `{\n${lignes.join(',\n')}\n${retrait}}`;
  };
  const parties = Object.entries(donnees).map(([cle, v]) => {
    if (cle === 'bruitages') return `  "bruitages": ${bloc(v, '  ', recette)}`;
    if (objet(v) && Object.values(v).every(objet)) return `  ${JSON.stringify(cle)}: ${bloc(v, '  ', uneLigne)}`;
    return `  ${JSON.stringify(cle)}: ${uneLigne(v)}`;
  });
  return `{\n${parties.join(',\n')}\n}\n`;
}
