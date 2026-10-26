// ============================================================
//  PATATE PLAGE - jeu en HTML / CSS / JavaScript natif
//  Mécaniques choisies : 02 Patate pourrie, 06 Combo de récolte,
//  28 Déplacement spécial (dash). Chronomètre = condition de fin.
//  Mécanique perso : "Coup de soleil" (jauge de chaleur + parasols).
// ============================================================

// ---------- Réglages (modifie ces valeurs pour changer le jeu) ----------
const REGLAGES = {
  dureePartie: 60,        // secondes
  vitessePatate: 220,     // pixels par seconde
  vitesseDash: 620,
  dureeDash: 0.15,        // secondes
  rechargeDash: 2,        // secondes
  intervalleApparition: 0.7,
  chancePourrie: 0.25,    // 25 % de patates pourries
  vieObjet: 6,            // secondes avant qu'une patate disparaisse
  // Coup de soleil
  chauffeSoleil: 10,      // points de chaleur par seconde au soleil
  refroidit: 30,          // points perdus par seconde sous un parasol
  dureeFrite: 1.5,        // secondes d'immobilisation quand on est frit
  penaliteFrite: 15,      // points perdus quand on est frit
  // Patates
  pointsBase: 10,
  penalitePourrie: 10,
  tempsPerduPourrie: 5,
  delaiCombo: 2,          // secondes pour enchaîner
  comboMax: 5
};

// ---------- Éléments de la page ----------
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const L = canvas.width;
const H = canvas.height;

const elScore = document.getElementById("score");
const elTemps = document.getElementById("temps");
const elCombo = document.getElementById("combo");
const elChaleur = document.getElementById("chaleur");
const elDash = document.getElementById("dash");
const elEcran = document.getElementById("ecran");
const elEcranTitre = document.getElementById("ecran-titre");
const elEcranTexte = document.getElementById("ecran-texte");
const elBouton = document.getElementById("bouton");

// ---------- Décor : les parasols (zones d'ombre) ----------
const parasols = [
  { x: 190, y: 190, r: 75 },
  { x: 610, y: 290, r: 75 },
  { x: 380, y: 410, r: 65 }
];

// ---------- État du jeu ----------
let etat = "menu"; // "menu" | "jeu" | "fin"
let joueur, objets, textes, score, tempsRestant, serie, minuteurCombo;
let chaleur, minuteurApparition, flashPourrie, record;

const touches = {};

// ---------- Record (localStorage) ----------
function lireRecord() {
  try {
    return Number(localStorage.getItem("patatePlageRecord")) || 0;
  } catch (e) {
    return 0;
  }
}
function sauverRecord(valeur) {
  try {
    localStorage.setItem("patatePlageRecord", String(valeur));
  } catch (e) {
    // localStorage indisponible : on ignore
  }
}
record = lireRecord();

// ---------- Démarrage / redémarrage ----------
function nouvellePartie() {
  joueur = {
    x: L / 2, y: H / 2, r: 18,
    dirX: 1, dirY: 0,
    dashRestant: 0, rechargeDash: 0,
    immobilise: 0
  };
  objets = [];
  textes = [];
  score = 0;
  tempsRestant = REGLAGES.dureePartie;
  serie = 0;
  minuteurCombo = 0;
  chaleur = 0;
  minuteurApparition = 0;
  flashPourrie = 0;
  etat = "jeu";
  elEcran.classList.add("cache");
}

function finDePartie() {
  etat = "fin";
  let message = "Score : " + score;
  if (score > record) {
    record = score;
    sauverRecord(record);
    message += " - nouveau record !";
  } else {
    message += " - record : " + record;
  }
  elEcranTitre.textContent = "Fin des vacances";
  elEcranTexte.textContent = message;
  elBouton.textContent = "Rejouer";
  elEcran.classList.remove("cache");
}

// ---------- Clavier ----------
window.addEventListener("keydown", (e) => {
  touches[e.key.toLowerCase()] = true;
  if (e.key === " " || e.key.startsWith("Arrow")) e.preventDefault();
  if (e.key === "Enter" && etat !== "jeu") nouvellePartie();
});
window.addEventListener("keyup", (e) => {
  touches[e.key.toLowerCase()] = false;
});
elBouton.addEventListener("click", nouvellePartie);

// ---------- Outils ----------
function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function alea(min, max) {
  return min + Math.random() * (max - min);
}
function estALOmbre() {
  return parasols.some((p) => distance(joueur, p) < p.r);
}
function ajouterTexte(x, y, contenu, couleur) {
  textes.push({ x, y, contenu, couleur, vie: 0.9 });
}

// ---------- Apparition des patates ----------
function faireApparaitre() {
  objets.push({
    x: alea(40, L - 40),
    y: alea(90, H - 40),   // on garde la zone de mer en haut libre
    r: 14,
    pourrie: Math.random() < REGLAGES.chancePourrie,
    vie: REGLAGES.vieObjet
  });
}

// ---------- Mise à jour ----------
function mettreAJour(dt) {
  tempsRestant -= dt;
  if (tempsRestant <= 0) {
    tempsRestant = 0;
    finDePartie();
    return;
  }

  // Déplacement
  if (joueur.immobilise > 0) {
    joueur.immobilise -= dt;
  } else {
    let dx = 0, dy = 0;
    if (touches["arrowleft"] || touches["q"] || touches["a"]) dx -= 1;
    if (touches["arrowright"] || touches["d"]) dx += 1;
    if (touches["arrowup"] || touches["z"] || touches["w"]) dy -= 1;
    if (touches["arrowdown"] || touches["s"]) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const n = Math.hypot(dx, dy);
      joueur.dirX = dx / n;
      joueur.dirY = dy / n;
    }

    // Dash (mécanique 28)
    if (touches[" "] && joueur.rechargeDash <= 0) {
      joueur.dashRestant = REGLAGES.dureeDash;
      joueur.rechargeDash = REGLAGES.rechargeDash;
    }

    let vitesse = REGLAGES.vitessePatate;
    let bouge = dx !== 0 || dy !== 0;
    if (joueur.dashRestant > 0) {
      vitesse = REGLAGES.vitesseDash;
      bouge = true; // le dash avance même sans touche de direction
      joueur.dashRestant -= dt;
    }
    if (bouge) {
      joueur.x += joueur.dirX * vitesse * dt;
      joueur.y += joueur.dirY * vitesse * dt;
    }
  }
  joueur.rechargeDash = Math.max(0, joueur.rechargeDash - dt);

  // Limites du terrain
  joueur.x = Math.max(joueur.r, Math.min(L - joueur.r, joueur.x));
  joueur.y = Math.max(60 + joueur.r, Math.min(H - joueur.r, joueur.y));

  // Coup de soleil (mécanique perso)
  if (estALOmbre()) {
    chaleur -= REGLAGES.refroidit * dt;
  } else {
    chaleur += REGLAGES.chauffeSoleil * dt;
  }
  chaleur = Math.max(0, Math.min(100, chaleur));
  if (chaleur >= 100) {
    joueur.immobilise = REGLAGES.dureeFrite;
    chaleur = 40;
    score = Math.max(0, score - REGLAGES.penaliteFrite);
    serie = 0;
    ajouterTexte(joueur.x, joueur.y - 30, "Frite ! -" + REGLAGES.penaliteFrite, "#c0392b");
  }

  // Apparition
  minuteurApparition -= dt;
  if (minuteurApparition <= 0) {
    faireApparaitre();
    minuteurApparition = REGLAGES.intervalleApparition;
  }

  // Patates : durée de vie + collisions
  for (let i = objets.length - 1; i >= 0; i--) {
    const o = objets[i];
    o.vie -= dt;
    if (o.vie <= 0) {
      objets.splice(i, 1);
      continue;
    }
    if (distance(joueur, o) < joueur.r + o.r) {
      ramasser(o);
      objets.splice(i, 1);
    }
  }

  // Combo (mécanique 06)
  if (minuteurCombo > 0) {
    minuteurCombo -= dt;
    if (minuteurCombo <= 0) serie = 0;
  }

  // Effets
  flashPourrie = Math.max(0, flashPourrie - dt);
  for (let i = textes.length - 1; i >= 0; i--) {
    textes[i].vie -= dt;
    textes[i].y -= 30 * dt;
    if (textes[i].vie <= 0) textes.splice(i, 1);
  }
}

function multiplicateur() {
  return Math.min(1 + Math.floor(serie / 3), REGLAGES.comboMax);
}

function ramasser(o) {
  if (o.pourrie) {
    // Patate pourrie (mécanique 02)
    score = Math.max(0, score - REGLAGES.penalitePourrie);
    tempsRestant = Math.max(0, tempsRestant - REGLAGES.tempsPerduPourrie);
    serie = 0;
    minuteurCombo = 0;
    flashPourrie = 0.3;
    ajouterTexte(o.x, o.y, "Beurk ! -" + REGLAGES.penalitePourrie + " / -" + REGLAGES.tempsPerduPourrie + "s", "#4d7c0f");
  } else {
    serie += 1;
    minuteurCombo = REGLAGES.delaiCombo;
    const gain = REGLAGES.pointsBase * multiplicateur();
    score += gain;
    ajouterTexte(o.x, o.y, "+" + gain, "#7a4a12");
  }
}

// ---------- Dessin ----------
function dessinerDecor() {
  // Sable
  ctx.fillStyle = "#f2d9a6";
  ctx.fillRect(0, 0, L, H);
  // Mer
  ctx.fillStyle = "#2a8fa8";
  ctx.fillRect(0, 0, L, 50);
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= L; x += 20) {
    const y = 50 + Math.sin(x / 20 + performance.now() / 400) * 4;
    if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();

  // Ombres des parasols
  parasols.forEach((p) => {
    ctx.fillStyle = "rgba(60, 40, 20, 0.22)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  });
  // Parasols (vus du dessus, par-dessus les patates plus tard si besoin)
  parasols.forEach((p) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#e4572e" : "#fff6e0";
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, 22, (i * Math.PI) / 4, ((i + 1) * Math.PI) / 4);
      ctx.closePath();
      ctx.fill();
    }
  });
}

function dessinerPatate(x, y, r, couleur, contour) {
  ctx.fillStyle = couleur;
  ctx.strokeStyle = contour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.2, r, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

function dessinerObjets() {
  objets.forEach((o) => {
    // clignote quand elle va disparaître
    if (o.vie < 1.5 && Math.floor(o.vie * 8) % 2 === 0) return;
    if (o.pourrie) {
      dessinerPatate(o.x, o.y, o.r, "#7f9a3a", "#3f5a14");
      ctx.fillStyle = "#3f5a14";
      ctx.beginPath(); ctx.arc(o.x - 4, o.y - 3, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + 5, o.y + 3, 3, 0, Math.PI * 2); ctx.fill();
    } else {
      dessinerPatate(o.x, o.y, o.r, "#e0a752", "#7a4a12");
      ctx.fillStyle = "#7a4a12";
      ctx.beginPath(); ctx.arc(o.x - 4, o.y - 2, 1.8, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(o.x + 5, o.y + 3, 1.8, 0, Math.PI * 2); ctx.fill();
    }
  });
}

function dessinerJoueur() {
  // La patate rougit avec la chaleur
  const t = chaleur / 100;
  const rouge = Math.round(176 + 40 * t);
  const vert = Math.round(123 - 70 * t);
  const bleu = Math.round(69 - 30 * t);
  let couleur = "rgb(" + rouge + "," + vert + "," + bleu + ")";
  if (joueur.immobilise > 0) couleur = "#f7c948"; // frite dorée

  const p = joueur;
  dessinerPatate(p.x, p.y, p.r, couleur, "#3b2a1a");

  // Lunettes de soleil
  ctx.fillStyle = "#1c1c1c";
  ctx.fillRect(p.x - 12, p.y - 7, 10, 7);
  ctx.fillRect(p.x + 2, p.y - 7, 10, 7);
  ctx.fillRect(p.x - 3, p.y - 5, 6, 2);
  // Sourire
  ctx.strokeStyle = "#3b2a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y + 4, 6, 0.2, Math.PI - 0.2);
  ctx.stroke();

  // Vapeur quand ça chauffe fort
  if (chaleur > 70) {
    ctx.strokeStyle = "rgba(255,255,255,0.8)";
    ctx.beginPath();
    ctx.moveTo(p.x - 6, p.y - 22);
    ctx.quadraticCurveTo(p.x - 12, p.y - 30, p.x - 6, p.y - 36);
    ctx.moveTo(p.x + 6, p.y - 22);
    ctx.quadraticCurveTo(p.x + 12, p.y - 30, p.x + 6, p.y - 36);
    ctx.stroke();
  }
}

function dessinerTextes() {
  ctx.font = "bold 18px 'Trebuchet MS', sans-serif";
  ctx.textAlign = "center";
  textes.forEach((t) => {
    ctx.globalAlpha = Math.max(0, t.vie / 0.9);
    ctx.fillStyle = t.couleur;
    ctx.fillText(t.contenu, t.x, t.y);
  });
  ctx.globalAlpha = 1;
}

function dessiner() {
  dessinerDecor();
  if (etat === "menu") return;
  dessinerObjets();
  dessinerJoueur();
  dessinerTextes();
  if (flashPourrie > 0) {
    ctx.fillStyle = "rgba(90, 140, 20, " + flashPourrie + ")";
    ctx.fillRect(0, 0, L, H);
  }
}

// ---------- Interface (HUD) ----------
function majHud() {
  if (etat === "menu") return;
  elScore.textContent = score;
  elTemps.textContent = Math.ceil(tempsRestant);
  elCombo.textContent = "x" + multiplicateur();
  elChaleur.style.width = chaleur + "%";
  const prete = 1 - joueur.rechargeDash / REGLAGES.rechargeDash;
  elDash.style.width = prete * 100 + "%";
}

// ---------- Boucle principale ----------
let dernier = performance.now();
function boucle(maintenant) {
  const dt = Math.min((maintenant - dernier) / 1000, 0.05);
  dernier = maintenant;
  if (etat === "jeu") mettreAJour(dt);
  dessiner();
  majHud();
  requestAnimationFrame(boucle);
}
requestAnimationFrame(boucle);
