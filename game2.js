(function () {
  // ==============================
  // Глобальные переменные игры
  // ==============================
  let scene, camera, renderer;
  let stack = [];       // Список уже установленных (зафиксированных) блоков
  let overhangs = [];   // Список «обрезков», которые отваливаются вниз
  let currentBlock;     // Текущий движущийся блок
  let lastTime = 0;     // Для дельты времени в анимации
  let speed = 0.006;    // Скорость движения блока
  let direction = "x";  // Направление движения следующего блока: 'x' или 'z'
  let game2AnimationFrameId = null;
  let isGame2Running = false;
  let score2 = 0;

  // Звуки (поменяйте src на свои реальные файлы)
  const placeSound = new Audio("https://actions.google.com/sounds/v1/cartoon/wood_plank_flicks.ogg");
  const missSound = new Audio("https://actions.google.com/sounds/v1/cartoon/bubble_pop.ogg");

  // ==============================
  // Функция инициализации игры
  // ==============================
  function initGame2() {
    // Если уже запущена, не инициализируем повторно
    if (isGame2Running) return;
    isGame2Running = true;
    score2 = 0;

    // Получаем canvas, на котором будет WebGL
    const canvas = document.getElementById("match3Canvas");

    // Создаём сцену
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Устанавливаем камеру (perspective)
    const aspect = canvas.width / canvas.height;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0, 0);

    // Создаём WebGLRenderer
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);

    // Добавим немного света
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Обнулим массивы
    stack = [];
    overhangs = [];

    // Создаём первый (базовый) блок
    // Параметры: ширина=3, глубина=3, начальные x=0, z=0, высота (y=0).
    const baseBlock = generateBlock(0, 0, 3, 3, 0, false);
    stack.push(baseBlock);

    // Генерируем новый (первый движущийся) блок сверху
    addNewBlock();

    // Подключим обработчик клика (или косания) - нажатие останавливает блок
    window.addEventListener("mousedown", onAction);
    window.addEventListener("touchstart", onAction);
    window.addEventListener("keydown", onKeyDown);

    // Запускаем цикл анимации
    lastTime = performance.now();
    animateStack();
  }

  // ==============================
  // Функция сброса/завершения игры
  // ==============================
  function resetGame2() {
    if (!isGame2Running) return;
    isGame2Running = false;

    // Останавливаем анимацию
    cancelAnimationFrame(game2AnimationFrameId);

    // Отписываемся от событий
    window.removeEventListener("mousedown", onAction);
    window.removeEventListener("touchstart", onAction);
    window.removeEventListener("keydown", onKeyDown);

    // Очищаем сцену
    if (scene) {
      while (scene.children.length > 0) {
        const child = scene.children[0];
        scene.remove(child);
      }
    }
    scene = null;
    camera = null;

    // renderer — можно принудительно освобождать ресурсы
    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss && renderer.forceContextLoss();
    }
    renderer = null;

    // Сбрасываем массивы
    stack = [];
    overhangs = [];
  }

  // ==============================
  // Основной цикл анимации
  // ==============================
  function animateStack(time) {
    // Вычисляем дельту
    const delta = time - lastTime;
    lastTime = time;

    // Двигаем текущий блок
    if (currentBlock) {
      if (direction === "x") {
        currentBlock.position.x += speed * delta;
      } else {
        currentBlock.position.z += speed * delta;
      }
    }

    // Плавно поднимаем камеру, чтобы башня всегда была видна
    updateCamera();

    // Рендер
    if (renderer && scene && camera) {
      renderer.render(scene, camera);
    }

    if (isGame2Running) {
      game2AnimationFrameId = requestAnimationFrame(animateStack);
    }
  }

  // ==============================
  // Добавление нового блока
  // ==============================
  function addNewBlock() {
    const topBlock = stack[stack.length - 1];
    const size = { width: topBlock.userData.width, depth: topBlock.userData.depth };

    // Если предыдущий блок двигался вдоль оси X,
    // новый будет двигаться вдоль оси Z, и наоборот.
    direction = direction === "x" ? "z" : "x";

    let x, z;
    let y = stack.length; // Высота нового блока = количество блоков в стеке
    if (direction === "x") {
      // Новый блок будет двигаться по оси X, значит изначальный Z как у предыдущего
      x = -6; // далеко слева (чтобы въехать в кадр)
      z = topBlock.position.z;
    } else {
      // Двигаемся по оси Z
      x = topBlock.position.x;
      z = -6;
    }
    const block = generateBlock(x, z, size.width, size.depth, y, true);
    currentBlock = block;
  }

  // ==============================
  // Генерация 3D-мешей блоков
  // ==============================
  function generateBlock(x, z, width, depth, y, isMovable) {
    const geometry = new THREE.BoxGeometry(width, 0.5, depth);
    // Материал с лёгким отражением
    const material = new THREE.MeshStandardMaterial({
      color: getRandomColor(),
      metalness: 0.2,
      roughness: 0.6,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y * 0.5, z); // высота каждого блока 0.5
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    // Сохраняем данные о реальных «размерах» блока, чтобы не зависеть от scale
    mesh.userData = { width, depth, isMovable };

    scene.add(mesh);
    return mesh;
  }

  // ==============================
  // Обработчик установки блока
  // ==============================
  function onAction() {
    if (!currentBlock || !isGame2Running) return;

    // Берём предыдущий блок в стеке (верхний)
    const topBlock = stack[stack.length - 1];
    // Пытаемся обрезать текущий
    const overlap = getOverlap(currentBlock, topBlock, direction);

    // Если пересечения нет — игра закончена
    if (overlap <= 0) {
      // Звук неудачи
      missSound.play();
      endGame();
      return;
    }

    // Иначе обрезаем текущий блок до пересечения
    const { newWidth, newDepth, leftoverWidth, leftoverDepth } = calculateNewDimensions(
      currentBlock,
      topBlock,
      direction
    );

    // Обновляем геометрию «основного» (оставшегося) куска
    updateBlockGeometry(currentBlock, newWidth, newDepth);

    // Создаём отлетающий обрезок
    if (leftoverWidth > 0 || leftoverDepth > 0) {
      createOverhang(currentBlock, leftoverWidth, leftoverDepth, direction);
    }

    // Подавляем движение текущего блока, превращаем его в «зафиксированный»
    currentBlock.userData.isMovable = false;

    // Добавляем в массив stack
    stack.push(currentBlock);

    // Звук удачной установки
    placeSound.currentTime = 0;
    placeSound.play();

    // Начисляем очки
    score2 += 5;
    localUserData.points += 5;
    if (typeof userRef !== "undefined" && userRef) {
      userRef.update({ points: localUserData.points });
    }

    // Создаём новый блок
    addNewBlock();
  }

  // ==============================
  // Вычисление пересечения блоков
  // ==============================
  function getOverlap(movingBlock, fixedBlock, dir) {
    let overlap = 0;
    if (dir === "x") {
      const movingLeft = movingBlock.position.x - movingBlock.userData.width / 2;
      const movingRight = movingBlock.position.x + movingBlock.userData.width / 2;
      const fixedLeft = fixedBlock.position.x - fixedBlock.userData.width / 2;
      const fixedRight = fixedBlock.position.x + fixedBlock.userData.width / 2;
      const left = Math.max(movingLeft, fixedLeft);
      const right = Math.min(movingRight, fixedRight);
      overlap = right - left;
    } else {
      const movingFront = movingBlock.position.z - movingBlock.userData.depth / 2;
      const movingBack = movingBlock.position.z + movingBlock.userData.depth / 2;
      const fixedFront = fixedBlock.position.z - fixedBlock.userData.depth / 2;
      const fixedBack = fixedBlock.position.z + fixedBlock.userData.depth / 2;
      const front = Math.max(movingFront, fixedFront);
      const back = Math.min(movingBack, fixedBack);
      overlap = back - front;
    }
    return overlap;
  }

  // ==============================
  // Новые размеры блоков после обрезки
  // ==============================
  function calculateNewDimensions(movingBlock, fixedBlock, dir) {
    let newWidth = movingBlock.userData.width;
    let newDepth = movingBlock.userData.depth;
    let leftoverWidth = 0;
    let leftoverDepth = 0;

    if (dir === "x") {
      const overlap = getOverlap(movingBlock, fixedBlock, "x");
      leftoverWidth = newWidth - overlap;
      newWidth = overlap;
    } else {
      const overlap = getOverlap(movingBlock, fixedBlock, "z");
      leftoverDepth = newDepth - overlap;
      newDepth = overlap;
    }

    return { newWidth, newDepth, leftoverWidth, leftoverDepth };
  }

  // ==============================
  // Обновление геометрии блока
  // ==============================
  function updateBlockGeometry(block, width, depth) {
    const oldGeometry = block.geometry;
    oldGeometry.dispose(); // Удаляем старую
    block.geometry = new THREE.BoxGeometry(width, 0.5, depth);

    // Сдвиг блока, чтобы он «лег» ровно на пересечение
    if (direction === "x") {
      // Определяем, как далеко блок уже «заехал»
      const fixedLeft = stack[stack.length - 1].position.x - stack[stack.length - 1].userData.width / 2;
      let blockLeft = block.position.x - (block.userData.width / 2);
      const overlapLeft = Math.max(blockLeft, fixedLeft);

      // Новая левая граница
      blockLeft = overlapLeft;
      // Новая ширина = width
      const blockCenter = blockLeft + width / 2;
      block.position.x = blockCenter;
    } else {
      const fixedFront = stack[stack.length - 1].position.z - stack[stack.length - 1].userData.depth / 2;
      let blockFront = block.position.z - (block.userData.depth / 2);
      const overlapFront = Math.max(blockFront, fixedFront);

      blockFront = overlapFront;
      const blockCenter = blockFront + depth / 2;
      block.position.z = blockCenter;
    }

    // Обновим userData
    block.userData.width = width;
    block.userData.depth = depth;
  }

  // ==============================
  // Создание отлетающего «обрезка»
  // ==============================
  function createOverhang(sourceBlock, leftoverW, leftoverD, dir) {
    const pos = new THREE.Vector3().copy(sourceBlock.position);
    const width = sourceBlock.userData.width;
    const depth = sourceBlock.userData.depth;

    // Координаты обрезка зависят от направления
    if (dir === "x") {
      // leftoverW — «толщина» обрезка
      const sign = (sourceBlock.position.x > stack[stack.length - 1].position.x) ? 1 : -1;
      pos.x = pos.x + sign * (width / 2 + leftoverW / 2);
    } else {
      const sign = (sourceBlock.position.z > stack[stack.length - 1].position.z) ? 1 : -1;
      pos.z = pos.z + sign * (depth / 2 + leftoverD / 2);
    }

    // Геометрия для обрезка
    const geometry = new THREE.BoxGeometry(leftoverW || 0.001, 0.5, leftoverD || 0.001);
    const material = sourceBlock.material.clone();
    const overhang = new THREE.Mesh(geometry, material);
    overhang.position.copy(pos);

    scene.add(overhang);
    overhangs.push(overhang);

    // Анимируем падение (простейшая ручная анимация)
    fallDown(overhang);
  }

  // ==============================
  // Простая анимация «падения»
  // ==============================
  function fallDown(mesh) {
    // Запомним стартовое время
    const start = performance.now();
    const startY = mesh.position.y;
    const fallDuration = 2000; // мс
    const rotateSpeed = (Math.random() - 0.5) * 0.002; // случайное вращение

    function animateFall(time) {
      const elapsed = time - start;
      const t = elapsed / fallDuration;
      if (t >= 1) {
        // Упал
        scene.remove(mesh);
        return;
      }
      // линейное падение
      mesh.position.y = startY - t * 5; // чем больше число, тем быстрее падает
      mesh.rotation.x += rotateSpeed * (elapsed / 16);
      mesh.rotation.z += rotateSpeed * (elapsed / 16);

      requestAnimationFrame(animateFall);
    }
    requestAnimationFrame(animateFall);
  }

  // ==============================
  // Завершение игры
  // ==============================
  function endGame() {
    if (!isGame2Running) return;
    isGame2Running = false;

    cancelAnimationFrame(game2AnimationFrameId);

    // Показываем ваш итоговый модал
    showEndGameModal("Game Over", "Your score: " + score2);

    // Обновим очки в БД
    if (typeof userRef !== "undefined" && userRef) {
      userRef.update({ points: localUserData.points });
    }
  }

  // ==============================
  // Слушатель клавиш (например, пробел)
  // ==============================
  function onKeyDown(e) {
    if (e.code === "Space" || e.code === "Enter") {
      onAction();
    }
  }

  // ==============================
  // Плавное обновление камеры
  // ==============================
  function updateCamera() {
    const topY = stack.length * 0.5; // каждая «плита» высотой 0.5
    // Небольшое смещение вверх
    camera.position.y += (topY + 3 - camera.position.y) * 0.02;
  }

  // ==============================
  // Случайный цвет блока
  // ==============================
  function getRandomColor() {
    const colors = [
      0xff5555, 0xff9955, 0xffee55, 0x99ff55,
      0x55ff99, 0x55ffee, 0x5599ff, 0x9955ff,
      0xff55ee
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  // ==============================
  // Экспорт функций в window
  // ==============================
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
