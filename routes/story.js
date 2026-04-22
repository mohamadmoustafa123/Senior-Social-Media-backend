const express = require("express");
const router = express.Router();
const Story = require("../models/story");
const multer = require("multer");
const path = require("path");
const Freind = require("../models/freinds");
const { requireAuth } = require("../middleware/auth");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + path.extname(file.originalname); // مثل: 1691408911234.jpg
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });
router.post("/insertStory", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const imageUrl = req.file
      ? `http://senior-social-media-backend-production.up.railway.app/uploads/${req.file.filename}`
      : "";
    const newStory = new Story({
      image: imageUrl,
      userId: req.userId,
    });
    await newStory.save();

    res.status(200).json({ message: "story added for 24hours" });
  } catch (err) {
    console.error("////", err);
    res.status(500).json({ err: err.message });
  }
});
router.get("/myStory", requireAuth, async (req, res) => {
  try {
    const myStory = await Story.find({ userId: req.userId }).sort({
      createdAt: -1,
    });
    console.log("////", myStory);
    res.status(200).json(myStory);
  } catch (err) {
    res.status(500).json({ err: err.message });
  }
});

router.delete("/deleteMyStory", requireAuth, async (req, res) => {
  try {
    await Story.deleteMany({ userId: req.userId });
    res.status(201).json({ message: "story has been delted " });
  } catch (err) {
    res.status(501).json({ error: err });
  }
});

router.get("/stories", requireAuth, async (req, res) => {
  const pageX = parseInt(req.query.pageX, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 10;
  const skip = (pageX - 1) * limit;
  try {
    const freinds = await Freind.find({
      $or: [
        { from: req.userId, state: "freind" },
        { to: req.userId, state: "freind" },
      ],
    });

    const freindsIds = freinds.map((f) => {
      const fromId = f.from.toString();
      const verifiedId = req.userId.toString();
      return fromId === verifiedId ? f.to : f.from;
    });
    const storyFreind = await Story.find({ userId: { $in: freindsIds } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId");

    res.status(200).json(storyFreind);
  } catch (err) {
    res.status(501).json({ error: err });
  }
});
module.exports = router;
