'use client';

import { useEffect, useState, ReactNode } from 'react';
import { checkAndMigrate } from '../utils/migration';

/**
 * セキュアストレージへのマイグレーションフック
 */
export function useSecureMigration() {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const performMigration = async () => {
      try {
        await checkAndMigrate();
        setError(null);
      } catch (err) {
        console.error('Migration error:', err);
        setError('Failed to migrate to secure storage');
      } finally {
        setIsLoading(false);
      }
    };

    performMigration();
  }, []);

  return { isLoading, error };
}

/**
 * セキュアストレージマイグレーションが完了するまで子コンポーネントの表示を遅延
 */
export function SecureMigrationProvider({ children }: { children: ReactNode }) {
  const { isLoading, error } = useSecureMigration();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Initializing secure storage...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center text-red-600">
          <p className="mb-2">Failed to initialize secure storage</p>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  return children;
}