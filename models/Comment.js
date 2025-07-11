const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  movie_id: { type: mongoose.Schema.Types.ObjectId, ref: "Movie", required: true },
  email: { type: String, required: true },
  comment_text: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Comment", commentSchema);
