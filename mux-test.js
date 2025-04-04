// Test MUX integration
require('dotenv').config();
const { Video } = require('@mux/mux-node');

console.log('Testing MUX API connection');
console.log(`MUX_TOKEN_ID exists: ${Boolean(process.env.MUX_TOKEN_ID)}`);
console.log(`MUX_TOKEN_SECRET exists: ${Boolean(process.env.MUX_TOKEN_SECRET)}`);

// Don't log the actual tokens for security reasons
console.log(`MUX_TOKEN_ID length: ${process.env.MUX_TOKEN_ID ? process.env.MUX_TOKEN_ID.length : 0}`);
console.log(`MUX_TOKEN_SECRET length: ${process.env.MUX_TOKEN_SECRET ? process.env.MUX_TOKEN_SECRET.length : 0}`);

try {
  // Initialize Video API with credentials
  const videoApi = new Video({
    tokenId: process.env.MUX_TOKEN_ID,
    tokenSecret: process.env.MUX_TOKEN_SECRET,
  });
  
  console.log('MUX SDK initialized successfully');
  
  // Test listing livestreams
  videoApi.LiveStreams.list()
    .then(response => {
      console.log(`Successfully retrieved live streams: ${response.data.length || 0} found`);
      console.log('MUX API connection working correctly');
      console.log('Sample response data structure:', JSON.stringify(response.data.slice(0, 1), null, 2));
    })
    .catch(error => {
      console.error('Error listing live streams:', error.message);
    });
} catch (error) {
  console.error('Error initializing MUX SDK:', error.message);
}