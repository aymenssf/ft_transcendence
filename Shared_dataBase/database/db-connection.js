import path, { dirname } from "path";
import sqlite3 from "sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sqlite = sqlite3.verbose();

class Database {
  constructor() {
    const db_path = process.env.NODE_ENV === 'production' 
    ? path.join(__dirname, "../../database/transcendence.db")  // Docker container path
    : path.join(__dirname, "../../../database/transcendence.db"); // Local development path
    console.log("Database path:", db_path);

    this.db = new sqlite.Database(db_path, (err) => {
      if (err) console.error("Database opening error: ", err);
      else console.log("Connecting to database ");
    });
    this.initTables();
  }

  initTables() {
    // database auth-user
    this.db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            avatar TEXT,
            is_42_user BOOLEAN DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
    // database dyal chat template !!!
    this.db.run(`
          CREATE TABLE IF NOT EXISTS chat_rooms (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            type TEXT CHECK(type IN ('private', 'group')) NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

    // database dyal game 
    this.db.run(`
      CREATE TABLE IF NOT EXISTS games (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        player1_id INTEGER NOT NULL,
        player2_id INTEGER,
        player1_score INTEGER DEFAULT 0,
        player2_score INTEGER DEFAULT 0 ,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        finished_at DATETIME
    )
    `);
  }

  createUser(username, email, password) {
    return new Promise((resolve, reject) => {
      this.db.run(
        "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
        [username, email, password],
        function (err) {
          if (err) {
            reject(err);
          } else {
            const userid = this.lastID;
            resolve({ id: userid, username, email });
          }
        }
      );
    });
  }

  findUserByUsername(username) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM users WHERE username = ?",
        [username],
        function (err, row) {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }

  findEmailByEmail(email) {
    return new Promise((resolve, reject) => {
      this.db.get(
        "SELECT * FROM users WHERE email = ?",
        [email],
        function (err, row) {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });
  }
  close() {
    this.db.close((err) => {
      if (err) console.error("Error closing the database connection:", err);
      else console.log("Database connection closed.");
    });
  }
}

export default new Database();
