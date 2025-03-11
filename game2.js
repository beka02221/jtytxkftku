/* game2.js – 3D Игра «Stack» с градиентным фоном, блоками с градиентными материалами и отражениями

Основные механики:
• Базовый блок создаётся в центре сцены.
• Каждый новый блок появляется над предыдущим и движется по горизонтали (чередуя оси X и Z).
• При клике или нажатии движущийся блок фиксируется – вычисляется пересечение с предыдущим блоком:
   – Если пересечение есть, лишнее отсекается, а оставшаяся часть становится базой для следующего блока.
   – Если пересечения нет – игра завершается (вызывается модальное окно).
• Скорость движения нового блока выбирается случайным образом (от 2 до 6) для усложнения авто-кликов.
• Каждый блок создаётся с прозрачностью и с градиентной текстурой, выбранной из одного из четырёх пастельных наборов:
   1. Серо-голубой: #D4E1E9 → #A7BBC7 → #7D8E99
   2. Серо-бежевый: #E4D4C8 → #CBB9A5 → #A89787
   3. Серо-зелёный: #BFD8C1 → #A2B9A7 → #7F9684
   4. Пыльно-фиолетовый: #D2C4E2 → #B19DC3 → #8D789F
• Дополнительно: движущийся блок пульсирует (эмиссия меняется) и иногда слегка «дергается» (эффект цифрового сбоя).
• Для каждого блока создаётся отражение – перевёрнутый дубликат с прозрачностью.
• Фон сцены – градиент, заданный с помощью canvas.
• Камера с FOV = 60° расположена в (400,800,600) и направлена на (0,300,0) (наклон ≈35°).
*/

// Параметры блоков
const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Градиентные наборы для блоков
const gradientSets = [
  ["#D4E1E9", "#A7BBC7", "#7D8E99"],
  ["#E4D4C8", "#CBB9A5", "#A89787"],
  ["#BFD8C1", "#A2B9A7", "#7F9684"],
  ["#D2C4E2", "#B19DC3", "#8D789F"]
];

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;

// Массив уложенных блоков (каждый: { mesh, size: {width, depth} })
let stack = [];
// Текущий движущийся блок (объект { mesh, size, movingAxis, speed, direction })
let currentBlock = null;

let glowLight; // точечный свет для пульсирующего свечения башни
let clock = new THREE.Clock();

// Создание градиентной текстуры для фона
function createBackgroundTexture() {
  let canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 256;
  let ctx = canvas.getContext("2d");

  let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#121212");   // тёмно-серый
  gradient.addColorStop(0.5, "#1E1E2F");   // глубокий серо-синий
  gradient.addColorStop(1, "#2C2C3E");     // угольно-фиолетовый

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return new THREE.CanvasTexture(canvas);
}

// Создание градиентной текстуры для блока на основе выбранного набора цветов
function createBlockTexture(gradientColors) {
  let width = 256, height = 256;
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");

  // Вертикальный градиент
  let grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, gradientColors[0]);
  grad.addColorStop(0.5, gradientColors[1]);
  grad.addColorStop(1, gradientColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Добавляем блик сверху – полупрозрачный белый прямоугольник (10% высоты)
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, 0, width, height * 0.1);

  return new THREE.CanvasTexture(canvas);
}

// Функция создания материала для блока с использованием градиентной текстуры
function getBlockMaterial() {
  // Выбираем случайный градиентный набор
  let colors = gradientSets[Math.floor(Math.random() * gradientSets.length)];
  let texture = createBlockTexture(colors);
  texture.minFilter = THREE.LinearFilter;
  let material = new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    shininess: 100,
    specular: new THREE.Color("#2C2C2C")
  });
  return material;
}

// Создание отражения для данного блока: клон с перевёрнутой осью Y, прозрачностью 0.3
function addReflection(originalMesh) {
  let reflection = originalMesh.clone();
  reflection.material = originalMesh.material.clone();
  reflection.material.opacity = 0.3;
  reflection.material.transparent = true;
  reflection.scale.y = -1; // переворачиваем по Y
  // Смещаем отражение чуть ниже оригинала
  reflection.position.y = originalMesh.position.y - BLOCK_HEIGHT * 1.1;
  scene.add(reflection);
}

// Инициализация Three.js и сцены
function initThree() {
  scene = new THREE.Scene();
  // Фон сцены – градиент, созданный через canvas
  scene.background = createBackgroundTexture();

  camera = new THREE.PerspectiveCamera(60, game2Canvas.width / game2Canvas.height, 1, 2000);
  // Камера установлена в (400,800,600) и направлена на (0,300,0) – наклон ≈35° вниз
  camera.position.set(400, 800, 600);
  camera.lookAt(new THREE.Vector3(0, 300, 0));
  camera.updateProjectionMatrix();

  renderer = new THREE.WebGLRenderer({ canvas: game2Canvas, antialias: true });
  renderer.setSize(game2Canvas.width, game2Canvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);
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

  // Glow-свет для башни
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
  mesh.position.set(0, BLOCK_HEIGHT / 2, 0);
  let block = { mesh: mesh, size: { width: INITIAL_BLOCK_SIZE.width, depth: INITIAL_BLOCK_SIZE.depth } };
  scene.add(mesh);
  addReflection(mesh);
  stack.push(block);
}

// Создание нового движущегося блока
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  let newSize = { width: topBlock.size.width, depth: topBlock.size.depth };
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
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
  currentBlock = { mesh: mesh, size: newSize, movingAxis: movingAxis, speed: blockSpeed, direction: direction };
  scene.add(mesh);
}

// Обновление положения движущегося блока с пульсирующим эффектом и "цифровым сбоем"
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
  
  // Пульсация эмиссии
  let pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 5);
  currentBlock.mesh.material.emissive = new THREE.Color(0x00FF00).multiplyScalar(pulse);
  
  // Эффект цифрового сбоя: случайное небольшое смещение
  if (Math.random() < 0.01) {
    currentBlock.mesh.position.x += (Math.random() - 0.5) * 5;
    currentBlock.mesh.position.z += (Math.random() - 0.5) * 5;
  }
  
  // Обновление позиции glow-света
  if (glowLight) {
    glowLight.position.y = stack[stack.length - 1].mesh.position.y;
    glowLight.intensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
  }
}

// Фиксация блока (вызывается по клику или нажатию клавиши)
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
    if (overlap <= 0) { gameOver(); return; }
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
    if (overlap <= 0) { gameOver(); return; }
    let newCenterZ = (overlapFront + overlapBack) / 2;
    let newGeometry = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, overlap);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeometry;
    currentBlock.mesh.position.z = newCenterZ;
    currentBlock.size.depth = overlap;
  }
  // Добавляем блок в башню и отражение
  stack.push(currentBlock);
  score++;
  addReflection(currentBlock.mesh);
  // Поднимаем камеру, если нужно
  let newY = currentBlock.mesh.position.y;
  if (newY > camera.position.y - 100) {
    camera.position.y = newY + 100;
  }
  spawnNewBlock();
}

// Основной цикл игры: обновление состояния и рендеринг
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

