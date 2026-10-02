// ─────────────────────────────────────────────────────────────
// LE SERVEUR DU CLASSEMENT EN LIGNE (une « fonction » Vercel)
// Vercel lance cette fonction chaque fois que le jeu appelle l'adresse
// /api/scores :
// - GET  /api/scores?arene=arene-pixel&combien=10 → les meilleurs scores ;
// - POST /api/scores avec { arene, pseudo, vagues, battus } → range le
//   score, et répond sa place. (Avec, si on l'a, « partie » : l'identifiant
//   de la partie enregistrée, voir parties.js. Le classement peut alors la
//   faire revoir.)
// Les scores sont rangés dans une base Upstash Redis, branchée au projet
// depuis le tableau de bord de Vercel. Vercel donne alors à cette fonction
// deux réglages secrets : l'adresse de la base et sa clé. Le jeu, lui, ne
// voit jamais la clé : c'est tout l'intérêt d'avoir un serveur.
// ─────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

// Les sites qui ont le droit d'appeler ce serveur depuis un navigateur :
// le jeu en ligne, et le jeu en développement sur l'ordinateur
const ORIGINES = ['https://patapain18.github.io', 'http://localhost:5180', 'http://localhost:4173'];
// Les arènes connues (« essai » sert aux vérifications : le jeu ne l'affiche jamais)
const ARENES = ['arene-pixel', 'essai'];
const LONGUEUR_PSEUDO = 16;
const MAX_VAGUES = 300;        // bien au-delà du meilleur joueur (une trentaine de vagues)
const MAX_BATTUS = 200000;
const GARDES = 200;            // on garde les 200 meilleurs scores de chaque arène
const ENVOIS_PAR_MINUTE = 6;   // au-delà, on refuse : personne ne peut inonder le classement

// ── Parler à la base ─────────────────────────────────────────
// Upstash comprend les commandes Redis envoyées par Internet : chaque commande est
// une liste (« ZADD », la clé, le score, la valeur…). On les envoie toutes d'un
// coup (un « pipeline ») et on reçoit leurs résultats, dans l'ordre.
const BASE = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const CLE = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(...commandes) {
  const reponse = await fetch(`${BASE}/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${CLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commandes),
  });
  if (!reponse.ok) throw new Error(`la base répond ${reponse.status}`);
  return (await reponse.json()).map((r) => {
    if (r.error) throw new Error(r.error);
    return r.result;
  });
}

// Chaque arène est un « ensemble trié » de Redis : chaque score y est rangé avec une
// note qui sert à le classer. La note = vagues × 1 000 000 + monstres battus : plus
// de vagues gagne toujours, et à égalité de vagues, plus de monstres battus.
// La SAISON : quand les règles changent beaucoup, le classement repart de zéro. Les scores
// d'avant restent dans la base (rien n'est effacé), sous la clé de leur saison : la saison 1
// sous « classement:arene-pixel », les suivantes sous « classement:arene-pixel:saison2 »…
// Saison 2 : depuis le 2 octobre 2026, le Météore ne revient qu'une fois par vague.
// (Le jeu affiche le numéro de la saison : SAISON dans src/classement.js, à changer en même temps.)
const SAISON = 2;
const cleArene = (arene) => (SAISON > 1 ? `classement:${arene}:saison${SAISON}` : `classement:${arene}`);
const note = ({ vagues, battus }) => vagues * 1000000 + battus;

// L'ordre exact du classement (comme dans le jeu) : vagues, puis monstres, puis le premier arrivé
const avant = (a, b) => b.vagues - a.vagues || b.battus - a.battus || a.date - b.date;

// ── Vérifier ce qui arrive ───────────────────────────────────
// On ne fait jamais confiance à ce qu'on reçoit : n'importe qui peut appeler cette
// adresse, avec n'importe quoi dedans.
function nettoyerPseudo(texte) {
  return String(texte)
    .replace(/[\u0000-\u001f\u007f]/g, '') // les caractères invisibles
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONGUEUR_PSEUDO);
}

function lireScore(corps) {
  const { arene, vagues, battus, partie } = corps || {};
  const pseudo = nettoyerPseudo(corps?.pseudo ?? '');
  if (!ARENES.includes(arene)) return { erreur: 'Arène inconnue.' };
  if (!pseudo) return { erreur: `Le pseudo doit faire de 1 à ${LONGUEUR_PSEUDO} caractères.` };
  if (!Number.isInteger(vagues) || vagues < 0 || vagues > MAX_VAGUES) return { erreur: 'Ce nombre de vagues est impossible.' };
  if (!Number.isInteger(battus) || battus < 0 || battus > MAX_BATTUS) return { erreur: 'Ce nombre de monstres est impossible.' };
  const score = { arene, pseudo, vagues, battus, date: Date.now() };
  if (typeof partie === 'string' && /^[a-z0-9]{8,24}$/.test(partie)) score.partie = partie; // (sinon, on l'ignore)
  return { score };
}

// Combien d'envois récents depuis cet ordinateur ? On ne garde pas son adresse
// Internet : seulement une empreinte (un « hachage », impossible à retourner),
// et pendant une minute seulement.
async function tropDEnvois(req) {
  const adresse = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const empreinte = createHash('sha256').update(`petits-gardiens:${adresse}`).digest('hex').slice(0, 24);
  const [envois] = await redis(['INCR', `limite:${empreinte}`], ['EXPIRE', `limite:${empreinte}`, 60]);
  return envois > ENVOIS_PAR_MINUTE;
}

// ── Les deux questions qu'on peut poser au serveur ───────────
async function lire(req, res) {
  const arene = String(req.query.arene || '');
  if (!ARENES.includes(arene)) return repondre(res, 400, { erreur: 'Arène inconnue.' });
  const combien = Math.max(1, Math.min(50, Number(req.query.combien) || 10));
  // un peu plus que demandé : à égalité de note, c'est la date qui départage (voir « avant »)
  const [valeurs, total] = await redis(['ZRANGE', cleArene(arene), 0, combien + 9, 'REV'], ['ZCARD', cleArene(arene)]);
  const scores = valeurs.map((v) => JSON.parse(v)).sort(avant).slice(0, combien)
    .map(({ pseudo, vagues, battus, date, partie }) => ({ pseudo, vagues, battus, date, ...(partie ? { partie } : {}) }));
  return repondre(res, 200, { scores, total });
}

async function ranger(req, res) {
  // Vercel lit le corps de la requête tout seul, et lève une erreur si le JSON est
  // cassé : on la rattrape, pour répondre « illisible » plutôt que « panne »
  let corps;
  try {
    corps = req.body;
    if (typeof corps === 'string') corps = JSON.parse(corps || '{}');
  } catch {
    return repondre(res, 400, { erreur: 'Score illisible.' });
  }
  const { score, erreur } = lireScore(corps);
  if (erreur) return repondre(res, 400, { erreur });
  if (await tropDEnvois(req)) return repondre(res, 429, { erreur: 'Trop de scores envoyés : attends une minute.' });
  const cle = cleArene(score.arene);
  // la valeur rangée = le score lui-même, avec un peu de hasard pour que deux scores
  // identiques restent deux scores différents
  const valeur = JSON.stringify({ ...score, hasard: Math.random().toString(36).slice(2, 8) });
  const [, place, total] = await redis(
    ['ZADD', cle, note(score), valeur],
    ['ZCOUNT', cle, note(score), '+inf'], // les scores aussi bons ou meilleurs : sa place (à égalité, les plus anciens restent devant)
    ['ZCARD', cle],
    ['ZREMRANGEBYRANK', cle, 0, -(GARDES + 1)], // on ne garde que les meilleurs
  );
  const { pseudo, vagues, battus, date } = score;
  return repondre(res, 200, { place, total, score: { pseudo, vagues, battus, date } });
}

function repondre(res, statut, donnees) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store'); // un classement change tout le temps
  return res.status(statut).send(JSON.stringify(donnees));
}

// ── L'entrée de la fonction ──────────────────────────────────
export default async function handler(req, res) {
  // le jeu est sur un autre site (github.io) : le navigateur demande d'abord la permission
  // (une requête « OPTIONS »), et on la donne seulement aux sites de la liste ORIGINES
  const origine = req.headers.origin;
  if (ORIGINES.includes(origine)) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  // la page d'un autre site : refusée tout de suite. (Sans navigateur, avec curl par exemple,
  // il n'y a pas d'« Origin » : on répond, et la vérification des scores fait le reste.)
  if (origine && !ORIGINES.includes(origine)) return repondre(res, 403, { erreur: 'Ce site n’a pas accès au classement.' });
  if (!BASE || !CLE) return repondre(res, 503, { erreur: 'La base du classement n’est pas encore branchée.' });
  try {
    if (req.method === 'GET') return await lire(req, res);
    if (req.method === 'POST') return await ranger(req, res);
    return repondre(res, 405, { erreur: 'GET ou POST seulement.' });
  } catch (e) {
    console.error(e); // visible dans les journaux du projet, sur vercel.com
    return repondre(res, 500, { erreur: 'Le classement ne répond pas : réessaie un peu plus tard.' });
  }
}
