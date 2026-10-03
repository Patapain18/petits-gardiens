// ─────────────────────────────────────────────────────────────
// LE COMPTEUR DE VISITES (une troisième « fonction » Vercel, à côté du classement et des parties)
// Chaque page du jeu prévient ce serveur qu'on vient de l'ouvrir, et le jeu le prévient
// quand un joueur lance la première vague d'une partie (voir src/compteur.js) :
// - POST /api/visites avec { page, niveau?, source? } → compte une visite de la page ;
// - POST /api/visites avec { evenement: 'partie', niveau } → compte une partie lancée ;
// - GET  /api/visites?jours=30 → les chiffres des 30 derniers jours (pour visites.html).
//
// Pourquoi pas le compteur de Vercel (« Web Analytics ») ? Il ne compte que les pages que
// Vercel envoie lui-même aux visiteurs. Le jeu, lui, est envoyé par GitHub Pages : le
// navigateur refuse d'envoyer ses visites au compteur de Vercel, qui n'a pas notre site
// dans sa liste (sa liste à lui, comme ORIGINES plus bas). Ce serveur-ci l'a.
//
// On ne garde RIEN sur les visiteurs : seulement des compteurs, jour par jour (combien de
// visites de chaque page, combien de visiteurs de chaque pays…). Pour compter les visiteurs
// DIFFÉRENTS sans savoir qui ils sont, on se sert d'un « HyperLogLog » de Redis : une petite
// structure qui estime combien de choses différentes on lui a données, sans jamais pouvoir
// les rendre. On lui donne une empreinte du visiteur, calculée à partir de son adresse
// Internet, de son navigateur et de la date du jour : demain, la même personne aura une
// autre empreinte, impossible à relier à celle d'aujourd'hui.
// Même base Upstash Redis que le classement (voir scores.js).
// ─────────────────────────────────────────────────────────────
import { createHash } from 'node:crypto';

const ORIGINES = ['https://patapain18.github.io', 'http://localhost:5180', 'http://localhost:4173'];
// Le vrai site : lui seul ajoute des visites. Le jeu en développement peut lire les chiffres,
// mais ses visites (les miennes, pendant que je vérifie) ne comptent pas.
const SITE = 'https://patapain18.github.io';
const PAGES = ['accueil', 'jeu', 'revoir', 'personnages', 'sons', 'lumieres', 'textures', 'modeles', 'editeur'];
const NIVEAU_VALIDE = /^[a-z0-9][a-z0-9-]{0,39}$/;
// D'où vient le visiteur : le nom d'un site (« discord.com »), parfois suivi d'un dossier
// (« patapain18.github.io/kaorie » : un autre site rangé sur la même adresse que le jeu)
const SOURCE_VALIDE = /^[a-z0-9][a-z0-9.-]{0,59}(\/[a-z0-9._-]{1,40})?$/;
// Les robots des moteurs de recherche ouvrent les pages eux aussi : on ne les compte pas
const ROBOTS = /bot|crawl|spider|slurp|headless|lighthouse/i;
const ENVOIS_PAR_MINUTE = 30;
const DUREE_DE_VIE = 60 * 60 * 24 * 400; // les compteurs d'un jour sont effacés au bout de 400 jours (13 mois)
const JOURS_MAX = 400;

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

// ── Les jours ────────────────────────────────────────────────
// Le jour à l'heure de Paris (« 2026-10-02 ») : une visite à minuit et demi compte pour le
// nouveau jour, pas pour la veille (l'horloge du serveur, elle, est à l'heure de Londres).
const jourDeParis = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(date);

// Les n derniers jours, du plus ancien à aujourd'hui
function derniersJours(n) {
  const aujourdhui = Date.parse(`${jourDeParis()}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(aujourdhui - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

// Les clés de la base, pour chaque jour :
// - les compteurs du jour, tous dans un « hash » Redis (un petit tableau nom → nombre) :
//   « page:jeu », « pays:FR », « partie:arene-pixel », « visiteurs »… ;
// - les empreintes des visiteurs du jour, et celles des joueurs (deux HyperLogLog).
const cleCompteurs = (jour) => `visites:${jour}`;
const cleVisiteurs = (jour) => `visites:${jour}:visiteurs`;
const cleJoueurs = (jour) => `visites:${jour}:joueurs`;

// ── Le navigateur et le système du visiteur (lus dans la carte d'identité de son navigateur,
// le « User-Agent ») : juste la famille, sans plus de détails ──
function navigateurDe(ua) {
  if (/Edg(e|A|iOS)?\//.test(ua)) return 'edge';
  if (/Firefox\/|FxiOS\//.test(ua)) return 'firefox';
  if (/Chrome\/|CriOS\//.test(ua)) return 'chrome';
  if (/Safari\//.test(ua)) return 'safari';
  return 'autre';
}
function systemeDe(ua) {
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android'; // (avant Linux : Android s'annonce aussi « Linux »)
  if (/Windows/.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/.test(ua)) return 'mac';
  if (/CrOS/.test(ua)) return 'chromeos';
  if (/Linux/.test(ua)) return 'linux';
  return 'autre';
}

// ── Compter une visite (ou une partie lancée) ────────────────
async function compter(req, res) {
  let corps = req.body;
  try {
    if (typeof corps === 'string') corps = JSON.parse(corps || '{}');
  } catch {
    return repondre(res, 400, { erreur: 'Visite illisible.' });
  }
  if (!corps || typeof corps !== 'object') return repondre(res, 400, { erreur: 'Visite illisible.' });
  const partie = corps.evenement === 'partie';
  const page = partie ? 'jeu' : corps.page;
  if (!PAGES.includes(page)) return repondre(res, 400, { erreur: 'Page inconnue.' });
  const niveau = typeof corps.niveau === 'string' && NIVEAU_VALIDE.test(corps.niveau) ? corps.niveau : null;
  if (partie && !niveau) return repondre(res, 400, { erreur: 'Niveau illisible.' });
  const source = typeof corps.source === 'string' && SOURCE_VALIDE.test(corps.source) ? corps.source : null;
  const ua = String(req.headers['user-agent'] || '');
  if (ROBOTS.test(ua)) return res.status(204).end();

  // L'empreinte du visiteur (voir tout en haut). Elle ne quitte jamais cette fonction : la base
  // ne reçoit que le HyperLogLog, qui l'avale sans la garder.
  const jour = jourDeParis();
  const adresse = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  const empreinte = createHash('sha256').update(`petits-gardiens-visites:${jour}:${adresse}:${ua}`).digest('hex').slice(0, 32);

  // 1. Pas plus de 30 envois par minute du même visiteur ; et le HyperLogLog du jour répond 1
  //    si cette empreinte est nouvelle (un visiteur pas encore vu aujourd'hui), 0 sinon
  const cleLimite = `limite-visites:${empreinte}`;
  const leHyperLogLog = partie ? cleJoueurs(jour) : cleVisiteurs(jour);
  const [envois, , nouveau] = await redis(['INCR', cleLimite], ['EXPIRE', cleLimite, 60], ['PFADD', leHyperLogLog, empreinte]);
  if (envois > ENVOIS_PAR_MINUTE) return repondre(res, 429, { erreur: 'Trop de visites d’un coup.' });

  // 2. Les compteurs du jour. Le pays, le navigateur et le système ne comptent qu'une fois par
  //    visiteur et par jour (sinon, un joueur qui ouvre dix pages compterait dix Français).
  //    Le pays : Vercel le devine d'après l'adresse Internet, et nous le donne tout prêt.
  const compteurs = partie ? [`partie:${niveau}`] : [`page:${page}`];
  if (!partie && niveau) compteurs.push(`niveau:${niveau}`);
  if (!partie && source) compteurs.push(`source:${source}`);
  if (nouveau === 1 && partie) compteurs.push('joueurs');
  if (nouveau === 1 && !partie) {
    const pays = String(req.headers['x-vercel-ip-country'] || '');
    compteurs.push('visiteurs', `pays:${/^[A-Z]{2}$/.test(pays) ? pays : 'XX'}`, `navigateur:${navigateurDe(ua)}`, `systeme:${systemeDe(ua)}`);
  }
  await redis(
    ...compteurs.map((nom) => ['HINCRBY', cleCompteurs(jour), nom, 1]),
    ['EXPIRE', cleCompteurs(jour), DUREE_DE_VIE], ['EXPIRE', leHyperLogLog, DUREE_DE_VIE],
  );
  return res.status(204).end(); // 204 : « bien reçu », sans rien à répondre
}

// ── Lire les chiffres des derniers jours ─────────────────────
// Chaque compteur « sorte:nom » est rangé avec ceux de sa sorte : page:jeu → pages.jeu
const SORTES = { page: 'pages', niveau: 'niveaux', partie: 'parties', pays: 'pays', navigateur: 'navigateurs', systeme: 'systemes', source: 'sources' };

async function lire(req, res) {
  const n = Math.max(1, Math.min(JOURS_MAX, Math.floor(Number(req.query.jours)) || 30));
  const jours = derniersJours(n);
  const reponses = await redis(...jours.map((jour) => ['HGETALL', cleCompteurs(jour)]));
  const resultat = jours.map((jour, i) => {
    const d = { jour, visiteurs: 0, joueurs: 0, ...Object.fromEntries(Object.values(SORTES).map((s) => [s, {}])) };
    const liste = reponses[i] || []; // HGETALL répond « nom, nombre, nom, nombre… »
    for (let k = 0; k < liste.length; k += 2) {
      const nombre = Number(liste[k + 1]);
      const deuxPoints = liste[k].indexOf(':');
      if (deuxPoints < 0) {
        if (liste[k] === 'visiteurs' || liste[k] === 'joueurs') d[liste[k]] = nombre;
      } else {
        const sorte = SORTES[liste[k].slice(0, deuxPoints)];
        if (sorte) d[sorte][liste[k].slice(deuxPoints + 1)] = nombre;
      }
    }
    return d;
  });
  return repondre(res, 200, { jours: resultat });
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
  if (origine && !ORIGINES.includes(origine)) return repondre(res, 403, { erreur: 'Ce site n’a pas accès aux visites.' });
  if (!BASE || !CLE) return repondre(res, 503, { erreur: 'La base n’est pas encore branchée.' });
  try {
    if (req.method === 'GET') return await lire(req, res);
    if (req.method === 'POST') {
      if (origine !== SITE) return repondre(res, 403, { erreur: 'Seul le vrai site compte des visites.' });
      return await compter(req, res);
    }
    return repondre(res, 405, { erreur: 'GET ou POST seulement.' });
  } catch (e) {
    console.error(e);
    return repondre(res, 500, { erreur: 'Le serveur ne répond pas : réessaie un peu plus tard.' });
  }
}
