const canvas = document.querySelector("#gameCanvas");
const context = canvas.getContext("2d");
const gameStage = document.querySelector("#gameStage");
const backButton = document.querySelector("#backButton");
const startButton = document.querySelector("#startButton");
const restartButton = document.querySelector("#restartButton");
const stageTitle = document.querySelector("#stageTitle");
const stageSubtitle = document.querySelector("#stageSubtitle");
const currentScore = document.querySelector("#currentScore");
const stageHighScore = document.querySelector("#stageHighScore");
const controlHint = document.querySelector("#controlHint");
const gameMessage = document.querySelector("#gameMessage");
const messageTitle = document.querySelector("#messageTitle");
const messageBody = document.querySelector("#messageBody");
const highScoreLabels = document.querySelectorAll("[data-high-score]");

const gameMeta = {
  pong: {
    title: "Pong",
    subtitle: "two-player classic",
    hint: "Player 1: W/S. Player 2: Arrow Up/Down. First to 7 ends the round."
  },
  snake: {
    title: "Snake",
    subtitle: "zone-out survival",
    hint: "Use arrow keys or WASD. Eat snacks, avoid walls and your tail."
  },
  brickBreaker: {
    title: "Brick Breaker",
    subtitle: "soft neon chaos",
    hint: "Move with Left/Right or A/D. Clear bricks before losing all lives."
  }
};

let highScores = {
  pong: 0,
  snake: 0,
  brickBreaker: 0
};

let activeGame = null;
let animationFrame = null;
let keys = {};

async function loadHighScores() {
  try {
    const response = await fetch("/api/highscores");
    highScores = await response.json();
    renderHighScores();
  } catch (error) {
    console.warn("High scores could not be loaded.", error);
  }
}

async function saveHighScore(game, score) {
  if (score <= (highScores[game] || 0)) {
    return;
  }

  try {
    const response = await fetch("/api/highscores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game, score })
    });
    highScores = await response.json();
    renderHighScores();
    stageHighScore.textContent = highScores[game] || 0;
  } catch (error) {
    console.warn("High score could not be saved.", error);
  }
}

function renderHighScores() {
  highScoreLabels.forEach((label) => {
    const game = label.dataset.highScore;
    label.textContent = highScores[game] || 0;
  });
}

function setScore(score) {
  currentScore.textContent = score;
}

function showMessage(title, body) {
  messageTitle.textContent = title;
  messageBody.textContent = body;
  gameMessage.classList.remove("hidden");
}

function hideMessage() {
  gameMessage.classList.add("hidden");
}

function clearCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackdrop() {
  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#292335");
  gradient.addColorStop(0.5, "#24333f");
  gradient.addColorStop(1, "#3b2b3d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = "rgba(255, 247, 237, 0.08)";
  context.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, canvas.height);
    context.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(canvas.width, y);
    context.stroke();
  }
}

function drawText(text, x, y, size = 22, align = "center") {
  context.fillStyle = "#fff7ed";
  context.font = `700 ${size}px Space Mono, monospace`;
  context.textAlign = align;
  context.fillText(text, x, y);
}

function loop() {
  if (!activeGame || !activeGame.running) {
    return;
  }

  activeGame.update();
  activeGame.draw();
  animationFrame = requestAnimationFrame(loop);
}

function startLoop() {
  cancelAnimationFrame(animationFrame);
  hideMessage();
  activeGame.running = true;
  animationFrame = requestAnimationFrame(loop);
}

function stopGame() {
  cancelAnimationFrame(animationFrame);
  if (activeGame) {
    activeGame.running = false;
  }
}

function openGame(gameName) {
  stopGame();
  keys = {};
  activeGame = createGame(gameName);

  const meta = gameMeta[gameName];
  stageTitle.textContent = meta.title;
  stageSubtitle.textContent = meta.subtitle;
  controlHint.textContent = meta.hint;
  setScore(0);
  stageHighScore.textContent = highScores[gameName] || 0;
  gameStage.classList.add("active");
  gameStage.setAttribute("aria-hidden", "false");
  activeGame.reset();
  activeGame.draw();
  showMessage(meta.title, "Press Start to play.");
}

function closeGame() {
  stopGame();
  activeGame = null;
  gameStage.classList.remove("active");
  gameStage.setAttribute("aria-hidden", "true");
  clearCanvas();
}

function endRound(title, body) {
  stopGame();
  showMessage(title, body);
}

function createGame(gameName) {
  if (gameName === "pong") {
    return createPong();
  }

  if (gameName === "snake") {
    return createSnake();
  }

  return createBrickBreaker();
}

function createPong() {
  const paddleWidth = 16;
  const paddleHeight = 104;
  const targetScore = 7;
  const state = {
    running: false,
    p1: 0,
    p2: 0,
    leftY: canvas.height / 2 - paddleHeight / 2,
    rightY: canvas.height / 2 - paddleHeight / 2,
    ballX: canvas.width / 2,
    ballY: canvas.height / 2,
    ballVX: 6,
    ballVY: 4
  };

  function resetBall(direction = 1) {
    state.ballX = canvas.width / 2;
    state.ballY = canvas.height / 2;
    state.ballVX = 6 * direction;
    state.ballVY = (Math.random() > 0.5 ? 1 : -1) * 4;
  }

  function scorePoint(player) {
    if (player === 1) {
      state.p1 += 1;
      resetBall(1);
    } else {
      state.p2 += 1;
      resetBall(-1);
    }

    const total = Math.max(state.p1, state.p2);
    setScore(total);
    saveHighScore("pong", total);

    if (state.p1 >= targetScore || state.p2 >= targetScore) {
      endRound("Round complete", `Final score ${state.p1} - ${state.p2}. Press Restart for another match.`);
    }
  }

  return {
    get running() {
      return state.running;
    },
    set running(value) {
      state.running = value;
    },
    reset() {
      state.p1 = 0;
      state.p2 = 0;
      state.leftY = canvas.height / 2 - paddleHeight / 2;
      state.rightY = canvas.height / 2 - paddleHeight / 2;
      resetBall(Math.random() > 0.5 ? 1 : -1);
      setScore(0);
    },
    update() {
      const speed = 8;
      if (keys.KeyW) state.leftY -= speed;
      if (keys.KeyS) state.leftY += speed;
      if (keys.ArrowUp) state.rightY -= speed;
      if (keys.ArrowDown) state.rightY += speed;
      state.leftY = Math.max(18, Math.min(canvas.height - paddleHeight - 18, state.leftY));
      state.rightY = Math.max(18, Math.min(canvas.height - paddleHeight - 18, state.rightY));

      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      if (state.ballY <= 14 || state.ballY >= canvas.height - 14) {
        state.ballVY *= -1;
      }

      const hitsLeft = state.ballX <= 44 && state.ballY >= state.leftY && state.ballY <= state.leftY + paddleHeight;
      const hitsRight = state.ballX >= canvas.width - 44 && state.ballY >= state.rightY && state.ballY <= state.rightY + paddleHeight;

      if (hitsLeft || hitsRight) {
        state.ballVX *= -1.08;
        const paddleY = hitsLeft ? state.leftY : state.rightY;
        state.ballVY = ((state.ballY - (paddleY + paddleHeight / 2)) / (paddleHeight / 2)) * 6;
      }

      if (state.ballX < 0) scorePoint(2);
      if (state.ballX > canvas.width) scorePoint(1);
    },
    draw() {
      drawBackdrop();
      context.fillStyle = "rgba(255, 247, 237, 0.22)";
      for (let y = 18; y < canvas.height; y += 34) {
        context.fillRect(canvas.width / 2 - 3, y, 6, 18);
      }

      context.fillStyle = "#fff7ed";
      context.fillRect(28, state.leftY, paddleWidth, paddleHeight);
      context.fillRect(canvas.width - 44, state.rightY, paddleWidth, paddleHeight);
      context.beginPath();
      context.arc(state.ballX, state.ballY, 13, 0, Math.PI * 2);
      context.fill();
      drawText(`${state.p1}  ${state.p2}`, canvas.width / 2, 66, 38);
    }
  };
}

function createSnake() {
  const tile = 24;
  const columns = Math.floor(canvas.width / tile);
  const rows = Math.floor(canvas.height / tile);
  const state = {
    running: false,
    tick: 0,
    score: 0,
    direction: { x: 1, y: 0 },
    nextDirection: { x: 1, y: 0 },
    snake: [],
    snack: { x: 10, y: 10 }
  };

  function placeSnack() {
    do {
      state.snack = {
        x: Math.floor(Math.random() * columns),
        y: Math.floor(Math.random() * rows)
      };
    } while (state.snake.some((segment) => segment.x === state.snack.x && segment.y === state.snack.y));
  }

  function changeDirection() {
    const requested = { ...state.nextDirection };
    if (keys.ArrowUp || keys.KeyW) Object.assign(requested, { x: 0, y: -1 });
    if (keys.ArrowDown || keys.KeyS) Object.assign(requested, { x: 0, y: 1 });
    if (keys.ArrowLeft || keys.KeyA) Object.assign(requested, { x: -1, y: 0 });
    if (keys.ArrowRight || keys.KeyD) Object.assign(requested, { x: 1, y: 0 });

    const reversing = requested.x + state.direction.x === 0 && requested.y + state.direction.y === 0;
    if (!reversing) {
      state.nextDirection = requested;
    }
  }

  return {
    get running() {
      return state.running;
    },
    set running(value) {
      state.running = value;
    },
    reset() {
      state.score = 0;
      state.tick = 0;
      state.direction = { x: 1, y: 0 };
      state.nextDirection = { x: 1, y: 0 };
      state.snake = [
        { x: 8, y: 10 },
        { x: 7, y: 10 },
        { x: 6, y: 10 }
      ];
      placeSnack();
      setScore(0);
    },
    update() {
      changeDirection();
      state.tick += 1;
      if (state.tick % 8 !== 0) return;

      state.direction = { ...state.nextDirection };
      const head = state.snake[0];
      const next = {
        x: head.x + state.direction.x,
        y: head.y + state.direction.y
      };

      const crashed = next.x < 0 || next.y < 0 || next.x >= columns || next.y >= rows ||
        state.snake.some((segment) => segment.x === next.x && segment.y === next.y);

      if (crashed) {
        saveHighScore("snake", state.score);
        endRound("Game over", `You scored ${state.score}. Press Restart to try again.`);
        return;
      }

      state.snake.unshift(next);
      if (next.x === state.snack.x && next.y === state.snack.y) {
        state.score += 10;
        setScore(state.score);
        saveHighScore("snake", state.score);
        placeSnack();
      } else {
        state.snake.pop();
      }
    },
    draw() {
      drawBackdrop();
      context.fillStyle = "#e2a94e";
      context.fillRect(state.snack.x * tile + 4, state.snack.y * tile + 4, tile - 8, tile - 8);

      state.snake.forEach((segment, index) => {
        context.fillStyle = index === 0 ? "#fff7ed" : "#4aa6a0";
        context.fillRect(segment.x * tile + 3, segment.y * tile + 3, tile - 6, tile - 6);
      });
      drawText(`Score ${state.score}`, 24, 38, 20, "left");
    }
  };
}

function createBrickBreaker() {
  const rows = 5;
  const columns = 10;
  const brickGap = 8;
  const brickWidth = (canvas.width - 120 - brickGap * (columns - 1)) / columns;
  const brickHeight = 28;
  const state = {
    running: false,
    score: 0,
    lives: 3,
    paddleX: canvas.width / 2 - 64,
    ballX: canvas.width / 2,
    ballY: canvas.height - 90,
    ballVX: 5,
    ballVY: -5,
    bricks: []
  };

  function resetBall() {
    state.paddleX = canvas.width / 2 - 64;
    state.ballX = canvas.width / 2;
    state.ballY = canvas.height - 90;
    state.ballVX = Math.random() > 0.5 ? 5 : -5;
    state.ballVY = -5;
  }

  function buildBricks() {
    state.bricks = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        state.bricks.push({
          x: 60 + column * (brickWidth + brickGap),
          y: 62 + row * (brickHeight + brickGap),
          width: brickWidth,
          height: brickHeight,
          alive: true,
          color: ["#d96b78", "#e2a94e", "#4aa6a0", "#cde8cf", "#fff7ed"][row]
        });
      }
    }
  }

  return {
    get running() {
      return state.running;
    },
    set running(value) {
      state.running = value;
    },
    reset() {
      state.score = 0;
      state.lives = 3;
      buildBricks();
      resetBall();
      setScore(0);
    },
    update() {
      const paddleSpeed = 9;
      const paddleWidth = 128;
      const paddleHeight = 16;
      if (keys.ArrowLeft || keys.KeyA) state.paddleX -= paddleSpeed;
      if (keys.ArrowRight || keys.KeyD) state.paddleX += paddleSpeed;
      state.paddleX = Math.max(20, Math.min(canvas.width - paddleWidth - 20, state.paddleX));

      state.ballX += state.ballVX;
      state.ballY += state.ballVY;

      if (state.ballX <= 12 || state.ballX >= canvas.width - 12) state.ballVX *= -1;
      if (state.ballY <= 12) state.ballVY *= -1;

      const hitsPaddle = state.ballY + 12 >= canvas.height - 48 &&
        state.ballY <= canvas.height - 30 &&
        state.ballX >= state.paddleX &&
        state.ballX <= state.paddleX + paddleWidth;

      if (hitsPaddle) {
        state.ballVY = -Math.abs(state.ballVY);
        state.ballVX = ((state.ballX - (state.paddleX + paddleWidth / 2)) / (paddleWidth / 2)) * 7;
      }

      for (const brick of state.bricks) {
        if (!brick.alive) continue;
        const hitsBrick = state.ballX >= brick.x &&
          state.ballX <= brick.x + brick.width &&
          state.ballY >= brick.y &&
          state.ballY <= brick.y + brick.height;

        if (hitsBrick) {
          brick.alive = false;
          state.ballVY *= -1;
          state.score += 10;
          setScore(state.score);
          saveHighScore("brickBreaker", state.score);
          break;
        }
      }

      if (state.bricks.every((brick) => !brick.alive)) {
        saveHighScore("brickBreaker", state.score);
        endRound("Board cleared", `You scored ${state.score}. Press Restart for a fresh wall.`);
      }

      if (state.ballY > canvas.height + 20) {
        state.lives -= 1;
        if (state.lives <= 0) {
          saveHighScore("brickBreaker", state.score);
          endRound("Game over", `You scored ${state.score}. Press Restart to play again.`);
        } else {
          resetBall();
        }
      }
    },
    draw() {
      drawBackdrop();
      state.bricks.forEach((brick) => {
        if (!brick.alive) return;
        context.fillStyle = brick.color;
        context.fillRect(brick.x, brick.y, brick.width, brick.height);
      });

      context.fillStyle = "#fff7ed";
      context.fillRect(state.paddleX, canvas.height - 44, 128, 16);
      context.beginPath();
      context.arc(state.ballX, state.ballY, 12, 0, Math.PI * 2);
      context.fill();
      drawText(`Score ${state.score}`, 24, 38, 20, "left");
      drawText(`Lives ${state.lives}`, canvas.width - 24, 38, 20, "right");
    }
  };
}

document.querySelectorAll(".game-card").forEach((card) => {
  card.addEventListener("click", () => openGame(card.dataset.game));
});

backButton.addEventListener("click", closeGame);
startButton.addEventListener("click", () => {
  if (!activeGame) return;
  startLoop();
});
restartButton.addEventListener("click", () => {
  if (!activeGame) return;
  activeGame.reset();
  activeGame.draw();
  startLoop();
});

window.addEventListener("keydown", (event) => {
  keys[event.code] = true;
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(event.code)) {
    event.preventDefault();
  }
});

window.addEventListener("keyup", (event) => {
  keys[event.code] = false;
});

loadHighScores();
