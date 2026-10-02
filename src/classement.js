// ─────────────────────────────────────────────────────────────
// LE CLASSEMENT DU MODE SURVIE
// Les scores sont rangés en ligne par le petit serveur du dossier
// serveur/ (une fonction Vercel) : tous les joueurs se comparent.
// Si le serveur ne répond pas (pas d'Internet, serveur en panne…), le jeu
// continue comme avant : le score est gardé dans ce navigateur, et le
// classement montre les scores de cet ordinateur.
// Toutes les fonctions sont « async » : elles renvoient une promesse, le
// temps que le serveur réponde. Le reste du jeu n'a presque pas changé
// quand le classement est passé en ligne : c'était prévu dès le début.
// ─────────────────────────────────────────────────────────────
const SERVEUR = 'https://petits-gardiens-classement.vercel.app/api/scores';
const ATTENTE_MAX = 6000; // au-delà de 6 secondes sans réponse, on fait sans le serveur
const CLE = 'petits-gardiens-classement';
const CLE_PSEUDO = 'petits-gardiens-pseudo';
const GARDES = 50;     // sur cet ordinateur, on garde les 50 meilleurs scores de chaque arène
export const LONGUEUR_PSEUDO = 16;

// D'où viennent les derniers scores lus : 'en-ligne' (tous les joueurs) ou 'ordinateur' (ce navigateur)
let source = 'ordinateur';
export const sourceDuClassement = () => source;

// ── Parler au serveur ────────────────────────────────────────
// Le serveur a répondu, mais il refuse le score (pseudo, trop d'envois…) :
// ce n'est pas une panne, on le dit au joueur
class Refus extends Error {}

async function demander(adresse, options = {}) {
  // si le serveur met trop de temps, on abandonne la question (AbortController)
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), ATTENTE_MAX);
  try {
    const reponse = await fetch(adresse, { ...options, signal: controle.signal });
    const donnees = await reponse.json().catch(() => ({}));
    if (reponse.status === 400 || reponse.status === 429) throw new Refus(donnees.erreur || 'Score refusé.');
    if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
    return donnees;
  } finally {
    clearTimeout(minuterie);
  }
}

// ── Les scores de cet ordinateur (quand le serveur ne répond pas) ──
function lireTout() {
  try { return JSON.parse(localStorage.getItem(CLE)) || {}; } catch { return {}; }
}
function ecrireTout(tout) {
  try { localStorage.setItem(CLE, JSON.stringify(tout)); } catch { /* stockage refusé : le score est perdu */ }
}

// L'ordre du classement : le plus de vagues tenues, puis le plus de monstres
// battus, puis le premier arrivé (à égalité, celui qui l'a fait avant reste devant)
const avant = (a, b) => b.vagues - a.vagues || b.battus - a.battus || a.date - b.date;

function meilleursScoresLocaux(arene, combien) {
  return [...(lireTout()[arene] || [])].sort(avant).slice(0, combien);
}
function enregistrerScoreLocal(arene, { pseudo, vagues, battus }) {
  const tout = lireTout();
  const score = { pseudo, vagues, battus, date: Date.now() };
  const liste = [...(tout[arene] || []), score].sort(avant);
  tout[arene] = liste.slice(0, GARDES);
  ecrireTout(tout);
  return { place: liste.indexOf(score) + 1, total: liste.length, score };
}

// ── Ce que le jeu utilise ────────────────────────────────────
// Les meilleurs scores d'une arène, du premier au dernier
export async function meilleursScores(arene, combien = 10) {
  try {
    const { scores } = await demander(`${SERVEUR}?arene=${encodeURIComponent(arene)}&combien=${combien}`);
    source = 'en-ligne';
    return scores;
  } catch {
    source = 'ordinateur';
    return meilleursScoresLocaux(arene, combien);
  }
}

// Range un score. Renvoie { place, total, score } (place 1 = premier) ;
// avec horsLigne: true si le serveur n'a pas répondu (le score est gardé sur cet
// ordinateur) ; ou { erreur } si le serveur a refusé le score.
export async function enregistrerScore(arene, { pseudo, vagues, battus }) {
  try {
    const resultat = await demander(SERVEUR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ arene, pseudo, vagues, battus }),
    });
    source = 'en-ligne';
    return resultat;
  } catch (e) {
    if (e instanceof Refus) return { erreur: e.message };
    source = 'ordinateur';
    return { ...enregistrerScoreLocal(arene, { pseudo, vagues, battus }), horsLigne: true };
  }
}

// Un pseudo propre : sans caractères invisibles ni espaces en trop, 16 caractères au plus
// (le serveur refait la même chose de son côté : il ne fait confiance à personne)
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
