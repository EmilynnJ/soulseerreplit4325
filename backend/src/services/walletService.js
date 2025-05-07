// c:\Users\emily\soulseerreplit4325-1\backend\src\services\walletService.js
const pool = require('../config/database');

/**
 * Creates a wallet for a new user.
 * Typically called during user registration/sync.
 */
exports.createWalletForUser = async (userId) => {
    try {
        const existingWallet = await pool.query('SELECT id FROM wallets WHERE user_id = $1', [userId]);
        if (existingWallet.rows.length > 0) {
            console.log(`Wallet already exists for user ${userId}`);
            return existingWallet.rows[0];
        }
        const newWallet = await pool.query(
            'INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING *',
            [userId, 0.00]
        );
        console.log(`Wallet created for user ${userId}:`, newWallet.rows[0]);
        return newWallet.rows[0];
    } catch (error) {
        console.error(`Error creating wallet for user ${userId}:`, error);
        throw error;
    }
};

exports.getWalletByUserId = async (userId) => {
    try {
        const result = await pool.query('SELECT * FROM wallets WHERE user_id = $1', [userId]);
        if (result.rows.length === 0) {
            // If no wallet, create one. This ensures users always have a wallet.
            return await this.createWalletForUser(userId);
        }
        return result.rows[0];
    } catch (error) {
        console.error(`Error fetching wallet for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Gets the current balance for a user.
 */
exports.getBalance = async (userId) => {
    try {
        const wallet = await this.getWalletByUserId(userId);
        return parseFloat(wallet.balance);
    } catch (error) {
        console.error(`Error fetching balance for user ${userId}:`, error);
        throw error;
    }
};

/**
 * Adds credits to a user's wallet and logs the transaction.
 * This should be called within a database transaction to ensure atomicity.
 */
exports.addCreditsToWallet = async (userId, amount, transactionDetails) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const walletResult = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        if (walletResult.rows.length === 0) {
            throw new Error(`Wallet not found for user ${userId}. Cannot add credits.`);
        }
        const wallet = walletResult.rows[0];
        const newBalance = parseFloat(wallet.balance) + parseFloat(amount);

        await client.query('UPDATE wallets SET balance = $1 WHERE id = $2', [newBalance, wallet.id]);

        const { type = 'credit_purchase', description, stripe_charge_id, status = 'completed' } = transactionDetails;
        await client.query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, description, stripe_charge_id, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [userId, wallet.id, type, amount, description, stripe_charge_id, status]
        );

        await client.query('COMMIT');
        return { success: true, newBalance };
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error adding credits to wallet for user ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Adds balance to a user's wallet (used for reader earnings).
 */
exports.addBalance = async (userId, amount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const walletResult = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        if (walletResult.rows.length === 0) {
            throw new Error(`Wallet not found for user ${userId}. Cannot add balance.`);
        }
        const wallet = walletResult.rows[0];
        const newBalance = parseFloat(wallet.balance) + parseFloat(amount);

        await client.query('UPDATE wallets SET balance = $1 WHERE id = $2', [newBalance, wallet.id]);

        await client.query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, description, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [userId, wallet.id, 'reader_earnings', amount, 'Earnings from reading session', 'completed']
        );

        await client.query('COMMIT');
        return {success: true, newBalance};
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error adding balance to wallet for user ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

/**
 * Deducts balance from a user's wallet (used for session costs).
 */
exports.deductBalance = async (userId, amount) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const walletResult = await client.query('SELECT id, balance FROM wallets WHERE user_id = $1 FOR UPDATE', [userId]);
        if (walletResult.rows.length === 0) {
            throw new Error(`Wallet not found for user ${userId}. Cannot deduct balance.`);
        }
        const wallet = walletResult.rows[0];
        const newBalance = parseFloat(wallet.balance) - parseFloat(amount);

        if (newBalance < 0) {
            throw new Error(`Insufficient balance for user ${userId}. Cannot deduct ${amount}.`);
        }

        await client.query('UPDATE wallets SET balance = $1 WHERE id = $2', [newBalance, wallet.id]);

        await client.query(
            `INSERT INTO transactions (user_id, wallet_id, type, amount, description, status)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
            [userId, wallet.id, 'session_fee', -amount, 'Cost for reading session', 'completed']
        );

        await client.query('COMMIT');
        return {success: true, newBalance};
    } catch (error) {
        await client.query('ROLLBACK');
        console.error(`Error deducting balance from wallet for user ${userId}:`, error);
        throw error;
    } finally {
        client.release();
    }
};

exports.getWalletTransactionsByUserId = async (userId, limit = 20, offset = 0) => {
    try {
        const wallet = await this.getWalletByUserId(userId); // Ensures wallet exists
        if (!wallet) {
             // Should not happen if getWalletByUserId creates one
            throw new Error(`Wallet not found for user ${userId}`);
        }

        const result = await pool.query(
            'SELECT * FROM transactions WHERE user_id = $1 AND wallet_id = $2 ORDER BY created_at DESC LIMIT $3 OFFSET $4',
            [userId, wallet.id, limit, offset]
        );
        return result.rows;
    } catch (error) {
        console.error(`Error fetching transactions for user ${userId}:`, error);
        throw error;
    }
};

// DeductCredits function will be similar to addCredits, but with a negative amount for 'session_fee' etc.
// It will be crucial for the pay-per-minute system. 
