/* game2.js – 3D Stack с «топ-даун с перспективой» камерой
   Особенности:
   - Блоки 2×2×0.5, укладываются по оси Y.
   - Камера:
       • position = (0, 15, -15)
       • rotationX = 35°, rotationY = 45°, rotationZ = 0°
       • FOV ~ 35°
   - Нет вывода текста: при "gameOver" игра тихо останавливается (добавьте свой UI по необходимости).
*/

//////////////////////////////////////////////////
// ПАРАМЕТРЫ БЛОКОВ И КАМЕРЫ
//////////////////////////////////////////////////
const BLOCK_WIDTH  = 2;
const BLOCK_DEPTH  = 2;
const BLOCK_HEIGHT = 0.5;

const CAMERA_FOV   = 35;
const CAMERA_NEAR  = 0.1;
const CAMERA_FAR   = 1000;

// Начальная позиция камеры
const CAMERA_POS = { x: 0, y: 15, z: -15 };
// Углы поворота камеры (в градусах)
const CAMERA_ROT = { xDeg: 35, yDeg: 45, zDeg: 0 };

//////////////////////////////////////////////////
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
//////////////////////////////////////////////////
let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;

let stack = [];          // Массив уложенных блоков: { mesh, size: { w, d } }
let currentBlock = null; // Текущий движущийся блок
let blockCount = 0;      // Счётчик уложенных блоков (если нужен для цвета или логики)

// Инициализация Three.js и базовых параметров сцены
function initThree() {
  scene = new THREE.Scene();
  // Нейтральный светлый фон (можно заменить на любой)
  scene.background = new THREE.Color(0xF0F0F0);

  // Камера с небольшим FOV для «топ-даун» перспективы
  camera = new THREE.PerspectiveCamera(
    CAMERA_FOV,
    game2Canvas.width / game2Canvas.height,
    CAMERA_NEAR,
    CAMERA_FAR
  );

  // Устанавливаем позицию камеры
  camera.position.set(CAMERA_POS.x, CAMERA_POS.y, CAMERA_POS.z);

  // Переводим градусы в радианы и задаём поворот камеры
  // Порядок вращения делаем "YXZ", чтобы повороты X применялись после Y
  camera.rotation.order = "YXZ";
  camera.rotation.y = THREE.MathUtils.degToRad(CAMERA_ROT.yDeg);
  camera.rotation.x = THREE.MathUtils.degToRad(CAMERA_ROT.xDeg);
  // (при необходимости можно добавить поворот z)

  // Создаём рендерер
  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Освещение: мягкий рассеянный + направленный
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(1024, 1024);
  scene.add(dirLight);
}

// Создание базового (нижнего) блока
function createBaseBlock() {
  const geometry = new THREE.BoxGeometry(BLOCK_WIDTH, BLOCK_HEIGHT, BLOCK_DEPTH);
  const material = new THREE.MeshPhongMaterial({ color: 0x5B9EA5 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  // Блок располагаем так, чтобы нижняя грань была на Y=0
  // => центр блока по высоте на Y = BLOCK_HEIGHT/2
  mesh.position.set(0, BLOCK_HEIGHT / 2, 0);

  scene.add(mesh);
  stack.push({
    mesh: mesh,
    size: { w: BLOCK_WIDTH, d: BLOCK_DEPTH }
  });

  blockCount++;
}

// Создание нового движущегося блока
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  let newW = topBlock.size.w;
  let newD = topBlock.size.d;

  // Определяем ось движения: чередуем X / Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
  let speed = 1.5 + Math.random() * 2; // случайная скорость
  let direction = 1;

  // Начальные координаты
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === "x") {
    startX -= newW; // блок «едет» слева направо
  } else {
    startZ -= newD; // блок «едет» «спереди» назад
  }

  // Новый блок располагается поверх предыдущего
  let newY = topBlock.mesh.position.y + BLOCK_HEIGHT;

  // Создаём меш
  const geometry = new THREE.BoxGeometry(newW, BLOCK_HEIGHT, newD);
  const material = new THREE.MeshPhongMaterial({ color: 0x9BD3D8 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  mesh.position.set(
    (movingAxis === "x") ? startX : topBlock.mesh.position.x,
    newY,
    (movingAxis === "z") ? startZ : topBlock.mesh.position.z
  );

  currentBlock = {
    mesh: mesh,
    size: { w: newW, d: newD },
    movingAxis: movingAxis,
    speed: speed,
    direction: direction
  };
  scene.add(mesh);

  blockCount++;
}

// Обновление положения движущегося блока
function updateGame() {
  if (!currentBlock) return;
  let topBlock = stack[stack.length - 1];

  if (currentBlock.movingAxis === "x") {
    currentBlock.mesh.position.x += currentBlock.speed * currentBlock.direction;

    let leftBound = topBlock.mesh.position.x - (topBlock.size.w + currentBlock.size.w);
    let rightBound = topBlock.mesh.position.x + (topBlock.size.w + currentBlock.size.w);
    if (currentBlock.mesh.position.x < leftBound) {
      currentBlock.mesh.position.x = leftBound;
      currentBlock.direction = 1;
    } else if (currentBlock.mesh.position.x > rightBound) {
      currentBlock.mesh.position.x = rightBound;
      currentBlock.direction = -1;
    }
  } else {
    currentBlock.mesh.position.z += currentBlock.speed * currentBlock.direction;

    let frontBound = topBlock.mesh.position.z - (topBlock.size.d + currentBlock.size.d);
    let backBound = topBlock.mesh.position.z + (topBlock.size.d + currentBlock.size.d);
    if (currentBlock.mesh.position.z < frontBound) {
      currentBlock.mesh.position.z = frontBound;
      currentBlock.direction = 1;
    } else if (currentBlock.mesh.position.z > backBound) {
      currentBlock.mesh.position.z = backBound;
      currentBlock.direction = -1;
    }
  }
}

// Функция фиксации блока
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;

  let topBlock = stack[stack.length - 1];
  let overlap = 0;

  if (currentBlock.movingAxis === "x") {
    let cLeft  = currentBlock.mesh.position.x - currentBlock.size.w / 2;
    let cRight = currentBlock.mesh.position.x + currentBlock.size.w / 2;
    let tLeft  = topBlock.mesh.position.x - topBlock.size.w / 2;
    let tRight = topBlock.mesh.position.x + topBlock.size.w / 2;

    overlap = Math.min(cRight, tRight) - Math.max(cLeft, tLeft);
    if (overlap <= 0) {
      gameOver();
      return;
    }
    // Новая ширина
    let newCenterX = (Math.min(cRight, tRight) + Math.max(cLeft, tLeft)) / 2;
    currentBlock.size.w = overlap;

    const newGeom = new THREE.BoxGeometry(overlap, BLOCK_HEIGHT, currentBlock.size.d);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeom;
    currentBlock.mesh.position.x = newCenterX;

  } else {
    let cFront = currentBlock.mesh.position.z - currentBlock.size.d / 2;
    let cBack  = currentBlock.mesh.position.z + currentBlock.size.d / 2;
    let tFront = topBlock.mesh.position.z - topBlock.size.d / 2;
    let tBack  = topBlock.mesh.position.z + topBlock.size.d / 2;

    overlap = Math.min(cBack, tBack) - Math.max(cFront, tFront);
    if (overlap <= 0) {
      gameOver();
      return;
    }
    // Новая глубина
    let newCenterZ = (Math.min(cBack, tBack) + Math.max(cFront, tFront)) / 2;
    currentBlock.size.d = overlap;

    const newGeom = new THREE.BoxGeometry(currentBlock.size.w, BLOCK_HEIGHT, overlap);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeom;
    currentBlock.mesh.position.z = newCenterZ;
  }

  // Успешно уложенный блок добавляем в стек
  stack.push(currentBlock);
  // Создаём следующий
  spawnNewBlock();
}

// Основной цикл рендеринга
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(gameLoop);
}

// Завершение игры
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  // Здесь не выводим текст — при желании добавьте свою логику
}

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById("match3Canvas");
  if (!game2Canvas) {
    console.error("Canvas 'match3Canvas' not found!");
    return;
  }

  initThree();
  createBaseBlock();
  spawnNewBlock();
  gameRunning = true;

  // Управление: по нажатию любой клавиши или клику
  window.addEventListener("keydown", onDropBlock);
  game2Canvas.addEventListener("click", onDropBlock);

  gameLoop();
}

// Сброс игры (если понадобится)
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
  blockCount = 0;
  gameRunning = false;
}
