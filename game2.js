/* game2.js – 3D Игра «Stack» с динамическим градиентным фоном, радужными блоками,
   объемными 3D-эффектами (тенями, бликами, отражениями) и минималистичным интерфейсом.
   
   За каждый успешно уложенный блок начисляется 5 points.
*/

////// ПАРАМЕТРЫ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ //////
const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0; // число успешно уложенных блоков

// Для динамического фона
let bgCanvas, bgCtx, bgTexture;
const bgCycleTime = 20; // период смены градиента (сек)

// Для радужного эффекта блоков
let rainbowHue = 0; // значение от 0 до 1, будет увеличиваться при каждом новом блоке

// Массив уложенных блоков: каждый элемент { mesh, size: {width, depth} }
let stack = [];
// Текущий движущийся блок: { mesh, size, movingAxis, speed, direction }
let currentBlock = null;

// Массив падающих (отсечённых) частей блоков
let fallingPieces = [];

// Часы для анимаций
let clock = new THREE.Clock();

////// ФУНКЦИИ ДЛЯ ДИНАМИЧЕСКОГО ФОНА //////
// Линейная интерполяция между двумя числовыми значениями
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Преобразование hex-строки в массив [r,g,b]
function hexToRgb(hex) {
  hex = hex.replace("#", "");
  return [
    parseInt(hex.substring(0, 2), 16),
    parseInt(hex.substring(2, 4), 16),
    parseInt(hex.substring(4, 6), 16)
  ];
}

// Интерполяция между двумя hex-цветами
function lerpColor(hex1, hex2, t) {
  let rgb1 = hexToRgb(hex1);
  let rgb2 = hexToRgb(hex2);
  let r = Math.round(lerp(rgb1[0], rgb2[0], t));
  let g = Math.round(lerp(rgb1[1], rgb2[1], t));
  let b = Math.round(lerp(rgb1[2], rgb2[2], t));
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Обновление градиентной текстуры фона на основе времени
function updateBackgroundTexture() {
  let t = (clock.getElapsedTime() % bgCycleTime) / bgCycleTime;
  // Определяем два наборов цветов для градиента:
  // набор 1: пастельный розовый → голубой
  // набор 2: пастельный фиолетовый → зелёный
  let topColor = lerpColor("#FFC0CB", "#D8BFD8", t);    // от розового к фиолетовому
  let bottomColor = lerpColor("#ADD8E6", "#90EE90", t);   // от голубого к зелёному

  let height = bgCanvas.height;
  let gradient = bgCtx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(1, bottomColor);

  bgCtx.fillStyle = gradient;
  bgCtx.fillRect(0, 0, bgCanvas.width, height);

  bgTexture.needsUpdate = true;
}

////// ФУНКЦИИ ДЛЯ МАТЕРИАЛОВ БЛОКОВ //////
// Создание текстуры для блока с радужным градиентом
function createRainbowBlockTexture(hue) {
  const width = 256, height = 256;
  let canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  let ctx = canvas.getContext("2d");
  
  // Вычисляем два цвета: базовый и немного сдвинутый по hue
  let baseColor = new THREE.Color().setHSL(hue, 1, 0.5);
  let nextColor = new THREE.Color().setHSL((hue + 0.1) % 1, 1, 0.5);
  
  // Создаем вертикальный градиент
  let grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#" + baseColor.getHexString());
  grad.addColorStop(1, "#" + nextColor.getHexString());
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  
  // Добавляем легкий блик сверху (10% высоты)
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.fillRect(0, 0, width, height * 0.1);
  
  return new THREE.CanvasTexture(canvas);
}

// Создание материала для блока с использованием радужной текстуры
function getBlockMaterial() {
  // Используем глобальный rainbowHue и затем увеличиваем его
  let texture = createRainbowBlockTexture(rainbowHue);
  rainbowHue = (rainbowHue + 0.15) % 1;
  texture.minFilter = THREE.LinearFilter;
  let material = new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    shininess: 100,
    specular: new THREE.Color("#FFFFFF")
  });
  return material;
}

////// ФУНКЦИИ ДЛЯ 3D СЦЕНЫ //////
// Инициализация динамического градиентного фона
function initBackground() {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = 16;
  bgCanvas.height = 256;
  bgCtx = bgCanvas.getContext("2d");
  // Первоначальное заполнение
  let grad = bgCtx.createLinearGradient(0, 0, 0, bgCanvas.height);
  grad.addColorStop(0, "#FFC0CB");
  grad.addColorStop(1, "#ADD8E6");
  bgCtx.fillStyle = grad;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgTexture = new THREE.CanvasTexture(bgCanvas);
}

// Инициализация Three.js сцены и камеры
function initThree() {
  scene = new THREE.Scene();
  initBackground();
  scene.background = bgTexture; // динамический фон
  
  camera = new THREE.PerspectiveCamera(60, game2Canvas.width / game2Canvas.height, 1, 2000);
  // Камера: позиция (400,900,700), направлена на (0,300,0) – наклон ≈35°
  camera.position.set(400, 900, 700);
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

////// ФУНКЦИИ ДЛЯ БЛОКОВ //////
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
  // Случайная скорость от 2 до 6
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

// Добавление отражения к блоку – клон, перевёрнутый по оси Y с прозрачностью
function addReflection(originalMesh) {
  let reflection = originalMesh.clone();
  reflection.material = originalMesh.material.clone();
  reflection.material.opacity = 0.3;
  reflection.material.transparent = true;
  reflection.scale.y = -1;
  reflection.position.y = originalMesh.position.y - BLOCK_HEIGHT * 1.1;
  scene.add(reflection);
}

// Функция создания и запуска эффекта падающей (отсечённой) части
function createFallingPiece(originalMesh, extraGeometry, offsetPosition) {
  let material = originalMesh.material.clone();
  material.opacity = 0.6;
  let fallingMesh = new THREE.Mesh(extraGeometry, material);
  fallingMesh.castShadow = true;
  fallingMesh.receiveShadow = true;
  // Позиция: совмещена с оригиналом плюс смещение (offsetPosition)
  fallingMesh.position.copy(originalMesh.position).add(offsetPosition);
  // Добавляем начальную скорость
  fallingMesh.userData.velocity = new THREE.Vector3(0, -5, 0);
  fallingPieces.push(fallingMesh);
  scene.add(fallingMesh);
}

// Обновление движения падающих частей (симуляция гравитации)
function updateFallingPieces(delta) {
  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    let piece = fallingPieces[i];
    // Ускорение гравитации
    piece.userData.velocity.y -= 9.8 * delta;
    piece.position.addScaledVector(piece.userData.velocity, delta);
    // Если опустились ниже y = -200, удаляем из сцены
    if (piece.position.y < -200) {
      scene.remove(piece);
      fallingPieces.splice(i, 1);
    }
  }
}

////// ФУНКЦИИ ДЛЯ ОБНОВЛЕНИЯ ИГРЫ //////
// Обновление положения движущегося блока с пульсирующими эффектами и цифровым сбоем
function updateGame() {
  updateBackgroundTexture();
  
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
  
  // Пульсация эмиссии текущего блока (эффект неонового свечения)
  let pulse = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 5);
  currentBlock.mesh.material.emissive = new THREE.Color(0x00FF00).multiplyScalar(pulse);
  
  // Эффект "цифрового сбоя": случайное небольшое смещение
  if (Math.random() < 0.01) {
    currentBlock.mesh.position.x += (Math.random() - 0.5) * 5;
    currentBlock.mesh.position.z += (Math.random() - 0.5) * 5;
  }
  
  // Обновление glow-света
  if (glowLight) {
    glowLight.position.y = stack[stack.length - 1].mesh.position.y;
    glowLight.intensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
  }
  
  // Обновление падающих частей
  let delta = clock.getDelta();
  updateFallingPieces(delta);
  
  // Обновление UI (если есть элемент с id "scoreDisplay")
  updateScoreUI();
}

// Обновление UI-счёта (каждый блок даёт 5 points)
function updateScoreUI() {
  let ui = document.getElementById("scoreDisplay");
  if (ui) {
    ui.innerText = "Score: " + (score * 5);
  }
}

////// ФУНКЦИЯ ФИКСАЦИИ БЛОКА //////
// При фиксации блока вычисляем пересечение с верхним блоком; если несовпадение – отсекаем лишнее и создаём падающую часть
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
    // Если блок не идеально совмещён, создаём падающую часть
    let extraWidth = currentBlock.size.width - overlap;
    if (extraWidth > 0) {
      // Определяем, с какой стороны произошёл сдвиг
      let offset = new THREE.Vector3();
      if (currentBlock.mesh.position.x < topBlock.mesh.position.x) {
        // лишняя часть справа
        offset.set(overlapRight + extraWidth/2 - currentBlock.mesh.position.x, 0, 0);
        // Создаём геометрию лишней части
        let extraGeom = new THREE.BoxGeometry(extraWidth, BLOCK_HEIGHT, currentBlock.size.depth);
        createFallingPiece(currentBlock.mesh, extraGeom, offset);
      } else {
        // лишняя часть слева
        offset.set(overlapLeft - extraWidth/2 - currentBlock.mesh.position.x, 0, 0);
        let extraGeom = new THREE.BoxGeometry(extraWidth, BLOCK_HEIGHT, currentBlock.size.depth);
        createFallingPiece(currentBlock.mesh, extraGeom, offset);
      }
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
    if (overlap <= 0) { gameOver(); return; }
    let extraDepth = currentBlock.size.depth - overlap;
    if (extraDepth > 0) {
      let offset = new THREE.Vector3();
      if (currentBlock.mesh.position.z < topBlock.mesh.position.z) {
        offset.set(0, 0, overlapBack + extraDepth/2 - currentBlock.mesh.position.z);
        let extraGeom = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, extraDepth);
        createFallingPiece(currentBlock.mesh, extraGeom, offset);
      } else {
        offset.set(0, 0, overlapFront - extraDepth/2 - currentBlock.mesh.position.z);
        let extraGeom = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, extraDepth);
        createFallingPiece(currentBlock.mesh, extraGeom, offset);
      }
    }
    let newCenterZ = (overlapFront + overlapBack) / 2;
    let newGeometry = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, overlap);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeometry;
    currentBlock.mesh.position.z = newCenterZ;
    currentBlock.size.depth = overlap;
  }
  // Добавляем успешно зафиксированный блок в башню и создаём отражение
  stack.push(currentBlock);
  score++;
  addReflection(currentBlock.mesh);
  // Поднимаем камеру, чтобы новый блок оставался в кадре
  let newY = currentBlock.mesh.position.y;
  if (newY > camera.position.y - 100) {
    camera.position.y = newY + 100;
  }
  spawnNewBlock();
}

////// ОСНОВНОЙ ЦИКЛ ИГРЫ ////// 
function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(gameLoop);
}

////// ФУНКЦИЯ ЗАВЕРШЕНИЯ ИГРЫ ////// 
function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  showEndGameModal("Game Over", "Score: " + (score * 5));
}

////// ИНИЦИАЛИЗАЦИЯ И СБРОС ИГРЫ ////// 
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

function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (renderer) {
    renderer.clear();
  }
}
