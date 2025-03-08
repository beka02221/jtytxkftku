(function () {
  // Переменные для canvas и его контекста
  let canvas, ctx;
  // Получим размеры холста (убедитесь, что в index.html есть <canvas id="game2Canvas" ...>)
  let CANVAS_WIDTH = 400;
  let CANVAS_HEIGHT = 740;

  // Константы игры
  const INITIAL_BLOCK_WIDTH = 300; // начальная ширина блока
  const BLOCK_HEIGHT = 30;         // высота блока
  const BASE_SPEED = 4;            // базовая скорость движения блока
  const GRAVITY = 0.5;             // ускорение падения для обрезанных частей
  const SCORE_PER_BLOCK = 5;       // очки за поставленный блок

  // Глобальные переменные игры
  let stack = [];         // массив установленных блоков (башенка)
  let currentBlock;       // текущий движущийся блок
  let fallingPieces = []; // массив обрезанных (отпадающих) частей
  let gameRunning = false;
  let animationFrameId;
  let score = 0;
  let direction = 1;      // направление движения: 1 – вправо, -1 – влево

  // Звуковые эффекты
  let dropSound, chopSound, gameOverSound;
  function initSounds() {
    // Замените пути на корректные URL/файлы звуков
    dropSound = new Audio('drop.mp3');     // звук установки блока
    chopSound = new Audio('chop.mp3');       // звук обрезки лишней части
    gameOverSound = new Audio('gameover.mp3'); // звук окончания игры
  }

  // Инициализация игры
  function initGame2() {
    canvas = document.getElementById("game2Canvas");
    if (!canvas) {
      console.error("Canvas с id 'game2Canvas' не найден!");
      return;
    }
    ctx = canvas.getContext("2d");
    // Обновляем размеры холста, если они заданы через атрибуты
    CANVAS_WIDTH = canvas.width;
    CANVAS_HEIGHT = canvas.height;

    // Сброс состояния игры
    score = 0;
    stack = [];
    fallingPieces = [];
    gameRunning = true;
    direction = 1;

    // Создаём базовый (неподвижный) блок — основа башенки, размещённую по центру внизу
    const baseBlock = {
      x: (CANVAS_WIDTH - INITIAL_BLOCK_WIDTH) / 2,
      y: CANVAS_HEIGHT - BLOCK_HEIGHT,
      width: INITIAL_BLOCK_WIDTH,
      height: BLOCK_HEIGHT
    };
    stack.push(baseBlock);

    // Создаём первый движущийся блок, располагаемый непосредственно над базовым блоком
    currentBlock = {
      x: 0, // стартуем слева
      y: baseBlock.y - BLOCK_HEIGHT,
      width: baseBlock.width,
      height: BLOCK_HEIGHT,
      speed: BASE_SPEED
    };

    initSounds();

    // Добавляем обработчики ввода: нажатие клавиши (пробел) и щелчок (или тач)
    document.addEventListener("keydown", handleKeyDown);
    canvas.addEventListener("click", dropBlock);
    canvas.addEventListener("touchstart", dropBlock);

    // Запуск игрового цикла
    updateGame2();
  }

  // Сброс игры (для выхода/перезапуска)
  function resetGame2() {
    cancelAnimationFrame(animationFrameId);
    gameRunning = false;
    document.removeEventListener("keydown", handleKeyDown);
    canvas.removeEventListener("click", dropBlock);
    canvas.removeEventListener("touchstart", dropBlock);
    clearCanvas();
  }

  // Очистка холста
  function clearCanvas() {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  }

  // Основной игровой цикл
  function updateGame2() {
    if (!gameRunning) return;
    update();
    draw();
    animationFrameId = requestAnimationFrame(updateGame2);
  }

  // Обновление состояния игры
  function update() {
    // Обновляем позицию текущего блока (движется горизонтально)
    currentBlock.x += currentBlock.speed * direction;
    if (currentBlock.x <= 0) {
      currentBlock.x = 0;
      direction = 1;
    } else if (currentBlock.x + currentBlock.width >= CANVAS_WIDTH) {
      currentBlock.x = CANVAS_WIDTH - currentBlock.width;
      direction = -1;
    }

    // Обновляем положение обрезанных (падающих) частей
    for (let piece of fallingPieces) {
      piece.y += piece.vy;
      piece.vy += GRAVITY;
      piece.opacity -= 0.02;
    }
    // Удаляем уже исчезнувшие части
    fallingPieces = fallingPieces.filter(piece => piece.y < CANVAS_HEIGHT && piece.opacity > 0);
  }

  // Отрисовка состояния игры
  function draw() {
    clearCanvas();

    // Рисуем фон (градиент от черного к темно-серому)
    let gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
    gradient.addColorStop(0, "#000");
    gradient.addColorStop(1, "#222");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Отрисовываем установленные блоки (башенку)
    for (let block of stack) {
      drawBlock(block, "#00FF00");
    }

    // Отрисовываем текущий движущийся блок
    drawBlock(currentBlock, "#00FF00");

    // Отрисовываем падающие (обрезанные) части
    for (let piece of fallingPieces) {
      drawBlock(piece, "rgba(0,255,0," + piece.opacity + ")");
    }

    // Отрисовываем текущий счет
    ctx.fillStyle = "#fff";
    ctx.font = "20px 'Press Start 2P'";
    ctx.textAlign = "left";
    ctx.fillText("Score: " + score, 10, 30);
  }

  // Функция для отрисовки одного блока
  function drawBlock(block, color) {
    ctx.fillStyle = color;
    ctx.fillRect(block.x, block.y, block.width, block.height);
    ctx.strokeStyle = "#005500";
    ctx.lineWidth = 2;
    ctx.strokeRect(block.x, block.y, block.width, block.height);
  }

  // Обработчик нажатия клавиши: при нажатии пробела блок «становится»
  function handleKeyDown(e) {
    if (e.code === "Space") {
      dropBlock();
    }
  }

  // Функция установки блока (вызывается по клику/тапу или нажатию пробела)
  function dropBlock() {
    if (!gameRunning) return;

    // Воспроизводим звук установки
    if (dropSound) dropSound.play();

    // Получаем предыдущий (верхний) блок башенки
    const previousBlock = stack[stack.length - 1];

    // Вычисляем пересечение текущего блока с предыдущим
    let overlapStart = Math.max(currentBlock.x, previousBlock.x);
    let overlapEnd = Math.min(currentBlock.x + currentBlock.width, previousBlock.x + previousBlock.width);
    let overlapWidth = overlapEnd - overlapStart;

    // Если пересечения нет – игра окончена
    if (overlapWidth <= 0) {
      gameOver();
      return;
    }

    // Если блок обрезан (неполное пересечение), проигрываем звук «обрезки» и создаём анимацию падающей части
    if (overlapWidth < currentBlock.width) {
      if (chopSound) chopSound.play();
      // Если блок выступает слева от предыдущего
      if (currentBlock.x < previousBlock.x) {
        let choppedWidth = previousBlock.x - currentBlock.x;
        fallingPieces.push({
          x: currentBlock.x,
          y: currentBlock.y,
          width: choppedWidth,
          height: currentBlock.height,
          vy: 0,
          opacity: 1
        });
      }
      // Если блок выступает справа
      else if (currentBlock.x + currentBlock.width > previousBlock.x + previousBlock.width) {
        let choppedWidth = currentBlock.x + currentBlock.width - (previousBlock.x + previousBlock.width);
        fallingPieces.push({
          x: previousBlock.x + previousBlock.width,
          y: currentBlock.y,
          width: choppedWidth,
          height: currentBlock.height,
          vy: 0,
          opacity: 1
        });
      }
    }

    // Обрезаем текущий блок до пересечения
    currentBlock.width = overlapWidth;
    currentBlock.x = overlapStart;

    // Добавляем скорректированный блок в башенку
    stack.push({
      x: currentBlock.x,
      y: currentBlock.y,
      width: currentBlock.width,
      height: currentBlock.height
    });

    // Начисляем очки
    score += SCORE_PER_BLOCK;

    // Создаём новый движущийся блок, который появляется выше предыдущего
    const nextY = currentBlock.y - BLOCK_HEIGHT;
    // Если башенка слишком высока (близко к верхней границе), сдвигаем всю башенку вниз
    if (nextY < 100) {
      let shift = 100 - nextY;
      stack.forEach(block => block.y += shift);
      fallingPieces.forEach(piece => piece.y += shift);
      currentBlock.y += shift;
    }

    // Новый блок стартует с левого края, его ширина равна пересечению
    currentBlock = {
      x: 0,
      y: currentBlock.y - BLOCK_HEIGHT,
      width: overlapWidth,
      height: BLOCK_HEIGHT,
      speed: BASE_SPEED + score * 0.1 // скорость немного растёт с каждым блоком
    };
    direction = 1; // начинаем движение вправо
  }

  // Функция окончания игры
  function gameOver() {
    gameRunning = false;
    if (gameOverSound) gameOverSound.play();
    cancelAnimationFrame(animationFrameId);
    // Можно показать модальное окно или просто вывести alert с результатом
    setTimeout(() => {
      alert("Game Over! Your score: " + score);
      // Здесь можно также обновить пользовательские данные (например, начислить очки)
    }, 100);
  }

  // Экспорт функций в глобальное пространство, чтобы index.html мог их вызвать
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
