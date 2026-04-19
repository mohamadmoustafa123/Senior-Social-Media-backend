const express = require("express");
const mongoose = require("mongoose");

const Comments = require("../models/comments");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.get("/:postId", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ message: "invalid post id" });
    }

    const comments = await Comments.find({ postId })
      .sort({ createdAt: -1 })
      .populate("userId", "name image")
      .lean();

    return res.status(200).json(comments);
  } catch (err) {
    return res.status(500).json({ error: err?.message || err });
  }
});

router.post("/:postId", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({ success: false, message: "invalid post id" });
    }
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, message: "comment text is required" });
    }

    const created = await Comments.create({
      postId,
      userId: req.userId,
      text: String(text).trim(),
    });

    const comment = await Comments.findById(created._id)
      .populate("userId", "name image")
      .lean();

    return res.status(201).json({ success: true, comment });
  } catch (err) {
    return res.status(500).json({ success: false, error: err?.message || err });
  }
});

module.exports = router;
