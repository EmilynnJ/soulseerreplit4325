/**
 * Reader balance service for tracking and processing reader earnings
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import stripeClient from './stripe-client';

// Minimum balance required for payout
const MIN_PAYOUT_BALANCE = 1500; // $15.00 in cents

// Define reader balance types
interface ReaderBalance {
  readerId: number;
  readerName: string;
  pendingBalance: number; // Cents
  lifetimeEarnings: number; // Cents
  lastPayoutDate: string | null;
  stripeAccountId: string | null;
  lastUpdated: string;
}

interface PayoutRecord {
  id: string;
  readerId: number;
  amount: number; // Cents
  status: 'pending' | 'completed' | 'failed';
  timestamp: string;
  notes: string;
  stripePayoutId: string | null;
}

// Path to the reader balances and payouts JSON files
const READER_BALANCES_FILE_PATH = path.join(process.cwd(), 'data', 'reader_balances.json');
const READER_PAYOUTS_FILE_PATH = path.join(process.cwd(), 'data', 'reader_payouts.json');

// Ensure data directory and files exist
function ensureDataFilesExist() {
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  if (!fs.existsSync(READER_BALANCES_FILE_PATH)) {
    fs.writeFileSync(READER_BALANCES_FILE_PATH, JSON.stringify([], null, 2));
  }
  
  if (!fs.existsSync(READER_PAYOUTS_FILE_PATH)) {
    fs.writeFileSync(READER_PAYOUTS_FILE_PATH, JSON.stringify([], null, 2));
  }
}

/**
 * Reader balance service for tracking and processing reader earnings
 */
export const readerBalanceService = {
  /**
   * Get a reader's balance
   * 
   * @param readerId The ID of the reader
   * @returns The reader's balance or null if not found
   */
  getReaderBalance: (readerId: number): ReaderBalance | null => {
    ensureDataFilesExist();
    
    // Load reader balances
    const balances = JSON.parse(fs.readFileSync(READER_BALANCES_FILE_PATH, 'utf-8')) as ReaderBalance[];
    
    // Find reader balance
    const balance = balances.find(b => b.readerId === readerId);
    return balance || null;
  },
  
  /**
   * Get all reader balances
   * 
   * @returns Array of all reader balances
   */
  getAllReaderBalances: (): ReaderBalance[] => {
    ensureDataFilesExist();
    
    // Load reader balances
    return JSON.parse(fs.readFileSync(READER_BALANCES_FILE_PATH, 'utf-8')) as ReaderBalance[];
  },
  
  /**
   * Add earnings to a reader's balance
   * 
   * @param readerId The ID of the reader
   * @param readerName The name of the reader
   * @param amount The amount to add in cents
   * @returns The updated reader balance
   */
  addReaderEarnings: (readerId: number, readerName: string, amount: number): ReaderBalance => {
    ensureDataFilesExist();
    
    // Load reader balances
    const balances = JSON.parse(fs.readFileSync(READER_BALANCES_FILE_PATH, 'utf-8')) as ReaderBalance[];
    
    // Find reader balance
    const balanceIndex = balances.findIndex(b => b.readerId === readerId);
    
    if (balanceIndex === -1) {
      // Create new reader balance
      const newBalance: ReaderBalance = {
        readerId,
        readerName,
        pendingBalance: amount,
        lifetimeEarnings: amount,
        lastPayoutDate: null,
        stripeAccountId: null,
        lastUpdated: new Date().toISOString()
      };
      
      // Add to balances
      balances.push(newBalance);
      
      // Save balances
      fs.writeFileSync(READER_BALANCES_FILE_PATH, JSON.stringify(balances, null, 2));
      
      return newBalance;
    } else {
      // Update existing balance
      balances[balanceIndex].pendingBalance += amount;
      balances[balanceIndex].lifetimeEarnings += amount;
      balances[balanceIndex].lastUpdated = new Date().toISOString();
      
      // Save balances
      fs.writeFileSync(READER_BALANCES_FILE_PATH, JSON.stringify(balances, null, 2));
      
      return balances[balanceIndex];
    }
  },
  
  /**
   * Get all payouts for a reader
   * 
   * @param readerId The ID of the reader
   * @returns Array of payout records
   */
  getReaderPayouts: (readerId: number): PayoutRecord[] => {
    ensureDataFilesExist();
    
    // Load payouts
    const payouts = JSON.parse(fs.readFileSync(READER_PAYOUTS_FILE_PATH, 'utf-8')) as PayoutRecord[];
    
    // Filter by reader ID
    return payouts.filter(p => p.readerId === readerId);
  },
  
  /**
   * Process payouts for all eligible readers
   * 
   * @returns Array of processed payout records
   */
  processEligiblePayouts: async (): Promise<PayoutRecord[]> => {
    ensureDataFilesExist();
    
    // Load reader balances
    const balances = JSON.parse(fs.readFileSync(READER_BALANCES_FILE_PATH, 'utf-8')) as ReaderBalance[];
    
    // Load payouts
    const payouts = JSON.parse(fs.readFileSync(READER_PAYOUTS_FILE_PATH, 'utf-8')) as PayoutRecord[];
    
    // Find eligible readers (balance >= $15)
    const eligibleReaders = balances.filter(b => b.pendingBalance >= MIN_PAYOUT_BALANCE);
    
    const processedPayouts: PayoutRecord[] = [];
    
    // Process each eligible reader
    for (const reader of eligibleReaders) {
      try {
        // Create payout record
        const payoutRecord: PayoutRecord = {
          id: uuidv4(),
          readerId: reader.readerId,
          amount: reader.pendingBalance,
          status: 'pending',
          timestamp: new Date().toISOString(),
          notes: `Automatic payout for reader ${reader.readerId}`,
          stripePayoutId: null
        };
        
        // In a real implementation, you would process the payout via Stripe Connect
        // For demonstration purposes, we'll just log it
        console.log(`[PAYOUT] Processing payout of $${(reader.pendingBalance / 100).toFixed(2)} for reader ${reader.readerId} (${reader.readerName})`);
        
        if (reader.stripeAccountId) {
          // If we have a Stripe account ID, we would process the payout through Stripe
          // This is just a placeholder for the actual implementation
          // const payout = await stripeClient.transfers.create({
          //   amount: reader.pendingBalance,
          //   currency: 'usd',
          //   destination: reader.stripeAccountId,
          //   description: `Payout for reader ${reader.readerId}`
          // });
          
          // payoutRecord.stripePayoutId = payout.id;
          payoutRecord.status = 'completed';
          
          // Update reader balance
          const readerIndex = balances.findIndex(b => b.readerId === reader.readerId);
          balances[readerIndex].pendingBalance = 0;
          balances[readerIndex].lastPayoutDate = new Date().toISOString();
          balances[readerIndex].lastUpdated = new Date().toISOString();
        } else {
          // Without a Stripe account, we'd need to handle this differently
          payoutRecord.status = 'pending';
          payoutRecord.notes += ' (No Stripe account connected)';
        }
        
        // Add to payout records
        payouts.push(payoutRecord);
        processedPayouts.push(payoutRecord);
      } catch (error) {
        console.error(`Error processing payout for reader ${reader.readerId}:`, error);
        
        // Create failed payout record
        const failedPayoutRecord: PayoutRecord = {
          id: uuidv4(),
          readerId: reader.readerId,
          amount: reader.pendingBalance,
          status: 'failed',
          timestamp: new Date().toISOString(),
          notes: `Failed payout: ${error instanceof Error ? error.message : 'Unknown error'}`,
          stripePayoutId: null
        };
        
        payouts.push(failedPayoutRecord);
        processedPayouts.push(failedPayoutRecord);
      }
    }
    
    // Save updated balances
    fs.writeFileSync(READER_BALANCES_FILE_PATH, JSON.stringify(balances, null, 2));
    
    // Save updated payouts
    fs.writeFileSync(READER_PAYOUTS_FILE_PATH, JSON.stringify(payouts, null, 2));
    
    return processedPayouts;
  },
  
  /**
   * Schedule daily payouts (to be called by a CRON job)
   */
  scheduleDailyPayouts: async (): Promise<void> => {
    try {
      console.log('[PAYOUT] Running scheduled daily payouts');
      const payouts = await readerBalanceService.processEligiblePayouts();
      console.log(`[PAYOUT] Processed ${payouts.length} payouts`);
    } catch (error) {
      console.error('[PAYOUT] Error processing scheduled payouts:', error);
    }
  }
};
