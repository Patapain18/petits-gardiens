// ─────────────────────────────────────────────────────────────
// LA TYPOGRAPHIE FRANÇAISE : LES ESPACES INSÉCABLES
// En français, on met une espace avant « ! ? : ; », et à l'intérieur des
// guillemets « ». Mais le navigateur a le droit de couper une ligne à
// n'importe quelle espace : un « ! » se retrouvait parfois tout seul au
// début d'une ligne (« À toi de jouer » puis « ! » en dessous).
// Une espace insécable (le caractère U+00A0) ressemble à une espace, mais la
// ligne ne peut pas être coupée à cet endroit : le signe reste collé au mot.
// ─────────────────────────────────────────────────────────────

const INSECABLE = ' ';

// Remplace l'espace avant ! ? : ; » (et après «) par une espace insécable
export const insecables = (texte) => String(texte).replace(/ ([!?:;»])/g, `${INSECABLE}$1`).replace(/« /g, `«${INSECABLE}`);
