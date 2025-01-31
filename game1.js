/* game1.js - Простой раннер с динозавром */

// Получаем доступ к canvas
window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
  
    let dinoX = 50;
    let dinoY = 180;
    let velocityY = 0;
    let gravity = 0.5;
    let isJumping = false;
  
    // Пример "препятствий"
    let obstacles = [];
    let obstacleSpeed = 3;
    let frameCount = 0;
  
    function init() {
      canvas.width = 400;
      canvas.height = 200;
  
      // Слушаем нажатие пробела или тап
      window.addEventListener('keydown', (e) => {
        if (e.code === 'Space') jump();
      });
      canvas.addEventListener('click', jump);
  
      requestAnimationFrame(gameLoop);
    }
  
    function jump() {
      if (!isJumping) {
        velocityY = -10;
        isJumping = true;
      }
    }
  
    function spawnObstacle() {
      const obstacle = {
        x: canvas.width,
        y: 180,
        width: 20,
        height: 20
      };
      obstacles.push(obstacle);
    }
  
    function update() {
      // Обновление позиции динозавра
      dinoY += velocityY;
      velocityY += gravity;
      if (dinoY >= 180) {
        dinoY = 180;
        isJumping = false;
      }
  
      // Спавн препятствий
      frameCount++;
      if (frameCount % 120 === 0) {
        spawnObstacle();
      }
  
      // Движение препятствий
      obstacles.forEach(obs => {
        obs.x -= obstacleSpeed;
      });
  
      // Проверка столкновений
      obstacles.forEach(obs => {
        if (
          dinoX < obs.x + obs.width &&
          dinoX + 20 > obs.x &&
          dinoY < obs.y + obs.height &&
          dinoY + 20 > obs.y
        ) {
          // Столкновение — заканчиваем игру
          alert('Игра окончена!');
          // Можно перезапустить
          obstacles = [];
          frameCount = 0;
          dinoX = 50;
          dinoY = 180;
          velocityY = 0;
        }
      });
  
      // Удаляем вышедшие за экран препятствия
      obstacles = obstacles.filter(obs => obs.x + obs.width > 0);
    }
  
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  
      // Рисуем динозавра (просто квадрат)
      ctx.fillStyle = '#00FF00';
      ctx.fillRect(dinoX, dinoY, 20, 20);
  
      // Рисуем препятствия
      ctx.fillStyle = 'red';
      obstacles.forEach(obs => {
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
      });
  
      // "Пол"
      ctx.fillStyle = '#555';
      ctx.fillRect(0, 200 - 10, canvas.width, 10);
    }
  
    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }
  
    init();
  });
  
