// ─────────────────────────────────────────────────────────────
// LES RÉGLAGES DES AMBIANCES (src/rendus/ambiances.json) : les vérifier, les écrire
// Le fichier range, pour chaque style, les réglages de ses quatre ambiances
// (le soleil, le ciel, la brume, le halo…). Les styles le lisent au démarrage ;
// l'atelier des lumières (lumieres.html) le modifie et l'enregistre.
// Ce petit module sert aux deux côtés : l'atelier, et le serveur de
// développement (vite.config.js), qui revérifie tout avant d'écrire le fichier.
// ─────────────────────────────────────────────────────────────
const COULEUR = /^#[0-9a-f]{6}$/i;

// Compare des réglages proposés au modèle (le fichier actuel) : les mêmes styles, les mêmes
// ambiances, les mêmes noms de réglages, et des valeurs du même genre (un nombre, une
// couleur « #rrggbb », une liste de la même longueur). Renvoie la liste des problèmes.
export function problemesAmbiances(proposees, modele) {
  const problemes = [];
  const comparer = (p, m, chemin) => {
    if (Array.isArray(m)) {
      if (!Array.isArray(p) || p.length !== m.length) { problemes.push(`${chemin} : il faut une liste de ${m.length} valeurs`); return; }
      p.forEach((valeur, i) => comparer(valeur, m[i], `${chemin}[${i}]`));
    } else if (m && typeof m === 'object') {
      if (!p || typeof p !== 'object' || Array.isArray(p)) { problemes.push(`${chemin} : il faut un objet`); return; }
      for (const cle of Object.keys(m)) {
        if (cle in p) comparer(p[cle], m[cle], `${chemin}.${cle}`);
        else problemes.push(`${chemin}.${cle} manque`);
      }
      for (const cle of Object.keys(p)) if (!(cle in m)) problemes.push(`${chemin}.${cle} : réglage inconnu`);
    } else if (typeof m === 'number') {
      if (typeof p !== 'number' || !Number.isFinite(p) || Math.abs(p) > 1000) problemes.push(`${chemin} : il faut un nombre`);
    } else if (typeof m === 'string') {
      if (typeof p !== 'string' || !COULEUR.test(p)) problemes.push(`${chemin} : il faut une couleur comme #ffcc88`);
    }
  };
  comparer(proposees, modele, 'ambiances');
  return problemes;
}

// Écrit les réglages en JSON lisible : ce qui tient sur une ligne y reste
// ({ "couleur": "#ffbe6e", "force": 0.85 }, [-24, 11, 9]…), le reste passe à la ligne.
export function formaterAmbiances(donnees) {
  const uneLigne = (v) => {
    if (Array.isArray(v)) return `[${v.map(uneLigne).join(', ')}]`;
    if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${uneLigne(x)}`).join(', ')} }`;
    return JSON.stringify(v);
  };
  const ecrire = (v, retrait) => {
    const court = uneLigne(v);
    if (retrait.length + court.length <= 120 || !v || typeof v !== 'object') return court;
    const dedans = retrait + '  ';
    if (Array.isArray(v)) return `[\n${v.map((x) => dedans + ecrire(x, dedans)).join(',\n')}\n${retrait}]`;
    return `{\n${Object.entries(v).map(([k, x]) => `${dedans}${JSON.stringify(k)}: ${ecrire(x, dedans)}`).join(',\n')}\n${retrait}}`;
  };
  return ecrire(donnees, '') + '\n';
}
