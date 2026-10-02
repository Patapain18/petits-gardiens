// ─────────────────────────────────────────────────────────────
// LE COMPTEUR DE VISITES
// Chaque page du site prévient notre serveur qu'on vient de l'ouvrir, et le
// jeu le prévient quand on lance la première vague d'une partie (voir
// serveur/api/visites.js). C'est ce qui remplit la page des visites
// (visites.html) : combien de visiteurs par jour, ce qu'ils regardent, d'où
// ils viennent, combien jouent vraiment.
//
// Ce qui part : le nom de la page (et du niveau, en jeu), et le site d'où
// vient le visiteur s'il a suivi un lien (juste son nom : « discord.com »).
// Rien sur lui : pas de cookie, rien de gardé dans son navigateur. Le
// serveur, lui, ne garde que des compteurs.
//
// On ne compte que le vrai site : ni le développement (npm run dev), ni le
// site fabriqué essayé sur l'ordinateur (localhost), ni les navigateurs
// pilotés par un programme. Et sur la page des visites, on peut demander de
// ne pas compter son propre ordinateur (pour ne pas se compter soi-même).
// ─────────────────────────────────────────────────────────────
const SERVEUR = 'https://petits-gardiens-classement.vercel.app/api/visites';
const ATTENTE_MAX = 8000;                 // au-delà de 8 secondes sans réponse, on laisse tomber
export const CLE_IGNORER = 'pg-visites-ignorer'; // « ne pas compter cet ordinateur » (voir visites.js)

export function ordinateurIgnore() {
  try { return localStorage.getItem(CLE_IGNORER) === 'oui'; } catch { return false; }
}
export function ignorerCetOrdinateur(oui) {
  try {
    if (oui) localStorage.setItem(CLE_IGNORER, 'oui');
    else localStorage.removeItem(CLE_IGNORER);
  } catch { /* stockage refusé : tant pis */ }
}

function onCompte() {
  if (!import.meta.env.PROD || ['localhost', '127.0.0.1'].includes(location.hostname)) return false;
  return !navigator.webdriver && !ordinateurIgnore();
}

// D'où vient le visiteur, s'il a suivi un lien depuis un autre site : son nom (« discord.com »).
// Un autre site rangé sur la même adresse que le jeu (patapain18.github.io/kaorie) garde son
// dossier, pour ne pas le confondre avec le jeu. Venu d'une page du jeu, ou directement : ''.
function sourceExterne() {
  try {
    const venu = new URL(document.referrer);
    if (venu.href.startsWith(new URL('./', location.href).href)) return '';
    const nom = venu.hostname.replace(/^www\./, '');
    const dossier = venu.hostname === location.hostname ? venu.pathname.split('/')[1].toLowerCase() : '';
    return dossier ? `${nom}/${dossier}` : nom;
  } catch {
    return ''; // pas de « referrer » : venu directement (un favori, un lien dans une appli…)
  }
}

// On envoie sans attendre la réponse, avec sendBeacon : le message part même si on quitte la
// page tout de suite. Le corps part en simple texte : le navigateur n'a pas à demander la
// permission avant (une requête « OPTIONS » de plus à chaque page, pour rien).
function envoyer(donnees) {
  if (!onCompte()) return;
  const corps = JSON.stringify(donnees);
  try {
    if (navigator.sendBeacon?.(SERVEUR, corps)) return;
  } catch { /* sendBeacon refusé : on essaie autrement */ }
  fetch(SERVEUR, { method: 'POST', body: corps, keepalive: true }).catch(() => {});
}

// Une page vient d'être ouverte. page : 'accueil', 'jeu', 'revoir'… ; niveau : en jeu, le niveau joué
export function compterVisite(page, niveau = null) {
  envoyer({ page, ...(niveau && { niveau }), source: sourceExterne() });
}

// Le joueur lance la première vague d'une partie
export function compterPartie(niveau) {
  envoyer({ evenement: 'partie', niveau });
}

// Les chiffres des derniers jours, pour la page des visites : { jours: [...] }, ou null
// (pas d'Internet, serveur en panne ou pas encore à jour…)
export async function lireVisites(jours) {
  const controle = new AbortController();
  const minuterie = setTimeout(() => controle.abort(), ATTENTE_MAX);
  try {
    const reponse = await fetch(`${SERVEUR}?jours=${jours}`, { signal: controle.signal });
    if (!reponse.ok) return null;
    return await reponse.json();
  } catch {
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}
