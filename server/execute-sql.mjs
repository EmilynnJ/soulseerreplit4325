import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from 'pg';
const { Client } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sqlFile = process.argv[2]; // Get filename from command line
if (!sqlFile) {
  console.error('Please provide an SQL file to execute');
  process.exit(1);
}

// Read database URL from .env file if it exists
let databaseUrl = '';
try {
  const envContent = fs.readFileSync(path.join(__dirname, '../.env'), 'utf8');
  const dbUrlMatch = envContent.match(/POSTGRES_URL=(.+)/);
  if (dbUrlMatch) {
    databaseUrl = dbUrlMatch[1];
  }
} catch (err) {
  console.warn('Could not read .env file:', err.message);
}

// Default to localhost if no POSTGRES_URL found
if (!databaseUrl) {
  databaseUrl = 'postgres://postgres:postgres@localhost:5432/soulseer';
}

console.log(`Using database: ${databaseUrl}`);
console.log(`Current directory: ${process.cwd()}`);
console.log(`Script directory: ${__dirname}`);
console.log(`SQL file argument: ${sqlFile}`);

async function execute() {
  // Create a new client
  const client = new Client({
    connectionString: databaseUrl
  });

  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to database');

    // Read the SQL file - use an absolute path if provided, otherwise resolve relative to current dir
    const sqlFilePath = path.isAbsolute(sqlFile) 
      ? sqlFile 
      : path.resolve(process.cwd(), sqlFile);
    
    console.log(`Reading SQL file from: ${sqlFilePath}`);
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`Executing SQL from ${sqlFile}:\n`);
    console.log(sql);

    // Execute the SQL
    const result = await client.query(sql);
    console.log('\nExecution result:');
    
    if (Array.isArray(result)) {
      result.forEach((r, i) => {
        console.log(`Result set ${i + 1}:`);
        console.table(r.rows);
      });
    } else {
      console.table(result.rows || []);
    }
    
    console.log('SQL executed successfully');
  } catch (err) {
    console.error('Error executing SQL:', err);
  } finally {
    // Close the connection
    await client.end();
    console.log('Connection closed');
  }
}

execute().catch(err => {
  console.error('Error:', err);
  process.exit(1);
}); 