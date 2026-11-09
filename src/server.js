
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const videoRoutes = require("./routes/video");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdn.jsdelivr.net"
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        mediaSrc: ["'self'", "https:", "blob:"],
        connectSrc: ["'self'", "https:", "blob:"],
        frameSrc: [
          "'self'",
          "https://www.dailymotion.com",
          "https://geo.dailymotion.com",
          "https://www.youtube.com",
          "https://www.youtube-nocookie.com",
          "https://player.vimeo.com"
        ]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

app.use(express.json({ limit: "20kb" }));

app.use(express.static(path.join(__dirname, "../public")));

app.use("/api/video", videoRoutes);

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    name: "Stream API",
    version: "2.0.0",
    status: "online"
  });
});

app.get("/api", (req, res) => {
  res.json({
    name: "Stream API",
    version: "2.0.0",
    endpoints: {
      health: "/api/health",
      resolve: "/api/video/resolve?url=VIDEO_URL"
    }
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Endpoint not found"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Stream API running on port ${PORT}`);
});
