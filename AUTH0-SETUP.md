# Auth0 Setup for SoulSeer

## Prerequisites
- An Auth0 account (you can sign up for free at [auth0.com](https://auth0.com))
- Your SoulSeer application running locally or deployed

## Setup Steps

### 1. Create an Auth0 Application

1. Log in to your Auth0 Dashboard
2. Navigate to "Applications" > "Applications"
3. Click the "Create Application" button
4. Name your application (e.g., "SoulSeer")
5. Select "Regular Web Applications" as the application type
6. Click "Create"

### 2. Configure Application Settings

1. In your new application settings, scroll to "Application URIs"
2. Configure the following URLs:
   - **Allowed Callback URLs**: 
     - For local development: `http://localhost:5173/auth/callback`
     - For production: `https://your-domain.com/auth/callback`
   - **Allowed Logout URLs**: 
     - For local development: `http://localhost:5173`
     - For production: `https://your-domain.com`
   - **Allowed Web Origins**: 
     - For local development: `http://localhost:5173`
     - For production: `https://your-domain.com`

3. Scroll down and click "Save Changes"

### 3. Get Your Application Credentials

Take note of the following credentials from your Auth0 application settings:
- **Domain** (e.g., `your-tenant.auth0.com`)
- **Client ID**
- **Client Secret**

### 4. Configure Environment Variables

1. Open the `.env` file in your project root
2. Update the Auth0 variables with your credentials:

```
# Auth0 Configuration
AUTH0_DOMAIN=your-auth0-domain.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_CALLBACK_URL=http://localhost:5173/auth/callback  # Update for production

# Client-side Auth0 variables
VITE_AUTH0_DOMAIN=your-auth0-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-auth0-client-id
```

### 5. Restart Your Application

- Restart your development server to load the new environment variables

## Testing

1. Start your application
2. Navigate to the login page
3. Click the "Continue with Auth0" button
4. You should be redirected to the Auth0 login page
5. After login, you should be redirected back to your application 
6. You should now be logged in to your SoulSeer application

## Troubleshooting

- **Login not working**: Check that your Auth0 credentials are correct and that your callback URLs are properly configured
- **Redirect issues**: Ensure your callback URL matches exactly what's configured in Auth0
- **CORS errors**: Make sure your application's domain is listed in the "Allowed Web Origins" setting

## Additional Resources

- [Auth0 React SDK Documentation](https://auth0.com/docs/quickstart/spa/react)
- [Auth0 Regular Web App Documentation](https://auth0.com/docs/quickstart/webapp) 