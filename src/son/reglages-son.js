// ─────────────────────────────────────────────────────────────
// LES RÉGLAGES DU SON (src/son/sons.json)
// Les recettes des bruitages, les réglages des trois époques (le volume de
// chaque orchestre, son écho, la force de ses bruits) et le mixage de la
// musique sont rangés dans sons.json : des données, que l'atelier du son
// (son.html) mesure, règle et enregistre. Les modules du son les lisent ici,
// à chaque son joué : un réglage de l'atelier compte tout de suite.
// ─────────────────────────────────────────────────────────────
import FICHIER from './sons.json' with { type: 'json' };

// Une copie : l'atelier du son peut la changer sur place (voir appliquerReglagesSon)
export const REGLAGES_SON = structuredClone(FICHIER);

// Remplace les réglages par ceux-là (rangés comme sons.json : voir format-sons.js). Sur place : les
// modules du son gardent les mêmes objets en main (BRUITAGES dans effets.js, MIXAGES dans son.js).
export function appliquerReglagesSon(nouveaux) {
  recopier(REGLAGES_SON, structuredClone(nouveaux));
}
const objet = (v) => v && typeof v === 'object' && !Array.isArray(v);
function recopier(cible, source) {
  // ce qui n'existe plus (une limite retirée) disparaît
  for (const cle of Object.keys(cible)) if (!(cle in source)) delete cible[cle];
  for (const [cle, valeur] of Object.entries(source)) {
    if (objet(valeur) && objet(cible[cle])) recopier(cible[cle], valeur);
    else cible[cle] = valeur; // un nombre, un texte, ou une liste (les couches, les notes) : remplacé
  }
}
