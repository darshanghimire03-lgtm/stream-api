
const express = require("express");
const { resolveVideo } = require("../services/resolver");

const router = express.Router();

router.get("/", (req, res) => {
  const videoUrl = req.query.url;

  if (!videoUrl) {
    return res.status(400).json({
      success: false,
      error: "Video URL is required",
      example: "/api/video?url=https://example.com/video.mp4"
    });
  }

  try {
    const result = resolveVideo(videoUrl);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
