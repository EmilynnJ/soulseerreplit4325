import { db } from "../db";
import * as fs from "fs";
import * as path from "path";
import pg from "pg";
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function runMigration() {
  try {
    console.log("Starting payment_link_url migration...");
    
    // Check if migration already exists
    const checkResult = await pool.query(
      "SELECT name FROM migrations WHERE name = $1",
      ["add_payment_link_url"]
    );
    
    if (checkResult.rows.length > 0) {
      console.log("Migration 'add_payment_link_url' already applied. Skipping.");
      return;
    }
    
    console.log("Running add_payment_link_url migration...");
    
    // Read and execute the SQL file
    const sqlPath = path.join(__dirname, "add_payment_link_url.sql");
    const sql = fs.readFileSync(sqlPath, "utf8");
    
    await pool.query(sql);
    
    // Record the migration
    await pool.query(
      "INSERT INTO migrations (name) VALUES ($1)",
      ["add_payment_link_url"]
    );
    
    console.log("Migration add_payment_link_url completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
