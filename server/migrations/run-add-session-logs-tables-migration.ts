import { pool } from "../db";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

async function runMigration() {
  console.log("Running migration to add session_logs and gift_logs tables...");

  const db = drizzle(pool);

  // Check if session_logs table already exists
  const migrationCheck = await pool.query(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'session_logs'
    )
  `);

  if (migrationCheck.rows[0].exists) {
    console.log("Tables already exist, skipping migration.");
    return;
  }

  try {
    // Create session_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS session_logs (
        id SERIAL PRIMARY KEY,
        room_id TEXT NOT NULL,
        reader_id INTEGER NOT NULL REFERENCES users(id),
        client_id INTEGER NOT NULL REFERENCES users(id),
        session_type TEXT NOT NULL CHECK (session_type IN ('video', 'voice', 'chat')),
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP,
        duration INTEGER,
        total_amount REAL,
        reader_earned REAL,
        platform_earned REAL,
        status TEXT NOT NULL CHECK (status IN ('waiting', 'connected', 'ended')),
        end_reason TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    // Create gift_logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS gift_logs (
        id SERIAL PRIMARY KEY,
        livestream_id INTEGER REFERENCES livestreams(id),
        sender_id INTEGER NOT NULL REFERENCES users(id),
        receiver_id INTEGER NOT NULL REFERENCES users(id),
        gift_type TEXT NOT NULL,
        gift_value REAL NOT NULL,
        receiver_earned REAL NOT NULL,
        platform_earned REAL NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    console.log("Migration completed successfully");
  } catch (error) {
    console.error("Migration failed:", error);
    throw error;
  }
}

runMigration().catch(console.error);