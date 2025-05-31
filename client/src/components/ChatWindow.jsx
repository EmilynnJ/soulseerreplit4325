import React, { useState, useEffect, useRef } from 'react';

const ChatWindow = ({ sessionId, webrtcService }) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (webrtcService && webrtcService.socket) {
      const socket = webrtcService.socket;

      socket.on('chat-message', (message) => {
        setMessages(prev => [...prev, message]);
      });

      socket.on('typing-start', (data) => {
        setIsTyping(true);
      });

      socket.on('typing-stop', (data) => {
        setIsTyping(false);
      });

      return () => {
        socket.off('chat-message');
        socket.off('typing-start');
        socket.off('typing-stop');
      };
    }
  }, [webrtcService]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const sendMessage = (e) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !webrtcService?.socket) return;

    const message = {
      id: Date.now(),
      text: newMessage,
      sender: 'client',
      timestamp: new Date().toISOString(),
      sessionId
    };

    webrtcService.socket.emit('chat-message', message);
    setMessages(prev => [...prev, message]);
    setNewMessage('');
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (webrtcService?.socket) {
      if (e.target.value.length > 0) {
        webrtcService.socket.emit('typing-start');
      } else {
        webrtcService.socket.emit('typing-stop');
      }
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className="chat-window">
      <div className="chat-header">
        <h3>Session Chat</h3>
      </div>
      
      <div className="messages-container">
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`message ${message.sender === 'client' ? 'sent' : 'received'}`}
          >
            <div className="message-content">
              {message.text}
            </div>
            <div className="message-time">
              {formatTime(message.timestamp)}
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <span>Reader is typing...</span>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form onSubmit={sendMessage} className="message-input-form">
        <input
          type="text"
          value={newMessage}
          onChange={handleTyping}
          placeholder="Type your message..."
          className="message-input"
        />
        <button type="submit" className="send-button">
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatWindow;