// Игра Breakout в стиле панк/ретро (game4.js)
function initGame4() {
  const canvas = document.getElementById("game4Canvas");
  const ctx = canvas.getContext("2d");

  // Размеры и свойства мяча
  const ballRadius = 8;
  let ballX = canvas.width / 2;
  let ballY = canvas.height - 30;
  let ballDX = 2;
  let ballDY = -2;

  // Свойства ракетки (paddle)
  const paddleHeight = 10;
  const paddleWidth = 75;
  let paddleX = (canvas.width - paddleWidth) / 2;

  // Свойства кирпичей
  const brickRowCount = 5;
  const brickColumnCount = 7;
  const brickWidth = 45;
  const brickHeight = 15;
  const brickPadding = 5;
  const brickOffsetTop = 30;
  const brickOffsetLeft = 20;

  // Создаем массив кирпичей
  const bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
  }

  // Счет и жизни игрока
  let score = 0;
  let lives = 3;

  // Флаги нажатия клавиш
  let rightPressed = false;
  let leftPressed = false;

  // Обработчики клавиатуры
  function keyDownHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = true;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = true;
    }
  }

  function keyUpHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = false;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = false;
    }
  }

  document.addEventListener("keydown", keyDownHandler, false);
  document.addEventListener("keyup", keyUpHandler, false);

  // Функция обнаружения столкновений мяча с кирпичами
  function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const b = bricks[c][r];
        if (b.status === 1) {
          if (
            ballX > b.x &&
            ballX < b.x + brickWidth &&
            ballY > b.y &&
            ballY < b.y + brickHeight
          ) {
            ballDY = -ballDY;
            b.status = 0;
            score++;
            if (score === brickRowCount * brickColumnCount) {
              alert("YOU WIN, CONGRATULATIONS!");
              document.location.reload();
            }
          }
        }
      }
    }
  }

  // Рисуем мяч (неоновый зеленый)
  function drawBall() {
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#39FF14"; // неоновый зеленый
    ctx.fill();
    ctx.closePath();
  }

  // Рисуем ракетку (неоновый красный)
  function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight, paddleWidth, paddleHeight);
    ctx.fillStyle = "#FF073A"; // неоновый красный
    ctx.fill();
    ctx.closePath();
  }

  // Рисуем кирпичи (неоновый голубой)
  function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        if (bricks[c][r].status === 1) {
          const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
          const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
          bricks[c][r].x = brickX;
          bricks[c][r].y = brickY;
          ctx.beginPath();
          ctx.rect(brickX, brickY, brickWidth, brickHeight);
          ctx.fillStyle = "#00FFFF"; // неоновый голубой (cyan)
          ctx.fill();
          ctx.closePath();
        }
      }
    }
  }

  // Рисуем счет и жизни в стиле ретро (шрифт Press Start 2P)
  function drawScore() {
    ctx.font = "16px 'Press Start 2P'";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Score: " + score, 8, 20);
  }

  function drawLives() {
    ctx.font = "16px 'Press Start 2P'";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Lives: " + lives, canvas.width - 100, 20);
  }

  let animationFrameId;
  // Основная функция отрисовки и логики игры
  function draw() {
    // Заливаем фон – тёмный для панк-стиля
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000"; // чёрный фон
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawBricks();
    drawBall();
    drawPaddle();
    drawScore();
    drawLives();
    collisionDetection();

    // Отскок мяча от боковых стен
    if (ballX + ballDX > canvas.width - ballRadius || ballX + ballDX < ballRadius) {
      ballDX = -ballDX;
    }
    // Отскок мяча от верхней стены
    if (ballY + ballDY < ballRadius) {
      ballDY = -ballDY;
    }
    // Если мяч касается нижней границы
    else if (ballY + ballDY > canvas.height - ballRadius) {
      if (ballX > paddleX && ballX < paddleX + paddleWidth) {
        ballDY = -ballDY;
      } else {
        lives--;
        if (!lives) {
          alert("GAME OVER");
          document.location.reload();
        } else {
          // Перезапуск позиции мяча и ракетки
          ballX = canvas.width / 2;
          ballY = canvas.height - 30;
          ballDX = 2;
          ballDY = -2;
          paddleX = (canvas.width - paddleWidth) / 2;
        }
      }
    }

    ballX += ballDX;
    ballY += ballDY;

    // Движение ракетки
    if (rightPressed && paddleX < canvas.width - paddleWidth) {
      paddleX += 7;
    } else if (leftPressed && paddleX > 0) {
      paddleX -= 7;
    }

    animationFrameId = requestAnimationFrame(draw);
  }

  // Запускаем игровой цикл
  animationFrameId = requestAnimationFrame(draw);
  // Сохраняем id анимации для возможности остановить игру (resetGame4)
  canvas.dataset.animationFrameId = animationFrameId;
}

// Функция для сброса/остановки игры Breakout
function resetGame4() {
  const canvas = document.getElementById("game4Canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (canvas.dataset.animationFrameId) {
    cancelAnimationFrame(canvas.dataset.animationFrameId);
    canvas.dataset.animationFrameId = null;
  }
  // Можно также удалить обработчики событий, если требуется:
  // document.removeEventListener("keydown", keyDownHandler);
  // document.removeEventListener("keyup", keyUpHandler);
}
