import express from 'express';
import { sessionTrackerService } from '../services/session-tracker-service';
import { zegoService } from '../services/zego-service';
import { giftService } from '../services/gift-service';
import { storage } from '../storage';
import { z } from 'zod';

const router = express.Router();

// Authentication middleware
function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// 1. Create a new reading session
router.post('/reading/create', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      readerId: z.number(),
      sessionType: z.enum(['video', 'voice', 'chat']),
      paymentMethodId: z.string()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { readerId, sessionType, paymentMethodId } = validation.data;
    const clientId = req.session.userId;

    // Create the session using ZegoService
    const session = await zegoService.createSession(
      readerId,
      clientId,
      sessionType,
      paymentMethodId
    );

    res.json(session);
  } catch (error: any) {
    console.error('Error creating reading session:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Get active session details for a user
router.get('/reading/session/:roomId', requireAuth, async (req, res) => {
  try {
    const roomId = req.params.roomId;
    if (!roomId) {
      return res.status(400).json({ error: 'Room ID is required' });
    }

    const userId = req.session.userId;
    const sessionDetails = sessionTrackerService.getSessionDetails(roomId);

    if (!sessionDetails) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Make sure the user is part of this session
    if (sessionDetails.readerId !== userId && sessionDetails.clientId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }

    // Return session details
    res.json({
      roomId,
      ...sessionDetails
    });
  } catch (error: any) {
    console.error('Error getting session details:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Mark session as connected (when both parties join)
router.post('/reading/connected', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      roomId: z.string()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { roomId } = validation.data;
    
    // Get session details
    const sessionDetails = sessionTrackerService.getSessionDetails(roomId);
    if (!sessionDetails) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Make sure the user is part of this session
    const userId = req.session.userId;
    if (sessionDetails.readerId !== userId && sessionDetails.clientId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }

    // Mark as connected
    await sessionTrackerService.sessionConnected(roomId);

    res.json({ success: true, message: 'Session marked as connected' });
  } catch (error: any) {
    console.error('Error marking session as connected:', error);
    res.status(500).json({ error: error.message });
  }
});

// 4. End a reading session
router.post('/reading/end', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      roomId: z.string(),
      reason: z.string().optional()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { roomId, reason } = validation.data;
    
    // Get session details
    const sessionDetails = sessionTrackerService.getSessionDetails(roomId);
    if (!sessionDetails) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Make sure the user is part of this session
    const userId = req.session.userId;
    if (sessionDetails.readerId !== userId && sessionDetails.clientId !== userId) {
      return res.status(403).json({ error: 'You are not authorized to access this session' });
    }

    // End the session
    const finalLog = await sessionTrackerService.endSession(roomId, reason || 'completed');

    res.json({ 
      success: true, 
      message: 'Session ended',
      sessionLog: finalLog
    });
  } catch (error: any) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Get active sessions for the current user
router.get('/reading/active', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const allSessions = sessionTrackerService.getActiveSessions();
    
    // Filter sessions where user is participant
    const userSessions = allSessions.filter(
      session => 
        session.session.readerId === userId || 
        session.session.clientId === userId
    );

    res.json(userSessions);
  } catch (error: any) {
    console.error('Error getting active sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

// 6. Get session history for the current user
router.get('/reading/history', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    let sessionLogs;
    if (user.role === 'reader') {
      sessionLogs = await sessionTrackerService.getReaderSessions(userId);
    } else {
      sessionLogs = await sessionTrackerService.getClientSessions(userId);
    }
    
    res.json(sessionLogs);
  } catch (error: any) {
    console.error('Error getting session history:', error);
    res.status(500).json({ error: error.message });
  }
});

// 7. Start a livestream (for readers only)
router.post('/livestream/start', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      title: z.string(),
      description: z.string(),
      category: z.string(),
      thumbnailUrl: z.string().optional()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { title, description, category, thumbnailUrl } = validation.data;
    const userId = req.session.userId;
    
    // Check if user is a reader
    const user = await storage.getUser(userId);
    if (!user || user.role !== 'reader') {
      return res.status(403).json({ error: 'Only readers can start livestreams' });
    }
    
    // Start the livestream
    const livestream = await zegoService.startLivestream(
      userId,
      title,
      description,
      category,
      thumbnailUrl
    );
    
    res.json(livestream);
  } catch (error: any) {
    console.error('Error starting livestream:', error);
    res.status(500).json({ error: error.message });
  }
});

// 8. Update livestream status
router.post('/livestream/update-status', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      livestreamId: z.number(),
      status: z.enum(['created', 'live', 'ended'])
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { livestreamId, status } = validation.data;
    const userId = req.session.userId;
    
    // Check if user owns this livestream
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      return res.status(404).json({ error: 'Livestream not found' });
    }
    
    if (livestream.userId !== userId) {
      return res.status(403).json({ error: 'You do not have permission to update this livestream' });
    }
    
    // Update the status
    const updatedLivestream = await zegoService.updateLivestreamStatus(livestreamId, status);
    
    res.json(updatedLivestream);
  } catch (error: any) {
    console.error('Error updating livestream status:', error);
    res.status(500).json({ error: error.message });
  }
});

// 9. Join a livestream as a viewer
router.post('/livestream/join', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      livestreamId: z.number()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { livestreamId } = validation.data;
    const userId = req.session.userId;
    
    // Join the livestream
    const joinInfo = await zegoService.joinLivestream(userId, livestreamId);
    
    res.json(joinInfo);
  } catch (error: any) {
    console.error('Error joining livestream:', error);
    res.status(500).json({ error: error.message });
  }
});

// 10. Get current active livestreams
router.get('/livestream/active', async (req, res) => {
  try {
    const activeLivestreams = await storage.getLivestreams();
    
    // Filter to only active livestreams
    const liveStreams = activeLivestreams.filter(stream => stream.status === 'live');
    
    // Include streamer information
    const enrichedStreams = await Promise.all(
      liveStreams.map(async (stream) => {
        const streamer = await storage.getUser(stream.userId);
        return {
          ...stream,
          streamer: streamer ? {
            id: streamer.id,
            username: streamer.username,
            fullName: streamer.fullName,
            profileImage: streamer.profileImage
          } : null
        };
      })
    );
    
    res.json(enrichedStreams);
  } catch (error: any) {
    console.error('Error getting active livestreams:', error);
    res.status(500).json({ error: error.message });
  }
});

// 11. Send a gift/tip during livestream
router.post('/livestream/gift', requireAuth, async (req, res) => {
  try {
    const schema = z.object({
      livestreamId: z.number(),
      amount: z.number().min(1),
      giftType: z.enum(['applause', 'heart', 'star', 'diamond', 'custom']),
      message: z.string().optional(),
      paymentMethodId: z.string()
    });

    const validation = schema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: validation.error.issues });
    }

    const { livestreamId, amount, giftType, message, paymentMethodId } = validation.data;
    const senderId = req.session.userId;
    
    // Get the livestream
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      return res.status(404).json({ error: 'Livestream not found' });
    }
    
    if (livestream.status !== 'live') {
      return res.status(400).json({ error: 'Livestream is not currently live' });
    }
    
    // Create the gift entry
    const { gift, log } = await giftService.sendGift(
      senderId,
      livestream.userId,
      livestreamId,
      amount,
      giftType,
      message
    );
    
    // Process payment
    await giftService.processGiftPayment(gift.id, paymentMethodId);
    
    res.json({ 
      success: true,
      gift,
      log 
    });
  } catch (error: any) {
    console.error('Error sending gift:', error);
    res.status(500).json({ error: error.message });
  }
});

// 12. Get livestream details
router.get('/livestream/:id', async (req, res) => {
  try {
    const livestreamId = parseInt(req.params.id);
    if (isNaN(livestreamId)) {
      return res.status(400).json({ error: 'Invalid livestream ID' });
    }
    
    const livestream = await storage.getLivestream(livestreamId);
    if (!livestream) {
      return res.status(404).json({ error: 'Livestream not found' });
    }
    
    // Get host information
    const host = await storage.getUser(livestream.userId);
    
    // Get gift information
    const gifts = await giftService.getGiftsForLivestream(livestreamId);
    const totalGiftValue = await giftService.getTotalGiftValueForLivestream(livestreamId);
    
    res.json({
      livestream,
      host: host ? {
        id: host.id,
        username: host.username,
        fullName: host.fullName,
        profileImage: host.profileImage,
        bio: host.bio
      } : null,
      giftSummary: {
        count: gifts.length,
        totalValue: totalGiftValue
      }
    });
  } catch (error: any) {
    console.error('Error getting livestream details:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;