// ─────────────────────────────────────────────────────────────
// REVOIR UNE PARTIE (la page revoir.html)
// revoir.html?partie=… : la partie enregistrée est lue sur le serveur
// (parties.js), puis rejouée pas à pas par le lecteur de
// jeu/enregistrement.js, et dessinée par le style de son niveau, comme en
// jeu. Rien ne se décide ici : on regarde les décisions du joueur se refaire.
//
// En développement : revoir.html?fichier=nom relit captures/parties/nom.json.
// Avec &test=1, la partie est rejouée d'un coup, sans dessin, et le résultat
// est rangé dans captures/parties/ : c'est ainsi qu'on vérifie qu'une partie
// jouée dans Chrome se rejoue pareil dans Safari.
// ─────────────────────────────────────────────────────────────
import { PAS } from './jeu/moteur.js';
import { BENEDICTIONS } from './jeu/benedictions.js';
import { chargerNiveau } from './jeu/niveau.js';
import { creerLecteur } from './jeu/enregistrement.js';
import { lirePartie, VERSION } from './parties.js';
import { lireOptions } from './options.js';
import { creerSon } from './son/son.js';
import { compterVisite } from './compteur.js';

compterVisite('revoir'); // une visite de plus (voir compteur.js)

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const STYLES = {
  voxel: () => import('./rendus/voxel.js'),
  cartoon: () => import('./rendus/cartoon.js'),
  pixel: () => import('./rendus/pixel.js'),
};
const $ = (s) => document.querySelector(s);
const parametres = new URLSearchParams(location.search);
const VITESSES = [1, 2, 4, 8];

// Fabrique un élément ; le texte passe par textContent (un pseudo n'est jamais lu comme du HTML)
function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// Le message au milieu de l'écran. boutons : [{ texte, action } ou { texte, lien }]
function message(titre, texte, boutons = []) {
  const carte = $('#message .carte');
  carte.replaceChildren(element('p', 'surtitre', 'Revoir la partie'), element('h1', '', titre), element('p', '', texte));
  if (boutons.length) {
    const zone = element('div', 'boutons-carte');
    boutons.forEach(({ texte: t, action, lien }, i) => {
      const b = lien ? element('a', 'bouton-lien', t) : element('button', '', t);
      if (lien) b.href = lien;
      if (i === 0) b.classList.add('principal');
      if (action) b.addEventListener('click', action);
      zone.append(b);
    });
    carte.append(zone);
  }
  $('#message').hidden = false;
  carte.querySelector('button, a')?.focus();
}

// « 3:07 » : un nombre de pas de jeu, en minutes et secondes
function minutes(pas) {
  const s = Math.floor(pas * PAS);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
const pluriel = (n, mot) => `${n} ${mot}${n > 1 ? 's' : ''}`;

// ── La partie à revoir ───────────────────────────────────────
async function chargerEnregistrement() {
  const fichier = parametres.get('fichier');
  if (fichier && import.meta.env.DEV) {
    const reponse = await fetch(`/__partie/${encodeURIComponent(fichier)}`);
    return reponse.ok ? reponse.json() : null;
  }
  const id = parametres.get('partie');
  return id ? lirePartie(id) : null;
}

// ── Le test du rejeu (développement) : tout d'un coup, sans dessin ──
async function tester(niveau, enr) {
  const debut = performance.now();
  const l = creerLecteur(niveau, enr);
  while (!l.fini) { l.avancer(600); l.etat.evenements.length = 0; }
  const e = l.etat;
  const resultat = {
    navigateur: navigator.userAgent, ecarts: l.ecarts, statut: e.statut, vague: e.vague, pas: e.pas, or: e.or, battus: e.battus,
    ennemis: e.ennemis.map((m) => [m.id, m.pv, m.d]), heros: e.heros && [e.heros.x, e.heros.y, e.heros.niveau, e.heros.xp],
    duree: Math.round(performance.now() - debut),
  };
  const famille = /Chrome\//.test(navigator.userAgent) ? 'chrome' : /Firefox\//.test(navigator.userAgent) ? 'firefox' : 'safari';
  await fetch('/__partie', { method: 'POST', body: JSON.stringify({ nom: `resultat-${parametres.get('fichier')}-${famille}`, partie: resultat }) });
  message(l.ecarts.length ? 'Rejeu différent' : 'Rejeu identique',
    `${famille} : ${pluriel(e.vague, 'vague')}, ${e.or} pièces, ${e.battus} battus, ${l.ecarts.length} écart(s), en ${resultat.duree} ms.`);
}

// ── Revoir ───────────────────────────────────────────────────
async function demarrer() {
  const enr = await chargerEnregistrement();
  if (!enr) {
    message('Partie introuvable', 'Cette partie n’existe pas, ou plus (les parties sont gardées un an). Le serveur ne répond peut-être pas : réessaie un peu plus tard.',
      [{ texte: 'Carte des époques', lien: './' }]);
    return;
  }
  const fiche = FICHES[`./niveaux/${enr.niveau}.json`];
  if (!fiche) {
    message('Niveau inconnu', `Le niveau « ${enr.niveau} » n’existe plus dans le jeu : impossible de revoir cette partie.`, [{ texte: 'Carte des époques', lien: './' }]);
    return;
  }
  const niveau = chargerNiveau(fiche);
  if (parametres.get('test') === '1') return tester(niveau, enr);

  const fin = enr.fin;                          // le dernier pas joué
  const options = lireOptions();
  const reglages = { ambiance: niveau.ambiance, camera: options.camera, qualite: options.qualite };
  const ui = { survol: -1, selection: -1, apercuPortee: null, visee: null, viseeMeteore: null, herosChoisi: false, viseeHeros: null };
  const son = creerSon();
  son.choisirEpoque(niveau.style);
  document.body.dataset.style = niveau.style;
  document.title = `Revoir : ${niveau.nom} — Petits Gardiens`;

  let lecteur = creerLecteur(niveau, enr);
  let rendu = null;
  let vitesse = 2, enPause = false, finMontree = false, ecartSignale = false;

  // le style du niveau : refait à neuf quand on revient en arrière (une partie qui recommence)
  async function nouveauRendu() {
    const module = await STYLES[niveau.style]();
    rendu?.detruire();
    $('#scene').replaceChildren();
    rendu = new module.default($('#scene'), niveau, reglages);
  }
  await nouveauRendu();

  // ── Qui a joué ──
  const quand = new Date(enr.date || enr.debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const resultat = { gagne: 'niveau gagné', abandon: 'partie quittée en route', perdu: `${pluriel(enr.vagues, 'vague')} tenue${enr.vagues > 1 ? 's' : ''}` }[enr.statut];
  $('#titre-revoir').textContent = `Revoir : ${niveau.nom}`;
  $('#qui').textContent = [enr.pseudo || 'Un joueur', resultat, quand].filter(Boolean).join(' · ');
  $('#ligne-heros').hidden = !niveau.heros;

  // ── La frise : un trait par fin de vague (les contrôles notés pendant la partie) ──
  $('#frise-vagues').replaceChildren(...enr.controles.map(([pas, vague]) => {
    const trait = element('span', vague % 5 === 0 ? 'cinq' : '');
    trait.style.left = `${(pas / fin) * 100}%`;
    trait.title = `Fin de la vague ${vague}`;
    return trait;
  }));

  // Un avertissement : une autre version du jeu (les règles ont peut-être changé depuis)
  if (enr.version !== VERSION) {
    $('#avertissement').textContent = `Cette partie a été jouée avec une autre version du jeu. Si les règles ont changé depuis, la partie revue peut s’écarter de la vraie.`;
    $('#avertissement').hidden = false;
  }

  // ── Aller à un moment de la partie (sans dessiner les pas sautés) ──
  async function allerA(pasVoulu) {
    pasVoulu = Math.max(0, Math.min(fin, Math.round(pasVoulu)));
    if (pasVoulu < lecteur.etat.pas) {
      lecteur = creerLecteur(niveau, enr);
      await nouveauRendu();
    }
    while (lecteur.etat.pas < pasVoulu && !lecteur.fini) {
      lecteur.avancer(Math.min(600, pasVoulu - lecteur.etat.pas));
      lecteur.etat.evenements.length = 0;
    }
    if (!lecteur.fini) { finMontree = false; $('#message').hidden = true; }
  }

  // ── Les boutons ──
  const boutonLecture = $('#lecture');
  function basculerPause() {
    if (lecteur.fini) { allerA(0); enPause = false; } else enPause = !enPause;
    boutonLecture.textContent = enPause ? 'Lecture' : 'Pause';
  }
  boutonLecture.addEventListener('click', basculerPause);
  document.querySelectorAll('[data-vitesse]').forEach((b) => b.addEventListener('click', () => {
    vitesse = Number(b.dataset.vitesse);
    document.querySelectorAll('[data-vitesse]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  const frise = $('#frise');
  frise.addEventListener('click', (e) => {
    const r = frise.getBoundingClientRect();
    allerA(((e.clientX - r.left) / r.width) * fin);
  });
  // le clavier : Espace = pause, flèches = 10 secondes en arrière / en avant
  addEventListener('keydown', (e) => {
    if (e.key === ' ' && e.target === document.body) { e.preventDefault(); basculerPause(); }
    if (e.key === 'ArrowRight') { e.preventDefault(); allerA(lecteur.etat.pas + 600); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); allerA(lecteur.etat.pas - 600); }
  });
  addEventListener('resize', () => rendu?.redimensionner());
  // le son se réveille au premier geste (les navigateurs l'exigent)
  addEventListener('pointerdown', () => son.debloquer(), { capture: true });
  addEventListener('keydown', () => son.debloquer(), { capture: true });

  // ── L'interface, à chaque image ──
  let benedictionsVues = -1;
  function majInterface() {
    const e = lecteur.etat;
    $('#or').textContent = String(e.or);
    $('#vague').textContent = niveau.survie ? String(e.vague) : `${e.vague} / ${niveau.vagues.length}`;
    $('#battus').textContent = String(e.battus);
    if (e.heros) $('#niveau-heros').textContent = `niv. ${e.heros.niveau}`;
    $('#frise-avance').style.setProperty('--avance', String(Math.min(1, e.pas / fin)));
    frise.setAttribute('aria-valuenow', String(Math.round((e.pas / fin) * 100)));
    $('#temps').textContent = `${minutes(e.pas)} / ${minutes(fin)}`;
    if (e.benedictions.length !== benedictionsVues) {
      benedictionsVues = e.benedictions.length;
      const comptes = new Map();
      for (const id of e.benedictions) comptes.set(id, (comptes.get(id) || 0) + 1);
      $('#mes-benedictions').hidden = !comptes.size;
      $('#mes-benedictions').replaceChildren(...[...comptes].map(([id, n]) => {
        const b = BENEDICTIONS[id];
        const etiquette = element('span', '', n > 1 ? `${b.nom} ×${n}` : b.nom);
        etiquette.dataset.sorte = b.sorte;
        etiquette.title = b.texte;
        return etiquette;
      }));
    }
    // la partie revue ne retrouve pas les contrôles de la vraie : on le dit (une fois)
    if (lecteur.ecarts.length && !ecartSignale) {
      ecartSignale = true;
      $('#avertissement').textContent = `À partir de la vague ${lecteur.ecarts[0].attendu[1]}, la partie revue s’écarte de la vraie : le jeu a changé depuis qu’elle a été jouée.`;
      $('#avertissement').hidden = false;
    }
  }

  // Le voile de givre du Grand froid, comme en jeu (une animation CSS, relancée à chaque fois)
  function montrerGivre() {
    const givre = $('#givre');
    givre.style.setProperty('--duree-givre', `${4 / vitesse}s`);
    givre.classList.remove('actif');
    void givre.offsetWidth;
    givre.classList.add('actif');
  }

  function montrerFin() {
    finMontree = true;
    boutonLecture.textContent = 'Revoir';
    const e = lecteur.etat;
    const qui = enr.pseudo || 'Le joueur';
    const texte = enr.statut === 'abandon'
      ? `${qui} a quitté la partie ici, pendant la vague ${e.vague}.`
      : e.statut === 'gagne' ? `${qui} a gagné, avec ${pluriel(e.battus, 'monstre')} battu${e.battus > 1 ? 's' : ''}.`
        : `${qui} a tenu ${pluriel(enr.vagues, 'vague')} et battu ${pluriel(e.battus, 'monstre')}.`;
    message('Fin de la partie', texte, [
      { texte: 'Revoir depuis le début', action: () => { allerA(0); enPause = false; boutonLecture.textContent = 'Pause'; } },
      { texte: 'Carte des époques', lien: './' },
    ]);
  }

  // ── La boucle : avancer la partie au rythme choisi, puis la dessiner ──
  let avant = performance.now(), reserve = 0;
  function boucle(maintenant) {
    // (jamais négatif : l'heure donnée à la toute première image peut être un poil plus ancienne que
    // « avant », et un temps négatif ferait choisir au style pixel une image d'animation qui n'existe pas)
    const dt = Math.max(0, Math.min(0.05, (maintenant - avant) / 1000));
    avant = maintenant;
    if (!enPause && !lecteur.fini) {
      reserve += dt * vitesse;
      const n = Math.floor((reserve + 0.001) / PAS);
      if (n > 0) { lecteur.avancer(n); reserve -= n * PAS; }
    }
    const e = lecteur.etat;
    if (e.evenements.some((ev) => ev.type === 'grandFroid')) montrerGivre();
    rendu?.dessiner(e, enPause ? 0 : dt * vitesse, dt, ui);
    if (vitesse <= 2) son.evenements(e.evenements, niveau.largeur); // plus vite, ce serait une cacophonie
    e.evenements.length = 0;
    son.maj(e, { pause: enPause || lecteur.fini });
    majInterface();
    if (lecteur.fini && !finMontree) montrerFin();
    requestAnimationFrame(boucle);
  }
  $('#message').hidden = true;
  requestAnimationFrame(boucle);

  // Pour les tests (le navigateur met la boucle en pause quand l'onglet est caché) :
  // __revoir.avancer(10) fait avancer de 10 secondes puis redessine ; __revoir.capturer('nom')
  window.__revoir = {
    get lecteur() { return lecteur; },
    allerA,
    avancer(secondes = 1) {
      lecteur.avancer(Math.round(secondes / PAS));
      rendu?.dessiner(lecteur.etat, PAS, PAS, ui);
      lecteur.etat.evenements.length = 0;
      majInterface();
    },
    async capturer(nom = 'revoir') {
      rendu.dessiner(lecteur.etat, 0, 0, ui);
      const image = $('#scene canvas').toDataURL('image/jpeg', 0.88);
      return (await fetch('/__capture', { method: 'POST', body: JSON.stringify({ nom, image }) })).text();
    },
  };
}

demarrer();
