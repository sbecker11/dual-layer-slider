const express = require('express');
const path = require('path');
const helmet = require('helmet');

const app = express();

// Campaign directory (where images are)
const CAMPAIGN_DIR = process.env.CAMPAIGN_DIR || path.join(__dirname, '../../../workspace-campaign-automation/campaign-automation');

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

// Serve static files from slider client and public directories
app.use(express.static(path.join(__dirname, '../client'), { dotfiles: 'allow' }));
app.use(express.static(path.join(__dirname, '../public'), { dotfiles: 'allow' }));

// Serve campaign outputs directory
app.use('/outputs', express.static(path.join(CAMPAIGN_DIR, 'outputs'), { dotfiles: 'allow' }));

// Serve content.html
app.get('/content/campaign_squares.html', (req, res) => {
    const filePath = path.join(__dirname, '../client/content/campaign_squares.html');
    res.sendFile(filePath);
});

app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// Ignore Chrome DevTools and other browser-specific requests
app.get('/.well-known/*', (req, res) => {
    res.status(404).send('Not Found');
});

app.get('*', (req, res) => {
    // Don't log Chrome DevTools requests
    if (!req.originalUrl.includes('.well-known') && !req.originalUrl.includes('favicon.ico')) {
        console.log("404 - Not Found:", req.originalUrl);
    }
    res.status(404).send('Not Found');
});

function tryPort(currentPort, maxPort = 3010) {
    const server = app.listen(currentPort, () => {
        console.log(`Server is running at http://localhost:${currentPort}`);
        console.log(`Serving campaign images from: ${CAMPAIGN_DIR}`);
        
        // Update HTML content with the actual port
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, '../client/content/campaign_squares.html');
        if (fs.existsSync(htmlPath)) {
            let htmlContent = fs.readFileSync(htmlPath, 'utf8');
            htmlContent = htmlContent.replace(/PORT_PLACEHOLDER/g, currentPort);
            fs.writeFileSync(htmlPath, htmlContent);
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

module.exports = app;
