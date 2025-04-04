// This script explores the structure of the @mux/mux-node package
// to help debug issues with integration

// Import the package
const Mux = require('@mux/mux-node');

console.log('Running Mux SDK version test');
console.log('===========================');

// Check the package version
console.log(`Mux Node SDK Version: ${require('@mux/mux-node/package.json').version}`);

// Log the structure of the Mux object
console.log('\nMux Object Structure:');
console.log('-------------------');
console.log('Mux is a constructor:', typeof Mux === 'function');
console.log('Mux exports:', Object.keys(Mux));

// Initialize Mux with environment variables
if (process.env.MUX_TOKEN_ID && process.env.MUX_TOKEN_SECRET) {
  try {
    console.log('\nInitializing Mux with credentials...');
    
    const muxClient = new Mux({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET
    });
    
    console.log('Mux client initialized successfully!');
    console.log('Mux client properties:', Object.keys(muxClient));
    
    // Check if Video client exists
    if (muxClient.Video) {
      console.log('\nVideo client exists!');
      console.log('Video client properties:', Object.keys(muxClient.Video));
      
      // Check liveStreams
      if (muxClient.Video.liveStreams) {
        console.log('\nliveStreams client exists!');
        console.log('liveStreams methods:', Object.keys(muxClient.Video.liveStreams));
        
        // Check available methods
        console.log('\nAvailable methods on liveStreams:');
        console.log('create method:', typeof muxClient.Video.liveStreams.create === 'function' ? 'Yes' : 'No');
        console.log('disable method:', typeof muxClient.Video.liveStreams.disable === 'function' ? 'Yes' : 'No');
        console.log('disableLiveStream method:', typeof muxClient.Video.liveStreams.disableLiveStream === 'function' ? 'Yes' : 'No');
      } else {
        console.log('\nliveStreams client does not exist!');
      }
      
      // Check assets
      if (muxClient.Video.assets) {
        console.log('\nassets client exists!');
        console.log('assets methods:', Object.keys(muxClient.Video.assets));
        
        // Check if get method exists
        console.log('get method:', typeof muxClient.Video.assets.get === 'function' ? 'Yes' : 'No');
      } else {
        console.log('\nassets client does not exist!');
      }
    } else {
      console.log('\nVideo client does not exist!');
    }
  } catch (error) {
    console.error('Error initializing Mux:', error.message);
  }
} else {
  console.log('\nMUX_TOKEN_ID and/or MUX_TOKEN_SECRET environment variables are not set.');
}

console.log('\nTest complete!');