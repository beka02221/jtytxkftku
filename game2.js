(function () {
  // Глобальные переменные
  let scene, camera, renderer;
  let baseBlock, currentBlock;
  let blocks = [];
  let gameRunning = false;
  let currentAxis = 'x'; // начальное направление движения – по оси X
  let moveSpeed = 0.2; // скорость движения текущего блока
  let score = 0;

  // Звуковые эффекты и музыка (файлы должны находиться в той же папке или по указанному пути)
  let perfectSound = new Audio("perfect.mp3");
  let dropSound = new Audio("drop.mp3");
  let gameOverSound = new Audio("gameover.mp3");
  let bgMusic = new Audio("background.mp3");
  bgMusic.loop = true;
  bgMusic.volume = 0.3;

  // Инициализация 3D-сцены
  function initScene() {
    // Создаём сцену и задаём цвет фона
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x202020);

    // Создаём перспективную камеру
    const canvas = document.getElementById("match3Canvas");
    camera = new THREE.PerspectiveCamera(
      45,
      canvas.clientWidth / canvas.clientHeight,
      1,
      1000
    );
    camera.position.set(0, 15, 25);
    camera.lookAt(0, 0, 0);

    // Создаём рендерер и включаем тени
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    renderer.shadowMap.enabled = true;

    // Добавляем базовое освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    scene.add(directionalLight);
  }

  // Функция для создания блока с заданными параметрами
  function createBlock(width, depth, height, position, color = 0x00ff00) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      metalness: 0.3,
      roughness: 0.4,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position);
    return mesh;
  }

  // Запуск игры
  function initGame2() {
    initScene();
    score = 0;
    blocks = [];
    gameRunning = true;
    currentAxis = 'x';

    // Воспроизводим фоновую музыку
    bgMusic.currentTime = 0;
    bgMusic.play();

    // Создаём базовый блок – опору для башни
    // Размер базового блока: 10x10, высота 1, позиция по Y = 0.5
    baseBlock = createBlock(10, 10, 1, new THREE.Vector3(0, 0.5, 0), 0x00ff00);
    scene.add(baseBlock);
    blocks.push(baseBlock);

    // Создаём первый движущийся блок
    spawnBlock();

    // Запускаем игровой цикл
    animate();
  }

  // Создание нового движущегося блока
  function spawnBlock() {
    const lastBlock = blocks[blocks.length - 1];
    // Размеры нового блока совпадают с размерами предыдущего (начально)
    const width = lastBlock.geometry.parameters.width;
    const depth = lastBlock.geometry.parameters.depth;
    const height = 1;
    const newY = lastBlock.position.y + height;
    let position = new THREE.Vector3(0, newY, 0);
    if (currentAxis === "x") {
      // Движение по оси X – стартовая позиция слева
      position.x = -15;
    } else {
      // Движение по оси Z – стартовая позиция спереди
      position.z = -15;
    }
    currentBlock = createBlock(width, depth, height, position, 0xff0000);
    scene.add(currentBlock);
  }

  // Игровой цикл
  function animate() {
    if (!gameRunning) return;
    requestAnimationFrame(animate);

    // Обновление позиции движущегося блока
    if (currentBlock) {
      if (currentAxis === "x") {
        currentBlock.position.x += moveSpeed;
        if (currentBlock.position.x > 15 || currentBlock.position.x < -15) {
          moveSpeed = -moveSpeed;
        }
      } else {
        currentBlock.position.z += moveSpeed;
        if (currentBlock.position.z > 15 || currentBlock.position.z < -15) {
          moveSpeed = -moveSpeed;
        }
      }
    }

    // Камера следует за башней: плавное поднятие по оси Y
    const topY = blocks[blocks.length - 1].position.y;
    if (topY + 5 > camera.position.y) {
      camera.position.y += 0.2;
    }

    renderer.render(scene, camera);
  }

  // Обработка клика/нажатия (фиксируем блок)
  function onUserInput() {
    if (!gameRunning || !currentBlock) return;

    // Останавливаем движение и вычисляем пересечение с предыдущим блоком
    const lastBlock = blocks[blocks.length - 1];

    if (currentAxis === "x") {
      const delta = currentBlock.position.x - lastBlock.position.x;
      const overlapWidth = lastBlock.geometry.parameters.width - Math.abs(delta);
      if (overlapWidth <= 0) {
        // Полное промахивание – игра окончена
        endGame();
        return;
      }
      // Расчёт нового центра для текущего блока (среднее между смещением)
      const newX = lastBlock.position.x + delta / 2;
      currentBlock.position.x = newX;
      // Изменяем геометрию текущего блока: новая ширина равна области пересечения
      currentBlock.geometry.dispose();
      currentBlock.geometry = new THREE.BoxGeometry(
        overlapWidth,
        1,
        lastBlock.geometry.parameters.depth
      );
      // Если есть выступ (лишняя часть), создаём объект для него и анимируем его падение
      const extraWidth = Math.abs(delta);
      if (extraWidth > 0) {
        const extraGeometry = new THREE.BoxGeometry(
          extraWidth,
          1,
          lastBlock.geometry.parameters.depth
        );
        const extraMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const extraBlock = new THREE.Mesh(extraGeometry, extraMaterial);
        extraBlock.castShadow = true;
        extraBlock.receiveShadow = true;
        let extraX;
        if (delta > 0) {
          extraX =
            currentBlock.position.x +
            (overlapWidth / 2) +
            (extraWidth / 2);
        } else {
          extraX =
            currentBlock.position.x -
            (overlapWidth / 2) -
            (extraWidth / 2);
        }
        extraBlock.position.set(extraX, currentBlock.position.y, currentBlock.position.z);
        scene.add(extraBlock);
        animateFall(extraBlock);
        dropSound.currentTime = 0;
        dropSound.play();
      } else {
        perfectSound.currentTime = 0;
        perfectSound.play();
      }
    } else {
      // Если движение по оси Z
      const delta = currentBlock.position.z - lastBlock.position.z;
      const overlapDepth = lastBlock.geometry.parameters.depth - Math.abs(delta);
      if (overlapDepth <= 0) {
        endGame();
        return;
      }
      const newZ = lastBlock.position.z + delta / 2;
      currentBlock.position.z = newZ;
      currentBlock.geometry.dispose();
      currentBlock.geometry = new THREE.BoxGeometry(
        lastBlock.geometry.parameters.width,
        1,
        overlapDepth
      );
      const extraDepth = Math.abs(delta);
      if (extraDepth > 0) {
        const extraGeometry = new THREE.BoxGeometry(
          lastBlock.geometry.parameters.width,
          1,
          extraDepth
        );
        const extraMaterial = new THREE.MeshStandardMaterial({ color: 0xff0000 });
        const extraBlock = new THREE.Mesh(extraGeometry, extraMaterial);
        extraBlock.castShadow = true;
        extraBlock.receiveShadow = true;
        let extraZ;
        if (delta > 0) {
          extraZ =
            currentBlock.position.z +
            (overlapDepth / 2) +
            (extraDepth / 2);
        } else {
          extraZ =
            currentBlock.position.z -
            (overlapDepth / 2) -
            (extraDepth / 2);
        }
        extraBlock.position.set(currentBlock.position.x, currentBlock.position.y, extraZ);
        scene.add(extraBlock);
        animateFall(extraBlock);
        dropSound.currentTime = 0;
        dropSound.play();
      } else {
        perfectSound.currentTime = 0;
        perfectSound.play();
      }
    }

    // Добавляем текущий блок в массив и увеличиваем счёт (за каждую удачную башенку +5)
    blocks.push(currentBlock);
    score += 5;

    // Чередуем направление движения следующего блока
    currentAxis = currentAxis === "x" ? "z" : "x";

    // Создаём следующий движущийся блок
    spawnBlock();
  }

  // Анимация падения отрезанной части (простейшая симуляция гравитации)
  function animateFall(block) {
    const fallSpeed = 0.2;
    function fall() {
      block.position.y -= fallSpeed;
      if (block.position.y > -10) {
        requestAnimationFrame(fall);
      } else {
        scene.remove(block);
      }
    }
    fall();
  }

  // Обработка завершения игры
  function endGame() {
    gameRunning = false;
    gameOverSound.currentTime = 0;
    gameOverSound.play();
    bgMusic.pause();
    // Если на странице определена глобальная функция показа модального окна, вызываем её
    if (window.showEndGameModal) {
      window.showEndGameModal("Game Over", "Your score: " + score);
    }
  }

  // Сброс игры (для перезапуска)
  function resetGame2() {
    gameRunning = false;
    window.removeEventListener("click", onUserInput);
    window.removeEventListener("keydown", handleKeyDown);
    if (renderer) {
      renderer.dispose();
    }
    // Дополнительный сброс можно добавить по необходимости
  }

  // Обработчик нажатия клавиши – фиксируем блок по нажатию пробела
  function handleKeyDown(event) {
    if (event.code === "Space") {
      onUserInput();
    }
  }

  // Добавляем слушатели событий
  window.addEventListener("click", onUserInput);
  window.addEventListener("keydown", handleKeyDown);

  // Глобально доступны функции инициализации и сброса игры
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
