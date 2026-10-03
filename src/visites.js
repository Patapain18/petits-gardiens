// ─────────────────────────────────────────────────────────────
// LA PAGE DES VISITES (visites.html)
// Les chiffres du compteur de visites (voir compteur.js et serveur/api/visites.js) :
// combien de visiteurs par jour, combien jouent vraiment, ce qu'ils ouvrent, d'où ils
// viennent. Le serveur répond jour par jour ; cette page additionne et dessine.
//
// Aucune autre page ne mène ici : c'est la page du créateur du jeu (garde-la dans
// tes favoris). Elle ne se compte pas elle-même.
// En développement, visites.html?demo montre de faux chiffres, pour voir la page sans attendre.
// ─────────────────────────────────────────────────────────────
import { lireVisites, ordinateurIgnore, ignorerCetOrdinateur } from './compteur.js';

const FICHES = import.meta.glob('./niveaux/*.json', { eager: true, import: 'default' });
const $ = (s) => document.querySelector(s);
const DEMO = import.meta.env.DEV && new URLSearchParams(location.search).has('demo');

// ── Les noms à afficher ──────────────────────────────────────
const PAGES = {
  accueil: 'Carte des époques', jeu: 'Le jeu', revoir: 'Revoir une partie', personnages: 'Galerie des personnages',
  sons: 'Salle des sons', lumieres: 'Atelier des lumières', textures: 'Atelier des textures', modeles: 'Atelier des modèles', editeur: 'Éditeur de niveaux',
};
const NAVIGATEURS = { chrome: 'Chrome', safari: 'Safari', firefox: 'Firefox', edge: 'Edge', autre: 'Autre' };
const SYSTEMES = { windows: 'Windows', mac: 'Mac', ios: 'iPhone, iPad', android: 'Android', linux: 'Linux', chromeos: 'ChromeOS', autre: 'Autre' };
const nomDuNiveau = (id) => (id === 'editeur' ? 'Niveau de l’éditeur' : FICHES[`./niveaux/${id}.json`]?.nom ?? id);
const nomsDesPays = new Intl.DisplayNames(['fr'], { type: 'region' });
// Le drapeau d'un pays : deux « lettres régionales » d'Unicode (F + R → 🇫🇷)
const drapeau = (code) => String.fromCodePoint(...[...code].map((lettre) => 0x1f1e6 + lettre.charCodeAt(0) - 65));
function nomDuPays(code) {
  if (code === 'XX') return 'Inconnu';
  try { return `${drapeau(code)} ${nomsDesPays.of(code)}`; } catch { return code; }
}
const nombre = (n) => n.toLocaleString('fr-FR');
const dateDe = (jour) => new Date(`${jour}T00:00:00Z`);
const jourCourt = (jour) => dateDe(jour).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const jourLong = (jour) => dateDe(jour).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const pluriel = (n, mot, mots = `${mot}s`) => `${nombre(n)} ${n > 1 ? mots : mot}`;

function element(balise, classe, texte) {
  const e = document.createElement(balise);
  if (classe) e.className = classe;
  if (texte !== undefined) e.textContent = texte;
  return e;
}

// ── Additionner les jours de la période ──────────────────────
const somme = (compteurs) => Object.values(compteurs).reduce((a, b) => a + b, 0);
function ajouter(total, compteurs) {
  for (const [nom, n] of Object.entries(compteurs)) total[nom] = (total[nom] || 0) + n;
}
function additionner(jours) {
  const total = { visiteurs: 0, joueurs: 0, pages: {}, niveaux: {}, parties: {}, pays: {}, navigateurs: {}, systemes: {}, sources: {} };
  for (const jour of jours) {
    total.visiteurs += jour.visiteurs;
    total.joueurs += jour.joueurs;
    for (const sorte of ['pages', 'niveaux', 'parties', 'pays', 'navigateurs', 'systemes', 'sources']) ajouter(total[sorte], jour[sorte]);
  }
  return total;
}

// ── Les quatre grands chiffres ───────────────────────────────
function afficherChiffres(total) {
  const vues = somme(total.pages);
  const parties = somme(total.parties);
  const part = total.visiteurs ? Math.round((total.joueurs / total.visiteurs) * 100) : 0;
  const cartes = [
    ['Visiteurs', nombre(total.visiteurs), 'chacun compte une fois par jour'],
    ['Pages ouvertes', nombre(vues), total.visiteurs ? `${(vues / total.visiteurs).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} par visiteur` : '—'],
    ['Parties lancées', nombre(parties), 'la première vague lancée'],
    ['Ont joué', `${part} %`, 'des visiteurs lancent une partie'],
  ];
  $('#chiffres').replaceChildren(...cartes.map(([titre, valeur, aide]) => {
    const carte = element('div', 'panneau chiffre');
    carte.append(element('span', 'titre-chiffre', titre), element('b', 'valeur', valeur), element('span', 'aide', aide));
    return carte;
  }));
}

// ── Le graphique : une barre par jour ────────────────────────
// La barre claire = les visiteurs du jour ; la partie orange, en bas = ceux qui ont joué.
// Survoler (ou toucher) un jour l'affiche en détail dessous ; au clavier : les flèches.
let jourChoisi = -1;
function afficherGraphique(jours) {
  const max = Math.max(1, ...jours.map((j) => j.visiteurs));
  const barres = $('#barres');
  barres.style.setProperty('--colonnes', jours.length);
  barres.setAttribute('aria-label', `Visiteurs par jour, du ${jourLong(jours[0].jour)} au ${jourLong(jours.at(-1).jour)} : jusqu’à ${pluriel(max, 'visiteur')} par jour.`);
  const repere = element('span', 'repere', nombre(max));
  barres.replaceChildren(repere, ...jours.map((j, i) => {
    const colonne = element('div', 'jour');
    colonne.style.setProperty('--visiteurs', j.visiteurs / max);
    colonne.style.setProperty('--joueurs', j.joueurs / max);
    colonne.title = `${jourCourt(j.jour)} : ${pluriel(j.visiteurs, 'visiteur')}`;
    colonne.append(element('span', 'barre visiteurs'), element('span', 'barre joueurs'));
    colonne.addEventListener('pointerenter', () => choisirJour(jours, i));
    colonne.addEventListener('click', () => choisirJour(jours, i));
    return colonne;
  }));
  barres.onkeydown = (e) => {
    const pas = { ArrowLeft: -1, ArrowRight: 1, Home: -jours.length, End: jours.length }[e.key];
    if (!pas) return;
    e.preventDefault();
    choisirJour(jours, Math.max(0, Math.min(jours.length - 1, jourChoisi + pas)));
  };
  // sous le graphique : le premier jour, le milieu, aujourd'hui
  const milieu = jours[Math.floor(jours.length / 2)];
  $('#axe').replaceChildren(element('span', '', jourCourt(jours[0].jour)), element('span', '', jourCourt(milieu.jour)), element('span', '', 'aujourd’hui'));
  choisirJour(jours, jours.length - 1);
}

function choisirJour(jours, i) {
  jourChoisi = i;
  const j = jours[i];
  document.querySelectorAll('#barres .jour').forEach((c, k) => c.classList.toggle('choisi', k === i));
  const vues = somme(j.pages), parties = somme(j.parties);
  const morceaux = [pluriel(j.visiteurs, 'visiteur'), `${pluriel(j.joueurs, 'a joué', 'ont joué')}`, pluriel(vues, 'page ouverte', 'pages ouvertes'), pluriel(parties, 'partie lancée', 'parties lancées')];
  const quand = i === jours.length - 1 ? `Aujourd’hui (${jourLong(j.jour)})` : jourLong(j.jour).replace(/^./, (l) => l.toUpperCase());
  $('#detail-jour').textContent = `${quand} : ${morceaux.join(', ')}.`;
}

// ── Les listes : pages, niveaux, pays… ───────────────────────
// lignes : [[nom affiché, nombre, détail ?], …], rangées de la plus grande à la plus petite
function liste(titre, unite, lignes, vide) {
  const bloc = element('section', 'panneau liste');
  bloc.append(element('h2', '', titre), element('p', 'unite', unite));
  const rangees = [...lignes].sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!rangees.length) {
    bloc.append(element('p', 'liste-vide', vide));
    return bloc;
  }
  const max = Math.max(1, ...rangees.map(([, n]) => n));
  const ol = element('ol');
  for (const [nom, n, detail] of rangees) {
    const li = element('li');
    li.style.setProperty('--part', n / max);
    const texte = element('span', 'nom', nom);
    if (detail) texte.append(element('small', '', detail));
    li.append(texte, element('b', '', nombre(n)));
    ol.append(li);
  }
  bloc.append(ol);
  return bloc;
}
const lignesDe = (compteurs, nommer) => Object.entries(compteurs).map(([cle, n]) => [nommer(cle), n]);

function afficherListes(total) {
  // les niveaux : ceux où une partie a été lancée, et ceux qu'on a seulement ouverts
  const niveaux = [...new Set([...Object.keys(total.parties), ...Object.keys(total.niveaux)])]
    .map((id) => [nomDuNiveau(id), total.parties[id] || 0, `ouvert ${pluriel(total.niveaux[id] || 0, 'fois', 'fois')}`]);
  $('#listes').replaceChildren(
    liste('Les pages', 'ouvertures', lignesDe(total.pages, (p) => PAGES[p] ?? p), 'Aucune page ouverte.'),
    liste('Les niveaux joués', 'parties lancées', niveaux, 'Aucune partie lancée.'),
    liste('Les pays', 'visiteurs', lignesDe(total.pays, nomDuPays), 'Personne pour l’instant.'),
    liste('Venus d’un autre site', 'visites', lignesDe(total.sources, (s) => s), 'Personne : ils sont venus directement (un favori, un lien dans une appli…).'),
    liste('Les navigateurs', 'visiteurs', lignesDe(total.navigateurs, (n) => NAVIGATEURS[n] ?? n), 'Personne pour l’instant.'),
    liste('Les systèmes', 'visiteurs', lignesDe(total.systemes, (s) => SYSTEMES[s] ?? s), 'Personne pour l’instant.'),
  );
}

// ── La période : 7, 30 ou 90 jours ───────────────────────────
// On garde la plus longue période déjà reçue : les plus courtes en sont la fin.
let recus = null; // { jours: [...] }
async function afficherPeriode(n) {
  document.querySelectorAll('[data-jours]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.jours) === n)));
  if (!recus || recus.jours.length < n) {
    $('#etat').hidden = false;
    $('#etat').textContent = 'Je demande les chiffres au serveur…';
    const reponse = DEMO ? fauxChiffres(n) : await lireVisites(n);
    if (!reponse) {
      $('#tableau').hidden = true;
      $('#etat').textContent = 'Le serveur des visites ne répond pas. Réessaie un peu plus tard (ou vérifie qu’il a bien été redéployé).';
      return;
    }
    recus = reponse;
  }
  const jours = recus.jours.slice(-n);
  const total = additionner(jours);
  $('#etat').hidden = total.visiteurs > 0 || somme(total.pages) > 0;
  $('#etat').textContent = 'Pas encore de visite sur cette période : les chiffres arriveront avec les premiers visiteurs.';
  $('#tableau').hidden = false;
  afficherChiffres(total);
  afficherGraphique(jours);
  afficherListes(total);
}
document.querySelectorAll('[data-jours]').forEach((b) => b.addEventListener('click', () => afficherPeriode(Number(b.dataset.jours))));

// ── Ne pas compter cet ordinateur ────────────────────────────
const caseIgnorer = $('#ignorer');
caseIgnorer.checked = ordinateurIgnore();
caseIgnorer.addEventListener('change', () => {
  ignorerCetOrdinateur(caseIgnorer.checked);
  $('#mot-ignorer').textContent = caseIgnorer.checked
    ? 'C’est noté : tes visites depuis ce navigateur ne comptent plus.'
    : 'Tes visites depuis ce navigateur comptent de nouveau.';
});

// ── Pour essayer la page sans attendre de vrais visiteurs (développement seulement) ──
// De faux chiffres, toujours les mêmes (un petit hasard qui part d'une graine)
function fauxChiffres(n) {
  let graine = 7;
  const hasard = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
  const tirer = (choix) => choix[Math.floor(hasard() * choix.length)];
  const aujourdhui = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  const jours = Array.from({ length: n }, (_, i) => {
    const jour = new Date(aujourdhui - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    const weekend = [0, 6].includes(dateDe(jour).getUTCDay());
    const visiteurs = Math.round(hasard() * (weekend ? 14 : 8));
    const joueurs = Math.round(visiteurs * (0.4 + hasard() * 0.4));
    const d = { jour, visiteurs, joueurs, pages: {}, niveaux: {}, parties: {}, pays: {}, navigateurs: {}, systemes: {}, sources: {} };
    const plus = (sorte, nom, k = 1) => { d[sorte][nom] = (d[sorte][nom] || 0) + k; };
    for (let v = 0; v < visiteurs; v++) {
      plus('pages', 'accueil');
      plus('pays', tirer(['FR', 'FR', 'FR', 'FR', 'BE', 'CH', 'CA']));
      plus('navigateurs', tirer(['chrome', 'chrome', 'safari', 'safari', 'firefox', 'edge']));
      plus('systemes', tirer(['windows', 'windows', 'mac', 'ios', 'android']));
      if (hasard() < 0.25) plus('sources', tirer(['discord.com', 'discord.com', 'google.com', 'instagram.com']));
    }
    for (let v = 0; v < joueurs; v++) {
      const niveau = tirer(['arene-pixel', 'arene-pixel', 'monde1-1', 'monde1-2', 'monde2-1']);
      plus('pages', 'jeu', 2);
      plus('niveaux', niveau, 2);
      plus('parties', niveau, 1 + Math.floor(hasard() * 3));
    }
    if (hasard() < 0.3) plus('pages', tirer(['personnages', 'sons', 'revoir']));
    return d;
  });
  return { jours };
}

afficherPeriode(30);
