(function () {
  // Параметры игры
  const BLOCK_HEIGHT = 30;                   // Высота блока (в пикселях)
  const INITIAL_BLOCK_WIDTH = 300;           // Начальная ширина базового блока
  const HORIZONTAL_SPEED = 4;                // Скорость горизонтального движения
  const DROP_SPEED = 10;                     // Скорость анимации падения блока
  const POINTS_PER_BLOCK = 5;                // Очки за каждый успешно уложенный блок

  // Звуковые эффекты (проверьте пути к файлам или замените их)
  const dropSound = new Audio('drop.mp3');
  const cutSound = new Audio('cut.mp3');
  const gameOverSound = new Audio('gameover.mp3');

  // Глобальные переменные игры
  let canvas, ctx;
  let gameRunning = false;
  let animationFrameId;
  let score = 0;
  let blocks = [];         // Массив успешно уложенных блоков
  let baseBlock = null;    // Базовый (начальный) блок
  let currentBlock = null; // Текущий движущийся блок

  // Инициализировать базовый блок в нижней части экрана
  function initBaseBlock() {
    const canvasWidth = canvas.width;
    const x = (canvasWidth - INITIAL_BLOCK_WIDTH) / 2;
    const y = canvas.height - BLOCK_HEIGHT;
    return { x: x, y: y, width: INITIAL_BLOCK_WIDTH, height: BLOCK_HEIGHT };
  }

  // Создать новый движущийся блок, который появляется сверху стека
  function spawnBlock() {
    // Блок наследует ширину последнего успешно уложенного блока
    const lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : baseBlock;
    const blockWidth = lastBlock.width;
    return {
      x: 0,                           // Начинаем с левого края
      y: lastBlock.y - BLOCK_HEIGHT,  // Появляется сразу над последним блоком
      width: blockWidth,
      height: BLOCK_HEIGHT,
      direction: 1                    // Направление движения: 1 = вправо, -1 = влево
    };
  }

  // Основной игровой цикл: обновление положения и отрисовка
  function update() {
    if (!gameRunning) return;

    // Обновляем положение текущего блока
    currentBlock.x += currentBlock.direction * HORIZONTAL_SPEED;

    // Отскок блока от боковых границ
    if (currentBlock.x <= 0) {
      currentBlock.x = 0;
      currentBlock.direction = 1;
    } else if (currentBlock.x + currentBlock.width >= canvas.width) {
      currentBlock.x = canvas.width - currentBlock.width;
      currentBlock.direction = -1;
    }

    // Перерисовка игрового поля
    draw();

    // Запрос следующего кадра
    animationFrameId = requestAnimationFrame(update);
  }

  // Отрисовка всех элементов игры
  function draw() {
    // Очистка холста
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Фон – чёрный
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Рисуем уже уложенные блоки
    if (blocks.length > 0) {
      blocks.forEach(block => drawBlock(block));
    } else if (baseBlock) {
      drawBlock(baseBlock);
    }

    // Рисуем текущий движущийся блок
    if (currentBlock) {
      drawBlock(currentBlock);
    }

    // Рисуем счёт
    ctx.fillStyle = "#fff";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "center";
    ctx.fillText("Score: " + score, canvas.width / 2, 30);
  }

  // Функция для отрисовки одного блока с эффектом свечения
  function drawBlock(block) {
    ctx.fillStyle = "#00FF00"; // Неоновый зелёный цвет
    ctx.shadowColor = "#00FF00";
    ctx.shadowBlur = 10;
    ctx.fillRect(block.x, block.y, block.width, block.height);
    ctx.shadowBlur = 0;
  }

  // Обработка события "фиксировать блок" – при клике или нажатии пробела
  function dropCurrentBlock() {
    if (!gameRunning) return;
    // Анимация падения: блок опускается до своей конечной позиции
    let lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : baseBlock;
    const targetY = lastBlock.y - BLOCK_HEIGHT;

    function animateDrop() {
      if (currentBlock.y < targetY) {
        currentBlock.y += DROP_SPEED;
        if (currentBlock.y > targetY) currentBlock.y = targetY;
        draw();
        requestAnimationFrame(animateDrop);
      } else {
        // После анимации падения проверяем пересечение с предыдущим блоком
        checkOverlap();
      }
    }

    // Воспроизводим звук фиксирования блока
    dropSound.play();
    animateDrop();
  }

  // Проверка пересечения текущего блока с предыдущим (базовым)
  function checkOverlap() {
    let lastBlock = blocks.length > 0 ? blocks[blocks.length - 1] : baseBlock;
    // Вычисляем пересечение по оси X
    let overlapX = Math.max(currentBlock.x, lastBlock.x);
    let overlapEnd = Math.min(currentBlock.x + currentBlock.width, lastBlock.x + lastBlock.width);
    let overlapWidth = overlapEnd - overlapX;

    // Если пересечения нет – игра окончена
    if (overlapWidth <= 0) {
      gameOver();
      return;
    }

    // Определяем части, которые не попали в пересечение
    let cutWidthLeft = overlapX - currentBlock.x;
    let cutWidthRight = (currentBlock.x + currentBlock.width) - overlapEnd;

    // Если есть выступающие части – анимируем их падение
    if (cutWidthLeft > 0) {
      let cutBlock = {
        x: currentBlock.x,
        y: currentBlock.y,
        width: cutWidthLeft,
        height: currentBlock.height,
        vy: 5
      };
      animateCutOff(cutBlock);
    }
    if (cutWidthRight > 0) {
      let cutBlock = {
        x: overlapEnd,
        y: currentBlock.y,
        width: cutWidthRight,
        height: currentBlock.height,
        vy: 5
      };
      animateCutOff(cutBlock);
    }

    // Обрезаем текущий блок до размера пересечения
    currentBlock.x = overlapX;
    currentBlock.width = overlapWidth;
    // Добавляем текущий блок в стопку
    blocks.push(currentBlock);
    // Обновляем счёт
    score += POINTS_PER_BLOCK;
    // Спавним следующий блок
    spawnNextBlock();
  }

  // Анимация отсекаемой части (падающего кусочка)
  function animateCutOff(cutBlock) {
    function fall() {
      cutBlock.y += cutBlock.vy;
      draw();
      // Отрисовываем отрезанную часть (можно выделить другим цветом)
      ctx.fillStyle = "#FF0000";
      ctx.fillRect(cutBlock.x, cutBlock.y, cutBlock.width, cutBlock.height);
      if (cutBlock.y < canvas.height) {
        requestAnimationFrame(fall);
      }
    }
    // Воспроизводим звук отсекаемой части
    cutSound.play();
    fall();
  }

  // Создание нового блока для следующего хода
  function spawnNextBlock() {
    // Если стопка достигла верха холста – игра завершается
    if (blocks.length > Math.floor(canvas.height / BLOCK_HEIGHT)) {
      gameOver();
      return;
    }
    currentBlock = spawnBlock();
  }

  // Завершение игры: остановка анимации и проигрывание звука game over
  function gameOver() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    gameOverSound.play();
    // Если в глобальном пространстве определена функция для показа модального окна окончания игры (например, showEndGameModal),
    // то вызываем её, передавая заголовок и финальный счёт.
    if (window.showEndGameModal) {
      window.showEndGameModal("Game Over", "Score: " + score);
    }
  }

  // Обработчик ввода: клик мышью или нажатие пробела
  function handleInput(e) {
    if (!gameRunning) return;
    dropCurrentBlock();
  }

  // Назначение обработчиков событий
  function setupInput() {
    canvas.addEventListener("click", handleInput);
    document.addEventListener("keydown", function (e) {
      if (e.code === "Space" || e.key === " ") {
        handleInput(e);
      }
    });
  }

  // Удаление обработчиков (при сбросе игры)
  function removeInput() {
    canvas.removeEventListener("click", handleInput);
    // Для keydown можно добавить логику удаления, если требуется
  }

  // Функция инициализации игры (вызывается при запуске game2)
  function initGame2() {
    canvas = document.getElementById("match3Canvas");
    if (!canvas) {
      console.error("Canvas с id 'match3Canvas' не найден");
      return;
    }
    ctx = canvas.getContext("2d");
    canvas.style.background = "#000";
    // Инициализация переменных
    gameRunning = true;
    score = 0;
    blocks = [];
    baseBlock = initBaseBlock();
    currentBlock = spawnBlock();
    setupInput();
    update();
  }

  // Функция сброса игры
  function resetGame2() {
    gameRunning = false;
    cancelAnimationFrame(animationFrameId);
    removeInput();
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // Экспортируем функции в глобальное пространство, чтобы index.html мог их вызвать
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
