// Note: The server is set up to serve static files and handle the root route.
// It uses helmet for security headers and listens on port 3000.
// The server is configured to serve files from the "client" and "public" directories,

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { exec } = require('child_process');

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
    const fs = require('fs');
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

// Function to open browser (cross-platform)
function openBrowser(url) {
    const platform = process.platform;
    let command;
    
    if (platform === 'darwin') {
        // macOS
        command = `open "${url}"`;
    } else if (platform === 'win32') {
        // Windows
        command = `start "" "${url}"`;
    } else {
        // Linux and others
        command = `xdg-open "${url}"`;
    }
    
    exec(command, (error) => {
        if (error) {
            console.log(`Could not automatically open browser. Please navigate to ${url}`);
        } else {
            console.log(`Opened browser to ${url}`);
        }
    });
}

// Track if browser has been opened to prevent multiple opens
// Use environment variable to persist across server restarts (nodemon, etc.)
let browserOpened = process.env.BROWSER_OPENED === 'true';
let browserOpenTimeout = null;

// start the server
function tryPort(currentPort, maxPort = 3010) {
    const server = app.listen(currentPort, () => {
        actualServerPort = currentPort; // Store the actual port the server is listening on
        const url = `http://localhost:${currentPort}`;
        console.log(`Server is running at ${url}`);
        console.log(`Serving campaign images from: ${path.join(CAMPAIGN_DIR, 'outputs')}`);
        
        // Automatically open browser only once (with debouncing to prevent rapid opens during restarts)
        if (!browserOpened) {
            // Clear any pending browser open
            if (browserOpenTimeout) {
                clearTimeout(browserOpenTimeout);
            }
            
            // Debounce browser opening - wait 2 seconds before opening
            // This prevents multiple opens during rapid server restarts (e.g., nodemon)
            browserOpenTimeout = setTimeout(() => {
                if (!browserOpened) {
                    openBrowser(url);
                    browserOpened = true;
                    process.env.BROWSER_OPENED = 'true';
                }
            }, 2000); // Wait 2 seconds before opening
        }
    }).on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            if (currentPort < maxPort) {
                console.log(`Port ${currentPort} is in use, trying port ${currentPort + 1}...`);
                tryPort(currentPort + 1, maxPort);
            } else {
                console.error(`No available ports found up to ${maxPort}.`);
            }
        } else {
            console.error('Server error:', err);
        }
    });
}

tryPort(port);

module.exports = app; // Export the app for testing purposes
