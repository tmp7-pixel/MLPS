// Web Audio API Synthesizer for 8-bit Retro Game Sound Effects
class SoundController {
  constructor() {
    this.audioCtx = null;
    this.muted = false;
  }

  init() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioContext();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  playJump() {
    if (this.muted) return;
    this.init();

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'square';
    const now = this.audioCtx.currentTime;

    // Pitch sweep up for classic jump sound
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.12);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.13);
  }

  playHit() {
    if (this.muted) return;
    this.init();

    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'sawtooth';
    const now = this.audioCtx.currentTime;

    // Pitch drop for collision/game over
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.28);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.28);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + 0.3);
  }

  playScore() {
    if (this.muted) return;
    this.init();

    const now = this.audioCtx.currentTime;

    // Two-tone chime for reaching 100s milestones
    [660, 880].forEach((freq, i) => {
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'square';
      const startTime = now + (i * 0.08);

      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.18, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.08);
    });
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }
}

// Main Game Controller
class DinoGame {
  constructor() {
    // DOM Elements
    this.container = document.getElementById('gameContainer');
    this.dino = document.getElementById('dino');
    this.obstaclesContainer = document.getElementById('obstacles');
    this.ground = document.getElementById('ground');
    this.scoreDisplay = document.getElementById('score');
    this.highScoreDisplay = document.getElementById('highScore');
    this.overlay = document.getElementById('messageOverlay');
    this.overlayTitle = document.getElementById('overlayTitle');
    this.overlaySubtitle = document.getElementById('overlaySubtitle');
    this.startBtn = document.getElementById('startBtn');
    this.soundToggleBtn = document.getElementById('soundToggle');
    this.sky = document.getElementById('sky');

    // Audio
    this.sound = new SoundController();

    // Game Physics & State
    this.gameSpeed = 6;
    this.baseSpeed = 6;
    this.maxSpeed = 13;
    this.speedIncrement = 0.0015;

    this.isPlaying = false;
    this.isGameOver = false;

    // Dino Physics
    this.dinoY = 0;
    this.dinoVelocityY = 0;
    this.gravity = 0.65;
    this.jumpForce = 13;
    this.isJumping = false;
    this.isDucking = false;

    // Obstacles & World
    this.obstacles = [];
    this.clouds = [];
    this.nextObstacleDistance = 0;
    this.groundOffset = 0;

    // Scoring
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('dino_hi_score') || '0', 10);
    this.updateHighScoreDisplay();

    // Bind event listeners
    this.bindEvents();
    this.initClouds();
  }

  updateHighScoreDisplay() {
    this.highScoreDisplay.textContent = String(Math.floor(this.highScore)).padStart(5, '0');
  }

  bindEvents() {
    // Keyboard inputs
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!this.isPlaying) {
          this.startGame();
        } else {
          this.jump();
        }
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        if (this.isPlaying) {
          this.duck(true);
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowDown') {
        this.duck(false);
      }
    });

    // Touch / Click on container
    this.container.addEventListener('pointerdown', (e) => {
      if (e.target === this.startBtn) return;
      if (!this.isPlaying) {
        this.startGame();
      } else {
        this.jump();
      }
    });

    this.startBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.startGame();
    });

    this.soundToggleBtn.addEventListener('click', () => {
      const isMuted = this.sound.toggleMute();
      this.soundToggleBtn.textContent = isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
    });
  }

  startGame() {
    this.sound.init();
    this.resetGame();
    this.isPlaying = true;
    this.isGameOver = false;
    this.overlay.style.display = 'none';

    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }

  resetGame() {
    this.score = 0;
    this.gameSpeed = this.baseSpeed;
    this.dinoY = 0;
    this.dinoVelocityY = 0;
    this.isJumping = false;
    this.isDucking = false;
    this.dino.classList.remove('ducking');
    this.dino.style.transform = `translateY(0px)`;

    // Clear obstacles
    this.obstacles.forEach(ob => ob.element.remove());
    this.obstacles = [];
    this.nextObstacleDistance = 60 + Math.random() * 40;
  }

  jump() {
    if (!this.isJumping) {
      this.isJumping = true;
      this.dinoVelocityY = this.jumpForce;
      this.sound.playJump();
    }
  }

  duck(isDucking) {
    if (this.isJumping) return;
    this.isDucking = isDucking;
    if (isDucking) {
      this.dino.classList.add('ducking');
    } else {
      this.dino.classList.remove('ducking');
    }
  }

  initClouds() {
    for (let i = 0; i < 3; i++) {
      const cloud = document.createElement('div');
      cloud.className = 'cloud';
      const width = 40 + Math.random() * 30;
      const height = 12 + Math.random() * 8;
      const x = Math.random() * 700;
      const y = 30 + Math.random() * 70;
      cloud.style.width = `${width}px`;
      cloud.style.height = `${height}px`;
      cloud.style.transform = `translate(${x}px, ${y}px)`;
      this.sky.appendChild(cloud);
      this.clouds.push({ element: cloud, x, y, speed: 0.6 + Math.random() * 0.5 });
    }
  }

  updateClouds() {
    const containerWidth = this.container.clientWidth || 800;
    this.clouds.forEach(cloud => {
      cloud.x -= cloud.speed;
      if (cloud.x < -100) {
        cloud.x = containerWidth + Math.random() * 100;
        cloud.y = 30 + Math.random() * 70;
      }
      cloud.element.style.transform = `translate(${cloud.x}px, ${cloud.y}px)`;
    });
  }

  spawnObstacle() {
    const isBird = this.score > 250 && Math.random() < 0.28;
    const obstacleElement = document.createElement('div');
    obstacleElement.className = 'obstacle';

    let width = 24;
    let height = 44;
    let bottom = 16;

    if (isBird) {
      width = 40;
      height = 30;
      // High or low bird
      bottom = Math.random() > 0.5 ? 58 : 28;
      obstacleElement.innerHTML = `
        <svg class="bird" viewBox="0 0 46 32" width="${width}" height="${height}">
          <path d="M0 16h8v4h8v4h8v-4h6v-6h4V8h6V4h4V0h-4v4h-8v4h-6v4h-4v4H16v4H8v-4H0v-4z"/>
        </svg>
      `;
    } else {
      // Cactus: single, double, or small/tall
      const type = Math.floor(Math.random() * 3);
      if (type === 0) {
        width = 22;
        height = 40;
        obstacleElement.innerHTML = `
          <svg class="cactus" viewBox="0 0 20 40" width="${width}" height="${height}">
            <path d="M6 0h8v40H6V0zm-6 12h6v6H0v-6zm0 6h4v10H0v-10zm14-4h6v6h-6v-6zm2 6h4v8h-4v-8z"/>
          </svg>
        `;
      } else if (type === 1) {
        width = 44;
        height = 42;
        obstacleElement.innerHTML = `
          <svg class="cactus" viewBox="0 0 40 40" width="${width}" height="${height}">
            <path d="M6 0h6v40H6V0zm-6 10h6v6H0v-6zm18-4h6v34h-6V6zm14 8h6v18h-6V14z"/>
          </svg>
        `;
      } else {
        width = 30;
        height = 32;
        obstacleElement.innerHTML = `
          <svg class="cactus" viewBox="0 0 24 30" width="${width}" height="${height}">
            <path d="M8 0h8v30H8V0zm-8 8h8v6H0V8zm16 4h8v6h-8v-6z"/>
          </svg>
        `;
      }
    }

    obstacleElement.style.bottom = `${bottom}px`;
    const startX = this.container.clientWidth;
    obstacleElement.style.transform = `translateX(${startX}px)`;

    this.obstaclesContainer.appendChild(obstacleElement);

    this.obstacles.push({
      element: obstacleElement,
      x: startX,
      width,
      height,
      bottom,
      isBird
    });
  }

  checkCollision(dinoBox, obsBox) {
    // Add a slight margin buffer for forgiving & fair pixel hitbox
    const margin = 5;
    return (
      dinoBox.x + margin < obsBox.x + obsBox.width &&
      dinoBox.x + dinoBox.width - margin > obsBox.x &&
      dinoBox.y < obsBox.y + obsBox.height &&
      dinoBox.y + dinoBox.height > obsBox.y + margin
    );
  }

  gameOver() {
    this.isPlaying = false;
    this.isGameOver = true;
    this.sound.playHit();

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('dino_hi_score', Math.floor(this.highScore));
      this.updateHighScoreDisplay();
    }

    this.overlayTitle.textContent = 'GAME OVER';
    this.overlaySubtitle.textContent = `Score: ${Math.floor(this.score)}`;
    this.startBtn.textContent = 'PLAY AGAIN';
    this.overlay.style.display = 'flex';
  }

  gameLoop(currentTime) {
    if (!this.isPlaying) return;

    // Advance speed gradually
    if (this.gameSpeed < this.maxSpeed) {
      this.gameSpeed += this.speedIncrement;
    }

    // Update Score
    const prevScore = Math.floor(this.score);
    this.score += 0.15;
    const currentScore = Math.floor(this.score);
    this.scoreDisplay.textContent = String(currentScore).padStart(5, '0');

    // Milestones (every 100 points sound chime)
    if (currentScore > 0 && currentScore % 100 === 0 && prevScore % 100 !== 0) {
      this.sound.playScore();
    }

    // Ground scrolling
    this.groundOffset = (this.groundOffset + this.gameSpeed) % 40;
    this.ground.style.transform = `translateX(-${this.groundOffset}px)`;

    // Dino vertical movement
    if (this.isJumping) {
      this.dinoY += this.dinoVelocityY;
      this.dinoVelocityY -= this.gravity;

      if (this.dinoY <= 0) {
        this.dinoY = 0;
        this.dinoVelocityY = 0;
        this.isJumping = false;
      }
    }
    this.dino.style.transform = `translateY(-${this.dinoY}px)`;

    // Clouds
    this.updateClouds();

    // Obstacle spawn management
    this.nextObstacleDistance -= this.gameSpeed;
    if (this.nextObstacleDistance <= 0) {
      this.spawnObstacle();
      // Minimum distance ensures jumpability, scaling with speed
      const minGap = 220 + this.gameSpeed * 10;
      const randomGap = Math.random() * 260;
      this.nextObstacleDistance = minGap + randomGap;
    }

    // Dino bounding box
    const dinoElementRect = this.dino.getBoundingClientRect();
    const containerRect = this.container.getBoundingClientRect();

    const dinoHitbox = {
      x: dinoElementRect.left - containerRect.left,
      y: this.dinoY,
      width: this.dino.clientWidth,
      height: this.dino.clientHeight
    };

    // Obstacles loop
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.gameSpeed;
      obs.element.style.transform = `translateX(${obs.x}px)`;

      const obsHitbox = {
        x: obs.x,
        y: obs.bottom - 16,
        width: obs.width,
        height: obs.height
      };

      // Collision detection
      if (this.checkCollision(dinoHitbox, obsHitbox)) {
        this.gameOver();
        return;
      }

      // Remove obstacles off screen
      if (obs.x < -60) {
        obs.element.remove();
        this.obstacles.splice(i, 1);
      }
    }

    requestAnimationFrame(this.gameLoop.bind(this));
  }
}

// Instantiate game on page load
window.addEventListener('DOMContentLoaded', () => {
  new DinoGame();
});
