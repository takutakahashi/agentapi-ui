import ServiceWorkerDiagnostics from '@/components/ServiceWorkerDiagnostics';

export default function SWDiagnosticsPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Service Worker Diagnostics</h1>
      <ServiceWorkerDiagnostics />
      
      <div className="mt-8 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Troubleshooting Steps:</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm">
          <li>Ensure you are accessing the site via HTTPS or localhost</li>
          <li>Check the browser console for any error messages</li>
          <li>Try clearing browser cache and cookies</li>
          <li>Check if Service Workers are enabled in your browser settings</li>
          <li>Try in an incognito/private window to rule out extensions</li>
          <li>Access <a href="/sw-test.html" className="text-blue-600 underline">/sw-test.html</a> for a standalone test</li>
        </ol>
      </div>
    </div>
  );
}