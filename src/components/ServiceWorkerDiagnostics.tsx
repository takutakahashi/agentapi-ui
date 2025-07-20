'use client';

import { useState, useEffect } from 'react';

interface DiagnosticInfo {
  supportStatus: {
    hasServiceWorker: boolean;
    protocol: string;
    hostname: string;
    isSecureContext: boolean;
    isLocalhost: boolean;
  };
  registrations: Array<{
    scope: string;
    scriptURL?: string;
    state: string;
  }>;
  controller?: {
    scriptURL: string;
    state: string;
  };
  swFileStatus?: {
    accessible: boolean;
    status?: number;
    contentType?: string;
    size?: number;
  };
  errors: string[];
}

export default function ServiceWorkerDiagnostics() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const runDiagnostics = async () => {
    setIsLoading(true);
    const info: DiagnosticInfo = {
      supportStatus: {
        hasServiceWorker: 'serviceWorker' in navigator,
        protocol: window.location.protocol,
        hostname: window.location.hostname,
        isSecureContext: window.isSecureContext || false,
        isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1',
      },
      registrations: [],
      errors: [],
    };

    try {
      // Check sw.js accessibility
      const swResponse = await fetch('/sw.js');
      info.swFileStatus = {
        accessible: swResponse.ok,
        status: swResponse.status,
        contentType: swResponse.headers.get('content-type') || undefined,
        size: (await swResponse.text()).length,
      };
    } catch (error) {
      info.errors.push(`Failed to fetch sw.js: ${error instanceof Error ? error.message : String(error)}`);
    }

    if (info.supportStatus.hasServiceWorker) {
      try {
        // Get registrations
        const registrations = await navigator.serviceWorker.getRegistrations();
        info.registrations = registrations.map(reg => ({
          scope: reg.scope,
          scriptURL: reg.active?.scriptURL || reg.installing?.scriptURL || reg.waiting?.scriptURL,
          state: reg.active ? 'active' : reg.installing ? 'installing' : reg.waiting ? 'waiting' : 'none',
        }));

        // Check controller
        if (navigator.serviceWorker.controller) {
          info.controller = {
            scriptURL: navigator.serviceWorker.controller.scriptURL,
            state: navigator.serviceWorker.controller.state,
          };
        }
      } catch (error) {
        info.errors.push(`Failed to get SW registrations: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    setDiagnostics(info);
    setIsLoading(false);
  };

  const registerSW = async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      console.log('SW registered:', registration);
      await runDiagnostics();
    } catch (error) {
      console.error('SW registration failed:', error);
      await runDiagnostics();
    }
  };

  const unregisterAll = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      await runDiagnostics();
    } catch (error) {
      console.error('Failed to unregister SWs:', error);
    }
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  if (isLoading) {
    return <div className="p-4">Running diagnostics...</div>;
  }

  if (!diagnostics) {
    return <div className="p-4">No diagnostic data available</div>;
  }

  return (
    <div className="p-4 space-y-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
      <h2 className="text-xl font-bold">Service Worker Diagnostics</h2>
      
      {/* Support Status */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded">
        <h3 className="font-semibold mb-2">Support Status</h3>
        <ul className="space-y-1 text-sm">
          <li className={diagnostics.supportStatus.hasServiceWorker ? 'text-green-600' : 'text-red-600'}>
            Service Worker Support: {diagnostics.supportStatus.hasServiceWorker ? '✓' : '✗'}
          </li>
          <li>Protocol: {diagnostics.supportStatus.protocol}</li>
          <li>Hostname: {diagnostics.supportStatus.hostname}</li>
          <li className={diagnostics.supportStatus.isSecureContext ? 'text-green-600' : 'text-red-600'}>
            Secure Context: {diagnostics.supportStatus.isSecureContext ? '✓' : '✗'}
          </li>
          <li>Is Localhost: {diagnostics.supportStatus.isLocalhost ? '✓' : '✗'}</li>
        </ul>
      </div>

      {/* SW File Status */}
      {diagnostics.swFileStatus && (
        <div className="bg-white dark:bg-gray-800 p-4 rounded">
          <h3 className="font-semibold mb-2">sw.js File Status</h3>
          <ul className="space-y-1 text-sm">
            <li className={diagnostics.swFileStatus.accessible ? 'text-green-600' : 'text-red-600'}>
              Accessible: {diagnostics.swFileStatus.accessible ? '✓' : '✗'}
            </li>
            {diagnostics.swFileStatus.status && (
              <li>HTTP Status: {diagnostics.swFileStatus.status}</li>
            )}
            {diagnostics.swFileStatus.contentType && (
              <li>Content-Type: {diagnostics.swFileStatus.contentType}</li>
            )}
            {diagnostics.swFileStatus.size && (
              <li>File Size: {diagnostics.swFileStatus.size} bytes</li>
            )}
          </ul>
        </div>
      )}

      {/* Registrations */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded">
        <h3 className="font-semibold mb-2">
          Registrations ({diagnostics.registrations.length})
        </h3>
        {diagnostics.registrations.length === 0 ? (
          <p className="text-sm text-gray-500">No Service Workers registered</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {diagnostics.registrations.map((reg, index) => (
              <li key={index} className="border-l-2 border-gray-300 pl-2">
                <div>Scope: {reg.scope}</div>
                {reg.scriptURL && <div>Script: {reg.scriptURL}</div>}
                <div>State: {reg.state}</div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Controller */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded">
        <h3 className="font-semibold mb-2">Page Controller</h3>
        {diagnostics.controller ? (
          <ul className="space-y-1 text-sm">
            <li>Script: {diagnostics.controller.scriptURL}</li>
            <li>State: {diagnostics.controller.state}</li>
          </ul>
        ) : (
          <p className="text-sm text-gray-500">Page is not controlled by a Service Worker</p>
        )}
      </div>

      {/* Errors */}
      {diagnostics.errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded">
          <h3 className="font-semibold mb-2 text-red-600">Errors</h3>
          <ul className="space-y-1 text-sm text-red-600">
            {diagnostics.errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={runDiagnostics}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh Diagnostics
        </button>
        <button
          onClick={registerSW}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Register SW
        </button>
        <button
          onClick={unregisterAll}
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Unregister All
        </button>
      </div>
    </div>
  );
}