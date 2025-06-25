const ORGANIZATION_HISTORY_PREFIX = 'agentapi-org-history-';
const MAX_HISTORY_SIZE = 10;

export interface OrganizationRepositoryHistory {
  organization: string;
  repositories: RepositoryHistoryItem[];
}

export interface RepositoryHistoryItem {
  repository: string;
  lastUsed: Date;
}

export class OrganizationHistory {
  // プロファイル固有のキーを生成
  private static getProfileOrganizationKey(profileId: string, organization: string): string {
    return `${ORGANIZATION_HISTORY_PREFIX}${profileId}-${organization}`;
  }

  static getOrganizationHistory(profileId: string, organization: string): RepositoryHistoryItem[] {
    if (!profileId || !organization) return [];
    
    try {
      const key = this.getProfileOrganizationKey(profileId, organization);
      const stored = localStorage.getItem(key);
      if (!stored) return [];
      
      const items = JSON.parse(stored) as Array<{repository: string; lastUsed: string}>;
      return items.map(item => ({
        repository: item.repository,
        lastUsed: new Date(item.lastUsed)
      }));
    } catch {
      return [];
    }
  }

  static addRepositoryToOrganization(profileId: string, organization: string, repository: string): void {
    if (!profileId || !organization || !repository.trim()) return;

    const history = this.getOrganizationHistory(profileId, organization);
    const existing = history.findIndex(item => item.repository === repository);
    
    if (existing !== -1) {
      history[existing].lastUsed = new Date();
    } else {
      history.unshift({
        repository,
        lastUsed: new Date()
      });
    }

    history.sort((a, b) => b.lastUsed.getTime() - a.lastUsed.getTime());
    
    const trimmed = history.slice(0, MAX_HISTORY_SIZE);
    
    try {
      const key = this.getProfileOrganizationKey(profileId, organization);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch {
      // ストレージエラーを無視
    }
  }

  static getAllOrganizationHistories(profileId: string): OrganizationRepositoryHistory[] {
    if (!profileId) return [];
    
    const histories: OrganizationRepositoryHistory[] = [];
    const profilePrefix = `${ORGANIZATION_HISTORY_PREFIX}${profileId}-`;
    
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(profilePrefix)) {
          const organization = key.substring(profilePrefix.length);
          const repositories = this.getOrganizationHistory(profileId, organization);
          if (repositories.length > 0) {
            histories.push({ organization, repositories });
          }
        }
      }
    } catch {
      // ストレージエラーを無視
    }
    
    return histories;
  }

  static clearOrganizationHistory(profileId: string, organization: string): void {
    if (!profileId || !organization) return;
    
    try {
      const key = this.getProfileOrganizationKey(profileId, organization);
      localStorage.removeItem(key);
    } catch {
      // ストレージエラーを無視
    }
  }

  static clearAllOrganizationHistories(profileId: string): void {
    if (!profileId) return;
    
    try {
      const profilePrefix = `${ORGANIZATION_HISTORY_PREFIX}${profileId}-`;
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(profilePrefix)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // ストレージエラーを無視
    }
  }

  static searchOrganizationRepositories(profileId: string, organization: string, query: string): string[] {
    const history = this.getOrganizationHistory(profileId, organization);
    const lowerQuery = query.toLowerCase();
    
    return history
      .filter(item => item.repository.toLowerCase().includes(lowerQuery))
      .map(item => item.repository);
  }

  // プロファイル内のリポジトリ履歴からサジェストを取得（グローバル履歴を使わない）
  static getProfileRepositorySuggestions(profileId: string, query?: string): string[] {
    if (!profileId) return [];
    
    try {
      // プロファイルのリポジトリ履歴を直接 localStorage から取得
      const profileKey = `agentapi-profile-${profileId}`;
      const stored = localStorage.getItem(profileKey);
      if (!stored) return [];
      
      const profile = JSON.parse(stored);
      if (!profile || !profile.repositoryHistory) return [];
      
      let repositories = profile.repositoryHistory
        .map((item: {repository: string}) => item.repository)
        .filter((repo: string) => repo && repo.trim());
      
      if (query && query.trim()) {
        const lowerQuery = query.toLowerCase();
        repositories = repositories.filter((repo: string) => 
          repo.toLowerCase().includes(lowerQuery)
        );
      }
      
      // 重複を削除して最新使用順でソート
      const uniqueRepositories = [...new Set(repositories)];
      return uniqueRepositories.slice(0, MAX_HISTORY_SIZE);
    } catch {
      return [];
    }
  }
}