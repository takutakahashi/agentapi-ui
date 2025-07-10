import { cookies } from 'next/headers';
import { randomBytes } from 'crypto';

const GITHUB_OAUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_API = 'https://api.github.com/user';

const OAUTH_STATE_COOKIE = 'agentapi_oauth_state';
const GITHUB_TOKEN_COOKIE = 'agentapi_github_token';

export interface GitHubTokenData {
  access_token: string;
  token_type: string;
  scope: string;
}

export interface GitHubUserData {
  id: number;
  login: string;
  name?: string;
  email?: string;
  avatar_url?: string;
}

export function getGitHubOAuthConfig() {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  const callbackUrl = process.env.GITHUB_OAUTH_CALLBACK_URL || 'http://localhost:3000/api/auth/callback/github';

  if (!clientId || !clientSecret) {
    throw new Error('GitHub OAuth configuration is missing. Please set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET environment variables.');
  }

  return {
    clientId,
    clientSecret,
    callbackUrl,
  };
}

export function generateOAuthState(): string {
  return randomBytes(32).toString('hex');
}

export async function setOAuthStateCookie(state: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax', // 'lax' for OAuth redirects
    maxAge: 10 * 60, // 10 minutes
    path: '/',
  });
}

export async function getOAuthStateFromCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  const state = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  return state || null;
}

export async function deleteOAuthStateCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });
}

export function getGitHubAuthorizationUrl(state: string): string {
  const { clientId, callbackUrl } = getGitHubOAuthConfig();
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user user:email',
    state: state,
  });

  return `${GITHUB_OAUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForToken(code: string): Promise<GitHubTokenData> {
  const { clientId, clientSecret, callbackUrl } = getGitHubOAuthConfig();

  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code: code,
      redirect_uri: callbackUrl,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to exchange code for token: ${errorText}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
  }

  return data as GitHubTokenData;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUserData> {
  const response = await fetch(GITHUB_USER_API, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch GitHub user: ${errorText}`);
  }

  return await response.json() as GitHubUserData;
}

export async function setGitHubTokenCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  
  // For GitHub OAuth tokens, we store them encrypted in cookies
  // In a production environment, you might want to store these in a database
  // and only store a session ID in the cookie
  const { encryptApiKey } = await import('./cookie-auth');
  const encryptedToken = encryptApiKey(token);
  
  cookieStore.set(GITHUB_TOKEN_COOKIE, encryptedToken, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
}

export async function getGitHubTokenFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const encryptedToken = cookieStore.get(GITHUB_TOKEN_COOKIE)?.value;
    
    if (!encryptedToken) {
      return null;
    }
    
    const { decryptApiKey } = await import('./cookie-auth');
    return decryptApiKey(encryptedToken);
  } catch (error) {
    console.error('Failed to decrypt GitHub token from cookie:', error);
    return null;
  }
}

export async function deleteGitHubTokenCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(GITHUB_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}

export async function isGitHubAuthenticated(): Promise<boolean> {
  const token = await getGitHubTokenFromCookie();
  return !!token;
}