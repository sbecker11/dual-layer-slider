import DOMPurify from './purify.es.mjs';

export class ScrollingContentDiv {
    static async create(htmlContentUrl, backgroundImgPaths) {
        const instance = new ScrollingContentDiv(htmlContentUrl, backgroundImgPaths);
        const initializedInstance = await instance.initialize();
        // this is added to the DOM from index.html
        return initializedInstance;
    }

    getSanitizedHtml(content) {
        // Use DOMPurify to sanitize the HTML content
        try {
            const sanitizedContent = DOMPurify.sanitize(content);
            return sanitizedContent;
        } catch (error) {
            console.error('Error sanitizing HTML content:', error);
            return '';
        }
    }

    constructor(htmlContentUrl, backgroundImageUrls) {
        if (!htmlContentUrl) {
            throw new Error('the URL to the htmlContent is required');
        }
        if (! backgroundImageUrls || !Array.isArray(backgroundImageUrls) || backgroundImageUrls.length === 0) {
            throw new Error('An array of background image URLS required');
        }
        this.htmlContentUrl = htmlContentUrl;
        this.htmlContent = null; // the HTML content of the ScrollingContentDiv
        this.htmlContentDiv = null; // holds all html content
        this.backgroundImageUrls = backgroundImageUrls;
        this.backgroundImages = [];
        this.backgroundVtDivs = []; // Array to hold multiple background vtDivs
        this.backgroundHtmlDivs = []; // Array to hold multiple background htmlDivs
        this.padding = 50; // padding to allow scrolling above and below the content
        this.contentScrollFactor = 2.0;
        this.backgroundScrollFactor = 0.1;
        this.verbose = true;

    }

    initializeBackgroundVtDivs() {
        // this function initializes the virtual background vtDiv's position in the virtual 
        // space using the height of all background images defined in this.backgroundImageUrls 
        // array, each with its own URL and height given to the constructor of the 
        // this ScrollingContentDiv class.
        // This function creates a virtualTop for the number of vtDivs reguired to 
        // create an infinitely scrolling list of alternating background images over
        // the current window.innerHeight.
        let top = 0;
        let vtDivIndex = 0
        let vtDivs = []
        const numImages = this.backgroundImageUrls.length;
        while ( top < window.innerHeight * 2) {
            let imageIndex = vtDivIndex % numImages;
            let imageHeight = this.backgroundImageUrls[imageIndex].height;
            vtDivs.push({
                vtDivIndex: vtDivIndex,
                imageIndex: imageIndex,
                imageHeight: imageHeight,
                imgUrl: this.backgroundImageUrls[imageIndex].url,
                top: top,
                btm: top + imageHeight,
                visible: true // will be set to false when the vtDiv is not visible
            });
            console.log(`vtDivs[0].id: ${vtDivs[0].id}`);
            vtDivIndex += 1;
            top += imageHeight;
        }
        // initilize this.backgroundVtDivs 
        this.backgroundVtDivs = vtDivs;

        // transform all this.backgroundVtDivs to wrap around the top and bottom 
        // edges of the browser window given the deltaY of 0
        this.transformVtDivs(0);
    }

    transformVtDivs(deltaY) {
        // this function uses the given deltaY to transform
        // all vtDivs. It also wraps the vtDivs around the top 
        // and bottom edges of the browser window and indicates 
        // whether vtDiv is visible or not. 
        // 
        // When a vtDiv passes out of the top or bottom edges 
        // of the browser window (from 0 to window.innerHeight)
        // it will be marked as not visible. 
        // 
        // This should be used by the caller to remove the 
        // physical htmlDiv from the DOM, apply the new top 
        // and btm values to the htmlDiv, and then add it back 
        // to the DOM where it will become visible as it scrolls 
        // back into view.
        
        // apply the deltaY to all vtDivs
        for (let vtDiv of this.backgroundVtDivs) {
            vtDiv.top += deltaY;
            vtDiv.btm += deltaY;
        }

        // now wrap the vtDivs around the top and bottom edges of the browser window
        for (let vtDiv of this.backgroundVtDivs) {
            let prevVtDiv = this.backgroundVtDivs[vtDiv.index - 1 % this.backgroundVtDivs.length];
            let nextVtDiv = this.backgroundVtDivs[vtDiv.index + 1 % this.backgroundVtDivs.length];

            // vtDiv has scrolled off the top edge of the browser
            // window so hide it and move vtDiv.top to after prevVtDiv.btm
            if (vtDiv.btm < 0) {
                vtDiv.top = prevVtDiv.btm;
                vtDiv.btm = vtDiv.top + vtDiv.imageHeight;
                vtDiv.visible = false;
            }
            // vtDiv has scroll off the bottom edge of the browserr
            // window so hide it and move vtDiv.btm to before nextVtDiv.top
            else if (vtDiv.top > window.innerHeight) {
                vtDiv.btm = nextVtDiv.top;
                vtDiv.top = vtDiv.btm - vtDiv.imageHeight;
                vtDiv.visible = false;
            }
            // otherwise, vtDiv is visible
            else {
                vtDiv.visible = true;
            }
        }
    }

    transformHtmlDivs() {
        let numVtDivs = this.backgroundVtDivs.length;
        let numHtmlDivs = this.backgroundHtmlDivs.length;

        if ( numVtDivs === 0 ) {
            throw new Error('backgroundVtDivs is not initialized');
        }
        if ( numHtmlDivs === 0 ) {
            throw new Error('backgroundHtmlDivs is not initialized');
        }
        if ( numVtDivs !== numHtmlDivs ) {
            throw new Error(`numVtDivs:${numVtDivs}  !=  numHtmlDivs:{$numHtmlDivs}`);
        }
        // This function uses the transformed vtDivs to update the
        // htmlDivs. It also hides the jump of any htmlDivs as they 
        // wrap around the top and bottom edges of the browser 
        // window. Thi is done by temporarily removing from htmlDiv, 
        // applying the new position, and then adding it back to DOM.
        for ( let htmlDiv of this.backgroundHtmlDivs) { // html-div-0, html-div-1, ...
            let vtDivIndex = parseInt(htmlDiv.id.split('-')[2]);
            this.validate_vtDivIndex(vtDivIndex);
            let vtDiv = this.backgroundVtDivs[vtDivIndex];
        
            if ( vtDiv.visible == false) {
                // if marked invisible, prepare to hide the 
                // jump by removing the htmlDiv from the DOM
                document.body.removeChild(htmlDiv);
            }

            // update the htmlDiv's position whether it's visible or not
            htmlDiv.style.top = `${vtDiv.top}px`;
            htmlDiv.style.bottom = `${vtDiv.btm}px`;

            if ( vtDiv.visible == false ) {
                // if it was invisible then add the repositioned 
                // htmlDiv back to the DOM
                document.body.appendChild(htmlDiv);
                // mark the vtDiv as visible for the next scroll.
                vtDiv.visible = true;
            }
        }
    }

    validate_vtDivIndex(vtDivIndex) {
        let numVtDivs = this.backgroundVtDivs.length;
        if ( typeof vtDivIndex !== 'number' ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is not a number it is a ${typeof vtDivIndex}`);
        }
        if ( !Number.isNaN(vtDivIndex) ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is not a number it is  a ${typeof vtDivIndex}`);
        }
        if ( !Number.isInteger(vtDivIndex) ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is not an integer it is a ${typeof vtDivIndex}`);
        }
        if ( vtDivIndex === null ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is null`);
        }
        if ( vtDivIndex === undefined ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is undefined`);
        }
        if ( vtDivIndex < 0 ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is negative`);
        }
        if ( vtDivIndex >= numVtDivs ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is greater than or equal to numVtDivs`);
        }
        if ( vtDivIndex === Infinity ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is Infinity`);
        }
        if ( vtDivIndex === -Infinity ) {
            throw new Error(`Invalid vtDivIndex: ${vtDivIndex} is -Infinity`);
        }
    }

    initializeBackgroundHtmlDivs() {
        // this function is called after initializeBackgroundVtDivs
        // which is called after the background images have been loaded
        // and when the window is resized.

        // this function using the backgroundVtDivs to creates the 
        // actual background HTML divs. It also removes any
        // old background HTML divs from the DOM and adds the
        // new background HTML divs to the DOM.

        // changes due to vertical scrolling are handled 
        // first by transformVtDivs and then transformHtmlDivs

        // create the actual background HTML divs using this.backgroundVtDivs
        let backgroundHtmlDivs = [];

        for ( let backgroundVtDiv of this.backgroundVtDivs) {
            let vtDivIndex = backgroundVtDiv.vtDivIndex;
            
            // create the new backgroundHtmlDiv
            let htmlDivId = `html-div-${vtDivIndex}`;
            const backgroundHtmlDiv = document.createElement('div');
            backgroundHtmlDiv.id = htmlDivId;
            backgroundHtmlDiv.className = 'background-html-div';
            backgroundHtmlDiv.style.position = 'absolute';
            backgroundHtmlDiv.style.top = `${backgroundVtDiv.top}px`;
            backgroundHtmlDiv.style.bottom = `${backgroundVtDiv.btm}px`;
            backgroundHtmlDiv.style.height = `${backgroundVtDiv.imageHeight}px`;
            backgroundHtmlDiv.style.left = '0';
            backgroundHtmlDiv.style.width = '100%';

            backgroundHtmlDiv.style.backgroundImage = `url(${backgroundVtDiv.imageUrl})`;
            backgroundHtmlDiv.style.backgroundRepeat = 'repeat';
            backgroundHtmlDiv.style.backgroundSize = 'auto';
            backgroundHtmlDiv.style.backgroundPosition = '0 0';
            backgroundHtmlDiv.style.backgroundColor = 'transparent';
            backgroundHtmlDiv.style.zIndex = '-1';
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

        let numVtDivs = this.backgroundVtDivs.length;
        let numHtmDivs = this.backgroundHtmlDivs.length;
        if ( numVtDivs !== numHtmDivs ) {
            throw new Error(`numVtDivs:${numVtDivs}  !=  numHtmlDivs:{$numHtmlDivs}`);
        }
    } // backgroundHtmlDivs initialized based on current state of backgroundVtDivs


    async initialize() {
        // this function is called only once

        // load the HTML content from this.htmlContentUrl
        if (this.verbose) {
            console.log('Attempting to fetch html from:', this.htmlContentUrl);
        }
        const contentResponse = await fetch(this.htmlContentUrl);
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

        // load all this.backgroundImages from this.imageFileUrls
        this.backgroundImages = []

        for ( let backgroundImageUrl of this.backgroundImageUrls) {
            let backgroundImageBlob = null;
            let backgroundImageHeight = null;
            if (this.verbose) {
                console.log('Attempting to fetch background image from:', backgroundImageUrl);
            }
            let response = await fetch(backgroundImageUrl);
            if (!response.ok) {
                throw new Error(`Failed to fetch background image: ${response.statusText}`);
            }
            try {
                backgroundImageBlob = await response.blob();
                if (!backgroundImageBlob) {
                    throw new Error('Failed to fetch background image blob');
                }
                if (this.verbose) {
                    console.log('Background image blob fetched successfully');
                }
                // fetch the image height
                backgroundImageHeight = await this.getImageHeight(backgroundImageBlob);
                if (!backgroundImageHeight) {
                    throw new Error('Failed to fetch background image height');
                }
                if (this.verbose) {
                    console.log('Background image height fetched successfully');
                }
                this.backgroundImages.push({
                    url: backgroundImageUrl,
                    blob: backgroundImageBlob,
                    objectUrl: URL.createObjectURL(backgroundImageBlob),
                    height: backgroundImageHeight
                });
                if (this.verbose) {
                    console.log(`Image blob and height of backgroundImg[{this.backgroundImages.length-1}] fetched successfully`);
                }
            }
            catch (error) {
                console.error(`Error fetching backgroundImageUrl: ${backgroundImageUrl} : `, error);
                throw error;
            }
    
        } // all this.backgroundImages loaded and initialized

        // The first call to create and set up this.backgroundVtDivs using this.backgroundImages
        this.initializeBackgroundVtDivs();

        // The first call to create and set up this.backgroundHtmlDivs using this.backgroundVtDivs
        this.initializeBackgroundHtmlDivs();

        // create the new wrapperDiv which will be 
        // the parent of the htmlContentDiv
        this.wrapperDiv = document.createElement('div');
        this.wrapperDiv.id = 'wrapper-div';
        this.wrapperDiv.addEventListener('wheel', (event) => this.handle_wrapper_scroll_event(event), { passive: false });

        // create the new htmlContentDiv holding the htmlContent
        // this will be affected by the wrapperDiv's scroll event
        // this will be affected by the window's resize event
        this.htmlContentDiv = document.createElement('div')
        this.htmlContentDiv.id = 'html-content-div';

        let sanitizedHtmlContent = this.sanitizeHtmlContent(this.htmlContent);
        if ( sanitizedHtmlContent.length === 0 ) {
            throw new Error('Failed to sanitize HTML content');
        }
        this.htmlContentDiv.innerHTML = sanitizedHtmlContent
// deepcode ignore DOMXSS: because it's been sanitized using DOMPurify

        this.wrapperDiv.appendChild(this.htmlContentDiv);

        document.body.appendChild(this.wrapperDiv);

        window.addEventListener('resize', (event) => this.handle_window_resize_event(event));

    
    } // end of initialize

    getCurrentBounderies() {
        if ( this.htmlContentDiv === null ) {
            throw new Error('this.htmlContentDiv is null');
        }
        // this function is called when the window is resized
        // it updates the boundaries used by the htmlContentDiv
        const contentHeight = this.htmlContentDiv.getBoundingClientRect().height;
        // allow scrolling above the top edge and the bottom edge of the window by newHeight
        const newHeight = (contentHeight + this.padding) * 2;
        return {
            minScroll: -newHeight, 
            maxScroll: newHeight
        };
    }

    handle_window_resize_event(event) {
        let currentTranslateY = 0;
        let lastTranslateY = 0;
        const boundaries = this.getCurrentBounderies();
        currentTranslateY = Math.min(boundaries.maxScroll,
            this.htmlContentDiv.style.transform = `translateY(${currentTranslateY}px)`);
        if (currentTranslateY !== lastTranslateY) {
            htmlContentDiv.style.transform = `translateY(${currentTranslateY}px)`;
            lastTranslateY = currentTranslateY;
        }
        this.initializeBackgroundVtDivs();
        this.initializeBackgroundHtmlDivs();
    }

    handle_wrapper_scroll_event(event) {
        event.preventDefault();

        let currentTranslateY = 0;
        let lastTranslateY = 0;

        const contentDelta = event.deltaY * this.contentScrollFactor;

        // get the contentDelta for the backgroundVtDivs
        const backgroundDelta = event.deltaY * this.backgroundScrollFactor;

        // translate the backgroundHtmlDivs
        this.transformVtDivs(backgroundDelta);

        // then update this.backgroundHtmlDivs
        this.transformHtmlDivs();

        // translate the htmlContentDiv
        let newTranslateY = currentTranslateY - contentDelta;
        
        if (this.verbose) {
            console.log("newTranslateY:", newTranslateY);
            console.log('Scroll Event:', {
                deltaY: event.deltaY,
                currentTranslateY,
                newTranslateY,
                lastTranslateY,
                boundaries,
                viewportHeight: window.innerHeight,
                contentHeight: htmlContentDiv.getBoundingClientRect().height
            });
        }

        // clamp the newTranslateY to the boundaries (not sure if this is neede)
        const boundaries = this.getCurrentBounderies();
        newTranslateY = Math.min(boundaries.maxScroll, Math.max(boundaries.minScroll, newTranslateY));
        
        if (newTranslateY !== lastTranslateY) {
            const contentRect = this. htmlContentDiv.getBoundingClientRect();
            
            if (contentRect.bottom < -this.padding || contentRect.top < -contentRect.height - this.padding) {
                // compute the new translation after going over the top edge of the window
                newTranslateY = window.innerHeight + this.padding;
            } else if (contentRect.top > window.innerHeight + this.padding) {
                // compute the new tranlation after going over the bottom edge of the window
                newTranslateY = -contentRect.height - this.padding;
            }
            // Temporarily remove the htmlContentDiv from the DOM
            this.wrapperDiv.removeChild(this.htmlContentDiv);

            // Apply the new translation
            this.htmlContentDiv.style.transition = 'transform 0.3s ease-out';
            this.htmlContentDiv.style.transition = 'none';
            this.htmlContentDiv.style.transform = `translateY(${newTranslateY}px)`;

            // Re-append the htmlContentDiv to the DOM
            this.wrapperDiv.appendChild(this.htmlContentDiv); 

            // update the state of the scrolling
            currentTranslateY = newTranslateY;
            lastTranslateY = newTranslateY;

        } // end of if (newTranslateY !== lastTranslateY)
    } // end of handle_wrapper_scroll_event

    async getImageHeight(imageBlob) {
        // this function returns the height of the image 
        // given the imageBlob after it has been loaded
        return new Promise((resolve, reject) => {
            // create a temp_image to get the height
            const temp_image = new Image();
            // define the onload handler
            temp_image.onload = () => {
                resolve(temp_image.height);
            };
            // defin the on error handler
            temp_image.onerror = reject;

            // this will be called after the onload
            temp_image.src = URL.createObjectURL(imageBlob);
        });
    } // end of getImageHeight

    sanitizeHtmlContent(htmlContent) { 
        // this function sanitizes the given htmlContent using DOMPurify
        // and returns the sanitized HTML content
        try {
            const sanitizedContent = DOMPurify.sanitize(htmlContent);
            return sanitizedContent;
        } catch (error) {
            console.error('Error sanitizing HTML content:', error);
            return '';
        }
    }

} // end of ScrollingContentDiv class