import dotenv from 'dotenv';
dotenv.config();

import { db } from './db.js';
import { storage } from './storage.js';
import { log } from './vite.js';

const WORKER_CHECK_INTERVAL = 60000; // 1 minute

async function processGifts() {
  try {
    log('Processing unprocessed gifts...', 'worker');
    const gifts = await storage.getUnprocessedGifts();
    log(`Found ${gifts.length} unprocessed gifts`, 'worker');

    for (const gift of gifts) {
      try {
        // Get the reader to update their balance
        const reader = await storage.getUser(gift.recipientId);
        if (!reader) {
          log(`Reader not found for gift: ${gift.id}`, 'worker');
          continue;
        }

        // Calculate the amount to add to reader's balance (70% of gift amount)
        const readerShare = Math.floor(gift.amount * 0.7); // 70% to reader, 30% to platform

        // Update reader's balance
        const updatedReader = await storage.updateUser(reader.id, {
          balance: (reader.balance || 0) + readerShare
        });

        log(`Updated balance for reader ${reader.username} by +$${readerShare}`, 'worker');

        // Mark gift as processed
        await storage.markGiftAsProcessed(gift.id);
        log(`Marked gift ${gift.id} as processed`, 'worker');
      } catch (error) {
        log(`Error processing gift ${gift.id}: ${error}`, 'worker');
      }
    }
  } catch (error) {
    log(`Error in processGifts: ${error}`, 'worker');
  }
}

// Process expired livestreams
async function processExpiredLivestreams() {
  try {
    log('Processing expired livestreams...', 'worker');
    
    const livestreams = await storage.getLivestreams();
    const now = new Date();
    
    for (const livestream of livestreams) {
      // Skip if not active or doesn't have an endTime
      if (livestream.status !== 'active' || !livestream.scheduledEndTime) continue;
      
      const endTime = new Date(livestream.scheduledEndTime);
      
      if (now > endTime) {
        log(`Ending expired livestream: ${livestream.id}`, 'worker');
        
        await storage.updateLivestream(livestream.id, {
          status: 'ended',
          actualEndTime: now
        });
        
        log(`Livestream ${livestream.id} marked as ended`, 'worker');
      }
    }
  } catch (error) {
    log(`Error in processExpiredLivestreams: ${error}`, 'worker');
  }
}

// Run the worker process
async function runWorkerProcess() {
  log('Starting background worker process...', 'worker');
  
  // Run these processes immediately on startup
  await processGifts();
  await processExpiredLivestreams();
  
  // Then run them on the defined interval
  setInterval(async () => {
    await processGifts();
    await processExpiredLivestreams();
  }, WORKER_CHECK_INTERVAL);
}

// Start the worker process
runWorkerProcess()
  .then(() => {
    log('Worker process started successfully', 'worker');
  })
  .catch((error) => {
    log(`Failed to start worker process: ${error}`, 'worker');
    process.exit(1);
  });