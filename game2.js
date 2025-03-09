(function () {
  // -----------------------------
  // Переменные и базовая настройка
  // -----------------------------
  let scene, camera, renderer;
  let stack = [];          // массив установленных блоков
  let overhangs = [];      // массив «срезанных» частей (в будущем можно будет их красиво анимировать)
  let lastBlock;           // последний установленный блок (для проверки пересечения)
  let currentBlock;        // текущий (движущийся) блок
  let game2Running = false;
  let animationId = null;

  // Параметры камеры
  const CAMERA_POSITION_START = 4; // высота камеры над основанием
  let cameraHeight = CAMERA_POSITION_START;

  // Начальные размеры (ширина и глубина) основания
  const INITIAL_SIZE = { width: 3, depth: 3 };

  // Скорость движения блока вдоль оси
  let moveSpeed = 0.02; 
  // Направление движения по оси (x или z)
  let moveDirection = "x"; 
  // Текущий коэффициент высоты (номер уровня)
  let currentLevel = 0; 

  // Очки за успешный блок
  const POINTS_PER_BLOCK = 5;

  // Флаги управления
  let isUserInteracting = false;

  // ----------------------------------------------
  // Функция инициализации (вызывается из index.html)
  // ----------------------------------------------
  function initGame2() {
    // Создаём рендерер на canvas (например, тот, что в верстке называется match3Canvas)
    const canvas = document.getElementById("match3Canvas");
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.setPixelRatio(window.devicePixelRatio || 1);

    // Создаём сцену
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000); // чёрный фон (можно поменять на свой вкус)

    // Создаём камеру с перспективой
    const aspect = canvas.width / canvas.height;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);
    camera.position.set(0, cameraHeight, 6);
    camera.lookAt(0, cameraHeight - 2, 0);

    // Свет (простейший вариант)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    scene.add(dirLight);

    // Сбрасываем переменные перед началом новой игры
    stack = [];
    overhangs = [];
    currentLevel = 0;
    cameraHeight = CAMERA_POSITION_START;
    game2Running = true;

    // Создаём первый (базовый) блок в основании
    const baseBlock = generateBlock(
      0, // x
      0, // y (по сути уровень 0)
      0, // z
      INITIAL_SIZE.width,
      INITIAL_SIZE.depth
    );
    scene.add(baseBlock);
    stack.push({ mesh: baseBlock, width: INITIAL_SIZE.width, depth: INITIAL_SIZE.depth, position: { x: 0, z: 0 } });
    lastBlock = stack[0];

    // Генерируем «движущийся» блок сверху
    addNewMovingBlock();

    // Подключаем обработчик нажатий клавиш
    document.addEventListener("keydown", onKeyDown);

    // Запускаем игровой цикл
    animate();
  }

  // ----------------------------------------------
  // Генерация блока (возвращает THREE.Mesh)
  // ----------------------------------------------
  function generateBlock(x, y, z, width, depth, color = 0x00ff00) {
    const geometry = new THREE.BoxGeometry(width, 0.5, depth);
    // Material (простенький MeshLambertMaterial; позже можно заменить на MeshStandardMaterial)
    const material = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    return mesh;
  }

  // ----------------------------------------------
  // Функция для добавления нового движущегося блока
  // ----------------------------------------------
  function addNewMovingBlock() {
    currentLevel++;
    moveDirection = moveDirection === "x" ? "z" : "x"; // чередуем ось движения

    // Координаты спауна: берём позицию последнего блока, но чуть выше
    const y = currentLevel * 0.5; // толщина блока — 0.5, поэтому уровень = 0.5 * номер
    let x = lastBlock.position.x;
    let z = lastBlock.position.z;

    // Ставим блок либо по X, либо по Z, с небольшим смещением, чтобы он "въезжал"
    if (moveDirection === "x") {
      x = -6; // пусть движется слева направо
      z = lastBlock.position.z;
    } else {
      x = lastBlock.position.x;
      z = 6; // движется с "глубины" к нам
    }

    // создаём сам меш
    const newBlockMesh = generateBlock(
      x,
      y,
      // z
      z,
      lastBlock.width, // у нового блока пока те же размеры, что и у предыдущего
      lastBlock.depth,
      0x00ff00
    );

    scene.add(newBlockMesh);

    currentBlock = {
      mesh: newBlockMesh,
      width: lastBlock.width,
      depth: lastBlock.depth,
      position: { x: x, z: z },
      direction: moveDirection
    };
  }

  // ----------------------------------------------
  // Обработка «установки» блока (когда игрок нажал пробел)
  // ----------------------------------------------
  function placeBlock() {
    // Проверяем, есть ли пересечение у currentBlock и lastBlock
    const overlap = measureOverlap(currentBlock, lastBlock);

    if (!overlap) {
      // Если совсем нет пересечения – игра заканчивается
      endGame2();
      return;
    }

    // У текущего блока уменьшаются width/depth до overlap
    // и мы пересчитываем позицию, чтобы ровно совмещалось
    if (currentBlock.direction === "x") {
      const deltaX = currentBlock.position.x - lastBlock.position.x;
      currentBlock.width = overlap;
      // Центрируем блок
      currentBlock.position.x = lastBlock.position.x + deltaX / 2;
    } else {
      const deltaZ = currentBlock.position.z - lastBlock.position.z;
      currentBlock.depth = overlap;
      // Центрируем блок
      currentBlock.position.z = lastBlock.position.z + deltaZ / 2;
    }

    // Обновляем меш текущего блока согласно новым размерам и позиции
    currentBlock.mesh.scale.x = currentBlock.width / currentBlock.mesh.geometry.parameters.width;
    currentBlock.mesh.scale.z = currentBlock.depth / currentBlock.mesh.geometry.parameters.depth;

    // Обновляем координаты меша
    currentBlock.mesh.position.x = currentBlock.position.x;
    currentBlock.mesh.position.z = currentBlock.position.z;

    // Добавляем игроку очки (5 очков за каждый блок)
    if (typeof localUserData !== "undefined") {
      localUserData.points += POINTS_PER_BLOCK;
      if (typeof userRef !== "undefined" && userRef) {
        userRef.update({ points: localUserData.points });
      }
    }

    // Текущий блок становится «последним»
    lastBlock = {
      mesh: currentBlock.mesh,
      width: currentBlock.width,
      depth: currentBlock.depth,
      position: { x: currentBlock.position.x, z: currentBlock.position.z }
    };

    // Добавляем следующий блок
    addNewMovingBlock();

    // Двигаем камеру чуть выше, чтобы башня оставалась в поле зрения
    cameraHeight += 0.5; // поднимаем на высоту одного блока
  }

  // ----------------------------------------------
  // Определяем пересечение текущего блока с предыдущим
  // Возвращает «длину пересечения» (по соответствующей оси) или 0, если пересечения нет
  // ----------------------------------------------
  function measureOverlap(blockA, blockB) {
    // если движение по X, считаем перекрытие по X
    if (blockA.direction === "x") {
      const sizeA = blockA.width;
      const sizeB = blockB.width;
      const posA = blockA.position.x;
      const posB = blockB.position.x;
      const leftA = posA - sizeA / 2;
      const rightA = posA + sizeA / 2;
      const leftB = posB - sizeB / 2;
      const rightB = posB + sizeB / 2;

      const overlap = Math.min(rightA, rightB) - Math.max(leftA, leftB);
      return overlap > 0 ? overlap : 0;
    } else {
      // движение по Z, считаем перекрытие по Z
      const sizeA = blockA.depth;
      const sizeB = blockB.depth;
      const posA = blockA.position.z;
      const posB = blockB.position.z;
      const leftA = posA - sizeA / 2;
      const rightA = posA + sizeA / 2;
      const leftB = posB - sizeB / 2;
      const rightB = posB + sizeB / 2;

      const overlap = Math.min(rightA, rightB) - Math.max(leftA, leftB);
      return overlap > 0 ? overlap : 0;
    }
  }

  // ----------------------------------------------
  // Игровой цикл (requestAnimationFrame)
  // ----------------------------------------------
  function animate() {
    if (!game2Running) return;

    // Двигаем текущий блок вдоль выбранной оси
    if (currentBlock) {
      if (currentBlock.direction === "x") {
        currentBlock.position.x += moveSpeed;
        currentBlock.mesh.position.x = currentBlock.position.x;
        // если блок улетел далеко, меняем направление (чтобы бегал взад-вперёд).
        if (currentBlock.position.x > 6) {
          moveSpeed = -moveSpeed;
        } else if (currentBlock.position.x < -6) {
          moveSpeed = -moveSpeed;
        }
      } else {
        currentBlock.position.z -= moveSpeed;
        currentBlock.mesh.position.z = currentBlock.position.z;
        if (currentBlock.position.z < -6) {
          moveSpeed = -moveSpeed;
        } else if (currentBlock.position.z > 6) {
          moveSpeed = -moveSpeed;
        }
      }
    }

    // Плавно двигаем камеру
    camera.position.y += (cameraHeight - camera.position.y) * 0.02;
    camera.lookAt(0, camera.position.y - 2, 0);

    renderer.render(scene, camera);
    animationId = requestAnimationFrame(animate);
  }

  // ----------------------------------------------
  // Обработка нажатий клавиш
  // ----------------------------------------------
  function onKeyDown(e) {
    if (!game2Running) return;
    if (e.code === "Space" || e.code === "Enter") {
      // Ставим блок
      placeBlock();
    } else if (e.code === "ArrowDown") {
      // Ускорим движение (для примера)
      moveSpeed = 0.05;
    }
  }

  // ----------------------------------------------
  // Завершение игры
  // ----------------------------------------------
  function endGame2() {
    game2Running = false;
    cancelAnimationFrame(animationId);
    // Показываем итоговое окно (как в тетрисе — showEndGameModal)
    if (typeof showEndGameModal === "function") {
      showEndGameModal("Game Over!", `Ваш результат: ${localUserData.points} очков`);
    }
  }

  // ----------------------------------------------
  // Сброс игры (вызывается при закрытии модального окна)
  // ----------------------------------------------
  function resetGame2() {
    game2Running = false;
    cancelAnimationFrame(animationId);

    // Удаляем обработчики
    document.removeEventListener("keydown", onKeyDown);

    // Чистим сцену
    if (scene) {
      while (scene.children.length > 0) {
        const obj = scene.children[0];
        scene.remove(obj);
      }
    }

    // Обнуляем ссылки
    stack = [];
    overhangs = [];
    lastBlock = null;
    currentBlock = null;

    if (renderer) {
      renderer.dispose();
      renderer.forceContextLoss();
      // renderer.domElement = null; // при необходимости
    }
    renderer = null;
    camera = null;
    scene = null;
  }

  // Делаем функции видимыми снаружи
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
