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
(async function() {
    console.log('🔍 Searching for tokens in LocalStorage and IndexedDB...');

    // Helper to get refresh token from IndexedDB
    const getRefreshTokenFromDB = () => {
        return new Promise((resolve) => {
            const request = indexedDB.open('firebaseLocalStorageDb');
            request.onerror = () => resolve(null);
            request.onsuccess = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
                    resolve(null);
                    return;
                }
                const transaction = db.transaction(['firebaseLocalStorage'], 'readonly');
                const store = transaction.objectStore('firebaseLocalStorage');
                const getAll = store.getAll();
                getAll.onsuccess = () => {
                    const res = getAll.result;
                    if (res && res.length > 0) {
                        for (const item of res) {
                            if (item.value && item.value.stsTokenManager && item.value.stsTokenManager.refreshToken) {
                                resolve(item.value.stsTokenManager.refreshToken);
                                return;
                            }
                        }
                    }
                    resolve(null);
                };
                getAll.onerror = () => resolve(null);
            };
        });
    };

    // 1. Get Access Token from LocalStorage
    let token = null;
    const authStore = localStorage.getItem('auth-store');
    if (authStore) {
        try {
            const parsed = JSON.parse(authStore);
            token = parsed.state?.firebase_token || parsed.firebase_token;
        } catch(e) {}
    }

    // 2. Get Refresh Token from IndexedDB
    const refresh = await getRefreshTokenFromDB();

    if (token) {
        console.log('\\n🔑 Rumple Credentials Found:\\n');
        console.log(\`RUMBLE_FIREBASE_TOKEN=\${token}\`);
        if (refresh) {
            console.log(\`RUMBLE_REFRESH_TOKEN=\${refresh || 'NOT FOUND'}\`);
        } else {
            console.log('\\n⚠️ Refresh token not found in IndexedDB. API will expire in 1 hour.');
        }
        
        const envContent = \`RUMBLE_FIREBASE_TOKEN=\${token}\\nRUMBLE_REFRESH_TOKEN=\${refresh || ''}\\nRUMBLE_MARKET=EGY\`;
        
        try {
            await navigator.clipboard.writeText(envContent);
            console.log('\\n📋 Full .env content copied to clipboard! Paste directly into your .env file.');
        } catch (err) {
            console.log('\\n⚠️ Could not copy to clipboard. Please copy manually from above.');
        }
    } else {
        console.log('❌ No access token found. Make sure you are logged in to therumble.app');
    }
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
