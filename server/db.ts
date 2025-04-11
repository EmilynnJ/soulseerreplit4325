import { drizzle } from 'drizzle-orm/node-postgres';
import { neon } from '@neondatabase/serverless';
import pg from 'pg';
import * as schema from '@shared/schema';

const { Pool } = pg;

// Create a PostgreSQL pool using the DATABASE_URL environment variable
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500, // Close connections after too many uses
  ssl: {
    rejectUnauthorized: false // Required for Neon serverless connections
  }
});

// Also create a Neon serverless client for edge functions or serverless environments
export const sql = neon(process.env.DATABASE_URL!);

// Initialize Drizzle with the pool and schema (primary connection method)
export const db = drizzle(pool, { schema });