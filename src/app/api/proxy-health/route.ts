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
    tests: {} as Record<string, unknown>
  };

  // Test 1: Check if single profile mode is enabled
  const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true';
  (diagnostics.tests as Record<string, unknown>).singleProfileMode = {
    enabled: singleProfileMode,
    status: singleProfileMode ? 'PASS' : 'FAIL',
    message: singleProfileMode ? 'Single profile mode is enabled' : 'Single profile mode is not enabled'
  };

  // Test 2: Check API key from cookie
  try {
    const apiKey = await getApiKeyFromCookie();
    (diagnostics.tests as Record<string, unknown>).apiKeyCookie = {
      hasApiKey: !!apiKey,
      apiKeyLength: apiKey?.length || 0,
      status: apiKey ? 'PASS' : 'FAIL',
      message: apiKey ? 'API key found in cookie' : 'No API key found in cookie'
    };
  } catch (error) {
    (diagnostics.tests as Record<string, unknown>).apiKeyCookie = {
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

    (diagnostics.tests as Record<string, unknown>).proxyConnection = {
      status: response.ok ? 'PASS' : 'FAIL',
      httpStatus: response.status,
      statusText: response.statusText,
      message: response.ok ? 'Successfully connected to agentapi-proxy' : `agentapi-proxy returned ${response.status}`
    };

    if (response.ok) {
      try {
        const data = await response.text();
        ((diagnostics.tests as Record<string, unknown>).proxyConnection as Record<string, unknown>).responseData = data;
      } catch {
        ((diagnostics.tests as Record<string, unknown>).proxyConnection as Record<string, unknown>).responseData = 'Could not parse response';
      }
    }
  } catch (error) {
    (diagnostics.tests as Record<string, unknown>).proxyConnection = {
      status: 'ERROR',
      message: `Failed to connect to agentapi-proxy: ${error instanceof Error ? error.message : 'Unknown error'}`,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message
      } : 'Unknown error'
    };
  }

  // Test 4: Try multiple authenticated endpoints if we have an API key
  if (((diagnostics.tests as Record<string, unknown>).apiKeyCookie as Record<string, unknown>)?.hasApiKey) {
    try {
      const apiKey = await getApiKeyFromCookie();
      console.log(`[ProxyHealth] Testing authenticated requests with API key`);
      
      // Test multiple possible endpoints
      const endpointsToTest = [
        { path: '/sessions', description: 'Sessions endpoint' },
        { path: '/api/sessions', description: 'API Sessions endpoint' },
        { path: '/v1/sessions', description: 'V1 Sessions endpoint' },
        { path: '/', description: 'Root endpoint' },
        { path: '/api', description: 'API root endpoint' },
        { path: '/agents', description: 'Agents endpoint' },
        { path: '/api/agents', description: 'API Agents endpoint' },
      ];

      const testResults = [];

      for (const endpoint of endpointsToTest) {
        try {
          const response = await fetch(`${PROXY_URL}${endpoint.path}`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
            signal: AbortSignal.timeout(5000)
          });

          const result: Record<string, unknown> = {
            path: endpoint.path,
            description: endpoint.description,
            status: response.status,
            statusText: response.statusText,
            success: response.ok
          };

          if (response.ok) {
            try {
              const data = await response.text();
              result.responseData = data.substring(0, 200); // Limit response data
            } catch {
              result.responseData = 'Could not parse response';
            }
          } else {
            try {
              const errorData = await response.text();
              result.errorData = errorData.substring(0, 200);
            } catch {
              result.errorData = 'Could not parse error';
            }
          }

          testResults.push(result);
        } catch (error) {
          testResults.push({
            path: endpoint.path,
            description: endpoint.description,
            status: 0,
            statusText: 'Network Error',
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      const successfulEndpoints = testResults.filter(result => (result as Record<string, unknown>).success);
      
      (diagnostics.tests as Record<string, unknown>).authenticatedRequest = {
        status: successfulEndpoints.length > 0 ? 'PASS' : 'FAIL',
        message: successfulEndpoints.length > 0 
          ? `Found ${successfulEndpoints.length} working endpoints` 
          : 'No working authenticated endpoints found',
        successfulEndpoints: successfulEndpoints.map(ep => (ep as Record<string, unknown>).path),
        allResults: testResults
      };

    } catch (error) {
      (diagnostics.tests as Record<string, unknown>).authenticatedRequest = {
        status: 'ERROR',
        message: `Authenticated request testing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  } else {
    (diagnostics.tests as Record<string, unknown>).authenticatedRequest = {
      status: 'SKIP',
      message: 'Skipped - no API key available'
    };
  }

  // Overall status
  const allTests = Object.values(diagnostics.tests as Record<string, unknown>);
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