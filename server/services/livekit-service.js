/**
 * LiveKit service wrapper - replaces LiveKit with our WebRTC implementation
 * 
 * This file maintains the old LiveKit interface but redirects all calls
 * to our new WebRTC-based livestream service.
 */

const { livestreamService } = require('./livestream-service');

/**
 * Create a new livestream
 * @param {Object} user The user creating the livestream
 * @param {string} title The livestream title
 * @param {string} description The livestream description
 * @returns {Promise<Object>} The created livestream data
 */
async function createLivestream(user, title, description) {
  return await livestreamService.createLivestream(user, title, description);
}

/**
 * Start a livestream
 * @param {number} livestreamId The ID of the livestream to start
 * @param {boolean} reinstantiate Whether to reinstantiate an already started livestream
 * @returns {Promise<Object>} The updated livestream data
 */
async function startLivestream(livestreamId, reinstantiate = false) {
  return await livestreamService.startLivestream(livestreamId, reinstantiate);
}

/**
 * End a livestream
 * @param {number} livestreamId The ID of the livestream to end
 * @returns {Promise<Object>} The updated livestream data
 */
async function endLivestream(livestreamId) {
  return await livestreamService.endLivestream(livestreamId);
}

/**
 * Get details of a livestream
 * @param {number} livestreamId The ID of the livestream
 * @returns {Promise<Object>} The livestream details
 */
async function getLivestreamDetails(livestreamId) {
  return await livestreamService.getLivestreamDetails(livestreamId);
}

/**
 * Generate token for joining a livestream
 * @param {number} userId The user ID
 * @param {string} roomName The room name
 * @param {string} displayName The display name
 * @returns {Object} The token and room ID
 */
function generateLivestreamToken(userId, roomName, displayName) {
  return livestreamService.generateLivestreamToken(userId, roomName, displayName);
}

/**
 * Generate token for a reader to host a livestream
 * @param {number} userId The user ID
 * @param {string} roomName The room name
 * @param {string} displayName The display name
 * @returns {Object} The token and room ID
 */
function generateReaderLivestreamToken(userId, roomName, displayName) {
  return livestreamService.generateReaderLivestreamToken(userId, roomName, displayName);
}

// Export the interface that mimics the old LiveKit service
module.exports = {
  createLivestream,
  startLivestream,
  endLivestream,
  getLivestreamDetails,
  generateLivestreamToken,
  generateReaderLivestreamToken
};