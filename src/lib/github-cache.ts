import { createHash } from 'crypto';
import { GitHubRepository } from '@/types/github';

interface CacheEntry {
  repositories: GitHubRepository[];
  fetchedAt: number;
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ENTRIES = 100;

// In-memory cache for GitHub repositories
const repositoryCache = new Map<string, CacheEntry>();

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getCachedRepositories(tokenHash: string): GitHubRepository[] | null {
  const entry = repositoryCache.get(tokenHash);

  if (!entry) {
    return null;
  }

  // Check if expired
  if (Date.now() > entry.expiresAt) {
    repositoryCache.delete(tokenHash);
    return null;
  }

  return entry.repositories;
}

export function setCachedRepositories(tokenHash: string, repositories: GitHubRepository[]): void {
  // Cleanup if we're at max capacity
  if (repositoryCache.size >= MAX_ENTRIES) {
    cleanupExpiredEntries();

    // If still at capacity, remove oldest entries
    if (repositoryCache.size >= MAX_ENTRIES) {
      const entriesToRemove = repositoryCache.size - MAX_ENTRIES + 1;
      const keys = Array.from(repositoryCache.keys());
      for (let i = 0; i < entriesToRemove; i++) {
        repositoryCache.delete(keys[i]);
      }
    }
  }

  const now = Date.now();
  repositoryCache.set(tokenHash, {
    repositories,
    fetchedAt: now,
    expiresAt: now + TTL_MS,
  });
}

export function getCacheExpiresAt(tokenHash: string): Date | null {
  const entry = repositoryCache.get(tokenHash);
  if (!entry) return null;
  return new Date(entry.expiresAt);
}

function cleanupExpiredEntries(): void {
  const now = Date.now();
  for (const [key, entry] of repositoryCache.entries()) {
    if (now > entry.expiresAt) {
      repositoryCache.delete(key);
    }
  }
}

export function invalidateCache(tokenHash: string): void {
  repositoryCache.delete(tokenHash);
}
