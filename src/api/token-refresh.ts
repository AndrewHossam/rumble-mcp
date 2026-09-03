/**
 * Firebase Token Refresh Module
 *
 * Handles automatic refresh of Firebase ID tokens using the refresh token.
 * Firebase ID tokens expire after 1 hour, but refresh tokens last indefinitely
 * (until logout or password change).
 */

// Firebase Web API Key (this is a public key, safe to include)
// Found from therumble.app network traffic (identitytoolkit call).
// Can be overridden via the FIREBASE_API_KEY environment variable.
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY ?? 'AIzaSyCxRxO08j2VAnaKaGrFejEooYnbzxWg_WU';

interface TokenRefreshResponse {
  access_token: string; // The new Firebase ID token
  expires_in: string; // Expiry time in seconds (usually "3600")
  token_type: string; // Always "Bearer"
  refresh_token: string; // The refresh token (may be rotated)
  id_token: string; // Same as access_token
  user_id: string; // Firebase user ID
  project_id: string; // Firebase project ID
}

interface TokenRefreshError {
  error: {
    code: number;
    message: string;
    errors: Array<{ message: string; domain: string; reason: string }>;
  };
}

/**
 * Refresh a Firebase ID token using a refresh token
 *
 * @param refreshToken - The Firebase refresh token
 * @param apiKey - Optional custom API key (uses default if not provided)
 * @returns The new ID token and updated refresh token
 */
export async function refreshFirebaseToken(
  refreshToken: string,
  apiKey: string = FIREBASE_API_KEY
): Promise<{ idToken: string; refreshToken: string; expiresIn: number }> {
  const url = `https://securetoken.googleapis.com/v1/token?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`,
    signal: AbortSignal.timeout(30_000),
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as TokenRefreshError;
    throw new Error(`Token refresh failed: ${error.error?.message || response.statusText}`);
  }

  const result = data as TokenRefreshResponse;

  return {
    idToken: result.id_token || result.access_token,
    refreshToken: result.refresh_token,
    expiresIn: parseInt(result.expires_in, 10) || 3600,
  };
}

/**
 * Check if a JWT token is expired or about to expire
 *
 * @param token - The JWT token to check
 * @param bufferSeconds - Seconds before actual expiry to consider it expired (default: 60)
 * @returns true if token is expired or will expire within buffer time
 */
export function isTokenExpired(token: string, bufferSeconds: number = 60): boolean {
  try {
    // JWT has 3 parts: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) return true;

    // Decode the payload (base64url)
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
    );

    // Check expiry time (exp is in seconds)
    const expiryTime = payload.exp * 1000; // Convert to milliseconds
    const now = Date.now();
    const bufferMs = bufferSeconds * 1000;

    return now >= expiryTime - bufferMs;
  } catch {
    // If we can't parse the token, assume it's expired
    return true;
  }
}

/**
 * Token manager class for handling automatic token refresh
 */
export class TokenManager {
  private idToken: string;
  private refreshToken: string | null;
  private apiKey: string;
  private onTokenRefresh?: (newToken: string) => void;
  // Coalesces concurrent refresh() calls onto a single in-flight network request.
  private inFlightRefresh: Promise<string> | null = null;

  constructor(
    idToken: string,
    refreshToken?: string,
    apiKey: string = FIREBASE_API_KEY,
    onTokenRefresh?: (newToken: string) => void
  ) {
    this.idToken = idToken;
    this.refreshToken = refreshToken || null;
    this.apiKey = apiKey;
    this.onTokenRefresh = onTokenRefresh;
  }

  /**
   * Get a valid token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    // If no refresh token, just return current token
    if (!this.refreshToken) {
      return this.idToken;
    }

    // Check if token is expired or about to expire
    if (isTokenExpired(this.idToken)) {
      await this.refresh();
    }

    return this.idToken;
  }

  /**
   * Force refresh the token. Concurrent calls are coalesced into a single
   * network request — all callers receive the same promise and the same token.
   */
  async refresh(): Promise<string> {
    if (this.inFlightRefresh) return this.inFlightRefresh;
    const refreshToken = this.refreshToken;
    if (!refreshToken) throw new Error('No refresh token available');

    this.inFlightRefresh = refreshFirebaseToken(refreshToken, this.apiKey)
      .then(result => {
        this.idToken = result.idToken;
        this.refreshToken = result.refreshToken;
        if (this.onTokenRefresh) this.onTokenRefresh(this.idToken);
        return this.idToken;
      })
      .finally(() => {
        this.inFlightRefresh = null;
      });

    return this.inFlightRefresh;
  }

  /**
   * Get current token without refresh check
   */
  getCurrentToken(): string {
    return this.idToken;
  }

  /**
   * Check if we have a refresh token
   */
  hasRefreshToken(): boolean {
    return !!this.refreshToken;
  }
}
