// Note: The server is set up to serve static files and handle the root route.
// It uses helmet for security headers and listens on port 3000.
// The server is configured to serve files from the "client" and "public" directories,

import express from 'express';
import path from 'path';
import helmet from 'helmet';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { autoOpenBrowser, removeBrowserLock } from '../../auto-open-browser/src/index.mjs';

// ES module equivalents for __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express(); // Create an instance of the Express application

// Configure helmet to include blob: in img-src directive
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'", "http://localhost:*"],
            "img-src": ["'self'", "data:", "blob:", "http://localhost:*"],
            "connect-src": ["'self'", "http://localhost:*"],
            "script-src": ["'self'", "http://localhost:*"],
            "style-src": ["'self'", "http://localhost:*", "'unsafe-inline'"]
        }
    }
}));

app.disable('x-powered-by');
const port = process.env.PORT || 3000;

// Campaign directory (where images are)
// Can be set via CAMPAIGN_DIR environment variable, or defaults to a common location
const CAMPAIGN_DIR = process.env.CAMPAIGN_DIR || path.join(__dirname, '../../../workspace-campaign-automation/campaign-automation-outputs');

// Store the actual server port (will be set when server starts)
let actualServerPort = port;

// Serve static files from the "client" and "public" directories
app.use(express.static(path.join(__dirname, '../client'), { dotfiles: 'allow' }));
app.use(express.static(path.join(__dirname, '../public'), { dotfiles: 'allow' }));

// Serve campaign outputs directory
app.use('/outputs', express.static(path.join(CAMPAIGN_DIR, 'outputs'), { dotfiles: 'allow' }));

// Serve campaign_squares.html with dynamic port replacement
app.get('/content/campaign_squares.html', (req, res) => {
    const filePath = path.join(__dirname, '../client/content/campaign_squares.html');
    
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading campaign_squares.html:', err);
            return res.status(404).send('Not Found: campaign_squares.html could not be served.');
        }
        
        // Get the port from the request host or use the actual server port
        const host = req.get('host') || `localhost:${actualServerPort}`;
        const currentPort = host.includes(':') ? host.split(':')[1] : actualServerPort;
        
        // Replace all instances of localhost:3000 with the current port
        const updatedContent = data.replace(/http:\/\/localhost:3000/g, `http://localhost:${currentPort}`);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(updatedContent);
    });
});

// Debug route to check content.html access
app.get('/content/content.html', (req, res) => {
    const filePath = path.join(__dirname, '../client/content/content.html');
    console.log('Request received for /content/content.html');
    console.log('Attempting to serve content.html from:', filePath);
    console.log('Current working directory:', process.cwd());
    console.log('Server directory:', __dirname);
    console.log('Request URL:', req.url);
    console.log('Request headers:', req.headers);
    res.sendFile(filePath, (err) => {
        if (err) {
            console.error('Error serving content.html:');
            console.error('Error details:', err);
            res.status(404).send('Not Found: content.html could not be served. Check server logs for details.');
        } else {
            console.log('Successfully served content.html');
        }
    });
});

// Serve the main HTML file
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Health check endpoint for browser to detect server status
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'ok', 
        port: actualServerPort,
        timestamp: Date.now()
    });
});

// Ignore Chrome DevTools and other browser-specific requests
app.get('/.well-known/*', (req, res) => {
    res.status(404).send('Not Found');
});

// // Serve the undefined request
app.get('*', (req, res) => {
    // Don't log Chrome DevTools requests
    if (!req.originalUrl.includes('.well-known') && !req.originalUrl.includes('favicon.ico')) {
        console.log("404 - Not Found:", req.originalUrl);
    }
    res.status(404).send('Not Found');
});

// Browser opening logic has been moved to auto-open-browser package

// Module-level variables for current process
let serverStarted = false; // Track if server has successfully started
let serverInstance = null; // Track the server instance for graceful shutdown

// start the server
const server = app.listen(port, () => {
    // Only open browser on the FIRST successful server start
    if (serverStarted) {
        console.log(`Server restarted on port ${port}, but browser already opened in this process. Skipping.`);
        return; // Server already started, don't open browser again
    }
    serverStarted = true;
    
    actualServerPort = port; // Store the actual port the server is listening on
    const url = `http://localhost:${port}`;
    console.log(`Server is running at ${url}`);
    console.log(`Serving campaign images from: ${path.join(CAMPAIGN_DIR, 'outputs')}`);
    
    // Automatically open browser using auto-open-browser package
    autoOpenBrowser(url, {
        appName: 'dual-layer-slider',
        verbose: true
    }).catch(error => {
        console.error('[Browser] Failed to open browser:', error.message);
    });
    
    // Store server instance for graceful shutdown
    serverInstance = server;
    
    // Remove browser lock on server stop (cleanup)
    server.on('close', () => {
        removeBrowserLock({ appName: 'dual-layer-slider', verbose: true });
        console.log('Server stopped - browser lock removed and port released');
        serverInstance = null; // Clear server instance reference
    });
});

// Handle server errors (e.g., port already in use)
server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use. Please stop the process using this port or use a different port.`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
});

// Handle process termination signals to gracefully shut down server and clean up
process.on('SIGTERM', () => {
    console.log('SIGTERM received - shutting down server gracefully...');
    gracefulShutdown();
});

process.on('SIGINT', () => {
    console.log('SIGINT received - shutting down server gracefully...');
    gracefulShutdown();
});

// Handle process exit to clean up lock
process.on('exit', () => {
    removeBrowserLock({ appName: 'dual-layer-slider' });
    console.log('Process exiting - cleanup complete');
});

// Graceful shutdown function
function gracefulShutdown() {
    removeBrowserLock({ appName: 'dual-layer-slider' });
    
    if (serverInstance) {
        console.log('Closing server to release port...');
        serverInstance.close(() => {
            console.log('Server closed successfully - port released');
            process.exit(0);
        });
        
        // Force close after 10 seconds if graceful shutdown doesn't complete
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10000);
    } else {
        console.log('No server instance to close');
        process.exit(0);
    }
}

export default app; // Export the app for testing purposes
