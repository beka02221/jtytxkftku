/* game2.js – 3D Игра «Stack» 
   Современный, минималистичный стиль с динамичным градиентным фоном и яркими градиентными блоками.
   
   Основные особенности:
   1. Фон – динамический градиент, который плавно меняется (от чёрного к серому, синему и фиолетовому).
   2. Блоки – объёмные, с мягкими тенями, отражениями, бликами и градиентными текстурами. Классические яркие цвета, хорошо видимые на тёмном фоне.
   3. При несовпадении блоков лишняя часть отсекается и анимированно падает вниз.
   4. Минималистичный интерфейс – очки (5 points за успешно уложенный блок) выводятся в верхней части экрана.
   5. Камера с FOV = 60° расположена в точке (400,800,600) и направлена на (0,300,0) – наклон примерно 35° для полного обзора конструкции.
*/

const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Градиентные наборы для блоков – яркие классические цвета
const gradientSets = [
  ["#00FF00", "#00CC00", "#009900"],       // Неоново-зелёный
  ["#0077FF", "#0055CC", "#003399"],       // Яркий синий
  ["#FF0033", "#CC0029", "#990020"],       // Насыщенный красный
  ["#AA00FF", "#8800CC", "#660099"]        // Электрический фиолетовый
];

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;  // количество блоков
// Для отображения очков (5 points за блок)
function updateScoreDisplay() {
  const el = document.getElementById("scoreDisplay");
  if (el) {
    el.innerText = "Score: " + (score * 5);
  }
}

// Массив уложенных блоков (каждый: { mesh, size: {width, depth} })
let stack = [];
// Текущий движущийся блок (объект { mesh, size, movingAxis, speed, direction })
let currentBlock = null;
// Массив отсекаемых частей, которые падают вниз
let fallingPieces = [];

// Фон: создаём динамический градиентный texture через canvas
let bgCanvas, bgContext, bgTexture;
function createBackgroundTexture() {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = 16;
  bgCanvas.height = 256;
  bgContext = bgCanvas.getContext("2d");
  bgTexture = new THREE.CanvasTexture(bgCanvas);
  return bgTexture;
}
// Обновление фона – плавное изменение градиента на основе времени
function updateBackground() {
  let t = clock.getElapsedTime();
  // Используем синусоиду для плавного смещения градиентных стопов
  // Например, добавим небольшой сдвиг к каждой остановке
  let offset = (Math.sin(t / 10) + 1) / 2; // от 0 до 1
  // Определённые базовые цвета
  // Верхняя: темно-серый, затем глубокий серо-синий, затем угольно-фиолетовый
  let color1 = "#000000"; // верх
  let color2 = "#121212";
  let color3 = "#1E1E2F";
  let color4 = "#2C2C3E";
  // Можем немного менять прозрачность или позицию стопов
  let grad = bgContext.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, color1);
  grad.addColorStop(0.4 + 0.1 * offset, color2);
  grad.addColorStop(0.7 + 0.1 * offset, color3);
  grad.addColorStop(1, color4);
  bgContext.fillStyle = grad;
  bgContext.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgTexture.needsUpdate = true;
}

// Функция для создания градиентной текстуры для блока на основе выбранного набора цветов
function createBlockTexture(gradientColors) {
  let width = 256, height = 256;
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");

  let grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, gradientColors[0]);
  grad.addColorStop(0.5, gradientColors[1]);
  grad.addColorStop(1, gradientColors[2]);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Добавляем блик сверху – белый прямоугольник с 10% прозрачностью
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, 0, width, height * 0.1);

  return new THREE.CanvasTexture(canvas);
}

// Функция создания материала для блока с использованием градиентной текстуры
function getBlockMaterial() {
  let colors = gradientSets[Math.floor(Math.random() * gradientSets.length)];
  let texture = createBlockTexture(colors);
  texture.minFilter = THREE.LinearFilter;
  let material = new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
    opacity: 0.95,
    shininess: 100,
    specular: new THREE.Color("#2C2C2C")
  });
  return material;
}

// Создание отражения для блока: клон, перевёрнутый по оси Y с прозрачностью 0.3
function addReflection(originalMesh) {
  let reflection = originalMesh.clone();
  reflection.material = originalMesh.material.clone();
  reflection.material.opacity = 0.3;
  reflection.material.transparent = true;
  reflection.scale.y = -1;
  reflection.position.y = originalMesh.position.y - BLOCK_HEIGHT * 1.1;
  scene.add(reflection);
}

// Инициализация Three.js и сцены
let clock = new THREE.Clock();
function initThree() {
  scene = new THREE.Scene();
  // Фон – динамический градиентный texture
  scene.background = createBackgroundTexture();

  camera = new THREE.PerspectiveCamera(60, game2Canvas.width / game2Canvas.height, 1, 2000);
  // Камера установлена в (400,800,600) и направлена на (0,300,0) – наклон ~35° вниз
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
  glowLight.position.set(0, stack.length > 0 ? stack[stack.length - 1].mesh.position.y : 0, 0);
  scene.add(glowLight);
}

// Создание базового блока (нижний)
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
  // Чередуем ось движения: четное число блоков – по оси X, нечетное – по оси Z
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

// Обновление движущегося блока и анимация падающих отрезков
function updateGame() {
  // Обновление динамичного фона
  updateBackground();

  if (currentBlock) {
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
    // Пульсирующий эффект эмиссии для движущегося блока
    let pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 5);
    currentBlock.mesh.material.emissive = new THREE.Color(0x00FF00).multiplyScalar(pulse);
    // Эффект цифрового сбоя: случайное небольшое смещение
    if (Math.random() < 0.01) {
      currentBlock.mesh.position.x += (Math.random() - 0.5) * 5;
      currentBlock.mesh.position.z += (Math.random() - 0.5) * 5;
    }
  }
  
  // Обновление glow-света вокруг башни
  if (glowLight) {
    glowLight.position.y = stack[stack.length - 1].mesh.position.y;
    glowLight.intensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
  }
  
  // Обновляем падающие отрезки (эффект отсекаемой части)
  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    let piece = fallingPieces[i];
    piece.velocityY -= 0.5;  // имитация гравитации
    piece.mesh.position.y += piece.velocityY;
    // Удаляем, если ушли ниже сцены
    if (piece.mesh.position.y < -200) {
      scene.remove(piece.mesh);
      fallingPieces.splice(i, 1);
    }
  }
}

// Фиксация блока – вычисление пересечения, отсекаем лишнее и создаём анимацию падающей части
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;
  let topBlock = stack[stack.length - 1];
  let movingAxis = currentBlock.movingAxis;
  let overlap = 0;
  // Сохраним исходные размеры перед изменениями
  let originalSize = { ...currentBlock.size };
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
    // Если не идеальное совпадение – создаём отсекаемую часть
    if (overlap < originalSize.width) {
      let extraWidth = originalSize.width - overlap;
      let extraGeometry = new THREE.BoxGeometry(extraWidth, BLOCK_HEIGHT, currentBlock.size.depth);
      let extraMaterial = getBlockMaterial();
      let extraMesh = new THREE.Mesh(extraGeometry, extraMaterial);
      extraMesh.castShadow = true;
      extraMesh.receiveShadow = true;
      // Определяем, с какой стороны отсекаем – в зависимости от смещения
      if (currentBlock.mesh.position.x > topBlock.mesh.position.x) {
        extraMesh.position.x = currentBlock.mesh.position.x + overlap / 2 + extraWidth / 2;
      } else {
        extraMesh.position.x = currentBlock.mesh.position.x - overlap / 2 - extraWidth / 2;
      }
      extraMesh.position.y = currentBlock.mesh.position.y;
      extraMesh.position.z = currentBlock.mesh.position.z;
      scene.add(extraMesh);
      fallingPieces.push({ mesh: extraMesh, velocityY: 0 });
    }
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
    if (overlap < originalSize.depth) {
      let extraDepth = originalSize.depth - overlap;
      let extraGeometry = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, extraDepth);
      let extraMaterial = getBlockMaterial();
      let extraMesh = new THREE.Mesh(extraGeometry, extraMaterial);
      extraMesh.castShadow = true;
      extraMesh.receiveShadow = true;
      if (currentBlock.mesh.position.z > topBlock.mesh.position.z) {
        extraMesh.position.z = currentBlock.mesh.position.z + overlap / 2 + extraDepth / 2;
      } else {
        extraMesh.position.z = currentBlock.mesh.position.z - overlap / 2 - extraDepth / 2;
      }
      extraMesh.position.y = currentBlock.mesh.position.y;
      extraMesh.position.x = currentBlock.mesh.position.x;
      scene.add(extraMesh);
      fallingPieces.push({ mesh: extraMesh, velocityY: 0 });
    }
  }
  // Успешно зафиксированный блок добавляем в башню и отражение
  stack.push(currentBlock);
  score++;
  updateScoreDisplay();
  addReflection(currentBlock.mesh);
  // Поднимаем камеру, если нужно
  let newY = currentBlock.mesh.position.y;
  if (newY > camera.position.y - 100) {
    camera.position.y = newY + 100;
  }
  spawnNewBlock();
}

// Основной цикл игры: обновление состояния, рендеринг и динамичный фон
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
  showEndGameModal("Game Over", "Score: " + (score * 5));
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
  updateScoreDisplay();
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
