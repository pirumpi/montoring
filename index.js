const WebSocket = require('ws');

const PORT = process.env.PORT || 8080; // Use environment variable or fallback to 8080

const wss = new WebSocket.Server({ port: PORT });

console.log(`WebSocket server started on port ${PORT}`);

wss.on('connection', ws => {
    console.log('Client connected');
    
    // Set up server-side ping interval (every 30 seconds)
    const pingInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.ping(); // Send WebSocket ping frame
        }
    }, 30000);

    // Set up pong timeout handler
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', message => {
        const messageStr = message.toString();
        
        // Handle ping/pong messages
        if (messageStr === 'ping') {
            ws.send('pong');
            return;
        }
        
        if (messageStr === 'pong') {
            // Client responded to our ping
            return;
        }
        
        // Echo other messages back to the client
        ws.send(messageStr);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clearInterval(pingInterval);
    });

    ws.on('error', error => {
        console.error('WebSocket error:', error.message);
        clearInterval(pingInterval);
    });
});

wss.on('error', error => {
    console.error('Server error:', error.message);
});

console.log('WebSocket server is listening...');