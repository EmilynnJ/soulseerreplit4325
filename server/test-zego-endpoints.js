/**
 * Test script for Zego endpoints
 * This script simulates API calls to the Zego integration endpoints
 */

import * as dotenv from 'dotenv';
import * as http from 'http';

dotenv.config();

// Mock user credentials - these should be from your database
const mockReader = {
  id: 2,
  username: 'testreader',
  fullName: 'Test Reader'
};

const mockClient = {
  id: 1,
  username: 'testclient',
  fullName: 'Test Client'
};

/**
 * Simple function to make an HTTP request
 */
function makeRequest(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve({ 
            statusCode: res.statusCode,
            headers: res.headers,
            data: jsonResponse
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

/**
 * Test the /health endpoint
 */
async function testHealthEndpoint() {
  console.log('\n=== Testing /health endpoint ===');
  
  try {
    const response = await makeRequest({
      host: 'localhost',
      port: 5000,
      path: '/health',
      method: 'GET'
    });
    
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', response.data);
    return response.statusCode === 200;
  } catch (error) {
    console.error('Error testing health endpoint:', error);
    return false;
  }
}

/**
 * Test the individual reading endpoints
 */
async function testZegoVideoEndpoint() {
  console.log('\n=== Testing /start-reading/video endpoint (unauthenticated) ===');
  
  try {
    // This will fail due to authentication, which is expected
    const response = await makeRequest({
      host: 'localhost',
      port: 5000,
      path: '/start-reading/video',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    }, {
      clientId: mockClient.id,
      readerId: mockReader.id
    });
    
    console.log(`Status: ${response.statusCode}`);
    console.log('Response:', response.data);
    
    console.log('\nNote: This test expects a 401 Unauthorized error since we\'re not authenticated.');
    console.log('To test with authentication, you would need to sign in through the web interface and use the session cookie.');
    return true;
  } catch (error) {
    console.error('Error testing Zego video endpoint:', error);
    return false;
  }
}

/**
 * Test the token generation with Zego credentials
 */
async function testZegoTokenGeneration() {
  console.log('\n=== Testing Zego token generation ===');
  
  // Check if Zego environment variables are set
  const zegoVideoAppId = process.env.ZEGO_VIDEO_APP_ID;
  const zegoVideoSecret = process.env.ZEGO_VIDEO_SERVER_SECRET;
  const zegoPhoneAppId = process.env.ZEGO_PHONE_APP_ID;
  const zegoPhoneSecret = process.env.ZEGO_PHONE_SERVER_SECRET;
  
  console.log('ZEGO_VIDEO_APP_ID available:', !!zegoVideoAppId);
  console.log('ZEGO_VIDEO_SERVER_SECRET available:', !!zegoVideoSecret);
  console.log('ZEGO_PHONE_APP_ID available:', !!zegoPhoneAppId);
  console.log('ZEGO_PHONE_SERVER_SECRET available:', !!zegoPhoneSecret);
  
  return true;
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('=== Starting Zego Endpoint Tests ===');
  
  // Test health endpoint
  const healthResult = await testHealthEndpoint();
  
  // Test Zego video endpoint
  const videoResult = await testZegoVideoEndpoint();
  
  // Test Zego token generation
  const tokenResult = await testZegoTokenGeneration();
  
  console.log('\n=== Test Results ===');
  console.log('Health Endpoint: ' + (healthResult ? 'PASS' : 'FAIL'));
  console.log('Zego Video Endpoint (Auth Check): ' + (videoResult ? 'PASS' : 'FAIL'));
  console.log('Zego Token Generation Check: ' + (tokenResult ? 'PASS' : 'FAIL'));
}

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
});