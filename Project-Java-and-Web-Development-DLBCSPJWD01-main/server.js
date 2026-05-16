const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");
const SCORE_FILE = path.join(__dirname, "data", "highscores.json");
const MUSIC_FILE = path.join(__dirname, "data", "music.json");

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

const defaultScores = {
  pong: 0,
  snake: 0,
  brickBreaker: 0
};

async function readScores() {
  try {
    const data = await fs.readFile(SCORE_FILE, "utf8");
    return { ...defaultScores, ...JSON.parse(data) };
  } catch (error) {
    await writeScores(defaultScores);
    return { ...defaultScores };
  }
}

async function writeScores(scores) {
  await fs.mkdir(path.dirname(SCORE_FILE), { recursive: true });
  await fs.writeFile(SCORE_FILE, `${JSON.stringify(scores, null, 2)}\n`);
}

async function readMusic() {
  const data = await fs.readFile(MUSIC_FILE, "utf8");
  return { source: "procedural", ...JSON.parse(data) };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function collectBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function serveStatic(request, response) {
  const requestUrl = new URL(request.url, `http://${request.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const requestedFile = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
  const safePath = path.normalize(requestedFile).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, { "Content-Type": mimeTypes[extension] || "application/octet-stream" });
    response.end(file);
  } catch (error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function handleApi(request, response) {
  if (request.url === "/api/music/tracks" && request.method === "GET") {
    try {
      sendJson(response, 200, await readMusic());
    } catch (error) {
      sendJson(response, 500, { error: "Music tracks could not be loaded." });
    }
    return;
  }

  if (request.url === "/api/highscores" && request.method === "GET") {
    sendJson(response, 200, await readScores());
    return;
  }

  if (request.url === "/api/highscores" && request.method === "POST") {
    try {
      const body = await collectBody(request);
      const payload = JSON.parse(body || "{}");
      const game = String(payload.game || "");
      const score = Number(payload.score);

      if (!Object.hasOwn(defaultScores, game) || !Number.isFinite(score) || score < 0) {
        sendJson(response, 400, { error: "Invalid game or score." });
        return;
      }

      const scores = await readScores();
      scores[game] = Math.max(scores[game] || 0, Math.floor(score));
      await writeScores(scores);
      sendJson(response, 200, scores);
    } catch (error) {
      sendJson(response, 400, { error: "Could not save high score." });
    }
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

const server = http.createServer(async (request, response) => {
  if (request.url.startsWith("/api/")) {
    await handleApi(request, response);
    return;
  }

  await serveStatic(request, response);
});

server.listen(PORT, () => {
  console.log(`Lofi Arcade running at http://localhost:${PORT}`);
});
