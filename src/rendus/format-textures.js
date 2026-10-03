// ─────────────────────────────────────────────────────────────
// LES RECETTES DES TEXTURES (src/rendus/textures.json) : les vérifier, les écrire
// Le fichier range, pour chaque style, la recette de chacune de ses textures
// (voir recettes.js). Le style voxel le lit au démarrage ; l'atelier des
// textures (textures.html) le modifie et l'enregistre.
// Ce petit module sert aux deux côtés : l'atelier, et le serveur de
// développement (vite.config.js), qui revérifie tout avant d'écrire le fichier.
// ─────────────────────────────────────────────────────────────
import { COUCHES } from './recettes.js';

const COULEUR = /^#[0-9a-f]{6}$/i;
const NOM_RAMPE = /^[a-z][a-zA-Z0-9]{0,23}$/;
export const VARIANTES_MAX = 4;
export const COUCHES_MAX = 12;
export const COULEURS_MAX = 8;

// Les problèmes d'une recette (une liste vide : tout va bien)
export function problemesRecette(r, chemin) {
  const problemes = [];
  if (!r || typeof r !== 'object' || Array.isArray(r)) return [`${chemin} : il faut une recette`];
  const rampes = r.rampes && typeof r.rampes === 'object' && !Array.isArray(r.rampes) ? r.rampes : null;
  if (!rampes || !Object.keys(rampes).length) problemes.push(`${chemin}.rampes : il faut au moins une rampe`);
  for (const [nom, couleurs] of Object.entries(rampes || {})) {
    if (!NOM_RAMPE.test(nom)) problemes.push(`${chemin}.rampes : « ${nom} » n’est pas un nom de rampe (des lettres, sans espace)`);
    if (!Array.isArray(couleurs) || !couleurs.length || couleurs.length > COULEURS_MAX || !couleurs.every((c) => typeof c === 'string' && COULEUR.test(c))) {
      problemes.push(`${chemin}.rampes.${nom} : il faut de 1 à ${COULEURS_MAX} couleurs comme #ffcc88`);
    }
  }
  if (!Array.isArray(r.couches) || !r.couches.length || r.couches.length > COUCHES_MAX) {
    problemes.push(`${chemin}.couches : il faut de 1 à ${COUCHES_MAX} couches`);
  } else {
    r.couches.forEach((couche, i) => {
      const ici = `${chemin}.couches[${i}]`;
      const sorte = COUCHES[couche?.type];
      if (!sorte) { problemes.push(`${ici} : sorte de couche inconnue « ${couche?.type} »`); return; }
      for (const [cle, borne] of Object.entries(sorte.reglages)) {
        const v = couche[cle];
        if (borne === 'rampe') {
          if (typeof v !== 'string' || !rampes?.[v]) problemes.push(`${ici}.${cle} : il faut le nom d’une des rampes de la recette`);
        } else if (borne === 'liste') {
          if (!Array.isArray(v) || v.length > 8 || !v.every((x) => typeof x === 'number' && Number.isFinite(x) && Math.abs(x) <= 100)) problemes.push(`${ici}.${cle} : il faut une liste d’au plus 8 nombres`);
        } else if (typeof v !== 'number' || !Number.isFinite(v) || v < borne[0] || v > borne[1]) {
          problemes.push(`${ici}.${cle} : il faut un nombre entre ${borne[0]} et ${borne[1]}`);
        }
      }
      for (const cle of Object.keys(couche)) if (cle !== 'type' && !(cle in sorte.reglages)) problemes.push(`${ici}.${cle} : réglage inconnu`);
    });
  }
  if (!Number.isInteger(r.variantes) || r.variantes < 1 || r.variantes > VARIANTES_MAX) problemes.push(`${chemin}.variantes : il faut un nombre entier de 1 à ${VARIANTES_MAX}`);
  if (typeof r.tourner !== 'boolean') problemes.push(`${chemin}.tourner : il faut true ou false`);
  if (typeof r.miroir !== 'boolean') problemes.push(`${chemin}.miroir : il faut true ou false`);
  for (const cle of Object.keys(r)) if (!['rampes', 'couches', 'variantes', 'tourner', 'miroir'].includes(cle)) problemes.push(`${chemin}.${cle} : réglage inconnu`);
  return problemes;
}

// Compare des recettes proposées au modèle (le fichier actuel) : les mêmes styles et les mêmes
// textures (le jeu se sert de chacune), chacune avec une recette correcte. Renvoie les problèmes.
export function problemesTextures(proposees, modele) {
  if (!proposees || typeof proposees !== 'object' || Array.isArray(proposees)) return ['textures : il faut un objet'];
  const problemes = [];
  for (const style of Object.keys(proposees)) if (!(style in modele)) problemes.push(`${style} : style inconnu`);
  for (const [style, textures] of Object.entries(modele)) {
    const p = proposees[style];
    if (!p || typeof p !== 'object') { problemes.push(`${style} manque`); continue; }
    for (const nom of Object.keys(textures)) if (!(nom in p)) problemes.push(`${style}.${nom} manque (le jeu s’en sert)`);
    for (const [nom, recette] of Object.entries(p)) {
      if (!(nom in textures)) problemes.push(`${style}.${nom} : texture inconnue`);
      else problemes.push(...problemesRecette(recette, `${style}.${nom}`));
    }
  }
  return problemes;
}

// Écrit les recettes en JSON lisible : ce qui tient sur une ligne y reste (une rampe, une
// couche…), le reste passe à la ligne. Une recette fait ainsi quelques lignes faciles à relire.
export function formaterTextures(donnees) {
  const uneLigne = (v) => {
    if (Array.isArray(v)) return `[${v.map(uneLigne).join(', ')}]`;
    if (v && typeof v === 'object') return `{ ${Object.entries(v).map(([k, x]) => `${JSON.stringify(k)}: ${uneLigne(x)}`).join(', ')} }`;
    return JSON.stringify(v);
  };
  const ecrire = (v, retrait) => {
    const court = uneLigne(v);
    if (retrait.length + court.length <= 110 || !v || typeof v !== 'object') return court;
    const dedans = retrait + '  ';
    if (Array.isArray(v)) return `[\n${v.map((x) => dedans + ecrire(x, dedans)).join(',\n')}\n${retrait}]`;
    return `{\n${Object.entries(v).map(([k, x]) => `${dedans}${JSON.stringify(k)}: ${ecrire(x, dedans)}`).join(',\n')}\n${retrait}}`;
  };
  return ecrire(donnees, '') + '\n';
}
