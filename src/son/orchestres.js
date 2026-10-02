// ─────────────────────────────────────────────────────────────
// LES TROIS ORCHESTRES
// Chaque époque joue le même thème (partition.js) avec ses propres
// instruments, et fait aussi ses bruitages avec eux :
// - pixel   : une console des années 1990 (ondes carrées, bruit à gros grain, aucun écho) ;
// - cartoon : un orchestre de dessin animé des années 2000 (marimba, basse qui sautille, wood-block) ;
// - voxel   : aujourd'hui (piano doux, nappes de cordes, beaucoup d'écho, batterie feutrée).
//
// Un instrument est décrit en données (voir jouerNote dans synthe.js) :
// ses ondes, son enveloppe, son filtre… Un instrument de « bruit »
// (les tambours, les cymbales) a un champ bruit à la place des ondes.
// La grosse caisse (kick) dit aussi sur quelle note elle tape (note).
//
// arranger(pas, accord, mesure) dit ce que joue l'accompagnement à chaque
// double croche de la mesure (pas = 0 à 15 ; mesure = le numéro de la mesure
// dans la partition) : une liste de { partie, instrument, numero (la note),
// duree (en pas), volume, retard (en secondes) }.
// Les parties : 'accords', 'basse', 'batterie' et 'chef' (une couche inquiétante).
// Chaque orchestre a deux arrangements : arranger pour le thème principal, et
// arrangerChef, plus pressant, pour le thème des chefs (avec la couche 'chef').
// La mélodie, elle, vient directement de la partition : elle est jouée par
// l'instrument « melodie », ou « melodieChef » pour le thème des chefs.
// ─────────────────────────────────────────────────────────────

// Quelques aides pour placer les notes d'un accord dans une octave
// (accord.fondamentale va de 0 = Do à 11 = Si ; octave 4 = autour du Do du milieu)
const dans = (accord, octave) => 12 * (octave + 1) + accord.fondamentale;
const tierce = (accord) => accord.notes[1]; // 3 ou 4 demi-tons au-dessus de la fondamentale
const QUINTE = 7;

// ═════════════════════════════════════════════════════════════
// PIXEL : la console 8 bits
// ═════════════════════════════════════════════════════════════
const pixel = {
  nom: 'Console 8 bits',
  volume: 0.6,                      // le volume de l'orchestre : les trois époques sonnent aussi fort
  volumeChef: 1.23,                 // le thème des chefs, un peu plus fort que le thème principal
  reverb: { envoi: 0, duree: 0.5 }, // une vieille console n'a pas d'écho
  bruit: 'console',                 // le bruit à gros grain
  brillance: 1,                     // les filtres des bruitages restent ouverts : un son vif
  forceBruit: 1,                    // le volume des bruits des bruitages (voir les deux autres époques)
  instruments: {
    // une impulsion fine, avec un petit vibrato qui arrive après le début de la note
    melodie: { ondes: [{ forme: 'impulsion25' }], enveloppe: { attaque: 0.003, decroissance: 0.15, maintien: 0.6, relache: 0.05 }, vibrato: { vitesse: 6, profondeur: 0.008, retard: 0.18 }, volume: 0.16 },
    arpege: { ondes: [{ forme: 'impulsion12' }], enveloppe: { attaque: 0.002, decroissance: 0.05, maintien: 0.5, relache: 0.02 }, volume: 0.07 },
    basse: { ondes: [{ forme: 'triangle' }], enveloppe: { attaque: 0.002, decroissance: 0.08, maintien: 0.85, relache: 0.02 }, volume: 0.3 },
    // la grosse caisse : une onde triangle qui part trois fois plus haut et tombe très vite
    kick: { ondes: [{ forme: 'triangle' }], glisse: { de: 3, duree: 0.07 }, enveloppe: { attaque: 0.001, decroissance: 0.1, maintien: 0, relache: 0.02 }, volume: 0.45, note: 45 },
    caisse: { bruit: 'console', filtre: { type: 'bandpass', de: 2500, a: 1200, q: 0.8 }, enveloppe: { decroissance: 0.12 }, volume: 0.2 },
    charley: { bruit: 'console', filtre: { type: 'highpass', de: 7000 }, enveloppe: { decroissance: 0.03 }, volume: 0.07 },
    // le thème des chefs : une carrée plus large et plus vibrante pour la mélodie (le héros !),
    // et une petite note aiguë qui clignote comme une alarme
    melodieChef: { ondes: [{ forme: 'square' }], enveloppe: { attaque: 0.003, decroissance: 0.12, maintien: 0.65, relache: 0.05 }, vibrato: { vitesse: 7, profondeur: 0.012, retard: 0.12 }, volume: 0.12 },
    alarme: { ondes: [{ forme: 'impulsion12' }], enveloppe: { attaque: 0.002, decroissance: 0.05, maintien: 0.4, relache: 0.02 }, volume: 0.045 },
    // pour les bruitages : un « bip » de console, et un son grave qui gronde
    timbre: { ondes: [{ forme: 'square' }], enveloppe: { attaque: 0.002, decroissance: 0.06, maintien: 0.5, relache: 0.03 }, volume: 0.19 },
    grave: { ondes: [{ forme: 'square' }], enveloppe: { attaque: 0.005, decroissance: 0.3, maintien: 0.4, relache: 0.1 }, volume: 0.12 },
  },
  arranger(pas, accord) {
    const notes = [];
    // des accords joués en arpège très rapide (une note par double croche) : le son des consoles,
    // qui ne pouvaient jouer que trois ou quatre notes à la fois
    const base = dans(accord, accord.fondamentale < 5 ? 4 : 3);
    const arpege = [0, tierce(accord), QUINTE, 12];
    notes.push({ partie: 'accords', instrument: 'arpege', numero: base + arpege[pas % 4], duree: 1 });
    // la basse sautille d'une octave à l'autre, à chaque croche
    if (pas % 2 === 0) notes.push({ partie: 'basse', instrument: 'basse', numero: dans(accord, 2) + (pas % 4 === 0 ? 0 : 12), duree: 1.8 });
    // la batterie : grosse caisse sur 1 et 3, caisse claire sur 2 et 4, charleston à chaque croche
    if (pas === 0 || pas === 8) notes.push({ partie: 'batterie', instrument: 'kick', numero: this.instruments.kick.note, duree: 1 });
    if (pas === 4 || pas === 12) notes.push({ partie: 'batterie', instrument: 'caisse', duree: 1 });
    if (pas % 2 === 0) notes.push({ partie: 'batterie', instrument: 'charley', duree: 1 });
    return notes;
  },
  // le thème des chefs : tout va plus vite
  arrangerChef(pas, accord, mesure) {
    const notes = [];
    // l'arpège saute d'une octave à l'autre
    const base = dans(accord, accord.fondamentale < 5 ? 4 : 3);
    const arpege = [0, 12, tierce(accord), QUINTE];
    notes.push({ partie: 'accords', instrument: 'arpege', numero: base + arpege[pas % 4], duree: 1 });
    // la basse martèle chaque double croche, en sautant d'octave
    notes.push({ partie: 'basse', instrument: 'basse', numero: dans(accord, 2) + (pas % 2 ? 12 : 0), duree: 0.9, volume: pas % 4 === 0 ? 1 : 0.75 });
    // grosse caisse sur chaque temps, caisse claire sur 2 et 4, charleston à chaque double croche ;
    // toutes les 4 mesures, un roulement de caisse claire annonce la suite
    if (pas % 4 === 0) notes.push({ partie: 'batterie', instrument: 'kick', numero: this.instruments.kick.note, duree: 1 });
    if (pas === 4 || pas === 12 || (mesure % 4 === 3 && pas >= 12)) notes.push({ partie: 'batterie', instrument: 'caisse', duree: 1 });
    notes.push({ partie: 'batterie', instrument: 'charley', duree: 1, volume: pas % 2 ? 0.5 : 1 });
    // l'alarme : la quinte de l'accord, tout en haut, qui clignote à chaque croche
    if (pas % 2 === 0) notes.push({ partie: 'chef', instrument: 'alarme', numero: dans(accord, 5) + QUINTE - 12, duree: 1, volume: pas % 4 === 0 ? 1 : 0.5 });
    return notes;
  },
};

// ═════════════════════════════════════════════════════════════
// CARTOON : l'orchestre de dessin animé
// ═════════════════════════════════════════════════════════════
const marimba = {
  // une lame de bois frappée : la note, plus deux harmoniques aiguës qui s'éteignent vite
  ondes: [{ forme: 'sine' }, { forme: 'sine', ratio: 4, volume: 0.18 }, { forme: 'sine', ratio: 9.2, volume: 0.04 }],
  enveloppe: { attaque: 0.002, decroissance: 0.5, maintien: 0, relache: 0.15 },
  volume: 0.3,
  // les notes longues sont « roulées » : la lame est refrappée à chaque croche
  roulement: true,
};
const cartoon = {
  nom: 'Orchestre de dessin animé',
  volume: 0.72,
  volumeChef: 1.14,
  reverb: { envoi: 0.12, duree: 1.2 }, // une petite salle
  bruit: 'blanc',
  brillance: 0.85,
  // le bruit blanc étale sa force sur tous les aigus : dans la bande d'un bruitage, il est
  // plus faible que le bruit « console » du pixel. On le pousse pour que ça s'entende autant.
  forceBruit: 2,
  instruments: {
    melodie: marimba,
    // des accords pincés, sur les temps 2 et 4 (le « pah » de « oum-pah »)
    pince: { ondes: [{ forme: 'triangle' }, { forme: 'sawtooth', volume: 0.2 }], filtre: { type: 'lowpass', frequence: 2200 }, enveloppe: { attaque: 0.003, decroissance: 0.15, maintien: 0.1, relache: 0.06 }, volume: 0.07 },
    // une basse ronde, comme un tuba (le « oum »)
    basse: { ondes: [{ forme: 'triangle' }, { forme: 'sine', ratio: 2, volume: 0.25 }], filtre: { type: 'lowpass', frequence: 900 }, enveloppe: { attaque: 0.01, decroissance: 0.25, maintien: 0.4, relache: 0.08 }, volume: 0.42 },
    kick: { ondes: [{ forme: 'sine' }], glisse: { de: 2.5, duree: 0.06 }, enveloppe: { attaque: 0.001, decroissance: 0.15, maintien: 0, relache: 0.03 }, volume: 0.5, note: 40 },
    // le wood-block : « toc »
    woodblock: { ondes: [{ forme: 'sine' }, { forme: 'sine', ratio: 2.7, volume: 0.4 }], enveloppe: { attaque: 0.001, decroissance: 0.04, maintien: 0, relache: 0.02 }, volume: 0.12 },
    shaker: { bruit: 'blanc', filtre: { type: 'highpass', de: 6000 }, enveloppe: { decroissance: 0.025 }, volume: 0.03 },
    // des timbales qui roulent, pour le chef
    timbale: { ondes: [{ forme: 'sine' }, { forme: 'triangle', ratio: 1.5, volume: 0.2 }], glisse: { de: 1.15, duree: 0.08 }, enveloppe: { attaque: 0.003, decroissance: 0.3, maintien: 0, relache: 0.2 }, volume: 0.25 },
    // le thème des chefs : une trompette de méchant de dessin animé (une dent de scie un peu
    // adoucie, qui démarre doucement et vibre)
    melodieChef: { ondes: [{ forme: 'sawtooth' }, { forme: 'square', volume: 0.3 }], filtre: { type: 'lowpass', frequence: 2400, q: 1 }, enveloppe: { attaque: 0.03, decroissance: 0.2, maintien: 0.7, relache: 0.08 }, vibrato: { vitesse: 5.5, profondeur: 0.01, retard: 0.2 }, volume: 0.1 },
    timbre: { ...marimba, volume: 0.18 },
    grave: { ondes: [{ forme: 'triangle' }, { forme: 'sawtooth', volume: 0.3 }], filtre: { type: 'lowpass', frequence: 700 }, enveloppe: { attaque: 0.01, decroissance: 0.3, maintien: 0.4, relache: 0.15 }, volume: 0.18 },
  },
  arranger(pas, accord) {
    const notes = [];
    // « oum » : la fondamentale sur le temps 1, la quinte sur le temps 3
    if (pas === 0) notes.push({ partie: 'basse', instrument: 'basse', numero: dans(accord, 2), duree: 4 });
    if (pas === 8) notes.push({ partie: 'basse', instrument: 'basse', numero: dans(accord, 2) + QUINTE - (accord.fondamentale >= 5 ? 12 : 0), duree: 4 });
    // « pah » : l'accord pincé sur les temps 2 et 4
    if (pas === 4 || pas === 12) {
      for (const n of accord.notes) notes.push({ partie: 'accords', instrument: 'pince', numero: dans(accord, 4) + n, duree: 2 });
    }
    // la batterie : grosse caisse douce sur 1 et 3, « tic-toc » du wood-block à contretemps, shaker léger
    if (pas === 0 || pas === 8) notes.push({ partie: 'batterie', instrument: 'kick', numero: this.instruments.kick.note, duree: 1 });
    if (pas % 4 === 2) notes.push({ partie: 'batterie', instrument: 'woodblock', numero: pas % 8 === 2 ? 79 : 84, duree: 1 });
    if (pas % 2 === 1) notes.push({ partie: 'batterie', instrument: 'shaker', duree: 1 });
    return notes;
  },
  // le thème des chefs : une course-poursuite de dessin animé
  arrangerChef(pas, accord, mesure) {
    const notes = [];
    const quinte = dans(accord, 2) + QUINTE - (accord.fondamentale >= 5 ? 12 : 0);
    // la basse marche à chaque temps : fondamentale, quinte, fondamentale, quinte
    if (pas % 4 === 0) notes.push({ partie: 'basse', instrument: 'basse', numero: pas % 8 === 0 ? dans(accord, 2) : quinte, duree: 2 });
    // des accords pincés, très courts, à chaque contretemps
    if (pas % 4 === 2) {
      for (const n of accord.notes) notes.push({ partie: 'accords', instrument: 'pince', numero: dans(accord, 4) + n, duree: 1 });
    }
    // grosse caisse sur chaque temps, wood-block à chaque croche, shaker à chaque double croche
    if (pas % 4 === 0) notes.push({ partie: 'batterie', instrument: 'kick', numero: this.instruments.kick.note, duree: 1 });
    if (pas % 2 === 0) notes.push({ partie: 'batterie', instrument: 'woodblock', numero: pas % 4 === 0 ? 84 : 79, duree: 1 });
    notes.push({ partie: 'batterie', instrument: 'shaker', duree: 1, volume: pas % 2 ? 1 : 0.6 });
    // les timbales : un coup sur les temps 1 et 3, et un roulement qui monte à la fin des mesures paires
    if (pas === 0 || pas === 8) notes.push({ partie: 'chef', instrument: 'timbale', numero: pas === 0 ? dans(accord, 2) : quinte, duree: 4 });
    if (mesure % 2 === 1 && pas >= 12) notes.push({ partie: 'chef', instrument: 'timbale', numero: dans(accord, 2), duree: 1, volume: 0.4 + (pas - 12) * 0.15 });
    return notes;
  },
};

// ═════════════════════════════════════════════════════════════
// VOXEL : aujourd'hui
// ═════════════════════════════════════════════════════════════
const piano = {
  // un piano doux : une onde triangle, adoucie, avec deux harmoniques ; il s'éteint lentement
  ondes: [{ forme: 'triangle' }, { forme: 'sine', ratio: 2, volume: 0.3 }, { forme: 'sine', ratio: 3, volume: 0.08 }],
  filtre: { type: 'lowpass', frequence: 2800 },
  enveloppe: { attaque: 0.008, decroissance: 1.6, maintien: 0, relache: 0.8 },
  volume: 0.22,
};
const voxel = {
  nom: 'Piano et nappes',
  volume: 0.51,
  volumeChef: 1.38,
  reverb: { envoi: 0.35, duree: 2.8 }, // une grande salle : chaque note résonne longtemps
  bruit: 'blanc',
  brillance: 0.6, // des bruitages plus feutrés
  forceBruit: 2.4, // (voir le cartoon) un peu plus encore, car les filtres plus fermés laissent passer moins de bruit
  instruments: {
    melodie: piano,
    piano: { ...piano, volume: 0.11 },
    // une nappe : deux dents de scie un peu désaccordées, très adoucies, qui montent lentement
    nappe: { ondes: [{ forme: 'sawtooth', desaccord: -8 }, { forme: 'sawtooth', desaccord: 8 }], filtre: { type: 'lowpass', frequence: 800, q: 0.4 }, enveloppe: { attaque: 0.9, decroissance: 1.5, maintien: 0.8, relache: 1.4 }, volume: 0.045 },
    basse: { ondes: [{ forme: 'sine' }, { forme: 'triangle', ratio: 2, volume: 0.12 }], enveloppe: { attaque: 0.06, decroissance: 0.6, maintien: 0.7, relache: 0.5 }, volume: 0.3 },
    kick: { ondes: [{ forme: 'sine' }], glisse: { de: 2.2, duree: 0.08 }, enveloppe: { attaque: 0.002, decroissance: 0.35, maintien: 0, relache: 0.05 }, volume: 0.5, note: 33 },
    caisse: { bruit: 'blanc', filtre: { type: 'bandpass', de: 1800, a: 1400, q: 0.7 }, enveloppe: { decroissance: 0.2 }, volume: 0.12 },
    charley: { bruit: 'blanc', filtre: { type: 'highpass', de: 9000 }, enveloppe: { decroissance: 0.02 }, volume: 0.04 },
    // le thème des chefs : des cuivres pour la mélodie (deux dents de scie, adoucies, qui
    // gonflent doucement), des cordes qui pulsent à chaque croche, une basse courte,
    // des toms (de gros tambours graves) et un bourdonnement sombre
    melodieChef: { ondes: [{ forme: 'sawtooth' }, { forme: 'sawtooth', desaccord: 7, volume: 0.6 }], filtre: { type: 'lowpass', frequence: 1600, q: 0.7 }, enveloppe: { attaque: 0.06, decroissance: 0.4, maintien: 0.75, relache: 0.25 }, volume: 0.1 },
    pulsation: { ondes: [{ forme: 'sawtooth', desaccord: -6 }, { forme: 'sawtooth', desaccord: 6 }], filtre: { type: 'lowpass', frequence: 1100, q: 0.8 }, enveloppe: { attaque: 0.005, decroissance: 0.18, maintien: 0.25, relache: 0.08 }, volume: 0.06 },
    basseCourte: { ondes: [{ forme: 'sine' }, { forme: 'triangle', ratio: 2, volume: 0.15 }], enveloppe: { attaque: 0.005, decroissance: 0.2, maintien: 0.5, relache: 0.05 }, volume: 0.3 },
    tom: { ondes: [{ forme: 'sine' }], glisse: { de: 1.8, duree: 0.12 }, enveloppe: { attaque: 0.002, decroissance: 0.4, maintien: 0, relache: 0.1 }, volume: 0.35 },
    bourdon: { ondes: [{ forme: 'sawtooth' }, { forme: 'sawtooth', desaccord: 12 }], filtre: { type: 'lowpass', frequence: 300, q: 2 }, enveloppe: { attaque: 1.2, decroissance: 1, maintien: 0.9, relache: 1.5 }, volume: 0.08 },
    // pour les bruitages : une cloche (des harmoniques qui ne tombent pas juste, comme le métal)
    timbre: { ondes: [{ forme: 'sine' }, { forme: 'sine', ratio: 2.76, volume: 0.35 }, { forme: 'sine', ratio: 5.4, volume: 0.12 }], enveloppe: { attaque: 0.002, decroissance: 0.6, maintien: 0, relache: 0.3 }, volume: 0.15 },
    grave: { ondes: [{ forme: 'sawtooth' }, { forme: 'sine', ratio: 0.5, volume: 0.5 }], filtre: { type: 'lowpass', frequence: 500, q: 1 }, enveloppe: { attaque: 0.02, decroissance: 0.4, maintien: 0.5, relache: 0.3 }, volume: 0.16 },
  },
  arranger(pas, accord) {
    const notes = [];
    // la nappe tient l'accord toute la mesure ; la basse aussi
    if (pas === 0) {
      for (const numero of [dans(accord, 3), dans(accord, 3) + QUINTE, dans(accord, 4) + tierce(accord)]) {
        notes.push({ partie: 'accords', instrument: 'nappe', numero, duree: 16 });
      }
      notes.push({ partie: 'basse', instrument: 'basse', numero: dans(accord, 2), duree: 16 });
    }
    // le piano égrène l'accord, une note par temps
    if (pas % 4 === 0) {
      const egrene = [dans(accord, 3), dans(accord, 3) + QUINTE, dans(accord, 4), dans(accord, 4) + tierce(accord)];
      notes.push({ partie: 'accords', instrument: 'piano', numero: egrene[pas / 4], duree: 4 });
    }
    // une batterie feutrée, au ralenti (« boum… boum-tchak ») ; les contretemps du charleston
    // arrivent un tout petit peu en retard : ça « balance » (le swing)
    if (pas === 0 || pas === 10) notes.push({ partie: 'batterie', instrument: 'kick', numero: this.instruments.kick.note, duree: 1 });
    if (pas === 8) notes.push({ partie: 'batterie', instrument: 'caisse', duree: 1 });
    if (pas % 2 === 0) notes.push({ partie: 'batterie', instrument: 'charley', duree: 1, retard: pas % 4 === 2 ? 0.03 : 0, volume: pas % 4 === 0 ? 1 : 0.6 });
    return notes;
  },
  // le thème des chefs : comme dans une bande-annonce de film
  arrangerChef(pas, accord, mesure) {
    const notes = [];
    // la nappe tient l'accord, plus doucement, et les cordes pulsent à chaque croche
    if (pas === 0) {
      for (const numero of [dans(accord, 3), dans(accord, 4) + tierce(accord)]) {
        notes.push({ partie: 'accords', instrument: 'nappe', numero, duree: 16, volume: 0.6 });
      }
    }
    if (pas % 2 === 0) notes.push({ partie: 'accords', instrument: 'pulsation', numero: dans(accord, 3) + (pas % 4 === 0 ? 0 : QUINTE), duree: 1.5 });
    // une basse courte à chaque croche
    if (pas % 2 === 0) notes.push({ partie: 'basse', instrument: 'basseCourte', numero: dans(accord, 2), duree: 1.5, volume: pas % 8 === 0 ? 1 : 0.7 });
    // les tambours : grosse caisse, toms qui répondent, caisse claire sur 2 et 4, charleston léger ;
    // toutes les 4 mesures, les toms dévalent pour annoncer la suite
    if (pas === 0 || pas === 6 || pas === 8) notes.push({ partie: 'batterie', instrument: 'kick', numero: this.instruments.kick.note, duree: 1 });
    if (pas === 10 || pas === 11) notes.push({ partie: 'batterie', instrument: 'tom', numero: 43, duree: 1 });
    if (mesure % 4 === 3 && pas >= 12) notes.push({ partie: 'batterie', instrument: 'tom', numero: 45 - (pas - 12) * 2, duree: 1 });
    if (pas === 4 || pas === 12) notes.push({ partie: 'batterie', instrument: 'caisse', duree: 1 });
    notes.push({ partie: 'batterie', instrument: 'charley', duree: 1, volume: pas % 2 ? 0.4 : 0.8 });
    // le chef : un bourdon grave toute la mesure, et un battement de cœur
    if (pas === 0) notes.push({ partie: 'chef', instrument: 'bourdon', numero: dans(accord, 2), duree: 16 });
    if (pas === 3) notes.push({ partie: 'chef', instrument: 'kick', numero: this.instruments.kick.note, duree: 1, volume: 0.7 });
    return notes;
  },
};

export const ORCHESTRES = { pixel, cartoon, voxel };
