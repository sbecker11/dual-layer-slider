# Dual-Layer Slider

A reusable JavaScript package for creating parallax scrolling interfaces with background and foreground layers. Perfect for creating immersive, infinite-scrolling experiences with smooth mouse-controlled navigation.

## Features

- 🎨 **Dual-Layer Parallax**: Background images scroll slower than foreground content
- 🖱️ **Mouse-Controlled Scrolling**: Smooth velocity-based scrolling controlled by mouse position
- 🔄 **Infinite Loop**: Seamless continuous scrolling with automatic content wrapping
- 🎯 **Drag-to-Scroll**: Click and drag to scroll content with pixel-perfect positioning
- 🛡️ **HTML Sanitization**: Built-in DOMPurify for safe HTML content rendering
- ⚡ **Performance Optimized**: Uses `requestAnimationFrame` for smooth 60fps animations

## Installation

```bash
npm install dual-layer-slider
```

## Quick Start

```javascript
import { initDualLayerSlider } from 'dual-layer-slider';

const slider = await initDualLayerSlider({
    htmlContent: '<div>Your HTML content here</div>',
    backgroundImageUrls: [
        '/images/background1.jpg',
        '/images/background2.jpg'
    ],
    containerId: 'my-container'
});
```

## API

### `initDualLayerSlider(config)`

Initialize the dual-layer slider with the provided configuration.

#### Parameters

- `config.htmlContent` (string, optional): HTML string to use as content
- `config.htmlContentUrl` (string, optional): URL to fetch HTML content from
- `config.backgroundImageUrls` (Array<string>, required): Array of background image URLs
- `config.containerId` (string, default: `'scrolling-container'`): ID of the container element
- `config.contentScrollFactor` (number, default: `2.0`): How fast content scrolls relative to input
- `config.backgroundScrollFactor` (number, default: `0.1`): How fast background scrolls (parallax effect)
- `config.maxVelocityPerSecond` (number, default: `400`): Maximum scroll velocity in pixels per second
- `config.velocityAccelerationRate` (number, default: `50`): Velocity increment rate
- `config.velocityDampingRate` (number, default: `0.9`): Damping factor for velocity
- `config.verbose` (boolean, default: `false`): Enable verbose logging
- `config.eagerImageLoading` (boolean, default: `false`): Force eager loading of images

#### Returns

Promise that resolves to a `ScrollingContentDiv` instance.

## Usage Examples

### Basic Usage with HTML String

```javascript
import { initDualLayerSlider } from 'dual-layer-slider';

const slider = await initDualLayerSlider({
    htmlContent: `
        <div class="item">Item 1</div>
        <div class="item">Item 2</div>
        <div class="item">Item 3</div>
    `,
    backgroundImageUrls: [
        '/bg1.jpg',
        '/bg2.jpg'
    ],
    containerId: 'slider-container'
});
```

### Using HTML from URL

```javascript
import { initDualLayerSlider } from 'dual-layer-slider';

const slider = await initDualLayerSlider({
    htmlContentUrl: '/api/content',
    backgroundImageUrls: [
        '/backgrounds/image1.png',
        '/backgrounds/image2.png'
    ]
});
```

### Advanced Configuration

```javascript
import { initDualLayerSlider } from 'dual-layer-slider';

const slider = await initDualLayerSlider({
    htmlContent: '<div>Content</div>',
    backgroundImageUrls: ['/bg1.jpg', '/bg2.jpg'],
    containerId: 'my-container',
    contentScrollFactor: 3.0,
    backgroundScrollFactor: 0.15,
    maxVelocityPerSecond: 600,
    velocityAccelerationRate: 75,
    velocityDampingRate: 0.85,
    verbose: true
});
```

### Direct Class Usage

For advanced usage, you can use the `ScrollingContentDiv` class directly:

```javascript
import { ScrollingContentDiv } from 'dual-layer-slider';

const slider = await ScrollingContentDiv.create(
    '/path/to/content.html',
    ['/bg1.jpg', '/bg2.jpg'],
    false // eagerImageLoading
);
```

## HTML Structure

Your HTML content will be automatically sanitized and duplicated to create a seamless infinite scroll. The container element must exist in your DOM:

```html
<div id="scrolling-container"></div>
```

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)

Requires ES6 modules support.

## License

MIT

## Contributing

Contributions welcome! Please open an issue or submit a pull request.
