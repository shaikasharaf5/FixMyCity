import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, X, Send, Image as ImageIcon, Bot, User as UserIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../lib/apiClient';

interface WSMessage {
  direction: 'inbound' | 'outbound';
  phone_number: string;
  text: string;
  media_url?: string;
  full_media_url?: string;
  timestamp: number;
  options?: string[];
}

export const WhatsAppSimulator: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<WSMessage[]>([
    {
      direction: 'outbound',
      phone_number: 'system',
      text: '🤖 *FixMyCity WhatsApp Bot Active*\nSend "Hi" to start interacting or reporting an issue!',
      timestamp: Date.now() / 1000
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Use user's ID for the websocket, default to 0 if logged out
  const wsUserId = user?.id || 0;
  const phoneNumber = '919999999999'; // Dummy WhatsApp number for the simulator

  useEffect(() => {
    if (!isOpen) return;

    const wsUrl = `ws://127.0.0.1:8001/ws/${wsUserId}/citizen`;
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.type === 'WHATSAPP_SIMULATOR_MESSAGE') {
          const msg = payload.data as WSMessage;
          setMessages(prev => [...prev, msg]);
          setIsTyping(false);
        }
      } catch (err) {
        console.error("WS parse error", err);
      }
    };

    // Keepalive ping
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 15000);

    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [isOpen, wsUserId]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const text = input;
    setInput('');
    setIsTyping(true);

    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: phoneNumber,
              type: "text",
              text: { body: text }
            }]
          }
        }]
      }]
    };

    try {
      await fetch('http://127.0.0.1:8001/api/complaints/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } catch (err) {
      console.error(err);
      setIsTyping(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    setIsUploading(true);
    setIsTyping(true);
    
    try {
      // 1. Upload to the backend to get a valid URL (using analyze endpoint to just store it)
      const formData = new FormData();
      formData.append('file', file);
      formData.append('latitude', '17.3850');
      formData.append('longitude', '78.4867');
      formData.append('district', 'Hyderabad');
      formData.append('ward', 'Simulator');
      
      const uploadRes = await api.postFormData('/complaints/analyze', formData);
      const imageUrl = uploadRes.before_image_url;
      
      // 2. Send webhook payload simulating a Meta image message
      const payload = {
        entry: [{
          changes: [{
            value: {
              messages: [{
                from: phoneNumber,
                type: "image",
                image: { id: "simulator_" + imageUrl }
              }]
            }
          }]
        }]
      };

      await fetch('http://127.0.0.1:8001/api/complaints/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
    } catch (err) {
      console.error("Upload failed", err);
      setMessages((prev) => [
        ...prev,
        {
          direction: "outbound",
          phone_number: "system",
          text: "❌ Image upload failed. Please try a different photo file.",
          timestamp: Math.floor(Date.now() / 1000)
        }
      ]);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const sendOption = (option: string) => {
    setInput(option);
    setTimeout(() => {
      const btn = document.getElementById('wa-send-btn');
      if (btn) btn.click();
    }, 50);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 md:bottom-8 md:right-8 w-[360px] h-[600px] max-h-[80vh] flex flex-col bg-[#0b141a] rounded-2xl shadow-[0_0_40px_rgba(37,211,102,0.3)] border border-white/10 z-[100] overflow-hidden animate-fade-in flex-shrink-0">
      
      {/* Header */}
      <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">FixMyCity Bot</h3>
            <p className="text-xs text-[#00a884]">Online (Simulator)</p>
          </div>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#0b141a] bg-[url('https://web.whatsapp.com/img/bg-chat-tile-dark_a4be512e7195b6b733d9110b408f075d.png')] bg-repeat opacity-95">
        {messages.map((msg, idx) => {
          const isOutbound = msg.direction === 'outbound'; // From Bot TO User
          
          return (
            <div key={idx} className={`flex flex-col ${isOutbound ? 'items-start' : 'items-end'}`}>
              <div className={`max-w-[85%] rounded-lg p-2.5 text-sm whitespace-pre-wrap shadow-sm relative ${isOutbound ? 'bg-[#202c33] text-slate-200 rounded-tl-none' : 'bg-[#005c4b] text-white rounded-tr-none'}`}>
                
                {msg.full_media_url && (
                  <div className="mb-2 rounded overflow-hidden">
                    <img src={msg.full_media_url} alt="Media" className="w-full max-h-[200px] object-cover" />
                  </div>
                )}
                
                {msg.text}

                {/* Inline Options (Buttons) */}
                {msg.options && msg.options.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.options.map(opt => (
                      <button key={opt} onClick={() => sendOption(opt)} className="px-3 py-1.5 bg-[#0b141a] text-[#00a884] font-semibold text-xs rounded border border-[#00a884]/30 hover:bg-[#00a884]/10 transition">
                        {opt}
                      </button>
                    ))}
                  </div>
                )}
                
                <div className="text-[10px] text-right mt-1 opacity-60">
                  {new Date(msg.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        {isTyping && (
           <div className="flex items-start">
             <div className="bg-[#202c33] rounded-lg rounded-tl-none p-3 shadow-sm">
                <div className="flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                  <div className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                </div>
             </div>
           </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-[#202c33] p-3 flex items-center gap-3 relative">
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleImageUpload} 
          className="hidden" 
        />
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-slate-400 hover:text-white transition disabled:opacity-50"
        >
          <ImageIcon className="w-6 h-6" />
        </button>
        <div className="flex-1 bg-[#2a3942] rounded-lg">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message"
            className="w-full bg-transparent text-white px-4 py-3 text-sm focus:outline-none resize-none h-11"
            rows={1}
          />
        </div>
        <button 
          id="wa-send-btn"
          onClick={sendMessage} 
          disabled={!input.trim()}
          className="w-10 h-10 rounded-full bg-[#00a884] flex items-center justify-center text-white disabled:opacity-50 transition"
        >
          <Send className="w-5 h-5 ml-1" />
        </button>
      </div>

    </div>
  );
};

export default WhatsAppSimulator;
