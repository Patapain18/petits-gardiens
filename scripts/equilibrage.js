// ─────────────────────────────────────────────────────────────
// npm run equilibrage
// Joue automatiquement chaque niveau de src/niveaux/ avec plusieurs
// « joueurs imaginaires » et dit s'il est trop facile, trop dur ou bien réglé.
//
//   npm run equilibrage                 → tous les niveaux
//   npm run equilibrage -- essai        → seulement src/niveaux/essai.json
//   npm run equilibrage -- --parties 5  → 5 parties par joueur au lieu de 3
// ─────────────────────────────────────────────────────────────
import fs from 'node:fs';
import path from 'node:path';
import { chargerNiveau } from '../src/jeu/niveau.js';
import { analyser, texteResultat } from '../src/jeu/equilibrage.js';
import { problemesCampagne } from '../src/jeu/campagne.js';

const DOSSIER = path.resolve('src/niveaux');

// ── Les options de la ligne de commande ──
const args = process.argv.slice(2);
let nombreParties = 3;
const demandes = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--parties') nombreParties = Math.max(1, Math.min(20, Number(args[++i]) || 3));
  else demandes.push(args[i].replace(/\.json$/, ''));
}

// ── Un peu de couleur dans le terminal (sauf si on la désactive avec NO_COLOR) ──
const couleur = process.stdout.isTTY && !process.env.NO_COLOR;
const teinte = (code) => (texte) => (couleur ? `\x1b[${code}m${texte}\x1b[0m` : texte);
const gras = teinte('1'), gris = teinte('2'), vert = teinte('32'), jaune = teinte('33'), rouge = teinte('31');
// vert : la difficulté visée est atteinte ; jaune : à un cran près ; rouge : plus loin
const couleurEcart = (ecart) => (ecart === 0 ? vert : Math.abs(ecart) === 1 ? jaune : rouge);
const virgule = (n, decimales = 1) => n.toFixed(decimales).replace('.', ',');

// ── Quels niveaux analyser ? ──
const tous = fs.readdirSync(DOSSIER).filter((f) => f.endsWith('.json')).map((f) => f.slice(0, -5)).sort();
const aAnalyser = demandes.length ? demandes : tous;
const inconnus = aAnalyser.filter((id) => !tous.includes(id));
if (inconnus.length) {
  console.error(rouge(`Niveau introuvable : ${inconnus.join(', ')}. Niveaux disponibles : ${tous.join(', ')}.`));
  process.exit(1);
}

console.log(gras('\nÉquilibrage des niveaux'));
console.log(gris(`${nombreParties} partie(s) par joueur imaginaire\n`));

// La campagne d'abord : chaque niveau listé dans src/jeu/campagne.js doit exister, dans le bon style
const toutesLesFiches = {};
for (const id of tous) {
  try { toutesLesFiches[id] = JSON.parse(fs.readFileSync(path.join(DOSSIER, id + '.json'), 'utf8')); } catch { /* signalé plus bas */ }
}
const erreursCampagne = problemesCampagne(toutesLesFiches);
for (const erreur of erreursCampagne) console.log(rouge(`Campagne : ${erreur}`));
if (erreursCampagne.length) console.log('');

let fichesIncorrectes = 0;
const debut = performance.now();
let totalParties = 0;

for (const id of aAnalyser) {
  const fichier = path.join('src/niveaux', id + '.json');
  let niveau;
  try {
    niveau = chargerNiveau(JSON.parse(fs.readFileSync(path.join(DOSSIER, id + '.json'), 'utf8')));
  } catch (erreur) {
    fichesIncorrectes++;
    console.log(`${gras(id)}  ${gris(fichier)}\n${rouge(erreur.message)}\n`);
    continue;
  }

  const graines = Array.from({ length: nombreParties }, (_, i) => i + 1);
  const { resultats, verdict, debutant, parties } = await analyser(niveau, { graines });
  totalParties += parties;

  console.log(`${gras(niveau.nom)}  ${gris(fichier)}`);
  console.log(gris(niveau.survie
    ? `Mode survie : des vagues sans fin, ${niveau.or} pièces au départ, ${niveau.socles.length} socles, époque ${niveau.style}\n`
    : `${niveau.vagues.length} vagues, ${niveau.or} pièces au départ, ${niveau.socles.length} socles, époque ${niveau.style}, difficulté visée : ${niveau.difficulte}\n`));

  // Le tableau : une ligne par joueur imaginaire
  const largeurNom = Math.max(...resultats.map((r) => r.strategie.nom.length), 'Joueur imaginaire'.length) + 2;
  const largeurResultat = Math.max(...resultats.map((r) => texteResultat(r).length), 'Résultat'.length) + 2;
  console.log('  ' + gris('Joueur imaginaire'.padEnd(largeurNom) + 'Résultat'.padEnd(largeurResultat) + 'Au plus près du château'));
  for (const r of resultats) {
    const texte = texteResultat(r);
    const enCouleur = r.victoires === r.total ? vert : r.victoires === 0 ? rouge : jaune;
    const marge = r.victoires ? `${virgule(r.marge)} case${r.marge >= 2 ? 's' : ''}` : '';
    const nom = r.strategie.reference ? gras(r.strategie.nom.padEnd(largeurNom)) : r.strategie.nom.padEnd(largeurNom);
    console.log('  ' + nom + enCouleur(texte.padEnd(largeurResultat)) + marge);
  }

  // Le débutant : il pose ses gardiens au hasard (et parfois, d'abord, un gardien qui ne se bat pas)
  if (debutant) {
    const pieges = debutant.pieges.map((p) => `, ${p.type === 'pepite' ? 'une Pépite' : 'une Bourrasque'} d’abord : ${p.part} %`).join('');
    console.log(gris(`\n  Un débutant (des gardiens posés au hasard) tient la vague 1 : ${debutant.auHasard} %${pieges}`));
  }

  // Le verdict, la difficulté visée (pas pour une arène de survie) et les conseils
  const enCouleur = verdict.objectif ? couleurEcart(verdict.objectif.ecart) : gras;
  console.log(`\n  Verdict : ${enCouleur(gras(verdict.titre))}. ${verdict.explication}`);
  if (verdict.objectif) console.log(`  ${enCouleur(verdict.objectif.texte)}`);
  for (const conseil of verdict.conseils) console.log(`  - ${conseil}`);
  console.log('');
}

const secondes = (performance.now() - debut) / 1000;
console.log(gris(`${totalParties} parties simulées en ${virgule(secondes, 2)} s`));
process.exit(fichesIncorrectes || erreursCampagne.length ? 1 : 0);
