const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  genre: { type: String },
  release_year: { type: Number },
  movie_poster: { type: String },
  trailer_url: { type: String },
  video_url: { type: String },
  download_url: { type: String },
  likes: { type: Number, default: 0 },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Movie", movieSchema);
