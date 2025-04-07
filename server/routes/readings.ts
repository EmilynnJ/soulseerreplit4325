import { Router } from 'express';
import { storage } from '../storage';
import { requireAuth, requireReader } from '../middleware/auth';
import { z } from 'zod';
import { readings } from '@shared/schema';

const router = Router();

// Get all readings
router.get('/', requireAuth, async (req, res) => {
  try {
    const readings = await storage.getReadings();
    res.json(readings);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get a specific reading
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const reading = await storage.getReading(Number(req.params.id));
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }
    res.json(reading);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new reading
router.post('/', requireAuth, async (req, res) => {
  try {
    const readingSchema = z.object({
      readerId: z.number(),
      clientId: z.number(),
      type: z.enum(['chat', 'video', 'voice']),
      readingMode: z.enum(['scheduled', 'on_demand']),
      scheduledFor: z.string().optional(),
      duration: z.number(),
      pricePerMinute: z.number(),
      notes: z.string().optional(),
    });

    const validatedData = readingSchema.parse(req.body);
    const reading = await storage.createReading({
      ...validatedData,
      status: 'scheduled',
      price: validatedData.pricePerMinute * validatedData.duration, // Legacy price field
    });

    res.status(201).json(reading);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// Start a reading session
router.post('/:id/start', requireAuth, async (req, res) => {
  try {
    const reading = await storage.getReading(Number(req.params.id));
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    // Only allow starting if status is payment_completed
    if (reading.status !== 'payment_completed') {
      return res.status(400).json({ error: 'Reading cannot be started - payment not completed' });
    }

    const updatedReading = await storage.updateReading(reading.id, {
      status: 'in_progress',
      startedAt: new Date(),
    });

    // Notify both reader and client about reading start
    const websocket = (global as any).websocket;
    if (websocket) {
      const notificationData = {
        type: 'reading_started',
        reading: updatedReading,
        timestamp: Date.now()
      };
      websocket.notifyUser(reading.readerId, notificationData);
      websocket.notifyUser(reading.clientId, notificationData);
    }

    res.json(updatedReading);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// End a reading session
router.post('/:id/end', requireAuth, async (req, res) => {
  try {
    const reading = await storage.getReading(Number(req.params.id));
    if (!reading) {
      return res.status(404).json({ error: 'Reading not found' });
    }

    const { status, duration, totalPrice } = req.body; // Added status to allow admin to control status changes

    // Only allow certain transitions based on user role and current status
    const validTransitions: Record<string, string[]> = {
      scheduled: ["cancelled", "in_progress"],
      waiting_payment: ["cancelled", "payment_completed"],
      payment_completed: ["in_progress", "cancelled"],
      in_progress: ["completed", "cancelled"],
      completed: [], // No transitions from completed
      cancelled: [] // No transitions from cancelled
    };

    if (!validTransitions[reading.status].includes(status)) {
      return res.status(400).json({ 
        message: `Cannot transition from ${reading.status} to ${status}`,
        validTransitions: validTransitions[reading.status]
      });
    }

    // Additional validations based on role
    if (req.user.role === "client" && !["cancelled"].includes(status)) {
      return res.status(403).json({ message: "Clients can only cancel readings" });
    } else if (req.user.role === "admin") {
      // Admins can perform any valid transition
      console.log("Admin performing status transition:", status);
    }


    const updatedReading = await storage.updateReading(reading.id, {
      status,
      completedAt: status === 'completed' ? new Date() : reading.completedAt, // Only update completedAt if completing
      duration: status === 'completed' ? duration : reading.duration, // Only update duration if completing
      totalPrice: status === 'completed' ? totalPrice : reading.totalPrice, // Only update totalPrice if completing
    });

    // Notify both reader and client about reading completion or cancellation
    const websocket = (global as any).websocket;
    if (websocket) {
      const notificationData = {
        type: status === 'completed' ? 'reading_completed' : 'reading_cancelled',
        reading: updatedReading,
        duration: status === 'completed' ? duration : reading.duration,
        totalPrice: status === 'completed' ? totalPrice : reading.totalPrice,
        timestamp: Date.now()
      };
      websocket.notifyUser(reading.readerId, notificationData);
      websocket.notifyUser(reading.clientId, notificationData);
    }

    res.json(updatedReading);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;