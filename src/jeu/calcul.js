// ─────────────────────────────────────────────────────────────
// DES CALCULS QUI DONNENT LE MÊME RÉSULTAT PARTOUT
// Une partie enregistrée doit se rejouer à l'identique (voir
// enregistrement.js), sur n'importe quel ordinateur et dans n'importe
// quel navigateur. Le moteur doit donc faire exactement les mêmes
// calculs partout, jusqu'au dernier chiffre après la virgule.
//
// Les additions, soustractions, multiplications, divisions et Math.sqrt
// le garantissent : la norme des nombres à virgule (IEEE 754) impose leur
// résultat exact. Math.hypot, lui, est laissé libre : Safari et Chrome
// peuvent répondre avec une différence au dernier chiffre. C'est minuscule,
// mais ça suffit à faire diverger une partie au bout de quelques minutes :
// un monstre touché d'un cheveu ici, raté là… Le moteur calcule donc
// toutes ses distances avec distance().
// ─────────────────────────────────────────────────────────────

// La distance d'un point à un autre (dx et dy : les écarts en x et en y), comme Math.hypot
export const distance = (dx, dy) => Math.sqrt(dx * dx + dy * dy);
