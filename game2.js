/* game2.js – 3D Игра «Stack» с динамическим градиентным фоном, радуговыми блоками,
   отражениями, анимациями отрезания и эффектами, а также минималистичным интерфейсом.

Основные особенности:
1. Фон:
   – Динамический градиентный фон, который плавно меняет цвета (от пастельного розового, голубого, фиолетового до зелёного),
     создавая приятную атмосферу.
2. Цвета фигур:
   – Каждый новый блок получает яркий, насыщенный цвет с эффектом градиентного перехода (эффект радуги),
     отличающийся от предыдущего.
3. 3D‑эффекты:
   – Блоки объемные, с мягкими тенями, отражениями (слабый дубликат, перевёрнутый по оси Y) и бликами.
   – Если блок не совмещён идеально, лишняя часть отрезается и создается падающая анимация с затуханием.
4. Анимации:
   – Движущийся блок плавно перемещается, при фиксации производится обрезка, а обрезанная часть падает с эффектом затухания.
   – Башня слегка раскачивается для реалистичности.
5. Интерфейс:
   – Информация (очки, высота башни) может располагаться отдельно (например, через HTML‑оверлей).
   – Управление осуществляется касанием экрана (без лишних кнопок).
6. Общий стиль:
   – Современный, минималистичный, low‑poly; динамические градиенты и плавные анимации создают стильный и увлекательный вид.
*/

// Параметры блоков
const BLOCK_HEIGHT = 20;
const INITIAL_BLOCK_SIZE = { width: 300, depth: 300 };

// Для эффекта радуги будем циклично менять оттенок
let currentHue = 0;

// Создание динамического градиентного фона
let bgCanvas = document.createElement("canvas");
bgCanvas.width = 16;
bgCanvas.height = 256;
let bgCtx = bgCanvas.getContext("2d");
let bgTexture = new THREE.CanvasTexture(bgCanvas);

function updateBackground() {
  // Медленное изменение с течением времени
  let t = clock.getElapsedTime() * 0.05;
  // Вычисляем четыре цвета с плавным переходом
  let hue1 = (t * 60) % 360;
  let hue2 = (t * 60 + 90) % 360;
  let hue3 = (t * 60 + 180) % 360;
  let hue4 = (t * 60 + 270) % 360;
  let gradient = bgCtx.createLinearGradient(0, 0, 0, bgCanvas.height);
  gradient.addColorStop(0, `hsl(${hue1}, 60%, 80%)`);
  gradient.addColorStop(0.33, `hsl(${hue2}, 60%, 80%)`);
  gradient.addColorStop(0.66, `hsl(${hue3}, 60%, 80%)`);
  gradient.addColorStop(1, `hsl(${hue4}, 60%, 80%)`);
  bgCtx.fillStyle = gradient;
  bgCtx.fillRect(0, 0, bgCanvas.width, bgCanvas.height);
  bgTexture.needsUpdate = true;
}

// Функция создания градиентной текстуры для блока с эффектом радуги
function getBlockMaterial() {
  // Каждый новый блок меняет цвет (эффект радуги)
  currentHue = (currentHue + 40) % 360;
  let canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  let ctx = canvas.getContext("2d");
  let gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, `hsl(${currentHue}, 100%, 50%)`);
  gradient.addColorStop(0.5, `hsl(${(currentHue + 20) % 360}, 100%, 50%)`);
  gradient.addColorStop(1, `hsl(${(currentHue + 40) % 360}, 100%, 50%)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  let texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  let material = new THREE.MeshPhongMaterial({
    map: texture,
    transparent: true,
    opacity: 0.9,
    shininess: 100,
    specular: new THREE.Color("#ffffff"),
    reflectivity: 0.5
  });
  return material;
}

// Массив для падающих отрезков (при несоответствии)
let fallingPieces = [];

// Добавление отражения для блока (перевёрнутый по оси Y с прозрачностью)
function addReflection(originalMesh) {
  let reflection = originalMesh.clone();
  reflection.material = originalMesh.material.clone();
  reflection.material.opacity = 0.3;
  reflection.material.transparent = true;
  reflection.scale.y = -1;
  // Располагаем отражение чуть ниже оригинала
  reflection.position.y = originalMesh.position.y - BLOCK_HEIGHT * 1.1;
  scene.add(reflection);
}

// Группа для башни – для легкого управления (например, раскачивание)
let towerGroup;

// Основные переменные Three.js
let scene, camera, renderer;
let game2Canvas;
let animationFrameId;
let gameRunning = false;
let score = 0;
let clock = new THREE.Clock();

// Массив уложенных блоков (каждый: { mesh, size: {width, depth} })
let stack = [];
// Текущий движущийся блок (объект { mesh, size, movingAxis, speed, direction })
let currentBlock = null;

// Точечный свет для эффекта свечения башни
let glowLight;

// Инициализация Three.js и сцены
function initThree() {
  scene = new THREE.Scene();
  // Фон – динамический градиент (изменяется в updateBackground)
  scene.background = bgTexture;

  // Настройка перспективной камеры:
  // FOV = 60°, позиция (400, 800, 600), взгляд направлен на (0, 300, 0) – наклон ~35° вниз.
  camera = new THREE.PerspectiveCamera(60, game2Canvas.width / game2Canvas.height, 1, 2000);
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
  // DirectionalLight для создания мягких теней
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
  glowLight.position.set(0, 0, 0);
  scene.add(glowLight);

  // Группа для башни (для последующего раскачивания)
  towerGroup = new THREE.Group();
  scene.add(towerGroup);
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
  let block = { mesh: mesh, size: { width: INITIAL_BLOCK_SIZE.width, depth: INITIAL_BLOCK_SIZE.depth } };
  towerGroup.add(mesh);
  addReflection(mesh);
  stack.push(block);
}

// Создание нового движущегося блока
function spawnNewBlock() {
  let topBlock = stack[stack.length - 1];
  let newSize = { width: topBlock.size.width, depth: topBlock.size.depth };
  // Чередуем ось движения: если число блоков четное – движется по оси X, иначе – по оси Z
  let movingAxis = (stack.length % 2 === 0) ? "x" : "z";
  // Случайная скорость движения от 2 до 6 (чтобы предотвратить авто-клики)
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
  towerGroup.add(mesh);
}

// Массив для падающих (отрезанных) частей
let fallingPieces = [];

// Обновление движения движущегося блока и динамических эффектов
function updateGame() {
  // Обновляем динамичный фон
  updateBackground();

  // Легкое покачивание башни (расчёт на основе времени)
  towerGroup.rotation.z = 0.02 * Math.sin(clock.getElapsedTime());

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
    // Эффект "цифрового сбоя": случайное небольшое смещение
    if (Math.random() < 0.01) {
      currentBlock.mesh.position.x += (Math.random() - 0.5) * 5;
      currentBlock.mesh.position.z += (Math.random() - 0.5) * 5;
    }
  }
  
  // Обновляем падающие отрезанные части (с эффектом падения и затухания)
  for (let i = fallingPieces.length - 1; i >= 0; i--) {
    let piece = fallingPieces[i];
    // Простая симуляция гравитации
    piece.velocity.y -= 0.2;
    piece.mesh.position.add(piece.velocity);
    piece.life -= 0.02;
    piece.mesh.material.opacity = Math.max(0, piece.life);
    if (piece.life <= 0) {
      towerGroup.remove(piece.mesh);
      scene.remove(piece.mesh);
      fallingPieces.splice(i, 1);
    }
  }
  
  // Обновляем glow-свет, следящий за верхним блоком
  if (glowLight && stack.length > 0) {
    glowLight.position.y = stack[stack.length - 1].mesh.position.y;
    glowLight.intensity = 0.5 + 0.5 * Math.sin(clock.getElapsedTime() * 3);
  }
}

// Фиксация блока (вызывается по клику или нажатию клавиши)
// Если блок не совмещён идеально, отрезается лишняя часть и создаётся падающий объект
function onDropBlock() {
  if (!gameRunning || !currentBlock) return;
  let topBlock = stack[stack.length - 1];
  let movingAxis = currentBlock.movingAxis;
  let overlap = 0;
  let newCenter;
  
  if (movingAxis === "x") {
    let currentLeft = currentBlock.mesh.position.x - currentBlock.size.width / 2;
    let currentRight = currentBlock.mesh.position.x + currentBlock.size.width / 2;
    let topLeft = topBlock.mesh.position.x - topBlock.size.width / 2;
    let topRight = topBlock.mesh.position.x + topBlock.size.width / 2;
    let overlapLeft = Math.max(currentLeft, topLeft);
    let overlapRight = Math.min(currentRight, topRight);
    overlap = overlapRight - overlapLeft;
    if (overlap <= 0) { gameOver(); return; }
    newCenter = (overlapLeft + overlapRight) / 2;
    // Если блок не идеально совмещён, создаём падающую часть
    if (overlap < currentBlock.size.width) {
      let extraWidth = currentBlock.size.width - overlap;
      let extraGeometry = new THREE.BoxGeometry(extraWidth, BLOCK_HEIGHT, currentBlock.size.depth);
      let extraMaterial = currentBlock.mesh.material.clone();
      extraMaterial.opacity = 0.7;
      let extraMesh = new THREE.Mesh(extraGeometry, extraMaterial);
      extraMesh.castShadow = true;
      extraMesh.receiveShadow = true;
      // Определяем, с какой стороны отрезается лишнее
      if (currentBlock.mesh.position.x > newCenter) {
        extraMesh.position.x = currentBlock.mesh.position.x + (overlap / 2 + extraWidth / 2);
      } else {
        extraMesh.position.x = currentBlock.mesh.position.x - (overlap / 2 + extraWidth / 2);
      }
      extraMesh.position.y = currentBlock.mesh.position.y;
      extraMesh.position.z = currentBlock.mesh.position.z;
      fallingPieces.push({ mesh: extraMesh, velocity: new THREE.Vector3(0, -2, 0), life: 2.0 });
      towerGroup.add(extraMesh);
    }
    // Обновляем геометрию основного блока
    let newGeometry = new THREE.BoxGeometry(overlap, BLOCK_HEIGHT, currentBlock.size.depth);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeometry;
    currentBlock.mesh.position.x = newCenter;
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
    newCenter = (overlapFront + overlapBack) / 2;
    if (overlap < currentBlock.size.depth) {
      let extraDepth = currentBlock.size.depth - overlap;
      let extraGeometry = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, extraDepth);
      let extraMaterial = currentBlock.mesh.material.clone();
      extraMaterial.opacity = 0.7;
      let extraMesh = new THREE.Mesh(extraGeometry, extraMaterial);
      extraMesh.castShadow = true;
      extraMesh.receiveShadow = true;
      if (currentBlock.mesh.position.z > newCenter) {
        extraMesh.position.z = currentBlock.mesh.position.z + (overlap / 2 + extraDepth / 2);
      } else {
        extraMesh.position.z = currentBlock.mesh.position.z - (overlap / 2 + extraDepth / 2);
      }
      extraMesh.position.y = currentBlock.mesh.position.y;
      extraMesh.position.x = currentBlock.mesh.position.x;
      fallingPieces.push({ mesh: extraMesh, velocity: new THREE.Vector3(0, -2, 0), life: 2.0 });
      towerGroup.add(extraMesh);
    }
    let newGeometry = new THREE.BoxGeometry(currentBlock.size.width, BLOCK_HEIGHT, overlap);
    currentBlock.mesh.geometry.dispose();
    currentBlock.mesh.geometry = newGeometry;
    currentBlock.mesh.position.z = newCenter;
    currentBlock.size.depth = overlap;
  }
  
  // Фиксированный блок добавляем в башню
  stack.push(currentBlock);
  score++;
  addReflection(currentBlock.mesh);
  
  // Поднимаем камеру, чтобы башня оставалась в кадре
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
  showEndGameModal("Game Over", "Score: " + score);
}

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Элемент canvas с id 'match3Canvas' не найден.");
    return;
  }
  clock.start();
  initThree();
  createBaseBlock();
  spawnNewBlock();
  score = 0;
  gameRunning = true;
  window.addEventListener("keydown", onDropBlock);
  game2Canvas.addEventListener("click", onDropBlock);
  gameLoop();
}

// Сброс игры (например, при закрытии)
function resetGame2() {
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("keydown", onDropBlock);
  game2Canvas.removeEventListener("click", onDropBlock);
  if (renderer) {
    renderer.clear();
  }
}
