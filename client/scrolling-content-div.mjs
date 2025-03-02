import DOMPurify from './purify.es.mjs';

export class ScrollingContentDiv {
    static async create(htmlContentUrl, backgroundImageUrls) {
        const instance = new ScrollingContentDiv(htmlContentUrl, backgroundImageUrls);
        const initializedInstance = await instance.initialize();
        // this is added to the DOM from index.html
        return initializedInstance;
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
        this.verbose = true;
        this.current_velocity = 0;
        this.last_delta = 0;
    }

    async initializeImageSlots() {
        // Picture an infinite stack of alternating images with different heights.
        // Also picture viewing a portion of the stack through a browser window.
        // This function creates the small(est) stack of alternating images that can be
        // used to create the effect of an infinite stack of alternating images.
     
        // This function sets the initial top values for all imageSlots required to 
        // create the effect of viewing an infinitely scrolling list of non-overlapping 
        // alternating background images over the current window.innerHeight.
        let top = 0;
        let slotIndex = 0;
        this.imageSlots = [];

        const numImages = this.backgroundImageObjects.length;
        if ( numImages === 0 ) {
            throw new Error('numImages is 0');
        }
        console.log("numImages:", numImages);
        const windowHeight = window.innerHeight;
        console.log("windowHeight:", windowHeight);
        
        while ( top < (windowHeight * 2)) {
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
            console.log("slotIndex:", slotIndex, " imageHeight:", imageHeight, " top:", top);
            slotIndex += 1;
            top += imageHeight;
            console.log("slotIndex:", slotIndex, " imageHeight:", imageHeight, " top:", top);
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
            backgroundHtmlDiv.style.backgroundRepeat = 'repeat';
            backgroundHtmlDiv.style.backgroundSize = 'auto';
            backgroundHtmlDiv.style.backgroundPosition = '0 0';
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
            if ( imgSlot.top < 0 ) {
                let prevImgSlot = this.imageSlots[(imgSlot.slotIndex - 1 + this.imageSlots.length) % this.imageSlots.length];
                imgSlot.top = prevImgSlot.btm;
                imgSlot.btm = imgSlot.top + imgSlot.imageHeight;
                imgSlot.visible = false;
            }
            if (imgSlot.btm < 0) {
                let prevImgSlot = this.imageSlots[(imgSlot.slotIndex - 1 + this.imageSlots.length) % this.imageSlots.length];
                imgSlot.top = prevImgSlot.btm;
                imgSlot.btm = imgSlot.top + imgSlot.imageHeight;
                imgSlot.visible = false;
            }
            // imgSlot has scrolled off the bottom edge of the browser window 
            // so caller will hide it, 
            // move imgSlot.btm to before nextImgSlot.top, 
            // and then show it again.
            else if (imgSlot.top > window.innerHeight) {
                let nextImgSlot = this.imageSlots[(imgSlot.slotIndex + 1 + this.imageSlots.length) % this.imageSlots.length];
                imgSlot.btm = nextImgSlot.top;
                imgSlot.top = imgSlot.btm - imgSlot.imageHeight;
                imgSlot.visible = false;
            }
            // otherwise, imgSlot is visible
            else {
                imgSlot.visible = true;
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
        console.log('Attempting to fetch html from:', contentUrl);
    
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
        for ( let backgroundImageObject of this.backgroundImageObjects) {
            console.log('**** backgroundImageObject:', backgroundImageObject);
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
        this.htmlContentDiv.innerHTML = sanitized_html_content;
// deepcode ignore DOMXSS: because it's been sanitized using DOMPurify

        this.wrapperDiv.appendChild(this.htmlContentDiv);

        document.body.appendChild(this.wrapperDiv);

        window.addEventListener('resize', (event) => this.handle_window_resize_event(event));

    } // end of class initizalization

    handle_window_resize_event(event) {
        // this function is called when the window is resized
        // it reinitializes the imageSlots because the number of imageSlots
        // required to cover the current window.innerHeight may have changed
        // thus the backgroundHtmlDivs are also reinitialized.

        this.initializeImageSlots();
        this.initializeBackgroundHtmlDivs();
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
    
        // Update the current velocity based on the scroll event
        this.current_velocity += event.deltaY * 0.1; // Smaller step for velocity updates
    
        const bounding_client_rect = this.htmlContentDiv.getBoundingClientRect();
        const content_height = bounding_client_rect.height;
        const padding = content_height / 2;
        const parent = this.htmlContentDiv.parentNode;
        if (parent !== this.wrapperDiv) {
            throw new Error('htmlContentDiv is not a child of wrapperDiv');
        }
    
        // Clamp the velocity
        const max_velocity = content_height / 10;
        const min_velocity = -max_velocity;
        this.current_velocity = Math.max(min_velocity, Math.min(max_velocity, this.current_velocity));
    
        // Dampen the velocity over time
        const damping_factor = 0.95; // Higher damping factor for smoother scrolling
        this.current_velocity *= damping_factor;
    
        // If the scroll is too small, ignore it
        if (Math.abs(this.current_velocity) < 0.01) {
            this.current_velocity = 0;
            return;
        }

        this.transformImgSlots(this.current_velocity/10);
        this.transformHtmlDivs();
    
        const new_delta = this.current_velocity;
    
        if (this.verbose) {
            let info = [];
            info.push(`crt_veloc: ${this.current_velocity.toFixed(3)}`);
            info.push(`new_delta: ${new_delta.toFixed(3)}`);
            info.push(`max_veloc: ${max_velocity.toFixed(3)}`);
            info.push(`evt.delta: ${event.deltaY.toFixed(3)}`);
            console.log(info.join('\n'));
        }
    
        // Use requestAnimationFrame for smoother updates
        const updatePosition = () => {
            const current_top = bounding_client_rect.top;
            const window_height = window.innerHeight;
    
            // Pre-translate the htmlContentDiv
            let new_top = current_top + new_delta;
            let new_btm = new_top + content_height;
    
            // New top has gone past the bottom edge, so instantaneously go to the top
            if (new_top > window_height + padding) {
                parent.removeChild(this.htmlContentDiv);
                new_top = -content_height;
                this.htmlContentDiv.style.transform = `translateY(${new_top}px)`;
                parent.appendChild(this.htmlContentDiv);
            }
            // New bottom has gone past the top edge, so instantaneously go to the bottom
            else if (new_btm < -padding) {
                parent.removeChild(this.htmlContentDiv);
                new_top = window_height;
                this.htmlContentDiv.style.transform = `translateY(${new_top}px)`;
                parent.appendChild(this.htmlContentDiv);
            }
            else {
                // Apply the transform with smoothed transition
                this.htmlContentDiv.style.transform = `translateY(${new_top}px)`;
                const initial_delay = 0;
                const distance = Math.abs(new_delta);
                const duration = distance / 1000; // Assuming 1000 pixels per second
                this.htmlContentDiv.style.transition = `transform ${duration}s ease-out ${initial_delay}s`;
            }
    
            // Continue updating the position if the velocity is still significant
            if (Math.abs(this.current_velocity) >= 0.01) {
                requestAnimationFrame(updatePosition);
            }
        };
    
        // Start the position update
        requestAnimationFrame(updatePosition);
    } // end of handle_wrapper_scroll_event

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
        try {
            const sanitized_html_content = DOMPurify.sanitize(html_content);
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
        console.log(`imageSlots: ${numImgSlots} htmlDivs: ${numHtmlDivs} at line_number: ${line_number}`);
    }


} // end of ScrollingContentDiv class