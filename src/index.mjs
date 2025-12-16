/**
 * Dual-Layer Slider - A reusable package for creating parallax scrolling interfaces
 * with background and foreground layers.
 * 
 * @module dual-layer-slider
 */

import { ScrollingContentDiv } from './ScrollingContentDiv.mjs';

/**
 * Default configuration options
 */
const DEFAULT_CONFIG = {
    // Content configuration
    htmlContent: null,           // HTML string or URL to fetch HTML from
    htmlContentUrl: null,         // URL to fetch HTML content (alternative to htmlContent)
    
    // Background configuration
    backgroundImageUrls: [],     // Array of background image URLs
    
    // Scrolling behavior
    contentScrollFactor: 2.0,     // How fast content scrolls relative to input
    backgroundScrollFactor: 0.1,  // How fast background scrolls (parallax effect)
    
    // Velocity control (mouse-based scrolling)
    maxVelocityPerSecond: 400,    // Maximum scroll velocity in pixels per second
    velocityAccelerationRate: 50, // Velocity increment rate
    velocityDampingRate: 0.9,     // Damping factor for velocity
    
    // Container configuration
    containerId: null,                   // ID of the container element (optional, defaults to body)
    wrapperId: 'wrapper-div',            // ID of the wrapper div (will be created)
    
    // Options
    verbose: false,               // Enable verbose logging
    eagerImageLoading: false,     // Force eager loading of images
};

/**
 * Initialize the dual-layer slider
 * 
 * @param {Object} config - Configuration object
 * @param {string|Array} config.htmlContent - HTML string or URL to HTML content
 * @param {Array<string>} config.backgroundImageUrls - Array of background image URLs
 * @param {string} [config.containerId='scrolling-container'] - ID of container element
 * @param {Object} [config.options] - Additional options
 * @returns {Promise<ScrollingContentDiv>} The initialized ScrollingContentDiv instance
 * 
 * @example
 * ```javascript
 * import { initDualLayerSlider } from 'dual-layer-slider';
 * 
 * const slider = await initDualLayerSlider({
 *   htmlContent: '<div>Your content here</div>',
 *   backgroundImageUrls: [
 *     '/images/bg1.jpg',
 *     '/images/bg2.jpg'
 *   ],
 *   containerId: 'my-container',
 *   options: {
 *     contentScrollFactor: 2.0,
 *     backgroundScrollFactor: 0.1
 *   }
 * });
 * ```
 */
export async function initDualLayerSlider(config) {
    // Merge with defaults
    const finalConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Validate required fields
    if (!finalConfig.htmlContent && !finalConfig.htmlContentUrl) {
        throw new Error('Either htmlContent or htmlContentUrl must be provided');
    }
    
    if (!finalConfig.backgroundImageUrls || finalConfig.backgroundImageUrls.length === 0) {
        throw new Error('At least one backgroundImageUrl must be provided');
    }
    
    // Determine content source
    let htmlContentUrl = finalConfig.htmlContentUrl;
    if (finalConfig.htmlContent && !htmlContentUrl) {
        // If HTML content is provided as string, create a data URL
        // Note: data URLs work, but blob URLs are better for larger content
        const blob = new Blob([finalConfig.htmlContent], { type: 'text/html' });
        htmlContentUrl = URL.createObjectURL(blob);
    }
    
    if (!htmlContentUrl) {
        throw new Error('Either htmlContent or htmlContentUrl must be provided');
    }
    
    // Create instance
    const instance = new ScrollingContentDiv(
        htmlContentUrl,
        finalConfig.backgroundImageUrls,
        finalConfig.eagerImageLoading
    );
    
    // Apply configuration
    instance.contentScrollFactor = finalConfig.contentScrollFactor;
    instance.backgroundScrollFactor = finalConfig.backgroundScrollFactor;
    instance.max_velocity_per_second = finalConfig.maxVelocityPerSecond;
    instance.velocity_acceleration_rate = finalConfig.velocityAccelerationRate;
    instance.velocity_damping_rate = finalConfig.velocityDampingRate;
    instance.verbose = finalConfig.verbose;
    
    // Initialize (container is handled internally by ScrollingContentDiv)
    await instance.initialize();
    
    return instance;
}

/**
 * Create a ScrollingContentDiv instance directly (lower-level API)
 * 
 * @param {string} htmlContentUrl - URL to HTML content
 * @param {Array<string>} backgroundImageUrls - Array of background image URLs
 * @param {boolean} [eagerImageLoading=false] - Force eager image loading
 * @returns {Promise<ScrollingContentDiv>} The initialized instance
 */
export async function createScrollingContentDiv(htmlContentUrl, backgroundImageUrls, eagerImageLoading = false) {
    return ScrollingContentDiv.create(htmlContentUrl, backgroundImageUrls, eagerImageLoading);
}

// Export the class for advanced usage
export { ScrollingContentDiv };

// Default export
export default { initDualLayerSlider, createScrollingContentDiv, ScrollingContentDiv };

