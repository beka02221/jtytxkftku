(function () {
  // === Глобальные переменные модуля "Stack" ===
  let scene, camera, renderer, world;
  let lastTime = 0;
  let stack = [];    // Все «хорошо» уложенные блоки
  let overhangs = []; // Выступающие части, падающие вниз
  let boxHeight = 1;  // Высота каждого блока
  let originalBoxSize = 3; // Исходный размер основания блока
  let game2Running = false; 
  let game2AnimationFrameId = null;
  
  // Счёт внутри этой мини-игры
  let score2 = 0;

  // Звуковые эффекты (подставьте свои mp3/ogg)
  const placeSound = new Audio(); // placeSound.src = "place.mp3";
  const errorSound = new Audio(); // errorSound.src = "error.mp3";

  // === Основные функции игры ===

  /**
   * Инициализация и запуск игры "Stack" (Game2)
   */
  function initGame2() {
    if (game2Running) return; // Чтобы не запускать повторно
    game2Running = true;
    score2 = 0;

    // Получаем canvas (match3Canvas), где будем рисовать 3D
    const canvas = document.getElementById("match3Canvas");
    if (!canvas) {
      console.error("Не найден canvas с id=match3Canvas");
      return;
    }

    // Очищаем сцену (на случай повторных запусков)
    resetGame2(true); 

    // Создаём мир Cannon.js
    world = new CANNON.World();
    world.gravity.set(0, -10, 0); 
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 40;

    // Создаём сцену Three.js
    scene = new THREE.Scene();

    // Настраиваем камеру (ортографическая для стабильного вида)
    // Можно использовать и перспективную, если хотите
    const aspect = canvas.width / canvas.height;
    const viewSize = 10; // "ширина" проекции
    camera = new THREE.OrthographicCamera(
      -viewSize * aspect / 2, // left
      viewSize * aspect / 2,  // right
      viewSize / 2,           // top
      -viewSize / 2,          // bottom
      0.1,                    // near
      100                     // far
    );
    camera.position.set(4, 4, 4);
    camera.lookAt(0, 0, 0);

    // Рендерер
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true
    });
    renderer.setSize(canvas.width, canvas.height);

    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 0);
    scene.add(dirLight);

    // Создаём "основание" (неподвижный) блок
    addLayer(0, 0, originalBoxSize, originalBoxSize);

    // Первый движущийся блок
    // Он выезжает слева (по оси X)
    addLayer(-10, 0, originalBoxSize, originalBoxSize, "x");

    // Обработчики событий: клик / нажатие / тач → фиксируем текущий блок
    window.addEventListener("mousedown", placeBlockHandler);
    window.addEventListener("touchstart", placeBlockHandler);
    window.addEventListener("keydown", keyDownHandler);

    lastTime = 0;
    // Запускаем цикл анимации
    game2AnimationFrameId = requestAnimationFrame(game2Loop);
  }

  /**
   * Сброс игры (останавливаем, очищаем сцену и удаляем слушатели)
   * @param {boolean} hardReset - если true, значит полностью обнуляем данные (для init)
   */
  function resetGame2(hardReset = false) {
    // Останавливаем анимацию
    if (game2AnimationFrameId) {
      cancelAnimationFrame(game2AnimationFrameId);
      game2AnimationFrameId = null;
    }
    // Убираем слушатели
    window.removeEventListener("mousedown", placeBlockHandler);
    window.removeEventListener("touchstart", placeBlockHandler);
    window.removeEventListener("keydown", keyDownHandler);

    // Если нужно полностью всё сбросить
    if (hardReset) {
      game2Running = false;

      // Очищаем мир Cannon
      if (world) {
        while (world.bodies.length > 0) {
          world.remove(world.bodies[0]);
        }
      }
      // Очищаем сцену Three.js
      if (scene) {
        while (scene.children.length > 0) {
          const child = scene.children[0];
          scene.remove(child);
        }
      }
      stack = [];
      overhangs = [];
      lastTime = 0;
    }
  }

  /**
   * Основной цикл анимации (обновления) игры
   * @param {number} time - время в мс (high-res timestamp)
   */
  function game2Loop(time) {
    if (!game2Running) return; // Игра остановлена
    
    const delta = lastTime ? time - lastTime : 0;
    lastTime = time;

    // Двигаем верхний блок (если игра не завершена)
    moveTopBlock(delta);

    // Поднимаем камеру по мере роста башни
    const topY = boxHeight * (stack.length - 2) + 4;
    if (camera && camera.position.y < topY) {
      camera.position.y += 0.005 * delta; 
    }

    // Обновляем физику Cannon.js
    world.step(delta / 1000);
    // Копируем позиции и повороты из Cannon в Three
    overhangs.forEach((obj) => {
      obj.threejs.position.copy(obj.cannonjs.position);
      obj.threejs.quaternion.copy(obj.cannonjs.quaternion);
    });

    // Рендерим сцену
    renderer.render(scene, camera);

    game2AnimationFrameId = requestAnimationFrame(game2Loop);
  }

  // === ЛОГИКА СТРОИТЕЛЬСТВА БАШНИ ===

  /**
   * Добавить новый слой (блок) в "стек" (горизонтальный сдвиг).
   * @param {number} x 
   * @param {number} z 
   * @param {number} width 
   * @param {number} depth 
   * @param {"x"|"z"} direction - along which axis the block will move
   */
  function addLayer(x, z, width, depth, direction) {
    const y = boxHeight * stack.length; // высота = кол-во уже уложенных блоков
    const layer = generateBox(x, y, z, width, depth, false);
    layer.direction = direction;
    stack.push(layer);
  }

  /**
   * Добавить "свисающую" часть блока, которая падает вниз
   */
  function addOverhang(x, z, width, depth) {
    const y = boxHeight * (stack.length - 1);
    const overhang = generateBox(x, y, z, width, depth, true);
    overhangs.push(overhang);
  }

  /**
   * Генерация нового Box (как в Three.js, так и в Cannon.js)
   * @param {number} x 
   * @param {number} y 
   * @param {number} z 
   * @param {number} width 
   * @param {number} depth 
   * @param {boolean} falls - если true, то этот объект "падает" (mass>0)
   */
  function generateBox(x, y, z, width, depth, falls) {
    // Three.js часть
    const geometry = new THREE.BoxGeometry(width, boxHeight, depth);
    // Красим блок в зависимости от "этажа"
    const color = new THREE.Color(`hsl(${30 + stack.length * 6}, 100%, 50%)`);
    const material = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    scene.add(mesh);

    // Cannon.js часть
    const shape = new CANNON.Box(
      new CANNON.Vec3(width / 2, boxHeight / 2, depth / 2)
    );
    // масса = 0 (не двигается), иначе > 0 (падает)
    let mass = falls ? 5 : 0;
    mass = mass * (width / originalBoxSize) * (depth / originalBoxSize);

    const body = new CANNON.Body({ mass, shape });
    body.position.set(x, y, z);
    world.addBody(body);

    return {
      threejs: mesh,
      cannonjs: body,
      width,
      depth
    };
  }

  /**
   * Срезает "лишнюю" часть блока и обновляет размеры верхнего блока.
   * @param {*} topLayer 
   * @param {number} overlap - пересечение по ширине/глубине
   * @param {number} size - исходный размер стороны
   * @param {number} delta - насколько сдвинулся блок относительно предыдущего
   */
  function cutBox(topLayer, overlap, size, delta) {
    const direction = topLayer.direction;
    const newWidth = (direction === "x") ? overlap : topLayer.width;
    const newDepth = (direction === "z") ? overlap : topLayer.depth;

    // Обновляем ThreeJS-меш
    topLayer.threejs.scale[direction] = overlap / size;
    // Сдвигаем позицию, чтобы "обрезать" правильную сторону
    topLayer.threejs.position[direction] -= delta / 2;

    // Обновляем CannonJS
    topLayer.cannonjs.position[direction] -= delta / 2;
    topLayer.width = newWidth;
    topLayer.depth = newDepth;

    const shape = new CANNON.Box(
      new CANNON.Vec3(newWidth / 2, boxHeight / 2, newDepth / 2)
    );
    topLayer.cannonjs.shapes = [];
    topLayer.cannonjs.addShape(shape);
  }

  /**
   * Двигает верхний блок (если игра не окончена)
   */
  function moveTopBlock(delta) {
    if (!stack.length) return;
    const topLayer = stack[stack.length - 1];
    if (!topLayer.direction) return;
    
    const speed = 0.007; // скорость движения
    const moveDistance = speed * delta;
    topLayer.threejs.position[topLayer.direction] += moveDistance;
    topLayer.cannonjs.position[topLayer.direction] += moveDistance;

    // Если блок выехал слишком далеко - завершаем игру
    if (topLayer.threejs.position[topLayer.direction] > 10) {
      // Блок "мимо" — конец
      missedTheSpot();
    }
  }

  /**
   * Обработчик события «фиксируем текущий блок»
   */
  function placeBlockHandler() {
    if (!game2Running) return;
    splitBlockAndAddNext();
  }

  /**
   * Обработчик нажатий клавиатуры (пробел = поставить блок, R = рестарт)
   */
  function keyDownHandler(e) {
    if (!game2Running) return;
    if (e.key === " ") {
      e.preventDefault();
      splitBlockAndAddNext();
    } else if (e.key === "r" || e.key === "R") {
      e.preventDefault();
      // Перезапуск
      resetGame2(true);
      initGame2();
    }
  }

  /**
   * Разрезает текущий блок, добавляет отрезанную часть как "свалившуюся",
   * потом создаёт следующий блок или завершает игру.
   */
  function splitBlockAndAddNext() {
    if (stack.length < 2) return;

    const topLayer = stack[stack.length - 1];
    const previousLayer = stack[stack.length - 2];
    const direction = topLayer.direction;

    const size = (direction === "x") ? topLayer.width : topLayer.depth;
    const delta = topLayer.threejs.position[direction]
                - previousLayer.threejs.position[direction];
    const overhangSize = Math.abs(delta);
    const overlap = size - overhangSize;

    if (overlap > 0) {
      // Блок уложен (хоть и не идеально)
      cutBox(topLayer, overlap, size, delta);

      // Создаём "свисающую" часть
      const overhangShift = (overlap / 2 + overhangSize / 2) * Math.sign(delta);
      const overhangX = (direction === "x")
          ? topLayer.threejs.position.x + overhangShift
          : topLayer.threejs.position.x;
      const overhangZ = (direction === "z")
          ? topLayer.threejs.position.z + overhangShift
          : topLayer.threejs.position.z;
      const overhangWidth = (direction === "x") ? overhangSize : topLayer.width;
      const overhangDepth = (direction === "z") ? overhangSize : topLayer.depth;
      addOverhang(overhangX, overhangZ, overhangWidth, overhangDepth);

      // Добавляем очки
      score2 += 5;
      placeSound.play && placeSound.play();

      // Создаём следующий блок (новый слой)
      const nextX = (direction === "x") ? topLayer.threejs.position.x : -10;
      const nextZ = (direction === "z") ? topLayer.threejs.position.z : -10;
      const newWidth = topLayer.width;
      const newDepth = topLayer.depth;
      const nextDirection = (direction === "x") ? "z" : "x";
      addLayer(nextX, nextZ, newWidth, newDepth, nextDirection);

    } else {
      // Нет пересечения — игра окончена
      missedTheSpot();
    }
  }

  /**
   * Если блок промахнулся (нет пересечения), завершаем игру
   */
  function missedTheSpot() {
    game2Running = false;
    errorSound.play && errorSound.play();

    const topLayer = stack[stack.length - 1];
    // Превращаем верхний слой в свисающую часть и даём ему упасть
    addOverhang(
      topLayer.threejs.position.x,
      topLayer.threejs.position.z,
      topLayer.width,
      topLayer.depth
    );
    world.remove(topLayer.cannonjs);
    scene.remove(topLayer.threejs);

    // Итоговый подсчёт очков:
    // Переносим накопленные очки в localUserData.points
    localUserData.points += score2;
    if (userRef) {
      userRef.update({ points: localUserData.points });
    }

    // Вызываем ваше окно с результатами:
    // showEndGameModal(заголовок, сообщение)
    showEndGameModal("Stack Game Over", "Your score: " + score2);
  }

  // === Экспортируемые функции ===
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
