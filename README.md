# Petits Gardiens

Un tower defense vu de dessus. De petits monstres gentils, les **gardiens**, protègent leur château. Des monstres méchants suivent le chemin et, **si un seul entre dans le château, la partie est perdue**.

> Où on en est (octobre 2026) : une **campagne complète** avec une carte des époques et trois mondes de 4 niveaux : le monde 1 en pixel art, le monde 2 en cartoon, le monde 3 en voxel (chacun commence par un **didacticiel**, le monde 2 finit par le Colosse et le monde 3 par le Dragon) ; un **mode survie** avec son **classement en ligne** ; des **parties enregistrées**, qu'on peut revoir ; un petit moteur maison (fiches de niveau, éditeur, équilibrage, fiches personnages), et des ateliers pour le régler (lumières, textures, modèles, équilibrage) ; des **gardiens qui s'améliorent** jusqu'au niveau 3 ; trois styles graphiques, un par époque, chacun avec 4 ambiances ; **la musique et les bruitages**, fabriqués par le code : un même thème joué par trois orchestres, un par époque, et un thème pour les chefs ; et un **écran d'options**.

**Jouer en ligne : https://patapain18.github.io/petits-gardiens/**

## Lancer le jeu

```bash
npm install
npm run dev
```

Puis ouvrir http://localhost:5180 : c'est la **carte des époques**, d'où l'on choisit un niveau. L'éditeur de niveaux est à http://localhost:5180/editeur.html, la galerie des personnages (chacun dans les trois styles) à http://localhost:5180/personnages.html, la salle des sons à http://localhost:5180/sons.html, et les ateliers : des lumières (`lumieres.html`), des textures (`textures.html`), des modèles (`modeles.html`) et de l'équilibrage (`equilibrage.html`).

Pour jouer un niveau précis : `http://localhost:5180/jeu.html?niveau=monde1-3` (le nom du fichier, sans `.json`).

## Mettre en ligne

Le jeu est publié sur **GitHub Pages**, à l'adresse https://patapain18.github.io/petits-gardiens/. Il n'y a rien à faire à la main : à chaque envoi (« push ») sur la branche `main`, un ordinateur de GitHub suit la recette `.github/workflows/mettre-en-ligne.yml`. Il installe les outils (`npm ci`), fabrique le site (`npm run build`, qui crée le dossier `dist/`), puis le publie. On suit son travail dans l'onglet « Actions » du dépôt, et quelques minutes plus tard, la nouvelle version est en ligne.

Ce qui change en ligne :
- **Le site vit dans un sous-dossier** (`…github.io/petits-gardiens/`) : `vite.config.js` fabrique donc des adresses relatives (`base: './'`).
- **Les outils de développement n'existent pas en ligne** : pas d'« Ouvrir tous les niveaux (test) », pas de captures d'écran ni de sons enregistrés. Dans l'éditeur, on peut ouvrir les niveaux du jeu (ils sont rangés dans le site), les modifier, les tester et télécharger leur fiche, mais pas les enregistrer dans le projet : ça demande `npm run dev`.
- **La progression et les options sont gardées par chaque navigateur** : chacun a les siennes, sur son ordinateur.
- **Le classement du mode survie, lui, est en ligne**, sur un petit serveur à part (avec les parties enregistrées et le compteur de visites). Il ne part pas avec le site : il se met en ligne sur Vercel (voir « Le classement en ligne »).

## Comment on joue

- Sur la carte des époques, choisis un niveau. Gagner un niveau ouvre le suivant. Le premier niveau, « La clairière », est un didacticiel : il explique tout en jouant.
- Clique sur un socle de pierre (le petit cube doré ou le « + » qui flotte) et choisis un gardien.
- Clique sur **Lancer la vague** (ou appuie sur Espace) quand tu es prêt.
- Chaque monstre tué rapporte de l'or, et chaque vague terminée donne un bonus.
- Clique sur un gardien déjà posé : tu vois ses chiffres et sa portée, tu peux l'**améliorer** (niveau 2, puis 3) ou le revendre (tu récupères 60 % de tout ce que tu as dépensé pour lui).
- Le bouton **Options**, en bas à droite, règle le son, la vitesse et l'affichage (voir « L'écran d'options ») ; la touche **M** coupe tout le son.
- Dans l'arène, deux **pouvoirs du château** aident pendant les vagues : le **Météore** (touche **1**), que l'on vise sur le chemin, et le **Grand froid** (touche **2**). Voir « Les pouvoirs du château ».
- Dans l'arène aussi, toutes les 5 vagues tenues, une **bénédiction** : un bonus à choisir parmi 3 (clic, ou touches 1, 2, 3), qui reste jusqu'à la fin de la partie. Voir « Les bénédictions ».
- Et un **héros**, le Grand Gardien : clique sur lui (ou touche **H**), puis sur la carte, et il y marche. Il frappe les monstres autour de lui et leur barre la route, mais ils le frappent aussi : à zéro, il est K.O. jusqu'à la vague suivante. Ses niveaux lui donnent des pouvoirs : l'Onde de choc (touche **O**) et le Bond (touche **B**). Voir « Le héros ».

| Gardien | Prix | Pouvoir |
|---|---|---|
| Braise (orange) | 70 | Boules de feu rapides, sur une seule cible |
| Givrine (bleue) | 75 | Gèle un petit groupe : les monstres avancent deux fois moins vite |
| Grondin (violet) | 120 | Rochers en cloche qui touchent jusqu'à 5 monstres d'un coup (mais pas les volants) |
| Étincelle (jaune), monde 2 | 90 | Un éclair qui saute d'un monstre à l'autre, et touche les volants |
| Bourrasque (menthe), monde 2 | 75 | Souffle les monstres en arrière sur le chemin |
| Pépite (cuivre), monde 3 | 100 | Ne tire pas : rapporte de l'or à la fin de chaque vague |
| Prisme (rose), monde 3 | 110 | Un rayon qui chauffe sur le même monstre, et traverse les carapaces |

| Monstre | Particularité |
|---|---|
| Gluant | Le monstre de base, il avance en sautillant |
| Filou | Fragile mais très rapide |
| Cuirassé | Lent, mais il encaisse énormément |
| Voltigeur, monde 2 | Une chauve-souris qui vole : les rochers du Grondin passent dessous |
| Gigogne, monde 2 | Une maman gelée : battue, elle libère 3 Gluants |
| Colosse, monde 2 | Le chef des monstres, à la fin du monde 2 : énorme, et il se brise en 2 Cuirassés |
| Carapace, monde 3 | Une tortue : chaque coup perd 5 dégâts sur sa carapace |
| Taupe, monde 3 | Elle creuse sous le chemin : sous terre, personne ne peut la viser |
| Dragon, monde 3 | Le chef du monde 3 : il vole, et son feu assomme les gardiens |

## Les améliorations

Chaque gardien a **3 niveaux**. On l'améliore depuis son menu : le bouton « Améliorer » donne le prix et ce qui change (« Dégâts 9 → 14, cadence 0,8 → 0,62 s… et une cape »). Pendant qu'on le survole, le cercle montre la portée du niveau suivant. S'il manque de l'or, le bouton est grisé et dit combien il manque ; il se débloque tout seul dès que l'or arrive.

| Gardien | Niveau 1 | Niveau 2 | Niveau 3 |
|---|---|---|---|
| Braise | 70 pièces · 9 dégâts toutes les 0,8 s | **Braise ardente** (+70) · 14 dégâts / 0,62 s | **Brasier** (+110) · 22 dégâts / 0,54 s, flamme bleue |
| Givrine | 75 · 7 dégâts, gel 2,5 s | **Givre** (+70) · 11 dégâts, gel 3 s, zone plus large | **Blizzard** (+110) · 16 dégâts, gel 3,5 s, cape blanche |
| Grondin | 120 · 24 dégâts toutes les 2,3 s, 5 monstres au plus | **Tonnerre** (+100) · 40 dégâts, explosion plus large, 6 monstres | **Séisme** (+150) · 62 dégâts, 8 monstres, mortier d'acier |
| Étincelle | 90 · 9 dégâts, l'éclair touche 3 monstres | **Éclair** (+75) · 14 dégâts, 4 monstres | **Foudre** (+115) · 20 dégâts, 4 monstres, antennes blanches |
| Bourrasque | 75 · recul de 1,2 case | **Rafale** (+75) · recul de 1,5 case, souffle plus large | **Tornade** (+115) · recul de 1,9 case, moulinet violet |
| Pépite | 100 · +25 pièces à chaque vague | **Filon** (+80) · +45 pièces | **Trésor** (+120) · +75 pièces, pioche de cristal |
| Prisme | 110 · 10 dégâts par seconde, jusqu'à ×3 | **Rayon** (+90) · 15 par seconde, jusqu'à ×3,2 | **Arc-en-ciel** (+130) · 22 par seconde, jusqu'à ×3,5, cristal doré |

La portée grandit aussi un peu à chaque niveau. Les prix sont réglés pour qu'une amélioration rapporte à peu près autant de dégâts par pièce qu'un nouveau gardien : améliorer est un vrai choix, pas un piège. Pour la Pépite, c'est l'or qui compte : achat ou amélioration, chaque dépense est remboursée en 4 vagues.

**Le code visuel**, le même pour tous les gardiens et dans les trois styles :
- **niveau 2 = une cape**, avec un col autour de l'arrière de la tête (c'est ce qu'on voit d'en haut), un gardien un peu plus grand et des couleurs plus vives ;
- **niveau 3 = une couronne dorée** en plus, encore un peu plus grand, et son pouvoir change de couleur.

**Dans le code :**
- `caracteristiques(type, niveau)` (dans `donnees.js`) donne les chiffres et l'apparence d'un gardien à un niveau ;
- `prixAmelioration(tour)`, `ameliorer(etat, socle)` et `prixRevente(tour)` sont dans `moteur.js` ; chaque gardien retient son `niveau` et l'or `investi` en lui ;
- un tir garde les chiffres du gardien au moment où il part (`p.fiche`) ;
- dans les styles 3D, la `Synchro` range les gardiens sous la clé « id:niveau ». Quand un gardien est amélioré, sa clé change : l'ancien est retiré et un nouveau est fabriqué avec sa nouvelle apparence, avec la petite animation d'apparition et une fontaine d'étincelles dorées.

![Les 9 gardiens dans les 3 styles : niveaux 1, 2 et 3](docs/ameliorations.jpg)

## La campagne : la carte des époques et ses trois mondes

La page d'accueil (`index.html`) montre **une colonne par monde**, chacune dans le style de son époque : le monde 1 en pixel art (les années 1990), le monde 2 en cartoon (les années 2000), le monde 3 en voxel (aujourd'hui).

![La carte des époques](docs/carte-des-epoques.jpg)

Chaque niveau est une médaille : verrouillé, « À toi de jouer ! » (il clignote), ou gagné (✓). On gagne un niveau → le suivant s'ouvre. La progression est gardée par le navigateur (`localStorage`) ; si le navigateur refuse, le jeu marche quand même, il oublie seulement les victoires.

| Niveau | Nom | Ambiance | Difficulté visée | Ce qu'il apprend |
|---|---|---|---|---|
| 1-1 | La clairière | midi | Didacticiel | tout : poser, lancer, améliorer, et les 6 personnages un par un |
| 1-2 | Les deux étangs | heure dorée | Facile | bien placer ses gardiens (3 socles sont moins bons) |
| 1-3 | Le bois brumeux | aube | Normal | mélanger les gardiens face aux foules (un long chemin en lacets) |
| 1-4 | Le col des Cuirassés | nuit | Normal | améliorer : sans amélioration, on perd aux dernières vagues |

![Les 4 niveaux du monde 1](docs/monde1.jpg)

Le monde 2 s'ouvre quand on a gagné le dernier niveau du monde 1 :

| Niveau | Nom | Ambiance | Difficulté visée | Ce qu'il apprend |
|---|---|---|---|---|
| 2-1 | Le pré des moulins | midi | Didacticiel | les 4 nouveaux, un par un : Étincelle arrive pour la vague 2 (celle des premiers Voltigeurs), Bourrasque pour la vague 4 (celle de la première Gigogne) |
| 2-2 | Le lac aux Voltigeurs | heure dorée | Facile | se défendre contre les volants : des nuées de Voltigeurs autour d'un grand lac |
| 2-3 | Le marais des Gigognes | aube | Normal | mélanger : des foules serrées (il faut des gardiens qui touchent tout un groupe), des Cuirassés espacés (il faut de la puissance), des volants |
| 2-4 | La vallée du Colosse | nuit | Normal | le dernier combat : tout à la fois, puis le Colosse, présenté par sa propre fiche quand il arrive |

![Les 4 niveaux du monde 2](docs/monde2.jpg)

Le monde 3 s'ouvre quand on a gagné le Colosse :

| Niveau | Nom | Ambiance | Difficulté visée | Ce qu'il apprend |
|---|---|---|---|---|
| 3-1 | La colline dorée | heure dorée | Didacticiel | les 4 nouveaux, un par un : la Pépite dès le début (plus elle arrive tôt, plus elle rapporte), le Prisme pour la vague 2 (celle des premières Carapaces), puis la Taupe, présentée quand elle sort de terre |
| 3-2 | La prairie des Carapaces | midi | Facile | les Carapaces par dizaines : le Prisme (ou de gros coups) contre l'armure |
| 3-3 | Le champ des Taupes | nuit | Normal | mélanger : trois longs sillons, des Taupes, des Carapaces espacées, et d'énormes foules qu'il faut balayer (le Grondin) |
| 3-4 | Le pic du Dragon | aube | Normal | le dernier combat : le château est au milieu, le chemin s'enroule autour, et le Dragon arrive en dernier, derrière son escorte |

![Les 4 niveaux du monde 3](docs/monde3.jpg)

**Le château au milieu.** Au 3-4, pour la première fois, le château n'est pas au bord de la carte : le chemin fait le tour de la montagne et finit au centre. Rien n'a changé dans le code pour ça : la porte est toujours à gauche, au bout du chemin. Seule surprise : la nuit, la lune éclaire de côté, et l'ombre d'un château au centre recouvrait la moitié de la carte. Le Dragon arrive donc à l'aube, dans la brume, et c'est le champ des Taupes qui se joue la nuit (le voxel y a gagné une nuit un peu moins brumeuse, plus lisible).

**Les ambiances du cartoon.** Comme le pixel art et le voxel, le cartoon a maintenant ses 4 moments de la journée : la couleur et la direction du soleil changent (à l'aube il vient de l'est, à l'heure dorée de l'ouest, avec de longues ombres), et la nuit, les lanternes et la porte du château éclairent le chemin autour d'elles.

L'ordre des mondes et des niveaux est rangé dans `src/jeu/campagne.js` (les règles : quel niveau vient après, lequel est ouvert). Pour ajouter un niveau à un monde, il suffit d'ajouter son id dans la liste `niveaux` de ce monde.

**Les cartes de début et de fin** disent où l'on est (« Monde 1 · Niveau 2 »). Après une victoire : « Niveau suivant », « Rejouer » ou « Carte des époques ». Après le dernier niveau d'un monde : « Tu as terminé le monde 1 ! ».

## Le mode survie

Un défi à part, en bas de la carte des époques : **L'arène pixel**. Les vagues ne s'arrêtent jamais, et chacune est plus dure que la précédente. Un seul monstre dans le château, et la partie s'arrête. Le score, c'est le nombre de vagues tenues ; à égalité, celui qui a battu le plus de monstres passe devant.

- En haut de l'écran : « Vague 12 » (sans total) et le **record** de l'arène, le meilleur score de tous les joueurs, qui passe en orange quand on est en train de le battre.
- À la fin : le score, « Nouveau record de l'arène ! » s'il le faut, puis un **pseudo libre** (16 caractères au plus) pour entrer dans le classement. Il sera visible par tous : un surnom, pas son vrai nom. Le jeu se souvient du pseudo pour la fois suivante. Ensuite : la place obtenue et les 10 meilleurs, sa ligne en orange.
- **Tout le monde joue la même partie** : la graine du hasard est fixe dans une arène, pour que les scores se comparent vraiment.

![L'arène pixel, en pleine partie](docs/arene.jpg)

**Les vagues sans fin** (`src/jeu/survie.js`). L'arène commence par les vagues écrites dans sa fiche (5 dans L'arène pixel). Ensuite, elles sont fabriquées : on mesure la « menace » de la dernière vague écrite (les points de vie qui arrivent, multipliés par la vitesse des monstres), et chaque nouvelle vague en apporte **20 % de plus**. Les thèmes tournent : une marée de Gluants, une ruée de Filous, une colonne de Cuirassés, puis tout à la fois. Au-delà de 15 monstres par groupe, les monstres ne deviennent plus plus nombreux mais **renforcés** (`force` multiplie leurs points de vie) : l'écran reste lisible, et l'or gagné ne suit plus, ce qui finit toujours par faire tomber le château.

**L'équilibrage** joue aussi les arènes : au lieu de « gagne / perd », il dit jusqu'où tient chaque joueur imaginaire. Pour L'arène pixel, avec les pouvoirs du château, les bénédictions et le héros (le Météore à un par vague, le héros avec sa vie et ses pouvoirs) : le bon joueur tient 26 vagues, des Braise seules 16 à 20, sans jamais améliorer 14 à 16, un mélange mal placé 20, et les meilleures compositions bien jouées 26 à 30. Un « expert » imaginaire qui copie la technique d'un vrai joueur (le héros devant les monstres, les combos, les bénédictions des pouvoirs) tient 34 vagues. Il conseille si un bon joueur tombe trop tôt, tient trop longtemps, ou si l'écart avec un joueur maladroit est trop faible pour que le classement départage.

**Le réglage d'octobre 2026.** L'arène était trop facile, surtout avec Givrine + Grondin. Les mesures (des parties simulées, et une recherche automatique de la meilleure composition, socle par socle) l'ont confirmé : ce mélange tenait 34 à 36 vagues, plus d'une demi-heure, contre 26 pour le bon joueur. La raison : les monstres gelés se tassent les uns contre les autres, et dans les dernières vagues un seul rocher en touchait 20 à 40 (jusqu'à 75 !). Autre problème : toute la défense était achetée dès la vague 13. Pendant plus de 20 vagues, il ne restait rien à décider, et l'or s'entassait (22 000 pièces à la fin). Trois changements :

- un rocher du Grondin touche **au plus 5 monstres** (6 pour Tonnerre, 8 pour Séisme) : les plus près du point de chute. C'est la limite la plus basse qui laisse tous les niveaux de la campagne à leur difficulté (avec 4, le pic du Dragon devient trop dur) ;
- les vagues fabriquées apportent **20 %** de menace en plus à chaque fois, au lieu de 17 % : le danger arrive plus tôt ;
- **15 monstres au plus par groupe**, au lieu de 40 (au-delà, ils sont renforcés) : moins de monstres, c'est moins d'or gagné, et une foule moins serrée pour les rochers. La défense est complète vers la vague 14, et non plus 13 : l'or compte un peu plus longtemps.

| Composition | Avant | Après |
|---|---|---|
| La meilleure trouvée par la recherche (surtout des Grondin, et 3 ou 4 Givrine) | 38 vagues | 24 |
| Givrine + Grondin, un sur deux | 34 à 36 | 22 à 24 |
| Le bon joueur (le mélange) | 26 à 30 | 20 |
| Braise + Givrine + Grondin | 30 | 20 |
| Que des Braise | 16 | 12 |

Givrine + Grondin reste le meilleur mélange de l'arène (c'est le rôle du Grondin : les foules), mais il ne tient plus que quelques vagues de plus qu'un bon mélange, au lieu de dix. Un bonus de fin de vague plus petit a aussi été essayé : aucun effet mesurable (la défense est complète avant que ça compte), il n'a donc pas changé.

**Le classement** (`src/classement.js`) est **en ligne** : tous les joueurs se comparent (voir la partie suivante). Ses fonctions répondaient déjà « plus tard » (`async`) quand les scores étaient gardés sur l'ordinateur : pour passer en ligne, ce fichier a changé, et le reste du jeu presque pas. Les pseudos sont toujours affichés tels quels (`textContent`), jamais interprétés comme du HTML.

**Créer une arène** : dans l'éditeur, coche « Mode survie » (et « Pouvoirs du château » pour donner le Météore et le Grand froid, « Bénédictions » pour les bonus toutes les 5 vagues, « Héros » pour le Grand Gardien). Les vagues écrites deviennent le début de l'arène, la suite est fabriquée toute seule, et l'arène apparaît d'elle-même dans le « Défi » de la carte des époques.

**Le plafond, et les pouvoirs du château.** Après le réglage d'octobre 2026, un vrai joueur est arrivé à la vague 22… et a senti un plafond : la meilleure composition donne le meilleur score possible, et le savoir-faire ne sert plus à rien. C'était vrai : pendant une vague, il n'y avait rien à faire ; la défense atteint sa puissance maximale vers la vague 14 (12 socles au niveau 3) ; et tout le monde joue la même partie. D'où trois idées, une par étape : les pouvoirs du château, les bénédictions et un héros à déplacer (ci-dessous). Chacune rendait l'arène plus facile et les parties plus longues : à la fin, la montée des vagues est passée de 20 % à 25 % (avec 20 %, un très bon joueur imaginaire repartait vers 35 vagues ; avec 28 %, tout le monde finissait pareil, et le savoir-faire ne comptait plus). Puis à 22 %, quand le Météore est passé à un par vague (voir « Le Météore, réglé avec une vraie partie »), et enfin à **20 %** quand le héros a reçu sa vie et ses pouvoirs (voir « Le héros »).

### Les pouvoirs du château

Deux boutons à côté de « Lancer la vague », dans les niveaux dont la fiche dit `"pouvoirs": true` (pour l'instant, l'arène) :

- **Météore** (touche 1) : **un par vague**. On clique sur le bouton, puis sur le chemin ; un cercle orange montre où il tombera. Il met 0,9 seconde à tomber (il faut viser là où les monstres **seront**), puis les monstres touchés perdent **la moitié de la vie qui leur reste** (même ceux qui volent), et **les trois quarts** s'ils sont gelés. Le bouton montre combien il en reste pour la vague (« 1/1 », puis « 0/1 ») ; un Météore pas lancé est perdu à la fin de la vague. Clic droit, Échap ou un nouveau clic sur le bouton : on annule.
- **Grand froid** (touche 2) : tous les monstres gèlent sur place pendant 4 secondes (pris dans un glaçon), et sont **fragiles** : ils prennent deux fois plus de dégâts. Il se recharge en 60 secondes, **pendant les vagues** seulement (on ne peut pas attendre tranquillement qu'il revienne entre deux vagues) ; son bouton se remplit pendant la recharge. Les chiffres sont dans `POUVOIRS` (`src/jeu/donnees.js`), les règles dans le moteur (`lancerMeteore`, `lancerGrandFroid`) ; les trois styles dessinent le cercle de visée, la boule de feu qui tombe, son explosion et les glaçons.

**Ce que les joueurs imaginaires ont trouvé** (ils se servent maintenant des pouvoirs : le bon joueur vise le plus gros paquet, là où il sera, et garde le froid pour le moment où le gros des monstres est sous le feu de ses gardiens ; le maladroit lance tout dès que c'est prêt) :

- Au premier essai, le Météore enlevait la moitié de la vie **maximale** : deux Météores battaient n'importe quel monstre, même dans les vagues les plus solides, et une défense de **Givrine seules tenait les 150 vagues** ! Une part de la vie **qui reste**, c'est toujours utile (en survie, les monstres deviennent de plus en plus solides), mais seul, le Météore ne bat plus personne.
- Le Grand froid ne servait presque à rien avec des Givrine : des monstres déjà ralentis, qu'on arrête tout à fait, n'avancent guère moins. D'où les monstres **fragiles** pendant le gel. Et un combo : un Météore sur des monstres gelés (deux fois la moitié) les bat tous. Ce n'est pas une astuce sans fin : garder le Météore pour ce combo fait tenir **moins** longtemps que de le lancer librement.
- Avec Givrine + Grondin : 24,6 vagues sans pouvoirs, 25,9 avec un Météore lancé au hasard, 29,4 avec un Météore bien visé. **Bien viser compte**, et le meilleur score n'est plus fixé par la composition seule.

**Le Météore, réglé avec une vraie partie.** Au début, le Météore se rechargeait en 30 secondes, et un combo « Grand froid puis Météore » enlevait toute la vie (la moitié, doublée par le « fragile »). Un vrai joueur a tenu 55 vagues, puis 50 dans une partie enregistrée (voir « Les parties enregistrées »), que `npm run parties` a racontée : 108 Météores touchant chacun 17,7 monstres en moyenne (le héros et les Givrine les tassent en paquet), 581 monstres battus par le combo, et surtout **95 à 100 % des dégâts faits par le Météore** de la vague 35 à la vague 50 ; les 12 gardiens ne servaient plus à rien. Et le joueur avait arrêté de jouer à la vague 51 : ce n'est pas le jeu qui l'avait battu. La raison : plus une vague dure, plus on lance de Météores, et comme chacun enlève une **part** de la vie, il suit les monstres à l'infini. Ce que les joueurs imaginaires n'avaient pas vu (ils visaient bien moins bien). Les changements :

- **un Météore par vague**, au lieu d'un toutes les 30 secondes : une vague plus longue n'en donne plus davantage ;
- **sur des monstres gelés, les trois quarts de la vie**, plus toute la vie : le combo reste le meilleur coup, mais il faut des gardiens pour finir ;
- la **Pluie d'étoiles** donne un Météore de plus par vague (une fois), et la **Comète** le rend plus large, plus plus fort ;
- la montée des vagues redescend de 25 % à **22 %** : avec un Météore moins fort, le bon joueur imaginaire ne tenait plus que 22 vagues (26 maintenant). Un « expert » imaginaire qui copie la technique de la partie de 50 vagues s'arrête vers 35 vagues, au lieu de pouvoir jouer à l'infini.

Le classement a changé de **saison** en même temps (voir « Le classement en ligne »).

### Les bénédictions

Dans les arènes dont la fiche dit `"benedictions": true` : après les vagues 5, 10, 15… une carte s'ouvre avec **3 bonus**. On en choisit un (clic, ou touches 1, 2, 3), et il reste jusqu'à la fin de la partie ; on ne peut pas lancer la vague suivante avant d'avoir choisi. Les bénédictions déjà prises s'affichent en petites étiquettes sous la barre du haut (le détail au survol).

**Les mêmes pour tout le monde.** Les 3 propositions sont tirées au hasard, mais avec une graine fixe (celle de la partie, et le numéro de l'étape) : à la même vague, tout le monde voit les mêmes, s'il a fait les mêmes choix avant. Le classement reste juste, et ce qui départage, c'est de bien choisir : un bonus qui va avec sa défense, ou une défense qu'on change pour profiter d'un bonus.

| Bénédiction | Ce qu'elle fait | Famille | Au plus |
|---|---|---|---|
| Feu de joie | les Braise font 35 % de dégâts en plus | un gardien | à volonté |
| Hiver éternel | le gel des Givrine dure 1,5 s de plus et ralentit encore plus (vitesse × 0,8) | un gardien | 2 fois |
| Rochers géants | les rochers des Grondin touchent 2 monstres de plus, explosion plus large (+0,25) | un gardien | 2 fois |
| Œil de lynx | tous les gardiens voient 0,5 case plus loin | tous les gardiens | 2 fois |
| Entraînement | tous les gardiens font 15 % de dégâts en plus | tous les gardiens | à volonté |
| Furie | tous les gardiens tirent 12 % plus vite | tous les gardiens | à volonté |
| Pluie d'étoiles | un Météore de plus à chaque vague | un pouvoir | 1 fois |
| Comète | le Météore touche 0,4 case plus loin | un pouvoir | 2 fois |
| Froid polaire | le Grand froid dure 1 s de plus et se recharge 10 s plus vite | un pouvoir | 2 fois |
| Coffre au trésor | 400 pièces tout de suite (jusqu'à la vague 15) | l'or | à volonté |
| Butin | les monstres rapportent 50 % d'or en plus (jusqu'à la vague 15) | l'or | 1 fois |
| Nouveau socle | un socle de plus sort de terre : une place pour un gardien de plus | un socle | tant qu'il en reste |

Jamais deux bonus d'or à la fois ; un bonus de gardien n'est proposé que si ce gardien est dans le niveau.

**Les socles bonus** sont rangés dans la fiche, à part : `"soclesBonus": [{ "x": 9.25, "y": 6.75 }, …]`. Ils viennent après les autres socles (les numéros des socles normaux ne changent pas) et dorment jusqu'à la bénédiction « Nouveau socle » : pas dessinés, impossibles à cliquer, et le moteur refuse d'y construire. Le décor est calculé avec les socles normaux seulement, pour que l'arène garde exactement les mêmes arbres : la place d'un socle bonus doit donc déjà être libre (pour L'arène pixel, un petit programme a cherché les places loin des arbres et des rochers, près du chemin). Au déblocage, le socle sort de terre (avec un « pop » en 3D), et la terre est peinte dessous.

Les chiffres d'un gardien dans une partie viennent de `ficheDe(etat, type, niveau)` (`src/jeu/benedictions.js`) : sa fiche, avec les bénédictions ; ceux d'un pouvoir, de `pouvoirDe(etat, nom)`. Le moteur, la fiche d'un gardien en partie et le cercle de portée s'en servent.

**Ce que les joueurs imaginaires ont mesuré** (le bon joueur choisit la bénédiction qui va le mieux avec sa défense ; le maladroit prend toujours la première) : avec les bénédictions, le bon joueur passe de 25 à 25-29 vagues. Pour juger chaque bénédiction, un banc d'essai l'a donnée **seule**, à la vague 5 (et 10), sans aucune autre :

- **Pluie d'étoiles** (le Météore 40 % plus vite) prise deux fois faisait gagner 4 vagues à presque tout le monde, et **Froid polaire** (+2 s et 15 s de recharge en moins) jusqu'à 5 vagues à des Givrine : trop forts pour des bonus que tout le monde voudrait. Réglés à 30 %, et +1 s / −10 s.
- **Comète** (un Météore plus gros) ne changeait presque rien : le Météore touche déjà les paquets. Elle l'a rendu aussi plus fort (10 % de vie en plus)… jusqu'à la partie enregistrée de 50 vagues : depuis, Pluie d'étoiles et Comète ont changé avec le Météore (voir plus haut).
- Les bonus de gardien (Feu de joie, Hiver éternel, Rochers géants) rapportent 2 à 4 vagues… mais seulement à une défense qui a ce gardien : c'est voulu.
- L'or et le nouveau socle comptent peu pour un bon joueur, dont la défense est complète vers la vague 14 ; ils aident surtout au début.

### Le héros

Dans les niveaux dont la fiche dit `"heros": true` : un **Grand Gardien**, une fois et demie plus grand qu'un gardien, tout blanc avec une cape rouge, une écharpe dorée et une couronne (en pixel art, il a son propre dessin, plus grand). Il commence sur le chemin, devant le château.

- **Le déplacer** : un clic sur lui (ou sur son bouton, ou la touche H), puis un clic sur la carte : il y marche, à 3 cases par seconde. Un cercle doré à ses pieds le montre toujours ; choisi, il montre aussi la portée de sa frappe, et un petit drapeau marque où il va. Clic droit ou Échap : on le lâche.
- **Arrêté, il frappe le sol** (toutes les 1,1 seconde) : jusqu'à 6 monstres autour de lui (à 1,3 case), les plus proches d'abord. Pas ceux qui volent, ni ceux qui sont sous terre.
- **Il barre la route** : les monstres qui passent tout près de lui (à 0,8 case) avancent deux fois moins vite. Sur le chemin, il les retient sous le feu des gardiens.
- **Pendant qu'il marche, il ne frappe pas et ne barre rien** : le déplacer au bon moment, c'est tout l'art.
- **Il a de la vie.** Les monstres qu'il bloque le frappent : chacun lui enlève quelques points de vie par seconde (`coup` dans sa fiche : 5 pour un Gluant, 4 pour un Filou, 12 pour un Cuirassé), et un monstre renforcé frappe plus fort (son coup × la racine quatrième de sa force). Un monstre gelé ou assommé ne frappe pas. Loin des combats (aucun monstre à moins de 2 cases pendant 2 secondes), il se soigne de 8 % de sa vie par seconde, et entre deux vagues, il se repose. Une barre de vie s'affiche au-dessus de lui quand il est blessé, et il clignote en rouge pendant qu'on le frappe.
- **À zéro, il est K.O. jusqu'à la vague suivante** : couché, gris, des étoiles au-dessus de la tête. Il ne frappe plus, ne barre plus la route, et on ne peut plus le déplacer. Au début de la vague suivante, il se relève avec toute sa vie.
- **Il gagne des niveaux** (jusqu'au 6) : toute la prime des monstres qu'il bat lui-même, et le quart de celle des monstres battus par les gardiens (et les pouvoirs). Son bouton montre son niveau, sa vie et son expérience. Les bénédictions « pour tous les gardiens » (Entraînement, Furie, Œil de lynx) comptent aussi pour lui.

| Niveau | Dégâts d'une frappe | Vie | Expérience | Ce qu'il gagne |
|---|---|---|---|---|
| 1 | 14 | 120 | 0 | |
| 2 | 20 | 160 | 100 | **Peau de pierre** (automatique) : il encaisse deux fois moins de coups, et se soigne deux fois plus vite |
| 3 | 28 | 210 | 350 | |
| 4 | 38 | 270 | 800 | **Onde de choc** (touche O) : les monstres à 2,2 cases sont assommés 2 secondes (ils ne bougent plus) et prennent deux frappes d'un coup ; 20 secondes de recharge |
| 5 | 52 | 340 | 1 400 | |
| 6 | 70 | 420 | 2 100 | **Bond** (touche B) : on vise, et il saute là d'un coup, puis assomme 1 seconde les monstres où il atterrit ; 25 secondes de recharge |

Ses pouvoirs ne marchent que pendant les vagues, et se rechargent pendant les vagues seulement (comme le Grand froid). Avant leur niveau, leurs boutons affichent « niv. 4 » et « niv. 6 » ; quand il les débloque, une bulle l'annonce.

Ses chiffres sont dans `HEROS` (`src/jeu/donnees.js`), ses règles dans le moteur (`envoyerHeros`, `ondeDeChoc`, `sauterHeros`, et `majHeros` à chaque image, avec `encaisser` pour les coups et les soins), ses chiffres du moment dans `ficheDuHeros(etat)`. Un monstre assommé a `assomme` (des secondes), comme un monstre gelé a `gele`.

**Réglé avec deux vraies parties.** Avant, le héros n'avait pas de vie : dans les deux parties enregistrées d'un vrai joueur, il faisait **62 à 99 % des dégâts** des vagues 2 à 15, et il était au niveau 6 dès la vague 7. Le joueur trouvait aussi que ses niveaux ne changeaient pas grand-chose. Maintenant, il frappe moins fort au début (14 au lieu de 28), il faut le surveiller (le soigner, ne pas le laisser tomber), et ses niveaux arrivent tout au long de la partie : avec l'« expert » imaginaire qui le pilote comme ce joueur, il fait encore 53 % des dégâts au début, puis 40 %, puis 15 % ; il est au niveau 4 vers la vague 11 et au niveau 6 entre les vagues 22 et 25. Le héros étant moins fort, la montée des vagues est passée de 22 % à 20 %, pour que le bon joueur imaginaire tienne toujours 26 vagues. Le bon joueur imaginaire, lui, recule son héros pour le soigner quand il a moins d'un tiers de sa vie, lance l'Onde de choc dès que 3 monstres sont autour de lui, et le Bond quand un monstre arrive au château.

**Ce que les joueurs imaginaires ont appris** : au premier essai, le bon joueur postait son héros au cœur de sa défense, là où le plus de gardiens tirent… et il ne frappait presque jamais : les monstres y mouraient avant d'arriver jusqu'à lui (0 frappe pendant 12 vagues, toujours niveau 1). Le bon réflexe, c'est l'inverse : le mettre **là où les monstres passent encore**. Le bon joueur retient où ils sont tombés à la vague d'avant, se poste vers le bout de cette zone, et court devant un monstre qui approche du château. Ainsi, un héros bien déplacé fait gagner 1 à 7 vagues selon la composition, contre 0 à 5 s'il ne bouge jamais.

**Réglé ensuite avec la partie d'un nouveau joueur.** La première vraie partie avec ce héros (Cosmopolite : 26 vagues, 2e du classement) est tombée dans le même piège : son héros était posté entre 22 et 42 % du chemin, juste derrière la zone où les gardiens battaient tout (les monstres mouraient avant 21 % du chemin). Il n'a presque rien battu lui-même : niveau 3 en 26 vagues (358 points d'expérience, quand il en faut 800 pour l'Onde de choc), puis 6 K.O. quand les vagues sont devenues assez fortes pour arriver jusqu'à lui, sur un héros resté trop faible. Et les rejeux ont montré que même les bons joueurs imaginaires n'avaient presque jamais le niveau 4. Depuis, le héros gagne aussi **le quart de la prime des monstres battus par les gardiens** (`partage`, dans sa fiche). Mesuré avec les joueurs imaginaires, et un nouveau joueur imaginaire « comme Cosmopolite » (le héros planté au tiers du chemin) :

| | Onde de choc (niveau 4) | Bond (niveau 6) | Vagues tenues |
|---|---|---|---|
| Bon joueur | vague 10 à 14 (avant : presque jamais) | vague 17 à 24 | 28 en moyenne (avant : 27,3) |
| Héros mal placé | vague 15 (avant : jamais) | rarement | 27 (avant : 26,3) |
| Expert | vague 8 (avant : 10-11) | vague 15 (avant : 16-22) | 34 (comme avant) |

Le partage ne change presque rien à la difficulté (moins d'une vague) : il permet surtout à tout le monde de voir les pouvoirs du héros. (Le quart, plutôt que des niveaux plus faciles : avec des seuils plus bas, les bons joueurs avaient le Bond dès la vague 12, alors que les niveaux devaient rester lents.)

## Le classement en ligne

Les scores du mode survie sont rangés **sur un petit serveur**, pour que tous les joueurs se comparent. Le jeu, lui, reste un site sans serveur sur GitHub Pages : il pose ses questions à une autre adresse, https://petits-gardiens-classement.vercel.app/api/scores.

**Pourquoi un serveur ?** Un site sur GitHub Pages n'est fait que de fichiers : il ne peut rien enregistrer pour tout le monde. Et le jeu ne peut pas écrire lui-même dans une base de données : il faudrait lui donner la clé de la base, et n'importe qui la lirait dans le code du site (puis effacerait tout). Le serveur garde la clé secrète, vérifie chaque score, et lui seul parle à la base.

```
le jeu (navigateur)  ── GET / POST ──▶  la fonction Vercel        ──▶  la base Upstash Redis
patapain18.github.io                    serveur/api/scores.js
                                        à Paris, avec la clé secrète
```

**Le serveur** (`serveur/api/scores.js`) est une **fonction Vercel** : Vercel la réveille à chaque question, puis elle se rendort. Il n'y a pas d'ordinateur allumé en permanence, et c'est gratuit à cette taille. Après un moment sans joueur, le premier appel prend une ou deux secondes : le temps du réveil. C'est pourquoi la carte de l'arène s'affiche tout de suite, avec « Le classement arrive… ».

| Question | Réponse |
|---|---|
| `GET /api/scores?arene=arene-pixel&combien=10` | `{ scores: [{ pseudo, vagues, battus, date }, …], total }` : les meilleurs, dans l'ordre |
| `POST /api/scores` avec `{ arene, pseudo, vagues, battus }` (et `partie`, l'identifiant de la partie enregistrée, s'il y en a un) | `{ place, total, score }` ; ou `{ erreur }`, avec le statut 400 (score refusé), 403 (un autre site) ou 429 (trop d'envois) |

**La base** : Upstash Redis, branchée au projet depuis le tableau de bord de Vercel (onglet Storage). Vercel donne alors à la fonction deux réglages secrets : `KV_REST_API_URL` (l'adresse de la base) et `KV_REST_API_TOKEN` (sa clé). Ils ne sont écrits nulle part dans le code. La fonction parle à la base par de simples requêtes web (l'« API REST » d'Upstash), sans bibliothèque à installer.

Chaque arène est un **ensemble trié** de Redis (la clé `classement:arene-pixel:saison2`) : chaque score y est rangé avec une **note** qui le classe, `vagues × 1 000 000 + monstres battus`. Plus de vagues gagne toujours ; à égalité de vagues, plus de monstres. À égalité parfaite, le premier arrivé reste devant. On garde les 200 meilleurs de chaque arène.

**Les saisons.** Quand les règles changent beaucoup, les vieux scores ne se comparent plus aux nouveaux : le classement repart de zéro, c'est une nouvelle **saison**. Rien n'est effacé : chaque saison a sa clé dans la base (la saison 1 sous `classement:arene-pixel`, la saison 2 sous `classement:arene-pixel:saison2`). Le numéro est écrit à deux endroits, à changer ensemble : `SAISON` dans `serveur/api/scores.js` (où ranger les scores) et dans `src/classement.js` (ce que le jeu affiche, et les scores gardés sur l'ordinateur). La **saison 2** a commencé le 2 octobre 2026, quand le Météore est passé à un par vague (le record de la saison 1 : 55 vagues).

**On ne fait confiance à personne** : n'importe qui peut appeler l'adresse du serveur, avec n'importe quoi dedans. Alors :
- **chaque score est vérifié** : arène connue, pseudo nettoyé comme dans le jeu (de 1 à 16 caractères), nombres entiers et possibles (300 vagues au plus) ;
- **6 envois par minute au plus** depuis une même adresse Internet. Le serveur ne garde pas cette adresse : seulement son empreinte (un « hachage » SHA-256, impossible à retourner), et pendant une minute ;
- **seul le jeu a la permission « CORS »**. Un navigateur ne laisse une page lire les réponses d'un autre site que si celui-ci l'autorise. Le serveur n'autorise que `patapain18.github.io` et le jeu en développement (`localhost:5180` et `localhost:4173`) ; les pages des autres sites sont refusées (403). Mais CORS est une règle des navigateurs : un programme comme `curl` passe outre. C'est pour ça que tout le reste est vérifié quand même ;
- dans le jeu, les pseudos sont affichés avec `textContent`, jamais comme du HTML, et le joueur est prévenu que son pseudo sera visible par tous.

Un joueur peut-il tricher ? Oui, en envoyant un faux score à la main : le serveur ne rejoue pas la partie. Pour un jeu entre amis, c'est accepté, et un score déplacé s'efface à la main (voir « Modérer »).

**Si le serveur ne répond pas** (pas d'Internet, serveur en panne, plus de 6 secondes d'attente), le jeu continue comme avant : le score est gardé dans le navigateur (les 50 meilleurs de chaque arène), et le classement montre les scores de cet ordinateur, avec la mention « Hors ligne ». Si le serveur répond mais refuse le score, le jeu affiche son message et on peut réessayer.

**Mettre le serveur en ligne.** Il a son propre projet Vercel, `petits-gardiens-classement`, et se publie à la main (il change rarement) :

```bash
cd serveur
npx vercel deploy --prod
```

`serveur/vercel.json` fait tourner la fonction à Paris (`cdg1`), près de la base (à Francfort) : chaque question à la base fait l'aller-retour en quelques millisecondes. Il renvoie aussi l'adresse du serveur toute seule (https://petits-gardiens-classement.vercel.app) vers le jeu : sans ça, quelqu'un qui l'ouvre tomberait sur une page « 404 », puisque le serveur n'a pas de page. Le dossier `serveur/.vercel` (le lien avec le projet) et les fichiers `.env*` ne vont jamais sur GitHub.

**Modérer** (effacer un pseudo déplacé) : sur vercel.com, projet `petits-gardiens-classement`, onglet Storage, ouvrir la base dans la console d'Upstash (« Open in Upstash »), puis « Data Browser » : dans la clé `classement:arene-pixel:saison2`, supprimer la ligne. L'arène `essai` sert aux vérifications : le serveur l'accepte, mais le jeu ne l'affiche jamais.

## Les parties enregistrées

Chaque partie est **enregistrée**, pour pouvoir la **revoir** (la page `revoir.html`) et pour **régler le jeu avec de vraies parties** (`npm run parties`), plus seulement avec les joueurs imaginaires.

**On ne filme pas la partie** : une vidéo de 30 minutes serait bien trop lourde. On note seulement les **décisions du joueur**, chacune avec son moment, comme on note une partie d'échecs :

```
[7830, 'lancerMeteore', 8.21, 11.4]   au pas 7 830 : Météore en (8,21 ; 11,4)
[7902, 'envoyerHeros', 12, 7]          au pas 7 902 : le héros part en (12 ; 7)
```

Pour revoir la partie, on la **rejoue** : le moteur refait les mêmes décisions aux mêmes moments, et retrouve exactement la même partie. Une partie de 25 vagues tient en 25 Ko environ.

**Pour que le rejeu soit exact**, au dernier chiffre près, sur n'importe quel ordinateur, il faut trois choses :
- **des pas toujours égaux** : le jeu avance par pas de 1/60 de seconde (`PAS`, dans `moteur.js`), quel que soit l'écran. `main.js` ajoute le temps écoulé à une réserve, qu'il dépense pas par pas. (Avant, chaque image avançait du temps écoulé depuis la précédente, 16,6 ms puis 16,8 ms… impossible à refaire pareil.) Le moteur compte ses pas dans `etat.pas` : c'est l'horloge des enregistrements.
- **un hasard qui part d'une graine** : la même graine redonne le même hasard (`aleatoire.js`). La graine est notée dans l'enregistrement.
- **les mêmes calculs dans tous les navigateurs** : les additions, multiplications, divisions et `Math.sqrt` donnent partout le même résultat, la norme des nombres à virgule (IEEE 754) l'impose. `Math.hypot` et `Math.pow`, non : Safari et Chrome peuvent différer au dernier chiffre, et une différence minuscule suffit à faire diverger une partie au bout de quelques minutes. Le moteur calcule donc ses distances avec `distance()` (`jeu/calcul.js`), et `survie.js` multiplie à la main plutôt qu'avec `Math.pow`. (Vérifié : une partie jouée dans Chrome se rejoue dans Safari avec le même or, les mêmes monstres au même endroit, et le héros à la même place, au dernier chiffre près. Et les parties des joueurs imaginaires n'ont pas changé d'un chiffre.)

**Les contrôles** : à la fin de chaque vague, l'enregistrement note aussi l'or et les monstres battus. Au rejeu, on les compare. S'ils ne collent plus, la partie revue s'écarte de la vraie (le jeu a changé depuis, ou il y a un bug) : on le signale.

**Le trajet d'une partie** :
1. `main.js` fait passer chaque décision du joueur par `agir('construire', socle, type)` : le moteur la fait, et `jeu/enregistrement.js` la note si elle a marché.
2. À la fin de la partie (ou quand on la quitte en route, après au moins une vague), `parties.js` l'envoie au serveur. Elle est d'abord gardée par le navigateur : si l'envoi échoue (pas d'Internet…) ou si l'onglet se ferme, elle part la prochaine fois qu'on ouvre le jeu.
3. Le serveur (`serveur/api/parties.js`, à côté de celui du classement, dans la même base) vérifie tout : des décisions bien formées (un nom, puis au plus 4 nombres possibles ou petits textes), 500 Ko au plus. Il ne garde pas la liste des décisions : quand le jeu en gagne une nouvelle (comme l'Onde de choc et le Bond du héros), il n'y a rien à changer sur le serveur. Il range la partie pour un an, et répond son identifiant.
4. Le score du classement garde cet identifiant : à côté du score, un lien **« Revoir »** ouvre `revoir.html?partie=…`.

| Question | Réponse |
|---|---|
| `POST /api/parties` avec l'enregistrement | `{ id }` ; ou `{ erreur }` (400 partie refusée, 413 trop longue, 429 trop d'envois) |
| `GET /api/parties?id=…` | la partie entière |
| `GET /api/parties?combien=50&niveau=arene-pixel` | les dernières parties, en bref (sans leurs décisions) |

**Revoir une partie** (`revoir.html` et `src/revoir.js`) : la partie est rejouée, et dessinée par le style de son niveau comme en jeu. Pause, vitesse de ×1 à ×8, et une frise (un trait par fin de vague) pour aller où l'on veut ; les flèches du clavier sautent de 10 secondes. Si la partie a été jouée avec une autre version du jeu, la page prévient : les règles ont peut-être changé depuis.

**Régler le jeu : `npm run parties`**. La commande télécharge les dernières parties, les rejoue, et raconte chacune : la défense, les bénédictions choisies (et celles laissées de côté), les Météores, les Grand froid et les combos, le héros (son niveau, ses ordres, ce qu'il a battu), qui a battu les monstres, et la vague perdue. Puis un bilan de toutes les parties.

```bash
npm run parties                      # les 30 dernières parties de l'arène, et un bilan
npm run parties -- --partie <id>     # une partie en détail, vague par vague
npm run parties -- --niveau monde2-3 # celles d'un autre niveau
npm run parties -- --essai           # les parties jouées pendant le développement
```

Chaque partie est rejouée avec **les règles de sa version** : le moteur de l'époque est ressorti de git (`git archive`), dans `parties/.moteurs/`. La version, c'est le commit publié : Vite l'écrit dans le jeu au moment de le fabriquer (`__VERSION__`, dans `vite.config.js`). Les parties téléchargées sont gardées dans `parties/`, qui ne va pas sur GitHub.

**Et si… ?** L'atelier de l'équilibrage rejoue aussi les vraies parties avec d'autres chiffres, avec les mêmes décisions (le lecteur « souple » de `enregistrement.js`) : voir « L'atelier de l'équilibrage ».

**Ce qui est envoyé** : les décisions de la partie, le pseudo du classement (s'il y en a un) et la famille du navigateur (Safari, Chrome…), utile si une partie se rejoue mal. Rien d'autre. Chaque joueur peut refuser dans les Options (« Partager mes parties »), et la carte de début de partie le rappelle. Les parties jouées avec `npm run dev` partent « pour essai » : le serveur les range à part, pour ne pas les mélanger aux vraies.

## Les visites

La page **`visites.html`** montre combien de monde passe par le jeu : les visiteurs de chaque jour (et combien ont lancé une partie), les pages ouvertes, les niveaux joués, les pays, les navigateurs, les systèmes, et les sites d'où viennent les visiteurs, sur 7, 30 ou 90 jours. Aucune autre page n'y mène : c'est la page du créateur du jeu, à garder dans ses favoris (https://patapain18.github.io/petits-gardiens/visites.html). En développement, `visites.html?demo` montre de faux chiffres, pour voir la page sans attendre de visiteurs.

**Pourquoi pas le compteur de Vercel ?** Vercel propose un compteur tout prêt (« Web Analytics »), mais il ne compte que les pages que Vercel envoie lui-même. Le jeu, lui, est envoyé par GitHub Pages. Essayé depuis le site en ligne, l'envoi d'une visite au compteur de Vercel est bloqué par le navigateur (« No 'Access-Control-Allow-Origin' header ») : c'est la règle CORS (voir « Le classement en ligne »), et le compteur de Vercel n'a pas notre site dans sa liste. Notre serveur, si.

**Comment ça compte :**

1. Chaque page appelle `compterVisite('accueil')`, `compterVisite('jeu', niveau)`… (dans `src/compteur.js`), et le jeu appelle `compterPartie(niveau)` quand on lance la première vague d'une partie.
2. Le message part avec `sendBeacon` : sans attendre de réponse, et même si on quitte la page aussitôt. Il contient le nom de la page (et du niveau), et le site d'où vient le visiteur s'il a suivi un lien (juste son nom : `discord.com`).
3. Le serveur (`serveur/api/visites.js`, dans la même base que le classement) ajoute 1 aux compteurs du jour : la page, le niveau, le site d'origine. Pour un visiteur pas encore vu aujourd'hui, il ajoute aussi 1 aux visiteurs, à son pays (Vercel le devine d'après l'adresse Internet), à son navigateur et à son système.

**Compter les visiteurs différents sans savoir qui ils sont.** Le serveur calcule une empreinte du visiteur : un hachage SHA-256 de son adresse Internet, de son navigateur et de la date du jour. Il la donne à un **HyperLogLog** de Redis (`PFADD`), une petite structure qui estime combien de choses différentes on lui a données, sans jamais pouvoir les rendre : elle répond seulement « nouveau » ou « déjà vu ». L'empreinte n'est rangée nulle part, et demain la même personne en aura une autre : impossible de suivre quelqu'un d'un jour à l'autre. La base ne contient donc que des compteurs, effacés au bout de 400 jours. Le revers : quelqu'un qui vient trois jours compte trois visiteurs (la page le dit : « chacun compte une fois par jour »).

**Ce qui ne compte pas** : le développement (`npm run dev`) et le site fabriqué essayé sur l'ordinateur (`localhost`), les robots des moteurs de recherche, les navigateurs pilotés par un programme, et au-delà de 30 envois par minute d'un même visiteur. La page des visites a aussi une case « Ne pas compter mes visites sur cet ordinateur », pour ne pas se compter soi-même (le choix est gardé par le navigateur).

| Question au serveur | Réponse |
|---|---|
| `POST /api/visites` avec `{ page, niveau?, source? }` | compte une visite (seulement depuis le vrai site) |
| `POST /api/visites` avec `{ evenement: 'partie', niveau }` | compte une partie lancée |
| `GET /api/visites?jours=30` | les compteurs des 30 derniers jours (400 au plus), jour par jour |

## Le didacticiel

Le premier niveau de chaque monde apprend à jouer. Tout est dans sa fiche :

```json
"gardiens": { "braise": 1, "givrine": 2, "grondin": 4 },
"didacticiel": {
  "lecons": ["poser", "lancer", "ameliorer"],
  "presenter": ["braise", "gluant", "givrine", "filou", "grondin", "cuirasse"]
}
```

- **`gardiens`** : à partir de quelle vague on peut poser chaque gardien. Ici, Braise dès le début, Givrine une fois la vague 1 terminée, Grondin pour la vague 4. Avant, son bouton est grisé dans le menu (« Arrive à la vague 4 »). Un gardien absent de la liste n'est pas proposé du tout. Sans ce champ, tous les gardiens sont là dès le début.
- **`lecons`** : un encart explique quoi faire, et une flèche dorée montre où cliquer (le meilleur socle, le bouton « Lancer la vague » qui pulse, le gardien à améliorer). Une leçon s'efface dès qu'elle est faite.
- **`presenter`** : une fiche s'ouvre, et **le jeu attend**, quand un gardien arrive ou quand un monstre se montre pour la première fois (la flèche le montre sur la carte). Elle donne son portrait, ses chiffres (« Points de vie : 26, fragile », « Vitesse : très rapide »), une description et un conseil.

Les textes des fiches sont rangés avec les personnages, dans `donnees.js` (`description` et `conseil`). **Le portrait est dessiné par le style actif**, donc dans l'époque du monde : chaque style a une méthode `portrait(apparence)`. En pixel art, c'est le sprite agrandi ; en 3D, un petit « appareil photo » (un second moteur de rendu, sur fond transparent) photographie le personnage.

![Une fiche du didacticiel : nouveau monstre](docs/didacticiel.jpg)

Le didacticiel (`src/didacticiel.js`) ne change aucune règle : à chaque image, il regarde l'état de la partie et affiche ce qu'il faut. **Au monde 2**, le niveau 2-1 présente les 4 nouveaux, et le 2-4 présente seulement le Colosse, quand il arrive (sa carte de début ne dit donc pas « Didacticiel »). Les fiches disent aussi les pouvoirs de chacun (« Vole : les rochers passent dessous », « Libère 3 Gluants en tombant »…), et le chef des monstres a sa fiche à lui : « Le chef des monstres ! », en rouge. **Au monde 3**, c'est pareil : le 3-1 présente les 4 nouveaux, et le 3-4 le Dragon. Une seule nouveauté : un monstre est présenté seulement quand on le voit. Une Taupe sous terre n'a donc sa fiche qu'au moment où elle ressort, sinon la flèche montrerait un tas de terre.

L'éditeur prévient si un personnage arrive sans fiche alors que le joueur ne l'a encore croisé dans **aucun niveau d'avant** de la campagne : il regarde les niveaux joués avant celui-ci (un Gluant au monde 2 est déjà connu, une Gigogne non).

## Les personnages du monde 2

Le monde 2 (l'époque cartoon) arrive avec **deux nouveaux gardiens et trois nouveaux monstres**. L'idée : chaque nouveau monstre punit une défense trop simple. Avec seulement des Grondin, les Voltigeurs passent ; avec seulement des Braise, les petits des Gigognes débordent ; et face au Colosse, il faut de la puissance tout le long du chemin.

![Les 5 personnages du monde 2 dans les 3 styles](docs/monde2-personnages.jpg)

| Personnage | Ce qu'il fait | Ses chiffres |
|---|---|---|
| **Étincelle** (gardien) | Son éclair frappe le monstre le plus avancé, puis saute sur le plus proche qu'il n'a pas encore touché (à moins de 1,6 case), et ainsi de suite, un peu moins fort à chaque saut. Il touche les volants, et il ne rate jamais : il frappe tout de suite. | 90 pièces, 9 dégâts, 3 monstres touchés au niveau 1 (4 aux niveaux 2 et 3) |
| **Bourrasque** (gardien) | Elle envoie un tourbillon qui fait reculer sur le chemin les monstres autour de sa cible : ils doivent refaire du chemin sous le feu des autres gardiens. Presque pas de dégâts. | 75 pièces, recul de 1,2 case au niveau 1 (1,9 au niveau 3) |
| **Voltigeur** (monstre) | Une chauve-souris qui vole au-dessus du chemin. Les tirs en cloche (les rochers du Grondin) ne peuvent ni la viser ni la toucher. Légère : le vent l'emporte une fois et demie plus loin. | 34 points de vie, très rapide |
| **Gigogne** (monstre) | Une grosse maman gelée qui porte ses petits sur le dos. Battue, elle libère 3 Gluants là où elle tombe. | 120 points de vie, lente |
| **Colosse** (le chef) | Un géant de roche et de lave, pour la fin du monde 2. Le vent ne le pousse pas, le gel ne le ralentit qu'à moitié, et battu, il se brise en 2 Cuirassés. Il n'est pas dans le défilé de la carte des époques : il reste une surprise. | 5 500 points de vie, lent, rapporte 100 pièces |

![En pleine partie, en cartoon : l'éclair d'Étincelle, les Voltigeurs au-dessus des Gigognes, un coup de vent](docs/monde2-en-jeu.jpg)

**Les nouvelles règles** (toutes dans `moteur.js`, sans aucun dessin) :
- **Voler** : un monstre `volant` passe au-dessus du chemin ; un gardien qui tire en cloche ne le vise pas, et ses explosions ne le touchent pas.
- **L'éclair** est instantané : rien ne voyage, le moteur calcule tout de suite le trajet (`foudroyer`) et l'envoie aux styles dans un événement `eclair`, qui le dessinent un court instant en zigzag.
- **Le vent** : le monstre poussé glisse en arrière, puis s'accroche au sol 2,5 secondes (un autre coup de vent ne le pousse pas). Et **un monstre ne peut être soufflé que 3 fois** : sans cette règle, des Bourrasques pouvaient renvoyer un monstre au tout début du chemin, hors de portée de tout le monde, pour toujours. La vague ne finissait jamais ! C'est la simulation d'équilibrage qui a trouvé ce piège.
- **Le rocher suit sa cible** : le Grondin vise l'endroit où le monstre sera quand le rocher retombera. Si le vent repousse le monstre pendant le vol, le point de chute recule avec lui ; sinon, Bourrasque ferait rater tous les rochers du Grondin.
- **Les petits** (la Gigogne, le Colosse) naissent là où leur parent est tombé, en faisant un petit bond. Ils passent par la liste d'attente des monstres : l'explosion qui a battu leur parent ne les touche donc pas.
- **Lourd ou léger** : chaque monstre dit combien le vent le fait reculer (`vent`) et combien le gel le ralentit (`gel`). Le Cuirassé, lourd, recule deux fois moins : c'est le seul changement pour un personnage du monde 1, et il ne compte que face à une Bourrasque.

![Étincelle et Bourrasque à leurs trois niveaux](docs/monde2-ameliorations.jpg)

**Ce qui a été vérifié** :
- de petits tests automatiques de chaque règle (le Grondin ignore les volants, la Gigogne libère bien 3 Gluants, le Colosse 2 Cuirassés, le vent ne bloque jamais une vague…) ;
- le monde 1 donne exactement les mêmes résultats d'équilibrage qu'avant ;
- les cinq personnages et leurs pouvoirs ont été joués dans les trois styles.

**Leurs chiffres ont été réglés avec les niveaux du monde 2**, grâce à l'équilibrage :
- **Étincelle** était bien trop forte au début : seule, elle gagnait les niveaux normaux mieux que le bon joueur ! Contre les foules serrées du monde 2, son éclair touchait 5 monstres à chaque coup, et il ne rate jamais. Elle touche maintenant 4 monstres au plus, un peu moins fort à chaque saut : sur un groupe, elle vaut à peu près une Braise, et bien moins sur un monstre seul.
- **Le Colosse** est passé de 1 600 à 5 500 points de vie. À 1 600, tout le monde le battait ; à 6 000, il fallait exactement 2 Givrine pour le ralentir, sinon on perdait presque toujours (trop exigeant : un joueur ne peut pas le deviner). À 5 500, toutes les défenses raisonnables gagnent, et celles qui ne varient pas perdent face à lui.
- **Bourrasque** vaut à peu près une Givrine dans un mélange… à condition d'être posée à côté de gardiens qui tapent fort : seule au milieu de nulle part, elle ne fait que retarder les monstres.

**La galerie des personnages** (`personnages.html`, en bas de la carte des époques) montre chaque personnage dans les trois styles, côte à côte : `?monde=1`, `?monde=nouveaux` (ceux qui ne sont encore dans aucun niveau) ou `?niveau=1` (les gardiens à leur niveau 1) filtrent la liste. C'est là qu'on vérifie un nouveau personnage : on écrit sa fiche une fois, et on voit tout de suite s'il rend bien partout.

## Les personnages du monde 3

Le monde 3 (l'époque voxel, aujourd'hui) arrive avec **deux nouveaux gardiens et trois nouveaux monstres**, sur la même idée qu'au monde 2 : chaque monstre punit une défense trop simple. Les Carapaces se moquent des petits coups ; les Taupes échappent aux gardiens tous regroupés au même endroit ; et le Dragon vole (les rochers du Grondin ne l'atteignent pas) en assommant les gardiens un par un. On les rencontre dans les 4 niveaux du monde 3 (voir la campagne, plus haut), et dans la galerie avec `personnages.html?monde=3`.

![Les 5 personnages du monde 3 dans les 3 styles](docs/monde3-personnages.jpg)

| Personnage | Ce qu'il fait | Ses chiffres |
|---|---|---|
| **Pépite** (gardien) | Une mineuse, avec un casque à lampe et une pioche. Elle ne tire pas : à la fin de chaque vague, elle rapporte de l'or, en plus du bonus de vague. Elle n'a pas de portée (pas de cercle autour d'elle). | 100 pièces, +25 pièces par vague : remboursée en 4 vagues |
| **Prisme** (gardien) | Son cristal accroche un rayon au monstre le plus avancé, et ne le lâche plus tant qu'il peut le toucher, même si d'autres monstres passent devant. Pendant ce temps, le rayon chauffe : il devient plus fort et plus épais. Quand sa cible meurt ou s'éloigne, il en prend une autre et repart de zéro. Il traverse les carapaces. | 110 pièces, 10 dégâts par seconde, jusqu'à 3 fois plus au bout de 2 secondes |
| **Carapace** (monstre) | Une tortue de pierre. Chaque coup perd 5 dégâts sur sa carapace, mais au moins 1 dégât passe toujours. Une Braise de niveau 1 ne lui fait plus que 4 dégâts par boule de feu ; un rocher du Grondin, encore 19. | 90 points de vie, lente |
| **Taupe** (monstre) | Elle plonge sous le chemin 1,6 seconde, ressort 2 secondes, et ainsi de suite. Sous terre, on ne voit qu'un petit tas de terre qui avance une fois et demie plus vite. Personne ne peut la viser, les tirs déjà partis se perdent, et ni le gel, ni l'éclair, ni le vent, ni les explosions ne la touchent. | 50 points de vie |
| **Dragon** (le chef) | Un énorme dragon rouge, pour la fin du monde 3. Il vole, le vent ne le pousse pas, et le gel ne le ralentit qu'à moitié. Toutes les 5 secondes, il crache du feu sur le gardien le plus proche (à moins de 3,2 cases). Ce gardien est assommé 2 secondes : il ne tire plus, des étoiles tournent au-dessus de sa tête, et un Prisme perd sa chauffe. | 3 500 points de vie, lent, rapporte 150 pièces |

![En pleine partie, en voxel : le Dragon crache son feu sur un Prisme, l'autre Prisme brûle une Taupe, les Carapaces avancent](docs/monde3-en-jeu.jpg)

**Les nouvelles règles** (toutes dans `moteur.js`, sans aucun dessin) :
- **La carapace** : tous les coups passent par une seule fonction, `blesser`. Elle enlève l'`armure` du monstre à chaque coup, sauf si le coup « perce » (le rayon). Comme chaque coup perd 5 dégâts, ce sont les petits coups rapides qui perdent le plus : contre une Carapace, il faut de gros coups.
- **Sous terre** : un monstre `cache` ne peut pas être visé (`peutViser`). Les pouvoirs qui touchent « les monstres autour » (le gel, l'éclair, le vent, l'explosion) l'ignorent aussi. Et un tir qui poursuivait la Taupe disparaît quand elle plonge.
- **Le rayon** ne fabrique aucun projectile. À chaque instant, le moteur enlève `degats × dt` points de vie à la cible (`dt` = le temps écoulé depuis l'image précédente), multipliés par la chauffe. Le gardien retient sa cible (`cibleRayon`) et sa chauffe (de 0 à 1) ; avant de chercher le monstre le plus avancé, il regarde si sa cible est encore à portée, et si oui, il la garde. Les styles lisent `tour.rayon` pour dessiner le rayon, qu'ils font grossir avec la chauffe.
- **La récolte** : quand une vague est finie, chaque gardien qui a une `recolte` l'ajoute à l'or, et un « +25 » doré s'envole au-dessus de lui (l'événement `recolte`). Il n'y en a pas après la dernière vague : le niveau est déjà gagné !
- **Le feu** : le Dragon a son compte à rebours (`feu`). À zéro, il choisit le gardien le plus proche parmi ceux qui tirent et ne sont pas déjà assommés : assommer une Pépite ne servirait à rien. S'il n'y a personne à portée, il réessaie une demi-seconde plus tard. Un gardien assommé ne recharge pas pendant ce temps.

![Pépite et Prisme à leurs trois niveaux](docs/monde3-ameliorations.jpg)

Les fiches du didacticiel savent déjà dire leurs pouvoirs : « Rapporte 25 pièces à chaque vague », « Son rayon chauffe : jusqu'à ×3 », « Carapace : chaque coup perd 5 dégâts », « Creuse sous terre : on ne peut pas l'y viser », « Crache du feu : assomme un gardien 2 s ».

**Ce qui a été vérifié** :
- de petits tests automatiques de chaque règle (la carapace enlève bien 5 dégâts mais jamais tout, le rayon la traverse et chauffe, une Taupe sous terre n'est ni visée, ni gelée, ni soufflée, la Pépite rapporte sa récolte à chaque vague, le feu assomme le gardien le plus proche mais jamais une Pépite, le rayon ne lâche pas sa Carapace quand des Filous la doublent…) ;
- les mondes 1 et 2 donnent exactement les mêmes résultats d'équilibrage qu'avant ;
- les cinq personnages et leurs pouvoirs ont été joués dans les trois styles.

**Ce que les essais ont fait changer** :
- **La Taupe ressemblait à un chat gris** : elle utilisait le gabarit du Filou, avec ses oreilles et sa queue touffue. Elle a maintenant son propre gabarit, `taupe` : un corps tout rond, un museau et des pattes roses, une queue minuscule… et des lunettes.
- **Le Dragon devenait rose pâle en cartoon** : un chef prend des coups sans arrêt, donc il clignotait en blanc tout le temps. Sur un chef, le clignotement et le givre sont maintenant trois fois plus discrets (en cartoon et en voxel).
- **En pixel art, un Dragon gelé devenait vert** : le gel faisait tourner toutes les couleurs pour qu'elles deviennent bleues, et un rouge qu'on fait tourner devient vert ! Le filtre de gel passe maintenant tout en sépia d'abord, puis le teinte : n'importe quel monstre gelé devient bleu glace.
- **Les ailes du Dragon** étaient trop grandes et trop à plat en 3D : elles sont plus petites, et relevées même au repos.
- **La carapace était trop forte** : avec 6 d'armure, les gardiens de niveau 1 ne faisaient presque rien. Elle est passée à 5.
- **Le cristal de l'Arc-en-ciel**, en pixel art, cachait sa couronne : il flotte maintenant deux pixels plus haut. Et le rayon du Prisme, trop fin en voxel, a été épaissi.

**Leurs chiffres ont été réglés avec les niveaux du monde 3**, grâce à l'équilibrage :
- **La Taupe** est passée de 70 à 50 points de vie, et reste moins longtemps sous terre (1,6 seconde au lieu de 2,2, et 2 secondes dehors au lieu de 1,8). Cachée plus de la moitié du temps, et rapide sous terre, elle encaissait autant qu'un Cuirassé… pour une prime de 9 pièces.
- **La Carapace** est passée de 140 à 90 points de vie : trois Carapaces dès la vague 2 faisaient un mur, même avec un Prisme.
- **Le Dragon** est passé de 7 000 à 3 500 points de vie, un peu plus lent (0,45 case par seconde au lieu de 0,5), et il crache moins souvent (toutes les 5 secondes au lieu de 4, et le gardien reste assommé 2 secondes au lieu de 2,5). L'équilibrage a montré deux choses : son escorte, plus rapide que lui, passait devant et attirait tous les tirs (les gardiens visent le monstre le plus avancé) ; et son feu laissait le gardien le plus proche assommé plus de la moitié du temps. Dans le niveau, l'escorte part donc devant, et le Dragon arrive en dernier.
- **Le Prisme garde sa cible** : avant, son rayon sautait sans arrêt sur le monstre le plus avancé ; au niveau 3, il était assez fort pour que ça ne le gêne pas, et des Prisme seuls gagnaient le champ des Taupes. Maintenant, il reste accroché à son monstre tant qu'il peut le toucher : encore mieux contre un gros monstre (le Dragon !), mais face à une foule, les autres passent pendant qu'il brûle le premier. Cette règle seule n'a pas suffi (ce sont les énormes foules au sol des dernières vagues, que le Grondin balaie d'un coup, qui arrêtent les Prisme seuls), mais elle donne au Prisme le caractère promis par sa fiche.

## La musique et les bruitages

**Tous les sons sont fabriqués par le code**, avec l'API Web Audio du navigateur : il n'y a pas un seul fichier son dans le projet, donc aucune question de droits d'auteur. Un son, c'est une onde (un oscillateur qui vibre : 440 fois par seconde, c'est la note La) ou du bruit, qui passe dans un filtre (plus sourd ou plus brillant), puis dans une **enveloppe** de volume : il monte (l'attaque), retombe (la décroissance), tient (le maintien) et s'éteint (la relâche).

**Une partition, trois orchestres.** Les musiques des Petits Gardiens sont écrites une seule fois, dans `src/son/partition.js`, comme sur une portée : le nom de la note, son octave, puis sa durée en croches. Chaque mesure a son accord.

```js
'A4:2 C5:2 E5:2 G5:1 E5:1', // la mesure 3 : un La de la 4e octave pendant 2 croches, puis un Do…
accords: ['C', 'G', 'Am', 'F', …] // Do majeur, Sol majeur, La mineur, Fa majeur…
```

Chaque époque le joue avec son orchestre (`src/son/orchestres.js`), comme chaque style dessine les personnages avec ses propres outils :

| Époque | L'orchestre | Ce qu'on entend |
|---|---|---|
| Pixel (années 1990) | une console 8 bits | des ondes carrées « fines » pour la mélodie et les accords joués en arpèges très rapides, une basse triangle qui saute d'octave, un bruit à gros grain pour la batterie, et aucun écho |
| Cartoon (années 2000) | un orchestre de dessin animé | un marimba (les notes longues sont « roulées »), le « oum-pah » d'une basse ronde et d'accords pincés, un wood-block, une petite salle |
| Voxel (aujourd'hui) | piano et nappes | un piano doux qui résonne longtemps, une nappe de cordes, une batterie feutrée qui « balance », une grande salle pleine d'écho |

Un instrument est décrit en données, comme l'apparence d'un personnage : ses ondes, son enveloppe, son filtre. Si on change de style en pleine partie, **la musique change d'époque avec le dessin**.

**Le thème des chefs.** Quand le Colosse ou le Dragon entre sur le chemin, un second thème prend la place du premier. Il est en *la mineur*, plus sombre, et il pique avec le sol dièse de l'accord de Mi, qui « tire » vers le La : c'est la couleur des musiques de méchants. Il va aussi un peu plus vite (128 pulsations par minute au lieu de 116). Sa partie A gronde dans le grave ; sa partie B monte, héroïque, car les gardiens résistent ! Chaque orchestre lui donne un arrangement plus pressant (`arrangerChef`) et une autre voix pour la mélodie (`melodieChef`) :

| Époque | Le thème des chefs |
|---|---|
| Pixel | une carrée plus vibrante pour la mélodie, l'arpège qui saute d'octave, une basse martelée à chaque double croche, la grosse caisse sur chaque temps, un roulement de caisse claire toutes les 4 mesures et une petite note aiguë qui clignote comme une alarme |
| Cartoon | une trompette de méchant, une basse qui marche à chaque temps, des accords pincés à chaque contretemps (une course-poursuite) et des timbales qui roulent |
| Voxel | des cuivres, des cordes qui pulsent à chaque croche, des toms (de gros tambours graves) qui dévalent toutes les 4 mesures, un bourdon sombre et un battement de cœur, comme dans une bande-annonce de film |

La musique passe sur le thème des chefs au début de la mesure suivante, juste après le coup de tonnerre qui annonce le chef. Elle revient au thème principal quand il tombe (sa défaite fait déjà un grand bruit). Le thème des chefs sonne un peu plus fort que le thème principal (environ 1,5 LU : `volumeChef`, propre à chaque orchestre).

**La musique suit la partie.** Le thème a 5 couches, et chacune monte ou descend doucement au début d'une mesure :

| Moment | Ce qui joue |
|---|---|
| Entre les vagues (calme) | les accords, la basse, et la mélodie à moitié |
| Pendant une vague | tout, avec la batterie |
| Un chef des monstres est là | le thème des chefs, avec toutes ses couches (dont la couche inquiétante : l'alarme, les timbales, le bourdon) |
| Pause, ou fiche du didacticiel ouverte | la musique passe « derrière une porte » : un filtre coupe ses aigus |
| Fin de la partie | une petite fanfare (victoire) ou quatre notes qui descendent, comme un trombone triste (défaite) |

Chaque thème dure 16 mesures (environ 33 secondes pour le thème principal, 30 pour celui des chefs), puis recommence.

**Le séquenceur.** Une note doit tomber pile à l'heure, sinon la musique boite. On ne la lance donc pas avec un `setTimeout` (qui peut avoir du retard), mais on la **programme à l'avance** sur l'horloge du son : toutes les 25 millisecondes, `son.js` prépare les notes des 0,15 secondes suivantes, chacune avec son heure exacte.

**Les bruitages.** Chaque événement du moteur a sa recette, écrite une seule fois dans `src/son/effets.js` : le tir de chaque gardien, l'éclair, le vent, l'explosion, le coup qui ricoche sur une carapace, un monstre battu (plus il est solide, plus c'est grave), la Taupe qui plonge et qui ressort, les petits qui sortent, le feu du Dragon, la récolte de la Pépite, poser, améliorer et revendre un gardien, une vague lancée, un chef qui arrive. La recette utilise les instruments de l'époque : le même tir de Braise sonne « console » en pixel et feutré, avec de l'écho, en voxel. Les rayons du Prisme font un bourdonnement continu, qui monte quand ils chauffent. Et chaque son vient de l'endroit de la carte où il se passe (à gauche ou à droite).

Un même bruitage ne peut pas jouer plus de 2 à 4 fois en même temps (`LIMITES`, dans `effets.js`) : sans ça, vingt Gluants battus d'un seul rocher feraient vingt sons d'un coup.

**Les réglages.** La fenêtre des options (voir plus bas) a deux curseurs (la musique, les bruitages) et une case pour tout couper (ou la touche M). Au départ : la musique à 50 %, les bruitages à 100 %. Les navigateurs interdisent de faire du bruit avant que le joueur ait cliqué : tout commence au premier clic (sur « Jouer »). Quand l'onglet est caché, le son se met en pause.

**Comment on a vérifié, sans haut-parleur.** Web Audio sait aussi calculer le son sans le jouer (un contexte « hors ligne »). On a ainsi enregistré le thème de chaque orchestre, puis analysé les fichiers :
- **la mélodie est juste** : la note entendue à chaque départ de note est celle de la partition (thème principal : 60 sur 60 en pixel et en cartoon ; en voxel, deux notes sont lues une octave trop haut, parce que la précédente résonne encore. Thème des chefs : 74 sur 74 dans les trois époques) ;
- **le volume est le même dans les trois époques** : environ −19 LUFS pendant une vague et −21 au calme (le LUFS mesure le volume tel que l'oreille l'entend), et environ 1,5 de plus pour le thème des chefs. Pour y arriver, chaque orchestre a son propre volume ;
- **les bruitages sont équilibrés** : la plupart sonnent aussi fort dans les trois époques, à 3 dB près. Le bruit « console » du pixel, plus puissant que le bruit blanc, a été baissé, et les bruits du cartoon et du voxel ont été poussés (`forceBruit`) ;
- **rien ne sature**.

Mais seule une oreille peut dire si c'est agréable : c'est au joueur de juger.

**La salle des sons** (`sons.html`, en bas de la carte des époques) : le thème principal (au calme ou pendant une vague), le thème des chefs, les musiques de fin et tous les bruitages, dans les trois époques côte à côte. C'est là qu'on écoute un nouveau son : on écrit sa recette une fois, et on l'entend tout de suite partout.

## L'écran d'options

Le bouton **Options** (en haut à droite de la carte des époques, et en bas à droite dans le jeu, à la place de l'ancien bouton « Son ») ouvre la même fenêtre partout. Chaque réglage s'applique et se garde tout de suite : il n'y a pas de bouton « Enregistrer ». Dans le jeu, la partie se met en pause tant que la fenêtre est ouverte.

| Section | Réglage | Ce qu'il fait |
|---|---|---|
| Le son | Musique, Bruitages | deux curseurs, de 0 à 100 % |
| | Couper tout le son | comme la touche M en jeu |
| Le jeu | Vitesse du jeu | ×1, ×2 ou ×3. Le bouton « Vitesse », en jeu, la change aussi : le jeu se souvient de la dernière |
| | Fiches des nouveaux personnages | « À chaque partie », ou « Seulement la première fois » : pour rejouer un niveau sans revoir les fiches et les leçons qu'on connaît déjà |
| L'affichage | Qualité graphique | « Complète », ou « Économe » pour les ordinateurs plus lents (voir plus bas) |
| | Taille des boutons et des textes du jeu | « Grande » agrandit tout le texte du jeu d'un quart (pratique en pixel art, où il est tout petit) |
| | Caméra du style voxel | la vue de jeu ou la vue cinéma ; les boutons du jeu la changent aussi |
| La progression | Effacer la progression | seulement sur la carte des époques : oublie les niveaux gagnés et les fiches déjà vues. Une confirmation est demandée, car on ne peut pas revenir en arrière |

**Comment c'est fait :**
- **`src/options.js`** garde toutes les options sous une seule clé du navigateur (`pg-options`), avec leurs valeurs de base. Chaque valeur est vérifiée : une valeur inconnue (une vieille version, un fichier modifié à la main) est remplacée par celle de base, pour que le jeu ne casse jamais. Les volumes réglés avant l'écran d'options (l'ancienne clé `pg-son`) sont repris.
- Chacun peut **s'abonner** aux changements (`quandOptionsChangent`) : le son ajuste ses volumes, le jeu sa vitesse, sa caméra, la taille de son interface… Ainsi, la touche M, le bouton « Vitesse » et la fenêtre restent toujours d'accord : ils changent tous la même option, et tout le monde suit.
- **`src/fenetre-options.js`** fabrique la fenêtre à partir d'une liste en données (`SECTIONS`) : pour ajouter une option, on l'ajoute à `options.js` et à cette liste. C'est un élément `<dialog>` du navigateur : une fenêtre par-dessus la page, qui se ferme avec Échap et garde le clavier à l'intérieur. Les choix sont de vrais boutons radio (les flèches du clavier passent de l'un à l'autre), dessinés comme les boutons du jeu.
- Dans le jeu, la fenêtre prend la police et les couleurs du style choisi (les variables de `style.css`) ; sur la carte des époques, elle a ses couleurs de secours.

**La qualité « économe ».** Quand elle change en pleine partie, le style est refait avec la nouvelle qualité.

| Style | Ce que l'économe enlève |
|---|---|
| Voxel | l'image n'est plus « Retina » (sur un écran très fin, ça fait 4 fois moins de pixels à calculer), les ombres sont moins détaillées (2048 au lieu de 4096), plus d'anticrénelage ni de halo de lumière |
| Cartoon | l'image n'est plus « Retina », pas d'anticrénelage, des ombres moins détaillées |
| Pixel | rien : il est déjà très léger |

**« Seulement la première fois ».** Quand une fiche est fermée ou une leçon réussie, `progression.js` le retient (la liste `vus`). Avec cette option, le didacticiel saute ce qui est déjà dans la liste. La liste est remplie même avec l'option « À chaque partie » : si on change d'avis, le jeu sait déjà ce qu'on a vu.

## Les lumières et les animations

Chaque monde a reçu plus de vie (du vent, de l'eau qui bouge, des oiseaux…) et des lumières et des ombres mieux réglées. Chaque changement a été vérifié dans **l'atelier des lumières**, pour qu'aucune lumière ne soit trop forte.

### L'atelier des lumières

La page `lumieres.html` (un outil d'atelier, comme l'éditeur ou la galerie) montre un niveau dans un style et une ambiance, pendant qu'**une partie se joue toute seule** : chaque socle reçoit un gardien (au niveau 1, 2 ou 3 selon le socle), les vagues s'enchaînent, et on voit les tirs, les explosions, les monstres battus. À droite, **des curseurs** pour régler l'ambiance affichée, appliqués tout de suite.

Pour ne pas se fier seulement à ses yeux, l'atelier mesure l'image (réduite à 640 pixels de large) :

| Mesure | Ce qu'elle veut dire |
|---|---|
| Zones brûlées | la part de l'image presque blanche (luminosité au-dessus de 0,93) : là, on ne voit plus aucun détail. Les **zébrures** rouges les montrent sur l'image, comme sur l'écran d'un appareil photo |
| Points brûlés | les taches presque blanches d'au moins 4 pixels : une lumière trop forte, même petite |
| Zones bouchées | la part presque noire (en dessous de 0,035) |
| Luminosité moyenne | de 0 (noir) à 1 (blanc) |
| Une image | le temps de calcul d'une image, en millisecondes (au-delà de 16 ms, on passe sous 60 images par seconde) |

La luminosité d'un pixel, c'est 0,21 × rouge + 0,72 × vert + 0,07 × bleu : l'œil voit le vert bien plus clair que le bleu.

- **Planche des 4 ambiances** : les quatre moments de la journée côte à côte, avec leurs mesures et leurs zébrures, dans `captures/atelier-<niveau>-<style>.jpg`. La partie est toujours arrêtée au même moment (la graine du hasard est fixe : on cherche d'abord le moment où il y a le plus de monstres à l'écran, puis on rejoue la partie jusque-là), pour comparer d'une fois sur l'autre.
- **Tour complet** : une planche pour chaque niveau, et un tableau de toutes les mesures.
- **Enregistrer dans le jeu** (avec `npm run dev`) : les réglages sont écrits dans `src/rendus/ambiances.json`, après avoir été revérifiés par le serveur de développement (les mêmes réglages, des nombres, des couleurs « #rrggbb »). Ce fichier range les ambiances des trois styles : ce sont des données, comme les fiches de niveau.

Le premier tour complet a trouvé ce que l'œil devinait : aucune grande zone brûlée, mais des nuits du voxel bien trop sombres (jusqu'à 39 % de l'image presque noire), ce qui fait paraître les lumières trop fortes, et l'étang du niveau 3-1 qui renvoyait le soleil de midi comme un miroir.

### Les lumières du jeu, partagées par les trois styles

`src/rendus/lumieres.js` fait, à chaque image, la liste des lumières allumées : les lanternes et la porte du château (la nuit), les boules de feu, la cible du rayon du Prisme, la flamme sur la tête de Braise, la lampe du casque de la Pépite, la lave du Colosse… et des **éclats** qui ne durent qu'un instant : une explosion, un éclair, un monstre battu, une amélioration. Une lumière, c'est une place, une hauteur, un rayon, une couleur et une force. Chaque style la dessine à sa façon, et chaque ambiance dit à quel point on la voit (`lumieres` : presque rien en plein midi, tout la nuit).

### Le monde 1 (pixel)

- **Des ombres portées qui suivent le soleil.** Chaque arbre, rocher, lanterne et personnage a une vraie ombre : sa silhouette, couchée sur le sol du côté opposé au soleil. Le `transform` du Canvas fait le travail : un pixel à la hauteur *h* au-dessus du pied du sprite est décalé de *h* × `dx` vers la droite et de *h* × `dy` vers le bas. Le sprite est donc retourné, penché et écrasé. Longues vers la droite à l'heure dorée, courtes à midi, vers la gauche à l'aube. Toutes les ombres vont dans un même calque, posé d'un coup : là où deux ombres se croisent, ce n'est pas plus sombre. Celles du décor sont peintes une fois pour toutes (et repeintes quand l'ambiance change) ; le château, vu de trois quarts, a une ombre « balayée » sur sa hauteur.
- **Le vent.** Des rafales traversent la carte de gauche à droite : chaque arbre a trois images (penché à gauche, droit, penché à droite), comme les touffes d'herbe et les fleurs qui poussent maintenant partout. Un arbre penche quand la rafale passe sur lui, puis se redresse. Le vent est plus fort à l'heure dorée, presque nul la nuit.
- **L'eau qui bouge.** Les pixels d'eau sont repérés une fois, puis repeints 8 fois par seconde : des vaguelettes, un liseré d'écume qui tourne le long du bord, de petits reflets. La nuit, l'eau prend des couleurs plus sombres (sous la lumière bleue de la nuit, les étangs brillaient comme des lampes).
- **Les ombres des nuages** glissent sur le sol : un grand motif de taches au bord tramé, qui se répète sans couture tous les 256 pixels.
- **La vie autour** : des volées d'oiseaux (avec leur ombre), des papillons qui volettent de fleur en fleur, des feuilles d'automne qui tombent en se balançant, les drapeaux du château qui flottent, les gardiens qui clignent des yeux et reculent d'un pixel quand ils tirent, un petit nuage « pouf » quand un monstre est battu.
- **Des lumières en pixels.** Chaque lumière pose un halo en quatre paliers, avec du tramage entre eux (comme les jeux 16 bits), ajouté à l'image (« lighter »). La nuit, la flamme de chaque Braise éclaire le sol autour d'elle, et un éclair d'Étincelle illumine un instant toute la carte.

Le *tramage* (« dithering ») sert partout : une grille de seuils qui alterne d'un pixel à l'autre. Un pixel est peint si sa valeur dépasse le seuil de sa case. On fait ainsi des dégradés avec très peu de couleurs.

### La carte des lumières (les deux styles 3D)

Three.js sait éclairer avec des lampes (`PointLight`), mais chacune coûte cher : chaque pixel de l'écran refait le calcul pour chaque lampe. Avec dix lanternes, des boules de feu et des explosions, le jeu ralentirait. L'astuce, puisqu'on regarde la carte d'en haut (`src/rendus/carte-lumieres.js`) : à chaque image, on peint toutes les lumières comme des taches de couleur dans une petite image qui couvre la carte, vue de dessus (8 pixels par case). Chaque matériau « branché » ajoute à sa couleur la lumière de cette image, à l'endroit où il se trouve. Une seule lecture d'image par pixel, quel que soit le nombre de lumières. Et comme une image ne dépasse jamais le blanc, même vingt lumières au même endroit ne peuvent pas éblouir.

Pour « brancher » un matériau, on modifie son programme (son *shader*) juste avant qu'il soit fabriqué (`onBeforeCompile`) : le sommet note sa place dans le monde, et le pixel va lire la carte à cette place. Deux pièges rencontrés :
- un canvas devient une texture retournée de haut en bas (`flipY`), comme une photo : les flaques de lumière apparaissaient en miroir, loin des lanternes ;
- Three.js range les programmes fabriqués sous une « clé » : deux matériaux modifiés différemment mais avec la même clé se partageaient le même programme. Chaque modification ajoute donc sa part à la clé (c'est aussi ce qui donnait la même épaisseur aux deux contours du cartoon).

### Le monde 2 (cartoon)

- **Une vraie nuit**, bleue et sombre, où les lanternes, la porte du château, les boules de feu et les explosions posent des **flaques de lumière en aplats** (cinq paliers, comme le reste du dessin). La lumière est découpée selon sa force, pas couleur par couleur : sinon la teinte changeait d'un palier à l'autre, en anneaux rouges et verts. La flamme de Braise et le cristal du Prisme éclairent leur gardien.
- **Le vent** : les feuillages (avec leur contour et leur ombre) et les touffes d'herbe bougent par rafales qui traversent la carte. C'est le programme de chaque feuillage qui décale le haut de la boule, selon sa place sur la carte et le temps.
- **L'eau de dessin animé** : un programme à elle, avec deux aplats de bleu, des traits de vaguelettes qui ondulent, une bande d'écume au bord dont la largeur ondule, des reflets qui scintillent, et des nénuphars. L'écume est posée au bord *visible* : le sol de la berge recouvre le bord du disque d'eau.
- **Des moulins à vent** dans les coins libres de la carte (au plus deux, loin du chemin, des socles, du château et des étangs), dont les ailes tournent plus vite quand le vent souffle fort.
- **Les ombres des nuages** qui glissent sur le sol, calculées par le programme du sol ; une **ombre douce au pied de chaque arbre** et de chaque rocher, peinte dans la texture du sol (sous un feuillage, la lumière du ciel arrive moins) ; un **liseré de lumière** sur le bord des personnages et des feuillages, de la couleur du ciel (le *rim light* des dessins animés).
- **La vie autour** : des volées d'oiseaux (leur ombre passe sur le sol), des papillons qui se posent de fleur en fleur, des feuilles d'automne qui tombent en tournoyant, des lucioles la nuit.
- **Les personnages** : les monstres arrivent avec un petit « pop » élastique et s'écrasent en disparaissant quand ils sont battus (`Synchro` sait maintenant faire partir un objet en douceur) ; les gardiens reculent quand ils tirent et sautent de joie quand une vague est repoussée.

### Le monde 3 (voxel)

- **L'occlusion ambiante, comme dans Minecraft.** Le monde était fait de 50 000 cubes entiers, dont la plupart des faces étaient collées à un voisin, donc invisibles. Il est maintenant assemblé face par face (`fabriquerBlocs`) : on ne garde que les faces visibles, rangées par matériau, soit quelques grands objets. Et chaque coin de face reçoit une clarté : on regarde les trois cubes qui touchent ce coin, devant la face ; plus il y en a, moins la lumière du ciel arrive, plus le coin est sombre. Au pied d'un mur, sous un arbre, au bord d'un étang, la lumière se pose tout en douceur. Bonus : une image se calcule plus vite (environ 5,5 ms au lieu de 7,5 en pleine bataille).
- **Les feuilles ondulent** (comme dans les *shaders* de Minecraft) : chaque coin bouge un tout petit peu selon sa place et le temps ; deux blocs voisins partagent leurs coins, donc bougent ensemble sans se décoller.
- **Des nuits lisibles et des lumières qui n'éblouissent plus.** L'atelier mesurait jusqu'à 39 % d'image presque noire la nuit ; c'est maintenant entre 6 et 9 %, avec un clair de lune plus fort, un halo (*bloom*) plus discret, les lanternes et les repères dorés des socles moins brillants, et les flaques de lumière de la carte des lumières (qui remplacent les lampes `PointLight`).
- **L'eau** : une texture en pixels qui glisse doucement, et un peu plus rugueuse. Trop lisse, elle renvoyait le soleil de midi comme un miroir (la seule vraie tache brûlée trouvée par l'atelier, sur le niveau 3-1).
- **La vie autour** : des feuilles d'automne qui tombent des arbres roux, un poisson qui saute de temps en temps hors d'un étang (avec ses éclaboussures), des volées d'oiseaux et leur ombre, des papillons.
- **Les personnages** : les mêmes animations qu'en cartoon (« pop », écrasement, recul, saut de joie), et les gardiens clignent des yeux.

Au passage, un vieux défaut est réparé : les têtes et les tiges des fleurs avaient la même « clé de programme », donc Three.js donnait à l'une le programme de l'autre.

Le tour complet final de l'atelier : 168 images (15 niveaux, dans les trois styles, aux quatre moments de la journée), sans aucune zone brûlée de taille notable (au plus 0,1 % de l'image, de petits reflets blancs voulus du pixel art).

## Les textures

### Des recettes plutôt que des dessins

Dans le style voxel, chaque texture fait **16 × 16 pixels**, comme dans Minecraft (le pixel art utilise les mêmes recettes, case par case, et le cartoon des recettes peintes au pinceau : voir plus bas). Personne ne les dessine à la main : chacune est fabriquée par le code d'après une **recette**, rangée dans `src/rendus/textures.json` (des données, comme les fiches de niveau). Une recette a trois parties :

- **les rampes** : des listes de couleurs, si possible rangées du plus sombre au plus clair (« vert » : cinq verts, « terre » : quatre bruns…) ;
- **les couches**, posées l'une après l'autre : d'abord un fond, puis des taches, des joints, des brins d'herbe, la lumière d'en haut… ;
- **les variantes**, et le droit de **tourner** ou de **retourner** la texture d'un bloc à l'autre (sur un grand sol, l'œil ne voit plus que c'est toujours la même image).

Par exemple, l'herbe. Au début, chaque pixel prenait un des cinq verts au hasard (une seule couche) ; la voici maintenant : un fond de verts très proches, des taches claires et des taches sombres de 2 pixels, une douzaine de brins (un pixel sombre, la pointe éclairée au-dessus), un peu de lumière d'en haut, et 4 variantes que chaque bloc peut tourner d'un quart de tour.

```json
"herbe": {
  "rampes": {
    "base": ["#66aa3b", "#6aad3d", "#6db040"],
    "clair": ["#76b947", "#7cbd4b"],
    "sombre": ["#5e9f36", "#599932"],
    "brins": ["#4d8b2d", "#8bcc59"]
  },
  "couches": [
    { "type": "hasard", "rampe": "base", "part": 1 },
    { "type": "taches", "rampe": "clair", "taille": 2, "seuil": 0.6, "haut": 0 },
    { "type": "taches", "rampe": "sombre", "taille": 2, "seuil": 0.64, "haut": 0 },
    { "type": "brins", "rampe": "brins", "nombre": 12, "longueur": 1 },
    { "type": "relief", "taille": 3, "force": 0.05, "seuil": 0.04 }
  ],
  "variantes": 4,
  "tourner": true,
  "miroir": false
}
```

| Couche | Ce qu'elle fait |
|---|---|
| Couleurs au hasard (`hasard`) | chaque pixel (ou une part des pixels) prend une couleur au hasard dans la rampe |
| Frange en haut (`frange`) | une bande en haut, plus ou moins haute selon la colonne : l'herbe qui déborde sur le côté d'un bloc, avec son ombre sur la terre |
| Taches (`taches`) | des taches douces, qui se raccordent d'un bloc à l'autre (un « bruit » qui fait le tour) |
| Joints de briques (`briques`) | des briques décalées d'une rangée à l'autre, chacune avec sa nuance et son relief (le haut et la gauche éclairés) : le château, les tuiles du toit |
| Planches (`lames`) | des planches en rangées, chacune avec sa nuance et un raccord placé au hasard |
| Rangées, Colonnes, Traits en biais | des lignes régulières, et l'ancienne écorce du bouleau |
| Traits (`traits`) | de petits traits debout ou couchés : les fibres du tronc, le fil du bois, les marques noires du bouleau, les reflets de l'eau |
| Cadre (`bord`), Halo (`halo`) | le cadre de la lanterne, et sa lumière plus forte au centre |
| Trous (`trous`) | des pixels transparents, isolés ou groupés : les feuilles laissent passer la lumière |
| Vagues (`vagues`), Dégradé (`degrade`) | des vaguelettes qui font le tour ; le haut plus clair que le bas |
| Lumière d'en haut (`relief`) | le haut de chaque bosse s'éclaire, le bas s'assombrit, comme sous le soleil |
| Brins, Cailloux, Fissures | des brins d'herbe à la pointe éclairée, de petits cailloux avec leur ombre, des fissures qui serpentent |
| Touffes en V (`touffes`) | de petites touffes d'herbe comme dans les jeux 16 bits : deux brins qui s'écartent d'un même pied, la pointe éclairée (ajoutée pour le pixel art) |

Le code est dans `src/rendus/recettes.js`. Il ne connaît ni Three.js ni le navigateur : il remplit un tableau de pixels, que le style voxel transforme en textures. Quelques idées à retenir :

- **chaque couche a son propre hasard** (sa graine vient du nom de la texture, de la variante et du numéro de la couche) : quand on règle une couche, les autres ne bougent pas ;
- **les variantes se raccordent entre elles, même tournées.** Les taches et la lumière d'en haut viennent d'un bruit calculé sur une grille de valeurs au hasard. Les valeurs du bord de la grille sont communes à toutes les variantes, et symétriques : le bord se lit pareil dans les deux sens, et pareil en colonne qu'en rangée (on regarde le bruit au centre de chaque pixel, pour que le quart de tour tombe juste). Deux variantes quelconques, tournées n'importe comment, se touchent donc sans couture ; seul le milieu change d'une variante à l'autre ;
- **un réglage absent prend la valeur d'une couche neuve** : un vieux fichier de recettes se fabrique toujours, même quand une couche a gagné un réglage ;
- **l'aspect de chaque face** (sa variante, ses quarts de tour, son miroir) vient d'un « hachage » de sa place : la même face a toujours le même aspect, dans le jeu comme dans l'atelier. Chaque variante a sa propre texture, et ce sont les coordonnées de texture des coins de la face qui tournent (`placerUV`) ;
- **le décor voxel repart toujours du même hasard** (les fleurs, la teinte des blocs) : deux rendus du même niveau sont identiques, et une comparaison avant / après ne montre que ce qui a vraiment changé ;
- **l'eau des étangs** est une seule grande image posée « dans le monde » : elle est assemblée sur 4 × 4 blocs avec les variantes tournées de sa texture (`peindreGrandSol`, dans `voxel.js`). Avec une image de 16 pixels par bloc, le même motif revenait à chaque bloc ; il ne revient plus que tous les 4.

Le passage aux recettes n'a pas changé l'allure du jeu : les recettes refont les mêmes textures qu'avant (même couleur moyenne à l'écran, vérifiée sur deux niveaux). Seules les petites fleurs ont changé de place, puisque le hasard du décor repart maintenant de sa graine.

### L'atelier des textures

La page `textures.html` (un outil d'atelier, à côté de l'atelier des lumières) sert à **voir** les textures, puis à les régler. On y choisit d'abord **le style** (voxel, cartoon ou pixel art) :

- **la bande des textures** du style, rangées par famille (pour le voxel : le sol, les arbres et le bois, le château et les objets, les personnages). Une pastille dorée marque celles qu'on a modifiées ;
- **un vrai niveau**, dans le style choisi : on choisit le niveau, l'ambiance, et la vue (la vue de jeu, le cinéma en voxel, ou **de près** : le chemin, un socle, le château, un arbre, l'étang). Le cartoon resserre sa caméra sur le point regardé ; le pixel art, qui n'a pas de caméra, agrandit son image 3 fois, sans flou. L'atelier dit combien de pixels d'écran fait un pixel de texture au centre de la vue (en voxel : environ 1 en vue de jeu, 9 de près) ;
- **les gros plans** de la texture choisie, avant (le fichier) et après (tes réglages), et **en grand** : un sol de 4 × 4 blocs (ou cases) avec ses variantes tournées, ou, pour le cartoon, un morceau de toile de 6,4 × 6,4 cases où la matière a sa forme habituelle (un chemin qui tourne, des socles, un étang, la cour) ;
- **la recette**, avec des curseurs : les couleurs de chaque rampe (et des boutons + et − pour en ajouter), les couches (on les règle, on les déplace, on en retire, on en ajoute), les variantes, les tours et le miroir. Tout s'applique tout de suite, même dans la 3D ; seul un changement de variantes oblige à reconstruire le niveau (une demi-seconde) ;
- **« Montrer l'avant »** : la 3D avec les recettes du fichier, pour comparer.

Pour ne pas se fier seulement à ses yeux, l'atelier mesure la texture choisie (survoler une mesure dit ce qu'elle veut dire) :

| Mesure | Ce qu'elle veut dire |
|---|---|
| Taches | la ressemblance entre un pixel et son voisin : 0, chaque pixel est tiré au hasard, comme une télé sans signal ; plus haut, les pixels se regroupent en taches ; 1, un aplat |
| Coutures | sur un grand sol, l'écart entre deux pixels de part et d'autre du bord d'un bloc, comparé à l'écart à l'intérieur : vers 1, on ne voit pas les bords des blocs ; plus haut, un quadrillage |
| Aspects différents | combien d'aspects un bloc peut prendre (variantes × tours × miroir) : à 1, l'œil voit la répétition |
| Couleurs, clarté moyenne | combien de couleurs différentes ; la clarté, de 0 (noir) à 1 (blanc) |
| Chemin / herbe | l'écart de clarté entre le chemin et l'herbe : le chemin doit se détacher d'un coup d'œil |

Les alertes ne concernent que les sols vus de dessus (l'herbe, la terre, le chemin, le sable, la neige, la pierre), là où le bruit, les coutures et la répétition se voient le plus.

- **Planche des textures** : toutes les textures du style en gros plan (avant, après) et en grand, avec leurs mesures, dans `captures/textures-planche-<style>.png`.
- **Banc d'essai** : le niveau sous les quatre ambiances, de loin et de près (le chemin, un socle, un arbre en voxel, l'étang dans les deux autres styles), dans `captures/textures-banc-<style>-<niveau>.jpg`.
- **Avant / après** : les mêmes vues avec les recettes du fichier, puis les tiennes, dans `captures/textures-avant-apres-<style>-<niveau>.jpg`.
- **Enregistrer dans le jeu** (avec `npm run dev`) : les recettes des trois styles sont écrites dans `src/rendus/textures.json`, après avoir été revérifiées par le serveur de développement (`format-textures.js` : les mêmes textures, des couches connues du bon moteur, des réglages dans leurs bornes, des couleurs « #rrggbb »).

### Ce que l'atelier a montré tout de suite

- **Les sols sont du bruit pur** : la mesure des taches vaut 0,07 pour l'herbe, 0,01 pour le chemin, autour de 0 pour la terre, la pierre et le sable. De près, ça ressemble à une télé sans signal ; une vraie texture de pixel art a des taches, une lumière qui vient d'en haut, des détails.
- **Tous les blocs ont la même image** : de près, les points sombres du chemin s'alignent en rangées. Le grand sol montre aussi que l'eau (des diagonales) et la pierre moussue (des losanges) se répètent d'un bloc à l'autre.
- **Un premier essai** (des taches, des brins, des cailloux, quatre variantes tournées) fait passer les taches de l'herbe de 0,07 à 0,36… mais les coutures de 1,1 à 1,6 : on voit alors le quadrillage des blocs. Exactement le genre de défaut que l'œil rate sur une image du jeu entier.
- **Le chemin se détache à peine de l'herbe** (un écart de clarté de 0,08).

C'est ce qui a été corrigé ensuite.

### Les nouvelles textures du voxel

Les 19 recettes ont été redessinées une famille après l'autre (le sol, l'eau, le bois, le château), avec un aperçu qui fabrique en une seconde une planche avant / après, puis vérifiées dans l'atelier, en 3D, sur les cinq niveaux voxel.

**La leçon principale** (celle de Minecraft) : avec de grosses taches, même sans couture, l'œil voit le motif revenir en grille. Des taches fines (2 pixels) et des quarts de tour au hasard donnent un sol naturel. Les grandes variations, elles, viennent de la teinte de chaque bloc, déjà calculée par le style voxel. Les côtés de blocs, qui ont un sens (la frange d'herbe en haut, les planches, les briques), ne tournent pas.

| Mesure | Avant | Après |
|---|---|---|
| Taches de l'herbe (0 = une télé sans signal) | 0,07 | 0,25 |
| Taches du chemin, de la terre, de la pierre | 0,01 ; −0,05 ; −0,01 | 0,32 ; 0,35 ; 0,44 |
| Coutures des sols (vers 1 : on ne voit pas les bords) | 0,9 à 1,2 | 0,6 à 1,05 |
| Aspects différents d'un bloc de sol | 1 | 16 |
| Écart de clarté chemin / herbe | 0,084 | 0,120 |

**Les ambiances n'ont pas bougé.** Elles avaient été réglées avec les anciennes textures : chaque texture garde donc sa couleur moyenne, à 0,03 près (le chemin est le seul à s'éclaircir vraiment, exprès, pour mieux se détacher de l'herbe). Les 20 images de l'atelier des lumières (5 niveaux voxel, 4 ambiances) ont été remesurées avant et après : la luminosité moyenne bouge d'au plus 0,004, les zones brûlées et bouchées ne bougent pas, et les points brûlés baissent (45 au lieu de 53). Au passage, l'atelier a trouvé deux fleurs blanches qui brûlaient à midi : leurs tiges et leurs têtes utilisent la texture « grain » des personnages, d'abord un poil trop claire, corrigée.

**Ce qui se voit** : en vue de jeu, le changement est discret (plus propre, le chemin ressort mieux) ; de près (la caméra « Cinéma »), le chemin devient du sable tassé avec ses cailloux, l'herbe a des brins, les feuilles des trous groupés comme un vrai feuillage, les briques une nuance et un relief chacune, le toit des tuiles, et l'eau des reflets irréguliers au lieu de rangées qui se répètent.

### Le pixel art : les mêmes recettes, case par case

Le sol du pixel art était peint pixel par pixel avec quelques couleurs fixes : trois verts en grandes taches pour l'herbe, plus des points isolés tirés au hasard (le même « sel et poivre » sur le chemin), et des aplats tout plats pour le sable, la terre des socles et le bord du chemin. Or, dans ce style, **une case fait justement 16 × 16 pixels** : le sol utilise maintenant les mêmes recettes que les blocs du voxel (`textures.json`, partie « pixel »), une tuile par case, avec ses variantes. `pixel.js` décide toujours *quelle matière* va où (l'eau, le sable des berges, le chemin, son bord, l'ombre de l'herbe, la terre sous les socles), puis prend la couleur dans la tuile de la case (`pixelTuile`).

- **Les grandes taches de l'herbe restent** : elles viennent d'un bruit à l'échelle du monde, plus grand qu'une case, qu'une tuile de 16 pixels ne pourrait pas faire sans se répéter. Elles éclaircissent ou foncent la couleur de la tuile (`TACHES_HERBE`), exactement comme avant.
- **La lumière vient toujours d'en haut à gauche** : les cailloux ont leur reflet en haut à gauche et leur ombre en bas à droite, les touffes leur pointe en haut. L'herbe, le chemin et la terre ne tournent donc pas d'une case à l'autre (l'herbe a seulement le droit au miroir, qui garde les touffes debout).
- L'eau qui bouge et la cour du château (cachée sous le château) gardent leur dessin à elles.

### Le cartoon : des recettes peintes au pinceau

Le sol du cartoon n'est pas fait de petits carrés : c'est **une grande toile peinte** (40 pixels par case), collée sur le terrain. Elle est maintenant peinte d'après des recettes, elles aussi (`textures.json`, partie « cartoon »), avec les mêmes rampes de couleurs, mais d'autres couches : des coups de pinceau. Le moteur est dans `src/rendus/peintures.js` ; comme `recettes.js`, il ne connaît ni Three.js ni le navigateur.

Chaque matière a une **forme**, donnée par le niveau : l'herbe est partout, le chemin suit sa ligne, la terre fait un disque sous chaque socle, la berge entoure chaque étang, la cour est un rectangle. Une couche peint « jusqu'à une certaine distance » de cette forme (la moitié de la largeur du chemin, le rayon du disque) : c'est son réglage **largeur**. Tout se mesure en cases, jamais en pixels : la même recette donne la même image dans l'atelier (en petit) et dans le jeu (en grand).

| Couche (pinceau) | Ce qu'elle fait |
|---|---|
| Aplat (`aplat`) | une couleur jusqu'à « largeur » cases de la forme, avec un bord qui **ondule** comme tracé à la main ; deux aplats qui ondulent pareil gardent des bords parallèles (une bordure toujours aussi large) |
| Taches (`taches`) | des taches aux formes libres, là où un bruit dépasse un seuil, au bord net ou fondu ; avec plusieurs couleurs, chaque tache a un cœur plus clair |
| Ronds, Traits | des ronds et de petits coups de pinceau semés au hasard (ce que faisait l'ancien sol) |
| Touffes (`touffes`) | trois brins en éventail, partis d'un même pied |
| Cailloux (`cailloux`) | des ovales avec leur ombre en bas à droite et un reflet en haut à gauche |
| Liseré (`lisere`) | un trait qui suit la forme, qui va et vient : les ornières du chemin |
| Ombre du bord (`ombre`) | un dégradé sombre depuis le bord vers l'intérieur : le chemin un peu creusé |
| Dalles (`dalles`) | des dalles de pierre aux formes irrégulières, séparées par des joints : la cour du château |

Quelques idées à retenir :

- **le hasard vient de la place des choses dans le monde** (une case, un coin de la grille du bruit), pas de l'ordre où on les peint. Repeindre un petit morceau de la toile donne exactement le même dessin que repeindre toute la toile : c'est ainsi qu'on ajoute la terre sous un socle bonus quand il se réveille (`majTerreSocles`, un disque 0,85 fois plus petit, comme avant) ;
- **chaque matière ne regarde que les pixels qu'elle peut toucher** : la distance à la forme est calculée une seule fois, et seulement près d'elle (le chemin ne touche qu'une petite partie de son grand rectangle). Toute la toile d'un niveau (2 080 × 1 520 pixels) se peint en 0,2 à 0,3 seconde ;
- **le décor du cartoon repart toujours du même hasard** (comme le voxel) : les arbres autour de la carte ont changé de place une fois, puis ne bougent plus d'un rendu à l'autre.

### Les nouvelles textures du pixel et du cartoon

Comme pour le voxel, on a d'abord écrit des recettes **« avant »** qui refont le sol d'avant avec les nouveaux moteurs (même photo, à quelques pixels près), pour comparer à décor égal. Puis chaque texture a été redessinée : des essais côte à côte en gros plan, puis l'atelier, dans les huit niveaux des deux mondes.

**Pixel art** : l'herbe a des touffes en V (deux brins sombres, la pointe claire) au lieu de points isolés, le chemin de petits cailloux ombrés et une terre tachetée, le sable des grains clairs, la terre des socles ses taches et ses cailloux.

| Mesure (pixel art) | Avant | Après |
|---|---|---|
| Taches du chemin (0 = une télé sans signal) | 0,00 | 0,29 |
| Taches du sable, de la terre, du bord (1 = un aplat) | 1 ; 1 ; 1 | 0,28 ; 0,30 ; 0,47 |
| Coutures des sols (vers 1 : on ne voit pas les bords des cases) | — | 0,4 à 0,9 |
| Clarté de l'herbe, du chemin | 0,544 ; 0,706 | 0,536 ; 0,692 |
| Écart de clarté chemin / herbe | 0,161 | 0,156 |

Une mesure trompe ici : les « taches » de l'herbe baissent (−0,11), parce qu'une touffe met un pixel sombre à côté d'un pixel clair, comme le ferait du bruit. Mais l'œil, lui, voit des brins d'herbe : les mesures aident, elles ne décident pas seules (c'est pour ça que l'atelier montre aussi tout en gros plan).

**Cartoon** : l'herbe a de grandes taches libres plus claires et plus sombres (au lieu de ronds transparents presque invisibles), des touffes et quelques brins clairs ; le chemin, la terre des socles et la berge des étangs ont des bords qui ondulent comme tracés à la main, une bordure sombre, des taches et des cailloux ombrés ; le chemin a des ornières et un milieu plus clair, là où l'on marche ; la cour du château est dallée.

| Mesure (cartoon) | Avant | Après |
|---|---|---|
| Contraste de l'herbe (0 = un aplat) | 0,025 | 0,032 |
| Contraste de la terre, de la berge, de la cour | 0 ; 0 ; 0 | 0,017 ; 0,034 ; 0,039 |
| Clarté de l'herbe, du chemin | 0,675 ; 0,784 | 0,681 ; 0,789 |
| Écart de clarté chemin / herbe | 0,109 | 0,108 |

**Les ambiances n'ont pas bougé**, dans les deux styles : les 32 images de l'atelier des lumières (les 8 niveaux des mondes 1 et 2, aux 4 moments de la journée) ont été remesurées avant et après. Les zones brûlées restent sous 0,07 % de l'image, le total des points brûlés ne bouge pas (55 en pixel, 66 en cartoon), la luminosité moyenne bouge d'au plus 0,005 en pixel et 0,011 en cartoon (le cartoon est un peu plus sombre la nuit : 2 % de l'image « bouchée » au lieu de 1,6 %, très loin de l'alerte, à 35 %).

## L'atelier des modèles

### Se voit-il bien ?

Dans un jeu de défense, le joueur doit repérer chaque monstre d'un coup d'œil, même petit, même pressé, sous n'importe quelle lumière. Or on ne voit pas bien soi-même si un personnage se détache : on sait où il est, alors on le trouve. Et environ un garçon sur douze est daltonien : il confond plus ou moins le rouge et le vert. La page `modeles.html` (un outil d'atelier) **mesure** si chaque personnage se voit bien, puis aide à régler son apparence.

On choisit le style, le niveau, l'ambiance, et le modèle : un monstre, un gardien (à chacun de ses trois niveaux), le héros, ou le socle libre (là où l'on construit). La scène est un **défilé** : tous les monstres attendent en file sur le chemin, chaque socle porte un gardien (le gardien choisi est sur le socle du milieu), et le héros attend devant le château. La partie n'avance pas, mais le vent, l'eau et les petites animations continuent.

### Comment on mesure

L'atelier photographie la scène deux fois : **avec le personnage** (mais sans son ombre : on ne mesure que lui), puis **sans lui** (il est caché le temps d'une photo). Les pixels qui changent, c'est lui. On compare alors chacun de ses pixels au pixel du sol qu'il cache. Le code de la mesure est dans `src/rendus/lisibilite.js`.

- **Comme l'œil le voit** : les couleurs passent dans l'espace « Lab » (L : la clarté ; a : du vert au rouge ; b : du bleu au jaune), où la distance entre deux couleurs suit à peu près ce que l'œil perçoit. Cette distance, l'**écart ΔE** (« delta E »), vaut 0 pour deux couleurs identiques, environ 2 quand on voit tout juste une différence, 10 pour deux couleurs nettement différentes, et plus de 30 pour deux couleurs qui n'ont rien à voir. La mesure garde l'écart **médian** : la moitié de ses pixels font mieux, l'autre moitié moins bien.
- **La vue des daltoniens** est simulée par les matrices de Machado (2009) : la deutéranopie et la protanopie (le rouge et le vert), et la tritanopie (le bleu et le jaune, bien plus rare). Le menu « Vue d'un daltonien » pose le même calcul sur tout l'écran (un filtre SVG).
- **Trois places sur le chemin** : un monstre est mesuré à sa place et à mi-chemin de ses deux voisins, et on garde la valeur du milieu (passer à l'ombre d'un arbre ne doit pas tout changer).
- **Deux photos vraiment identiques** : la flamme d'une Braise vacille au hasard à chaque image. Pendant une photo, le hasard repart toujours du même nombre, sinon la flamme comptait comme une partie du monstre voisin.
- Les petits points isolés (un reflet, la lueur d'une lanterne) ne comptent pas : on ne garde que les gros morceaux de la silhouette, que l'atelier dessine en doré par-dessus la vue.

| Mesure | Ce qu'elle veut dire |
|---|---|
| Se détache du sol | l'écart ΔE médian entre ses pixels et le sol qu'ils cachent ; alerte sous 22, rouge sous 14 |
| Daltoniens (rouge-vert) | la même mesure, vue par un œil deutéranope ou protanope (le pire des deux) |
| Tritanopie (bleu-jaune) | la même, pour le daltonisme bleu-jaune |
| Taille | sa hauteur à l'écran (ce qui se voit de lui), dans une fenêtre de jeu de 1 280 × 720 |
| Ressemblance | pour un monstre : celui qui lui ressemble le plus (l'écart entre leurs couleurs moyennes, et le rapport de leurs tailles) |

« **Mesurer tout le style** » fait le tour des 32 modèles sous les quatre ambiances (15 secondes en voxel), avec un tableau et une planche dans `captures/modeles-tour-<style>-<niveau>.jpg`. « **Avant / après** » montre le modèle avec l'apparence du fichier, puis la tienne. « **Enregistrer dans le jeu** » réécrit `src/jeu/apparences.json`, après une vérification par le serveur de développement (`format-apparences.js` : les mêmes personnages, le même gabarit, des couleurs « #rrggbb », une taille raisonnable).

Pour les photos, chaque style sait cacher un personnage (`rendu.masques`) ou lui retirer son ombre (`rendu.sansOmbre`), et refabriquer tous les personnages quand une apparence change (`oublierPersonnages`).

### Ce que l'atelier a trouvé, et ce qui a changé

Le premier tour complet donne une image claire : **le cartoon et le pixel art s'en sortent bien**, grâce au contour sombre de leurs personnages. **Le voxel**, qui n'en a pas, a les vrais soucis, surtout à l'heure dorée (la lumière orangée et l'étalonnage assombrissent tous les verts) :

- **le Filou**, brun sur le chemin brun, disparaissait presque (un écart de 10) ;
- **le Gluant** devenait un pavé olive à l'écran (une clarté de 32 sur 100, au lieu de 74 pour sa couleur) : un daltonien ne le distinguait plus du chemin rouille (un écart de 6). Changer sa couleur n'y suffisait pas : c'est la lumière qui l'éteignait.

Ce qui a changé :

1. **Le Filou devient une souris gris-bleu** (aux yeux rouges). Le bleu tranche sur les chemins orangés, pour tout le monde : c'est l'axe bleu-jaune, que les daltoniens rouge-vert voient bien.
2. **Le Gluant passe à un vert citron**, plus clair et plus jaune (`#a6ee4c` au lieu de `#5ed048`) : sa clarté n'est plus celle du chemin de sable. Les trois petits sur le dos de la Gigogne, qui sont des Gluants, prennent la même couleur.
3. **Dans le style voxel, la gelée luit un peu de sa propre couleur** (une lueur de 0,3, dans `voxel.js`). Le voxel remettait la lueur des monstres à zéro à chaque image (elle sert au flash blanc quand ils sont touchés) : il garde maintenant une « lueur de base » par morceau. Le Gluant et la Gigogne se voient à l'heure dorée, à l'aube et la nuit.

| Pire des quatre ambiances (vue normale / daltoniens) | Voxel | Cartoon | Pixel |
|---|---|---|---|
| Gluant, avant → après | 13 / 6 → 34 / 25 | 41 / 17 → 50 / 28 | 34 / 10 → 39 / 22 |
| Filou, avant → après | 10 / 9 → 16 / 15 | 18 / 16 → 30 / 26 | 16 / 13 → 36 / 32 |
| Cases rouges sur les 128 mesures du style (32 modèles × 4 ambiances) | 21 → 11 | 3 → 0 | 2 → 1 |

(La pire ambiance du Filou en voxel est l'aube brumeuse, où tout pâlit ; à l'heure dorée, il passe de 10 à 38.)

**Ce qui reste en rouge**, à regarder plus tard : en voxel, le Colosse (mais il est immense : 150 à 200 pixels de haut), la Gigogne à l'aube, la Taupe la nuit, et quelques gardiens (l'Étincelle de niveau 3, la Bourrasque à l'aube, le Prisme la nuit) ; en pixel art, le Dragon la nuit (13,9, tout juste sous le seuil). Les lumières des quatre niveaux voxel ont été remesurées avec la gelée qui luit : rien ne brûle (au plus 0,02 % de l'image).

## L'atelier de l'équilibrage

### Pourquoi un atelier

`npm run equilibrage` dit, en texte, si chaque niveau a bien la difficulté visée : des joueurs imaginaires le jouent, et on regarde qui gagne. Mais il ne raconte pas ce qui se passe vague après vague, et il ne sait rien des vrais joueurs. La page `equilibrage.html` (un outil d'atelier) le montre **en courbes**, avec **les vraies parties par-dessus**, et les chiffres du jeu s'y règlent **avec des curseurs** : l'atelier rejoue tout, et garde l'avant en pâle.

### Les chiffres du jeu, rangés dans une table

Comme dans les studios de jeu vidéo, les chiffres sont rangés à part, dans une **table d'équilibrage** : `src/jeu/chiffres.json`. On y trouve le prix, les dégâts et la portée des gardiens, la vie, la vitesse et la prime des monstres, les pouvoirs du château, le héros, l'économie (la revente, le bonus de fin de vague) et le mode survie (la croissance des vagues). `donnees.js` garde ce qui n'est pas un chiffre (les noms, les textes du didacticiel, les apparences) et va chercher les chiffres dans la table :

```js
niveaux: [
  { ...G.braise.niveaux[0], apparence: APPARENCES.gardiens.braise[0] },
  { nom: 'Braise ardente', ...G.braise.niveaux[1], apparence: APPARENCES.gardiens.braise[1] },
  …
```

(Les trois petits points « `...` » recopient tous les champs d'un objet dans un autre : ici, le prix, les dégâts, la cadence et la portée du niveau.)

`src/jeu/format-chiffres.js` donne le **sens de chaque chiffre** : son nom, son unité, ses limites et une phrase qui l'explique. Les curseurs de l'atelier s'en servent, et le serveur de développement revérifie tout avant d'écrire le fichier (les mêmes champs, chaque chiffre dans ses limites, des niveaux du héros de plus en plus chers). Pour essayer des chiffres sans réécrire le fichier, `appliquerChiffres(chiffres)` (dans `donnees.js`) les recopie dans les fiches : seul l'atelier s'en sert. Ce rangement n'a rien changé au jeu : les 330 parties de `npm run equilibrage` et les 58 vraies parties rejouées sont restées identiques, à l'octet près.

### Ce que montre l'atelier

En haut, les niveaux, rangés par monde. Chacun a une **pastille** (verte : l'objectif est atteint ; orange ou rouge : manqué) et le nombre de **vraies parties** jouées.

Pour le niveau choisi, quatre graphiques, vague après vague :

| Graphique | Ce qu'il montre | Comment le lire |
|---|---|---|
| Jusqu'où vont les monstres | au plus près du château qu'un monstre est arrivé, pour chaque joueur imaginaire (le bon joueur en bleu) et chaque vraie partie (en orange) | près de 0 : très serré ; une croix : une partie perdue là (« ×9 » : neuf parties perdues à la même vague) |
| L'or | ce que le joueur détaillé gagne pendant chaque vague, ce qu'il dépense avant, et ce qui lui reste au lancement | une réserve qui grimpe : il n'a plus rien à acheter |
| Les monstres contre les gardiens | la force de chaque vague (la menace : les PV × la vitesse) et celle de ses gardiens contre ces monstres-là | les deux partent de ×1 ; quand le rouge monte plus vite que le bleu, la défense décroche |
| Qui fait les dégâts | la part de chacun (chaque gardien, le héros, le Météore) dans les dégâts de chaque vague | un gardien absent ne sert à rien ; une part énorme : il fait tout |

En survolant un graphique (ou au clavier, avec les flèches), une bulle donne toutes les valeurs de la vague ; « Les chiffres des courbes » les met en tableau. Dessous : le verdict, comme dans `npm run equilibrage`, le débutant (voir plus bas), le tableau des joueurs imaginaires et celui des **vraies parties**. Un clic sur un joueur, ou sur une partie, la détaille dans les graphiques.

À droite, **« Que régler ? »** : le niveau lui-même (l'or de départ, l'arrivée de chaque gardien, et chaque groupe de monstres de chaque vague : combien, et à quel écart), un gardien (niveau par niveau), un monstre, le héros, les pouvoirs du château, ou l'économie et la survie. Chaque curseur va du tiers au triple de la valeur du fichier, et la case à côté accepte une valeur exacte ; un chiffre changé est marqué en doré, avec l'avant. Dès qu'un curseur bouge, l'atelier rejoue le niveau avec tes chiffres.

« **Tour complet** » joue tous les niveaux (avec les vraies parties, une quarantaine de secondes) et les range dans un tableau, avant et après tes chiffres. En rouge : un objectif manqué, un piège dans un didacticiel, ou un **mur pour les vrais joueurs** (au moins 3 parties perdues à la même vague, dès les 3 premières). « **Planche** » range les quatre graphiques dans `captures/equilibrage-<niveau>.png`, « **Avant / après** » la course du niveau avec les chiffres du fichier puis les tiens. « **Enregistrer dans le jeu** » réécrit `chiffres.json` et les fiches de niveau modifiées (seulement avec `npm run dev` ; le jeu se recharge avec les nouveaux chiffres).

### Comment il calcule

- **Dans des workers.** Un *Web Worker* est un petit programme qui tourne à côté de la page, en même temps qu'elle : les joueurs imaginaires peuvent jouer des centaines de parties sans que la page se fige. L'atelier en fait tourner deux (`atelier-equilibrage-calcul.js`) : l'un avec les chiffres du fichier (l'avant), l'autre avec les tiens (l'après). Si un curseur bouge pendant un calcul, l'ancien calcul est arrêté et le nouveau repart.
- **Le relevé** (`jeu/releve.js`) regarde une partie se jouer et note, à chaque vague : le plus près du château, là où tombent les monstres, l'or (au lancement, dépensé avant, gagné : les primes, le bonus de fin de vague, la récolte des Pépites), la défense et les dégâts de chacun. Les mêmes relevés servent pour les joueurs imaginaires et pour les vraies parties rejouées (un essai vérifie que l'or de chaque vague tombe juste, à la pièce près).
- **La force des gardiens** se mesure au banc d'essai (voir plus bas) : les dégâts par seconde de chaque gardien contre chaque sorte de monstre de la vague, comptés selon sa part de la menace. Un Grondin compte donc pour rien contre une vague de Voltigeurs.
- **Deux mesures qui n'ont pas la même unité ne partagent jamais un axe.** La menace des monstres et les dégâts par seconde des gardiens sont donc ramenés à ×1 à la première vague, sur une échelle « logarithmique » (×1, ×2, ×5, ×10… à distances égales), pour voir l'arène grimper jusqu'à ×500.
- **Les couleurs ont été vérifiées par le calcul**, avec une méthode de graphiques : deux couleurs voisines doivent rester distinctes pour un daltonien, sur le fond sombre de l'atelier. Les sources de dégâts gardent toujours la même couleur et le même ordre dans les piles (Braise orange, Givrine bleue, Bourrasque vert d'eau, Étincelle jaune, Prisme rose, Grondin vert, héros violet, Météore rouge). Le premier ordre essayé mettait le héros en vert juste à côté de la Braise orange : deux couleurs qu'un daltonien confond.

### Les vraies parties, et « et si… ? »

L'atelier lit les parties enregistrées sur le serveur, comme `npm run parties`, et les rejoue avec le lecteur de `jeu/enregistrement.js`. Une partie jouée avec d'anciennes règles ne se rejoue plus pareil : sa courbe raconterait une autre partie que la vraie. Elle n'est donc pas dessinée (la case « Anciennes règles » la montre quand même).

**Et si… ?** Quand tes chiffres changent, chaque vraie partie est rejouée avec **les mêmes décisions** : « avec 8 Voltigeurs au lieu de 12, ce joueur aurait-il tenu la vague 2 ? ». Mais une décision prise au pas 2 400 n'est peut-être plus possible à ce moment-là. Le **lecteur souple** (`creerLecteurSouple`) refait donc les décisions dans l'ordre, chacune dès qu'elle redevient possible :
- lancer la vague, ou choisir une bénédiction : il attend que ce soit possible, et décale d'autant toutes les décisions suivantes ;
- un achat qui manque d'or est mis de côté, et refait dès que l'or arrive (une minute au plus), sans retenir les autres décisions ;
- le reste (un pouvoir, le héros) se fait à son moment, ou pas du tout.

Avec les mêmes chiffres, il refait exactement les vraies parties (vérifié sur 53 d'entre elles). Mais ce n'est qu'une indication : avec d'autres chiffres, le vrai joueur aurait peut-être fait d'autres choix. Avec plus d'or, il aurait acheté plus de gardiens, alors que ce lecteur ne refait que ses achats. Le tableau signale les décisions qui n'ont pas pu se faire à leur moment.

### Le banc d'essai

`jeu/banc.js` pose chaque gardien seul, à côté d'un chemin tout droit, et fait passer devant lui une file de 10 monstres d'une même sorte (un seul pour un chef), avec une vie infinie. C'est le vrai moteur qui joue : le temps de vol des tirs, l'armure de la Carapace, les volants que les rochers ne touchent pas, la Taupe qui plonge, le Dragon qui assomme… Pour un gardien, le panneau montre la part de la vie qu'il enlève à chaque monstre qui passe (100 % : il le bat à lui seul), combien de temps il **retient** les monstres sous le feu (le gel, le vent), et ce que rapporte une amélioration comparée à un nouveau gardien, à prix égal. Pour un monstre : la part de sa vie qu'enlève chaque gardien. Tout le banc se mesure en 0,2 seconde.

### Le débutant

Les vraies parties ont montré où les nouveaux joueurs perdent : **dès les premières vagues**. `pardonDuDebutant()` (dans `jeu/equilibrage.js`) imite un joueur qui découvre le niveau : il pose des Braise au hasard (il ne sait pas encore quels socles sont bons), avec tout son or, puis lance la vague 1. Sur 60 façons de les placer, combien tiennent ? Et s'il achète d'abord un gardien qui ne se bat presque pas (une Pépite, une Bourrasque) ? Dans un didacticiel ou un niveau facile, un piège de ce genre (la vague 1 tenue moins d'une fois sur deux) donne un conseil, dans l'atelier, dans l'éditeur et dans `npm run equilibrage`.

### Ce que l'atelier a trouvé, et ce qui a changé

Il y avait 58 parties enregistrées : 7 dans l'arène, 51 dans la campagne, jouées par quelques amis.

**1. Deux murs pour les vrais joueurs.**
- **La vallée du Colosse** : 13 parties, dont 11 perdues, et 9 à la vague 2. Les graphiques racontent la première : à la vague 2, la force des monstres double (×1,9) pendant que celle de la défense baisse (×0,8). Son Grondin, qui faisait 80 % des dégâts à la vague 1, ne touche pas les 12 Voltigeurs, qui volent. Le joueur a fini par gagner… avec 5 Étincelle.
- **La colline dorée** (le didacticiel du monde 3) : trois défaites d'affilée **dès la vague 1**, chaque fois avec une Pépite achetée tout de suite, et deux gardiens seulement. C'était pourtant le conseil de sa fiche : « Pose-la tôt ».

**2. Le débutant a mesuré le piège.** Avec des Braise posées au hasard, la vague 1 est tenue dans 75 à 100 % des cas, dans tous les niveaux : elle pardonne. Mais avec un gardien qui ne se bat pas, acheté d'abord :

| Niveau | Pépite d'abord | Bourrasque d'abord |
|---|---|---|
| La colline dorée (didacticiel) | 10 % → plus possible (elle arrive à la vague 2) | 13 % → plus possible |
| La prairie des Carapaces (facile) | 0 % → plus possible | 0 % → plus possible |
| Le lac aux Voltigeurs (facile) | — | 3 % → plus possible |
| Les niveaux normaux | de 0 à 50 % (gardé : un niveau normal peut punir) | de 0 à 22 % (gardé) |

**3. Ce qui a changé** (dans les fiches de niveau, enregistrées par l'atelier, et une phrase) :
1. La colline dorée : la Pépite et la Bourrasque arrivent à la vague 2. La vague 1 se joue avec des gardiens qui tirent, et la fiche de la Pépite s'ouvre après la première vague, quand la défense tient.
2. La prairie des Carapaces et le lac aux Voltigeurs (deux niveaux faciles) : pareil pour la Bourrasque (et pour la Pépite dans la prairie).
3. La vallée du Colosse : 8 Voltigeurs au lieu de 12 à la vague 2, un peu plus espacés (0,9 seconde au lieu de 0,7). Le bon joueur imaginaire trouve toujours le niveau « Équilibré », avec la même marge ; le grand test du niveau passe de la vague 2 à la vague 8, celle du Colosse ; et, rejouées avec les mêmes décisions, 4 des 9 parties perdues à la vague 2 l'auraient tenue (et celle perdue à la vague 8 aurait été gagnée).
4. Le conseil de la Pépite : « Pose-la quand tes premiers gardiens tiennent bon… » (au lieu de « Pose-la tôt »).

Les 13 niveaux atteignent toujours leur objectif, et les joueurs imaginaires jouent exactement pareil partout, sauf dans la vallée du Colosse. (Les anciennes parties de ces quatre niveaux ne se rejouent plus tout à fait pareil : la page « Revoir la partie » le signale, comme après chaque changement de règles.)

**4. Le banc d'essai confirme une règle des fiches.** « Une amélioration rapporte à peu près autant de dégâts par pièce qu'un nouveau gardien » : c'est vrai, de 0,83 à 1,21 fois selon le gardien et le niveau. Avec deux remarques, à surveiller (rien n'est changé) :
- le **Blizzard** (le niveau 3 de la Givrine) rapporte 1,5 fois ce que rapporterait une nouvelle Givrine, en plus d'un gel bien plus fort : l'améliorer est toujours le bon choix ;
- la **Bourrasque** retient peu les monstres : 1,2 à 1,6 fois plus longtemps sous le feu, contre 1,6 à 2,5 pour la Givrine au même prix. La poser tôt fait perdre, mais une Givrine posée au même moment aussi : c'est surtout une question de moment.

Le **Grondin** est le plus rentable contre les foules au sol : 35 dégâts pour 100 pièces, contre 22 à 25 pour les autres. C'est pour ça qu'il fait 60 à 70 % des dégâts dans les vraies parties de l'arène.

**5. L'arène : le plafond se voit.** Dès la vague 13, la force des gardiens plafonne à ×20 (tous les socles sont au niveau 3) pendant que celle des monstres grimpe jusqu'à ×500 vers la vague 27. Ce sont le Météore et le héros qui comblent l'écart, et l'or inutilisé grimpe jusqu'à 9 000 pièces. C'était déjà connu ; maintenant, ça se voit.

**Ce qui reste, à décider plus tard :**
- **montrer la prochaine vague** avant de la lancer (« 8 Voltigeurs : des volants ! »). C'est le vrai remède au piège des volants : l'équilibrage seul n'y suffit pas, puisqu'un débutant qui ouvre avec un Grondin ne passe la vague 2 de la vallée que 12 fois sur 100 (au lieu de 0) ;
- **prévenir quand on lance une vague avec beaucoup d'or en poche** (une défaite aux deux étangs avec une seule Braise et 130 pièces) ;
- le Blizzard et la Bourrasque.

## Comment le code est rangé

L'idée principale : **les règles du jeu ne savent pas dessiner, et les dessins ne connaissent pas les règles.**

```
index.html             l'accueil : la carte des époques
jeu.html               le jeu (jeu.html?niveau=monde1-1)
editeur.html           l'éditeur de niveaux
personnages.html       la galerie des personnages, chacun dans les trois styles
sons.html              la salle des sons : le thème et les bruitages, dans les trois époques
lumieres.html          l'atelier des lumières : régler les ambiances et repérer les lumières trop fortes
textures.html          l'atelier des textures : voir les textures des trois styles en grand, les mesurer, régler leurs recettes
modeles.html           l'atelier des modèles : chaque personnage sur les vrais sols, sa lisibilité mesurée (daltoniens compris), ses couleurs
equilibrage.html       l'atelier de l'équilibrage : les niveaux en courbes, avec les vraies parties, et les chiffres du jeu à régler
revoir.html            revoir une partie enregistrée (revoir.html?partie=…)
visites.html           les visites du site, jour après jour (la page du créateur, reliée à aucune autre)
src/
├── accueil.js         la carte des époques : les mondes, les niveaux, la progression
├── accueil.css        son allure (chaque monde dans le style de son époque)
├── personnages.js     la galerie des personnages (+ personnages.css)
├── sons.js           la salle des sons (+ sons.css)
├── atelier-lumieres.js l'atelier des lumières : la partie automatique, les curseurs, les mesures (+ atelier-lumieres.css)
├── atelier-textures.js l'atelier des textures : gros plans, grand sol, vrai niveau, mesures, recettes (+ atelier-textures.css)
├── atelier-modeles.js l'atelier des modèles : le défilé, les photos avec et sans le modèle, les mesures, l'apparence (+ atelier-modeles.css)
├── atelier-equilibrage.js l'atelier de l'équilibrage : les niveaux, les courbes, les vraies parties, les curseurs, le banc (+ atelier-equilibrage.css)
├── atelier-equilibrage-calcul.js son calcul, dans un worker : les joueurs imaginaires et les vraies parties, avec les chiffres qu'on lui donne
├── graphiques.js      les graphiques de l'atelier de l'équilibrage (courbes, colonnes, bulle du survol), dans un canvas
├── main.js            le chef d'orchestre du jeu : boucle, boutons, menu, cartes de début et de fin
├── didacticiel.js     les leçons, les fiches de présentation et la flèche
├── progression.js     les niveaux gagnés et les fiches déjà vues, gardés par le navigateur
├── options.js         les options du joueur (son, vitesse, affichage…), et qui doit être prévenu quand elles changent
├── fenetre-options.js la fenêtre des options, fabriquée à partir d'une liste (+ options.css)
├── classement.js      le classement du mode survie : il demande au serveur, ou garde le score sur l'ordinateur
├── parties.js         l'envoi des parties enregistrées au serveur (et celles en attente)
├── revoir.js          la page « Revoir la partie » : la partie rejouée et dessinée (+ revoir.css)
├── compteur.js        le compteur de visites : chaque page prévient le serveur qu'on l'a ouverte
├── visites.js         la page des visites : les chiffres additionnés et dessinés (+ visites.css)
├── style.css          l'interface du jeu (elle change de look selon le style choisi)
├── niveaux/           LES FICHES DE NIVEAU (des données pures, sans code)
│   ├── monde1-1.json … monde1-4.json   les quatre niveaux du monde 1
│   ├── monde2-1.json … monde2-4.json   les quatre niveaux du monde 2
│   ├── monde3-1.json … monde3-4.json   les quatre niveaux du monde 3
│   ├── arene-pixel.json   l'arène du mode survie
│   └── essai.json     le niveau de test (hors campagne)
├── editeur/           L'ÉDITEUR DE NIVEAUX (page editeur.html)
│   ├── editeur.js     le cœur : état, historique, souris, clavier, boutons
│   ├── carte.js       le plan vu de dessus et « qu'y a-t-il sous la souris ? »
│   ├── panneau.js     le formulaire de droite (époque, carte, vagues, vérification)
│   ├── conseils.js    les conseils de conception (socle sur le chemin…)
│   ├── format.js      JSON lisible, nouveau niveau, nom de fichier
│   └── editeur.css
├── jeu/               LES RÈGLES (aucun dessin ici)
│   ├── campagne.js    les mondes et leurs niveaux, dans l'ordre ; quel niveau est ouvert
│   ├── survie.js      le mode survie : les vagues fabriquées, de plus en plus dures
│   ├── benedictions.js les bénédictions : la liste, le tirage des 3 propositions, les chiffres avec les bonus
│   ├── niveau.js      lit et vérifie une fiche, puis calcule chemin, relief et décor
│   ├── equilibrage.js les joueurs imaginaires, le débutant et le verdict d'équilibrage
│   ├── releve.js      le relevé d'une partie, vague par vague (pour les courbes de l'atelier de l'équilibrage)
│   ├── banc.js        le banc d'essai : chaque gardien face à une file de chaque monstre
│   ├── donnees.js     les fiches des personnages : noms, textes, chiffres (lus dans chiffres.json) et apparence
│   ├── chiffres.json  les chiffres du jeu, la « table d'équilibrage » (l'atelier de l'équilibrage la modifie)
│   ├── format-chiffres.js  le sens de chaque chiffre (nom, unité, limites) ; vérifier et écrire chiffres.json
│   ├── apparences.json l'apparence des personnages, rangée à part (l'atelier des modèles la modifie)
│   ├── moteur.js      ce qui se passe à chaque instant : déplacements, tirs, or, défaite
│   ├── enregistrement.js  les parties enregistrées : noter les décisions, puis les rejouer (le « lecteur », et le lecteur « souple » des « et si… ? »)
│   ├── calcul.js      distance() : un calcul qui donne le même résultat dans tous les navigateurs
│   └── aleatoire.js   hasard « reproductible » et bruit (pour placer le décor)
├── son/               LE SON (fabriqué par le code, sans aucun fichier)
│   ├── synthe.js      le petit synthétiseur : notes, bruits, enveloppes, table de mixage, écho
│   ├── partition.js   le thème principal, celui des chefs et les musiques de fin, écrits comme sur une portée
│   ├── orchestres.js  les instruments et les deux arrangements de chaque époque
│   ├── effets.js      une recette de bruitage par événement du jeu
│   └── son.js         le chef d'orchestre : séquenceur, mixage selon la partie, réglages
└── rendus/            LES DESSINS (ils lisent l'état du jeu et l'affichent)
    ├── voxel.js       style 1 : cubes façon Minecraft + lumière de coucher de soleil
    ├── cartoon.js     style 2 : formes rondes et contours, façon Kingdom Rush
    ├── pixel.js       style 3 : vrai pixel art 16 bits, dessiné en Canvas 2D
    ├── ambiances.json les réglages des quatre ambiances de chaque style (l'atelier des lumières les modifie)
    ├── format-ambiances.js  vérifier et écrire ambiances.json
    ├── textures.json  les recettes des textures des trois styles (l'atelier des textures les modifie)
    ├── recettes.js    la fabrique des textures du voxel et du pixel : d'une recette à 16 × 16 pixels, et les mesures
    ├── peintures.js   les recettes peintes du cartoon : la toile du sol, matière par matière, et les mesures
    ├── format-textures.js  vérifier et écrire textures.json
    ├── lumieres.js    les lumières du jeu, à chaque instant (lanternes, feu, explosions…), pour les trois styles
    ├── carte-lumieres.js  la carte des lumières des styles 3D (toutes les lumières dans une petite image vue de dessus)
    ├── apparence.js   le vocabulaire des apparences (gabarits, accessoires, couleurs)
    ├── format-apparences.js  vérifier et écrire apparences.json
    ├── lisibilite.js  la lisibilité : les couleurs comme l'œil les voit (Lab, écart ΔE), la vue des daltoniens, la mesure avec / sans
    └── outils3d.js    morceaux partagés par les deux styles 3D
serveur/               LE SERVEUR DU CLASSEMENT (un projet Vercel à part, voir « Le classement en ligne »)
├── api/scores.js      la fonction du classement : vérifie, range et lit les scores
├── api/parties.js     la fonction des parties enregistrées : vérifie, range et relit les parties
├── api/visites.js     la fonction du compteur de visites : des compteurs par jour, rien sur les visiteurs
├── vercel.json        la fonction tourne à Paris, près de la base ; l'adresse seule renvoie vers le jeu
└── package.json
scripts/
├── equilibrage.js     npm run equilibrage : les joueurs imaginaires jouent chaque niveau
└── parties.js         npm run parties : les vraies parties, rejouées et racontées
```

### Du fichier à la partie

1. `main.js` importe la fiche `niveaux/essai.json`.
2. **`chargerNiveau(fiche)`** (dans `jeu/niveau.js`) la vérifie, puis calcule tout ce qui en découle : la longueur du chemin, le relief du terrain, la position des arbres et des fleurs.
3. **`creerPartie(niveau)`** prépare une partie sur ce niveau : l'or de départ, aucun gardien, aucun monstre.
4. Chaque style reçoit le même `niveau` et construit son décor à partir de lui.

### La boucle de jeu (dans `main.js`)

Environ 60 fois par seconde :

1. **`majPartie(etat, PAS)`** fait avancer les règles d'un pas de 1/60 de seconde, toujours le même (voir « Les parties enregistrées ») : les monstres marchent, les gardiens visent le monstre le plus avancé à leur portée, les tirs volent, l'or tombe. Le temps écoulé depuis l'image précédente remplit une réserve, dépensée pas par pas : une image fait parfois deux pas, parfois aucun, et en vitesse ×2 il y a deux fois plus de pas.
2. **`rendu.dessiner(etat, …)`** demande au style choisi de dessiner cet état.
3. Les **événements** (« un monstre est mort », « un tir a touché »…) sont lus par le style pour faire des effets (particules, flash) et par le son pour les bruitages, puis effacés.

Comme les styles ne font que lire `etat`, on peut changer de style en pleine partie : la partie continue, seul le dessin change.

### Ce que doit savoir faire un style

Chaque fichier de `rendus/` exporte une classe avec les mêmes méthodes :

| Méthode | Rôle |
|---|---|
| `new Rendu(conteneur, niveau, reglages)` | construit le décor du niveau |
| `dessiner(etat, dtJeu, dtReel, ui)` | dessine une image |
| `socleSous(x, y)` | quel socle est sous la souris ? |
| `versEcran(x, y, hauteur)` | où se trouve un point du jeu à l'écran ? (pour placer le menu, les « +6 » et la flèche du didacticiel) |
| `portrait(apparence)` | le portrait d'un personnage, dans ce style (pour les fiches du didacticiel) |
| `choisirAmbiance(nom, immediat)` | changer le moment de la journée (`immediat` : sans glisser doucement, pour l'atelier des lumières) |
| `majTexture(nom)` | une recette de texture a changé : la refaire, ou repeindre le sol (pour l'atelier des textures) |
| `oublierPersonnages()`, `masques`, `sansOmbre` | une apparence a changé : refabriquer les personnages ; cacher un personnage, ou lui retirer son ombre, le temps d'une photo (pour l'atelier des modèles) |
| `redimensionner()` / `detruire()` | suivre la taille de la fenêtre / tout libérer |

### Les trois styles, techniquement

- **Voxel doré** (Three.js). Le monde est fait d'environ 50 000 cubes, assemblés face par face (seulement les faces visibles, avec leur occlusion ambiante) en quelques grands objets, un par matériau. Les textures 16 × 16 sont dessinées par le code. L'éclairage vient d'un soleil bas qui projette de vraies ombres. Par-dessus, un post-traitement ajoute le halo des lumières (*bloom*), les rayons de soleil, la chaleur des couleurs et la vignette. Il y a 4 ambiances et 2 caméras.
- **Diorama cartoon** (Three.js). Il utilise un *toon shading*, c'est-à-dire 3 tons seulement au lieu d'un dégradé. Les contours sombres viennent d'une copie de l'objet légèrement gonflée et vue de l'intérieur. La caméra est orthographique, donc sans perspective, ce qui donne l'effet maquette. Le sol est peint d'après ses recettes (`peintures.js`) sur une grande toile, puis collé sur le terrain. Ses 4 ambiances changent la couleur et la position du soleil, la lumière du ciel, la couleur de l'eau, le vent et les ombres des nuages ; les lumières du jeu passent par la carte des lumières.
- **Pixel art** (Canvas 2D, sans Three.js). Chaque sprite est dessiné case par case par le code, et le contour sombre est ajouté automatiquement. La scène est dessinée en petite résolution (une case = 16 pixels, et le sol prend la tuile de 16 × 16 de chaque case, d'après ses recettes), puis agrandie d'un nombre entier de fois sans lissage, pour garder des pixels bien carrés. L'ordre d'une image : le sol (le fond peint d'avance, l'eau, l'herbe, les socles), le calque des ombres, les ombres des nuages, tout ce qui a de la hauteur trié du haut vers le bas de l'écran, la vie (papillons, feuilles, oiseaux), puis la lumière. Ses 4 ambiances sont des voiles de couleur posés sur l'image ; la nuit, tout s'assombrit en bleu (« multiply ») et les lumières du jeu ajoutent des halos (« lighter »), avec des lucioles.

## Les fiches des personnages

Chaque personnage est décrit **une seule fois**, dans `src/jeu/donnees.js` : son nom, ses textes, ses chiffres de jeu (prix, dégâts, vitesse…) et son **apparence**. Les trois styles fabriquent eux-mêmes le personnage à partir de cette apparence. Les chiffres et l'apparence sont rangés à part, dans deux fichiers de données (comme les fiches de niveau) : `src/jeu/chiffres.json`, que règle l'atelier de l'équilibrage, et `src/jeu/apparences.json`, que règle l'atelier des modèles. Ils changent sans qu'on touche au code des règles.

```js
braise: {
  nom: 'Braise', role: '…', projectile: { type: 'feu', ...G.braise.projectile }, // commun aux 3 niveaux
  niveaux: [
    { ...G.braise.niveaux[0], apparence: APPARENCES.gardiens.braise[0] },  // lus dans chiffres.json et apparences.json
    { nom: 'Braise ardente', ...G.braise.niveaux[1], apparence: … },       // niveau 2 : cout = prix de l'amélioration
    { nom: 'Brasier', ...G.braise.niveaux[2], apparence: … },              // niveau 3
  ],
},
```

```json
"braise": {
  "projectile": { "vitesse": 9 },
  "niveaux": [
    { "cout": 70, "degats": 9, "cadence": 0.8, "portee": 3 },
    { "cout": 70, "degats": 14, "cadence": 0.62, "portee": 3.2 },
    { "cout": 110, "degats": 22, "cadence": 0.54, "portee": 3.4 }
  ]
}
```

```json
"braise": [
  { "gabarit": "gardien", "couleurs": { "clair": "#ffb46a", "peau": "#f0803a", "fonce": "#b8522a" }, "accessoires": ["flamme"] },
  …
]
```

Le gabarit est la silhouette de base, les couleurs vont du dessus éclairé (`clair`) à l'ombre (`fonce`), et les accessoires sont ce qu'il porte. Les monstres n'ont qu'un niveau : leur fiche recopie directement leurs chiffres (`...M.gluant`, lus dans `chiffres.json`) et leur `apparence` (`APPARENCES.monstres.gluant`…). Le sens de chaque chiffre (son unité, ses limites) est écrit dans `src/jeu/format-chiffres.js`.

**Les pouvoirs**, des champs facultatifs que le moteur sait lire :

| Champ | Pour qui | Rôle |
|---|---|---|
| `ralentissement: { facteur, duree, zone }` | gardien | le gel de Givrine |
| `zone` | gardien | le rayon d'explosion du Grondin |
| `monstresMax` | gardien | combien de monstres une explosion touche au plus (les plus près du point de chute) |
| `rebonds: { nombre, saut, attenuation }` | gardien | l'éclair d'Étincelle : combien de sauts, à quelle distance, et ce qui reste des dégâts à chaque saut (0,7 = 70 %) |
| `souffle: { recul, zone }` | gardien | le vent de Bourrasque : de combien de cases reculent les monstres autour de la cible |
| `projectile: { cloche: true }` | gardien | un tir en cloche, qui ne touche pas les volants |
| `projectile: { instantane: true }` | gardien | rien ne voyage : le coup part tout de suite (l'éclair) |
| `rayon: { montee, max }` | gardien | un rayon qui ne s'arrête pas (`degats` = par seconde), accroché à sa cible tant qu'il peut la toucher, et qui chauffe : jusqu'à `max` fois plus fort au bout de `montee` secondes sur la même cible. Il traverse les carapaces |
| `recolte` | gardien | l'or qu'il rapporte à la fin de chaque vague (la Pépite). Un gardien sans `projectile` ne tire pas, et une `portee` de 0 n'affiche aucun cercle |
| `volant: true` | monstre | il vole au-dessus du chemin |
| `enfants: { type, nombre }` | monstre | battu, il libère ces monstres-là |
| `vent` | monstre | combien le vent le fait reculer : 1 normal, 1,5 léger, 0 jamais |
| `gel` | monstre | combien le gel le ralentit : 1 normal, 0,5 à moitié |
| `armure` | monstre | sa carapace : chaque coup perd ces dégâts-là (au moins 1 dégât passe toujours). Le rayon la traverse |
| `creuse: { dessous, dessus, vitesse }` | monstre | il passe `dessous` secondes sous terre (personne ne peut le viser, et il va `vitesse` fois plus vite), puis `dessus` secondes dehors |
| `feu: { toutesLes, portee, duree }` | monstre | toutes les `toutesLes` secondes, il crache sur le gardien le plus proche (à moins de `portee` cases), qui reste assommé `duree` secondes |
| `boss: true` | monstre | un chef : fiche spéciale dans le didacticiel, pas dans le défilé de la carte |

**Le vocabulaire** (défini dans `src/rendus/apparence.js`) :

| Gabarit | Silhouette |
|---|---|
| `gardien` | la mascotte : corps rectangulaire, yeux en barres, bras, quatre pattes |
| `gelee` | une gelée qui sautille |
| `rongeur` | un petit animal rapide (oreilles, queue), vu de profil |
| `golem` | un gros bloc de pierre avec de la mousse sur le dos (et des fissures de lave si on lui donne la couleur `lave`) |
| `volant` | une petite bête ronde qui vole en battant des ailes, comme une chauve-souris |
| `tortue` | une tortue vue de profil : une carapace bombée, une tête, quatre pattes |
| `taupe` | une taupe toute ronde, avec un long museau et de grosses pattes pour creuser |
| `dragon` | un grand dragon qui vole : un long cou, de grandes ailes, une queue. En pixel art, il n'existe qu'en grand (c'est un chef) |

| Accessoire | Couleur par défaut |
|---|---|
| `flamme` | orange |
| `cristaux` | bleu glace |
| `echarpe` | blanc |
| `cornes` | os |
| `mortier` | bronze |
| `cape` | rouge : une cape dans le dos et un col autour de la tête (niveaux 2 et 3) |
| `couronne` | dorée (niveau 3) |
| `antennes` | cyan : deux antennes qui crépitent (et grossissent quand le gardien tire) |
| `moulinet` | rose : un petit moulin à vent sur la tête, qui tourne plus vite quand le gardien souffle |
| `petits` | vert : trois petites gelées qui voyagent sur le dos |
| `casque` | blanc : un casque de mineur avec sa lampe |
| `pioche` | gris acier : une pioche dans le dos (la couleur est celle de son fer) |
| `prisme` | blanc : un cristal qui flotte au-dessus de la tête, entouré d'éclats d'arc-en-ciel (il brille plus fort quand le rayon chauffe) |
| `lunettes` | orange : de grosses lunettes rondes sur les yeux |

Les couleurs `clair`, `peau` et `fonce` sont obligatoires. Certains gabarits en utilisent d'autres : `yeux` pour tous, `mousse` et `lave` pour le golem, `carapace` pour la tortue, `museau` pour la taupe, `ventre` pour le dessous du dragon. Une couleur peut aussi être donnée à un accessoire (`{ type: 'flamme', couleur: '#5ab8ff' }` donne une flamme bleue), et `taille` agrandit le personnage (1,4 = 40 % plus grand). En pixel art, agrandir un sprite abîmerait ses pixels : la taille n'y est donc pas appliquée, sauf pour les grands personnages (1,4 ou plus) quand leur gabarit a une version « grand », redessinée pixel par pixel (la Gigogne et le Colosse).

**Les ancres.** Chaque gabarit indique où s'accrochent les accessoires : le sommet de la tête, la ceinture, le dos, le bas des pieds… Un accessoire va donc sur n'importe quel gabarit. Des cornes sur un golem, par exemple, se placent toutes seules sur sa tête. Le monde 3 a ajouté l'ancre des **yeux** (pour poser les lunettes), et un accessoire qui **relève le sommet** : le casque. Tout ce qui vient après lui dans la liste se pose sur le casque, et pas dedans : c'est pour ça que, dans la fiche de Trésor, `casque` vient avant `couronne`.

**L'ordre des accessoires compte en pixel art** : chacun se peint par-dessus les précédents. La couronne vient donc après la flamme, pour être devant elle. La cape, elle, utilise un pinceau spécial, `p.derriere(…)`, qui ne peint que les cases encore vides : elle est dessinée après le corps mais paraît derrière lui.

**Créer un nouveau personnage** : il suffit d'écrire une fiche avec un gabarit, des couleurs et des accessoires existants. Il apparaît alors dans les trois styles, sans une ligne de dessin.

**Ajouter un nouvel accessoire ou un nouveau gabarit** : il faut le dessiner une fois dans chaque style, dans `ACCESSOIRES_VOXEL` (voxel.js), `ACCESSOIRES_CARTOON` (cartoon.js) et `ACCESSOIRES_PIXEL` (pixel.js), ou bien dans les `GABARITS_…` correspondants, puis l'ajouter à la liste de `apparence.js`. Si un style a été oublié, un message le dit au démarrage. Une fiche qui utilise un mot inconnu (gabarit, accessoire, couleur mal écrite) est aussi signalée clairement.

## L'éditeur de niveaux

Il s'ouvre depuis le bas de la carte des époques (« Éditeur de niveaux ») ou à l'adresse http://localhost:5180/editeur.html.

**Les outils** (à gauche, ou les touches 1 à 4) : chacun modifie un type d'objet sur le plan.

| Outil | Clic | Glisser | Clic droit |
|---|---|---|---|
| 1 Chemin | ajoute un point au bout du chemin, ou en insère un si l'on clique sur le chemin | déplace un point | supprime le point |
| 2 Socles | pose un socle | le déplace | le supprime |
| 3 Lanternes | pose une lanterne | la déplace | la supprime |
| 4 Étangs | creuse un étang | le centre : le déplace ; le bord : change sa taille (la molette aussi) | le supprime |

Les objets se placent à la demi-case près ; en tenant **Alt**, au dixième de case. **Suppr** efface l'objet choisi, **Ctrl+Z** / **Ctrl+Maj+Z** annulent et refont. Au survol d'un socle, deux cercles montrent la portée des gardiens (3 et 3,6 cases).

Le château se place tout seul : sa porte est au bout du chemin.

**Le panneau de droite** règle le reste de la fiche : le nom, la description, la difficulté visée, l'époque et l'ambiance, la taille de la carte, l'or de départ, le décor (« Tirer un autre décor » replace les arbres ; le curseur règle combien d'arbres poussent dans la zone de jeu), les vagues, la vague d'arrivée de chaque gardien et le didacticiel (des cases à cocher pour les leçons et les personnages à présenter).

**La vérification** se fait en direct :
- les **erreurs** (en rouge) empêchent de tester ou d'enregistrer ;
- les **conseils** (en orange) signalent ce qui marcherait mal en jeu, comme un socle sur le chemin ou trop loin pour tirer, ou un didacticiel qui oublie de présenter un personnage. Survole un conseil pour voir l'objet concerné sur le plan.

**Les boutons du haut :**
- **Tester ce niveau** ouvre le jeu avec la fiche en cours (`jeu.html?niveau=editeur`). On joue directement (le didacticiel aussi), et « Modifier dans l'éditeur » ramène à l'éditeur.
- **Enregistrer dans le projet** écrit la fiche dans `src/niveaux/` (seulement avec `npm run dev`). Le serveur revérifie la fiche avec le même code que le jeu avant d'écrire quoi que ce soit.
- **Télécharger** et **Copier le JSON** donnent la fiche sans passer par le serveur.
- **Ouvrir un niveau** reprend une fiche du projet ; **Nouveau** part d'un niveau simple déjà jouable.

Le travail en cours est gardé dans le navigateur : on peut fermer la page et la rouvrir sans rien perdre.

## Les fiches de niveau

Un niveau est un fichier JSON rangé dans `src/niveaux/`. Toutes les positions sont en **cases** : `x` vers la droite, `y` vers le bas, `{ "x": 0, "y": 0 }` étant le coin en haut à gauche de la zone de jeu.

| Champ | Rôle |
|---|---|
| `id`, `nom` | identifiant (sans espaces) et nom affiché |
| `style` | l'époque du niveau : `"pixel"`, `"cartoon"` ou `"voxel"` |
| `ambiance` | le moment de la journée : `"doree"`, `"aube"`, `"midi"` ou `"nuit"` |
| `largeur`, `hauteur` | taille de la zone de jeu, en cases |
| `or` | or au début de la partie |
| `chemin` | les points du chemin, du départ (hors de l'écran) jusqu'à la porte du château |
| `socles` | les endroits où l'on peut poser un gardien |
| `chateau` | le centre du château (sa porte est le dernier point du chemin) |
| `etangs` | une liste d'étangs `{ "x", "y", "rayon" }`, qui peut être vide |
| `lanternes` | les lampadaires le long du chemin (ils s'allument la nuit) |
| `decor.graine` | changer ce nombre replace autrement les arbres, rochers et fleurs |
| `decor.arbres` | combien d'arbres dans la zone de jeu, de 0 (aucun) à 1 (une forêt). Facultatif |
| `description` | une phrase sur le niveau (carte des époques, carte de début). Facultatif |
| `difficulte` | la difficulté visée : `"didacticiel"`, `"facile"` ou `"normal"` (normal si absent) |
| `gardiens` | à partir de quelle vague chaque gardien est disponible, ex. `{ "braise": 1, "givrine": 2 }`. Facultatif : sinon tous, dès le début |
| `didacticiel` | les leçons et les personnages à présenter (voir « Le didacticiel »). Facultatif |
| `survie` | `true` : une arène du mode survie (après les vagues écrites, des vagues sans fin). Facultatif |
| `pouvoirs` | `true` : le joueur a les pouvoirs du château (le Météore et le Grand froid). Facultatif |
| `benedictions` | `true` : toutes les 5 vagues tenues, une bénédiction à choisir parmi 3. Facultatif |
| `soclesBonus` | des socles en plus (`[{ "x": …, "y": … }]`), qui dorment jusqu'à la bénédiction « Nouveau socle ». Facultatif |
| `heros` | `true` : le joueur a un héros, le Grand Gardien, qu'il déplace sur la carte. Facultatif |
| `vagues` | la liste des vagues. Chaque vague contient des groupes `{ "type", "nombre", "ecart", "delai" }` : quel monstre, combien, les secondes entre deux monstres et les secondes avant le premier. Un groupe peut ajouter `"force": 2` pour des monstres deux fois plus résistants |

Si une fiche contient une erreur (champ manquant, mauvais type de monstre…), le jeu affiche la liste des problèmes à l'écran au lieu de démarrer.

Limite actuelle : le château est dessiné avec sa porte à gauche, donc le chemin doit arriver par la gauche.

## Équilibrage

Le moteur peut jouer tout seul, sans dessin, avec **9 joueurs imaginaires**. En regardant qui gagne et qui perd, on sait si un niveau a bien **la difficulté visée** par sa fiche. Les joueurs n'achètent que les gardiens que le niveau propose, quand ils arrivent ; un joueur qui n'a rien à acheter (« Que des Étincelle » dans un niveau du monde 1) ne joue pas.

**Dans le terminal :**

```bash
npm run equilibrage
```

Cette commande teste tous les niveaux. `npm run equilibrage -- essai` teste seulement `essai.json`, et `-- --parties 6` fait jouer 6 parties à chaque joueur au lieu de 3.

**Dans l'éditeur :** le bouton « Tester l’équilibrage », en bas du panneau. Survoler un joueur dans le tableau montre sur le plan où il a posé ses gardiens, avec « niv. 2 » ou « niv. 3 » en doré sous ceux qu'il a améliorés.

| Joueur imaginaire | Ce qu'il fait |
|---|---|
| Mélange bien placé | le bon joueur : une Braise, (au monde 3) un Prisme, une Braise, (au monde 2) une Étincelle, (au monde 3) une Pépite, puis Givrine, Grondin… sur les meilleurs socles, et il améliore quand c'est rentable |
| Mélange bien placé, sans améliorer | le même, qui n'améliore jamais : sert à savoir si les améliorations sont utiles |
| Que des Braise, bien placées | le joueur qui ne varie pas |
| Que des Étincelle, bien placées | l'autre joueur qui ne varie pas, au monde 2 (l'Étincelle est, comme la Braise, un gardien à tout faire) |
| Que des Prisme, bien placés | celui qui ne varie pas au monde 3 |
| Que des Braise, mal placées | le même, sur les pires socles |
| Mélange mal placé | le bon mélange, sur les pires socles |
| Que des Grondin / que des Givrine | un seul type de gardien |

**Le mélange du bon joueur** est une seule liste pour les trois mondes : Étincelle et Bourrasque (monde 2), Prisme et Pépite (monde 3) y sont glissés entre les gardiens du monde 1. Dans un niveau qui ne les propose pas, ils disparaissent de la liste, et il reste exactement le mélange d'avant : les résultats des mondes 1 et 2 n'ont pas bougé d'un pixel quand les mondes suivants sont arrivés. Au monde 2, l'Étincelle arrive en 3e : le bon joueur en a besoin tôt, contre les premiers Voltigeurs (un Grondin acheté trop tôt ne les touche pas).

Un « bon socle » est un socle qui voit beaucoup de chemin : on mesure la longueur de chemin à moins de 3 cases. Avant chaque vague, chaque joueur achète tout ce qu'il peut dans l'ordre de son plan : d'abord un gardien sur chaque socle, puis tous ses gardiens au niveau 2, puis au niveau 3.

Le bon joueur, lui, réfléchit un peu plus. Il met d'abord un gardien sur chaque bon socle. Ensuite, il compare ce qu'il peut payer : poser un nouveau gardien ou en améliorer un. Il choisit ce qui rapporte le plus de dégâts par pièce, en tenant compte du chemin que voit chaque socle. Chaque joueur joue plusieurs parties, avec des graines différentes, car le hasard déplace un peu les monstres. Le hasard du moteur part d'une **graine** : `creerPartie(niveau, 42)` rejoue toujours exactement la même partie. C'est pour ça que deux tests donnent les mêmes résultats. En jeu, la graine est tirée au hasard.

**Le verdict :**
- **Trop dur** : même le bon joueur perd.
- **Très facile** : un joueur maladroit gagne. C'est le but d'un didacticiel !
- **Facile** : des Braise (ou des Étincelle, ou des Prisme) bien placées suffisent.
- **Équilibré** : il faut mélanger les gardiens et bien les placer.

Il est comparé à la difficulté visée (`difficulte` dans la fiche) : « Objectif atteint », ou « Plus facile / plus dur que prévu », avec des conseils pour corriger. Didacticiel → très facile ; facile → facile ; normal → équilibré. Les 12 niveaux de la campagne et le niveau d'essai atteignent tous leur objectif.

**Une leçon du monde 2** : pour qu'un niveau soit « Équilibré », il doit punir chaque façon simple de jouer. Des foules serrées punissent les Braise seules (il faut toucher tout un groupe), des Cuirassés espacés punissent les Étincelle seules (l'éclair ne peut pas sauter d'un monstre à l'autre s'ils sont à plus de 2 cases), et des volants punissent les Grondin. Et comme au monde 1 : un début doux, et des dernières vagues très fournies, car c'est là que le mélange et les améliorations prennent l'avantage.

**La Pépite ne se juge pas en dégâts, mais en or.** Les joueurs imaginaires la posent sur le pire socle (elle n'a pas besoin de voir le chemin), et le bon joueur l'achète seulement si elle a encore le temps de rapporter **une fois et demie son prix** d'ici la fin du niveau (elle récolte à la fin de chaque vague, sauf la dernière) ; pareil pour ses améliorations. Dans un niveau de 8 vagues, il faut donc l'acheter avant la vague 2. Si c'est trop tard, il pose à sa place un gardien qui tire : au premier essai, il laissait ce socle vide toute la partie, avec 3 000 pièces en poche !

**Une leçon du monde 3** : dès la vague 5, le bon joueur a tous ses gardiens au niveau 3, et l'or s'entasse. Les dernières vagues ne testent donc plus son argent, mais sa **défense au complet**, et c'est là qu'on punit ceux qui ne varient pas : d'énormes foules au sol (le Grondin les balaie d'un coup, les Prisme seuls sont débordés) et des Carapaces dès les premières vagues (les éclairs de niveau 1 ricochent dessus). À l'inverse, les premières vagues décident de tout le reste : avec moins de monstres au début, le bon joueur gagne moins d'or… et il a perdu plus tard. Et pour un chef : son escorte doit partir devant lui, sinon elle le protège.

Il est accompagné de conseils : le bon joueur a-t-il eu chaud (« un monstre est passé à 0,2 case du château ») ? Quelle vague arrête le plus de joueurs ? Peut-on gagner sans jamais améliorer ses gardiens ? (C'est le cas du niveau d'essai : avec 10 socles, poser des gardiens partout suffit. Pour rendre les améliorations utiles, il faut moins de socles ou des dernières vagues plus fortes.)

**Le débutant** : chaque niveau (sauf l'arène) est aussi joué par un débutant, qui pose des Braise au hasard avec tout son or, puis lance la vague 1 ; et, si le niveau les propose dès le début, par un débutant qui achète d'abord une Pépite ou une Bourrasque (deux gardiens qui ne se battent presque pas). Dans un didacticiel ou un niveau facile, si la vague 1 est tenue moins d'une fois sur deux, un conseil le dit. C'est l'atelier de l'équilibrage, et les vraies parties, qui ont montré ce piège (voir « L'atelier de l'équilibrage »).

Le code est dans `src/jeu/equilibrage.js` (partagé par la commande `scripts/equilibrage.js`, par l'éditeur et par l'atelier de l'équilibrage, qui montre tout ça en courbes, avec les vraies parties par-dessus).

## Astuces de développement

Dans la console du navigateur (F12) :

- `__jeu.etat.or = 999` : de l'or à volonté pour tester ;
- `__jeu.avancer(3)` : fait avancer la partie de 3 secondes, puis redessine (pour tester même quand l'onglet est caché : le navigateur met alors la boucle du jeu en pause) ;
- `__jeu.agir('construire', 3, 'givrine')` : une décision, comme si le joueur avait cliqué (elle est enregistrée) ; `__jeu.enregistrement` : l'enregistrement de la partie en cours. Attention, `__jeu.etat.or = 999` n'est pas une décision : une partie « trichée » ainsi ne se rejoue pas pareil ;
- l'adresse `/__partie` du serveur de développement garde une partie dans `captures/parties/nom.json` ; `revoir.html?fichier=nom` la revoit, et `revoir.html?fichier=nom&test=1` la rejoue d'un coup et range le résultat à côté. On ouvre la même adresse dans Safari, Chrome et Firefox, et on compare : c'est ainsi qu'on a vérifié que le rejeu est exact partout ;
- sur la carte des époques (avec `npm run dev`) : « Ouvrir tous les niveaux (test) » (« Effacer la progression » est maintenant dans les options, pour tout le monde) ;
- `__capturer('nom')` : enregistre une capture du jeu dans `captures/nom.jpg` (seulement avec `npm run dev`) ;
- `__planche('nom')` (dans la galerie des personnages) : assemble les personnages affichés en une seule image, une ligne par personnage et une colonne par style, dans `captures/nom.jpg` ;
- `__editeur.etat.fiche` (dans la console de l'éditeur) : la fiche en cours de modification ;
- dans l'atelier des lumières : `__atelier.choisir({ niveau: 'monde3-3', style: 'voxel', ambiance: 'nuit' })`, `__atelier.planche()`, `__atelier.tourComplet({ styles: 'tous' })` (tous les niveaux dans les trois styles), `__atelier.capturer('nom', { ambiance: 'nuit', zone: [0.1, 0.1, 0.5, 0.5], avancer: 2 })` (une capture en grand, ou un gros plan, après avoir fait avancer la partie de 2 secondes) ;
- dans l'atelier de l'équilibrage : `__equilibrage.choisir('monde2-4')`, `__equilibrage.tourComplet()`, `__equilibrage.planche()`, `__equilibrage.avantApres()`, `__equilibrage.remplacer({ monstres: { gluant: { pv: 50 } } })` (des chiffres « après », en entier ou en partie) et `__equilibrage.resultats` (tous les relevés) ;
- `__jeu.son.effet('recolte')` (dans le jeu) ou `__son.effet('recolte')` (dans la salle des sons) : joue un bruitage ; `__jeu.son.reglages` : les volumes ; `__jeu.son.enCours` : quel thème joue, avec quel mixage, à quelle mesure ;
- l'adresse `/__son` du serveur de développement enregistre un son calculé hors ligne dans `captures/nom.wav` (c'est ainsi qu'on a vérifié la musique) ;
- pour essayer le serveur du classement sans salir le vrai : l'arène `essai`, par exemple `curl 'https://petits-gardiens-classement.vercel.app/api/scores?arene=essai'`. Les erreurs de la fonction s'affichent sur vercel.com, projet `petits-gardiens-classement`, onglet « Logs ».

## Décisions prises

- **Un style graphique différent par niveau** : c'est la signature du jeu. Les règles restent identiques, seul le dessin change.
- **Chaque monde est une époque du jeu vidéo** : le monde 1 en pixel art, le monde 2 en cartoon, le monde 3 en voxel doré. Les gardiens traversent les époques, et la progression graphique devient une récompense.
- Caméra : la **vue de jeu** (la vue « Cinéma » reste un bonus pour admirer).
- Les personnages actuels sont validés.

## Prochaines étapes (à décider ensemble)

1. Le petit moteur maison, brique par brique (terminé) :
   - ~~les niveaux deviennent des fiches~~ (fait : `src/niveaux/essai.json`) ;
   - ~~un éditeur de niveaux dans le navigateur~~ (fait : `editeur.html`) ;
   - ~~la simulation d'équilibrage lancée par une commande~~ (fait : `npm run equilibrage` et le bouton de l'éditeur) ;
   - ~~une fiche personnage pour trois rendus~~ (fait : l'apparence dans `donnees.js`, le vocabulaire dans `rendus/apparence.js`).
2. ~~Améliorer les gardiens : niveaux 2 et 3, un « skin » par amélioration~~ (fait : cape au niveau 2, couronne au niveau 3).
3. ~~Les premiers vrais niveaux du monde 1 (pixel art), avec une carte des époques~~ (fait : 4 niveaux, dont un didacticiel ; la progression est gardée).
4. ~~Un mode défi avec un classement~~ (fait : le mode survie et son classement).
5. ~~Le monde 2 (l'époque cartoon)~~ (fait : 5 nouveaux personnages, 4 niveaux dont un didacticiel et le combat contre le Colosse, et les ambiances du cartoon).
6. ~~Le monde 3 (l'époque voxel, aujourd'hui)~~ (fait : 5 nouveaux personnages, puis 4 niveaux dont un didacticiel et le combat contre le Dragon, avec leurs chiffres réglés par l'équilibrage).
7. ~~Sons et musique, écran d'options~~ (fait : un thème joué par trois orchestres, qui suit la partie, et les bruitages de chaque événement ; un second thème pour les combats de chef ; puis la fenêtre des options : son, vitesse, fiches, qualité graphique, taille de l'interface, caméra, progression).
8. ~~Mettre le jeu en ligne~~ (fait : GitHub Pages, publié tout seul à chaque envoi sur `main`).
9. ~~Le classement en ligne, pour comparer les scores entre amis~~ (fait : une fonction Vercel et une base Upstash Redis ; si le serveur ne répond pas, le score est gardé sur l'ordinateur).
10. ~~Enregistrer les parties, pour les revoir et régler le jeu avec de vraies parties~~ (fait : `revoir.html` et `npm run parties`).
11. ~~Le héros, plus vivant : de la vie (à zéro, K.O. jusqu'à la vague suivante) et des pouvoirs gagnés avec ses niveaux~~ (fait : la Peau de pierre au niveau 2, l'Onde de choc au 4, le Bond au 6 ; réglé avec les parties enregistrées).
12. ~~Un atelier des textures, et des textures refaites dans les trois styles~~ (fait : des recettes réglables et mesurées ; le voxel, puis le pixel art et le cartoon).
13. ~~Un atelier des modèles, pour que chaque personnage se voie bien, même pour un joueur daltonien~~ (fait : le Filou gris-bleu, le Gluant vert citron, la gelée qui luit en voxel).
14. ~~Un atelier de l'équilibrage, avec les vraies parties par-dessus~~ (fait : les niveaux en courbes, les chiffres du jeu dans une table, le banc d'essai et le débutant ; les pièges des premières vagues retirés de trois niveaux, et la vague 2 de la vallée du Colosse adoucie).
