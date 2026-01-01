// GitHub Repository types for repository list API

export interface GitHubRepository {
  id: number;
  full_name: string;        // "owner/repo"
  name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
  description: string | null;
  private: boolean;
  html_url: string;
  updated_at: string;
  pushed_at: string;
  stargazers_count: number;
  language: string | null;
}

export interface RepositoryListResponse {
  repositories: GitHubRepository[];
  cached: boolean;
  cache_expires_at?: string;
}

export interface RepositoryListError {
  error: string;
  code: 'NO_GITHUB_TOKEN' | 'GITHUB_API_ERROR' | 'RATE_LIMITED' | 'INTERNAL_ERROR';
  message?: string;
  retry_after?: number;
}
