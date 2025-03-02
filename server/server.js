// Note: The server is set up to serve static files and handle the root route.
// It uses helmet for security headers and listens on port 3000.
// The server is configured to serve files from the "client" and "public" directories,

const express = require('express');
const path = require('path');
const helmet = require('helmet');

const app = express(); // Create an instance of the Express application

// Configure helmet to include blob: in img-src directive
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            "default-src": ["'self'"],
            "img-src": ["'self'", "data:", "blob:"]
        }
    }
}));

app.disable('x-powered-by');
const port = 3000;

// Serve static files from the "client" and "public" directories
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../public')));

// Serve the main HTML file
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

// // Serve the undefined request
app.get('*', (req, res) => {
    console.log("404 - Not Found:", req.originalUrl);
    res.status(404).send('Not Found');
});

// start the server
app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});

module.exports = app; // Export the app for testing purposes
