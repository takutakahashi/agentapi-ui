import AgentAPIChat from '../components/AgentAPIChat';

export default function AgentAPIPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto py-8 h-screen flex flex-col">
        <AgentAPIChat />
      </div>
    </div>
  );
}