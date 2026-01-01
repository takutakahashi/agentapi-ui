'use client';

import { useState, useEffect } from 'react';

/**
 * 値をデバウンスするフック
 * @param value デバウンスする値
 * @param delay デバウンス遅延 (ミリ秒)
 * @returns デバウンスされた値
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
