import ChatbotPanel from '../components/ChatbotPanel';

export default function ChatbotPage() {
    return (
        <div className="max-w-4xl mx-auto">
            <div className="stat-card mb-6">
                <h2 className="text-2xl font-bold text-text-primary">Precaution Chatbot</h2>
                <p className="text-text-secondary mt-2">
                    Ask about symptoms or conditions to get basic precautions and suggestions.
                </p>
            </div>

            <ChatbotPanel className="w-full" listHeightClass="max-h-[520px]" />
        </div>
    );
}
