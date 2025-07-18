import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';
import { getEncryptionService } from '@/lib/encryption';

const PROXY_URL = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams.path, 'GET');
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams.path, 'POST');
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams.path, 'PUT');
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams.path, 'DELETE');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  return handleProxyRequest(request, resolvedParams.path, 'PATCH');
}

// Debug logging utility
const DEBUG_ENABLED = process.env.NODE_ENV !== 'production' && process.env.DEBUG_LOGS !== 'false';
const debugLog = (...args: unknown[]) => {
  if (DEBUG_ENABLED) {
    console.log(...args);
  }
};

async function handleProxyRequest(
  request: NextRequest,
  pathParts: string[],
  method: string
): Promise<NextResponse> {
  try {
    // Log the incoming request for debugging
    debugLog(`[API Proxy] ${method} request to:`, pathParts.join('/'), {
      searchParams: request.nextUrl.searchParams.toString(),
      hasBody: method !== 'GET' && method !== 'HEAD'
    });

    // Check if single profile mode is enabled
    const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true' || 
                              process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true';
    
    if (!singleProfileMode) {
      console.error('API proxy request failed: Single profile mode is not enabled. Set SINGLE_PROFILE_MODE=true environment variable.');
      return NextResponse.json(
        { 
          error: 'Single profile mode is not enabled', 
          message: 'This API endpoint requires single profile mode to be enabled.',
          code: 'SINGLE_PROFILE_MODE_DISABLED'
        },
        { status: 403 }
      );
    }

    // Check if this is an OAuth endpoint that doesn't require API key
    const path = pathParts.join('/');
    const isOAuthEndpoint = path.startsWith('oauth/') || path.includes('auth/');
    
    // Get API key from cookie (skip for OAuth endpoints)
    let apiKey: string | null = null;
    if (!isOAuthEndpoint) {
      apiKey = await getApiKeyFromCookie();
      if (!apiKey) {
        console.error('API proxy request failed: No API key found in cookie. Make sure you are logged in and COOKIE_ENCRYPTION_SECRET is properly configured.');
        return NextResponse.json(
          { 
            error: 'Authentication required', 
            message: 'No API key found in cookie. Please log in again.',
            code: 'NO_API_KEY'
          },
          { status: 401 }
        );
      }
    }

    // Determine proxy URL based on single profile mode settings
    let proxyUrl = PROXY_URL;
    
    // In single profile mode, use the request hostname for proxy URL construction
    if (singleProfileMode) {
      const host = request.headers.get('host');
      
      if (host) {
        // Use the actual backend URL for proxying
        proxyUrl = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080';
      }
    }
    
    // Construct target URL
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = `${proxyUrl}/${path}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    debugLog(`[API Proxy] Target URL constructed:`, targetUrl);

    // Prepare request body and handle encrypted config
    let body: string | undefined;
    let decryptedConfig: Record<string, unknown> = {};
    
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        const bodyText = await request.text();
        body = bodyText;
        
        // Try to parse the body as JSON to check for encrypted config
        try {
          const bodyData = JSON.parse(bodyText);
          
          // Check if the request contains encrypted configuration
          // Only decrypt if we have an API key (OAuth endpoints don't have one)
          if (bodyData.encryptedConfig && apiKey) {
            const encryptionService = getEncryptionService();
            const currentTokenHash = encryptionService.hashApiToken(apiKey);
            
            try {
              decryptedConfig = encryptionService.decrypt(
                bodyData.encryptedConfig,
                currentTokenHash
              ) as Record<string, unknown>;
              
              // Remove encryptedConfig from the body and merge decrypted data
              delete bodyData.encryptedConfig;
              body = JSON.stringify(bodyData);
            } catch (decryptError) {
              console.error('Failed to decrypt config:', decryptError);
              return NextResponse.json(
                { error: 'Failed to decrypt configuration' },
                { status: 401 }
              );
            }
          } else if (bodyData.encryptedConfig && !apiKey) {
            // OAuth endpoints with encrypted config should not happen, but handle gracefully
            console.warn('OAuth endpoint received encrypted config, ignoring');
            delete bodyData.encryptedConfig;
            body = JSON.stringify(bodyData);
          }
        } catch {
          // Body is not JSON, use as-is
        }
      } catch (error) {
        console.error('Error reading request body:', error);
        return NextResponse.json(
          { error: 'Failed to read request body' },
          { status: 400 }
        );
      }
    }

    // Prepare headers
    const headers = new Headers();
    // Only add Authorization header for non-OAuth endpoints
    if (!isOAuthEndpoint && apiKey) {
      headers.set('Authorization', `Bearer ${apiKey}`);
    }
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    
    // Add decrypted environment variables as headers if available
    if (decryptedConfig.environmentVariables) {
      Object.entries(decryptedConfig.environmentVariables as Record<string, unknown>).forEach(([key, value]) => {
        headers.set(`X-Env-${key}`, String(value));
      });
    }
    
    // Add Bedrock settings as environment variables if available
    if (decryptedConfig.bedrockSettings) {
      const bedrockConfig = decryptedConfig.bedrockSettings as Record<string, unknown>;
      
      // Only add environment variables if Bedrock is enabled
      if (bedrockConfig.enabled) {
        headers.set('X-Env-CLAUDE_CODE_USE_BEDROCK', '1');
        
        // Add AWS credentials if configured
        if (bedrockConfig.awsAccessKeyId) {
          headers.set('X-Env-AWS_ACCESS_KEY_ID', String(bedrockConfig.awsAccessKeyId));
        }
        if (bedrockConfig.awsSecretAccessKey) {
          headers.set('X-Env-AWS_SECRET_ACCESS_KEY', String(bedrockConfig.awsSecretAccessKey));
        }
        if (bedrockConfig.awsSessionToken) {
          headers.set('X-Env-AWS_SESSION_TOKEN', String(bedrockConfig.awsSessionToken));
        }
        if (bedrockConfig.region) {
          headers.set('X-Env-AWS_REGION', String(bedrockConfig.region));
        }
        if (bedrockConfig.modelName) {
          headers.set('X-Env-ANTHROPIC_MODEL', String(bedrockConfig.modelName));
        }
        if (bedrockConfig.endpointUrl) {
          headers.set('X-Env-AWS_ENDPOINT_URL', String(bedrockConfig.endpointUrl));
        }
      }
    }
    
    
    // Add base URL override if available
    if (decryptedConfig.baseUrl) {
      headers.set('X-Base-URL', String(decryptedConfig.baseUrl));
    }

    // Copy relevant headers from original request (excluding accept-encoding to avoid compression issues)
    const headersToForward = [
      'user-agent',
      'accept-language',
      'cache-control',
      'pragma',
      'sec-fetch-dest',
      'sec-fetch-mode',
      'sec-fetch-site',
    ];

    headersToForward.forEach(headerName => {
      const value = request.headers.get(headerName);
      if (value) {
        headers.set(headerName, value);
      }
    });

    // Check if this is a Server-Sent Events request
    const acceptHeader = request.headers.get('accept');
    const isSSE = acceptHeader?.includes('text/event-stream');

    if (isSSE) {
      return handleSSERequest(targetUrl, headers);
    }

    // Make the request to the proxy
    // Set timeout based on the endpoint - longer for message sending
    const isMessageEndpoint = pathParts.includes('message');
    const timeoutMs = isMessageEndpoint ? 120000 : 30000; // 2 minutes for messages, 30s for others

    debugLog(`[API Proxy] Making ${method} request to backend:`, {
      url: targetUrl,
      hasAuth: !!headers.get('Authorization'),
      isOAuthEndpoint,
      timeout: timeoutMs,
      bodyLength: typeof body === 'string' ? body.length : 0
    });

    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(timeoutMs),
    });

    debugLog(`[API Proxy] Backend response:`, {
      status: response.status,
      statusText: response.statusText,
      contentType: response.headers.get('content-type'),
      url: targetUrl
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let responseData: unknown;
    
    try {
      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }
    } catch (parseError) {
      // If we can't parse the response, create a structured error
      const errorMessage = `Failed to parse response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`;
      
      if (!response.ok) {
        return NextResponse.json(
          { 
            error: 'Proxy response parsing failed', 
            status: response.status,
            details: errorMessage,
            code: 'RESPONSE_PARSE_ERROR'
          },
          { status: response.status }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Response parsing failed', 
          details: errorMessage,
          code: 'RESPONSE_PARSE_ERROR'
        },
        { status: 500 }
      );
    }

    // Return response with appropriate status
    if (!response.ok) {
      // Ensure error response is properly structured
      let errorResponse: Record<string, unknown>;
      
      if (typeof responseData === 'object' && responseData !== null) {
        errorResponse = responseData as Record<string, unknown>;
      } else {
        errorResponse = { 
          error: responseData || 'Proxy request failed', 
          status: response.status,
          code: 'PROXY_REQUEST_FAILED'
        };
      }
      
      return NextResponse.json(errorResponse, { status: response.status });
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error('Proxy request error:', error);
    
    // Handle timeout errors specifically
    if (error instanceof Error && (error.name === 'TimeoutError' || error.message.includes('timeout'))) {
      return NextResponse.json(
        { 
          error: 'Request timeout',
          message: 'リクエストがタイムアウトしました。処理に時間がかかっている可能性があります。',
          code: 'TIMEOUT_ERROR'
        },
        { status: 408 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Internal proxy error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

async function handleSSERequest(
  targetUrl: string,
  headers: Headers
): Promise<NextResponse> {
  try {
    // Create a ReadableStream to handle Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await fetch(targetUrl, {
            method: 'GET',
            headers,
          });

          if (!response.ok) {
            const errorData = await response.text();
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ error: errorData, status: response.status })}\n\n`)
            );
            controller.close();
            return;
          }

          const reader = response.body?.getReader();
          if (!reader) {
            controller.enqueue(
              new TextEncoder().encode(`data: ${JSON.stringify({ error: 'No response body' })}\n\n`)
            );
            controller.close();
            return;
          }

          // Read the stream and forward chunks
          while (true) {
            const { done, value } = await reader.read();
            
            if (done) {
              controller.close();
              break;
            }

            controller.enqueue(value);
          }
        } catch (error) {
          console.error('SSE stream error:', error);
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Stream error', details: error instanceof Error ? error.message : 'Unknown error' })}\n\n`)
          );
          controller.close();
        }
      },
      cancel() {
        // Clean up resources if needed
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    console.error('SSE request error:', error);
    return NextResponse.json(
      { 
        error: 'SSE request failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}