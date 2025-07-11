require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const cors = require('cors');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const User = require('./models/User.js');
const Movie = require('./models/Movie.js');
const Comment = require('./models/Comment.js');

const app = express();
const PORT = process.env.PORT || 5000;

// ✅ CORS and JSON
app.use(cors({
  origin: ["https://www.getagasobanuye.xyz", "https://getagasobanuye.xyz"],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

// ✅ Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Multer + Cloudinary Storage
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "movie_posters",
    allowed_formats: ["jpg", "png", "jpeg", "webp"],
    transformation: [{ width: 600, height: 800, crop: "limit" }],
  },
});
const upload = multer({ storage });

// ✅ MongoDB Connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

// ========== ROUTES ==========

app.get('/', (req, res) => {
  res.send('Backend is working!');
});

// --- Movies ---
app.get('/movies', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const movies = await Movie.find({})
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const formatted = movies.map(m => ({ ...m._doc, id: m._id, _id: undefined }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });

  try {
    const movies = await Movie.find({ title: new RegExp(q, 'i') });
    const formatted = movies.map(m => ({ ...m._doc, id: m._id, _id: undefined }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/movies/:id', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json({ ...movie._doc, id: movie._id, _id: undefined });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/movies/:id/related', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    const related = await Movie.find({ genre: movie.genre, _id: { $ne: movie._id } })
      .sort({ created_at: -1 })
      .limit(5);

    const formatted = related.map(m => ({ ...m._doc, id: m._id, _id: undefined }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/movies', upload.single('movie_poster'), async (req, res) => {
  const { title, genre, release_year, description, trailer_url, video_url, download_url } = req.body;
  if (!title || !genre || !release_year || !description || !trailer_url || !video_url) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  const movie_poster = req.file ? req.file.path : null;

  try {
    const newMovie = new Movie({
      title,
      genre,
      release_year,
      description,
      trailer_url,
      video_url,
      download_url: download_url || null,
      movie_poster,
      likes: 0,
    });

    const savedMovie = await newMovie.save();
    res.status(201).json({ id: savedMovie._id, message: 'Movie added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/movies/:id', upload.single('movie_poster'), async (req, res) => {
  const { title, genre, release_year, description, trailer_url, video_url, download_url } = req.body;

  if (!title || !genre || !release_year || !description || !trailer_url || !video_url) {
    return res.status(400).json({ error: 'Please provide all required fields' });
  }

  try {
    const movieData = {
      title,
      genre,
      release_year,
      description,
      trailer_url,
      video_url,
      download_url: download_url || null,
    };

    if (req.file) movieData.movie_poster = req.file.path;

    const updatedMovie = await Movie.findByIdAndUpdate(req.params.id, movieData, { new: true });
    if (!updatedMovie) return res.status(404).json({ error: 'Movie not found' });

    res.json({ message: 'Movie updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/movies/:id', async (req, res) => {
  try {
    const deleted = await Movie.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Movie not found' });
    res.json({ message: 'Movie deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/movies/:id/like', async (req, res) => {
  try {
    const movie = await Movie.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );
    if (!movie) return res.status(404).json({ error: 'Movie not found' });
    res.json({ message: 'Movie liked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/movies/:id/unlike', async (req, res) => {
  try {
    const movie = await Movie.findById(req.params.id);
    if (!movie) return res.status(404).json({ error: 'Movie not found' });

    if (movie.likes > 0) {
      movie.likes--;
      await movie.save();
    }

    res.json({ message: 'Movie unliked' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Comments ---
app.get('/movies/:id/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ movie_id: req.params.id }).sort({ created_at: -1 });
    const formatted = comments.map(c => ({ ...c._doc, id: c._id, _id: undefined }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/movies/:id/comments', async (req, res) => {
  const { email, comment_text } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email cannot be empty' });
  if (!comment_text?.trim()) return res.status(400).json({ error: 'Comment text cannot be empty' });

  try {
    const newComment = new Comment({
      movie_id: req.params.id,
      email: email.trim(),
      comment_text: comment_text.trim(),
    });
    const saved = await newComment.save();
    res.status(201).json({ ...saved._doc, id: saved._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/comments/:id', async (req, res) => {
  try {
    const deleted = await Comment.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Comment not found' });
    res.json({ message: 'Comment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Admin Login ---
app.post('/admin/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    res.json({ message: 'Login successful', user: { id: user._id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
