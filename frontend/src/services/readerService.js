// c:\Users\emily\soulseerreplit4325-1\frontend\src\services\readerService.js
import apiClient from './api';

export const getAvailableReaders = async () => {
  try {
    const response = await apiClient.get('/readers');
    return response.data;
  } catch (error) {
    console.error("Error fetching available readers:", error);
    throw error;
  }
};

export const getReaderProfile = async (readerId) => {
  // const response = await apiClient.get(`/readers/${readerId}`);
  // return response.data;
  console.log("Placeholder: Fetching reader profile for", readerId);
  return { id: readerId, name: "Mystic Meg", specialty: "Tarot", rate: 2.99 };
};
