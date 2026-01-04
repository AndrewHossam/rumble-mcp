#!/usr/bin/env node
/**
 * Helper script to extract Firebase token from TheRumble.app
 * 
 * Usage:
 *   1. Open https://therumble.app in your browser and log in
 *   2. Open DevTools (F12) > Console
 *   3. Paste the JavaScript snippet below and press Enter
 *   4. Copy the token and add it to your .env file
 */

const EXTRACTION_SCRIPT = `
// Paste this in your browser console on therumble.app
(function() {
    // The token is stored in localStorage under 'auth-store' as JSON
    const authStore = localStorage.getItem('auth-store');
    
    if (authStore) {
        try {
            const parsed = JSON.parse(authStore);
            const token = parsed.state?.firebase_token || parsed.firebase_token;
            
            if (token) {
                console.log('\\n🔑 Firebase Token Found:\\n');
                console.log(token);
                navigator.clipboard.writeText(token).then(() => {
                    console.log('\\n📋 Token copied to clipboard!');
                }).catch(() => {
                    console.log('\\n⚠️ Could not copy to clipboard. Please copy manually from above.');
                });
                return token;
            }
        } catch(e) {
            console.log('Error parsing auth-store:', e);
        }
    }
    
    // Fallback: Try to extract from Discord integration link
    const discordLink = document.querySelector('a[href*="firebase_token"]');
    if (discordLink) {
        const url = new URL(discordLink.href, window.location.origin);
        const token = url.searchParams.get('firebase_token');
        if (token) {
            console.log('\\n🔑 Firebase Token Found (from Discord link):\\n');
            console.log(token);
            navigator.clipboard.writeText(token).then(() => {
                console.log('\\n📋 Token copied to clipboard!');
            }).catch(() => {
                console.log('\\n⚠️ Could not copy to clipboard. Please copy manually from above.');
            });
            return token;
        }
    }
    
    console.log('❌ No token found. Make sure you are logged in to therumble.app');
    return null;
})();
`;

const separator = '─'.repeat(60);

console.log(`
╔═══════════════════════════════════════════════════════════╗
║         Rumble Firebase Token Extraction Helper           ║
╠═══════════════════════════════════════════════════════════╣
║                                                           ║
║  Steps to get your token:                                 ║
║                                                           ║
║  1. Open https://therumble.app in your browser           ║
║  2. Log in to your account                                ║
║  3. Open DevTools: Press F12 or Cmd+Option+I (Mac)       ║
║  4. Go to the Console tab                                 ║
║  5. Paste the script below and press Enter                ║
║  6. Copy the token to your .env file                      ║
║                                                           ║
╚═══════════════════════════════════════════════════════════╝

📋 Copy and paste this script in your browser console:
${separator}
${EXTRACTION_SCRIPT}
${separator}

After getting the token, add it to your .env file:

  RUMBLE_FIREBASE_TOKEN=<your-token-here>
  RUMBLE_MARKET=EGY

`);
