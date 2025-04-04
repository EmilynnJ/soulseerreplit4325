// Testing Mux according to latest documentation
require('dotenv').config();

console.log('Starting Mux API test with latest documentation approach');

try {
  // First, let's see what we get when we require the module
  const muxModule = require('@mux/mux-node');
  console.log('Mux module contents:', Object.keys(muxModule));
  
  // Try the simple import approach from documentation
  const Mux = muxModule.default || muxModule.Mux || muxModule;
  console.log('Is Mux a constructor?', typeof Mux === 'function');
  
  // Try the direct Video client approach
  const { Video } = muxModule;
  console.log('Is Video available?', !!Video);
  console.log('Is Video a constructor?', typeof Video === 'function');
  
  // Try to initialize the Video API client
  if (typeof Video === 'function') {
    const videoClient = new Video({
      tokenId: process.env.MUX_TOKEN_ID,
      tokenSecret: process.env.MUX_TOKEN_SECRET,
    });
    
    console.log('Video client initialized');
    console.log('Video client methods:', Object.keys(videoClient));
    
    if (videoClient.liveStreams) {
      console.log('liveStreams exists on video client');
      console.log('liveStreams methods:', Object.keys(videoClient.liveStreams));
      
      // Try inspecting liveStreams object in detail
      console.log('liveStreams._client methods:', Object.keys(videoClient.liveStreams._client));
      
      // Try different methods that might be available
      if (typeof videoClient.liveStreams._client.get === 'function') {
        console.log('Trying liveStreams._client.get...');
        videoClient.liveStreams._client.get('/')
          .then(response => {
            console.log('LiveStreams get success!', response);
          })
          .catch(err => {
            console.error('LiveStreams get error:', err.message);
          });
      }
      
      // Try direct API call to list livestreams
      if (videoClient.liveStreams._client && typeof videoClient.liveStreams._client.request === 'function') {
        console.log('Trying direct request API...');
        videoClient.liveStreams._client.request('GET', '/video/v1/live-streams')
          .then(response => {
            console.log('Direct API request success!');
            console.log(response);
          })
          .catch(err => {
            console.error('Direct API request error:', err.message);
          });
      }
    } else {
      console.log('liveStreams does not exist on video client');
    }
  }
} catch (error) {
  console.error('Error in Mux API test:', error.message);
}