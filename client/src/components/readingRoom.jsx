import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import WebRTCService from '../services/webrtcService';
import VideoCall from './VideoCall';
import ChatWindow from './ChatWindow';
import BillingDisplay from './BillingDisplay';

const ReadingRoom = () => {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  
  const [sessionData, setSessionData] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [sessionType, setSessionType] = useState('video');
  const [billingInfo, setBillingInfo] = useState({
    totalCost: 0,
    timeElapsed: 0,
    ratePerMinute: 0
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  
  const webrtcService = useRef(null);
  const billingTimer = useRef(null);

  useEffect(() => {
    initializeSession();
    
    return () => {
      cleanup();
    };
  }, [sessionId]);

  const initializeSession = async () => {
    try {
      const mockSession = {
        success: true,
        data: {
          id: sessionId,
          sessionType: 'video',
          rate: 5.99,
          userId: 'user-123',
          userType: 'client',
          readerId: 'reader-456'
        }
      };

      setSessionData(mockSession.data);
      setSessionType(mockSession.data.sessionType || 'video');
      setBillingInfo(prev => ({
        ...prev,
        ratePerMinute: mockSession.data.rate || 0
      }));

      webrtcService.current = new WebRTCService();
      setupWebRTCEventHandlers();

      await webrtcService.current.connectToWebRTCService(
        sessionId,
        mockSession.data.userId,
        mockSession.data.userType
      );

    } catch (error) {
      console.error('Error initializing session:', error);
      setConnectionStatus('error');
    }
  };

  const setupWebRTCEventHandlers = () => {
    const service = webrtcService.current;

    service.onSessionJoined = (data) => {
      console.log('Session joined successfully:', data);
      setConnectionStatus('connected');
      setIsSessionActive(true);
      startBillingTimer();
    };

    service.onSessionEnded = (data) => {
      console.log('Session ended:', data);
      setIsSessionActive(false);
      stopBillingTimer();
      
      setTimeout(() => {
        navigate('/');
      }, 3000);
    };

    service.onBillingUpdate = (data) => {
      setBillingInfo(prev => ({
        ...prev,
        totalCost: data.totalCost,
        timeElapsed: data.timeElapsed
      }));
    };

    service.onInsufficientFunds = (data) => {
      alert('Insufficient funds! Please add credits to continue the session.');
      endSession();
    };

    service.onConnectionStateChange = (state) => {
      console.log('Connection state changed:', state);
      if (state === 'failed' || state === 'disconnected') {
        setConnectionStatus('disconnected');
      }
    };

    service.onDisconnected = () => {
      setConnectionStatus('disconnected');
      setIsSessionActive(false);
      stopBillingTimer();
    };
  };

  const startCall = async () => {
    try {
      await webrtcService.current.startCall(sessionType);
    } catch (error) {
      console.error('Error starting call:', error);
      alert('Could not start call. Please check your camera/microphone permissions.');
    }
  };

  const endSession = () => {
    if (webrtcService.current) {
      webrtcService.current.endCall();
    }
    stopBillingTimer();
    setIsSessionActive(false);
  };

  const startBillingTimer = () => {
    billingTimer.current = setInterval(() => {
      setBillingInfo(prev => {
        const newTimeElapsed = prev.timeElapsed + 1;
        const newTotalCost = (newTimeElapsed / 60) * prev.ratePerMinute;
        
        return {
          ...prev,
          timeElapsed: newTimeElapsed,
          totalCost: parseFloat(newTotalCost.toFixed(2))
        };
      });
    }, 1000);
  };

  const stopBillingTimer = () => {
    if (billingTimer.current) {
      clearInterval(billingTimer.current);
      billingTimer.current = null;
    }
  };

  const cleanup = () => {
    stopBillingTimer();
    if (webrtcService.current) {
      webrtcService.current.disconnect();
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (connectionStatus === 'error') {
    return (
      <div className="reading-room error">
        <h2>Session Error</h2>
        <p>Unable to connect to the reading session. Please try again.</p>
        <button onClick={() => navigate('/')}>Return to Home</button>
      </div>
    );
  }

  if (connectionStatus === 'connecting') {
    return (
      <div className="reading-room connecting">
        <div className="loading-spinner"></div>
        <h2>Connecting to your reading session...</h2>
        <p>Please wait while we establish the connection.</p>
      </div>
    );
  }

  return (
    <div className="reading-room">
      <div className="session-header">
        <h2>Reading Session</h2>
        <div className="session-info">
          <span className="session-type">{sessionType.toUpperCase()}</span>
          <span className="session-status">{isSessionActive ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      <div className="session-content">
        <div className="video-section">
          <VideoCall 
            webrtcService={webrtcService.current}
            sessionType={sessionType}
            onStartCall={startCall}
            onEndCall={endSession}
          />
        </div>

        <div className="sidebar">
          <BillingDisplay 
            totalCost={billingInfo.totalCost}
            timeElapsed={formatTime(billingInfo.timeElapsed)}
            ratePerMinute={billingInfo.ratePerMinute}
          />
          
          <ChatWindow 
            sessionId={sessionId}
            webrtcService={webrtcService.current}
          />
        </div>
      </div>

      <div className="session-controls">
        <button 
          className="btn-primary"
          onClick={startCall}
          disabled={!isSessionActive}
        >
          Start Call
        </button>
        
        <button 
          className="btn-danger"
          onClick={endSession}
        >
          End Session
        </button>
      </div>
    </div>
  );
};

export default ReadingRoom;
