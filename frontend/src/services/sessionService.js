// c:\Users\emily\soulseerreplit4325-1\frontend\src\services\sessionService.js
import apiClient from './api';

export const startSession = async (readerUserId, sessionType) => {
  try {
    const response = await apiClient.post('/sessions/start', {
      readerUserId,
      sessionType,
    });
    return response.data; // Expected: { sessionId, sessionLog, message }
  } catch (error) {
    console.error("Error starting session:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

export const endSession = async (sessionId) => {
  try {
    const response = await apiClient.post(`/sessions/${sessionId}/end`);
    return response.data; // Expected: { message, sessionLog }
  } catch (error) {
    console.error("Error ending session:", error.response?.data || error.message);
    throw error.response?.data || error;
  }
};

export const getSessionDetails = async (sessionId) => {
  // const response = await apiClient.get(`/sessions/${sessionId}`);
  // return response.data;
};
