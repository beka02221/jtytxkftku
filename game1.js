// game1.js – Бесконечный уровень в стиле Geometry Dash

// Получаем canvas и контекст
var C = document.querySelector("canvas"),
    c = C.getContext("2d");

// Исходные размеры canvas
var W = C.width,
    H = C.height;

// Коэффициент масштабирования (для ретро-стиля, S=2, можно менять)
var S = 2;

// Базовые параметры
var cell = 40,               // базовая единица (ячейка)
    stroke = 2,              // толщина линий
    gravity = 0.98,          // сила гравитации
    rand = (min, max) => Math.round(Math.random() * (max - min)) + min,
    score = 0,
    frame = 0,
    framesPerPt = 5,         // кадры на пункт (для начисления очков)
    difficulty = 1;

// --- Параметры уровня ---
// Земля (ground): расположена на 60% высоты canvas, толщина – 40 пикселей
var groundY = H * 0.6,       // уровень земли (от верха canvas)
    groundHeight = 40;

// Размеры платформ (кубов): каждый куб 60×60
var cubeSize = 60;

// Размеры шипов (спайков): 30×30
var spikeW = 30,
    spikeH = 30;

// Размеры монет: 50×50
var coinSize = 50;

// --- Объекты игры ---
// Игрок (sq) – квадрат; координаты заданы в системе примера (отрисовка перевёрнута по Y)
var sq = {
    x: cubeSize * 2,                 // стартовая позиция по X
    y: groundY - cubeSize,           // игрок стоит на земле
    w: cubeSize,                     // ширина 60
    h: cubeSize,                     // высота 60
    rot: 0,
    xVel: 4,                         // горизонтальная скорость
    yVel: 0,
    minYVel: -15,                    // сила прыжка (можно увеличить для динамики)
    onGrnd: true,
    dead: false,
    jump: function () {
        if (this.onGrnd && !this.dead) {
            this.yVel = this.minYVel;
            this.onGrnd = false;
        } else if (this.dead && this.y < -this.h) {
            // Сброс игры при падении за экран
            score = 0;
            frame = 0;
            difficulty = 1;
            this.x = cubeSize * 2;
            this.y = groundY - cubeSize;
            this.rot = 0;
            this.xVel = 4;
            this.yVel = 0;
            this.dead = false;
            // Очистим объекты уровня (платформы, шипы, монеты)
            platforms = [];
            spikes = [];
            coins = [];
        }
    }
};
var sqJump = sq.jump.bind(sq);

// Массивы объектов уровня
var platforms = [];   // платформы (наборы кубов)
var spikes = [];      // шипы (спайки)
var coins = [];       // монеты

// --- Фон и градиенты ---
var bgFill = c.createLinearGradient(W / 2, 0, W / 2, groundY);
bgFill.addColorStop(0, "#0c48db");
bgFill.addColorStop(1, "#5785f6");

var floorFill = c.createLinearGradient(W / 2, groundY, W / 2, groundY + groundHeight);
floorFill.addColorStop(0, "#0c48db");
floorFill.addColorStop(1, "#171717");

var floorLine = c.createLinearGradient(0, groundY, W, groundY);
floorLine.addColorStop(0, "#0c48db");
floorLine.addColorStop(0.5, "#f1f1f1");
floorLine.addColorStop(1, "#0c48db");

// --- Текстуры и изображения ---
// Текстура для платформ (кубов)
var platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg"; // убедитесь, что изображение доступно и имеет размеры 300×300

// GIF для персонажа
var playerImg = new Image();
playerImg.crossOrigin = "anonymous";
playerImg.src = "https://cdn.masto.host/rigczclub/accounts/avatars/000/000/001/original/7a2c1ce45c8f8d02.gif";

// GIF для монеты
var coinImg = new Image();
coinImg.crossOrigin = "anonymous";
coinImg.src = "https://donatepay.ru/uploads/notification/images/830208_1664005822.gif";

// --- Overlay элементы для анимации GIF ---
// Так как в Telegram Web App canvas часто отрисовывает только первый кадр GIF, для анимированных элементов (персонажа и монет) используем HTML‑элементы поверх canvas.
var container = C.parentElement;
if (getComputedStyle(container).position === "static") {
    container.style.position = "relative";
}
var playerOverlay = document.createElement("img");
playerOverlay.src = playerImg.src;
playerOverlay.style.position = "absolute";
playerOverlay.style.width = sq.w + "px";
playerOverlay.style.height = sq.h + "px";
playerOverlay.style.pointerEvents = "none";
playerOverlay.style.zIndex = "1";
container.appendChild(playerOverlay);

// Для монет будем отрисовывать их как обычные изображения (если требуется — можно создать overlay для каждой монеты)

// --- Функция для обновления позиций overlay элементов ---
function updateOverlays() {
    playerOverlay.style.left = sq.x + "px";
    playerOverlay.style.top = sq.y + "px";
    // Если у монеты создан overlay, обновлять и его (здесь монеты рисуются на canvas как текстуры)
}

// --- Генерация объектов уровня ---
// Генерация платформ: каждая платформа – набор кубов с четкими границами
function spawnPlatform() {
    // С вероятностью 70% платформа на уровне земли, 30% – приподнятая (elevated)
    var type = Math.random() < 0.7 ? "ground" : "elevated";
    var blocksCount = rand(1, 3); // от 1 до 3 кубов
    var platW = blocksCount * cubeSize;
    var platX = W + rand(0, 2) * cell;
    var platY = (type === "ground") ? groundY - cubeSize : groundY - cubeSize - rand(20, 80);
    platforms.push({ x: platX, y: platY, w: platW, h: cubeSize, blocks: blocksCount, type: "platform" });
    
    // Иногда рядом с платформой добавляем шипы (с вероятностью 50%)
    if (Math.random() < 0.5) {
        var spikeX = platX + (Math.random() < 0.5 ? -spikeW : platW);
        var spikeY = platY + cubeSize - spikeH; // на уровне верхней границы платформы
        spikes.push({ x: spikeX, y: spikeY, w: spikeW, h: spikeH });
    }
    
    // Иногда над платформой появляется монета (вероятность 70%)
    if (Math.random() < 0.7) {
        var coinX = platX + platW / 2 - coinSize / 2;
        var coinY = platY - 60; // монета расположена выше платформы
        coins.push({ x: coinX, y: coinY, w: coinSize, h: coinSize });
    }
}

// Генерация шипов вне платформ – если не было сгенерировано вместе с платформой
function spawnSpike() {
    var spawnX = W;
    // Добавляем шип, если рядом нет платформ
    var overlap = platforms.some(p => p.x < spawnX + spikeW && p.x + p.w > spawnX);
    if (!overlap) {
        spikes.push({ x: spawnX, y: groundY - spikeH, w: spikeW, h: spikeH });
    }
}

// --- Основной цикл отрисовки (render) ---
var render = function () {
    frame++;
    
    // Обновляем фон: фон отрисовывается до уровня земли (groundY)
    c.fillStyle = bgFill;
    c.fillRect(0, 0, W, groundY);
    
    // Отрисовка земли (с возвышенной текстурой)
    c.fillStyle = floorFill;
    c.fillRect(0, groundY, W, groundHeight);
    
    // Физика игрока
    if (sq.y >= groundY - sq.h) {
        sq.y = groundY - sq.h;
        sq.onGrnd = true;
        sq.yVel = 0;
    } else {
        sq.yVel += gravity;
    }
    sq.y += sq.yVel;
    if (!sq.dead) {
        sq.x += sq.xVel;
    }
    // Обновляем угол поворота игрока (например, в зависимости от yVel)
    sq.rot = (sq.yVel / sq.minYVel) * -90;
    
    // Проверка столкновения с платформами (если игрок падает на платформу)
    platforms.forEach(function (p) {
        if (!sq.dead &&
            sq.y + sq.h >= p.y &&
            sq.y + sq.h - sq.yVel < p.y &&
            sq.x + sq.w > p.x &&
            sq.x < p.x + p.w) {
            sq.y = p.y - sq.h;
            sq.yVel = 0;
            sq.onGrnd = true;
        }
    });
    
    // Проверка столкновения с шипами – простая прямоугольная коллизия
    spikes.forEach(function (sp) {
        if (!sq.dead &&
            sq.x < sp.x + sp.w &&
            sq.x + sq.w > sp.x &&
            sq.y < sp.y + sp.h &&
            sq.y + sq.h > sp.y) {
            sq.dead = true;
        }
    });
    
    // Обновляем позиции платформ, шипов и монет (сдвиг влево, как будто камера движется)
    platforms.forEach(function (p) { p.x -= sq.xVel; });
    spikes.forEach(function (sp) { sp.x -= sq.xVel; });
    coins.forEach(function (coin) { coin.x -= sq.xVel; });
    
    // Удаляем объекты, вышедшие за левую границу
    platforms = platforms.filter(p => p.x + p.w > 0);
    spikes = spikes.filter(sp => sp.x + sp.w > 0);
    coins = coins.filter(coin => coin.x + coin.w > 0);
    
    // Генерация новых объектов
    var lastPlatformX = platforms.length ? platforms[platforms.length - 1].x + platforms[platforms.length - 1].w : W;
    if (lastPlatformX < W && !sq.dead) {
        spawnPlatform();
        if (Math.random() < 0.3) { // иногда дополнительно спавним одиночный шип
            spawnSpike();
        }
    }
    
    // Отрисовка платформ – каждый куб платформы отрисовывается отдельно
    platforms.forEach(function (p) {
        for (var i = 0; i < p.blocks; i++) {
            if (platformImg.complete) {
                c.drawImage(platformImg, p.x + i * cubeSize, p.y, cubeSize, cubeSize);
            } else {
                c.fillStyle = "#8B4513";
                c.fillRect(p.x + i * cubeSize, p.y, cubeSize, cubeSize);
            }
        }
    });
    
    // Отрисовка шипов как чёрных треугольников
    c.fillStyle = "black";
    spikes.forEach(function (sp) {
        c.beginPath();
        c.moveTo(sp.x, sp.y + sp.h);
        c.lineTo(sp.x + sp.w / 2, sp.y);
        c.lineTo(sp.x + sp.w, sp.y + sp.h);
        c.closePath();
        c.fill();
    });
    
    // Отрисовка монет – для простоты рисуем их как золотые круги
    coins.forEach(function (coin) {
        c.fillStyle = "gold";
        c.beginPath();
        c.arc(coin.x + coin.w / 2, coin.y + coin.h / 2, coin.w / 2, 0, Math.PI * 2);
        c.fill();
        c.strokeStyle = "#b8860b";
        c.lineWidth = 2;
        c.stroke();
        c.closePath();
    });
    
    // Отрисовка игрока (sq) – с учётом поворота
    c.save();
    c.translate(sq.x + sq.w / 2, sq.y + sq.h / 2);
    c.rotate((sq.rot * Math.PI) / 180);
    c.fillStyle = "#f2b826";
    c.strokeStyle = "#171717";
    c.fillRect(-sq.w / 2, -sq.h / 2, sq.w, sq.h);
    c.strokeRect(-sq.w / 2, -sq.h / 2, sq.w, sq.h);
    c.restore();
    
    // Начисление очков и увеличение сложности
    if (frame % framesPerPt === framesPerPt - 1 && !sq.dead) score++;
    if (frame % (100 * framesPerPt) === 0 && difficulty <= 9) difficulty++;
    
    // Отрисовка счёта
    c.fillStyle = "#f1f1f1";
    c.lineWidth = stroke * 2;
    c.font = "bold 40px Calibri, sans-serif";
    c.textAlign = "center";
    c.strokeText(score, W / 2, cell * 1.5);
    c.fillText(score, W / 2, cell * 1.5);
    
    // Обновляем overlay для персонажа
    updateOverlays();
    
    requestAnimationFrame(render);
};

// Настраиваем размеры canvas с учетом масштабирования
C.width = W * S;
C.height = H * S;
c.scale(S, S);

// Обработчик клика/нажатия для прыжка
window.addEventListener("keydown", function (e) {
    if (e.code === "Space") sqJump();
});
C.addEventListener("click", sqJump);

// Запуск игрового цикла
render();

