// ─────────────────────────────────────────────────────────────
// LES PARTIES ENREGISTRÉES (une deuxième « fonction » Vercel, à côté du classement)
// Le jeu envoie ici l'enregistrement de chaque partie terminée : les
// décisions du joueur, chacune avec son moment (voir src/jeu/enregistrement.js).
// Une partie se rejoue ensuite à l'identique : sur la page « Revoir la
// partie », et dans la commande npm run parties (pour régler le jeu).
// - POST /api/parties avec l'enregistrement → le range, et répond son identifiant ;
// - GET  /api/parties?id=… → une partie ;
// - GET  /api/parties?combien=50 (&niveau=arene-pixel) → les dernières parties, en bref.
// Les parties « pour essai » (jouées pendant le développement) sont rangées à part :
// GET /api/parties?essai=1 les liste.
// Même base Upstash Redis que le classement (voir scores.js).
// ─────────────────────────────────────────────────────────────
import { createHash, randomBytes } from 'node:crypto';

const ORIGINES = ['https://patapain18.github.io', 'http://localhost:5180', 'http://localhost:4173'];
const LONGUEUR_PSEUDO = 16;
const TAILLE_MAX = 500_000;           // une partie de 30 minutes fait quelques dizaines de Ko
const ACTIONS_MAX = 40_000;
const CONTROLES_MAX = 2_000;
const GARDEES = 1000;                 // la liste des dernières parties : les 1 000 plus récentes
const DUREE_DE_VIE = 60 * 60 * 24 * 365; // chaque partie est effacée au bout d'un an
const ENVOIS_PAR_MINUTE = 8;
const ID_VALIDE = /^[a-z0-9]{8,24}$/;
const NIVEAU_VALIDE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const VERSION_VALIDE = /^[a-z0-9]{3,40}$/;
const STATUTS = ['perdu', 'gagne', 'abandon'];
const NAVIGATEURS = ['safari', 'chrome', 'firefox', 'edge', 'autre'];

// Les décisions qu'on peut trouver dans une partie, et ce qui les accompagne :
// 'n' = un nombre, 'e' = un nombre entier (positif), 't' = un petit texte
const ACTIONS = {
  construire: ['e', 't'], ameliorer: ['e'], vendre: ['e'], lancerVague: [],
  lancerMeteore: ['n', 'n'], lancerGrandFroid: [], envoyerHeros: ['n', 'n'], choisirBenediction: ['t'],
};

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

// Les clés de la base : chaque partie à part, et des listes de résumés (les plus récentes d'abord)
const clePartie = (id) => `partie:${id}`;
const cleListe = (essai, niveau = null) => `${essai ? 'parties-essai' : 'parties'}${niveau ? `:${niveau}` : ''}`;

// ── Vérifier ce qui arrive ───────────────────────────────────
// On ne fait jamais confiance à ce qu'on reçoit : n'importe qui peut appeler cette adresse.
function nettoyerPseudo(texte) {
  return String(texte)
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, LONGUEUR_PSEUDO);
}
const entier = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max;

function actionValide(action, pasAvant) {
  if (!Array.isArray(action) || !entier(action[0], 1e8) || action[0] < pasAvant) return false;
  const attendu = ACTIONS[action[1]];
  if (!attendu || action.length !== attendu.length + 2) return false;
  return attendu.every((sorte, k) => {
    const v = action[k + 2];
    if (sorte === 'e') return entier(v, 1000);
    if (sorte === 'n') return typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1000;
    return typeof v === 'string' && /^[a-z0-9-]{1,30}$/i.test(v);
  });
}

function lirePartie(corps) {
  if (!corps || typeof corps !== 'object') return { erreur: 'Partie illisible.' };
  const { format, version, niveau, graine, debut, fin, statut, vagues, battus, navigateur, actions, controles } = corps;
  if (format !== 1) return { erreur: 'Format inconnu.' };
  if (typeof version !== 'string' || !VERSION_VALIDE.test(version)) return { erreur: 'Version illisible.' };
  if (typeof niveau !== 'string' || !NIVEAU_VALIDE.test(niveau)) return { erreur: 'Niveau illisible.' };
  if (!entier(graine, 2 ** 32) || !entier(debut, 1e14) || !entier(fin, 1e8)) return { erreur: 'Partie illisible.' };
  if (!STATUTS.includes(statut)) return { erreur: 'Fin de partie inconnue.' };
  if (!entier(vagues, 1000) || !entier(battus, 1e7)) return { erreur: 'Score impossible.' };
  if (!Array.isArray(actions) || actions.length > ACTIONS_MAX) return { erreur: 'Décisions illisibles.' };
  let pas = 0;
  for (const action of actions) {
    if (!actionValide(action, pas)) return { erreur: 'Une décision est illisible.' };
    pas = action[0];
  }
  if (!Array.isArray(controles) || controles.length > CONTROLES_MAX) return { erreur: 'Contrôles illisibles.' };
  if (!controles.every((c) => Array.isArray(c) && c.length === 4 && c.every((v) => entier(v, 1e9)))) return { erreur: 'Contrôles illisibles.' };
  const partie = {
    format, version, niveau, graine, debut, fin, statut, vagues, battus,
    pseudo: nettoyerPseudo(corps.pseudo ?? ''),
    navigateur: NAVIGATEURS.includes(navigateur) ? navigateur : 'autre',
    essai: corps.essai === true,
    date: Date.now(),
    actions, controles,
  };
  return { partie };
}

// Combien d'envois récents depuis cet ordinateur ? (comme pour le classement : une empreinte
// de son adresse Internet, impossible à retourner, gardée une minute seulement)
async function tropDEnvois(req) {
  const adresse = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const empreinte = createHash('sha256').update(`petits-gardiens-parties:${adresse}`).digest('hex').slice(0, 24);
  const [envois] = await redis(['INCR', `limite-parties:${empreinte}`], ['EXPIRE', `limite-parties:${empreinte}`, 60]);
  return envois > ENVOIS_PAR_MINUTE;
}

// Le résumé d'une partie, pour les listes (sans ses décisions)
const resumer = (id, p) => ({
  id, niveau: p.niveau, version: p.version, pseudo: p.pseudo, statut: p.statut, vagues: p.vagues,
  battus: p.battus, pas: p.fin, actions: p.actions.length, navigateur: p.navigateur, debut: p.debut, date: p.date,
});

// ── Les questions qu'on peut poser au serveur ────────────────
async function lire(req, res) {
  const id = String(req.query.id || '');
  if (id) {
    if (!ID_VALIDE.test(id)) return repondre(res, 400, { erreur: 'Identifiant illisible.' });
    const [valeur] = await redis(['GET', clePartie(id)]);
    if (!valeur) return repondre(res, 404, { erreur: 'Cette partie n’existe pas (ou plus).' });
    return repondre(res, 200, { id, ...JSON.parse(valeur) });
  }
  const niveau = String(req.query.niveau || '');
  if (niveau && !NIVEAU_VALIDE.test(niveau)) return repondre(res, 400, { erreur: 'Niveau illisible.' });
  const combien = Math.max(1, Math.min(GARDEES, Number(req.query.combien) || 50));
  const [valeurs] = await redis(['LRANGE', cleListe(req.query.essai === '1', niveau || null), 0, combien - 1]);
  return repondre(res, 200, { parties: valeurs.map((v) => JSON.parse(v)) });
}

async function ranger(req, res) {
  let corps;
  try {
    corps = req.body;
    if (typeof corps === 'string') corps = JSON.parse(corps || '{}');
  } catch {
    return repondre(res, 400, { erreur: 'Partie illisible.' });
  }
  if (JSON.stringify(corps ?? null).length > TAILLE_MAX) return repondre(res, 413, { erreur: 'Partie trop longue.' });
  const { partie, erreur } = lirePartie(corps);
  if (erreur) return repondre(res, 400, { erreur });
  if (await tropDEnvois(req)) return repondre(res, 429, { erreur: 'Trop de parties envoyées : attends une minute.' });
  // l'identifiant : l'heure (en base 36), puis un peu de hasard
  const id = Date.now().toString(36) + randomBytes(4).toString('hex');
  const resume = JSON.stringify(resumer(id, partie));
  const toutes = cleListe(partie.essai), duNiveau = cleListe(partie.essai, partie.niveau);
  await redis(
    ['SET', clePartie(id), JSON.stringify(partie), 'EX', DUREE_DE_VIE],
    ['LPUSH', toutes, resume], ['LTRIM', toutes, 0, GARDEES - 1],
    ['LPUSH', duNiveau, resume], ['LTRIM', duNiveau, 0, GARDEES - 1],
  );
  return repondre(res, 200, { id });
}

function repondre(res, statut, donnees) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(statut).send(JSON.stringify(donnees));
}

// ── L'entrée de la fonction ──────────────────────────────────
export default async function handler(req, res) {
  const origine = req.headers.origin;
  if (ORIGINES.includes(origine)) {
    res.setHeader('Access-Control-Allow-Origin', origine);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  res.setHeader('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (origine && !ORIGINES.includes(origine)) return repondre(res, 403, { erreur: 'Ce site n’a pas accès aux parties.' });
  if (!BASE || !CLE) return repondre(res, 503, { erreur: 'La base n’est pas encore branchée.' });
  try {
    if (req.method === 'GET') return await lire(req, res);
    if (req.method === 'POST') return await ranger(req, res);
    return repondre(res, 405, { erreur: 'GET ou POST seulement.' });
  } catch (e) {
    console.error(e);
    return repondre(res, 500, { erreur: 'Le serveur ne répond pas : réessaie un peu plus tard.' });
  }
}
