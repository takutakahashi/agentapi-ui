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
  static getOrganizationHistory(organization: string): RepositoryHistoryItem[] {
    if (!organization) return [];
    
    try {
      const key = `${ORGANIZATION_HISTORY_PREFIX}${organization}`;
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
      const key = `${ORGANIZATION_HISTORY_PREFIX}${organization}`;
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
      const key = `${ORGANIZATION_HISTORY_PREFIX}${organization}`;
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
}