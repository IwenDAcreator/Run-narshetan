const GAME_WIDTH = 360; 
const GAME_HEIGHT = 640;
const GROUND_Y = GAME_HEIGHT - 50;

let player;
let obstacles;
let score = 0;
let bestScore = 0;
let scoreText;
let bestText;
let nameText;
let playerName = ""; // pseudo pour la session
let gameOver = false;
let spawnTimer;
let bg; 
let inputElement;
let gameStarted = false;

let baseSpeed = 220;
let bgSpeed = 3;
let scoreTimer = 0;

// --- Variables pause
let isPaused = false;
let pauseBtn;
let pauseOverlay;
let pauseText;
let pauseBtnContainer; // cadre rond

// =========================
// FIREBASE CONFIGURATION
// =========================
if (!firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyDnPIwUvzC5d_caDx2Jq9b5mVpsdX9rKNY",
    authDomain: "runner-arcade-77ba6.firebaseapp.com",
    databaseURL: "https://runner-arcade-77ba6-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "runner-arcade-77ba6",
    storageBucket: "runner-arcade-77ba6.firebasestorage.app",
    messagingSenderId: "569587415547",
    appId: "1:569587415547:web:3099613cd76d5db42a335e"
  };
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// =========================
// PHASER CONFIG
// =========================
const config = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game',
  backgroundColor: '#aaaaaa',
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
  // Sprite sheet du joueur (7 frames horizontales)
  this.load.spritesheet('player', 'assets/player_run.png', {
    frameWidth: 71, // 500 / 7 ≈ 71
    frameHeight: 86
  });
  this.load.image('obstacle', 'assets/obstacle.png');
  this.load.image('background', 'assets/background.png');
}

// =========================
// CREATE
// =========================
function create() {
  const scene = this;

  bg = scene.add.tileSprite(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 'background');

  const ground = scene.add.rectangle(GAME_WIDTH / 2, GROUND_Y, GAME_WIDTH, 10);
  scene.physics.add.existing(ground, true);
  ground.setVisible(false);

  player = scene.physics.add.sprite(80, -200, 'player'); 
  player.setOrigin(0.5, 1);
  player.setScale(1);
  player.body.setSize(47,85);
  player.body.setOffset(0, 0);
  player.setCollideWorldBounds(true);
  player.setBounce(0.2);
  scene.physics.add.collider(player, ground);

  // =========================
  // Création de l'animation de course
  // =========================
  scene.anims.create({
    key: 'run',
    frames: scene.anims.generateFrameNumbers('player', { start: 0, end: 6 }),
    frameRate: 10,
    repeat: -1
  });

  // Lancer l'animation
  player.play('run');

  obstacles = scene.physics.add.group();
  scene.physics.add.collider(obstacles, ground);
  scene.physics.add.overlap(player, obstacles, hit, null, scene);

  scoreText = scene.add.text(10, 10, 'Score: 0', { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', fill: '#000' });
  bestText = scene.add.text(GAME_WIDTH - 10, 10, 'Best: ' + bestScore, { fontFamily: 'Arial', fontSize: '28px', fontStyle: 'bold', fill: '#000' }).setOrigin(1, 0);

  const rect = scene.add.rectangle(GAME_WIDTH / 2, 60, 180, 30, 0xffffff, 0.8).setStrokeStyle(3, 0x000000, 1);
  rect.setOrigin(0.5, 0.5);
  nameText = scene.add.text(GAME_WIDTH / 2, 60, playerName, { fontFamily: "Arial", fontSize: "20px", fontStyle: "bold", fill: "#000" }).setOrigin(0.5, 0.5);

  scene.tweens.add({ targets: rect, scaleX: 1.05, scaleY: 1.05, duration: 800, yoyo: true, repeat: -1 });

  pauseBtnContainer = scene.add.circle(GAME_WIDTH / 2, 20, 18, 0xffffff); 
  pauseBtnContainer.setStrokeStyle(3, 0x000000); 
  pauseBtnContainer.setInteractive({ useHandCursor: true });
  pauseBtn = scene.add.text(GAME_WIDTH / 2, 20, "⏸", { fontSize: "20px", fontFamily: "Arial", color: "#000000", fontStyle: "bold" }).setOrigin(0.5);
  pauseBtnContainer.on("pointerdown", ()=>{ if(!gameOver && gameStarted) togglePause(scene); });
  pauseBtn.on("pointerdown", ()=>{ if(!gameOver && gameStarted) togglePause(scene); });

  if (!playerName) showInput(scene);
  else startGame(scene); 
}

// =========================
// SHOW INPUT
// =========================
function showInput(scene) {
  inputElement = document.createElement("input");
  inputElement.type = "text";
  inputElement.placeholder = "Pseudo";
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

  inputElement.addEventListener("input", ()=>{ inputElement.value = inputElement.value.replace(/\s/g,""); });
  inputElement.addEventListener("keydown", (e)=>{
    if(e.key==="Enter" && inputElement.value.length>0){
      playerName = inputElement.value.substring(0,7);
      nameText.setText(playerName);
      inputElement.style.display="none";
      startGame(scene);
    }
  });
}

// =========================
// START GAME
// =========================
function startGame(scene) {
  gameStarted = true;
  player.body.allowGravity = true;
  player.setVelocityY(300);

  scheduleNextObstacle(scene);

  scene.input.on('pointerdown', jump);
  scene.input.keyboard.on('keydown-SPACE', jump);
  function jump(){ if(gameOver) return; if(player.body.blocked.down) player.setVelocityY(-520);}
}

// =========================
// SPAWN OBSTACLE ALEATOIRE
// =========================
function scheduleNextObstacle(scene) {
  if(gameOver || !gameStarted) return;

  const delay = Phaser.Math.Between(1000, 2000);
  spawnTimer = scene.time.addEvent({
    delay: delay,
    loop: false,
    callback: () => {
      spawnObstacle();
      scheduleNextObstacle(scene);
    },
    callbackScope: scene
  });
}

function spawnObstacle() {
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
// HIT
// =========================
function hit() {
  if(!gameStarted) return;
  gameOver=true;
  player.setTint(0xff0000);
  spawnTimer.remove();

  if(score>bestScore) bestScore=score;
  bestText.setText('Best: '+bestScore);

  saveScoreFirebase(playerName, bestScore);
  showLeaderboardFirebase(this, ()=>{ 
      const overlay = this.add.rectangle(GAME_WIDTH/2, GAME_HEIGHT/2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 1);
      const gameOverText = this.add.text(GAME_WIDTH/2, GAME_HEIGHT/2-50,'GAME OVER',{ font:'28px Arial', fill:'#fff'}).setOrigin(0.5);
      const restartText = this.add.text(GAME_WIDTH/2, GAME_HEIGHT/2+20,'REJOUER',{ font:'28px Arial', fill:'#fff'}).setOrigin(0.5);
      this.tweens.add({ targets: restartText, alpha:0.2, duration:500, yoyo:true, repeat:-1 });

      restartText.setInteractive({ useHandCursor:true });
      restartText.on('pointerdown', ()=>{
        overlay.destroy();
        gameOverText.destroy();
        restartText.destroy();
        this.input.removeAllListeners();
        this.input.keyboard.removeAllListeners();
        this.scene.restart();
        score=0;
        gameOver=false;
        baseSpeed=220;
        bgSpeed=3;
        scoreTimer=0;
        nameText.setText(playerName);
      });
  });
}

// =========================
// FIREBASE FUNCTIONS
// =========================
function saveScoreFirebase(name, score){
  if(!name || score<=0) return;
  db.ref('leaderboard').push({name:name, score:score});
}

function showLeaderboardFirebase(scene, onCloseCallback){
  db.ref('leaderboard').once('value', snapshot => {
    let scores = {};

    snapshot.forEach(child => {
      const data = child.val();
      const name = data.name;
      const score = data.score;

      if(!scores[name] || score > scores[name]){
        scores[name] = score;
      }
    });

    let scoreArray = [];
    for(let name in scores){
      scoreArray.push({name: name, score: scores[name]});
    }

    scoreArray.sort((a,b)=>b.score-a.score);
    scoreArray = scoreArray.slice(0,10);

    let leaderboardObjects = [];

    const boardHeight = Math.min(420, GAME_HEIGHT-80);
    const boardBg = scene.add.rectangle(GAME_WIDTH/2,GAME_HEIGHT/2,300,boardHeight,0x000000,0.8).setStrokeStyle(3,0xffd700);
    leaderboardObjects.push(boardBg);

    const titleY = GAME_HEIGHT/2 - boardHeight/2 + 40;
    const title = scene.add.text(GAME_WIDTH/2,titleY,"🏆 TOP 10",{ fontFamily:"Courier", fontSize:"28px", color:"#FFD700", fontStyle:"bold"}).setOrigin(0.5);
    leaderboardObjects.push(title);

    let startY = titleY + 40;
    scoreArray.forEach((entry,i)=>{
      let color="#FFFFFF";
      if(i===0) color="#FFD700";
      if(i===1) color="#C0C0C0";
      if(i===2) color="#cd7f32";

      const txt = scene.add.text(GAME_WIDTH/2,startY+i*28,`${i+1}. ${entry.name} - ${entry.score}`,{ fontFamily:"Courier", fontSize:"20px", color:color }).setOrigin(0.5);
      leaderboardObjects.push(txt);
    });

    const closeBtn = scene.add.text(GAME_WIDTH/2,GAME_HEIGHT/2+boardHeight/2-30,"FERMER",{ fontFamily:"Courier", fontSize:"22px", color:"#FFD700", fontStyle:"bold"}).setOrigin(0.5).setInteractive({ useHandCursor:true });
    leaderboardObjects.push(closeBtn);

    closeBtn.on("pointerdown", ()=>{
      leaderboardObjects.forEach(obj=>obj.destroy());
      leaderboardObjects=[];
      if(onCloseCallback) onCloseCallback();
    });
  });
}

// =========================
// TOGGLE PAUSE
// =========================
function togglePause(scene){
  isPaused = !isPaused;
  if(isPaused){
    scene.physics.pause();
    scene.time.paused=true;
    pauseOverlay = scene.add.rectangle(GAME_WIDTH/2,GAME_HEIGHT/2,GAME_WIDTH,GAME_HEIGHT,0x000000,0.5);
    pauseText = scene.add.text(GAME_WIDTH/2,GAME_HEIGHT/2,"PAUSE",{ fontSize:"42px", fontFamily:"Arial", fontStyle:"bold", color:"#fff"}).setOrigin(0.5);
  } else {
    scene.physics.resume();
    scene.time.paused=false;
    pauseOverlay.destroy();
    pauseText.destroy();
  }
}

// =========================
// UPDATE
// =========================
function update(time, delta){
  if(!gameStarted || isPaused) return;
  if(!gameOver){
    scoreTimer+=delta;
    if(scoreTimer>=500){
      score++;
      scoreText.setText('Score: '+score);
      scoreTimer=0;
      baseSpeed+=5;
      bgSpeed=baseSpeed/73; // background synchro avec obstacle
    }
    bg.tilePositionX+=bgSpeed;
  }
  obstacles.getChildren().forEach(o=>{
    if(!gameStarted) return;
    o.setVelocityX(-baseSpeed);
    if(o.x<-50) o.destroy();
  });
}
