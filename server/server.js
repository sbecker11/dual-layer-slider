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

// Function to open browser (cross-platform) with single window enforcement
// Uses Chrome/Chromium app mode with dedicated profile to ensure only one window
function openBrowser(url) {
    const platform = process.platform;
    let command;
    const appName = 'dual-layer-slider';
    const userDataDir = path.join(os.tmpdir(), 'dual-layer-slider-browser');
    
    if (platform === 'darwin') {
        // macOS: Try Chrome/Chromium with app mode first (ensures single window)
        // Fallback to Safari/other browsers if Chrome not available
        const chromePaths = [
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
            '/Applications/Chromium.app/Contents/MacOS/Chromium',
            '/usr/bin/google-chrome',
            '/usr/bin/chromium'
        ];
        
        // Try to find Chrome/Chromium
        let chromePath = null;
        for (const chrome of chromePaths) {
            if (fs.existsSync(chrome)) {
                chromePath = chrome;
                break;
            }
        }
        
        if (chromePath) {
            // Use Chrome with app mode and dedicated user data directory
            // This ensures only one window is opened (same profile = same window)
            command = `"${chromePath}" --app="${url}" --user-data-dir="${userDataDir}" --new-window`;
        } else {
            // Fallback: Try to focus existing Safari window or open new one
            // Use AppleScript to check if Safari has a window open to this URL
            const host = new URL(url).host;
            command = `osascript -e 'tell application "Safari" to if (count of windows) > 0 then set URL of current tab of front window to "${url}" else make new document with properties {URL:"${url}"} end if' -e 'tell application "Safari" to activate' 2>/dev/null || open "${url}"`;
        }
    } else if (platform === 'win32') {
        // Windows: Try Chrome with app mode
        command = `start "" "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --app="${url}" --user-data-dir="${userDataDir.replace(/\//g, '\\\\')}" --new-window 2>nul || start "" "${url}"`;
    } else {
        // Linux: Try Chrome/Chromium with app mode
        command = `google-chrome --app="${url}" --user-data-dir="${userDataDir}" --new-window 2>/dev/null || chromium --app="${url}" --user-data-dir="${userDataDir}" --new-window 2>/dev/null || xdg-open "${url}"`;
    }
    
    console.log(`[Browser] Executing command: ${command.substring(0, 100)}...`);
    exec(command, (error, stdout, stderr) => {
        if (error) {
            console.error(`[Browser] Error opening with app mode:`, error.message);
            if (stderr) console.error(`[Browser] stderr:`, stderr);
            console.log(`[Browser] Trying fallback method...`);
            // Fallback to simple open
            const fallbackCommand = platform === 'darwin' ? `open "${url}"` : 
                                   platform === 'win32' ? `start "" "${url}"` : 
                                   `xdg-open "${url}"`;
            console.log(`[Browser] Executing fallback: ${fallbackCommand}`);
            exec(fallbackCommand, (fallbackError, fallbackStdout, fallbackStderr) => {
                if (fallbackError) {
                    console.error(`[Browser] Fallback also failed:`, fallbackError.message);
                    if (fallbackStderr) console.error(`[Browser] Fallback stderr:`, fallbackStderr);
                    console.log(`[Browser] Could not automatically open browser. Please navigate to ${url}`);
                } else {
                    console.log(`[Browser] Opened browser to ${url} (fallback method)`);
                    if (fallbackStdout) console.log(`[Browser] Fallback stdout:`, fallbackStdout);
                }
            });
        } else {
            console.log(`[Browser] Opened browser to ${url} (app mode - single window enforced)`);
            if (stdout) console.log(`[Browser] stdout:`, stdout);
            if (stderr) console.log(`[Browser] stderr:`, stderr);
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
        
        // Lock expires after 5 seconds
        // This allows browser to reopen after closing all windows and restarting server
        // Short expiry prevents stale locks from blocking browser opens
        const lockExpiryTime = 5 * 1000; // 5 seconds (very short to prevent multiple opens)
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

function removeBrowserLock() {
    try {
        if (fs.existsSync(browserLockFile)) {
            fs.unlinkSync(browserLockFile);
            console.log('Browser lock removed');
        }
    } catch (error) {
        // Ignore errors removing lock
    }
}

// Module-level variables for current process
let browserOpened = false;
let browserOpenTimeout = null;
let serverStarted = false; // Track if server has successfully started
let browserOpenAttempted = false; // Track if we've attempted to open browser
let serverInstance = null; // Track the server instance for graceful shutdown

// start the server
function tryPort(currentPort, maxPort = 3010) {
    const server = app.listen(currentPort, () => {
        // Only open browser on the FIRST successful server start
        // This prevents multiple opens when trying different ports
        if (serverStarted) {
            console.log(`Server restarted on port ${currentPort}, but browser already opened in this process. Skipping.`);
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
        
        // Only open browser when running in dev mode (npm run dev)
        // Check multiple ways to detect dev mode - be more permissive
        // 1. NODEMON environment variable (set by nodemon)
        // 2. npm_lifecycle_event === 'dev' (set by npm when running npm run dev)
        // 3. Explicit OPEN_BROWSER env var for manual override
        // 4. Check if nodemon is in process args or parent process
        // 5. Check if NODE_ENV is not 'production'
        const nodemonEnv = process.env.NODEMON !== undefined;
        const npmDevEvent = process.env.npm_lifecycle_event === 'dev';
        const openBrowserEnv = process.env.OPEN_BROWSER === 'true' || process.env.OPEN_BROWSER === '1';
        const nodemonInArgs = process.argv.some(arg => arg.includes('nodemon'));
        const notProduction = process.env.NODE_ENV !== 'production';
        
        console.log('[Browser] Dev mode check:', {
            NODEMON: nodemonEnv,
            npm_lifecycle_event: process.env.npm_lifecycle_event,
            OPEN_BROWSER: process.env.OPEN_BROWSER,
            NODE_ENV: process.env.NODE_ENV,
            nodemonInArgs: nodemonInArgs,
            processArgs: process.argv.slice(0, 5).join(' ')
        });
        
        // Be more permissive - if not explicitly production, allow browser opening
        // This ensures it works even if nodemon detection fails
        const isDevMode = nodemonEnv || npmDevEvent || openBrowserEnv || nodemonInArgs || notProduction;
        
        if (!isDevMode) {
            console.log('[Browser] Automatic browser opening is disabled (only opens in dev mode: npm run dev)');
            console.log('[Browser] To enable: npm run dev (uses nodemon) or set OPEN_BROWSER=true');
            return;
        }
        
        console.log('[Browser] Dev mode detected - browser will open automatically');
        
        // Only attempt to open browser if:
        // 1. We haven't opened it in this process
        // 2. We haven't attempted to open it in this process
        // 3. The file-based lock doesn't exist (browser hasn't been opened in any recent process)
        const lockCheck = checkBrowserLock();
        console.log('[Browser] Pre-open check:', {
            browserOpened: browserOpened,
            browserOpenAttempted: browserOpenAttempted,
            lockExists: lockCheck,
            willAttempt: !browserOpened && !browserOpenAttempted && !lockCheck
        });
        
        if (!browserOpened && !browserOpenAttempted && !lockCheck) {
            browserOpenAttempted = true; // Mark that we're attempting to open
            setBrowserLock(); // Set lock immediately to prevent other processes from opening
            console.log('[Browser] Lock set, will open browser in 2 seconds');
            
            // Debounce browser opening - wait 2 seconds before opening
            // This prevents multiple opens during rapid server restarts (e.g., nodemon)
            browserOpenTimeout = setTimeout(() => {
                console.log('[Browser] Timeout fired, attempting to open browser...');
                // Final checks before opening:
                // 1. Process hasn't opened browser yet
                // 2. We marked attempt flag
                // 3. Lock file still exists (we set it)
                // 4. Lock file is still valid (not expired)
                if (!browserOpened && browserOpenAttempted) {
                    // Re-check lock one more time right before opening
                    if (checkBrowserLock()) {
                        // Double-check: make sure we still have the lock (prevent race conditions)
                        setBrowserLock(); // Refresh lock timestamp
                        console.log(`[Browser] Calling openBrowser(${url})...`);
                        openBrowser(url);
                        browserOpened = true;
                        console.log('[Browser] Opened successfully. Future server restarts will not open additional windows.');
                    } else {
                        console.log('[Browser] Open cancelled - lock file expired or removed');
                        browserOpenAttempted = false; // Reset attempt flag if lock expired
                    }
                } else {
                    if (browserOpened) {
                        console.log('[Browser] Open cancelled - already opened in this process');
                    } else {
                        console.log('[Browser] Open cancelled - attempt flag not set');
                    }
                }
                browserOpenTimeout = null;
            }, 2000); // Wait 2 seconds before opening (reduced for faster startup)
        } else if (checkBrowserLock()) {
            // Lock exists but checkBrowserLock should have removed expired locks
            // If we get here, the lock is still valid (less than 30 seconds old)
            try {
                const lockContent = fs.readFileSync(browserLockFile, 'utf8');
                const lockTime = parseInt(lockContent, 10);
                if (!isNaN(lockTime)) {
                    const ageSeconds = Math.floor((Date.now() - lockTime) / 1000);
                    const remainingSeconds = Math.max(0, 5 - ageSeconds);
                    console.log(`[Browser] Lock active (age: ${ageSeconds}s, expires in ${remainingSeconds}s). Skipping automatic browser open.`);
                    
                    // If lock is expired, remove it
                    if (ageSeconds >= 5) {
                        try {
                            fs.unlinkSync(browserLockFile);
                            console.log('Browser lock expired and removed. Browser will open on next server start.');
                        } catch (error) {
                            // Ignore errors removing expired lock
                        }
                    }
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
        });
        
        // Store server instance for graceful shutdown
        serverInstance = server;
        
        // Remove browser lock on server stop (cleanup)
        server.on('close', () => {
            removeBrowserLock();
            console.log('Server stopped - browser lock removed and port released');
            serverInstance = null; // Clear server instance reference
        });
        
        server.on('error', (err) => {
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
    removeBrowserLock();
    console.log('Process exiting - cleanup complete');
});

// Graceful shutdown function
function gracefulShutdown() {
    removeBrowserLock();
    
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

module.exports = app; // Export the app for testing purposes
