import { setupGlobalErrorHandling, errorLogger } from './errorLogger';

/**
 * エラーハンドリングの初期化
 * アプリケーション起動時に一度だけ呼び出す
 */
export function initializeErrorHandling(): void {
  // グローバルエラーハンドリングを設定
  setupGlobalErrorHandling();
  
  // 開発環境では詳細ログを有効化
  if (process.env.NODE_ENV === 'development') {
    errorLogger.info('Error handling system initialized in development mode');
  }
}

/**
 * エラーハンドリングのヘルパー関数
 */
export class ErrorHelper {
  /**
   * 非同期関数を安全に実行し、エラーを適切にハンドリング
   */
  static async safeAsync<T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>,
    onError?: (error: Error) => void
  ): Promise<T | null> {
    try {
      return await operation();
    } catch (error) {
      const errorContext = {
        ...context,
        timestamp: new Date().toISOString(),
        operation: operation.name || 'anonymous'
      };
      
      if (error instanceof Error) {
        errorLogger.error(`Safe async operation failed: ${error.message}`, errorContext, error);
      } else {
        errorLogger.error(`Safe async operation failed: ${String(error)}`, errorContext);
      }
      
      if (onError) {
        onError(error instanceof Error ? error : new Error(String(error)));
      }
      
      return null;
    }
  }

  /**
   * Promise配列を安全に実行し、失敗したものはログに記録
   */
  static async safePromiseAll<T>(
    promises: Promise<T>[],
    context?: Record<string, unknown>
  ): Promise<T[]> {
    const results = await Promise.allSettled(promises);
    const successfulResults: T[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        successfulResults.push(result.value);
      } else {
        errorLogger.error(
          `Promise ${index} failed in safePromiseAll`,
          { ...context, index, reason: result.reason }
        );
      }
    });
    
    return successfulResults;
  }

  /**
   * ローカルストレージ操作を安全に実行
   */
  static safeLocalStorageOperation<T>(
    operation: () => T,
    fallback: T,
    context?: Record<string, unknown>
  ): T {
    if (typeof window === 'undefined') {
      return fallback;
    }

    try {
      return operation();
    } catch (error) {
      errorLogger.error(
        'LocalStorage operation failed',
        { ...context, error: error instanceof Error ? error.message : String(error) }
      );
      return fallback;
    }
  }
}

/**
 * React Hook用のエラーハンドリングヘルパー
 */
export function useErrorHandler() {
  const handleError = (error: unknown, context?: Record<string, unknown>) => {
    if (error instanceof Error) {
      errorLogger.error(`React component error: ${error.message}`, context, error);
    } else {
      errorLogger.error(`React component error: ${String(error)}`, context);
    }
  };

  const handleAsyncError = async <T>(
    operation: () => Promise<T>,
    context?: Record<string, unknown>
  ): Promise<T | null> => {
    return ErrorHelper.safeAsync(operation, context, handleError);
  };

  return {
    handleError,
    handleAsyncError
  };
}

export default ErrorHelper;