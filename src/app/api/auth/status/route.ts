import { NextResponse } from 'next/server';
import { getApiKeyFromCookie } from '@/lib/cookie-auth';
import { getEncryptionService } from '@/lib/encryption';
import { 
  getGitHubTokenFromCookie, 
  getGitHubUser, 
  isGitHubAuthenticated 
} from '@/lib/github-oauth';

export async function GET() {
  try {
    // Check if single profile mode is enabled
    const singleProfileMode = process.env.SINGLE_PROFILE_MODE === 'true' || 
                              process.env.NEXT_PUBLIC_SINGLE_PROFILE_MODE === 'true';
    
    if (!singleProfileMode) {
      return NextResponse.json(
        { 
          singleProfileMode: false,
          authenticated: false,
          message: 'Single profile mode is not enabled'
        },
        { status: 200 }
      );
    }

    // Check both API key and GitHub OAuth authentication
    const apiKey = await getApiKeyFromCookie();
    const githubAuthenticated = await isGitHubAuthenticated();
    
    const authenticated = !!apiKey || githubAuthenticated;
    
    // Calculate token hash if authenticated with API key
    let tokenHash = null;
    if (apiKey) {
      try {
        const encryptionService = getEncryptionService();
        tokenHash = encryptionService.hashApiToken(apiKey);
      } catch (err) {
        console.error('Failed to hash API token:', err);
      }
    }

    // Get GitHub user data if authenticated with GitHub
    let githubUser = null;
    if (githubAuthenticated) {
      try {
        const githubToken = await getGitHubTokenFromCookie();
        if (githubToken) {
          githubUser = await getGitHubUser(githubToken);
        }
      } catch (err) {
        console.error('Failed to get GitHub user data:', err);
      }
    }

    // Determine authentication method
    let authMethod = 'none';
    if (apiKey && githubAuthenticated) {
      authMethod = 'both';
    } else if (apiKey) {
      authMethod = 'api_key';
    } else if (githubAuthenticated) {
      authMethod = 'github_oauth';
    }

    return NextResponse.json(
      { 
        singleProfileMode: true,
        authenticated,
        authMethod,
        tokenHash,
        githubUser,
        message: authenticated ? 'Authenticated' : 'Not authenticated'
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Auth status error:', error);
    return NextResponse.json(
      { 
        singleProfileMode: false,
        authenticated: false,
        error: 'Internal server error'
      },
      { status: 500 }
    );
  }
}