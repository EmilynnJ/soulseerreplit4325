class WebRTCService {
  constructor() {
    this.socket = null;
    this.localStream = null;
    this.remoteStream = null;
    this.peerConnection = null;
    this.isConnected = false;
    this.webrtcServiceUrl = process.env.REACT_APP_WEBRTC_URL || 'https://soulseer-webrtc.onrender.com';
    
    this.setupPeerConnection();
  }

  setupPeerConnection() {
    const configuration = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    this.peerConnection = new RTCPeerConnection(configuration);
    
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.socket) {
        this.socket.emit('ice-candidate', event.candidate);
      }
    };

    this.peerConnection.ontrack = (event) => {
      this.remoteStream = event.streams[0];
      this.onRemoteStreamReceived?.(this.remoteStream);
    };

    this.peerConnection.onconnectionstatechange = () => {
      console.log('Connection state:', this.peerConnection.connectionState);
      this.onConnectionStateChange?.(this.peerConnection.connectionState);
    };
  }

  async connectToWebRTCService(sessionId, userId, userType) {
    try {
      const { io } = await import('socket.io-client');
      this.socket = io(this.webrtcServiceUrl, {
        transports: ['websocket', 'polling']
      });

      this.socket.on('connect', () => {
        console.log('Connected to WebRTC service');
        this.isConnected = true;
        
        this.socket.emit('join-session', {
          sessionId,
          userId,
          userType
        });
      });

      this.socket.on('session-joined', (data) => {
        console.log('Session joined:', data);
        this.onSessionJoined?.(data);
      });

      this.socket.on('offer', async (offer) => {
        await this.handleOffer(offer);
      });

      this.socket.on('answer', async (answer) => {
        await this.handleAnswer(answer);
      });

      this.socket.on('ice-candidate', async (candidate) => {
        await this.handleIceCandidate(candidate);
      });

      this.socket.on('session-ended', (data) => {
        console.log('Session ended:', data);
        this.endCall();
        this.onSessionEnded?.(data);
      });

      this.socket.on('billing-update', (data) => {
        console.log('Billing update:', data);
        this.onBillingUpdate?.(data);
      });

      this.socket.on('insufficient-funds', (data) => {
        console.log('Insufficient funds:', data);
        this.onInsufficientFunds?.(data);
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from WebRTC service');
        this.isConnected = false;
        this.onDisconnected?.();
      });

    } catch (error) {
      console.error('Error connecting to WebRTC service:', error);
      throw error;
    }
  }

  async startCall(sessionType = 'video') {
    try {
      const constraints = {
        video: sessionType === 'video',
        audio: sessionType === 'video' || sessionType === 'audio'
      };

      this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      this.localStream.getTracks().forEach(track => {
        this.peerConnection.addTrack(track, this.localStream);
      });

      this.onLocalStreamReceived?.(this.localStream);

      if (this.userType === 'client') {
        await this.createOffer();
      }

    } catch (error) {
      console.error('Error starting call:', error);
      throw error;
    }
  }

  async createOffer() {
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      
      if (this.socket) {
        this.socket.emit('offer', offer);
      }
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }

  async handleOffer(offer) {
    try {
      await this.peerConnection.setRemoteDescription(offer);
      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);
      
      if (this.socket) {
        this.socket.emit('answer', answer);
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }

  async handleAnswer(answer) {
    try {
      await this.peerConnection.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }

  async handleIceCandidate(candidate) {
    try {
      await this.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }

  toggleVideo() {
    if (this.localStream) {
      const videoTrack = this.localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        return videoTrack.enabled;
      }
    }
    return false;
  }

  toggleAudio() {
    if (this.localStream) {
      const audioTrack = this.localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        return audioTrack.enabled;
      }
    }
    return false;
  }

  endCall() {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    if (this.peerConnection) {
      this.peerConnection.close();
      this.setupPeerConnection();
    }

    if (this.socket) {
      this.socket.emit('end-session');
    }

    this.onCallEnded?.();
  }

  disconnect() {
    this.endCall();
    
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    
    this.isConnected = false;
  }

  onLocalStreamReceived = null;
  onRemoteStreamReceived = null;
  onSessionJoined = null;
  onSessionEnded = null;
  onBillingUpdate = null;
  onInsufficientFunds = null;
  onConnectionStateChange = null;
  onCallEnded = null;
  onDisconnected = null;
}

export default WebRTCService;