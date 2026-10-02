// Configuration de Vite (le serveur de développement et la fabrication du site).
//
// Le plugin « outils-dev » ne sert que pendant le développement (npm run dev) :
// - /__capture  : enregistre une capture d'écran du jeu dans captures/
// - /__son      : enregistre un son calculé hors ligne dans captures/ (pour le vérifier)
// - /__niveaux  : liste, ouvre et enregistre les fiches de niveau de src/niveaux/
//                 (c'est ce qu'utilise l'éditeur de niveaux)
// - /__ambiances : enregistre les réglages des ambiances (src/rendus/ambiances.json)
//                 (c'est ce qu'utilise l'atelier des lumières)
// - /__partie   : garde une partie enregistrée dans captures/parties/ (POST), ou la relit
//                 (GET /__partie/nom) : pour vérifier qu'elle se rejoue pareil partout
import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { problemesFiche } from './src/jeu/niveau.js';
import { formaterFiche } from './src/editeur/format.js';
import { problemesAmbiances, formaterAmbiances } from './src/rendus/format-ambiances.js';

const DOSSIER_NIVEAUX = path.resolve('src/niveaux');
const FICHIER_AMBIANCES = path.resolve('src/rendus/ambiances.json');
// Un nom de fichier sûr : des minuscules, des chiffres et des tirets, rien d'autre.
// (Impossible d'écrire « ../../quelque-chose » ailleurs que dans src/niveaux.)
const ID_VALIDE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const TAILLE_MAX_FICHE = 300_000;      // une fiche fait quelques Ko : au-delà, on refuse
const TAILLE_MAX_CAPTURE = 30_000_000; // une capture d'écran pèse quelques Mo

// Lit le corps d'une requête, en refusant ce qui est trop gros
function lireCorps(req, tailleMax) {
  return new Promise((resoudre, rejeter) => {
    let corps = '';
    req.on('data', (morceau) => {
      corps += morceau;
      if (corps.length > tailleMax) { rejeter(new Error('trop gros')); req.destroy(); }
    });
    req.on('end', () => resoudre(corps));
    req.on('error', rejeter);
  });
}

function repondre(res, statut, donnees) {
  res.statusCode = statut;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(donnees));
}

const outilsDev = {
  name: 'outils-dev',
  apply: 'serve',
  configureServer(server) {
    // Captures d'écran (pour comparer les rendus)
    server.middlewares.use('/__capture', async (req, res) => {
      if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' });
      try {
        const { nom, image } = JSON.parse(await lireCorps(req, TAILLE_MAX_CAPTURE));
        const fichier = path.join('captures', String(nom).replace(/[^\w-]/g, '') + '.jpg');
        fs.mkdirSync('captures', { recursive: true });
        fs.writeFileSync(fichier, Buffer.from(String(image).split(',')[1], 'base64'));
        res.end(fichier);
      } catch {
        repondre(res, 400, { erreur: 'capture illisible' });
      }
    });

    // Les sons calculés « hors ligne » (pour les vérifier sans haut-parleur) : captures/nom.wav
    server.middlewares.use('/__son', async (req, res) => {
      if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' });
      try {
        const { nom, wav } = JSON.parse(await lireCorps(req, TAILLE_MAX_CAPTURE));
        const fichier = path.join('captures', String(nom).replace(/[^\w-]/g, '') + '.wav');
        fs.mkdirSync('captures', { recursive: true });
        fs.writeFileSync(fichier, Buffer.from(String(wav), 'base64'));
        res.end(fichier);
      } catch {
        repondre(res, 400, { erreur: 'son illisible' });
      }
    });

    // Les parties enregistrées, pour les vérifier : captures/parties/nom.json
    server.middlewares.use('/__partie', async (req, res) => {
      const dossier = path.join('captures', 'parties');
      if (req.method === 'GET') {
        const nom = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\/+/, '')).replace(/[^\w-]/g, '');
        const fichier = path.join(dossier, nom + '.json');
        if (!nom || !fs.existsSync(fichier)) return repondre(res, 404, { erreur: 'partie introuvable' });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(fs.readFileSync(fichier, 'utf8'));
      }
      if (req.method !== 'POST') return repondre(res, 405, { erreur: 'GET ou POST seulement' });
      try {
        const { nom, partie } = JSON.parse(await lireCorps(req, TAILLE_MAX_CAPTURE));
        const fichier = path.join(dossier, String(nom).replace(/[^\w-]/g, '') + '.json');
        fs.mkdirSync(dossier, { recursive: true });
        fs.writeFileSync(fichier, JSON.stringify(partie));
        res.end(fichier);
      } catch {
        repondre(res, 400, { erreur: 'partie illisible' });
      }
    });

    // Les réglages des ambiances (l'atelier des lumières) : on revérifie tout, en comparant
    // avec le fichier actuel (mêmes styles, mêmes réglages, des valeurs du bon genre)
    server.middlewares.use('/__ambiances', async (req, res) => {
      if (req.method !== 'POST') return repondre(res, 405, { erreur: 'POST seulement' });
      let donnees;
      try {
        donnees = JSON.parse(await lireCorps(req, TAILLE_MAX_FICHE));
      } catch {
        return repondre(res, 400, { erreur: 'Réglages illisibles (JSON invalide ou trop gros).' });
      }
      const modele = JSON.parse(fs.readFileSync(FICHIER_AMBIANCES, 'utf8'));
      const problemes = problemesAmbiances(donnees, modele);
      if (problemes.length) return repondre(res, 422, { erreur: `Réglages incorrects : ${problemes[0]}`, problemes });
      fs.writeFileSync(FICHIER_AMBIANCES, formaterAmbiances(donnees));
      repondre(res, 200, { fichier: 'src/rendus/ambiances.json' });
    });

    // Les fiches de niveau
    server.middlewares.use('/__niveaux', async (req, res) => {
      const id = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\/+/, ''));

      // GET /__niveaux → la liste des niveaux du projet
      if (req.method === 'GET' && !id) {
        const niveaux = fs.readdirSync(DOSSIER_NIVEAUX)
          .filter((nom) => nom.endsWith('.json'))
          .map((nom) => {
            try {
              const fiche = JSON.parse(fs.readFileSync(path.join(DOSSIER_NIVEAUX, nom), 'utf8'));
              return { id: nom.slice(0, -5), nom: fiche.nom || nom, style: fiche.style };
            } catch {
              return { id: nom.slice(0, -5), nom: `${nom} (illisible)` };
            }
          });
        return repondre(res, 200, niveaux);
      }

      if (!ID_VALIDE.test(id)) return repondre(res, 400, { erreur: 'Nom de fichier invalide : utilise des minuscules, des chiffres et des tirets.' });
      const fichier = path.join(DOSSIER_NIVEAUX, id + '.json');

      // GET /__niveaux/essai → la fiche essai.json
      if (req.method === 'GET') {
        if (!fs.existsSync(fichier)) return repondre(res, 404, { erreur: 'Ce niveau n’existe pas.' });
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        return res.end(fs.readFileSync(fichier, 'utf8'));
      }

      // POST /__niveaux/essai → enregistre la fiche, après l'avoir vérifiée ici aussi :
      // on ne fait jamais confiance à ce qui arrive, même depuis notre propre éditeur.
      if (req.method === 'POST') {
        let fiche;
        try {
          fiche = JSON.parse(await lireCorps(req, TAILLE_MAX_FICHE));
        } catch {
          return repondre(res, 400, { erreur: 'Fiche illisible (JSON invalide ou trop gros).' });
        }
        if (fiche?.id !== id) return repondre(res, 400, { erreur: 'Le nom du fichier ne correspond pas à l’id de la fiche.' });
        const erreurs = problemesFiche(fiche);
        if (erreurs.length) return repondre(res, 422, { erreur: `Fiche incorrecte : ${erreurs[0]}`, erreurs });
        const existait = fs.existsSync(fichier);
        fs.writeFileSync(fichier, formaterFiche(fiche));
        return repondre(res, 200, { fichier: `src/niveaux/${id}.json`, existait });
      }

      repondre(res, 405, { erreur: 'Méthode non prise en charge.' });
    });
  },
};

// La version du jeu, notée dans chaque partie enregistrée (voir src/parties.js) : le commit
// publié, pour pouvoir rejouer une vieille partie avec les règles de l'époque. GitHub Actions
// donne le commit dans GITHUB_SHA ; sur l'ordinateur, on le demande à git. En développement
// (npm run dev), le code change sans arrêt : la version est « dev ».
function versionDuJeu(commande) {
  if (commande === 'serve') return 'dev';
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7);
  try { return execSync('git rev-parse --short=7 HEAD').toString().trim(); } catch { return 'inconnue'; }
}

export default defineConfig(({ command }) => ({
  plugins: [outilsDev],
  define: { __VERSION__: JSON.stringify(versionDuJeu(command)) },
  server: { port: 5180 }, // toujours la même adresse : http://localhost:5180
  // Des adresses relatives (« ./assets/… » plutôt que « /assets/… ») : le site marche aussi
  // rangé dans un sous-dossier, comme sur GitHub Pages (patapain18.github.io/petits-gardiens/)
  base: './',
  // Sept pages : l'accueil avec la carte des époques (index.html), le jeu (jeu.html),
  // l'éditeur de niveaux (editeur.html), la galerie des personnages (personnages.html),
  // la salle des sons (sons.html), l'atelier des lumières (lumieres.html) et la page
  // pour revoir une partie enregistrée (revoir.html)
  build: {
    rollupOptions: {
      input: { accueil: 'index.html', jeu: 'jeu.html', editeur: 'editeur.html', personnages: 'personnages.html', sons: 'sons.html', lumieres: 'lumieres.html', revoir: 'revoir.html' },
    },
  },
}));
