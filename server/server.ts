import Stripe from 'stripe';
const stripe = new Stripe('pk_test_51JY2J5KBeGJ0fV26zs9QmZ4qpZi8cnbvSrZEid3xA5oJjiJloBMCX3U3kvuuxymHXVs19XrRa7PrvLRL6SDORbSs00pest5uhr', {
  apiVersion: '2025-04-30.basil'
});

const app = express();

app.post('/create-checkout-session', async (req, res) => {

