/* =========================
   game2.js — Stack (3D башня)
   Управление:
     - Клик / Тап: установить текущий движущийся блок на место.
   При достижении 10 блоков — победа, +200 points.
   При промахе — Game Over.
========================= */

// Глобальные переменные для game2
let game2Started = false;    // Запущена ли игра
let game2Running = false;    // Идёт ли игровой цикл
let animationFrameId2 = null;

// Трёхмерная сцена
let game2Canvas;       // HTMLCanvasElement (match3Canvas)
let renderer2;         // THREE.WebGLRenderer
let scene2;            // THREE.Scene
let camera2;           // THREE.PerspectiveCamera

// Логика "Stack"
let baseSize = { x: 3, y: 0.5, z: 3 }; // Начальные размеры блоков
let stack = [];        // Массив уже установленных блоков
let currentBlock = null;
let currentDirection = 'x';  // По какой оси двигается текущий блок (x или z)
let blockSpeed = 0.03;       // Скорость движения текущего блока
let levelCount = 0;          // Сколько блоков уже поставили (счёт)
const MAX_LEVELS = 10;       // Сколько блоков надо поставить для победы

// Плоскость (для визуала)
let floorMesh = null;

// Инициализация игры
function initGame2() {
  game2Canvas = document.getElementById("match3Canvas");
  if (!game2Canvas) {
    console.error("Canvas с id='match3Canvas' не найден!");
    return;
  }

  // Создаём сцену, камеру, рендерер
  scene2 = new THREE.Scene();
  scene2.background = new THREE.Color(0x000000);

  // Параметры камеры
  const aspect = game2Canvas.width / game2Canvas.height;
  camera2 = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
  // Расположим камеру так, чтобы смотреть сверху под небольшим углом
  camera2.position.set(4, 10, 10);
  camera2.lookAt(0, 0, 0);

  // Рендерер
  renderer2 = new THREE.WebGLRenderer({
    canvas: game2Canvas,
    antialias: true,
  });
  renderer2.setSize(game2Canvas.width, game2Canvas.height);

  // Создадим простой "пол" (для визуальной опоры)
  const floorGeom = new THREE.PlaneGeometry(20, 20);
  const floorMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  floorMesh = new THREE.Mesh(floorGeom, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0; // На уровне y=0
  scene2.add(floorMesh);

  // Начальный "базовый" блок (основа)
  const baseBlock = createBlock(baseSize.x, baseSize.y, baseSize.z, 0, baseSize.y / 2, 0);
  scene2.add(baseBlock.mesh);
  stack.push(baseBlock);

  // Создаём "движущийся" первый блок
  spawnNextBlock();

  // События мыши/тач — по нажатию ставим блок
  game2Canvas.addEventListener("mousedown", onUserClick, false);
  game2Canvas.addEventListener("touchstart", onUserClick, { passive: false });

  // Сбрасываем счёт
  levelCount = 0;

  // Запуск игры с флагами
  game2Started = false;
  game2Running = true;

  // Сразу перерисуем (при первом кадре игрок может увидеть стартовую сцену)
  drawGame2();
}

// Основной игровой цикл
function game2Loop() {
  updateGame2();
  drawGame2();
  if (game2Running) {
    animationFrameId2 = requestAnimationFrame(game2Loop);
  }
}

// Обновление логики
function updateGame2() {
  if (!game2Started) return; // Пока не было первого клика, блок стоит на месте

  if (currentBlock) {
    // Двигаем текущий блок вдоль выбранной оси
    if (currentDirection === 'x') {
      currentBlock.mesh.position.x += blockSpeed;
    } else {
      currentBlock.mesh.position.z += blockSpeed;
    }
  }
}

// Отрисовка сцены
function drawGame2() {
  renderer2.render(scene2, camera2);
}

// Пользовательский ввод (установка блока)
function onUserClick(e) {
  e.preventDefault();

  // При первом клике запустим игру (игровой цикл)
  if (!game2Started) {
    game2Started = true;
    game2Running = true;
    game2Loop();
  }

  if (!currentBlock) return;

  // Проверяем пересечение с предыдущим блоком
  const topBlock = stack[stack.length - 1]; // последний установленный
  const overlap = checkOverlap(topBlock, currentBlock);

  // Если перекрытия нет — Game Over
  if (overlap.overlapSize <= 0) {
    endGame2(false);
    return;
  }

  // Если есть перекрытие — возможно «подрезаем» блок (для наглядности)
  const newSize = { ...currentBlock.size };
  const newPos = { ...currentBlock.mesh.position };

  if (currentDirection === 'x') {
    newSize.x = overlap.overlapSize;
    newPos.x = overlap.correctedPosition;
  } else {
    newSize.z = overlap.overlapSize;
    newPos.z = overlap.correctedPosition;
  }

  // Обновляем текущий блок размером и позицией
  currentBlock.size = newSize;
  currentBlock.mesh.scale.x = newSize.x / baseSize.x; 
  currentBlock.mesh.scale.z = newSize.z / baseSize.z;
  currentBlock.mesh.position.x = newPos.x;
  currentBlock.mesh.position.z = newPos.z;

  // Добавляем блок в стек
  stack.push(currentBlock);
  levelCount++;

  // Проверка победы (например, собрали 10 блоков)
  if (levelCount >= MAX_LEVELS) {
    endGame2(true);
    return;
  }

  // Спавним следующий блок
  spawnNextBlock();
}

// Создание нового блока (THREE.Mesh)
function createBlock(sx, sy, sz, px, py, pz) {
  const geometry = new THREE.BoxGeometry(sx, sy, sz);
  const material = new THREE.MeshBasicMaterial({ color: 0x00ff88 });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(px, py, pz);

  return {
    size: { x: sx, y: sy, z: sz },
    mesh: mesh,
  };
}

// Создать следующий движущийся блок поверх предыдущего
function spawnNextBlock() {
  const topBlock = stack[stack.length - 1];
  const nextY = topBlock.mesh.position.y + topBlock.size.y; // следующий слой выше

  // Меняем направление движения на противоположное (x -> z -> x -> ...)
  currentDirection = currentDirection === 'x' ? 'z' : 'x';

  // Начальные координаты нового блока
  // Поставим рядом по оси, чтобы он «заезжал» на предыдущий
  let startX = topBlock.mesh.position.x;
  let startZ = topBlock.mesh.position.z;
  if (currentDirection === 'x') {
    startX = -6; // далеко слева, будет ехать вправо
  } else {
    startZ = -6; // «далеко сзади», будет ехать вперёд
  }

  // Создаём такой же размер, как у последнего
  const newBlock = createBlock(
    topBlock.size.x,
    topBlock.size.y,
    topBlock.size.z,
    startX,
    nextY,
    startZ
  );

  scene2.add(newBlock.mesh);
  currentBlock = newBlock;
}

// Проверка пересечения по оси
function checkOverlap(blockBelow, blockMoving) {
  // Берём позиции
  const belowPos = blockBelow.mesh.position;
  const belowSize = blockBelow.size;
  const movingPos = blockMoving.mesh.position;
  const movingSize = blockMoving.size;

  let overlapSize = 0;
  let correctedPosition = 0;

  if (currentDirection === 'x') {
    // Смотрим перекрытие по X
    const delta = movingPos.x - belowPos.x;
    const halfBelow = belowSize.x / 2;
    const halfMoving = movingSize.x / 2;

    const leftEdge = -Math.min(halfBelow, halfMoving) + (belowPos.x + movingPos.x)/2;
    const rightEdge = Math.min(halfBelow, halfMoving) + (belowPos.x + movingPos.x)/2;
    // Фактическое перекрытие = halfBelow + halfMoving - |delta|
    overlapSize = halfBelow + halfMoving - Math.abs(delta);
    correctedPosition = belowPos.x + delta / 2; 
    // (или более точная формула, если хотите аккуратный срез; для наглядности оставим упрощённо)
  } else {
    // По Z
    const delta = movingPos.z - belowPos.z;
    const halfBelow = belowSize.z / 2;
    const halfMoving = movingSize.z / 2;

    overlapSize = halfBelow + halfMoving - Math.abs(delta);
    correctedPosition = belowPos.z + delta / 2;
  }

  return {
    overlapSize: overlapSize > 0 ? overlapSize : 0,
    correctedPosition
  };
}

// Завершение игры (win/lose)
function endGame2(playerWin) {
  game2Running = false;

  if (playerWin) {
    // Начисляем 200 очков
    if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
      localUserData.points += 200;
      userRef.update({ points: localUserData.points });
      updateTopBar(); // Обновить отображение очков в шапке
    }
    showEndGameModal("You Win!", "You stacked " + levelCount + " blocks. +200 points!");
  } else {
    // Просто завершили (промахнулись)
    if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
      userRef.update({ points: localUserData.points });
    }
    showEndGameModal("Game Over", "You stacked " + levelCount + " blocks");
  }
}

// Сброс игры (вызывается при закрытии модалки)
function resetGame2() {
  // Останавливаем игровой цикл
  cancelAnimationFrame(animationFrameId2);
  game2Running = false;

  // Убираем слушатели
  if (game2Canvas) {
    game2Canvas.removeEventListener("mousedown", onUserClick);
    game2Canvas.removeEventListener("touchstart", onUserClick);
  }

  // Чистим сцену
  if (scene2) {
    while (scene2.children.length > 0) {
      const obj = scene2.children.pop();
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
      // remove from scene
    }
  }

  // Сбрасываем все переменные
  stack = [];
  currentBlock = null;
  levelCount = 0;
  game2Started = false;
  game2Running = false;
  currentDirection = 'x';
  animationFrameId2 = null;

  // Очистим рендерер (на всякий случай)
  if (renderer2) {
    renderer2.renderLists.dispose();
    // renderer2.dispose(); // обычно не требуется в рамках одной страницы
  }
}

