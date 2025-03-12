function initBreakout() {
  const canvas = document.getElementById("breakoutCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Стили canvas (рамка, фон)
  canvas.style.backgroundColor = "black";
  canvas.style.border = "2px solid blue";

  // Параметры платформы (уменьшим ширину)
  const paddleHeight = 10;
  let paddleWidth = 40;
  let paddleX = (canvas.width - paddleWidth) / 2;

  // Параметры мяча и базовая скорость (будем повышать на каждом уровне)
  const ballRadius = 10;
  let baseSpeedX = 4; 
  let baseSpeedY = 4; 
  // Текущая скорость мяча
  let dx = 0;  
  let dy = 0;  

  // Позиция мяча
  let x = paddleX + paddleWidth / 2;  
  let y = canvas.height - paddleHeight - 10 - ballRadius;

  // Параметры кирпичей
  let brickRowCount = 4;    
  let brickColumnCount = 10;
  let brickWidth = 35;
  let brickHeight = 15;
  let brickPadding = 8;
  let brickOffsetTop = 40;
  let brickOffsetLeft = 15;

  // Количество кирпичей всего
  const totalBricks = brickRowCount * brickColumnCount;

  // Массив кирпичей
  let bricks = [];

  // Функция, восстанавливающая все кирпичи
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

  // Начальные значения
  let score = 0;
  let level = 1; 
  let lives = 1;       // только 1 жизнь
  let gameStarted = false; // пока не двигаем мяч, пока игрок не сдвинет платформу

  // Обработчики событий клавиатуры
  let rightPressed = false;
  let leftPressed = false;

  document.addEventListener("keydown", keyDownHandler, false);
  document.addEventListener("keyup", keyUpHandler, false);

  function keyDownHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = true;
      startBallIfNeeded();
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = true;
      startBallIfNeeded();
    }
  }

  function keyUpHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = false;
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = false;
    }
  }

  // Если игра ещё не началась, запускаем мяч, когда игрок впервые двигает платформу
  function startBallIfNeeded() {
    if(!gameStarted) {
      gameStarted = true;
      // Задаём скорости мяча в зависимости от уровня
      dx = baseSpeedX + (level - 1);
      dy = -(baseSpeedY + (level - 1));
    }
  }

  // Проверка столкновений мяча и кирпичей
  function collisionDetection() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        const b = bricks[c][r];
        if (b.status === 1) {
          if (
            x > b.x &&
            x < b.x + brickWidth &&
            y > b.y &&
            y < b.y + brickHeight
          ) {
            dy = -dy;
            b.status = 0;
            score++;
            // Проверяем, все ли кирпичи уничтожены
            if(score % totalBricks === 0) {
              // Переход на следующий уровень
              level++;
              // Увеличиваем скорость мяча (на каждый уровень +1 к скорости)
              dx = baseSpeedX + (level - 1);
              dy = -(baseSpeedY + (level - 1));
              // Сбрасываем кирпичи
              resetBricks();
              // Возвращаем мяч на платформу, чтобы игрок мог начать заново
              gameStarted = false;
              x = paddleX + paddleWidth / 2; 
              y = canvas.height - paddleHeight - 10 - ballRadius;
            }
          }
        }
      }
    }
  }

  function drawBall() {
    ctx.beginPath();
    // Оранжевый мяч
    ctx.arc(x, y, ballRadius, 0, Math.PI*2);
    ctx.fillStyle = "#FF4500";
    ctx.fill();
    ctx.closePath();
  }

  function drawPaddle() {
    ctx.beginPath();
    ctx.rect(paddleX, canvas.height - paddleHeight - 10, paddleWidth, paddleHeight);
    ctx.fillStyle = "#0095DD";
    ctx.fill();
    ctx.closePath();
  }

  function drawBricks() {
    for (let c = 0; c < brickColumnCount; c++) {
      for (let r = 0; r < brickRowCount; r++) {
        if (bricks[c][r].status === 1) {
          const brickX = (c * (brickWidth + brickPadding)) + brickOffsetLeft;
          const brickY = (r * (brickHeight + brickPadding)) + brickOffsetTop;
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

    // Если игра не началась, мяч следует за платформой
    if(!gameStarted) {
      x = paddleX + paddleWidth / 2;
      y = canvas.height - paddleHeight - 10 - ballRadius;
    } else {
      // Двигаем мяч, если игра идёт
      // Отскок от боковых стен
      if(x + dx > canvas.width - ballRadius || x + dx < ballRadius) {
        dx = -dx;
      }
      // Отскок от верхней стены
      if(y + dy < ballRadius) {
        dy = -dy;
      }
      // Проверка нижней границы
      else if(y + dy > canvas.height - ballRadius) {
        // Проверяем, попал ли мяч на платформу
        if(x > paddleX && x < paddleX + paddleWidth) {
          dy = -dy;
        } else {
          // Потеряли жизнь
          lives--;
          if(lives <= 0) {
            alert("GAME OVER");
            document.location.reload();
          } else {
            // Сброс мяча и остановка, чтобы ждать движения платформы
            gameStarted = false;
            x = paddleX + paddleWidth / 2;
            y = canvas.height - paddleHeight - 10 - ballRadius;
            dx = 0;
            dy = 0;
          }
        }
      }
      x += dx;
      y += dy;
    }

    // Движение платформы
    if(rightPressed && paddleX < canvas.width - paddleWidth) {
      paddleX += 7;
    } else if(leftPressed && paddleX > 0) {
      paddleX -= 7;
    }

    requestAnimationFrame(draw);
  }

  draw();
}

// Сброс игры (можно просто заново вызывать initBreakout)
function resetBreakout() {
  initBreakout();
}
