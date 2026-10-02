// ─────────────────────────────────────────────────────────────
// LA SALLE DES SONS (la page sons.html, un outil d'atelier)
// Les deux thèmes et tous les bruitages, dans les trois époques, côte à côte :
// quand on invente un son, on écrit sa recette une seule fois
// (src/son/effets.js) et on l'écoute ici dans chaque époque.
// ─────────────────────────────────────────────────────────────
import { creerSon } from './son/son.js';
import { ORCHESTRES } from './son/orchestres.js';

// le thème ne démarre pas tout seul ici : on choisit ce qu'on écoute
const son = creerSon({ musique: false });

const EPOQUES = [['pixel', 'Pixel'], ['cartoon', 'Cartoon'], ['voxel', 'Voxel']];

// Les bruitages, rangés par famille : [nom de la recette, texte du bouton, événement d'exemple]
const BRUITAGES = [
  ['Les gardiens', [
    ['tir:braise', 'Braise tire'], ['tir:givrine', 'Givrine tire'], ['tir:grondin', 'Grondin tire'],
    ['tir:bourrasque', 'Bourrasque tire'], ['eclair', 'Éclair d’Étincelle'],
    ['souffle', 'Coup de vent'], ['explosion', 'Rocher qui explose'], ['carapace', 'Coup sur une carapace'],
  ]],
  ['Les monstres', [
    ['mort', 'Petit monstre battu', { quoi: 'gluant' }], ['mort', 'Gros monstre battu', { quoi: 'cuirasse' }],
    ['mort', 'Chef battu', { quoi: 'dragon' }], ['plonge', 'La Taupe plonge'], ['surgit', 'La Taupe ressort'],
    ['naissance', 'Des petits sortent'], ['flamme', 'Feu du Dragon'],
  ]],
  ['L’or et les gardiens', [
    ['recolte', 'Récolte de la Pépite'], ['construction', 'Gardien posé'], ['amelioration', 'Amélioration'], ['vente', 'Gardien revendu'],
  ]],
  ['Les grands moments', [
    ['vague', 'Vague lancée'], ['chef', 'Un chef arrive'], ['fiche', 'Fiche du didacticiel'], ['menu', 'Menu d’un socle'], ['clic', 'Clic d’un bouton'],
  ]],
];

const $ = (s) => document.querySelector(s);
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// Le thème en cours : dans quelle époque, et avec quel mixage (null = rien ne joue)
let themeEnCours = null;
function montrerTheme() {
  document.querySelectorAll('[data-mixage]').forEach((b) => {
    b.setAttribute('aria-pressed', String(themeEnCours?.epoque === b.dataset.epoque && themeEnCours?.mixage === b.dataset.mixage));
  });
}

function bouton(texte, action) {
  const b = element('button', '', texte);
  b.addEventListener('click', () => {
    son.debloquer(); // le premier clic réveille le son (règle des navigateurs)
    action(b);
  });
  return b;
}

function colonne(epoque, nom) {
  const section = element('section', 'epoque');
  section.append(element('h2', '', nom), element('p', 'orchestre', ORCHESTRES[epoque].nom));

  // la musique : le thème principal (calme entre les vagues, ou pendant une vague), et le thème des chefs
  section.append(element('h3', '', 'La musique'));
  const theme = element('div', 'boutons');
  for (const [mixage, texte] of [['calme', 'Thème, au calme'], ['vague', 'Thème, pendant une vague'], ['chef', 'Thème des chefs']]) {
    const b = bouton(texte, () => {
      son.choisirEpoque(epoque);
      // dans une autre époque, la musique repart du début ; sinon, elle change à la mesure suivante
      if (themeEnCours?.epoque !== epoque) son.recommencer(mixage);
      son.forcerMixage(mixage);
      themeEnCours = { epoque, mixage };
      montrerTheme();
    });
    b.dataset.epoque = epoque;
    b.dataset.mixage = mixage;
    theme.append(b);
  }
  theme.append(bouton('Arrêter', () => { son.arreterTheme(); themeEnCours = null; montrerTheme(); }));
  section.append(theme);

  // les musiques de fin
  section.append(element('h3', '', 'Les fins de partie'));
  const fins = element('div', 'boutons');
  for (const [jingle, texte] of [['victoire', 'Victoire'], ['defaite', 'Défaite']]) {
    fins.append(bouton(texte, () => {
      son.choisirEpoque(epoque);
      son.jingle(jingle); // (la musique de fin arrête le thème)
      themeEnCours = null;
      montrerTheme();
    }));
  }
  section.append(fins);

  // les bruitages
  for (const [famille, liste] of BRUITAGES) {
    section.append(element('h3', '', famille));
    const boutons = element('div', 'boutons');
    for (const [recette, texte, ev = {}] of liste) {
      boutons.append(bouton(texte, () => {
        son.choisirEpoque(epoque); // (si le thème joue, il passe lui aussi dans cette époque)
        son.effet(recette, ev);
        if (themeEnCours) { themeEnCours.epoque = epoque; montrerTheme(); }
      }));
    }
    section.append(boutons);
  }
  return section;
}

$('#epoques').replaceChildren(...EPOQUES.map(([epoque, nom]) => colonne(epoque, nom)));

// Accès de débogage depuis la console du navigateur (ex. : __son.effet('recolte'))
window.__son = son;
