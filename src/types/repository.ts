/**
 * GitHub リポジトリの型定義
 */
export interface Repository {
  id: number
  name: string
  full_name: string
  owner: {
    login: string
    avatar_url: string
  }
  description: string | null
  private: boolean
  html_url: string
  updated_at: string
  pushed_at: string
  language: string | null
  stargazers_count: number
  forks_count: number
  default_branch: string
}

/**
 * リポジトリリストのレスポンス型
 */
export interface RepositoriesResponse {
  repositories: Repository[]
  cached: boolean
  cachedAt: string
}
