'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { useGitHubRepositories } from '@/hooks/useGitHubRepositories';
import { OrganizationHistory } from '@/utils/organizationHistory';
import { GitHubRepository } from '@/types/github';

interface RepositorySearchInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

export default function RepositorySearchInput({
  value,
  onChange,
  disabled = false,
  placeholder = '例: owner/repository-name',
  id = 'repository',
}: RepositorySearchInputProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [localSuggestions, setLocalSuggestions] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch GitHub repositories with the current query
  const {
    repositories: githubRepos,
    isLoading: isLoadingGitHub,
    error: githubError,
  } = useGitHubRepositories(value, { enabled: showDropdown });

  // Debug logging
  console.log('[RepositorySearchInput] State:', {
    value,
    showDropdown,
    localSuggestions: localSuggestions.length,
    githubRepos: githubRepos.length,
    isLoadingGitHub,
    githubError,
  });

  // Update local suggestions when value changes
  const updateLocalSuggestions = useCallback((query: string) => {
    const suggestions = OrganizationHistory.getRepositorySuggestions(query || undefined);
    setLocalSuggestions(suggestions);
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = e.target.value;
      onChange(newValue);
      updateLocalSuggestions(newValue);
    },
    [onChange, updateLocalSuggestions]
  );

  const handleFocus = useCallback(() => {
    updateLocalSuggestions(value);
    setShowDropdown(true);
  }, [value, updateLocalSuggestions]);

  const handleBlur = useCallback(() => {
    // Delay to allow click on dropdown items
    setTimeout(() => {
      setShowDropdown(false);
    }, 150);
  }, []);

  const selectRepository = useCallback(
    (repo: string) => {
      onChange(repo);
      setShowDropdown(false);
    },
    [onChange]
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Filter out local suggestions that are already in GitHub results
  const githubRepoNames = new Set(githubRepos.map((r) => r.full_name));
  const filteredLocalSuggestions = localSuggestions.filter((s) => !githubRepoNames.has(s));

  const hasLocalSuggestions = filteredLocalSuggestions.length > 0;
  const hasGitHubRepos = githubRepos.length > 0;
  const showSuggestions = showDropdown && (hasLocalSuggestions || hasGitHubRepos || isLoadingGitHub);

  return (
    <div className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
        placeholder={placeholder}
        disabled={disabled}
        autoComplete="off"
      />

      {showSuggestions && (
        <div
          ref={dropdownRef}
          className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 mt-1 max-h-80 overflow-y-auto"
        >
          {/* Local History Section */}
          {hasLocalSuggestions && (
            <>
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  リポジトリ履歴
                </span>
              </div>
              <div className="p-2 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-2">
                {filteredLocalSuggestions.map((suggestion, index) => (
                  <button
                    key={`local-${index}`}
                    type="button"
                    onClick={() => selectRepository(suggestion)}
                    className="text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-900 dark:text-white font-mono text-sm rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors break-all"
                    title={suggestion}
                  >
                    <span className="flex items-center gap-2">
                      <svg
                        className="w-4 h-4 text-gray-400 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="break-all">{suggestion}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* GitHub Repositories Section */}
          {(hasGitHubRepos || isLoadingGitHub) && (
            <>
              <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  GitHub リポジトリ
                </span>
                {isLoadingGitHub && (
                  <svg
                    className="animate-spin h-4 w-4 text-gray-400"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                )}
              </div>
              {githubError && (
                <div className="p-2 text-sm text-red-500 dark:text-red-400">{githubError}</div>
              )}
              {hasGitHubRepos && (
                <div className="p-2 grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {githubRepos.slice(0, 20).map((repo: GitHubRepository) => (
                    <button
                      key={repo.id}
                      type="button"
                      onClick={() => selectRepository(repo.full_name)}
                      className="text-left px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-gray-900 dark:text-white rounded-md border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-700 transition-colors"
                      title={repo.description || repo.full_name}
                    >
                      <div className="flex items-start gap-2">
                        <svg
                          className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                          />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm break-all">{repo.full_name}</span>
                            {repo.private && (
                              <svg
                                className="w-3 h-3 text-gray-400 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          {repo.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {repo.language && <span>{repo.language}</span>}
                            {repo.stargazers_count > 0 && (
                              <span className="flex items-center gap-1">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                                {repo.stargazers_count}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
