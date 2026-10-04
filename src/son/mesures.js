// ─────────────────────────────────────────────────────────────
// LES MESURES DU SON (l'atelier du son)
// Un son calculé hors ligne (voir hors-ligne.js) n'est qu'une longue liste de
// nombres entre −1 et 1, les « échantillons » : 48 000 par seconde et par
// côté (gauche, droite). Ce fichier les mesure comme l'oreille les entend :
// - le VOLUME RESSENTI, en LUFS (« Loudness Units relative to Full Scale ») :
//   la norme des radios et des plateformes de musique (ITU-R BS.1770). L'oreille
//   entend mal les graves et très bien les aigus vers 2 à 4 kHz : on filtre
//   donc le son comme elle (la « pondération K ») avant de mesurer sa
//   puissance. 0 LUFS est le maximum ; −14 est très fort, −30 discret ;
//   une différence de 1 LU est à peine audible, 6 LU c'est deux fois plus fort
//   (ou presque) ;
// - la CRÊTE, en dB : le plus grand échantillon (0 dB = 1 : au-delà, le son est
//   écrêté, il « sature ») ;
// - les GRAVES et les AIGUS : la part de l'énergie dans chaque bande de
//   fréquences (avec une transformée de Fourier, qui décompose le son en notes) ;
// - la DURETÉ : la part de l'énergie entre 2 et 5 kHz, la bande où l'oreille est
//   la plus sensible (trop d'énergie là, et le son fatigue vite) ;
// - le SPECTROGRAMME : une image du son, le temps de gauche à droite, les
//   fréquences de bas en haut, la force en couleur.
// Ce fichier ne connaît ni le navigateur ni Web Audio : il compte.
// ─────────────────────────────────────────────────────────────

export const FREQUENCE_ECHANTILLONNAGE = 48000; // les sons de l'atelier sont calculés à 48 kHz

// ── La pondération K (le filtre « oreille » de la norme) ──
// Deux filtres l'un après l'autre : un qui relève les aigus (la tête fait obstacle au son), puis
// un qui coupe l'extrême grave (l'oreille ne l'entend presque pas). Coefficients de la norme, à 48 kHz.
const ETAGES_K = [
  { b: [1.53512485958697, -2.69169618940638, 1.19839281085285], a: [-1.69065929318241, 0.73248077421585] },
  { b: [1, -2, 1], a: [-1.99004745483398, 0.99007225036621] },
];
function filtrer(echantillons, { b, a }) {
  const sortie = new Float32Array(echantillons.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < echantillons.length; i++) {
    const x = echantillons[i];
    const y = b[0] * x + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    sortie[i] = y;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
  }
  return sortie;
}
export const ponderationK = (echantillons) => ETAGES_K.reduce((s, etage) => filtrer(s, etage), echantillons);

// La puissance moyenne (pondérée K) de chaque bloc de « taille » échantillons, tous les « saut »
// échantillons, en additionnant les canaux (gauche + droite, comme la norme)
function blocs(canauxK, taille, saut) {
  const n = canauxK[0].length;
  const puissances = [];
  for (let debut = 0; debut + taille <= Math.max(n, taille); debut += saut) {
    let somme = 0;
    for (const c of canauxK) {
      let s = 0;
      const fin = Math.min(n, debut + taille);
      for (let i = debut; i < fin; i++) s += c[i] * c[i];
      somme += s / taille; // (un bloc qui dépasse la fin compte comme du silence)
    }
    puissances.push(somme);
    if (debut + taille >= n) break;
  }
  return puissances;
}
const enLUFS = (puissance) => (puissance > 0 ? -0.691 + 10 * Math.log10(puissance) : -Infinity);

// Le volume ressenti :
// - momentane : le plus fort moment, sur une fenêtre de 0,4 s (la mesure des bruitages : un son court
//   paraît moins fort qu'un son long, et cette fenêtre fait comme l'oreille) ;
// - integre : sur toute la durée, sans compter les silences (la mesure des musiques, avec les deux
//   « portes » de la norme : on oublie ce qui est sous −70 LUFS, puis ce qui est 10 LU sous la moyenne).
export function volumeRessenti(canaux, fe = FREQUENCE_ECHANTILLONNAGE) {
  const canauxK = canaux.map(ponderationK);
  const taille = Math.round(0.4 * fe), saut = Math.round(0.1 * fe);
  const puissances = blocs(canauxK, taille, saut);
  const momentane = enLUFS(Math.max(...puissances));
  const audibles = puissances.filter((p) => enLUFS(p) > -70);
  const moyenne = audibles.reduce((s, p) => s + p, 0) / Math.max(1, audibles.length);
  const gardes = audibles.filter((p) => enLUFS(p) > enLUFS(moyenne) - 10);
  const integre = enLUFS(gardes.reduce((s, p) => s + p, 0) / Math.max(1, gardes.length));
  return { momentane, integre };
}

// Le volume ressenti au fil du temps : une valeur (LUFS sur 0,4 s) tous les « pas » secondes
export function volumeAuFilDuTemps(canaux, fe = FREQUENCE_ECHANTILLONNAGE, pas = 0.1) {
  const canauxK = canaux.map(ponderationK);
  return blocs(canauxK, Math.round(0.4 * fe), Math.round(pas * fe)).map(enLUFS);
}

// La crête : le plus grand échantillon, en dB (0 dB = 1)
export function crete(canaux) {
  let max = 0;
  for (const c of canaux) for (let i = 0; i < c.length; i++) max = Math.max(max, Math.abs(c[i]));
  return max > 0 ? 20 * Math.log10(max) : -Infinity;
}

// La durée audible : du premier au dernier moment où le son dépasse « seuil » dB sous sa crête
export function dureeAudible(canaux, fe = FREQUENCE_ECHANTILLONNAGE, seuil = 40) {
  const pic = 10 ** (crete(canaux) / 20), limite = pic * 10 ** (-seuil / 20);
  let premier = -1, dernier = -1;
  const n = canaux[0].length;
  for (let i = 0; i < n; i++) {
    let v = 0;
    for (const c of canaux) v = Math.max(v, Math.abs(c[i]));
    if (v >= limite) { if (premier < 0) premier = i; dernier = i; }
  }
  return premier < 0 ? 0 : (dernier - premier) / fe;
}

// ── La transformée de Fourier (rapide) ──
// Elle décompose un morceau de son en une somme de sinus : la force de chaque fréquence.
// Réel et imaginaire sont modifiés sur place ; leur longueur doit être une puissance de 2.
function fft(reel, imag) {
  const n = reel.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [reel[i], reel[j]] = [reel[j], reel[i]]; [imag[i], imag[j]] = [imag[j], imag[i]]; }
  }
  for (let longueur = 2; longueur <= n; longueur <<= 1) {
    const angle = (-2 * Math.PI) / longueur, wr = Math.cos(angle), wi = Math.sin(angle);
    for (let i = 0; i < n; i += longueur) {
      let cr = 1, ci = 0;
      for (let k = 0; k < longueur / 2; k++) {
        const ar = reel[i + k], ai = imag[i + k];
        const br = reel[i + k + longueur / 2] * cr - imag[i + k + longueur / 2] * ci;
        const bi = reel[i + k + longueur / 2] * ci + imag[i + k + longueur / 2] * cr;
        reel[i + k] = ar + br; imag[i + k] = ai + bi;
        reel[i + k + longueur / 2] = ar - br; imag[i + k + longueur / 2] = ai - bi;
        const t = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = t;
      }
    }
  }
}
// Une fenêtre de Hann : le morceau de son est adouci aux deux bouts (sinon, la coupure nette
// ajouterait des fréquences qui n'existent pas)
const hann = (n) => Float32Array.from({ length: n }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (n - 1)));

// Les bandes de fréquences (en Hz)
export const BANDES = { graves: [20, 250], mediums: [250, 2000], aigus: [2000, 6000], tresAigus: [6000, 20000] };

// Le spectre moyen d'un son (gauche et droite mélangés) : la part de l'énergie de chaque bande,
// la fréquence « centre de gravité » (la brillance : plus elle est haute, plus le son est brillant),
// et la dureté (la part entre 2 et 5 kHz)
export function spectre(canaux, fe = FREQUENCE_ECHANTILLONNAGE, taille = 4096) {
  const n = canaux[0].length;
  const mono = new Float32Array(n);
  for (const c of canaux) for (let i = 0; i < n; i++) mono[i] += c[i] / canaux.length;
  const fenetre = hann(taille);
  const puissance = new Float64Array(taille / 2);
  let morceaux = 0;
  for (let debut = 0; debut + taille <= n || (debut === 0 && n > 0); debut += taille / 2) {
    const reel = new Float32Array(taille), imag = new Float32Array(taille);
    for (let i = 0; i < taille; i++) reel[i] = (mono[debut + i] || 0) * fenetre[i];
    fft(reel, imag);
    for (let k = 0; k < taille / 2; k++) puissance[k] += reel[k] * reel[k] + imag[k] * imag[k];
    morceaux++;
    if (debut + taille >= n) break;
  }
  const hz = (k) => (k * fe) / taille;
  let total = 0, pondere = 0, dur = 0;
  const bandes = Object.fromEntries(Object.keys(BANDES).map((b) => [b, 0]));
  for (let k = 1; k < taille / 2; k++) {
    const f = hz(k), p = puissance[k];
    if (f < 20) continue;
    total += p;
    pondere += p * f;
    if (f >= 2000 && f < 5000) dur += p;
    for (const [b, [de, a]] of Object.entries(BANDES)) if (f >= de && f < a) bandes[b] += p;
  }
  if (!total) return { bandes, brillance: 0, durete: 0 };
  for (const b of Object.keys(bandes)) bandes[b] /= total;
  return { bandes, brillance: pondere / total, durete: dur / total };
}

// Le spectrogramme : pour chaque petite tranche de temps, la force (en dB) de chaque rangée de
// fréquences, rangées sur une échelle « musicale » (logarithmique : chaque octave a la même hauteur,
// comme sur un clavier de piano), de 40 Hz à 16 kHz. 0 dB : un sinus qui va de −1 à 1 (le plus fort
// possible) ; −60 dB, mille fois plus faible.
export function spectrogramme(canaux, fe = FREQUENCE_ECHANTILLONNAGE, { taille = 1024, saut = 256, rangees = 72 } = {}) {
  const n = canaux[0].length;
  const mono = new Float32Array(n);
  for (const c of canaux) for (let i = 0; i < n; i++) mono[i] += c[i] / canaux.length;
  const fenetre = hann(taille);
  const colonnes = Math.max(1, Math.floor((n - taille) / saut) + 1);
  const image = new Float32Array(colonnes * rangees).fill(-120);
  const fBas = 40, fHaut = 16000;
  // la rangée de chaque case de la transformée
  const rangee = new Int16Array(taille / 2).fill(-1);
  for (let k = 1; k < taille / 2; k++) {
    const f = (k * fe) / taille;
    if (f < fBas || f > fHaut) continue;
    rangee[k] = Math.min(rangees - 1, Math.floor((Math.log(f / fBas) / Math.log(fHaut / fBas)) * rangees));
  }
  for (let c = 0; c < colonnes; c++) {
    const reel = new Float32Array(taille), imag = new Float32Array(taille);
    for (let i = 0; i < taille; i++) reel[i] = (mono[c * saut + i] || 0) * fenetre[i];
    fft(reel, imag);
    const somme = new Float64Array(rangees);
    for (let k = 1; k < taille / 2; k++) if (rangee[k] >= 0) somme[rangee[k]] += reel[k] * reel[k] + imag[k] * imag[k];
    // (avec la fenêtre de Hann, un sinus de force 1 donne (taille / 4)² dans sa case : c'est le 0 dB)
    for (let r = 0; r < rangees; r++) image[c * rangees + r] = somme[r] > 0 ? 10 * Math.log10(somme[r] / ((taille * taille) / 16)) : -120;
  }
  return { image, colonnes, rangees, duree: n / fe, fBas, fHaut };
}

// La fin du son : le dernier moment où il dépasse « seuil » dB sous sa crête (en secondes)
export function finAudible(canaux, fe = FREQUENCE_ECHANTILLONNAGE, seuil = 60) {
  const limite = 10 ** ((crete(canaux) - seuil) / 20);
  for (let i = canaux[0].length - 1; i >= 0; i--) {
    for (const c of canaux) if (Math.abs(c[i]) >= limite) return (i + 1) / fe;
  }
  return 0;
}

// La forme de l'onde, pour la dessiner : pour chaque colonne de « colonnes », le plus petit et
// le plus grand échantillon (gauche et droite mélangés)
export function formeDOnde(canaux, colonnes) {
  const n = canaux[0].length, parColonne = Math.max(1, Math.floor(n / colonnes));
  const min = new Float32Array(colonnes), max = new Float32Array(colonnes);
  for (let c = 0; c < colonnes; c++) {
    let mi = 0, ma = 0;
    for (let i = c * parColonne; i < Math.min(n, (c + 1) * parColonne); i++) {
      let v = 0;
      for (const canal of canaux) v += canal[i] / canaux.length;
      if (v < mi) mi = v;
      if (v > ma) ma = v;
    }
    min[c] = mi;
    max[c] = ma;
  }
  return { min, max };
}

// Tout sur un son, d'un coup
export function mesurerSon(canaux, fe = FREQUENCE_ECHANTILLONNAGE) {
  const { momentane, integre } = volumeRessenti(canaux, fe);
  return { volume: momentane, volumeIntegre: integre, crete: crete(canaux), duree: dureeAudible(canaux, fe), ...spectre(canaux, fe) };
}
