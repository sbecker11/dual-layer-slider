const express = require('express');
const path = require('path');
const helmet = require('helmet');

const app = express(); // Create an instance of the Express application

app.use(helmet());
app.disable('x-powered-by');
const port = 3000;

// Serve static files from the "client" and "public" directories
app.use(express.static(path.join(__dirname, '../client')));
app.use(express.static(path.join(__dirname, '../public')));

// Serve the main HTML file
app.get('/', (_, res) => {
    res.sendFile(path.join(__dirname, '../public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});