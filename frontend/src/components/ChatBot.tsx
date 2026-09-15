import React, { useState, useEffect, useRef } from "react";
import api from "../services/api";
import { Mic, Send, X } from "lucide-react";

interface ChatMessage {
  role: "user" | "bot";
  content: string;
}

const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "bot",
      content: "Hello! I am **CiviTrack AI**, your smart municipal assistant. 🤖\n\nHow can I help you today? You can ask me to search, count, or detail complaints across Telangana. For example:\n- *\"Show water leakage in Hyderabad\"*\n- *\"How many issues are resolved?\"*\n- *\"Show details for complaint #57\"*"
    }
  ]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.lang = "en-IN";
      rec.interimResults = false;
      rec.maxAlternatives = 1;
      rec.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? prev + " " + transcript : transcript));
      };
      rec.onend = () => setListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  const handleVoice = () => {
    if (!recognitionRef.current) return;
    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
    } else {
      recognitionRef.current.start();
      setListening(true);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    try {
      const response = await api.post("/api/chatbot/query", { query: userMsg.content });
      const botMsg: ChatMessage = { role: "bot", content: response.data.response };
      setMessages((prev) => [...prev, botMsg]);
    } catch (e) {
      const errMsg: ChatMessage = { role: "bot", content: "Sorry, I could not fetch the data." };
      setMessages((prev) => [...prev, errMsg]);
    }
  };

  const renderInlineMarkdown = (text: string): React.ReactNode => {
    // Replace **bold** with strong tags
    const parts = text.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, idx) => {
      if (idx % 2 === 1) {
        return <strong key={idx} className="font-extrabold text-teal-300">{part}</strong>;
      }
      // Parse inline code `code`
      const subparts = part.split(/`([^`]+)`/g);
      return subparts.map((subpart, sIdx) => {
        if (sIdx % 2 === 1) {
          return <code key={sIdx} className="bg-white/10 px-1.5 py-0.5 rounded font-mono text-xs text-indigo-300">{subpart}</code>;
        }
        // Parse italic *italic* or _italic_
        const italicParts = subpart.split(/\*([^*]+)\*/g);
        return italicParts.map((ip, ipIdx) => {
          if (ipIdx % 2 === 1) {
            return <em key={ipIdx} className="italic text-slate-350">{ip}</em>;
          }
          return ip;
        });
      });
    });
  };

  const renderFormattedText = (text: string) => {
    if (!text) return null;

    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];
    let currentTable: string[][] = [];
    let currentList: string[] = [];
    let isNumberedList = false;

    const flushTable = (key: number) => {
      if (currentTable.length === 0) return null;
      const tableData = [...currentTable];
      currentTable = [];
      
      if (tableData.length < 2) {
        return tableData.map((row, rIdx) => (
          <div key={`tbl-err-${key}-${rIdx}`} className="my-1">
            {row.join(" | ")}
          </div>
        ));
      }
      
      const headers = tableData[0].map(h => h.trim());
      const rows = tableData.slice(2).map(r => r.map(c => c.trim()));
      
      return (
        <div key={`table-${key}`} className="my-3 overflow-x-auto border border-white/10 rounded-xl shadow-lg bg-black/35">
          <table className="min-w-full divide-y divide-white/10 text-xs">
            <thead className="bg-white/5">
              <tr>
                {headers.map((h, idx) => (
                  <th key={idx} className="px-4 py-2.5 text-left font-bold uppercase tracking-wider text-teal-400">
                    {renderInlineMarkdown(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-white/5 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-4 py-2 text-slate-100 font-medium">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    };

    const flushList = (key: number) => {
      if (currentList.length === 0) return null;
      const listData = [...currentList];
      const isNum = isNumberedList;
      currentList = [];
      isNumberedList = false;

      if (isNum) {
        return (
          <ol key={`ol-${key}`} className="list-decimal pl-5 my-2 space-y-1.5 text-slate-200">
            {listData.map((item, idx) => (
              <li key={idx}>{renderInlineMarkdown(item)}</li>
            ))}
          </ol>
        );
      } else {
        return (
          <ul key={`ul-${key}`} className="list-disc pl-5 my-2 space-y-1.5 text-slate-200">
            {listData.map((item, idx) => (
              <li key={idx}>{renderInlineMarkdown(item)}</li>
            ))}
          </ul>
        );
      }
    };

    let elKey = 0;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("|") || (line.includes("|") && line.split("|").length > 2)) {
        if (currentList.length > 0) {
          elements.push(flushList(elKey++));
        }
        let cells = line.split("|");
        if (cells[0] === "") cells.shift();
        if (cells[cells.length - 1] === "") cells.pop();
        currentTable.push(cells);
        continue;
      }

      if (currentTable.length > 0) {
        elements.push(flushTable(elKey++));
      }

      if (line.startsWith("- ") || line.startsWith("* ")) {
        if (currentList.length > 0 && isNumberedList) {
          elements.push(flushList(elKey++));
        }
        isNumberedList = false;
        currentList.push(line.substring(2));
        continue;
      }

      const numMatch = line.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        if (currentList.length > 0 && !isNumberedList) {
          elements.push(flushList(elKey++));
        }
        isNumberedList = true;
        currentList.push(numMatch[2]);
        continue;
      }

      if (currentList.length > 0) {
        elements.push(flushList(elKey++));
      }

      if (line.startsWith("#")) {
        const level = line.match(/^(#+)\s+(.*)/);
        if (level) {
          const hText = level[2];
          const hLevel = level[1].length;
          if (hLevel === 1) {
            elements.push(<h1 key={elKey++} className="text-base font-black text-teal-400 mt-4 mb-2">{renderInlineMarkdown(hText)}</h1>);
          } else if (hLevel === 2) {
            elements.push(<h2 key={elKey++} className="text-sm font-extrabold text-teal-400 mt-3 mb-1.5">{renderInlineMarkdown(hText)}</h2>);
          } else {
            elements.push(<h3 key={elKey++} className="text-xs font-bold text-teal-400 mt-2 mb-1">{renderInlineMarkdown(hText)}</h3>);
          }
          continue;
        }
      }

      if (line !== "") {
        elements.push(
          <p key={elKey++} className="my-1.5 leading-relaxed text-slate-205 font-medium">
            {renderInlineMarkdown(line)}
          </p>
        );
      } else {
        elements.push(<div key={elKey++} className="h-2" />);
      }
    }

    if (currentTable.length > 0) {
      elements.push(flushTable(elKey++));
    }
    if (currentList.length > 0) {
      elements.push(flushList(elKey++));
    }

    return <>{elements}</>;
  };

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 hover:scale-105 hover:shadow-xl transition transform border border-blue-400/30"
        title="Chat with CiviTrack"
      >
        <Send className="w-6 h-6" />
      </button>

      {/* Centered Large Chat Dialog Overlay */}
      <div
        className={`fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div
          className={`w-full max-w-4xl h-[85vh] bg-[#090d16] border border-white/10 rounded-2xl flex flex-col shadow-2xl overflow-hidden transition-transform duration-300 ${
            open ? "scale-100" : "scale-95"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 text-white bg-white/5">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-teal-400"></span>
              </span>
              <span className="font-extrabold tracking-wider text-xs uppercase text-slate-200">CiviTrack AI Assistant</span>
            </div>
            <button onClick={() => setOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <X className="w-4 h-4 text-slate-400 hover:text-white" />
            </button>
          </div>

          {/* Message List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 text-sm text-white scrollbar-thin">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-md ${
                    msg.role === "user"
                      ? "bg-teal-650 text-white rounded-tr-none font-semibold border border-teal-500/20"
                      : "bg-white/5 border border-white/10 rounded-tl-none"
                  }`}
                >
                  {renderFormattedText(msg.content)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="p-4 border-t border-white/10 bg-white/5 flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Ask about complaints (e.g., 'water leak in Hyderabad' or 'how many resolved?')..."
              className="flex-1 bg-black/45 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-teal-400 focus:ring-1 focus:ring-teal-400 placeholder-white/30 font-medium"
            />
            <button
              onClick={handleVoice}
              className={`p-3 rounded-xl border border-white/10 hover:bg-white/10 transition-colors ${
                listening ? "bg-teal-500/20 border-teal-500/40" : "bg-black/20"
              }`}
              title="Speech to Text"
            >
              <Mic className={`w-5 h-5 ${listening ? "animate-pulse text-teal-400" : "text-slate-350"}`} />
            </button>
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="p-3 rounded-xl bg-teal-500 hover:bg-teal-600 disabled:opacity-40 disabled:hover:bg-teal-500 text-white font-extrabold shadow-lg transition-all"
              title="Send Message"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatBot;
