# Render Deployment Guide

## Database Connection Issue Fix

The application is failing to connect to the Neon database with this error:
```
Error: No database connection string was provided to `neon()`. Perhaps an environment variable has not been set?
```

### Solution: Update Environment Variables in Render

1. Log in to your Render dashboard: https://dashboard.render.com/
2. Find and click on your web service "soulseerreplit4325"
3. Go to the "Environment" tab
4. Add the following environment variable:
   - Key: `DATABASE_URL`
   - Value: `postgresql://neondb_owner:npg_Pbpz9TuH5AhX@ep-lively-base-a4k2rid7-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require`
5. Click "Save Changes"
6. Go to the "Manual Deploy" tab
7. Click "Deploy latest commit" to rebuild with the new environment variable

### Why This Works

1. The application is trying to read the database connection string from the `DATABASE_URL` environment variable.
2. In your codebase, both `database.ts` and `db.ts` are looking for this environment variable.
3. Setting this variable in Render ensures the application can connect to the Neon database at runtime.

### Additional Notes

- Make sure all sensitive environment variables (database credentials, API keys, etc.) are properly set in Render's environment variables section rather than hardcoding them in files.
- If you have multiple environments (development, staging, production), ensure each has the appropriate variables set.
- For local development, continue using `.env.local` or `.env` files, but never commit these to your repository.

### Troubleshooting

If you still encounter database connection issues after updating the environment variables:

1. Verify the connection string format is correct
2. Check that your IP is allowed in Neon's connection settings
3. Ensure your Neon database is active and not paused
4. Check the Render logs for any additional error details 