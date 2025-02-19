// Получаем холст и контекст
var C = document.querySelector("canvas"),
    c = C.getContext("2d");

// Масштабирование: S=2 для ретро-эффекта (можно менять)
var S = 2; 
C.width = 400 * S;
C.height = 600 * S;
c.scale(S, S);

// Базовые размеры (без учета масштаба)
var W = 400, H = 600;

// Размер базовой ячейки (будет использоваться для платформ – кубов)
var cell = 40;

// Параметры времени и сложности
var stroke = 2,
    gravity = 0.98,
    rand = (min, max) => Math.round(Math.random()*(max-min))+min,
    frame = 0,
    framesPerPt = 5,
    difficulty = 1;

// Новые глобальные переменные для геймплея
var gameStarted = false,
    startTime = 0,
    maxTime = 300 * 1000, // 5 минут в мс
    coinCount = 0;       // количество собранных монет (каждая = 5 прогресс-единиц)
    
// Земля: её верхняя граница на 80% высоты холста
var groundY = H * 0.8; 
var groundHeight = H - groundY; // толщина земли

// Объект игрока (квадрат размером cell)
var sq = {
    x: cell * 2 + 1,
    y: groundY - cell,
    w: cell,
    h: cell,
    rot: 0,
    xVel: 4,        // горизонтальная скорость (имитация движения)
    yVel: 0,
    minYVel: -15,   // сила прыжка (можно увеличить)
    onGrnd: true,
    dead: false,
    jump: function () {
        if(this.onGrnd && !this.dead){
            this.yVel = this.minYVel;
            this.onGrnd = false;
        }
    }
};
var sqJump = sq.jump.bind(sq);

// Функция-«фабрика» для создания прямоугольников
var wall = (x, y, w, h) => ({ x: x, y: y, w: w, h: h });

// Основной пол (земля) – создаём один «wall»
var floorWall = wall(0, groundY, W, groundHeight);

// Массив платформ (первые элементы – только земля)
var walls = [ floorWall ];

// Дополнительные объекты: монеты (будем генерировать их позже)
var coins = [];
// Для шипов (объекты, рисуемые как треугольники)
var spikes = [];

// Для таймера: рисуем вертикальный ползунок справа
var sliderX = W - cell * 1.5,
    sliderY = cell,
    sliderWidth = cell,
    sliderHeight = H - 2 * cell;

// Фон: создаём линейный градиент от верха до уровня земли
var bgFill = c.createLinearGradient(W/2, 0, W/2, groundY);
bgFill.addColorStop(0, "#0c48db");
bgFill.addColorStop(1, "#5785f6");

// Заливка земли: делаем её чёрной
var floorFill = "#000";

// Загружаем текстуру для платформ (кубов) – wall1.jpg (300×300)
var platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg";

// --- Дополнительный оверлей для анимации персонажа и монет ---
// В данном примере для простоты мы не реализуем анимацию GIF в canvas, а оставляем отрисовку игрока через canvas

// Функция отрисовки стартового экрана
function drawStartScreen() {
    c.fillStyle = "#000";
    c.fillRect(0, 0, W, H);
    c.fillStyle = "#FFF";
    // Используем нестандартный шрифт – Comic Sans MS (можно заменить на любой)
    c.font = "bold 48px 'Comic Sans MS', cursive";
    c.textAlign = "center";
    c.fillText("Тап, чтобы старт", W/2, H/2);
}

// Основной цикл отрисовки
function render() {
    // Если игра еще не началась, рисуем стартовый экран и ждем нажатия
    if(!gameStarted) {
        drawStartScreen();
        requestAnimationFrame(render);
        return;
    }
    
    // Если игра запущена – вычисляем время игры
    var currentTime = Date.now();
    var elapsed = currentTime - startTime;
    var timerProgress = Math.min(elapsed / maxTime, 1); // от 0 до 1
    
    frame++;
    
    // Физика игрока: обновляем вертикальное положение
    sq.y += sq.yVel;
    sq.yVel += gravity;
    if(sq.y + sq.h >= groundY) {
        sq.y = groundY - sq.h;
        sq.yVel = 0;
        sq.onGrnd = true;
    }
    
    // Движение платформ: удаляем те, что ушли влево
    walls = walls.filter(e => e.x + e.w > 0);
    walls.forEach((e, i) => {
        if(i > 0) { e.x -= sq.xVel; } // не двигаем пол (i==0)
    });
    
    // Генерация новых платформ
    if(walls.length === 1 || (walls[walls.length-1].x + walls[walls.length-1].w < W)) {
        // Случайный промежуток
        var gap = rand(0, 3) * cell;
        // Количество кубов платформы (от 1 до 3)
        var blocks = rand(1, 3);
        // 70% шанс – платформа на земле, 30% – приподнятая (до 3 клеток вверх)
        var pY = (Math.random() < 0.7) ? groundY - cell : groundY - cell - rand(1,3)*cell;
        var newWall = wall(W + gap, pY, blocks * cell, cell);
        walls.push(newWall);
        
        // Добавляем шипы: 50% шанс, шипы располагаются на уровне земли
        if(Math.random() < 0.5) {
            spikes.push({ x: W + gap + rand(0, blocks * cell), size: cell });
        }
        // Добавляем монету: 70% шанс, монета располагается чуть выше платформы
        if(Math.random() < 0.7) {
            coins.push({ x: W + gap + rand(0, blocks * cell), y: pY - cell, size: 50 });
        }
    }
    
    // Двигаем шипы и монеты
    spikes.forEach(sp => { sp.x -= sq.xVel; });
    spikes = spikes.filter(sp => sp.x + sp.size > 0);
    
    coins.forEach(coin => { coin.x -= sq.xVel; });
    coins = coins.filter(coin => coin.x + coin.size > 0);
    
    // Проверка столкновения игрока с монетами (простой прямоугольный коллайдер)
    for(var i = 0; i < coins.length; i++){
        var coin = coins[i];
        if(sq.x < coin.x + coin.size &&
           sq.x + sq.w > coin.x &&
           sq.y < coin.y + coin.size &&
           sq.y + sq.h > coin.y){
               coinCount++;
               coins.splice(i, 1);
               i--;
        }
    }
    
    // Проверка столкновения с платформами (игрок не умирает от земли)
    walls.forEach((e, i) => {
        if(i > 0) { // не проверяем пол
            if(sq.x < e.x + e.w && sq.x + sq.w > e.x &&
               sq.y < e.y + e.h && sq.y + sq.h > e.y){
                   // Если столкновение произошло с платформой, принудительно ставим игрока на неё
                   sq.y = e.y - sq.h;
                   sq.yVel = 0;
                   sq.onGrnd = true;
            }
        }
    });
    
    // Проверка столкновения с шипами (используем простую AABB-проверку)
    spikes.forEach(sp => {
        if(sq.x < sp.x + sp.size &&
           sq.x + sq.w > sp.x - sp.size/2 &&
           sq.y + sq.h > groundY - sp.size){
               sq.dead = true;
        }
    });
    
    // Очистка холста
    c.clearRect(0, 0, W, H);
    
    // Отрисовка фона (до уровня земли)
    c.fillStyle = bgFill;
    c.fillRect(0, 0, W, groundY);
    
    // Отрисовка земли (чёрная)
    c.fillStyle = floorFill;
    c.fillRect(0, groundY, W, groundHeight);
    
    // Отрисовка платформ (кубы)
    walls.forEach((e, i) => {
        if(i === 0) {
            // Пол уже отрисован
            return;
        }
        for(var j = 0; j < e.w/cell; j++){
            // Если текстура загружена – рисуем её, иначе заливка
            if(platformImg.complete){
                c.drawImage(platformImg, 0, 0, 300, 300, e.x + j * cell, e.y, cell, cell);
            } else {
                c.fillStyle = "#8B4513";
                c.fillRect(e.x + j * cell, e.y, cell, cell);
            }
        }
    });
    
    // Отрисовка шипов (чёрные треугольники)
    c.fillStyle = "black";
    spikes.forEach(sp => {
        c.beginPath();
        c.moveTo(sp.x, groundY - sp.size);
        c.lineTo(sp.x + sp.size/2, groundY);
        c.lineTo(sp.x - sp.size/2, groundY);
        c.closePath();
        c.fill();
    });
    
    // Отрисовка монет (желтые круги)
    c.fillStyle = "yellow";
    coins.forEach(coin => {
        c.beginPath();
        c.arc(coin.x + coin.size/2, coin.y + coin.size/2, coin.size/2, 0, Math.PI*2);
        c.fill();
    });
    
    // Отрисовка игрока (с вращением, зависящим от вертикальной скорости)
    c.fillStyle = "#f2b826";
    c.save();
    var rot = (sq.yVel / sq.minYVel) * -90;
    c.translate(sq.x + sq.w/2, sq.y + sq.h/2);
    c.rotate(rot * Math.PI/180);
    c.fillRect(-sq.w/2, -sq.h/2, sq.w, sq.h);
    c.restore();
    
    // Отрисовка таймера (ползунок)
    c.strokeStyle = "#FFF";
    c.lineWidth = stroke;
    c.strokeRect(sliderX, sliderY, sliderWidth, sliderHeight);
    c.fillStyle = "#f2b826";
    var filledHeight = sliderHeight * timerProgress;
    c.fillRect(sliderX, sliderY + sliderHeight - filledHeight, sliderWidth, filledHeight);
    
    // Отрисовка информации о прогрессе (каждая монета = 5 единиц)
    c.fillStyle = "#FFF";
    c.font = "bold 20px Arial";
    c.textAlign = "left";
    c.fillText("Прогресс: " + (coinCount * 5), cell, cell);
    
    // Обновление счета (можно оставить, если нужно)
    if(!sq.dead && frame % framesPerPt == framesPerPt - 1)
        score++;
    if(frame % (100 * framesPerPt) == 0 && difficulty <= 9)
        difficulty++;
    
    // Если время вышло или игрок умер – завершаем игру
    if(sq.dead || timerProgress >= 1){
        c.fillStyle = "#FFF";
        c.font = "bold 48px 'Comic Sans MS', cursive";
        c.textAlign = "center";
        c.fillText("Игра окончена", W/2, H/2);
        // Здесь можно вызвать функцию сохранения прогресса (например, saveProgress(coinCount * 5))
        return;
    }
    
    requestAnimationFrame(render);
}

// Обработчики старта игры и прыжка
C.addEventListener("click", function(){
    if(!gameStarted){
        gameStarted = true;
        startTime = Date.now();
    } else if(sq.onGrnd && !sq.dead){
        sq.jump();
    }
});
document.addEventListener("keydown", function(e){
    if(e.code === "Space"){
        if(!gameStarted){
            gameStarted = true;
            startTime = Date.now();
        } else if(sq.onGrnd && !sq.dead){
            sq.jump();
        }
    }
});

// Функция сброса игры (без сохранения прогресса во время игры)
function resetGame() {
    score = 0;
    frame = 0;
    difficulty = 1;
    coinCount = 0;
    sq.x = cell * 2 + 1;
    sq.y = groundY - cell;
    sq.xVel = 4;
    sq.yVel = 0;
    sq.dead = false;
    walls = [ floorWall ];
    spikes = [];
    coins = [];
}

resetGame();
render();

