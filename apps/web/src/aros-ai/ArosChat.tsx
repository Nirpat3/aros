import { useState, type FormEvent } from 'react';
import { useWhitelabel } from '../whitelabel/WhitelabelProvider';

interface Message {
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
}

export function ArosChat() {
  const { config } = useWhitelabel();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'agent', content: config.agent.greeting ?? 'What do you need?', timestamp: Date.now() },
  ]);
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input.trim(), timestamp: Date.now() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Agent response would come from the AROS AI backend
    // For now, acknowledge the message
    const agentMsg: Message = {
      role: 'agent',
      content: 'Processing your request.',
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, agentMsg]);
  };

  if (!config.features?.agentChat) return null;

  return (
    <>
      <button className="aros-chat-toggle" onClick={() => setOpen(!open)} aria-label={`Chat with ${config.agent.name}`}>
        {config.agent.name}
      </button>

      {open && (
        <div className="aros-chat-panel">
          <div className="aros-chat-header">
            <strong>{config.agent.name}</strong>
            <button onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>

          <div className="aros-chat-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`aros-chat-message aros-chat-${msg.role}`}>
                {msg.content}
              </div>
            ))}
          </div>

          <form className="aros-chat-input" onSubmit={send}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Message ${config.agent.name}...`}
            />
            <button type="submit">Send</button>
          </form>
        </div>
      )}
    </>
  );
}
