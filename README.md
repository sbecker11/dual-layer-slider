# Dual-Layer Slider

A dual-layer scrolling interface with a campaign image review tool, featuring parallax scrolling effects and custom momentum-based scrolling.

## Overview

This application combines a visually appealing dual-layer scrolling interface with a practical campaign image review tool. The interface features two scrolling layers that move at different speeds, creating a parallax effect, while the foreground content provides an interactive image curation interface.

## Features

### Dual-Layer Scrolling Interface

- **Background Layer**: Alternating background images (sequoia sunrise and milky way) that scroll at a slower rate, creating a parallax effect
- **Foreground Layer**: Content that scrolls faster than the background, providing the main interactive interface
- **Infinite Scrolling**: Background images wrap around seamlessly to create an infinite scrolling effect
- **Custom Momentum Scrolling**: Smooth, momentum-based scrolling with velocity damping and animation frame optimization

### Campaign Image Review Tool

The main content is a campaign image review interface that allows users to:

- **View Campaign Images**: Display campaign images in a responsive grid layout (1x1 square images)
- **Mark for Deletion**: Click delete buttons to mark images for deletion
- **Track Progress**: View real-time counts of deleted items and remaining items in a status bar
- **Export Results**: Export marked items as JSON with metadata including:
  - Image path
  - Timestamp
  - Product name
  - Campaign name
- **State Persistence**: Automatically saves and restores review state using localStorage

## Technical Features

- **Custom Scrolling Implementation**: Momentum-based scrolling with velocity tracking and damping
- **Parallax Effect**: Background scrolls at 0.1x speed while content scrolls at 2.0x speed
- **Infinite Scrolling Background**: Background images wrap around top and bottom edges seamlessly
- **HTML Sanitization**: Uses DOMPurify to sanitize loaded HTML content for security
- **Express Server**: Node.js/Express server serving static files with security headers (Helmet)
- **Responsive Design**: Grid layout adapts to different screen sizes
- **Performance Optimizations**: 
  - Animation pauses when window loses focus
  - Uses requestAnimationFrame for smooth updates
  - Efficient DOM manipulation for background image wrapping

## Project Structure

```
dual-layer-slider/
├── client/
│   ├── backgrounds/          # Background images for parallax effect
│   ├── content/              # HTML content files
│   ├── main.mjs              # Main client-side entry point
│   └── scrolling-content-div.mjs  # Core scrolling component
├── public/
│   ├── css/                  # Stylesheets
│   ├── index.html            # Main HTML file
│   └── favicon.ico
├── server/
│   └── server.js             # Express server
└── package.json
```

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

Or for development with auto-reload:
```bash
npm run dev
```

The server will start on port 3000 (or the next available port if 3000 is in use).

## Usage

1. Open your browser and navigate to `http://localhost:3000`
2. The dual-layer scrolling interface will load with background images and campaign content
3. Scroll through the campaign images using your mouse wheel or trackpad
4. Click the "🗑️ Delete" button on any image card to mark it for deletion
5. View the counts in the status bar at the top
6. Click "💾 Export Results" to download a JSON file with all marked items

## Dependencies

- **express**: Web server framework
- **helmet**: Security headers middleware
- **dompurify**: HTML sanitization library

## Development Dependencies

- **nodemon**: Auto-reload server during development

## Browser Compatibility

This application uses modern JavaScript features including:
- ES6 modules
- Fetch API
- requestAnimationFrame
- CSS transforms

Works best in modern browsers that support these features.

