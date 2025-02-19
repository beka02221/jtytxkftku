// Получаем холст и контекст
var C = document.querySelector("canvas"),
    c = C.getContext("2d");

// Масштабирование (S=2 для ретро эффекта, можно менять)
var S = 2; 
// Устанавливаем базовые размеры (400×600)
C.width = 400 * S;
C.height = 600 * S;
c.scale(S, S);

var W = 400, H = 600; // базовые координаты (без учета масштаба)
var cell = 40;       // базовый размер ячейки (размер куба платформы)
var stroke = 2;
var gravity = 0.98;
var rand = (min, max) => Math.round(Math.random() * (max - min)) + min;
var score = 0, frame = 0, framesPerPt = 5, difficulty = 1;

// Задаем уровень земли – верхняя граница земли на 80% высоты холста
var groundY = H * 0.8;
var groundHeight = H - groundY; // толщина земли

// Объект игрока (игрок – квадрат размером cell)
var player = {
    x: cell * 2,
    y: groundY - cell,
    w: cell,
    h: cell,
    xVel: 4,       // горизонтальная скорость (для имитации движения)
    yVel: 0,
    minYVel: -15,  // сила прыжка (можно увеличить для динамичности)
    onGrnd: true,
    dead: false,
    jump: function() {
        if(this.onGrnd && !this.dead){
            this.yVel = this.minYVel; 
            this.onGrnd = false;
        }
    }
};

// Массивы объектов: платформ (наборы кубов), шипов и монет
var platforms = []; // каждая платформа: {x, y, blocks, w, h}
// Шипы будут рисоваться как треугольники на уровне земли
var spikes = [];    // каждый шип: {x, size}
// Монеты (увеличены до 50×50)
var coins = [];     // каждый объект: {x, y, size}

// Фон – создаем линейный градиент от верха до уровня земли
var bgFill = c.createLinearGradient(W/2, 0, W/2, groundY);
bgFill.addColorStop(0, "#0c48db");
bgFill.addColorStop(1, "#5785f6");

// Заливка земли (возвышенная земля)
var floorFill = c.createLinearGradient(W/2, groundY, W/2, H);
floorFill.addColorStop(0, "#0c48db");
floorFill.addColorStop(1, "#171717");

// Загрузка текстуры для кубов платформ (изображение wall1.jpg размером 300×300)
var platformImg = new Image();
platformImg.crossOrigin = "anonymous";
platformImg.src = "wall1.jpg";

// --- Основной цикл рендеринга ---
function render() {
    frame++;
    // Отрисовка фона (только до земли)
    c.fillStyle = bgFill;
    c.fillRect(0, 0, W, groundY);
    
    // Отрисовка земли (возвышенной, толстый пол)
    c.fillStyle = floorFill;
    c.fillRect(0, groundY, W, groundHeight);
    
    // Физика игрока
    if(!player.dead) {
        player.y += player.yVel;
        player.yVel += gravity;
        if(player.y + player.h >= groundY){
            player.y = groundY - player.h;
            player.yVel = 0;
            player.onGrnd = true;
        }
    }
    
    // Обновляем и отрисовываем платформы (каждая платформа – набор кубов)
    for(var i = 0; i < platforms.length; i++){
        var plat = platforms[i];
        plat.x -= player.xVel; // движение платформ влево
        // Рисуем каждый куб платформы с текстурой
        for(var j = 0; j < plat.blocks; j++){
            var cubeX = plat.x + j * cell;
            if(platformImg.complete){
                // Масштабируем текстуру: берем исходный размер (300×300) и рисуем в размере cell×cell
                c.drawImage(platformImg, 0, 0, 300, 300, cubeX, plat.y, cell, cell);
            } else {
                c.fillStyle = "#8B4513";
                c.fillRect(cubeX, plat.y, cell, cell);
            }
        }
    }
    // Удаляем платформы, вышедшие за левую границу
    platforms = platforms.filter(plat => plat.x + plat.blocks * cell > 0);
    
    // Обновляем и отрисовываем шипы (спайки)
    for(var i = 0; i < spikes.length; i++){
        var sp = spikes[i];
        sp.x -= player.xVel;
        // Рисуем шип как черный треугольник (вершина направлена вверх)
        c.fillStyle = "black";
        c.beginPath();
        c.moveTo(sp.x, groundY - sp.size);       // вершина
        c.lineTo(sp.x + sp.size/2, groundY);       // нижний правый угол
        c.lineTo(sp.x - sp.size/2, groundY);       // нижний левый угол
        c.closePath();
        c.fill();
    }
    spikes = spikes.filter(sp => sp.x + sp.size > 0);
    
    // Обновляем и отрисовываем монеты
    for(var i = 0; i < coins.length; i++){
        var coin = coins[i];
        coin.x -= player.xVel;
        // Рисуем монету как желтый круг
        c.fillStyle = "yellow";
        c.beginPath();
        c.arc(coin.x, coin.y, coin.size/2, 0, Math.PI*2);
        c.fill();
    }
    coins = coins.filter(coin => coin.x + coin.size > 0);
    
    // Проверка столкновения игрока с шипами
    for(var i = 0; i < spikes.length; i++){
        var sp = spikes[i];
        // Простейшая проверка по прямоугольнику вокруг шипа
        if(player.x < sp.x + sp.size &&
           player.x + player.w > sp.x - sp.size/2 &&
           player.y + player.h > groundY - sp.size){
            player.dead = true;
        }
    }
    
    // Проверка подбора монет (прямоугольное пересечение)
    for(var i = 0; i < coins.length; i++){
        var coin = coins[i];
        if(player.x < coin.x + coin.size &&
           player.x + player.w > coin.x - coin.size &&
           player.y < coin.y + coin.size &&
           player.y + player.h > coin.y - coin.size){
               score++;
               coins.splice(i, 1);
               i--;
        }
    }
    
    // Отрисовка игрока (простой квадрат, можно добавить вращение по yVel)
    c.fillStyle = "#f2b826";
    c.save();
    // Опциональное вращение: угол зависит от скорости прыжка
    var rot = (player.yVel / player.minYVel) * -90;
    c.translate(player.x + player.w/2, player.y + player.h/2);
    c.rotate(rot * Math.PI/180);
    c.fillRect(-player.w/2, -player.h/2, player.w, player.h);
    c.restore();
    
    // Обновление счета и сложности
    if(frame % framesPerPt === framesPerPt - 1 && !player.dead) score++;
    if(frame % (100 * framesPerPt) === 0 && difficulty <= 9) difficulty++;
    
    // Генерация новых объектов
    // Если последняя платформа далеко от правого края, создаем новую
    if(platforms.length === 0 || (platforms[platforms.length - 1].x + platforms[platforms.length - 1].blocks * cell < W)){
        // Задаем случайный промежуток (в клетках)
        var gap = rand(0, 3) * cell;
        // Количество кубов платформы от 1 до 3
        var blocks = rand(1, 3);
        // В 70% случаев платформа на земле, в 30% – немного приподнятая (до 3 клеток вверх)
        var pY = (Math.random() < 0.7) ? groundY - cell : groundY - cell - rand(1,3) * cell;
        platforms.push({x: W + gap, y: pY, blocks: blocks, w: blocks * cell, h: cell});
        
        // Шипы: с вероятностью 50% добавляем шип, расположенный на уровне земли
        if(Math.random() < 0.5){
            spikes.push({x: W + gap + rand(0, blocks * cell), size: 30});
        }
        
        // Монеты: с вероятностью 70% добавляем монету выше платформы
        if(Math.random() < 0.7){
            coins.push({x: W + gap + rand(0, blocks * cell), y: pY - cell, size: 50});
        }
    }
    
    // Отрисовка счета
    c.fillStyle = "#f1f1f1";
    c.font = "bold 40px Calibri, sans-serif";
    c.textAlign = "center";
    c.fillText(score, W/2, cell * 1.5);
    
    requestAnimationFrame(render);
}

// Обработчики прыжка (клик по холсту или пробел)
C.addEventListener("click", function(){
    if(player.onGrnd && !player.dead) player.jump();
});
document.addEventListener("keydown", function(e){
    if(e.code === "Space" && player.onGrnd && !player.dead) player.jump();
});

// Функция сброса игры
function resetGame() {
    score = 0;
    frame = 0;
    difficulty = 1;
    player.x = cell * 2;
    player.y = groundY - cell;
    player.xVel = 4;
    player.yVel = 0;
    player.dead = false;
    platforms = [];
    spikes = [];
    coins = [];
    // Создаем начальную платформу, которая покрывает весь экран (чтобы игрок сразу стоял на чем-то)
    platforms.push({x: -1, y: groundY - cell, blocks: 10, w: W + 2, h: cell});
}

resetGame();
render();
