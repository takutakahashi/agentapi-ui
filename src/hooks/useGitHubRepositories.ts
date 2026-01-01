'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDebounce } from './useDebounce';
import { GitHubRepository, RepositoryListResponse, RepositoryListError } from '@/types/github';

interface UseGitHubRepositoriesOptions {
  enabled?: boolean;
  debounceMs?: number;
}

interface UseGitHubRepositoriesReturn {
  repositories: GitHubRepository[];
  isLoading: boolean;
  error: string | null;
  isCached: boolean;
  refetch: () => void;
}

/**
 * GitHubリポジトリを取得するフック
 * @param query 検索クエリ
 * @param options オプション
 * @returns リポジトリリスト、ローディング状態、エラー
 */
export function useGitHubRepositories(
  query: string,
  options: UseGitHubRepositoriesOptions = {}
): UseGitHubRepositoriesReturn {
  const { enabled = true, debounceMs = 300 } = options;

  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCached, setIsCached] = useState(false);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const debouncedQuery = useDebounce(query, debounceMs);

  const fetchRepositories = useCallback(async (searchQuery: string) => {
    console.log('[useGitHubRepositories] Fetching repositories, query:', searchQuery);
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (searchQuery) {
        params.set('q', searchQuery);
      }

      const url = `/api/github/repositories?${params.toString()}`;
      console.log('[useGitHubRepositories] Fetching URL:', url);
      const response = await fetch(url);
      console.log('[useGitHubRepositories] Response status:', response.status);

      if (!response.ok) {
        const errorData: RepositoryListError = await response.json();
        console.log('[useGitHubRepositories] Error response:', errorData);
        // NO_GITHUB_TOKEN with empty repos means API key auth - not an error
        if (errorData.code === 'NO_GITHUB_TOKEN' && response.status === 401) {
          setRepositories([]);
          setIsCached(false);
          return;
        }
        throw new Error(errorData.message || errorData.error);
      }

      const data: RepositoryListResponse = await response.json();
      console.log('[useGitHubRepositories] Success, repos count:', data.repositories.length, 'cached:', data.cached);
      setRepositories(data.repositories);
      setIsCached(data.cached);
    } catch (err) {
      console.error('[useGitHubRepositories] Fetch error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('リポジトリの取得に失敗しました');
      }
      setRepositories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setRepositories([]);
      setIsLoading(false);
      return;
    }

    fetchRepositories(debouncedQuery);
  }, [debouncedQuery, enabled, fetchRepositories, fetchTrigger]);

  const refetch = useCallback(() => {
    setFetchTrigger((prev) => prev + 1);
  }, []);

  return {
    repositories,
    isLoading,
    error,
    isCached,
    refetch,
  };
}
