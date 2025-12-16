// Note: The server is set up to serve static files and handle the root route.
// It uses helmet for security headers and listens on port 3000.
// The server is configured to serve files from the "client" and "public" directories,

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');

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
// Use a file-based lock that persists across process restarts (nodemon)
const browserLockFile = path.join(os.tmpdir(), 'dual-layer-slider-browser-opened.lock');

function checkBrowserLock() {
    try {
        if (!fs.existsSync(browserLockFile)) {
            return false;
        }
        
        // Read the lock file to check timestamp
        const lockContent = fs.readFileSync(browserLockFile, 'utf8');
        const lockTime = parseInt(lockContent, 10);
        
        // Lock expires after 30 seconds
        // This allows browser to reopen after closing all windows and restarting server
        const lockExpiryTime = 30 * 1000; // 30 seconds
        const now = Date.now();
        
        if (isNaN(lockTime) || (now - lockTime) > lockExpiryTime) {
            // Lock expired or invalid, remove it
            try {
                fs.unlinkSync(browserLockFile);
            } catch (error) {
                // Ignore errors removing expired lock
            }
            return false;
        }
        
        return true; // Lock is still valid
    } catch (error) {
        return false;
    }
}

function setBrowserLock() {
    try {
        fs.writeFileSync(browserLockFile, Date.now().toString(), 'utf8');
    } catch (error) {
        // Ignore errors - file lock is best effort
    }
}

// Module-level variables for current process
let browserOpened = false;
let browserOpenTimeout = null;
let serverStarted = false; // Track if server has successfully started
let browserOpenAttempted = false; // Track if we've attempted to open browser

// start the server
function tryPort(currentPort, maxPort = 3010) {
    const server = app.listen(currentPort, () => {
        // Only open browser on the FIRST successful server start
        // This prevents multiple opens when trying different ports
        if (serverStarted) {
            return; // Server already started, don't open browser again
        }
        serverStarted = true;
        
        actualServerPort = currentPort; // Store the actual port the server is listening on
        const url = `http://localhost:${currentPort}`;
        console.log(`Server is running at ${url}`);
        console.log(`Serving campaign images from: ${path.join(CAMPAIGN_DIR, 'outputs')}`);
        
        // Automatically open browser only once per server process
        // Clear any pending browser open attempts first
        if (browserOpenTimeout) {
            clearTimeout(browserOpenTimeout);
            browserOpenTimeout = null;
        }
        
        // Check if browser opening is disabled via environment variable
        const disableAutoOpen = process.env.DISABLE_AUTO_BROWSER === 'true' || process.env.DISABLE_AUTO_BROWSER === '1';
        
        if (disableAutoOpen) {
            console.log('Automatic browser opening is disabled (DISABLE_AUTO_BROWSER=true)');
            return;
        }
        
        // Only attempt to open browser if:
        // 1. We haven't opened it in this process
        // 2. We haven't attempted to open it in this process
        // 3. The file-based lock doesn't exist (browser hasn't been opened in any recent process)
        if (!browserOpened && !browserOpenAttempted && !checkBrowserLock()) {
            browserOpenAttempted = true; // Mark that we're attempting to open
            setBrowserLock(); // Set lock immediately to prevent other processes from opening
            
            // Debounce browser opening - wait 5 seconds before opening
            // This prevents multiple opens during rapid server restarts (e.g., nodemon)
            browserOpenTimeout = setTimeout(() => {
                // Double-check: process flag and file lock still exists (we set it)
                if (!browserOpened && checkBrowserLock()) {
                    openBrowser(url);
                    browserOpened = true;
                    console.log('Browser opened. Future server restarts will not open additional windows.');
                }
                browserOpenTimeout = null;
            }, 5000); // Wait 5 seconds before opening
        } else if (checkBrowserLock()) {
            // Lock exists but checkBrowserLock should have removed expired locks
            // If we get here, the lock is still valid (less than 30 seconds old)
            try {
                const lockContent = fs.readFileSync(browserLockFile, 'utf8');
                const lockTime = parseInt(lockContent, 10);
                if (!isNaN(lockTime)) {
                    const ageSeconds = Math.floor((Date.now() - lockTime) / 1000);
                    const remainingSeconds = Math.max(0, 30 - ageSeconds);
                    console.log(`Browser lock active (age: ${ageSeconds}s, expires in ${remainingSeconds}s). Skipping automatic browser open.`);
                    console.log(`To force browser open, delete: ${browserLockFile}`);
                } else {
                    console.log('Browser lock file exists but is invalid. Skipping automatic browser open.');
                }
            } catch (error) {
                console.log('Browser lock check failed. Skipping automatic browser open.');
            }
        } else if (browserOpenAttempted) {
            console.log('Browser open already attempted in this process. Skipping.');
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
