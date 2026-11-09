
const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");

const { resolveVideo } = require("./resolver");
const { securityHeaders, apiCors } = require("./security");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(securityHeaders);
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

app.use(express.json({ limit: "20kb" }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false
});

app.use("/api", apiCors, apiLimiter);

app.get("/", (req, res) => {
  res.json({
    success: true,
    name: "Stream API",
    version: "3.0.0",
    message: "Backend is running",
    documentation: "/api"
  });
});

app.get("/api", (req, res) => {
  res.json({
    name: "Stream API",
    version: "3.0.0",
    endpoints: {
      health: "GET /api/health",
      resolve: "GET /api/v1/resolve?url=VIDEO_URL",
      resolvePost: "POST /api/v1/resolve"
    }
  });
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    timestamp: new Date().toISOString()
  });
});

function handleResolve(req, res) {
  try {
    const result = resolveVideo(
      req.method === "GET" ? req.query.url : req.body.url
    );

    res.json({
      ...result,
      server: "Stream API",
      version: "3.0.0"
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

app.get("/api/v1/resolve", handleResolve);
app.post("/api/v1/resolve", handleResolve);
app.get("/api/video/resolve", handleResolve);

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    error: "API endpoint not found"
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({
    success: false,
    error: "Internal server error"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stream API running on port ${PORT}`);
});
