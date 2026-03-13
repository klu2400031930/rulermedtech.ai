import { useEffect, useRef, useState } from 'react';
import { Bot, Send, X } from 'lucide-react';
import api from '../utils/api';

const DEFAULT_WELCOME = 'Hi! Share your symptoms or condition and I will suggest precautions.';

export default function ChatbotPanel({
    title = 'Precaution Chatbot',
    showClose = false,
    onClose,
    className = '',
    listHeightClass = 'max-h-[520px]',
    inputPlaceholder = 'Describe symptoms or ask for precautions...'
}) {
    const [messages, setMessages] = useState([
        { id: 'welcome', role: 'bot', text: DEFAULT_WELCOME }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const listRef = useRef(null);

    useEffect(() => {
        const el = listRef.current;
        if (el) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    const sendMessage = async () => {
        const text = input.trim();
        if (!text || loading) return;
        const userMessage = { id: `${Date.now()}-u`, role: 'user', text };
        setMessages((prev) => [...prev, userMessage]);
        setInput('');
        setLoading(true);
        try {
            const res = await api.post('/chatbot/ask', { message: text });
            const data = res.data || {};
            const botMessage = {
                id: `${Date.now()}-b`,
                role: 'bot',
                text: data.reply || 'Here are precautions and suggestions based on your message.',
                precautions: data.precautions || [],
                suggestions: data.suggestions || [],
                disclaimer: data.disclaimer
            };
            setMessages((prev) => [...prev, botMessage]);
        } catch (error) {
            setMessages((prev) => [...prev, {
                id: `${Date.now()}-e`,
                role: 'bot',
                text: 'Chatbot is unavailable right now. Please try again later.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={`rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden ${className}`}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-teal-50">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <Bot size={16} className="text-primary" />
                    {title}
                </div>
                {showClose && (
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">
                        <X size={16} />
                    </button>
                )}
            </div>

            <div ref={listRef} className={`${listHeightClass} overflow-y-auto px-4 py-3 space-y-3`}>
                {messages.map((msg) => (
                    <div key={msg.id} className={`text-sm ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        <div className={`inline-block rounded-xl px-3 py-2 ${msg.role === 'user' ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}>
                            {msg.text}
                        </div>
                        {msg.precautions?.length > 0 && (
                            <div className="mt-2 text-xs text-slate-600">
                                <div className="font-semibold text-slate-700 mb-1">Precautions</div>
                                <ul className="space-y-1 list-disc list-inside">
                                    {msg.precautions.map((item, idx) => (
                                        <li key={`${msg.id}-p-${idx}`}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {msg.suggestions?.length > 0 && (
                            <div className="mt-2 text-xs text-slate-600">
                                <div className="font-semibold text-slate-700 mb-1">Suggestions</div>
                                <ul className="space-y-1 list-disc list-inside">
                                    {msg.suggestions.map((item, idx) => (
                                        <li key={`${msg.id}-s-${idx}`}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {msg.disclaimer && (
                            <div className="mt-2 text-[10px] text-slate-400 italic">{msg.disclaimer}</div>
                        )}
                    </div>
                ))}
                {loading && (
                    <div className="text-xs text-slate-500">Thinking...</div>
                )}
            </div>

            <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-100 bg-white">
                <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={(event) => event.key === 'Enter' && sendMessage()}
                    placeholder={inputPlaceholder}
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
                <button
                    onClick={sendMessage}
                    disabled={loading || !input.trim()}
                    className="rounded-lg bg-primary px-3 py-2 text-white disabled:opacity-50"
                >
                    <Send size={16} />
                </button>
            </div>
        </div>
    );
}
