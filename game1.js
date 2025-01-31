let match3Interval = null;
let match3Ctx = null;
let match3TimeLeft = 60; // 1 минута
let match3TimerElement = null;

/**
 * Инициализация игры "3 в ряд"
 */
function initGame2() {
  const canvas = document.getElementById('match3Canvas');
  match3Ctx = canvas.getContext('2d');
  match3TimerElement = document.getElementById('match3Timer');

  // Сброс значений игры
  match3TimeLeft = 60;
  updateMatch3Timer();

  // Запуск таймера
  match3Interval = setInterval(() => {
    match3TimeLeft--;
    updateMatch3Timer();
    if (match3TimeLeft <= 0) {
      endMatch3Game();
    }
  }, 1000);

  // Запуск игрового цикла
  match3GameLoop();
}

/**
 * Обновление отображения таймера
 */
function updateMatch3Timer() {
  if (match3TimerElement) {
    match3TimerElement.textContent = `Время: ${match3TimeLeft} сек`;
  }
}

/**
 * Завершение игры "3 в ряд"
 */
function endMatch3Game() {
  clearInterval(match3Interval);
  match3Interval = null;
  showGlobalModal('Время вышло!', 'Игра "3 в ряд" завершена.');
  resetGame2();
}

/**
 * Завершение игры и возврат к главному экрану
 */
function resetGame2() {
  if (match3Interval) {
    clearInterval(match3Interval);
    match3Interval = null;
  }
  match3Ctx = null;
  document.getElementById('match3Canvas').style.display = 'none';
  document.getElementById('match3Timer').style.display = 'none';
  // Отображение кнопки закрытия после завершения игры
  document.querySelector('.game-close-button').style.display = 'block';
}

/**
 * Игровой цикл для Match-3 (пример)
 */
function match3GameLoop() {
  if (!match3Ctx) return;

  // Здесь должна быть логика вашей игры "3 в ряд"
  // Например, обновление состояния доски, проверка на совпадения и т.д.

  // Для примера просто очищаем и закрашиваем канвас
  match3Ctx.clearRect(0, 0, 800, 800);
  match3Ctx.fillStyle = '#00FF00';
  match3Ctx.fillRect(0, 0, 800, 800);

  // Продолжаем игровой цикл
  requestAnimationFrame(match3GameLoop);
}
