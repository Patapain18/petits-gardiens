// ─────────────────────────────────────────────────────────────
// CHEF D'ORCHESTRE DU JEU (la page jeu.html)
// - charge le niveau demandé dans l'adresse (jeu.html?niveau=monde1-1)
// - fait tourner la boucle de jeu (logique + dessin)
// - gère l'interface (boutons, menu des gardiens, cartes de début et de fin)
// - branche le didacticiel quand le niveau en a un
// - charge le style graphique choisi et permet d'en changer à chaud
// - fait jouer la musique et les bruitages (src/son/)
// - applique les options du joueur (src/options.js) et ouvre leur fenêtre
// - enregistre la partie (jeu/enregistrement.js) et l'envoie à la fin (parties.js)
// ─────────────────────────────────────────────────────────────
import {
  creerPartie, majPartie, tourSur, prixAmelioration, prixRevente, estDisponible, vaguesTerminees, pouvoirPret, pouvoirHerosPret, PAS,
} from './jeu/moteur.js';
import { NIVEAU_MAX, POUVOIRS, HEROS, caracteristiques } from './jeu/donnees.js';
import { BENEDICTIONS, TOUTES_LES, ficheDe, pouvoirDe, ficheDuHeros } from './jeu/benedictions.js';
import { nouvelEnregistrement, agir as agirEtNoter, noterControle } from './jeu/enregistrement.js';
import { VERSION, preparerEnvoi, garderEtEnvoyer, garderEnAttente, envoyerPartiesEnAttente } from './parties.js';
import { chargerNiveau } from './jeu/niveau.js';
import { placeDuNiveau, niveauSuivant } from './jeu/campagne.js';
import { noterVictoire } from './progression.js';
import { meilleursScores, enregistrerScore, nettoyerPseudo, pseudoMemorise, memoriserPseudo, sourceDuClassement, LONGUEUR_PSEUDO, SAISON } from './classement.js';
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
// L'enregistrement de la partie : chaque décision du joueur, avec son moment (voir
// jeu/enregistrement.js). Pas pour un niveau en essai depuis l'éditeur : sa fiche n'existe
// que dans ce navigateur, personne ne pourrait rejouer la partie.
const nouvelEnregistrementSiPossible = () => (depuisEditeur ? null : nouvelEnregistrement(etat, VERSION));
let enregistrement = nouvelEnregistrementSiPossible();
let dejaEnvoyee = false;  // la partie est finie et son enregistrement est parti
let partieEnvoyee = null; // cet envoi : une promesse de son identifiant sur le serveur (ou de null)

// Toutes les décisions du joueur passent par ici : le moteur les fait, l'enregistrement les note
const agir = (nom, ...args) => agirEtNoter(enregistrement, etat, nom, ...args);
let recordAvant = 0; // mode survie : le record de l'arène au début de la partie
let rendu = null;              // le style graphique actif
let styleActif = null;
const optionsDeDepart = lireOptions(); // les options du joueur (voir src/options.js)
let vitesse = optionsDeDepart.vitesse;
let enPause = true;            // en pause tant qu'on n'a pas cliqué sur « Jouer »
// socle survolé / sélectionné ; apercuPortee = la portée à montrer pendant qu'on survole « Améliorer » ;
// visee = 'meteore' pendant qu'on vise le Météore (viseeMeteore = l'endroit visé : { x, y, rayon }), ou
// 'bond' pendant qu'on vise le Bond du héros (viseeBond) ;
// herosChoisi : on a cliqué sur le héros, le prochain clic sur la carte l'envoie (viseeHeros : où)
const ui = { survol: -1, selection: -1, apercuPortee: null, visee: null, viseeMeteore: null, viseeBond: null, herosChoisi: false, viseeHeros: null };

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
// Le jeu avance par pas toujours égaux (PAS = 1/60 s) : c'est ce qui permet de rejouer une
// partie enregistrée à l'identique. Le temps écoulé depuis l'image précédente s'ajoute à une
// réserve, qu'on dépense pas par pas ; ce qui reste attend l'image suivante. (Le « - 0,001 » :
// une image arrive parfois un poil avant 1/60 s ; on fait quand même son pas, et la réserve
// passe un peu sous zéro. Sinon, de temps en temps, une image n'aurait aucun pas.)
let avant = performance.now();
let reserve = 0;
function boucle(maintenant) {
  // dt = temps écoulé depuis l'image précédente (plafonné si l'onglet a dormi ; jamais négatif :
  // l'heure donnée à la toute première image peut être un poil plus ancienne que « avant »)
  const dt = Math.max(0, Math.min(0.05, (maintenant - avant) / 1000));
  avant = maintenant;

  // le jeu attend aussi pendant qu'une fiche du didacticiel est ouverte
  const enJeu = !enPause && !didacticiel.bloque;
  if (enJeu) {
    reserve += dt * vitesse;
    while (reserve >= PAS - 0.001) {
      faireUnPas();
      reserve -= PAS;
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

// Un pas de jeu. Quand une vague se termine (ou la partie), l'enregistrement note un contrôle.
function faireUnPas() {
  const statutAvant = etat.statut;
  majPartie(etat, PAS);
  if (statutAvant === 'vague' && etat.statut !== 'vague') noterControle(enregistrement, etat);
}

// La partie est finie, ou le joueur la quitte en route : on envoie son enregistrement (une
// seule fois). statut : 'perdu', 'gagne' ou 'abandon'. Une partie quittée avant la première
// vague n'apprend rien : on ne l'envoie pas.
function envoyerEnregistrement(statut) {
  if (!enregistrement || dejaEnvoyee || etat.vague === 0) return;
  dejaEnvoyee = true;
  partieEnvoyee = garderEtEnvoyer(preparerEnvoi(enregistrement, etat, statut));
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
  setTimeout(() => b.remove(), classe.includes('bulle-longue') ? 2700 : 950); // (le temps de son animation)
}

function traiterEvenements() {
  son.evenements(etat.evenements, niveau.largeur); // chaque événement a son bruitage
  for (const ev of etat.evenements) {
    if (!rendu) break;
    if (ev.type === 'mort') bulle('+' + ev.prime, ev.x, ev.y, 0.8);
    if (ev.type === 'amelioration') bulle(`Niveau ${ev.niveau}`, ev.x, ev.y, 1.4, 'bulle-niveau');
    if (ev.type === 'recolte') bulle('+' + ev.or, ev.x, ev.y, 1.4); // la Pépite rapporte sa récolte
    if (ev.type === 'grandFroid') montrerGivre();
    if (ev.type === 'herosNiveau') {
      bulle(`${HEROS.nom} : niveau ${ev.niveau} !`, ev.x, ev.y, 1.9, 'bulle-niveau');
      // ce niveau lui donne un pouvoir : on le dit, plus longtemps (le temps de lire)
      const pouvoir = Object.values(HEROS.pouvoirs).find((p) => p.niveau === ev.niveau);
      if (pouvoir) bulle(`Nouveau pouvoir : ${pouvoir.nom}${pouvoir.touche ? ` (touche ${pouvoir.touche.toUpperCase()})` : ''} !`, ev.x, ev.y, 2.6, 'bulle-niveau bulle-longue');
    }
    if (ev.type === 'herosKO') bulle('K.O. ! Il revient à la vague suivante', ev.x, ev.y, 1.9, 'bulle-ko bulle-longue');
  }
  etat.evenements.length = 0;
  if (etat.statut === 'perdu' && !$('#message').dataset.fin) afficherFin(false);
  if (etat.statut === 'gagne' && !$('#message').dataset.fin) afficherFin(true);
}

// ── Interface ────────────────────────────────────────────────
// Change le texte d'un élément, seulement s'il a changé. majInterface() tourne à chaque image :
// réécrire le même texte remplaçait 60 fois par seconde le « nœud de texte » des boutons, et
// dans Safari, un clic commencé sur ce texte était perdu s'il était remplacé avant qu'on relâche
// la souris (il fallait parfois cliquer plusieurs fois sur « Lancer la vague »).
function ecrire(el, texte) {
  if (el.textContent !== texte) el.textContent = texte;
}

function majInterface() {
  ecrire($('#or'), String(etat.or));
  // en mode survie, les vagues ne s'arrêtent jamais : pas de total, mais le record à battre
  ecrire($('#vague'), niveau.survie ? String(etat.vague) : `${etat.vague} / ${niveau.vagues.length}`);
  if (niveau.survie) {
    const tenues = vaguesTerminees(etat);
    ecrire($('#record'), String(Math.max(recordAvant, tenues)));
    $('#ligne-record').classList.toggle('battu', tenues > recordAvant); // on est en train de battre le record
  }
  const bouton = $('#lancer');
  if (etat.statut === 'preparation' && etat.offre) {
    bouton.disabled = true; // une bénédiction attend d'être choisie
    ecrire(bouton, 'Choisis une bénédiction');
  } else if (etat.statut === 'preparation') {
    bouton.disabled = false;
    ecrire(bouton, `Lancer la vague ${etat.vague + 1}`);
  } else {
    bouton.disabled = true;
    ecrire(bouton, etat.statut === 'vague' ? 'Vague en cours…' : 'Partie terminée');
  }
  if (etat.pouvoirs) majPouvoirs();
  if (niveau.benedictions) majBenedictions();
  if (etat.heros) { majBoutonHeros(); majPouvoirsHeros(); }
  // Le menu ouvert se met à jour si l'or change, ou si un gardien arrive (boutons grisés ou non)
  if (!menu.hidden) {
    menu.querySelectorAll('[data-prix]').forEach((b) => {
      const type = b.dataset.gardien; // seulement sur les boutons « poser un gardien »
      const pasArrive = type !== undefined && !estDisponible(etat, type);
      const manque = Number(b.dataset.prix) - etat.or;
      b.disabled = pasArrive || manque > 0;
      ecrire(b.querySelector('.manque'), pasArrive ? `Arrive à la vague ${niveau.gardiens[type]}`
        : manque > 0 ? `Il te manque ${manque} pièces` : '');
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
        if (agir('construire', index, cle)) fermerMenu();
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
        if (agir('ameliorer', index)) ouvrirMenu(index); // le menu montre tout de suite le nouveau niveau
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
    revendre.addEventListener('click', () => { agir('vendre', index); fermerMenu(); });
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
  if (nom === 'froid') { agir('lancerGrandFroid'); return; }
  if (ui.visee === 'meteore') { arreterVisee(); return; }
  commencerVisee('meteore');
}

// Viser un endroit de la carte : pour le Météore, ou pour le Bond du héros
function commencerVisee(quoi) {
  arreterVisee();
  lacherHeros();
  fermerMenu();
  ui.visee = quoi;
  conteneur.classList.add('visee');
}

function arreterVisee() {
  ui.visee = null;
  ui.viseeMeteore = null;
  ui.viseeBond = null;
  conteneur.classList.remove('visee');
}

// À chaque image : chaque bouton se remplit, et dit s'il est prêt. Le Météore montre combien il
// en reste pour la vague (« 1/1 », puis « 0/1 » ; entre deux vagues, ceux de la vague suivante) ;
// le Grand froid, les secondes avant d'être rechargé.
function majPouvoirs() {
  for (const b of boutonsPouvoirs) {
    const nom = b.dataset.pouvoir, pret = pouvoirPret(etat, nom);
    if (!pret && document.activeElement === b) b.blur(); // un bouton grisé ne garde pas le clavier
    b.disabled = !pret;
    b.classList.toggle('pret', pret);
    if (nom === 'meteore') {
      const { parVague } = pouvoirDe(etat, 'meteore');
      const restants = etat.statut === 'vague' ? etat.pouvoirs.meteore : parVague;
      b.style.setProperty('--charge', String(restants / parVague));
      ecrire(b.querySelector('.etat-pouvoir'), `${restants}/${parVague}`);
      b.setAttribute('aria-pressed', String(ui.visee === 'meteore'));
    } else {
      const reste = etat.pouvoirs[nom];
      b.style.setProperty('--charge', String(1 - reste / pouvoirDe(etat, nom).recharge));
      ecrire(b.querySelector('.etat-pouvoir'), reste > 0 ? `${Math.ceil(reste)} s` : '');
    }
  }
  if (ui.visee === 'meteore' && !pouvoirPret(etat, 'meteore')) arreterVisee(); // la vague est finie : on ne vise plus
}

// ── Le héros ─────────────────────────────────────────────────
// On clique sur lui (ou sur son bouton, ou la touche H), puis sur la carte : il y marche.
// Clic droit, Échap ou un nouveau clic sur lui : on le lâche.
const boutonHeros = $('#bouton-heros');
boutonHeros.title = `${HEROS.description} (touche H)`;
boutonHeros.addEventListener('click', () => { basculerHeros(); boutonHeros.blur(); });

function basculerHeros() {
  if (!etat.heros || etat.heros.ko) return; // K.O. : il ne peut rien faire avant la vague suivante
  if (ui.herosChoisi) { lacherHeros(); return; }
  arreterVisee();
  fermerMenu();
  ui.herosChoisi = true;
  conteneur.classList.add('deplacement');
}

function lacherHeros() {
  ui.herosChoisi = false;
  ui.viseeHeros = null;
  conteneur.classList.remove('deplacement');
}

// Le héros est-il sous la souris ? (on compare à l'écran : il est grand, et debout). S'il se tient
// tout près d'un socle, c'est le plus proche de la souris qui gagne : on peut toujours ouvrir le socle.
function herosSous(px, py) {
  const h = etat.heros;
  if (!h || h.ko || !rendu) return false; // (K.O., on ne peut pas le choisir : un clic va au socle d'à côté)
  const pied = rendu.versEcran(h.x, h.y, 0), corps = rendu.versEcran(h.x, h.y, 0.5), cote = rendu.versEcran(h.x + 0.7, h.y, 0);
  const rayon = Math.max(22, Math.hypot(cote.x - pied.x, cote.y - pied.y));
  const dHeros = Math.hypot(px - corps.x, py - corps.y);
  if (dHeros >= rayon) return false;
  const i = rendu.socleSous(px, py);
  if (i < 0) return true;
  const s = niveau.socles[i], ps = rendu.versEcran(s.x, s.y, 0.3);
  return dHeros < Math.hypot(px - ps.x, py - ps.y);
}

// Son bouton : son niveau (ou « K.O. »), sa vie, et la barre de son expérience vers le niveau suivant
function majBoutonHeros() {
  const h = etat.heros;
  ecrire(boutonHeros.querySelector('.niveau-heros'), h.ko ? 'K.O.' : `niv. ${h.niveau}`);
  const actuel = HEROS.niveaux[h.niveau - 1].xp, suivant = HEROS.niveaux[h.niveau]?.xp;
  boutonHeros.style.setProperty('--xp', String(suivant ? (h.xp - actuel) / (suivant - actuel) : 1));
  const vie = h.vie / ficheDuHeros(etat).vie;
  boutonHeros.style.setProperty('--vie', String(vie));
  boutonHeros.classList.toggle('ko', h.ko);
  boutonHeros.classList.toggle('blesse', !h.ko && vie <= 0.5);
  boutonHeros.classList.toggle('danger', !h.ko && vie <= 0.25);
  if (h.ko && ui.herosChoisi) lacherHeros(); // il vient de tomber pendant qu'on le déplaçait
  boutonHeros.setAttribute('aria-pressed', String(ui.herosChoisi));
}

// ── Les pouvoirs du héros ────────────────────────────────────
// Deux boutons à côté du sien (et les touches O et B) : l'Onde de choc part tout de suite ; le Bond
// se vise, comme le Météore (on clique sur le bouton, puis là où il doit atterrir). Avant le niveau
// qui les débloque, ils montrent « niv. 4 » ou « niv. 6 ».
const boutonsPouvoirsHeros = [...document.querySelectorAll('[data-pouvoir-heros]')];
for (const b of boutonsPouvoirsHeros) {
  const { nom, texte, touche, niveau: niveauRequis } = HEROS.pouvoirs[b.dataset.pouvoirHeros];
  b.title = `${nom} : ${texte} À partir du niveau ${niveauRequis} du héros. (touche ${touche.toUpperCase()})`;
  b.addEventListener('click', () => { utiliserPouvoirHeros(b.dataset.pouvoirHeros); b.blur(); });
}

function utiliserPouvoirHeros(nom) {
  if (!pouvoirHerosPret(etat, nom)) return;
  if (nom === 'onde') { agir('ondeDeChoc'); return; }
  if (ui.visee === 'bond') { arreterVisee(); return; }
  commencerVisee('bond');
}

function majPouvoirsHeros() {
  const h = etat.heros;
  for (const b of boutonsPouvoirsHeros) {
    const nom = b.dataset.pouvoirHeros, pouvoir = HEROS.pouvoirs[nom];
    const debloque = h.niveau >= pouvoir.niveau, pret = pouvoirHerosPret(etat, nom);
    if (!pret && document.activeElement === b) b.blur();
    b.disabled = !pret;
    b.classList.toggle('pret', pret);
    b.classList.toggle('verrouille', !debloque);
    b.style.setProperty('--charge', String(debloque ? 1 - h[nom] / pouvoir.recharge : 0));
    ecrire(b.querySelector('.etat-pouvoir'), !debloque ? `niv. ${pouvoir.niveau}` : h.ko ? 'K.O.' : h[nom] > 0 ? `${Math.ceil(h[nom])} s` : '');
    if (nom === 'bond') b.setAttribute('aria-pressed', String(ui.visee === 'bond'));
  }
  if (ui.visee === 'bond' && !pouvoirHerosPret(etat, 'bond')) arreterVisee();
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
  lacherHeros();
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
  if (!agir('choisirBenediction', id)) return;
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
  if (niveau.heros) {
    carte.append(element('p', 'mention-heros', `Le ${HEROS.nom} t’aide : clique sur lui, puis sur la carte (touche H). Il frappe et barre la route… mais les monstres le frappent aussi : K.O., il revient à la vague suivante. Ses niveaux lui donnent des pouvoirs.`));
  }
  if (niveau.benedictions) {
    carte.append(element('p', 'mention-benedictions', `Toutes les ${TOUTES_LES} vagues tenues, une bénédiction : un bonus à choisir parmi 3, pour le reste de la partie.`));
  }
  if (niveau.pouvoirs) {
    const { meteore, froid } = POUVOIRS;
    carte.append(element('p', 'mention-pouvoirs', `Deux pouvoirs du château t’aident pendant les vagues : le ${meteore.nom} (touche ${meteore.touche}), un par vague, que tu vises sur le chemin, et le ${froid.nom} (touche ${froid.touche}), qui gèle tous les monstres.`));
  }
  // la partie est enregistrée (si le joueur ne l'a pas refusé dans les Options) : on le dit
  if (enregistrement && lireOptions().partage) {
    carte.append(element('p', 'mention-partage', 'Ta partie sera enregistrée pour pouvoir la revoir et mieux régler le jeu. Tu peux refuser dans les Options.'));
  }
  // le record à battre (lu dans le classement, qui répond « plus tard »)
  const record = element('p', 'record-arene', '');
  if (niveau.survie) {
    carte.append(record);
    meilleursScores(niveau.id, 1).then(([premier]) => {
      record.textContent = premier
        ? `Le record de l’arène : ${pluriel(premier.vagues, 'vague')}, par ${premier.pseudo}.`
        : `Saison ${SAISON} : personne n’a encore joué ici, à toi l’honneur !`;
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
  for (const titre of ['', 'Pseudo', 'Vagues', 'Monstres', '']) tete.append(element('th', '', titre));
  const corps = table.createTBody();
  scores.forEach((score, i) => {
    const ligne = corps.insertRow();
    if (i + 1 === moi) ligne.className = 'moi';
    // textContent partout : un pseudo est affiché tel quel, jamais interprété comme du HTML
    for (const valeur of [i + 1, score.pseudo, score.vagues, score.battus]) ligne.append(element('td', '', String(valeur)));
    // la partie de ce score a été enregistrée : on peut la revoir
    const revoir = element('td', 'revoir-score');
    if (score.partie) {
      const lien = element('a', '', 'Revoir');
      lien.href = `./revoir.html?partie=${encodeURIComponent(score.partie)}`;
      lien.title = `Revoir la partie de ${score.pseudo}`;
      revoir.append(lien);
    }
    ligne.append(revoir);
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
    // le score garde l'identifiant de sa partie enregistrée : le classement pourra la faire revoir
    const partie = await partieEnvoyee;
    const resultat = await enregistrerScore(niveau.id, { pseudo, vagues, battus, partie });
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
      : `Classement en ligne de la saison ${SAISON}, avec tous les joueurs.`);
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
  envoyerEnregistrement(victoire ? 'gagne' : 'perdu');
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
  if (etat.statut === 'vague' || etat.statut === 'preparation') envoyerEnregistrement('abandon'); // quittée en route
  etat = nouvellePartie();
  enregistrement = nouvelEnregistrementSiPossible();
  dejaEnvoyee = false;
  partieEnvoyee = null;
  arreterVisee();
  lacherHeros();
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
$('#lancer').addEventListener('click', () => { if (agir('lancerVague')) son.effet('vague'); });
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
    // on vise le Météore (ou le Bond du héros) : le cercle suit la souris
    const p = rendu.versSol(e.clientX, e.clientY);
    if (ui.visee === 'meteore') ui.viseeMeteore = p && { ...p, rayon: pouvoirDe(etat, 'meteore').rayon };
    else ui.viseeBond = p && { ...p, rayon: HEROS.pouvoirs.bond.rayon };
    ui.survol = -1;
    return;
  }
  if (ui.herosChoisi) {
    // on choisit où envoyer le héros : une marque suit la souris
    ui.viseeHeros = rendu.versSol(e.clientX, e.clientY);
    ui.survol = -1;
    return;
  }
  if (herosSous(e.clientX, e.clientY)) {
    ui.survol = -1;
    conteneur.style.cursor = 'pointer';
    return;
  }
  ui.survol = rendu.socleSous(e.clientX, e.clientY);
  conteneur.style.cursor = ui.survol >= 0 ? 'pointer' : '';
});
conteneur.addEventListener('click', (e) => {
  if (!rendu) return;
  if (ui.visee) {
    const p = rendu.versSol(e.clientX, e.clientY);
    if (p && agir(ui.visee === 'meteore' ? 'lancerMeteore' : 'sauterHeros', p.x, p.y)) arreterVisee();
    return;
  }
  if (ui.herosChoisi) {
    // un clic sur le héros lui-même le lâche ; ailleurs, il y va
    const p = rendu.versSol(e.clientX, e.clientY);
    if (!herosSous(e.clientX, e.clientY) && p) agir('envoyerHeros', p.x, p.y);
    lacherHeros();
    return;
  }
  if (herosSous(e.clientX, e.clientY)) { basculerHeros(); son.effet('menu'); return; }
  const i = rendu.socleSous(e.clientX, e.clientY);
  if (i >= 0) { ouvrirMenu(i); son.effet('menu'); } else fermerMenu();
});
// clic droit pendant qu'on vise : on annule (sans ouvrir le menu du navigateur)
conteneur.addEventListener('contextmenu', (e) => {
  if (!ui.visee && !ui.herosChoisi) return;
  e.preventDefault();
  arreterVisee();
  lacherHeros();
});
addEventListener('keydown', (e) => {
  // la carte des bénédictions est ouverte : 1, 2 et 3 choisissent (et rien d'autre ne réagit)
  // (sur un clavier français, la touche 1 donne « & » sans Maj : on regarde aussi la touche elle-même, e.code)
  const chiffre = /^(Digit|Numpad)[1-9]$/.test(e.code) ? e.code.slice(-1) : e.key;
  if (!$('#benediction').hidden) {
    const id = etat.offre?.[Number(chiffre) - 1];
    if (id) { e.preventDefault(); prendreBenediction(id); }
    return;
  }
  if (e.key === 'Escape') { fermerMenu(); didacticiel.fermerFiche(); arreterVisee(); lacherHeros(); }
  // Espace lance la vague, sauf si un bouton actif a le clavier (Espace appuie alors sur lui)
  if (e.key === ' ' && (e.target === document.body || e.target.disabled)) { e.preventDefault(); $('#lancer').click(); }
  // les pouvoirs du château : touches 1 et 2 (pas pendant qu'on écrit son pseudo)
  const dansUnChamp = e.target instanceof Element && e.target.closest('input, textarea');
  if (etat.pouvoirs && !dansUnChamp) {
    const nom = Object.keys(POUVOIRS).find((n) => POUVOIRS[n].touche === chiffre);
    if (nom) utiliserPouvoir(nom);
  }
  // le héros : touche H
  if (etat.heros && !dansUnChamp) {
    const touche = e.key.toLowerCase();
    if (touche === HEROS.touche) basculerHeros();
    // ses pouvoirs : O (l'Onde de choc) et B (le Bond)
    const pouvoir = Object.keys(HEROS.pouvoirs).find((n) => HEROS.pouvoirs[n].touche === touche);
    if (pouvoir) utiliserPouvoirHeros(pouvoir);
  }
});
addEventListener('resize', () => rendu?.redimensionner());

// Une carte plus haute que la fenêtre (un petit écran) : son voile défile, et on lui met la classe
// « deborde » : la bande des boutons prend alors un fond (voir style.css). On surveille la taille
// des voiles (la fenêtre change) et celle de leurs cartes (leur texte change).
const surveillerVoiles = new ResizeObserver((changements) => {
  for (const { target } of changements) {
    const voile = target.closest('.voile');
    voile.classList.toggle('deborde', voile.scrollHeight > voile.clientHeight + 1);
  }
});
for (const voile of document.querySelectorAll('.voile')) {
  surveillerVoiles.observe(voile);
  for (const carte of voile.children) surveillerVoiles.observe(carte);
}

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
boutonHeros.hidden = !niveau.heros;
$('#pouvoirs-heros').hidden = !niveau.heros;
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

// Les parties enregistrées : celles qui n'avaient pas pu partir la dernière fois partent
// maintenant ; et si le joueur quitte la page en pleine partie (onglet fermé, retour à la
// carte…), le navigateur la garde pour l'envoyer à la prochaine visite.
envoyerPartiesEnAttente();
addEventListener('pagehide', () => {
  if (!enregistrement || dejaEnvoyee || etat.vague === 0) return;
  if (etat.statut === 'vague' || etat.statut === 'preparation') garderEnAttente(preparerEnvoi(enregistrement, etat, 'abandon'));
});

// Accès de débogage depuis la console du navigateur (ex. : __jeu.etat.or = 999).
// __jeu.avancer(3) fait avancer la partie de 3 secondes, puis redessine : pratique pour
// tester même quand l'onglet est caché (le navigateur met alors la boucle en pause).
// __jeu.agir('construire', 3, 'givrine') fait une décision comme le joueur (elle est enregistrée).
window.__jeu = {
  get etat() { return etat; }, get rendu() { return rendu; }, get ui() { return ui; }, son,
  get enregistrement() { return enregistrement; }, get partieEnvoyee() { return partieEnvoyee; },
  agir,
  avancer(secondes = 1) {
    for (let i = Math.round(secondes / PAS); i > 0 && etat.statut !== 'perdu' && etat.statut !== 'gagne'; i--) faireUnPas();
    rendu?.dessiner(etat, PAS, PAS, ui);
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
