// ─────────────────────────────────────────────────────────────
// LE SON CALCULÉ « HORS LIGNE » (l'atelier du son)
// Web Audio sait calculer un son sans le jouer : un OfflineAudioContext
// fabrique les échantillons aussi vite qu'il peut, au lieu de les envoyer au
// haut-parleur. On obtient exactement ce que le joueur entendrait (les mêmes
// instruments, la même table de mixage, le même compresseur), mais sous
// forme de nombres, qu'on peut mesurer (mesures.js) et dessiner.
//
// Le hasard est fixé pendant qu'on prépare le son (les petites variations
// de ±3 %, le grain du bruit) : le même calcul donne toujours le même son, et
// « avant » et « après » ne diffèrent que par les réglages.
// ─────────────────────────────────────────────────────────────
import { creerTable } from './synthe.js';
import { outilsBruitages, appliquerReverb, creerCouches, jouerPas, creerBourdon, THEME_LU, THEME_CHEF_LU, MIXAGES } from './son.js';
import { BRUITAGES, recetteDe, jouerRecette, creerGarde } from './effets.js';
import { ORCHESTRES } from './orchestres.js';
import { PAS_PAR_MESURE } from './partition.js';
import { REGLAGES_SON, appliquerReglagesSon } from './reglages-son.js';
import { OPTIONS_DE_BASE } from '../options.js';
import { mixageA } from './situations.js';

export const FE = 48000; // 48 000 échantillons par seconde
const DEBUT = 0.25;      // un bruitage commence à 0,25 s (le temps que l'écho de la salle soit en place)

// Le hasard fixé (un petit générateur : chaque nombre se calcule à partir du précédent)
function avecGraine(graine, faire) {
  let g = graine;
  const vrai = Math.random;
  Math.random = () => (g = (g * 16807) % 2147483647) / 2147483647;
  try { return faire(); } finally { Math.random = vrai; }
}

// D'autres réglages le temps de préparer le son (pour l'AVANT) : on les remet après. Le son ne lit
// les réglages que pendant qu'on le prépare : le calcul lui-même, ensuite, ne les regarde plus.
function avecReglages(reglages, faire) {
  if (!reglages) return faire();
  const enPlace = structuredClone(REGLAGES_SON);
  appliquerReglagesSon(reglages);
  try { return faire(); } finally { appliquerReglagesSon(enPlace); }
}

// La table de mixage du jeu, dans un contexte hors ligne. compresseur : false = on le contourne
// (pour mesurer ce qu'il ferait), true = comme dans le jeu.
function preparerTable(ctx, orchestre, compresseur) {
  const table = creerTable(ctx);
  if (!compresseur) {
    table.general.disconnect();
    table.general.connect(ctx.destination);
  }
  appliquerReverb(table, orchestre);
  // l'écho tout de suite à sa place (dans le jeu, il y glisse en 0,05 s quand on change d'époque)
  for (const tranche of [table.musique, table.effets]) tranche.envoi.gain.cancelScheduledValues(0);
  table.musique.envoi.gain.value = orchestre.reverb.envoi;
  table.effets.envoi.gain.value = orchestre.reverb.envoi * 0.8;
  table.general.gain.value = 1;
  return table;
}

const canauxDe = (tampon) => [tampon.getChannelData(0), tampon.getChannelData(1)];

// La durée d'une recette : jusqu'à la fin de sa dernière couche (en secondes)
export function dureeRecette(recette) {
  return recette.couches.reduce((m, c) => {
    const notes = c.outil === 'arpege' ? (c.notes.length - 1) * c.ecart : 0;
    const duree = c.outil === 'coup' ? 0.4 : c.duree;
    return Math.max(m, (c.retard ?? 0) + notes + duree);
  }, 0);
}

// ── Un bruitage seul ──
// nom : la recette (dans sons.json) ; ev : l'événement (pour les recettes « selon les PV » : quel
// monstre) ; volumeEffets : celui des options. Renvoie { canaux: [gauche, droite], fe, debut }.
export async function rendreBruitage(nom, epoque, { ev = {}, graine = 12345, compresseur = true, reglages = null, volumeEffets = OPTIONS_DE_BASE.effets } = {}) {
  const orchestre = ORCHESTRES[epoque];
  const ctx = avecReglages(reglages, () => {
    const recette = BRUITAGES[nom];
    const duree = DEBUT + dureeRecette(recette) + orchestre.reverb.duree * (orchestre.reverb.envoi ? 1 : 0) + 0.4;
    const c = new OfflineAudioContext(2, Math.ceil(FE * Math.max(1, duree)), FE);
    avecGraine(graine, () => {
      const table = preparerTable(c, orchestre, compresseur);
      table.effets.volume.gain.value = volumeEffets;
      jouerRecette(recette, outilsBruitages(table, orchestre, { debut: DEBUT }), ev);
    });
    return c;
  });
  return { canaux: canauxDe(await ctx.startRendering()), fe: FE, debut: DEBUT };
}

// ── La musique seule ──
// mixage : 'calme', 'vague' ou 'chef' (le thème des chefs) ; secondes : combien on en calcule.
export async function rendreMusique(epoque, mixage, { secondes = 16, graine = 12345, compresseur = true, reglages = null, volumeMusique = OPTIONS_DE_BASE.musique } = {}) {
  const orchestre = ORCHESTRES[epoque];
  const ctx = new OfflineAudioContext(2, Math.ceil(FE * secondes), FE);
  avecReglages(reglages, () => avecGraine(graine, () => {
    const table = preparerTable(ctx, orchestre, compresseur);
    table.musique.volume.gain.value = volumeMusique * orchestre.volume;
    planifierMusique(table, orchestre, () => mixage, secondes);
  }));
  return { canaux: canauxDe(await ctx.startRendering()), fe: FE };
}

// La musique d'un bout à l'autre, comme le séquenceur du jeu (son.js) : le mixage change au début
// d'une mesure (les couches y glissent doucement), et le thème des chefs remplace le thème principal
// (en repartant de sa première mesure) quand un chef arrive. mixageVoulu(heure) dit lequel on veut.
function planifierMusique(table, orchestre, mixageVoulu, duree) {
  const couches = creerCouches(table);
  let partition = mixageVoulu(0.05) === 'chef' ? THEME_CHEF_LU : THEME_LU;
  let numeroPas = 0, heure = 0.05, applique = null;
  while (heure < duree) {
    if (numeroPas % PAS_PAR_MESURE === 0) {
      const mixage = mixageVoulu(heure);
      const voulue = mixage === 'chef' ? THEME_CHEF_LU : THEME_LU;
      if (voulue !== partition) { partition = voulue; numeroPas = 0; }
      if (mixage !== applique) {
        const force = mixage === 'chef' ? orchestre.volumeChef : 1;
        for (const [nom, gain] of Object.entries(couches)) {
          // au départ, la musique joue déjà (on arrive au milieu d'une partie) : pas de montée
          if (applique === null) gain.gain.setValueAtTime(MIXAGES[mixage][nom] * force, 0);
          else gain.gain.setTargetAtTime(MIXAGES[mixage][nom] * force, heure, 0.35);
        }
        applique = mixage;
      }
    }
    jouerPas(table, orchestre, partition, numeroPas, heure, couches);
    numeroPas++;
    heure += partition.dureePas;
  }
}

// ── Une situation de jeu (voir situations.js) ──
// musique, effets : les jouer ou non ; compresseur : comme dans le jeu, ou contourné ;
// lireReduction : noter, toutes les 50 ms, de combien le compresseur baisse le son (en dB).
// Renvoie { canaux, fe, reduction: [dB…] (si demandée), joues: {nom: n}, refuses: {nom: n}, departs } :
// refuses = les départs empêchés par les limites des bruitages (voir effets.js) ; departs = chaque
// bruitage demandé, avec son heure et s'il a joué : [{ t, nom, joue }].
//
// Le calcul commence une seconde plus tôt (la musique joue déjà), et cette seconde est jetée : au
// tout début, le compresseur « démarre à froid » et baisse le son pour rien (de 12 dB, pendant une
// demi-seconde). Dans le jeu, il tourne depuis longtemps.
export const PAS_REDUCTION = 0.05;
const CHAUFFE = 1;
export async function rendreSituation(enregistrement, epoque, { musique = true, effets = true, compresseur = true, lireReduction = false, graine = 12345, reglages = null, volumes = OPTIONS_DE_BASE } = {}) {
  const orchestre = ORCHESTRES[epoque];
  const { duree } = enregistrement;
  const ctx = new OfflineAudioContext(2, Math.ceil(FE * (CHAUFFE + duree)), FE);
  const joues = {}, refuses = {}, departs = [];
  let table = null;
  avecReglages(reglages, () => avecGraine(graine, () => {
    table = preparerTable(ctx, orchestre, compresseur);
    table.musique.volume.gain.value = musique ? volumes.musique * orchestre.volume : 0;
    table.effets.volume.gain.value = effets ? volumes.effets : 0;
    if (musique) planifierMusique(table, orchestre, (t) => mixageA(enregistrement, t - CHAUFFE), CHAUFFE + duree);
    if (!effets) return;
    const garde = creerGarde();
    for (const e of enregistrement.evenements) {
      const recette = BRUITAGES[recetteDe(e.nom, e.ev)];
      if (!recette) continue; // un événement sans bruitage (un projectile qui touche, un monstre qui s'échappe)
      if (!garde(e.nom, e.t)) { refuses[e.nom] = (refuses[e.nom] || 0) + 1; departs.push({ t: e.t, nom: e.nom, joue: false }); continue; }
      joues[e.nom] = (joues[e.nom] || 0) + 1;
      departs.push({ t: e.t, nom: e.nom, joue: true });
      jouerRecette(recette, outilsBruitages(table, orchestre, { pan: e.pan, debut: CHAUFFE + e.t + 0.005 }), e.ev);
    }
    if (enregistrement.bourdon.length) {
      const bourdon = creerBourdon(table, orchestre, CHAUFFE);
      for (const b of enregistrement.bourdon) bourdon.regler(b.volume, b.frequence, CHAUFFE + b.t);
    }
  }));
  // de combien le compresseur baisse le son : on arrête le calcul toutes les 50 ms pour le lire
  const reduction = [];
  if (lireReduction && compresseur) {
    for (let k = 1; k * PAS_REDUCTION < duree - 1e-6; k++) { // (pas pile à la fin : le calcul serait déjà fini)
      ctx.suspend(CHAUFFE + k * PAS_REDUCTION).then(() => { reduction.push(table.compresseur.reduction); ctx.resume(); });
    }
  }
  const tampon = await ctx.startRendering();
  const debut = Math.round(CHAUFFE * FE);
  return { canaux: canauxDe(tampon).map((c) => c.subarray(debut)), fe: FE, reduction, joues, refuses, departs };
}
