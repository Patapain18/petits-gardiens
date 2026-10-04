// ─────────────────────────────────────────────────────────────
// AU DOIGT : LE JEU SUR UN ÉCRAN TACTILE
// - TACTILE : l'appareil se pilote au doigt (« pointer: coarse » : un doigt
//   est moins précis qu'une souris). Le jeu change alors sa façon de choisir
//   un gardien (la roue autour du socle) et de viser (on pose le doigt, le
//   cercle apparaît, on le glisse, on lâche). ?tactile dans l'adresse le force,
//   pour essayer sur un ordinateur ;
// - estUnTelephone() : un petit écran tactile (sa plus petite largeur fait au
//   plus 520 pixels). Couché, les boutons flottent dans les coins et le
//   plateau prend toute la hauteur ; debout, on demande de le tourner ;
// - auDoigt(texte) : les textes du jeu parlent de « cliquer » et de touches du
//   clavier. Au doigt, on « touche », et il n'y a pas de clavier.
// ─────────────────────────────────────────────────────────────
const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams();

export const TACTILE = params.has('tactile') || (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches);

export const estUnTelephone = () => TACTILE && Math.min(innerWidth, innerHeight) <= 520;

export function auDoigt(texte) {
  if (!TACTILE) return texte;
  return String(texte)
    // « (touche H) », « (ou appuie sur Espace) », « (touche O) » : pas de clavier
    .replace(/\s*\((?:ou )?(?:appuie sur )?(?:la )?(?:touche|Espace|Échap)[^)]*\)/g, '')
    .replace(/\bClique sur lui\b/g, 'Touche-le')
    .replace(/\bclique sur lui\b/g, 'touche-le')
    .replace(/\bClique\b/g, 'Touche')
    .replace(/\bclique\b/g, 'touche')
    .replace(/\bcliques\b/g, 'touches')
    .replace(/\bcliquer\b/g, 'toucher')
    .replace(/\bun clic\b/g, 'un toucher');
}
