(function () {
  // =======================
  // ПАРАМЕТРЫ И ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
  // =======================
  const INITIAL_WIDTH = 3;    // начальная ширина базового блока (в условных единицах)
  const INITIAL_DEPTH = 3;    // начальная глубина базового блока
  const BLOCK_HEIGHT = 0.5;   // высота каждого блока
  let moveSpeed = 0.05;       // скорость движения текущего блока
  const GRAVITY = 9.8;        // ускорение падения для отсекаемых кусков
  const SCORE_PER_BLOCK = 5;  // очки за успешно уложенный блок

  // Звуковые эффекты
  const dropSound = new Audio('drop.mp3');
  const cutSound = new Audio('cut.mp3');
  const gameOverSound = new Audio('gameover.mp3');

  // Three.js объекты
  let scene, camera, renderer, composer, clock;
  // Игровые объекты
  let baseBlock = null;         // базовый неподвижный блок
  let currentBlock = null;      // текущий движущийся блок
  let blocks = [];              // уложенные блоки (башня)
  let fallingBlocks = [];       // отсекаемые куски, которые падают
  // Игровой цикл и состояние
  let gameRunning = false;
  let score = 0;
  let currentDirection = 'x';   // направление движения: 'x' или 'z'
  
  // =======================
  // ИНИЦИАЛИЗАЦИЯ СЦЕНЫ, КАМЕРЫ, РЕНДЕРА, ОСВЕЩЕНИЯ И ПОСТОБРАБОТКИ
  // =======================
  function initScene() {
    // Создаём сцену и задаём фон
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Создаём перспективную камеру
    const aspect = window.innerWidth / window.innerHeight;
    camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 100);
    camera.position.set(0, 5, 7);
    camera.lookAt(0, 0, 0);

    // Создаём рендерер
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    // Добавляем освещение: Ambient и Directional (для теней)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(10, 20, 0);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Постобработка: создаём composer с RenderPass и BloomPass
    composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    composer.addPass(renderPass);
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, 0.4, 0.85
    );
    composer.addPass(bloomPass);

    // Часы для deltaTime
    clock = new THREE.Clock();

    window.addEventListener('resize', onWindowResize, false);
  }

  function onWindowResize(){
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
  }

  // =======================
  // ФУНКЦИИ СОЗДАНИЯ ОБЪЕКТОВ
  // =======================
  // Создание базового блока – опоры башни
  function createBaseBlock() {
    const geometry = new THREE.BoxGeometry(INITIAL_WIDTH, BLOCK_HEIGHT, INITIAL_DEPTH);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      roughness: 0.3,
      metalness: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Располагаем базовый блок так, чтобы его нижняя грань касалась "земли" (y = 0)
    mesh.position.y = BLOCK_HEIGHT / 2;
    scene.add(mesh);
    return { mesh: mesh, width: INITIAL_WIDTH, depth: INITIAL_DEPTH };
  }

  // Создание движущегося блока, наследующего размеры последнего блока башни
  function spawnMovingBlock() {
    let last = blocks.length > 0 ? blocks[blocks.length - 1] : baseBlock;
    const width = last.width;
    const depth = last.depth;
    const geometry = new THREE.BoxGeometry(width, BLOCK_HEIGHT, depth);
    const material = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      roughness: 0.3,
      metalness: 0.6
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    // Появляется сразу над последним блоком
    let y = last.mesh.position.y + BLOCK_HEIGHT;
    mesh.position.y = y;
    // В зависимости от направления движения задаём начальное положение:
    if (currentDirection === 'x') {
      mesh.position.x = -5;
      mesh.position.z = last.mesh.position.z;
    } else { // 'z'
      mesh.position.z = -5;
      mesh.position.x = last.mesh.position.x;
    }
    scene.add(mesh);
    return { mesh: mesh, width: width, depth: depth };
  }

  // =======================
  // АНМАЦИЯ ОТСЕКАЕМЫХ КУСОК
  // =======================
  // Анимация падения отсекаемого куска с простейшей симуляцией гравитации
  function animateFallingBlock(block, delta) {
    if (!block.fallVelocity) block.fallVelocity = 0;
    block.fallVelocity += GRAVITY * delta;
    block.mesh.position.y -= block.fallVelocity * delta;
    // Добавляем небольшое вращение для эффекта динамики
    block.mesh.rotation.x += delta;
    block.mesh.rotation.z += delta;
    // Удаляем кусок, если он ушёл ниже сцены
    if (block.mesh.position.y < -10) {
      scene.remove(block.mesh);
      return false;
    }
    return true;
  }

  function updateFallingBlocks(delta) {
    fallingBlocks = fallingBlocks.filter(block => animateFallingBlock(block, delta));
  }

  // =======================
  // ОБРАБОТКА ФИКСАЦИИ БЛОКА И ВЫЧИСЛЕНИЕ ПЕРЕСЕЧЕНИЯ
  // =======================
  function dropCurrentBlock() {
    if (!gameRunning || !currentBlock) return;
    dropSound.play();

    // Останавливаем движение и вычисляем пересечение с предыдущим блоком
    let last = blocks.length > 0 ? blocks[blocks.length - 1] : baseBlock;
    let direction = currentDirection; // 'x' или 'z'
    let deltaPos = 0;
    if (direction === 'x') {
      deltaPos = currentBlock.mesh.position.x - last.mesh.position.x;
      let overlap = currentBlock.width - Math.abs(deltaPos);
      if (overlap <= 0) {
        gameOver();
        return;
      }
      let newWidth = overlap;
      // Вычисляем новое положение по X (середина пересечения)
      let newX = last.mesh.position.x + deltaPos / 2;
      // Обновляем геометрию текущего блока
      let geometry = new THREE.BoxGeometry(newWidth, BLOCK_HEIGHT, currentBlock.depth);
      currentBlock.mesh.geometry.dispose();
      currentBlock.mesh.geometry = geometry;
      currentBlock.mesh.position.x = newX;
      // Если есть отсекаемая часть – создаём отдельный объект
      let cutSize = currentBlock.width - newWidth;
      if (cutSize > 0) {
        let cutX;
        if (deltaPos > 0) {
          // если блок сдвинут вправо, отсекается правая часть
          cutX = currentBlock.mesh.position.x + newWidth / 2 + cutSize / 2;
        } else {
          // если блок сдвинут влево, отсекается левая часть
          cutX = currentBlock.mesh.position.x - newWidth / 2 - cutSize / 2;
        }
        let geometryCut = new THREE.BoxGeometry(cutSize, BLOCK_HEIGHT, currentBlock.depth);
        let materialCut = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          roughness: 0.3,
          metalness: 0.6
        });
        let cutMesh = new THREE.Mesh(geometryCut, materialCut);
        cutMesh.castShadow = true;
        cutMesh.receiveShadow = true;
        cutMesh.position.set(cutX, currentBlock.mesh.position.y, currentBlock.mesh.position.z);
        scene.add(cutMesh);
        fallingBlocks.push({ mesh: cutMesh, fallVelocity: 0 });
        cutSound.play();
      }
      // Обновляем ширину текущего блока
      currentBlock.width = newWidth;
    } else if (direction === 'z') {
      deltaPos = currentBlock.mesh.position.z - last.mesh.position.z;
      let overlap = currentBlock.depth - Math.abs(deltaPos);
      if (overlap <= 0) {
        gameOver();
        return;
      }
      let newDepth = overlap;
      let newZ = last.mesh.position.z + deltaPos / 2;
      let geometry = new THREE.BoxGeometry(currentBlock.width, BLOCK_HEIGHT, newDepth);
      currentBlock.mesh.geometry.dispose();
      currentBlock.mesh.geometry = geometry;
      currentBlock.mesh.position.z = newZ;
      let cutSize = currentBlock.depth - newDepth;
      if (cutSize > 0) {
        let cutZ;
        if (deltaPos > 0) {
          cutZ = currentBlock.mesh.position.z + newDepth / 2 + cutSize / 2;
        } else {
          cutZ = currentBlock.mesh.position.z - newDepth / 2 - cutSize / 2;
        }
        let geometryCut = new THREE.BoxGeometry(currentBlock.width, BLOCK_HEIGHT, cutSize);
        let materialCut = new THREE.MeshStandardMaterial({
          color: 0xff0000,
          roughness: 0.3,
          metalness: 0.6
        });
        let cutMesh = new THREE.Mesh(geometryCut, materialCut);
        cutMesh.castShadow = true;
        cutMesh.receiveShadow = true;
        cutMesh.position.set(currentBlock.mesh.position.x, currentBlock.mesh.position.y, cutZ);
        scene.add(cutMesh);
        fallingBlocks.push({ mesh: cutMesh, fallVelocity: 0 });
        cutSound.play();
      }
      currentBlock.depth = newDepth;
    }

    // Добавляем успешно уложенный блок в башню и обновляем счёт
    blocks.push(currentBlock);
    score += SCORE_PER_BLOCK;

    // Поднимаем камеру, чтобы башня всегда была в поле зрения
    let newCamY = currentBlock.mesh.position.y + 2;
    if (newCamY > camera.position.y) {
      camera.position.y = newCamY;
    }

    // Подготавливаем следующий блок, меняя направление движения
    currentDirection = currentDirection === 'x' ? 'z' : 'x';
    currentBlock = spawnMovingBlock();
  }

  // =======================
  // ОБРАБОТКА ИГРОВОГО ЦИКЛА
  // =======================
  function animate() {
    if (!gameRunning) return;
    let delta = clock.getDelta();

    // Обновляем позицию движущегося блока
    if (currentBlock) {
      if (currentDirection === 'x') {
        currentBlock.mesh.position.x += moveSpeed;
        if (currentBlock.mesh.position.x > 5 || currentBlock.mesh.position.x < -5) {
          moveSpeed = -moveSpeed;
        }
      } else { // движение по оси z
        currentBlock.mesh.position.z += moveSpeed;
        if (currentBlock.mesh.position.z > 5 || currentBlock.mesh.position.z < -5) {
          moveSpeed = -moveSpeed;
        }
      }
    }

    // Обновляем анимацию падающих кусков
    updateFallingBlocks(delta);

    // Рендерим сцену с постобработкой
    composer.render(delta);
    requestAnimationFrame(animate);
  }

  // =======================
  // ОБРАБОТКА ВВОДА ПОЛЬЗОВАТЕЛЯ
  // =======================
  function onUserInput() {
    if (!gameRunning) return;
    dropCurrentBlock();
  }

  function setupInput() {
    window.addEventListener('click', onUserInput, false);
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' || e.key === ' ') {
        onUserInput();
      }
    });
  }

  function removeInput() {
    window.removeEventListener('click', onUserInput, false);
  }

  // =======================
  // ФУНКЦИИ ИНИЦИАЛИЗАЦИИ И СБРОСА ИГРЫ
  // =======================
  function initGame2() {
    // Если ранее уже был создан renderer – удаляем его DOM-элемент
    if (renderer && renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
    initScene();
    score = 0;
    blocks = [];
    fallingBlocks = [];
    currentDirection = 'x';
    moveSpeed = 0.05;
    baseBlock = createBaseBlock();
    currentBlock = spawnMovingBlock();
    gameRunning = true;
    setupInput();
    clock.start();
    animate();
  }

  function resetGame2() {
    gameRunning = false;
    removeInput();
    // Удаляем все объекты из сцены
    while (scene.children.length > 0) {
      scene.remove(scene.children[0]);
    }
    if (renderer && renderer.domElement && renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  }

  // =======================
  // ЭКСПОРТАЦИЯ ФУНКЦИЙ
  // =======================
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();

