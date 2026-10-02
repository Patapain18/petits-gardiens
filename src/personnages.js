// ─────────────────────────────────────────────────────────────
// LA GALERIE DES PERSONNAGES (la page personnages.html, un outil d'atelier)
// Chaque personnage dans les trois styles, côte à côte : quand on invente
// un personnage, on écrit sa fiche une seule fois (src/jeu/donnees.js) et
// on vérifie ici qu'il rend bien partout.
//
//   personnages.html               → tout le monde
//   personnages.html?monde=1       → les personnages des niveaux du monde 1
//   personnages.html?monde=nouveaux → ceux qui ne sont encore dans aucun niveau
//   personnages.html?niveau=1      → les gardiens à leur niveau 1 seulement
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, NIVEAU_MAX, caracteristiques } from './jeu/donnees.js';
import { chargerNiveau } from './jeu/niveau.js';
import { MONDES } from './jeu/campagne.js';
import RenduVoxel from './rendus/voxel.js';
import RenduCartoon from './rendus/cartoon.js';
import { imagePersonnage } from './rendus/pixel.js';

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const $ = (s) => document.querySelector(s);

// ── Dans quel monde croise-t-on chaque personnage ? ──
// On regarde les niveaux de chaque monde : les gardiens proposés, les monstres
// des vagues… et les petits qu'ils libèrent. Le premier monde trouvé gagne.
const mondeDe = new Map();
for (const monde of MONDES) {
  for (const id of monde.niveaux) {
    const fiche = FICHES[`./niveaux/${id}.json`];
    if (!fiche) continue;
    const types = [...Object.keys(fiche.gardiens || GARDIENS)];
    for (const groupe of fiche.vagues.flat()) {
      types.push(groupe.type);
      if (MONSTRES[groupe.type]?.enfants) types.push(MONSTRES[groupe.type].enfants.type);
    }
    for (const type of types) if (!mondeDe.has(type)) mondeDe.set(type, monde.numero);
  }
}

// ── Les filtres ──
const params = new URLSearchParams(location.search);
const filtre = params.get('monde');            // '1', '2'… ou 'nouveaux'
const niveauSeul = Number(params.get('niveau')) || null;
const garder = (type) => !filtre || (filtre === 'nouveaux' ? !mondeDe.has(type) : String(mondeDe.get(type)) === filtre);

const liens = [['Tous', '?']];
for (const monde of MONDES) if ([...mondeDe.values()].includes(monde.numero)) liens.push([`Monde ${monde.numero}`, `?monde=${monde.numero}`]);
if ([...Object.keys(GARDIENS), ...Object.keys(MONSTRES)].some((type) => !mondeDe.has(type))) liens.push(['Pas encore dans un niveau', '?monde=nouveaux']);
$('#filtres').replaceChildren(...liens.map(([texte, lien]) => {
  const a = document.createElement('a');
  a.textContent = texte;
  a.href = lien;
  if ((lien === '?' && !filtre) || lien === `?monde=${filtre}`) a.setAttribute('aria-current', 'page');
  return a;
}), Object.assign(document.createElement('a'), { textContent: 'Carte des époques', href: './' }));

// ── Les « photographes » ──
// Les styles 3D ont besoin d'un rendu complet pour photographier un personnage
// (lumières, matériaux…) : on en crée un de chaque, caché, sur le niveau d'essai.
const niveauEssai = chargerNiveau(FICHES['./niveaux/essai.json']);
const voxel = new RenduVoxel($('#ateliers'), niveauEssai, {});
const cartoon = new RenduCartoon($('#ateliers'), niveauEssai);
const STYLES = [
  ['Voxel', (apparence) => voxel.portrait(apparence)],
  ['Cartoon', (apparence) => cartoon.portrait(apparence)],
  ['Pixel', (apparence) => imagePersonnage(apparence, 128)],
];

// Une carte : le nom du personnage, puis son portrait dans chaque style
function carte({ nom, detail, apparence }) {
  const article = document.createElement('article');
  article.className = 'perso';
  const titre = document.createElement('h3');
  titre.textContent = nom;
  const sous = document.createElement('small');
  sous.textContent = detail;
  titre.append(sous);
  const styles = document.createElement('div');
  styles.className = 'styles';
  for (const [nomStyle, photographier] of STYLES) {
    const figure = document.createElement('figure');
    figure.dataset.style = nomStyle.toLowerCase();
    const legende = document.createElement('figcaption');
    legende.textContent = nomStyle;
    figure.append(photographier(apparence), legende);
    styles.append(figure);
  }
  article.append(titre, styles);
  return article;
}

const gardiens = Object.keys(GARDIENS).filter(garder).flatMap((type) =>
  Array.from({ length: NIVEAU_MAX }, (_, i) => i + 1)
    .filter((n) => !niveauSeul || n === niveauSeul)
    .map((n) => {
      const c = caracteristiques(type, n);
      return { nom: c.nom, detail: n === 1 ? 'gardien, niveau 1' : `${GARDIENS[type].nom}, niveau ${n}`, apparence: c.apparence };
    }));
const monstres = Object.entries(MONSTRES).filter(([type]) => garder(type)).map(([, m]) => ({
  nom: m.nom, detail: m.boss ? 'le chef des monstres' : 'monstre', apparence: m.apparence,
}));

$('#gardiens').replaceChildren(...gardiens.map(carte));
$('#monstres').replaceChildren(...monstres.map(carte));
$('#gardiens').closest('section').hidden = !gardiens.length;
$('#monstres').closest('section').hidden = !monstres.length;

// Les photos sont prises : les rendus cachés ne servent plus
voxel.detruire();
cartoon.detruire();

// Planche (développement) : __planche('nom') assemble les personnages affichés en une
// seule image (une ligne par personnage, une colonne par style) et l'enregistre dans captures/nom.jpg
window.__planche = async (nom = 'planche') => {
  const cartes = [...document.querySelectorAll('.perso')];
  const CASE = 200, MARGE = 180, HAUT = 50;
  const c = document.createElement('canvas');
  c.width = MARGE + STYLES.length * CASE;
  c.height = HAUT + cartes.length * CASE;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1c1424';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = '#ffd27a';
  ctx.font = '700 24px "Pixelify Sans", sans-serif';
  ctx.textAlign = 'center';
  STYLES.forEach(([nomStyle], i) => ctx.fillText(nomStyle, MARGE + i * CASE + CASE / 2, 34));
  cartes.forEach((carteHtml, ligne) => {
    const y = HAUT + ligne * CASE;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff4e0';
    ctx.font = '700 22px "Pixelify Sans", sans-serif';
    ctx.fillText(carteHtml.querySelector('h3').firstChild.textContent, 16, y + CASE / 2);
    ctx.fillStyle = '#c8b8a8';
    ctx.font = '500 15px "Pixelify Sans", sans-serif';
    ctx.fillText(carteHtml.querySelector('small').textContent, 16, y + CASE / 2 + 22);
    carteHtml.querySelectorAll('figure canvas').forEach((image, i) => {
      // le pixel art est agrandi sans lissage, les portraits 3D avec
      ctx.imageSmoothingEnabled = i < 2;
      const k = Math.min((CASE - 20) / image.width, (CASE - 20) / image.height);
      const l = image.width * k, h = image.height * k;
      ctx.drawImage(image, MARGE + i * CASE + (CASE - l) / 2, y + (CASE - h) / 2, l, h);
    });
  });
  const image = c.toDataURL('image/jpeg', 0.9);
  return (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
};
