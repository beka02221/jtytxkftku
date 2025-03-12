/* game2.js – 3D Игра «Stack»
   Современный минималистичный стиль с динамичным градиентным фоном и плоскими, матовыми цветами блоков.

   Основные особенности:
   1. Фон – динамичный градиент, плавно меняющийся от чёрного к темно-серому, синему и фиолетовому.
   2. Блоки – объёмные, с мягкими тенями, отражениями (отражение создаётся как перевёрнутый дубликат)
      и простыми, плоскими (матовыми) цветами без бликов.
      Цвета выбираются случайно из нового набора темных, не отражающих оттенков:
         • Темно-синий (0x003366)
         • Тёмно-оранжевый (0xCC5500)
         • Тёмно-серый (0x444444)
         • Темно-фиолетовый (0x330033)
         • Тёмно-бирюзовый (0x004D4D)
   3. При несовпадении блоков лишняя часть отсекается и падает вниз с эффектом гравитации.
   4. Минималистичный интерфейс – очки (5 points за блок) отображаются в верхней части экрана.
   5. Камера с FOV = 60° изначально расположена в точке (400,800,600) и направлена на башню.
      При накоплении, камера плавно поднимается.
*/

// Определяем размеры базового блока
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };
// Изменено: теперь высота равна ширине, что делает блоки кубами
const BLOCK_HEIGHT = INITIAL_BLOCK_SIZE.width;

// Новый набор плоских цветов для блоков – темные, не отражающие оттенки
const flatColors = [0x003366, 0xCC5500, 0x444444, 0x330033, 0x004D4D];

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;
let glowLight;  // Для glow-света
// Переменная для плавного перемещения камеры по оси Y
let cameraTargetY = 800;

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
// Массив падающих отсекаемых частей
let fallingPieces = [];

// Создание динамичного градиентного фона (черный → темно-серый → глубокий синий → угольно-фиолетовый)
let bgCanvas, bgContext, bgTexture;
function createBackgroundTexture() {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = 16;
  bgCanvas.height = 256;
  bgContext = bgCanvas.getContext("2d");
  bgTexture = new THREE.CanvasTexture(bgCanvas);
  return bgTexture;
}
function updateBackground() {
  let t = clock.getElapsedTime();
  let offset = (Math.sin(t / 10) + 1) / 2; // от 0 до 1
  let color1 = "#000000";
  let color2 = "#121212";
  let color3 = "#1E1E2F";
  let color4 = "#2C2C3E";
  let grad = bgContext.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, color1);
  grad.addColorStop(0.4 + 0.1 * offset, color2);
  grad.addColorStop(0.7 + 0.1 * offset, color3);
  grad.addColorStop(1, color4);
  bgContext.fillStyle = grad;
  bgContext.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgTexture.needsUpdate = true;
}

// Функция создания материала для блока с плоским матовым цветом
function getBlockMaterial() {
  let color = flatColors[Math.floor(Math.random() * flatColors.length)];
  let material = new THREE.MeshLambertMaterial({
    color: color,
    flatShading: true,
    emissive: 0x000000
  });
  return material;
}

// Создание отражения для блока: клон с переворотом по оси Y, прозрачностью 0.3
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
  // Устанавливаем фон – динамичный градиент
  scene.background = createBackgroundTexture();

  camera = new THREE.PerspectiveCamera(60, game2Canvas.width / game2Canvas.height, 1, 2000);
  // Изначально камера установлена в (400,800,600)
  camera.position.set(400, cameraTargetY, 600);
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
  // Улучшаем тени: увеличиваем разрешение и настраиваем смещение
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  directionalLight.shadow.bias = -0.001;
  directionalLight.shadow.camera.left = -500;
  directionalLight.shadow.camera.right = 500;
  directionalLight.shadow.camera.top = 500;
  directionalLight.shadow.camera.bottom = -500;
  scene.add(directionalLight);
  
  // Дополнительный glow-свет для башни
  glowLight = new THREE.PointLight(0x00FF00, 1, 500);
  glowLight.position.set(0, stack.length > 0 ? stack[stack.length - 1].mesh.position.y : 0, 0);
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

// Обновление положения движущегося блока, падающих отсекаемых частей и плавное перемещение камеры
function updateGame() {
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
    // Эффект цифрового сбоя: случайное небольшое смещение
    if (Math.random() < 0.01) {
      currentBlock.mesh.position.x += (Math.random() - 0.5) * 5;
      currentBlock.mesh.position.z += (Math.random() - 0.5) * 5;
    }
  }
  
  // Плавное перемещение камеры вверх, если башня растёт
  let targetY = stack[stack.length - 1].mesh.position.y + 100;
  camera.position.y += (targetY - camera.position.y) * 0.05;
  // Обновляем направление взгляда камеры так, чтобы она всегда смотрела на верх башни
  camera.lookAt(new THREE.Vector3(0, stack[stack.length - 1].mesh.position.y, 0));
  
  // Обновление glow-света
  if (glowLight) {
    glowLight.position.y = stack[stack.length - 1].mesh.position.y;
    glowLight.intensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
  }
  
  // Обновление падающих отсекаемых частей
  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    let piece = fallingPieces[i];
    piece.velocityY -= 0.5;
    piece.mesh.position.y += piece.velocityY;
    if (piece.mesh.position.y < -200) {
      scene.remove(piece.mesh);
      fallingPieces.splice(i, 1);
    }
  }
}

// Фиксация блока – вычисление пересечения, создание падающей части при несовпадении
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;
  let topBlock = stack[stack.length - 1];
  let movingAxis = currentBlock.movingAxis;
  let overlap = 0;
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
    if (overlap < originalSize.width) {
      let extraWidth = originalSize.width - overlap;
      let extraGeometry = new THREE.BoxGeometry(extraWidth, BLOCK_HEIGHT, currentBlock.size.depth);
      let extraMaterial = getBlockMaterial();
      let extraMesh = new THREE.Mesh(extraGeometry, extraMaterial);
      extraMesh.castShadow = true;
      extraMesh.receiveShadow = true;
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
  stack.push(currentBlock);
  score++;
  updateScoreDisplay();
  addReflection(currentBlock.mesh);
  // Обновляем целевую позицию камеры – она будет стремиться к верхнему блоку + 100 по Y
  cameraTargetY = currentBlock.mesh.position.y + 100;
  spawnNewBlock();
}

// Основной цикл игры: обновление и рендеринг
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

// Сброс игры
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (renderer) {
    renderer.clear();
  }
}
