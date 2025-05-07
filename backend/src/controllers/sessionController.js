const {v4: uuidv4} = require('uuid');
const db = require('../config/database');
const walletService = require('../services/walletService');

// In-memory store for active sessions (in production, consider a more robust solution like Redis)
const activeSessions = new Map();

// Start a new reading session
exports.startSession = async (req, res) => {
    try {
        const {readerId, clientId, sessionType} = req.body;
        if (!readerId || !clientId || !sessionType) {
            return res.status(400).json({message: 'Missing required parameters'});
        }

      // Check if client has sufficient balance
      const clientBalance = await walletService.getBalance(clientId);
      if (clientBalance <= 0) {
          return res.status(400).json({message: 'Insufficient balance to start a session'});
      }

      const sessionId = uuidv4();
      const startTime = new Date();
      const session = {
          id: sessionId,
          readerId,
          clientId,
          type: sessionType,
          startTime,
          status: 'pending',
          cost: 0,
          duration: 0
      };

      // Store session in memory
      activeSessions.set(sessionId, session);

      // Emit session request to reader via WebSocket
      if (req.io) {
          req.io.to(`reader:${readerId}`).emit('requestSession', session);
      } else {
          console.error('WebSocket io object not available in request');
          return res.status(500).json({message: 'WebSocket service unavailable'});
    }

      res.status(200).json({message: 'Session request sent', sessionId});
  } catch (error) {
      console.error('Error starting session:', error);
      res.status(500).json({message: 'Internal server error'});
  }
};

// Accept a session request
exports.acceptSession = async (req, res) => {
    try {
        const {sessionId} = req.body;
        const session = activeSessions.get(sessionId);

      if (!session) {
          return res.status(404).json({message: 'Session not found'});
      }

      session.status = 'active';
      activeSessions.set(sessionId, session);

      // Notify client that session is accepted
      if (req.io) {
          req.io.to(`client:${session.clientId}`).emit('sessionAccepted', {sessionId});
      } else {
          console.error('WebSocket io object not available in request');
          return res.status(500).json({message: 'WebSocket service unavailable'});
      }

      // Start tracking cost per minute (mock reader rate, in production fetch from DB)
      const readerRate = 5; // $5 per minute for demo
      setInterval(async () => {
          if (activeSessions.has(sessionId) && session.status === 'active') {
              session.duration += 1; // Increment duration by minute
              session.cost = Math.ceil(session.duration / 60) * readerRate;
              activeSessions.set(sessionId, session);

          // Check client balance
          const balance = await walletService.getBalance(session.clientId);
          if (balance < session.cost) {
              if (req.io) {
                  await endSessionInternal(sessionId, req.io);
              } else {
                  console.error('WebSocket io object not available for session termination');
              }
          }
      }
    }, 60000); // Check every minute

      res.status(200).json({message: 'Session accepted', sessionId});
  } catch (error) {
      console.error('Error accepting session:', error);
      res.status(500).json({message: 'Internal server error'});
  }
};

// End a session
exports.endSession = async (req, res) => {
    try {
        const {sessionId} = req.body;
        const session = activeSessions.get(sessionId);

      if (!session) {
          return res.status(404).json({message: 'Session not found'});
      }

      if (req.io) {
          await endSessionInternal(sessionId, req.io);
          res.status(200).json({message: 'Session ended', sessionId});
      } else {
          console.error('WebSocket io object not available in request');
          res.status(500).json({message: 'WebSocket service unavailable'});
    }
  } catch (error) {
      console.error('Error ending session:', error);
      res.status(500).json({message: 'Internal server error'});
  }
};

// Handle WebRTC signaling
exports.handleSignaling = async (req, res) => {
    try {
        const {sessionId, type, data, from} = req.body;
        const session = activeSessions.get(sessionId);

      if (!session) {
          return res.status(404).json({message: 'Session not found'});
      }

      if (req.io) {
          const target = from === session.clientId ? `reader:${session.readerId}` : `client:${session.clientId}`;
          req.io.to(target).emit(`webrtc${type.charAt(0).toUpperCase() + type.slice(1)}`, data);
          res.status(200).json({message: 'Signaling data forwarded'});
      } else {
          console.error('WebSocket io object not available in request');
          res.status(500).json({message: 'WebSocket service unavailable'});
    }
  } catch (error) {
      console.error('Error handling signaling:', error);
      res.status(500).json({message: 'Internal server error'});
  }
};

// Handle chat messages
exports.handleChatMessage = async (req, res) => {
    try {
        const {sessionId, message} = req.body;
        const session = activeSessions.get(sessionId);

      if (!session) {
          return res.status(404).json({message: 'Session not found'});
      }

      // Log message to DB (simplified, in production add proper schema)
      await db.query('INSERT INTO chat_messages (session_id, sender_id, content, timestamp) VALUES ($1, $2, $3, $4)',
          [sessionId, message.sender, message.content, message.timestamp]);

      if (req.io) {
          const target = message.sender === session.clientId ? `reader:${session.readerId}` : `client:${session.clientId}`;
          req.io.to(target).emit('chatMessage', message);
          res.status(200).json({message: 'Chat message sent'});
      } else {
          console.error('WebSocket io object not available in request');
          res.status(500).json({message: 'WebSocket service unavailable'});
    }
  } catch (error) {
      console.error('Error handling chat message:', error);
      res.status(500).json({message: 'Internal server error'});
  }
};

// Get session details
exports.getSessionDetails = async (req, res) => {
    try {
        const {sessionId} = req.params;
        const session = activeSessions.get(sessionId);

      if (!session) {
          return res.status(404).json({message: 'Session not found'});
    }

      res.status(200).json(session);
  } catch (error) {
      console.error('Error getting session details:', error);
      res.status(500).json({message: 'Internal server error'});
  }
};

// Internal function to end session and log to DB
async function endSessionInternal(sessionId, io) {
    const session = activeSessions.get(sessionId);
    if (!session) return;

    session.status = 'ended';
    const endTime = new Date();
    activeSessions.delete(sessionId);

    // Calculate final cost and duration
    const durationSeconds = Math.floor((endTime - session.startTime) / 1000);
    const finalDuration = Math.max(session.duration, durationSeconds);
    const readerRate = 5; // Mock rate, fetch from DB in production
    const finalCost = Math.ceil(finalDuration / 60) * readerRate;

    // Deduct cost from client and credit reader (70% to reader, 30% to platform)
    await walletService.deductBalance(session.clientId, finalCost);
    const readerEarnings = finalCost * 0.7;
    await walletService.addBalance(session.readerId, readerEarnings);

    // Log session to DB
    await db.query(
        'INSERT INTO sessions (id, reader_id, client_id, type, start_time, end_time, duration, cost, reader_earnings) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)',
        [sessionId, session.readerId, session.clientId, session.type, session.startTime, endTime, finalDuration, finalCost, readerEarnings]
    );

    // Notify both parties
    if (io) {
        io.to(`client:${session.clientId}`).emit('sessionEnded', {sessionId, cost: finalCost, duration: finalDuration});
        io.to(`reader:${session.readerId}`).emit('sessionEnded', {
            sessionId,
            earnings: readerEarnings,
            duration: finalDuration
        });
    } else {
        console.error('WebSocket io object not available for session termination notifications');
    }
}