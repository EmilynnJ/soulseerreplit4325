// Fixed import and usage for Mux SDK v10.1.0
import Mux from '@mux/mux-node';
import { storage } from '../storage';
import { Livestream, type User } from '@shared/schema';

// Helper function for logging
function log(message: string, tag = 'mux') {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [${tag}] ${message}`);
}

// Get MUX credentials from environment
function getMuxCredentials() {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;
  
  if (!tokenId || !tokenSecret) {
    log("MUX credentials not found. MUX features will be disabled.");
    return null;
  }
  
  return { tokenId, tokenSecret };
}

// Initialize the Mux client once at module load time
const credentials = getMuxCredentials();
const muxClient = credentials ? new Mux(credentials) : null;
log(muxClient ? "MUX client initialized on startup" : "MUX client initialization failed - missing credentials");

// Types for MUX API responses
interface MuxLiveStream {
  id: string;
  status: string;
  stream_key: string;
  playback_ids: Array<{ id: string; policy: string }>;
  created_at: string;
  recent_asset_ids?: string[];
}

interface MuxAsset {
  id: string;
  playback_ids: Array<{ id: string; policy: string }>;
  status: string;
  duration: number;
  created_at: string;
  recent_asset_ids?: string[];
}

// Create a new livestream
export async function createLivestream(user: User, title: string, description: string) {
  try {
    log(`Creating new livestream for user ${user.id}`);

    // Check if client is available
    if (!muxClient) {
      throw new Error("MUX client not initialized - check your MUX credentials");
    }

    // Create a new livestream using FIXED MUX API call pattern
    const response = await muxClient.video.liveStreams.create({
      playback_policy: ['public'],
      new_asset_settings: {
        playback_policy: ['public'],
      }
    });
    
    const muxLiveStream = response as unknown as MuxLiveStream;

    // Save livestream details to our database
    const livestream = await storage.createLivestream({
      userId: user.id,
      title,
      description,
      status: 'created',
      streamKey: muxLiveStream.stream_key,
      playbackId: muxLiveStream.playback_ids[0].id,
      muxLivestreamId: muxLiveStream.id,
      // Add missing schema fields
      category: 'general',
      thumbnailUrl: null,
    });

    log(`Livestream created successfully: ${livestream.id}`);
    
    return {
      ...livestream,
      streamUrl: `rtmps://global-live.mux.com:443/app/${muxLiveStream.stream_key}`
    };
  } catch (error) {
    log(`Error creating livestream: ${error}`);
    throw error;
  }
}

// Get livestream details including stream key and RTMP URL
export async function getLivestreamDetails(id: number) {
  try {
    const livestream = await storage.getLivestream(id);
    if (!livestream) {
      throw new Error(`Livestream with ID ${id} not found`);
    }

    // If the livestream exists in our database but not in MUX, create a new one in MUX
    if (!livestream.muxLivestreamId) {
      log(`Livestream ${id} has no MUX ID, creating new MUX livestream`);
      
      // Check if client is available
      if (!muxClient) {
        throw new Error("MUX client not initialized - check your MUX credentials");
      }

      // Create a new livestream using FIXED MUX API call pattern
      const response = await muxClient.video.liveStreams.create({
        playback_policy: ['public'],
        new_asset_settings: {
          playback_policy: ['public'],
        }
      });
      
      const muxLiveStream = response as unknown as MuxLiveStream;

      // Update our database with MUX details
      await storage.updateLivestream(id, {
        streamKey: muxLiveStream.stream_key,
        playbackId: muxLiveStream.playback_ids[0].id,
        muxLivestreamId: muxLiveStream.id,
      });

      return {
        ...livestream,
        streamKey: muxLiveStream.stream_key,
        playbackId: muxLiveStream.playback_ids[0].id,
        muxLivestreamId: muxLiveStream.id,
        streamUrl: `rtmps://global-live.mux.com:443/app/${muxLiveStream.stream_key}`
      };
    }

    return {
      ...livestream,
      streamUrl: `rtmps://global-live.mux.com:443/app/${livestream.streamKey}`
    };
  } catch (error) {
    log(`Error getting livestream details: ${error}`);
    throw error;
  }
}

// Start a livestream - update status in our database
export async function startLivestream(id: number) {
  try {
    const livestream = await storage.getLivestream(id);
    if (!livestream) {
      throw new Error(`Livestream with ID ${id} not found`);
    }

    // Update livestream status in our database
    const updatedLivestream = await storage.updateLivestream(id, {
      status: 'live',
    });

    log(`Livestream ${id} started`);
    return updatedLivestream;
  } catch (error) {
    log(`Error starting livestream: ${error}`);
    throw error;
  }
}

// End a livestream - update status in our database and optionally disable in MUX
export async function endLivestream(id: number, disableMuxStream = true) {
  try {
    const livestream = await storage.getLivestream(id);
    if (!livestream) {
      throw new Error(`Livestream with ID ${id} not found`);
    }

    // If requested, disable the livestream in MUX
    if (disableMuxStream && livestream.muxLivestreamId) {
      if (!muxClient) {
        throw new Error("MUX client not initialized - check your MUX credentials");
      }
      
      await muxClient.video.liveStreams.disable(livestream.muxLivestreamId);
      log(`Disabled MUX livestream ${livestream.muxLivestreamId}`);
    }

    // Get asset details if available
    let assetDetails = null;
    if (livestream.muxAssetId) {
      try {
        if (!muxClient) {
          throw new Error("MUX client not initialized - check your MUX credentials");
        }
        
        // Use any to bypass type checking for Mux SDK differences
        const assets = muxClient.video.assets as any;
        const response = await assets.get(livestream.muxAssetId);
        assetDetails = response as unknown as MuxAsset;
      } catch (error) {
        log(`Could not fetch asset details: ${error}`);
      }
    }

    // Update livestream status in our database
    const updatedLivestream = await storage.updateLivestream(id, {
      status: 'ended',
      thumbnailUrl: assetDetails?.playback_ids && assetDetails.playback_ids.length > 0 
        ? `https://image.mux.com/${assetDetails.playback_ids[0].id}/thumbnail.jpg`
        : null
    });

    log(`Livestream ${id} ended`);
    return updatedLivestream;
  } catch (error) {
    log(`Error ending livestream: ${error}`);
    throw error;
  }
}

// Handle webhook events from MUX
export async function handleMuxWebhook(rawBody: string, signature: string) {
  try {
    // First, try to parse the body as JSON
    let body;
    try {
      body = JSON.parse(rawBody);
      log(`Successfully parsed webhook JSON body`);
    } catch (parseError) {
      log(`Error parsing webhook JSON: ${parseError}`);
      return {
        success: false,
        message: 'Error processing webhook',
        error: `JSON parsing error: ${parseError}`,
        time: new Date().toISOString()
      };
    }

    // Verify webhook signature if MUX_WEBHOOK_SECRET is provided
    if (process.env.MUX_WEBHOOK_SECRET) {
      try {
        // Import crypto synchronously
        const crypto = require('crypto');
        const secret = process.env.MUX_WEBHOOK_SECRET as string;
        
        // Create HMAC using the secret
        const hmac = crypto.createHmac('sha256', secret);
        hmac.update(rawBody);
        const calculatedSignature = hmac.digest('hex');
        
        // Verify signature
        if (calculatedSignature !== signature) {
          log('MUX webhook signature verification failed');
          
          // In development mode, include signature details for debugging
          const debugInfo = process.env.NODE_ENV !== 'production' 
            ? {
                expected: calculatedSignature,
                received: signature,
                payload: rawBody.substring(0, 100) + (rawBody.length > 100 ? '...' : '')
              }
            : undefined;
            
          return {
            success: false,
            message: 'Invalid webhook signature',
            error: 'Signature mismatch',
            time: new Date().toISOString(),
            debug: debugInfo
          };
        }
        
        log('MUX webhook signature verified successfully');
      } catch (cryptoError) {
        log(`Error during signature verification: ${cryptoError}`);
        return {
          success: false,
          message: 'Error verifying webhook signature',
          error: `${cryptoError}`,
          time: new Date().toISOString()
        };
      }
    } else if (process.env.NODE_ENV !== 'production') {
      // For development, skip signature verification if no secret is set
      log('MUX_WEBHOOK_SECRET not set, skipping signature verification in development mode');
    } else {
      // In production, require MUX_WEBHOOK_SECRET
      log('MUX_WEBHOOK_SECRET missing in production environment');
      return {
        success: false,
        message: 'Missing MUX_WEBHOOK_SECRET in production environment',
        error: 'Configuration error',
        time: new Date().toISOString()
      };
    }
    
    // At this point, we've verified the signature and parsed the body
    const { type, data } = body;
    log(`Received MUX webhook: ${type}`);

    // Handle different event types
    switch (type) {
      case 'video.live_stream.active':
        await handleLivestreamActive(data);
        break;
      case 'video.live_stream.idle':
        await handleLivestreamIdle(data);
        break;
      case 'video.asset.ready':
        await handleAssetReady(data);
        break;
      default:
        log(`Unhandled webhook type: ${type}`);
        return { 
          success: true, 
          message: `Event type '${type}' received but not handled`,
          eventType: type
        };
    }

    return { 
      success: true, 
      message: 'Webhook processed successfully',
      eventType: type
    };
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error';
    log(`Error handling MUX webhook: ${errorMessage}`);
    
    // Return structured error for diagnostics instead of throwing
    return {
      success: false,
      message: 'Error processing webhook',
      error: errorMessage,
      time: new Date().toISOString()
    };
  }
}

// Handle livestream.active event
export async function handleLivestreamActive(data: any) {
  try {
    const muxLivestreamId = data.id;
    
    // Check if this is a test call (for development testing without real data)
    if (muxLivestreamId && muxLivestreamId.includes('test_') && process.env.NODE_ENV !== 'production') {
      log(`Processing test livestream.active event for ID: ${muxLivestreamId}`);
      return; // Skip actual storage updates for test events
    }
    
    // Find the livestream in our database
    const livestreams = await storage.getLivestreams();
    const livestream = livestreams.find(ls => ls.muxLivestreamId === muxLivestreamId);
    
    if (livestream) {
      await storage.updateLivestream(livestream.id, {
        status: 'live',
      });
      log(`Updated livestream ${livestream.id} to 'live' status via webhook`);
    } else {
      log(`Could not find livestream with MUX ID: ${muxLivestreamId}`);
    }
  } catch (error) {
    log(`Error handling livestream.active: ${error}`);
  }
}

// Handle livestream.idle event
export async function handleLivestreamIdle(data: any) {
  try {
    const muxLivestreamId = data.id;
    
    // Check if this is a test call (for development testing without real data)
    if (muxLivestreamId && muxLivestreamId.includes('test_') && process.env.NODE_ENV !== 'production') {
      log(`Processing test livestream.idle event for ID: ${muxLivestreamId}`);
      return; // Skip actual storage updates for test events
    }
    
    // Find the livestream in our database
    const livestreams = await storage.getLivestreams();
    const livestream = livestreams.find(ls => ls.muxLivestreamId === muxLivestreamId);
    
    if (livestream) {
      await storage.updateLivestream(livestream.id, {
        status: 'idle',
      });
      log(`Updated livestream ${livestream.id} to 'idle' status via webhook`);
    } else {
      log(`Could not find livestream with MUX ID: ${muxLivestreamId}`);
    }
  } catch (error) {
    log(`Error handling livestream.idle: ${error}`);
  }
}

// Handle asset.ready event
export async function handleAssetReady(data: any) {
  try {
    const muxAssetId = data.id;
    
    // Check if this is a test call (for development testing without MUX credentials)
    if (muxAssetId && muxAssetId.includes('test_') && process.env.NODE_ENV !== 'production') {
      log(`Processing test asset.ready event for ID: ${muxAssetId}`);
      return; // Skip actual API calls for test events
    }
    
    // Skip if Mux is not initialized
    if (!muxClient) {
      log(`MUX client not initialized, skipping asset.ready handling`);
      return;
    }
    
    // In production, get the asset details from MUX
    // Use any to bypass type checking for Mux SDK differences
    const assets = muxClient.video.assets as any;
    const response = await assets.get(muxAssetId);
    const asset = response as unknown as MuxAsset;
    
    // Find the corresponding livestream
    if (asset && asset.playback_ids && asset.playback_ids.length > 0) {
      const livestreams = await storage.getLivestreams();
      
      // Try to find a matching livestream
      const livestream = livestreams.find(ls => 
        ls.muxLivestreamId && asset.recent_asset_ids?.includes(ls.muxLivestreamId)
      );
      
      if (livestream) {
        await storage.updateLivestream(livestream.id, {
          // Just update the thumbnail URL as that's in the schema
          thumbnailUrl: `https://image.mux.com/${asset.playback_ids[0].id}/thumbnail.jpg`,
        });
        log(`Updated livestream ${livestream.id} with asset info via webhook`);
      }
    }
  } catch (error) {
    log(`Error handling asset.ready: ${error}`);
  }
}

// Get all active livestreams
export async function getActiveLivestreams() {
  try {
    const allLivestreams = await storage.getLivestreams();
    // Filter for active livestreams
    return allLivestreams.filter(ls => ls.status === 'live');
  } catch (error) {
    log(`Error getting active livestreams: ${error}`);
    throw error;
  }
}