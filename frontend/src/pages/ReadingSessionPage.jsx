import React, {useState, useEffect, useRef} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import {useAuth} from '../contexts/AuthContext';
import {useSocket} from '../contexts/SocketContext';
import '../styles/ReadingSession.css';

function ReadingSessionPage() {
    const {user} = useAuth();
    const socket = useSocket();
    const location = useLocation();
    const navigate = useNavigate();
    const {reader, sessionType} = location.state || {};

    const [sessionActive, setSessionActive] = useState(false);
    const [startTime, setStartTime] = useState(null);
    const [duration, setDuration] = useState(0);
    const [cost, setCost] = useState(0);
    const [stream, setStream] = useState(null);
    const [peerStream, setPeerStream] = useState(null);
    const [chatMessages, setChatMessages] = useState([]);
    const [messageInput, setMessageInput] = useState('');
    const [error, setError] = useState('');

    const videoRef = useRef(null);
    const peerVideoRef = useRef(null);
    const peerConnection = useRef(null);

    useEffect(() => {
        if (!reader || !sessionType) {
            navigate('/readers');
            return;
        }

      if (user.role !== 'client') {
          setError('Only clients can initiate reading sessions.');
          navigate('/dashboard');
          return;
      }

      // Initialize WebRTC connection
      initializeWebRTC();

      // Emit session request to reader via WebSocket
      socket.emit('requestSession', {
          readerId: reader.id,
          clientId: user.id,
          sessionType,
      });

      // Listen for session acceptance
      socket.on('sessionAccepted', (data) => {
          setSessionActive(true);
          setStartTime(new Date());
          startMediaStream();
      });

      socket.on('sessionRejected', (data) => {
          setError('Session request was rejected by the reader.');
          navigate('/readers');
      });

      socket.on('sessionEnded', (data) => {
          endSession();
      });

      socket.on('chatMessage', (message) => {
          setChatMessages((prev) => [...prev, message]);
      });

      socket.on('webrtcOffer', async (offer) => {
          if (peerConnection.current) {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
              const answer = await peerConnection.current.createAnswer();
              await peerConnection.current.setLocalDescription(answer);
              socket.emit('webrtcAnswer', answer);
          }
      });

      socket.on('webrtcAnswer', async (answer) => {
          if (peerConnection.current) {
              await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
          }
      });

      socket.on('webrtcIceCandidate', async (candidate) => {
          if (peerConnection.current) {
              await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
      });

      return () => {
          cleanup();
          socket.off('sessionAccepted');
          socket.off('sessionRejected');
          socket.off('sessionEnded');
          socket.off('chatMessage');
          socket.off('webrtcOffer');
          socket.off('webrtcAnswer');
          socket.off('webrtcIceCandidate');
      };
  }, [reader, sessionType, user, socket, navigate]);

    useEffect(() => {
        let interval;
        if (sessionActive) {
            interval = setInterval(() => {
                setDuration((prev) => {
                    const newDuration = prev + 1;
                    setCost(calculateCost(newDuration, reader.rate));
                    return newDuration;
        });
      }, 1000);
    }
      return () => clearInterval(interval);
  }, [sessionActive, reader]);

    useEffect(() => {
        if (user && user.balance < cost) {
            endSession();
            setError('Session ended due to insufficient balance.');
        }
    }, [cost, user]);

    const initializeWebRTC = () => {
        peerConnection.current = new RTCPeerConnection({
            iceServers: [{urls: 'stun:stun.l.google.com:19302'}],
        });

      peerConnection.current.onicecandidate = (event) => {
          if (event.candidate) {
              socket.emit('webrtcIceCandidate', event.candidate);
          }
    };

      peerConnection.current.ontrack = (event) => {
          setPeerStream(event.streams[0]);
          if (peerVideoRef.current) {
              peerVideoRef.current.srcObject = event.streams[0];
          }
    };
  };

    const startMediaStream = async () => {
        try {
            if (sessionType === 'video' || sessionType === 'phone') {
                const constraints = {
                    video: sessionType === 'video',
                    audio: true,
                };
                const userStream = await navigator.mediaDevices.getUserMedia(constraints);
                setStream(userStream);
                if (videoRef.current) {
                    videoRef.current.srcObject = userStream;
        }
          userStream.getTracks().forEach((track) => {
              peerConnection.current.addTrack(track, userStream);
        });

          const offer = await peerConnection.current.createOffer();
          await peerConnection.current.setLocalDescription(offer);
          socket.emit('webrtcOffer', offer);
      }
    } catch (err) {
        console.error('Error accessing media devices:', err);
        setError('Failed to start media stream. Please check your camera and microphone permissions.');
    }
  };

    const calculateCost = (durationSeconds, ratePerMinute) => {
        const minutes = Math.ceil(durationSeconds / 60);
        return minutes * ratePerMinute;
    };

    const endSession = () => {
        setSessionActive(false);
        setDuration(0);
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            setStream(null);
        }
        if (peerConnection.current) {
            peerConnection.current.close();
            peerConnection.current = null;
        }
        socket.emit('endSession', {
            readerId: reader.id,
            clientId: user.id,
            duration,
            cost,
        });
        navigate('/dashboard');
    };

    const cleanup = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
        }
        if (peerConnection.current) {
            peerConnection.current.close();
        }
    };

    const sendMessage = () => {
        if (messageInput.trim()) {
            const message = {
                sender: user.id,
                content: messageInput,
                timestamp: new Date().toISOString(),
            };
            setChatMessages((prev) => [...prev, message]);
            socket.emit('chatMessage', {
                sessionId: `${user.id}-${reader.id}`,
                message,
            });
            setMessageInput('');
        }
    };

    const handleEndSession = () => {
        endSession();
    };

    return (
        <div className="reading-session-container">
            <h2 className="session-title">Reading Session with {reader?.name}</h2>
            <p className="session-type">Type: {sessionType}</p>
            {error && <div className="error-message">{error}</div>}

            {!sessionActive ? (
                <div className="waiting-container">
                    <p>Waiting for {reader?.name} to accept the session...</p>
                </div>
            ) : (
                <>
                    <div className="session-info">
                        <p>Duration: {Math.floor(duration / 60)}:{(duration % 60).toString().padStart(2, '0')}</p>
                        <p>Cost: ${cost.toFixed(2)}</p>
                        <p>Balance: ${user?.balance?.toFixed(2) || '0.00'}</p>
                    </div>

                    {(sessionType === 'video' || sessionType === 'phone') && (
                        <div className="video-container">
                            <div className="video-wrapper">
                                <video ref={videoRef} autoPlay muted playsInline className="local-video"/>
                                <p className="video-label">You</p>
                            </div>
                            <div className="video-wrapper">
                                <video ref={peerVideoRef} autoPlay playsInline className="remote-video"/>
                                <p className="video-label">{reader?.name}</p>
                            </div>
                        </div>
                    )}

                    {sessionType === 'chat' && (
                        <div className="chat-container">
                            <div className="chat-messages">
                                {chatMessages.map((msg, index) => (
                                    <div key={index}
                                         className={`message ${msg.sender === user.id ? 'sent' : 'received'}`}>
                                        <p>{msg.content}</p>
                                        <span
                                            className="timestamp">{new Date(msg.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="chat-input">
                <textarea
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    placeholder="Type your message here..."
                    rows={3}
                />
                  <button onClick={sendMessage}>Send</button>
              </div>
            </div>
          )}

            <button onClick={handleEndSession} className="end-session-button">
                End Session
            </button>
        </>
      )}
    </div>
  );
}

export default ReadingSessionPage;