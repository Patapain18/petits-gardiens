// ─────────────────────────────────────────────────────────────
// LE PANNEAU DE RÉGLAGES (à droite de l'éditeur)
// Relie les champs du formulaire à la fiche : quand on tape, la fiche
// change (et le plan se redessine) ; quand on quitte le champ, la
// modification est « validée » (elle entre dans l'historique Annuler).
// ─────────────────────────────────────────────────────────────
import { GARDIENS, MONSTRES, caracteristiques } from '../jeu/donnees.js';
import { DIFFICULTES, LECONS } from '../jeu/niveau.js';
import { texteResultat } from '../jeu/equilibrage.js';
import { versIdentifiant } from './format.js';

const $ = (s) => document.querySelector(s);
const nombreDe = (v) => (v === '' ? NaN : Number(v));

// Les erreurs de fiche sont écrites pour quelqu'un qui modifie le JSON à la main.
// Dans l'éditeur, on les dit autrement quand c'est possible.
const EN_CLAIR = {
  '"socles" doit contenir au moins 1 point(s)': 'Il faut au moins un socle : choisis l’outil Socles (touche 2) et clique sur la carte.',
  '"nom" doit être un texte': 'Donne un nom au niveau.',
  '"id" doit être un texte (ex. "prairie")': 'Donne un nom au fichier du niveau.',
};

export class Panneau {
  // etat : l'état partagé de l'éditeur ; modifier(changement, valider) : applique un changement à la fiche ;
  // montrer(objet) : met un objet en évidence sur le plan (quand on survole un conseil) ;
  // montrerGardiens(liste) : dessine sur le plan les gardiens d'un joueur imaginaire
  constructor({ etat, modifier, montrer, montrerGardiens }) {
    this.etat = etat;
    this.modifier = modifier;
    this.montrer = montrer;
    this.montrerGardiens = montrerGardiens;
    this.vaguesOuvertes = new Set([0]);
    this.structureVagues = '';
    this.nombreDeVagues = 0;
    this.brancherChamps();
    this.brancherVagues();
    this.brancherCampagne();
  }

  // ── Champs simples ─────────────────────────────────────────
  brancherChamps() {
    // Branche un champ : « appliquer » renvoie false si la valeur n'est pas correcte
    const champ = (selecteur, appliquer) => {
      const el = $(selecteur);
      const essayer = (valider) => {
        const correct = appliquer(el.value, valider);
        el.setAttribute('aria-invalid', String(!correct));
      };
      el.addEventListener('input', () => essayer(false));
      el.addEventListener('change', () => essayer(true));
    };
    const entier = (min, max, cle) => (v, valider) => {
      const n = nombreDe(v);
      if (!Number.isInteger(n) || n < min || n > max) return false;
      this.modifier((f) => { f[cle] = n; }, valider);
      return true;
    };

    champ('#nom', (v, valider) => {
      if (!v.trim()) return false;
      this.modifier((f) => {
        f.nom = v.trim();
        // tant qu'on n'a pas choisi le nom du fichier soi-même, il suit le nom du niveau
        if (!this.etat.idManuel) f.id = versIdentifiant(v);
      }, valider);
      return true;
    });
    champ('#fichier', (v, valider) => {
      const id = versIdentifiant(v);
      if (!v.trim()) return false;
      this.etat.idManuel = true;
      this.modifier((f) => { f.id = id; }, valider);
      return true;
    });
    champ('#largeur', entier(8, 60, 'largeur'));
    champ('#hauteur', entier(6, 40, 'hauteur'));
    champ('#or', entier(0, 99999, 'or'));
    champ('#graine', (v, valider) => {
      const n = nombreDe(v);
      if (!Number.isInteger(n) || n < 0) return false;
      this.modifier((f) => { f.decor = { ...f.decor, graine: n }; }, valider);
      return true;
    });
    champ('#description', (v, valider) => {
      if (v.length > 200) return false;
      this.modifier((f) => {
        if (v.trim()) f.description = v.trim();
        else delete f.description; // pas de description : on n'écrit pas le champ
      }, valider);
      return true;
    });
    // le curseur des arbres : on voit le résultat en glissant, on valide en lâchant
    const arbres = $('#arbres');
    const changerArbres = (valider) => this.modifier((f) => { f.decor = { ...f.decor, arbres: Number(arbres.value) }; }, valider);
    arbres.addEventListener('input', () => changerArbres(false));
    arbres.addEventListener('change', () => changerArbres(true));
    $('#ambiance').addEventListener('change', (ev) => this.modifier((f) => { f.ambiance = ev.target.value; }, true));
    document.querySelectorAll('[data-epoque]').forEach((b) => b.addEventListener('click', () =>
      this.modifier((f) => { f.style = b.dataset.epoque; }, true)));
    $('#autre-decor').addEventListener('click', () =>
      this.modifier((f) => { f.decor = { ...f.decor, graine: 1 + Math.floor(Math.random() * 99999) }; }, true));
  }

  // ── Campagne : difficulté visée, gardiens disponibles, didacticiel ──
  brancherCampagne() {
    $('#difficulte').replaceChildren(...Object.entries(DIFFICULTES).map(([cle, nom]) => new Option(nom, cle)));
    $('#difficulte').addEventListener('change', (ev) => this.modifier((f) => { f.difficulte = ev.target.value; }, true));
    $('#survie').addEventListener('change', (ev) => this.modifier((f) => {
      if (ev.target.checked) f.survie = true;
      else delete f.survie; // pas coché : un niveau normal, on n'écrit pas le champ
    }, true));
    $('#pouvoirs').addEventListener('change', (ev) => this.modifier((f) => {
      if (ev.target.checked) f.pouvoirs = true;
      else delete f.pouvoirs; // pas coché : pas de pouvoirs, on n'écrit pas le champ
    }, true));

    // Une liste de cases à cocher : leçons ou personnages
    const cases = (selecteur, elements) => {
      $(selecteur).append(...elements.map(([cle, nom]) => {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.value = cle;
        label.append(input, ` ${nom}`);
        return label;
      }));
    };
    cases('#lecons', Object.entries(LECONS));
    cases('#presenter', [...Object.keys(GARDIENS).map((t) => [t, GARDIENS[t].nom]), ...Object.entries(MONSTRES).map(([t, m]) => [t, m.nom])]);
    // quand on coche ou décoche, on relit toutes les cases et on réécrit « didacticiel »
    const lireCases = (selecteur) => [...document.querySelectorAll(`${selecteur} input:checked`)].map((c) => c.value);
    for (const selecteur of ['#lecons', '#presenter']) {
      $(selecteur).addEventListener('change', () => this.modifier((f) => {
        const lecons = lireCases('#lecons'), presenter = lireCases('#presenter');
        if (lecons.length || presenter.length) f.didacticiel = { lecons, presenter };
        else delete f.didacticiel; // rien de coché : pas de didacticiel
      }, true));
    }

    // les gardiens disponibles : un menu par gardien (« Dès la vague 1 », « À partir de la vague 3 »…)
    $('#gardiens-dispo').addEventListener('change', (ev) => {
      const type = ev.target.dataset.gardien;
      if (!type) return;
      this.modifier((f) => {
        // une fiche sans « gardiens » les propose tous dès la vague 1 : on part de là
        const dispo = { ...(f.gardiens || Object.fromEntries(Object.keys(GARDIENS).map((t) => [t, 1]))) };
        if (ev.target.value === 'jamais') delete dispo[type];
        else dispo[type] = Number(ev.target.value);
        f.gardiens = dispo;
      }, true);
    });
  }

  // Les menus des gardiens disponibles (redessinés quand le nombre de vagues change)
  dessinerGardiens(fiche) {
    const dispo = fiche.gardiens || Object.fromEntries(Object.keys(GARDIENS).map((t) => [t, 1]));
    $('#gardiens-dispo').replaceChildren(...Object.keys(GARDIENS).map((type) => {
      const ligne = document.createElement('label');
      ligne.className = 'ligne-gardien';
      const pastille = document.createElement('span');
      pastille.className = 'pastille-gardien';
      pastille.style.background = caracteristiques(type, 1).apparence.couleurs.peau;
      const choix = document.createElement('select');
      choix.dataset.gardien = type;
      choix.append(...fiche.vagues.map((_, i) => new Option(i === 0 ? 'Dès la vague 1' : `À partir de la vague ${i + 1}`, String(i + 1))));
      choix.append(new Option('Pas dans ce niveau', 'jamais'));
      choix.value = dispo[type] ? String(Math.min(dispo[type], fiche.vagues.length)) : 'jamais';
      ligne.append(pastille, GARDIENS[type].nom, choix);
      return ligne;
    }));
  }

  // ── Les vagues ─────────────────────────────────────────────
  brancherVagues() {
    const zone = $('#vagues');
    // Un seul écouteur pour tous les champs des vagues (même ceux créés plus tard)
    zone.addEventListener('input', (ev) => {
      const el = ev.target;
      const { vague, groupe, champ } = el.dataset;
      if (!champ) return;
      let valeur = el.value, correct = true;
      if (champ !== 'type') {
        valeur = nombreDe(el.value);
        correct = champ === 'nombre' ? Number.isInteger(valeur) && valeur >= 1 && valeur <= 999
          : Number.isFinite(valeur) && valeur >= 0 && valeur <= 600;
      }
      el.setAttribute('aria-invalid', String(!correct));
      if (correct) this.modifier((f) => { f.vagues[vague][groupe][champ] = valeur; }, false);
    });
    zone.addEventListener('change', (ev) => {
      if (ev.target.dataset.champ) this.modifier(() => {}, true); // valide ce qui vient d'être tapé
    });
    zone.addEventListener('toggle', (ev) => {
      const i = Number(ev.target.dataset.vague);
      if (ev.target.open) this.vaguesOuvertes.add(i); else this.vaguesOuvertes.delete(i);
    }, true);
    zone.addEventListener('click', (ev) => {
      const bouton = ev.target.closest('button[data-action]');
      if (!bouton) return;
      const v = Number(bouton.dataset.vague), g = Number(bouton.dataset.groupe);
      const actions = {
        'ajouter-groupe': (f) => f.vagues[v].push({ type: 'gluant', nombre: 5, ecart: 1, delai: 0 }),
        'retirer-groupe': (f) => f.vagues[v].splice(g, 1),
        'dupliquer-vague': (f) => { f.vagues.splice(v + 1, 0, structuredClone(f.vagues[v])); this.vaguesOuvertes.add(v + 1); },
        'supprimer-vague': (f) => f.vagues.splice(v, 1),
      };
      this.modifier(actions[bouton.dataset.action], true);
    });
    $('#ajouter-vague').addEventListener('click', () => this.modifier((f) => {
      const derniere = f.vagues[f.vagues.length - 1];
      // la nouvelle vague reprend la précédente avec un peu plus de monstres
      f.vagues.push(derniere ? derniere.map((g) => ({ ...g, nombre: g.nombre + 2 })) : [{ type: 'gluant', nombre: 6, ecart: 1.5, delai: 0 }]);
      this.vaguesOuvertes.add(f.vagues.length - 1);
    }, true));
  }

  dessinerVagues(fiche) {
    const zone = $('#vagues');
    const options = (choisi) => Object.entries(MONSTRES)
      .map(([cle, m]) => `<option value="${cle}"${cle === choisi ? ' selected' : ''}>${m.nom}</option>`).join('');
    zone.innerHTML = fiche.vagues.map((vague, v) => `
      <details class="vague" data-vague="${v}"${this.vaguesOuvertes.has(v) ? ' open' : ''}>
        <summary><span class="vague-titre">Vague ${v + 1}</span><span class="vague-resume" data-resume="${v}"></span></summary>
        ${vague.map((g, i) => `
          <div class="groupe">
            <select data-vague="${v}" data-groupe="${i}" data-champ="type" aria-label="Monstre du groupe ${i + 1}">${options(g.type)}</select>
            <label>× <input type="number" min="1" max="999" step="1" value="${g.nombre}" data-vague="${v}" data-groupe="${i}" data-champ="nombre" aria-label="Nombre de monstres"></label>
            <label>toutes les <input type="number" min="0" step="0.1" value="${g.ecart}" data-vague="${v}" data-groupe="${i}" data-champ="ecart" aria-label="Secondes entre deux monstres"> s</label>
            <label>après <input type="number" min="0" step="0.5" value="${g.delai}" data-vague="${v}" data-groupe="${i}" data-champ="delai" aria-label="Secondes avant le premier monstre"> s</label>
            <button class="petit" data-action="retirer-groupe" data-vague="${v}" data-groupe="${i}" aria-label="Retirer ce groupe" title="Retirer ce groupe"${vague.length < 2 ? ' disabled' : ''}>Retirer</button>
          </div>`).join('')}
        <div class="vague-actions">
          <button class="petit" data-action="ajouter-groupe" data-vague="${v}">Ajouter un groupe</button>
          <button class="petit" data-action="dupliquer-vague" data-vague="${v}">Dupliquer</button>
          <button class="petit danger" data-action="supprimer-vague" data-vague="${v}"${fiche.vagues.length < 2 ? ' disabled title="Il faut au moins une vague"' : ''}>Supprimer</button>
        </div>
      </details>`).join('');
  }

  // Le petit résumé à côté de chaque vague (se met à jour sans tout redessiner)
  majResumes(fiche) {
    fiche.vagues.forEach((vague, v) => {
      const el = document.querySelector(`[data-resume="${v}"]`);
      if (!el) return;
      const total = vague.reduce((n, g) => n + (Number(g.nombre) || 0), 0);
      const fin = Math.max(...vague.map((g) => (Number(g.delai) || 0) + ((Number(g.nombre) || 1) - 1) * (Number(g.ecart) || 0)));
      el.textContent = `${total} monstre${total > 1 ? 's' : ''}, le dernier part après ${fin.toFixed(0)} s`;
    });
  }

  // ── Afficher la fiche dans le formulaire ───────────────────
  // force = true : on réécrit tout (chargement, Annuler) ; sinon on ne touche
  // pas au champ en cours de frappe, pour ne pas déplacer le curseur.
  afficher(fiche, force = false) {
    const remplir = (selecteur, valeur) => {
      const el = $(selecteur);
      if (force || document.activeElement !== el) {
        el.value = valeur ?? '';
        el.removeAttribute('aria-invalid');
      }
    };
    remplir('#nom', fiche.nom);
    remplir('#fichier', fiche.id);
    remplir('#largeur', fiche.largeur);
    remplir('#hauteur', fiche.hauteur);
    remplir('#or', fiche.or);
    remplir('#graine', fiche.decor?.graine ?? 1);
    remplir('#description', fiche.description ?? '');
    $('#difficulte').value = fiche.difficulte || 'normal';
    $('#survie').checked = Boolean(fiche.survie);
    $('#pouvoirs').checked = Boolean(fiche.pouvoirs);
    $('#ligne-difficulte').hidden = Boolean(fiche.survie); // on ne gagne jamais une arène : pas de difficulté visée
    if (force || document.activeElement !== $('#arbres')) $('#arbres').value = fiche.decor?.arbres ?? 0.05;
    $('#valeur-arbres').textContent = `${Math.round((fiche.decor?.arbres ?? 0.05) * 100)} %`;
    $('#ambiance').value = fiche.ambiance || 'doree';
    $('#ligne-ambiance').hidden = fiche.style === 'cartoon'; // le cartoon n'a pas encore d'ambiances
    // le didacticiel : les cases cochées suivent la fiche
    const coches = new Set([...(fiche.didacticiel?.lecons || []), ...(fiche.didacticiel?.presenter || [])]);
    document.querySelectorAll('#lecons input, #presenter input').forEach((c) => { c.checked = coches.has(c.value); });
    // les gardiens disponibles : on redessine les menus seulement si le nombre de vagues a changé
    if (force || fiche.vagues.length !== this.nombreDeVagues) {
      this.nombreDeVagues = fiche.vagues.length;
      this.dessinerGardiens(fiche);
    } else {
      const dispo = fiche.gardiens || Object.fromEntries(Object.keys(GARDIENS).map((t) => [t, 1]));
      document.querySelectorAll('#gardiens-dispo select').forEach((s) => { s.value = dispo[s.dataset.gardien] ? String(dispo[s.dataset.gardien]) : 'jamais'; });
    }
    document.querySelectorAll('[data-epoque]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.epoque === fiche.style)));
    $('#chemin-fichier').textContent = `src/niveaux/${fiche.id}.json`;

    const structure = fiche.vagues.map((v) => v.length).join(',');
    if (force || structure !== this.structureVagues) {
      this.structureVagues = structure;
      this.dessinerVagues(fiche);
    }
    this.majResumes(fiche);
  }

  // ── La liste de vérification ───────────────────────────────
  afficherVerification(erreurs, conseils, niveau) {
    const liste = $('#verification');
    liste.innerHTML = '';
    const ajouter = (texte, classe, objet) => {
      const li = document.createElement('li');
      li.className = classe;
      li.textContent = texte; // textContent : jamais interprété comme du HTML
      if (objet) {
        li.tabIndex = 0;
        li.addEventListener('mouseenter', () => this.montrer(objet));
        li.addEventListener('focus', () => this.montrer(objet));
        li.addEventListener('mouseleave', () => this.montrer(null));
        li.addEventListener('blur', () => this.montrer(null));
      }
      liste.append(li);
    };
    erreurs.forEach((texte) => ajouter(EN_CLAIR[texte] || texte, 'erreur'));
    conseils.forEach((c) => ajouter(c.texte, 'conseil', c.objet));
    if (!erreurs.length && !conseils.length) ajouter('Tout est bon : le niveau est prêt à être testé.', 'ok');

    // quelques chiffres sur le niveau
    const resume = $('#resume-niveau');
    if (niveau?.survie) {
      const ecrites = this.etat.fiche.vagues.length;
      resume.textContent = `Chemin de ${niveau.longueurChemin.toFixed(1).replace('.', ',')} cases, ${niveau.socles.length} socles, ${ecrites} vague${ecrites > 1 ? 's' : ''} écrite${ecrites > 1 ? 's' : ''}, puis des vagues sans fin.`;
    } else if (niveau) {
      const monstres = niveau.vagues.flat().reduce((n, g) => n + g.nombre, 0);
      resume.textContent = `Chemin de ${niveau.longueurChemin.toFixed(1).replace('.', ',')} cases, ${niveau.socles.length} socles, ${niveau.vagues.length} vagues pour ${monstres} monstres.`;
    } else {
      resume.textContent = 'Corrige les erreurs pour voir le décor et les conseils.';
    }
  }

  // ── Les résultats du test d'équilibrage ────────────────────
  // aJour = false : le niveau a changé depuis le test, on le signale.
  afficherEquilibrage(analyse, aJour = true) {
    const zone = $('#resultat-equilibrage');
    zone.replaceChildren();
    if (!analyse) return;
    const el = (balise, classe, texte) => {
      const e = document.createElement(balise);
      if (classe) e.className = classe;
      if (texte !== undefined) e.textContent = texte;
      return e;
    };
    if (!aJour) zone.append(el('p', 'perime', 'Le niveau a changé depuis ce test : relance-le pour avoir des résultats à jour.'));

    // Le verdict, et la difficulté visée : vert = atteinte, orange = à un cran près, rouge = plus loin
    // (une arène de survie n'a pas de difficulté visée : on ne la gagne jamais)
    const verdict = el('div', 'verdict');
    verdict.dataset.niveau = analyse.verdict.niveau;
    verdict.append(el('strong', '', analyse.verdict.titre), el('p', '', analyse.verdict.explication));
    if (analyse.verdict.objectif) {
      const { ecart } = analyse.verdict.objectif;
      verdict.dataset.conforme = ecart === 0 ? 'oui' : Math.abs(ecart) === 1 ? 'presque' : 'non';
      verdict.append(el('p', 'objectif', analyse.verdict.objectif.texte));
    }
    zone.append(verdict);
    if (analyse.verdict.conseils.length) {
      const liste = el('ul', 'conseils-equilibrage');
      analyse.verdict.conseils.forEach((c) => liste.append(el('li', '', c)));
      zone.append(liste);
    }

    // Le tableau des joueurs imaginaires (survoler une ligne montre ses gardiens sur le plan)
    const table = el('table', 'joueurs');
    const tete = table.createTHead().insertRow();
    tete.append(el('th', '', 'Joueur imaginaire'), el('th', '', 'Résultat'));
    const corps = table.createTBody();
    for (const r of analyse.resultats) {
      const ligne = corps.insertRow();
      ligne.className = (r.victoires === r.total ? 'gagne' : r.victoires === 0 ? 'perd' : 'parfois') + (r.strategie.reference ? ' reference' : '');
      ligne.tabIndex = 0;
      const resultat = el('td', 'resultat', texteResultat(r));
      if (r.victoires) resultat.append(el('small', '', `au plus près : ${r.marge.toFixed(1).replace('.', ',')} case${r.marge >= 2 ? 's' : ''} du château`));
      ligne.append(el('td', '', r.strategie.nom), resultat);
      const montrer = () => this.montrerGardiens(r.gardiens);
      const cacher = () => this.montrerGardiens(null);
      ligne.addEventListener('mouseenter', montrer);
      ligne.addEventListener('focus', montrer);
      ligne.addEventListener('mouseleave', cacher);
      ligne.addEventListener('blur', cacher);
    }
    zone.append(table);
    zone.append(el('p', 'note', `${analyse.parties} parties simulées. Survole un joueur pour voir où il a posé ses gardiens.`));
  }
}
