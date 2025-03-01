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
        this.backgroundImgs = [];
        this.backgroundVtDivs = []; // Array to hold multiple background vtDivs
        this.backgroundHtmlDivs = []; // Array to hold multiple background htmlDivs
        this.verbose = true; // Initialize verbose flag
        this.backgroundScrollFactor = 0.1;
        this.padding = 50;
        this.scrollSpeed = 2.0;

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
                index: vtDivIndex,
                imageIndex: imageIndex,
                imageHeight: imageHeight,
                imgUrl: this.backgroundImageUrls[imageIndex].url,
                top: top,
                btm: top + imageHeight,
                visible: true // will be set to false when the vtDiv is not visible
            });
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
        // This function uses the transformed vtDivs to update the
        // htmlDivs. It also hides the jump of any htmlDivs as they 
        // wrap around the top and bottom edges of the browser 
        // window. Thi is done by temporarily removing from htmlDiv, 
        // applying the new position, and then adding it back to DOM.
        for ( let htmlDiv of this.backgroundHtmlDivs) {
            let vtDiv = this.backgroundVtDivs[htmlDiv.index];

            if ( !vtDiv.visible ) {
                // if marked invisible, prepare to hide the 
                // jump by removing the htmlDiv from the DOM
                document.body.removeChild(htmlDiv);
            }

            // update the htmlDiv's position whether it's visible or not
            htmlDiv.style.top = `${vtDiv.top}px`;
            htmlDiv.style.bottom = `${vtDiv.btm}px`;

            if ( !vtDiv.visible ) {
                // if it was invisible then add the repositioned 
                // htmlDiv back to the DOM
                document.body.appendChild(htmlDiv);
                // mark the vtDiv as visible for the next scroll.
                vtDiv.visible = true;
            }
        }
    }

    initializeBackgroundHtmlDivs() {

        // create the actual background HTML divs using this.backgroundVtDivs
        let backgroundHtmlDivs = [];

        for ( let backgroundVtDiv of this.backgroundVtDivs) {
            let imageIndex = backgroundVtDiv.imageIndex;
            let backgroundImageObjectUrl = this.backgroundImgs[imageIndex].objectUrl;
            let imgHeight = backgroundVtDiv.imageHeight;

            const backgroundHtmlDiv = document.createElement('div');
            backgroundHtmlDiv.id = backgroundVtDiv.index;
            backgroundHtmlDiv.style.position = 'absolute';
            backgroundHtmlDiv.style.top = `${backgroundVtDiv.top}px`;
            backgroundHtmlDiv.style.bottom = `${backgroundVtDiv.btm}px`;
            backgroundHtmlDiv.style.left = '0';
            backgroundHtmlDiv.style.width = '100%';
            backgroundHtmlDiv.style.height = `${backgroundVtDiv.imageHeight}px`;

            backgroundHtmlDiv.style.backgroundImage = `url(${backgroundVtDiv.imageUrl})`;
            backgroundHtmlDiv.style.backgroundRepeat = 'repeat';
            backgroundHtmlDiv.style.backgroundSize = 'auto';
            backgroundHtmlDiv.style.backgroundPosition = '0 0';
            backgroundHtmlDiv.style.backgroundColor = 'transparent';
            backgroundHtmlDiv.style.zIndex = '-1';
            backgroundHtmlDiv.style.pointerEvents = 'none';

            document.body.appendChild(backgroundHtmlDiv);

            backgroundHtmlDivs.push(backgroundHtmlDiv);
        }

        this.backgroundHtmlDivs = backgroundHtmlDivs;
    }


    async initialize() {

        window.addEventListener('resize', (event) => handle_window_resize_event(event));

        // load and sanitize the HTML content from this.htmlContentUrl
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
        if (this.verbose) {
            console.log('HTML content fetched successfully');
        }
        this.sanitizedHtmlContent = this.getSanitizedHtml(htmlContent);
        if (this.verbose) {
            console.log('HTML content sanitized successfully');
        }

        // load all background images from this.imageFileUrls
        this.backgroundImgs = []
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
                // create an object URL for the image
                let backgroundObjectUrl = URL.createObjectURL(backgroundImageBlob);
                this.backgroundImgs.push({
                    url: backgroundImageUrl,
                    blob: backgroundImageBlob,
                    objectUrl: backgroundObjectUrl,
                    height: backgroundImageHeight
                });
                if (this.verbose) {
                    console.log(`Image blob and height of backgroundImg[{this.backgroundImgs.length-1}] fetched successfully`);
                }
            }
            catch (error) {
                console.error('Error fetching background image:', error);
                throw error;
            }
        
            this.backgroundImgs.push({
                url: backgroundImageUrl,
                blob: backgroundImageBlob,
                objectUrl: backgroundObjectUrl,
                height: backgroundImageHeight
            });
            if (this.verbose) {
                console.log(`Image blob and height of backgroundImg[{this.backgroundImgs.length-1}] fetched successfully`);
            }
        } // all this.backgroundImgs loaded and initialized

        // Create and set up this.backgroundVtDivs using this.backgroundImgs
        this.initializeBackgroundVtDivs();

        // create and set up this.backgroundHtmlDivs using this.backgroundVtDivs
        this.initializeBackgroundHtmlDivs();

        // create the wrapperDiv which will be 
        // the parent of the htmlContentDiv
        let wrapperDiv = document.getElementById("wrapper-div");
        if ( !wrapperDiv ) {
            wrapperDiv = document.createElement('div');
            wrapperDiv.id = 'wrapper-div';
            document.body.appendChild(wrapperDiv);

            wrapperDiv.addEventListener('wheel', (event) => handle_wrapper_scroll_event(event), { passive: false });
        }

        // create the htmlContentDiv which will be
        // the parent of the htmlContent
        let htmlContentDiv = document.getElementById("html-content-div");
        if ( !htmlContentDiv ) {
            htmlContentDiv =  document.createElement('div');
            htmlContentDiv.id = 'html-content-div';
            wrapperDiv.appendChild(htmlContentDiv);
        }
        htmlContentDiv.innerHTML = this.sanitizedHtmlContent;
        this.htmlContentDiv = htmlContentDiv;

        document.body.appendChild(wrapperDiv);
        wrapperDiv.appendChild(htmlContentDiv);
    
}

    updateBoundaries() {
        const contentHeight = htmlContentDiv.getBoundingClientRect().height;
        return {
            minScroll: -(contentHeight * 2) - this.padding, // Allow scrolling beyond the content height with this.padding
            maxScroll: contentHeight * 2 + this.padding // Allow scrolling beyond the content height with this.padding
        };
    }

    handle_window_resize_event(event) {
        const boundaries = this.updateBoundaries();
        currentTranslateY = Math.min(boundaries.maxScroll,
            Math.max(boundaries.minScroll, currentTranslateY));
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
        let cumulativeDeltaY = 0; // Variable to track the cumulative delta scrolls for the background image

        const boundaries = this.updateBoundaries();
        const delta = event.deltaY * this.scrollSpeed;

        // translate the backgroundHtmlDivs
        const backgroundDelta = delta * this.backgroundScrollFactor;
        this.transformVtDivs(backgroundDelta);

        // to update this.backgroundHtmlDivs
        this.transformHtmlDivs();

        // translate the htmlContentDiv
        let newTranslateY = currentTranslateY - delta;
        
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

        newTranslateY = Math.min(boundaries.maxScroll, Math.max(boundaries.minScroll, newTranslateY));
        
        if (newTranslateY !== lastTranslateY) {
            const contentRect = htmlContentDiv.getBoundingClientRect();
            
            if (contentRect.bottom < -this.padding || contentRect.top < -contentRect.height - this.padding) {
                this.wrapperDiv.removeChild(htmlContentDiv); // Temporarily remove the htmlContentDiv from the DOM
                newTranslateY = window.innerHeight + this.padding;
            } else if (contentRect.top > window.innerHeight + this.padding) {
                wrapperDiv.removeChild(htmlContentDiv); // Temporarily remove the htmlContentDiv from the DOM
                newTranslateY = -contentRect.height - this.padding;
            }

            this.htmlContentDiv.style.transform = `translateY(${newTranslateY}px)`;
            currentTranslateY = newTranslateY;
            lastTranslateY = newTranslateY;
            wrapperDiv.appendChild(htmlContentDiv); // Re-append the htmlContentDiv to the DOM
        }
    }

    async getImageHeight(imageBlob) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                resolve(img.height);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(imageBlob);
        });
    }
}