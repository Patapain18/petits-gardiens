// ─────────────────────────────────────────────────────────────
// L'ATELIER DU SON (la page son.html, un outil d'atelier)
// Les « oreilles » de l'atelier : chaque bruitage est calculé hors ligne
// (son/hors-ligne.js) dans les trois époques, puis mesuré comme l'oreille
// l'entend (son/mesures.js) : son volume ressenti comparé à la musique de
// l'époque, sa crête, sa dureté, sa forme d'onde et son spectrogramme.
// Chaque bruitage a un rôle (fréquent, interface, événement, important) qui
// dit à quel volume il doit sonner : le nuage montre d'un coup d'œil ceux
// qui sortent de leur bande.
// Les situations de jeu (son/situations.js) rejouent 30 secondes d'une
// vraie vague, jouée par le bon joueur imaginaire : la musique est-elle
// couverte ? Le compresseur travaille-t-il trop ? Combien de bruitages les
// limites empêchent-elles ?
// Les recettes, les réglages des époques et le mixage de la musique
// (son/sons.json) se règlent avec les curseurs ; l'atelier garde l'avant en
// pâle. « Enregistrer dans le jeu » réécrit sons.json (avec npm run dev).
//
// Dans la console : __atelierSon.choisir('grandFroid' | 'situation:foule' | 'musique'),
// __atelierSon.tourComplet(), __atelierSon.planche(), __atelierSon.avantApres(),
// __atelierSon.remplacer(reglages), __atelierSon.reglages, __atelierSon.resultats.
// ─────────────────────────────────────────────────────────────
import FICHIER from './son/sons.json' with { type: 'json' };
import { REGLAGES_SON, appliquerReglagesSon } from './son/reglages-son.js';
import { CHAMPS, OUTILS, FILTRES, ROLES, COUCHES_MAX, NOTES_MAX, problemesSons } from './son/format-sons.js';
import { rendreBruitage, rendreMusique, rendreSituation, PAS_REDUCTION } from './son/hors-ligne.js';
import { SITUATIONS, enregistrerSituation, DUREE_SITUATION } from './son/situations.js';
import { mesurerSon, volumeAuFilDuTemps, volumeRessenti, crete, spectrogramme, formeDOnde, finAudible } from './son/mesures.js';
import { ORCHESTRES } from './son/orchestres.js';
import { EPOQUES, COULEURS, creerToile, dessinerOnde, dessinerSpectrogramme, dessinerRampe, dessinerNuage, dessinerTemps, tempsSous, forme, NUAGE } from './atelier-son-dessins.js';
import { TEINTES } from './graphiques.js';
import { insecables } from './typographie.js';
import { compterVisite } from './compteur.js';

compterVisite('son'); // une visite de plus (voir compteur.js)

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const FICHES_PAR_ID = Object.fromEntries(Object.entries(FICHES).map(([chemin, f]) => [chemin.slice('./niveaux/'.length, -'.json'.length), f]));
const NOMS_EPOQUES = Object.keys(EPOQUES);
const MIXAGES_NOMS = { calme: 'Calme (entre les vagues)', vague: 'Pendant une vague', chef: 'Thème des chefs' };
const VUE_DEBUT = 0.2; // les bruitages commencent à 0,25 s : on les montre à partir de 0,2 s

const $ = (s) => document.querySelector(s);
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = insecables(texte); // (« ! » et « : » jamais seuls au début d'une ligne)
  return e;
}
const textes = (t) => document.createTextNode(insecables(t));
const nombre = (v, chiffres = 1) => (Number.isFinite(v) ? v.toLocaleString('fr-FR', { minimumFractionDigits: chiffres, maximumFractionDigits: chiffres }) : '—');
const signe = (v, chiffres = 0) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${nombre(Math.abs(v), chiffres)}`;
const pourcent = (v) => `${nombre(v * 100, 0)} %`;
const memes = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const attendre = () => new Promise((r) => setTimeout(r, 0));
const NOTES = ['Do', 'Do♯', 'Ré', 'Ré♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const nomNote = (n) => `${NOTES[n % 12]}${Math.floor(n / 12) - 1}`;
// Le volume comparé à la musique, en mots (« 7 LU sous la musique »)
const enMots = (rel) => (Math.abs(rel) < 0.5 ? 'aussi fort que la musique' : `${nombre(Math.abs(rel), 0)} LU ${rel < 0 ? 'sous' : 'au-dessus de'} la musique`);
const cibleEnMots = ([a, b]) => {
  const bout = (v) => (v < 0 ? `${-v} sous` : v > 0 ? `${v} au-dessus de` : 'au niveau de');
  return `entre ${bout(a)} et ${bout(b)} la musique (en LU)`;
};

// ═════════════════════════════════════════════════════════════
// LES RÉGLAGES : ceux du fichier (l'AVANT), et les tiens (l'APRÈS)
// L'après, ce sont les réglages du son eux-mêmes (REGLAGES_SON) : changés sur place par les curseurs.
// ═════════════════════════════════════════════════════════════
let AVANT = structuredClone(FICHIER);
const reglages = REGLAGES_SON;
const historique = []; // les réglages d'avant chaque changement (pour « Annuler »)
const modifie = () => !memes(reglages, AVANT);
const recetteModifiee = (nom) => !memes(reglages.bruitages[nom], AVANT.bruitages[nom]);
const epoqueModifiee = (epoque) => !memes(reglages.epoques[epoque], AVANT.epoques[epoque]);

// Les bruitages, rangés par famille (dans l'ordre du fichier)
const FAMILLES = [];
for (const [nom, r] of Object.entries(reglages.bruitages)) {
  let f = FAMILLES.find((x) => x.nom === r.famille);
  if (!f) FAMILLES.push((f = { nom: r.famille, sons: [] }));
  f.sons.push(nom);
}
const ORDRE = FAMILLES.flatMap((f) => f.sons);

// L'événement d'exemple des recettes qui dépendent du monstre, et l'événement du jeu qui joue
// chaque recette (pour l'écouter au milieu de la musique : il passe par les mêmes règles que le jeu)
const EXEMPLES = { mort: { quoi: 'gluant' }, 'mort:chef': { quoi: 'dragon' }, 'explosion:meteore': { quoi: 'meteore' } };
const EVENEMENTS = { 'mort:chef': 'mort', 'explosion:meteore': 'explosion' };

// ── Ce qu'on regarde (lu dans l'adresse, pour pouvoir y revenir) ──
const params = new URLSearchParams(location.search);
const choix = {
  vue: ['bruitage', 'situation', 'musique'].includes(params.get('vue')) ? params.get('vue') : 'bruitage',
  nom: ORDRE.includes(params.get('son')) ? params.get('son') : 'grandFroid',
  situation: SITUATIONS.some((s) => s.id === params.get('situation')) ? params.get('situation') : 'foule',
  epoque: 'pixel',     // l'époque réglée dans le panneau de la musique
  mixage: 'vague',     // le mixage réglé dans le panneau de la musique
  avant: true,         // montrer l'avant quand quelque chose a changé
  dansLaMusique: false, // écouter les bruitages au milieu de la musique
};
function retenirChoix() {
  const p = new URLSearchParams({ vue: choix.vue });
  if (choix.vue === 'bruitage') p.set('son', choix.nom);
  if (choix.vue === 'situation') p.set('situation', choix.situation);
  history.replaceState(null, '', `?${p}`);
}

// ═════════════════════════════════════════════════════════════
// LES CALCULS (gardés : la clé dit tout ce dont le son dépend)
// Un son de 3 secondes pèse 1 Mo : on ne garde les échantillons que des derniers calculés. Les
// mesures, elles, sont gardées toutes.
// ═════════════════════════════════════════════════════════════
const mesures = new Map(); // clé → promesse de { mesure, duree }
const sons = new Map();    // clé → promesse d'un son calculé (les derniers seulement)
function garderSon(cle, fabriquer, place = 24) {
  if (sons.has(cle)) { const p = sons.get(cle); sons.delete(cle); sons.set(cle, p); return p; }
  const p = fabriquer();
  sons.set(cle, p);
  while (sons.size > place) sons.delete(sons.keys().next().value);
  return p;
}
const versionDe = (avant) => (avant ? AVANT : reglages);

// Un bruitage dans une époque : { canaux, fe, debut } (si son : true) et sa mesure
const cleBruitage = (nom, epoque, avant) => JSON.stringify(['b', nom, epoque, versionDe(avant).bruitages[nom], versionDe(avant).epoques[epoque]]);
function calculerSon(nom, epoque, avant) {
  const cle = cleBruitage(nom, epoque, avant);
  return garderSon(cle, () => rendreBruitage(nom, epoque, { ev: EXEMPLES[nom] || {}, reglages: avant ? AVANT : null }));
}
function mesurer(nom, epoque, avant) {
  const cle = cleBruitage(nom, epoque, avant);
  if (!mesures.has(cle)) {
    mesures.set(cle, calculerSon(nom, epoque, avant).then((s) => {
      const vue = s.canaux.map((c) => c.subarray(Math.round(VUE_DEBUT * s.fe)));
      return { ...mesurerSon(vue, s.fe), longueur: vue[0].length / s.fe };
    }));
  }
  return mesures.get(cle);
}

// La musique d'une époque, avec un mixage : son volume ressenti (intégré, sur 16 secondes)
const cleMusique = (epoque, mixage, avant) => JSON.stringify(['m', epoque, mixage, versionDe(avant).epoques[epoque], versionDe(avant).mixages[mixage]]);
function calculerMusique(epoque, mixage, avant) {
  return garderSon(cleMusique(epoque, mixage, avant), () => rendreMusique(epoque, mixage, { secondes: 16, reglages: avant ? AVANT : null }), 30);
}
function volumeMusique(epoque, mixage, avant) {
  const cle = cleMusique(epoque, mixage, avant);
  if (!mesures.has(cle)) mesures.set(cle, calculerMusique(epoque, mixage, avant).then((s) => ({ integre: volumeRessenti(s.canaux, s.fe).integre, crete: crete(s.canaux) })));
  return mesures.get(cle);
}
// La référence : la musique de l'époque pendant une vague
const reference = (epoque, avant) => volumeMusique(epoque, 'vague', avant).then((m) => m.integre);

// Un bruitage, tout mesuré : pour chaque époque, sa mesure et son volume comparé à la musique
async function bilan(nom, avant) {
  const parEpoque = {};
  for (const e of NOMS_EPOQUES) {
    const [m, ref] = await Promise.all([mesurer(nom, e, avant), reference(e, avant)]);
    parEpoque[e] = { ...m, rel: m.volume - ref, reference: ref };
  }
  return parEpoque;
}

// ── Le jugement d'un bruitage ──
// Renvoie [{ niveau: 'attention' | 'trop', texte }] (vide : tout va bien)
const ECART_EPOQUES = 4; // au-delà de 4 LU d'écart entre deux époques, le même bruitage ne sonne plus pareil
function juger(nom, parEpoque) {
  const r = reglages.bruitages[nom];
  const [a, b] = ROLES[r.role].cible;
  const problemes = [];
  for (const e of NOMS_EPOQUES) {
    const m = parEpoque[e];
    if (m.rel < a) problemes.push({ niveau: m.rel < a - 3 ? 'trop' : 'attention', epoque: e, texte: `${EPOQUES[e].nom} : trop discret (${nombre(a - m.rel, 0)} LU sous sa bande)` });
    if (m.rel > b) problemes.push({ niveau: m.rel > b + 3 ? 'trop' : 'attention', epoque: e, texte: `${EPOQUES[e].nom} : trop fort (${nombre(m.rel - b, 0)} LU au-dessus de sa bande)` });
    if (m.crete > -1) problemes.push({ niveau: 'trop', epoque: e, texte: `${EPOQUES[e].nom} : il frôle la saturation (crête à ${nombre(m.crete, 1)} dB)` });
    if (r.role === 'frequent' && m.durete > 0.6) problemes.push({ niveau: 'attention', epoque: e, texte: `${EPOQUES[e].nom} : dur pour l’oreille (${pourcent(m.durete)} de son énergie entre 2 et 5 kHz), et il revient sans arrêt` });
  }
  const rels = NOMS_EPOQUES.map((e) => parEpoque[e].rel);
  const ecart = Math.max(...rels) - Math.min(...rels);
  if (ecart > ECART_EPOQUES) problemes.push({ niveau: 'attention', texte: `Pas le même volume d’une époque à l’autre (${nombre(ecart, 1)} LU d’écart)` });
  return problemes;
}
const niveauDe = (problemes) => (problemes.some((p) => p.niveau === 'trop') ? 'trop' : problemes.length ? 'attention' : 'bien');

// ── Une situation de jeu ──
const enregistrements = new Map();
function enregistrementDe(id) {
  if (!enregistrements.has(id)) enregistrements.set(id, enregistrerSituation(SITUATIONS.find((s) => s.id === id), FICHES_PAR_ID));
  return enregistrements.get(id);
}
const situationsCalculees = new Map(); // clé → promesse du résultat (sans les échantillons)
const cleSituation = (id, avant) => JSON.stringify(['s', id, versionDe(avant)]);
// Trois calculs : la musique seule, les bruitages seuls (sans compresseur : il agit pareil sur les deux,
// leur rapport ne change pas), et tout ensemble, comme dans le jeu (avec ce que fait le compresseur).
// Les réglages sont copiés au départ : si un curseur bouge entre deux calculs, les trois gardent les
// mêmes réglages (ceux de la clé).
function calculerSituation(id, avant, progres = () => {}) {
  const cle = cleSituation(id, avant);
  if (!situationsCalculees.has(cle)) {
    const s = SITUATIONS.find((x) => x.id === id);
    const r = structuredClone(versionDe(avant));
    situationsCalculees.set(cle, (async () => {
      const enr = enregistrementDe(id);
      progres('la musique seule');
      const musique = await garderSon(`${cle}|musique`, () => rendreSituation(enr, s.epoque, { effets: false, compresseur: false, reglages: r }), 24);
      progres('les bruitages seuls');
      const effets = await garderSon(`${cle}|effets`, () => rendreSituation(enr, s.epoque, { musique: false, compresseur: false, reglages: r }), 24);
      progres('tout ensemble, comme dans le jeu');
      const mix = await garderSon(`${cle}|mix`, () => rendreSituation(enr, s.epoque, { lireReduction: true, reglages: r }), 24);
      return {
        musique: { lufs: volumeAuFilDuTemps(musique.canaux), integre: volumeRessenti(musique.canaux).integre },
        effets: { lufs: volumeAuFilDuTemps(effets.canaux), integre: volumeRessenti(effets.canaux).integre },
        mix: { lufs: volumeAuFilDuTemps(mix.canaux), integre: volumeRessenti(mix.canaux).integre, crete: crete(mix.canaux), reduction: mix.reduction, departs: mix.departs, joues: mix.joues, refuses: mix.refuses },
      };
    })());
  }
  return situationsCalculees.get(cle);
}
// Les grands chiffres d'une situation, et son jugement
function resumer(c) {
  const n = Math.min(c.musique.lufs.length, c.effets.lufs.length);
  let devant = 0, couverte = 0;
  for (let i = 0; i < n; i++) {
    const m = c.musique.lufs[i], e = c.effets.lufs[i];
    if (!(e > -70)) continue;
    if (!(m > -70) || e > m) devant++;
    if (m > -70 && e - m > 10) couverte++;
  }
  const red = c.mix.reduction.length ? c.mix.reduction : [0];
  const joues = Object.values(c.mix.joues).reduce((s, v) => s + v, 0), empeches = Object.values(c.mix.refuses).reduce((s, v) => s + v, 0);
  return {
    musique: c.musique.integre, effets: c.effets.integre, mix: c.mix.integre, crete: c.mix.crete,
    devant: devant / n, couverte: couverte / n,
    reductionMax: Math.min(...red), plus3: red.filter((v) => v < -3).length / red.length, plus6: red.filter((v) => v < -6).length / red.length,
    joues, empeches,
  };
}
function jugerSituation(r) {
  const p = [];
  if (r.couverte > 0.1) p.push({ niveau: 'trop', texte: `La musique est couverte ${pourcent(r.couverte)} du temps (les bruitages plus de 10 LU au-dessus d’elle).` });
  else if (r.couverte > 0.03) p.push({ niveau: 'attention', texte: `La musique est couverte ${pourcent(r.couverte)} du temps.` });
  if (r.plus6 > 0.05) p.push({ niveau: 'trop', texte: `Le compresseur baisse le son de plus de 6 dB ${pourcent(r.plus6)} du temps : on l’entend « pomper ».` });
  else if (r.plus3 > 0.1) p.push({ niveau: 'attention', texte: `Le compresseur baisse le son de plus de 3 dB ${pourcent(r.plus3)} du temps.` });
  if (r.crete > -0.3) p.push({ niveau: 'trop', texte: `Ça sature : la crête monte à ${nombre(r.crete, 1)} dB.` });
  else if (r.crete > -1) p.push({ niveau: 'attention', texte: `La crête frôle la saturation (${nombre(r.crete, 1)} dB).` });
  return p;
}

// ═════════════════════════════════════════════════════════════
// ÉCOUTER (les sons calculés, tels quels : ce qu'on entend est exactement ce qui est mesuré)
// ═════════════════════════════════════════════════════════════
let audio = null, lecture = null;
function ecouter(son) {
  arreter();
  audio ??= new AudioContext({ sampleRate: son.fe });
  if (audio.state === 'suspended') audio.resume();
  const tampon = audio.createBuffer(2, son.canaux[0].length, son.fe);
  son.canaux.forEach((c, k) => tampon.copyToChannel(c, k));
  const source = audio.createBufferSource();
  source.buffer = tampon;
  source.connect(audio.destination);
  source.start();
  lecture = source;
  source.onended = () => { if (lecture === source) lecture = null; };
}
function arreter() {
  if (lecture) { try { lecture.stop(); } catch { /* déjà fini */ } lecture = null; }
}
// Un bruitage au milieu de la musique de son époque (une vague), par les mêmes règles que le jeu
async function sonDansLaMusique(nom, epoque, avant) {
  const enr = { duree: 4, evenements: [{ t: 1.2, nom: EVENEMENTS[nom] || nom, ev: EXEMPLES[nom] || {}, pan: 0 }], mixages: [{ t: 0, mixage: 'vague' }], bourdon: [] };
  return rendreSituation(enr, epoque, { reglages: avant ? AVANT : null });
}
function boutonEcouter(texte, fabriquer, classe = '') {
  const b = element('button', `ecouter ${classe}`.trim(), texte);
  b.type = 'button';
  b.addEventListener('click', async () => {
    b.disabled = true;
    try { ecouter(await fabriquer()); } finally { b.disabled = false; }
  });
  return b;
}

// ═════════════════════════════════════════════════════════════
// LA BANDE DES SONS
// ═════════════════════════════════════════════════════════════
const etats = {}; // nom → 'bien' | 'attention' | 'trop' (d'après le dernier calcul)
function construireBande() {
  const bande = $('#bande');
  bande.replaceChildren();
  const groupe = (titre, boutons) => {
    const f = element('div', 'famille');
    f.append(element('span', 'nom-famille', titre));
    const v = element('div', 'vignettes');
    v.append(...boutons);
    f.append(v);
    bande.append(f);
  };
  const carte = (texte, data, action) => {
    const b = element('button', 'carte-son');
    b.type = 'button';
    Object.assign(b.dataset, data);
    b.append(element('span', 'pastille'), element('span', 'nom', texte));
    b.addEventListener('click', action);
    return b;
  };
  for (const f of FAMILLES) {
    groupe(f.nom, f.sons.map((nom) => carte(reglages.bruitages[nom].nom, { son: nom }, () => choisir(nom))));
  }
  groupe('La musique', [carte('Les trois orchestres', { musique: '1' }, () => choisir('musique'))]);
  groupe('Des situations de jeu', SITUATIONS.map((s) => carte(s.nom, { situation: s.id }, () => choisir(`situation:${s.id}`))));
  majBande();
}
function majBande() {
  for (const b of document.querySelectorAll('.carte-son')) {
    const { son, situation, musique } = b.dataset;
    const choisie = (son && choix.vue === 'bruitage' && choix.nom === son) || (situation && choix.vue === 'situation' && choix.situation === situation) || (musique && choix.vue === 'musique');
    b.setAttribute('aria-pressed', String(Boolean(choisie)));
    const etat = son ? etats[son] : situation ? etats[`situation:${situation}`] : null;
    b.querySelector('.pastille').className = `pastille ${etat || ''}`;
    b.classList.toggle('modifiee', Boolean((son && recetteModifiee(son)) || (musique && NOMS_EPOQUES.some(epoqueModifiee))));
  }
}

// ═════════════════════════════════════════════════════════════
// CE QU'ON REGARDE
// ═════════════════════════════════════════════════════════════
function construireChoix() {
  const form = $('#choix');
  form.replaceChildren();
  const avant = element('button', 'bouton-avant', 'Montrer l’avant');
  avant.type = 'button';
  avant.setAttribute('aria-pressed', String(choix.avant));
  avant.title = 'Quand tu as changé quelque chose : l’avant, en pâle, derrière l’après';
  avant.addEventListener('click', () => { choix.avant = !choix.avant; avant.setAttribute('aria-pressed', String(choix.avant)); afficher(); });
  const musique = element('label', 'choix-case');
  const caseMusique = element('input');
  caseMusique.type = 'checkbox';
  caseMusique.checked = choix.dansLaMusique;
  caseMusique.addEventListener('change', () => { choix.dansLaMusique = caseMusique.checked; });
  musique.append(caseMusique, textes('Écouter les bruitages au milieu de la musique'));
  const stop = element('button', 'bouton-avant', '■ Arrêter le son');
  stop.type = 'button';
  stop.addEventListener('click', arreter);
  form.append(avant, musique, stop);
}

function choisir(quoi) {
  if (quoi === 'musique') choix.vue = 'musique';
  else if (String(quoi).startsWith('situation:')) { choix.vue = 'situation'; choix.situation = quoi.slice('situation:'.length); }
  else if (ORDRE.includes(quoi)) { choix.vue = 'bruitage'; choix.nom = quoi; }
  else throw new Error(`Inconnu : ${quoi} (un bruitage, « musique » ou « situation:${SITUATIONS[0].id} »)`);
  retenirChoix();
  majBande();
  dessinerReglages();
  afficher();
}

// ═════════════════════════════════════════════════════════════
// LES VUES
// ═════════════════════════════════════════════════════════════
let generation = 0;      // chaque nouvel affichage annule les calculs de l'ancien
let calculEnCours = null; // la promesse de l'affichage en cours (pour attendre qu'il soit fini)
const toiles = {};       // les toiles dessinées (pour les planches)
function afficher() {
  const ma = ++generation;
  $('#vue').replaceChildren();
  $('#fig-nuage').hidden = choix.vue === 'situation';
  const vue = choix.vue === 'bruitage' ? afficherBruitage : choix.vue === 'musique' ? afficherMusique : afficherSituation;
  calculEnCours = (async () => {
    try {
      await vue(ma);
      if (choix.vue !== 'situation') await majNuage(ma);
    } catch (e) {
      if (ma === generation) dire(`Le calcul a échoué : ${e.message}`, true);
      console.error(e);
    }
  })();
  return calculEnCours;
}
const encore = (ma) => ma === generation;
function etatCalcul(texte) { $('#etat-calcul').textContent = texte; $('#cote-vue').classList.toggle('calcul', Boolean(texte)); }

// ── Un bruitage dans les trois époques ──
async function afficherBruitage(ma) {
  const nom = choix.nom, r = reglages.bruitages[nom], role = ROLES[r.role];
  $('#titre-vue').textContent = insecables(r.nom);
  $('#info-vue').textContent = insecables(`${r.famille} · ${role.nom.toLowerCase()} : ${role.aide} Sa bande : ${cibleEnMots(role.cible)}. ${r.description}`);
  const grille = element('div', 'epoques');
  const cartes = {};
  for (const e of NOMS_EPOQUES) {
    const carte = element('figure', 'carte-epoque');
    const titre = element('figcaption');
    const cle = element('span', `cle ${EPOQUES[e].forme}`);
    cle.style.setProperty('--couleur', EPOQUES[e].couleur);
    titre.append(cle, document.createTextNode(` ${EPOQUES[e].nom} `), element('small', '', ORCHESTRES[e].nom));
    const onde = element('div', 'toile onde');
    onde.append(element('canvas'));
    const spectro = element('div', 'toile spectro');
    spectro.append(element('canvas'));
    const valeurs = element('dl', 'valeurs');
    const ecoute = element('div', 'ecoute');
    carte.append(titre, onde, spectro, valeurs, ecoute);
    grille.append(carte);
    cartes[e] = { carte, onde, spectro, valeurs, ecoute };
  }
  const legende = element('p', 'legende-spectro');
  const rampe = element('canvas');
  rampe.width = 120;
  rampe.height = 10;
  dessinerRampe(rampe.getContext('2d'), 120, 10);
  legende.append(textes('En haut : la forme de l’onde (la force du son au fil du temps ; l’avant en gris derrière). En bas : le spectrogramme, les graves en bas, les aigus en haut, la force en couleur : rien '), rampe, textes(' très fort.'));
  const problemes = element('ul', 'problemes');
  $('#vue').append(grille, legende, problemes);

  etatCalcul('Calcul des trois époques…');
  const avantAussi = choix.avant && NOMS_EPOQUES.some((e) => cleBruitage(nom, e, true) !== cleBruitage(nom, e, false));
  const [apres, avant] = await Promise.all([bilan(nom, false), avantAussi ? bilan(nom, true) : null]);
  const sonsApres = await Promise.all(NOMS_EPOQUES.map((e) => calculerSon(nom, e, false)));
  const sonsAvant = avantAussi ? await Promise.all(NOMS_EPOQUES.map((e) => calculerSon(nom, e, true))) : [];
  if (!encore(ma)) return;
  etatCalcul('');
  // on montre le son de 0,2 s jusqu'à sa fin (quand il est 40 dB sous sa crête : la queue de l'écho, plus
  // bas, ne se verrait pas), à la même échelle de temps dans les trois époques
  const vue = (s) => {
    const depuis = s.canaux.map((c) => c.subarray(Math.round(VUE_DEBUT * s.fe)));
    const fin = Math.ceil((finAudible(depuis, s.fe, 40) + 0.05) * s.fe);
    return depuis.map((c) => c.subarray(0, Math.max(Math.round(0.1 * s.fe), Math.min(c.length, fin))));
  };
  const duree = Math.max(...[...sonsApres, ...sonsAvant].map((s) => vue(s)[0].length / s.fe));
  // la même échelle de force pour les trois époques : agrandie si le son est faible (sinon, un son
  // discret ne serait qu'un trait plat)
  const pic = Math.max(...[...sonsApres, ...sonsAvant].map((s) => 10 ** (crete(vue(s)) / 20)));
  const zoom = Math.max(1, Math.min(50, Math.floor(0.9 / pic)));
  toiles.bruitage = {};
  NOMS_EPOQUES.forEach((e, k) => {
    const c = cartes[e], m = apres[e], ma2 = avant?.[e];
    const canauxApres = vue(sonsApres[k]), canauxAvant = avantAussi ? vue(sonsAvant[k]) : null;
    const ondeApres = formeDOnde(canauxApres, 360), ondeAvant = canauxAvant ? formeDOnde(canauxAvant, 360) : null;
    const spectroApres = spectrogramme(canauxApres), spectroAvant = canauxAvant ? spectrogramme(canauxAvant) : null;
    toiles.bruitage[e] = { ondeApres, ondeAvant, spectroApres, spectroAvant, duree, dureeApres: canauxApres[0].length / 48000, dureeAvant: canauxAvant ? canauxAvant[0].length / 48000 : 0, mesure: m, mesureAvant: ma2 };
    toiles.bruitage[e].zoom = zoom;
    creerToile(c.onde, (ctx, l, h) => dessinerOnde(ctx, l, h, { onde: ondeApres, avant: ondeAvant, couleur: EPOQUES[e].couleur, duree, dureeOnde: toiles.bruitage[e].dureeApres, dureeAvant: toiles.bruitage[e].dureeAvant, zoom }));
    creerToile(c.spectro, (ctx, l, h) => dessinerSpectrogramme(ctx, l, h, spectroApres, { duree }));
    // les mesures
    const [a, b] = role.cible;
    const ligne = (titre, valeur, ancien, classe = '', aide = '') => {
      const dt = element('dt', '', titre);
      if (aide) dt.title = aide;
      const dd = element('dd', classe, valeur);
      if (ancien !== null && ancien !== undefined && ancien !== valeur) dd.append(element('small', 'avant', ` avant : ${ancien}`));
      c.valeurs.append(dt, dd);
    };
    const classeVolume = m.rel < a - 3 || m.rel > b + 3 ? 'trop' : m.rel < a || m.rel > b ? 'attention' : 'bien';
    ligne('Volume', `${nombre(m.volume, 1)} LUFS`, ma2 ? `${nombre(ma2.volume, 1)}` : null, '', 'Le volume ressenti, au moment le plus fort (sur 0,4 seconde)');
    ligne('Comparé à la musique', enMots(m.rel), ma2 ? enMots(ma2.rel) : null, `volume-${classeVolume}`, `La musique de cette époque, pendant une vague, au volume des options par défaut (${nombre(m.reference, 1)} LUFS)`);
    ligne('Crête', `${nombre(m.crete, 1)} dB`, ma2 ? nombre(ma2.crete, 1) : null, m.crete > -1 ? 'volume-trop' : '', 'Le plus grand échantillon (0 dB : il sature)');
    ligne('Durée', `${nombre(m.duree, 2)} s`, ma2 ? nombre(ma2.duree, 2) : null, '', 'Tant qu’il dépasse 40 dB sous sa crête');
    ligne('Dureté', pourcent(m.durete), ma2 ? pourcent(ma2.durete) : null, r.role === 'frequent' && m.durete > 0.6 ? 'volume-attention' : '', 'La part de son énergie entre 2 et 5 kHz, là où l’oreille est la plus sensible (trop : il fatigue)');
    ligne('Brillance', `${nombre(m.brillance, 0)} Hz`, ma2 ? `${nombre(ma2.brillance, 0)} Hz` : null, '', 'Le « centre de gravité » de ses fréquences : plus c’est haut, plus il est brillant (ou sifflant)');
    c.ecoute.replaceChildren(
      boutonEcouter('▶ Écouter', () => (choix.dansLaMusique ? sonDansLaMusique(nom, e, false) : calculerSon(nom, e, false))),
      ...(avantAussi ? [boutonEcouter('▶ L’avant', () => (choix.dansLaMusique ? sonDansLaMusique(nom, e, true) : calculerSon(nom, e, true)), 'pale')] : []),
    );
  });
  const liste = juger(nom, apres);
  etats[nom] = niveauDe(liste);
  majBande();
  problemes.replaceChildren(...(liste.length
    ? liste.map((p) => element('li', `probleme-${p.niveau}`, p.texte))
    : [element('li', 'probleme-bien', 'Rien à signaler : il est dans sa bande dans les trois époques, sans saturer.')]));
}

// ── La musique des trois orchestres ──
async function afficherMusique(ma) {
  $('#titre-vue').textContent = 'Les trois orchestres';
  $('#info-vue').textContent = insecables('La musique de chaque époque, à chaque moment de la partie, mesurée comme le jeu la joue (le volume des options par défaut : 0,5 pour la musique). Les trois époques devraient sonner aussi fort : on change d’époque en changeant de monde, et un saut de volume s’entend. C’est aussi la référence des bruitages : « 7 LU sous la musique », c’est sous celle d’une vague.');
  const fig = element('figure', 'graphique');
  fig.append(element('h3', '', 'Le volume de la musique'), element('p', 'sous-titre', 'Le volume ressenti (intégré, sur 16 secondes), pour chaque époque. La bande : à 1 LU de leur moyenne.'));
  const t = element('div', 'toile');
  t.append(element('canvas'), Object.assign(element('div', 'bulle'), { hidden: true }));
  fig.append(t, legendeEpoques());
  const tableau = element('table', 'resultats ecoutes');
  $('#vue').append(fig, tableau);
  etatCalcul('Calcul des neuf musiques…');
  const lignes = [];
  for (const mixage of Object.keys(MIXAGES_NOMS)) {
    const valeurs = {}, avant = {};
    for (const e of NOMS_EPOQUES) {
      valeurs[e] = (await volumeMusique(e, mixage, false)).integre;
      if (choix.avant && cleMusique(e, mixage, true) !== cleMusique(e, mixage, false)) avant[e] = (await volumeMusique(e, mixage, true)).integre;
      if (!encore(ma)) return;
    }
    const moyenne = NOMS_EPOQUES.reduce((s, e) => s + valeurs[e], 0) / 3;
    lignes.push({ nom: mixage, texte: MIXAGES_NOMS[mixage], cible: [moyenne - 1, moyenne + 1], valeurs, avant: Object.keys(avant).length ? avant : null });
  }
  etatCalcul('');
  const spec = { lignes, min: -32, max: -12, pas: 2, zero: false, axe: 'LUFS (0 = le maximum)', format: (v) => `${v}` };
  toiles.musique = spec;
  t.querySelector('canvas').style.height = `${NUAGE.haut + NUAGE.bas + lignes.length * NUAGE.ligne + 8}px`;
  creerToile(t, (ctx, l, h, p) => dessinerNuage(ctx, l, h, spec, p), (x, y) => {
    const k = Math.floor((y - NUAGE.haut) / NUAGE.ligne);
    const li = lignes[k];
    if (!li) return null;
    return { titre: li.texte, lignes: NOMS_EPOQUES.map((e) => ({ couleur: EPOQUES[e].couleur, forme: EPOQUES[e].forme, valeur: `${nombre(li.valeurs[e], 1)} LUFS`, texte: EPOQUES[e].nom + (li.avant?.[e] !== undefined ? ` (avant : ${nombre(li.avant[e], 1)})` : '') })) };
  });
  // écouter chaque musique
  const tete = element('tr');
  tete.append(element('th', '', 'Écouter'), ...Object.values(MIXAGES_NOMS).map((n) => element('th', '', n)));
  tableau.replaceChildren(tete);
  for (const e of NOMS_EPOQUES) {
    const tr = element('tr');
    tr.append(element('td', '', `${EPOQUES[e].nom} (${ORCHESTRES[e].nom})`));
    for (const mixage of Object.keys(MIXAGES_NOMS)) {
      const td = element('td');
      td.append(boutonEcouter('▶', () => calculerMusique(e, mixage, false)));
      if (choix.avant && cleMusique(e, mixage, true) !== cleMusique(e, mixage, false)) td.append(boutonEcouter('▶ avant', () => calculerMusique(e, mixage, true), 'pale'));
      tr.append(td);
    }
    tableau.append(tr);
  }
}
function legendeEpoques() {
  const ul = element('ul', 'legende');
  for (const e of NOMS_EPOQUES) {
    const li = element('li');
    const cle = element('span', `cle ${EPOQUES[e].forme}`);
    cle.style.setProperty('--couleur', EPOQUES[e].couleur);
    li.append(cle, document.createTextNode(EPOQUES[e].nom));
    ul.append(li);
  }
  const li = element('li');
  const cle = element('span', 'cle barre');
  cle.style.setProperty('--couleur', 'rgba(255, 210, 122, 0.35)');
  li.append(cle, document.createTextNode('sa bande (d’après son rôle)'));
  ul.append(li);
  if (modifie()) {
    const li2 = element('li');
    const c2 = element('span', 'cle rond pale creux');
    c2.style.setProperty('--couleur', TEINTES.encreDouce);
    li2.append(c2, document.createTextNode('l’avant (creux)'));
    ul.append(li2);
  }
  return ul;
}

// ── Une situation de jeu ──
async function afficherSituation(ma) {
  const s = SITUATIONS.find((x) => x.id === choix.situation);
  $('#titre-vue').textContent = s.nom;
  etatCalcul('Le joueur imaginaire joue la vague…');
  await attendre();
  const enr = enregistrementDe(s.id);
  if (!encore(ma)) return;
  const fiche = FICHES_PAR_ID[s.niveau];
  $('#info-vue').textContent = insecables(`${s.aide} (${fiche.nom}, ${EPOQUES[s.epoque].nom.toLowerCase()} : de la ${nombre(enr.depart, 0)}e à la ${nombre(enr.depart + DUREE_SITUATION, 0)}e seconde, en comptant 4 secondes de préparation avant la vague.)`);
  const ecoutes = element('div', 'ecoute ecoute-situation');
  const resume = element('ul', 'problemes');
  const figures = {};
  const figure = (id, titre, sousTitre, hauteur) => {
    const fig = element('figure', 'graphique');
    fig.id = id;
    fig.append(element('h3', '', titre), element('p', 'sous-titre', sousTitre));
    const t = element('div', 'toile');
    const canvas = element('canvas');
    canvas.style.height = `${hauteur}px`;
    t.append(canvas, Object.assign(element('div', 'bulle'), { hidden: true }));
    const legende = element('ul', 'legende');
    fig.append(t, legende);
    figures[id] = { fig, toile: t, legende };
    return fig;
  };
  const details = element('table', 'resultats departs');
  $('#vue').append(ecoutes, resume,
    figure('fig-volume', 'Le volume ressenti, au fil du temps', 'La musique seule et les bruitages seuls (en LUFS, sur 0,4 seconde ; un trou : le silence). En rouge : les moments où les bruitages couvrent la musique (plus de 10 LU au-dessus d’elle).', 200),
    figure('fig-compresseur', 'Ce que fait le compresseur', 'De combien il baisse tout le son (en dB), pour qu’il ne sature pas. Au-delà de 3 dB, on commence à l’entendre : la musique baisse à chaque gros bruitage.', 130),
    figure('fig-departs', 'Les bruitages, seconde par seconde', 'Combien partent chaque seconde, et combien les limites empêchent (le même bruitage trop souvent à la fois).', 110),
    details);

  const progres = (quoi) => etatCalcul(`Calcul de la situation : ${quoi}…`);
  const apres = await calculerSituation(s.id, false, progres);
  const avantAussi = choix.avant && cleSituation(s.id, true) !== cleSituation(s.id, false);
  const avant = avantAussi ? await calculerSituation(s.id, true, (q) => progres(`l’avant, ${q}`)) : null;
  if (!encore(ma)) return;
  etatCalcul('');
  const r = resumer(apres), ra = avant ? resumer(avant) : null;
  etats[`situation:${s.id}`] = niveauDe(jugerSituation(r));
  majBande();
  toiles.situation = { s, enr, apres, avant, r, ra };

  // écouter (avec les réglages de ce qui est affiché, même si un curseur a bougé depuis)
  const cle = cleSituation(s.id, false), cleA = cleSituation(s.id, true);
  const reglagesAffiches = { apres: structuredClone(reglages), avant: structuredClone(AVANT) };
  const sonDe = (c, quoi, av) => {
    const r = av ? reglagesAffiches.avant : reglagesAffiches.apres;
    return garderSon(`${c}|${quoi}`, () => rendreSituation(enr, s.epoque, quoi === 'mix' ? { reglages: r } : quoi === 'musique' ? { effets: false, compresseur: false, reglages: r } : { musique: false, compresseur: false, reglages: r }), 24);
  };
  ecoutes.append(
    boutonEcouter('▶ Comme dans le jeu', () => sonDe(cle, 'mix', false)),
    ...(avantAussi ? [boutonEcouter('▶ L’avant', () => sonDe(cleA, 'mix', true), 'pale')] : []),
    boutonEcouter('▶ La musique seule', () => sonDe(cle, 'musique', false)),
    boutonEcouter('▶ Les bruitages seuls', () => sonDe(cle, 'effets', false)),
  );
  // le résumé (avec l'avant entre parenthèses, quand quelque chose a changé)
  const av = (texte) => (ra ? ` (avant : ${texte})` : '');
  const lignes = [
    { niveau: 'info', texte: `Musique : ${nombre(r.musique, 1)} LUFS${av(nombre(ra?.musique, 1))}. Bruitages : ${nombre(r.effets, 1)} LUFS${av(nombre(ra?.effets, 1))}. Les bruitages passent devant la musique ${pourcent(r.devant)} du temps${av(pourcent(ra?.devant))}.` },
    { niveau: 'info', texte: `Le compresseur baisse le son au plus de ${nombre(-r.reductionMax, 1)} dB${av(`${nombre(-ra?.reductionMax, 1)} dB`)}, de plus de 3 dB ${pourcent(r.plus3)} du temps. Crête : ${nombre(r.crete, 1)} dB${av(`${nombre(ra?.crete, 1)} dB`)}.` },
    { niveau: 'info', texte: `${r.joues} bruitages joués, ${r.empeches} empêchés par les limites${av(`${ra?.joues} et ${ra?.empeches}`)}.` },
    ...jugerSituation(r),
  ];
  if (!jugerSituation(r).length) lignes.push({ niveau: 'bien', texte: 'Rien à signaler : la musique n’est pas couverte, le compresseur reste discret, rien ne sature.' });
  resume.replaceChildren(...lignes.map((l) => element('li', `probleme-${l.niveau}`, l.texte)));

  // les graphiques
  const pasMesure = 0.1, decalage = 0.2; // une valeur tous les 0,1 s, sur 0,4 s : au milieu de sa fenêtre
  const sansSilence = (lufs) => lufs.map((v) => (v > -60 ? v : null)); // le silence : un trou dans la courbe
  // les repères : les changements de musique et les grands moments (ceux qui tombent ensemble n'en font qu'un)
  const reperes = [];
  const reperer = (t, texte) => {
    const proche = reperes.find((r) => Math.abs(r.t - t) < 0.6);
    if (proche) { if (!proche.texte.includes(texte)) proche.texte += ` · ${texte}`; } else reperes.push({ t, texte });
  };
  for (const e of enr.evenements) if (['chef', 'vague'].includes(e.nom) || (e.nom === 'mort' && ['colosse', 'dragon'].includes(e.ev.quoi))) reperer(e.t, e.nom === 'chef' ? 'un chef arrive' : e.nom === 'vague' ? 'vague lancée' : 'chef battu');
  for (const m of enr.mixages.filter((x) => x.t > 0)) reperer(m.t, m.mixage === 'chef' ? 'thème des chefs' : m.mixage === 'vague' ? 'la vague' : 'calme');
  const zones = [];
  apres.effets.lufs.forEach((e, i) => { const m = apres.musique.lufs[i]; if (m > -70 && e - m > 10) zones.push({ de: i * pasMesure + decalage - 0.05, a: i * pasMesure + decalage + 0.05, couleur: COULEURS.couverte }); });
  const specVolume = {
    duree: DUREE_SITUATION,
    y: { min: -60, max: -5, graduations: [-60, -50, -40, -30, -20, -10], format: (v) => `${v}` },
    zones, reperes,
    lignes: [
      ...(avant ? [{ couleur: COULEURS.musique, valeurs: sansSilence(avant.musique.lufs), pas: pasMesure, decalage, opacite: 0.35, tirets: true, epaisseur: 1.5 }, { couleur: COULEURS.effets, valeurs: sansSilence(avant.effets.lufs), pas: pasMesure, decalage, opacite: 0.35, tirets: true, epaisseur: 1.5 }] : []),
      { couleur: COULEURS.musique, valeurs: sansSilence(apres.musique.lufs), pas: pasMesure, decalage },
      { couleur: COULEURS.effets, valeurs: sansSilence(apres.effets.lufs), pas: pasMesure, decalage },
    ],
  };
  const specCompresseur = {
    duree: DUREE_SITUATION,
    y: { min: -12, max: 0, graduations: [-12, -9, -6, -3, 0], format: (v) => (v ? `−${-v} dB` : '0') },
    seuil: { valeur: -3, texte: 'on l’entend' },
    lignes: [
      ...(avant ? [{ couleur: COULEURS.compresseur, valeurs: avant.mix.reduction, pas: PAS_REDUCTION, decalage: PAS_REDUCTION, opacite: 0.35, tirets: true, epaisseur: 1.5 }] : []),
      { couleur: COULEURS.compresseur, valeurs: apres.mix.reduction, pas: PAS_REDUCTION, decalage: PAS_REDUCTION },
    ],
  };
  const parSeconde = (departs, joue) => { const v = new Array(DUREE_SITUATION).fill(0); for (const d of departs) if (d.joue === joue) v[Math.min(DUREE_SITUATION - 1, Math.floor(d.t))]++; return v; };
  const joues = parSeconde(apres.mix.departs, true), empeches = parSeconde(apres.mix.departs, false);
  const maxDeparts = Math.max(4, ...joues.map((v, i) => v + empeches[i]));
  const haut = Math.ceil(maxDeparts / 4) * 4;
  const specDeparts = {
    duree: DUREE_SITUATION,
    y: { min: 0, max: haut, graduations: [0, haut / 4, haut / 2, (3 * haut) / 4, haut], format: (v) => `${v}` },
    barres: { pas: 1, series: [{ couleur: COULEURS.effets, valeurs: joues }, { couleur: COULEURS.empeches, valeurs: empeches }] },
  };
  toiles.situation.specs = { 'fig-volume': specVolume, 'fig-compresseur': specCompresseur, 'fig-departs': specDeparts };
  const valeurA = (tab, t, pas, dec = 0) => tab[Math.max(0, Math.min(tab.length - 1, Math.round((t - dec) / pas)))];
  const mixageA = (t) => [...enr.mixages].reverse().find((m) => m.t <= t)?.mixage || 'calme';
  creerToile(figures['fig-volume'].toile, (ctx, l, h, p) => dessinerTemps(ctx, l, h, specVolume, p), (x, y, { largeur }) => {
    const t = tempsSous(x, largeur, DUREE_SITUATION);
    if (t === null) return null;
    const m = valeurA(apres.musique.lufs, t, pasMesure, decalage), e = valeurA(apres.effets.lufs, t, pasMesure, decalage);
    return { titre: `${nombre(t, 1)} s · ${MIXAGES_NOMS[mixageA(t)].toLowerCase()}`, lignes: [
      { couleur: COULEURS.musique, valeur: Number.isFinite(m) ? `${nombre(m, 1)} LUFS` : 'silence', texte: 'la musique' },
      { couleur: COULEURS.effets, valeur: Number.isFinite(e) ? `${nombre(e, 1)} LUFS` : 'silence', texte: 'les bruitages' },
      ...(Number.isFinite(m) && Number.isFinite(e) ? [{ texte: e > m ? `les bruitages devant, de ${nombre(e - m, 0)} LU` : `la musique devant, de ${nombre(m - e, 0)} LU` }] : []),
    ] };
  });
  creerToile(figures['fig-compresseur'].toile, (ctx, l, h, p) => dessinerTemps(ctx, l, h, specCompresseur, p), (x, y, { largeur }) => {
    const t = tempsSous(x, largeur, DUREE_SITUATION);
    if (t === null || !apres.mix.reduction.length) return null;
    const v = valeurA(apres.mix.reduction, t, PAS_REDUCTION, PAS_REDUCTION);
    return { titre: `${nombre(t, 1)} s`, lignes: [{ couleur: COULEURS.compresseur, valeur: `${nombre(-v, 1)} dB`, texte: 'de moins' }] };
  });
  creerToile(figures['fig-departs'].toile, (ctx, l, h, p) => dessinerTemps(ctx, l, h, specDeparts, p), (x, y, { largeur }) => {
    const t = tempsSous(x, largeur, DUREE_SITUATION);
    if (t === null) return null;
    const i = Math.min(DUREE_SITUATION - 1, Math.floor(t));
    const noms = {};
    for (const d of apres.mix.departs) if (Math.floor(d.t) === i) noms[d.nom] = (noms[d.nom] || 0) + 1;
    return { titre: `De ${i} à ${i + 1} s`, lignes: [
      { couleur: COULEURS.effets, forme: 'barre', valeur: String(joues[i]), texte: 'joués' },
      { couleur: COULEURS.empeches, forme: 'barre', valeur: String(empeches[i]), texte: 'empêchés' },
      ...Object.entries(noms).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, v]) => ({ valeur: `${v}×`, texte: reglages.bruitages[n]?.nom || n })),
    ] };
  });
  const legende = (ul, items) => ul.replaceChildren(...items.map(([couleur, texte, classe = '']) => {
    const li = element('li');
    const c = element('span', `cle ${classe}`.trim());
    c.style.setProperty('--couleur', couleur);
    li.append(c, document.createTextNode(texte));
    return li;
  }));
  legende(figures['fig-volume'].legende, [[COULEURS.musique, 'la musique seule'], [COULEURS.effets, 'les bruitages seuls'], [COULEURS.couverte.replace('0.18', '0.6'), 'la musique couverte', 'barre'], ...(avant ? [[TEINTES.encreDouce, 'l’avant (en tirets pâles)', 'pale']] : [])]);
  legende(figures['fig-compresseur'].legende, [[COULEURS.compresseur, 'la baisse du son'], ...(avant ? [[TEINTES.encreDouce, 'l’avant', 'pale']] : [])]);
  legende(figures['fig-departs'].legende, [[COULEURS.effets, 'joués', 'barre'], [COULEURS.empeches, 'empêchés par les limites', 'barre']]);
  // le détail des bruitages
  const noms = [...new Set([...Object.keys(apres.mix.joues), ...Object.keys(apres.mix.refuses)])].sort((a, b) => (apres.mix.joues[b] || 0) - (apres.mix.joues[a] || 0));
  const tete = element('tr');
  tete.append(element('th', '', 'Bruitage'), element('th', '', 'Joués'), element('th', '', 'Empêchés'), element('th', '', 'Sa limite'));
  details.replaceChildren(tete);
  for (const n of noms) {
    const tr = element('tr');
    tr.tabIndex = 0;
    const lim = reglages.bruitages[n]?.limite || reglages.limiteParDefaut;
    tr.append(element('td', 'lien', reglages.bruitages[n]?.nom || n), element('td', '', String(apres.mix.joues[n] || 0)), element('td', '', String(apres.mix.refuses[n] || 0)), element('td', '', `${lim.max} en 0,3 s, ${nombre(lim.ecart, 2)} s d’écart`));
    const ouvrir = () => { if (ORDRE.includes(n)) choisir(n); };
    tr.addEventListener('click', ouvrir);
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ouvrir(); });
    details.append(tr);
  }
}

// ── Le nuage de tous les bruitages ──
let nuage = null, specNuage = null;
async function majNuage(ma) {
  const fig = $('#fig-nuage');
  const toile = fig.querySelector('.toile');
  const lignes = ORDRE.map((nom) => ({ nom, texte: reglages.bruitages[nom].nom, cible: ROLES[reglages.bruitages[nom].role].cible, valeurs: { pixel: null, cartoon: null, voxel: null }, avant: null, choisie: choix.vue === 'bruitage' && nom === choix.nom, modifie: recetteModifiee(nom) }));
  specNuage = { lignes, min: -30, max: 15 };
  toiles.nuage = specNuage;
  toile.querySelector('canvas').style.height = `${NUAGE.haut + NUAGE.bas + lignes.length * NUAGE.ligne + 4}px`;
  fig.querySelector('.legende').replaceWith(legendeEpoques());
  if (!nuage) {
    nuage = creerToile(toile, (ctx, l, h, p) => dessinerNuage(ctx, l, h, specNuage, p), (x, y) => {
      const k = Math.floor((y - NUAGE.haut) / NUAGE.ligne);
      const li = specNuage.lignes[k];
      if (!li) return null;
      const r = reglages.bruitages[li.nom];
      return { titre: `${li.texte} (${ROLES[r.role].nom.toLowerCase()})`, lignes: [
        ...NOMS_EPOQUES.map((e) => ({ couleur: EPOQUES[e].couleur, forme: EPOQUES[e].forme, valeur: li.valeurs[e] === null ? '…' : `${signe(li.valeurs[e], 1)} LU`, texte: EPOQUES[e].nom + (li.avant?.[e] !== undefined && li.avant?.[e] !== null ? ` (avant : ${signe(li.avant[e], 1)})` : '') })),
        { texte: `Sa bande : ${cibleEnMots(li.cible)}. Un clic pour l’ouvrir.` },
      ] };
    });
    nuage.canvas.addEventListener('click', (e) => {
      const r = nuage.canvas.getBoundingClientRect();
      const k = Math.floor((e.clientY - r.top - NUAGE.haut) / NUAGE.ligne);
      if (specNuage.lignes[k]) choisir(specNuage.lignes[k].nom);
    });
  }
  nuage.redessiner();
  let n = 0;
  for (const li of lignes) {
    const apres = await bilan(li.nom, false);
    if (!encore(ma)) return;
    for (const e of NOMS_EPOQUES) li.valeurs[e] = apres[e].rel;
    if (choix.avant && NOMS_EPOQUES.some((e) => cleBruitage(li.nom, e, true) !== cleBruitage(li.nom, e, false))) {
      const avant = await bilan(li.nom, true);
      if (!encore(ma)) return;
      li.avant = Object.fromEntries(NOMS_EPOQUES.map((e) => [e, avant[e].rel]));
    }
    etats[li.nom] = niveauDe(juger(li.nom, apres));
    if (++n % 6 === 0) { nuage.redessiner(); majBande(); etatCalcul(`Tous les bruitages : ${n} sur ${lignes.length}…`); }
  }
  etatCalcul('');
  nuage.redessiner();
  majBande();
}

// ═════════════════════════════════════════════════════════════
// LE PANNEAU DES RÉGLAGES
// ═════════════════════════════════════════════════════════════
const decimales = (pas) => (String(pas).split('.')[1] || '').length;
const propre = (v, champ) => {
  const p = champ.entier ? 1 : champ.pas;
  return Number((Math.round(v / p) * p).toFixed(decimales(p)));
};
// Une ligne de réglage : le nom, un curseur (« logarithmique » pour les fréquences : chaque octave a
// la même place), la valeur exacte (modifiable au clavier), et l'avant s'il a changé
function ligneReglage(champ, valeur, avant, quandChange, retirer = null) {
  const ligne = element('div', 'reglage reglage-chiffre');
  const nom = element('span', 'nom', champ.nom);
  if (champ.unite) nom.append(element('small', '', ` (${champ.unite})`));
  nom.title = champ.aide || '';
  if (retirer) {
    const x = element('button', 'petit retirer', '×');
    x.type = 'button';
    x.title = `Retirer « ${champ.nom.toLowerCase()} »`;
    x.addEventListener('click', retirer);
    nom.append(x);
  }
  const versCurseur = (v) => (champ.log ? Math.log(v) : v);
  const curseur = element('input');
  Object.assign(curseur, { type: 'range', min: String(versCurseur(champ.min)), max: String(versCurseur(champ.max)), step: champ.log ? 'any' : String(champ.pas), value: String(versCurseur(valeur)) });
  curseur.setAttribute('aria-label', champ.nom);
  const saisie = element('input');
  Object.assign(saisie, { type: 'number', min: String(champ.min), max: String(champ.max), step: String(champ.pas), value: String(valeur) });
  saisie.setAttribute('aria-label', `${champ.nom} (valeur exacte)`);
  const ancien = element('span', 'ancien');
  const maj = (v) => {
    ligne.classList.toggle('modifie', v !== avant);
    ancien.textContent = v === avant ? '' : avant === undefined ? 'nouveau' : `avant : ${avant.toLocaleString('fr-FR', { maximumFractionDigits: 3 })}`;
  };
  const changer = (brut, source) => {
    let v = Number(brut);
    if (!Number.isFinite(v)) return;
    v = propre(Math.max(champ.min, Math.min(champ.max, v)), champ);
    if (source !== curseur) curseur.value = String(versCurseur(v));
    if (source !== saisie) saisie.value = String(v);
    maj(v);
    quandChange(v);
  };
  curseur.addEventListener('input', () => changer(champ.log ? Math.exp(Number(curseur.value)) : curseur.value, curseur));
  saisie.addEventListener('change', () => changer(saisie.value, saisie));
  ligne.append(nom, curseur, saisie, ancien);
  maj(valeur);
  return ligne;
}

// Retient les réglages d'avant un changement (pour « Annuler »). Les petits pas d'un même curseur
// comptent pour un seul changement.
let dernierMemorise = { quoi: null, quand: 0 };
function memoriser(quoi) {
  const maintenant = performance.now();
  if (quoi && dernierMemorise.quoi === quoi && maintenant - dernierMemorise.quand < 1500) { dernierMemorise.quand = maintenant; return; }
  historique.push(structuredClone(reglages));
  if (historique.length > 100) historique.shift();
  dernierMemorise = { quoi, quand: maintenant };
}
let attenteCalcul = null;
function apresChangement({ panneau = false } = {}) {
  majBande();
  if (panneau) dessinerReglages();
  clearTimeout(attenteCalcul);
  attenteCalcul = setTimeout(afficher, 250); // on attend que le curseur s'arrête un peu
  dire(modifie() ? 'Pas encore enregistré.' : '');
}
const changeur = (quoi, faire, options) => (v) => { memoriser(quoi); faire(v); apresChangement(options); };

function dessinerReglages() {
  const zone = $('#reglages');
  zone.replaceChildren();
  if (choix.vue === 'bruitage') {
    $('#titre-reglages').textContent = reglages.bruitages[choix.nom].nom;
    reglagesBruitage(zone, choix.nom);
  } else {
    const s = SITUATIONS.find((x) => x.id === choix.situation);
    $('#titre-reglages').textContent = insecables(choix.vue === 'musique' ? 'Les trois orchestres' : `Le son de « ${s.nom} »`);
    if (choix.vue === 'situation') zone.append(element('p', 'aide', 'Ces 30 secondes se jouent avec l’orchestre de leur époque. Pour régler un bruitage, ouvre-le dans la bande (ou clique sur son nom dans le tableau, sous les graphiques).'));
    reglagesEpoques(zone, choix.vue === 'situation' ? s.epoque : null);
  }
}

// Les réglages d'une recette : ses couches et sa limite
const COUCHE_PAR_DEFAUT = {
  bip: { outil: 'bip', frequence: 660, duree: 0.08, volume: 0.15 },
  grave: { outil: 'grave', frequence: 80, duree: 0.4, volume: 0.4 },
  arpege: { outil: 'arpege', notes: [72, 76, 79], ecart: 0.06, duree: 0.1, volume: 0.25 },
  coup: { outil: 'coup', volume: 0.4 },
  bruit: { outil: 'bruit', duree: 0.3, volume: 0.15, filtre: 'bandpass', de: 1200, a: 600, q: 1 },
};
const VALEUR_PAR_DEFAUT = { glisse: 2, retard: 0.05, q: 1 };
function reglagesBruitage(zone, nom) {
  const r = reglages.bruitages[nom], av = AVANT.bruitages[nom];
  zone.append(element('p', 'aide', `${ROLES[r.role].nom} : sa bande est ${cibleEnMots(ROLES[r.role].cible)}. Chaque couche part en même temps (sauf si elle a un retard).`));
  r.couches.forEach((c, i) => {
    const avantCouche = av.couches[i]?.outil === c.outil ? av.couches[i] : {};
    const groupe = element('fieldset', 'groupe couche');
    const legende = element('legend', '', `${i + 1}. ${OUTILS[c.outil].nom}${c.outil === 'bruit' ? ` : ${FILTRES[c.filtre]}` : ''}`);
    legende.title = OUTILS[c.outil].aide;
    groupe.append(legende);
    if (r.couches.length > 1) {
      const outils = element('div', 'outils-couche');
      const retirer = element('button', 'petit', 'Retirer');
      retirer.type = 'button';
      retirer.addEventListener('click', () => { memoriser(null); r.couches.splice(i, 1); apresChangement({ panneau: true }); });
      outils.append(retirer);
      groupe.append(outils);
    }
    const ici = `${nom}.${i}`;
    for (const cle of [...OUTILS[c.outil].obligatoires, ...OUTILS[c.outil].permis]) {
      if (!(cle in c)) continue;
      const optionnel = OUTILS[c.outil].permis.includes(cle);
      const retirer = optionnel ? () => { memoriser(null); delete c[cle]; apresChangement({ panneau: true }); } : null;
      if (cle === 'filtre') {
        const ligne = element('label', 'reglage');
        ligne.append(element('span', 'nom', 'Filtre'));
        const select = element('select');
        for (const [f, texte] of Object.entries(FILTRES)) select.append(Object.assign(element('option', '', `${f} : ${texte}`), { value: f, selected: c.filtre === f }));
        select.addEventListener('change', () => { memoriser(null); c.filtre = select.value; apresChangement({ panneau: true }); });
        ligne.append(select);
        groupe.append(ligne);
      } else if (cle === 'notes') {
        const ligne = element('label', 'reglage reglage-notes');
        ligne.append(element('span', 'nom', 'Notes (60 = Do4, +1 par demi-ton)'));
        const saisie = element('input');
        saisie.value = c.notes.join(' ');
        const noms = element('span', 'noms-notes', c.notes.map(nomNote).join(' · '));
        saisie.addEventListener('change', () => {
          const notes = saisie.value.trim().split(/[\s,;]+/).map(Number);
          if (!notes.length || notes.length > NOTES_MAX || notes.some((n) => !Number.isInteger(n) || n < CHAMPS.couche.note.min || n > CHAMPS.couche.note.max)) {
            dire(`Les notes : de 1 à ${NOTES_MAX} nombres entiers, de ${CHAMPS.couche.note.min} à ${CHAMPS.couche.note.max}.`, true);
            saisie.value = c.notes.join(' ');
            return;
          }
          memoriser(null);
          c.notes = notes;
          noms.textContent = notes.map(nomNote).join(' · ');
          apresChangement();
        });
        ligne.append(saisie, noms);
        if (avantCouche.notes && !memes(avantCouche.notes, c.notes)) ligne.append(element('span', 'ancien', `avant : ${avantCouche.notes.join(' ')}`));
        groupe.append(ligne);
      } else if (cle === 'selonLesPV') {
        const ligne = element('label', 'choix-case');
        const caseSelon = element('input');
        caseSelon.type = 'checkbox';
        caseSelon.checked = c.selonLesPV;
        caseSelon.addEventListener('change', () => { memoriser(null); c.selonLesPV = caseSelon.checked; apresChangement(); });
        ligne.append(caseSelon, textes('Plus grave pour les monstres solides'));
        groupe.append(ligne);
      } else {
        groupe.append(ligneReglage(CHAMPS.couche[cle], c[cle], avantCouche[cle], changeur(`${ici}.${cle}`, (v) => { c[cle] = v; }), retirer));
      }
    }
    // les champs facultatifs qu'on peut ajouter
    const manquants = OUTILS[c.outil].permis.filter((cle) => !(cle in c) && cle !== 'selonLesPV');
    if (manquants.length) {
      const ajout = element('p', 'ajouts');
      ajout.append(textes('Ajouter : '));
      for (const cle of manquants) {
        const b = element('button', 'petit', CHAMPS.couche[cle].nom.toLowerCase());
        b.type = 'button';
        b.title = CHAMPS.couche[cle].aide;
        b.addEventListener('click', () => { memoriser(null); c[cle] = VALEUR_PAR_DEFAUT[cle]; apresChangement({ panneau: true }); });
        ajout.append(b);
      }
      groupe.append(ajout);
    }
    zone.append(groupe);
  });
  if (r.couches.length < COUCHES_MAX) {
    const ajout = element('div', 'ajout-couche');
    const select = element('select');
    for (const [o, d] of Object.entries(OUTILS)) select.append(Object.assign(element('option', '', `${d.nom} : ${d.aide}`), { value: o }));
    const b = element('button', 'petit', 'Ajouter une couche');
    b.type = 'button';
    b.addEventListener('click', () => { memoriser(null); r.couches.push(structuredClone(COUCHE_PAR_DEFAUT[select.value])); apresChangement({ panneau: true }); });
    ajout.append(select, b);
    zone.append(ajout);
  }
  // sa limite
  const groupe = element('fieldset', 'groupe');
  groupe.append(element('legend', '', 'Sa limite'));
  const propre_ = element('label', 'choix-case');
  const casePropre = element('input');
  casePropre.type = 'checkbox';
  casePropre.checked = Boolean(r.limite);
  const d = reglages.limiteParDefaut;
  casePropre.addEventListener('change', () => {
    memoriser(null);
    if (casePropre.checked) r.limite = structuredClone(av.limite || d);
    else delete r.limite;
    apresChangement({ panneau: true });
  });
  propre_.append(casePropre, textes(`Sa propre limite (sinon, celle par défaut : ${d.max} départs en 0,3 s, ${nombre(d.ecart, 2)} s d’écart)`));
  groupe.append(propre_);
  if (r.limite) {
    for (const [cle, champ] of Object.entries(CHAMPS.limite)) groupe.append(ligneReglage(champ, r.limite[cle], av.limite?.[cle], changeur(`${nom}.limite.${cle}`, (v) => { r.limite[cle] = v; })));
  }
  if (EVENEMENTS[nom]) groupe.append(element('p', 'aide', `Il compte avec la limite de « ${reglages.bruitages[EVENEMENTS[nom]].nom} » : c’est le même événement du jeu.`));
  zone.append(groupe);
  zone.append(element('p', 'note', 'Les réglages des trois époques (la force des bruits, des « boum », l’écho…) sont dans « La musique ».'));
}

// Les réglages des époques (une seule si imposee), le mixage de la musique, la limite par défaut
function reglagesEpoques(zone, imposee) {
  const epoque = imposee || choix.epoque;
  if (!imposee) {
    const onglets = element('div', 'onglets');
    onglets.setAttribute('role', 'tablist');
    for (const e of NOMS_EPOQUES) {
      const b = element('button', '', EPOQUES[e].nom);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(e === epoque));
      b.addEventListener('click', () => { choix.epoque = e; dessinerReglages(); });
      onglets.append(b);
    }
    zone.append(onglets);
  }
  const e = reglages.epoques[epoque], av = AVANT.epoques[epoque];
  const groupe = (titre, cles) => {
    const g = element('fieldset', 'groupe');
    g.append(element('legend', '', titre));
    for (const cle of cles) {
      const [a, b] = cle.split('.');
      const valeur = b ? e[a][b] : e[a], ancien = b ? av[a]?.[b] : av[a];
      g.append(ligneReglage(CHAMPS.epoque[cle], valeur, ancien, changeur(`${epoque}.${cle}`, (v) => { if (b) e[a][b] = v; else e[a] = v; })));
    }
    zone.append(g);
  };
  groupe(`${EPOQUES[epoque].nom} : la musique`, ['volume', 'volumeChef', 'reverb.envoi', 'reverb.duree']);
  groupe(`${EPOQUES[epoque].nom} : les bruitages`, ['brillance', 'forceBruit', 'forceAigus', 'hauteurAigus', 'forceCoup']);
  // le mixage
  zone.append(element('h3', '', 'Le mixage de la musique'));
  const onglets = element('div', 'onglets');
  for (const m of Object.keys(MIXAGES_NOMS)) {
    const b = element('button', '', MIXAGES_NOMS[m]);
    b.type = 'button';
    b.setAttribute('aria-selected', String(m === choix.mixage));
    b.addEventListener('click', () => { choix.mixage = m; dessinerReglages(); });
    onglets.append(b);
  }
  zone.append(onglets);
  const mix = reglages.mixages[choix.mixage], mixAvant = AVANT.mixages[choix.mixage];
  const g = element('fieldset', 'groupe');
  g.append(element('legend', '', `Le volume de chaque couche : ${MIXAGES_NOMS[choix.mixage].toLowerCase()}`));
  for (const cle of Object.keys(mix)) g.append(ligneReglage(CHAMPS.mixage[cle], mix[cle], mixAvant[cle], changeur(`mix.${choix.mixage}.${cle}`, (v) => { mix[cle] = v; })));
  zone.append(g);
  // la limite par défaut
  const gl = element('fieldset', 'groupe');
  gl.append(element('legend', '', 'La limite par défaut des bruitages'));
  for (const [cle, champ] of Object.entries(CHAMPS.limite)) gl.append(ligneReglage(champ, reglages.limiteParDefaut[cle], AVANT.limiteParDefaut[cle], changeur(`limite.${cle}`, (v) => { reglages.limiteParDefaut[cle] = v; })));
  zone.append(gl);
}

// ═════════════════════════════════════════════════════════════
// LES ACTIONS
// ═════════════════════════════════════════════════════════════
function dire(texte, erreur = false) {
  const p = $('#etat');
  p.textContent = texte;
  p.classList.toggle('erreur', erreur);
}
function construireActions() {
  const actions = [
    ['Annuler', annuler],
    ['Tout annuler', toutAnnuler],
    ['Tour complet', tourComplet],
    ['Planche', () => planche(false)],
    ['Avant/après', () => planche(true)],
  ];
  if (import.meta.env.DEV) actions.splice(2, 0, ['Enregistrer dans le jeu', enregistrer]);
  $('#actions').replaceChildren(...actions.map(([texte, action]) => {
    const b = element('button', texte === 'Enregistrer dans le jeu' ? 'principal' : '', texte);
    b.type = 'button';
    b.addEventListener('click', action);
    return b;
  }));
  if (!import.meta.env.DEV) $('#actions').append(element('p', 'note', 'En ligne, l’atelier ne peut pas enregistrer dans le projet : lance le jeu avec npm run dev.'));
}
function annuler() {
  if (!historique.length) { dire('Rien à annuler.'); return; }
  appliquerReglagesSon(historique.pop());
  dernierMemorise = { quoi: null, quand: 0 };
  apresChangement({ panneau: true });
}
function toutAnnuler() {
  if (!modifie()) { dire('Rien à annuler : ce sont les réglages du fichier.'); return; }
  memoriser(null);
  appliquerReglagesSon(AVANT);
  apresChangement({ panneau: true });
}
async function enregistrer() {
  const problemes = problemesSons(reglages, AVANT);
  if (problemes.length) { dire(`Pas enregistré : ${problemes[0]}`, true); return; }
  if (!modifie()) { dire('Rien à enregistrer : ce sont les réglages du fichier.'); return; }
  try {
    const reponse = await fetch('/__sons', { method: 'POST', body: JSON.stringify(reglages) });
    const donnees = await reponse.json();
    if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
    AVANT = structuredClone(reglages); // le fichier, c'est maintenant ça : l'avant devient l'après
    apresChangement({ panneau: true });
    dire(`Enregistré dans ${donnees.fichier}.`);
  } catch (e) {
    dire(`Pas enregistré : ${e.message}`, true);
  }
}
function remplacer(nouveaux) {
  const problemes = problemesSons(nouveaux, AVANT);
  if (problemes.length) throw new Error(`Réglages incorrects : ${problemes.join(' ; ')}`);
  memoriser(null);
  appliquerReglagesSon(nouveaux);
  apresChangement({ panneau: true });
  return afficher();
}

// ── Le tour complet : tous les bruitages et toutes les situations ──
const resultats = { bruitages: {}, situations: {} };
async function tourComplet() {
  const ma = ++generation; // (le tour passe avant l'affichage en cours)
  const tour = $('#tour');
  tour.replaceChildren(element('h2', '', 'Le tour complet'), element('p', 'aide', 'Calcul en cours…'));
  const lignes = [];
  let n = 0;
  for (const nom of ORDRE) {
    dire(`Tour complet : ${reglages.bruitages[nom].nom} (${++n} sur ${ORDRE.length})…`);
    const apres = await bilan(nom, false);
    const problemes = juger(nom, apres);
    etats[nom] = niveauDe(problemes);
    resultats.bruitages[nom] = { parEpoque: Object.fromEntries(NOMS_EPOQUES.map((e) => [e, { rel: apres[e].rel, volume: apres[e].volume, crete: apres[e].crete, durete: apres[e].durete }])), problemes };
    lignes.push({ nom, apres, problemes });
  }
  majBande();
  const sits = [];
  for (const s of SITUATIONS) {
    const c = await calculerSituation(s.id, false, (q) => dire(`Tour complet : « ${s.nom} », ${q}…`));
    const r = resumer(c);
    etats[`situation:${s.id}`] = niveauDe(jugerSituation(r));
    resultats.situations[s.id] = { ...r, problemes: jugerSituation(r) };
    sits.push({ s, r });
  }
  majBande();
  // les bruitages : une ligne par bruitage, son volume comparé à la musique dans chaque époque
  const table = element('table', 'resultats');
  const tete = element('tr');
  tete.append(element('th', '', 'Bruitage'), element('th', '', 'Rôle (sa bande)'), ...NOMS_EPOQUES.map((e) => element('th', '', EPOQUES[e].nom)), element('th', '', 'À regarder'));
  table.append(tete);
  for (const { nom, apres, problemes } of lignes) {
    const r = reglages.bruitages[nom], [a, b] = ROLES[r.role].cible;
    const tr = element('tr');
    tr.tabIndex = 0;
    tr.append(element('td', 'lien', r.nom), element('td', '', `${ROLES[r.role].nom} (${signe(a)} à ${signe(b)})`));
    for (const e of NOMS_EPOQUES) {
      const v = apres[e].rel;
      tr.append(element('td', v < a - 3 || v > b + 3 ? 'trop' : v < a || v > b ? 'attention' : '', `${signe(v, 1)} LU`));
    }
    tr.append(element('td', problemes.some((p) => p.niveau === 'trop') ? 'trop' : problemes.length ? 'attention' : '', problemes.map((p) => p.texte).join(' · ') || '—'));
    const ouvrir = () => choisir(nom);
    tr.addEventListener('click', ouvrir);
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ouvrir(); });
    table.append(tr);
  }
  const tableS = element('table', 'resultats');
  const teteS = element('tr');
  teteS.append(...['Situation', 'Musique', 'Bruitages', 'Bruitages devant', 'Musique couverte', 'Compresseur (au plus)', 'Plus de 3 dB', 'Crête', 'Joués / empêchés', 'À regarder'].map((t) => element('th', '', t)));
  tableS.append(teteS);
  for (const { s, r } of sits) {
    const p = jugerSituation(r);
    const tr = element('tr');
    tr.tabIndex = 0;
    tr.append(element('td', 'lien', s.nom), element('td', '', `${nombre(r.musique, 1)} LUFS`), element('td', '', `${nombre(r.effets, 1)} LUFS`), element('td', '', pourcent(r.devant)),
      element('td', r.couverte > 0.1 ? 'trop' : r.couverte > 0.03 ? 'attention' : '', pourcent(r.couverte)), element('td', '', `${nombre(-r.reductionMax, 1)} dB`),
      element('td', r.plus3 > 0.1 ? 'attention' : '', pourcent(r.plus3)), element('td', r.crete > -0.3 ? 'trop' : r.crete > -1 ? 'attention' : '', `${nombre(r.crete, 1)} dB`),
      element('td', '', `${r.joues} / ${r.empeches}`), element('td', p.some((x) => x.niveau === 'trop') ? 'trop' : p.length ? 'attention' : '', p.map((x) => x.texte).join(' · ') || '—'));
    const ouvrir = () => choisir(`situation:${s.id}`);
    tr.addEventListener('click', ouvrir);
    tr.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') ouvrir(); });
    tableS.append(tr);
  }
  const aRegarder = lignes.filter((l) => l.problemes.length).length;
  tour.replaceChildren(
    element('h2', '', 'Le tour complet'),
    element('p', 'aide', `Chaque bruitage dans les trois époques, comparé à la musique de l’époque (pendant une vague), et chaque situation de jeu. En orange : un peu hors de sa bande (ou autre chose à regarder) ; en rouge : bien hors de sa bande, ou il sature. ${aRegarder} bruitage${aRegarder > 1 ? 's' : ''} sur ${ORDRE.length} à regarder. Un clic sur une ligne l’ouvre.`),
    table,
    element('h3', '', 'Les situations de jeu'),
    tableS,
  );
  dire('Tour complet fini.');
  if (ma === generation) afficher();
  return resultats;
}

// ── Les planches (rangées dans captures/, ou téléchargées en ligne) ──
async function ranger(canvas, nom) {
  const image = canvas.toDataURL('image/png');
  if (import.meta.env.DEV) {
    const fichier = await (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
    dire(`Rangée dans ${fichier}`);
    return fichier;
  }
  const lien = element('a');
  lien.href = image;
  lien.download = `${nom}.png`;
  lien.click();
  return lien.download;
}
// Écrit un texte qui passe à la ligne ; renvoie la hauteur utilisée
function paragraphe(ctx, texte, x, y, largeur, taille = 15, couleur = '#c8b8a8') {
  ctx.font = `${taille}px "Pixelify Sans", sans-serif`;
  ctx.fillStyle = couleur;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  let ligne = '', yy = y;
  for (const mot of texte.split(' ')) {
    const essai = ligne ? `${ligne} ${mot}` : mot;
    if (ctx.measureText(essai).width > largeur && ligne) { ctx.fillText(ligne, x, yy); yy += taille * 1.35; ligne = mot; } else ligne = essai;
  }
  if (ligne) { ctx.fillText(ligne, x, yy); yy += taille * 1.35; }
  return yy - y;
}
// Dessine dans une case de planche (avec son titre)
function casePlanche(ctx, x, y, l, h, titre, dessin) {
  ctx.save();
  if (titre) {
    ctx.font = '16px "Pixelify Sans", sans-serif';
    ctx.fillStyle = '#ffd27a';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(titre, x, y);
    y += 22;
    h -= 22;
  }
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.rect(0, 0, l, h);
  ctx.clip();
  dessin(ctx, l, h);
  ctx.restore();
}
async function planche(avantApres = false) {
  await calculEnCours;
  const c = element('canvas');
  c.width = 1600;
  const parts = [];
  const L = 1600, marge = 16;
  if (choix.vue === 'bruitage') {
    const t = toiles.bruitage;
    if (!t) return null;
    const r = reglages.bruitages[choix.nom];
    const colonne = (L - marge * 4) / 3;
    const hauteurCarte = avantApres ? 456 : 330;
    c.height = 120 + hauteurCarte + 30 + (NUAGE.haut + NUAGE.bas + ORDRE.length * NUAGE.ligne) + 40;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#140e1a';
    ctx.fillRect(0, 0, c.width, c.height);
    paragraphe(ctx, `${r.nom}${avantApres ? ' — avant / après' : ''}`, marge, 14, L - 2 * marge, 28, '#fff4e0');
    paragraphe(ctx, `${r.famille} · ${ROLES[r.role].nom.toLowerCase()} : sa bande est ${cibleEnMots(ROLES[r.role].cible)}. ${r.description}`, marge, 54, L - 2 * marge, 15);
    NOMS_EPOQUES.forEach((e, k) => {
      const x = marge + k * (colonne + marge), te = t[e];
      let y = 110;
      casePlanche(ctx, x, y, colonne, 26, `${EPOQUES[e].nom} (${ORCHESTRES[e].nom})`, () => {});
      y += 26;
      casePlanche(ctx, x, y, colonne, 110, avantApres ? 'Forme de l’onde (avant en gris, après en couleur)' : 'Forme de l’onde', (cx, l, h) => dessinerOnde(cx, l, h, { onde: te.ondeApres, avant: te.ondeAvant, couleur: EPOQUES[e].couleur, duree: te.duree, dureeOnde: te.dureeApres, dureeAvant: te.dureeAvant, zoom: te.zoom }));
      y += 116;
      if (avantApres) {
        casePlanche(ctx, x, y, colonne, 120, 'Spectrogramme : avant', (cx, l, h) => dessinerSpectrogramme(cx, l, h, te.spectroAvant || te.spectroApres, { duree: te.duree }));
        y += 126;
      }
      casePlanche(ctx, x, y, colonne, 120, avantApres ? 'Spectrogramme : après' : 'Spectrogramme', (cx, l, h) => dessinerSpectrogramme(cx, l, h, te.spectroApres, { duree: te.duree }));
      y += 128;
      const m = te.mesure, a = te.mesureAvant;
      const textes = [
        `Comparé à la musique : ${enMots(m.rel)}${a ? ` (avant : ${enMots(a.rel)})` : ''}`,
        `Volume : ${nombre(m.volume, 1)} LUFS${a ? ` (avant : ${nombre(a.volume, 1)})` : ''} · crête : ${nombre(m.crete, 1)} dB${a ? ` (avant : ${nombre(a.crete, 1)})` : ''}`,
        `Dureté : ${pourcent(m.durete)}${a ? ` (avant : ${pourcent(a.durete)})` : ''} · brillance : ${nombre(m.brillance, 0)} Hz${a ? ` (avant : ${nombre(a.brillance, 0)})` : ''}`,
      ];
      for (const tx of textes) y += paragraphe(ctx, tx, x, y, colonne, 13, '#e9d6b8');
    });
    const yNuage = 120 + hauteurCarte + 20;
    casePlanche(ctx, marge, yNuage, L - 2 * marge, NUAGE.haut + NUAGE.bas + ORDRE.length * NUAGE.ligne + 26, 'Tous les bruitages, comparés à la musique (formes creuses : l’avant)', (cx, l, h) => dessinerNuage(cx, l, h, specNuage));
    parts.push(`son-${choix.nom.replace(':', '-')}`);
  } else if (choix.vue === 'musique') {
    const spec = toiles.musique;
    if (!spec) return null;
    c.height = 140 + (NUAGE.haut + NUAGE.bas + 3 * NUAGE.ligne + 30) + (NUAGE.haut + NUAGE.bas + ORDRE.length * NUAGE.ligne) + 60;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#140e1a';
    ctx.fillRect(0, 0, c.width, c.height);
    paragraphe(ctx, `Les trois orchestres${avantApres ? ' — avant / après' : ''}`, marge, 14, L - 2 * marge, 28, '#fff4e0');
    let y = 60;
    casePlanche(ctx, marge, y, L - 2 * marge, NUAGE.haut + NUAGE.bas + 3 * NUAGE.ligne + 26, 'Le volume de la musique (LUFS, formes creuses : l’avant)', (cx, l, h) => dessinerNuage(cx, l, h, spec));
    y += NUAGE.haut + NUAGE.bas + 3 * NUAGE.ligne + 50;
    casePlanche(ctx, marge, y, L - 2 * marge, NUAGE.haut + NUAGE.bas + ORDRE.length * NUAGE.ligne + 26, 'Tous les bruitages, comparés à la musique', (cx, l, h) => dessinerNuage(cx, l, h, specNuage));
    parts.push('son-musique');
  } else {
    const t = toiles.situation;
    if (!t?.specs) return null;
    c.height = 940;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#140e1a';
    ctx.fillRect(0, 0, c.width, c.height);
    paragraphe(ctx, `${t.s.nom}${avantApres ? ' — avant / après (en tirets pâles : l’avant)' : ''}`, marge, 14, L - 2 * marge, 28, '#fff4e0');
    let y = 54;
    for (const li of $('#vue .problemes').querySelectorAll('li')) y += paragraphe(ctx, li.textContent, marge, y, L - 2 * marge, 14, li.className.includes('trop') ? '#ffb0a0' : li.className.includes('attention') ? '#ffd08a' : '#e9d6b8');
    y += 8;
    const hauteurs = { 'fig-volume': 300, 'fig-compresseur': 200, 'fig-departs': 170 };
    for (const [id, spec] of Object.entries(t.specs)) {
      casePlanche(ctx, marge, y, L - 2 * marge, hauteurs[id] + 22, $(`#${id} h3`).textContent, (cx, l, h) => dessinerTemps(cx, l, h, spec));
      y += hauteurs[id] + 34;
    }
    parts.push(`son-situation-${t.s.id}`);
  }
  if (avantApres) parts.push('avant-apres');
  return ranger(c, parts.join('-'));
}

// ═════════════════════════════════════════════════════════════
// C'EST PARTI
// ═════════════════════════════════════════════════════════════
construireBande();
construireChoix();
construireActions();
dessinerReglages();
afficher();

// Pour la console (et les vérifications automatiques)
window.__atelierSon = {
  choisir,
  tourComplet,
  planche: () => planche(false),
  avantApres: () => planche(true),
  remplacer,
  attendre: () => calculEnCours,
  get reglages() { return structuredClone(reglages); },
  get avant() { return structuredClone(AVANT); },
  get resultats() { return resultats; },
  // les grands chiffres d'une situation, avant et après (calculés s'il le faut)
  async comparerSituation(id) {
    const apres = resumer(await calculerSituation(id, false));
    const avant = cleSituation(id, true) === cleSituation(id, false) ? apres : resumer(await calculerSituation(id, true));
    return { avant, apres };
  },
  get etats() { return { ...etats }; },
};
