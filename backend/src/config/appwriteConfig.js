const { Client, Account, Users } = require('node-appwrite');
require('dotenv').config({ path: '../../../.env' });

const client = new Client()
    .setEndpoint(process.env.VITE_APPWRITE_API_ENDPOINT) // Your Appwrite Endpoint
    .setProject(process.env.VITE_APPWRITE_PROJECT_ID) // Your project ID
    .setKey(process.env.VITE_APPWRITE_API); // Your Appwrite API secret key from root .env

const account = new Account(client);
const users = new Users(client);

module.exports = { client, account, users };