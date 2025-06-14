import { Suspense } from 'react';
import AgentAPIChat from '../components/AgentAPIChat';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AgentAPIPage() {
  return (
    <div className="h-dvh bg-gray-50">
      <div className="w-full h-full flex flex-col px-0 sm:container sm:mx-auto sm:px-4">
        <Suspense fallback={<LoadingSpinner />}>
          <AgentAPIChat />
        </Suspense>
      </div>
    </div>
  );
}