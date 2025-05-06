const http = require('http');
const WebSocket = require('ws');
const app = require('./app');
const { handleWebSocketConnection } = require('./websockets/websocketManager'); // Central manager

const PORT = process.env.PORT || 3001;

const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
    console.log('New WebSocket client connected');
    handleWebSocketConnection(ws, req); // Delegate to the manager

    ws.on('close', () => {
        console.log('WebSocket client disconnected');
    });
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`WebSocket server is running on port ${PORT}`);
});
