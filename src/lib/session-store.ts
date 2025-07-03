import { Session } from '../types/agentapi';

export interface SessionStore {
  get(sessionId: string): Promise<Session | null>;
  set(session: Session): Promise<void>;
  delete(sessionId: string): Promise<void>;
  has(sessionId: string): Promise<boolean>;
  clear(): Promise<void>;
  getAll(): Promise<Session[]>;
  getByUserId(userId: string): Promise<Session[]>;
}

export class MemorySessionStore implements SessionStore {
  private sessions: Map<string, Session> = new Map();

  async get(sessionId: string): Promise<Session | null> {
    return this.sessions.get(sessionId) || null;
  }

  async set(session: Session): Promise<void> {
    this.sessions.set(session.session_id, session);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async has(sessionId: string): Promise<boolean> {
    return this.sessions.has(sessionId);
  }

  async clear(): Promise<void> {
    this.sessions.clear();
  }

  async getAll(): Promise<Session[]> {
    return Array.from(this.sessions.values());
  }

  async getByUserId(userId: string): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(
      session => session.user_id === userId
    );
  }
}

export class LocalStorageSessionStore implements SessionStore {
  private readonly storageKey = 'agentapi-sessions';

  private getStoredSessions(): Map<string, Session> {
    if (typeof window === 'undefined') {
      return new Map();
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return new Map();
      }

      const parsed = JSON.parse(stored);
      return new Map(Object.entries(parsed));
    } catch (error) {
      console.error('Failed to parse stored sessions:', error);
      return new Map();
    }
  }

  private saveStoredSessions(sessions: Map<string, Session>): void {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const obj = Object.fromEntries(sessions);
      localStorage.setItem(this.storageKey, JSON.stringify(obj));
    } catch (error) {
      console.error('Failed to save sessions to localStorage:', error);
    }
  }

  async get(sessionId: string): Promise<Session | null> {
    const sessions = this.getStoredSessions();
    return sessions.get(sessionId) || null;
  }

  async set(session: Session): Promise<void> {
    const sessions = this.getStoredSessions();
    sessions.set(session.session_id, session);
    this.saveStoredSessions(sessions);
  }

  async delete(sessionId: string): Promise<void> {
    const sessions = this.getStoredSessions();
    sessions.delete(sessionId);
    this.saveStoredSessions(sessions);
  }

  async has(sessionId: string): Promise<boolean> {
    const sessions = this.getStoredSessions();
    return sessions.has(sessionId);
  }

  async clear(): Promise<void> {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.storageKey);
    }
  }

  async getAll(): Promise<Session[]> {
    const sessions = this.getStoredSessions();
    return Array.from(sessions.values());
  }

  async getByUserId(userId: string): Promise<Session[]> {
    const sessions = this.getStoredSessions();
    return Array.from(sessions.values()).filter(
      session => session.user_id === userId
    );
  }
}

// Session cache with TTL support
export class SessionCache {
  private cache: Map<string, { session: Session; expires: number }> = new Map();
  private readonly ttl: number;

  constructor(ttlSeconds: number = 300) {
    this.ttl = ttlSeconds * 1000;
  }

  get(sessionId: string): Session | null {
    const cached = this.cache.get(sessionId);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expires) {
      this.cache.delete(sessionId);
      return null;
    }

    return cached.session;
  }

  set(session: Session): void {
    this.cache.set(session.session_id, {
      session,
      expires: Date.now() + this.ttl
    });
  }

  delete(sessionId: string): void {
    this.cache.delete(sessionId);
  }

  clear(): void {
    this.cache.clear();
  }

  cleanup(): void {
    const now = Date.now();
    for (const [sessionId, cached] of this.cache.entries()) {
      if (now > cached.expires) {
        this.cache.delete(sessionId);
      }
    }
  }
}

// Default session store instance
let defaultStore: SessionStore | null = null;

export function getDefaultSessionStore(): SessionStore {
  if (!defaultStore) {
    // Use LocalStorage in browser, Memory in server
    defaultStore = typeof window !== 'undefined' 
      ? new LocalStorageSessionStore()
      : new MemorySessionStore();
  }
  return defaultStore;
}

export function setDefaultSessionStore(store: SessionStore): void {
  defaultStore = store;
}