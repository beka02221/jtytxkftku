(function() {
  // Константы игры
  const CANVAS_WIDTH = 400;
  const CANVAS_HEIGHT = 600;
  const BLOCK_HEIGHT = 30;
  const INITIAL_BLOCK_WIDTH = 200;
  let moveSpeed = 3; // начальная скорость движения блока

  let canvas, ctx;
  let stack = [];      // массив зафиксированных блоков (стопка)
  let movingBlock;     // текущий движущийся блок
  let gameRunning = false;
  let score = 0;

  // Инициализация игры
  function initStackGame() {
    canvas = document.getElementById("stackGameCanvas");
    if (!canvas) {
      // Если canvas не найден, создаём его и добавляем в body
      canvas = document.createElement("canvas");
      canvas.id = "stackGameCanvas";
      document.body.appendChild(canvas);
    }
    ctx = canvas.getContext("2d");
    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    // Сброс состояния игры
    stack = [];
    score = 0;
    moveSpeed = 3;

    // Создаём базовый блок (основание стопки) в нижней части экрана
    const baseBlock = {
      x: (CANVAS_WIDTH - INITIAL_BLOCK_WIDTH) / 2,
      y: CANVAS_HEIGHT - BLOCK_HEIGHT,
      width: INITIAL_BLOCK_WIDTH,
      height: BLOCK_HEIGHT
    };
    stack.push(baseBlock);

    // Создаём первый движущийся блок, который будет двигаться слева направо
    movingBlock = {
      x: 0,
      y: baseBlock.y - BLOCK_HEIGHT,
      width: baseBlock.width,
      height: BLOCK_HEIGHT,
      direction: 1  // 1: вправо, -1: влево
    };

    gameRunning = true;
    // Добавляем обработчик клика для фиксации блока
    canvas.addEventListener("click", placeBlock);
    // Запускаем игровой цикл
    requestAnimationFrame(gameLoop);
  }

  // Игровой цикл
  function gameLoop() {
    if (!gameRunning) return;
    update();
    draw();
    requestAnimationFrame(gameLoop);
  }

  // Обновление состояния игры
  function update() {
    // Движение блока по горизонтали
    movingBlock.x += movingBlock.direction * moveSpeed;
    // Проверка границ: если блок достиг края, меняем направление
    if (movingBlock.x < 0) {
      movingBlock.x = 0;
      movingBlock.direction = 1;
    } else if (movingBlock.x + movingBlock.width > CANVAS_WIDTH) {
      movingBlock.x = CANVAS_WIDTH - movingBlock.width;
      movingBlock.direction = -1;
    }
  }

  // Отрисовка игры
  function draw() {
    // Очистка канваса
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Рисуем стопку блоков
    for (const block of stack) {
      ctx.fillStyle = "#00FF00";
      ctx.fillRect(block.x, block.y, block.width, block.height);
      ctx.strokeStyle = "#005500";
      ctx.strokeRect(block.x, block.y, block.width, block.height);
    }

    // Рисуем движущийся блок
    ctx.fillStyle = "#00FF00";
    ctx.fillRect(movingBlock.x, movingBlock.y, movingBlock.width, movingBlock.height);
    ctx.strokeStyle = "#005500";
    ctx.strokeRect(movingBlock.x, movingBlock.y, movingBlock.width, movingBlock.height);

    // Отрисовка счёта
    ctx.fillStyle = "#00FF00";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Score: " + score, CANVAS_WIDTH / 2, 30);
  }

  // Фиксация движущегося блока (по клику)
  function placeBlock() {
    // Определяем последний блок в стопке
    const lastBlock = stack[stack.length - 1];
    // Вычисляем область пересечения движущегося блока и последнего блока
    const overlapStart = Math.max(movingBlock.x, lastBlock.x);
    const overlapEnd = Math.min(movingBlock.x + movingBlock.width, lastBlock.x + lastBlock.width);
    const overlapWidth = overlapEnd - overlapStart;

    // Если пересечения нет – игра окончена
    if (overlapWidth <= 0) {
      endGame();
      return;
    }

    // Обрезаем движущийся блок по области пересечения
    movingBlock.width = overlapWidth;
    movingBlock.x = overlapStart;

    // Добавляем зафиксированный блок в стопку
    stack.push({ ...movingBlock });
    score++;

    // Увеличиваем скорость движения с каждым уровнем (по желанию)
    moveSpeed += 0.2;

    // Создаём новый движущийся блок для следующего уровня
    const newBlock = {
      // Начинаем с противоположной стороны для разнообразия движения
      x: (stack.length % 2 === 0) ? 0 : CANVAS_WIDTH - movingBlock.width,
      y: movingBlock.y - BLOCK_HEIGHT,
      width: movingBlock.width,
      height: BLOCK_HEIGHT,
      direction: (stack.length % 2 === 0) ? 1 : -1
    };

    // Если новый блок выходит за верхнюю границу, перемещаем всю стопку вниз
    if (newBlock.y < 0) {
      for (const block of stack) {
        block.y += BLOCK_HEIGHT;
      }
      newBlock.y += BLOCK_HEIGHT;
    }

    movingBlock = newBlock;
  }

  // Завершение игры
  function endGame() {
    gameRunning = false;
    canvas.removeEventListener("click", placeBlock);
    // Отображаем сообщение о завершении игры
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.fillStyle = "#00FF00";
    ctx.font = "30px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Game Over", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
    ctx.font = "20px 'Press Start 2P'";
    ctx.fillText("Score: " + score, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 40);
  }

  // Экспортируем функцию инициализации игры
  window.initStackGame = initStackGame;
})();
