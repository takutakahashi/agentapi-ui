'use client';

import React from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  const getToastConfig = (type?: 'info' | 'success' | 'warning' | 'error') => {
    switch (type) {
      case 'success':
        return {
          containerClass: 'bg-green-50 dark:bg-green-900/90 border-green-200 dark:border-green-700',
          textClass: 'text-green-800 dark:text-green-100',
          iconClass: 'text-green-500 dark:text-green-400',
          closeClass: 'text-green-400 hover:text-green-600 dark:text-green-500 dark:hover:text-green-300',
          Icon: CheckCircle
        };
      case 'warning':
        return {
          containerClass: 'bg-yellow-50 dark:bg-yellow-900/90 border-yellow-200 dark:border-yellow-700',
          textClass: 'text-yellow-800 dark:text-yellow-100',
          iconClass: 'text-yellow-500 dark:text-yellow-400',
          closeClass: 'text-yellow-400 hover:text-yellow-600 dark:text-yellow-500 dark:hover:text-yellow-300',
          Icon: AlertTriangle
        };
      case 'error':
        return {
          containerClass: 'bg-red-50 dark:bg-red-900/90 border-red-200 dark:border-red-700',
          textClass: 'text-red-800 dark:text-red-100',
          iconClass: 'text-red-500 dark:text-red-400',
          closeClass: 'text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300',
          Icon: XCircle
        };
      case 'info':
      default:
        return {
          containerClass: 'bg-blue-50 dark:bg-blue-900/90 border-blue-200 dark:border-blue-700',
          textClass: 'text-blue-800 dark:text-blue-100',
          iconClass: 'text-blue-500 dark:text-blue-400',
          closeClass: 'text-blue-400 hover:text-blue-600 dark:text-blue-500 dark:hover:text-blue-300',
          Icon: Info
        };
    }
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      {toasts.map((toast) => {
        const config = getToastConfig(toast.type);
        const Icon = config.Icon;

        return (
          <div
            key={toast.id}
            className={`
              flex items-start gap-3 p-4 rounded-xl shadow-lg backdrop-blur-sm
              border max-w-md animate-slide-in
              ${config.containerClass}
            `}
          >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${config.iconClass}`} />
            <p className={`flex-1 text-sm font-medium ${config.textClass}`}>
              {toast.message}
            </p>
            <button
              onClick={() => removeToast(toast.id)}
              className={`flex-shrink-0 p-1 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/10 ${config.closeClass}`}
              aria-label="閉じる"
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
};
