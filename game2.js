/* game2.js – Игра «Stack»
   Описание:
   - Базовый (нижний) блок создаётся в центре нижней части экрана.
   - Каждый новый блок движется горизонтально над предыдущим блоком.
   - При нажатии (или клике) фиксируется позиция движущегося блока.
   - Вычисляется пересечение нового блока с верхним блоком башенки:
       • Если пересечение есть, лишнее отсекается, а оставшаяся часть становится базой для следующего блока.
       • Если пересечения нет – игра заканчивается.
   - Подсчёт очков ведётся по количеству успешно уложенных блоков.
*/

let game2Canvas, game2Ctx;
let canvasWidth, canvasHeight;

const blockHeight = 30;
const initialBlockWidth = 300; // начальная ширина базового блока
const speed = 3;              // скорость движения блока

let stack = [];               // массив уложенных блоков (каждый: {x, y, width, height})
let currentBlock = null;      // текущий движущийся блок
let gameRunning = false;
let animationFrameId = null;
let score = 0;

// Инициализация игры
function initGame2() {
  // Для game2 используется canvas с id "match3Canvas"
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  game2Ctx = game2Canvas.getContext('2d');
  canvasWidth = game2Canvas.width;
  canvasHeight = game2Canvas.height;
  
  // Инициализируем башенку: базовый блок в центре нижней части экрана
  stack = [];
  let baseBlock = {
    width: initialBlockWidth,
    height: blockHeight,
    x: (canvasWidth - initialBlockWidth) / 2,
    y: canvasHeight - blockHeight
  };
  stack.push(baseBlock);

  // Создаём первый движущийся блок
  spawnNewBlock();

  score = 0;
  gameRunning = true;

  // Добавляем обработчики: нажатие клавиши или клик мышью фиксирует блок
  window.addEventListener("keydown", onDropBlock);
  game2Canvas.addEventListener("click", onDropBlock);

  gameLoop();
}

// Функция создания нового движущегося блока.
// Новый блок наследует ширину верхнего блока башенки и появляется непосредственно над ним.
// Для разнообразия направление движения чередуется.
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  let newBlock = {
    width: topBlock.width,
    height: blockHeight,
    y: topBlock.y - blockHeight,
    // Начальное положение и направление зависят от номера хода
    direction: 1 // 1 – движение вправо, -1 – влево
  };
  if (stack.length % 2 === 0) {
    newBlock.x = 0;         // стартуем с левого края
    newBlock.direction = 1;
  } else {
    newBlock.x = canvasWidth - newBlock.width; // стартуем с правого края
    newBlock.direction = -1;
  }
  currentBlock = newBlock;
}

// Обработчик события фиксации блока (нажатие клавиши или клик мышью)
function onDropBlock(e) {
  if (!gameRunning || !currentBlock) return;
  let topBlock = stack[stack.length - 1];
  let overlap = getOverlap(currentBlock, topBlock);
  
  if (overlap > 0) {
    // Подгоняем новый блок под область пересечения
    let newX = Math.max(currentBlock.x, topBlock.x);
    currentBlock.width = overlap;
    currentBlock.x = newX;
    // Добавляем блок в башенку и увеличиваем счёт
    stack.push(currentBlock);
    score++;
    // Создаём следующий движущийся блок
    spawnNewBlock();
  } else {
    // Нет пересечения – игра окончена
    gameOver();
  }
}

// Функция расчёта пересечения по оси X двух блоков
function getOverlap(block1, block2) {
  let start = Math.max(block1.x, block2.x);
  let end = Math.min(block1.x + block1.width, block2.x + block2.width);
  return Math.max(0, end - start);
}

// Основной игровой цикл
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  drawGame();
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Обновление состояния игры: перемещение текущего блока
function updateGame() {
  if (!currentBlock) return;
  currentBlock.x += speed * currentBlock.direction;
  
  // Отскок при достижении границ экрана
  if (currentBlock.x <= 0) {
    currentBlock.x = 0;
    currentBlock.direction = 1;
  }
  if (currentBlock.x + currentBlock.width >= canvasWidth) {
    currentBlock.x = canvasWidth - currentBlock.width;
    currentBlock.direction = -1;
  }
}

// Отрисовка игрового поля и объектов
function drawGame() {
  // Заливаем фон чёрным
  game2Ctx.fillStyle = "#000000";
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Рисуем уложенные блоки
  for (let block of stack) {
    game2Ctx.fillStyle = "#0FF"; // неоновый циан
    game2Ctx.fillRect(block.x, block.y, block.width, block.height);
    game2Ctx.strokeStyle = "#FFFFFF";
    game2Ctx.lineWidth = 2;
    game2Ctx.strokeRect(block.x, block.y, block.width, block.height);
  }
  
  // Рисуем движущийся блок
  if (currentBlock) {
    game2Ctx.fillStyle = "#0FF";
    game2Ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.height);
    game2Ctx.strokeStyle = "#FFFFFF";
    game2Ctx.lineWidth = 2;
    game2Ctx.strokeRect(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.height);
  }
  
  // Отображаем счёт
  game2Ctx.fillStyle = "#FFFFFF";
  game2Ctx.font = "20px Arial";
  game2Ctx.fillText("Score: " + score, 10, 30);
}

// Завершение игры: остановка игрового цикла, удаление обработчиков и вывод сообщения
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  
  // Затемняем экран и выводим сообщение о завершении игры
  game2Ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
  game2Ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  game2Ctx.fillStyle = "#FFFFFF";
  game2Ctx.font = "30px Arial";
  game2Ctx.fillText("Game Over!", canvasWidth / 2 - 80, canvasHeight / 2);
  game2Ctx.font = "20px Arial";
  game2Ctx.fillText("Score: " + score, canvasWidth / 2 - 40, canvasHeight / 2 + 30);
}

// Функция сброса игры (например, при закрытии)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (game2Ctx) {
    game2Ctx.clearRect(0, 0, canvasWidth, canvasHeight);
  }
}
