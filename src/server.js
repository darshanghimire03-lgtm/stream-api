
const express = require("express");
const helmet = require("helmet");
const path = require("path");
const videoRoutes = require("./routes/video");

const app = express();
const PORT = process.env.PORT || 3000;

app.disable("x-powered-by");

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(express.json({ limit: "20kb" }));

app.use(express.static(path.join(__dirname, "../public")));

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    name: "Stream API",
    version: "1.0.0",
    status: "online"
  });
});

app.use("/api/video", videoRoutes);

app.get("/api", (req, res) => {
  res.json({
    name: "Stream API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      resolve: "/api/video?url=VIDEO_URL",
      player: "/player"
    }
  });
});

app.get("/player", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
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
