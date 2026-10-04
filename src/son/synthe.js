// ─────────────────────────────────────────────────────────────
// LE PETIT SYNTHÉTISEUR
// Tous les sons du jeu sont fabriqués ici, avec l'API Web Audio du
// navigateur : pas un seul fichier son, donc pas de droits d'auteur.
//
// Un son, c'est :
// - une ou plusieurs « ondes » (des oscillateurs qui vibrent à une
//   fréquence : 440 vibrations par seconde = la note La), ou du bruit ;
// - un filtre, qui rend le son plus sourd ou plus brillant ;
// - une « enveloppe » de volume : le son monte (attaque), retombe
//   (décroissance), tient (maintien), puis s'éteint (relâche).
//
// Ce fichier ne sait rien du jeu : il fabrique des notes et des bruits.
// ─────────────────────────────────────────────────────────────

// ── Les notes ────────────────────────────────────────────────
// Chaque note a un numéro (celui de la norme MIDI) : le Do du milieu du
// piano (C4) est le 60, et chaque demi-ton ajoute 1.
const DEMI_TONS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// « C4 » → 60, « F#5 » → 78, « Bb3 » → 58 (# = dièse, b = bémol)
export function numeroNote(nom) {
  const m = /^([A-G])([#b]?)(\d)$/.exec(nom);
  if (!m) throw new Error(`Note inconnue : « ${nom} » (exemples : C4, F#5, Bb3)`);
  return 12 * (Number(m[3]) + 1) + DEMI_TONS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

// La fréquence d'une note : le La4 (numéro 69) vibre 440 fois par seconde,
// et monter d'un demi-ton multiplie la fréquence par la racine 12e de 2
// (douze demi-tons plus haut, c'est l'octave : deux fois plus vite).
export const frequence = (numero) => 440 * 2 ** ((numero - 69) / 12);

// ── La table de mixage ───────────────────────────────────────
// Tous les sons arrivent sur deux tranches, « musique » et « effets »
// (chacune a son volume), puis passent par un compresseur : quand beaucoup
// de sons jouent en même temps, il baisse un peu le tout au lieu de saturer.
// La musique passe aussi par un filtre, qui l'assourdit quand le jeu est en pause.
// Les deux tranches envoient une part de leur son dans une réverbération
// (l'écho d'une salle) : grande au voxel, petite au cartoon, aucune au pixel.
export function creerTable(ctx) {
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -14;
  compresseur.knee.value = 10;
  compresseur.ratio.value = 4;
  compresseur.attack.value = 0.004;
  compresseur.release.value = 0.25;
  compresseur.connect(ctx.destination);

  const general = ctx.createGain();
  general.connect(compresseur);

  const reverb = ctx.createConvolver();
  reverb.connect(general);

  const tranche = (avantSortie) => {
    const volume = ctx.createGain();
    const envoi = ctx.createGain(); // la part envoyée dans la réverbération
    envoi.gain.value = 0;
    volume.connect(avantSortie);
    volume.connect(envoi);
    envoi.connect(reverb);
    return { volume, envoi };
  };

  const sourdine = ctx.createBiquadFilter(); // le filtre de la pause
  sourdine.type = 'lowpass';
  sourdine.frequency.value = 20000;
  sourdine.connect(general);

  return {
    ctx,
    compresseur, // (l'atelier du son lit de combien il baisse le son)
    general,
    reverb,
    sourdine,
    musique: tranche(sourdine),
    effets: tranche(general),
    bruits: creerBruits(ctx),
    ondes: creerOndes(ctx),
  };
}

// L'écho d'une salle, fabriqué avec du bruit qui s'éteint doucement :
// c'est la « réponse » de la salle à un clap très court (une réponse impulsionnelle).
// Plus elle dure, plus la salle paraît grande.
export function reponseSalle(ctx, duree) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * duree));
  const tampon = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const d = tampon.getChannelData(canal);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) ** 3;
  }
  return tampon;
}

// ── Les bruits ───────────────────────────────────────────────
// Du bruit blanc (des valeurs au hasard) sert à fabriquer les explosions,
// le vent, les tambours… Le bruit « console » imite celui des vieilles
// consoles : chaque valeur est répétée plusieurs fois, ce qui donne un grain
// plus gros, plus « 8 bits ».
function creerBruits(ctx) {
  const fabriquer = (repetition) => {
    const tampon = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); // 1 seconde
    const d = tampon.getChannelData(0);
    let valeur = 0;
    for (let i = 0; i < d.length; i++) {
      // ±0,58 : un bruit qui vaut toujours tout en haut ou tout en bas serait bien plus fort que le bruit blanc
      if (i % repetition === 0) valeur = Math.random() < 0.5 ? -0.58 : 0.58;
      d[i] = repetition === 1 ? Math.random() * 2 - 1 : valeur;
    }
    return tampon;
  };
  return { blanc: fabriquer(1), console: fabriquer(6) };
}

// ── Les formes d'onde ────────────────────────────────────────
// Le navigateur connaît quatre formes : 'sine' (sinus, très doux), 'triangle',
// 'square' (carrée) et 'sawtooth' (dent de scie, riche et brillante).
// Les consoles 8 bits avaient aussi des carrées « plus fines » (des impulsions) :
// on les fabrique en additionnant des sinus (une série de Fourier).
// rapport = la part du temps où l'onde est en haut (0,5 = une carrée normale).
function creerOndes(ctx) {
  const impulsion = (rapport) => {
    const n = 64;
    const reel = new Float32Array(n), imaginaire = new Float32Array(n);
    for (let k = 1; k < n; k++) reel[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * rapport);
    return ctx.createPeriodicWave(reel, imaginaire);
  };
  return { impulsion25: impulsion(0.25), impulsion12: impulsion(0.125) };
}

// Branche une forme d'onde sur un oscillateur
function choisirForme(table, osc, forme) {
  if (table.ondes[forme]) osc.setPeriodicWave(table.ondes[forme]);
  else osc.type = forme;
}

// ── L'enveloppe de volume ────────────────────────────────────
// Le volume monte en « attaque » secondes, retombe vers « maintien » (une part
// du volume) en « decroissance » secondes, tient jusqu'à la fin de la note,
// puis s'éteint en « relache » secondes. Renvoie le moment où tout est fini.
function envelopper(gain, debut, duree, volume, { attaque = 0.005, decroissance = 0.1, maintien = 0.7, relache = 0.1 } = {}) {
  const fin = debut + Math.max(duree, attaque);
  gain.setValueAtTime(0, debut);
  gain.linearRampToValueAtTime(volume, debut + attaque);
  // setTargetAtTime glisse vers une valeur, en ralentissant (comme un objet qui freine)
  gain.setTargetAtTime(volume * maintien, debut + attaque, decroissance / 3 + 0.001);
  gain.setTargetAtTime(0, fin, relache / 4 + 0.001);
  return fin + relache;
}

// ── Jouer une note ───────────────────────────────────────────
// instrument = une description en données (voir src/son/orchestres.js) :
//   ondes      : la liste des oscillateurs mélangés, chacun avec sa forme,
//                son « ratio » (2 = une octave au-dessus), son volume et son
//                désaccord en centièmes de demi-ton (deux ondes un peu
//                désaccordées donnent un son plus large, comme un chœur) ;
//   enveloppe  : attaque, décroissance, maintien, relâche ;
//   filtre     : { type: 'lowpass', frequence, q } (lowpass = ne garde que les graves) ;
//   glisse     : la note part plus haut (ou plus bas) et glisse vers sa fréquence
//                (« de » = 2 : elle part une octave au-dessus) en « duree » secondes ;
//   vibrato    : la fréquence tremble un peu (« vitesse » fois par seconde) ;
//   volume     : le volume de l'instrument.
// options : frequence (en Hz), debut (l'heure du contexte audio), duree,
//   volume (multiplié par celui de l'instrument), sortie (où brancher le son),
//   pan (de -1 = à gauche à 1 = à droite).
export function jouerNote(table, instrument, { frequence: f, debut, duree, volume = 1, sortie, pan = 0 }) {
  const { ctx } = table;
  const gain = ctx.createGain();
  let dernier = gain;
  if (instrument.filtre) {
    const filtre = ctx.createBiquadFilter();
    filtre.type = instrument.filtre.type || 'lowpass';
    filtre.frequency.value = instrument.filtre.frequence;
    filtre.Q.value = instrument.filtre.q ?? 0.7;
    gain.connect(filtre);
    dernier = filtre;
  }
  if (pan) {
    const panoramique = ctx.createStereoPanner();
    panoramique.pan.value = pan;
    dernier.connect(panoramique);
    dernier = panoramique;
  }
  dernier.connect(sortie);

  const fin = envelopper(gain.gain, debut, duree, volume * (instrument.volume ?? 1), instrument.enveloppe);
  for (const onde of instrument.ondes) {
    const osc = ctx.createOscillator();
    choisirForme(table, osc, onde.forme);
    const cible = f * (onde.ratio ?? 1);
    if (instrument.glisse) {
      osc.frequency.setValueAtTime(cible * instrument.glisse.de, debut);
      osc.frequency.exponentialRampToValueAtTime(cible, debut + instrument.glisse.duree);
    } else {
      osc.frequency.setValueAtTime(cible, debut);
    }
    osc.detune.value = onde.desaccord ?? 0;
    if (instrument.vibrato) {
      // un tout petit oscillateur très lent qui fait trembler la fréquence
      const lfo = ctx.createOscillator(), profondeur = ctx.createGain();
      lfo.frequency.value = instrument.vibrato.vitesse;
      profondeur.gain.setValueAtTime(0, debut);
      profondeur.gain.linearRampToValueAtTime(cible * instrument.vibrato.profondeur, debut + (instrument.vibrato.retard ?? 0) + 0.05);
      lfo.connect(profondeur);
      profondeur.connect(osc.frequency);
      lfo.start(debut);
      lfo.stop(fin);
    }
    let sortieOnde = gain;
    if (onde.volume !== undefined && onde.volume !== 1) {
      const g = ctx.createGain();
      g.gain.value = onde.volume;
      g.connect(gain);
      sortieOnde = g;
    }
    osc.connect(sortieOnde);
    osc.start(debut);
    osc.stop(fin);
  }
  return fin;
}

// ── Jouer un bruit ───────────────────────────────────────────
// options : debut, duree, volume, sortie, pan, et :
//   bruit   : 'blanc' ou 'console' ;
//   filtre  : { type: 'bandpass', de, a, q } : la fréquence du filtre glisse de « de » à « a »
//             (un bruit qui descend dans les graves = une explosion qui s'éloigne) ;
//   enveloppe : comme pour une note.
export function jouerBruit(table, { debut, duree, volume = 1, sortie, pan = 0, bruit = 'blanc', filtre = null, enveloppe = {} }) {
  const { ctx } = table;
  const source = ctx.createBufferSource();
  source.buffer = table.bruits[bruit];
  source.loop = true;
  const gain = ctx.createGain();
  let dernier = gain;
  if (filtre) {
    const f = ctx.createBiquadFilter();
    f.type = filtre.type || 'lowpass';
    f.Q.value = filtre.q ?? 0.7;
    f.frequency.setValueAtTime(filtre.de, debut);
    if (filtre.a && filtre.a !== filtre.de) f.frequency.exponentialRampToValueAtTime(filtre.a, debut + duree);
    gain.connect(f);
    dernier = f;
  }
  if (pan) {
    const panoramique = ctx.createStereoPanner();
    panoramique.pan.value = pan;
    dernier.connect(panoramique);
    dernier = panoramique;
  }
  dernier.connect(sortie);
  const fin = envelopper(gain.gain, debut, duree, volume, { attaque: 0.002, decroissance: duree, maintien: 0, relache: 0.05, ...enveloppe });
  source.connect(gain);
  // on démarre à un endroit au hasard du bruit, pour que deux bruits ne soient jamais identiques
  source.start(debut, Math.random() * 0.9);
  source.stop(fin);
  return fin;
}
