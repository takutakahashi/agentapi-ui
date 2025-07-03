/**
 * プロファイル関連の型ガードとバリデーション関数
 */

import {
  ProfileId,
  ProfileName,
  ProfileDescription,
  SystemPrompt,
  HexColor,
  ValidUrl,
  ValidationResult,
  isValidProfileId,
  isValidProfileName,
  isValidUrl,
  isNonEmptyString,
  isISODateString,
  isHexColor
} from '../types/typeUtils';
import { 
  Profile, 
  ProfileListItem, 
  CreateProfileRequest, 
  UpdateProfileRequest,
  MCPServerConfig,
  GitHubAuthSettings
} from '../types/profile';
import { AgentApiProxySettings, EnvironmentVariable } from '../types/settings';
import { RepositoryHistoryItem } from './organizationHistory';
import { MessageTemplate } from '../types/messageTemplate';

/**
 * プロファイルIDの型ガード
 */
export const isProfileId = (value: unknown): value is ProfileId => {
  return isValidProfileId(value);
};

/**
 * プロファイル名の型ガード
 */
export const isProfileName = (value: unknown): value is ProfileName => {
  return isValidProfileName(value);
};

/**
 * プロファイル説明の型ガード
 */
export const isProfileDescription = (value: unknown): value is ProfileDescription => {
  return typeof value === 'string';
};

/**
 * システムプロンプトの型ガード
 */
export const isSystemPrompt = (value: unknown): value is SystemPrompt => {
  return typeof value === 'string';
};

/**
 * 環境変数の型ガード
 */
export const isEnvironmentVariable = (value: unknown): value is EnvironmentVariable => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    'key' in obj &&
    'value' in obj &&
    typeof obj.key === 'string' &&
    typeof obj.value === 'string' &&
    isNonEmptyString(obj.key)
  );
};

/**
 * 環境変数配列の型ガード
 */
export const isEnvironmentVariableArray = (value: unknown): value is EnvironmentVariable[] => {
  return Array.isArray(value) && value.every(isEnvironmentVariable);
};

/**
 * AgentApiProxySettingsの型ガード
 */
export const isAgentApiProxySettings = (value: unknown): value is AgentApiProxySettings => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'endpoint' in value &&
    typeof (value as Record<string, unknown>).endpoint === 'string' &&
    isNonEmptyString((value as Record<string, unknown>).endpoint) &&
    isValidUrl((value as Record<string, unknown>).endpoint)
  );
};

/**
 * リポジトリ履歴項目の型ガード
 */
export const isRepositoryHistoryItem = (value: unknown): value is RepositoryHistoryItem => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'repository' in value &&
    'lastUsed' in value &&
    typeof (value as Record<string, unknown>).repository === 'string' &&
    isNonEmptyString((value as Record<string, unknown>).repository) &&
    ((value as Record<string, unknown>).lastUsed instanceof Date || isISODateString((value as Record<string, unknown>).lastUsed))
  );
};

/**
 * リポジトリ履歴配列の型ガード
 */
export const isRepositoryHistoryArray = (value: unknown): value is RepositoryHistoryItem[] => {
  return Array.isArray(value) && value.every(isRepositoryHistoryItem);
};

/**
 * メッセージテンプレートの型ガード
 */
export const isMessageTemplate = (value: unknown): value is MessageTemplate => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'content' in value &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    typeof (value as Record<string, unknown>).content === 'string' &&
    isNonEmptyString((value as Record<string, unknown>).id) &&
    isNonEmptyString((value as Record<string, unknown>).name) &&
    isNonEmptyString((value as Record<string, unknown>).content)
  );
};

/**
 * メッセージテンプレート配列の型ガード
 */
export const isMessageTemplateArray = (value: unknown): value is MessageTemplate[] => {
  return Array.isArray(value) && value.every(isMessageTemplate);
};

/**
 * MCPServerConfigの型ガード
 */
export const isMCPServerConfig = (value: unknown): value is MCPServerConfig => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'name' in value &&
    'endpoint' in value &&
    'enabled' in value &&
    'transport' in value &&
    typeof (value as Record<string, unknown>).id === 'string' &&
    typeof (value as Record<string, unknown>).name === 'string' &&
    typeof (value as Record<string, unknown>).endpoint === 'string' &&
    typeof (value as Record<string, unknown>).enabled === 'boolean' &&
    ['stdio', 'sse', 'websocket'].includes((value as Record<string, unknown>).transport as string) &&
    isNonEmptyString((value as Record<string, unknown>).id) &&
    isNonEmptyString((value as Record<string, unknown>).name) &&
    isNonEmptyString((value as Record<string, unknown>).endpoint)
  );
};

/**
 * MCPServerConfig配列の型ガード
 */
export const isMCPServerConfigArray = (value: unknown): value is MCPServerConfig[] => {
  return Array.isArray(value) && value.every(isMCPServerConfig);
};

/**
 * GitHubAuthSettingsの型ガード
 */
export const isGitHubAuthSettings = (value: unknown): value is GitHubAuthSettings => {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    'enabled' in obj &&
    'scopes' in obj &&
    typeof obj.enabled === 'boolean' &&
    Array.isArray(obj.scopes) &&
    (obj.scopes as unknown[]).every((scope: unknown) => typeof scope === 'string')
  );
};

/**
 * プロファイルの完全な型ガード
 */
export const isProfile = (value: unknown): value is Profile => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    isProfileId(obj.id) &&
    isProfileName(obj.name) &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.icon === undefined || typeof obj.icon === 'string') &&
    (obj.mainColor === undefined || typeof obj.mainColor === 'string') &&
    (obj.systemPrompt === undefined || typeof obj.systemPrompt === 'string') &&
    Array.isArray(obj.fixedOrganizations) &&
    obj.fixedOrganizations.every((org: unknown) => typeof org === 'string') &&
    isAgentApiProxySettings(obj.agentApiProxy) &&
    isRepositoryHistoryArray(obj.repositoryHistory) &&
    isEnvironmentVariableArray(obj.environmentVariables) &&
    isMessageTemplateArray(obj.messageTemplates) &&
    typeof obj.isDefault === 'boolean' &&
    isISODateString(obj.created_at) &&
    isISODateString(obj.updated_at) &&
    (obj.githubAuth === undefined || isGitHubAuthSettings(obj.githubAuth)) &&
    (obj.mcpServers === undefined || isMCPServerConfigArray(obj.mcpServers))
  );
};

/**
 * プロファイルリスト項目の型ガード
 */
export const isProfileListItem = (value: unknown): value is ProfileListItem => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    isProfileId(obj.id) &&
    isProfileName(obj.name) &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.icon === undefined || typeof obj.icon === 'string') &&
    (obj.mainColor === undefined || typeof obj.mainColor === 'string') &&
    typeof obj.isDefault === 'boolean' &&
    (obj.lastUsed === undefined || isISODateString(obj.lastUsed)) &&
    typeof obj.repositoryCount === 'number' &&
    obj.repositoryCount >= 0
  );
};

/**
 * プロファイル作成リクエストの型ガード
 */
export const isCreateProfileRequest = (value: unknown): value is CreateProfileRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    isProfileName(obj.name) &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.icon === undefined || typeof obj.icon === 'string') &&
    (obj.mainColor === undefined || typeof obj.mainColor === 'string') &&
    (obj.systemPrompt === undefined || typeof obj.systemPrompt === 'string') &&
    Array.isArray(obj.fixedOrganizations) &&
    obj.fixedOrganizations.every((org: unknown) => typeof org === 'string') &&
    isAgentApiProxySettings(obj.agentApiProxy) &&
    isEnvironmentVariableArray(obj.environmentVariables) &&
    (obj.isDefault === undefined || typeof obj.isDefault === 'boolean')
  );
};

/**
 * プロファイル更新リクエストの型ガード
 */
export const isUpdateProfileRequest = (value: unknown): value is UpdateProfileRequest => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  return (
    (obj.name === undefined || isProfileName(obj.name)) &&
    (obj.description === undefined || typeof obj.description === 'string') &&
    (obj.icon === undefined || typeof obj.icon === 'string') &&
    (obj.mainColor === undefined || typeof obj.mainColor === 'string') &&
    (obj.systemPrompt === undefined || typeof obj.systemPrompt === 'string') &&
    (obj.fixedOrganizations === undefined || (
      Array.isArray(obj.fixedOrganizations) &&
      obj.fixedOrganizations.every((org: unknown) => typeof org === 'string')
    )) &&
    (obj.agentApiProxy === undefined || (
      typeof obj.agentApiProxy === 'object' &&
      obj.agentApiProxy !== null
    )) &&
    (obj.environmentVariables === undefined || isEnvironmentVariableArray(obj.environmentVariables)) &&
    (obj.messageTemplates === undefined || isMessageTemplateArray(obj.messageTemplates)) &&
    (obj.isDefault === undefined || typeof obj.isDefault === 'boolean') &&
    (obj.githubAuth === undefined || isGitHubAuthSettings(obj.githubAuth)) &&
    (obj.mcpServers === undefined || isMCPServerConfigArray(obj.mcpServers))
  );
};

/**
 * プロファイル名のバリデーション
 */
export const validateProfileName = (name: unknown): ValidationResult<ProfileName> => {
  if (!isNonEmptyString(name)) {
    return {
      valid: false,
      errors: ['プロファイル名は必須です。']
    };
  }

  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      errors: ['プロファイル名を空にすることはできません。']
    };
  }

  if (trimmed.length > 100) {
    return {
      valid: false,
      errors: ['プロファイル名は100文字以内で入力してください。']
    };
  }

  return {
    valid: true,
    value: trimmed as ProfileName
  };
};

/**
 * プロファイル説明のバリデーション
 */
export const validateProfileDescription = (description: unknown): ValidationResult<ProfileDescription | undefined> => {
  if (description === undefined || description === null || description === '') {
    return {
      valid: true,
      value: undefined
    };
  }

  if (typeof description !== 'string') {
    return {
      valid: false,
      errors: ['プロファイル説明は文字列である必要があります。']
    };
  }

  const trimmed = description.trim();
  if (trimmed.length > 500) {
    return {
      valid: false,
      errors: ['プロファイル説明は500文字以内で入力してください。']
    };
  }

  return {
    valid: true,
    value: trimmed.length > 0 ? trimmed as ProfileDescription : undefined
  };
};

/**
 * システムプロンプトのバリデーション
 */
export const validateSystemPrompt = (prompt: unknown): ValidationResult<SystemPrompt | undefined> => {
  if (prompt === undefined || prompt === null || prompt === '') {
    return {
      valid: true,
      value: undefined
    };
  }

  if (typeof prompt !== 'string') {
    return {
      valid: false,
      errors: ['システムプロンプトは文字列である必要があります。']
    };
  }

  const trimmed = prompt.trim();
  if (trimmed.length > 10000) {
    return {
      valid: false,
      errors: ['システムプロンプトは10,000文字以内で入力してください。']
    };
  }

  return {
    valid: true,
    value: trimmed.length > 0 ? trimmed as SystemPrompt : undefined
  };
};

/**
 * メインカラーのバリデーション
 */
export const validateMainColor = (color: unknown): ValidationResult<HexColor | undefined> => {
  if (color === undefined || color === null || color === '') {
    return {
      valid: true,
      value: undefined
    };
  }

  if (typeof color !== 'string') {
    return {
      valid: false,
      errors: ['メインカラーは文字列である必要があります。']
    };
  }

  if (!isHexColor(color)) {
    return {
      valid: false,
      errors: ['メインカラーは有効なHEX形式（#RRGGBB）で入力してください。']
    };
  }

  return {
    valid: true,
    value: color
  };
};

/**
 * APIエンドポイントのバリデーション
 */
export const validateApiEndpoint = (url: unknown): ValidationResult<ValidUrl> => {
  if (!isNonEmptyString(url)) {
    return {
      valid: false,
      errors: ['APIエンドポイントは必須です。']
    };
  }

  if (!isValidUrl(url)) {
    return {
      valid: false,
      errors: ['有効なURLを入力してください。']
    };
  }

  try {
    const urlObj = new URL(url);
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return {
        valid: false,
        errors: ['HTTPまたはHTTPSのURLを入力してください。']
      };
    }
  } catch {
    return {
      valid: false,
      errors: ['有効なURLを入力してください。']
    };
  }

  return {
    valid: true,
    value: url
  };
};

/**
 * 環境変数のバリデーション
 */
export const validateEnvironmentVariables = (variables: unknown): ValidationResult<EnvironmentVariable[]> => {
  if (!Array.isArray(variables)) {
    return {
      valid: false,
      errors: ['環境変数は配列である必要があります。']
    };
  }

  const errors: string[] = [];
  const validVariables: EnvironmentVariable[] = [];
  const usedKeys = new Set<string>();

  for (let i = 0; i < variables.length; i++) {
    const variable = variables[i];
    
    if (!isEnvironmentVariable(variable)) {
      errors.push(`環境変数 ${i + 1}: 不正な形式です。`);
      continue;
    }

    if (usedKeys.has(variable.key)) {
      errors.push(`環境変数 ${i + 1}: 変数名 "${variable.key}" が重複しています。`);
      continue;
    }

    if (variable.key.length > 100) {
      errors.push(`環境変数 ${i + 1}: 変数名は100文字以内で入力してください。`);
      continue;
    }

    if (variable.value.length > 1000) {
      errors.push(`環境変数 ${i + 1}: 変数値は1,000文字以内で入力してください。`);
      continue;
    }

    usedKeys.add(variable.key);
    validVariables.push(variable);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    value: validVariables
  };
};

/**
 * 固定組織のバリデーション
 */
export const validateFixedOrganizations = (organizations: unknown): ValidationResult<string[]> => {
  if (!Array.isArray(organizations)) {
    return {
      valid: false,
      errors: ['固定組織は配列である必要があります。']
    };
  }

  const errors: string[] = [];
  const validOrganizations: string[] = [];
  const usedOrgs = new Set<string>();

  for (let i = 0; i < organizations.length; i++) {
    const org = organizations[i];
    
    if (!isNonEmptyString(org)) {
      errors.push(`組織 ${i + 1}: 組織名は必須です。`);
      continue;
    }

    const trimmed = org.trim();
    if (trimmed.length === 0) {
      errors.push(`組織 ${i + 1}: 組織名を空にすることはできません。`);
      continue;
    }

    if (usedOrgs.has(trimmed)) {
      errors.push(`組織 ${i + 1}: 組織名 "${trimmed}" が重複しています。`);
      continue;
    }

    if (trimmed.length > 100) {
      errors.push(`組織 ${i + 1}: 組織名は100文字以内で入力してください。`);
      continue;
    }

    // GitHub組織名の形式チェック（英数字とハイフンのみ）
    if (!/^[a-zA-Z0-9\-]+$/.test(trimmed)) {
      errors.push(`組織 ${i + 1}: 組織名は英数字とハイフンのみ使用できます。`);
      continue;
    }

    usedOrgs.add(trimmed);
    validOrganizations.push(trimmed);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    value: validOrganizations
  };
};

/**
 * プロファイル作成リクエストの包括的バリデーション
 */
export const validateCreateProfileRequest = (request: unknown): ValidationResult<CreateProfileRequest> => {
  if (typeof request !== 'object' || request === null) {
    return {
      valid: false,
      errors: ['リクエストは有効なオブジェクトである必要があります。']
    };
  }

  const obj = request as Record<string, unknown>;
  const errors: string[] = [];

  // 名前のバリデーション
  const nameResult = validateProfileName(obj.name);
  if (!nameResult.valid) {
    errors.push(...nameResult.errors);
  }

  // 説明のバリデーション
  const descriptionResult = validateProfileDescription(obj.description);
  if (!descriptionResult.valid) {
    errors.push(...descriptionResult.errors);
  }

  // システムプロンプトのバリデーション
  const systemPromptResult = validateSystemPrompt(obj.systemPrompt);
  if (!systemPromptResult.valid) {
    errors.push(...systemPromptResult.errors);
  }

  // メインカラーのバリデーション
  const colorResult = validateMainColor(obj.mainColor);
  if (!colorResult.valid) {
    errors.push(...colorResult.errors);
  }

  // 固定組織のバリデーション
  const orgResult = validateFixedOrganizations(obj.fixedOrganizations);
  if (!orgResult.valid) {
    errors.push(...orgResult.errors);
  }

  // AgentApiProxySettingsのバリデーション
  if (!isAgentApiProxySettings(obj.agentApiProxy)) {
    errors.push('AgentAPIプロキシ設定が不正です。');
  } else {
    const endpointResult = validateApiEndpoint(obj.agentApiProxy.endpoint);
    if (!endpointResult.valid) {
      errors.push(...endpointResult.errors);
    }
  }

  // 環境変数のバリデーション
  const envResult = validateEnvironmentVariables(obj.environmentVariables || []);
  if (!envResult.valid) {
    errors.push(...envResult.errors);
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    value: {
      name: nameResult.valid ? nameResult.value : obj.name as string,
      description: descriptionResult.valid ? descriptionResult.value : obj.description as string | undefined,
      icon: obj.icon as string | undefined,
      mainColor: colorResult.valid ? colorResult.value : obj.mainColor as string | undefined,
      systemPrompt: systemPromptResult.valid ? systemPromptResult.value : obj.systemPrompt as string | undefined,
      fixedOrganizations: orgResult.valid ? orgResult.value : [],
      agentApiProxy: obj.agentApiProxy as AgentApiProxySettings,
      environmentVariables: envResult.valid ? envResult.value : [],
      isDefault: (obj.isDefault as boolean) || false
    }
  };
};

/**
 * プロファイル更新リクエストの包括的バリデーション
 */
export const validateUpdateProfileRequest = (request: unknown): ValidationResult<UpdateProfileRequest> => {
  if (typeof request !== 'object' || request === null) {
    return {
      valid: false,
      errors: ['リクエストは有効なオブジェクトである必要があります。']
    };
  }

  const obj = request as Record<string, unknown>;
  const errors: string[] = [];
  const validatedRequest: Record<string, unknown> = {};

  // 名前のバリデーション（存在する場合のみ）
  if (obj.name !== undefined) {
    const nameResult = validateProfileName(obj.name);
    if (!nameResult.valid) {
      errors.push(...nameResult.errors);
    } else {
      validatedRequest.name = nameResult.value;
    }
  }

  // 説明のバリデーション（存在する場合のみ）
  if (obj.description !== undefined) {
    const descriptionResult = validateProfileDescription(obj.description);
    if (!descriptionResult.valid) {
      errors.push(...descriptionResult.errors);
    } else {
      validatedRequest.description = descriptionResult.value;
    }
  }

  // システムプロンプトのバリデーション（存在する場合のみ）
  if (obj.systemPrompt !== undefined) {
    const systemPromptResult = validateSystemPrompt(obj.systemPrompt);
    if (!systemPromptResult.valid) {
      errors.push(...systemPromptResult.errors);
    } else {
      validatedRequest.systemPrompt = systemPromptResult.value;
    }
  }

  // メインカラーのバリデーション（存在する場合のみ）
  if (obj.mainColor !== undefined) {
    const colorResult = validateMainColor(obj.mainColor);
    if (!colorResult.valid) {
      errors.push(...colorResult.errors);
    } else {
      validatedRequest.mainColor = colorResult.value;
    }
  }

  // 固定組織のバリデーション（存在する場合のみ）
  if (obj.fixedOrganizations !== undefined) {
    const orgResult = validateFixedOrganizations(obj.fixedOrganizations);
    if (!orgResult.valid) {
      errors.push(...orgResult.errors);
    } else {
      validatedRequest.fixedOrganizations = orgResult.value;
    }
  }

  // AgentApiProxySettingsのバリデーション（存在する場合のみ）
  if (obj.agentApiProxy !== undefined) {
    if (typeof obj.agentApiProxy !== 'object' || obj.agentApiProxy === null) {
      errors.push('AgentAPIプロキシ設定は有効なオブジェクトである必要があります。');
    } else {
      // エンドポイントが指定されている場合のみバリデーション
      const proxy = obj.agentApiProxy as Record<string, unknown>;
      if (proxy.endpoint !== undefined) {
        const endpointResult = validateApiEndpoint(proxy.endpoint);
        if (!endpointResult.valid) {
          errors.push(...endpointResult.errors);
        }
      }
      validatedRequest.agentApiProxy = obj.agentApiProxy;
    }
  }

  // 環境変数のバリデーション（存在する場合のみ）
  if (obj.environmentVariables !== undefined) {
    const envResult = validateEnvironmentVariables(obj.environmentVariables);
    if (!envResult.valid) {
      errors.push(...envResult.errors);
    } else {
      validatedRequest.environmentVariables = envResult.value;
    }
  }

  // その他のフィールドをそのまま追加
  if (obj.icon !== undefined) {
    validatedRequest.icon = obj.icon;
  }
  if (obj.messageTemplates !== undefined) {
    if (isMessageTemplateArray(obj.messageTemplates)) {
      validatedRequest.messageTemplates = obj.messageTemplates;
    } else {
      errors.push('メッセージテンプレートの形式が不正です。');
    }
  }
  if (obj.isDefault !== undefined) {
    if (typeof obj.isDefault === 'boolean') {
      validatedRequest.isDefault = obj.isDefault;
    } else {
      errors.push('isDefaultはboolean値である必要があります。');
    }
  }
  if (obj.githubAuth !== undefined) {
    if (isGitHubAuthSettings(obj.githubAuth)) {
      validatedRequest.githubAuth = obj.githubAuth;
    } else {
      errors.push('GitHub認証設定の形式が不正です。');
    }
  }
  if (obj.mcpServers !== undefined) {
    if (isMCPServerConfigArray(obj.mcpServers)) {
      validatedRequest.mcpServers = obj.mcpServers;
    } else {
      errors.push('MCPサーバー設定の形式が不正です。');
    }
  }

  if (errors.length > 0) {
    return {
      valid: false,
      errors
    };
  }

  return {
    valid: true,
    value: validatedRequest as UpdateProfileRequest
  };
};