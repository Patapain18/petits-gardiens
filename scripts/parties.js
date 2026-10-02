// ─────────────────────────────────────────────────────────────
// npm run parties
// Télécharge les parties enregistrées par les joueurs (voir src/parties.js),
// les rejoue une par une, et raconte ce qui s'y est passé : la défense,
// les bénédictions, les pouvoirs, le héros, qui a battu les monstres, et
// comment la partie s'est terminée. C'est ce qui sert à régler le jeu avec
// de vraies parties, et plus seulement avec les joueurs imaginaires.
//
//   npm run parties                      → les 30 dernières parties de l'arène, et un bilan
//   npm run parties -- --combien 100     → les 100 dernières
//   npm run parties -- --niveau monde2-3 → celles d'un autre niveau
//   npm run parties -- --partie <id>     → une partie en détail, vague par vague
//   npm run parties -- --essai           → les parties jouées pendant le développement
//   npm run parties -- --fichier captures/parties/nom.json → une partie gardée sur l'ordinateur
//
// Chaque partie est rejouée avec les règles de SA version du jeu : le
// moteur de l'époque est ressorti de git (git archive), dans parties/.moteurs/.
// Les parties téléchargées sont gardées dans parties/ (pas envoyé sur GitHub).
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const SERVEUR = 'https://petits-gardiens-classement.vercel.app/api/parties';
const DOSSIER = path.resolve('parties');
const MOTEURS = path.join(DOSSIER, '.moteurs');

// ── Les options de la ligne de commande ──
const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(`--${nom}`); return i >= 0 ? args[i + 1] : null; };
const niveauDemande = option('niveau') || 'arene-pixel';
const combien = Math.max(1, Math.min(1000, Number(option('combien')) || 30));
const essai = args.includes('--essai');

// ── Un peu de couleur dans le terminal ──
const couleur = process.stdout.isTTY && !process.env.NO_COLOR;
const teinte = (code) => (texte) => (couleur ? `\x1b[${code}m${texte}\x1b[0m` : texte);
const gras = teinte('1'), gris = teinte('2'), vert = teinte('32'), jaune = teinte('33'), rouge = teinte('31');
const virgule = (n, d = 1) => n.toFixed(d).replace('.', ',');
const pourcent = (n, total) => (total ? `${Math.round((100 * n) / total)} %` : '0 %');
const pluriel = (n, mot, s = 's') => `${n} ${mot}${n > 1 ? s : ''}`;

// ── Parler au serveur ──
async function demander(adresse) {
  const reponse = await fetch(adresse);
  const donnees = await reponse.json().catch(() => ({}));
  if (!reponse.ok) throw new Error(donnees.erreur || `le serveur répond ${reponse.status}`);
  return donnees;
}

// Une partie : gardée dans parties/ après le premier téléchargement (elle ne change plus)
async function partie(id) {
  const fichier = path.join(DOSSIER, `${id}.json`);
  if (fs.existsSync(fichier)) return JSON.parse(fs.readFileSync(fichier, 'utf8'));
  const p = await demander(`${SERVEUR}?id=${encodeURIComponent(id)}`);
  fs.mkdirSync(DOSSIER, { recursive: true });
  fs.writeFileSync(fichier, JSON.stringify(p));
  return p;
}

// ── Le moteur de la bonne version ──
// « dev » (une partie de développement) : le moteur d'aujourd'hui. Sinon, celui du commit
// noté dans la partie, ressorti de git une fois pour toutes.
const moteursCharges = new Map();
async function moteur(version) {
  if (moteursCharges.has(version)) return moteursCharges.get(version);
  let racine = path.resolve('.');
  let avertissement = null;
  if (version !== 'dev') {
    const dossier = path.join(MOTEURS, version);
    try {
      if (!fs.existsSync(path.join(dossier, 'src/jeu/enregistrement.js'))) {
        execSync(`git cat-file -e ${version}^{commit}`, { stdio: 'ignore' });
        fs.mkdirSync(dossier, { recursive: true });
        execSync(`git archive --format=tar ${version} src/jeu src/niveaux | tar -x -C "${dossier}"`);
      }
      racine = dossier;
    } catch {
      avertissement = `version ${version} inconnue de git (fais git pull ?) : rejouée avec le moteur d'aujourd'hui`;
    }
  }
  const importer = (fichier) => import(pathToFileURL(path.join(racine, 'src/jeu', fichier)).href);
  const m = {
    ...(await importer('enregistrement.js')),
    ...(await importer('niveau.js')),
    MONSTRES: (await importer('donnees.js')).MONSTRES,
    BENEDICTIONS: (await importer('benedictions.js')).BENEDICTIONS,
    fiche: (id) => JSON.parse(fs.readFileSync(path.join(racine, 'src/niveaux', `${id}.json`), 'utf8')),
    avertissement,
  };
  moteursCharges.set(version, m);
  return m;
}

// Les thèmes des vagues fabriquées du mode survie, dans l'ordre de src/jeu/survie.js
const THEMES = ['une marée de Gluants', 'une ruée de Filous', 'une colonne de Cuirassés', 'tout à la fois'];
const NOMS = { braise: 'Braise', givrine: 'Givrine', grondin: 'Grondin', etincelle: 'Étincelle', bourrasque: 'Bourrasque', prisme: 'Prisme', pepite: 'Pépite', heros: 'héros', meteore: 'Météore' };
const nom = (type) => NOMS[type] || type;

// ── Rejouer une partie en comptant tout ──
async function analyser(p) {
  const m = await moteur(p.version);
  const niveau = m.chargerNiveau(m.fiche(p.niveau));
  const lecteur = m.creerLecteur(niveau, p);
  const e = lecteur.etat;
  const vagues = [];                  // une ligne par vague jouée
  let v = null;                       // la vague en cours
  const par = {};                     // monstres battus, par qui
  let combos = 0, meteores = 0, froids = 0, ordres = 0, frappes = 0, chemin = 0, arretEnVague = 0, enVague = 0, touches = 0, chutes = 0;
  let ko = 0, ondes = 0, bonds = 0;
  const niveauxHeros = [];            // [niveau, vague]
  const offres = [];                  // [vague, [3 propositions]]
  let fuite = null;
  let herosAvant = e.heros && { x: e.heros.x, y: e.heros.y };
  let offreVue = null;
  while (!lecteur.fini) {
    lecteur.avancer(1);
    if (e.statut === 'vague' && (!v || v.numero !== e.vague)) {
      v = { numero: e.vague, debut: e.pas, orDebut: e.or, battus: 0, par: {}, auPlusPres: Infinity, meteores: 0, froids: 0, ordres: 0, heros: 0, degatsAvant: { ...(e.degatsPar || {}) } };
      vagues.push(v);
    }
    for (const ev of e.evenements) {
      if (ev.type === 'mort') {
        const qui = ev.par || 'autre';
        par[qui] = (par[qui] || 0) + 1;
        if (qui === 'meteore' && ev.gele) combos++;
        if (v) { v.battus++; v.par[qui] = (v.par[qui] || 0) + 1; if (qui === 'heros') v.heros++; }
      }
      if (ev.type === 'meteore') { meteores++; if (v) v.meteores++; }
      if (ev.type === 'explosion' && ev.quoi === 'meteore' && ev.touches !== undefined) { touches += ev.touches; chutes++; }
      if (ev.type === 'grandFroid') { froids++; if (v) v.froids++; }
      if (ev.type === 'herosEnvoye') { ordres++; if (v) v.ordres++; }
      if (ev.type === 'frappe') frappes++;
      if (ev.type === 'herosNiveau') niveauxHeros.push([ev.niveau, e.vague]);
      if (ev.type === 'herosKO') ko++;
      if (ev.type === 'ondeDeChoc') ondes++;
      if (ev.type === 'bond') bonds++;
      if (ev.type === 'fuite') fuite = { quoi: ev.quoi, vague: e.vague };
    }
    e.evenements.length = 0;
    if (e.offre && e.offre !== offreVue) { offreVue = e.offre; offres.push([e.vague, [...e.offre]]); }
    if (e.statut === 'vague' && v) {
      for (const monstre of e.ennemis) v.auPlusPres = Math.min(v.auPlusPres, niveau.longueurChemin - monstre.d);
      enVague++;
      if (e.heros && !e.heros.cible) arretEnVague++;
    }
    if (v && e.statut !== 'vague' && v.fin === undefined) { v.fin = e.pas; v.orFin = e.or; v.degats = difference(e.degatsPar, v.degatsAvant); }
    if (e.heros) {
      chemin += Math.hypot(e.heros.x - herosAvant.x, e.heros.y - herosAvant.y);
      herosAvant = { x: e.heros.x, y: e.heros.y };
    }
  }
  return {
    p, m, niveau, e, ecarts: lecteur.ecarts, vagues, par, combos, meteores, froids, ordres, frappes, chemin, touches, chutes, ko, ondes, bonds,
    arretEnVague: enVague ? arretEnVague / enVague : 0, niveauxHeros, offres, fuite,
  };
}

// Les dégâts faits pendant une vague : ceux de la fin, moins ceux du début (null si la partie
// a été jouée avec une version du jeu qui ne les comptait pas encore)
function difference(apres, avant) {
  if (!apres) return null;
  return Object.fromEntries(Object.entries(apres).map(([qui, d]) => [qui, d - (avant[qui] || 0)]));
}
// « Météore 41 %, Grondin 25 %… » : la part de chacun
function parts(table) {
  const total = Object.values(table).reduce((t, n) => t + n, 0);
  return Object.entries(table).sort((x, y) => y[1] - x[1]).map(([qui, n]) => `${nom(qui)} ${pourcent(n, total)}`).join(', ');
}

// Le thème d'une vague (mode survie) : les premières sont écrites dans la fiche du niveau
function theme(a, numero) {
  if (!a.niveau.survie) return '';
  const ecrites = a.m.fiche(a.p.niveau).vagues.length;
  return numero <= ecrites ? 'vague écrite' : THEMES[(numero - 1) % THEMES.length];
}

// ── Raconter une partie ──
function raconter(a, rang) {
  const { p, e } = a;
  const quand = new Date(p.date || p.debut).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const fin = { perdu: `${pluriel(p.vagues, 'vague')} tenue${p.vagues > 1 ? 's' : ''}`, gagne: 'gagné', abandon: `quittée à la vague ${e.vague}` }[p.statut] || `vague ${e.vague}`;
  const rejeu = a.ecarts.length ? rouge(`rejeu différent dès la vague ${a.ecarts[0].attendu[1]}`) : vert('rejeu exact');
  const reel = p.date && p.debut ? ` · ${Math.round((p.date - p.debut) / 60000)} min en vrai` : '';
  const lignes = [];
  lignes.push(`${gras(`${rang}. ${p.pseudo || 'anonyme'}`)} · ${quand} · ${p.navigateur || 'navigateur ?'} · ${gras(fin)} · ${e.battus} battus · ${Math.round(e.pas / 3600)} min de jeu${reel}  ${gris(`[${p.version}, ${p.id || 'fichier'}]`)} ${rejeu}`);
  if (a.m.avertissement) lignes.push(jaune(`   ${a.m.avertissement}`));
  // la défense à la fin
  const compte = {};
  for (const t of e.tours) {
    compte[t.type] ??= { n: 0, niveaux: [] };
    compte[t.type].n++;
    compte[t.type].niveaux.push(t.niveau);
  }
  const defense = Object.entries(compte).sort((x, y) => y[1].n - x[1].n)
    .map(([type, { n, niveaux }]) => `${n} ${nom(type)} (niv. ${niveaux.sort().join('/')})`).join(', ');
  lignes.push(`   Défense : ${defense || 'aucun gardien'}${e.soclesDebloques?.length ? ` · ${pluriel(e.soclesDebloques.length, 'socle')} bonus` : ''}`);
  // les bénédictions : à chaque étape, celle choisie (et les deux autres proposées)
  if (a.offres.length) {
    const choix = e.benedictions;
    const texte = a.offres.map(([vague, offre], i) => {
      const prise = choix[i];
      if (!prise) return `v${vague} ${gris('(rien choisi)')}`;
      const autres = offre.filter((id) => id !== prise).map((id) => a.m.BENEDICTIONS[id]?.nom || id);
      return `v${vague} ${a.m.BENEDICTIONS[prise]?.nom || prise} ${gris(`(pas ${autres.join(', ')})`)}`;
    });
    lignes.push(`   Bénédictions : ${texte.join(' · ')}`);
  }
  if (e.pouvoirs) {
    const vise = a.chutes ? ` (${virgule(a.touches / a.chutes)} monstres touchés à chaque fois)` : '';
    lignes.push(`   Pouvoirs : ${pluriel(a.meteores, 'Météore')}${vise}, ${a.froids} Grand froid · combos (Météore sur des gelés) : ${pluriel(a.combos, 'monstre')} battu${a.combos > 1 ? 's' : ''} d'un coup`);
  }
  if (e.heros) {
    const n6 = a.niveauxHeros.map(([n, vague]) => `niv. ${n} v${vague}`).join(', ');
    lignes.push(`   Héros : niveau ${e.heros.niveau} (${n6 || 'jamais monté'}) · ${pluriel(a.ordres, 'ordre')} · ${virgule(a.chemin, 0)} cases parcourues · arrêté ${pourcent(a.arretEnVague, 1)} du temps des vagues · ${a.par.heros || 0} battus`);
    // (sa vie et ses pouvoirs : depuis octobre 2026)
    if (e.heros.vie !== undefined) lignes.push(`          ${a.ko} K.O. · ${a.ondes} Onde${a.ondes > 1 ? 's' : ''} de choc · ${pluriel(a.bonds, 'Bond')}`);
  }
  if (e.degatsPar) lignes.push(`   Qui fait les dégâts : ${parts(e.degatsPar) || '—'}`);
  lignes.push(`   Qui donne le dernier coup : ${parts(a.par) || '—'}`);
  if (a.fuite) {
    const leType = a.m.MONSTRES[a.fuite.quoi]?.nom || a.fuite.quoi;
    const t = theme(a, a.fuite.vague);
    lignes.push(`   Fin : un ${leType} est entré pendant la vague ${a.fuite.vague}${t ? ` (${t})` : ''}`);
  }
  return lignes.join('\n');
}

// ── Une partie en détail, vague par vague ──
function detailler(a) {
  const lignes = [raconter(a, '•'), '', gras('   Vague par vague')];
  for (const v of a.vagues) {
    const duree = ((v.fin ?? a.e.pas) - v.debut) / 60;
    const t = theme(a, v.numero);
    const pres = Number.isFinite(v.auPlusPres) ? virgule(Math.max(0, v.auPlusPres)) : '—';
    const danger = v.auPlusPres < 3 ? rouge(pres) : v.auPlusPres < 8 ? jaune(pres) : pres;
    const extras = [v.meteores && pluriel(v.meteores, 'Météore'), v.froids && `${v.froids} froid`, v.ordres && pluriel(v.ordres, 'ordre')].filter(Boolean).join(', ');
    lignes.push(`   ${String(v.numero).padStart(3)} ${gris((t || '').padEnd(24))} ${String(Math.round(duree)).padStart(4)} s · ${String(v.battus).padStart(3)} battus (héros ${v.heros}) · or ${v.orDebut} → ${v.orFin ?? '—'} · au plus près du château : ${danger} case(s)${extras ? ` · ${extras}` : ''}`);
    if (v.degats) lignes.push(gris(`        dégâts : ${parts(v.degats)}`));
  }
  return lignes.join('\n');
}

// ── Le bilan de plusieurs parties ──
function bilan(analyses) {
  const finies = analyses.filter((a) => a.p.statut !== 'abandon');
  const vagues = finies.map((a) => a.p.vagues).sort((x, y) => x - y);
  const lignes = [gras(`Bilan : ${pluriel(analyses.length, 'partie')} (${pluriel(analyses.length - finies.length, 'abandonnée')})`)];
  if (vagues.length) lignes.push(`   Vagues tenues : médiane ${vagues[Math.floor(vagues.length / 2)]}, de ${vagues[0]} à ${vagues[vagues.length - 1]}`);
  const prises = {};
  for (const a of analyses) for (const id of a.e.benedictions) prises[id] = (prises[id] || 0) + 1;
  const proposees = {};
  for (const a of analyses) for (const [, offre] of a.offres) for (const id of offre) proposees[id] = (proposees[id] || 0) + 1;
  const benedictions = Object.keys(proposees).sort((x, y) => (prises[y] || 0) / proposees[y] - (prises[x] || 0) / proposees[x])
    .map((id) => `${analyses[0].m.BENEDICTIONS[id]?.nom || id} ${prises[id] || 0}/${proposees[id]}`);
  if (benedictions.length) lignes.push(`   Bénédictions (prises / proposées) : ${benedictions.join(', ')}`);
  const somme = (cle) => analyses.reduce((t, a) => t + a[cle], 0);
  if (analyses.some((a) => a.e.pouvoirs)) lignes.push(`   Par partie : ${virgule(somme('meteores') / analyses.length)} Météores, ${virgule(somme('froids') / analyses.length)} Grand froid, ${virgule(somme('combos') / analyses.length)} monstres battus par combo`);
  if (analyses.some((a) => a.e.heros)) lignes.push(`   Héros, par partie : ${virgule(somme('ordres') / analyses.length)} ordres, ${virgule(analyses.reduce((t, a) => t + (a.par.heros || 0), 0) / analyses.length)} monstres battus`);
  const degats = {};
  for (const a of analyses) for (const [qui, d] of Object.entries(a.e.degatsPar || {})) degats[qui] = (degats[qui] || 0) + d;
  if (Object.keys(degats).length) lignes.push(`   Qui fait les dégâts (toutes les parties) : ${parts(degats)}`);
  const fuites = {};
  for (const a of analyses) if (a.fuite) { const t = theme(a, a.fuite.vague) || 'vague'; fuites[t] = (fuites[t] || 0) + 1; }
  if (Object.keys(fuites).length) lignes.push(`   Vagues fatales : ${Object.entries(fuites).sort((x, y) => y[1] - x[1]).map(([t, n]) => `${t} ${n}`).join(', ')}`);
  const desynchro = analyses.filter((a) => a.ecarts.length).length;
  lignes.push(desynchro ? rouge(`   ${pluriel(desynchro, 'partie')} ne se rejoue${desynchro > 1 ? 'nt' : ''} pas à l'identique`) : vert('   Toutes les parties se rejouent à l\'identique'));
  return lignes.join('\n');
}

// ── C'est parti ──
try {
  const fichier = option('fichier');
  const id = option('partie');
  if (fichier) {
    console.log(detailler(await analyser(JSON.parse(fs.readFileSync(fichier, 'utf8')))));
  } else if (id) {
    console.log(detailler(await analyser(await partie(id))));
  } else {
    const liste = await demander(`${SERVEUR}?combien=${combien}&niveau=${encodeURIComponent(niveauDemande)}${essai ? '&essai=1' : ''}`);
    console.log(gras(`\nParties enregistrées : ${niveauDemande}${essai ? ' (essais de développement)' : ''}`));
    console.log(gris(`${pluriel(liste.parties.length, 'partie')}, les plus récentes d'abord\n`));
    const analyses = [];
    for (const [i, resume] of liste.parties.entries()) {
      const a = await analyser(await partie(resume.id));
      a.p.id = resume.id;
      analyses.push(a);
      console.log(raconter(a, i + 1) + '\n');
    }
    if (analyses.length) console.log(bilan(analyses));
  }
} catch (erreur) {
  console.error(rouge(`Impossible : ${erreur.message}`));
  process.exitCode = 1;
}
