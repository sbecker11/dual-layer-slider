import { ScrollingContentDiv } from './scrolling-content-div.mjs';

export const bgImgPath = './backgrounds/sequoia-sunrise.png';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const htmlPath = './content/content.html';
        // const bgImgPath = './backgrounds/milky-way-blue-seamless-bordered.jpg';
        const contentDiv = await ScrollingContentDiv.create(htmlPath, bgImgPath );
        // The content div is now automatically appended to document.body
    } catch (error) {
        console.error('Failed to initialize ScrollingContentDiv:', error);
    }
});