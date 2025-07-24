import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const cookieString = request.headers.get('cookie')
    if (!cookieString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cookies = Object.fromEntries(
      cookieString.split('; ').map(cookie => {
        const [key, value] = cookie.split('=')
        return [key, decodeURIComponent(value)]
      })
    )

    const token = cookies.agentapi_token
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const encryptedConfig = cookies.agentapi_encrypted_config
    if (!encryptedConfig) {
      return NextResponse.json({ 
        systemPrompt: '',
        success: true 
      })
    }

    const decryptResponse = await fetch(`${request.nextUrl.origin}/api/decrypt`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookieString 
      },
      body: JSON.stringify({ data: encryptedConfig })
    })

    if (!decryptResponse.ok) {
      console.error('Failed to decrypt config for system prompt')
      return NextResponse.json({ 
        systemPrompt: '',
        success: true 
      })
    }

    const { decrypted } = await decryptResponse.json()
    
    let decryptedJson
    try {
      const decryptedString = Buffer.from(decrypted, 'base64').toString('utf8')
      decryptedJson = JSON.parse(decryptedString)
    } catch (parseError) {
      console.error('Failed to parse decrypted data:', parseError)
      return NextResponse.json({ 
        systemPrompt: '',
        success: true 
      })
    }

    return NextResponse.json({
      systemPrompt: decryptedJson.systemPrompt || '',
      success: true
    })

  } catch (error) {
    console.error('Error getting system prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieString = request.headers.get('cookie')
    if (!cookieString) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const cookies = Object.fromEntries(
      cookieString.split('; ').map(cookie => {
        const [key, value] = cookie.split('=')
        return [key, decodeURIComponent(value)]
      })
    )

    const token = cookies.agentapi_token
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { systemPrompt } = await request.json()

    let existingConfig = {}
    const encryptedConfig = cookies.agentapi_encrypted_config
    
    if (encryptedConfig) {
      try {
        const decryptResponse = await fetch(`${request.nextUrl.origin}/api/decrypt`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Cookie': cookieString 
          },
          body: JSON.stringify({ data: encryptedConfig })
        })

        if (decryptResponse.ok) {
          const { decrypted } = await decryptResponse.json()
          const decryptedString = Buffer.from(decrypted, 'base64').toString('utf8')
          existingConfig = JSON.parse(decryptedString)
        }
      } catch (error) {
        console.warn('Failed to decrypt existing config, using empty config:', error)
      }
    }

    const updatedConfig = {
      baseUrl: `${request.nextUrl.protocol}//${request.nextUrl.host}/api/proxy`,
      ...existingConfig,
      systemPrompt: systemPrompt || ''
    }

    const base64Data = Buffer.from(JSON.stringify(updatedConfig)).toString('base64')

    const encryptResponse = await fetch(`${request.nextUrl.origin}/api/encrypt`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': cookieString 
      },
      body: JSON.stringify({ data: base64Data })
    })

    if (!encryptResponse.ok) {
      throw new Error('Failed to encrypt updated config')
    }

    const { encrypted } = await encryptResponse.json()

    const response = NextResponse.json({ success: true })
    response.cookies.set('agentapi_encrypted_config', encrypted, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60
    })

    return response

  } catch (error) {
    console.error('Error saving system prompt:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}