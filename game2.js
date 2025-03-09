/* game2.js – 3D Игра «Stack» с использованием Three.js
   Основные механики:
   • Базовый блок создаётся в центре сцены.
   • Каждый новый блок появляется над предыдущим и движется по горизонтали (по оси X или Z, чередуясь).
   • При нажатии клавиши или клике движущийся блок фиксируется – вычисляется пересечение с предыдущим блоком.
       – Если пересечение есть, размер блока уменьшается до области пересечения.
       – Если пересечения нет – игра заканчивается (вызывается модальное окно).
   • С каждым новым блоком скорость движения случайным образом меняется, что затрудняет авто-клики.
*/

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;
const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Массив уже уложенных блоков (каждый элемент: { mesh, size: {width, depth} } )
let stack = [];
// Текущий движущийся блок (объект { mesh, size, movingAxis, speed, direction } )
let currentBlock = null;

// Инициализация Three.js и базовых параметров сцены
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000); // фон – черный

  camera = new THREE.PerspectiveCamera(45, game2Canvas.width / game2Canvas.height, 1, 1000);
  // Начальное положение камеры – немного выше и дальше, чтобы видеть башню
  camera.position.set(0, 300, 500);
  camera.lookAt(new THREE.Vector3(0, 100, 0));

  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);

  // Освещение
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(0, 1, 1);
  scene.add(directionalLight);
}

// Создание базового (нижнего) блока
function createBaseBlock() {
  let geometry = new THREE.BoxGeometry(INITIAL_BLOCK_SIZE.width, BLOCK_HEIGHT, INITIAL_BLOCK_SIZE.depth);
  let material = new THREE.MeshLambertMaterial({ color: 0x00ffff }); // неоновый циан
  let mesh = new THREE.Mesh(geometry, material);
  // Размещаем базовый блок в центре, его нижняя грань на y = 0
  mesh.position.set(0, BLOCK_HEIGHT / 2, 0);
  let block = {
    mesh: mesh,
    size: { width: INITIAL_BLOCK_SIZE.width, depth: INITIAL_BLOCK_SIZE.depth }
  };
  scene.add(mesh);
  stack.push(block);
}

// Создание нового движущегося блока
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  // Новый блок наследует размеры предыдущего
  let newSize = { width: topBlock.size.width, depth: topBlock.size.depth };
  // Чередуем ось движения: если число блоков четное – двигаем по оси X, иначе – по оси Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
  // Случайная скорость от 2 до 6 (чтобы авто-кликер не работал стабильно)
  let blockSpeed = 2 + Math.random() * 4;
  let direction = 1; // направление движения (1 или -1)
  // Начальные координаты нового блока задаются относительно верхнего блока
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === "x") {
    // Начинаем с левого края относительно верхнего блока
    startX = topBlock.mesh.position.x - newSize.width;
    direction = 1;
  } else {
    // Если движение по оси Z – начинаем с "заднего" края
    startZ = topBlock.mesh.position.z - newSize.depth;
    direction = 1;
  }
  let newY = topBlock.mesh.position.y + BLOCK_HEIGHT;
  // Создаём геометрию нового блока
  let geometry = new THREE.BoxGeometry(newSize.width, BLOCK_HEIGHT, newSize.depth);
  let material = new THREE.MeshLambertMaterial({ color: 0x00ffff });
  let mesh = new THREE.Mesh(geometry, material);
  // Устанавливаем позицию: если движение по X – z совпадает с верхним блоком, иначе x совпадает
  mesh.position.set(
    (movingAxis === "x") ? startX : topBlock.mesh.position.x,
    newY,
    (movingAxis === "z") ? startZ : topBlock.mesh.position.z
  );
  currentBlock = {
    mesh: mesh,
    size: newSize, // текущий размер блока
    movingAxis: movingAxis, // "x" или "z"
    speed: blockSpeed,
    direction: direction
  };
  scene.add(mesh);
}

// Обновление положения движущегося блока
function updateGame() {
  if (!currentBlock) return;
  let topBlock = stack[stack.length - 1];
  if (currentBlock.movingAxis === "x") {
    currentBlock.mesh.position.x += currentBlock.speed * currentBlock.direction;
    // Определяем границы движения относительно верхнего блока
    let leftBound = topBlock.mesh.position.x - (topBlock.size.width / 2 + currentBlock.size.width);
    let rightBound = topBlock.mesh.position.x + (topBlock.size.width / 2 + currentBlock.size.width);
    if (currentBlock.mesh.position.x < leftBound) {
      currentBlock.mesh.position.x = leftBound;
      currentBlock.direction = 1;
    } else if (currentBlock.mesh.position.x > rightBound) {
      currentBlock.mesh.position.x = rightBound;
      currentBlock.direction = -1;
    }
  } else {
    currentBlock.mesh.position.z += currentBlock.speed * currentBlock.direction;
    let frontBound = topBlock.mesh.position.z - (topBlock.size.depth / 2 + currentBlock.size.depth);
    let backBound = topBlock.mesh.position.z + (topBlock.size.depth / 2 + currentBlock.size.depth);
    if (currentBlock.mesh.position.z < frontBound) {
      currentBlock.mesh.position.z = frontBound;
      currentBlock.direction = 1;
    } else if (currentBlock.mesh.position.z > backBound) {
      currentBlock.mesh.position.z = backBound;
      currentBlock.direction = -1;
    }
  }
}

// Функция фиксации блока (вызывается по нажатию клавиши или клику)
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;
  let topBlock = stack[stack.length - 1];
  let movingAxis = currentBlock.movingAxis;
  let overlap = 0;
  if (movingAxis === "x") {
    let currentLeft = currentBlock.mesh.position.x - currentBlock.size.width / 2;
    let currentRight = currentBlock.mesh.position.x + currentBlock.size.width / 2;
    let topLeft = topBlock.mesh.position.x - topBlock.size.width / 2;
    let topRight = topBlock.mesh.position.x + topBlock.size.width / 2;
    let overlapLeft = Math.max(currentLeft, topLeft);
    let overlapRight = Math.min(currentRight, topRight);
    overlap = overlapRight - overlapLeft;
    if (overlap <= 0) {
      gameOver();
      return;
    }
    // Вычисляем новый центр по оси X
    let newCenterX = (overlapLeft + overlapRight) / 2;
    // Обновляем геометрию блока: новая ширина = overlap, глубина не меняется
    let newGeometry = new THREE.BoxGeometry(overlap, BLOCK_HEIGHT, currentBlock.size.depth);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeometry;
    currentBlock.mesh.position.x = newCenterX;
    currentBlock.size.width = overlap;
  } else {
    let currentFront = currentBlock.mesh.position.z - currentBlock.size.depth / 2;
    let currentBack = currentBlock.mesh.position.z + currentBlock.size.depth / 2;
    let topFront = topBlock.mesh.position.z - topBlock.size.depth / 2;
    let topBack = topBlock.mesh.position.z + topBlock.size.depth / 2;
    let overlapFront = Math.max(currentFront, topFront);
    let overlapBack = Math.min(currentBack, topBack);
    overlap = overlapBack - overlapFront;
    if (overlap <= 0) {
      gameOver();
      return;
    }
    let newCenterZ = (overlapFront + overlapBack) / 2;
    let newGeometry = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, overlap);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeometry;
    currentBlock.mesh.position.z = newCenterZ;
    currentBlock.size.depth = overlap;
  }
  // Успешно зафиксированный блок добавляем в башню
  stack.push(currentBlock);
  score++;
  // Поднимаем камеру, чтобы новый блок был в поле зрения
  let newY = currentBlock.mesh.position.y;
  if (newY > camera.position.y - 100) {
    camera.position.y = newY + 100;
  }
  // Создаём следующий движущийся блок
  spawnNewBlock();
}

// Основной игровой цикл: обновление состояния и рендеринг
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Функция завершения игры: отключает анимацию, удаляет обработчики и показывает модальное окно
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  // Вызываем функцию показа модального окна (реализована в основном скрипте)
  showEndGameModal("Game Over", "Score: " + score);
}

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  // Инициализируем Three.js
  initThree();
  // Создаём базовый блок
  createBaseBlock();
  // Создаём первый движущийся блок
  spawnNewBlock();
  score = 0;
  gameRunning = true;
  // Добавляем обработчики: нажатие клавиши или клик мышью фиксируют блок
  window.addEventListener("keydown", onDropBlock);
  game2Canvas.addEventListener("click", onDropBlock);
  gameLoop();
}

// Функция сброса игры (вызывается, например, при закрытии)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (renderer) {
    renderer.clear();
  }
}

