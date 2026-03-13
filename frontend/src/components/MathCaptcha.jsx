import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';

function generateChallenge() {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let answer;
    switch (op) {
        case '+': answer = a + b; break;
        case '-': answer = a - b; break;
        case '×': answer = a * b; break;
        default: answer = a + b;
    }
    return { text: `${a} ${op} ${b} = ?`, answer };
}

function drawCaptcha(canvas, text) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Background
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(0, 0, w, h);

    // Noise lines
    for (let i = 0; i < 6; i++) {
        ctx.strokeStyle = `hsl(${Math.random() * 360}, 40%, 75%)`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.random() * w, Math.random() * h);
        ctx.lineTo(Math.random() * w, Math.random() * h);
        ctx.stroke();
    }

    // Noise dots
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `hsl(${Math.random() * 360}, 40%, 70%)`;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, 1.5, 0, Math.PI * 2);
        ctx.fill();
    }

    // Text
    ctx.font = 'bold 26px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1e293b';

    // Slight rotation for each character
    const chars = text.split('');
    const startX = w / 2 - (chars.length * 12) / 2;
    chars.forEach((char, i) => {
        ctx.save();
        const x = startX + i * 14 + 7;
        const y = h / 2 + (Math.random() - 0.5) * 8;
        ctx.translate(x, y);
        ctx.rotate((Math.random() - 0.5) * 0.3);
        ctx.fillText(char, 0, 0);
        ctx.restore();
    });
}

export default function MathCaptcha({ onVerified }) {
    const canvasRef = useRef(null);
    const [challenge, setChallenge] = useState(() => generateChallenge());
    const [input, setInput] = useState('');
    const [status, setStatus] = useState('pending'); // pending | success | error

    const refresh = useCallback(() => {
        const newChallenge = generateChallenge();
        setChallenge(newChallenge);
        setInput('');
        setStatus('pending');
        onVerified(false);
    }, [onVerified]);

    useEffect(() => {
        if (canvasRef.current) {
            drawCaptcha(canvasRef.current, challenge.text);
        }
    }, [challenge]);

    const handleChange = (event) => {
        const value = event.target.value;
        setInput(value);
        if (value === '') {
            setStatus('pending');
            onVerified(false);
            return;
        }
        const num = parseInt(value, 10);
        if (!isNaN(num) && num === challenge.answer) {
            setStatus('success');
            onVerified(true);
        } else if (value.length >= String(challenge.answer).length) {
            setStatus('error');
            onVerified(false);
        } else {
            setStatus('pending');
            onVerified(false);
        }
    };

    const borderColor = status === 'success'
        ? 'border-green-400 ring-2 ring-green-100'
        : status === 'error'
            ? 'border-red-400 ring-2 ring-red-100'
            : 'border-slate-200';

    return (
        <div className="space-y-2">
            <label className="mb-1.5 block text-sm font-medium text-text-secondary">
                Security Check
            </label>
            <div className="flex items-center gap-3">
                <canvas
                    ref={canvasRef}
                    width={180}
                    height={50}
                    className="rounded-xl border border-slate-200"
                    style={{ imageRendering: 'auto' }}
                />
                <button
                    type="button"
                    onClick={refresh}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-primary"
                    title="New challenge"
                >
                    <RefreshCw size={16} />
                </button>
            </div>
            <input
                type="text"
                value={input}
                onChange={handleChange}
                className={`input-field ${borderColor}`}
                placeholder="Solve the math problem above"
                inputMode="numeric"
                autoComplete="off"
            />
            {status === 'success' && (
                <p className="text-xs font-medium text-green-600">✓ Verified</p>
            )}
            {status === 'error' && (
                <p className="text-xs font-medium text-red-500">✗ Incorrect answer, try again</p>
            )}
        </div>
    );
}
