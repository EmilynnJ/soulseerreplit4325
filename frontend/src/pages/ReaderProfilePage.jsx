// c:\Users\emily\soulseerreplit4325-1\frontend\src\pages\ReaderProfilePage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getReaderProfile } from '../services/readerService'; // Fetches from backend
import { startSession as apiStartSession } from '../services/sessionService'; // Frontend service to call backend
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext'; // For real-time communication
import placeholderImage from '../assets/images/placeholder.png';

const ReaderProfilePage = () => {
  const { readerId } = useParams();
  const [reader, setReader] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sessionError, setSessionError] = useState(null);
  const { currentUser } = useAuth();
  const { sendMessage, socket, isConnected } = useSocket(); // Assuming connectSocket is called elsewhere or automatically

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const data = await getReaderProfile(readerId);
        setReader(data);
      } catch (err) {
        setError(err.message || 'Failed to load reader profile.');
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [readerId]);

  const handleStartSession = async (sessionType) => {
    if (!currentUser) {
      setSessionError("Please login to start a session.");
      return;
    }
    if (!reader) return;

    setSessionError(null);
    setLoading(true); // Or a specific session loading state
    try {
      // This calls the backend HTTP endpoint to initiate and log the session
      const sessionDetails = await apiStartSession(reader.user_id, sessionType); // reader.user_id from backend
      console.log("Session initiated via API:", sessionDetails);
      alert(`Session ${sessionType} with ${reader.name} requested! Waiting for reader to accept. Session ID: ${sessionDetails.sessionId}`);
      // Frontend now needs to handle the "waiting for reader acceptance" state,
      // which will likely be updated via WebSocket messages.
      // For now, we just show an alert.
    } catch (err) {
      console.error("Failed to start session:", err);
      setSessionError(err.message || `Failed to start ${sessionType} session.`);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !reader) return <p>Loading reader profile...</p>;
  if (error) return <p style={{ color: 'red' }}>Error: {error}</p>;
  if (!reader) return <p>Reader not found.</p>;

  return (
    <div style={{ padding: '20px', color: 'var(--color-text-light)' }}>
      <img src={reader.profile_image_url || placeholderImage} alt={reader.name} style={{ width: '150px', height: '150px', borderRadius: '50%', objectFit: 'cover' }} />
      <h1 style={{ color: 'var(--color-primary-pink)' }}>{reader.name}</h1>
      <p>Email: {reader.email}</p>
      <p>Specialties: {reader.specialties?.join(', ') || 'N/A'}</p>
      <p>Bio: {reader.bio || 'No bio available.'}</p>
      <p style={{ color: reader.is_online ? 'lightgreen' : 'lightcoral' }}>{reader.is_online ? 'Online' : 'Offline'}</p>
      {reader.rate_per_minute > 0 && <p style={{ color: 'var(--color-text-gold)' }}>Rate: ${parseFloat(reader.rate_per_minute).toFixed(2)}/min</p>}
      
      {sessionError && <p style={{ color: 'red' }}>{sessionError}</p>}

      {currentUser && currentUser.role === 'client' && reader.is_online && reader.rate_per_minute > 0 && (
        <div style={{ marginTop: '20px' }}>
          <h3 style={{ color: 'var(--color-primary-deep-pink)' }}>Start a Session:</h3>
          <button onClick={() => handleStartSession('chat')} disabled={loading} style={{marginRight: '10px'}}>Start Chat</button>
          {/* <button onClick={() => handleStartSession('video')} disabled={loading} style={{marginRight: '10px'}}>Start Video Call</button>
          <button onClick={() => handleStartSession('phone')} disabled={loading}>Start Phone Call</button> */}
          <p style={{fontSize: '0.8em', marginTop: '5px'}}>First minute will be charged upon reader acceptance.</p>
        </div>
      )}
      {!reader.is_online && <p>This reader is currently offline.</p>}
      <Link to="/readers" style={{ display: 'block', marginTop: '20px', color: 'var(--color-accent-gold)' }}>Back to Readers</Link>
    </div>
  );
};

export default ReaderProfilePage;