// ─────────────────────────────────────────────────────────────
// L'ENVOI DES PARTIES ENREGISTRÉES
// À la fin de chaque partie, son enregistrement (voir jeu/enregistrement.js :
// les décisions du joueur et le moment où il les a prises) part sur le
// serveur du classement. C'est ce qui permet de revoir une partie
// (revoir.html) et de régler le jeu avec de vraies parties (npm run parties).
//
// On n'envoie rien d'autre que la partie elle-même, le pseudo du classement
// (s'il y en a un) et la famille du navigateur (Safari, Chrome…), utile si
// une partie se rejoue mal. Le joueur peut tout refuser dans les Options
// (« Partager mes parties »).
//
// Chaque partie terminée est d'abord gardée par le navigateur, puis envoyée :
// si l'envoi échoue (pas d'Internet…) ou si l'onglet se ferme en route, elle
// part la prochaine fois qu'on ouvre le jeu.
// ─────────────────────────────────────────────────────────────
import { vaguesTerminees } from './jeu/moteur.js';
import { lireOptions } from './options.js';
import { pseudoMemorise } from './classement.js';

const SERVEUR = 'https://petits-gardiens-classement.vercel.app/api/parties';
const ATTENTE_MAX = 8000;                        // au-delà de 8 secondes sans réponse, on laisse tomber
const CLE_ATTENTE = 'pg-parties-en-attente';     // les parties pas encore envoyées
const ATTENTE_GARDEES = 5;                       // on n'en garde pas plus (les plus récentes)
const TAILLE_MAX = 450_000;                      // une partie fait quelques dizaines de Ko : au-delà, on n'envoie pas

// La version du jeu (le commit publié), écrite par Vite au moment de fabriquer le site
// (voir vite.config.js) ; « dev » pendant le développement
export const VERSION = __VERSION__;

// Les parties jouées pendant le développement (npm run dev) partent « pour essai » : le
// serveur les range à part, pour ne pas mélanger mes vérifications avec les vraies parties
const ESSAI = import.meta.env.DEV;

// La famille du navigateur, sans plus de détails
function navigateur() {
  const ua = navigator.userAgent;
  if (/Firefox\//.test(ua)) return 'firefox';
  if (/Edg\//.test(ua)) return 'edge';
  if (/Chrome\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'autre';
}

// Ce qui part sur le serveur : l'enregistrement, et comment la partie s'est terminée.
// statut : 'perdu', 'gagne', ou 'abandon' (le joueur a recommencé ou est parti en route)
export function preparerEnvoi(enregistrement, etat, statut) {
  return {
    ...enregistrement,
    fin: etat.pas,                    // le dernier pas joué
    statut,
    vagues: vaguesTerminees(etat),    // les vagues tenues
    battus: etat.battus,
    pseudo: pseudoMemorise(),
    navigateur: navigateur(),
    essai: ESSAI,
  };
}

// Envoie une partie. Renvoie son identifiant sur le serveur (pour la revoir), ou null
// (partage refusé dans les Options, pas d'Internet, serveur en panne…).
export async function envoyerPartie(envoi) {
  if (!lireOptions().partage) return null;
  const corps = JSON.stringify(envoi);
  if (corps.length > TAILLE_MAX) return null;
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), ATTENTE_MAX);
  try {
    const reponse = await fetch(SERVEUR, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: corps,
      signal: controle.signal,
    });
    if (!reponse.ok) return null;
    return (await reponse.json()).id ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

// Les parties en attente d'envoi, gardées par le navigateur (une partie = son « debut », l'heure
// où elle a commencé : deux parties n'ont jamais le même)
function lireAttente() {
  try { return JSON.parse(localStorage.getItem(CLE_ATTENTE)) || []; } catch { return []; }
}
function ecrireAttente(liste) {
  try { localStorage.setItem(CLE_ATTENTE, JSON.stringify(liste.slice(-ATTENTE_GARDEES))); } catch { /* stockage refusé : tant pis */ }
}
export function garderEnAttente(envoi) {
  if (!lireOptions().partage) return;
  ecrireAttente([...lireAttente().filter((e) => e.debut !== envoi.debut), envoi]);
}
function oublierAttente(envoi) {
  ecrireAttente(lireAttente().filter((e) => e.debut !== envoi.debut));
}

// Garde la partie (au cas où), puis l'envoie ; une fois arrivée, le navigateur l'oublie.
// Renvoie son identifiant sur le serveur, ou null.
export async function garderEtEnvoyer(envoi) {
  garderEnAttente(envoi);
  const id = await envoyerPartie(envoi);
  if (id) oublierAttente(envoi);
  return id;
}

// À l'ouverture du jeu : on envoie les parties restées en attente
export async function envoyerPartiesEnAttente() {
  for (const envoi of lireAttente()) {
    if (await envoyerPartie(envoi)) oublierAttente(envoi);
  }
}

// Une partie enregistrée, pour la revoir (null si elle n'existe pas, ou si le serveur ne répond pas)
export async function lirePartie(id) {
  try {
    const reponse = await fetch(`${SERVEUR}?id=${encodeURIComponent(id)}`);
    if (!reponse.ok) return null;
    return await reponse.json();
  } catch {
    return null;
  }
}
