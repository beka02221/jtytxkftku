// game2.js – «3 в ряд» на Phaser 3 с пользовательскими фигурами

let phaserGame2 = null;

let gameOptions = {
    gemSize: 40,
    swapSpeed: 200,
    fallSpeed: 100,
    destroySpeed: 200,
    boardOffset: { x: 0, y: 0 }
};

// Функция-обёртка для создания текстур с фигурами
function createGemTextures(scene) {
    const gemSize = gameOptions.gemSize;
    const colors = [0xffa500, 0x00ff00, 0x1e90ff, 0xff1493, 0xffff00, 0x00ffff];

    let graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // Gem 0: звезда
    drawStar(graphics, gemSize/2, gemSize/2, 5, gemSize/2 - 2, gemSize/4, colors[0]);
    graphics.generateTexture("gem0", gemSize, gemSize);
    graphics.clear();

    // Gem 1: круг
    graphics.fillStyle(colors[1], 1);
    graphics.fillCircle(gemSize/2, gemSize/2, gemSize/2 - 2);
    graphics.generateTexture("gem1", gemSize, gemSize);
    graphics.clear();

    // Gem 2: ромб
    graphics.fillStyle(colors[2], 1);
    let diamondPoints = [
        { x: gemSize/2, y: 2 },
        { x: gemSize-2, y: gemSize/2 },
        { x: gemSize/2, y: gemSize-2 },
        { x: 2, y: gemSize/2 }
    ];
    graphics.beginPath();
    graphics.moveTo(diamondPoints[0].x, diamondPoints[0].y);
    for (let i = 1; i < diamondPoints.length; i++) {
        graphics.lineTo(diamondPoints[i].x, diamondPoints[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture("gem2", gemSize, gemSize);
    graphics.clear();

    // Gem 3: треугольник
    graphics.fillStyle(colors[3], 1);
    graphics.beginPath();
    graphics.moveTo(gemSize/2, 2);
    graphics.lineTo(gemSize-2, gemSize-2);
    graphics.lineTo(2, gemSize-2);
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture("gem3", gemSize, gemSize);
    graphics.clear();

    // Gem 4: квадрат
    graphics.fillStyle(colors[4], 1);
    graphics.fillRect(2, 2, gemSize-4, gemSize-4);
    graphics.generateTexture("gem4", gemSize, gemSize);
    graphics.clear();

    // Gem 5: шестиугольник
    graphics.fillStyle(colors[5], 1);
    let hexagonPoints = [];
    let centerX = gemSize/2, centerY = gemSize/2, radius = gemSize/2 - 2;
    for (let i = 0; i < 6; i++) {
        let angle = Phaser.Math.DegToRad(60 * i - 30);
        hexagonPoints.push({ x: centerX + radius * Math.cos(angle), y: centerY + radius * Math.sin(angle) });
    }
    graphics.beginPath();
    graphics.moveTo(hexagonPoints[0].x, hexagonPoints[0].y);
    for (let i = 1; i < hexagonPoints.length; i++) {
        graphics.lineTo(hexagonPoints[i].x, hexagonPoints[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.generateTexture("gem5", gemSize, gemSize);
    graphics.destroy();
}

// Функция для отрисовки звезды с помощью Graphics
function drawStar(graphics, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    graphics.fillStyle(color, 1);
    graphics.beginPath();
    graphics.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        graphics.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        graphics.lineTo(x, y);
        rot += step;
    }
    graphics.lineTo(cx, cy - outerRadius);
    graphics.closePath();
    graphics.fillPath();
}

// Функция, вызываемая из index.html для запуска игры Match-3
function initGame2() {
    let config = {
        type: Phaser.AUTO,
        width: gameOptions.gemSize * 8,    // 8 столбцов
        height: gameOptions.gemSize * 8,   // 8 строк
        parent: "match3Canvas",
        scene: PlayGame,
        backgroundColor: 0x222222
    };
    phaserGame2 = new Phaser.Game(config);
}

// Функция для завершения игры Match-3 (вызывается при окончании таймера)
function resetGame2() {
    if (phaserGame2) {
        phaserGame2.destroy(true);
        phaserGame2 = null;
    }
}


// Класс сцены для игры «3 в ряд»
class PlayGame extends Phaser.Scene {
    constructor() {
        super("PlayGame");
    }
    preload() {
        // Создадим текстуры для gem-ов
        createGemTextures(this);
    }
    create() {
        // Создаем игровое поле Match3 с 8 строками, 8 столбцами, 6 типами
        this.match3 = new Match3({ rows: 8, columns: 8, items: 6 });
        this.match3.generateField();
        this.canPick = true;
        this.dragging = false;
        this.drawField();
        this.input.on("pointerdown", this.gemSelect, this);
    }
    drawField() {
        // Для хранения отрисованных объектов (sprites)
        this.fieldSprites = [];
        for (let i = 0; i < this.match3.getRows(); i++) {
            this.fieldSprites[i] = [];
            for (let j = 0; j < this.match3.getColumns(); j++) {
                let gemX = gameOptions.boardOffset.x + gameOptions.gemSize * j + gameOptions.gemSize / 2;
                let gemY = gameOptions.boardOffset.y + gameOptions.gemSize * i + gameOptions.gemSize / 2;
                // Используем текстуру "gem" + значение
                let gem = this.add.sprite(gemX, gemY, "gem" + this.match3.valueAt(i, j));
                gem.setInteractive();
                this.match3.setCustomData(i, j, gem);
                this.fieldSprites[i][j] = gem;
            }
        }
    }
    gemSelect(pointer) {
        if (this.canPick) {
            this.dragging = true;
            let row = Math.floor((pointer.y - gameOptions.boardOffset.y) / gameOptions.gemSize);
            let col = Math.floor((pointer.x - gameOptions.boardOffset.x) / gameOptions.gemSize);
            if (this.match3.validPick(row, col)) {
                let selectedGem = this.match3.getSelectedItem();
                if (!selectedGem) {
                    this.match3.customDataOf(row, col).setScale(1.2);
                    this.match3.customDataOf(row, col).setDepth(1);
                    this.match3.setSelectedItem(row, col);
                } else {
                    if (this.match3.areTheSame(row, col, selectedGem.row, selectedGem.column)) {
                        this.match3.customDataOf(row, col).setScale(1);
                        this.match3.deleselectItem();
                    } else {
                        if (this.match3.areNext(row, col, selectedGem.row, selectedGem.column)) {
                            this.match3.customDataOf(selectedGem.row, selectedGem.column).setScale(1);
                            this.match3.deleselectItem();
                            this.swapGems(row, col, selectedGem.row, selectedGem.column, true);
                        } else {
                            this.match3.customDataOf(selectedGem.row, selectedGem.column).setScale(1);
                            this.match3.customDataOf(row, col).setScale(1.2);
                            this.match3.setSelectedItem(row, col);
                        }
                    }
                }
            }
        }
    }
    swapGems(row, col, row2, col2, swapBack) {
        let movements = this.match3.swapItems(row, col, row2, col2);
        this.swappingGems = 2;
        this.canPick = false;
        movements.forEach(function(movement) {
            this.tweens.add({
                targets: this.match3.customDataOf(movement.row, movement.column),
                x: this.match3.customDataOf(movement.row, movement.column).x + gameOptions.gemSize * movement.deltaColumn,
                y: this.match3.customDataOf(movement.row, movement.column).y + gameOptions.gemSize * movement.deltaRow,
                duration: gameOptions.swapSpeed,
                callbackScope: this,
                onComplete: function() {
                    this.swappingGems--;
                    if (this.swappingGems === 0) {
                        if (!this.match3.matchInBoard()) {
                            if (swapBack) {
                                this.swapGems(row, col, row2, col2, false);
                            } else {
                                this.canPick = true;
                            }
                        } else {
                            this.handleMatches();
                        }
                    }
                }
            });
        }, this);
    }
    handleMatches() {
        let gemsToRemove = this.match3.getMatchList();
        let destroyed = 0;
        gemsToRemove.forEach(function(gem) {
            destroyed++;
            this.tweens.add({
                targets: this.match3.customDataOf(gem.row, gem.column),
                alpha: 0,
                duration: gameOptions.destroySpeed,
                callbackScope: this,
                onComplete: function() {
                    destroyed--;
                    if (destroyed === 0) {
                        this.makeGemsFall();
                    }
                }
            });
        }, this);
    }
    makeGemsFall() {
        let moved = 0;
        this.match3.removeMatches();
        let fallingMovements = this.match3.arrangeBoardAfterMatch();
        fallingMovements.forEach(function(movement) {
            moved++;
            this.tweens.add({
                targets: this.match3.customDataOf(movement.row, movement.column),
                y: this.match3.customDataOf(movement.row, movement.column).y + movement.deltaRow * gameOptions.gemSize,
                duration: gameOptions.fallSpeed * Math.abs(movement.deltaRow),
                callbackScope: this,
                onComplete: function() {
                    moved--;
                    if (moved === 0) {
                        this.endOfMove();
                    }
                }
            });
        }, this);
        let replenishMovements = this.match3.replenishBoard();
        replenishMovements.forEach(function(movement) {
            moved++;
            let sprite = this.add.sprite(
                gameOptions.boardOffset.x + gameOptions.gemSize * movement.column + gameOptions.gemSize / 2,
                gameOptions.boardOffset.y + gameOptions.gemSize * (movement.row - movement.deltaRow) + gameOptions.gemSize / 2,
                "gem" + this.match3.valueAt(movement.row, movement.column)
            );
            sprite.alpha = 0;
            this.match3.setCustomData(movement.row, movement.column, sprite);
            this.tweens.add({
                targets: sprite,
                alpha: 1,
                y: gameOptions.boardOffset.y + gameOptions.gemSize * movement.row + gameOptions.gemSize / 2,
                duration: gameOptions.fallSpeed * movement.deltaRow,
                callbackScope: this,
                onComplete: function() {
                    moved--;
                    if (moved === 0) {
                        this.endOfMove();
                    }
                }
            });
        }, this);
    }
    endOfMove() {
        if (this.match3.matchInBoard()) {
            this.time.addEvent({
                delay: 250,
                callback: this.handleMatches,
                callbackScope: this
            });
        } else {
            this.canPick = true;
            this.match3.deleselectItem();
        }
    }
}

// Класс логики Match3 (упрощённый вариант)
// Этот класс реализует генерацию поля, проверку совпадений, обмен элементов и пополнение пустых мест.
class Match3 {
    constructor(obj) {
        this.rows = obj.rows;
        this.columns = obj.columns;
        this.items = obj.items;
    }
    generateField() {
        this.gameArray = [];
        this.selectedItem = false;
        for (let i = 0; i < this.rows; i++) {
            this.gameArray[i] = [];
            for (let j = 0; j < this.columns; j++) {
                do {
                    let randomValue = Math.floor(Math.random() * this.items);
                    this.gameArray[i][j] = { value: randomValue, isEmpty: false, row: i, column: j };
                } while (this.isPartOfMatch(i, j));
            }
        }
    }
    getRows() { return this.rows; }
    getColumns() { return this.columns; }
    valueAt(row, column) {
        if (!this.validPick(row, column)) return false;
        return this.gameArray[row][column].value;
    }
    validPick(row, column) {
        return row >= 0 && row < this.rows && column >= 0 && column < this.columns;
    }
    setCustomData(row, column, customData) {
        this.gameArray[row][column].customData = customData;
    }
    customDataOf(row, column) {
        return this.gameArray[row][column].customData;
    }
    getSelectedItem() {
        return this.selectedItem;
    }
    setSelectedItem(row, column) {
        this.selectedItem = { row: row, column: column };
    }
    deleselectItem() {
        this.selectedItem = false;
    }
    areTheSame(row, column, row2, column2) {
        return row === row2 && column === column2;
    }
    areNext(row, column, row2, column2) {
        return Math.abs(row - row2) + Math.abs(column - column2) === 1;
    }
    isPartOfHorizontalMatch(row, column) {
        return (this.valueAt(row, column) === this.valueAt(row, column - 1) &&
                this.valueAt(row, column) === this.valueAt(row, column - 2)) ||
               (this.valueAt(row, column) === this.valueAt(row, column + 1) &&
                this.valueAt(row, column) === this.valueAt(row, column + 2)) ||
               (this.valueAt(row, column) === this.valueAt(row, column - 1) &&
                this.valueAt(row, column) === this.valueAt(row, column + 1));
    }
    isPartOfVerticalMatch(row, column) {
        return (this.valueAt(row, column) === this.valueAt(row - 1, column) &&
                this.valueAt(row, column) === this.valueAt(row - 2, column)) ||
               (this.valueAt(row, column) === this.valueAt(row + 1, column) &&
                this.valueAt(row, column) === this.valueAt(row + 2, column)) ||
               (this.valueAt(row, column) === this.valueAt(row - 1, column) &&
                this.valueAt(row, column) === this.valueAt(row + 1, column));
    }
    isPartOfMatch(row, column) {
        return this.isPartOfHorizontalMatch(row, column) || this.isPartOfVerticalMatch(row, column);
    }
    matchInBoard() {
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                if (this.isPartOfMatch(i, j)) return true;
            }
        }
        return false;
    }
    getMatchList() {
        let matches = [];
        for (let i = 0; i < this.rows; i++) {
            for (let j = 0; j < this.columns; j++) {
                if (this.isPartOfMatch(i, j)) {
                    matches.push({ row: i, column: j });
                }
            }
        }
        return matches;
    }
    removeMatches() {
        let matches = this.getMatchList();
        matches.forEach(function(item) {
            this.setEmpty(item.row, item.column);
        }, this);
    }
    setEmpty(row, column) {
        this.gameArray[row][column].isEmpty = true;
    }
    isEmpty(row, column) {
        return this.gameArray[row][column].isEmpty;
    }
    emptySpacesBelow(row, column) {
        let result = 0;
        for (let i = row + 1; i < this.rows; i++) {
            if (this.isEmpty(i, column)) result++;
        }
        return result;
    }
    arrangeBoardAfterMatch() {
        let result = [];
        for (let i = this.rows - 2; i >= 0; i--) {
            for (let j = 0; j < this.columns; j++) {
                let emptySpaces = this.emptySpacesBelow(i, j);
                if (!this.isEmpty(i, j) && emptySpaces > 0) {
                    this.swapItems(i, j, i + emptySpaces, j);
                    result.push({
                        row: i + emptySpaces,
                        column: j,
                        deltaRow: emptySpaces,
                        deltaColumn: 0
                    });
                }
            }
        }
        return result;
    }
    replenishBoard() {
        let result = [];
        for (let j = 0; j < this.columns; j++) {
            if (this.isEmpty(0, j)) {
                let emptySpaces = this.emptySpacesBelow(0, j) + 1;
                for (let i = 0; i < emptySpaces; i++) {
                    let randomValue = Math.floor(Math.random() * this.items);
                    result.push({
                        row: i,
                        column: j,
                        deltaRow: emptySpaces
                    });
                    this.gameArray[i][j].value = randomValue;
                    this.gameArray[i][j].isEmpty = false;
                }
            }
        }
        return result;
    }
    swapItems(row, column, row2, column2) {
        let tempObject = Object.assign({}, this.gameArray[row][column]);
        this.gameArray[row][column] = Object.assign({}, this.gameArray[row2][column2]);
        this.gameArray[row2][column2] = tempObject;
        return [{
            row: row,
            column: column,
            deltaRow: row - row2,
            deltaColumn: column - column2
        },
        {
            row: row2,
            column: column2,
            deltaRow: row2 - row,
            deltaColumn: column2 - column
        }];
    }
    setSelectedItem(row, column) {
        this.selectedItem = { row: row, column: column };
    }
    getSelectedItem() {
        return this.selectedItem;
    }
    deleselectItem() {
        this.selectedItem = false;
    }
}
