import { ProfileManager } from '../utils/profileManager';
import { createAgentAPIProxyClientFromStorage } from '../lib/agentapi-proxy-client';
import { GitHubUser } from '../types/profile';

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
      const authInfo = await client.getAuthInfo();
      
      // Update profile with auth info if authenticated
      if (authInfo.authenticated && authInfo.type === 'github' && authInfo.user) {
        const profile = ProfileManager.getProfile(profileId);
        if (profile) {
          profile.githubAuth = {
            enabled: true,
            user: authInfo.user,
            scopes: (authInfo as any).scopes || [],
            organizations: (authInfo as any).organizations || [],
            repositories: (authInfo as any).repositories || []
          };
          ProfileManager.updateProfile(profile);
        }
      }
      
      return authInfo;
    } catch (error) {
      console.error('Failed to check auth status:', error);
      return { type: 'none', authenticated: false };
    }
  }

  async startGitHubAuth(profileId: string): Promise<string> {
    try {
      const client = createAgentAPIProxyClientFromStorage(undefined, profileId);
      const authUrl = await client.getGitHubAuthUrl(profileId);
      
      // Open auth URL in a new window
      window.open(authUrl, 'github-auth', 'width=500,height=700');
      
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
    const profile = ProfileManager.getProfile(profileId);
    if (profile) {
      profile.githubAuth = undefined;
      ProfileManager.updateProfile(profile);
    }
  }

  isTokenExpired(tokenExpiresAt?: string): boolean {
    if (!tokenExpiresAt) return true;
    return new Date(tokenExpiresAt) < new Date();
  }
}

export const githubAuthService = GitHubAuthService.getInstance();