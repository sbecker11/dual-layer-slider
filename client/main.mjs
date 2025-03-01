import { ScrollingContentDiv } from './scrolling-content-div.mjs';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const htmlContentUrl = 'http://localhost:3000/content/content.html';
        const backgroundImageUrls = [
            'http://localhost:3000/backgrounds/sequoia-sunrise-470.png',
            'http://localhost:3000/backgrounds/milky-way-blue-470.jpeg'
        ];
        const contentDiv = await ScrollingContentDiv.create( htmlContentUrl, backgroundImageUrls );
    } catch (error) {
        console.error('Failed to initialize ScrollingContentDiv:', error);
    }
});