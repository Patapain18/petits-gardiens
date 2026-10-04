// ─────────────────────────────────────────────────────────────
// L'APERÇU DE LA PROCHAINE VAGUE
// Avant de lancer une vague, le joueur voit ce qui arrive : quels monstres,
// combien, et ce qu'ils ont de spécial (ils volent, ils ont une carapace…).
// Et si sa défense a un trou contre cette vague (des volants, et aucun
// gardien qui les touche), l'aperçu le prévient.
// Les vraies parties l'ont montré : dans la vallée du Colosse, 9 parties sur
// 13 ont été perdues à la vague 2, celle des Voltigeurs, que les rochers du
// Grondin ne touchent pas… et rien ne disait qu'ils arrivaient.
// Ce module ne connaît que les règles (pas l'écran) : main.js l'affiche.
// ─────────────────────────────────────────────────────────────
import { MONSTRES, caracteristiques } from './donnees.js';
import { estDisponible, tourSur, prixAmelioration } from './moteur.js';
import { socleActif } from './benedictions.js';

const virgule = (n) => String(Math.round(n * 10) / 10).replace('.', ',');
const pluriel = (n, nom) => `${n} ${nom}${n > 1 ? 's' : ''}`;
// « une Braise », « un Grondin » : les gardiens qui sont des garçons (les autres sont des filles)
const GARCONS = ['grondin', 'prisme'];
const unGardien = (type) => `${GARCONS.includes(type) ? 'un' : 'une'} ${caracteristiques(type, 1).nom}`;

// Ce qu'un monstre a de spécial : un mot court (pour l'étiquette) et une phrase (pour le survol).
// force : en mode survie, les monstres renforcés ont « force » fois plus de points de vie.
export function traitsDe(type, force = 1) {
  const m = MONSTRES[type];
  const traits = [];
  if (m.boss) traits.push({ cle: 'chef', mot: 'chef', phrase: 'Le chef des monstres : énormément de points de vie.' });
  if (m.volant) traits.push({ cle: 'volant', mot: 'vole', phrase: 'Il vole au-dessus du chemin : les rochers du Grondin passent dessous.' });
  if (m.armure) traits.push({ cle: 'armure', mot: 'carapace', phrase: `Carapace : chaque coup perd ${m.armure} dégâts (le rayon du Prisme la traverse).` });
  if (m.creuse) traits.push({ cle: 'creuse', mot: 'creuse', phrase: 'Il creuse sous le chemin : personne ne peut le viser quand il est dessous.' });
  if (m.feu) traits.push({ cle: 'feu', mot: 'crache du feu', phrase: `Il crache du feu sur un gardien, qui reste assommé ${virgule(m.feu.duree)} s.` });
  if (m.enfants) {
    const petits = pluriel(m.enfants.nombre, MONSTRES[m.enfants.type].nom);
    traits.push({ cle: 'enfants', mot: `${petits} dedans`, phrase: `En tombant, il libère ${petits}, qui continuent la route.` });
  }
  if (!m.boss && m.vitesse >= 1.5) traits.push({ cle: 'rapide', mot: 'rapide', phrase: 'Très rapide : il reste peu de temps devant tes gardiens.' });
  if (!m.boss && m.pv >= 100) traits.push({ cle: 'solide', mot: 'solide', phrase: `Très solide : ${m.pv} points de vie.` });
  if (force > 1) traits.push({ cle: 'renforce', mot: `renforcé ×${virgule(force)}`, phrase: `Renforcé : ${virgule(force)} fois plus de points de vie que d’habitude.` });
  return traits;
}

// La prochaine vague : null s'il n'y en a plus. Sinon { numero, monstres, total, alertes } :
// - monstres : une ligne par sorte de monstre, dans l'ordre où ils arrivent ({ type, nom,
//   nombre, force, traits }) ;
// - total : le nombre de monstres (sans les petits qui sortent des Gigognes) ;
// - alertes : les trous de la défense contre cette vague ({ fort, texte } : fort = un vrai danger).
export function apercuVague(etat) {
  const { vagues } = etat.niveau;
  const index = etat.vague; // le nombre de vagues déjà lancées : la prochaine a ce numéro dans la liste
  const groupes = vagues[index];
  if (!groupes) return null;
  const parSorte = new Map();
  for (const g of [...groupes].sort((a, b) => (a.delai ?? 0) - (b.delai ?? 0))) {
    const ligne = parSorte.get(g.type) || { type: g.type, nom: MONSTRES[g.type].nom, nombre: 0, force: 1 };
    ligne.nombre += g.nombre;
    ligne.force = Math.max(ligne.force, g.force || 1);
    parSorte.set(g.type, ligne);
  }
  const monstres = [...parSorte.values()].map((m) => ({ ...m, traits: traitsDe(m.type, m.force) }));
  return {
    numero: index + 1,
    monstres,
    total: monstres.reduce((s, m) => s + m.nombre, 0),
    alertes: alertes(etat, monstres),
  };
}

// Les noms d'une liste de monstres, à la française (« les Voltigeurs et le Dragon »)
function noms(monstres) {
  const mots = monstres.map((m) => (m.nombre > 1 ? `les ${m.nom}s` : `le ${m.nom}`));
  return mots.length > 1 ? `${mots.slice(0, -1).join(', ')} et ${mots[mots.length - 1]}` : mots[0];
}

// Les trous de la défense contre ces monstres (d'après les gardiens posés)
function alertes(etat, monstres) {
  const liste = [];
  const tireurs = etat.tours.map((t) => caracteristiques(t.type, t.niveau)).filter((c) => c.projectile);
  if (!tireurs.length) {
    liste.push({ fort: true, texte: 'Aucun gardien ne tire encore : pose-en avant de lancer la vague.' });
  } else {
    // des volants, et que des tirs en cloche (les rochers du Grondin), qui retombent au sol
    const volants = monstres.filter((m) => MONSTRES[m.type].volant);
    if (volants.length && !tireurs.some((c) => !c.projectile.cloche)) {
      liste.push({ fort: true, texte: `Aucun de tes gardiens ne touche ${noms(volants)}, qui volent : les rochers passent dessous. Il faut une Braise, une Givrine, une Étincelle ou un Prisme.` });
    }
    // une carapace, et que des petits coups (le rayon du Prisme, lui, la traverse)
    for (const m of monstres.filter((x) => MONSTRES[x.type].armure)) {
      const armure = MONSTRES[m.type].armure;
      if (!tireurs.some((c) => c.projectile.type === 'rayon' || c.degats >= 2 * armure)) {
        liste.push({ fort: false, texte: `La carapace ${m.nombre > 1 ? `des ${m.nom}s` : `de la ${m.nom}`} enlève ${armure} dégâts à chaque coup : tes gardiens tapent trop doucement. Il faut de gros coups (un Grondin, des gardiens améliorés) ou le rayon d’un Prisme.` });
      }
    }
  }
  // l'or qui dort (au moins 100 pièces) : de quoi poser un gardien de plus, ou en améliorer un. (Une
  // vraie partie perdue aux deux étangs : une seule Braise, et 130 pièces en poche.)
  const achat = moinsCherAchat(etat);
  if (achat && etat.or >= Math.max(100, achat.prix)) liste.push({ fort: false, texte: `Il te reste ${etat.or} pièces : de quoi ${achat.texte}.` });
  return liste;
}

// La dépense la moins chère possible maintenant : poser un gardien sur un socle libre, ou en
// améliorer un ({ prix, texte }, ou null s'il n'y a rien à acheter)
function moinsCherAchat(etat) {
  let meilleur = null;
  const proposer = (prix, texte) => { if (prix !== null && (!meilleur || prix < meilleur.prix)) meilleur = { prix, texte }; };
  const libre = etat.niveau.socles.some((_, i) => socleActif(etat, i) && !tourSur(etat, i));
  if (libre) {
    for (const type of Object.keys(etat.niveau.gardiens)) {
      if (estDisponible(etat, type)) proposer(caracteristiques(type, 1).cout, `poser ${unGardien(type)}`);
    }
  }
  for (const tour of etat.tours) proposer(prixAmelioration(tour), `améliorer ${unGardien(tour.type)}`);
  return meilleur;
}
