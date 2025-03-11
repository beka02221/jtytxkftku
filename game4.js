/* game4.js – 3D Breakout/Arkanoid Игра
   Современный минималистичный стиль с динамичным градиентным фоном и яркими элементами.

   Основные особенности:
   1. Динамический градиентный фон.
   2. Управляемая игроком платформа.
   3. Шарик с физикой столкновений.
   4. Разрушаемые кирпичи с начислением очков.
   5. Система жизней и отображение счета.
*/

// ------------------------- Константы и настройки -------------------------
const PADDLE_WIDTH = 150;
const PADDLE_HEIGHT = 20;
const PADDLE_DEPTH = 20;

const BALL_RADIUS = 10;

const BRICK_ROWS = 5;
const BRICK_COLUMNS = 10;
const BRICK_WIDTH = 60;
const BRICK_HEIGHT = 20;
const BRICK_DEPTH = 20;
const BRICK_PADDING = 10;
const BRICK_OFFSET_TOP = 50;
const BRICK_OFFSET_LEFT = 30;

// Границы игрового поля (в мировых координатах)
const GAME_LEFT = -400;
const GAME_RIGHT = 400;
const GAME_TOP = 500;
const GAME_BOTTOM = 0;

// ------------------------- Глобальные переменные -------------------------
let scene, camera, renderer;
let breakoutCanvas;
let animationFrameId;
let gameRunning = false;

let score = 0;
let lives = 3;

let paddle, ball, bricks = [];
let ballVelocity = new THREE.Vector3(2, -2, 2); // начальная скорость шарика

// Переменные для динамичного фона
let bgCanvas, bgContext, bgTexture;

// ------------------------- Функции фона -------------------------
function createBackgroundTexture() {
  bgCanvas = document.createElement("canvas");
  bgCanvas.width = 16;
  bgCanvas.height = 256;
  bgContext = bgCanvas.getContext("2d");
  bgTexture = new THREE.CanvasTexture(bgCanvas);
  return bgTexture;
}

function updateBackground() {
  // Динамический градиент: плавное изменение оттенков
  let t = Date.now() * 0.001;
  let offset = (Math.sin(t / 10) + 1) / 2;
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

// ------------------------- Инициализация Three.js -------------------------
function initThree() {
  scene = new THREE.Scene();
  scene.background = createBackgroundTexture();

  camera = new THREE.PerspectiveCamera(60, breakoutCanvas.width / breakoutCanvas.height, 1, 2000);
  camera.position.set(0, 300, 800);
  camera.lookAt(new THREE.Vector3(0, 300, 0));
  camera.updateProjectionMatrix();

  renderer = new THREE.WebGLRenderer({ canvas: breakoutCanvas, antialias: true });
  renderer.setSize(breakoutCanvas.width, breakoutCanvas.height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  let ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
  scene.add(ambientLight);

  let directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
  directionalLight.position.set(100, 200, 100);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
}

// ------------------------- Создание игровых объектов -------------------------
function createPaddle() {
  const geometry = new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_DEPTH);
  const material = new THREE.MeshLambertMaterial({ color: 0x0095DD });
  let paddleMesh = new THREE.Mesh(geometry, material);
  paddleMesh.position.set(0, PADDLE_HEIGHT / 2, -250);
  paddleMesh.castShadow = true;
  paddleMesh.receiveShadow = true;
  scene.add(paddleMesh);
  return paddleMesh;
}

function createBall() {
  const geometry = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
  const material = new THREE.MeshLambertMaterial({ color: 0xFF4500 });
  let ballMesh = new THREE.Mesh(geometry, material);
  ballMesh.position.set(0, BALL_RADIUS + 200, -240);
  ballMesh.castShadow = true;
  ballMesh.receiveShadow = true;
  scene.add(ballMesh);
  return ballMesh;
}

function createBricks() {
  let brickArray = [];
  for (let r = 0; r < BRICK_ROWS; r++) {
    brickArray[r] = [];
    for (let c = 0; c < BRICK_COLUMNS; c++) {
      const geometry = new THREE.BoxGeometry(BRICK_WIDTH, BRICK_HEIGHT, BRICK_DEPTH);
      const material = new THREE.MeshLambertMaterial({ color: getRandomBrickColor() });
      let brickMesh = new THREE.Mesh(geometry, material);
      // Расчёт позиции кирпича
      let x = c * (BRICK_WIDTH + BRICK_PADDING) - ((BRICK_COLUMNS * (BRICK_WIDTH + BRICK_PADDING)) / 2) + BRICK_WIDTH / 2 + BRICK_OFFSET_LEFT;
      let y = GAME_TOP - r * (BRICK_HEIGHT + BRICK_PADDING) - BRICK_OFFSET_TOP;
      brickMesh.position.set(x, y, 0);
      brickMesh.castShadow = true;
      brickMesh.receiveShadow = true;
      scene.add(brickMesh);
      brickArray[r][c] = { mesh: brickMesh, status: 1 }; // status: 1 - кирпич существует
    }
  }
  return brickArray;
}

function getRandomBrickColor() {
  // Набор ярких цветов для кирпичей
  const colors = [0xff5733, 0xffbd33, 0x75ff33, 0x33ffbd, 0x3375ff, 0xbd33ff];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ------------------------- Обработка столкновений -------------------------
function checkCollisionSphereBox(sphere, box) {
  // Простейшая проверка столкновения "сфера–осьно-выравненный прямоугольный параллелепипед (AABB)"
  let boxPos = box.position;
  // Получаем размеры коробки
  let boxSize = new THREE.Vector3();
  box.geometry.computeBoundingBox();
  box.geometry.boundingBox.getSize(boxSize);
  let halfExtents = boxSize.multiplyScalar(0.5);
  // Вычисляем ближайшую точку на коробке к центру сферы
  let closestPoint = new THREE.Vector3(
    THREE.MathUtils.clamp(sphere.position.x, boxPos.x - halfExtents.x, boxPos.x + halfExtents.x),
    THREE.MathUtils.clamp(sphere.position.y, boxPos.y - halfExtents.y, boxPos.y + halfExtents.y),
    THREE.MathUtils.clamp(sphere.position.z, boxPos.z - halfExtents.z, boxPos.z + halfExtents.z)
  );
  let distance = sphere.position.distanceTo(closestPoint);
  return distance < BALL_RADIUS;
}

function checkCollisionSpherePlane(sphere, planeY) {
  // Проверка столкновения с горизонтальной плоскостью (например, нижняя граница)
  return (sphere.position.y - BALL_RADIUS) < planeY;
}

// ------------------------- Управление и обновление игры -------------------------
function updateGame() {
  updateBackground();

  // Движение шарика
  ball.position.add(ballVelocity);

  // Отскок от боковых стен
  if (ball.position.x + BALL_RADIUS > GAME_RIGHT) {
    ball.position.x = GAME_RIGHT - BALL_RADIUS;
    ballVelocity.x = -ballVelocity.x;
  }
  if (ball.position.x - BALL_RADIUS < GAME_LEFT) {
    ball.position.x = GAME_LEFT + BALL_RADIUS;
    ballVelocity.x = -ballVelocity.x;
  }
  // Отскок от верхней стены
  if (ball.position.y + BALL_RADIUS > GAME_TOP) {
    ball.position.y = GAME_TOP - BALL_RADIUS;
    ballVelocity.y = -ballVelocity.y;
  }
  // Если шарик упал ниже игрового поля – потеря жизни
  if (ball.position.y - BALL_RADIUS < GAME_BOTTOM) {
    lives--;
    if (lives <= 0) {
      gameOver();
      return;
    } else {
      resetBallAndPaddle();
    }
  }

  // Столкновение с платформой
  if (checkCollisionSphereBox(ball, paddle)) {
    // Меняем направление шарика по вертикали
    ballVelocity.y = Math.abs(ballVelocity.y);
    // Корректируем горизонтальную скорость в зависимости от точки удара
    let hitPoint = (ball.position.x - paddle.position.x) / (PADDLE_WIDTH / 2);
    ballVelocity.x = hitPoint * 5;
  }

  // Столкновения с кирпичами
  for (let r = 0; r < bricks.length; r++) {
    for (let c = 0; c < bricks[r].length; c++) {
      let brick = bricks[r][c];
      if (brick.status === 1 && checkCollisionSphereBox(ball, brick.mesh)) {
        // Удаляем кирпич из сцены
        scene.remove(brick.mesh);
        brick.status = 0;
        score += 10;
        // Простой алгоритм – меняем направление шарика по вертикали
        ballVelocity.y = -ballVelocity.y;
      }
    }
  }
}

function resetBallAndPaddle() {
  // Сброс позиций шарика и платформы после потери жизни
  ball.position.set(0, BALL_RADIUS + 200, -240);
  ballVelocity.set(2, -2, 2);
  paddle.position.set(0, PADDLE_HEIGHT / 2, -250);
}

function gameLoop() {
  if (!gameRunning) return;
  updateGame();
  renderer.render(scene, camera);
  animationFrameId = requestAnimationFrame(gameLoop);
}

function gameOver() {
  gameRunning = false;
  cancelAnimationFrame(animationFrameId);
  window.removeEventListener("mousemove", onMouseMove);
  alert("Game Over! Score: " + score);
}

// ------------------------- Управление платформой -------------------------
// Управление мышью для перемещения платформы по оси X
function onMouseMove(event) {
  let rect = breakoutCanvas.getBoundingClientRect();
  let mouseX = event.clientX - rect.left;
  // Преобразуем координаты мыши (0...ширина) в диапазон от -1 до 1
  let normalizedX = (mouseX / rect.width) * 2 - 1;
  // Масштабируем до границ игрового поля
  paddle.position.x = normalizedX * (GAME_RIGHT - 50);
}

// ------------------------- Инициализация игры -------------------------
function initGame4() {
  breakoutCanvas = document.getElementById("breakoutCanvas");
  if (!breakoutCanvas) {
    console.error("Элемент canvas с id 'breakoutCanvas' не найден.");
    return;
  }
  initThree();

  // Создаём игровые объекты
  paddle = createPaddle();
  ball = createBall();
  bricks = createBricks();

  score = 0;
  lives = 3;
  gameRunning = true;

  // Назначаем обработчик движения мыши для управления платформой
  window.addEventListener("mousemove", onMouseMove);

  gameLoop();
}

// ------------------------- Экспорт и запуск -------------------------
// Для запуска игры вызовите функцию initGame4() после загрузки страницы.
// Например:
// window.onload = initGame4;
