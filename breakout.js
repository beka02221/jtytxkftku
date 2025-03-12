// Глобальная переменная для хранения id анимации игры breakout
let breakoutAnimationId;

function initBreakout() {
  const canvas = document.getElementById("breakoutCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Стили canvas
  canvas.style.backgroundColor = "black";
  canvas.style.border = "2px solid blue";

  // Параметры платформы (уменьшенная ширина)
  const paddleHeight = 10;
  let paddleWidth = 40;
  let paddleX = (canvas.width - paddleWidth) / 2;

  // Параметры мяча
  const ballRadius = 10;
  let baseSpeedX = 4;
  let baseSpeedY = 4;
  let dx = 0;
  let dy = 0;
  // Мяч стартует, расположившись на центре платформы
  let x = paddleX + paddleWidth / 2;
  let y = canvas.height - paddleHeight - ballRadius - 2;

  // Параметры кирпичей
  let brickRowCount = 4;
  let brickColumnCount = 10;
  let brickWidth = 35;
  let brickHeight = 15;
  let brickPadding = 8;
  let brickOffsetTop = 40;
  let brickOffsetLeft = 15;

  let score = 0;
  let level = 1;
  let lives = 1; // только 1 жизнь
  let gameStarted = false; // мяч пока не запущен

  // Массив кирпичей и функция сброса
  let bricks = [];
  function resetBricks() {
    bricks = [];
    for (let c = 0; c < brickColumnCount; c++) {
      bricks[c] = [];
      for (let r = 0; r < brickRowCount; r++) {
        bricks[c][r] = { x: 0, y: 0, status: 1 };
      }
    }
  }
  resetBricks();

  // Управление с клавиатуры
  let rightPressed = false;
  let leftPressed = false;
  document.addEventListener("keydown", keyDownHandler, false);
  document.addEventListener("keyup", keyUpHandler, false);

  function keyDownHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = true;
      startBallIfNeeded();
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = true;
      startBallIfNeeded();
    }
  }
  function keyUpHandler(e) {
    if (e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = false;
    } else if (e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = false;
    }
  }

  // Поддержка управления касанием для мобильных устройств
  canvas.addEventListener("touchmove", function(e) {
    let rect = canvas.getBoundingClientRect();
    let touchX = e.touches[0].clientX - rect.left;
    paddleX = touchX - paddleWidth / 2;
    if (paddleX < 0) paddleX = 0;
    if (paddleX > canvas.width - paddleWidth) paddleX = canvas.width - paddleWidth;
    startBallIfNeeded();
    e.preventDefault();
  }, { passive: false });

  // При первом движении платформы запускаем мяч
  function startBallIfNeeded() {
    if (!gameStarted) {
      gameStarted = true;
      dx = baseSpeedX + (level - 1);
      dy = -(baseSpeedY + (level - 1));
    }
  }

  function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        let b = bricks[c][r];
        if (b.status === 1) {
          if (x > b.x && x < b.x + brickWidth && y > b.y && y < b.y + brickHeight) {
            dy = -dy;
            b.status = 0;
            score++;
            // Если все кирпичи сбиты, переходим на новый уровень
            if (score % (brickRowCount * brickColumnCount) === 0) {
              level++;
              dx = baseSpeedX + (level - 1);
              dy = -(baseSpeedY + (level - 1));
              resetBricks();
              gameStarted = false;
              x = paddleX + paddleWidth / 2;
              y = canvas.height - paddleHeight - ballRadius - 2;
            }
          }
        }
      }
    }
  }

  function drawBall() {
    ctx.beginPath();
    ctx.arc(x, y, ballRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#FF4500"; // оранжевый
    ctx.fill();
    ctx.closePath();
  }

  function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight - 2, paddleWidth, paddleHeight);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
  }

  function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        if (bricks[c][r].status === 1) {
          let brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
          let brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
          bricks[c][r].x = brickX;
          bricks[c][r].y = brickY;
          ctx.beginPath();
          ctx.rect(brickX, brickY, brickWidth, brickHeight);
          ctx.fillStyle = "#0080FF";
          ctx.fill();
          ctx.closePath();
        }
      }
    }
  }

  function drawScore() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Score: " + score, 8, 20);
  }

  function drawLives() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText("Lives: " + lives, canvas.width - 75, 20);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBricks();
    drawBall();
    drawPaddle();
    drawScore();
    drawLives();
    collisionDetection();

    if (!gameStarted) {
      // Пока игрок не запустил игру, мяч остается на платформе
      x = paddleX + paddleWidth / 2;
      y = canvas.height - paddleHeight - ballRadius - 2;
    } else {
      // Движение мяча
      if (x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
        dx = -dx;
      }
      if (y + dy < ballRadius) {
        dy = -dy;
      }
      // Если мяч опускается ниже уровня платформы (учитываем положение платформы)
      else if (y + dy > canvas.height - paddleHeight - ballRadius - 2) {
        if (x > paddleX && x < paddleX + paddleWidth) {
          dy = -dy;
        } else {
          // Промах – игра окончена
          lives--;
          if (lives <= 0) {
            showGlobalModal("Game Over", "Your final score: " + score);
            cancelAnimationFrame(breakoutAnimationId);
            return;
          } else {
            gameStarted = false;
            x = paddleX + paddleWidth / 2;
            y = canvas.height - paddleHeight - ballRadius - 2;
            dx = 0;
            dy = 0;
          }
        }
      }
      x += dx;
      y += dy;
    }

    // Обновление позиции платформы (клавиатура)
    if (rightPressed && paddleX < canvas.width - paddleWidth) {
      paddleX += 7;
    } else if (leftPressed && paddleX > 0) {
      paddleX -= 7;
    }

    breakoutAnimationId = requestAnimationFrame(draw);
  }

  breakoutAnimationId = requestAnimationFrame(draw);
}

function resetBreakout() {
  cancelAnimationFrame(breakoutAnimationId);
  // Удаляем обработчики клавиатуры (если нужно)
  document.removeEventListener("keydown", keyDownHandler);
  document.removeEventListener("keyup", keyUpHandler);
  const canvas = document.getElementById("breakoutCanvas");
  if (canvas) {
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function finishBreakout() {
  resetBreakout();
  // Дополнительная логика закрытия игры (например, показать главное меню)
}
