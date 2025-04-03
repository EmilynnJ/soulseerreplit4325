# SoulSeer Deployment Guide

This document outlines the steps to deploy the SoulSeer application to Railway, as well as alternative deployment options.

## Railway Deployment (Preferred Method)

### Prerequisites

1. A [Railway account](https://railway.app/)
2. [Railway CLI](https://docs.railway.app/develop/cli) installed (optional but recommended)
3. A PostgreSQL database
4. Stripe API keys (for payment processing)
5. MUX API keys (for video streaming)

### Environment Variables

The following environment variables need to be set in your Railway project:

```
DATABASE_URL=your_postgres_database_url
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret
MUX_TOKEN_ID=your_mux_token_id
MUX_TOKEN_SECRET=your_mux_token_secret
MUX_WEBHOOK_SECRET=your_mux_webhook_secret
SESSION_SECRET=a_random_secret_for_session_encryption
```

### Deployment Steps

1. **Sign in to Railway**:
   ```bash
   railway login
   ```

2. **Initialize a new Railway project** (if not already done):
   ```bash
   railway init
   ```

3. **Link your local project to the Railway project**:
   ```bash
   railway link
   ```

4. **Add a PostgreSQL database to your project**:
   ```bash
   railway add
   ```
   Select PostgreSQL from the options.

5. **Set up environment variables**:
   ```bash
   railway variables set DATABASE_URL=<your-database-url> STRIPE_SECRET_KEY=<your-stripe-key> ...
   ```
   Or set them through the Railway dashboard.

6. **Deploy your application**:
   ```bash
   railway up
   ```

7. **Generate a domain**:
   ```bash
   railway domain
   ```

### Post-Deployment Configuration

1. **Set up Stripe webhooks** to point to your new domain
2. **Set up MUX webhooks** to point to your new domain
3. **Run database migrations**:
   ```bash
   railway run npm run db:push
   ```

## Vercel Deployment (Alternative)

### Prerequisites

1. A [Vercel account](https://vercel.com/)
2. [Vercel CLI](https://vercel.com/docs/cli) installed (optional)
3. A PostgreSQL database
4. Stripe and MUX API keys

### Deployment Steps

1. **Sign in to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy the application**:
   ```bash
   vercel
   ```

3. **Set environment variables** in the Vercel dashboard

4. **Connect a PostgreSQL database** in the Vercel dashboard or use an external provider

## Mobile App Preparation

### iOS App Store

1. Create an Apple Developer account ($99/year)
2. Create an App ID in the Apple Developer Portal
3. Create a distribution certificate and provisioning profile
4. Package the web app as a PWA or use a wrapper like Capacitor/Cordova
5. Submit for review in App Store Connect

### Google Play Store

1. Create a Google Play Developer account ($25 one-time fee)
2. Create a new application in the Google Play Console
3. Package the web app as a PWA or use a wrapper like Capacitor/Cordova
4. Generate a signed APK or Android App Bundle
5. Upload to the Google Play Console and submit for review

### Amazon App Store

1. Create an Amazon Developer account
2. Create a new app in the Amazon Developer Console
3. Package the web app similarly to Google Play
4. Upload and submit for review

## Troubleshooting

### Common Railway Deployment Issues

- **Database connection errors**: Ensure your DATABASE_URL is correct
- **Missing environment variables**: Check all required environment variables are set
- **Build failures**: Review build logs for specific errors
- **Runtime errors**: Check application logs via `railway logs`

### Resource Scaling

If you need to scale your application:

1. Adjust the number of replicas in the Railway dashboard
2. Upgrade your Railway plan for more resources
3. Scale your database as needed

## Monitoring and Maintenance

1. Set up monitoring with Railway's built-in tools
2. Consider integrating with external monitoring services
3. Regularly back up your database
4. Keep dependencies updated