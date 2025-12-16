# Dual-Layer Slider

A reusable package for creating parallax scrolling interfaces with background and foreground layers. This project includes two standalone, reusable packages:

1. **`dual-layer-slider`** - The core parallax scrolling component
2. **`auto-open-browser`** - A utility for automatically opening browsers in development mode

## Packages

### 1. Dual-Layer Slider Package

**Location**: `src/` directory

A reusable JavaScript package for creating smooth, continuous parallax scrolling interfaces with dual layers (background and foreground content).

#### Features

- 🎨 **Parallax Scrolling**: Background images scroll slower than foreground content
- 🔄 **Continuous Looping**: Seamless infinite scroll with content wrapping
- 🖱️ **Mouse Control**: Velocity-based scrolling controlled by mouse position
- 🎯 **Drag to Scroll**: Direct manipulation - drag to move content
- ⚡ **Smooth Animations**: Optimized `requestAnimationFrame` animations
- 🔒 **XSS Protection**: HTML sanitization with DOMPurify
- 📦 **Zero Dependencies**: Self-contained (includes DOMPurify)

#### Installation

```bash
# If published to npm:
npm install dual-layer-slider

# Or use directly from source:
import { initDualLayerSlider } from './src/index.mjs';
```

#### Quick Start

```javascript
import { initDualLayerSlider } from 'dual-layer-slider';

// Initialize the slider
await initDualLayerSlider({
    containerId: 'my-container',
    htmlContent: '<div>Your HTML content here</div>',
    backgroundImageUrls: [
        'https://example.com/bg1.jpg',
        'https://example.com/bg2.jpg'
    ]
});
```

#### API

##### `initDualLayerSlider(config)`

Initialize a dual-layer slider with the provided configuration.

**Parameters:**
- `config` (object, required):
  - `containerId` (string, required): ID of the container element
  - `htmlContent` (string) OR `htmlContentUrl` (string, required): HTML content to display
  - `backgroundImageUrls` (array, required): Array of background image URLs
  - `contentItemHeight` (number, default: `300`): Height of each content item in pixels
  - `backgroundScrollFactor` (number, default: `0.5`): Background scroll speed multiplier (0-1)
  - `maxVelocity` (number, default: `400`): Maximum scroll velocity in px/s
  - `velocityAccelerationRate` (number, default: `50`): Mouse acceleration rate
  - `velocityDampingRate` (number, default: `0.95`): Velocity damping per frame
  - `maxDeltaPerFrame` (number, default: `40`): Maximum pixels moved per frame
  - `eagerLoadImages` (boolean, default: `true`): Preload images immediately
  - `verbose` (boolean, default: `false`): Enable verbose logging

**Returns:** Promise that resolves to the `ScrollingContentDiv` instance

#### Usage Examples

See the `examples/` directory for complete examples:
- `examples/basic.html` - Basic usage example
- `examples/test.html` - Test file with placeholder images

#### Exports

```javascript
import {
    initDualLayerSlider,      // Main initialization function
    createScrollingContentDiv, // Lower-level API
    ScrollingContentDiv        // Core class
} from 'dual-layer-slider';
```

---

### 2. Auto-Open Browser Package

**Location**: `../auto-open-browser/` directory

A reusable Node.js package for automatically opening browsers in development mode with single-window enforcement and lock management.

#### Features

- 🚀 **Auto-opens browser** when server starts in dev mode
- 🔒 **Single-window enforcement** using Chrome app mode
- 🛡️ **Lock file management** prevents multiple browser windows
- 🎯 **Smart dev mode detection** (nodemon, npm scripts, env vars)
- 🌍 **Cross-platform** support (macOS, Windows, Linux)
- ⚙️ **Configurable** debounce, lock expiry, and behavior

#### Installation

```bash
# If published to npm:
npm install auto-open-browser

# Or use directly from source:
import { autoOpenBrowser } from '../auto-open-browser/src/index.mjs';
```

#### Quick Start

```javascript
import { autoOpenBrowser } from 'auto-open-browser';

// Auto-open browser when server starts
server.listen(3000, async () => {
    console.log('Server running at http://localhost:3000');
    await autoOpenBrowser('http://localhost:3000', {
        appName: 'my-app'
    });
});
```

#### API

##### `autoOpenBrowser(url, config)`

Automatically open browser with smart detection and lock management.

**Parameters:**
- `url` (string, required): URL to open
- `config` (object, optional):
  - `appName` (string, default: `'app'`): App name for lock file
  - `debounceMs` (number, default: `2000`): Delay before opening
  - `lockExpiryMs` (number, default: `5000`): Lock file expiry time
  - `enableDevModeDetection` (boolean, default: `true`): Auto-detect dev mode
  - `enableLockFile` (boolean, default: `true`): Use file-based lock
  - `verbose` (boolean, default: `false`): Enable verbose logging
  - `force` (boolean, default: `false`): Force open even if lock exists

**Returns:** Promise<void>

#### Environment Variables

- `DISABLE_AUTO_BROWSER`: Set to `'true'` or `'1'` to disable auto-opening
- `OPEN_BROWSER`: Set to `'true'` or `'1'` to force enable
- `NODE_ENV`: Set to `'production'` to disable in production
- `NODEMON`: Automatically set by nodemon (enables dev mode detection)

For complete documentation, see `../auto-open-browser/README.md`.

---

## Project Structure

```
dual-layer-slider/
├── src/                    # Reusable dual-layer-slider package
│   ├── index.mjs          # Main API
│   ├── ScrollingContentDiv.mjs  # Core scrolling component
│   └── purify.es.mjs      # DOMPurify (included)
├── examples/              # Usage examples
│   ├── basic.html
│   └── test.html
├── client/                # Application-specific client code
├── server/                # Application-specific server code
│   └── server.js         # Express server (uses auto-open-browser)
├── public/                # Static files
└── package.json

../auto-open-browser/      # Separate reusable package
├── src/
│   └── index.mjs         # Browser opening logic
├── package.json
└── README.md
```

## Development

### Running the Application

```bash
npm run dev    # Start server with nodemon (auto-opens browser)
npm start      # Start server without auto-reload
```

### Package Development

Both packages are designed to be reusable and can be:
1. Used directly from source (as in this project)
2. Published to npm for use in other projects
3. Copied into other projects as needed

## License

MIT
