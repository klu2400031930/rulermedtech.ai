import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import ChatbotPanel from './ChatbotPanel';

export default function ChatbotWidget() {
    const [open, setOpen] = useState(false);

    return (
        <div className="fixed bottom-6 right-6 z-50">
            {open && (
                <ChatbotPanel
                    showClose
                    onClose={() => setOpen(false)}
                    className="mb-4 w-[340px]"
                    listHeightClass="max-h-[380px]"
                />
            )}

            <button
                onClick={() => setOpen((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-white shadow-lg hover:bg-blue-700"
            >
                <MessageCircle size={18} />
                {open ? 'Close Chat' : 'Chat'}
            </button>
        </div>
    );
}
