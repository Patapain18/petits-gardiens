// ─────────────────────────────────────────────────────────────
// LE CLASSEMENT DU MODE SURVIE
// Pour l'instant, les scores sont gardés dans ce navigateur (localStorage).
// Toutes les fonctions sont « async » : elles renvoient une promesse, comme
// le ferait une question posée à un serveur. Le jour où le classement passe
// en ligne, seul ce fichier change (il parlera à un serveur au lieu du
// navigateur) : le reste du jeu ne verra pas la différence.
// ─────────────────────────────────────────────────────────────
const CLE = 'petits-gardiens-classement';
const CLE_PSEUDO = 'petits-gardiens-pseudo';
const GARDES = 50;     // on garde les 50 meilleurs scores de chaque arène
export const LONGUEUR_PSEUDO = 16;

function lireTout() {
  try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; }
}
function ecrireTout(tout) {
  try { localStorage.setItem(CLE, JSON.stringify(tout)); } catch { /* stockage refusé : le score est perdu */ }
}

// L'ordre du classement : le plus de vagues tenues, puis le plus de monstres
// battus, puis le premier arrivé (à égalité, celui qui l'a fait avant reste devant)
const avant = (a, b) => b.vagues - a.vagues || b.battus - a.battus || a.date - b.date;

// Les meilleurs scores d'une arène, du premier au dernier
export async function meilleursScores(arene, combien = 10) {
  return [...(lireTout()[arene] || [])].sort(avant).slice(0, combien);
}

// Range un score et renvoie sa place (1 = premier), même s'il ne reste pas dans les 50
export async function enregistrerScore(arene, { pseudo, vagues, battus }) {
  const tout = lireTout();
  const score = { pseudo, vagues, battus, date: Date.now() };
  const liste = [...(tout[arene] || []), score].sort(avant);
  tout[arene] = liste.slice(0, GARDES);
  ecrireTout(tout);
  return { place: liste.indexOf(score) + 1, total: liste.length, score };
}

// Un pseudo propre : sans caractères invisibles ni espaces en trop, 16 caractères au plus
export function nettoyerPseudo(texte) {
  return String(texte)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONGUEUR_PSEUDO);
}

// Le pseudo de la dernière partie, pour ne pas le retaper à chaque fois
export function pseudoMemorise() {
  try { return localStorage.getItem(CLE_PSEUDO) || ''; } catch { return ''; }
}
export function memoriserPseudo(pseudo) {
  try { localStorage.setItem(CLE_PSEUDO, pseudo); } catch { /* tant pis */ }
}
