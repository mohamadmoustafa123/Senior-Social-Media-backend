const { type } = require("express/lib/response");
const mongoose = require("mongoose");
const storySchema = new mongoose.Schema({
  image: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

storySchema.index({createdAt:1},{expireAfterSeconds:24*60*60})
module.exports=mongoose.model("Story",storySchema)
