(function () {
  // --------------------------------------------------
  // Глобальные переменные для Stack
  // --------------------------------------------------
  let scene, camera, renderer;
  let composer; // если захотите использовать постобработку
  let stackBlocks = [];      // Массив уже установленных блоков (каждый блок – {mesh, size, position, etc.})
  let activeBlock = null;    // Текущий движущийся блок
  let blockSpeed = 0.08;     // Скорость движения текущего блока
  let direction = 'x';       // Направление движения (x или z)
  let game2Running = false;
  let game2AnimationFrameId = null;

  // Размеры блоков (стартовые)
  const START_WIDTH  = 3;  // по x
  const START_DEPTH  = 3;  // по z
  const BLOCK_HEIGHT = 0.5; // высота кубика

  // Звуки (упрощённый вариант)
  let placeSound, fallSound, bgMusic;

  // --------------------------------------------------
  // Инициализация аудио
  // --------------------------------------------------
  function loadSounds() {
    // Простой пример через HTMLAudioElement:
    placeSound = new Audio('sounds/place.mp3'); // короткий «щелчок» при успешном размещении
    fallSound  = new Audio('sounds/fall.mp3');  // звук падения обрезанной части
    bgMusic    = new Audio('sounds/bgMusic.mp3'); // простая фоновая музыка
    bgMusic.loop = true; // зацикливаем фоновую музыку
  }

  // Включаем/выключаем музыку
  function startMusic() {
    if (bgMusic) {
      bgMusic.currentTime = 0;
      bgMusic.play().catch(err => {
        // В некоторых браузерах требуется пользовательское действие
        console.log('Music play error:', err);
      });
    }
  }
  function stopMusic() {
    if (bgMusic) {
      bgMusic.pause();
      bgMusic.currentTime = 0;
    }
  }

  // --------------------------------------------------
  // Создаём сцену, камеру, рендерер
  // --------------------------------------------------
  function createScene() {
    // Сцена
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Камера (перспектива)
    const fov = 60;
    const aspect = 400 / 740; // если canvas имеет такие размеры
    const near = 0.1;
    const far = 1000;
    camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    camera.position.set(0, 5, 8); // начальная позиция камеры
    camera.lookAt(0, 0, 0);

    // Рендерер
    const canvas = document.getElementById('match3Canvas');
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.shadowMap.enabled = true;  // тени

    // Можно добавить базовый ambient light + directional light
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // При желании здесь же подключаете EffectComposer для bloom и др.
    // composer = new THREE.EffectComposer(renderer);
    // composer.addPass(new THREE.RenderPass(scene, camera));
    // let bloomPass = new THREE.BloomPass(...);
    // composer.addPass(bloomPass);
  }

  // --------------------------------------------------
  // Базовый блок-основание
  // --------------------------------------------------
  function createBaseBlock() {
    // Блок на "земле", служит фундаментом
    const geometry = new THREE.BoxGeometry(START_WIDTH, BLOCK_HEIGHT, START_DEPTH);
    const material = new THREE.MeshStandardMaterial({ color: 0x00ff00, metalness: 0.3, roughness: 0.5 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(0, 0, 0);
    mesh.receiveShadow = true;
    mesh.castShadow = true;

    scene.add(mesh);

    stackBlocks.push({
      mesh: mesh,
      width: START_WIDTH,
      depth: START_DEPTH,
      x: 0,
      y: 0,
      z: 0
    });
  }

  // --------------------------------------------------
  // Создаём новый движущийся блок
  // --------------------------------------------------
  function createMovingBlock() {
    const topBlock = stackBlocks[stackBlocks.length - 1];
    const newY = topBlock.y + BLOCK_HEIGHT; // размещаем над предыдущим

    // Начинаем с той же ширины/глубины, что и у верхнего
    const geometry = new THREE.BoxGeometry(topBlock.width, BLOCK_HEIGHT, topBlock.depth);
    const material = new THREE.MeshStandardMaterial({ color: 0xff4444, metalness: 0.3, roughness: 0.4 });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Меняем направление движения каждый раз
    if (direction === 'x') {
      // Блок будет ехать вдоль оси x
      mesh.position.set(-6, newY, topBlock.z); // начинаем слева
    } else {
      // Блок будет ехать вдоль оси z
      mesh.position.set(topBlock.x, newY, -6); // начинаем "сзади"
    }

    scene.add(mesh);

    activeBlock = {
      mesh: mesh,
      width: topBlock.width,
      depth: topBlock.depth,
      x: mesh.position.x,
      y: newY,
      z: mesh.position.z
    };
  }

  // --------------------------------------------------
  // Логика фиксации блока
  // --------------------------------------------------
  function placeBlock() {
    if (!activeBlock) return;

    const topBlock = stackBlocks[stackBlocks.length - 1];

    // Координаты для упрощения
    let currentPos = activeBlock.mesh.position.clone();
    let currentWidth = activeBlock.width;
    let currentDepth = activeBlock.depth;

    let previousPos = new THREE.Vector3(topBlock.x, topBlock.y, topBlock.z);
    let previousWidth = topBlock.width;
    let previousDepth = topBlock.depth;

    // Определяем пересечение по оси X и Z
    // Для оси X
    let overlapX = Math.min(
      (previousPos.x + previousWidth / 2), 
      (currentPos.x + currentWidth / 2)
    ) - Math.max(
      (previousPos.x - previousWidth / 2), 
      (currentPos.x - currentWidth / 2)
    );

    // Для оси Z
    let overlapZ = Math.min(
      (previousPos.z + previousDepth / 2),
      (currentPos.z + currentDepth / 2)
    ) - Math.max(
      (previousPos.z - previousDepth / 2),
      (currentPos.z - currentDepth / 2)
    );

    // Если направление движения x, основная ось для "обрезки" – X
    // Если z, то для "обрезки" – Z
    let overlap = 0;
    if (direction === 'x') {
      overlap = overlapX;
    } else {
      overlap = overlapZ;
    }

    // Если перекрытие <= 0, значит блок не попал – игра окончена
    if (overlap <= 0) {
      // Игра заканчивается
      if (fallSound) fallSound.play().catch(()=>{});
      endGame2(true);
      return;
    }

    // Вычисляем размер нового блока (после обрезки)
    // И позицию
    let newWidth = currentWidth;
    let newDepth = currentDepth;

    if (direction === 'x') {
      newWidth = overlap;
    } else {
      newDepth = overlap;
    }

    // Чтобы найти сдвиг leftover-части, используем разницу
    let leftoverSize = 0;
    let leftoverShift = 0;
    if (direction === 'x') {
      leftoverSize = currentWidth - overlap;
      leftoverShift = currentPos.x > topBlock.x ? overlap/2 + leftoverSize/2 : -overlap/2 - leftoverSize/2;
    } else {
      leftoverSize = currentDepth - overlap;
      leftoverShift = currentPos.z > topBlock.z ? overlap/2 + leftoverSize/2 : -overlap/2 - leftoverSize/2;
    }

    // Устанавливаем конечные размеры у активного блока
    activeBlock.width = newWidth;
    activeBlock.depth = newDepth;

    // Корректируем mesh:
    activeBlock.mesh.scale.x = (direction === 'x') ? (overlap / activeBlock.width) : 1;
    activeBlock.mesh.scale.z = (direction === 'z') ? (overlap / activeBlock.depth) : 1;

    // Сдвигаем mesh так, чтобы центр совпал с пересечением
    if (direction === 'x') {
      let cutPosition = activeBlock.mesh.position.x + leftoverShift;
      activeBlock.mesh.position.x = (activeBlock.mesh.position.x + cutPosition) / 2;
    } else {
      let cutPosition = activeBlock.mesh.position.z + leftoverShift;
      activeBlock.mesh.position.z = (activeBlock.mesh.position.z + cutPosition) / 2;
    }

    // Сохраняем финальные координаты в структуре
    activeBlock.x = activeBlock.mesh.position.x;
    activeBlock.z = activeBlock.mesh.position.z;

    // Анимируем отлет лишнего блока
    if (leftoverSize > 0.01) {
      createLeftoverBlock(
        leftoverSize,
        direction === 'x' ? activeBlock.depth : activeBlock.width,
        leftoverShift
      );
    }

    // Добавляем установленный блок в массив stackBlocks
    stackBlocks.push({
      mesh: activeBlock.mesh,
      width: activeBlock.width,
      depth: activeBlock.depth,
      x: activeBlock.x,
      y: activeBlock.y,
      z: activeBlock.z
    });

    // Добавляем очки
    localUserData.points += 5;
    if (typeof userRef !== 'undefined' && userRef) {
      userRef.update({ points: localUserData.points });
    }

    // Звук
    if (placeSound) placeSound.play().catch(()=>{});

    // Удаляем "активный блок"
    activeBlock = null;

    // Меняем направление
    direction = (direction === 'x') ? 'z' : 'x';

    // Создаём следующий блок
    createMovingBlock();

    // Поднимаем камеру чуть выше
    updateCamera();
  }

  // --------------------------------------------------
  // Создаём «лишнюю» часть и анимируем падение
  // --------------------------------------------------
  function createLeftoverBlock(size, otherSize, leftoverShift) {
    // size – ширина или глубина (зависит от направления)
    // otherSize – оставшаяся размерность
    // leftoverShift – смещение от центральной точки
    const topBlock = stackBlocks[stackBlocks.length - 1];

    // Геометрия у leftover (плоский кусок, такой же по высоте)
    let geometry, material;
    material = new THREE.MeshStandardMaterial({ color: 0xff0000, metalness: 0.2, roughness: 0.7 });

    // Позиция leftover
    let leftoverMesh;
    if (direction === 'x') {
      geometry = new THREE.BoxGeometry(size, BLOCK_HEIGHT, otherSize);
      leftoverMesh = new THREE.Mesh(geometry, material);

      leftoverMesh.position.set(
        topBlock.x + leftoverShift,
        topBlock.y,
        topBlock.z
      );
    } else {
      geometry = new THREE.BoxGeometry(otherSize, BLOCK_HEIGHT, size);
      leftoverMesh = new THREE.Mesh(geometry, material);

      leftoverMesh.position.set(
        topBlock.x,
        topBlock.y,
        topBlock.z + leftoverShift
      );
    }
    leftoverMesh.castShadow = true;
    leftoverMesh.receiveShadow = true;
    scene.add(leftoverMesh);

    // Анимация падения
    const targetY = leftoverMesh.position.y - 5; // пусть падает на несколько единиц вниз
    const duration = 2000; // 2 секунды падения
    new TWEEN.Tween(leftoverMesh.position)
      .to({ y: targetY }, duration)
      .easing(TWEEN.Easing.Quadratic.In)
      .onUpdate(() => {})
      .onComplete(() => {
        // Удаляем обрезок из сцены
        scene.remove(leftoverMesh);
      })
      .start();

    // Звук падения
    if (fallSound) {
      setTimeout(() => {
        fallSound.play().catch(()=>{});
      }, 200); // небольшой сдвиг по времени
    }
  }

  // --------------------------------------------------
  // Обновляем позицию и взгляд камеры
  // --------------------------------------------------
  function updateCamera() {
    const topBlock = stackBlocks[stackBlocks.length - 1];
    const newHeight = topBlock.y + 5;
    // Плавно двигаем камеру
    new TWEEN.Tween(camera.position)
      .to({ y: newHeight }, 500)
      .easing(TWEEN.Easing.Quadratic.Out)
      .start();
    // Можно также плавно анимировать lookAt
    // Но чаще просто смотрим на центр башни:
    camera.lookAt(0, topBlock.y, 0);
  }

  // --------------------------------------------------
  // Игровой цикл
  // --------------------------------------------------
  function update() {
    if (!game2Running) return;

    TWEEN.update();

    // Двигаем текущий блок (если есть)
    if (activeBlock) {
      if (direction === 'x') {
        activeBlock.mesh.position.x += blockSpeed;
        activeBlock.x = activeBlock.mesh.position.x;
        // Чтобы блок ходил взад-вперёд, можно сделать отражение:
        if (activeBlock.x > 6) {
          blockSpeed *= -1;
        }
        if (activeBlock.x < -6) {
          blockSpeed *= -1;
        }
      } else {
        activeBlock.mesh.position.z += blockSpeed;
        activeBlock.z = activeBlock.mesh.position.z;
        if (activeBlock.z > 6) {
          blockSpeed *= -1;
        }
        if (activeBlock.z < -6) {
          blockSpeed *= -1;
        }
      }
    }

    renderer.render(scene, camera);
    // Если используете постобработку:
    // composer.render();

    game2AnimationFrameId = requestAnimationFrame(update);
  }

  // --------------------------------------------------
  // Нажатие/клик для остановки блока
  // --------------------------------------------------
  function handleUserInputForGame2() {
    placeBlock();
  }

  // --------------------------------------------------
  // Запуск игры
  // --------------------------------------------------
  function initGame2() {
    if (game2Running) return; // если уже запущена
    game2Running = true;

    // Подгружаем звуки
    loadSounds();
    startMusic();

    // Создаём сцену
    createScene();

    // Очищаем массивы
    stackBlocks = [];

    // Создаём базовый блок (фундамент)
    createBaseBlock();

    // Создаём первый движущийся блок
    createMovingBlock();

    // Вешаем обработчик нажатия (Space или клик)
    // Можно сделать общий на document, либо кнопку в мобильном интерфейсе
    document.addEventListener('keydown', onKeyDown2);
    document.addEventListener('click', onClick2);

    update(); // запускаем цикл анимации
  }

  function onKeyDown2(e) {
    // Пробел – разместить блок
    if (e.code === 'Space') {
      handleUserInputForGame2();
    }
  }
  function onClick2(e) {
    // Если хотите разделить управление – уберите отсюда
    // Но часто на мобильных устройствах проще «тап» = placeBlock
    handleUserInputForGame2();
  }

  // --------------------------------------------------
  // Завершение игры
  // --------------------------------------------------
  function endGame2(showModal = false) {
    if (!game2Running) return;
    game2Running = false;

    stopMusic();

    cancelAnimationFrame(game2AnimationFrameId);
    document.removeEventListener('keydown', onKeyDown2);
    document.removeEventListener('click', onClick2);

    // Показываем «Game Over» через ваш глобальный метод (например, showEndGameModal)
    if (showModal) {
      if (typeof showEndGameModal === 'function') {
        let height = stackBlocks.length - 1; // -1, т.к. первый – фундамент
        showEndGameModal("Game Over", `Вы выстроили башню высотой в ${height} блоков!`);
      }
    }
  }

  // --------------------------------------------------
  // Сброс и очистка
  // --------------------------------------------------
  function resetGame2() {
    endGame2(false); // завершаем без показа «Game Over»
    // Очищаем сцену
    if (scene) {
      while (scene.children.length > 0) {
        let child = scene.children[0];
        scene.remove(child);
      }
    }
    if (renderer) {
      renderer.dispose();
    }
    scene = null;
    camera = null;
    renderer = null;
    stackBlocks = [];
    activeBlock = null;
    direction = 'x';
  }

  // Открываем наружу для index.html
  window.initGame2 = initGame2;
  window.resetGame2 = resetGame2;
})();
