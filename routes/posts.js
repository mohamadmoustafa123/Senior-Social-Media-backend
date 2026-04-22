const express = require("express");
const router = express.Router();
const Posts = require("../models/posts");
const multer = require("multer");
const path = require("path");
const { requireAuth } = require("../middleware/auth");

//اعداد التخزين
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

router.post("/insertPost", requireAuth, upload.single("image"), async (req, res) => {
  const { description } = req.body;
  try {
    const imageUrl = req.file
      ? `http://senior-social-media-backend-production.up.railway.app/uploads/${req.file.filename}`
      : "";

    const newPost = new Posts({
      description,
      image: imageUrl,
      userId: req.userId,
    });
    await newPost.save();
    res.status(200).json({ message: "create post success" });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "create post failed" });
  }
});

// Upload a video post (stored in `image` field; filtered later by file extension)
router.post("/insertVideo", requireAuth, upload.single("image"), async (req, res) => {
  const { description } = req.body;
  try {
    const imageUrl = req.file
      ? `http://senior-social-media-backend-production.up.railway.app/uploads/${req.file.filename}`
      : "";

    const newPost = new Posts({
      description: description ?? "",
      image: imageUrl,
      userId: req.userId,
    });
    await newPost.save();
    res.status(200).json({ message: "create video success" });
  } catch (err) {
    return res.status(500).json({ message: err?.message || "create video failed" });
  }
});

router.get("/posts", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page);
    const limit = parseInt(req.query.limit);
    const userId = req.userId;
    const skip = (page - 1) * limit;
    let posts = await Posts.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId")
      .lean();

    posts = posts.map((post) => {
      const likesArray = Array.isArray(post.likes) ? post.likes : [];
      const alreadyLiked = likesArray
        .map((id) => id.toString())
        .includes(userId);
      return { ...post, liked: alreadyLiked, likesCount: likesArray.length };
    });
    return res.status(201).json(posts);
  } catch (err) {
    res.status(500).json(err);
  }
});

router.post("/:postId/like", requireAuth, async (req, res) => {
  try {
    const userId = req.userId;

    const post = await Posts.findById(req.params.postId);

    if (!post) {
      return res.status(401).json({ message: "post is not found" });
    }
    const alreadyLiked = post.likes.includes(userId);
    if (alreadyLiked) {
      post.likes = post.likes.filter((id) => {
        return id.toString() !== userId.toString();
      });
    } else {
      post.likes.push(userId);
    }
    await post.save();
    res.json({ liked: !alreadyLiked, likesCount: post.likes.length });
  } catch (err) {
    console.error(err);
    res.status(err?.statusCode || err?.status || 500).json({
      message: err?.message || "Internal Server Error",
    });
  }
});

/** Update own post (description and/or image) – only the author */
router.put("/update/:postId", requireAuth, upload.single("image"), async (req, res) => {
  try {
    const post = await Posts.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Not allowed to edit this post" });
    }
    const { description } = req.body;
    if (description !== undefined) {
      post.description = description;
    }
    if (req.file) {
      post.image = `http://senior-social-media-backend-production.up.railway.app/uploads/${req.file.filename}`;
    }
    await post.save();
    let updated = await Posts.findById(post._id).populate("userId").lean();
    const likesArray = Array.isArray(updated.likes) ? updated.likes : [];
    const alreadyLiked = likesArray
      .map((id) => id.toString())
      .includes(req.userId.toString());
    updated = {
      ...updated,
      liked: alreadyLiked,
      likesCount: likesArray.length,
    };
    return res.status(200).json(updated);
  } catch (err) {
    return res.status(500).json({ error: err?.message || err });
  }
});

/** Delete own post – only the author can delete */
router.delete("/delete/:postId", requireAuth, async (req, res) => {
  try {
    const post = await Posts.findById(req.params.postId);
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (post.userId.toString() !== req.userId.toString()) {
      return res.status(403).json({ message: "Not allowed to delete this post" });
    }
    await Posts.findByIdAndDelete(req.params.postId);
    return res.status(200).json({ message: "deleted" });
  } catch (err) {
    return res.status(500).json({ error: err?.message || err });
  }
});

router.get("/myPosts", requireAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let myPosts = await Posts.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId")
      .lean();
    myPosts = myPosts.map((post) => {
      const likesArray = Array.isArray(post.likes) ? post.likes : [];
      const alreadyLiked = likesArray
        .map((id) => id.toString())
        .includes(req.userId);
      return { ...post, liked: alreadyLiked, likesCount: likesArray.length };
    });
    return res.status(200).json(myPosts);
  } catch (err) {
    return res.status(500).json(err);
  }
});

router.get("/videos", async (req, res) => {
  try {
    const videos = await Posts.find({
      image: { $regex: /\.(mp4|webm|ogg|mov|m4v|mkv|avi)$/i },
    }).populate("userId");
    res.status(200).json(videos);
  } catch (err) {
    res.status(500).json({ error: err });
  }
});

router.get("/postsUserSearch", requireAuth, async (req, res) => {
  const { userSearchId } = req.query;
  try {
    let postsUser = await Posts.find({ userId: userSearchId })
      .populate("userId")
      .lean();
    postsUser = postsUser.map((post) => {
      const likesArray = Array.isArray(post.likes) ? post.likes : [];
      const alreadyLiked = likesArray
        .map((id) => id.toString())
        .includes(req.userId);
      return { ...post, liked: alreadyLiked, likesCount: likesArray.length };
    });
    return res.status(200).json(postsUser);
  } catch (err) {
    return res.status(500).json(err);
  }
});
module.exports = router;
