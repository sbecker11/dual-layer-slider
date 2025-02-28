import { bgImgPath } from './main.mjs';

export class ScrollingContentDiv {
    static async create(htmlFilePath, backgroundImgPath) {
        const instance = new ScrollingContentDiv(htmlFilePath, backgroundImgPath );
        return await instance.initialize();
    }

    constructor(htmlFilePath, imageFilePath) {
        if (!htmlFilePath) {
            throw new Error('HTML file path is required');
        }
        if (!imageFilePath) {
            throw new Error('Background IMG path is required');
        }
        this.htmlFilePath = htmlFilePath;
        this.imageFilePath = imageFilePath;
        this.contentDiv = null;
        this.backgroundDiv = null;
        this.verbose = false; // Initialize verbose flag
    }

    async initialize() {
        try {
            if ( this.verbose ) {
                console.log('Attempting to fetch html from:', this.htmlFilePath);
            }
            const contentResonse = await fetch(this.htmlFilePath);
            if (!contentResonse.ok) {
                throw new Error(`Failed to fetch HTML file: ${contentResonse.statusText}`);
            }
            const htmlContent = await contentResonse.text();

            // Fetch image content (you'll need to specify the correct image path)

            this.imageFilePath = bgImgPath;
            // this.imageFilePath = '/backgrounds/milky-way-blue-seamless-bordered.jpg';
            // Use the working URL path for image
            if ( this.verbose ) {
                console.log('Attempting to fetch image from:', this.imageFilePath);
            }
            const imageResponse = await fetch(this.imageFilePath);
            if (!imageResponse.ok) {
                throw new Error(`Failed to fetch IMG file: ${imageResponse.statusText}`);
            }
            const backgroundImg = await imageResponse.blob();
            const backgroundDiv = document.createElement('div');
            backgroundDiv.id = 'background-div';
            backgroundDiv.style.position = 'fixed';
            backgroundDiv.style.top = '0';
            backgroundDiv.style.left = '0';
            backgroundDiv.style.right = '0';
            backgroundDiv.style.bottom = '0';
            backgroundDiv.style.overflow = 'hidden';
            backgroundDiv.style.zIndex = '-1';

            const objectURL = URL.createObjectURL(backgroundImg);
            backgroundDiv.style.backgroundImage = `url(${objectURL})`;
            backgroundDiv.style.backgroundRepeat = 'repeat';
            backgroundDiv.style.backgroundSize = 'auto';
            backgroundDiv.style.backgroundPosition = `0 0 px`;

            document.body.append(backgroundDiv);
            this.backgroundDiv = backgroundDiv;

            // Clean up the object URL
            // URL.revokeObjectURL(objectURL);

            const wrapperDiv = document.createElement('div');
            wrapperDiv.style.position = 'fixed';
            wrapperDiv.style.top = '0';
            wrapperDiv.style.left = '0';
            wrapperDiv.style.right = '0';
            wrapperDiv.style.bottom = '0';
            wrapperDiv.style.overflow = 'hidden';
            wrapperDiv.style.backgroundColor = 'transparent';

            const contentDiv = document.createElement('div');
            contentDiv.id = 'content-div';
            contentDiv.innerHTML = htmlContent;

            if (this.verbose) {
                console.log('Gap divs found:', contentDiv.querySelectorAll('.gap').length);
            }

            document.body.style.margin = '0';
            document.body.style.padding = '0';
            document.body.style.overflow = 'hidden';
            document.body.style.height = '100vh';
            document.body.style.width = '100vw';
            document.body.style.backgroundColor = 'transparent';

            contentDiv.style.position = 'absolute';
            contentDiv.style.top = '0';
            contentDiv.style.left = '0';
            contentDiv.style.width = '100%';
            contentDiv.style.minHeight = '200vh';
            contentDiv.style.margin = '0px';
            contentDiv.style.padding = '0px';
            contentDiv.style.boxSizing = 'border-box';
            contentDiv.style.transition = 'transform 0.2s cubic-bezier(0.33, 1, 0.68, 1)';
            contentDiv.style.backgroundColor = 'transparent';

            document.body.appendChild(wrapperDiv);
            wrapperDiv.appendChild(contentDiv);
            this.contentDiv = contentDiv;

            let currentTranslateY = 0;
            let lastTranslateY = 0;
            const scrollSpeed = 2.0;
            let cumulativeDeltaY = 0; // Variable to track the cumulative delta scrolls for the background image

            const PADDING = 50; // Global constant for padding

            const updateBoundaries = () => {
                const viewportHeight = window.innerHeight;
                const contentHeight = contentDiv.getBoundingClientRect().height;
                return {
                    minScroll: -(contentHeight * 2) - PADDING, // Allow scrolling beyond the content height with padding
                    maxScroll: contentHeight * 2 + PADDING // Allow scrolling beyond the content height with padding
                };
            };

            wrapperDiv.addEventListener('wheel', (event) => {
                event.preventDefault();
                
                const boundaries = updateBoundaries();
                const delta = event.deltaY * scrollSpeed;
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
                        contentHeight: contentDiv.getBoundingClientRect().height
                    });
                }

                newTranslateY = Math.min(boundaries.maxScroll, Math.max(boundaries.minScroll, newTranslateY));
                
                if (newTranslateY !== lastTranslateY) {
                    const contentRect = contentDiv.getBoundingClientRect();
                    
                    if (contentRect.bottom < -PADDING || contentRect.top < -contentRect.height - PADDING) {
                        wrapperDiv.removeChild(contentDiv); // Temporarily remove the contentDiv from the DOM
                        newTranslateY = window.innerHeight + PADDING;
                    } else if (contentRect.top > window.innerHeight + PADDING) {
                        wrapperDiv.removeChild(contentDiv); // Temporarily remove the contentDiv from the DOM
                        newTranslateY = -contentRect.height - PADDING;
                    }

                    contentDiv.style.transform = `translateY(${newTranslateY}px)`;
                    currentTranslateY = newTranslateY;
                    lastTranslateY = newTranslateY;
                    wrapperDiv.appendChild(contentDiv); // Re-append the contentDiv to the DOM
                }

                // Update the background image's position based on the cumulative delta scrolls
                cumulativeDeltaY -= delta;
                this.backgroundDiv.style.backgroundPosition = `0 ${cumulativeDeltaY * 0.1}px`;
                if ( this.verbose ) {
                    console.log(`BackgroundDiv style.backgroundPosition set to: 0 ${cumulativeDeltaY * 0.1}px`);
                }
            }, { passive: false });

            window.addEventListener('resize', () => {
                const boundaries = updateBoundaries();
                currentTranslateY = Math.min(boundaries.maxScroll, 
                    Math.max(boundaries.minScroll, currentTranslateY));
                
                if (currentTranslateY !== lastTranslateY) {
                    contentDiv.style.transform = `translateY(${currentTranslateY}px)`;
                    lastTranslateY = currentTranslateY;
                }
            });

            return contentDiv;
        } catch (error) {
            throw new Error(`Failed to create ScrollingContentDiv: ${error.message}`);
        }
    }
}