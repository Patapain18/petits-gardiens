// ─────────────────────────────────────────────────────────────
// CHEF D'ORCHESTRE DU JEU (la page jeu.html)
// - charge le niveau demandé dans l'adresse (jeu.html?niveau=monde1-1)
// - fait tourner la boucle de jeu (logique + dessin)
// - gère l'interface (boutons, menu des gardiens, cartes de début et de fin)
// - branche le didacticiel quand le niveau en a un
// - charge le style graphique choisi et permet d'en changer à chaud
// - fait jouer la musique et les bruitages (src/son/)
// - applique les options du joueur (src/options.js) et ouvre leur fenêtre
// ─────────────────────────────────────────────────────────────
import {
  creerPartie, majPartie, construire, vendre, lancerVague, tourSur, ameliorer, prixAmelioration, prixRevente, estDisponible,
  vaguesTerminees, pouvoirPret, lancerMeteore, lancerGrandFroid,
} from './jeu/moteur.js';
import { NIVEAU_MAX, POUVOIRS, caracteristiques } from './jeu/donnees.js';
import { BENEDICTIONS, TOUTES_LES, choisirBenediction, ficheDe, pouvoirDe } from './jeu/benedictions.js';
import { chargerNiveau } from './jeu/niveau.js';
import { placeDuNiveau, niveauSuivant } from './jeu/campagne.js';
import { noterVictoire } from './progression.js';
import { meilleursScores, enregistrerScore, nettoyerPseudo, pseudoMemorise, memoriserPseudo, sourceDuClassement, LONGUEUR_PSEUDO } from './classement.js';
import { Didacticiel } from './didacticiel.js';
import { creerSon } from './son/son.js';
import { lireOptions, changerOptions, quandOptionsChangent } from './options.js';
import { creerFenetreOptions } from './fenetre-options.js';

// Toutes les fiches de src/niveaux/ (Vite les rassemble ici automatiquement)
const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const ficheParId = (id) => FICHES[`./niveaux/${id}.json`] || null;

// Quel niveau jouer ? On le lit dans l'adresse : jeu.html?niveau=monde1-1, ou ?niveau=editeur
// pour la fiche en cours dans l'éditeur de niveaux (gardée par le navigateur).
// (Sans niveau du tout, jeu.html renvoie à la carte des époques avant même de charger ce fichier.)
const demande = new URLSearchParams(location.search).get('niveau');
const depuisEditeur = demande === 'editeur';
function ficheDemandee() {
  if (depuisEditeur) {
    try { return JSON.parse(localStorage.getItem('pg-editeur-fiche')); } catch { return null; }
  }
  return ficheParId(demande);
}

// Le niveau joué : sa fiche est vérifiée puis complétée par chargerNiveau().
// Si la fiche manque ou a une erreur, on l'affiche à l'écran (plus pratique que la console).
function chargerOuSignaler(fiche) {
  const carte = document.querySelector('#message .carte');
  const signaler = (titre, texte) => {
    carte.replaceChildren(element('h1', '', titre), element('pre', '', texte), boutons([{ texte: 'Carte des époques', lien: './' }]));
  };
  if (!fiche) {
    signaler('Niveau introuvable', depuisEditeur
      ? 'Aucune fiche à tester : ouvre l’éditeur de niveaux et clique sur « Tester ce niveau ».'
      : `Il n’y a pas de niveau « ${demande} » dans src/niveaux/.`);
    throw new Error(`Niveau introuvable : ${demande}`);
  }
  try {
    return chargerNiveau(fiche);
  } catch (erreur) {
    signaler('Fiche de niveau à corriger', erreur.message);
    throw erreur;
  }
}

// Petits outils pour fabriquer les cartes de message. Le texte passe par
// textContent : il est affiché tel quel, jamais interprété comme du HTML.
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}
// boutons([{ texte, action } ou { texte, lien }]) : le premier est le bouton principal
function boutons(liste) {
  const zone = element('div', 'boutons-carte');
  liste.forEach(({ texte, action, lien }, i) => {
    const b = lien ? element('a', 'bouton-lien', texte) : element('button', i === 0 ? 'principal' : '', texte);
    if (lien) b.href = lien;
    if (lien && i === 0) b.classList.add('principal');
    if (action) b.dataset.action = action;
    zone.append(b);
  });
  return zone;
}

const niveau = chargerOuSignaler(ficheDemandee());
const place = depuisEditeur ? null : placeDuNiveau(niveau.id); // sa place dans la campagne (null hors campagne)
const didacticiel = new Didacticiel(niveau);
const son = creerSon(); // la musique et les bruitages (rien ne sonne avant le premier clic)

// Chaque style est un module à part, chargé seulement quand on le choisit
const STYLES = {
  voxel: () => import('./rendus/voxel.js'),
  cartoon: () => import('./rendus/cartoon.js'),
  pixel: () => import('./rendus/pixel.js'),
};

const $ = (s) => document.querySelector(s);
const conteneur = $('#scene');
const menu = $('#menu');

// En mode survie, tout le monde joue la même partie (la même graine de hasard) :
// les scores du classement se comparent vraiment. Ailleurs, la graine est tirée au hasard.
const nouvellePartie = () => creerPartie(niveau, niveau.survie ? 1 : undefined);
let etat = nouvellePartie();
let recordAvant = 0; // mode survie : le record de l'arène au début de la partie
let rendu = null;              // le style graphique actif
let styleActif = null;
const optionsDeDepart = lireOptions(); // les options du joueur (voir src/options.js)
let vitesse = optionsDeDepart.vitesse;
let enPause = true;            // en pause tant qu'on n'a pas cliqué sur « Jouer »
// socle survolé / sélectionné ; apercuPortee = la portée à montrer pendant qu'on survole « Améliorer » ;
// visee = 'meteore' pendant qu'on vise le Météore, viseeMeteore = l'endroit visé ({ x, y, rayon })
const ui = { survol: -1, selection: -1, apercuPortee: null, visee: null, viseeMeteore: null };

// Réglages d'affichage, gardés si on change de style puis qu'on revient : l'ambiance de départ vient
// de la fiche du niveau, la caméra (voxel) et la qualité viennent des options du joueur.
const reglages = { ambiance: niveau.ambiance, camera: optionsDeDepart.camera, qualite: optionsDeDepart.qualite };

// ── Changer de style graphique ───────────────────────────────
// forcer : refaire le style même s'il est déjà affiché (quand la qualité graphique change)
async function choisirStyle(nom, { forcer = false } = {}) {
  if (nom === styleActif && !forcer) return;
  styleActif = nom;
  son.choisirEpoque(nom); // la musique change d'époque avec le dessin
  const module = await STYLES[nom]();
  if (styleActif !== nom) return; // on a recliqué entre-temps sur un autre style
  if (rendu) rendu.detruire();
  conteneur.innerHTML = '';
  rendu = new module.default(conteneur, niveau, reglages);
  document.body.dataset.style = nom;
  document.querySelectorAll('[data-style]').forEach((b) => {
    if (b.tagName === 'BUTTON') b.setAttribute('aria-pressed', String(b.dataset.style === nom));
  });
  fermerMenu();
}

// ── La boucle de jeu ─────────────────────────────────────────
let avant = performance.now();
function boucle(maintenant) {
  // dt = temps écoulé depuis l'image précédente (plafonné si l'onglet a dormi)
  const dt = Math.min(0.05, (maintenant - avant) / 1000);
  avant = maintenant;

  // le jeu attend aussi pendant qu'une fiche du didacticiel est ouverte
  const enJeu = !enPause && !didacticiel.bloque;
  if (enJeu) {
    // On découpe en petits pas réguliers pour que la logique reste stable même en ×2
    let reste = dt * vitesse;
    while (reste > 0) {
      const pas = Math.min(reste, 1 / 60);
      majPartie(etat, pas);
      reste -= pas;
    }
  }

  if (rendu) rendu.dessiner(etat, enJeu ? dt * vitesse : 0, dt, ui);
  traiterEvenements();
  if (didacticiel.actif && rendu) {
    // le didacticiel ne parle que pendant la partie (pas sur les cartes de début et de fin)
    const ficheAvant = didacticiel.bloque;
    if ($('#message').hidden) didacticiel.maj(etat, rendu);
    else didacticiel.cacher();
    if (didacticiel.bloque && !ficheAvant) son.effet('fiche'); // une fiche vient de s'ouvrir
  }
  son.maj(etat, { pause: !enJeu }); // la musique suit la partie (calme, vague, chef, pause)
  majInterface();
  requestAnimationFrame(boucle);
}

// Effets d'interface liés aux événements du moteur (les styles, eux,
// ont déjà lu la liste pendant dessiner() pour leurs particules)
function bulle(texte, x, y, hauteur, classe = '') {
  const p = rendu.versEcran(x, y, hauteur);
  const b = document.createElement('div');
  b.className = 'bulle ' + classe;
  b.textContent = texte;
  b.style.left = p.x + 'px';
  b.style.top = p.y + 'px';
  $('#bulles').append(b);
  setTimeout(() => b.remove(), 950);
}

function traiterEvenements() {
  son.evenements(etat.evenements, niveau.largeur); // chaque événement a son bruitage
  for (const ev of etat.evenements) {
    if (!rendu) break;
    if (ev.type === 'mort') bulle('+' + ev.prime, ev.x, ev.y, 0.8);
    if (ev.type === 'amelioration') bulle(`Niveau ${ev.niveau}`, ev.x, ev.y, 1.4, 'bulle-niveau');
    if (ev.type === 'recolte') bulle('+' + ev.or, ev.x, ev.y, 1.4); // la Pépite rapporte sa récolte
    if (ev.type === 'grandFroid') montrerGivre();
  }
  etat.evenements.length = 0;
  if (etat.statut === 'perdu' && !$('#message').dataset.fin) afficherFin(false);
  if (etat.statut === 'gagne' && !$('#message').dataset.fin) afficherFin(true);
}

// ── Interface ────────────────────────────────────────────────
function majInterface() {
  $('#or').textContent = etat.or;
  // en mode survie, les vagues ne s'arrêtent jamais : pas de total, mais le record à battre
  $('#vague').textContent = niveau.survie ? String(etat.vague) : `${etat.vague} / ${niveau.vagues.length}`;
  if (niveau.survie) {
    const tenues = vaguesTerminees(etat);
    $('#record').textContent = Math.max(recordAvant, tenues);
    $('#ligne-record').classList.toggle('battu', tenues > recordAvant); // on est en train de battre le record
  }
  const bouton = $('#lancer');
  if (etat.statut === 'preparation' && etat.offre) {
    bouton.disabled = true; // une bénédiction attend d'être choisie
    bouton.textContent = 'Choisis une bénédiction';
  } else if (etat.statut === 'preparation') {
    bouton.disabled = false;
    bouton.textContent = `Lancer la vague ${etat.vague + 1}`;
  } else {
    bouton.disabled = true;
    bouton.textContent = etat.statut === 'vague' ? 'Vague en cours…' : 'Partie terminée';
  }
  if (etat.pouvoirs) majPouvoirs();
  if (niveau.benedictions) majBenedictions();
  // Le menu ouvert se met à jour si l'or change, ou si un gardien arrive (boutons grisés ou non)
  if (!menu.hidden) {
    menu.querySelectorAll('[data-prix]').forEach((b) => {
      const type = b.dataset.gardien; // seulement sur les boutons « poser un gardien »
      const pasArrive = type !== undefined && !estDisponible(etat, type);
      const manque = Number(b.dataset.prix) - etat.or;
      b.disabled = pasArrive || manque > 0;
      b.querySelector('.manque').textContent = pasArrive ? `Arrive à la vague ${niveau.gardiens[type]}`
        : manque > 0 ? `Il te manque ${manque} pièces` : '';
    });
    // Suivre le socle si la caméra bouge (style cinéma)
    placerMenu(ui.selection);
  }
}

// Un nombre écrit à la française (0.62 → « 0,62 »)
const fr = (n) => String(Math.round(n * 100) / 100).replace('.', ',');

// Les chiffres d'un gardien, en lignes « Dégâts 14 », « Portée 3,2 »…
function chiffresDe(c) {
  if (!c.projectile) return [['Récolte', `+${c.recolte} pièces à chaque vague`]]; // un gardien qui ne tire pas (la Pépite)
  if (c.rayon) return [['Dégâts', `${fr(c.degats)} par seconde`], ['Chauffe', `jusqu’à ×${fr(c.rayon.max)}`], ['Portée', fr(c.portee)]];
  const lignes = [['Dégâts', fr(c.degats)], ['Cadence', `${fr(c.cadence)} s`], ['Portée', fr(c.portee)]];
  if (c.zone) lignes.push(['Explosion', fr(c.zone)]);
  if (c.monstresMax) lignes.push(['Touche', `${c.monstresMax} monstres au plus`]);
  if (c.ralentissement) lignes.push(['Gel', `${fr(c.ralentissement.duree)} s, vitesse × ${fr(c.ralentissement.facteur)}`]);
  if (c.rebonds) lignes.push(['Éclair', `${c.rebonds.nombre + 1} monstres`]);
  if (c.souffle) lignes.push(['Recul', `${fr(c.souffle.recul)} case${c.souffle.recul >= 2 ? 's' : ''}`]);
  return lignes;
}

// Ce que change l'amélioration : « Dégâts 14 → 22, cadence 0,62 → 0,54 s… et une couronne »
// (la flèche est dans un <span> : la police pixel n'en a pas, on la grossit dans style.css)
const NOMS_ACCESSOIRES = {
  cape: 'une cape', couronne: 'une couronne', flamme: 'une flamme', cristaux: 'des cristaux', echarpe: 'une écharpe', cornes: 'des cornes',
  mortier: 'un mortier', antennes: 'des antennes', moulinet: 'un moulinet', petits: 'des petits',
  casque: 'un casque', pioche: 'une pioche', prisme: 'un prisme', lunettes: 'des lunettes',
};
function differences(avant, apres) {
  const changements = [];
  const comparer = (nom, a, b, unite = '') => {
    if (a !== b) changements.push(`${nom} ${fr(a)} <span class="fleche">→</span> ${fr(b)}${unite}`);
  };
  if (avant.recolte) comparer('récolte', avant.recolte, apres.recolte, ' pièces');
  comparer('dégâts', avant.degats, apres.degats, avant.rayon ? ' par seconde' : '');
  comparer('cadence', avant.cadence, apres.cadence, ' s');
  comparer('portée', avant.portee, apres.portee);
  if (avant.rayon) comparer('chauffe ×', avant.rayon.max, apres.rayon.max);
  if (avant.zone) comparer('explosion', avant.zone, apres.zone);
  if (avant.monstresMax) comparer('monstres touchés', avant.monstresMax, apres.monstresMax);
  if (avant.ralentissement) comparer('gel', avant.ralentissement.duree, apres.ralentissement.duree, ' s');
  if (avant.rebonds) comparer('éclair', avant.rebonds.nombre + 1, apres.rebonds.nombre + 1, ' monstres');
  if (avant.souffle) comparer('recul', avant.souffle.recul, apres.souffle.recul);
  const types = (c) => c.apparence.accessoires.map((a) => (typeof a === 'string' ? a : a.type));
  const nouveaux = types(apres).filter((t) => !types(avant).includes(t));
  let texte = changements.join(', ');
  if (nouveaux.length) texte += `, et ${nouveaux.map((t) => NOMS_ACCESSOIRES[t] || t).join(' et ')}`;
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function ouvrirMenu(index) {
  ui.selection = index;
  ui.apercuPortee = null;
  const tour = tourSur(etat, index);
  menu.innerHTML = '';
  if (!tour) {
    menu.setAttribute('aria-label', 'Choisir un gardien');
    menu.insertAdjacentHTML('beforeend', '<h2>Poser un gardien</h2>');
    for (const cle of Object.keys(niveau.gardiens)) { // seulement les gardiens que ce niveau propose
      const g = caracteristiques(cle, 1);
      const b = document.createElement('button');
      b.className = 'option';
      b.dataset.prix = g.cout;
      b.dataset.gardien = cle;
      b.innerHTML = `
        <span class="pastille" style="background:${g.apparence.couleurs.peau}"></span>
        <span class="nom">${g.nom}</span>
        <span class="prix"><span class="piece"></span>${g.cout}</span>
        <span class="role">${g.role}</span>
        <span class="manque"></span>`;
      b.addEventListener('click', () => {
        if (construire(etat, index, cle)) fermerMenu();
      });
      menu.append(b);
    }
  } else {
    const c = ficheDe(etat, tour.type, tour.niveau); // ses chiffres, avec les bénédictions
    menu.setAttribute('aria-label', `${c.nom}, niveau ${tour.niveau}`);
    menu.insertAdjacentHTML('beforeend', `
      <h2>${c.nom} <span class="niveau-gardien">niveau ${tour.niveau}/${NIVEAU_MAX}</span></h2>
      <p class="role-gardien">${c.role}</p>
      <dl class="chiffres">${chiffresDe(c).map(([nom, valeur]) => `<div><dt>${nom}</dt><dd>${valeur}</dd></div>`).join('')}</dl>`);

    const prix = prixAmelioration(tour);
    if (prix !== null) {
      const suivant = ficheDe(etat, tour.type, tour.niveau + 1);
      const b = document.createElement('button');
      b.className = 'option amelioration';
      b.dataset.prix = prix;
      b.innerHTML = `
        <span class="pastille" style="background:${suivant.apparence.couleurs.peau}"></span>
        <span class="nom">Améliorer&nbsp;: ${suivant.nom}</span>
        <span class="prix"><span class="piece"></span>${prix}</span>
        <span class="role">${differences(c, suivant)}</span>
        <span class="manque"></span>`;
      b.addEventListener('click', () => {
        if (ameliorer(etat, index)) ouvrirMenu(index); // le menu montre tout de suite le nouveau niveau
      });
      // pendant qu'on survole le bouton (ou qu'on y arrive au clavier), le cercle montre
      // la portée du niveau suivant. :focus-visible = le focus vient du clavier, pas du
      // focus automatique donné à l'ouverture du menu.
      const montrer = () => { if (b.matches(':hover, :focus-visible')) ui.apercuPortee = suivant.portee; };
      const cacher = () => { ui.apercuPortee = null; };
      b.addEventListener('mouseenter', montrer);
      b.addEventListener('focus', montrer);
      b.addEventListener('mouseleave', cacher);
      b.addEventListener('blur', cacher);
      menu.append(b);
    } else {
      menu.insertAdjacentHTML('beforeend', '<p class="niveau-max">Niveau maximum atteint.</p>');
    }
    const revendre = document.createElement('button');
    revendre.textContent = `Revendre (+${prixRevente(tour)})`;
    revendre.addEventListener('click', () => { vendre(etat, index); fermerMenu(); });
    menu.append(revendre);
  }
  menu.hidden = false;
  placerMenu(index);
  majInterface();
  menu.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
}

function placerMenu(index) {
  if (index < 0 || !rendu) return;
  const socle = niveau.socles[index];
  const p = rendu.versEcran(socle.x, socle.y, 0);
  const l = menu.offsetWidth, h = menu.offsetHeight;
  // à droite du socle, sans sortir de l'écran
  let x = p.x + 40, y = p.y - h / 2;
  if (x + l > innerWidth - 12) x = p.x - 40 - l;
  x = Math.max(12, Math.min(innerWidth - l - 12, x));
  y = Math.max(12, Math.min(innerHeight - h - 12, y));
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

function fermerMenu() {
  menu.hidden = true;
  ui.selection = -1;
  ui.apercuPortee = null;
}

// ── Les pouvoirs du château ──────────────────────────────────
// Deux boutons à côté de « Lancer la vague » (et les touches 1 et 2). Le Grand froid part tout
// de suite ; le Météore se vise : on clique sur le bouton, puis sur le chemin (clic droit, Échap
// ou un nouveau clic sur le bouton pour annuler).
const boutonsPouvoirs = [...document.querySelectorAll('[data-pouvoir]')];
for (const b of boutonsPouvoirs) {
  const { description, touche } = POUVOIRS[b.dataset.pouvoir];
  b.title = `${description} (touche ${touche})`;
  b.querySelector('.touche').textContent = touche;
  // après un clic, le bouton rend le clavier : sinon il le garderait, et la touche Espace (qui lance
  // la vague) appuierait sur lui à la place
  b.addEventListener('click', () => { utiliserPouvoir(b.dataset.pouvoir); b.blur(); });
}

function utiliserPouvoir(nom) {
  if (!pouvoirPret(etat, nom)) return;
  if (nom === 'froid') { lancerGrandFroid(etat); return; }
  if (ui.visee) { arreterVisee(); return; }
  ui.visee = 'meteore';
  fermerMenu();
  conteneur.classList.add('visee');
}

function arreterVisee() {
  ui.visee = null;
  ui.viseeMeteore = null;
  conteneur.classList.remove('visee');
}

// À chaque image : la recharge de chaque bouton (il se remplit), et « prêt » ou non
function majPouvoirs() {
  for (const b of boutonsPouvoirs) {
    const nom = b.dataset.pouvoir, reste = etat.pouvoirs[nom], pret = pouvoirPret(etat, nom);
    if (!pret && document.activeElement === b) b.blur(); // un bouton grisé ne garde pas le clavier
    b.disabled = !pret;
    b.classList.toggle('pret', pret);
    b.style.setProperty('--charge', String(1 - reste / pouvoirDe(etat, nom).recharge));
    b.querySelector('.etat-pouvoir').textContent = reste > 0 ? `${Math.ceil(reste)} s` : '';
    if (nom === 'meteore') b.setAttribute('aria-pressed', String(ui.visee === 'meteore'));
  }
  if (ui.visee && !pouvoirPret(etat, 'meteore')) arreterVisee(); // la vague est finie : on ne vise plus
}

// Le voile de givre du Grand froid (une animation CSS, relancée à chaque fois)
function montrerGivre() {
  const givre = $('#givre');
  givre.style.setProperty('--duree-givre', `${pouvoirDe(etat, 'froid').duree}s`);
  givre.classList.remove('actif');
  void givre.offsetWidth; // le navigateur « oublie » l'animation, pour pouvoir la rejouer
  givre.classList.add('actif');
}

// ── Les bénédictions ─────────────────────────────────────────
// Après la vague 5, 10, 15… le moteur propose 3 bénédictions (etat.offre) : une carte s'ouvre,
// et le joueur en choisit une (clic, ou touches 1, 2, 3) avant de lancer la vague suivante.
const SORTES = { gardien: 'Un gardien', gardiens: 'Tous les gardiens', pouvoir: 'Un pouvoir', or: 'L’or', socle: 'Un socle' };
let offreAffichee = null; // l'offre que montre la carte (on ne la remplit qu'une fois)

function majBenedictions() {
  const voile = $('#benediction');
  const montrer = Boolean(etat.offre) && !$('#message').dataset.fin;
  if (montrer && offreAffichee !== etat.offre) remplirBenediction();
  if (voile.hidden === montrer) voile.hidden = !montrer;
  if (!montrer) offreAffichee = null;
}

function remplirBenediction() {
  offreAffichee = etat.offre;
  fermerMenu();
  arreterVisee();
  $('#benediction-titre').textContent = `Vague ${vaguesTerminees(etat)} tenue !`;
  $('#choix-benedictions').replaceChildren(...etat.offre.map((id, i) => {
    const b = BENEDICTIONS[id];
    const bouton = element('button', 'choix-benediction');
    bouton.dataset.sorte = b.sorte;
    bouton.append(element('kbd', '', String(i + 1)), element('span', 'sorte-benediction', SORTES[b.sorte]),
      element('strong', '', b.nom), element('span', 'texte-benediction', b.texte));
    const deja = etat.benedictions.filter((x) => x === id).length;
    if (deja) bouton.append(element('span', 'deja-benediction', deja === 1 ? 'Déjà choisie une fois' : `Déjà choisie ${deja} fois`));
    bouton.addEventListener('click', () => prendreBenediction(id));
    return bouton;
  }));
  son.effet('fiche');
  $('#choix-benedictions button').focus({ preventScroll: true });
}

function prendreBenediction(id) {
  if (!choisirBenediction(etat, id)) return;
  $('#benediction').hidden = true;
  offreAffichee = null;
  afficherMesBenedictions();
  document.activeElement?.blur?.(); // Espace lancera la vague suivante
}

// Les bénédictions déjà choisies, en petites étiquettes (« Comète ×2 »), le détail au survol
function afficherMesBenedictions() {
  const comptes = new Map();
  for (const id of etat.benedictions) comptes.set(id, (comptes.get(id) || 0) + 1);
  const zone = $('#mes-benedictions');
  zone.hidden = !comptes.size;
  zone.replaceChildren(...[...comptes].map(([id, n]) => {
    const b = BENEDICTIONS[id];
    const etiquette = element('span', '', n > 1 ? `${b.nom} ×${n}` : b.nom);
    etiquette.dataset.sorte = b.sorte;
    etiquette.title = b.texte;
    return etiquette;
  }));
}

// ── Les cartes de début et de fin ────────────────────────────
// Où l'on est : « Monde 1 · Niveau 2 », « Test depuis l'éditeur »…
function surtitre() {
  if (niveau.survie) return 'Mode survie';
  if (place) return `Monde ${place.monde.numero} · Niveau ${place.numero}`;
  return depuisEditeur ? 'Test depuis l’éditeur' : 'Niveau hors campagne';
}

function afficherIntro() {
  const carte = $('#message .carte');
  carte.replaceChildren(element('p', 'surtitre', surtitre()), element('h1', '', niveau.nom));
  if (niveau.description) carte.append(element('p', 'description-niveau', niveau.description));
  // (un niveau qui présente seulement un personnage, comme le chef du monde 2, n'est pas un didacticiel)
  if (niveau.difficulte === 'didacticiel' || niveau.didacticiel.lecons.length) carte.append(element('p', 'mention-didacticiel', 'Didacticiel : on t’explique tout en jouant.'));
  const regle = element('p', '', niveau.survie
    ? 'Ton score, c’est le nombre de vagues tenues. '
    : 'Des monstres suivent le chemin vers le château : ');
  regle.append(element('strong', '', niveau.survie ? 'Un seul monstre dans le château, et la partie s’arrête.' : 'si un seul entre, c’est perdu.'));
  carte.append(regle);
  if (niveau.benedictions) {
    carte.append(element('p', 'mention-benedictions', `Toutes les ${TOUTES_LES} vagues tenues, une bénédiction : un bonus à choisir parmi 3, pour le reste de la partie.`));
  }
  if (niveau.pouvoirs) {
    const { meteore, froid } = POUVOIRS;
    carte.append(element('p', 'mention-pouvoirs', `Deux pouvoirs du château t’aident pendant les vagues : le ${meteore.nom} (touche ${meteore.touche}), que tu vises sur le chemin, et le ${froid.nom} (touche ${froid.touche}), qui gèle tous les monstres.`));
  }
  // le record à battre (lu dans le classement, qui répond « plus tard »)
  const record = element('p', 'record-arene', '');
  if (niveau.survie) {
    carte.append(record);
    meilleursScores(niveau.id, 1).then(([premier]) => {
      record.textContent = premier
        ? `Le record de l’arène : ${pluriel(premier.vagues, 'vague')}, par ${premier.pseudo}.`
        : 'Personne n’a encore joué ici : à toi l’honneur !';
    });
  }
  carte.append(boutons([{ texte: 'Jouer', action: 'jouer' }, { texte: 'Carte des époques', lien: './' }]));
  $('#message').hidden = false;
  carte.querySelector('[data-action="jouer"]').focus();
}

// « 1 vague », « 12 vagues »
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// Le tableau des 10 meilleurs scores de l'arène ; moi = la place à mettre en avant
async function tableauClassement(moi) {
  const scores = await meilleursScores(niveau.id, 10);
  const table = element('table', 'classement');
  const tete = table.createTHead().insertRow();
  for (const titre of ['', 'Pseudo', 'Vagues', 'Monstres']) tete.append(element('th', '', titre));
  const corps = table.createTBody();
  scores.forEach((score, i) => {
    const ligne = corps.insertRow();
    if (i + 1 === moi) ligne.className = 'moi';
    // textContent partout : un pseudo est affiché tel quel, jamais interprété comme du HTML
    for (const valeur of [i + 1, score.pseudo, score.vagues, score.battus]) ligne.append(element('td', '', String(valeur)));
  });
  return table;
}

// La fin d'une partie de survie : le score, le pseudo, puis le classement
function afficherFinSurvie() {
  const m = $('#message');
  m.dataset.fin = '1';
  const carte = m.querySelector('.carte');
  const vagues = vaguesTerminees(etat), battus = etat.battus;
  const titre = etat.statut === 'gagne' ? `Incroyable : les ${pluriel(vagues, 'vague')} tenues !`
    : vagues ? `Tu as tenu ${pluriel(vagues, 'vague')}` : 'Aucune vague tenue';
  carte.replaceChildren(
    element('p', 'surtitre', surtitre()),
    element('h1', '', titre),
    element('p', '', `${battus} monstre${battus > 1 ? 's' : ''} battu${battus > 1 ? 's' : ''}.`),
  );
  if (vagues > recordAvant) carte.append(element('p', 'nouveau-record', 'Nouveau record de l’arène !'));

  // le formulaire du pseudo
  const formulaire = element('form', 'formulaire-score');
  const etiquette = element('label', '', 'Ton pseudo pour le classement');
  const champ = element('input');
  champ.maxLength = LONGUEUR_PSEUDO;
  champ.autocomplete = 'nickname';
  champ.value = pseudoMemorise();
  etiquette.append(champ);
  const envoyer = element('button', 'principal', 'Enregistrer mon score');
  envoyer.type = 'submit';
  const erreur = element('p', 'erreur-pseudo', '');
  // le classement est en ligne : tout le monde verra le pseudo
  const prudence = element('p', 'note-classement', 'Ton pseudo sera visible par tous les joueurs : choisis un surnom, pas ton vrai nom.');
  formulaire.append(etiquette, envoyer, erreur, prudence);
  champ.addEventListener('input', () => { erreur.textContent = ''; });
  formulaire.addEventListener('submit', async (ev) => {
    ev.preventDefault(); // un formulaire rechargerait la page : on s'en occupe nous-mêmes
    const pseudo = nettoyerPseudo(champ.value);
    if (!pseudo) {
      erreur.textContent = `Écris un pseudo (${LONGUEUR_PSEUDO} caractères au plus).`;
      champ.focus();
      return;
    }
    memoriserPseudo(pseudo);
    envoyer.disabled = true;
    envoyer.textContent = 'Envoi…';
    const resultat = await enregistrerScore(niveau.id, { pseudo, vagues, battus });
    if (resultat.erreur) {
      // le serveur a refusé (un pseudo bizarre, trop d'envois d'un coup…) : on le dit, et on peut réessayer
      erreur.textContent = resultat.erreur;
      envoyer.disabled = false;
      envoyer.textContent = 'Enregistrer mon score';
      return;
    }
    const { place, total } = resultat;
    const rang = element('p', 'place-classement', `Tu prends la ${place === 1 ? '1re' : `${place}e`} place sur ${total}.`);
    const ou = element('p', 'note-classement', resultat.horsLigne
      ? 'Le classement en ligne ne répond pas : ton score est gardé sur cet ordinateur.'
      : 'Classement en ligne, avec tous les joueurs.');
    formulaire.replaceWith(rang, ou, await tableauClassement(place));
    rejouer.classList.add('principal'); // le score est rangé : rejouer devient l'action principale
    rejouer.focus();
  });
  // un seul bouton principal à la fois : d'abord « Enregistrer mon score »
  const choix = boutons([{ texte: 'Rejouer', action: 'recommencer' }, { texte: 'Carte des époques', lien: './' }]);
  const rejouer = choix.querySelector('[data-action="recommencer"]');
  rejouer.classList.remove('principal');
  carte.append(formulaire, choix);
  m.hidden = false;
  champ.focus();
  champ.select();
}

// Le record de l'arène, lu au début de chaque partie de survie
async function lireRecord() {
  if (!niveau.survie) return;
  const [premier] = await meilleursScores(niveau.id, 1);
  recordAvant = premier ? premier.vagues : 0;
}

function afficherFin(victoire) {
  son.jingle(victoire ? 'victoire' : 'defaite');
  if (niveau.survie) return afficherFinSurvie();
  const m = $('#message');
  m.dataset.fin = '1';
  const carte = m.querySelector('.carte');
  const suivant = victoire && place ? niveauSuivant(niveau.id) : null;
  if (victoire && place) noterVictoire(niveau.id); // le niveau suivant est maintenant débloqué

  let texte, choix;
  if (victoire) {
    texte = `Les ${niveau.vagues.length} vagues sont repoussées. Tes gardiens ont gardé ${etat.or} pièces en poche.`;
    if (place?.dernierDuMonde) texte += ` Tu as terminé le monde ${place.monde.numero} !${suivant ? '' : ' La suite arrive bientôt.'}`;
    if (depuisEditeur) choix = [{ texte: 'Rejouer', action: 'recommencer' }, { texte: 'Modifier dans l’éditeur', lien: './editeur.html' }];
    else if (suivant) choix = [{ texte: `Niveau suivant : ${ficheParId(suivant)?.nom || suivant}`, lien: `./jeu.html?niveau=${suivant}` }, { texte: 'Rejouer', action: 'recommencer' }, { texte: 'Carte des époques', lien: './' }];
    else choix = [{ texte: 'Carte des époques', lien: './' }, { texte: 'Rejouer', action: 'recommencer' }];
  } else {
    texte = `Il a passé la porte pendant la vague ${etat.vague}. Place tes gardiens près des virages : c’est là qu’ils tirent le plus longtemps.`;
    choix = depuisEditeur
      ? [{ texte: 'Réessayer', action: 'recommencer' }, { texte: 'Modifier dans l’éditeur', lien: './editeur.html' }]
      : [{ texte: 'Réessayer', action: 'recommencer' }, { texte: 'Carte des époques', lien: './' }];
  }
  carte.replaceChildren(
    element('p', 'surtitre', surtitre()),
    element('h1', '', victoire ? 'Le château tient bon !' : 'Un monstre est entré'),
    element('p', '', texte),
    boutons(choix),
  );
  m.hidden = false;
  carte.querySelector('button, a').focus();
}

function recommencer() {
  etat = nouvellePartie();
  arreterVisee();
  offreAffichee = null;
  $('#benediction').hidden = true;
  afficherMesBenedictions(); // (plus aucune)
  lireRecord(); // un score vient peut-être d'être enregistré
  fermerMenu();
  const m = $('#message');
  m.hidden = true;
  delete m.dataset.fin;
  enPause = false;
  $('#pause').setAttribute('aria-pressed', 'false');
  rendu?.reinitialiser?.();
  son.recommencer();
}

// ── Branchements des boutons et de la souris ─────────────────
// Les boutons des cartes sont recréés à chaque fois : un seul écouteur, sur la carte entière
$('#message').addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'jouer') { $('#message').hidden = true; enPause = false; }
  if (action === 'recommencer') recommencer();
});
$('#lancer').addEventListener('click', () => { if (lancerVague(etat)) son.effet('vague'); });
$('#recommencer').addEventListener('click', recommencer);
// la vitesse est une option : le jeu s'en souvient (l'abonnement aux options, plus bas, l'applique)
$('#vitesse').addEventListener('click', () => changerOptions({ vitesse: vitesse === 1 ? 2 : vitesse === 2 ? 3 : 1 }));
$('#pause').addEventListener('click', (e) => {
  enPause = !enPause;
  e.currentTarget.setAttribute('aria-pressed', String(enPause));
});

document.querySelectorAll('button[data-style]').forEach((b) =>
  b.addEventListener('click', () => choisirStyle(b.dataset.style)));

document.querySelectorAll('[data-ambiance]').forEach((b) =>
  b.addEventListener('click', () => {
    reglages.ambiance = b.dataset.ambiance;
    document.querySelectorAll('[data-ambiance]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    rendu?.choisirAmbiance?.(b.dataset.ambiance);
  }));
// la caméra aussi est une option (l'abonnement aux options l'applique)
document.querySelectorAll('[data-camera]').forEach((b) =>
  b.addEventListener('click', () => changerOptions({ camera: b.dataset.camera })));

conteneur.addEventListener('pointermove', (e) => {
  if (!rendu) return;
  if (ui.visee) {
    // on vise le Météore : le cercle suit la souris
    const p = rendu.versSol(e.clientX, e.clientY);
    ui.viseeMeteore = p && { ...p, rayon: pouvoirDe(etat, 'meteore').rayon };
    ui.survol = -1;
    return;
  }
  ui.survol = rendu.socleSous(e.clientX, e.clientY);
  conteneur.style.cursor = ui.survol >= 0 ? 'pointer' : '';
});
conteneur.addEventListener('click', (e) => {
  if (!rendu) return;
  if (ui.visee) {
    const p = rendu.versSol(e.clientX, e.clientY);
    if (p && lancerMeteore(etat, p.x, p.y)) arreterVisee();
    return;
  }
  const i = rendu.socleSous(e.clientX, e.clientY);
  if (i >= 0) { ouvrirMenu(i); son.effet('menu'); } else fermerMenu();
});
// clic droit pendant qu'on vise : on annule (sans ouvrir le menu du navigateur)
conteneur.addEventListener('contextmenu', (e) => {
  if (!ui.visee) return;
  e.preventDefault();
  arreterVisee();
});
addEventListener('keydown', (e) => {
  // la carte des bénédictions est ouverte : 1, 2 et 3 choisissent (et rien d'autre ne réagit)
  if (!$('#benediction').hidden) {
    const id = etat.offre?.[Number(e.key) - 1];
    if (id) { e.preventDefault(); prendreBenediction(id); }
    return;
  }
  if (e.key === 'Escape') { fermerMenu(); didacticiel.fermerFiche(); arreterVisee(); }
  // Espace lance la vague, sauf si un bouton actif a le clavier (Espace appuie alors sur lui)
  if (e.key === ' ' && (e.target === document.body || e.target.disabled)) { e.preventDefault(); $('#lancer').click(); }
  // les pouvoirs du château : touches 1 et 2 (pas pendant qu'on écrit son pseudo)
  const dansUnChamp = e.target instanceof Element && e.target.closest('input, textarea');
  if (etat.pouvoirs && !dansUnChamp) {
    const nom = Object.keys(POUVOIRS).find((n) => POUVOIRS[n].touche === e.key);
    if (nom) utiliserPouvoir(nom);
  }
});
addEventListener('resize', () => rendu?.redimensionner());

// ── Le son ───────────────────────────────────────────────────
// Les navigateurs n'acceptent de faire du bruit qu'après un geste du joueur :
// le premier clic (ou la première touche) réveille le son.
const reveillerSon = () => son.debloquer();
addEventListener('pointerdown', reveillerSon, { capture: true });
addEventListener('keydown', reveillerSon, { capture: true });

// Un petit « clic » pour les boutons (sauf ceux qui ont déjà leur propre son :
// poser ou améliorer un gardien, lancer une vague)
document.addEventListener('click', (e) => {
  const b = e.target.closest('button, a.bouton-lien');
  if (!b || b.disabled || b.matches('.option, #lancer')) return;
  son.effet('clic');
});

// ── Les options ──────────────────────────────────────────────
// La fenêtre des options (la même que sur la carte des époques) : le jeu se met
// en pause tant qu'elle est ouverte.
let pauseAvantOptions = false;
const fenetreOptions = creerFenetreOptions({
  enOuvrant: () => { pauseAvantOptions = enPause; enPause = true; fermerMenu(); },
  enFermant: () => { enPause = pauseAvantOptions; },
});
$('#bouton-options').addEventListener('click', () => fenetreOptions.ouvrir());

// Appliquer les options : au démarrage, puis chaque fois qu'une option change
// (dans la fenêtre, avec la touche M, le bouton « Vitesse » ou ceux de la caméra)
function appliquerOptions(o) {
  vitesse = o.vitesse;
  $('#vitesse').textContent = `Vitesse ×${vitesse}`;
  document.body.classList.toggle('interface-grande', o.interface === 'grande');
  $('#bouton-options').textContent = o.coupe ? 'Options (muet)' : 'Options';
  if (o.camera !== reglages.camera) {
    reglages.camera = o.camera;
    rendu?.choisirCamera?.(o.camera);
  }
  document.querySelectorAll('[data-camera]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.camera === o.camera)));
  if (o.qualite !== reglages.qualite) {
    reglages.qualite = o.qualite;
    if (styleActif) choisirStyle(styleActif, { forcer: true }); // le style est refait avec la nouvelle qualité
  }
}
quandOptionsChangent(appliquerOptions);
appliquerOptions(optionsDeDepart);

// La touche M coupe (ou remet) tout le son, sauf pendant qu'on écrit son pseudo (mode survie)
addEventListener('keydown', (e) => {
  const dansUnChamp = e.target instanceof Element && e.target.closest('input, textarea');
  if ((e.key === 'm' || e.key === 'M') && !dansUnChamp) son.regler({ coupe: !son.reglages.coupe });
});

// ── C'est parti ──────────────────────────────────────────────
// Le style (l'époque) vient de la fiche du niveau. Les boutons « Style » permettent
// seulement de voir le niveau dans une autre époque, pour comparer.
choisirStyle(niveau.style);
document.title = `${niveau.nom} — Petits Gardiens`;
$('#ligne-record').hidden = !niveau.survie;
$('#pouvoirs').hidden = !niveau.pouvoirs;
lireRecord();
if (depuisEditeur) {
  // On vient de l'éditeur : pas besoin de la carte de début, on joue directement
  $('#lien-editeur').hidden = false;
  $('#message').hidden = true;
  enPause = false;
} else {
  afficherIntro();
}
document.querySelectorAll('[data-ambiance]').forEach((b) =>
  b.setAttribute('aria-pressed', String(b.dataset.ambiance === reglages.ambiance)));
requestAnimationFrame(boucle);

// Accès de débogage depuis la console du navigateur (ex. : __jeu.etat.or = 999).
// __jeu.avancer(3) fait avancer la partie de 3 secondes, puis redessine : pratique pour
// tester même quand l'onglet est caché (le navigateur met alors la boucle en pause).
window.__jeu = {
  get etat() { return etat; }, get rendu() { return rendu; }, get ui() { return ui; }, son,
  avancer(secondes = 1) {
    for (let t = 0; t < secondes; t += 1 / 60) majPartie(etat, 1 / 60);
    rendu?.dessiner(etat, 1 / 60, 1 / 60, ui);
    traiterEvenements();
    majInterface();
  },
};

// Capture d'écran (développement) : __capturer('nom') enregistre captures/nom.jpg
window.__capturer = async (nom = 'capture') => {
  const canvas = conteneur.querySelector('canvas');
  rendu.dessiner(etat, 0, 0, ui); // on redessine juste avant de lire l'image
  const image = canvas.toDataURL('image/jpeg', 0.88);
  return (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
};
