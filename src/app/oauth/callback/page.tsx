'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createAgentAPIProxyClientFromStorage } from '@/lib/agentapi-proxy-client';
import { ProfileManager } from '@/utils/profileManager';

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const profileId = searchParams.get('profileId');

        if (!code || !state) {
          setStatus('error');
          setMessage('Missing required parameters');
          return;
        }

        // For now, we'll need to store profile ID in localStorage or handle it differently
        // since the OAuth flow doesn't carry profile information through GitHub
        const storedProfileId = profileId || localStorage.getItem('oauth-profile-id');
        
        if (!storedProfileId) {
          setStatus('error');
          setMessage('Profile ID not found');
          return;
        }

        const client = createAgentAPIProxyClientFromStorage(undefined, storedProfileId);
        
        // Exchange code for session
        const sessionResponse = await client.exchangeOAuthCode(code, state);

        // Update profile with OAuth session information
        ProfileManager.updateProfile(storedProfileId, {
          githubAuth: {
            enabled: true,
            sessionId: sessionResponse.sessionId,
            user: sessionResponse.user,
            scopes: [],
            organizations: [],
            repositories: [],
            expiresAt: sessionResponse.expiresAt.toISOString()
          }
        });

        // Clean up stored profile ID
        localStorage.removeItem('oauth-profile-id');

        setStatus('success');
        setMessage('GitHub authentication successful!');

        // Close the popup window and refresh the parent
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-success', profileId: storedProfileId }, '*');
          window.close();
        } else {
          // If not in a popup, redirect to profiles page
          setTimeout(() => {
            window.location.href = '/profiles';
          }, 2000);
        }
      } catch (error) {
        console.error('OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'OAuth callback failed');
        
        // Notify parent window of error
        if (window.opener) {
          window.opener.postMessage({ type: 'oauth-error', error: error instanceof Error ? error.message : 'OAuth callback failed' }, '*');
        }
      }
    };

    handleOAuthCallback();
  }, [searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        {status === 'loading' && (
          <div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p>Processing GitHub authentication...</p>
          </div>
        )}
        
        {status === 'success' && (
          <div>
            <div className="text-green-600 text-4xl mb-4">✓</div>
            <p className="text-green-600 font-semibold">{message}</p>
            <p className="text-gray-600 mt-2">This window will close automatically.</p>
          </div>
        )}
        
        {status === 'error' && (
          <div>
            <div className="text-red-600 text-4xl mb-4">✗</div>
            <p className="text-red-600 font-semibold">{message}</p>
            <button 
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}