import { AppError, ErrorSeverity, ErrorType } from '../types/errors';

/**
 * ログレベル
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

/**
 * ログエントリ
 */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: Record<string, unknown>;
  error?: AppError;
}

/**
 * エラーログの設定
 */
export interface ErrorLoggerConfig {
  enableConsoleLogging: boolean;
  enableStorageLogging: boolean;
  maxStoredLogs: number;
  logLevel: LogLevel;
}

/**
 * 統一されたエラーロガー
 */
export class ErrorLogger {
  private static instance: ErrorLogger;
  private config: ErrorLoggerConfig;
  private logs: LogEntry[] = [];

  private constructor(config?: Partial<ErrorLoggerConfig>) {
    this.config = {
      enableConsoleLogging: true,
      enableStorageLogging: true,
      maxStoredLogs: 100,
      logLevel: LogLevel.INFO,
      ...config
    };

    // 初期化時に既存のログを読み込み
    this.loadStoredLogs();
  }

  /**
   * シングルトンインスタンスを取得
   */
  public static getInstance(config?: Partial<ErrorLoggerConfig>): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger(config);
    }
    return ErrorLogger.instance;
  }

  /**
   * エラーをログに記録
   */
  public logError(error: AppError, context?: Record<string, unknown>): void {
    const logLevel = this.mapSeverityToLogLevel(error.severity);
    this.log(logLevel, error.getLogMessage(), context, error);
  }

  /**
   * 一般的なログを記録
   */
  public log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: AppError): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date(),
      context,
      error
    };

    // メモリに保存
    this.logs.push(logEntry);
    if (this.logs.length > this.config.maxStoredLogs) {
      this.logs.shift(); // 古いログを削除
    }

    // コンソールに出力
    if (this.config.enableConsoleLogging) {
      this.logToConsole(logEntry);
    }

    // ストレージに保存
    if (this.config.enableStorageLogging) {
      this.saveLogsToStorage();
    }
  }

  /**
   * デバッグログ
   */
  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * 情報ログ
   */
  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * 警告ログ
   */
  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * エラーログ（一般的なエラー用）
   */
  public error(message: string, context?: Record<string, unknown>, error?: Error): void {
    this.log(LogLevel.ERROR, message, context, error as AppError);
  }

  /**
   * すべてのログを取得
   */
  public getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 指定したレベル以上のログを取得
   */
  public getLogsByLevel(minLevel: LogLevel): LogEntry[] {
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const minIndex = levelOrder.indexOf(minLevel);
    
    return this.logs.filter(log => {
      const logIndex = levelOrder.indexOf(log.level);
      return logIndex >= minIndex;
    });
  }

  /**
   * エラータイプでログをフィルタ
   */
  public getLogsByErrorType(errorType: ErrorType): LogEntry[] {
    return this.logs.filter(log => log.error?.type === errorType);
  }

  /**
   * ログをクリア
   */
  public clearLogs(): void {
    this.logs = [];
    if (this.config.enableStorageLogging) {
      this.clearStoredLogs();
    }
  }

  /**
   * エラー統計を取得
   */
  public getErrorStats(): Record<string, unknown> {
    const errorLogs = this.logs.filter(log => log.error);
    const stats = {
      totalErrors: errorLogs.length,
      errorsByType: {} as Record<ErrorType, number>,
      errorsBySeverity: {} as Record<ErrorSeverity, number>,
      recentErrors: errorLogs.slice(-10)
    };

    errorLogs.forEach(log => {
      if (log.error) {
        // エラータイプ別の統計
        const type = log.error.type;
        stats.errorsByType[type] = (stats.errorsByType[type] || 0) + 1;

        // 重要度別の統計
        const severity = log.error.severity;
        stats.errorsBySeverity[severity] = (stats.errorsBySeverity[severity] || 0) + 1;
      }
    });

    return stats;
  }

  /**
   * ログレベルが記録対象かチェック
   */
  private shouldLog(level: LogLevel): boolean {
    const levelOrder = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR];
    const currentIndex = levelOrder.indexOf(this.config.logLevel);
    const requestedIndex = levelOrder.indexOf(level);
    return requestedIndex >= currentIndex;
  }

  /**
   * エラーの重要度をログレベルにマッピング
   */
  private mapSeverityToLogLevel(severity: ErrorSeverity): LogLevel {
    switch (severity) {
      case ErrorSeverity.LOW:
        return LogLevel.INFO;
      case ErrorSeverity.MEDIUM:
        return LogLevel.WARN;
      case ErrorSeverity.HIGH:
      case ErrorSeverity.CRITICAL:
        return LogLevel.ERROR;
      default:
        return LogLevel.WARN;
    }
  }

  /**
   * コンソールにログを出力
   */
  private logToConsole(logEntry: LogEntry): void {
    const { level, message, timestamp, context, error } = logEntry;
    const timeStr = timestamp.toISOString();
    const contextStr = context ? ` | Context: ${JSON.stringify(context)}` : '';
    const fullMessage = `[${timeStr}] ${message}${contextStr}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(fullMessage);
        break;
      case LogLevel.INFO:
        console.info(fullMessage);
        break;
      case LogLevel.WARN:
        console.warn(fullMessage);
        if (error) console.warn('Error details:', error.getErrorDetails());
        break;
      case LogLevel.ERROR:
        console.error(fullMessage);
        if (error) {
          console.error('Error details:', error.getErrorDetails());
          if (error.stack) console.error('Stack trace:', error.stack);
        }
        break;
    }
  }

  /**
   * ストレージからログを読み込み
   */
  private loadStoredLogs(): void {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem('agentapi-error-logs');
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        this.logs = parsedLogs.map((log: LogEntry & { timestamp: string }) => ({
          ...log,
          timestamp: new Date(log.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load stored error logs:', error);
    }
  }

  /**
   * ログをストレージに保存
   */
  private saveLogsToStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      // エラーオブジェクトは循環参照があるため、シリアライズ可能な形式に変換
      const serializableLogs = this.logs.map(log => ({
        level: log.level,
        message: log.message,
        timestamp: log.timestamp,
        context: log.context,
        error: log.error ? {
          type: log.error.type,
          severity: log.error.severity,
          recoveryType: log.error.recoveryType,
          message: log.error.message,
          userMessage: log.error.userMessage,
          context: log.error.context,
          timestamp: log.error.timestamp
        } : undefined
      }));

      localStorage.setItem('agentapi-error-logs', JSON.stringify(serializableLogs));
    } catch (error) {
      console.warn('Failed to save error logs to storage:', error);
    }
  }

  /**
   * ストレージのログをクリア
   */
  private clearStoredLogs(): void {
    if (typeof window === 'undefined') return;

    try {
      localStorage.removeItem('agentapi-error-logs');
    } catch (error) {
      console.warn('Failed to clear stored error logs:', error);
    }
  }
}

/**
 * グローバルな ErrorLogger インスタンス
 */
export const errorLogger = ErrorLogger.getInstance();

/**
 * ユーティリティ関数：未処理エラーをキャッチしてログに記録
 */
export function setupGlobalErrorHandling(): void {
  // 未処理のエラーをキャッチ
  if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
      const error = new AppError(
        ErrorType.UNKNOWN_ERROR,
        event.error?.message || event.message || 'Unknown error',
        '予期しないエラーが発生しました。',
        ErrorSeverity.HIGH,
        undefined,
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      );
      errorLogger.logError(error);
    });

    // 未処理のPromise拒否をキャッチ
    window.addEventListener('unhandledrejection', (event) => {
      const error = new AppError(
        ErrorType.ASYNC_OPERATION_FAILED,
        String(event.reason),
        '非同期処理でエラーが発生しました。',
        ErrorSeverity.HIGH,
        undefined,
        { reason: event.reason }
      );
      errorLogger.logError(error);
    });
  }
}