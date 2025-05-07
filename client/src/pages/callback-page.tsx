import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Client, Account } from 'appwrite';
import axios from 'axios';

const CallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Initialize Appwrite
        const client = new Client();
        client
          .setEndpoint('https://nyc.cloud.appwrite.io/v1')
          .setProject('681831b30038fbc171cf');
        const account = new Account(client);

        // Get the current session
        const session = await account.getSession('current');
        
        // Get user information
        const user = await account.get();
        
        // Send user data to our backend
        await axios.post('/api/appwrite-user', {
          userId: user.$id,
          email: user.email,
          name: user.name,
          providerId: session.provider
        });
        
        // Redirect to home page or dashboard
        navigate('/');
      } catch (err) {
        console.error('Error during OAuth callback:', err);
        setError('Authentication failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Completing login...</h1>
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary mx-auto"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Authentication Error</h1>
          <p className="text-red-500">{error}</p>
          <p>Redirecting to login page...</p>
        </div>
      </div>
    );
  }

  return null;
};

export default CallbackPage; 