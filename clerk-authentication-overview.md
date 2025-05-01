# Clerk Authentication Implementation

## Overview

The application has been configured to use Clerk for authentication and user management. Clerk provides a complete authentication and user management solution that handles sign-up, sign-in, session management, and user profiles.

## Implementation Details

### Client-Side Integration

1. **ClerkProvider**: The application uses `ClerkProvider` in `client/src/main.tsx` to wrap the entire application, making authentication services available throughout:

```tsx
<ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignOutUrl="/">
  <App />
</ClerkProvider>
```

2. **User Authentication Components**: The following Clerk components are used in the application:

```tsx
import { SignedIn, SignedOut, SignInButton, UserButton } from '@clerk/clerk-react'
```

- `SignedIn`: Content within this component only displays when a user is signed in
- `SignedOut`: Content within this component only displays when a user is signed out
- `SignInButton`: Button that redirects to the sign-in page
- `UserButton`: Profile button for the authenticated user

3. **Protected Routes**: Routes that require authentication use the `ClerkProtectedRoute` component in `client/src/lib/clerk-protected-route.tsx`, which handles:
   - Loading states
   - Redirecting unauthenticated users to the auth page
   - Allowing authenticated users to access protected content

### Server-Side Integration

1. **Authentication Verification**: The server uses Clerk's backend API to verify users through the session token:

```ts
// server/clerk-auth.ts
import { clerkClient } from '@clerk/backend';

export const requireAuth = async (req, res, next) => {
  try {
    // Get the session token from the Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Unauthorized - No valid token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // Verify the token
    try {
      const session = await clerkClient.sessions.verifyToken({ token });
      
      if (!session) {
        return res.status(401).json({ message: 'Unauthorized - Invalid token' });
      }
      
      // Add the user data to the request
      (req as any).auth = { userId: session.userId };
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Unauthorized - Token verification failed' });
    }
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
```

2. **Route Protection**: The server uses Clerk to protect API routes requiring authentication:

```ts
import { requireAuth } from './clerk-auth';

// Protected routes
app.get('/api/user-data', requireAuth, (req, res) => {
  // Only authenticated users can access this endpoint
});
```

## User Roles and Permissions

The application supports three user roles, stored in the user's public metadata:

1. **Admin** (`role: "admin"`): Full access to the application
2. **Reader** (`role: "reader"`): Can provide psychic readings to clients
3. **Client** (`role: "client"`): Can book readings with readers

Access control based on roles is handled in the application code by checking the user's role from their metadata.

## Environment Configuration

The application uses the following environment variables for Clerk:

```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_cmVsYXRlZC1hcmFjaG5pZC00OC5jbGVyay5hY2NvdW50cy5kZXYk
CLERK_SECRET_KEY=sk_test_K62Kt1rn96jF7LynnyrnEtSoZJ6GcBVHtFTU2Sffy4
```

## User Authentication Flow

1. User navigates to the application
2. If not authenticated, they see the sign-in button
3. User signs in through Clerk's authentication UI
4. Upon successful authentication, Clerk issues a session token
5. The token is stored in the browser and sent with API requests
6. Protected routes and API endpoints verify the token before granting access
7. User role information is used to determine specific permissions within the application

This implementation provides a secure, feature-rich authentication system with minimal custom code required. 