// ─────────────────────────────────────────────────────────────
// Petits outils partagés par les deux styles 3D (voxel et cartoon)
// ─────────────────────────────────────────────────────────────
import * as THREE from 'three';

// Garde un objet 3D par élément du jeu (monstre, gardien, tir), repéré par une clé.
// - crée l'objet quand un élément apparaît
// - le met à jour à chaque image
// - le supprime quand l'élément disparaît de l'état du jeu
// La clé est l'id de l'élément, sauf si on en donne une autre : pour les gardiens,
// c'est « id + niveau ». Quand un gardien est amélioré, sa clé change : l'ancien
// objet est retiré et un nouveau est fabriqué avec l'apparence du nouveau niveau.
// sortie (facultatif) : une petite animation de départ (un monstre battu qui s'écrase).
// sortie(vue, t) est appelée à chaque image avec le temps écoulé depuis le départ ;
// tant qu'elle renvoie true, l'objet reste dans la scène.
export class Synchro {
  constructor(scene, creer, maj, retirer, cle = (element) => element.id) {
    this.scene = scene;
    this.creer = creer;
    this.maj = maj;
    this.retirer = retirer;
    this.cle = cle;
    this.objets = new Map();
    this.sortie = null;
    this.sortants = []; // les objets en train de partir : { vue, t }
  }
  appliquer(liste, ...extra) {
    const vus = new Set();
    for (const element of liste) {
      const cle = this.cle(element);
      let vue = this.objets.get(cle);
      if (!vue) {
        vue = this.creer(element);
        this.objets.set(cle, vue);
        this.scene.add(vue.racine);
      }
      this.maj(vue, element, ...extra);
      vus.add(cle);
    }
    for (const [cle, vue] of this.objets) {
      if (vus.has(cle)) continue;
      if (this.sortie) { this.objets.delete(cle); this.sortants.push({ vue, t: 0 }); } // il part en douceur
      else this.enlever(cle, vue);
    }
  }
  // Fait avancer les animations de départ (dt : le temps écoulé depuis l'image précédente)
  majSortants(dt) {
    this.sortants = this.sortants.filter((s) => {
      s.t += dt;
      if (this.sortie(s.vue, s.t)) return true;
      this.scene.remove(s.vue.racine);
      this.retirer?.(s.vue);
      return false;
    });
  }
  enlever(cle, vue) {
    this.scene.remove(vue.racine);
    this.retirer?.(vue);
    this.objets.delete(cle);
  }
  vider() {
    for (const [cle, vue] of this.objets) this.enlever(cle, vue);
    for (const s of this.sortants) { this.scene.remove(s.vue.racine); this.retirer?.(s.vue); }
    this.sortants = [];
  }
}

// Système de particules : un seul « paquet » de petits cubes (InstancedMesh),
// ce qui permet d'en afficher des centaines sans ralentir.
export class Particules {
  constructor(scene, max = 900, geometrie = new THREE.BoxGeometry(1, 1, 1)) {
    this.max = max;
    this.liste = [];
    const materiau = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geometrie, materiau, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, new THREE.Color());
    scene.add(this.mesh);
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  // options : position, vitesse, couleur, taille, vie, gravite, eclat (>1 = brille)
  emettre({ x, y, z, vx = 0, vy = 0, vz = 0, couleur = '#fff', taille = 0.08, vie = 0.6, gravite = -6, eclat = 1, frein = 1 }) {
    if (this.liste.length >= this.max) this.liste.shift();
    const c = new THREE.Color(couleur).multiplyScalar(eclat);
    this.liste.push({ x, y, z, vx, vy, vz, c, taille, vie, vieMax: vie, gravite, frein, rot: Math.random() * 6 });
  }
  maj(dt) {
    const vivantes = [];
    for (const p of this.liste) {
      p.vie -= dt;
      if (p.vie <= 0) continue;
      p.vy += p.gravite * dt;
      const f = Math.pow(p.frein, dt * 60);
      p.vx *= f; p.vy *= f; p.vz *= f;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < -0.05 && p.gravite < 0) { p.y = -0.05; p.vy *= -0.3; p.vx *= 0.6; p.vz *= 0.6; }
      p.rot += dt * 4;
      vivantes.push(p);
    }
    this.liste = vivantes;
    for (let i = 0; i < this.max; i++) {
      const p = this.liste[i];
      if (!p) { this.mesh.setMatrixAt(i, this.zero); continue; }
      const t = p.vie / p.vieMax;
      this.s.setScalar(p.taille * (0.3 + 0.7 * t));
      this.q.setFromEuler(this.e.set(p.rot, p.rot * 0.7, 0));
      this.m.compose(this.p.set(p.x, p.y, p.z), this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, p.c);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  vider() { this.liste = []; }
}

// Petite barre de vie qui flotte au-dessus d'un monstre et fait face à la caméra
export function creerBarreDeVie(largeur = 0.5) {
  const groupe = new THREE.Group();
  const fond = new THREE.Mesh(
    new THREE.PlaneGeometry(largeur + 0.04, 0.09),
    new THREE.MeshBasicMaterial({ color: '#1a1012', toneMapped: false, depthWrite: false }),
  );
  const plein = new THREE.Mesh(
    new THREE.PlaneGeometry(largeur, 0.05),
    new THREE.MeshBasicMaterial({ color: '#7be04a', toneMapped: false, depthWrite: false }),
  );
  plein.position.z = 0.001;
  groupe.add(fond, plein);
  groupe.renderOrder = 10;
  fond.renderOrder = 10;
  plein.renderOrder = 11;
  groupe.userData = { plein, largeur };
  return groupe;
}
const qParent = new THREE.Quaternion();
export function majBarreDeVie(barre, ratio, camera) {
  const { plein, largeur } = barre.userData;
  barre.visible = ratio < 0.999;
  plein.scale.x = Math.max(0.001, ratio);
  plein.position.x = -(1 - ratio) * largeur / 2;
  plein.material.color.set(ratio > 0.5 ? '#7be04a' : ratio > 0.25 ? '#f2c230' : '#ec4a3a');
  // La barre est accrochée au monstre, qui tourne quand il marche : on annule
  // la rotation du monstre pour que la barre reste toujours face à la caméra.
  barre.parent.getWorldQuaternion(qParent);
  barre.quaternion.copy(qParent.invert().multiply(camera.quaternion));
}

// Trouve le socle le plus proche d'un point du sol (en cases)
export function socleProche(emplacements, x, y, rayon = 0.75) {
  let meilleur = -1, min = rayon;
  emplacements.forEach((e, i) => {
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < min) { min = d; meilleur = i; }
  });
  return meilleur;
}

// Angle 2D du jeu (atan2(dy, dx)) → rotation autour de l'axe vertical en 3D,
// pour qu'un modèle dont l'avant regarde vers +Z se tourne dans la bonne direction.
export const versRotationY = (angle) => Math.atan2(Math.cos(angle), Math.sin(angle));

// Pour l'atelier des modèles : un personnage photographié sans son ombre (la photo « avec lui » ne
// doit montrer que lui : voir rendus/lisibilite.js). oui = false : ses morceaux ne projettent plus
// d'ombre, et son ombre ronde (s'il en a une) disparaît ; oui = true : tout revient comme avant.
export function ombrerVue(vue, oui) {
  if (!oui && vue.ombre) vue.ombre.visible = false;
  if ((vue.sansOmbre ?? false) === !oui) return;
  if (oui && vue.ombre) vue.ombre.visible = true;
  vue.sansOmbre = !oui;
  vue.racine.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.ombreAvant ??= o.castShadow;
    o.castShadow = oui && o.userData.ombreAvant;
  });
}

// Libère la mémoire graphique d'un objet et de ses enfants
export function liberer(objet) {
  objet.traverse((o) => {
    o.geometry?.dispose();
    const m = o.material;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}

// ── Les portraits (pour les fiches du didacticiel) ──
// Un petit moteur de rendu à part, sur fond transparent : « l'appareil photo ».
// Chaque style en crée un (la première fois qu'il en a besoin) et le libère dans detruire().
export function creerAppareilPhoto() {
  const appareil = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  appareil.setClearColor(0x000000, 0); // fond transparent
  appareil.toneMapping = THREE.NeutralToneMapping;
  return appareil;
}

// Photographie un personnage tout seul, avec ses lumières, et renvoie l'image (un canvas).
// La caméra recule juste assez pour voir tout le personnage, un peu de côté et d'en haut.
export function photographier(appareil, personnage, lumieres, taille = 256) {
  appareil.setSize(taille, taille, false);
  const scene = new THREE.Scene();
  scene.add(personnage, ...lumieres);
  const sphere = new THREE.Box3().setFromObject(personnage).getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(26, 1, 0.01, 100);
  const direction = new THREE.Vector3(0.5, 0.42, 1).normalize();
  camera.position.copy(sphere.center).addScaledVector(direction, sphere.radius / Math.sin(THREE.MathUtils.degToRad(13)));
  camera.lookAt(sphere.center);
  appareil.render(scene, camera);
  const image = document.createElement('canvas');
  image.width = image.height = taille;
  image.getContext('2d').drawImage(appareil.domElement, 0, 0);
  personnage.traverse((o) => o.geometry?.dispose()); // ses formes ne servent plus
  return image;
}
