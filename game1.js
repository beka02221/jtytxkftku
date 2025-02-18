/* game1.js – Улучшенный динозавр-раннер */

/* ===================== Классы ===================== */

// Класс игрока (динозавра)
class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.width = 20;
    this.height = 20;
    this.velocityY = 0;
    this.gravity = 0.5;
    this.jumpCount = 0;
    this.maxJumps = 2; // разрешён двойной прыжок

    // Настройка спрайта
    this.sprite = new Image();
    this.sprite.src = 'dino_sprite.png'; // спрайт-лист динозавра
    this.frameWidth = 20;
    this.frameHeight = 20;
    this.frameCount = 4; // кол-во кадров анимации
    this.currentFrame = 0;
    this.frameTimer = 0;
    this.frameInterval = 0.1; // время между кадрами (сек)
  }

  update(deltaTime) {
    // Анимация спрайта
    this.frameTimer += deltaTime;
    if (this.frameTimer >= this.frameInterval) {
      this.currentFrame = (this.currentFrame + 1) % this.frameCount;
      this.frameTimer = 0;
    }
    // Физика движения
    this.y += this.velocityY;
    this.velocityY += this.gravity;
    // Столкновение с землёй (земля на y = 180)
    if (this.y >= 180) {
      this.y = 180;
      this.velocityY = 0;
      this.jumpCount = 0; // сброс прыжков, когда на земле
    }
  }

  jump() {
    if (this.jumpCount < this.maxJumps) {
      this.velocityY = -10; // можно добавить зависимость от длительности нажатия
      this.jumpCount++;
      if (jumpSound) {
        jumpSound.currentTime = 0;
        jumpSound.play();
      }
    }
  }

  draw(ctx) {
    if (this.sprite.complete) {
      ctx.drawImage(
        this.sprite,
        this.currentFrame * this.frameWidth,
        0,
        this.frameWidth,
        this.frameHeight,
        this.x,
        this.y,
        this.width,
        this.height
      );
    } else {
      // запасной вариант — простой прямоугольник
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}

// Класс препятствия
class Obstacle {
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed; // в пикселях/сек

    // Случайный тип препятствия для разнообразия
    this.type = Math.random() < 0.5 ? 0 : 1;
    this.sprite = new Image();
    this.sprite.src = this.type === 0 ? 'obstacle1.png' : 'obstacle2.png';
  }

  update(deltaTime) {
    this.x -= this.speed * deltaTime;
  }

  draw(ctx) {
    if (this.sprite.complete) {
      ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'red';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
}

// Класс бонуса (монеты)
class Bonus {
  constructor(x, y, size, speed) {
    this.x = x;
    this.y = y;
    this.size = size;
    this.speed = speed;
    this.collected = false;
    this.sprite = new Image();
    this.sprite.src = 'coin.gif'; // анимированный gif монеты
  }

  update(deltaTime) {
    this.x -= this.speed * deltaTime;
  }

  draw(ctx) {
    if (this.sprite.complete) {
      ctx.drawImage(this.sprite, this.x, this.y, this.size, this.size);
    } else {
      ctx.fillStyle = 'gold';
      ctx.beginPath();
      ctx.arc(this.x + this.size / 2, this.y + this.size / 2, this.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Класс фонового слоя для параллакса
class BackgroundLayer {
  constructor(imageSrc, speedMultiplier) {
    this.image = new Image();
    this.image.src = imageSrc;
    this.speedMultiplier = speedMultiplier;
    this.x = 0;
  }

  update(deltaTime, baseSpeed) {
    this.x -= baseSpeed * this.speedMultiplier * deltaTime;
    if (this.x <= -400) {
      this.x += 400; // повторяем изображение (ширина канвы = 400)
    }
  }

  draw(ctx) {
    if (this.image.complete) {
      ctx.drawImage(this.image, this.x, 0, 400, 200);
      ctx.drawImage(this.image, this.x + 400, 0, 400, 200);
    } else {
      // запасной фон — сплошной цвет
      ctx.fillStyle = '#87CEEB'; // небесно-голубой
      ctx.fillRect(this.x, 0, 400, 200);
      ctx.fillRect(this.x + 400, 0, 400, 200);
    }
  }
}

/* ===================== Глобальные переменные ===================== */

let canvas, ctx;
let player;
let obstacles = [];
let bonuses = [];
let backgroundLayers = [];
let obstacleSpawnTimer = 0;
let obstacleSpawnInterval = 1.5; // начальный интервал спавна препятствий (сек)
let bonusSpawnTimer = 0;
let bonusSpawnInterval = 3; // интервал спавна бонусов (сек)
let lastTime = 0;
let gameTime = 300; // 5 минут = 300 сек
let paused = false;
let gameOver = false;
let gameLoopId;
let baseObstacleSpeed = 200; // базовая скорость препятствий (пикс/сек)
let difficultyFactor = 0; // фактор динамической сложности

// Аудиоэффекты
let jumpSound, collisionSound, coinSound, bgMusic;

/* ===================== Инициализация игры ===================== */

function initGame1() {
  canvas = document.getElementById('gameCanvas');
  ctx = canvas.getContext('2d');

  // Сброс глобальных переменных
  obstacles = [];
  bonuses = [];
  gameTime = 300;
  paused = false;
  gameOver = false;
  obstacleSpawnTimer = 0;
  bonusSpawnTimer = 0;
  difficultyFactor = 0;

  // Инициализируем игрока
  player = new Player(50, 180);

  // Инициализируем фон (два слоя с разной скоростью)
  backgroundLayers = [
    new BackgroundLayer('background_far.png', 0.2),
    new BackgroundLayer('background_near.png', 0.5)
  ];

  // Загружаем аудио
  jumpSound = new Audio('jump.mp3');
  collisionSound = new Audio('collision.mp3');
  coinSound = new Audio('coin.mp3');
  bgMusic = new Audio('bg_music.mp3');
  bgMusic.loop = true;
  bgMusic.volume = 0.5; // можно добавить управление громкостью
  bgMusic.play();

  // Назначаем обработчики событий
  window.addEventListener('keydown', handleKeyDown);
  canvas.addEventListener('click', handleCanvasClick);

  lastTime = performance.now();
  gameLoopId = requestAnimationFrame(gameLoop);
}

/* ===================== Игровой цикл ===================== */

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let deltaTime = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (!paused && !gameOver) {
    update(deltaTime);
  }
  draw();

  if (!gameOver) {
    gameLoopId = requestAnimationFrame(gameLoop);
  }
}

/* ===================== Обновление состояния ===================== */

function update(deltaTime) {
  // Обновляем игровой таймер
  gameTime -= deltaTime;
  if (gameTime <= 0) {
    gameTime = 0;
    // По окончании времени даём бонус 500 "прогресса"
    localUserData.points += 500;
    endGame("Время вышло", "Вы получили бонус 500 прогресса!");
    return;
  }

  // Фактор сложности растёт с прошедшим временем
  difficultyFactor = (300 - gameTime) / 300;

  // Обновляем игрока
  player.update(deltaTime);

  // Спавн препятствий
  obstacleSpawnTimer += deltaTime;
  let currentSpawnInterval = obstacleSpawnInterval - difficultyFactor * 0.8; // уменьшение интервала со сложностью
  if (obstacleSpawnTimer >= currentSpawnInterval) {
    spawnObstacle();
    obstacleSpawnTimer = 0;
  }
  obstacles.forEach(obs => obs.update(deltaTime));
  obstacles = obstacles.filter(obs => obs.x + obs.width > 0);

  // Спавн бонусов (монеты)
  bonusSpawnTimer += deltaTime;
  if (bonusSpawnTimer >= bonusSpawnInterval) {
    spawnBonus();
    bonusSpawnTimer = 0;
  }
  bonuses.forEach(bonus => bonus.update(deltaTime));
  bonuses = bonuses.filter(bonus => bonus.x + bonus.size > 0 && !bonus.collected);

  // Обновляем фон
  backgroundLayers.forEach(layer => layer.update(deltaTime, baseObstacleSpeed / 3));

  // Проверка столкновений с препятствиями
  obstacles.forEach(obs => {
    if (isColliding(player, obs)) {
      if (collisionSound) {
        collisionSound.currentTime = 0;
        collisionSound.play();
      }
      endGame("Игра окончена", "Вы врезались в препятствие!");
    }
  });

  // Проверка столкновений с бонусами
  bonuses.forEach(bonus => {
    if (isColliding(player, { x: bonus.x, y: bonus.y, width: bonus.size, height: bonus.size })) {
      bonus.collected = true;
      if (coinSound) {
        coinSound.currentTime = 0;
        coinSound.play();
      }
      // За монету начисляем 5 прогресса
      localUserData.points += 5;
    }
  });
}

/* ===================== Функции спавна ===================== */

function spawnObstacle() {
  // Случайные параметры препятствия
  let width = 20 + Math.random() * 20; // 20–40 пикселей
  let height = 20 + Math.random() * 30; // 20–50 пикселей
  let x = 400;
  // Располагаем препятствие на земле (земля условно на y = 180)
  let y = 180 - (height - 20);
  let speed = baseObstacleSpeed + difficultyFactor * 100;
  obstacles.push(new Obstacle(x, y, width, height, speed));
}

function spawnBonus() {
  let size = 15;
  let x = 400;
  // Монета появляется в диапазоне высоты от 100 до 160 пикселей
  let y = 100 + Math.random() * 60;
  let speed = baseObstacleSpeed;
  bonuses.push(new Bonus(x, y, size, speed));
}

/* ===================== Функция проверки столкновений ===================== */

function isColliding(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/* ===================== Рисование ===================== */

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Рисуем фон (слои)
  backgroundLayers.forEach(layer => layer.draw(ctx));

  // Рисуем землю с градиентом
  let groundGradient = ctx.createLinearGradient(0, 180, 0, 200);
  groundGradient.addColorStop(0, '#555');
  groundGradient.addColorStop(1, '#333');
  ctx.fillStyle = groundGradient;
  ctx.fillRect(0, 180, 400, 20);

  // Рисуем препятствия и бонусы
  obstacles.forEach(obs => obs.draw(ctx));
  bonuses.forEach(bonus => bonus.draw(ctx));

  // Рисуем игрока
  player.draw(ctx);

  // Рисуем таймер (палзунок времени)
  drawTimeSlider();

  // Если игра на паузе – затемняем экран и выводим надпись
  if (paused) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('ПАУЗА', 150, 100);
  }
}

// Функция отрисовки таймера вверху (прогресс-бар)
function drawTimeSlider() {
  let sliderWidth = 300;
  let sliderHeight = 10;
  let x = 50;
  let y = 10;
  ctx.fillStyle = '#ccc';
  ctx.fillRect(x, y, sliderWidth, sliderHeight);
  let percent = gameTime / 300; // 300 сек – исходное время
  ctx.fillStyle = '#0F0';
  ctx.fillRect(x, y, sliderWidth * percent, sliderHeight);
  ctx.strokeStyle = '#000';
  ctx.strokeRect(x, y, sliderWidth, sliderHeight);
}

/* ===================== Обработка событий ===================== */

function handleKeyDown(e) {
  if (e.code === 'Space') {
    if (!paused && !gameOver) {
      player.jump();
    }
  } else if (e.code === 'KeyP') {
    // Пауза по клавише "P"
    paused = !paused;
    if (!paused) {
      lastTime = performance.now();
      gameLoopId = requestAnimationFrame(gameLoop);
    }
  }
}

function handleCanvasClick(e) {
  if (!paused && !gameOver) {
    player.jump();
  }
}

/* ===================== Завершение игры ===================== */

function endGame(title, message) {
  gameOver = true;
  bgMusic.pause();
  // Позволяем проиграть анимацию (например, fade-out) и затем показать итоговое окно
  setTimeout(() => {
    showEndGameModal(title, `${message}\nНабрано прогресса: ${localUserData.points}`);
    resetGame1();
  }, 1000);
}

/* ===================== Сброс игры ===================== */

function resetGame1() {
  if (gameLoopId) {
    cancelAnimationFrame(gameLoopId);
    gameLoopId = null;
  }
  window.removeEventListener('keydown', handleKeyDown);
  canvas.removeEventListener('click', handleCanvasClick);
  ctx = null;
}

