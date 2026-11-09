
const express = require("express");
const router = express.Router();

const { resolveVideo } = require("../services/resolver");

router.get("/resolve", (req, res) => {
  try {
    const result = resolveVideo(req.query.url);

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

router.post("/resolve", (req, res) => {
  try {
    const result = resolveVideo(req.body.url);

    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
