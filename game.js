// =========================
// FIREBASE CONFIG
// =========================
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, query, orderByChild, limitToLast, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDnPIwUvzC5d_caDx2Jq9b5mVpsdX9rKNY",
  authDomain: "runner-arcade-77ba6.firebaseapp.com",
  databaseURL: "https://runner-arcade-77ba6-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "runner-arcade-77ba6",
  storageBucket: "runner-arcade-77ba6.firebasestorage.app",
  messagingSenderId: "569587415547",
  appId: "1:569587415547:web:3099613cd76d5db42a335e"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// =========================
// CONFIG JEU
// =========================
const GAME_WIDTH = 360;
const GAME_HEIGHT = 640;
const GROUND_Y = GAME_HEIGHT - 50;

let player, obstacles;
let score = 0;
let scoreText;
let nameText;
let playerName = "";
let gameOver = false;
let spawnTimer;
let bg;
let gameStarted = false;

let baseSpeed = 220;
let bgSpeed = 3;
let scoreTimer = 0;

// --- Pause
let isPaused = false;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 1200 }, debug: false }
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

// =========================
// PRELOAD
// =========================
function preload() {
  this.load.image('player', 'assets/player.png');
  this.load.image('obstacle', 'assets/obstacle.png');
  this.load.image('background', 'assets/background.png');
}

// =========================
// CREATE
// =========================
function create() {
  const scene = this;

  // Background
  bg = scene.add.tileSprite(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 'background');

  // Sol invisible
  const ground = scene.add.rectangle(GAME_WIDTH/2, GROUND_Y, GAME_WIDTH, 10);
  scene.physics.add.existing(ground, true);
  ground.setVisible(false);

  // Joueur
  player = scene.physics.add.sprite(80, -200, 'player');
  player.setOrigin(0.5, 1);
  player.setScale(0.15);
  player.setCollideWorldBounds(true);
  player.setBounce(0.2);
  scene.physics.add.collider(player, ground);

  // Obstacles
  obstacles = scene.physics.add.group();
  scene.physics.add.collider(obstacles, ground);
  scene.physics.add.overlap(player, obstacles, hit, null, scene);

  // Score et pseudo
  scoreText = scene.add.text(10, 10, 'SCORE: 0', { fontFamily: 'Courier', fontSize: '24px', color: '#00ff00' });
  nameText = scene.add.text(GAME_WIDTH/2, 40, "", { fontFamily: 'Courier', fontSize: '20px', color: '#00ff00' }).setOrigin(0.5);

  showInput(scene);
}

// =========================
// INPUT PSEUDO
// =========================
function showInput(scene) {
  const inputElement = document.createElement("input");
  inputElement.type = "text";
  inputElement.placeholder = "Pseudo (max 7 caractères)";
  inputElement.maxLength = 7;
  inputElement.style.position = "absolute";
  inputElement.style.top = "50%";
  inputElement.style.left = "50%";
  inputElement.style.transform = "translate(-50%, -50%)";
  inputElement.style.width = "220px";
  inputElement.style.height = "40px";
  inputElement.style.fontSize = "20px";
  inputElement.style.textAlign = "center";
  inputElement.style.border = "2px solid #000";
  inputElement.style.borderRadius = "8px";
  inputElement.style.outline = "none";
  document.body.appendChild(inputElement);

  inputElement.addEventListener("input", () => {
    inputElement.value = inputElement.value.replace(/\s/g, "");
  });

  inputElement.addEventListener("keydown", (e) => {
    if(e.key === "Enter" && inputElement.value.length > 0){
      playerName = inputElement.value.substring(0,7);
      nameText.setText(playerName);
      inputElement.style.display = "none";
      startGame(scene);
    }
  });
}

// =========================
// START GAME
// =========================
function startGame(scene){
  gameStarted = true;
  player.body.allowGravity = true;
  player.setVelocityY(300);

  spawnTimer = scene.time.addEvent({ delay:1400, loop:true, callback:spawnObstacle, callbackScope:scene });

  scene.input.on('pointerdown', jump);
  scene.input.keyboard.on('keydown-SPACE', jump);

  function jump() {
    if(gameOver) return;
    if(player.body.blocked.down) player.setVelocityY(-520);
  }
}

// =========================
// OBSTACLES
// =========================
function spawnObstacle(){
  if(gameOver || !gameStarted) return;
  const obs = obstacles.create(GAME_WIDTH+40, GROUND_Y, 'obstacle');
  obs.setOrigin(0.5,1);
  obs.setScale(0.15);
  obs.body.setSize(obs.width, obs.height);
  obs.setVelocityX(-baseSpeed);
  obs.body.allowGravity = false;
  obs.setImmovable(true);
}

// =========================
// HIT / GAME OVER
// =========================
function hit(){
  if(!gameStarted) return;
  gameOver = true;
  player.setTint(0xff0000);
  spawnTimer.remove();

  saveScoreOnline(playerName, score);

  getTop10Leaderboard((scores) => {
    showLeaderboard(this, scores);
  });
}

// =========================
// SCORE ONLINE
// =========================
function saveScoreOnline(name, score){
  if(!name || score<=0) return;
  push(ref(database,'leaderboard'), { name:name, score:score });
}

// =========================
// GET TOP 10
// =========================
function getTop10Leaderboard(callback){
  const leaderboardRef = query(ref(database,'leaderboard'), orderByChild('score'), limitToLast(10));
  onValue(leaderboardRef, snapshot => {
    let scores = [];
    snapshot.forEach(child => scores.push(child.val()));
    scores.sort((a,b)=>b.score-a.score);
    callback(scores);
  });
}

// =========================
// SHOW LEADERBOARD
// =========================
function showLeaderboard(scene, scores){
  const boardBg = scene.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, 300, 420, 0x000000, 0.8).setStrokeStyle(3,0xffd700);
  const title = scene.add.text(GAME_WIDTH/2, GAME_HEIGHT/2 -180, "🏆 TOP 10", { fontFamily:"Courier", fontSize:"28px", color:"#FFD700", fontStyle:"bold" }).setOrigin(0.5);
  let startY = GAME_HEIGHT/2 - 140;

  scores.forEach((entry,i)=>{
    let color = "#FFFFFF";
    if(i===0) color="#FFD700";
    if(i===1) color="#C0C0C0";
    if(i===2) color="#cd7f32";

    scene.add.text(GAME_WIDTH/2, startY+i*28, `${i+1}. ${entry.name} - ${entry.score}`, { fontFamily:"Courier", fontSize:"20px", color:color }).setOrigin(0.5);
  });

  const closeBtn = scene.add.text(GAME_WIDTH/2, GAME_HEIGHT/2+170, "FERMER", { fontFamily:"Courier", fontSize:"22px", color:"#FFD700", fontStyle:"bold" }).setOrigin(0.5).setInteractive({ useHandCursor:true });
  closeBtn.on("pointerdown",()=>{
    boardBg.destroy();
    title.destroy();
    closeBtn.destroy();
    scene.children.list.forEach(obj => { if(obj.text && obj.text.includes(". ")) obj.destroy(); });
  });
}

// =========================
// UPDATE
// =========================
function update(time,delta){
  if(!gameStarted || gameOver) return;

  scoreTimer += delta;
  if(scoreTimer >= 2000){
    score++;
    scoreText.setText('SCORE: '+score);
    scoreTimer = 0;
    baseSpeed += 5;
    bgSpeed += 0.05;
  }
  bg.tilePositionX += bgSpeed;

  obstacles.getChildren().forEach(o=>{
    o.setVelocityX(-baseSpeed);
    if(o.x < -50) o.destroy();
  });
}
// =========================
// FIREBASE CONFIG
// =========================
import { initializeApp } from "firebase/app";
import { getDatabase, ref, push, query, orderByChild, limitToLast, onValue } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDnPIwUvzC5d_caDx2Jq9b5mVpsdX9rKNY",
  authDomain: "runner-arcade-77ba6.firebaseapp.com",
  databaseURL: "https://runner-arcade-77ba6-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "runner-arcade-77ba6",
  storageBucket: "runner-arcade-77ba6.firebasestorage.app",
  messagingSenderId: "569587415547",
  appId: "1:569587415547:web:3099613cd76d5db42a335e"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

// =========================
// CONFIG JEU
// =========================
const GAME_WIDTH = 360;
const GAME_HEIGHT = 640;
const GROUND_Y = GAME_HEIGHT - 50;

let player, obstacles;
let score = 0;
let scoreText;
let nameText;
let playerName = "";
let gameOver = false;
let spawnTimer;
let bg;
let gameStarted = false;

let baseSpeed = 220;
let bgSpeed = 3;
let scoreTimer = 0;

// --- Pause
let isPaused = false;

const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#000000',
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 1200 }, debug: false }
  },
  scene: { preload, create, update }
};

new Phaser.Game(config);

// =========================
// PRELOAD
// =========================
function preload() {
  this.load.image('player', 'assets/player.png');
  this.load.image('obstacle', 'assets/obstacle.png');
  this.load.image('background', 'assets/background.png');
}

// =========================
// CREATE
// =========================
function create() {
  const scene = this;

  // Background
  bg = scene.add.tileSprite(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 'background');

  // Sol invisible
  const ground = scene.add.rectangle(GAME_WIDTH/2, GROUND_Y, GAME_WIDTH, 10);
  scene.physics.add.existing(ground, true);
  ground.setVisible(false);

  // Joueur
  player = scene.physics.add.sprite(80, -200, 'player');
  player.setOrigin(0.5, 1);
  player.setScale(0.15);
  player.setCollideWorldBounds(true);
  player.setBounce(0.2);
  scene.physics.add.collider(player, ground);

  // Obstacles
  obstacles = scene.physics.add.group();
  scene.physics.add.collider(obstacles, ground);
  scene.physics.add.overlap(player, obstacles, hit, null, scene);

  // Score et pseudo
  scoreText = scene.add.text(10, 10, 'SCORE: 0', { fontFamily: 'Courier', fontSize: '24px', color: '#00ff00' });
  nameText = scene.add.text(GAME_WIDTH/2, 40, "", { fontFamily: 'Courier', fontSize: '20px', color: '#00ff00' }).setOrigin(0.5);

  showInput(scene);
}

// =========================
// INPUT PSEUDO
// =========================
function showInput(scene) {
  const inputElement = document.createElement("input");
  inputElement.type = "text";
  inputElement.placeholder = "Pseudo (max 7 caractères)";
  inputElement.maxLength = 7;
  inputElement.style.position = "absolute";
  inputElement.style.top = "50%";
  inputElement.style.left = "50%";
  inputElement.style.transform = "translate(-50%, -50%)";
  inputElement.style.width = "220px";
  inputElement.style.height = "40px";
  inputElement.style.fontSize = "20px";
  inputElement.style.textAlign = "center";
  inputElement.style.border = "2px solid #000";
  inputElement.style.borderRadius = "8px";
  inputElement.style.outline = "none";
  document.body.appendChild(inputElement);

  inputElement.addEventListener("input", () => {
    inputElement.value = inputElement.value.replace(/\s/g, "");
  });

  inputElement.addEventListener("keydown", (e) => {
    if(e.key === "Enter" && inputElement.value.length > 0){
      playerName = inputElement.value.substring(0,7);
      nameText.setText(playerName);
      inputElement.style.display = "none";
      startGame(scene);
    }
  });
}

// =========================
// START GAME
// =========================
function startGame(scene){
  gameStarted = true;
  player.body.allowGravity = true;
  player.setVelocityY(300);

  spawnTimer = scene.time.addEvent({ delay:1400, loop:true, callback:spawnObstacle, callbackScope:scene });

  scene.input.on('pointerdown', jump);
  scene.input.keyboard.on('keydown-SPACE', jump);

  function jump() {
    if(gameOver) return;
    if(player.body.blocked.down) player.setVelocityY(-520);
  }
}

// =========================
// OBSTACLES
// =========================
function spawnObstacle(){
  if(gameOver || !gameStarted) return;
  const obs = obstacles.create(GAME_WIDTH+40, GROUND_Y, 'obstacle');
  obs.setOrigin(0.5,1);
  obs.setScale(0.15);
  obs.body.setSize(obs.width, obs.height);
  obs.setVelocityX(-baseSpeed);
  obs.body.allowGravity = false;
  obs.setImmovable(true);
}

// =========================
// HIT / GAME OVER
// =========================
function hit(){
  if(!gameStarted) return;
  gameOver = true;
  player.setTint(0xff0000);
  spawnTimer.remove();

  saveScoreOnline(playerName, score);

  getTop10Leaderboard((scores) => {
    showLeaderboard(this, scores);
  });
}

// =========================
// SCORE ONLINE
// =========================
function saveScoreOnline(name, score){
  if(!name || score<=0) return;
  push(ref(database,'leaderboard'), { name:name, score:score });
}

// =========================
// GET TOP 10
// =========================
function getTop10Leaderboard(callback){
  const leaderboardRef = query(ref(database,'leaderboard'), orderByChild('score'), limitToLast(10));
  onValue(leaderboardRef, snapshot => {
    let scores = [];
    snapshot.forEach(child => scores.push(child.val()));
    scores.sort((a,b)=>b.score-a.score);
    callback(scores);
  });
}

// =========================
// SHOW LEADERBOARD
// =========================
function showLeaderboard(scene, scores){
  const boardBg = scene.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, 300, 420, 0x000000, 0.8).setStrokeStyle(3,0xffd700);
  const title = scene.add.text(GAME_WIDTH/2, GAME_HEIGHT/2 -180, "🏆 TOP 10", { fontFamily:"Courier", fontSize:"28px", color:"#FFD700", fontStyle:"bold" }).setOrigin(0.5);
  let startY = GAME_HEIGHT/2 - 140;

  scores.forEach((entry,i)=>{
    let color = "#FFFFFF";
    if(i===0) color="#FFD700";
    if(i===1) color="#C0C0C0";
    if(i===2) color="#cd7f32";

    scene.add.text(GAME_WIDTH/2, startY+i*28, `${i+1}. ${entry.name} - ${entry.score}`, { fontFamily:"Courier", fontSize:"20px", color:color }).setOrigin(0.5);
  });

  const closeBtn = scene.add.text(GAME_WIDTH/2, GAME_HEIGHT/2+170, "FERMER", { fontFamily:"Courier", fontSize:"22px", color:"#FFD700", fontStyle:"bold" }).setOrigin(0.5).setInteractive({ useHandCursor:true });
  closeBtn.on("pointerdown",()=>{
    boardBg.destroy();
    title.destroy();
    closeBtn.destroy();
    scene.children.list.forEach(obj => { if(obj.text && obj.text.includes(". ")) obj.destroy(); });
  });
}

// =========================
// UPDATE
// =========================
function update(time,delta){
  if(!gameStarted || gameOver) return;

  scoreTimer += delta;
  if(scoreTimer >= 2000){
    score++;
    scoreText.setText('SCORE: '+score);
    scoreTimer = 0;
    baseSpeed += 5;
    bgSpeed += 0.05;
  }
  bg.tilePositionX += bgSpeed;

  obstacles.getChildren().forEach(o=>{
    o.setVelocityX(-baseSpeed);
    if(o.x < -50) o.destroy();
  });
}
