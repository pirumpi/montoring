const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');

// --- Configuration ---
const WS_SERVER_URL = 'ws://localhost:8080'; // Change to your server's IP/hostname if not local
const RECONNECT_INTERVAL_MS = 2 * 1000; // Try to reconnect every 2 seconds
const HEARTBEAT_INTERVAL_MS = 5 * 1000; // Send heartbeat every 5 seconds
const LOG_FILE = path.join(__dirname, 'connection_websocket_log.txt');
const MAX_LOG_LINES = 1000; // Keep log file to a reasonable size

// --- Variables ---
let ws = null;
let isConnected = false;
let lastConnectionTime = new Date();
let disconnectionCount = 0;
let reconnectAttemptCount = 0;
let heartbeatInterval = null;

console.log(`Starting WebSocket internet connection monitor.`);
console.log(`Connecting to: ${WS_SERVER_URL}`);
console.log(`Logs will be written to: ${LOG_FILE}`);

// Function to append to the log file and manage its size
function appendToLog(message) {
    const timestamp = new Date().toLocaleString();
    const logEntry = `${timestamp} - ${message}\n`;

    fs.appendFile(LOG_FILE, logEntry, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
        } else {
            // Read the file and trim if it exceeds MAX_LOG_LINES
            fs.readFile(LOG_FILE, 'utf8', (readErr, data) => {
                if (readErr) {
                    console.error('Error reading log file for trimming:', readErr);
                    return;
                }
                const lines = data.split('\n');
                if (lines.length > MAX_LOG_LINES) {
                    const newContent = lines.slice(lines.length - MAX_LOG_LINES).join('\n');
                    fs.writeFile(LOG_FILE, newContent, 'utf8', (writeErr) => {
                        if (writeErr) {
                            console.error('Error trimming log file:', writeErr);
                        }
                    });
                }
            });
        }
    });
}

function startHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
    }
    heartbeatInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('ping'); // Send a small message to keep the connection active
        }
    }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
        // Already connecting or connected, no need to re-initiate
        return;
    }

    reconnectAttemptCount++;
    console.log(`Attempting to connect to WebSocket server... (Attempt ${reconnectAttemptCount})`);
    appendToLog(`Attempting to connect to WebSocket server... (Attempt ${reconnectAttemptCount})`);

    ws = new WebSocket(WS_SERVER_URL);

    ws.onopen = () => {
        if (!isConnected) {
            const disconnectedDurationMs = new Date() - lastConnectionTime;
            const disconnectedDurationSeconds = (disconnectedDurationMs / 1000).toFixed(2);
            console.log(`✅ WebSocket connected! Was disconnected for ~${disconnectedDurationSeconds} seconds.`);
            appendToLog(`WebSocket connected! Was disconnected for ~${disconnectedDurationSeconds} seconds. Total disconnections: ${disconnectionCount}`);
            isConnected = true;
            reconnectAttemptCount = 0; // Reset reconnect attempts on successful connection
        } else {
            console.log(`✅ WebSocket connected.`);
            appendToLog(`WebSocket connected.`);
        }
        lastConnectionTime = new Date();
        startHeartbeat(); // Start heartbeats once connected
    };

    ws.onmessage = message => {
        // If the server echoes back, it confirms bidirectional communication
        // console.log(`Received heartbeat response: ${message.data}`);
    };

    ws.onclose = (event) => {
        if (isConnected) {
            disconnectionCount++;
            console.log(`❌ WebSocket disconnected! Code: ${event.code}, Reason: ${event.reason}. (Total Disconnections: ${disconnectionCount})`);
            appendToLog(`WebSocket disconnected! Code: ${event.code}, Reason: ${event.reason}. (Total Disconnections: ${disconnectionCount})`);
            isConnected = false;
        } else {
             // console.log(`WebSocket remains disconnected. Code: ${event.code}, Reason: ${event.reason}`);
        }
        lastConnectionTime = new Date(); // Mark disconnection time
        stopHeartbeat(); // Stop heartbeats if disconnected
        setTimeout(connectWebSocket, RECONNECT_INTERVAL_MS); // Try to reconnect
    };

    ws.onerror = (error) => {
        if (isConnected) {
            disconnectionCount++;
            console.error(`❌ WebSocket error, likely disconnected! Message: ${error.message}. (Total Disconnections: ${disconnectionCount})`);
            appendToLog(`WebSocket error, likely disconnected! Message: ${error.message}. (Total Disconnections: ${disconnectionCount})`);
            isConnected = false;
        } else {
            // console.error(`WebSocket error while disconnected: ${error.message}`);
        }
        lastConnectionTime = new Date(); // Mark disconnection time
        stopHeartbeat(); // Stop heartbeats if disconnected
        // No explicit reconnect here, as onclose will handle it, or we'll try again via setInterval
    };
}

// Initial connection attempt
connectWebSocket();

// Handle process exit to log final status
process.on('SIGINT', () => {
    console.log('\nMonitoring stopped. Final disconnection count:', disconnectionCount);
    appendToLog(`Monitoring stopped. Total disconnections: ${disconnectionCount}`);
    if (ws) {
        ws.close(); // Close the WebSocket gracefully
    }
    stopHeartbeat();
    process.exit();
});