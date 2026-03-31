// Difficulty configuration drives target score, timer, and drop behavior.
const difficultySettings = {
  easy: {
    label: "Easy",
    timeLimit: 75,
    targetScore: 180,
    spawnIntervalMs: 980,
    dropSpeedBase: 85,
    speedIncreasePerSecond: 1.6,
    superDropChance: 0.05,
    cleanDropChance: 0.78,
    description: "Longer timer, lower target score, and slower drops."
  },
  normal: {
    label: "Normal",
    timeLimit: 60,
    targetScore: 240,
    spawnIntervalMs: 840,
    dropSpeedBase: 105,
    speedIncreasePerSecond: 2.2,
    superDropChance: 0.035,
    cleanDropChance: 0.73,
    description: "Balanced timer and score target for standard play."
  },
  hard: {
    label: "Hard",
    timeLimit: 45,
    targetScore: 320,
    spawnIntervalMs: 690,
    dropSpeedBase: 130,
    speedIncreasePerSecond: 2.9,
    superDropChance: 0.02,
    cleanDropChance: 0.68,
    description: "Short timer, higher target score, and faster spawns."
  }
};

const milestones = [
  { score: 10, message: "Halfway there!" },
  { score: 20, message: "Nice work!" }
];

const gameState = {
  score: 0,
  lives: 3,
  fill: 0,
  running: false,
  paused: false,
  startTime: 0,
  canX: 0,
  canSpeed: 420,
  timeRemaining: difficultySettings.normal.timeLimit,
  selectedDifficulty: "normal",
  activeDifficulty: difficultySettings.normal,
  cleanCaught: 0,
  superCaught: 0
};

const startScreen = document.getElementById("startScreen");
const gameScreen = document.getElementById("gameScreen");
const endScreen = document.getElementById("endScreen");
const gameArea = document.getElementById("gameArea");
const waterCan = document.getElementById("waterCan");
const pauseOverlay = document.getElementById("pauseOverlay");
const milestoneMessage = document.getElementById("milestoneMessage");

const scoreValue = document.getElementById("scoreValue");
const livesValue = document.getElementById("livesValue");
const fillValue = document.getElementById("fillValue");
const fillBar = document.getElementById("fillBar");
const difficultyValue = document.getElementById("difficultyValue");
const targetValue = document.getElementById("targetValue");
const timeValue = document.getElementById("timeValue");
const objectivesList = document.getElementById("objectivesList");
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
const difficultyDescription = document.getElementById("difficultyDescription");
const difficultyButtons = document.querySelectorAll(".difficulty-button");

let drops = [];
let lastFrameTime = 0;
let animationId = null;
let spawnTimerId = null;
let timerIntervalId = null;
let canReactionTimerId = null;
let milestoneTimerId = null;

const triggeredMilestones = new Set();
const pressedKeys = {
  left: false,
  right: false
};

const soundState = {
  ready: false,
  sounds: {},
  lastPlayByType: {},
  minGapMs: {
    button: 70,
    collect: 90,
    miss: 170,
    win: 600
  }
};

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
  scoreValue.textContent = gameState.score + "/" + gameState.activeDifficulty.targetScore;
  livesValue.textContent = gameState.lives;
  fillValue.textContent = Math.floor(gameState.fill);
  fillBar.style.width = gameState.fill + "%";
  difficultyValue.textContent = gameState.activeDifficulty.label;
  targetValue.textContent = gameState.activeDifficulty.targetScore;
  timeValue.textContent = Math.max(0, gameState.timeRemaining);
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

function removeElement(element, withFade) {
  if (!element) {
    return;
  }

  if (withFade) {
    element.classList.add("popped");
    setTimeout(() => {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    }, 160);
    return;
  }

  if (element.parentNode) {
    element.parentNode.removeChild(element);
  }
}

function showMilestoneMessage(message, durationMs) {
  if (!milestoneMessage) {
    return;
  }

  milestoneMessage.textContent = message;
  milestoneMessage.classList.add("active");

  if (milestoneTimerId) {
    clearTimeout(milestoneTimerId);
  }

  milestoneTimerId = setTimeout(() => {
    milestoneMessage.classList.remove("active");
    milestoneTimerId = null;
  }, durationMs);
}

function resetMilestoneState() {
  triggeredMilestones.clear();

  if (milestoneTimerId) {
    clearTimeout(milestoneTimerId);
    milestoneTimerId = null;
  }

  if (milestoneMessage) {
    milestoneMessage.textContent = "";
    milestoneMessage.classList.remove("active");
  }
}

function checkMilestones() {
  for (const milestone of milestones) {
    if (gameState.score >= milestone.score && !triggeredMilestones.has(milestone.score)) {
      triggeredMilestones.add(milestone.score);
      showMilestoneMessage(milestone.message, 1300);
    }
  }
}

// Builds compact wave files in-memory so no external sound files are required.
function buildToneDataUri(segments) {
  const sampleRate = 22050;
  const samples = [];

  for (const segment of segments) {
    const count = Math.floor((segment.durationMs / 1000) * sampleRate);

    for (let i = 0; i < count; i += 1) {
      const progress = i / count;
      const frequency = segment.frequencyEnd
        ? segment.frequency + ((segment.frequencyEnd - segment.frequency) * progress)
        : segment.frequency;
      const t = i / sampleRate;
      let value = Math.sin((2 * Math.PI * frequency) * t);

      if (segment.wave === "square") {
        value = value >= 0 ? 1 : -1;
      }

      const envelope = 1 - progress;
      const amplitude = Math.max(-1, Math.min(1, value * segment.volume * envelope));
      samples.push(amplitude);
    }
  }

  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset, text) {
    for (let i = 0; i < text.length; i += 1) {
      view.setUint8(offset + i, text.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const sample of samples) {
    view.setInt16(offset, sample * 32767, true);
    offset += bytesPerSample;
  }

  const uint8 = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < uint8.length; i += 1) {
    binary += String.fromCharCode(uint8[i]);
  }

  return "data:audio/wav;base64," + btoa(binary);
}

function initializeSounds() {
  if (soundState.ready) {
    return;
  }

  soundState.sounds = {
    collect: new Audio(buildToneDataUri([
      { frequency: 720, frequencyEnd: 980, durationMs: 85, volume: 0.5, wave: "sine" }
    ])),
    miss: new Audio(buildToneDataUri([
      { frequency: 280, frequencyEnd: 190, durationMs: 120, volume: 0.45, wave: "sine" }
    ])),
    button: new Audio(buildToneDataUri([
      { frequency: 540, frequencyEnd: 610, durationMs: 55, volume: 0.34, wave: "square" }
    ])),
    win: new Audio(buildToneDataUri([
      { frequency: 440, durationMs: 100, volume: 0.35, wave: "sine" },
      { frequency: 620, durationMs: 120, volume: 0.35, wave: "sine" },
      { frequency: 820, durationMs: 160, volume: 0.35, wave: "sine" }
    ]))
  };

  for (const audio of Object.values(soundState.sounds)) {
    audio.preload = "auto";
    audio.load();
  }

  soundState.ready = true;
}

function playSound(type) {
  if (!soundState.ready || !soundState.sounds[type]) {
    return;
  }

  const now = performance.now();
  const lastPlay = soundState.lastPlayByType[type] || 0;
  const minGap = soundState.minGapMs[type] || 80;

  if (now - lastPlay < minGap) {
    return;
  }

  soundState.lastPlayByType[type] = now;
  const audio = soundState.sounds[type];

  // Resetting currentTime avoids excessive overlap when events fire quickly.
  audio.pause();
  audio.currentTime = 0;
  audio.play().catch(() => {
    // Browsers can block autoplay before first interaction; safely ignore.
  });
}

function unlockAudio() {
  initializeSounds();
}

function renderObjectives() {
  objectivesList.innerHTML = "";

  const objectives = [
    {
      key: "cleanObjective",
      text: "Catch 5 clean drops (0/5)"
    },
    {
      key: "superObjective",
      text: "Catch 1 gold super drop (0/1)"
    }
  ];

  for (const objective of objectives) {
    const item = document.createElement("li");
    item.dataset.objectiveKey = objective.key;
    item.textContent = objective.text;
    objectivesList.appendChild(item);
  }
}

function completeObjective(objectiveKey) {
  const item = objectivesList.querySelector('[data-objective-key="' + objectiveKey + '"]');
  if (!item) {
    return;
  }

  item.classList.add("completed");
  setTimeout(() => {
    removeElement(item, false);

    if (objectivesList.children.length === 0) {
      const allDone = document.createElement("li");
      allDone.textContent = "All objectives complete! Keep scoring before time runs out.";
      objectivesList.appendChild(allDone);
    }
  }, 220);
}

function updateObjectiveProgress(dropType) {
  const cleanObjective = objectivesList.querySelector('[data-objective-key="cleanObjective"]');
  const superObjective = objectivesList.querySelector('[data-objective-key="superObjective"]');

  if (dropType === "clean") {
    gameState.cleanCaught += 1;
    if (cleanObjective) {
      cleanObjective.textContent = "Catch 5 clean drops (" + Math.min(5, gameState.cleanCaught) + "/5)";
      if (gameState.cleanCaught >= 5) {
        completeObjective("cleanObjective");
      }
    }
  }

  if (dropType === "super") {
    gameState.superCaught += 1;
    if (superObjective) {
      superObjective.textContent = "Catch 1 gold super drop (" + Math.min(1, gameState.superCaught) + "/1)";
      if (gameState.superCaught >= 1) {
        completeObjective("superObjective");
      }
    }
  }
}

function setDifficulty(mode) {
  if (!difficultySettings[mode]) {
    return;
  }

  gameState.selectedDifficulty = mode;

  for (const button of difficultyButtons) {
    button.classList.toggle("active", button.dataset.difficulty === mode);
  }

  difficultyDescription.textContent = difficultySettings[mode].description;
}

function updateScore(points) {
  gameState.score = Math.max(0, gameState.score + points);

  const target = gameState.activeDifficulty.targetScore;
  gameState.fill = Math.min(100, (gameState.score / target) * 100);

  updateHud();
  checkMilestones();

  if (gameState.score >= target) {
    endGame(true);
  }
}

function clearActiveDrops() {
  for (const drop of drops) {
    removeElement(drop.element, false);
  }
  drops = [];
}

function initGame() {
  gameState.activeDifficulty = difficultySettings[gameState.selectedDifficulty];
  gameState.score = 0;
  gameState.lives = 3;
  gameState.fill = 0;
  gameState.running = true;
  gameState.paused = false;
  gameState.timeRemaining = gameState.activeDifficulty.timeLimit;
  gameState.startTime = performance.now();
  gameState.cleanCaught = 0;
  gameState.superCaught = 0;

  resetMilestoneState();
  clearCanReaction();
  clearCelebration();
  clearActiveDrops();
  renderObjectives();

  updateHud();
  showScreen(gameScreen);
  pauseOverlay.classList.remove("active");
  pauseButton.textContent = "Pause";

  gameState.canX = (gameArea.clientWidth / 2) - (waterCan.offsetWidth / 2);
  updateWaterCanPosition();

  startSpawning();
  startTimer();

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
  }, gameState.activeDifficulty.spawnIntervalMs);
}

function startTimer() {
  if (timerIntervalId) {
    clearInterval(timerIntervalId);
  }

  timerIntervalId = setInterval(() => {
    if (!gameState.running || gameState.paused) {
      return;
    }

    gameState.timeRemaining -= 1;
    updateHud();

    if (gameState.timeRemaining <= 0) {
      endGame(gameState.score >= gameState.activeDifficulty.targetScore);
    }
  }, 1000);
}

function createDrop() {
  const dropElement = document.createElement("div");
  const dropImage = document.createElement("img");
  const roll = Math.random();
  let type = "bad";

  if (roll < gameState.activeDifficulty.superDropChance) {
    type = "super";
  } else if (roll < gameState.activeDifficulty.superDropChance + gameState.activeDifficulty.cleanDropChance) {
    type = "clean";
  }

  dropElement.classList.add("drop", type);
  dropImage.className = "drop-image";
  dropImage.src = "img/water-drop.png";
  dropImage.alt = "";
  dropElement.appendChild(dropImage);

  const gameAreaWidth = gameArea.clientWidth;
  const dropSize = 24;
  const startX = Math.random() * (gameAreaWidth - dropSize);

  const elapsedSeconds = (performance.now() - gameState.startTime) / 1000;
  const speed = gameState.activeDifficulty.dropSpeedBase + (elapsedSeconds * gameState.activeDifficulty.speedIncreasePerSecond);

  const dropData = {
    element: dropElement,
    type,
    x: startX,
    y: -34,
    speed
  };

  dropElement.style.left = dropData.x + "px";
  dropElement.style.top = dropData.y + "px";

  gameArea.appendChild(dropElement);
  drops.push(dropData);
}

function removeDrop(drop, withFade) {
  const dropIndex = drops.indexOf(drop);
  if (dropIndex === -1) {
    return;
  }

  drops.splice(dropIndex, 1);
  removeElement(drop.element, withFade);
}

function handleCatch(drop) {
  const isPositiveDrop = drop.type === "clean" || drop.type === "super";
  triggerCanReaction(isPositiveDrop);

  if (drop.type === "super") {
    gameState.lives += 1;
    updateScore(10);
    playSound("collect");
  } else if (drop.type === "clean") {
    updateScore(10);
    playSound("collect");
  } else {
    gameState.lives -= 1;
    updateScore(-10);
    playSound("miss");
  }

  updateObjectiveProgress(drop.type);
  updateHud();
  removeDrop(drop, true);

  if (gameState.lives <= 0) {
    endGame(false);
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
      removeDrop(drop, false);
      playSound("miss");
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

  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  clearActiveDrops();

  if (didWin) {
    showMilestoneMessage("You did it!", 1700);
    playSound("win");
  }

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

  if (timerIntervalId) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }

  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }

  clearActiveDrops();
  clearCanReaction();
  clearCelebration();
  resetMilestoneState();

  pauseOverlay.classList.remove("active");
  pauseButton.textContent = "Pause";
  showScreen(startScreen);
}

startButton.addEventListener("click", () => {
  playSound("button");
  initGame();
});

playAgainButton.addEventListener("click", () => {
  playSound("button");
  initGame();
});

howToPlayButton.addEventListener("click", () => {
  playSound("button");
  howToPlayPanel.classList.toggle("active");
});

pauseButton.addEventListener("click", () => {
  if (!gameState.running) {
    return;
  }

  playSound("button");
  setPausedState(!gameState.paused);
});

menuButton.addEventListener("click", () => {
  playSound("button");
  returnToMainMenu();
});

endMenuButton.addEventListener("click", () => {
  playSound("button");
  returnToMainMenu();
});

for (const button of difficultyButtons) {
  button.addEventListener("click", () => {
    playSound("button");
    setDifficulty(button.dataset.difficulty);
  });
}

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

document.addEventListener("pointerdown", unlockAudio, { once: true });

setDifficulty("normal");
updateHud();
renderObjectives();
initializeSounds();
