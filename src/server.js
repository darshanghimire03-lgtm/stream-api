
const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const { inspectWebsite } = require("./inspector");
const { resolveVideo } = require("./resolver");
const { securityHeaders, apiCors } = require("./security");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(securityHeaders);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: "20kb" }));

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use("/api", apiCors, limiter);

app.get("/", (req, res) => {
  res.json({
    name: "Stream API",
    version: "4.0.0",
    status: "online",
    endpoints: {
      health: "/api/health",
      inspect: "/api/v1/inspect?url=WEBSITE_URL",
      resolve: "/api/v1/resolve?url=VIDEO_PAGE_URL"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    version: "4.0.0",
    timestamp: new Date().toISOString()
  });
});

function getUrl(req) {
  return req.method === "POST"
    ? req.body.url
    : req.query.url;
}

app.all("/api/v1/inspect", async (req, res) => {
  if (!["GET", "POST"].includes(req.method)) {
    return res.sendStatus(405);
  }

  try {
    const result = await inspectWebsite(getUrl(req));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.all("/api/v1/resolve", async (req, res) => {
  if (!["GET", "POST"].includes(req.method)) {
    return res.sendStatus(405);
  }

  try {
    const result = await resolveVideo(getUrl(req));
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err.message);

  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stream API v4.0 running on ${PORT}`);
});
