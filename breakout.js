function initBreakout() {
  const canvas = document.getElementById("breakoutCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  // Стили canvas (рамка, фон)
  canvas.style.backgroundColor = "black";
  canvas.style.border = "2px solid blue";

  // Начальные параметры мяча
  let ballRadius = 10;
  // Увеличим скорость (было 2, -2)
  let x = canvas.width / 2;
  let y = canvas.height - 30;
  let dx = 4;    // скорость по X
  let dy = -4;   // скорость по Y

  // Параметры платформы (уменьшим ширину до 50)
  const paddleHeight = 10;
  let paddleWidth = 50;
  let paddleX = (canvas.width - paddleWidth) / 2;

  // Параметры кирпичей
  const brickRowCount = 4;   // количество рядов
  const brickColumnCount = 10; // количество столбцов
  const brickWidth = 35;
  const brickHeight = 15;
  const brickPadding = 8;
  const brickOffsetTop = 40;
  const brickOffsetLeft = 15;

  let bricks = [];
  for (let c = 0; c < brickColumnCount; c++) {
    bricks[c] = [];
    for (let r = 0; r < brickRowCount; r++) {
      bricks[c][r] = { x: 0, y: 0, status: 1 };
    }
  }

  let score = 0;
  let lives = 3;

  // Обработчики событий клавиатуры
  let rightPressed = false;
  let leftPressed = false;

  document.addEventListener("keydown", keyDownHandler, false);
  document.addEventListener("keyup", keyUpHandler, false);

  function keyDownHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = true;
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = true;
    }
  }

  function keyUpHandler(e) {
    if(e.key === "Right" || e.key === "ArrowRight") {
      rightPressed = false;
    } else if(e.key === "Left" || e.key === "ArrowLeft") {
      leftPressed = false;
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
            if(score === brickRowCount * brickColumnCount) {
              alert("YOU WIN, CONGRATULATIONS!");
              document.location.reload();
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
    // Платформа тоже может быть синей
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
          // Синие кирпичи
          ctx.fillStyle = "#0080FF";
          ctx.fill();
          ctx.closePath();
        }
      }
    }
  }

  function drawScore() {
    ctx.font = "16px Arial";
    ctx.fillStyle = "#FFFFFF"; // белый текст
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
      // Попал ли мяч на ракетку?
      if(x > paddleX && x < paddleX + paddleWidth) {
        dy = -dy;
      } else {
        lives--;
        if(!lives) {
          alert("GAME OVER");
          document.location.reload();
        } else {
          // Сброс мяча и платформы
          x = canvas.width / 2;
          y = canvas.height - 30;
          dx = 4;
          dy = -4;
          paddleX = (canvas.width - paddleWidth) / 2;
        }
      }
    }

    // Движение платформы
    if(rightPressed && paddleX < canvas.width - paddleWidth) {
      paddleX += 7;
    } else if(leftPressed && paddleX > 0) {
      paddleX -= 7;
    }

    x += dx;
    y += dy;
    requestAnimationFrame(draw);
  }

  draw();
}

// Сброс игры (можно просто заново вызывать initBreakout)
function resetBreakout() {
  initBreakout();
}
