const { type, format } = require("express/lib/response");
const mongoose = require("mongoose");
const freindsSchema = new mongoose.Schema({
    from:{ type: mongoose.Schema.Types.ObjectId, ref: "User"},
    to:{ type: mongoose.Schema.Types.ObjectId, ref: "User"},
    state:{type:String}
  
});
module.exports = mongoose.model("Freinds", freindsSchema);