const express = require("express");

const router = express.Router();

/**
 * POST /intent  body: { text: string }
 * Proxies to Python `intent_service` (FastAPI) and returns { intent, score }.
 */
router.post("/intent", async (req, res) => {
  try {
    const { text } = req.body;
    if (text == null || typeof text !== "string") {
      return res.status(400).json({ error: "text required" });
    }
    const base = (process.env.INTENT_SERVICE_URL || "http://127.0.0.1:8000").replace(
      /\/$/,
      ""
    );
    const url = `${base}/intent`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "intent_service_error", detail });
    }
    const data = await r.json();
    return res.json(data);
  } catch (err) {
    console.error("voice intent proxy", err);
    return res.status(500).json({ error: "server_error" });
  }
});

module.exports = router;
