/* game1.js - Раннер с динозавром с расширенным функционалом */

/* Предполагается, что существуют глобальные объекты:
   localUserData.points – текущие очки/прогресс пользователя,
   updateTopBar(points, timeLeft) – обновляет интерфейс (очки, таймер и слайдер времени),
   showEndGameModal(title, message) – отображает окно окончания игры.
*/

// Пример глобальных переменных и функций (их можно заменить на свои)
let localUserData = { points: 0 };

function updateTopBar(points, timeLeft) {
  // Обновление счётчика очков и таймера (элементы должны быть в index.html)
  document.getElementById('scoreDisplay').innerText = `Очки: ${points}`;
  document.getElementById('timerDisplay').innerText = `Время: ${timeLeft} с`;
  let slider = document.getElementById('timeSlider');
  if (slider) {
    slider.value = timeLeft;
  }
}

function showEndGameModal(title, message) {
  // Пример простого модального окна
  alert(`${title}\n${message}`);
}

// ================= Классы игры =================

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
    this.maxJumps = 2; // двойной прыжок
    // Спрайт игрока
    this.sprite = new Image();
    this.sprite.src = 'dinoSprite.png'; // укажите путь к изображению динозавра
    // Для анимации можно использовать дополнительные поля:
    this.frameIndex = 0;
    this.frameRate = 10;
    this.frameTimer = 0;
  }
  
  update(deltaTime) {
    // Применяем гравитацию
    this.velocityY += this.gravity;
    this.y += this.velocityY;
    
    // Проверка на землю (y = 180)
    if (this.y >= 180) {
      this.y = 180;
      this.velocityY = 0;
      this.jumpCount = 0;
    }
    
    // Обновление анимации спрайта (если используется спрайт-лист)
    this.frameTimer += deltaTime;
    if (this.frameTimer > 1000 / this.frameRate) {
      this.frameIndex = (this.frameIndex + 1) % 4; // допустим, 4 кадра в спрайт-листе
      this.frameTimer = 0;
    }
  }
  
  draw(ctx) {
    // Если изображение загружено, рисуем спрайт, иначе – прямоугольник
    if (this.sprite.complete) {
      let frameWidth = this.sprite.width / 4;
      ctx.drawImage(
        this.sprite,
        this.frameIndex * frameWidth, 0,
        frameWidth, this.sprite.height,
        this.x, this.y, this.width, this.height
      );
    } else {
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(this.x, this.y, this.width, this.height);
    }
  }
  
  jump() {
    if (this.jumpCount < this.maxJumps) {
      this.velocityY = -10;
      this.jumpCount++;
    }
  }
}

// Класс препятствия
class Obstacle {
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y; // обычно на уровне земли (180)
    this.width = width;
    this.height = height;
    this.speed = speed;
    // Спрайт препятствия
    this.sprite = new Image();
    this.sprite.src = 'obstacleSprite.png'; // укажите путь к изображению препятствия
  }
  
  update(deltaTime) {
    this.x -= this.speed;
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

// Класс бонуса – монеты
class Coin {
  constructor(x, y, width, height, speed) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = speed;
    // Анимированная монета (можно использовать GIF или спрайт-лист)
    this.sprite = new Image();
    this.sprite.src = 'coin.gif'; // укажите путь к анимированному изображению монеты
  }
  
  update(deltaTime) {
    this.x -= this.speed;
  }
  
  draw(ctx) {
    if (this.sprite.complete) {
      ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
    } else {
      ctx.fillStyle = 'gold';
      ctx.beginPath();
      ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Класс фонового слоя с параллакс-эффектом
class BackgroundLayer {
  constructor(imageSrc, speedModifier) {
    this.image = new Image();
    this.image.src = imageSrc;
    this.speedModifier = speedModifier;
    this.x = 0;
    this.y = 0;
  }
  
  update(deltaTime, baseSpeed) {
    this.x -= baseSpeed * this.speedModifier;
    if (this.x <= -this.image.width) {
      this.x = 0;
    }
  }
  
  draw(ctx, canvasWidth, canvasHeight) {
    if (this.image.complete) {
      // Рисуем два изображения для плавного повторения
      ctx.drawImage(this.image, this.x, this.y, this.image.width, canvasHeight);
      ctx.drawImage(this.image, this.x + this.image.width, this.y, this.image.width, canvasHeight);
    }
  }
}

// Главный класс игры
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.player = new Player(50, 180);
    this.obstacles = [];
    this.coins = [];
    this.backgroundLayers = [];
    // Добавляем слои фона (можно добавить больше для лучшего эффекта)
    this.backgroundLayers.push(new BackgroundLayer('bgLayer1.png', 0.2));
    this.backgroundLayers.push(new BackgroundLayer('bgLayer2.png', 0.5));
    
    this.isPaused = false;
    this.gameTime = 300; // 5 минут = 300 секунд
    this.lastTime = performance.now();
    this.frameCount = 0;
    
    // Звуковые эффекты и музыка
    this.jumpSound = new Audio('jump.mp3');
    this.collisionSound = new Audio('collision.mp3');
    this.coinSound = new Audio('coin.mp3');
    this.bgMusic = new Audio('background.mp3');
    this.bgMusic.loop = true;
    
    // Привязываем обработчики событий
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleClick = this.handleClick.bind(this);
    window.addEventListener('keydown', this.handleKeyDown);
    this.canvas.addEventListener('click', this.handleClick);
  }
  
  init() {
    localUserData.points = 0;
    this.bgMusic.play();
    this.lastTime = performance.now();
    requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  handleKeyDown(e) {
    if (e.code === 'Space') {
      this.player.jump();
      this.jumpSound.play();
    }
    if (e.code === 'KeyP') {
      this.togglePause();
    }
  }
  
  handleClick(e) {
    this.player.jump();
    this.jumpSound.play();
  }
  
  togglePause() {
    this.isPaused = !this.isPaused;
  }
  
  spawnObstacle() {
    // Рандомизируем размеры и скорость препятствия
    let width = 20 + Math.random() * 20;
    let height = 20 + Math.random() * 20;
    let x = this.canvas.width;
    let y = 180; // на уровне земли
    let speed = 3 + localUserData.points / 500; // сложность растёт с очками
    this.obstacles.push(new Obstacle(x, y, width, height, speed));
  }
  
  spawnCoin() {
    let width = 15;
    let height = 15;
    let x = this.canvas.width;
    let y = 120 + Math.random() * 60; // монета может появляться выше земли
    let speed = 3;
    this.coins.push(new Coin(x, y, width, height, speed));
  }
  
  update(deltaTime) {
    if (this.isPaused) return;
    
    // Обновляем таймер игры
    this.gameTime -= deltaTime / 1000;
    if (this.gameTime <= 0) {
      // Если время вышло – игрок получает бонус +500 и игра завершается
      localUserData.points += 500;
      showEndGameModal(
        'Победа',
        `Время вышло!\nПолучено бонусных очков: 500\nИтоговый прогресс: ${localUserData.points}`
      );
      this.reset();
      return;
    }
    
    // Обновляем игрока
    this.player.update(deltaTime);
    
    // Обновляем препятствия
    this.obstacles.forEach(obs => obs.update(deltaTime));
    this.obstacles = this.obstacles.filter(obs => obs.x + obs.width > 0);
    
    // Обновляем монеты
    this.coins.forEach(coin => coin.update(deltaTime));
    this.coins = this.coins.filter(coin => coin.x + coin.width > 0);
    
    // Обновляем фон
    this.backgroundLayers.forEach(layer => layer.update(deltaTime, 3));
    
    // Каждые несколько кадров спавним препятствие или монету
    this.frameCount++;
    if (this.frameCount % 100 === 0) {
      this.spawnObstacle();
    }
    if (this.frameCount % 150 === 0) {
      if (Math.random() < 0.5) {
        this.spawnCoin();
      }
    }
    
    // Проверка столкновений с препятствиями
    for (let obs of this.obstacles) {
      if (this.checkCollision(this.player, obs)) {
        this.collisionSound.play();
        showEndGameModal(
          'Игра окончена',
          `Вы врезались в препятствие!\nНабрано очков: ${localUserData.points}`
        );
        this.reset();
        return;
      }
    }
    
    // Проверка столкновений с монетами
    for (let i = 0; i < this.coins.length; i++) {
      let coin = this.coins[i];
      if (this.checkCollision(this.player, coin)) {
        this.coinSound.play();
        // За сбор монеты даётся +5 к прогрессу
        localUserData.points += 5;
        this.coins.splice(i, 1);
        i--;
      }
    }
    
    // Обновляем UI (очки и оставшееся время)
    updateTopBar(localUserData.points, Math.floor(this.gameTime));
  }
  
  checkCollision(a, b) {
    return a.x < b.x + b.width &&
           a.x + a.width > b.x &&
           a.y < b.y + b.height &&
           a.y + a.height > b.y;
  }
  
  draw() {
    // Очищаем канвас
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Рисуем фон
    this.backgroundLayers.forEach(layer => layer.draw(this.ctx, this.canvas.width, this.canvas.height));
    
    // Рисуем бонусы (монеты)
    this.coins.forEach(coin => coin.draw(this.ctx));
    
    // Рисуем препятствия
    this.obstacles.forEach(obs => obs.draw(this.ctx));
    
    // Рисуем игрока
    this.player.draw(this.ctx);
    
    // Рисуем пол
    this.ctx.fillStyle = '#555';
    this.ctx.fillRect(0, 190, this.canvas.width, 10);
  }
  
  gameLoop(timestamp) {
    let deltaTime = timestamp - this.lastTime;
    this.lastTime = timestamp;
    if (!this.isPaused) {
      this.update(deltaTime);
      this.draw();
    }
    requestAnimationFrame(this.gameLoop.bind(this));
  }
  
  reset() {
    // Остановка игры, очистка объектов и событий (можно добавить анимацию завершения)
    this.bgMusic.pause();
    window.removeEventListener('keydown', this.handleKeyDown);
    this.canvas.removeEventListener('click', this.handleClick);
    // Дополнительно можно перезапустить игру или перейти в меню
  }
}

// ================ Инициализация игры =================

// При загрузке страницы получаем канвас и запускаем игру.
// В HTML должны присутствовать элементы с id="gameCanvas", "scoreDisplay", "timerDisplay" и "timeSlider".
window.addEventListener('load', () => {
  const canvas = document.getElementById('gameCanvas');
  const game = new Game(canvas);
  game.init();
});
