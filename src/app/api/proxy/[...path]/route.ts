import { NextRequest, NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';

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

async function handleProxyRequest(
  request: NextRequest,
  pathParts: string[],
  method: string
): Promise<NextResponse> {
  try {
    // Check if single profile mode is enabled
    const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true';
    
    if (!singleProfileMode) {
      return NextResponse.json(
        { error: 'Single profile mode is not enabled' },
        { status: 403 }
      );
    }

    // Get API key from cookie
    const apiKey = await getApiKeyFromCookie();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No API key found in cookie' },
        { status: 401 }
      );
    }

    // Construct target URL
    const path = pathParts.join('/');
    const searchParams = request.nextUrl.searchParams;
    const targetUrl = `${PROXY_URL}/${path}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

    // Prepare headers
    const headers = new Headers();
    headers.set('Authorization', `Bearer ${apiKey}`);
    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');

    // Copy relevant headers from original request
    const headersToForward = [
      'user-agent',
      'accept-language',
      'accept-encoding',
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

    // Prepare request body
    let body: string | undefined;
    if (method !== 'GET' && method !== 'HEAD') {
      try {
        body = await request.text();
      } catch (error) {
        console.error('Error reading request body:', error);
        return NextResponse.json(
          { error: 'Failed to read request body' },
          { status: 400 }
        );
      }
    }

    // Check if this is a Server-Sent Events request
    const acceptHeader = request.headers.get('accept');
    const isSSE = acceptHeader?.includes('text/event-stream');

    if (isSSE) {
      return handleSSERequest(targetUrl, headers);
    }

    // Make the request to the proxy
    const response = await fetch(targetUrl, {
      method,
      headers,
      body,
    });

    // Handle non-JSON responses
    const contentType = response.headers.get('content-type');
    let responseData: unknown;
    
    if (contentType?.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    // Return response with appropriate status
    if (!response.ok) {
      return NextResponse.json(
        { error: responseData || 'Proxy request failed', status: response.status },
        { status: response.status }
      );
    }

    return NextResponse.json(responseData, { status: response.status });
  } catch (error) {
    console.error('Proxy request error:', error);
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
        'Access-Control-Allow-Origin': '*',
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