/* game2.js – 3D Игра «Stack» с динамичной камерой и начислением 10 points за блок
   Основные механики:
   • Базовый блок создаётся в центре сцены.
   • Каждый новый блок появляется над предыдущим и движется по горизонтали (чередуя оси X и Z).
   • При нажатии клавиши или клике движущийся блок фиксируется – вычисляется пересечение с предыдущим блоком.
       – Если пересечение есть, размер блока уменьшается до области пересечения.
       – Если пересечения нет – игра заканчивается (вызывается модальное окно).
   • Скорость движения нового блока выбирается случайным образом.
   • Каждый блок получает случайный пастельный цвет из заданной палитры.
   • В сцене включены тени.
   • Фон сцены – чёрный.
   • Камера расположена позади башенки, отодвинута и наклонена вперёд с динамичным (lerp) слежением за ростом башни.
   • За каждый успешно уложенный блок начисляется 10 points, которые записываются на пользователя.
*/

const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Палитра пастельных цветов (мягкие оттенки)
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

// Функция линейной интерполяции
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Инициализация Three.js и базовых параметров сцены
function initThree() {
  scene = new THREE.Scene();
  // Фон сцены – чёрный
  scene.background = new THREE.Color(0x000000);

  camera = new THREE.PerspectiveCamera(45, game2Canvas.width / game2Canvas.height, 1, 1000);
  /*  
     Стартовая позиция камеры: расположена позади башенки, немного выше исходного уровня.
     При этом камера наклонена вперёд (смотрит на точку, находящуюся ниже её положения),
     чтобы игрок видел падающие блоки и перспективу строительства.
  */
  camera.position.set(0, 400, 1000);
  camera.lookAt(new THREE.Vector3(0, 200, 0));

  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Освещение: AmbientLight для общего мягкого света
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

// Выбираем случайный цвет из палитры
function getRandomColor() {
  return pastelColors[Math.floor(Math.random() * pastelColors.length)];
}

// Создание базового (нижнего) блока
function createBaseBlock() {
  let geometry = new THREE.BoxGeometry(INITIAL_BLOCK_SIZE.width, BLOCK_HEIGHT, INITIAL_BLOCK_SIZE.depth);
  let material = new THREE.MeshPhongMaterial({ color: getRandomColor() });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Размещаем базовый блок в центре, нижняя грань на y = 0
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
  let newSize = { width: topBlock.size.width, depth: topBlock.size.depth };
  // Чередуем ось движения: четное число блоков – движение по оси X, нечетное – по оси Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
  // Случайная скорость от 2 до 6 (затрудняет авто-клик)
  let blockSpeed = 2 + Math.random() * 4;
  let direction = 1;
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === "x") {
    // Двигаем по оси X: старт с левого края относительно верхнего блока
    startX = topBlock.mesh.position.x - newSize.width;
    direction = 1;
  } else {
    // Двигаем по оси Z: старт с заднего края
    startZ = topBlock.mesh.position.z - newSize.depth;
    direction = 1;
  }
  let newY = topBlock.mesh.position.y + BLOCK_HEIGHT;
  // Создаём геометрию нового блока
  let geometry = new THREE.BoxGeometry(newSize.width, BLOCK_HEIGHT, newSize.depth);
  let material = new THREE.MeshPhongMaterial({ color: getRandomColor() });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Устанавливаем позицию: если движение по X – z совпадает с верхним блоком, иначе x совпадает
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

// Обновление положения движущегося блока и динамичное слежение камеры
function updateGame() {
  if (!currentBlock) return;
  let topBlock = stack[stack.length - 1];
  // Обновление движения текущего блока
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
  
  // Динамическое слежение камеры (плавное поднятие)
  // Цель: камера сохраняет фиксированный угол, но её Y-позиция плавно поднимается, чтобы башня целиком была видна.
  let targetY = topBlock.mesh.position.y + 200; // смещение над верхним блоком
  camera.position.y = lerp(camera.position.y, targetY, 0.1);
  // Фиксированный угол обзора: камера всегда смотрит на точку чуть выше верхнего блока
  let lookAtTarget = new THREE.Vector3(0, topBlock.mesh.position.y + 50, 0);
  camera.lookAt(lookAtTarget);
}

// Фиксация блока (вызывается по нажатию клавиши или клику)
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
  // Успешно зафиксированный блок добавляем в башню
  stack.push(currentBlock);
  // Начисляем 10 points за каждый успешно уложенный блок
  score += 10;
  // Если доступны данные пользователя, обновляем их (например, через userRef и localUserData)
  if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
    localUserData.points += 10;
    userRef.update({ points: localUserData.points });
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

// Завершение игры: отключение анимации, удаление обработчиков и вызов модального окна
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  // Вызываем функцию показа модального окна (реализуйте showEndGameModal в основном скрипте)
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
