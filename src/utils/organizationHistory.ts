import { RepositoryHistoryItem, loadFullGlobalSettings } from '../types/settings';

const ORGANIZATION_HISTORY_PREFIX = 'agentapi-org-history-';
const MAX_HISTORY_SIZE = 10;

export interface OrganizationRepositoryHistory {
  organization: string;
  repositories: RepositoryHistoryItem[];
}

export type { RepositoryHistoryItem };

export class OrganizationHistory {
  // 組織固有のキーを生成
  private static getOrganizationKey(organization: string): string {
    return `${ORGANIZATION_HISTORY_PREFIX}${organization}`;
  }

  static getOrganizationHistory(organization: string): RepositoryHistoryItem[] {
    if (!organization) return [];

    try {
      const key = this.getOrganizationKey(organization);
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

  static addRepositoryToOrganization(organization: string, repository: string): void {
    if (!organization || !repository.trim()) return;

    const history = this.getOrganizationHistory(organization);
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
      const key = this.getOrganizationKey(organization);
      localStorage.setItem(key, JSON.stringify(trimmed));
    } catch {
      // ストレージエラーを無視
    }
  }

  static getAllOrganizationHistories(): OrganizationRepositoryHistory[] {
    const histories: OrganizationRepositoryHistory[] = [];

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(ORGANIZATION_HISTORY_PREFIX)) {
          const organization = key.substring(ORGANIZATION_HISTORY_PREFIX.length);
          const repositories = this.getOrganizationHistory(organization);
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

  static clearOrganizationHistory(organization: string): void {
    if (!organization) return;

    try {
      const key = this.getOrganizationKey(organization);
      localStorage.removeItem(key);
    } catch {
      // ストレージエラーを無視
    }
  }

  static clearAllOrganizationHistories(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(ORGANIZATION_HISTORY_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
      // ストレージエラーを無視
    }
  }

  static searchOrganizationRepositories(organization: string, query: string): string[] {
    const history = this.getOrganizationHistory(organization);
    const lowerQuery = query.toLowerCase();

    return history
      .filter(item => item.repository.toLowerCase().includes(lowerQuery))
      .map(item => item.repository);
  }

  // グローバルのリポジトリ履歴からサジェストを取得
  static getRepositorySuggestions(query?: string): string[] {
    try {
      const settings = loadFullGlobalSettings();
      if (!settings || !settings.repositoryHistory) return [];

      let repositories: string[] = settings.repositoryHistory
        .map(item => item.repository)
        .filter(repo => repo && repo.trim());

      if (query && query.trim()) {
        const lowerQuery = query.toLowerCase();
        repositories = repositories.filter(repo =>
          repo.toLowerCase().includes(lowerQuery)
        );
      }

      // 重複を削除して最新使用順でソート
      const uniqueRepositories: string[] = [...new Set(repositories)];
      return uniqueRepositories.slice(0, MAX_HISTORY_SIZE);
    } catch {
      return [];
    }
  }
}
