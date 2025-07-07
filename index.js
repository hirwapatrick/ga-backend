const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const { CloudinaryStorage } = require("multer-storage-cloudinary");

const app = express();
const PORT = 5000;

// ✅ CORS and JSON
app.use(cors({ origin: "https://www.getagasobanuye.xyz" }));
app.use(express.json());

// ✅ Cloudinary Configuration
cloudinary.config({
  cloud_name: "dpy64b9p8",
  api_key: "414143472629295",
  api_secret: "hX1JTJXRzDhXokQnnZAEgOw1bEE",
});

// ✅ Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "movie_posters",
    allowed_formats: ["jpg", "png", "jpeg","webp"],
    transformation: [{ width: 600, height: 800, crop: "limit" }],
  },
});
const upload = multer({ storage });

// ✅ MySQL Pool Connection
const pool = mysql.createPool({
  host: "sql3.freesqldatabase.com",
  user: "sql3788352",
  password: "j8nKDwXVnz",
  database: "sql3788352",
  waitForConnections: true,
  connectionLimit: 20,
  queueLimit: 0,
});

app.get("/", (req, res) => {
  res.send("Backend is working!");
});

// ================= MOVIE ROUTES =================

app.get("/movies", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;
  try {
    const [rows] = await pool.query(
      `SELECT id, title, genre, release_year, description, trailer_url, video_url, download_url, likes, movie_poster FROM movies ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: "Query parameter 'q' is required" });
  try {
    const [rows] = await pool.query(
      `SELECT id, title, genre, release_year, description FROM movies WHERE title LIKE ?`,
      [`%${q}%`]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/movies/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT id, title, genre, release_year, description, trailer_url, video_url, download_url, likes, movie_poster FROM movies WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Movie not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/movies/:id/related", async (req, res) => {
  const { id } = req.params;
  try {
    const [movieRows] = await pool.query("SELECT genre FROM movies WHERE id = ?", [id]);
    if (movieRows.length === 0) return res.status(404).json({ error: "Movie not found" });

    const genre = movieRows[0].genre;
    const [related] = await pool.query(
      "SELECT id, title, genre, release_year, movie_poster FROM movies WHERE genre = ? AND id != ? ORDER BY created_at DESC LIMIT 5",
      [genre, id]
    );

    res.json(related);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/movies", upload.single("movie_poster"), async (req, res) => {
  const { title, genre, release_year, description, trailer_url, video_url, download_url } = req.body;
  if (!title || !genre || !release_year || !description || !trailer_url || !video_url) {
    return res.status(400).json({ error: "Please provide all required fields" });
  }

  const movie_poster = req.file ? req.file.path : null;

  try {
    const [result] = await pool.query(
      `INSERT INTO movies (title, genre, release_year, description, trailer_url, video_url, download_url, likes, movie_poster) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [title, genre, release_year, description, trailer_url, video_url, download_url || null, movie_poster]
    );
    res.status(201).json({ id: result.insertId, message: "Movie added successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put("/movies/:id", upload.single("movie_poster"), async (req, res) => {
  const { title, genre, release_year, description, trailer_url, video_url, download_url } = req.body;
  const { id } = req.params;

  if (!title || !genre || !release_year || !description || !trailer_url || !video_url) {
    return res.status(400).json({ error: "Please provide all required fields" });
  }

  const movie_poster = req.file ? req.file.path : null;

  try {
    let query, values;
    if (movie_poster) {
      query = `UPDATE movies SET title = ?, genre = ?, release_year = ?, description = ?, trailer_url = ?, video_url = ?, download_url = ?, movie_poster = ? WHERE id = ?`;
      values = [title, genre, release_year, description, trailer_url, video_url, download_url || null, movie_poster, id];
    } else {
      query = `UPDATE movies SET title = ?, genre = ?, release_year = ?, description = ?, trailer_url = ?, video_url = ?, download_url = ? WHERE id = ?`;
      values = [title, genre, release_year, description, trailer_url, video_url, download_url || null, id];
    }

    const [result] = await pool.query(query, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Movie not found" });
    res.json({ message: "Movie updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/movies/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query("SELECT movie_poster FROM movies WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Movie not found" });

    const [result] = await pool.query("DELETE FROM movies WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Movie not found" });

    res.json({ message: "Movie deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/movies/:id/like", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE movies SET likes = likes + 1 WHERE id = ?", [id]);
    res.json({ message: "Movie liked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/movies/:id/unlike", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("UPDATE movies SET likes = GREATEST(likes - 1, 0) WHERE id = ?", [id]);
    res.json({ message: "Movie unliked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= COMMENTS =================

app.get("/movies/:id/comments", async (req, res) => {
  const movieId = req.params.id;
  try {
    const [comments] = await pool.query(
      "SELECT id, email, comment_text, created_at FROM movie_comments WHERE movie_id = ? ORDER BY created_at DESC",
      [movieId]
    );
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/movies/:id/comments", async (req, res) => {
  const movieId = req.params.id;
  const { email, comment_text } = req.body;

  if (!email || email.trim() === "") return res.status(400).json({ error: "Email cannot be empty" });
  if (!comment_text || comment_text.trim() === "") return res.status(400).json({ error: "Comment text cannot be empty" });

  try {
    const [result] = await pool.query(
      "INSERT INTO movie_comments (movie_id, email, comment_text) VALUES (?, ?, ?)",
      [movieId, email.trim(), comment_text.trim()]
    );
    const [rows] = await pool.query("SELECT id, email, comment_text, created_at FROM movie_comments WHERE id = ?", [
      result.insertId,
    ]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/comments/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await pool.query("DELETE FROM movie_comments WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Comment not found" });
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= ADMIN LOGIN =================

app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const [users] = await pool.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ================= SERVER START =================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running on port ${PORT}`);
});
