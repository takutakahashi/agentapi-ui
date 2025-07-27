import { NextRequest, NextResponse } from 'next/server'
import { setApiKeyCookie } from '@/lib/cookie-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { apiKey } = body

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Set the authentication cookie
    await setApiKeyCookie(apiKey)
    const response = NextResponse.json({ success: true })

    return response
  } catch {
    return NextResponse.json(
      { error: 'Failed to restore session' },
      { status: 500 }
    )
  }
}