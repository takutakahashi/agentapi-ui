import { Session, CreateSessionRequest } from '../types/agentapi';
import { AgentAPIProxyClient } from './agentapi-proxy-client';
import { SessionStore, getDefaultSessionStore, SessionCache } from './session-store';

export interface SessionManagerOptions {
  store?: SessionStore;
  cache?: SessionCache;
  syncInterval?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export class SessionManager {
  private client: AgentAPIProxyClient;
  private store: SessionStore;
  private cache: SessionCache;
  private syncInterval: number;
  private maxRetries: number;
  private retryDelay: number;
  private syncTimer?: NodeJS.Timeout;

  constructor(client: AgentAPIProxyClient, options: SessionManagerOptions = {}) {
    this.client = client;
    this.store = options.store || getDefaultSessionStore();
    this.cache = options.cache || new SessionCache(300); // 5 minute default TTL
    this.syncInterval = options.syncInterval || 30000; // 30 seconds default
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
  }

  /**
   * Create a new session with server-side persistence
   */
  async createSession(data?: Partial<CreateSessionRequest>): Promise<Session> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Create session via API
        const session = await this.client.start(data);

        // Store locally
        await this.store.set(session);

        // Cache for quick access
        this.cache.set(session);

        return session;
      } catch (error) {
        lastError = error as Error;
        console.error(`Failed to create session (attempt ${attempt}/${this.maxRetries}):`, error);

        if (attempt < this.maxRetries) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('Failed to create session after multiple attempts');
  }

  /**
   * Get session with caching and fallback to store
   */
  async getSession(sessionId: string): Promise<Session | null> {
    // Check cache first
    const cached = this.cache.get(sessionId);
    if (cached) {
      return cached;
    }

    // Check local store
    const stored = await this.store.get(sessionId);
    if (stored) {
      this.cache.set(stored);
      return stored;
    }

    // Fetch from API if not found locally
    try {
      const sessions = await this.client.search({ 
        limit: 1,
        // Search by session ID would require API support
      });

      const session = sessions.sessions.find(s => s.session_id === sessionId);
      if (session) {
        await this.store.set(session);
        this.cache.set(session);
        return session;
      }
    } catch (error) {
      console.error('Failed to fetch session from API:', error);
    }

    return null;
  }

  /**
   * Update session status
   */
  async updateSessionStatus(sessionId: string, status: 'active' | 'inactive' | 'error'): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Update local copy
    session.status = status;
    session.updated_at = new Date().toISOString();

    // Store updated session
    await this.store.set(session);
    this.cache.set(session);

    // Note: Actual API update would require endpoint support
  }

  /**
   * Delete session with cleanup
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      // Delete from API
      await this.client.delete(sessionId);
    } catch (error) {
      console.error('Failed to delete session from API:', error);
    }

    // Delete from local storage
    await this.store.delete(sessionId);
    
    // Remove from cache
    this.cache.delete(sessionId);
  }

  /**
   * Get all sessions for current user
   */
  async getUserSessions(userId?: string): Promise<Session[]> {
    // Get from local store first
    const localSessions = userId 
      ? await this.store.getByUserId(userId)
      : await this.store.getAll();

    // Optionally sync with API
    try {
      const apiResponse = await this.client.search({
        user_id: userId,
        limit: 100
      });

      // Merge and deduplicate
      const sessionMap = new Map<string, Session>();
      
      // Add local sessions first
      localSessions.forEach(session => {
        sessionMap.set(session.session_id, session);
      });

      // Update with API sessions (more recent)
      apiResponse.sessions.forEach(session => {
        sessionMap.set(session.session_id, session);
      });

      // Update local store with merged data
      const mergedSessions = Array.from(sessionMap.values());
      for (const session of mergedSessions) {
        await this.store.set(session);
      }

      return mergedSessions;
    } catch (error) {
      console.error('Failed to sync sessions with API:', error);
      // Fall back to local sessions
      return localSessions;
    }
  }

  /**
   * Start automatic synchronization
   */
  startSync(): void {
    if (this.syncTimer) {
      return;
    }

    this.syncTimer = setInterval(async () => {
      try {
        await this.syncSessions();
      } catch (error) {
        console.error('Session sync failed:', error);
      }
    }, this.syncInterval);

    // Run initial sync
    this.syncSessions().catch(console.error);
  }

  /**
   * Stop automatic synchronization
   */
  stopSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  /**
   * Manually trigger session synchronization
   */
  async syncSessions(): Promise<void> {
    try {
      // Get all local sessions
      const localSessions = await this.store.getAll();
      
      // Get sessions from API
      const apiResponse = await this.client.search({ limit: 100 });
      
      // Create maps for efficient lookup
      const localMap = new Map(localSessions.map(s => [s.session_id, s]));
      const apiMap = new Map(apiResponse.sessions.map(s => [s.session_id, s]));
      
      // Update local store with API sessions
      for (const apiSession of apiResponse.sessions) {
        const localSession = localMap.get(apiSession.session_id);
        
        // Update if API version is newer or doesn't exist locally
        if (!localSession || new Date(apiSession.updated_at) > new Date(localSession.updated_at)) {
          await this.store.set(apiSession);
          this.cache.set(apiSession);
        }
      }
      
      // Remove local sessions that don't exist in API
      for (const localSession of localSessions) {
        if (!apiMap.has(localSession.session_id)) {
          await this.store.delete(localSession.session_id);
          this.cache.delete(localSession.session_id);
        }
      }
      
      // Clean up expired cache entries
      this.cache.cleanup();
    } catch (error) {
      console.error('Failed to sync sessions:', error);
      throw error;
    }
  }

  /**
   * Clear all local session data
   */
  async clearLocalSessions(): Promise<void> {
    await this.store.clear();
    this.cache.clear();
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    error: number;
  }> {
    const sessions = await this.store.getAll();
    
    return {
      total: sessions.length,
      active: sessions.filter(s => s.status === 'active').length,
      inactive: sessions.filter(s => s.status === 'inactive').length,
      error: sessions.filter(s => s.status === 'error').length
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Factory function
export function createSessionManager(
  client: AgentAPIProxyClient,
  options?: SessionManagerOptions
): SessionManager {
  return new SessionManager(client, options);
}

// Global instance management
let defaultManager: SessionManager | null = null;

export function getDefaultSessionManager(client: AgentAPIProxyClient): SessionManager {
  if (!defaultManager) {
    defaultManager = new SessionManager(client);
  }
  return defaultManager;
}

export function setDefaultSessionManager(manager: SessionManager): void {
  defaultManager = manager;
}