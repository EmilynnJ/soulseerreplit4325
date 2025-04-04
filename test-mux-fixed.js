// Test script for the fixed Mux client
require('dotenv').config();
const express = require('express');
const app = express();
const port = 4001;

// Basic middleware
app.use(express.json());

// Logging function
function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

// Import the Mux SDK directly
const Mux = require('@mux/mux-node');

// Main test function
async function testMux() {
  try {
    // Get credentials from environment
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    
    if (!tokenId || !tokenSecret) {
      log(`Error: Missing MUX credentials`);
      return false;
    }
    
    log(`MUX_TOKEN_ID found (length: ${tokenId.length})`);
    log(`MUX_TOKEN_SECRET found (length: ${tokenSecret.length})`);
    
    // Initialize Mux client
    const muxClient = new Mux({ tokenId, tokenSecret });
    log('Mux client initialized');
    
    // Try to list livestreams
    log('Fetching live streams...');
    const liveStreams = await muxClient.video.liveStreams.list();
    log(`Successfully retrieved ${liveStreams.data.length} live streams`);
    
    // Try to create a test live stream
    log('Creating test live stream...');
    const newLiveStream = await muxClient.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public']
      }
    });
    
    log(`Successfully created live stream: ${newLiveStream.id}`);
    log(`Stream key: ${newLiveStream.stream_key}`);
    log(`Playback ID: ${newLiveStream.playback_ids[0].id}`);
    
    // Try to disable the test live stream we just created
    log(`Disabling live stream: ${newLiveStream.id}`);
    await muxClient.video.liveStreams.disable(newLiveStream.id);
    log('Successfully disabled live stream');
    
    return true;
  } catch (error) {
    log(`Error testing Mux: ${error.message}`);
    log(error.stack);
    return false;
  }
}

// API route for testing
app.get('/test-mux', async (req, res) => {
  try {
    const success = await testMux();
    res.json({
      success,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Start the server
app.listen(port, '0.0.0.0', async () => {
  log(`Mux test server listening on port ${port}`);
  
  // Run the test on startup
  try {
    const result = await testMux();
    log(`Initial Mux test ${result ? 'successful' : 'failed'}`);
  } catch (error) {
    log(`Error running initial Mux test: ${error.message}`);
  }
});