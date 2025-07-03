'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, CreateSessionRequest } from '../types/agentapi';
import { SessionManager, createSessionManager } from '../lib/session-manager';
import { createAgentAPIProxyClientFromStorage } from '../lib/agentapi-proxy-client';
import { ProfileManager } from '../utils/profileManager';

interface SessionContextValue {
  // Session management
  sessions: Session[];
  currentSession: Session | null;
  isLoading: boolean;
  error: Error | null;
  
  // Actions
  createSession: (data?: Partial<CreateSessionRequest>) => Promise<Session>;
  selectSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  clearSessions: () => Promise<void>;
  
  // Session stats
  sessionStats: {
    total: number;
    active: number;
    inactive: number;
    error: number;
  };
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: React.ReactNode;
  profileId?: string;
  autoSync?: boolean;
  syncInterval?: number;
}

export function SessionProvider({ 
  children, 
  profileId,
  autoSync = true,
  syncInterval = 30000 
}: SessionProviderProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [sessionManager, setSessionManager] = useState<SessionManager | null>(null);
  const [sessionStats, setSessionStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    error: 0
  });

  // Initialize session manager
  useEffect(() => {
    const effectiveProfileId = profileId || ProfileManager.getCurrentProfileId() || undefined;
    const client = createAgentAPIProxyClientFromStorage(undefined, effectiveProfileId);
    const manager = createSessionManager(client, { syncInterval });
    
    setSessionManager(manager);
    
    if (autoSync) {
      manager.startSync();
    }
    
    // Initial load
    loadSessions(manager);
    
    return () => {
      manager.stopSync();
    };
  }, [profileId, autoSync, syncInterval]);

  // Load sessions
  const loadSessions = async (manager: SessionManager) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const userSessions = await manager.getUserSessions();
      setSessions(userSessions);
      
      // Update stats
      const stats = await manager.getSessionStats();
      setSessionStats(stats);
      
      // Select first active session if none selected
      if (!currentSession && userSessions.length > 0) {
        const activeSession = userSessions.find(s => s.status === 'active');
        if (activeSession) {
          setCurrentSession(activeSession);
        }
      }
    } catch (err) {
      setError(err as Error);
      console.error('Failed to load sessions:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Create new session
  const createSession = useCallback(async (data?: Partial<CreateSessionRequest>): Promise<Session> => {
    if (!sessionManager) {
      throw new Error('Session manager not initialized');
    }
    
    try {
      setError(null);
      const session = await sessionManager.createSession(data);
      
      // Refresh session list
      await loadSessions(sessionManager);
      
      // Auto-select new session
      setCurrentSession(session);
      
      return session;
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [sessionManager]);

  // Select session
  const selectSession = useCallback(async (sessionId: string) => {
    if (!sessionManager) {
      throw new Error('Session manager not initialized');
    }
    
    try {
      setError(null);
      const session = await sessionManager.getSession(sessionId);
      
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
      }
      
      setCurrentSession(session);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [sessionManager]);

  // Delete session
  const deleteSession = useCallback(async (sessionId: string) => {
    if (!sessionManager) {
      throw new Error('Session manager not initialized');
    }
    
    try {
      setError(null);
      await sessionManager.deleteSession(sessionId);
      
      // Clear current session if it was deleted
      if (currentSession?.session_id === sessionId) {
        setCurrentSession(null);
      }
      
      // Refresh session list
      await loadSessions(sessionManager);
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [sessionManager, currentSession]);

  // Refresh sessions
  const refreshSessions = useCallback(async () => {
    if (!sessionManager) {
      return;
    }
    
    await loadSessions(sessionManager);
  }, [sessionManager]);

  // Clear all sessions
  const clearSessions = useCallback(async () => {
    if (!sessionManager) {
      throw new Error('Session manager not initialized');
    }
    
    try {
      setError(null);
      await sessionManager.clearLocalSessions();
      
      setSessions([]);
      setCurrentSession(null);
      setSessionStats({
        total: 0,
        active: 0,
        inactive: 0,
        error: 0
      });
    } catch (err) {
      setError(err as Error);
      throw err;
    }
  }, [sessionManager]);

  const value: SessionContextValue = {
    sessions,
    currentSession,
    isLoading,
    error,
    createSession,
    selectSession,
    deleteSession,
    refreshSessions,
    clearSessions,
    sessionStats
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

// Hook for session-aware components
export function useCurrentSession() {
  const { currentSession } = useSession();
  return currentSession;
}

// Hook for session creation
export function useCreateSession() {
  const { createSession, isLoading, error } = useSession();
  return { createSession, isLoading, error };
}

// Hook for session list
export function useSessionList() {
  const { sessions, refreshSessions, isLoading, error } = useSession();
  return { sessions, refreshSessions, isLoading, error };
}