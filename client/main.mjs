import { ScrollingContentDiv } from './scrolling-content-div.mjs';

// Track page load time to prevent premature closing
window.pageLoadTime = Date.now();

document.addEventListener('DOMContentLoaded', async () => {
    try {
        console.log('DOMContentLoaded fired');
        
        // Single Window Enforcement: Ensure only one window stays open
        // Use BroadcastChannel + localStorage to coordinate and close duplicates
        const channelName = 'dual-layer-slider-windows';
        const channel = new BroadcastChannel(channelName);
        const PRIMARY_WINDOW_KEY = 'dual-layer-slider-primary-window';
        const WINDOW_ID_KEY = 'dual-layer-slider-window-id';
        
        // Generate a unique ID for this window
        let windowId = sessionStorage.getItem(WINDOW_ID_KEY);
        if (!windowId) {
            windowId = `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem(WINDOW_ID_KEY, windowId);
        }
        
        // Check if there's already a primary window
        const primaryWindowId = localStorage.getItem(PRIMARY_WINDOW_KEY);
        let isPrimaryWindow = false;
        let isSingleWindow = false;
        
        // Check if there's a stale primary window (older than 10 seconds)
        // Reduced from 30 seconds to be more aggressive about claiming primary
        let shouldClaimPrimary = false;
        if (primaryWindowId) {
            // Check if the primary window ID is stale (from a previous session)
            // If it's been more than 10 seconds, assume the previous window is gone
            const primaryWindowAge = localStorage.getItem(`${PRIMARY_WINDOW_KEY}_timestamp`);
            if (primaryWindowAge) {
                const age = Date.now() - parseInt(primaryWindowAge, 10);
                if (age > 5000) { // 5 seconds - if older than 5 seconds, assume stale
                    console.log(`[Window Control] Primary window is stale (${Math.floor(age/1000)}s old), claiming primary status`);
                    shouldClaimPrimary = true;
                } else if (primaryWindowId === windowId) {
                    // This window is already the primary
                    isPrimaryWindow = true;
                    isSingleWindow = true;
                    // Update timestamp to show we're still alive
                    localStorage.setItem(`${PRIMARY_WINDOW_KEY}_timestamp`, Date.now().toString());
                    console.log('[Window Control] This window is the PRIMARY window (restored)');
                } else {
                    // Another window is recently primary (less than 5 seconds old) - check if it's actually still alive
                    // Use BroadcastChannel to ping the other window
                    console.log(`[Window Control] Another window claims primary (${primaryWindowId}), checking if it's still alive...`);
                    
                    // Send a ping to check if the other window responds
                    let pingResponded = false;
                    let shouldCloseAsDuplicate = false;
                    
                    const pingListener = (event) => {
                        if (event.data.type === 'ping-response' && event.data.windowId === primaryWindowId) {
                            pingResponded = true;
                            clearTimeout(pingTimeout);
                            channel.removeEventListener('message', pingListener);
                            // Other window is alive - this is a duplicate
                            console.log(`[Window Control] Duplicate window detected. Primary window: ${primaryWindowId} is still alive. Closing this window...`);
                            shouldCloseAsDuplicate = true;
                            setTimeout(() => {
                                window.close();
                                if (!window.closed) {
                                    window.location.href = 'about:blank';
                                }
                            }, 1000);
                        }
                    };
                    channel.addEventListener('message', pingListener);
                    
                    const pingTimeout = setTimeout(() => {
                        channel.removeEventListener('message', pingListener);
                        if (!pingResponded && !shouldCloseAsDuplicate) {
                            // Other window didn't respond - it's probably dead, claim primary
                            console.log('[Window Control] Other primary window did not respond - claiming primary status');
                            shouldClaimPrimary = true;
                        }
                    }, 2000); // Wait 2 seconds for response
                    
                    // Send ping
                    channel.postMessage({ type: 'ping', windowId: windowId, timestamp: Date.now() });
                    
                    // Wait a bit to see if we get a response before continuing
                    // If we should close as duplicate, the listener will handle it
                    // Otherwise, continue initialization and the timeout will set shouldClaimPrimary if needed
                }
            } else {
                // No timestamp - assume stale, claim primary
                console.log('[Window Control] Primary window has no timestamp - assuming stale, claiming primary');
                shouldClaimPrimary = true;
            }
        } else {
            // No primary window - claim it
            shouldClaimPrimary = true;
        }
        
        if (shouldClaimPrimary) {
            localStorage.setItem(PRIMARY_WINDOW_KEY, windowId);
            localStorage.setItem(`${PRIMARY_WINDOW_KEY}_timestamp`, Date.now().toString());
            isPrimaryWindow = true;
            isSingleWindow = true;
            console.log('[Window Control] This window is the PRIMARY window');
        }
        
        // Announce this window's existence (only if primary)
        if (isPrimaryWindow) {
            channel.postMessage({ type: 'primary-window-opened', windowId: windowId, timestamp: Date.now() });
        }
        
        // Listen for other windows trying to claim primary status
        channel.onmessage = (event) => {
            if (event.data.type === 'primary-window-opened') {
                const otherWindowId = event.data.windowId;
                if (otherWindowId !== windowId) {
                    // Another window is claiming primary - check if we're still primary
                    const currentPrimary = localStorage.getItem(PRIMARY_WINDOW_KEY);
                    if (currentPrimary !== windowId) {
                        console.log('[Window Control] Another window claimed primary. Closing this window...');
                        setTimeout(() => {
                            window.close();
                            if (!window.closed) {
                                window.location.href = 'about:blank';
                            }
                        }, 500);
                    }
                }
            } else if (event.data.type === 'window-closed') {
                // Another window closed - check if we're now the only one
                const currentPrimary = localStorage.getItem(PRIMARY_WINDOW_KEY);
                if (currentPrimary === windowId) {
                    isSingleWindow = true;
                    console.log('[Window Control] Only single window remaining - ensuring images load');
                    if (typeof forceImageReload === 'function') {
                        forceImageReload();
                    }
                }
            }
        };
        
        // Clean up on window close - release primary status if this was the primary window
        window.addEventListener('beforeunload', () => {
            const currentPrimary = localStorage.getItem(PRIMARY_WINDOW_KEY);
            if (currentPrimary === windowId) {
                // Clear primary window marker so a new window can claim it
                localStorage.removeItem(PRIMARY_WINDOW_KEY);
                channel.postMessage({ type: 'window-closed', windowId: windowId });
            }
            channel.close();
        });
        
        // Periodic check: if primary window marker is cleared, this window can claim it
        setInterval(() => {
            const currentPrimary = localStorage.getItem(PRIMARY_WINDOW_KEY);
            if (!currentPrimary && isPrimaryWindow) {
                // Reclaim primary status
                localStorage.setItem(PRIMARY_WINDOW_KEY, windowId);
            } else if (currentPrimary && currentPrimary !== windowId && isPrimaryWindow) {
                // Another window claimed primary - close this one
                console.log('[Window Control] Primary status lost. Closing window...');
                window.close();
            }
        }, 2000);
        
        // Use the current port from window.location
        const port = window.location.port || '3000';
        const baseUrl = `http://localhost:${port}`;
        
        console.log('Base URL:', baseUrl);
        const htmlContentUrl = `${baseUrl}/content/campaign_squares.html`;
        const backgroundImageUrls = [
            `${baseUrl}/backgrounds/sequoia-sunrise-470.png`,
            `${baseUrl}/backgrounds/milky-way-blue-470.jpeg`
        ];
        
        console.log('Loading content from:', htmlContentUrl);
        
        // Keep backgrounds transparent to show parallax background layer
        // Inject a style element into the head with highest priority
        const overrideStyle = document.createElement('style');
        overrideStyle.textContent = ':root { --bg-color: transparent !important; } html, body { background-color: transparent !important; }';
        document.head.appendChild(overrideStyle);
        
        // Also set inline styles as backup
        document.documentElement.style.setProperty('--bg-color', 'transparent');
        document.body.style.backgroundColor = 'transparent';
        document.documentElement.style.backgroundColor = 'transparent';
        
        // Always pass isSingleWindow=true for primary window to ensure aggressive image loading
        const contentDiv = await ScrollingContentDiv.create( htmlContentUrl, backgroundImageUrls, isPrimaryWindow );
        console.log('ScrollingContentDiv created successfully');
        
        // Monitor server health and close browser when server quits
        if (isPrimaryWindow) {
            let healthCheckInterval = null;
            let consecutiveFailures = 0;
            const MAX_FAILURES = 3; // Close after 3 consecutive failures
            const HEALTH_CHECK_INTERVAL = 2000; // Check every 2 seconds
            
            const checkServerHealth = async () => {
                try {
                    const healthUrl = `${baseUrl}/health`;
                    // Create AbortController for timeout (more compatible than AbortSignal.timeout)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1 second timeout
                    
                    const response = await fetch(healthUrl, { 
                        method: 'GET',
                        cache: 'no-cache',
                        signal: controller.signal
                    });
                    
                    clearTimeout(timeoutId);
                    
                    if (response.ok) {
                        consecutiveFailures = 0; // Reset failure count on success
                        const data = await response.json();
                        if (data.port && data.port.toString() !== port) {
                            console.warn(`[Health Check] Server port changed from ${port} to ${data.port}`);
                            // Navigate to the new port
                            const newUrl = `http://localhost:${data.port}`;
                            console.log(`[Health Check] Navigating browser to new port: ${newUrl}`);
                            window.location.href = newUrl;
                            return; // Don't continue with this check
                        }
                    } else {
                        consecutiveFailures++;
                        console.warn(`[Health Check] Server health check failed (${consecutiveFailures}/${MAX_FAILURES})`);
                    }
                } catch (error) {
                    consecutiveFailures++;
                    console.warn(`[Health Check] Server unreachable (${consecutiveFailures}/${MAX_FAILURES}):`, error.message);
                    
                    // Only close if we've had multiple failures AND enough time has passed since page load
                    // This prevents closing during initial page load when server might be slow
                    const timeSinceLoad = Date.now() - (window.pageLoadTime || Date.now());
                    const minTimeBeforeClose = 10000; // 10 seconds minimum before we can close
                    
                    if (consecutiveFailures >= MAX_FAILURES && timeSinceLoad > minTimeBeforeClose) {
                        console.log('[Health Check] Server appears to have stopped. Closing browser window...');
                        clearInterval(healthCheckInterval);
                        healthCheckInterval = null;
                        
                        // Try to close the window
                        window.close();
                        
                        // If window.close() doesn't work, show a message and redirect
                        setTimeout(() => {
                            if (!window.closed) {
                                document.body.innerHTML = `
                                    <div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-family: monospace; text-align: center; padding: 20px;">
                                        <div>
                                            <h1>Server Disconnected</h1>
                                            <p>The development server has stopped.</p>
                                            <p>This window will close automatically.</p>
                                        </div>
                                    </div>
                                `;
                                // Try closing again after showing message
                                setTimeout(() => {
                                    window.close();
                                    if (!window.closed) {
                                        window.location.href = 'about:blank';
                                    }
                                }, 2000);
                            }
                        }, 100);
                    }
                }
            };
            
            // Start health checking after a longer delay to ensure server is ready
            // Don't start checking immediately - give server time to fully start
            // Also, don't close on initial failures - server might still be starting
            let initialChecksDone = 0;
            const INITIAL_GRACE_PERIOD = 3; // Allow 3 initial failures before closing
            
            setTimeout(() => {
                // Do an initial check before starting interval
                checkServerHealth().then(() => {
                    healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);
                    console.log('[Health Check] Started monitoring server health');
                }).catch(() => {
                    initialChecksDone++;
                    if (initialChecksDone < INITIAL_GRACE_PERIOD) {
                        // If initial check fails, wait a bit more and try again
                        console.log(`[Health Check] Initial check failed (${initialChecksDone}/${INITIAL_GRACE_PERIOD}), retrying in 2 seconds...`);
                        setTimeout(() => {
                            checkServerHealth().then(() => {
                                healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);
                                console.log('[Health Check] Started monitoring server health (after retry)');
                            }).catch(() => {
                                initialChecksDone++;
                                if (initialChecksDone < INITIAL_GRACE_PERIOD) {
                                    // Try one more time
                                    setTimeout(() => {
                                        checkServerHealth().then(() => {
                                            healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);
                                            console.log('[Health Check] Started monitoring server health (after second retry)');
                                        }).catch((err) => {
                                            console.error('[Health Check] Failed after multiple retries, but not closing window yet');
                                            // Start monitoring anyway - server might be slow to start
                                            healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);
                                            console.log('[Health Check] Started monitoring (will close only after 3 consecutive failures)');
                                        });
                                    }, 2000);
                                } else {
                                    // Start monitoring anyway - don't close on startup failures
                                    healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);
                                    console.log('[Health Check] Started monitoring (grace period exhausted, but not closing)');
                                }
                            });
                        }, 2000);
                    } else {
                        // Start monitoring anyway - don't close on startup failures
                        healthCheckInterval = setInterval(checkServerHealth, HEALTH_CHECK_INTERVAL);
                        console.log('[Health Check] Started monitoring (grace period exhausted, but not closing)');
                    }
                });
            }, 5000); // Wait 5 seconds before starting checks (increased from 3)
            
            // Clean up interval on page unload
            window.addEventListener('beforeunload', () => {
                if (healthCheckInterval) {
                    clearInterval(healthCheckInterval);
                    healthCheckInterval = null;
                }
            });
        }
        
        // Additional image loading check for primary window
        if (isPrimaryWindow) {
            setTimeout(() => {
                const htmlContentDiv = document.getElementById('html-content-div');
                if (htmlContentDiv) {
                    const images = htmlContentDiv.querySelectorAll('img');
                    console.log(`[Primary Window] Checking ${images.length} images after initialization...`);
                    let notLoadedCount = 0;
                    images.forEach((img, idx) => {
                        if (!img.complete || img.naturalWidth === 0) {
                            notLoadedCount++;
                            console.warn(`[Primary Window] Image ${idx} not loaded: ${img.src.substring(0, 60)}...`);
                            // Force reload
                            const originalSrc = img.src;
                            img.src = '';
                            setTimeout(() => {
                                img.src = originalSrc;
                            }, idx * 50);
                        }
                    });
                    if (notLoadedCount > 0) {
                        console.warn(`[Primary Window] ${notLoadedCount} images need to be reloaded`);
                    } else {
                        console.log(`[Primary Window] All ${images.length} images loaded successfully`);
                    }
                }
            }, 2000);
        }
        
        // Function to force image reload (called when single window detected)
        function forceImageReload() {
            const htmlContentDiv = document.getElementById('html-content-div');
            if (!htmlContentDiv) return;
            
            const images = htmlContentDiv.querySelectorAll('img');
            console.log(`[Single Window] Forcing reload of ${images.length} images`);
            images.forEach((img, idx) => {
                if (img.src) {
                    const originalSrc = img.src;
                    img.src = '';
                    setTimeout(() => {
                        img.src = originalSrc;
                        console.log(`[Single Window] Reloaded image ${idx}`);
                    }, idx * 10); // Stagger reloads slightly
                }
            });
        }
        
        // Store function globally for use by window detection
        window.forceImageReload = forceImageReload;
        
        // Inject campaign slideshow JavaScript after content loads
        // Scripts in innerHTML don't execute, so we run them here
        // Use string concatenation to avoid template literal issues in heredoc
        setTimeout(() => {
            const script = document.createElement('script');
            const scriptCode = [
                '// Campaign slideshow functionality',
                'const marks = {',
                '    keeps: new Set(),',
                '    deletes: new Set()',
                '};',
                '',
                'let totalImages = 0;',
                '',
                'function updateTotalImages() {',
                '    const htmlContentDiv = document.getElementById("html-content-div");',
                '    if (htmlContentDiv) {',
                '        totalImages = htmlContentDiv.querySelectorAll(".image-card").length;',
                '    }',
                '}',
                '',
                '// Load saved state',
                'function loadState() {',
                '    try {',
                '        const saved = localStorage.getItem("campaignSlideshowState");',
                '        if (saved) {',
                '            const state = JSON.parse(saved);',
                '            marks.keeps = new Set(state.keeps || []);',
                '            marks.deletes = new Set(state.deletes || []);',
                '            ',
                '            // Restore visual state',
                '            const htmlContentDiv = document.getElementById("html-content-div");',
                '            if (htmlContentDiv) {',
                '                state.keeps.forEach(path => {',
                '                    const card = htmlContentDiv.querySelector("[data-path=\\"" + path + "\\"] .image-card");',
                '                    if (card) {',
                '                        card.classList.add("marked-keep");',
                '                        const keepBtn = card.querySelector(".btn-keep");',
                '                        if (keepBtn) keepBtn.classList.add("active");',
                '                    }',
                '                });',
                '                ',
                '                state.deletes.forEach(path => {',
                '                    const card = htmlContentDiv.querySelector("[data-path=\\"" + path + "\\"] .image-card");',
                '                    if (card) {',
                '                        card.classList.add("marked-delete");',
                '                        const deleteBtn = card.querySelector(".btn-delete");',
                '                        if (deleteBtn) deleteBtn.classList.add("active");',
                '                    }',
                '                });',
                '            }',
                '        }',
                '    } catch (e) {',
                '        console.error("Error loading state:", e);',
                '    }',
                '    updateCounts();',
                '}',
                '',
                '// Save state',
                'function saveState() {',
                '    try {',
                '        const state = {',
                '            deletes: Array.from(marks.deletes)',
                '        };',
                '        localStorage.setItem("campaignSlideshowState", JSON.stringify(state));',
                '    } catch (e) {',
                '        console.error("Error saving state:", e);',
                '    }',
                '}',
                '',
                '// Update counts',
                'function updateCounts() {',
                '    const htmlContentDiv = document.getElementById("html-content-div");',
                '    if (!htmlContentDiv) return;',
                '    ',
                '    const deleteCount = htmlContentDiv.querySelector("#deleteCount");',
                '    const remainingCount = htmlContentDiv.querySelector("#remainingCount");',
                '    ',
                '    if (deleteCount) deleteCount.textContent = marks.deletes.size;',
                '    if (remainingCount) {',
                '        const remaining = totalImages - marks.deletes.size;',
                '        remainingCount.textContent = remaining;',
                '    }',
                '}',
                '',
                '// Marking functions',
                '// Keep functionality removed - only delete button remains',
                'window.markKeep = function(index, path) {',
                '    // Keep functionality removed - this function does nothing',
                '    return;',
                '};',
                '',
                'window.markDelete = function(index, path) {',
                '    console.log("markDelete called", index, path);',
                '    const htmlContentDiv = document.getElementById("html-content-div");',
                '    if (!htmlContentDiv) return;',
                '    ',
                '    const card = htmlContentDiv.querySelector("#card-" + index);',
                '    if (!card) {',
                '        console.error("Card not found:", "card-" + index);',
                '        return;',
                '    }',
                '    const deleteBtn = card.querySelector(".btn-delete");',
                '    ',
                '    if (marks.deletes.has(path)) {',
                '        marks.deletes.delete(path);',
                '        card.classList.remove("marked-delete");',
                '        if (deleteBtn) {',
                '            deleteBtn.classList.remove("active");',
                '            deleteBtn.textContent = "🗑️ Delete";',
                '        }',
                '    } else {',
                '        marks.deletes.add(path);',
                '        card.classList.add("marked-delete");',
                '        if (deleteBtn) {',
                '            deleteBtn.classList.add("active");',
                '            deleteBtn.textContent = "❌ Delete";',
                '        }',
                '    }',
                '    ',
                '    updateCounts();',
                '    saveState();',
                '};',
                '',
                '// Export results',
                'window.exportResults = function() {',
                '    const htmlContentDiv = document.getElementById("html-content-div");',
                '    if (!htmlContentDiv) return;',
                '    ',
                '    const results = {',
                '        timestamp: new Date().toISOString(),',
                '        total: totalImages,',
                '        keeps: Array.from(marks.keeps).map(path => {',
                '            const item = htmlContentDiv.querySelector("[data-path=\\"" + path + "\\"]");',
                '            return {',
                '                path: path,',
                '                timestamp: item ? item.dataset.timestamp : "",',
                '                product: item ? item.dataset.product : "",',
                '                campaign: item ? item.dataset.campaign : ""',
                '            };',
                '        }),',
                '        deletes: Array.from(marks.deletes).map(path => {',
                '            const item = htmlContentDiv.querySelector("[data-path=\\"" + path + "\\"]");',
                '            return {',
                '                path: path,',
                '                timestamp: item ? item.dataset.timestamp : "",',
                '                product: item ? item.dataset.product : "",',
                '                campaign: item ? item.dataset.campaign : ""',
                '            };',
                '        })',
                '    };',
                '    ',
                '    const blob = new Blob([JSON.stringify(results, null, 2)], { type: "application/json" });',
                '    const url = URL.createObjectURL(blob);',
                '    const a = document.createElement("a");',
                '    a.href = url;',
                '    const dateStr = new Date().toISOString().split("T")[0];',
                '    a.download = "campaign_slideshow_results_" + dateStr + ".json";',
                '    document.body.appendChild(a);',
                '    a.click();',
                '    document.body.removeChild(a);',
                '    URL.revokeObjectURL(url);',
                '    ',
                '    alert("Exported " + results.keeps.length + " keeps and " + results.deletes.length + " deletes!");',
                '};',
                '',
                '// Set up event delegation for buttons',
                'function setupEventDelegation() {',
                '    const htmlContentDiv = document.getElementById("html-content-div");',
                '    if (htmlContentDiv) {',
                '        // Handle keep/delete buttons',
                '        htmlContentDiv.addEventListener("click", function(e) {',
                '            const btn = e.target.closest(".btn-keep, .btn-delete");',
                '            if (btn) {',
                '                e.preventDefault();',
                '                e.stopPropagation();',
                '                const action = btn.dataset.action;',
                '                const index = parseInt(btn.dataset.index);',
                '                const path = btn.dataset.path;',
                '                ',
                '                console.log("Button clicked:", action, index, path);',
                '                ',
                '                if (action === "keep") {',
                '                    window.markKeep(index, path);',
                '                } else if (action === "delete") {',
                '                    window.markDelete(index, path);',
                '                }',
                '                return false;',
                '            }',
                '            ',
                '            // Handle export button',
                '            if (e.target.id === "export-results-btn" || e.target.closest("#export-results-btn")) {',
                '                e.preventDefault();',
                '                e.stopPropagation();',
                '                window.exportResults();',
                '                return false;',
                '            }',
                '        }, true);',
                '    }',
                '}',
                '',
                '// Initialize after content loads',
                'setTimeout(() => {',
                '    updateTotalImages();',
                '    loadState();',
                '    setupEventDelegation();',
                '}, 1000);'
            ].join('\\n');
            script.textContent = scriptCode;
            document.body.appendChild(script);
        }, 1000);
    } catch (error) {
        console.error('Failed to initialize ScrollingContentDiv:', error);
        console.error('Error stack:', error.stack);
        // Show error on page
        document.body.innerHTML = '<div style="padding: 20px; font-family: monospace; background: #fee; border: 2px solid #f00; margin: 20px;"><h1>Error Loading Content</h1><p><strong>Error:</strong> ' + error.message + '</p><p><strong>Stack:</strong></p><pre>' + error.stack + '</pre><p>Check the browser console for more details.</p></div>';
    }
});
