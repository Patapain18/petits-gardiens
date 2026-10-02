// ─────────────────────────────────────────────────────────────
// LA PARTITION
// Les musiques des Petits Gardiens, écrites une seule fois. Chaque
// époque les joue avec son orchestre (src/son/orchestres.js) : une
// console 8 bits, un petit orchestre de dessin animé, ou un piano
// moderne. C'est la même idée que pour les personnages : une fiche,
// trois rendus.
//
// Comment c'est écrit :
// - une mesure = 8 croches (4 temps, comme une chanson à « un, deux,
//   trois, quatre ») ;
// - une note = son nom, son octave, puis sa durée en croches :
//   « E5:2 » = un Mi de la 5e octave qui dure 2 croches (une noire) ;
//   « G#5 » = un sol dièse (un demi-ton au-dessus du sol), « Bb4 » = un si bémol ;
// - « -:2 » = un silence de 2 croches ;
// - un accord par mesure : « C » = Do majeur, « Am » = La mineur…
// - tempo : le nombre de pulsations par minute (une pulsation = une noire = 2 croches) ;
// - arrangement : la façon dont l'orchestre accompagne (voir orchestres.js).
// ─────────────────────────────────────────────────────────────
import { numeroNote } from './synthe.js';

// Le thème principal, joyeux : la partie A (mesures 1 à 8), puis la partie B, qui monte (9 à 16)
export const THEME = {
  tempo: 116,
  arrangement: 'theme',
  melodie: [
    'G4:2 C5:2 E5:2 D5:1 C5:1', // 1  Do
    'D5:3 B4:1 G4:4',           // 2  Sol
    'A4:2 C5:2 E5:2 G5:1 E5:1', // 3  La mineur
    'F5:3 E5:1 C5:4',           // 4  Fa
    'G4:2 C5:2 E5:2 G5:2',      // 5  Do
    'A5:3 G5:1 D5:4',           // 6  Sol
    'F5:2 E5:2 D5:2 C5:2',      // 7  Fa
    'D5:6 -:2',                 // 8  Sol
    'E5:1 E5:1 A5:2 G5:2 E5:2', // 9  La mineur
    'F5:1 F5:1 A5:2 G5:2 F5:2', // 10 Fa
    'E5:1 E5:1 G5:2 C6:2 G5:2', // 11 Do
    'B5:3 A5:1 G5:4',           // 12 Sol
    'E5:1 E5:1 A5:2 G5:2 E5:2', // 13 La mineur
    'F5:2 A5:2 C6:2 A5:2',      // 14 Fa
    'D6:3 C6:1 A5:2 F5:2',      // 15 Ré mineur
    'G5:6 -:2',                 // 16 Sol… et on recommence au début
  ],
  accords: ['C', 'G', 'Am', 'F', 'C', 'G', 'F', 'G', 'Am', 'F', 'C', 'G', 'Am', 'F', 'Dm', 'G'],
};

// Le thème des chefs, quand le Colosse ou le Dragon est sur le chemin : en la mineur (plus
// sombre), un peu plus rapide, avec des notes qui piquent (le sol dièse de l'accord de Mi,
// qui « tire » vers le La : c'est la couleur des musiques de méchants). La partie A gronde
// dans le grave ; la partie B monte, héroïque : les gardiens résistent !
export const THEME_CHEF = {
  tempo: 128,
  arrangement: 'chef',
  melodie: [
    'A4:1 A4:1 C5:1 A4:1 E5:2 D5:1 C5:1',   // 1  La mineur
    'B4:2 C5:1 B4:1 A4:4',                  // 2  La mineur
    'A4:1 A4:1 C5:1 A4:1 F5:2 E5:1 D5:1',   // 3  Fa
    'E5:3 D5:1 B4:4',                       // 4  Sol
    'A4:1 A4:1 C5:1 E5:1 A5:2 G5:1 E5:1',   // 5  La mineur
    'F5:2 E5:1 D5:1 C5:4',                  // 6  La mineur
    'D5:1 F5:1 A5:2 G5:1 F5:1 E5:2',        // 7  Ré mineur
    'G#5:6 -:2',                            // 8  Mi (majeur : son sol dièse annonce le retour au La)
    'C6:3 B5:1 A5:2 G5:2',                  // 9  Fa
    'B5:3 A5:1 G5:2 D5:2',                  // 10 Sol
    'E5:1 A5:1 C6:2 B5:1 A5:1 E5:2',        // 11 La mineur
    'A5:6 -:2',                             // 12 La mineur
    'F5:1 A5:1 C6:2 A5:1 F5:1 C5:2',        // 13 Fa
    'G5:1 B5:1 D6:2 B5:1 G5:1 D5:2',        // 14 Sol
    'E5:1 G#5:1 B5:2 E6:2 D6:1 B5:1',       // 15 Mi
    'G#5:4 B5:2 -:2',                       // 16 Mi… et on repart au début
  ],
  accords: ['Am', 'Am', 'F', 'G', 'Am', 'Am', 'Dm', 'E', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
};

// Les petites musiques qui remplacent le thème à la fin d'une partie
export const JINGLES = {
  // une fanfare qui monte
  victoire: {
    tempo: 116,
    arrangement: 'theme',
    melodie: ['C5:1 E5:1 G5:1 C6:3 -:2', 'G5:1 C6:1 E6:6'],
    accords: ['C', 'C'],
  },
  // « wouah wouah wouaaah… wouaaaah » : des notes qui descendent, comme un trombone triste
  defaite: {
    tempo: 116,
    arrangement: 'theme',
    melodie: ['Bb4:2 A4:2 Ab4:2 -:2', 'G4:6 -:2'],
    accords: ['Gm', 'Gm'],
  },
};

// ── Lire la partition ────────────────────────────────────────
// Le séquenceur (src/son/son.js) avance par « pas » d'une double croche
// (16 pas par mesure : c'est plus fin que la croche, pour les arpèges rapides).
export const PAS_PAR_MESURE = 16;

// « G4:2 C5:2 » → [{ pas: 0, numero: 67, duree: 4 }, { pas: 4, numero: 72, duree: 4 }]
// (pas et duree en doubles croches, comptés depuis le début de la mesure)
export function lireMesure(texte) {
  const notes = [];
  let pas = 0;
  for (const morceau of texte.trim().split(/\s+/)) {
    const [nom, duree] = morceau.split(':');
    const longueur = Number(duree) * 2; // une croche = 2 doubles croches
    if (nom !== '-') notes.push({ pas, numero: numeroNote(nom), duree: longueur });
    pas += longueur;
  }
  if (pas !== PAS_PAR_MESURE) throw new Error(`Mesure de ${pas / 2} croches au lieu de 8 : « ${texte} »`);
  return notes;
}

// Un accord, ce sont trois notes : la fondamentale, la tierce et la quinte.
// « Am » → { fondamentale: 9 (La), notes: [0, 3, 7] } : en demi-tons au-dessus de la fondamentale.
// Majeur (joyeux) : tierce à 4 demi-tons ; mineur (plus triste) : tierce à 3.
export function lireAccord(nom) {
  const m = /^([A-G])([#b]?)(m?)$/.exec(nom);
  if (!m) throw new Error(`Accord inconnu : « ${nom} » (exemples : C, Am, F#, Bbm)`);
  const fondamentale = (numeroNote(`${m[1]}${m[2]}4`) - 60 + 12) % 12; // de 0 (Do) à 11 (Si)
  return { fondamentale, notes: m[3] ? [0, 3, 7] : [0, 4, 7] };
}

// Une partition, lue une fois pour toutes : son tempo, son arrangement, et la liste
// de ses mesures, chacune avec ses notes de mélodie et son accord
export function lirePartition({ tempo, arrangement, melodie, accords }) {
  if (melodie.length !== accords.length) throw new Error('Il faut un accord par mesure de mélodie.');
  return {
    tempo,
    arrangement,
    dureePas: 60 / tempo / 4, // la durée d'une double croche, en secondes
    mesures: melodie.map((texte, i) => ({ notes: lireMesure(texte), accord: lireAccord(accords[i]) })),
  };
}
