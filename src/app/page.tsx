import { Suspense } from 'react';
import AgentAPIChat from './components/AgentAPIChat';
import LoadingSpinner from './components/LoadingSpinner';

export default function Home() {
  return (
    <div className="h-dvh bg-gray-50">
      <div className="container mx-auto h-full">
        <Suspense fallback={<LoadingSpinner />}>
          <AgentAPIChat />
        </Suspense>
      </div>
    </div>
  );
}