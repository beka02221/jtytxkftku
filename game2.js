/* game2.js — 3D Игра «Stack» в стиле, похожем на скриншот
   Особенности:
   - Камера с перспективой и углом около 40–45°, расположена «сверху» и смотрит вниз.
   - Мягкий пастельный фон (почти белый).
   - Блоки раскрашиваются из набора приглушённых (пастельных) цветов.
   - Нет никакого текста, счёта и т.п. на экране.
   - При отсутствии пересечения блоков игра завершается (функция gameOver), но сообщение о конце игры не выводится (вы можете добавить своё при необходимости).
*/

//////////////////////////////////////////////////
// ПАРАМЕТРЫ И НАСТРОЙКИ
//////////////////////////////////////////////////
const BLOCK_HEIGHT = 20;             // Толщина каждого блока
const INITIAL_BLOCK_SIZE = {         // Размеры базового блока (ширина и глубина)
  width: 300,
  depth: 300
};

// Набор цветов блоков (снизу вверх – от тёмных к более светлым пастельным тонам)
const blockColors = [
  0x25354B, // тёмно-синий (низ)
  0x4A728E,
  0x6CB6C6,
  0x9CDDDD,
  0xC2F5F3  // самый светлый (верх)
];

// Фон сцены (почти белый, как на скриншоте)
const SCENE_BACKGROUND = 0xFAF9F8;

// Логика выбора цвета для очередного блока
function getBlockColor(index) {
  // Просто берём по модулю длины массива, чтобы цвета шли по кругу
  return blockColors[index % blockColors.length];
}

//////////////////////////////////////////////////
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
//////////////////////////////////////////////////
let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let stack = [];            // Массив уложенных блоков: { mesh, size: { width, depth } }
let currentBlock = null;   // Текущий движущийся блок
let blockCount = 0;        // Сколько блоков уже уложено (используется для выбора цвета)

// Инициализация Three.js: создание сцены, камеры, рендера, освещения
function initThree() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(SCENE_BACKGROUND); // фон – почти белый

  // Камера с умеренным FOV = 45°, чтобы блоки были видны с «изометрическим» наклоном
  camera = new THREE.PerspectiveCamera(
    45,
    game2Canvas.width / game2Canvas.height,
    1,
    2000
  );

  // Позиция камеры: слегка наклон сверху, смотрит вниз на (0, 0, 0)
  // При желании подкорректируйте, чтобы получить угол ~30-45°
  camera.position.set(0, 250, 350);
  camera.lookAt(0, 0, 0);

  // Создаём WebGLRenderer и настраиваем тени
  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Добавляем мягкое окружающее освещение
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  // Добавляем направленный источник света для теней
  let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(200, 400, 200);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -500;
  directionalLight.shadow.camera.right = 500;
  directionalLight.shadow.camera.top = 500;
  directionalLight.shadow.camera.bottom = -500;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
}

// Создание базового (нижнего) блока
function createBaseBlock() {
  let geometry = new THREE.BoxGeometry(
    INITIAL_BLOCK_SIZE.width,
    BLOCK_HEIGHT,
    INITIAL_BLOCK_SIZE.depth
  );
  let material = new THREE.MeshPhongMaterial({ color: getBlockColor(blockCount) });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Размещаем базовый блок так, чтобы его нижняя грань была на y=0
  // => центр блока по высоте на y = BLOCK_HEIGHT/2
  mesh.position.set(0, BLOCK_HEIGHT / 2, 0);

  // Добавляем в массив stack
  stack.push({
    mesh: mesh,
    size: {
      width: INITIAL_BLOCK_SIZE.width,
      depth: INITIAL_BLOCK_SIZE.depth
    }
  });
  scene.add(mesh);

  blockCount++;
}

// Создаём новый движущийся блок над последним уложенным
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  let newSize = {
    width: topBlock.size.width,
    depth: topBlock.size.depth
  };

  // Определяем ось движения: чередуем X и Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";

  // Случайная скорость (2–6) чтобы усложнить автоклик
  let blockSpeed = 2 + Math.random() * 4;
  let direction = 1;

  // Начальное положение по X/Z относительно предыдущего блока
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === "x") {
    // Двигаем по оси X: старт с левого края
    startX -= newSize.width;
  } else {
    // Двигаем по оси Z: старт с «заднего» края
    startZ -= newSize.depth;
  }

  let newY = topBlock.mesh.position.y + BLOCK_HEIGHT;

  // Создаём сам блок (геометрию и материал)
  let geometry = new THREE.BoxGeometry(newSize.width, BLOCK_HEIGHT, newSize.depth);
  let material = new THREE.MeshPhongMaterial({ color: getBlockColor(blockCount) });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Устанавливаем позицию блока
  mesh.position.set(
    (movingAxis === "x") ? startX : topBlock.mesh.position.x,
    newY,
    (movingAxis === "z") ? startZ : topBlock.mesh.position.z
  );

  currentBlock = {
    mesh: mesh,
    size: newSize,
    movingAxis: movingAxis,
    speed: blockSpeed,
    direction: direction
  };
  scene.add(mesh);

  blockCount++;
}

// Двигаем текущий блок в игровом цикле
function updateGame() {
  if (!currentBlock) return;

  let topBlock = stack[stack.length - 1];
  if (currentBlock.movingAxis === "x") {
    currentBlock.mesh.position.x += currentBlock.speed * currentBlock.direction;

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

// При клике или нажатии клавиши «фиксируем» блок
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;

  let topBlock = stack[stack.length - 1];
  let overlap = 0;

  if (currentBlock.movingAxis === "x") {
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
    // Центрируем блок по вычисленному пересечению
    let newCenterX = (overlapLeft + overlapRight) / 2;

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

  // Успешно уложили блок — добавляем в стек
  stack.push(currentBlock);

  // Создаём следующий движущийся блок
  spawnNewBlock();
}

// Игровой цикл: обновляем сцену и рендерим
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Завершение игры: останавливаем анимацию и удаляем обработчики
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);

  // Здесь нет никакого текста/сообщений — при желании вызовите свою функцию
  // showEndGameModal("Game Over", "Score: ...") или что-то ещё.
  // В данном примере — просто тихое завершение.
}

// Инициализация игры (вызывается при старте)
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Canvas with id 'match3Canvas' not found.");
    return;
  }
  initThree();
  createBaseBlock();
  spawnNewBlock();

  gameRunning = true;

  // Управление: нажатие клавиш / клик
  // Можно заменить "keydown" на проверку, например, e.key === ' ' для пробела и т.п.
  window.addEventListener("keydown", onDropBlock);
  game2Canvas.addEventListener("click", onDropBlock);

  gameLoop();
}

// Сброс игры (вызывается при выходе из игры или перезапуске)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (renderer) {
    renderer.clear();
  }
  scene = null;
  camera = null;
  renderer = null;
  stack = [];
  currentBlock = null;
  gameRunning = false;
  blockCount = 0;
}

