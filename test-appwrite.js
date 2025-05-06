import { Client } from 'appwrite';

// Initialize Appwrite client
const appwriteClient = new Client();

// Set the endpoint and project ID
const endpoint = process.env.APPWRITE_API_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1';
const projectId = process.env.VITE_APPWRITE_PROJECT_ID || '681831b30038fbc171cf';

console.log(`Testing Appwrite configuration with:
- Endpoint: ${endpoint}
- Project ID: ${projectId}
`);

try {
  appwriteClient
    .setEndpoint(endpoint)
    .setProject(projectId);
  
  console.log('Appwrite client initialized successfully!');
} catch (error) {
  console.error('Error initializing Appwrite client:', error);
}