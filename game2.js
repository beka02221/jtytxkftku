// game2.js – базовая 3D-игра «Stack» в Three.js
// ----------------------------------------------
//  • Камера: (0,10,-10), Rotation X=35°, Y=45°, Z=0°, FOV=40°
//  • Размер блоков: 2 x 0.5 x 2
//  • Нижний блок: центр по y=0.25 (нижняя грань на y=0)
//  • При неточном попадании игра завершается (без текстовых сообщений)

//////////////////////////////////////////////////
// ПАРАМЕТРЫ
//////////////////////////////////////////////////
const BLOCK_WIDTH   = 2;    // Ширина  (X)
const BLOCK_HEIGHT  = 0.5;  // Высота  (Y)
const BLOCK_DEPTH   = 2;    // Глубина (Z)

// Начальные размеры первого (нижнего) блока
// (можно менять, но здесь они совпадают со стандартными)
const INITIAL_BLOCK_SIZE = {
  width:  BLOCK_WIDTH,
  height: BLOCK_HEIGHT,
  depth:  BLOCK_DEPTH
};

// Скорость движения нового блока выбирается случайно в этом диапазоне
const MIN_SPEED = 1.5;
const MAX_SPEED = 3.0;

// Палитра (примерные пастельные оттенки)
const blockColors = [0x25354B, 0x4A728E, 0x6CB6C6, 0x9CDDDD, 0xC2F5F3];

//////////////////////////////////////////////////
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
//////////////////////////////////////////////////
let scene, camera, renderer;
let game2Canvas;          // Canvas-элемент
let animationFrameId;     // ID анимационного кадра
let gameRunning = false;  // Флаг, идёт ли игра

// Список уложенных блоков
// Каждый элемент: { mesh, size: { width, depth }, axis: 'x'|'z' }
let stack = [];

// Текущий движущийся блок
// { mesh, size: { width, depth }, movingAxis, speed, direction }
let currentBlock = null;

// Счётчик для выбора цвета (по модулю массива blockColors)
let blockCount = 0;

//////////////////////////////////////////////////
// ИНИЦИАЛИЗАЦИЯ СЦЕНЫ И КАМЕРЫ
//////////////////////////////////////////////////
function initThree() {
  scene = new THREE.Scene();
  // Можно задать цвет фона, например, светлый:
  // scene.background = new THREE.Color(0xf0f0f0);
  // Или оставить чёрный фон:
  scene.background = new THREE.Color(0x000000);

  // Камера (Perspectivе) с FOV=40°
  camera = new THREE.PerspectiveCamera(
    40,                               // FOV
    game2Canvas.width / game2Canvas.height, // соотношение сторон
    0.1,                              // near
    1000                              // far
  );

  // Позиция (0,10,-10)
  camera.position.set(0, 10, -10);

  // Устанавливаем поворот в градусах: X=35°, Y=45°, Z=0°
  camera.rotation.order = 'XYZ';
  camera.rotation.x = THREE.MathUtils.degToRad(35);
  camera.rotation.y = THREE.MathUtils.degToRad(45);
  camera.rotation.z = 0;

  // Создаём WebGLRenderer
  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Добавляем освещение
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);
}

//////////////////////////////////////////////////
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
//////////////////////////////////////////////////

// Получаем цвет из палитры, циклически
function getBlockColor() {
  const color = blockColors[blockCount % blockColors.length];
  blockCount++;
  return color;
}

// Создаём и добавляем в сцену новый блок (THREE.Mesh) с заданными размерами
function createBlock(width, height, depth, color) {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshPhongMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

//////////////////////////////////////////////////
// МЕХАНИКА ИГРЫ: СОЗДАНИЕ ПЕРВОГО БЛОКА, СПАВН НОВЫХ
//////////////////////////////////////////////////

// Создаём нижний (базовый) блок
function createBaseBlock() {
  const color = getBlockColor();
  const mesh = createBlock(INITIAL_BLOCK_SIZE.width, INITIAL_BLOCK_SIZE.height, INITIAL_BLOCK_SIZE.depth, color);

  // Размещаем так, чтобы нижняя грань лежала на y=0
  // Значит центр блока = height/2 => y=0.25
  mesh.position.set(0, BLOCK_HEIGHT / 2, 0);

  // Сохраняем в stack
  stack.push({
    mesh: mesh,
    size: {
      width:  INITIAL_BLOCK_SIZE.width,
      depth:  INITIAL_BLOCK_SIZE.depth
    },
    axis: 'x' // (можно не использовать для базового)
  });

  scene.add(mesh);
}

// Спавним новый движущийся блок поверх верхнего
function spawnNewBlock() {
  // Верхний блок
  const topBlock = stack[stack.length - 1];

  // Новому блоку передаём текущие размеры
  let newWidth = topBlock.size.width;
  let newDepth = topBlock.size.depth;

  // Чередуем ось движения: если в стеке чётное число блоков — 'x', иначе 'z'
  // (Можно использовать другую логику, на ваше усмотрение)
  const movingAxis = (stack.length % 2 === 0) ? 'x' : 'z';

  // Случайная скорость
  const speed = THREE.MathUtils.randFloat(MIN_SPEED, MAX_SPEED);

  // Блок
  const color = getBlockColor();
  const mesh = createBlock(newWidth, BLOCK_HEIGHT, newDepth, color);

  // Позиция нового блока:
  // По высоте: чуть выше предыдущего (т.е. center.y = topBlockCenterY + 0.5)
  const newY = topBlock.mesh.position.y + BLOCK_HEIGHT;

  // Начальное смещение вдоль оси X или Z
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === 'x') {
    // Слева направо: начнём левее на (newWidth)
    startX -= newWidth;
  } else {
    // Спереди назад: начнём "ближе" на (newDepth)
    startZ -= newDepth;
  }

  mesh.position.set(
    (movingAxis === 'x') ? startX : topBlock.mesh.position.x,
    newY,
    (movingAxis === 'z') ? startZ : topBlock.mesh.position.z
  );

  currentBlock = {
    mesh,
    size: {
      width: newWidth,
      depth: newDepth
    },
    movingAxis,
    speed,
    direction: 1
  };

  scene.add(mesh);
}

//////////////////////////////////////////////////
// УПРАВЛЕНИЕ: ФИКСАЦИЯ БЛОКА (DROP)
//////////////////////////////////////////////////
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;

  const topBlock = stack[stack.length - 1];
  let overlap = 0;

  if (currentBlock.movingAxis === 'x') {
    // Рассчитываем пересечение по X
    const currentLeft  = currentBlock.mesh.position.x - currentBlock.size.width / 2;
    const currentRight = currentBlock.mesh.position.x + currentBlock.size.width / 2;
    const topLeft      = topBlock.mesh.position.x - topBlock.size.width / 2;
    const topRight     = topBlock.mesh.position.x + topBlock.size.width / 2;

    const overlapLeft  = Math.max(currentLeft,  topLeft);
    const overlapRight = Math.min(currentRight, topRight);

    overlap = overlapRight - overlapLeft;
    if (overlap <= 0) {
      gameOver();
      return;
    }
    // Корректируем геометрию
    const newCenterX = (overlapLeft + overlapRight) / 2;
    currentBlock.mesh.position.x = newCenterX;
    // Меняем ширину
    currentBlock.size.width = overlap;

    // Пересоздаём геометрию
    const newGeo = new THREE.BoxGeometry(overlap, BLOCK_HEIGHT, currentBlock.size.depth);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeo;

  } else {
    // Рассчитываем пересечение по Z
    const currentFront = currentBlock.mesh.position.z - currentBlock.size.depth / 2;
    const currentBack  = currentBlock.mesh.position.z + currentBlock.size.depth / 2;
    const topFront     = topBlock.mesh.position.z - topBlock.size.depth / 2;
    const topBack      = topBlock.mesh.position.z + topBlock.size.depth / 2;

    const overlapFront = Math.max(currentFront, topFront);
    const overlapBack  = Math.min(currentBack,  topBack);

    overlap = overlapBack - overlapFront;
    if (overlap <= 0) {
      gameOver();
      return;
    }
    // Корректируем геометрию
    const newCenterZ = (overlapFront + overlapBack) / 2;
    currentBlock.mesh.position.z = newCenterZ;
    // Меняем глубину
    currentBlock.size.depth = overlap;

    const newGeo = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, overlap);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeo;
  }

  // Блок зафиксирован — добавляем в stack
  stack.push(currentBlock);

  // Создаём следующий
  spawnNewBlock();
}

//////////////////////////////////////////////////
// ОБНОВЛЕНИЕ: ДВИЖЕНИЕ ТЕКУЩЕГО БЛОКА
//////////////////////////////////////////////////
function updateGame() {
  if (!currentBlock) return;
  const topBlock = stack[stack.length - 1];

  if (currentBlock.movingAxis === 'x') {
    currentBlock.mesh.position.x += currentBlock.speed * currentBlock.direction;
    // Границы — относительно верхнего блока (допустимый «коридор»)
    const leftBound  = topBlock.mesh.position.x - (topBlock.size.width / 2 + currentBlock.size.width);
    const rightBound = topBlock.mesh.position.x + (topBlock.size.width / 2 + currentBlock.size.width);
    if (currentBlock.mesh.position.x < leftBound) {
      currentBlock.mesh.position.x = leftBound;
      currentBlock.direction = 1;
    } else if (currentBlock.mesh.position.x > rightBound) {
      currentBlock.mesh.position.x = rightBound;
      currentBlock.direction = -1;
    }
  } else {
    currentBlock.mesh.position.z += currentBlock.speed * currentBlock.direction;
    // Границы по Z
    const frontBound = topBlock.mesh.position.z - (topBlock.size.depth / 2 + currentBlock.size.depth);
    const backBound  = topBlock.mesh.position.z + (topBlock.size.depth / 2 + currentBlock.size.depth);
    if (currentBlock.mesh.position.z < frontBound) {
      currentBlock.mesh.position.z = frontBound;
      currentBlock.direction = 1;
    } else if (currentBlock.mesh.position.z > backBound) {
      currentBlock.mesh.position.z = backBound;
      currentBlock.direction = -1;
    }
  }
}

//////////////////////////////////////////////////
// ЗАВЕРШЕНИЕ ИГРЫ
//////////////////////////////////////////////////
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('keydown', onDropBlock);
  game2Canvas.removeEventListener('click', onDropBlock);
  // Нет текстовых сообщений — просто завершаем
}

//////////////////////////////////////////////////
// ГЛАВНЫЙ ЦИКЛ (АНИМАЦИЯ)
//////////////////////////////////////////////////
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(gameLoop);
}

//////////////////////////////////////////////////
// ИНИЦИАЛИЗАЦИЯ И СБРОС
//////////////////////////////////////////////////

// Запуск игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Canvas with id 'match3Canvas' not found.");
    return;
  }

  initThree();
  createBaseBlock();  // нижний блок
  spawnNewBlock();    // первый движущийся

  gameRunning = true;

  // Управление — нажимаем клавишу или кликаем
  window.addEventListener('keydown', onDropBlock);
  game2Canvas.addEventListener('click', onDropBlock);

  gameLoop();
}

// Сброс игры (например, при выходе)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener('keydown', onDropBlock);
  game2Canvas.removeEventListener('click', onDropBlock);

  // Очищаем сцену, если нужно
  if (renderer) {
    renderer.clear();
  }
  scene = null;
  camera = null;
  renderer = null;
  stack = [];
  currentBlock = null;
  blockCount = 0;
  gameRunning = false;
}
