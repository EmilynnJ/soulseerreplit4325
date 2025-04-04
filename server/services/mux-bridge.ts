// Bridge between new Mux client and the rest of the application
import * as muxFixed from './mux-client.fixed';
import { storage } from '../storage';
import { User, Livestream, InsertLivestream } from '@shared/schema';

export const createLivestream = muxFixed.createLivestream;
export const getLivestreamDetails = muxFixed.getLivestreamDetails;
export const startLivestream = muxFixed.startLivestream;
export const endLivestream = muxFixed.endLivestream;
export const handleMuxWebhook = muxFixed.handleMuxWebhook;
export const getActiveLivestreams = muxFixed.getActiveLivestreams;

// Re-export these methods so they can be imported from muxClient in routes.ts
export async function getLivestreamsForUser(userId: number): Promise<Livestream[]> {
  try {
    const allLivestreams = await storage.getLivestreams();
    return allLivestreams.filter((ls: Livestream) => ls.userId === userId);
  } catch (error) {
    console.error(`Error getting livestreams for user ${userId}:`, error);
    throw error;
  }
}

export async function getPublicLivestreams(): Promise<Livestream[]> {
  try {
    const allLivestreams = await storage.getLivestreams();
    return allLivestreams.filter((ls: Livestream) => ls.status === 'live');
  } catch (error) {
    console.error('Error getting public livestreams:', error);
    throw error;
  }
}

// Mux client is initialized automatically in mux-fixed.ts