const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Freind = require("../models/freinds");
const User = require("../models/User");
const { requireAuth } = require("../middleware/auth");

router.post("/add", requireAuth, async (req, res) => {
  const { toUserPost, state } = req.body;
  try {
    if (!toUserPost || !mongoose.Types.ObjectId.isValid(String(toUserPost))) {
      return res.status(400).json({ message: "invalid target user" });
    }
    const myId = req.userId;
    const toId = new mongoose.Types.ObjectId(String(toUserPost));
    const alreadyAdded = await Freind.find({
      from: myId,
      to: toId,
    });
    if (alreadyAdded.length > 0) {
      return res.status(401).json({ message: "you request already sending" });
    }
    const newFreind = new Freind({
      from: myId,
      to: toId,
      state: state,
    });
    await newFreind.save();
    res.status(201).json({ message: "the freind request success" });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});
router.get("/freindRequest", requireAuth, async (req, res) => {
  try {
    const myId = req.userId;

    const freindRequest = await Freind.find({
      to: myId,
      state: "pending",
    })
      .populate("from")
      .populate("to");
    return res.status(200).json({ freindRequest });
  } catch (err) {
    console.log(err.message);
    res.status(500).json({ error: err.message });
  }
});
router.post("/State", requireAuth, async (req, res) => {
  const { toUserPost } = req.body;

  try {
    const myId = req.userId;
    const relation = await Freind.find({
      $or: [
        { from: myId, to: toUserPost },
        { from: toUserPost, to: myId },
      ],
    });
    return res.status(201).json({ relation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put("/update-state", requireAuth, async (req, res) => {
  const { from, newState } = req.body;
  if (!from || !newState) {
    return res.status(400).json({ message: "all required" });
  }

  try {
    const myId = req.userId;
    const updatedDoc = await Freind.findOneAndUpdate(
      { from: from, to: myId },
      { state: newState },
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

router.get("/AllFreinds", requireAuth, async (req, res) => {
  try {
    const me = req.userId;
    if (!mongoose.Types.ObjectId.isValid(me)) {
      return res.status(401).json({ message: "invalid token id" });
    }
    const meOid = new mongoose.Types.ObjectId(me);
    const rows = await Freind.find({
      $or: [
        { from: meOid, state: { $in: ["freind", "friend"] } },
        { to: meOid, state: { $in: ["freind", "friend"] } },
      ],
    })
      .populate({ path: "from", model: "User", select: "name image email" })
      .populate({ path: "to", model: "User", select: "name image email" })
      .lean();

    const meStr = String(me);

    /** Resolve other user id (hex string) for comparison */
    function refId(ref) {
      if (ref == null) return "";
      if (typeof ref === "object" && ref._id) return String(ref._id);
      return String(ref);
    }

    const freinds = [];
    for (const doc of rows) {
      const fromId = refId(doc.from);
      const otherRef = fromId === meStr ? doc.to : doc.from;
      if (otherRef == null) continue;

      let uid =
        typeof otherRef === "object" && otherRef._id != null
          ? String(otherRef._id)
          : String(otherRef);
      let name =
        typeof otherRef === "object" && otherRef.name != null ? otherRef.name : null;
      let image =
        typeof otherRef === "object" && otherRef.image != null ? otherRef.image : undefined;

      if (!name && mongoose.Types.ObjectId.isValid(uid)) {
        const u = await User.findById(uid).select("name image email").lean();
        if (u) {
          name = u.name;
          image = u.image;
          uid = String(u._id);
        }
      }

      if (!uid) continue;
      freinds.push({
        _id: uid,
        name: name || "User",
        image: image || undefined,
      });
    }

    res.status(200).json({ freinds });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});
router.get("/AllFreindsReq", requireAuth, async (req, res) => {
  try {
    const myId = req.userId;
    const freindsReq = await Freind.find({
      to: myId,
      state: "freind",
    }).populate("from");
    res.status(200).json({ freindsReq });
  } catch (err) {
    res.status(500).json({ error: err });
  }
});
module.exports = router;
