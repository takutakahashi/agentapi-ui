'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Page Visibility API を使用してブラウザがバックグラウンドかどうかを追跡するカスタムフック
 * @returns {boolean} ページが表示されている場合は true、バックグラウンドの場合は false
 */
export function usePageVisibility(): boolean {
  const [isVisible, setIsVisible] = useState<boolean>(true);

  useEffect(() => {
    // 初期状態を設定
    setIsVisible(!document.hidden);

    const handleVisibilityChange = () => {
      setIsVisible(!document.hidden);
    };

    // visibilitychange イベントリスナーを追加
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // クリーンアップ
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return isVisible;
}

/**
 * バックグラウンド制御機能付きの setInterval フック
 * ページがバックグラウンドになったときに自動的にインターバルを停止し、
 * フォアグラウンドに戻ったときに再開する
 * 
 * @param callback 実行する関数
 * @param delay インターバルの間隔（ミリ秒）
 * @param immediate 最初に即座に実行するかどうか（デフォルト: true）
 * @returns インターバルの状態とコントロール機能
 */
export function useBackgroundAwareInterval(
  callback: () => void,
  delay: number,
  immediate: boolean = true
): {
  isRunning: boolean;
  start: () => void;
  stop: () => void;
  restart: () => void;
} {
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const isVisible = usePageVisibility();
  
  // useRefでcallbackの最新版を保持し、再レンダリングを防ぐ
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const start = () => {
    if (intervalId) return; // 既に動作中の場合は何もしない
    
    if (immediate) {
      callbackRef.current();
    }
    
    const id = setInterval(() => callbackRef.current(), delay);
    setIntervalId(id);
    setIsRunning(true);
  };

  const stop = () => {
    if (intervalId) {
      clearInterval(intervalId);
      setIntervalId(null);
      setIsRunning(false);
    }
  };

  const restart = () => {
    stop();
    start();
  };

  // ページの表示状態が変化したときの処理
  useEffect(() => {
    if (isVisible && !intervalId && isRunning) {
      // ページがフォアグラウンドに戻り、インターバルが停止していて実行中の状態の場合は再開
      start();
    } else if (!isVisible && intervalId) {
      // ページがバックグラウンドになった場合はインターバルを停止
      clearInterval(intervalId);
      setIntervalId(null);
    }
  }, [isVisible]);

  // コンポーネントのアンマウント時にクリーンアップ
  useEffect(() => {
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  return { isRunning, start, stop, restart };
}