import { NextRequest, NextResponse } from 'next/server';
import { setApiKeyCookie, deleteApiKeyCookie, getApiKeyFromCookie } from '@/lib/cookie-auth';

export async function POST(request: NextRequest) {
  try {
    const { action, apiKey } = await request.json();

    switch (action) {
      case 'set':
        if (!apiKey) {
          return NextResponse.json({ error: 'API key is required' }, { status: 400 });
        }
        await setApiKeyCookie(apiKey);
        return NextResponse.json({ success: true });

      case 'delete':
        await deleteApiKeyCookie();
        return NextResponse.json({ success: true });

      case 'get':
        const storedApiKey = await getApiKeyFromCookie();
        return NextResponse.json({ apiKey: storedApiKey });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Cookie operation failed:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}