// Core game state values.
const gameState = {
  score: 0,
  lives: 3,
  fill: 0,
  level: 1,
  maxLevels: 10,
  running: false,
  paused: false,
  spawnIntervalMs: 900,
  dropSpeedBase: 90,
  speedIncreasePerSecond: 2,
  startTime: 0,
  canX: 0,
  canSpeed: 420
};

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const gameArea = document.getElementById("gameArea");
const waterCan = document.getElementById("waterCan");
const pauseOverlay = document.getElementById("pauseOverlay");

const levelValue = document.getElementById("levelValue");
const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");
const fillValue = document.getElementById("fillValue");
const fillBar = document.getElementById("fillBar");
const endTitle = document.getElementById("endTitle");
const finalScore = document.getElementById("finalScore");
const celebrationLayer = document.getElementById("celebrationLayer");

const startButton = document.getElementById("startButton");
const howToPlayButton = document.getElementById("howToPlayButton");
const howToPlayPanel = document.getElementById("howToPlayPanel");
const pauseButton = document.getElementById("pauseButton");
const menuButton = document.getElementById("menuButton");
const playAgainButton = document.getElementById("playAgainButton");
const endMenuButton = document.getElementById("endMenuButton");

let drops = [];
let lastFrameTime = 0;
let animationId = null;
let spawnTimerId = null;
const pressedKeys = {
  left: false,
  right: false
};
let canReactionTimerId = null;

function clearCelebration() {
  celebrationLayer.innerHTML = "";
  endScreen.classList.remove("win-screen");
}

function launchCelebration() {
  clearCelebration();
  endScreen.classList.add("win-screen");

  const confettiColors = ["#16a34a", "#ef4444", "#f59e0b", "#3b82f6", "#22c55e"];
  const pieceCount = 90;

  for (let i = 0; i < pieceCount; i += 1) {
    const piece = document.createElement("span");
    piece.classList.add("confetti-piece");

    piece.style.left = (Math.random() * 100) + "%";
    piece.style.backgroundColor = confettiColors[i % confettiColors.length];
    piece.style.animationDuration = (2.2 + (Math.random() * 1.7)) + "s";
    piece.style.animationDelay = (Math.random() * 0.55) + "s";
    piece.style.transform = "rotate(" + (Math.random() * 360) + "deg)";

    celebrationLayer.appendChild(piece);
  }
}

function showScreen(screenElement) {
  startScreen.classList.remove("active");
  gameScreen.classList.remove("active");
  endScreen.classList.remove("active");
  screenElement.classList.add("active");
}

function updateHud() {
  levelValue.textContent = gameState.level;
  scoreValue.textContent = gameState.score;
  livesValue.textContent = gameState.lives;
  fillValue.textContent = Math.floor(gameState.fill);
  fillBar.style.width = gameState.fill + "%";
}

function updateWaterCanPosition() {
  const maxCanX = gameArea.clientWidth - waterCan.offsetWidth;
  gameState.canX = Math.max(0, Math.min(gameState.canX, maxCanX));
  waterCan.style.left = gameState.canX + "px";
}

function clearCanReaction() {
  waterCan.classList.remove("react-good", "react-bad");

  if (canReactionTimerId) {
    clearTimeout(canReactionTimerId);
    canReactionTimerId = null;
  }
}

function triggerCanReaction(isGoodCatch) {
  clearCanReaction();

  const reactionClass = isGoodCatch ? "react-good" : "react-bad";

  // Force reflow so repeated catches restart the tween.
  void waterCan.offsetWidth;
  waterCan.classList.add(reactionClass);

  canReactionTimerId = setTimeout(() => {
    waterCan.classList.remove(reactionClass);
    canReactionTimerId = null;
  }, 260);
}

function applyLevelSettings() {
  gameState.spawnIntervalMs = Math.max(420, 920 - ((gameState.level - 1) * 180));
  gameState.dropSpeedBase = 95 + ((gameState.level - 1) * 35);
  gameState.speedIncreasePerSecond = 2 + ((gameState.level - 1) * 0.7);
}

function resetGame() {
  gameState.score = 0;
  gameState.lives = 3;
  gameState.fill = 0;
  gameState.level = 1;
  gameState.running = true;
  gameState.paused = false;
  gameState.startTime = performance.now();
  applyLevelSettings();
  clearCanReaction();
  clearCelebration();

  drops = [];

  for (const drop of gameArea.querySelectorAll(".drop")) {
    drop.remove();
  }

  updateHud();
  showScreen(gameScreen);
  pauseOverlay.classList.remove("active");
  pauseButton.textContent = "Pause";

  gameState.canX = (gameArea.clientWidth / 2) - (waterCan.offsetWidth / 2);
  updateWaterCanPosition();

  startSpawning();

  lastFrameTime = performance.now();
  animationId = requestAnimationFrame(gameLoop);
}

function startSpawning() {
  if (spawnTimerId) {
    clearInterval(spawnTimerId);
  }

  spawnTimerId = setInterval(() => {
    if (gameState.running && !gameState.paused) {
      createDrop();
    }
  }, gameState.spawnIntervalMs);
}

function createDrop() {
  const dropElement = document.createElement("div");
  const superDropChance = 0.03;
  const cleanDropChance = 0.74;
  const roll = Math.random();
  let type = "bad";

  if (roll < superDropChance) {
    type = "super";
  } else if (roll < superDropChance + cleanDropChance) {
    type = "clean";
  }

  dropElement.classList.add("drop", type);

  const gameAreaWidth = gameArea.clientWidth;
  const dropSize = 26;
  const startX = Math.random() * (gameAreaWidth - dropSize);

  const elapsedSeconds = (performance.now() - gameState.startTime) / 1000;
  const speed = gameState.dropSpeedBase + (elapsedSeconds * gameState.speedIncreasePerSecond);

  const dropData = {
    element: dropElement,
    type,
    x: startX,
    y: -30,
    speed
  };

  dropElement.style.left = dropData.x + "px";
  dropElement.style.top = dropData.y + "px";

  gameArea.appendChild(dropElement);
  drops.push(dropData);
}

function handleCatch(drop) {
  const isPositiveDrop = drop.type === "clean" || drop.type === "super";
  triggerCanReaction(isPositiveDrop);

  if (drop.type === "super") {
    gameState.lives += 1;
    gameState.score += 10;
    gameState.fill = Math.min(100, gameState.fill + 10);
  } else if (drop.type === "clean") {
    gameState.score += 10;
    gameState.fill = Math.min(100, gameState.fill + 10);
  } else {
    gameState.lives -= 1;
    gameState.score = Math.max(0, gameState.score - 10);
  }

  updateHud();
  removeDrop(drop, true);

  if (gameState.lives <= 0) {
    endGame(false);
    return;
  }

  if (gameState.fill >= 100) {
    if (gameState.level >= gameState.maxLevels) {
      endGame(true);
      return;
    }

    advanceLevel();
  }
}

function advanceLevel() {
  gameState.level += 1;
  gameState.fill = 0;
  gameState.startTime = performance.now();
  applyLevelSettings();
  startSpawning();

  for (const drop of drops) {
    if (drop.element.parentNode) {
      drop.element.parentNode.removeChild(drop.element);
    }
  }
  drops = [];

  updateHud();
}

function removeDrop(drop, withFade) {
  const dropIndex = drops.indexOf(drop);
  if (dropIndex === -1) {
    return;
  }

  drops.splice(dropIndex, 1);

  if (withFade) {
    drop.element.classList.add("popped");
    setTimeout(() => {
      if (drop.element.parentNode) {
        drop.element.parentNode.removeChild(drop.element);
      }
    }, 160);
  } else if (drop.element.parentNode) {
    drop.element.parentNode.removeChild(drop.element);
  }
}

function gameLoop(currentTime) {
  if (!gameState.running) {
    return;
  }

  if (gameState.paused) {
    lastFrameTime = currentTime;
    animationId = requestAnimationFrame(gameLoop);
    return;
  }

  const deltaTime = (currentTime - lastFrameTime) / 1000;
  lastFrameTime = currentTime;

  if (pressedKeys.left) {
    gameState.canX -= gameState.canSpeed * deltaTime;
  }
  if (pressedKeys.right) {
    gameState.canX += gameState.canSpeed * deltaTime;
  }
  updateWaterCanPosition();

  const gameAreaHeight = gameArea.clientHeight;
  const canTop = gameArea.clientHeight - waterCan.offsetHeight - 8;
  const canLeft = gameState.canX;
  const canRight = gameState.canX + waterCan.offsetWidth;
  const canBottom = canTop + waterCan.offsetHeight;

  for (let i = drops.length - 1; i >= 0; i -= 1) {
    const drop = drops[i];
    if (!drop) {
      continue;
    }

    drop.y += drop.speed * deltaTime;
    drop.element.style.top = drop.y + "px";

    const dropLeft = drop.x;
    const dropRight = drop.x + drop.element.offsetWidth;
    const dropTop = drop.y;
    const dropBottom = drop.y + drop.element.offsetHeight;

    const intersectsCan =
      dropRight > canLeft &&
      dropLeft < canRight &&
      dropBottom > canTop &&
      dropTop < canBottom;

    if (intersectsCan) {
      handleCatch(drop);

      if (!gameState.running) {
        break;
      }

      continue;
    }

    if (drop.y > gameAreaHeight) {
      // Missed drops disappear with no penalty.
      removeDrop(drop, false);
    }
  }

  animationId = requestAnimationFrame(gameLoop);
}

function endGame(didWin) {
  gameState.running = false;

  if (spawnTimerId) {
    clearInterval(spawnTimerId);
    spawnTimerId = null;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  for (const drop of drops) {
    if (drop.element.parentNode) {
      drop.element.parentNode.removeChild(drop.element);
    }
  }
  drops = [];

  endTitle.textContent = didWin ? "You Win!" : "Game Over";
  finalScore.textContent = gameState.score;
  showScreen(endScreen);

  if (didWin) {
    launchCelebration();
  } else {
    clearCelebration();
  }
}

function setPausedState(paused) {
  if (!gameState.running) {
    return;
  }

  gameState.paused = paused;

  if (gameState.paused) {
    pauseOverlay.classList.add("active");
    pauseButton.textContent = "Resume";
  } else {
    pauseOverlay.classList.remove("active");
    pauseButton.textContent = "Pause";
  }
}

function returnToMainMenu() {
  gameState.running = false;
  gameState.paused = false;
  pressedKeys.left = false;
  pressedKeys.right = false;

  if (spawnTimerId) {
    clearInterval(spawnTimerId);
    spawnTimerId = null;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  for (const drop of drops) {
    if (drop.element.parentNode) {
      drop.element.parentNode.removeChild(drop.element);
    }
  }
  drops = [];
  clearCanReaction();
  clearCelebration();

  pauseOverlay.classList.remove("active");
  pauseButton.textContent = "Pause";
  showScreen(startScreen);
}

startButton.addEventListener("click", resetGame);
playAgainButton.addEventListener("click", resetGame);
howToPlayButton.addEventListener("click", () => {
  howToPlayPanel.classList.toggle("active");
});
pauseButton.addEventListener("click", () => {
  if (!gameState.running) {
    return;
  }
  setPausedState(!gameState.paused);
});
menuButton.addEventListener("click", returnToMainMenu);
endMenuButton.addEventListener("click", returnToMainMenu);

document.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();

  if (event.key === "ArrowLeft" || key === "a") {
    event.preventDefault();
    pressedKeys.left = true;
  }
  if (event.key === "ArrowRight" || key === "d") {
    event.preventDefault();
    pressedKeys.right = true;
  }
});

document.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();

  if (event.key === "ArrowLeft" || key === "a") {
    event.preventDefault();
    pressedKeys.left = false;
  }
  if (event.key === "ArrowRight" || key === "d") {
    event.preventDefault();
    pressedKeys.right = false;
  }
});
