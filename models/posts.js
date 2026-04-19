const { type } = require("express/lib/response");
const mongoose = require("mongoose");
const postsSchema = new mongoose.Schema({
  description: { type: String },
  image: { type: String },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  likes:[{type:mongoose.Schema.Types.ObjectId,ref:"User"}]
},{timestamps:true});
module.exports = mongoose.model("Posts", postsSchema);
