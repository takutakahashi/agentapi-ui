import { Suspense } from 'react';
import AgentAPIChat from './components/AgentAPIChat';
import TopBar from './components/TopBar';
import LoadingSpinner from './components/LoadingSpinner';

export default function Home() {
  return (
    <div className="h-dvh bg-gray-50">
      <div className="container mx-auto h-full flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-hidden">
          <Suspense fallback={<LoadingSpinner />}>
            <AgentAPIChat />
          </Suspense>
        </div>
      </div>
    </div>
  );
}