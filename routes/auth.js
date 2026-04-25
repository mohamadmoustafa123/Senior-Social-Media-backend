const express = require("express");
const router = express.Router();
const User = require("../models/User");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const multer = require("multer");
const path = require("path");
const { getToken, requireAuth } = require("../middleware/auth");

// ----- Sign Up: creates user, sets cookie (web) and returns token (React Native) -----
router.post("/signup", async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email is already exist" });
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      name,
      email,
      password: hashedPassword,
      image:
        "https://senior-social-media-backend-production.up.railway.app/publicImg/pngfind.com-placeholder-png-6104451.png",
    });
    await newUser.save();
    const token = jwt.sign({ id: newUser._id }, process.env.SECRET_KEY, {
      expiresIn: "1h",
    });
    // Cookie for web; token in body for React Native (Bearer header)
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 3600000,
      })
      .status(200)
      .json({ message: "User created", token });
  } catch (err) {
    if (err.name == "ValidationError") {
      const firstError = Object.values(err.errors)[0].message;
      return res.status(400).json({
        message: firstError,
      });
    }
    res.status(500).json({ error: err.message });
  }
});
// ----- Sign In: validates credentials, sets cookie (web) and returns token + user (React Native) -----
router.post("/signin", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "user not found" });
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: "Wrong password" });
    const token = jwt.sign({ id: user._id }, process.env.SECRET_KEY, {
      expiresIn: "1h",
    });
    // Cookie for web; token + user in body for React Native
    const userObj = { id: user._id, name: user.name, email: user.email, image: user.image };
    console.log(userObj)
    res
      .cookie("token", token, {
        httpOnly: true,
        secure: false,
        sameSite: "lax",
        maxAge: 3600000,
      })
      .status(200)
      .json({ message: "Login successful", token, user: userObj });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get("/check-auth", (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  try {
    const verified = jwt.verify(token, process.env.SECRET_KEY);
    res.status(200).json({ authenticated: true, userId: verified.id });
  } catch (err) {
    res.status(401).json({ authenticated: false });
  }
});

// ----- Logout: clears cookie (web). React Native clears token locally and removes header. -----
router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
  });
  res.status(200).json({ message: "logout successful" });
});
router.get("/authenticateInfo", async (req, res) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ authenticated: false });
  }
  try {
    const verified = jwt.verify(token, process.env.SECRET_KEY);
    const user = await User.findById(verified.id).lean();
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({ user });
  } catch (err) {
    return res.status(401).json({ message: "Invalid expired token" });
  }
});

//edit image
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

router.put("/update-image", requireAuth, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const imageUrl = `https://senior-social-media-backend-production.up.railway.app/uploads/${req.file.filename}`;

    const updatedDoc = await User.findOneAndUpdate(
      { _id: req.userId },
      { image: imageUrl },
      { new: true }
    );

    if (!updatedDoc) {
      return res.status(400).json({ message: "Document not found" });
    }
    res
      .status(200)
      .json({ message: "State updated successfully", data: updatedDoc });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get("/searchPerson", async (req, res) => {
  const { inputName } = req.query;
  try {
    const raw = (inputName ?? "").toString().trim();
    if (!raw) {
      return res.status(200).json([]);
    }
    const escaped = raw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const search = await User.find({
      name: { $regex: "^" + escaped, $options: "i" },
    }).lean();
    return res.status(200).json(search);
  } catch (err) {
    return res.status(500).json({ error: err });
  }
});

router.get("/userSearchInfo", async (req, res) => {
  const { userSearchId } = req.query
  try {
    const userSearchInfo = await User.findOne({ _id: userSearchId })
    res.status(200).json({ userSearchInfo })

  } catch (err) { res.status(500).json({ err: err.message }) }
})
module.exports = router;
