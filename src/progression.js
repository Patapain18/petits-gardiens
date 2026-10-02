// ─────────────────────────────────────────────────────────────
// LA PROGRESSION DU JOUEUR
// Les niveaux gagnés sont gardés dans le navigateur (localStorage), ainsi
// que les fiches et les leçons du didacticiel déjà vues (pour l'option
// « seulement la première fois »).
// Si le navigateur refuse (navigation privée, stockage bloqué…), le jeu
// marche quand même : la progression est simplement oubliée.
// ─────────────────────────────────────────────────────────────
const CLE = 'petits-gardiens-progression';

// { gagnes: Set des ids gagnés, toutDebloque: true en mode test (tous les niveaux ouverts),
//   vus: Set des fiches (« taupe ») et des leçons (« lecon:poser ») déjà vues }
export function lireProgression() {
  try {
    const p = JSON.parse(localStorage.getItem(CLE));
    return { gagnes: new Set(p?.gagnes || []), toutDebloque: Boolean(p?.toutDebloque), vus: new Set(p?.vus || []) };
  } catch {
    return { gagnes: new Set(), toutDebloque: false, vus: new Set() };
  }
}

function ecrire(p) {
  try {
    localStorage.setItem(CLE, JSON.stringify({ gagnes: [...p.gagnes], toutDebloque: p.toutDebloque, vus: [...p.vus] }));
  } catch { /* stockage refusé : tant pis */ }
}

export function noterVictoire(id) {
  const p = lireProgression();
  p.gagnes.add(id);
  ecrire(p);
}

// Une fiche ou une leçon du didacticiel a été vue jusqu'au bout
export function noterVu(nom) {
  const p = lireProgression();
  if (p.vus.has(nom)) return;
  p.vus.add(nom);
  ecrire(p);
}

// Mode test : ouvrir tous les niveaux sans avoir gagné les précédents
export function choisirToutDebloque(oui) {
  const p = lireProgression();
  p.toutDebloque = oui;
  ecrire(p);
}

export function effacerProgression() {
  try { localStorage.removeItem(CLE); } catch { /* rien à effacer */ }
}
