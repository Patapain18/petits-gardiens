// ─────────────────────────────────────────────────────────────
// LES CHIFFRES DU JEU (src/jeu/chiffres.json) : leur sens, les vérifier, les écrire
// chiffres.json est la « table d'équilibrage » du jeu : le prix et les dégâts
// des gardiens, la vie et la vitesse des monstres, les pouvoirs du château,
// le héros, l'économie et le mode survie. Les fiches (donnees.js) la lisent
// au démarrage ; l'atelier de l'équilibrage (equilibrage.html) la règle et
// l'enregistre.
//
// Ce module sert aux deux côtés : l'atelier (le nom, l'unité et les limites
// de chaque curseur) et le serveur de développement (vite.config.js), qui
// revérifie tout avant d'écrire le fichier.
// ─────────────────────────────────────────────────────────────

// Le sens de chaque chiffre, par famille. nom : pour le curseur ; unite : ce qu'il compte ;
// min, max : les limites acceptées ; pas : le pas du curseur ; entier : un nombre entier ;
// aide : une phrase qui l'explique.
export const CHAMPS = {
  gardien: {
    cout: { nom: 'Prix', unite: 'pièces', min: 0, max: 600, pas: 5, entier: true, aide: 'Le prix d’achat au niveau 1 ; aux niveaux 2 et 3, le prix de l’amélioration.' },
    degats: { nom: 'Dégâts', unite: 'par coup', min: 0, max: 400, pas: 0.5, aide: 'Les points de vie enlevés à chaque coup (pour le rayon du Prisme : chaque seconde, avant qu’il chauffe).' },
    cadence: { nom: 'Temps entre deux coups', unite: 's', min: 0.1, max: 8, pas: 0.01, aide: 'Une attaque toutes les … secondes : plus c’est petit, plus il tire vite.' },
    portee: { nom: 'Portée', unite: 'cases', min: 0.5, max: 8, pas: 0.1, aide: 'Jusqu’où il voit les monstres.' },
    zone: { nom: 'Rayon de l’explosion', unite: 'cases', min: 0.1, max: 4, pas: 0.05, aide: 'Le rocher touche les monstres à moins de … cases du point de chute.' },
    monstresMax: { nom: 'Monstres touchés au plus', unite: 'monstres', min: 1, max: 40, pas: 1, entier: true, aide: 'L’explosion ne touche que les plus proches du point de chute.' },
    'ralentissement.facteur': { nom: 'Vitesse des gelés', unite: '× leur vitesse', min: 0.05, max: 1, pas: 0.01, aide: '0,45 : les monstres touchés avancent à 45 % de leur vitesse.' },
    'ralentissement.duree': { nom: 'Durée du gel', unite: 's', min: 0.1, max: 12, pas: 0.1, aide: 'Combien de temps le gel dure après chaque coup.' },
    'ralentissement.zone': { nom: 'Le gel gagne les voisins à', unite: 'cases', min: 0, max: 4, pas: 0.05, aide: 'Les monstres à moins de … cases de la cible gèlent aussi.' },
    'rebonds.nombre': { nom: 'Sauts de l’éclair', unite: 'sauts', min: 0, max: 12, pas: 1, entier: true, aide: 'Après sa cible, l’éclair saute sur ce nombre d’autres monstres.' },
    'rebonds.saut': { nom: 'Longueur d’un saut', unite: 'cases', min: 0.2, max: 6, pas: 0.05, aide: 'L’éclair ne saute que sur un monstre à moins de … cases du précédent.' },
    'rebonds.attenuation': { nom: 'Ce qui reste à chaque saut', unite: '× les dégâts', min: 0.05, max: 1, pas: 0.01, aide: '0,6 : chaque saut fait 60 % des dégâts du précédent.' },
    'souffle.recul': { nom: 'Recul', unite: 'cases', min: 0, max: 8, pas: 0.05, aide: 'De combien de cases les monstres soufflés reculent sur le chemin.' },
    'souffle.zone': { nom: 'Le vent pousse les voisins à', unite: 'cases', min: 0, max: 4, pas: 0.05, aide: 'Les monstres à moins de … cases de la cible reculent aussi.' },
    'rayon.montee': { nom: 'Temps pour chauffer', unite: 's', min: 0.1, max: 12, pas: 0.1, aide: 'Le rayon chauffe à fond en … secondes sur le même monstre (il repart de zéro s’il en change).' },
    'rayon.max': { nom: 'Chauffé à fond', unite: '× les dégâts', min: 1, max: 12, pas: 0.05, aide: 'Les dégâts du rayon chauffé à fond.' },
    recolte: { nom: 'Or récolté', unite: 'pièces par vague', min: 0, max: 600, pas: 5, entier: true, aide: 'L’or rapporté à la fin de chaque vague (sauf la dernière : le niveau est gagné).' },
    'projectile.vitesse': { nom: 'Vitesse des tirs', unite: 'cases/s', min: 0.5, max: 40, pas: 0.5, aide: 'Un tir lent arrive parfois quand sa cible est déjà tombée.' },
  },
  monstre: {
    pv: { nom: 'Points de vie', unite: 'PV', min: 1, max: 50000, pas: 1, aide: 'Les dégâts qu’il encaisse avant de tomber.' },
    vitesse: { nom: 'Vitesse', unite: 'cases/s', min: 0.05, max: 8, pas: 0.01, aide: 'Plus il est rapide, moins il reste longtemps sous le feu des gardiens.' },
    prime: { nom: 'Or rapporté', unite: 'pièces', min: 0, max: 2000, pas: 1, entier: true, aide: 'L’or gagné quand on le bat.' },
    coup: { nom: 'Coups au héros', unite: 'PV/s', min: 0, max: 300, pas: 0.5, aide: 'La vie qu’il enlève chaque seconde au héros qui le bloque.' },
    vent: { nom: 'Recul sous le vent', unite: '×', min: 0, max: 4, pas: 0.05, aide: '1 : normal ; 1,5 : léger, il s’envole plus loin ; 0 : le vent ne le pousse pas.' },
    gel: { nom: 'Effet du gel', unite: '×', min: 0, max: 1, pas: 0.05, aide: '1 : normal ; 0,5 : le gel ne le ralentit qu’à moitié (et le gèle moitié moins longtemps).' },
    armure: { nom: 'Carapace', unite: 'dégâts perdus par coup', min: 0, max: 200, pas: 1, aide: 'Chaque coup perd ces dégâts-là (au moins 1 passe toujours). Le rayon du Prisme et le Météore la traversent.' },
    'creuse.dessous': { nom: 'Sous terre', unite: 's', min: 0.1, max: 12, pas: 0.1, aide: 'Le temps qu’il passe sous terre, où personne ne peut le viser.' },
    'creuse.dessus': { nom: 'Dehors', unite: 's', min: 0.1, max: 12, pas: 0.1, aide: 'Le temps qu’il reste dehors avant de replonger.' },
    'creuse.vitesse': { nom: 'Vitesse sous terre', unite: '× sa vitesse', min: 0.1, max: 6, pas: 0.05, aide: 'Sous terre, il file plus vite.' },
    'feu.toutesLes': { nom: 'Crache du feu toutes les', unite: 's', min: 0.5, max: 60, pas: 0.5, aide: 'Le temps entre deux jets de feu.' },
    'feu.portee': { nom: 'Portée du feu', unite: 'cases', min: 0.5, max: 12, pas: 0.1, aide: 'Il crache sur le gardien le plus proche, à moins de … cases.' },
    'feu.duree': { nom: 'Gardien assommé', unite: 's', min: 0, max: 12, pas: 0.1, aide: 'Le gardien touché ne tire plus pendant … secondes.' },
    'enfants.nombre': { nom: 'Petits libérés', unite: 'monstres', min: 0, max: 30, pas: 1, entier: true, aide: 'Battu, il libère ce nombre de petits monstres.' },
  },
  meteore: {
    parVague: { nom: 'Météores par vague', unite: '', min: 0, max: 10, pas: 1, entier: true, aide: 'Combien on en a pour chaque vague (ceux qu’on ne lance pas sont perdus).' },
    chute: { nom: 'Temps de chute', unite: 's', min: 0.1, max: 6, pas: 0.05, aide: 'Il faut viser là où les monstres SERONT quand il tombera.' },
    rayon: { nom: 'Rayon de l’explosion', unite: 'cases', min: 0.2, max: 6, pas: 0.05, aide: 'Il touche les monstres à moins de … cases.' },
    part: { nom: 'Part de vie enlevée', unite: 'de la vie qui reste', min: 0, max: 1, pas: 0.01, aide: '0,5 : chaque monstre touché perd la moitié de la vie qui lui reste.' },
    partGele: { nom: 'Sur un monstre gelé', unite: 'de la vie qui reste', min: 0, max: 1, pas: 0.01, aide: 'La part enlevée à un monstre gelé par le Grand froid.' },
  },
  froid: {
    recharge: { nom: 'Recharge', unite: 's de vague', min: 1, max: 900, pas: 1, aide: 'Le temps (pendant les vagues seulement) avant de pouvoir le relancer.' },
    duree: { nom: 'Durée', unite: 's', min: 0.1, max: 30, pas: 0.1, aide: 'Les monstres restent gelés sur place pendant … secondes.' },
    fragile: { nom: 'Dégâts sur les gelés', unite: '×', min: 1, max: 10, pas: 0.05, aide: '2 : gelés, les monstres prennent deux fois plus de dégâts.' },
  },
  heros: {
    vitesse: { nom: 'Vitesse de marche', unite: 'cases/s', min: 0.2, max: 12, pas: 0.1, aide: 'Pendant qu’il marche, il ne frappe pas.' },
    rayon: { nom: 'Portée de sa frappe', unite: 'cases', min: 0.2, max: 6, pas: 0.05, aide: 'Il frappe le sol et touche les monstres à moins de … cases.' },
    monstresMax: { nom: 'Monstres touchés au plus', unite: 'monstres', min: 1, max: 40, pas: 1, entier: true, aide: 'Une frappe touche les plus proches.' },
    cadence: { nom: 'Temps entre deux frappes', unite: 's', min: 0.1, max: 8, pas: 0.05, aide: 'Une frappe toutes les … secondes.' },
    'barrage.rayon': { nom: 'Il barre la route à', unite: 'cases', min: 0, max: 4, pas: 0.05, aide: 'Les monstres à moins de … cases avancent au ralenti… et le frappent.' },
    'barrage.facteur': { nom: 'Vitesse des monstres bloqués', unite: '× leur vitesse', min: 0, max: 1, pas: 0.01, aide: '0,5 : ils avancent deux fois moins vite.' },
    coupParDefaut: { nom: 'Coups d’un monstre sans « coup »', unite: 'PV/s', min: 0, max: 300, pas: 0.5, aide: 'Pour les monstres dont la fiche ne dit rien.' },
    'soin.attente': { nom: 'Calme avant de se soigner', unite: 's', min: 0, max: 30, pas: 0.5, aide: 'Il se soigne après … secondes sans monstre à moins de 2 cases.' },
    'soin.part': { nom: 'Soin', unite: 'de sa vie par seconde', min: 0, max: 1, pas: 0.01, aide: '0,08 : il reprend 8 % de sa vie chaque seconde.' },
    partage: { nom: 'Expérience partagée', unite: 'de la prime', min: 0, max: 1, pas: 0.01, aide: 'Il gagne cette part de la prime des monstres battus par les autres.' },
  },
  herosNiveau: {
    degats: { nom: 'Dégâts d’une frappe', unite: 'PV', min: 0, max: 2000, pas: 1, aide: 'Les points de vie enlevés à chaque monstre touché.' },
    vie: { nom: 'Vie', unite: 'PV', min: 1, max: 20000, pas: 5, entier: true, aide: 'À zéro, il est K.O. jusqu’à la vague suivante.' },
    xp: { nom: 'Expérience pour y arriver', unite: 'points', min: 0, max: 200000, pas: 10, entier: true, aide: 'Le total d’expérience qu’il faut pour atteindre ce niveau.' },
  },
  peau: {
    niveau: { nom: 'Au niveau', unite: '', min: 1, max: 6, pas: 1, entier: true, aide: 'Le niveau du héros où ce pouvoir arrive.' },
    coups: { nom: 'Coups encaissés', unite: '×', min: 0, max: 1, pas: 0.01, aide: '0,5 : il encaisse deux fois moins de coups.' },
    soin: { nom: 'Soin', unite: '×', min: 1, max: 10, pas: 0.1, aide: '2 : il se soigne deux fois plus vite.' },
  },
  onde: {
    niveau: { nom: 'Au niveau', unite: '', min: 1, max: 6, pas: 1, entier: true, aide: 'Le niveau du héros où ce pouvoir arrive.' },
    recharge: { nom: 'Recharge', unite: 's de vague', min: 1, max: 300, pas: 1, aide: 'Le temps (pendant les vagues) avant de pouvoir la relancer.' },
    rayon: { nom: 'Rayon', unite: 'cases', min: 0.2, max: 8, pas: 0.05, aide: 'Les monstres à moins de … cases sont assommés.' },
    duree: { nom: 'Assommés pendant', unite: 's', min: 0, max: 12, pas: 0.1, aide: 'Assommés, ils ne bougent plus.' },
    degats: { nom: 'Frappes d’un coup', unite: '× une frappe', min: 0, max: 20, pas: 0.5, aide: 'Les monstres touchés prennent ce nombre de frappes d’un coup.' },
  },
  bond: {
    niveau: { nom: 'Au niveau', unite: '', min: 1, max: 6, pas: 1, entier: true, aide: 'Le niveau du héros où ce pouvoir arrive.' },
    recharge: { nom: 'Recharge', unite: 's de vague', min: 1, max: 300, pas: 1, aide: 'Le temps (pendant les vagues) avant de pouvoir resauter.' },
    duree: { nom: 'Durée du saut', unite: 's', min: 0.1, max: 4, pas: 0.05, aide: 'Pendant le saut, il ne frappe pas.' },
    rayon: { nom: 'Rayon à l’atterrissage', unite: 'cases', min: 0.2, max: 8, pas: 0.05, aide: 'Les monstres à moins de … cases sont assommés.' },
    assomme: { nom: 'Assommés pendant', unite: 's', min: 0, max: 12, pas: 0.1, aide: 'Le temps où les monstres ne bougent plus.' },
  },
  economie: {
    revente: { nom: 'Revente', unite: 'de ce qu’on a dépensé', min: 0, max: 1, pas: 0.01, aide: 'Ce qu’on récupère en revendant un gardien (achat et améliorations).' },
    'finDeVague.base': { nom: 'Bonus de fin de vague', unite: 'pièces', min: 0, max: 2000, pas: 5, entier: true, aide: 'L’or gagné à la fin de chaque vague…' },
    'finDeVague.parVague': { nom: '… plus, par vague tenue', unite: 'pièces', min: 0, max: 500, pas: 1, entier: true, aide: '… plus cette somme × le numéro de la vague.' },
  },
  survie: {
    croissance: { nom: 'Menace en plus à chaque vague', unite: '×', min: 1, max: 3, pas: 0.01, aide: '1,2 : chaque vague fabriquée apporte 20 % de menace en plus (les points de vie × la vitesse).' },
    maxParGroupe: { nom: 'Monstres par groupe au plus', unite: 'monstres', min: 1, max: 200, pas: 1, entier: true, aide: 'Au-delà, les monstres deviennent plus solides plutôt que plus nombreux.' },
  },
};

// La famille d'un chiffre, d'après sa place dans le fichier (le chemin, comme
// ['gardiens', 'braise', 'niveaux', 0, 'ralentissement', 'facteur']), et son nom dans la famille
// (« ralentissement.facteur »). null s'il n'est pas à une place connue.
export function familleDe(chemin) {
  const [groupe, a, b, c, ...reste] = chemin;
  const cle = (morceaux) => morceaux.join('.');
  if (groupe === 'gardiens') {
    if (b === 'projectile') return { famille: 'gardien', cle: cle(['projectile', c, ...reste]) };
    if (b === 'niveaux') return { famille: 'gardien', cle: cle(reste) };
  }
  if (groupe === 'monstres') return { famille: 'monstre', cle: cle([b, c, ...reste].filter((x) => x !== undefined)) };
  if (groupe === 'pouvoirs' && (a === 'meteore' || a === 'froid')) return { famille: a, cle: cle([b, c, ...reste].filter((x) => x !== undefined)) };
  if (groupe === 'heros') {
    if (a === 'niveaux') return { famille: 'herosNiveau', cle: cle([c, ...reste].filter((x) => x !== undefined)) };
    if (a === 'pouvoirs') return { famille: b, cle: cle([c, ...reste].filter((x) => x !== undefined)) };
    return { famille: 'heros', cle: cle([a, b, c, ...reste].filter((x) => x !== undefined)) };
  }
  if (groupe === 'economie' || groupe === 'survie') return { famille: groupe, cle: cle([a, b, c, ...reste].filter((x) => x !== undefined)) };
  return null;
}
export const champDe = (chemin) => {
  const f = familleDe(chemin);
  return f ? CHAMPS[f.famille]?.[f.cle] || null : null;
};

// Compare des chiffres proposés au modèle (le fichier actuel) : exactement les mêmes champs, aux
// mêmes places (l'atelier change des valeurs, pas la forme du fichier), et chaque chiffre dans ses
// limites. Renvoie la liste des problèmes (vide : tout va bien).
export function problemesChiffres(proposes, modele) {
  const problemes = [];
  const verifier = (p, m, chemin) => {
    const ici = chemin.join('.') || 'chiffres';
    if (Array.isArray(m)) {
      if (!Array.isArray(p) || p.length !== m.length) return problemes.push(`${ici} : il faut une liste de ${m.length}`);
      return m.forEach((x, i) => verifier(p[i], x, [...chemin, i]));
    }
    if (m && typeof m === 'object') {
      if (!p || typeof p !== 'object' || Array.isArray(p)) return problemes.push(`${ici} : il faut un objet`);
      for (const cle of Object.keys(p)) if (!(cle in m)) problemes.push(`${ici}.${cle} : champ inconnu`);
      for (const cle of Object.keys(m)) {
        if (!(cle in p)) problemes.push(`${ici}.${cle} manque`);
        else verifier(p[cle], m[cle], [...chemin, cle]);
      }
      return;
    }
    const champ = champDe(chemin);
    if (!champ) return problemes.push(`${ici} : chiffre inconnu (il manque son sens dans format-chiffres.js)`);
    if (typeof p !== 'number' || !Number.isFinite(p)) return problemes.push(`${ici} : il faut un nombre`);
    if (p < champ.min || p > champ.max) problemes.push(`${ici} : ${champ.nom.toLowerCase()} entre ${champ.min} et ${champ.max}`);
    if (champ.entier && !Number.isInteger(p)) problemes.push(`${ici} : il faut un nombre entier`);
  };
  verifier(proposes, modele, []);
  // quelques règles de bon sens sur le héros : des niveaux de plus en plus chers, des pouvoirs qu'il
  // peut atteindre
  const niveaux = proposes?.heros?.niveaux;
  if (!problemes.length && Array.isArray(niveaux)) {
    if (niveaux[0].xp !== 0) problemes.push('heros.niveaux.0.xp : le niveau 1 doit demander 0 point d’expérience');
    for (let i = 1; i < niveaux.length; i++) {
      if (niveaux[i].xp <= niveaux[i - 1].xp) problemes.push(`heros.niveaux.${i}.xp : chaque niveau doit demander plus d’expérience que le précédent`);
    }
    for (const [nom, p] of Object.entries(proposes.heros.pouvoirs)) {
      if (p.niveau > niveaux.length) problemes.push(`heros.pouvoirs.${nom}.niveau : le héros n’a que ${niveaux.length} niveaux`);
    }
  }
  return problemes;
}

// Écrit les chiffres en JSON lisible : ce qui tient sur une ligne y reste (un niveau de gardien,
// un monstre), le reste passe à la ligne ; une liste (les niveaux) a toujours un élément par ligne.
export function formaterChiffres(donnees) {
  const aUneListe = (v) => Array.isArray(v) || (v && typeof v === 'object' && Object.values(v).some(aUneListe));
  const uneLigne = (v) => {
    if (Array.isArray(v)) return `[${v.map(uneLigne).join(', ')}]`;
    if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${uneLigne(x)}`).join(', ')} }`;
    return JSON.stringify(v);
  };
  const ecrire = (v, retrait) => {
    const court = uneLigne(v);
    if (!v || typeof v !== 'object' || (retrait.length + court.length <= 140 && !aUneListe(v))) return court;
    const dedans = retrait + '  ';
    if (Array.isArray(v)) return `[\n${v.map((x) => dedans + ecrire(x, dedans)).join(',\n')}\n${retrait}]`;
    return `{\n${Object.entries(v).map(([k, x]) => `${dedans}${JSON.stringify(k)}: ${ecrire(x, dedans)}`).join(',\n')}\n${retrait}}`;
  };
  return ecrire(donnees, '') + '\n';
}
