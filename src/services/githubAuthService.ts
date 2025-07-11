import { ProfileManager } from '../utils/profileManager';
import { createAgentAPIProxyClientFromStorage } from '../lib/agentapi-proxy-client';
import { GitHubUser, GitHubAuthSettings } from '../types/profile';

export class GitHubAuthService {
  private static instance: GitHubAuthService;

  private constructor() {}

  static getInstance(): GitHubAuthService {
    if (!GitHubAuthService.instance) {
      GitHubAuthService.instance = new GitHubAuthService();
    }
    return GitHubAuthService.instance;
  }

  async checkAuthStatus(profileId: string): Promise<{ type: 'github' | 'none'; authenticated: boolean; user?: GitHubUser }> {
    try {
      const client = createAgentAPIProxyClientFromStorage(undefined, profileId);
      
      // First check if we have OAuth session in cookie (only on client side)
      let sessionId: string | undefined;
      if (typeof window !== 'undefined') {
        // On client side, we can check profile for session ID
        const profile = ProfileManager.getProfile(profileId);
        sessionId = profile?.githubAuth?.sessionId;
      }
      
      const authStatus = await client.getOAuthStatus(sessionId);
      
      if (authStatus.authenticated && authStatus.user) {
        // Update profile with latest auth info
        const githubAuthUpdate: Partial<GitHubAuthSettings> = {
          enabled: true,
          user: authStatus.user,
          scopes: [],
          organizations: [],
          repositories: []
        };
        
        // If we got a session ID from the response, store it
        if (authStatus.sessionId) {
          githubAuthUpdate.sessionId = authStatus.sessionId;
        }
        
        ProfileManager.updateProfile(profileId, {
          githubAuth: githubAuthUpdate as GitHubAuthSettings
        });
        
        return {
          type: 'github',
          authenticated: true,
          user: authStatus.user
        };
      } else {
        // No authentication, remove from profile
        ProfileManager.updateProfile(profileId, {
          githubAuth: undefined
        });
        return { type: 'none', authenticated: false };
      }
    } catch (error) {
      console.error('Failed to check auth status:', error);
      return { type: 'none', authenticated: false };
    }
  }

  async startGitHubAuth(profileId: string): Promise<string> {
    try {
      const client = createAgentAPIProxyClientFromStorage(undefined, profileId);
      
      // Generate OAuth URL using the proxy client with profileId in metadata
      const redirectURI = `${window.location.origin}/oauth/callback`;
      const { authUrl } = await client.startOAuthFlow(redirectURI, { profileId });
      
      // Open auth URL in a new window
      const authWindow = window.open(authUrl, 'github-auth', 'width=500,height=700');
      
      // Listen for messages from the auth window
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        
        if (event.data.type === 'oauth-success') {
          window.removeEventListener('message', handleMessage);
          // Refresh the current page to update auth status
          window.location.reload();
        } else if (event.data.type === 'oauth-error') {
          window.removeEventListener('message', handleMessage);
          console.error('OAuth error:', event.data.error);
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      // Clean up listener if window is closed manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
        }
      }, 1000);
      
      return authUrl;
    } catch (error) {
      console.error('Failed to start GitHub auth:', error);
      throw error;
    }
  }

  async waitForAuth(profileId: string, maxAttempts = 60, intervalMs = 2000): Promise<boolean> {
    for (let i = 0; i < maxAttempts; i++) {
      const authStatus = await this.checkAuthStatus(profileId);
      if (authStatus.authenticated) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    
    return false;
  }

  async disconnect(profileId: string): Promise<void> {
    try {
      const client = createAgentAPIProxyClientFromStorage(undefined, profileId);
      await client.logoutOAuth();
    } catch (error) {
      console.error('Failed to logout from GitHub:', error);
    }

    // Always remove local auth info
    ProfileManager.updateProfile(profileId, {
      githubAuth: undefined
    });
  }

  isTokenExpired(tokenExpiresAt?: string): boolean {
    if (!tokenExpiresAt) return true;
    return new Date(tokenExpiresAt) < new Date();
  }
}

export const githubAuthService = GitHubAuthService.getInstance();