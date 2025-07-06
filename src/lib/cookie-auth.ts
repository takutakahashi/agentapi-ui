import { cookies } from 'next/headers';

const COOKIE_NAME = 'agentapi_token';

export async function setApiKeyCookie(apiKey: string): Promise<void> {
  const cookieStore = await cookies();
  
  cookieStore.set(COOKIE_NAME, apiKey, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60, // 30 days
    path: '/',
  });
}

export async function getApiKeyFromCookie(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const apiKey = cookieStore.get(COOKIE_NAME)?.value;
    
    if (!apiKey) {
      console.warn('No agentapi_token cookie found');
      return null;
    }
    
    return apiKey;
  } catch (error) {
    console.error('Failed to get API key from cookie:', error);
    return null;
  }
}

export async function deleteApiKeyCookie(): Promise<void> {
  const cookieStore = await cookies();
  // Set the cookie with maxAge=0 to ensure it's deleted
  cookieStore.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: 0,
    path: '/',
  });
}