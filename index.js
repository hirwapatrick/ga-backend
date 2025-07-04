const express = require("express");
const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 5000;

// Middleware
app.use(cors({ origin: "https://getagasobanuyemovies.onrender.com" }));
app.use(express.json());
app.use("/poster", express.static(path.join(__dirname, "public/poster")));

// Multer setup for storing uploaded posters
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "public/poster"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + ext);
  },
});
const upload = multer({ storage });

// MySQL connection
let connection;
async function connectDB() {
  try {
    connection = await mysql.createConnection({
      host: "sql3.freesqldatabase.com",
      user: "sql3788352",
      password: "j8nKDwXVnz",
      database: "sql3788352",
    });
    console.log("✅ Connected to MySQL");
  } catch (err) {
    console.error("❌ MySQL connection failed:", err.message);
    process.exit(1);
  }
}
connectDB();

// ========== MOVIE ROUTES ==========

app.get("/movies", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const [rows] = await connection.query(
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
    const [rows] = await connection.query(
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
    const [rows] = await connection.query(
      `SELECT id, title, genre, release_year, description, trailer_url, video_url, download_url, likes, movie_poster FROM movies WHERE id = ?`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: "Movie not found" });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// New route: Related movies by genre, excluding current movie
app.get("/movies/:id/related", async (req, res) => {
  const movieId = req.params.id;
  try {
    // Get genre of current movie
    const [movieRows] = await connection.query("SELECT genre FROM movies WHERE id = ?", [movieId]);
    if (movieRows.length === 0) return res.status(404).json({ error: "Movie not found" });

    const genre = movieRows[0].genre;

    // Get up to 5 related movies of same genre excluding current movie
    const [related] = await connection.query(
      "SELECT id, title, genre, release_year, movie_poster FROM movies WHERE genre = ? AND id != ? ORDER BY created_at DESC LIMIT 5",
      [genre, movieId]
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

  const movie_poster = req.file ? `/poster/${req.file.filename}` : null;

  try {
    const [result] = await connection.query(
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

  const movie_poster = req.file ? `/poster/${req.file.filename}` : null;

  try {
    let query, values;
    if (movie_poster) {
      query = `UPDATE movies SET title = ?, genre = ?, release_year = ?, description = ?, trailer_url = ?, video_url = ?, download_url = ?, movie_poster = ? WHERE id = ?`;
      values = [title, genre, release_year, description, trailer_url, video_url, download_url || null, movie_poster, id];
    } else {
      query = `UPDATE movies SET title = ?, genre = ?, release_year = ?, description = ?, trailer_url = ?, video_url = ?, download_url = ? WHERE id = ?`;
      values = [title, genre, release_year, description, trailer_url, video_url, download_url || null, id];
    }

    const [result] = await connection.query(query, values);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Movie not found" });
    res.json({ message: "Movie updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/movies/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await connection.query("SELECT movie_poster FROM movies WHERE id = ?", [id]);
    if (rows.length === 0) return res.status(404).json({ error: "Movie not found" });

    const posterPath = rows[0].movie_poster ? path.join(__dirname, "public", rows[0].movie_poster) : null;

    const [result] = await connection.query("DELETE FROM movies WHERE id = ?", [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Movie not found" });

    if (posterPath) {
      fs.unlink(posterPath, (err) => {
        if (err) console.error("Failed to delete poster image:", err.message);
      });
    }

    res.json({ message: "Movie deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/movies/:id/like", async (req, res) => {
  const { id } = req.params;
  try {
    await connection.query("UPDATE movies SET likes = likes + 1 WHERE id = ?", [id]);
    res.json({ message: "Movie liked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/movies/:id/unlike", async (req, res) => {
  const { id } = req.params;
  try {
    await connection.query("UPDATE movies SET likes = GREATEST(likes - 1, 0) WHERE id = ?", [id]);
    res.json({ message: "Movie unliked" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/movies/:id/comments", async (req, res) => {
  const movieId = req.params.id;
  try {
    const [comments] = await connection.query(
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
    const [result] = await connection.query(
      "INSERT INTO movie_comments (movie_id, email, comment_text) VALUES (?, ?, ?)",
      [movieId, email.trim(), comment_text.trim()]
    );

    const [rows] = await connection.query(
      "SELECT id, email, comment_text, created_at FROM movie_comments WHERE id = ?",
      [result.insertId]
    );

    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/comments/:id", async (req, res) => {
  const commentId = req.params.id;
  try {
    const [result] = await connection.query("DELETE FROM movie_comments WHERE id = ?", [commentId]);
    if (result.affectedRows === 0) return res.status(404).json({ error: "Comment not found" });
    res.json({ message: "Comment deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin login (NO JWT)
app.post("/admin/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "Email and password are required" });

  try {
    const [users] = await connection.query("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });

    res.json({ message: "Login successful", user: { id: user.id, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running`);
});
