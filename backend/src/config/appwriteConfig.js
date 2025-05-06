// c:\Users\emily\soulseerreplit4325-1\backend\src\config\appwriteConfig.js
const { Client, Account, Users } = require('node-appwrite');
require('dotenv').config({ path: '../../../.env' });

const client = new Client();

client
    .setEndpoint(process.env.VITE_APPWRITE_API_ENDPOINT) // Your Appwrite Endpoint
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID) // Your project ID
    .setKey(process.env.APPWRITE_API_KEY); // Your Appwrite API secret key from root .env
    // Note: Ensure APPWRITE_API_KEY is defined in your root .env, not VITE_APPWRITE-API

const account = new Account(client);
const users = new Users(client);

module.exports = { client, account, users };