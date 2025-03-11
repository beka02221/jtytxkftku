/* game2.js – 3D Игра «Stack» с новой цветовой палитрой, цифровыми эффектами и оптимальной камерой

   Основные механики:
   • Базовый блок создаётся в центре сцены.
   • Каждый новый блок появляется над предыдущим и движется по горизонтали (чередуя оси X и Z).
   • При нажатии клавиши или клике движущийся блок фиксируется – вычисляется пересечение с предыдущим блоком:
       – Если пересечение есть, размер блока уменьшается до области пересечения.
       – Если пересечения нет – игра заканчивается (вызывается модальное окно).
   • Скорость движения нового блока выбирается случайным образом (от 2 до 6) для усложнения авто-кликов.
   • Каждый блок создаётся с прозрачностью и цифровыми зелёными оттенками с лёгким свечением.
   • Дополнительно: движущийся блок получает пульсирующий эффект и иногда "дергается" (цифровой сбой).
   • Камера с FOV 60°, расположенная в (400,800,600) и направленная на (0,300,0), обеспечивает вид с наклоном около 35°.
   • Фон сцены – чёрный, а вокруг башни пульсирует точечный свет, усиливая атмосферу.
*/

// Параметры блоков
const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Новая палитра зелёных оттенков
function getRandomBlockColor() {
  const colors = [0x00FF00, 0x008000, 0x00C2A0, 0x39FF14];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Функция создания материала для блока с прозрачностью, свечением и текстурой (здесь можно добавить цифровые символы)
function getBlockMaterial() {
  let color = getRandomBlockColor();
  let material = new THREE.MeshPhongMaterial({
    color: color,
    emissive: new THREE.Color(color),
    transparent: true,
    opacity: 0.8,
    shininess: 100
  });
  return material;
}

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;

// Массив уложенных блоков (каждый: { mesh, size: {width, depth} })
let stack = [];
// Текущий движущийся блок (объект { mesh, size, movingAxis, speed, direction })
let currentBlock = null;

let glowLight; // точечный свет для эффекта свечения вокруг башни
let clock = new THREE.Clock();

// Инициализация Three.js и сцены
function initThree() {
  scene = new THREE.Scene();
  // Фон сцены – чёрный
  scene.background = new THREE.Color(0x000000);

  // Настройка перспективной камеры с FOV = 60° и соотношением сторон canvas
  camera = new THREE.PerspectiveCamera(60, game2Canvas.width / game2Canvas.height, 1, 2000);
  // Камера установлена в (400,800,600) и направлена на (0,300,0) – наклон ~35° вниз
  camera.position.set(400, 800, 600);
  camera.lookAt(new THREE.Vector3(0, 300, 0));
  camera.updateProjectionMatrix();

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

  // Точечный свет для пульсирующего свечения башни
  glowLight = new THREE.PointLight(0x00FF00, 1, 500);
  glowLight.position.set(0, stack.length > 0 ? stack[stack.length-1].mesh.position.y : 0, 0);
  scene.add(glowLight);
}

// Создание базового (нижнего) блока
function createBaseBlock() {
  let geometry = new THREE.BoxGeometry(INITIAL_BLOCK_SIZE.width, BLOCK_HEIGHT, INITIAL_BLOCK_SIZE.depth);
  let material = getBlockMaterial();
  let mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  // Размещаем базовый блок в центре; нижняя грань на y = 0
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
  // Чередуем ось движения: четное число блоков – по оси X, нечетное – по оси Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
  // Случайная скорость движения от 2 до 6
  let blockSpeed = 2 + Math.random() * 4;
  let direction = 1;
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (movingAxis === "x") {
    startX = topBlock.mesh.position.x - newSize.width;
    direction = 1;
  } else {
    startZ = topBlock.mesh.position.z - newSize.depth;
    direction = 1;
  }
  let newY = topBlock.mesh.position.y + BLOCK_HEIGHT;
  let geometry = new THREE.BoxGeometry(newSize.width, BLOCK_HEIGHT, newSize.depth);
  let material = getBlockMaterial();
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

// Обновление положения движущегося блока с пульсацией и эффектом "цифрового сбоя"
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
  
  // Пульсирующий неоновый эффект для движущегося блока
  let pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 5);
  currentBlock.mesh.material.emissive = new THREE.Color(0x00FF00).multiplyScalar(pulse);
  
  // Анимированный эффект "цифрового сбоя": случайное небольшое смещение
  if (Math.random() < 0.01) {
    currentBlock.mesh.position.x += (Math.random() - 0.5) * 5;
    currentBlock.mesh.position.z += (Math.random() - 0.5) * 5;
  }
  
  // Обновление пульсирующего glow-света вокруг башни
  if (glowLight) {
    glowLight.position.y = stack[stack.length - 1].mesh.position.y;
    glowLight.intensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
  }
}

// Фиксация блока (вызывается по нажатию клавиши или клике)
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
  score++;
  // Поднимаем камеру, чтобы новый блок оставался в кадре
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
