const mysql = require("mysql2/promise");
const bcrypt = require("bcrypt");

async function insertUser() {
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "getagasobanuye",
  });

  const email = "hirwap96@gmail.com";
  const plainPassword = "patrick#@2008";

  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  try {
    await connection.query(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, hashedPassword]
    );
    console.log("✅ User inserted successfully.");
  } catch (err) {
    console.error("❌ Failed to insert user:", err.message);
  } finally {
    connection.end();
  }
}

insertUser();
