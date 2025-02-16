// game4.js — Breakout в стиле ретро-панк
function initGame4() {
  const canvas = document.getElementById("game4Canvas");
  const ctx = canvas.getContext("2d");

  // Переключатели для нажатий (клавиатура + мобильные кнопки)
  let rightPressed = false;
  let leftPressed = false;

  // Размеры и свойства мяча
  const ballRadius = 8;
  let ballX = canvas.width / 2;
  let ballY = canvas.height - 40;
  let ballDX = 2;
  let ballDY = -2;

  // Свойства ракетки
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

  // Массив кирпичей
  const bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
  }

  // Счет и жизни
  let score = 0;
  let lives = 3;

  // --- Обработчики клавиатуры ---
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

  document.addEventListener("keydown", keyDownHandler);
  document.addEventListener("keyup", keyUpHandler);

  // --- Обработчики мобильных кнопок ---
  const btnLeft = document.getElementById("btnLeft");
  const btnRight = document.getElementById("btnRight");

  // Для плавного управления при удержании
  btnLeft.addEventListener("mousedown", () => (leftPressed = true));
  btnLeft.addEventListener("mouseup", () => (leftPressed = false));
  btnLeft.addEventListener("touchstart", e => {
    e.preventDefault();
    leftPressed = true;
  });
  btnLeft.addEventListener("touchend", e => {
    e.preventDefault();
    leftPressed = false;
  });

  btnRight.addEventListener("mousedown", () => (rightPressed = true));
  btnRight.addEventListener("mouseup", () => (rightPressed = false));
  btnRight.addEventListener("touchstart", e => {
    e.preventDefault();
    rightPressed = true;
  });
  btnRight.addEventListener("touchend", e => {
    e.preventDefault();
    rightPressed = false;
  });

  // Функция столкновений мяча с кирпичами
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
              // Все кирпичи сбиты — победа
              showEndGameModal("YOU WIN!", "Congratulations!");
            }
          }
        }
      }
    }
  }

  // Рисуем мяч
  function drawBall() {
    ctx.beginPath();
    ctx.arc(ballX, ballY, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#39FF14"; // неоново‑зелёный
    ctx.fill();
    ctx.closePath();
  }

  // Рисуем ракетку
  function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight);
    ctx.fillStyle = "#FF073A"; // неоново‑красный
    ctx.fill();
    ctx.closePath();
  }

  // Рисуем кирпичи
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
          ctx.fillStyle = "#00FFFF"; // неоново‑голубой (cyan)
          ctx.fill();
          ctx.closePath();
        }
      }
    }
  }

  // Рисуем счёт и жизни в верхнем углу
  function drawScore() {
    ctx.font = "14px 'Press Start 2P'";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Score: " + score, 8, 20);
  }

  function drawLives() {
    ctx.font = "14px 'Press Start 2P'";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Lives: " + lives, canvas.width - 100, 20);
  }

  let animationFrameId;
  function draw() {
    // Очищаем холст
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawBricks();
    drawBall();
    drawPaddle();
    drawScore();
    drawLives();
    collisionDetection();

    // Проверка столкновений со стенками
    if (ballX + ballDX > canvas.width - ballRadius || ballX + ballDX < ballRadius) {
      ballDX = -ballDX;
    }
    if (ballY + ballDY < ballRadius + 20) {
      // +20, чтобы не перекрывало строку счёта
      ballDY = -ballDY;
    } else if (ballY + ballDY > canvas.height - ballRadius - paddleHeight - 10) {
      // Учитываем высоту ракетки
      if (ballX > paddleX && ballX < paddleX + paddleWidth) {
        ballDY = -ballDY;
      } else {
        // Потеря жизни
        lives--;
        if (lives <= 0) {
          showEndGameModal("GAME OVER", "Try again!");
        } else {
          // Сбрасываем мяч и ракетку
          ballX = canvas.width / 2;
          ballY = canvas.height - 40;
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
      paddleX += 5;
    } else if (leftPressed && paddleX > 0) {
      paddleX -= 5;
    }

    animationFrameId = requestAnimationFrame(draw);
  }

  // Запуск игры
  animationFrameId = requestAnimationFrame(draw);
  // Сохраняем id
  canvas.dataset.animationFrameId = animationFrameId;
}

// Функция сброса (остановки) игры
function resetGame4() {
  const canvas = document.getElementById("game4Canvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Отменяем анимацию
  if (canvas.dataset.animationFrameId) {
    cancelAnimationFrame(canvas.dataset.animationFrameId);
    canvas.dataset.animationFrameId = null;
  }

  // Сбрасываем слушатели клавиш/кнопок (по желанию)
  // document.removeEventListener("keydown", keyDownHandler);
  // document.removeEventListener("keyup", keyUpHandler);
  
  // Прячем кнопки управления
  document.getElementById("breakoutControls").style.display = "none";
}
