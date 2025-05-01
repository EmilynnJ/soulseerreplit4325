import { drizzle } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';
import * as schema from '@shared/schema';

const { Pool } = pg;

// Define DATABASE_URL with fallback
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require&connect_timeout=10';

// Create a PostgreSQL pool using the DATABASE_URL 
export const pool = new Pool({ 
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500, // Close connections after too many uses
  ssl: {
    rejectUnauthorized: false // Required for Neon serverless connections
  }
});

// Also create a Neon serverless client for edge functions or serverless environments
export const sql = neon(DATABASE_URL);

// Initialize Drizzle with the pool and schema (primary connection method)
export const db = drizzle(pool, { schema });