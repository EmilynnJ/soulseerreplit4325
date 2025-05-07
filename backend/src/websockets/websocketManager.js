const url = require('url');

// Store connected clients by user ID
const connectedClients = new Map();

// Handle new WebSocket connection
function handleWebSocketConnection(ws, req) {
    const query = url.parse(req.url, true).query;
    const userId = query.userId;
    const role = query.role;

    if (!userId || !role) {
        ws.send(JSON.stringify({type: 'error', message: 'Missing userId or role in connection query'}));
        ws.close();
        return;
    }

    // Store client connection with user-specific identifier
    const clientKey = `${role}:${userId}`;
    connectedClients.set(clientKey, ws);
    console.log(`Client connected: ${clientKey}`);

    // Send connection confirmation
    ws.send(JSON.stringify({type: 'connection', status: 'connected', userId, role}));

    // Handle messages from client
    ws.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            handleMessage(message, ws, userId, role);
        } catch (error) {
            console.error('Error parsing WebSocket message:', error);
            ws.send(JSON.stringify({type: 'error', message: 'Invalid message format'}));
        }
    });

    // Handle disconnection
    ws.on('close', () => {
        connectedClients.delete(clientKey);
        console.log(`Client disconnected: ${clientKey}`);
    });

    ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientKey}:`, error);
        connectedClients.delete(clientKey);
    });
}

function handleMessage(message, ws, userId, role) {
    console.log(`Received message from ${role}:${userId}:`, message.type);

    switch (message.type) {
        case 'requestSession': {
            const {readerId, clientId, sessionType, sessionId} = message.data;
            const targetReader = connectedClients.get(`reader:${readerId}`);
            if (targetReader) {
                targetReader.send(JSON.stringify({
                    type: 'requestSession',
                    data: {sessionId, clientId, sessionType}
                }));
                console.log(`Session request forwarded to reader ${readerId}`);
            } else {
                ws.send(JSON.stringify({
                    type: 'error',
                    message: `Reader ${readerId} is not online`
                }));
                console.log(`Reader ${readerId} not found for session request`);
            }
            break;
        }
        case 'sessionAccepted': {
            const {sessionId, readerId, clientId} = message.data;
            const targetClient = connectedClients.get(`client:${clientId}`);
            if (targetClient) {
                targetClient.send(JSON.stringify({
                    type: 'sessionAccepted',
                    data: {sessionId, readerId}
                }));
                console.log(`Session acceptance forwarded to client ${clientId}`);
            }
            break;
        }
        case 'sessionRejected': {
            const {sessionId, readerId, clientId} = message.data;
            const targetClient = connectedClients.get(`client:${clientId}`);
            if (targetClient) {
                targetClient.send(JSON.stringify({
                    type: 'sessionRejected',
                    data: {sessionId, readerId}
                }));
                console.log(`Session rejection forwarded to client ${clientId}`);
            }
            break;
        }
        case 'endSession': {
            const {sessionId, readerId, clientId} = message.data;
            const target = role === 'reader' ? connectedClients.get(`client:${clientId}`) : connectedClients.get(`reader:${readerId}`);
            if (target) {
                target.send(JSON.stringify({
                    type: 'sessionEnded',
                    data: {sessionId}
                }));
                console.log(`Session end notification sent to ${role === 'reader' ? 'client' : 'reader'}`);
            }
            break;
        }
        case 'webrtcOffer':
        case 'webrtcAnswer':
        case 'webrtcIceCandidate': {
            const {sessionId, readerId, clientId, data} = message.data;
            const target = role === 'reader' ? connectedClients.get(`client:${clientId}`) : connectedClients.get(`reader:${readerId}`);
            if (target) {
                target.send(JSON.stringify({
                    type: message.type,
                    data
                }));
                console.log(`${message.type} forwarded to ${role === 'reader' ? 'client' : 'reader'}`);
            }
            break;
        }
        case 'chatMessage': {
            const {sessionId, readerId, clientId, message: chatMessage} = message.data;
            const target = role === 'reader' ? connectedClients.get(`client:${clientId}`) : connectedClients.get(`reader:${readerId}`);
            if (target) {
                target.send(JSON.stringify({
                    type: 'chatMessage',
                    data: chatMessage
                }));
                console.log(`Chat message forwarded to ${role === 'reader' ? 'client' : 'reader'}`);
            }
            // Optionally log chat message to DB here or via API call
            break;
        }
        default:
            ws.send(JSON.stringify({
                type: 'error',
                message: `Unknown message type: ${message.type}`
            }));
            console.log(`Unknown message type: ${message.type}`);
    }
}

module.exports = {handleWebSocketConnection};