/**
 * Webchat Bridge - Injection script for OpenClaw webchat
 * 
 * This script adds support for:
 * 1. BroadcastChannel messages from the Agent Dashboard
 * 2. URL parameter prefill (?message=...)
 * 
 * INSTALLATION OPTIONS:
 * 
 * Option 1: Browser Console (temporary)
 *   Copy and paste this entire script into the browser console on the webchat page.
 * 
 * Option 2: Userscript (persistent)
 *   Install with Tampermonkey/Greasemonkey using the userscript header below.
 * 
 * Option 3: Browser Extension
 *   Load as a content script targeting the webchat URL.
 */

// ==UserScript==
// @name         OpenClaw Webchat Bridge
// @namespace    https://openclaw.dev
// @version      1.0
// @description  Enable Ask Agent auto-paste from Agent Dashboard
// @match        http://localhost:*/
// @match        https://*.tail*.ts.net/
// @match        https://*.tailscale.net/
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    
    const DEBUG = false;
    const log = (...args) => DEBUG && console.log('[WebchatBridge]', ...args);
    
    /**
     * Find the message input element in the webchat
     * Tries multiple selectors to handle different UI versions
     */
    function findInputElement() {
        // Try common selectors for chat inputs
        const selectors = [
            'textarea',
            'input[type="text"]',
            '[contenteditable="true"]',
            '.message-input',
            '.chat-input',
            '#message-input',
            '[data-testid="message-input"]'
        ];
        
        for (const selector of selectors) {
            const el = document.querySelector(selector);
            if (el) {
                log('Found input with selector:', selector);
                return el;
            }
        }
        
        log('No input element found');
        return null;
    }
    
    /**
     * Set the value of the input element
     * Handles both textarea/input and contenteditable elements
     */
    function setInputValue(element, text) {
        if (!element) return false;
        
        if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
            // Standard input elements
            element.value = text;
            element.focus();
            
            // Dispatch input event to trigger any listeners
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            
            log('Set textarea/input value');
            return true;
        } else if (element.contentEditable === 'true') {
            // Contenteditable elements (used by some chat UIs)
            element.textContent = text;
            element.focus();
            
            // Move cursor to end
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(false);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            
            // Dispatch input event
            element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text }));
            
            log('Set contenteditable value');
            return true;
        }
        
        return false;
    }
    
    /**
     * Initialize BroadcastChannel listener
     */
    function initBroadcastChannel() {
        try {
            const channel = new BroadcastChannel('openclaw-webchat');
            
            channel.onmessage = (event) => {
                log('Received BroadcastChannel message:', event.data);
                
                if (event.data.type === 'fill-message' && event.data.text) {
                    const input = findInputElement();
                    if (setInputValue(input, event.data.text)) {
                        log('Message filled via BroadcastChannel');
                        
                        // Focus the window
                        window.focus();
                    }
                }
            };
            
            log('BroadcastChannel listener initialized');
        } catch (err) {
            console.warn('[WebchatBridge] BroadcastChannel not supported:', err);
        }
    }
    
    /**
     * Check URL parameters for prefill message
     */
    function checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const prefillMessage = urlParams.get('message');
        
        if (prefillMessage) {
            log('Found message in URL params');
            
            // Wait for the input to be available (SPA might not have rendered yet)
            const tryFill = (attempts = 0) => {
                const input = findInputElement();
                
                if (input) {
                    if (setInputValue(input, prefillMessage)) {
                        log('Message prefilled from URL params');
                        
                        // Clear the URL param to avoid re-filling on refresh
                        const cleanUrl = new URL(window.location.href);
                        cleanUrl.searchParams.delete('message');
                        window.history.replaceState({}, '', cleanUrl.toString());
                    }
                } else if (attempts < 20) {
                    // Retry for up to 10 seconds (500ms * 20)
                    setTimeout(() => tryFill(attempts + 1), 500);
                } else {
                    console.warn('[WebchatBridge] Could not find input element after 10 seconds');
                }
            };
            
            // Start trying after a short delay
            setTimeout(tryFill, 100);
        }
    }
    
    /**
     * Initialize the bridge
     */
    function init() {
        log('Initializing Webchat Bridge...');
        
        // Initialize BroadcastChannel listener
        initBroadcastChannel();
        
        // Check URL params for prefill message
        checkUrlParams();
        
        log('Webchat Bridge initialized');
    }
    
    // Run on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
    
    // Also run on navigation (for SPAs)
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
            lastUrl = window.location.href;
            checkUrlParams();
        }
    });
    
    observer.observe(document.body, { childList: true, subtree: true });
})();
