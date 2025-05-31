import React, { useRef, useEffect, useState } from 'react';

const VideoCall = ({ webrtcService, sessionType, onStartCall, onEndCall }) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [callStarted, setCallStarted] = useState(false);

  useEffect(() => {
    if (webrtcService) {
      webrtcService.onLocalStreamReceived = (stream) => {
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setCallStarted(true);
      };

      webrtcService.onRemoteStreamReceived = (stream) => {
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }
      };

      webrtcService.onCallEnded = () => {
        setCallStarted(false);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = null;
        }
      };
    }
  }, [webrtcService]);

  const toggleVideo = () => {
    if (webrtcService) {
      const enabled = webrtcService.toggleVideo();
      setIsVideoEnabled(enabled);
    }
  };

  const toggleAudio = () => {
    if (webrtcService) {
      const enabled = webrtcService.toggleAudio();
      setIsAudioEnabled(enabled);
    }
  };

  const handleStartCall = () => {
    onStartCall();
  };

  const handleEndCall = () => {
    onEndCall();
    setCallStarted(false);
  };

  return (
    <div className="video-call">
      <div className="video-container">
        {sessionType !== 'chat' && (
          <>
            <div className="remote-video">
              <video
                ref={remoteVideoRef}
                autoPlay
                playsInline
                className="remote-video-element"
              />
              <div className="video-label">Reader</div>
            </div>
            
            <div className="local-video">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="local-video-element"
              />
              <div className="video-label">You</div>
            </div>
          </>
        )}
        
        {sessionType === 'chat' && (
          <div className="chat-only-indicator">
            <div className="chat-icon">💬</div>
            <h3>Text Chat Session</h3>
            <p>This is a text-only reading session</p>
          </div>
        )}
      </div>

      <div className="call-controls">
        {!callStarted ? (
          <button 
            className="start-call-btn"
            onClick={handleStartCall}
          >
            Start {sessionType === 'video' ? 'Video' : sessionType === 'audio' ? 'Audio' : 'Chat'} Session
          </button>
        ) : (
          <div className="active-controls">
            {sessionType !== 'chat' && (
              <>
                <button 
                  className={`control-btn ${isAudioEnabled ? 'active' : 'disabled'}`}
                  onClick={toggleAudio}
                  title={isAudioEnabled ? 'Mute Audio' : 'Unmute Audio'}
                >
                  🎤
                </button>
                
                {sessionType === 'video' && (
                  <button 
                    className={`control-btn ${isVideoEnabled ? 'active' : 'disabled'}`}
                    onClick={toggleVideo}
                    title={isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
                  >
                    📹
                  </button>
                )}
              </>
            )}
            
            <button 
              className="end-call-btn"
              onClick={handleEndCall}
            >
              End Call
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoCall;