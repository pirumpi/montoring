const WebSocket = require('ws');

const PORT = process.env.PORT || 8080; // Use environment variable or fallback to 8080

const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', ws => {
    console.log('Client connected');

    ws.on('message', message => {
        // console.log(`Received: ${message}`);
        // Echo the message back to the client
        ws.send(message.toString());
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error.message);
    });
});

wss.on('error', error => {
    console.error('Server error:', error.message);
});

console.log('WebSocket server is listening...');