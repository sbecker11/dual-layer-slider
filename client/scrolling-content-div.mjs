import DOMPurify from './purify.es.mjs';

export class ScrollingContentDiv {
    static async create(htmlContentUrl, backgroundImageUrls) {
        const instance = new ScrollingContentDiv(htmlContentUrl, backgroundImageUrls);
        await instance.initialize();
        // this is added to the DOM from index.html
        return instance;
    }

    constructor(htmlContentUrl, backgroundImageUrls) {
        this.htmlContentUrl = this.validate_url_string(htmlContentUrl);
        this.backgroundImageUrls = this.validate_list_of_url_strings(backgroundImageUrls);
        this.backgroundImageObjects = [];
        this.htmlContent = null; // the HTML content of the ScrollingContentDiv
        this.htmlContentDiv = null; // holds all html content
        this.wrapperDiv = null; // the wrapper div holding the htmlContentDiv
        this.imageSlots = []; // Array to hold the imageSlots used to position the background images
        this.backgroundImageObjects = []; // the array of realized background images
        this.backgroundHtmlDivs = []; // Array to hold multiple background htmlDivs
        this.contentScrollFactor = 2.0;
        this.backgroundScrollFactor = 0.1;
        this.verbose = false; // Disable verbose logging
        this.current_velocity = 0;
        this.last_delta = 0;
        this.absolute_scroll_top = 0; // Track absolute scroll position
        this.last_translate_y = null; // Track last translateY to calculate scroll delta
        this.scroll_top_min = null; // Minimum scrollTop limit (null = no limit)
        this.scroll_top_max = null; // Maximum scrollTop limit (null = no limit)
        this.animation_frame_id = null; // Track animation frame for cancellation
        this.is_window_focused = true; // Track window focus state
        this.campaign_square_height = null; // Height of a single campaign square item
        this.last_logged_images = null; // Track last logged images to avoid duplicate logs
        this.mouse_y_position = null; // Track mouse Y position
        this.scroll_velocity = 0; // Accumulated scroll velocity (pixels per second)
        this.max_velocity_per_second = 400; // Maximum velocity in pixels per second (positive or negative)
        this.max_velocity_per_frame = null; // Will be set based on container height to prevent flickering
        this.velocity_acceleration_rate = 50; // Velocity increment rate (pixels per second per second) - reduced to prevent oscillation
        this.velocity_damping_rate = 0.9; // Damping factor to slow down velocity when mouse is at center
        this.last_frame_time = null; // Track time for per-second calculations
        this.frame_count = 0; // Frame counter for logging
    }

    async initializeImageSlots() {
        // Picture an infinite stack of alternating images with different heights.
        // Also picture viewing a portion of the stack through a browser window.
        // This function creates the small(est) stack of alternating images that can be
        // used to create the effect of an infinite stack of alternating images.
     
        // This function sets the initial top values for all imageSlots required to 
        // create the effect of viewing an infinitely scrolling list of non-overlapping 
        // alternating background images over the current window.innerHeight.
        
        const numImages = this.backgroundImageObjects.length;
        if ( numImages === 0 ) {
            throw new Error('numImages is 0');
        }
        if (this.verbose) console.log("numImages:", numImages);
        const windowHeight = window.innerHeight;
        if (this.verbose) console.log("windowHeight:", windowHeight);
        
        // Start with negative offset to ensure we have images above the viewport
        // This ensures coverage from the very top (y=0) of the viewport
        let slotIndex = 0;
        this.imageSlots = [];
        
        // Calculate total height of one complete cycle of all images
        let totalCycleHeight = 0;
        for (let i = 0; i < numImages; i++) {
            totalCycleHeight += this.backgroundImageObjects[i].height;
        }
        
        // Start positioning from negative offset to ensure coverage well above viewport
        // We need image slots starting well before y=0 to prevent gaps
        // Start with a negative offset equal to at least one full cycle of images
        let startOffset = -totalCycleHeight;
        let top = startOffset;
        
        // Create enough image slots to cover well above and below viewport
        // Cover from -totalCycleHeight to windowHeight * 2 + totalCycleHeight
        const targetBottom = windowHeight * 2 + totalCycleHeight;
        while ( top < targetBottom) {
            let imageIndex = slotIndex % numImages;
            let backgroundImageObject = this.backgroundImageObjects[imageIndex];
            let imageHeight = backgroundImageObject.height;
            let imageUrl = backgroundImageObject.url;
            this.imageSlots.push({
                slotIndex: slotIndex,
                imageIndex: imageIndex,
                imageHeight: imageHeight,
                imageUrl: imageUrl,
                top: top,
                btm: top + imageHeight,
                visible: true // will be set to false when the imgSlot is not visible
            });
            if (this.verbose) console.log("slotIndex:", slotIndex, " imageHeight:", imageHeight, " top:", top, " btm:", top + imageHeight);
            slotIndex += 1;
            top += imageHeight;
        }
        
        // Ensure we have at least one image slot that starts well before y=0
        // Add more slots going backwards if needed to ensure no gaps
        if (this.imageSlots.length > 0 && this.imageSlots[0].top > -totalCycleHeight) {
            // Add slots before the first one to ensure coverage well above viewport
            let currentTop = this.imageSlots[0].top;
            let prependSlotIndex = -1;
            // Add at least one full cycle above, plus buffer
            const minTop = -totalCycleHeight * 2;
            while (currentTop > minTop) {
                let imageIndex = (prependSlotIndex % numImages + numImages) % numImages;
                let backgroundImageObject = this.backgroundImageObjects[imageIndex];
                let imageHeight = backgroundImageObject.height;
                let imageUrl = backgroundImageObject.url;
                currentTop -= imageHeight;
                this.imageSlots.unshift({
                    slotIndex: prependSlotIndex,
                    imageIndex: imageIndex,
                    imageHeight: imageHeight,
                    imageUrl: imageUrl,
                    top: currentTop,
                    btm: currentTop + imageHeight,
                    visible: true
                });
                prependSlotIndex -= 1;
                if (this.verbose) console.log("Prepended slot at top:", currentTop, " btm:", currentTop + imageHeight);
            }
            // Renumber slot indices
            this.imageSlots.forEach((slot, idx) => {
                slot.slotIndex = idx;
            });
        }
        
        // Also ensure we have enough slots below the viewport
        if (this.imageSlots.length > 0) {
            const lastSlot = this.imageSlots[this.imageSlots.length - 1];
            const targetBottom = windowHeight * 2 + totalCycleHeight;
            let currentTop = lastSlot.btm;
            let appendSlotIndex = this.imageSlots.length;
            while (currentTop < targetBottom) {
                let imageIndex = appendSlotIndex % numImages;
                let backgroundImageObject = this.backgroundImageObjects[imageIndex];
                let imageHeight = backgroundImageObject.height;
                let imageUrl = backgroundImageObject.url;
                this.imageSlots.push({
                    slotIndex: appendSlotIndex,
                    imageIndex: imageIndex,
                    imageHeight: imageHeight,
                    imageUrl: imageUrl,
                    top: currentTop,
                    btm: currentTop + imageHeight,
                    visible: true
                });
                if (this.verbose) console.log("Appended slot at top:", currentTop, " btm:", currentTop + imageHeight);
                appendSlotIndex += 1;
                currentTop += imageHeight;
            }
        }
        
        // initialize this.imageSlots 
        let numImgSlots = this.imageSlots.length;
        if ( numImgSlots < 2 ) {
            throw new Error('numImgSlots is too small: ' + numImgSlots);
        }

        // transform all this.imageSlots to wrap around the top and bottom 
        // edges of the browser window given the deltaY of 0
        this.transformImgSlots(0);
    }

    initializeBackgroundHtmlDivs() {
        // This function is called after initializeImageSlots
        // which is called after the background images have been
        // loaded and when the window is resized. Window resizing
        // could increase or decrease the list of imageSlots
        // required to cover the current browser window.innerHeight.
        // 
        // This function uses the imageSlots to recreate the 
        // actual background HTML divs. Old background HTML divs
        // are removed from the DOM and new background HTML divs
        // replacements are added to the DOM.

        // Changes due to vertical scrolling do not require 
        // wholesale imageSlot or backgroundHtmDiv replacements. 
        // When a new scrolling contentDelta is given 
        // a scaled contentDelta is used in transformImgSlots. 

        // create the actual background HTML divs using this.imageSlots
        let backgroundHtmlDivs = [];

        let numImgSlots = this.imageSlots.length;
        if ( numImgSlots < 2  ) {
            throw new Error('imageSlots is too small: ' + numImgSlots);
        }


        for ( let imageSlot of this.imageSlots) {
            
            // create the new backgroundHtmlDiv
            const backgroundHtmlDiv = document.createElement('div');
            backgroundHtmlDiv.id = "html-div-" + imageSlot.slotIndex;
            backgroundHtmlDiv.className = 'background-html-div';
            backgroundHtmlDiv.style.position = 'absolute';
            backgroundHtmlDiv.style.top = imageSlot.top + 'px';
            backgroundHtmlDiv.style.bottom = '';
            backgroundHtmlDiv.style.height = imageSlot.imageHeight + 'px';
            backgroundHtmlDiv.style.left = 0;
            backgroundHtmlDiv.style.width = '100%';
            backgroundHtmlDiv.style.backgroundImage = `url(${imageSlot.imageUrl})`; 
            backgroundHtmlDiv.style.backgroundRepeat = 'repeat-y'; // Repeat vertically only
            backgroundHtmlDiv.style.backgroundSize = '100% auto'; // Full width, maintain aspect ratio
            backgroundHtmlDiv.style.backgroundPosition = 'center top'; // Center horizontally, align to top
            backgroundHtmlDiv.style.backgroundColor = 'transparent';
            backgroundHtmlDiv.style.zIndex = -1;
            backgroundHtmlDiv.style.pointerEvents = 'none';

            // replace the old backgroundHtmlDiv with the new one if found
            let oldDiv = document.getElementById(backgroundHtmlDiv.id);
            if ( oldDiv ) {
                document.body.removeChild(oldDiv);
            }
            document.body.appendChild(backgroundHtmlDiv);
            backgroundHtmlDivs.push(backgroundHtmlDiv);
        }

        this.backgroundHtmlDivs = backgroundHtmlDivs;

        let numHtmDivs = this.backgroundHtmlDivs.length;
        if ( numHtmDivs === 0 ) {
            throw new Error('backgroundHtmlDivs is not initialized');
        }
        if ( numImgSlots !== numHtmDivs ) {
            throw new Error(`Mismatch between image slots and HTML divs: numImgSlots:${numImgSlots} != numHtmlDivs:${numHtmlDivs}. Image slots: ${JSON.stringify(this.imageSlots)}, HTML divs: ${JSON.stringify(this.backgroundHtmlDivs)}`);
        }

        this.validate_lists(123);

    } // backgroundHtmlDivs initialized based on current state of imageSlots


    transformImgSlots(deltaY) {
        // This function uses the given deltaY to transform
        // all imageSlots. It also wraps the imageSlots around the top 
        // and bottom edges of the browser window and indicates 
        // whether imgSlot is visible or not. 
        // 
        // When an imgSlot passes out of the top or bottom edges 
        // of the browser window it will be marked as not visible. 
        // 
        // This the most effective way to hide an htmlDiv while
        // it jumps is to remove it from the DOM, apply the new top 
        // and btm values to the htmlDiv, and then add it back 
        // to the DOM where it will become visible as it scrolls 
        // back into view.
        
        // apply the deltaY to all imageSlots
        for (let imgSlot of this.imageSlots) {
            imgSlot.top += deltaY;
            imgSlot.btm += deltaY;
        }

        // now wrap the imageSlots around the top and bottom edges of the browser window 

        // imgSlot has scrolled off the top edge of the browser window
        // so caller will hide it,
        // set its new imgSlot.top to after prevImgSlot.btm,
        // and then show it again.
        for ( let imgSlot of this.imageSlots) {
            // Check if image slot is completely above the viewport (btm < 0)
            if (imgSlot.btm < 0) {
                let prevImgSlot = this.imageSlots[(imgSlot.slotIndex - 1 + this.imageSlots.length) % this.imageSlots.length];
                imgSlot.top = prevImgSlot.btm;
                imgSlot.btm = imgSlot.top + imgSlot.imageHeight;
                imgSlot.visible = false;
            }
            // Check if image slot is completely below the viewport (top > window.innerHeight)
            else if (imgSlot.top > window.innerHeight) {
                let nextImgSlot = this.imageSlots[(imgSlot.slotIndex + 1 + this.imageSlots.length) % this.imageSlots.length];
                imgSlot.btm = nextImgSlot.top;
                imgSlot.top = imgSlot.btm - imgSlot.imageHeight;
                imgSlot.visible = false;
            }
            // Image slot overlaps with viewport (at least partially visible)
            // Visible if: top < window.innerHeight AND btm > 0
            else if (imgSlot.top < window.innerHeight && imgSlot.btm > 0) {
                imgSlot.visible = true;
            }
            // Edge case: image slot starts above viewport but extends into it (top < 0 but btm > 0)
            else if (imgSlot.top < 0 && imgSlot.btm > 0) {
                imgSlot.visible = true;
            }
            // Otherwise, mark as not visible (shouldn't happen, but safety check)
            else {
                imgSlot.visible = false;
            }
        }
    } // end of transformImgSlots

    transformHtmlDivs() {
        // This function uses the transformed imageSlots to update the
        // htmlDivs. It also hides the jump of any htmlDivs as they 
        // wrap around the top and bottom edges of the browser 
        // window. This is done by temporarily removing from htmlDiv, 
        // applying the new position, and then adding it back to DOM.

        this.validate_lists(194);

        for ( let imgSlot of this.imageSlots) {
            let htmlDiv = this.backgroundHtmlDivs[imgSlot.slotIndex];
            if ( htmlDiv == undefined ) {
                throw new Error(`htmlDiv is not defined for imgSlot:${imgSlot.slotIndex}`);
            }

            if ( imgSlot.visible == false) {
                // if marked invisible, prepare to hide the 
                // jump by removing the htmlDiv from the DOM
                document.body.removeChild(htmlDiv);
            }

            // update the htmlDiv's position whether it's visible or not
            htmlDiv.style.top = `${imgSlot.top}px`;
            htmlDiv.style.bottom = `${imgSlot.btm}px`;

            if ( imgSlot.visible == false ) {
                // if it was invisible then add the repositioned 
                // htmlDiv back to the DOM
                document.body.appendChild(htmlDiv);
                // mark the imgSlot as visible for the next scroll.
                imgSlot.visible = true;
            }
        }
    }

    /**
     * Initializes the ScrollingContentDiv instance.
     * This function is called only once and performs the following tasks:
     * - Loads the HTML content from the provided URL.
     * - Loads all background images from the provided URLs.
     * - Initializes image slots and background HTML divs.
     * - Creates and sets up the wrapper div and HTML content div.
     * - Adds event listeners for window resize and scroll events.
     * 
     * @returns {Promise<void>} A promise that resolves when initialization is complete.
     * @throws {Error} If fetching HTML content or background images fails.
     */
    async initialize() {
        // this function is called only once

        // load the HTML content from contentUrl
        const contentUrl = this.validate_url_string(this.htmlContentUrl);
        if (this.verbose) console.log('Attempting to fetch html from:', contentUrl);
    
        const contentResponse = await fetch(contentUrl);
        if (!contentResponse.ok) {
            throw new Error(`Failed to fetch HTML file: ${contentResponse.statusText}`);
        }
        const htmlContent = await contentResponse.text();
        if (!htmlContent) {
            throw new Error('Failed to fetch HTML content');
        }
        this.htmlContent = htmlContent;
        if (this.verbose) {
            console.log('HTML content fetched successfully');
        }

        // load all this.backgroundImageObjects from this.imageFileUrls
        this.backgroundImageObjects = []

        for ( let backgroundImageUrl of this.backgroundImageUrls) {
            let imageUrl = this.validate_url_string(backgroundImageUrl);
            let imageBlob = null;
            let imageHeight = null;
            if (this.verbose) {
                console.log('Attempting to fetch background image from:', imageUrl);
            }
            let response = await fetch(imageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch background image: ${response.statusText}`);
            }
            try {
                // imageBlob points to the downloaded image byte array
                imageBlob = await response.blob();
                if (!imageBlob) {
                    throw new Error('Failed to fetch background image blob');
                }
                if (this.verbose) {
                    console.log('Background image blob fetched successfully');
                }
                // fetch the image height
                const imageDimensions = await this.getImageDimensions(imageUrl);
                if (!imageDimensions) {
                    throw new Error('Failed to fetch background image imageDimensions');
                }
                if (this.verbose) {
                    console.log('Background image imageDimensions fetched successfully');
                }

                this.backgroundImageObjects.push({
                    url: imageUrl,
                    height: imageDimensions.height
                });
            }
            catch (error) {
                console.error(`Error fetching backgroundImageUrl: ${backgroundImageUrl} : `, error);
                throw error;
            }
        } // all this.backgroundImageObjects loaded and initialized
        if (this.verbose) {
            for ( let backgroundImageObject of this.backgroundImageObjects) {
                console.log('**** backgroundImageObject:', backgroundImageObject);
            }
        }

        // The first call to create and set up this.imageSlots using this.backgroundImageObjects
        this.initializeImageSlots();

        // The first call to create and set up this.backgroundHtmlDivs using this.imageSlots
        this.initializeBackgroundHtmlDivs();

        // create the new wrapperDiv which will be 
        // the parent of the htmlContentDiv;
        this.wrapperDiv = document.createElement('div');
        this.wrapperDiv.id = 'wrapper-div';
        this.wrapperDiv.addEventListener('wheel', (event) => this.handle_wrapper_scroll_event(event), { passive: false });

        // create the new htmlContentDiv holding the htmlContent
        // this will be affected by the wrapperDiv's scroll event
        // this will be affected by the window's resize event
        this.htmlContentDiv = document.createElement('div');
        this.htmlContentDiv.id = 'html-content-div';

        let sanitized_html_content = this.getSanitizedHtmlContent(this.htmlContent);
        if ( sanitized_html_content.length === 0 ) {
            throw new Error('Failed to sanitize HTML content');
        }
        
        // Debug: Check image count in sanitized content before duplication
        const imgCountBeforeDup = (sanitized_html_content.match(/<img/g) || []).length;
        console.log(`[Init] Sanitized content has ${imgCountBeforeDup} img tags before duplication`);
        
        // Create continuous loop by duplicating content multiple times
        // We'll create 3 copies: original, copy above, copy below for seamless looping
        const contentCopy = sanitized_html_content;
        this.htmlContentDiv.innerHTML = contentCopy + contentCopy + contentCopy;
// deepcode ignore DOMXSS: because it's been sanitized using DOMPurify

        // Debug: Log image count after insertion - check immediately and after a delay
        const imgElementsImmediate = this.htmlContentDiv.querySelectorAll('img');
        console.log(`[Init] Found ${imgElementsImmediate.length} img elements in DOM immediately after insertion (expected: ${imgCountBeforeDup * 3})`);
        
        setTimeout(() => {
            const imgElements = this.htmlContentDiv.querySelectorAll('img');
            console.log(`[Init] Found ${imgElements.length} img elements in DOM after 100ms delay`);
            if (imgElements.length > 0) {
                imgElements.forEach((img, idx) => {
                    const rect = img.getBoundingClientRect();
                    const computedStyle = window.getComputedStyle(img);
                    const isVisible = rect.width > 0 && rect.height > 0;
                    const display = computedStyle.display;
                    const visibility = computedStyle.visibility;
                    const opacity = computedStyle.opacity;
                    const zIndex = computedStyle.zIndex;
                    
                    console.log(`[Init] Image ${idx}:`);
                    console.log(`  src="${img.src.substring(0, 80)}..."`);
                    console.log(`  dimensions=${rect.width}x${rect.height}`);
                    console.log(`  display=${display}, visibility=${visibility}, opacity=${opacity}, z-index=${zIndex}`);
                    console.log(`  visible=${isVisible}`);
                    
                    if (!isVisible) {
                        console.error(`[Init] Image ${idx} is NOT visible!`);
                        console.error(`  Parent container:`, img.parentElement?.className);
                        const parentRect = img.parentElement?.getBoundingClientRect();
                        if (parentRect) {
                            console.error(`  Parent dimensions: ${parentRect.width}x${parentRect.height}`);
                        }
                    }
                    
                    // Force image to load and check for errors
                    img.onerror = () => {
                        console.error(`[Init] Image ${idx} failed to load: ${img.src}`);
                    };
                    img.onload = () => {
                        console.log(`[Init] Image ${idx} loaded successfully: ${img.naturalWidth}x${img.naturalHeight}`);
                    };
                });
            } else {
                console.error('[Init] ERROR: No img elements found in DOM after delay!');
                console.log('[Init] HTML content sample:', this.htmlContentDiv.innerHTML.substring(0, 1000));
                // Try to find why images aren't there
                const allElements = this.htmlContentDiv.querySelectorAll('*');
                console.log(`[Init] Total elements in htmlContentDiv: ${allElements.length}`);
            }
        }, 500); // Increased delay to 500ms to ensure DOM is fully ready

        this.wrapperDiv.appendChild(this.htmlContentDiv);
        
        // Set initial position to the middle copy (second copy) so we can scroll in both directions
        // Wait for content to be measured, then position it
        setTimeout(() => {
            const contentHeight = this.htmlContentDiv.getBoundingClientRect().height;
            const singleContentHeight = contentHeight / 3;
            // Position at the start of the middle copy (one content height down)
            const initialPosition = -singleContentHeight;
            this.htmlContentDiv.style.transform = `translateY(${initialPosition}px)`;
            this.htmlContentDiv.style.transition = 'none'; // No transition for initial positioning
            this.last_translate_y = initialPosition;
            this.last_frame_time = performance.now(); // Initialize frame time tracking
            
            // Force all images to load immediately (change lazy loading to eager)
            // Since content is duplicated and positioned, we want all images to load
            const imgElements = this.htmlContentDiv.querySelectorAll('img');
            console.log(`[Init] Found ${imgElements.length} images, forcing them to load...`);
            imgElements.forEach((img, idx) => {
                // Change lazy loading to eager for all images
                if (img.loading === 'lazy') {
                    img.loading = 'eager';
                    console.log(`[Init] Changed image ${idx} from lazy to eager loading`);
                }
                
                // Force image to load by triggering load event
                if (!img.complete) {
                    // Create a new image element to force load
                    const newImg = new Image();
                    newImg.onload = () => {
                        console.log(`[Init] Image ${idx} preloaded successfully: ${newImg.naturalWidth}x${newImg.naturalHeight}`);
                    };
                    newImg.onerror = () => {
                        console.error(`[Init] Image ${idx} failed to preload: ${img.src}`);
                    };
                    newImg.src = img.src;
                } else {
                    console.log(`[Init] Image ${idx} already loaded: ${img.naturalWidth}x${img.naturalHeight}`);
                }
                
                // Ensure image is visible
                img.style.display = 'block';
                img.style.visibility = 'visible';
                img.style.opacity = '1';
            });
        }, 300); // Increased delay to ensure DOM and styles are fully applied

        document.body.appendChild(this.wrapperDiv);

        window.addEventListener('resize', (event) => this.handle_window_resize_event(event));
        
        // Track mouse position for delta-y calculation
        document.addEventListener('mousemove', (event) => {
            this.handle_mouse_move(event);
            // Start animation loop when mouse moves (if not already running)
            if (this.animation_frame_id === null && this.is_window_focused) {
                this.startAnimationLoop();
            }
        });
        document.addEventListener('mouseleave', () => {
            this.mouse_y_position = null;
            this.mouse_over_image_container = null;
            this.mouse_relative_position = null;
        });
        
        // Pause animation when window loses focus
        window.addEventListener('blur', () => {
            this.is_window_focused = false;
            // Stop any ongoing animation
            if (this.animation_frame_id !== null) {
                cancelAnimationFrame(this.animation_frame_id);
                this.animation_frame_id = null;
            }
            // Stop velocity immediately
            this.current_velocity = 0;
        });
        
        // Resume animation when window gains focus
        window.addEventListener('focus', () => {
            this.is_window_focused = true;
        });
        
        // Also pause when page becomes hidden (tab switch, etc.)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.is_window_focused = false;
                if (this.animation_frame_id !== null) {
                    cancelAnimationFrame(this.animation_frame_id);
                    this.animation_frame_id = null;
                }
                this.scroll_velocity = 0;
                this.current_velocity = 0;
            } else {
                this.is_window_focused = true;
            }
        });
        
        // Clean up when page is unloading (window closing)
        window.addEventListener('beforeunload', () => {
            this.is_window_focused = false;
            if (this.animation_frame_id !== null) {
                cancelAnimationFrame(this.animation_frame_id);
                this.animation_frame_id = null;
            }
            this.scroll_velocity = 0;
            this.current_velocity = 0;
        });
        
        // Return the instance for method chaining
        return this;
    } // end of class initizalization

    handle_window_resize_event(event) {
        // this function is called when the window is resized
        // it reinitializes the imageSlots because the number of imageSlots
        // required to cover the current window.innerHeight may have changed
        // thus the backgroundHtmlDivs are also reinitialized.

        this.initializeImageSlots();
        this.initializeBackgroundHtmlDivs();
    }

    /**
     * Set scrollTop limits
     * @param {number|null} min - Minimum scrollTop value (null = no minimum)
     * @param {number|null} max - Maximum scrollTop value (null = no maximum)
     */
    setScrollTopLimits(min, max) {
        this.scroll_top_min = min;
        this.scroll_top_max = max;
        
        // Clamp current scrollTop to new limits
        if (this.scroll_top_min !== null && this.absolute_scroll_top < this.scroll_top_min) {
            this.absolute_scroll_top = this.scroll_top_min;
        }
        if (this.scroll_top_max !== null && this.absolute_scroll_top > this.scroll_top_max) {
            this.absolute_scroll_top = this.scroll_top_max;
        }
    }

    // updateBoundaries() {
    //     const contentHeight = this.htmlContentDiv.getBoundingClientRect().height;
    //     return {
    //         minScroll: -(contentHeight * 2) - this.padding, // Allow scrolling beyond the content height with this.padding
    //         maxScroll: contentHeight * 2 + this.padding // Allow scrolling beyond the content height with this.padding
    //     };
    // }

    handle_wrapper_scroll_event(event) {
        event.preventDefault();
        // Mouse-based scrolling is now primary, scroll events are ignored
        // Start animation loop if not already running
        if (this.animation_frame_id === null) {
            this.startAnimationLoop();
        }
    }
    
    startAnimationLoop() {
        // Calculate campaign square height if not already calculated
        if (this.campaign_square_height === null && this.htmlContentDiv) {
            const firstItem = this.htmlContentDiv.querySelector('.dashboard__item');
            if (firstItem) {
                this.campaign_square_height = firstItem.getBoundingClientRect().height;
                console.log('Campaign square height:', this.campaign_square_height, 'px');
            }
        }
        
        // Initialize translateY tracking if needed
        if (this.last_translate_y === null && this.htmlContentDiv) {
            const bounding_client_rect = this.htmlContentDiv.getBoundingClientRect();
            this.last_translate_y = bounding_client_rect.top;
        }
        
        const updatePosition = () => {
            // Recalculate bounding rect to get current position
            const current_rect = this.htmlContentDiv.getBoundingClientRect();
            const current_content_height = current_rect.height;
    
            // For continuous loop: calculate the single content height (since we duplicated it 3 times)
            const single_content_height = current_content_height / 3;
            
            // Calculate velocity acceleration based on mouse position relative to htmlContentDiv edges
            const current_time = performance.now();
            let delta_time = 0;
            if (this.last_frame_time !== null) {
                delta_time = (current_time - this.last_frame_time) / 1000; // Convert to seconds
            }
            this.last_frame_time = current_time;
            
            // Clamp delta_time to prevent large jumps (e.g., if tab was inactive)
            // Use a reasonable maximum delta_time (e.g., 1/30 second = ~33ms for 30fps)
            const MAX_DELTA_TIME = 1/30; // Maximum 33ms between frames
            if (delta_time > MAX_DELTA_TIME) {
                delta_time = MAX_DELTA_TIME;
            }
            
            if (delta_time > 0 && this.htmlContentDiv) {
                const contentRect = this.htmlContentDiv.getBoundingClientRect();
                const contentTop = contentRect.top;
                const contentHeight = contentRect.height;
                
                if (this.mouse_y_position !== null && contentHeight > 0) {
                    // Calculate mouse position relative to container viewport (0 = top edge, 1 = bottom edge, 0.5 = center)
                    // Use viewport-relative position to avoid issues with scrolling container
                    const viewportTop = 0;
                    const viewportBottom = window.innerHeight;
                    const viewportHeight = viewportBottom - viewportTop;
                    
                    // Calculate mouse position relative to viewport (0 = top, 1 = bottom, 0.5 = center)
                    const mouseRelativeY = (this.mouse_y_position - viewportTop) / viewportHeight;
                    
                    // Calculate target velocity based on mouse position
                    // Top edge (0) → -max_velocity, bottom edge (1) → +max_velocity, center (0.5) → 0
                    const normalizedPosition = (mouseRelativeY - 0.5) * 2; // Maps 0.5→0, 0→-1, 1→+1
                    const targetVelocity = normalizedPosition * this.max_velocity_per_second;
                    
                    // Accelerate velocity toward target velocity smoothly
                    const velocityDifference = targetVelocity - this.scroll_velocity;
                    const acceleration = velocityDifference * this.velocity_acceleration_rate * delta_time;
                    
                    // Increment velocity (act as accelerator)
                    this.scroll_velocity += acceleration;
                    
                    // Clamp velocity to max values
                    this.scroll_velocity = Math.max(-this.max_velocity_per_second, 
                                                    Math.min(this.max_velocity_per_second, this.scroll_velocity));
                    
                    // Apply damping when mouse is near center (dampen toward zero)
                    const distanceFromCenter = Math.abs(mouseRelativeY - 0.5);
                    const centerThreshold = 0.1; // 10% from center
                    if (distanceFromCenter < centerThreshold) {
                        // Dampen velocity toward zero
                        this.scroll_velocity *= Math.pow(this.velocity_damping_rate, delta_time * 60); // Scale by 60 for per-second damping
                    }
                } else {
                    // No mouse position, apply damping to slow down
                    this.scroll_velocity *= Math.pow(this.velocity_damping_rate, delta_time * 60);
                }
            }
            
            // Calculate frame delta based on velocity and time elapsed
            let frame_delta = 0;
            if (delta_time > 0) {
                const velocity_per_frame = this.scroll_velocity * delta_time; // Pixels per second * seconds = pixels
                
                // Hard limit: abs(current_velocity converted to frame delta) should never exceed 20px per animation frame
                const MAX_DELTA_PER_FRAME = 40; // Absolute maximum pixels per frame (increased from 20)
                
                // Clamp frame delta to never exceed 20px per frame
                frame_delta = Math.max(-MAX_DELTA_PER_FRAME, 
                                      Math.min(MAX_DELTA_PER_FRAME, velocity_per_frame));
            }
            
            // Log current velocity to browser console (every 60 frames to reduce spam)
            if (!this.velocity_log_frame_count) this.velocity_log_frame_count = 0;
            this.velocity_log_frame_count++;
            if (this.velocity_log_frame_count % 60 === 0) {
                console.log('Current velocity:', this.scroll_velocity.toFixed(2), 'px/s');
            }
            
            // Accumulate position instead of resetting to zero
            // Calculate new position based on last position plus delta
            let new_top = (this.last_translate_y || 0) + frame_delta;
            let is_wrapping = false;
    
            // Continuous loop wrapping: wrap when we exceed boundaries
            // We have 3 copies: copy1 (top), copy2 (middle), copy3 (bottom)
            // translateY ranges: copy1 [-2h to -h], copy2 [-h to 0], copy3 [0 to h]
            // We start at -h (top of copy2, middle)
            // Wrap earlier (20px before boundaries) to prevent translateY from exceeding safe bounds
            const wrap_threshold_top = -single_content_height * 2 + 20; // Wrap 20px before bottom of copy1
            const wrap_threshold_bottom = 0 - 20; // Wrap 20px before top of copy3
            
            if (new_top <= wrap_threshold_top) {
                // Scrolled too far up, wrap to copy3 (bottom)
                // Calculate how far past threshold we went
                const overshoot = wrap_threshold_top - new_top;
                new_top = wrap_threshold_bottom - overshoot; // Continue from bottom threshold
                is_wrapping = true;
            } else if (new_top >= wrap_threshold_bottom) {
                // Scrolled too far down, wrap to copy1 (top)
                // Calculate how far past threshold we went
                const overshoot = new_top - wrap_threshold_bottom;
                new_top = wrap_threshold_top + overshoot; // Continue from top threshold
                is_wrapping = true;
            }
            
            // Update background images with parallax effect (dual-layer scrolling)
            // Background scrolls at backgroundScrollFactor speed (0.1x) for parallax
            // Content scrolls at contentScrollFactor speed (2.0x) - but we use frame_delta directly
            const background_delta = frame_delta * this.backgroundScrollFactor;
            this.transformImgSlots(background_delta);
            this.transformHtmlDivs();
            
            // Log dual-layer scrolling info (every 30 frames to reduce console spam)
            if (!this.frame_count) this.frame_count = 0;
            this.frame_count++;
            if (this.frame_count % 30 === 0) {
                console.log(`Dual-layer: Content delta=${frame_delta.toFixed(2)}px, Background delta=${background_delta.toFixed(2)}px (${(this.backgroundScrollFactor * 100).toFixed(0)}% speed)`);
            }
            
            // Apply the transform without CSS transition for consistent frame-by-frame updates
            // CSS transitions can cause jumps when combined with rapid frame updates
            this.htmlContentDiv.style.transform = `translateY(${new_top}px)`;
            this.htmlContentDiv.style.transition = 'none'; // No transition - we handle smoothness via frame delta limits
            
            // Update last_translate_y after applying transform (for next frame, it will be reset to 0)
            this.last_translate_y = new_top;
            
            // Log visible image filenames
            this.logVisibleImages();
            
            // Log y-translate value when it changes (threshold: 1px to reduce noise)
            if (this.last_logged_scroll_top === null || Math.abs(new_top - this.last_logged_scroll_top) > 1) {
                console.log('y-translate:', new_top.toFixed(2), 'px');
                this.last_logged_scroll_top = new_top;
            }
            
            // Additional verbose logging if enabled
            if (this.verbose) {
                console.log('translateY:', new_top.toFixed(2), 'px | scrollTop:', this.absolute_scroll_top.toFixed(2), 'px');
            }
    
            // Continue animation loop if window is focused
            // Keep running as long as mouse might be over an image container
            if (this.is_window_focused) {
                this.animation_frame_id = requestAnimationFrame(updatePosition);
            } else {
                this.animation_frame_id = null;
            }
        };
        
        // Start the animation loop
        if (this.is_window_focused) {
            this.animation_frame_id = requestAnimationFrame(updatePosition);
        }
    } // end of startAnimationLoop

    // Function to get image dimension from a URL string
    // example usage:
    // const url = 'https://example.com/image.jpg';
    // const dimensions = await this.etImageDimensions(url);
    // const dimensions = await this.getImageDimensions(url);
    async getImageDimensions(url) {
        const imageUrl = this.validate_url_string(url);
        return new Promise((resolve, reject) => {
        const temp_image_element = new Image();
    
        // Set up event handlers
        temp_image_element.onload = () => {
            resolve({
            height: temp_image_element.naturalHeight,
            width: temp_image_element.naturalWidth
            });
        };
    
        temp_image_element.onerror = () => {
            reject(new Error('Failed to load image'));
        };
    
        // Set the image source to trigger loading
        temp_image_element.src = imageUrl;
        });
    }
    /**
     * Validates a given URL string.
     * 
     * @param {string} url_string - The URL string to validate.
     * @returns {string} - The validated URL string.
     * @throws {Error} - If the URL string is invalid.
     */
    getSanitizedHtmlContent(html_content) {
        // Use DOMPurify to sanitize the HTML content
        // Configure DOMPurify to allow images and their attributes
        try {
            // Create a fresh DOMPurify config for each call to avoid any potential state issues
            const config = {
                ALLOWED_TAGS: ['div', 'img', 'span', 'p', 'button', 'strong', 'a', 'style', 'script', 'main', 'section', 'article', 'header', 'footer'],
                ALLOWED_ATTR: ['class', 'id', 'src', 'alt', 'loading', 'data-path', 'data-timestamp', 'data-product', 'data-campaign', 'href', 'type', 'rel', 'width', 'height'],
                ALLOW_DATA_ATTR: true,
                KEEP_CONTENT: true,
                RETURN_DOM: false, // Return string, not DOM
                RETURN_DOM_FRAGMENT: false,
                RETURN_TRUSTED_TYPE: false,
                // Ensure images are preserved
                ADD_ATTR: ['src', 'alt', 'loading'], // Explicitly allow these attributes
                FORBID_TAGS: [], // Don't forbid any tags
                FORBID_ATTR: [] // Don't forbid any attributes
            };
            
            const sanitized_html_content = DOMPurify.sanitize(html_content, config);
            
            // Debug: Check if images are in sanitized content
            const imgCount = (sanitized_html_content.match(/<img/g) || []).length;
            const originalImgCount = (html_content.match(/<img/g) || []).length;
            
            console.log(`[Sanitize] Original HTML has ${originalImgCount} img tags, sanitized has ${imgCount} img tags`);
            
            if (imgCount === 0 && originalImgCount > 0) {
                console.error('[Sanitize] ERROR: DOMPurify stripped all img tags!');
                console.log('[Sanitize] Original HTML sample:', html_content.substring(0, 1000));
                console.log('[Sanitize] Sanitized HTML sample:', sanitized_html_content.substring(0, 1000));
            } else if (imgCount === 0) {
                console.warn('[Sanitize] WARNING: No img tags found in sanitized content!');
                console.log('[Sanitize] Sample of sanitized content:', sanitized_html_content.substring(0, 500));
            } else if (imgCount < originalImgCount) {
                console.warn(`[Sanitize] WARNING: Some img tags were removed (${originalImgCount} -> ${imgCount})`);
            }
            
            return sanitized_html_content;
        } catch (error) {
            console.error('Error sanitizing HTML content:', error);
            return '';
        }
    }
    
    validate_url_string(url_string) {
        // returns a validated url_string
        if ( !url_string || typeof url_string !== 'string' || url_string.length === 0 || url_string == undefined) {
            throw new Error('Invalid url_string: null, not string, empty, or undefined');
        }
        if ( !url_string.startsWith('http') ) {
            throw new Error('Invalid url_string: ' + url_string + ' is not a valid URL');
        }
        return url_string;
    }

    /**
     * Validates a list of URL strings.
     * 
     * @param {Array<string>} url_strings - The list of URL strings to validate.
     * @returns {Array<string>} - The validated list of URL strings.
     * @throws {Error} - If the list is invalid or contains invalid URL strings.
     */
    validate_list_of_url_strings(url_strings) {
        
        // returns a validated list of valid url_strings
        if (! url_strings || !Array.isArray(url_strings) || url_strings.length === 0 || url_strings == undefined) {
            throw new Error('Invalid url_strings: null, not an array, empty, or undefined');
        }
        for ( let url_string of url_strings) {
            this.validate_url_string(url_string);
        }
        return url_strings;
    }

    validate_lists(line_number) {
        let numImgSlots = this.imageSlots.length;
        let numHtmlDivs = this.backgroundHtmlDivs.length;

        if ( numImgSlots === 0 ) {
            throw new Error('imageSlots is not initialized at line_number:' + line_number);
        }
        if ( numHtmlDivs === 0 ) {
            throw new Error('backgroundHtmlDivs is not initialized at line_number:' + line_number);
        }
        if ( numImgSlots !== numHtmlDivs ) {
            throw  new Error(`Mismatch between image slots and HTML divs: numImgSlots:${numImgSlots} != numHtmlDivs:${numHtmlDivs}. Image slots: ${JSON.stringify(this.imageSlots)}, HTML divs: ${JSON.stringify(this.backgroundHtmlDivs)} at line_number: ${line_number}`);
        }
        if (this.verbose) console.log(`imageSlots: ${numImgSlots} htmlDivs: ${numHtmlDivs} at line_number: ${line_number}`);
    }

    /**
     * Handle mouse move event to calculate velocity increment based on mouse position relative to htmlContentDiv edges
     * Mouse at top edge → negative velocity acceleration
     * Mouse at bottom edge → positive velocity acceleration
     * Mouse at center → velocity dampens toward zero
     */
    handle_mouse_move(event) {
        if (!this.htmlContentDiv) return;
        
        const mouseY = event.clientY;
        this.mouse_y_position = mouseY;
    }

    /**
     * Log filenames of images that are currently visible children of the scrolling container
     */
    logVisibleImages() {
        if (!this.htmlContentDiv) return;
        
        const viewportTop = 0;
        const viewportBottom = window.innerHeight;
        
        // Get all image elements within the scrolling container
        const images = this.htmlContentDiv.querySelectorAll('img');
        const visibleImages = [];
        
        images.forEach(img => {
            const rect = img.getBoundingClientRect();
            // Check if image is visible in viewport (at least partially)
            if (rect.bottom >= viewportTop && rect.top <= viewportBottom) {
                // Extract filename from src or alt attribute
                const src = img.src || img.getAttribute('src') || '';
                const alt = img.alt || '';
                
                // Extract filename from path
                let filename = '';
                if (src) {
                    const urlParts = src.split('/');
                    filename = urlParts[urlParts.length - 1] || '';
                } else if (alt) {
                    filename = alt;
                }
                
                if (filename) {
                    visibleImages.push(filename);
                }
            }
        });
        
        // Only log if the list of visible images has changed
        const imagesKey = visibleImages.sort().join(',');
        if (this.last_logged_images !== imagesKey) {
            console.log('Visible images:', visibleImages);
            this.last_logged_images = imagesKey;
        }
    }


} // end of ScrollingContentDiv class