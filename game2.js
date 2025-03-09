/* game2.js — Stack
   Адаптирован под структуру, аналогичную game3.js, game4.js и т.д.
*/

///////////////////////////////
// Глобальные переменные игры
///////////////////////////////
let camera2, scene2, renderer2;    // Three.js
let world2;                        // Cannon.js физический мир
let stack2 = [];                   // Основные блоки (лежат ровно)
let overhangs2 = [];               // Срезанные части (сваливаются вниз)

let lastTimestamp2 = 0;            // Предыдущий таймстамп (для расчёта dt)
let boxHeight2 = 1;                // Высота одного блока
let originalBoxSize2 = 3;          // Начальный размер блока (ширина = глубина)
let autopilot2 = false;            // Если true, блок движется «сам»
let game2Ended = false;            // Флаг окончания
let game2Running = false;          // Флаг запущенного игрового цикла
let game2Started = false;          // Флаг «начато движение»
let robotPrecision2 = 0;           // Регулирует точность «автопилота»
let animationFrameId2;             // Для отмены requestAnimationFrame
let score2 = 0;                    // Локальный счёт в этой игре (Stack)

////////////////////////////////
// Инициализация игры (вызов из index)
////////////////////////////////
function initGame2() {
  // Получаем canvas для рендера
  const game2Canvas = document.getElementById('match3Canvas');
  if (!game2Canvas) {
    console.error("Canvas с id='match3Canvas' не найден!");
    return;
  }

  // Сбрасываем глобальные переменные на случай повторного запуска
  resetGame2(false); // передаём false, чтобы полностью пересоздать сцену

  // Создаём физический мир Cannon.js
  world2 = new CANNON.World();
  world2.gravity.set(0, -10, 0); // Гравитация
  world2.broadphase = new CANNON.NaiveBroadphase();
  world2.solver.iterations = 40;

  // Создаём сцену
  scene2 = new THREE.Scene();

  // Настраиваем камеру (ортографическая для упрощения)
  // Обратите внимание: размеры зависят от реальных px canvas,
  // потому что в Three.js ортокамера рассчитывается исходя из «ширины/высоты».
  const aspect = game2Canvas.width / game2Canvas.height;
  const viewSize = 10; // «ширина» проекции
  const w = viewSize * aspect;
  const h = viewSize;

  camera2 = new THREE.OrthographicCamera(
    w / -2, // left
    w / 2,  // right
    h / 2,  // top
    h / -2, // bottom
    0,      // near
    100     // far
  );
  camera2.position.set(4, 4, 4);
  camera2.lookAt(0, 0, 0);

  // Добавляем освещение
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene2.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
  dirLight.position.set(10, 20, 0);
  scene2.add(dirLight);

  // Создаём renderer, указывая canvas
  renderer2 = new THREE.WebGLRenderer({
    canvas: game2Canvas,
    antialias: true
  });
  // Настраиваем размер (под габариты canvas)
  renderer2.setSize(game2Canvas.width, game2Canvas.height);

  // Начальные параметры игры
  autopilot2 = true;     // при старте игра «ждёт» клика, автопилот включён
  game2Ended = false;
  game2Running = false;
  game2Started = false;
  lastTimestamp2 = 0;
  stack2 = [];
  overhangs2 = [];
  score2 = 0;

  setRobotPrecision2();

  // Добавляем «фундамент» (первый блок в координатах 0,0)
  addLayer2(0, 0, originalBoxSize2, originalBoxSize2);
  // Добавляем ещё один блок, смещённый вдоль x
  addLayer2(-10, 0, originalBoxSize2, originalBoxSize2, "x");

  // Вешаем обработчики клика/тача на сам canvas
  game2Canvas.addEventListener("mousedown", onStackCanvasClick, false);
  game2Canvas.addEventListener("touchstart", onStackCanvasClick, { passive: false });

  // Также, если хотите, можно позволить клавишу «пробел» для desktop:
  // document.addEventListener("keydown", (e) => {
  //   if (e.code === "Space") {
  //     e.preventDefault();
  //     onStackCanvasClick();
  //   }
  // });

  // Сразу рисуем один кадр, чтобы было видно старт
  drawGame2();
}

///////////////////////////////////////////////
// Функция запуска игрового цикла (после клика)
///////////////////////////////////////////////
function startGame2() {
  if (game2Running) return; // уже идёт

  // Если надо заново начать:
  resetGame2(true);

  game2Ended = false;
  game2Running = true;
  game2Started = true;
  lastTimestamp2 = performance.now(); // для dt
  requestAnimationFrame(game2Loop);
}

///////////////////////////////////////////////
// Игровой цикл
///////////////////////////////////////////////
function game2Loop(timestamp) {
  if (!game2Running) return; // если остановка

  const dt = timestamp - lastTimestamp2;
  lastTimestamp2 = timestamp;

  updateGame2(dt);
  drawGame2();

  animationFrameId2 = requestAnimationFrame(game2Loop);
}

///////////////////////////////////////////////
// Логика обновления (каждый кадр)
///////////////////////////////////////////////
function updateGame2(dt) {
  if (game2Ended) return;

  // Скорость движения верхнего блока
  const speed = 0.008; // чем больше, тем быстрее

  // Берём «верхний» блок и «предыдущий» блок
  const topLayer = stack2[stack2.length - 1];
  const previousLayer = stack2[stack2.length - 2];
  if (!topLayer || !previousLayer) return;

  // Нужно ли двигать блок? 
  // game2Started = true только после того, как игрок нажал «начать»
  if (game2Started && !game2Ended) {
    const direction = topLayer.direction;
    // Если не автопилот, мы двигаем блок пока пользователь не кликнет
    // Если автопилот, двигаем пока он не дойдёт до «робот-позиции»
    const blockShouldMove =
      (!autopilot2) ||
      (autopilot2 && topLayer.threejs.position[direction] <
        previousLayer.threejs.position[direction] + robotPrecision2);

    if (blockShouldMove) {
      topLayer.threejs.position[direction] += speed * dt;
      topLayer.cannonjs.position[direction] += speed * dt;

      // Если улетел за грань (прошёл x>10 или z>10)
      if (topLayer.threejs.position[direction] > 10) {
        missedTheSpot2();
      }
    } else {
      // Автопилот достиг «нужной» точки — автоматически «режем»
      if (autopilot2) {
        splitBlockAndAddNextOneIfOverlaps2();
        setRobotPrecision2();
      }
    }
  }

  // Сдвигаем камеру потихоньку вверх, чтобы видно было растущую башню
  const maxY = boxHeight2 * (stack2.length - 2) + 4; // "идеальная" позиция камеры
  if (camera2.position.y < maxY) {
    camera2.position.y += 0.005 * dt; // плавно поднимаем
  }

  // Шаг физики Cannon.js
  world2.step(dt / 1000);

  // Обновляем позиции overhang-блоков в Three.js
  overhangs2.forEach(obj => {
    obj.threejs.position.copy(obj.cannonjs.position);
    obj.threejs.quaternion.copy(obj.cannonjs.quaternion);
  });
}

///////////////////////////////////////////////
// Отрисовка (каждый кадр)
///////////////////////////////////////////////
function drawGame2() {
  if (!renderer2 || !scene2 || !camera2) return;
  renderer2.render(scene2, camera2);
}

///////////////////////////////////////////////
// Завершение / сброс игры
///////////////////////////////////////////////
function resetGame2(justClean = false) {
  // Останавливаем цикл
  if (animationFrameId2) cancelAnimationFrame(animationFrameId2);
  game2Running = false;
  game2Ended = false;
  game2Started = false;
  score2 = 0;

  // Очищаем Cannon.js, если мир существует
  if (world2 && world2.bodies) {
    while (world2.bodies.length > 0) {
      world2.remove(world2.bodies[0]);
    }
  }
  // Очищаем Three.js сцену
  if (scene2) {
    // Удаляем все меши
    const meshes = scene2.children.filter(c => c.isMesh);
    meshes.forEach(m => scene2.remove(m));
  }
  stack2 = [];
  overhangs2 = [];

  // Если justClean=false, то всё (сцена/камера/мир) пересоздадим в initGame2()
  // Иначе — мы просто стерли все блоки, но сохраняем scene2/renderer2/...
}

///////////////////////////////////////////////
// Обработчик клика/тача на canvas
///////////////////////////////////////////////
function onStackCanvasClick(e) {
  // Если игра ещё не началась — запускаем
  if (!game2Started) {
    startGame2();
    return;
  }
  // Иначе «режем» блок
  if (!game2Ended) {
    splitBlockAndAddNextOneIfOverlaps2();
  }
}

///////////////////////////////////////////////
// Вырезаем наложившуюся часть и создаём следующий блок
///////////////////////////////////////////////
function splitBlockAndAddNextOneIfOverlaps2() {
  const topLayer = stack2[stack2.length - 1];
  const previousLayer = stack2[stack2.length - 2];
  if (!topLayer || !previousLayer) return;

  const direction = topLayer.direction;
  const size = (direction === "x") ? topLayer.width : topLayer.depth;
  const delta = topLayer.threejs.position[direction] - previousLayer.threejs.position[direction];
  const overhangSize = Math.abs(delta);
  const overlap = size - overhangSize;

  if (overlap > 0) {
    // Есть пересечение
    cutBox2(topLayer, overlap, size, delta);

    // Срезанный кусок делаем отдельным «overhang»
    const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
    const overhangX = (direction === "x")
      ? topLayer.threejs.position.x + overhangShift
      : topLayer.threejs.position.x;
    const overhangZ = (direction === "z")
      ? topLayer.threejs.position.z + overhangShift
      : topLayer.threejs.position.z;
    const overhangW = (direction === "x") ? overhangSize : topLayer.width;
    const overhangD = (direction === "z") ? overhangSize : topLayer.depth;
    addOverhang2(overhangX, overhangZ, overhangW, overhangD);

    // Добавляем следующий блок поверх
    const nextX = (direction === "x") ? topLayer.threejs.position.x : -10;
    const nextZ = (direction === "z") ? topLayer.threejs.position.z : -10;
    const newWidth = topLayer.width;
    const newDepth = topLayer.depth;
    const nextDirection = (direction === "x") ? "z" : "x";
    stack2.push(generateBox2(nextX, boxHeight2 * stack2.length, nextZ, newWidth, newDepth, false, nextDirection));

    // Обновляем локальный счёт (каждый удачный блок)
    score2 = stack2.length - 1;
  } else {
    // Промахнулись
    missedTheSpot2();
  }
}

///////////////////////////////////////////////
// Если блок полностью промахнулся
///////////////////////////////////////////////
function missedTheSpot2() {
  // Верхний блок падает вниз
  const topLayer = stack2[stack2.length - 1];
  addOverhang2(topLayer.threejs.position.x, topLayer.threejs.position.z, topLayer.width, topLayer.depth);
  world2.remove(topLayer.cannonjs);
  scene2.remove(topLayer.threejs);
  stack2.pop();

  game2Ended = true;
  game2Running = false;

  // Начисляем очки пользователю (по желанию)
  // Например: +score2 к localUserData.points
  if (typeof localUserData !== 'undefined') {
    localUserData.points += score2;
  }
  // Сохраняем на сервер
  if (typeof userRef !== 'undefined' && typeof localUserData !== 'undefined') {
    userRef.update({ points: localUserData.points });
  }

  // Показываем итог
  showEndGameModal("Game Over", "Your score: " + score2);
}

///////////////////////////////////////////////
// Вырезаем overlap
///////////////////////////////////////////////
function cutBox2(topLayer, overlap, size, delta) {
  const direction = topLayer.direction;
  const newWidth = (direction === "x") ? overlap : topLayer.width;
  const newDepth = (direction === "z") ? overlap : topLayer.depth;

  // Изменяем размеры в Three.js
  topLayer.threejs.scale[direction] = overlap / size;
  topLayer.threejs.position[direction] -= delta / 2;

  // Изменяем в Cannon.js
  topLayer.cannonjs.position[direction] -= delta / 2;
  const shape = new CANNON.Box(
    new CANNON.Vec3(newWidth / 2, boxHeight2 / 2, newDepth / 2)
  );
  topLayer.cannonjs.shapes = [];
  topLayer.cannonjs.addShape(shape);

  // Обновляем «метаданные» 
  topLayer.width = newWidth;
  topLayer.depth = newDepth;
}

///////////////////////////////////////////////
// Генерация коробки (блока) и добавление в сцену/физику
///////////////////////////////////////////////
function generateBox2(x, y, z, width, depth, falls, direction) {
  const geometry = new THREE.BoxGeometry(width, boxHeight2, depth);
  const color = new THREE.Color(`hsl(${30 + stack2.length * 4}, 100%, 50%)`);
  const material = new THREE.MeshLambertMaterial({ color: color });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  scene2.add(mesh);

  const shape = new CANNON.Box(
    new CANNON.Vec3(width / 2, boxHeight2 / 2, depth / 2)
  );
  let mass = falls ? 5 : 0; // падающий кусок или стационарный
  // Массу делаем пропорционально размеру
  mass *= width / originalBoxSize2;
  mass *= depth / originalBoxSize2;
  const body = new CANNON.Body({ mass: mass, shape: shape });
  body.position.set(x, y, z);
  world2.addBody(body);

  return {
    threejs: mesh,
    cannonjs: body,
    width: width,
    depth: depth,
    direction: direction
  };
}

function addLayer2(x, z, width, depth, direction) {
  const y = boxHeight2 * stack2.length;
  const layer = generateBox2(x, y, z, width, depth, false, direction);
  stack2.push(layer);
}

function addOverhang2(x, z, width, depth) {
  const y = boxHeight2 * (stack2.length - 1);
  const overhang = generateBox2(x, y, z, width, depth, true, null);
  overhangs2.push(overhang);
}

///////////////////////////////////////////////
// «Точность» автопилота
///////////////////////////////////////////////
function setRobotPrecision2() {
  robotPrecision2 = Math.random() * 1 - 0.5;
}

///////////////////////////////////////////////
// Экспортируем нужные функции в глобальную область
///////////////////////////////////////////////
window.initGame2 = initGame2;
window.resetGame2 = resetGame2;
