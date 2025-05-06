require('dotenv').config({ path: '../../../.env' });
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = stripe;

console.log('Stripe Secret Key:', process.env.STRIPE_SECRET_KEY ? 'Loaded' : 'Not Loaded');
console.log('Stripe Webhook Secret:', process.env.STRIPE_WEBHOOK_SIGNING_SECRET ? 'Loaded' : 'Not Loaded');