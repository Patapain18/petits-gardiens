// ─────────────────────────────────────────────────────────────
// LA FENÊTRE DES OPTIONS
// La même fenêtre sur la carte des époques et dans le jeu. Elle est
// fabriquée à partir de la liste SECTIONS ci-dessous (des données) :
// pour ajouter une option, on l'ajoute à options.js et à cette liste.
//
// C'est un élément <dialog> du navigateur : une fenêtre par-dessus la page,
// qui se ferme avec Échap et garde le clavier à l'intérieur tant qu'elle est
// ouverte. Chaque réglage s'applique (et se garde) tout de suite : pas de
// bouton « Enregistrer ».
// ─────────────────────────────────────────────────────────────
import { lireOptions, changerOptions, quandOptionsChangent } from './options.js';
import './options.css';

// Les réglages, rangés par section. type : 'curseur' (de 0 à 100 %), 'case' (oui ou non),
// ou 'choix' (une valeur parmi plusieurs : [valeur, texte du bouton]).
const SECTIONS = [
  {
    titre: 'Le son',
    reglages: [
      { cle: 'musique', type: 'curseur', texte: 'Musique' },
      { cle: 'effets', type: 'curseur', texte: 'Bruitages' },
      { cle: 'coupe', type: 'case', texte: 'Couper tout le son', aide: 'En jeu, la touche M fait pareil.' },
    ],
  },
  {
    titre: 'Le jeu',
    reglages: [
      { cle: 'vitesse', type: 'choix', texte: 'Vitesse du jeu', valeurs: [[1, '×1'], [2, '×2'], [3, '×3']], aide: 'Le bouton « Vitesse », en jeu, la change aussi : le jeu se souvient de la dernière.' },
      {
        cle: 'fiches', type: 'choix', texte: 'Fiches des nouveaux personnages',
        valeurs: [['toujours', 'À chaque partie'], ['premiere-fois', 'Seulement la première fois']],
        aide: 'Pour rejouer un niveau sans revoir les fiches et les leçons qu’on connaît déjà.',
      },
      {
        cle: 'partage', type: 'case', texte: 'Partager mes parties',
        aide: 'À la fin de chaque partie, tes décisions (où tu poses tes gardiens, quand tu lances les pouvoirs…) partent sur le serveur du classement, avec ton pseudo. Elles servent à revoir les parties et à mieux régler le jeu. Rien d’autre sur toi n’est envoyé. (Le site compte aussi ses visites, sans savoir qui tu es : pas de cookie, seulement des compteurs.)',
      },
    ],
  },
  {
    titre: 'L’affichage',
    reglages: [
      {
        cle: 'qualite', type: 'choix', texte: 'Qualité graphique',
        valeurs: [['complete', 'Complète'], ['econome', 'Économe']],
        aide: 'Économe : une image moins fine, des ombres plus simples, sans halo de lumière. Pour les ordinateurs plus lents (surtout en voxel).',
      },
      { cle: 'interface', type: 'choix', texte: 'Taille des boutons et des textes du jeu', valeurs: [['normale', 'Normale'], ['grande', 'Grande']] },
      { cle: 'camera', type: 'choix', texte: 'Caméra du style voxel', valeurs: [['haute', 'Vue de jeu'], ['cinema', 'Cinéma']] },
    ],
  },
];

// Petit outil pour fabriquer un élément ; le texte passe par textContent (jamais du HTML)
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// Un réglage : son élément, et une fonction qui l'affiche à jour (montrer)
function fabriquerReglage(r) {
  const bloc = element('div', 'reglage');
  let montrer;
  if (r.type === 'curseur') {
    const etiquette = element('label', 'reglage-curseur');
    const curseur = element('input');
    Object.assign(curseur, { type: 'range', min: 0, max: 100, step: 5 });
    const valeur = element('output');
    etiquette.append(element('span', '', r.texte), curseur, valeur);
    curseur.addEventListener('input', () => {
      valeur.textContent = `${curseur.value} %`;
      changerOptions({ [r.cle]: curseur.value / 100 });
    });
    montrer = (o) => { curseur.value = Math.round(o[r.cle] * 100); valeur.textContent = `${curseur.value} %`; };
    bloc.append(etiquette);
  } else if (r.type === 'case') {
    const etiquette = element('label', 'reglage-case');
    const caseACocher = element('input');
    caseACocher.type = 'checkbox';
    etiquette.append(caseACocher, element('span', '', r.texte));
    caseACocher.addEventListener('change', () => changerOptions({ [r.cle]: caseACocher.checked }));
    montrer = (o) => { caseACocher.checked = o[r.cle]; };
    bloc.append(etiquette);
  } else {
    // un groupe de boutons radio (un seul peut être choisi) ; les flèches du clavier passent de l'un à l'autre
    const groupe = element('fieldset', 'reglage-choix');
    groupe.append(element('legend', '', r.texte));
    const boutons = r.valeurs.map(([valeur, texte]) => {
      const etiquette = element('label');
      const radio = element('input');
      Object.assign(radio, { type: 'radio', name: `option-${r.cle}`, value: String(valeur) });
      radio.addEventListener('change', () => { if (radio.checked) changerOptions({ [r.cle]: valeur }); });
      etiquette.append(radio, element('span', '', texte));
      groupe.append(etiquette);
      return { radio, valeur };
    });
    montrer = (o) => boutons.forEach(({ radio, valeur }) => { radio.checked = o[r.cle] === valeur; });
    bloc.append(groupe);
  }
  if (r.aide) bloc.append(element('p', 'aide', r.aide));
  return { bloc, montrer };
}

// La section « Progression » (seulement sur la carte des époques) : effacer, après confirmation
function fabriquerProgression(effacer) {
  const section = element('section', 'section-options');
  section.append(element('h3', '', 'La progression'));
  const demande = element('button', 'danger', 'Effacer la progression…');
  const confirmation = element('div', 'confirmation');
  confirmation.hidden = true;
  const oui = element('button', 'danger', 'Oui, tout effacer');
  const non = element('button', '', 'Annuler');
  confirmation.append(element('p', '', 'Tous les niveaux gagnés seront oubliés, ainsi que les fiches déjà vues. On ne peut pas revenir en arrière.'), oui, non);
  const fait = element('p', 'aide', '');
  fait.setAttribute('role', 'status');
  demande.addEventListener('click', () => { confirmation.hidden = false; demande.hidden = true; non.focus(); });
  non.addEventListener('click', () => { confirmation.hidden = true; demande.hidden = false; demande.focus(); });
  oui.addEventListener('click', () => {
    effacer();
    confirmation.hidden = true;
    demande.hidden = false;
    fait.textContent = 'C’est fait : tout recommence au premier niveau.';
    demande.focus();
  });
  section.append(demande, confirmation, fait);
  return section;
}

// Fabrique la fenêtre et l'ajoute à la page.
// effacerProgression : si on la donne, la section « Progression » apparaît (sur la carte des époques)
// enOuvrant / enFermant : ce que la page doit faire quand la fenêtre s'ouvre ou se ferme (le jeu se met en pause)
export function creerFenetreOptions({ effacerProgression = null, enOuvrant = null, enFermant = null } = {}) {
  const fenetre = element('dialog', 'fenetre-options');
  fenetre.setAttribute('aria-labelledby', 'titre-options');
  const titre = element('h2', '', 'Options');
  titre.id = 'titre-options';
  fenetre.append(titre);

  const montrerTout = [];
  for (const s of SECTIONS) {
    const section = element('section', 'section-options');
    section.append(element('h3', '', s.titre));
    for (const r of s.reglages) {
      const { bloc, montrer } = fabriquerReglage(r);
      section.append(bloc);
      montrerTout.push(montrer);
    }
    fenetre.append(section);
  }
  if (effacerProgression) fenetre.append(fabriquerProgression(effacerProgression));

  const fermer = element('button', 'principal', 'Fermer');
  fermer.addEventListener('click', () => fenetre.close());
  const pied = element('div', 'pied-options');
  pied.append(fermer);
  fenetre.append(pied);
  // un clic sur le fond sombre, autour de la fenêtre, la ferme aussi
  fenetre.addEventListener('click', (e) => { if (e.target === fenetre) fenetre.close(); });
  fenetre.addEventListener('close', () => enFermant?.());
  document.body.append(fenetre);

  // si une option change ailleurs (la touche M, le bouton « Vitesse »…), la fenêtre suit
  const afficher = (o) => montrerTout.forEach((montrer) => montrer(o));
  quandOptionsChangent(afficher);

  return {
    ouvrir() {
      if (fenetre.open) return;
      afficher(lireOptions());
      fenetre.showModal();
      enOuvrant?.();
    },
    get ouverte() { return fenetre.open; },
  };
}
