/* game2.js – 3D Игра «Stack» с динамическим обновлением камеры
   Основные механики:
   • Базовый блок создаётся в центре сцены.
   • Каждый новый блок появляется над предыдущим и движется по горизонтали (чередуя оси X и Z).
   • При нажатии клавиши или клике движущийся блок фиксируется – вычисляется пересечение с предыдущим блоком:
       – Если пересечение есть, размер блока уменьшается до области пересечения.
       – Если пересечения нет – игра заканчивается (вызывается модальное окно).
   • Скорость движения нового блока выбирается случайным образом (от 2 до 6), чтобы затруднить авто-клики.
   • Каждый блок получает случайный пастельный цвет из заданной палитры.
   • Сцена имеет чёрный фон.
   • Камера располагается над центром стека, наклонена вниз примерно на 35° и динамически обновляется,
     чтобы вся башня всегда помещалась в кадре.
*/

const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Палитра пастельных цветов (можно заменить на любые приятные для глаз оттенки)
const pastelColors = [0xA8DADC, 0xF4A261, 0x457B9D, 0xE63946, 0xB7E4C7];

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;

// Массив уложенных блоков (каждый: { mesh, size: {width, depth} })
let stack = [];
// Текущий движущийся блок (объект { mesh, size, movingAxis, speed, direction })
let currentBlock = null;

function initThree() {
  scene = new THREE.Scene();
  // Чёрный фон
  scene.background = new THREE.Color(0x000000);

  // Настройка перспективной камеры (FOV 45°, ближняя и дальняя плоскости)
  camera = new THREE.PerspectiveCamera(45, game2Canvas.width / game2Canvas.height, 1, 2000);
  // Изначальная позиция будет пересчитана в updateCamera()
  
  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // AmbientLight для мягкого освещения
  let ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
  // DirectionalLight для создания теней
  let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  directionalLight.shadow.camera.left = -500;
  directionalLight.shadow.camera.right = 500;
  directionalLight.shadow.camera.top = 500;
  directionalLight.shadow.camera.bottom = -500;
  directionalLight.shadow.mapSize.width = 1024;
  directionalLight.shadow.mapSize.height = 1024;
  scene.add(directionalLight);
}

// Функция для выбора случайного цвета из палитры
function getRandomColor() {
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

// Создание базового блока, который служит основой башни
function createBaseBlock() {
  let geometry = new THREE.BoxGeometry(INITIAL_BLOCK_SIZE.width, BLOCK_HEIGHT, INITIAL_BLOCK_SIZE.depth);
  let material = new THREE.MeshPhongMaterial({ color: getRandomColor() });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Размещаем базовый блок по центру: нижняя грань на y = 0
  mesh.position.set(0, BLOCK_HEIGHT / 2, 0);
  let block = {
    mesh: mesh,
    size: { width: INITIAL_BLOCK_SIZE.width, depth: INITIAL_BLOCK_SIZE.depth }
  };
  scene.add(mesh);
  stack.push(block);
}

// Функция создания нового движущегося блока
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  let newSize = { width: topBlock.size.width, depth: topBlock.size.depth };
  // Чередуем ось движения: четное число блоков – движение по оси X, нечетное – по оси Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
  // Случайная скорость от 2 до 6
  let blockSpeed = 2 + Math.random() * 4;
  let direction = 1;
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === "x") {
    // Стартуем с левого края относительно верхнего блока
    startX = topBlock.mesh.position.x - newSize.width;
    direction = 1;
  } else {
    // Стартуем с заднего края относительно верхнего блока
    startZ = topBlock.mesh.position.z - newSize.depth;
    direction = 1;
  }
  let newY = topBlock.mesh.position.y + BLOCK_HEIGHT;
  let geometry = new THREE.BoxGeometry(newSize.width, BLOCK_HEIGHT, newSize.depth);
  let material = new THREE.MeshPhongMaterial({ color: getRandomColor() });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
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
}

// Обновление положения движущегося блока
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

// Функция динамического обновления камеры так, чтобы вся башня была видна
function updateCamera() {
  // Верх башни – верхняя граница последнего блока
  let topBlock = stack[stack.length - 1];
  let towerTop = topBlock.mesh.position.y + BLOCK_HEIGHT / 2;
  let towerHeight = towerTop; // так как базовый блок начинается от y = 0
  let midY = towerHeight / 2;
  // Рассчитываем требуемое расстояние d от центра башни для того, чтобы вместить башню по вертикали
  let halfFOV = THREE.MathUtils.degToRad(45 / 2); // 22.5°
  let d = (towerHeight / 2) / Math.tan(halfFOV) + 50; // добавляем отступ 50
  // Камера располагается с наклоном 35° от вертикали
  let tiltAngle = THREE.MathUtils.degToRad(35);
  let cameraY = midY + d * Math.cos(tiltAngle);
  let cameraZ = d * Math.sin(tiltAngle);
  camera.position.set(0, cameraY, cameraZ);
  camera.lookAt(new THREE.Vector3(0, midY, 0));
}

// Фиксация движущегося блока (вызывается по нажатию клавиши или клику)
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
  // Добавляем успешно зафиксированный блок в башню
  stack.push(currentBlock);
  score++;
  // Обновляем камеру, чтобы вся башня оставалась в кадре
  updateCamera();
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

// Завершение игры: остановка анимации, удаление обработчиков и вызов модального окна
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  // Функция showEndGameModal должна быть реализована в основном скрипте
  showEndGameModal("Game Over", "Score: " + score);
}

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  initThree();
  createBaseBlock();
  spawnNewBlock();
  score = 0;
  gameRunning = true;
  // Первоначальное обновление камеры
  updateCamera();
  window.addEventListener("keydown", onDropBlock);
  game2Canvas.addEventListener("click", onDropBlock);
  gameLoop();
}

// Функция сброса игры (например, при закрытии)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (renderer) {
    renderer.clear();
  }
}
