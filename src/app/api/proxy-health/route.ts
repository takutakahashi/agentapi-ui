import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';

const PROXY_URL = process.env.AGENTAPI_PROXY_URL || 'http://localhost:8080';

export async function GET() {
  const diagnostics: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: {
      AGENTAPI_PROXY_URL: PROXY_URL,
      SINGLE_PROFILE_MODE: process.env.SINGLE_PROFILE_MODE,
      COOKIE_ENCRYPTION_SECRET_SET: !!process.env.COOKIE_ENCRYPTION_SECRET,
      COOKIE_ENCRYPTION_SECRET_LENGTH: process.env.COOKIE_ENCRYPTION_SECRET?.length || 0,
    },
    tests: {}
  };

  // Test 1: Check if single profile mode is enabled
  const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true';
  diagnostics.tests.singleProfileMode = {
    enabled: singleProfileMode,
    status: singleProfileMode ? 'PASS' : 'FAIL',
    message: singleProfileMode ? 'Single profile mode is enabled' : 'Single profile mode is not enabled'
  };

  // Test 2: Check API key from cookie
  try {
    const apiKey = await getApiKeyFromCookie();
    diagnostics.tests.apiKeyCookie = {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      status: apiKey ? 'PASS' : 'FAIL',
      message: apiKey ? 'API key found in cookie' : 'No API key found in cookie'
    };
  } catch (error) {
    diagnostics.tests.apiKeyCookie = {
      hasApiKey: false,
      status: 'ERROR',
      message: `Failed to get API key from cookie: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }

  // Test 3: Try to reach agentapi-proxy
  try {
    console.log(`[ProxyHealth] Testing connection to ${PROXY_URL}`);
    const response = await fetch(`${PROXY_URL}/health`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Short timeout for health check
      signal: AbortSignal.timeout(5000)
    });

    diagnostics.tests.proxyConnection = {
      status: response.ok ? 'PASS' : 'FAIL',
      httpStatus: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Successfully connected to agentapi-proxy' : `agentapi-proxy returned ${response.status}`
    };

    if (response.ok) {
      try {
        const data = await response.text();
        diagnostics.tests.proxyConnection.responseData = data;
      } catch {
        diagnostics.tests.proxyConnection.responseData = 'Could not parse response';
      }
    }
  } catch (error) {
    diagnostics.tests.proxyConnection = {
      status: 'ERROR',
      message: `Failed to connect to agentapi-proxy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : 'Unknown error'
    };
  }

  // Test 4: Try authenticated request if we have an API key
  if (diagnostics.tests.apiKeyCookie?.hasApiKey) {
    try {
      const apiKey = await getApiKeyFromCookie();
      console.log(`[ProxyHealth] Testing authenticated request with API key`);
      
      const response = await fetch(`${PROXY_URL}/sessions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(10000)
      });

      diagnostics.tests.authenticatedRequest = {
        status: response.ok ? 'PASS' : 'FAIL',
        httpStatus: response.status,
        statusText: response.statusText,
        message: response.ok ? 'Authenticated request successful' : `Authenticated request failed with ${response.status}`
      };

      if (!response.ok) {
        try {
          const errorData = await response.text();
          diagnostics.tests.authenticatedRequest.errorResponse = errorData;
        } catch {
          diagnostics.tests.authenticatedRequest.errorResponse = 'Could not parse error response';
        }
      }
    } catch (error) {
      diagnostics.tests.authenticatedRequest = {
        status: 'ERROR',
        message: `Authenticated request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } else {
    diagnostics.tests.authenticatedRequest = {
      status: 'SKIP',
      message: 'Skipped - no API key available'
    };
  }

  // Overall status
  const allTests = Object.values(diagnostics.tests);
  const hasError = allTests.some((test: unknown) => (test as { status: string }).status === 'ERROR');
  const hasFailure = allTests.some((test: unknown) => (test as { status: string }).status === 'FAIL');
  
  diagnostics.overall = {
    status: hasError ? 'ERROR' : hasFailure ? 'FAIL' : 'PASS',
    summary: hasError ? 'Some tests had errors' : hasFailure ? 'Some tests failed' : 'All tests passed'
  };

  console.log('[ProxyHealth] Diagnostics complete:', diagnostics);

  return NextResponse.json(diagnostics, {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}