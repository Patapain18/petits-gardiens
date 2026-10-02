// ─────────────────────────────────────────────────────────────
// LE CHEF D'ORCHESTRE DU SON
// - il joue la musique : le thème (partition.js) avec l'orchestre de
//   l'époque (orchestres.js), et la fait vivre avec la partie : calme
//   entre les vagues, batterie pendant une vague, et le thème des chefs
//   quand le Colosse ou le Dragon est là ;
// - il joue les bruitages des événements du jeu (effets.js) ;
// - il règle les volumes d'après les options du joueur (src/options.js).
//
// Les navigateurs interdisent de faire du bruit avant que le joueur ait
// cliqué quelque part : rien ne commence avant debloquer(), appelé au
// premier clic ou à la première touche.
// ─────────────────────────────────────────────────────────────
import { creerTable, reponseSalle, jouerNote, jouerBruit, frequence } from './synthe.js';
import { THEME, THEME_CHEF, JINGLES, PAS_PAR_MESURE, lirePartition } from './partition.js';
import { ORCHESTRES } from './orchestres.js';
import { RECETTES, LIMITES } from './effets.js';
import { MONSTRES } from '../jeu/donnees.js';
import { lireOptions, changerOptions, quandOptionsChangent } from '../options.js';

const AVANCE = 0.15;              // les notes sont préparées 0,15 s avant d'être jouées

// Le volume de chaque couche de la musique, selon le moment de la partie
// (« chef » : c'est le thème des chefs qui joue, avec toutes ses couches)
export const MIXAGES = {
  calme: { melodie: 0.55, accords: 1, basse: 0.8, batterie: 0, chef: 0 },
  vague: { melodie: 1, accords: 1, basse: 1, batterie: 1, chef: 0 },
  chef: { melodie: 1, accords: 1, basse: 1, batterie: 1, chef: 1 },
};
const COUCHES = Object.keys(MIXAGES.calme);

// Les partitions sont lues une seule fois, au chargement
export const THEME_LU = lirePartition(THEME);
export const THEME_CHEF_LU = lirePartition(THEME_CHEF);
const JINGLES_LUS = Object.fromEntries(Object.entries(JINGLES).map(([nom, p]) => [nom, lirePartition(p)]));

// ── Jouer une note de la partition ───────────────────────────
// Ces fonctions servent au jeu, et aussi aux vérifications sans haut-parleur
// (on peut les faire jouer dans un contexte audio « hors ligne », qui calcule le son sans l'entendre).

// Un instrument de l'orchestre : une note (ondes) ou un bruit (tambours)
export function jouerInstrument(table, instrument, { numero, frequence: f, debut, duree, volume = 1, sortie, pan = 0 }) {
  if (instrument.bruit) {
    return jouerBruit(table, {
      debut, duree, volume: volume * instrument.volume, sortie, pan,
      bruit: instrument.bruit, filtre: instrument.filtre, enveloppe: instrument.enveloppe,
    });
  }
  return jouerNote(table, instrument, { frequence: f ?? frequence(numero), debut, duree, volume, sortie, pan });
}

// Une note de la mélodie. Avec un marimba (au cartoon), les notes longues sont
// « roulées » : la lame est refrappée à chaque croche, de plus en plus doucement.
function jouerMelodie(table, instrument, note, debut, dureePas, sortie) {
  if (instrument.roulement && note.duree >= 8) {
    for (let k = 0; k < note.duree; k += 2) {
      jouerInstrument(table, instrument, { numero: note.numero, debut: debut + k * dureePas, duree: 2 * dureePas, volume: 1 - k / (note.duree * 1.6), sortie });
    }
    return;
  }
  jouerInstrument(table, instrument, { numero: note.numero, debut, duree: note.duree * dureePas * 0.92, sortie });
}

// Tout ce qui joue à un pas de la musique : la mélodie de la partition, et
// l'accompagnement que l'orchestre arrange. sorties = { melodie, accords, … } :
// où brancher chaque couche. parties = les couches à jouer (toutes, par défaut).
// Le thème des chefs a son propre arrangement, et sa propre mélodie (melodieChef).
export function jouerPas(table, orchestre, partition, numeroPas, debut, sorties, parties = COUCHES) {
  const numeroMesure = Math.floor(numeroPas / PAS_PAR_MESURE) % partition.mesures.length;
  const mesure = partition.mesures[numeroMesure];
  const pas = numeroPas % PAS_PAR_MESURE;
  const chef = partition.arrangement === 'chef';
  if (parties.includes('melodie')) {
    const instrument = (chef && orchestre.instruments.melodieChef) || orchestre.instruments.melodie;
    for (const note of mesure.notes) if (note.pas === pas) jouerMelodie(table, instrument, note, debut, partition.dureePas, sorties.melodie);
  }
  const accompagnement = chef ? orchestre.arrangerChef(pas, mesure.accord, numeroMesure) : orchestre.arranger(pas, mesure.accord, numeroMesure);
  for (const e of accompagnement) {
    if (!parties.includes(e.partie)) continue;
    jouerInstrument(table, orchestre.instruments[e.instrument], {
      numero: e.numero, debut: debut + (e.retard ?? 0), duree: e.duree * partition.dureePas, volume: e.volume ?? 1, sortie: sorties[e.partie],
    });
  }
}

// La réverbération de l'époque : la taille de la salle et la part de son qu'on y envoie
export function appliquerReverb(table, orchestre) {
  const t = table.ctx.currentTime;
  table.reverb.buffer = reponseSalle(table.ctx, orchestre.reverb.duree);
  table.musique.envoi.gain.setTargetAtTime(orchestre.reverb.envoi, t, 0.05);
  table.effets.envoi.gain.setTargetAtTime(orchestre.reverb.envoi * 0.8, t, 0.05);
}

// Une couche de musique = un petit bouton de volume, branché sur la tranche « musique »
export function creerCouches(table) {
  return Object.fromEntries(COUCHES.map((nom) => {
    const g = table.ctx.createGain();
    g.gain.value = 0;
    g.connect(table.musique.volume);
    return [nom, g];
  }));
}

// Les outils des recettes de bruitages (voir effets.js), branchés sur une époque.
// pan : d'où vient le son, de -1 (à gauche) à 1 (à droite) ; debut : quand il commence
export function outilsBruitages(table, orchestre, { pan = 0, debut = table.ctx.currentTime + 0.005 } = {}) {
  const sortie = table.effets.volume;
  const inst = orchestre.instruments;
  const varier = () => 1 + (Math.random() - 0.5) * 0.06; // ±3 % : deux tirs ne sonnent jamais pareil
  const sonner = (instrument, f, { duree = 0.1, volume = 1, de, retard = 0 }) => {
    const choisi = de ? { ...instrument, glisse: { de, duree: Math.min(duree, 0.12) } } : instrument;
    jouerNote(table, choisi, { frequence: f, debut: debut + retard, duree, volume, sortie, pan });
  };
  return {
    bip: (f, options = {}) => sonner(inst.timbre, f * varier(), options),
    note: (numero, options = {}) => sonner(inst.timbre, frequence(numero), options),
    arpege: (numeros, { ecart = 0.06, retard = 0, ...options } = {}) =>
      numeros.forEach((numero, k) => sonner(inst.timbre, frequence(numero), { ...options, retard: retard + k * ecart })),
    grave: (f, options = {}) => sonner(inst.grave, f * varier(), options),
    coup: ({ volume = 1, retard = 0 } = {}) =>
      jouerInstrument(table, inst.kick, { numero: inst.kick.note, debut: debut + retard, duree: 0.12, volume, sortie, pan }),
    bruit: ({ duree = 0.2, volume = 1, type = 'lowpass', de = 1000, a, q, retard = 0 }) =>
      jouerBruit(table, {
        debut: debut + retard, duree, volume: volume * orchestre.forceBruit, sortie, pan, bruit: orchestre.bruit,
        // la brillance de l'époque : au voxel, les filtres sont plus fermés, le son plus feutré
        filtre: { type, de: de * orchestre.brillance, a: (a ?? de) * orchestre.brillance, q },
      }),
  };
}

// ═════════════════════════════════════════════════════════════
// Le chef d'orchestre
// musique : le thème démarre-t-il tout seul au premier clic ? (pas dans la salle des sons)
// ═════════════════════════════════════════════════════════════
export function creerSon({ musique = true } = {}) {
  let table = null;              // la table de mixage, fabriquée au premier clic
  let couches = null;            // le volume de chaque couche de musique
  let sortieJingle = null;       // les petites musiques de fin ont leur propre tranche
  let orchestre = ORCHESTRES.pixel;
  let reglages = lireOptions(); // les volumes (musique, effets) et « coupe » viennent des options

  // le séquenceur : il avance de pas en pas (une double croche à chaque fois)
  let themeVoulu = musique;      // le thème doit-il jouer ? (non pendant une musique de fin)
  let minuterie = null;
  let partition = THEME_LU;      // la partition en cours : le thème principal ou celui des chefs
  let numeroPas = 0;             // le pas en cours, compté depuis le début de la partition
  let heurePas = 0;              // l'heure (du contexte audio) du prochain pas à jouer
  let mixage = 'calme', mixageApplique = null;

  // les bruitages
  const departs = new Map();     // pour chaque bruitage : l'heure de ses derniers départs
  let bourdon = null;            // le bourdonnement des rayons du Prisme
  let pauseAppliquee = false;    // le filtre de la pause est-il fermé ?
  const chefsVus = new Set();    // les chefs déjà annoncés

  // ── Démarrer ──
  function debloquer() {
    if (!table) {
      const Contexte = window.AudioContext || window.webkitAudioContext;
      if (!Contexte) return; // un très vieux navigateur : le jeu marche, sans le son
      table = creerTable(new Contexte());
      couches = creerCouches(table);
      sortieJingle = table.ctx.createGain();
      sortieJingle.connect(table.musique.volume);
      appliquerReverb(table, orchestre);
      appliquerVolumes();
      if (themeVoulu) demarrerTheme();
    }
    if (table.ctx.state === 'suspended' && !document.hidden) table.ctx.resume();
  }

  function appliquerVolumes() {
    if (!table) return;
    const t = table.ctx.currentTime;
    // le volume choisi par le joueur, ajusté pour que les trois orchestres sonnent aussi fort
    table.musique.volume.gain.setTargetAtTime(reglages.musique * orchestre.volume, t, 0.05);
    table.effets.volume.gain.setTargetAtTime(reglages.effets, t, 0.05);
    table.general.gain.setTargetAtTime(reglages.coupe ? 0 : 1, t, 0.05);
  }

  // ── La musique ──
  function demarrerTheme() {
    themeVoulu = true;
    if (!table) return; // elle démarrera au premier clic
    clearInterval(minuterie);
    partition = mixage === 'chef' ? THEME_CHEF_LU : THEME_LU;
    numeroPas = 0;
    heurePas = table.ctx.currentTime + 0.1;
    mixageApplique = null;
    // toutes les 25 millisecondes, on prépare les notes des 0,15 prochaines secondes
    minuterie = setInterval(planifier, 25);
    planifier();
  }

  function planifier() {
    const maintenant = table.ctx.currentTime;
    // si le navigateur nous a laissés dormir (onglet caché), on reprend à l'heure actuelle
    // au lieu de jouer d'un coup toutes les notes en retard
    if (heurePas < maintenant - 0.05) heurePas = maintenant + 0.05;
    while (heurePas < maintenant + AVANCE) {
      if (numeroPas % PAS_PAR_MESURE === 0) {
        // au début d'une mesure : un chef vient d'arriver (ou de tomber) ? On change de
        // partition, et la nouvelle repart de sa première mesure
        const voulue = mixage === 'chef' ? THEME_CHEF_LU : THEME_LU;
        if (voulue !== partition) { partition = voulue; numeroPas = 0; }
        appliquerMixage(heurePas);
      }
      jouerPas(table, orchestre, partition, numeroPas, heurePas, couches);
      numeroPas++;
      heurePas += partition.dureePas; // le thème des chefs va un peu plus vite
    }
  }

  // Le mixage change au début d'une mesure : les couches montent ou descendent doucement
  // (le thème des chefs est un peu plus fort : volumeChef, propre à chaque orchestre)
  function appliquerMixage(heure) {
    if (mixage === mixageApplique) return;
    const force = mixage === 'chef' ? orchestre.volumeChef : 1;
    for (const nom of COUCHES) couches[nom].gain.setTargetAtTime(MIXAGES[mixage][nom] * force, heure, 0.35);
    mixageApplique = mixage;
  }

  function arreterTheme() {
    themeVoulu = false;
    clearInterval(minuterie);
    minuterie = null;
    if (!table) return;
    const t = table.ctx.currentTime;
    for (const nom of COUCHES) couches[nom].gain.setTargetAtTime(0, t, 0.12);
    mixageApplique = null;
  }

  // Une petite musique de fin (victoire, défaite), à la place du thème
  function jingle(nom) {
    arreterTheme();
    if (!table) return;
    const musiqueDeFin = JINGLES_LUS[nom];
    const debut = table.ctx.currentTime + 0.2;
    const sorties = { melodie: sortieJingle, accords: sortieJingle, basse: sortieJingle };
    for (let n = 0; n < musiqueDeFin.mesures.length * PAS_PAR_MESURE; n++) {
      jouerPas(table, orchestre, musiqueDeFin, n, debut + n * musiqueDeFin.dureePas, sorties, ['melodie', 'accords', 'basse']);
    }
  }

  // ── Changer d'époque (quand on change de style) ──
  function choisirEpoque(nom) {
    if (!ORCHESTRES[nom] || ORCHESTRES[nom] === orchestre) return;
    orchestre = ORCHESTRES[nom];
    if (!table) return;
    appliquerReverb(table, orchestre);
    appliquerVolumes();
    mixageApplique = null; // le mixage sera refait à la prochaine mesure, avec les volumes de cet orchestre
    if (bourdon) { bourdon.arreter(); bourdon = null; } // il sera refait avec les instruments de la nouvelle époque
  }

  // ── Les bruitages ──
  // Un bruitage a-t-il le droit de jouer maintenant ? (voir LIMITES dans effets.js)
  function autorise(nom) {
    const { max, ecart } = LIMITES[nom] || LIMITES.defaut;
    const t = table.ctx.currentTime;
    const recents = (departs.get(nom) || []).filter((heure) => heure > t - 0.3);
    if (recents.length >= max || recents.some((heure) => heure > t - ecart)) return false;
    recents.push(t);
    departs.set(nom, recents);
    return true;
  }

  // Joue un bruitage par son nom (« clic », « vague »…), s'il a le droit
  function effet(nom, ev = {}, pan = 0) {
    if (!table || table.ctx.state !== 'running' || !RECETTES[nom] || !autorise(nom)) return;
    RECETTES[nom](outilsBruitages(table, orchestre, { pan }), ev);
  }

  // Les événements du moteur (une liste par image). largeur = celle de la carte,
  // pour savoir si un son vient de la gauche ou de la droite.
  function evenements(liste, largeur) {
    if (!table) return;
    for (const ev of liste) {
      const nom = ev.type === 'tir' ? `tir:${ev.quoi}` : ev.type;
      const pan = ev.x !== undefined ? Math.max(-1, Math.min(1, (ev.x / largeur) * 2 - 1)) * 0.6 : 0;
      effet(nom, ev, pan);
    }
  }

  // ── À chaque image : la musique suit la partie ──
  function maj(etat, { pause = false } = {}) {
    if (!table) return;
    const enJeu = etat.statut === 'vague';
    const chefs = enJeu ? etat.ennemis.filter((e) => MONSTRES[e.type].boss) : [];
    mixage = chefs.length ? 'chef' : enJeu ? 'vague' : 'calme';
    // un chef qui arrive : un grand coup de tonnerre
    for (const c of chefs) {
      if (chefsVus.has(c.id)) continue;
      chefsVus.add(c.id);
      effet('chef');
    }
    // en pause, la musique passe « derrière une porte » (on coupe ses aigus). On ne change le filtre
    // que quand la pause commence ou finit : un ordre par image encombrerait le moteur audio.
    if (pause !== pauseAppliquee) {
      table.sourdine.frequency.setTargetAtTime(pause ? 600 : 20000, table.ctx.currentTime, 0.15);
      pauseAppliquee = pause;
    }
    majBourdon(etat, pause);
  }

  // Le bourdonnement des rayons du Prisme : plus il y a de rayons, plus il est fort,
  // et il monte quand un rayon chauffe
  function majBourdon(etat, pause) {
    const rayons = pause ? [] : etat.tours.filter((t) => t.rayon);
    if (!bourdon && !rayons.length) return;
    if (!bourdon) bourdon = creerBourdon();
    const chauffe = rayons.reduce((m, tour) => Math.max(m, tour.chauffe || 0), 0);
    bourdon.regler(Math.min(1, rayons.length / 3) * 0.05, 196 * (1 + chauffe * 0.5));
  }

  function creerBourdon() {
    const { ctx } = table;
    const volume = ctx.createGain();
    volume.gain.value = 0;
    const filtre = ctx.createBiquadFilter();
    filtre.frequency.value = 4000 * orchestre.brillance;
    volume.connect(filtre);
    filtre.connect(table.effets.volume);
    // deux ondes de la forme du « timbre » de l'époque, à l'octave l'une de l'autre,
    // un tout petit peu désaccordées : elles « battent » ensemble, ça scintille
    const forme = orchestre.instruments.timbre.ondes[0].forme;
    const oscs = [1, 2.006].map((ratio) => {
      const osc = ctx.createOscillator();
      if (table.ondes[forme]) osc.setPeriodicWave(table.ondes[forme]); else osc.type = forme;
      osc.connect(volume);
      osc.start();
      return { osc, ratio };
    });
    // on ne donne un nouvel ordre que si le volume ou la hauteur ont vraiment changé
    let volumeDonne = -1, frequenceDonnee = -1;
    return {
      regler(v, f) {
        const t = ctx.currentTime;
        if (Math.abs(v - volumeDonne) > 0.002) { volume.gain.setTargetAtTime(v, t, 0.08); volumeDonne = v; }
        if (Math.abs(f - frequenceDonnee) > f * 0.01) {
          oscs.forEach(({ osc, ratio }) => osc.frequency.setTargetAtTime(f * ratio, t, 0.1));
          frequenceDonnee = f;
        }
      },
      arreter: () => {
        volume.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
        oscs.forEach(({ osc }) => osc.stop(ctx.currentTime + 0.3));
      },
    };
  }

  // Quand une option change (la fenêtre des options, la touche M…), les volumes suivent
  quandOptionsChangent((options) => { reglages = options; appliquerVolumes(); });

  // L'onglet est caché : on met le son en pause (et on le reprend en revenant)
  document.addEventListener('visibilitychange', () => {
    if (!table) return;
    if (document.hidden) table.ctx.suspend(); else table.ctx.resume();
  });

  return {
    debloquer,
    choisirEpoque,
    evenements,
    effet,
    maj,
    jingle,
    // une nouvelle partie : le thème repart du début, au calme (ou directement avec
    // un autre mixage, pour la salle des sons)
    recommencer(mixageDeDepart = 'calme') { chefsVus.clear(); mixage = mixageDeDepart; demarrerTheme(); },
    arreterTheme,
    // pour la salle des sons : forcer un mixage (calme, vague, chef)
    forcerMixage(nom) { mixage = nom; },
    get reglages() { return { musique: reglages.musique, effets: reglages.effets, coupe: reglages.coupe }; },
    // changer un volume (ex. : regler({ coupe: true })) : c'est une option comme les autres
    regler(changements) { changerOptions(changements); },
    get actif() { return Boolean(table) && table.ctx.state === 'running'; },
    // ce qui joue en ce moment (pour vérifier, depuis la console) : quel thème, et quel mixage
    get enCours() {
      if (!minuterie) return { theme: null, mixage };
      return { theme: partition === THEME_CHEF_LU ? 'chefs' : 'principal', mixage, mesure: Math.floor(numeroPas / PAS_PAR_MESURE) + 1 };
    },
  };
}
