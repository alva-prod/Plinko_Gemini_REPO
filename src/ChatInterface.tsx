import { useState, useRef, useEffect } from "react";
import { Send, Zap, Bot, User, Loader2, Trophy, X } from "lucide-react";
import PlinkoGame from "./PlinkoGame";

interface Message {
  role: "user" | "assistant";
  content: string;
}

type AppState = "chat" | "plinko" | "loading" | "thinking";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function callGemini(prompt: string, history: Message[]): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/gemini-chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ prompt, history }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data.text;
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [appState, setAppState] = useState<AppState>("chat");
  const [ballCount, setBallCount] = useState(0);
  const [statusText, setStatusText] = useState("");
  const bigWinRef = useRef(false);
  const pendingPromptRef = useRef("");
  const messagesRef = useRef<Message[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, appState]);

  const wordCount = input.trim() === "" ? 0 : input.trim().split(/\s+/).length;

  function computeBalls(wc: number): number {
    if (wc < 10) return 0;
    if (wc < 20) return 50;
    if (wc < 50) return 30;
    return 10;
  }

  const computedBalls = computeBalls(wordCount);

  const handleGenerate = () => {
    if (!input.trim() || appState !== "chat") return;
    const prompt = input.trim();
    const wc = prompt.split(/\s+/).length;
    const balls = computeBalls(wc);

    pendingPromptRef.current = prompt;
    setBallCount(balls);
    bigWinRef.current = false;

    if (balls <= 0) {
      // Not enough words — go straight to API
      setInput("");
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      setAppState("loading");
      setStatusText("Generating response...");
      callGemini(prompt, messages)
        .then((text) => {
          setMessages((prev) => [...prev, { role: "assistant", content: text }]);
          setAppState("chat");
          setStatusText("");
        })
        .catch((err) => {
          setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${err.message}` }]);
          setAppState("chat");
          setStatusText("");
        });
      return;
    }

    setInput("");
    setAppState("plinko");
    setStatusText(`${balls} ball${balls !== 1 ? "s" : ""} — land on a gold slot to get your answer!`);
  };

  const handlePlinkoResult = (slot: number, total: number, big: boolean) => {
    if (big && !bigWinRef.current) {
      bigWinRef.current = true;
      setStatusText("Big win! Fetching your answer...");
    }
  };

  const closePlinko = () => {
    const prompt = pendingPromptRef.current;
    const history = messagesRef.current;
    setAppState("thinking");
    setMessages((prev) => [...prev, { role: "user", content: prompt }]);
    callGemini(prompt, history)
      .then((text) => {
        setMessages((prev) => [...prev, { role: "assistant", content: text }]);
        setAppState("chat");
        setStatusText("");
      })
      .catch((err) => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${err.message}` },
        ]);
        setAppState("chat");
        setStatusText("");
      });
  };

  const handleAllBallsDone = () => {
    if (bigWinRef.current) {
      const prompt = pendingPromptRef.current;
      const history = messagesRef.current;
      setAppState("thinking");
      setMessages((prev) => [...prev, { role: "user", content: prompt }]);
      callGemini(prompt, history)
        .then((text) => {
          setMessages((prev) => [...prev, { role: "assistant", content: text }]);
          setAppState("chat");
          setStatusText("");
        })
        .catch((err) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${err.message}` },
          ]);
          setAppState("chat");
          setStatusText("");
        });
    } else {
      window.location.reload();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleGenerate();
    }
  };

  const showPlinko = appState === "plinko";

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <Zap className="w-5 h-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-base font-semibold text-slate-100">Plinko Chat</h1>
          <p className="text-xs text-slate-500">Powered by Gemini · Win big to get a response</p>
        </div>
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat column */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
            {messages.length === 0 && !showPlinko && (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                  <Zap className="w-8 h-8 text-amber-400" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-200 mb-1">Welcome to Plinko Chat</h2>
                  <p className="text-slate-500 text-sm max-w-md">
                    Type your message below. 10+ words triggers a Plinko game.
                    Land a ball on a gold slot (25x or 100x) to send your query to Gemini.
                  </p>
                </div>
                <div className="flex gap-3 text-xs text-slate-600">
                  <span className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                    &lt;10 words = instant reply
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                    10–19 = 50 balls
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                    20–49 = 30 balls
                  </span>
                  <span className="px-3 py-1.5 rounded-full bg-slate-800 border border-slate-700">
                    50+ = 10 balls
                  </span>
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center mt-0.5">
                    <Bot className="w-4 h-4 text-blue-400" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-amber-500/15 border border-amber-500/25 text-slate-100"
                      : "bg-slate-800 border border-slate-700 text-slate-200"
                  }`}
                >
                  <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                </div>
                {msg.role === "user" && (
                  <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mt-0.5">
                    <User className="w-4 h-4 text-amber-400" />
                  </div>
                )}
              </div>
            ))}

            {appState === "loading" && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-blue-400" />
                </div>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                  <span className="text-sm text-slate-400">Thinking...</span>
                </div>
              </div>
            )}

            {appState === "thinking" && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-amber-400" />
                </div>
                <div className="bg-slate-800 border border-amber-500/30 rounded-2xl px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span className="text-sm text-amber-400">Big win! Generating your answer...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Status bar */}
          {statusText && (
            <div className="mx-4 mb-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-sm text-center">
              {statusText}
            </div>
          )}

          {/* Input area */}
          <div className="px-4 pb-5 pt-2">
            <div className="relative rounded-2xl border border-slate-700 bg-slate-900 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message… (200+ words unlocks Plinko)"
                disabled={appState !== "chat"}
                rows={3}
                className="w-full bg-transparent px-4 pt-4 pb-12 text-sm text-slate-100 placeholder-slate-600 resize-none outline-none disabled:opacity-50"
              />
              <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-600">
                  <span>
                    {wordCount} word{wordCount !== 1 ? "s" : ""}
                  </span>
                  {wordCount > 0 && (
                    <>
                      <span>·</span>
                      {computedBalls > 0 ? (
                        <span className="text-amber-500">
                          {computedBalls} balls to play
                        </span>
                      ) : (
                        <span className="text-slate-600">
                          {10 - wordCount} more word{10 - wordCount !== 1 ? "s" : ""} for Plinko
                        </span>
                      )}
                    </>
                  )}
                </div>
                <button
                  onClick={handleGenerate}
                  disabled={!input.trim() || appState !== "chat"}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 disabled:text-slate-500 text-slate-900 text-sm font-semibold transition-all active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                  Generate
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-700 mt-2 text-center">
              Ctrl+Enter to send · 10–19 words=50 balls · 20–49=30 balls · 50+=10 balls · 25x/100x sends query
            </p>
          </div>
        </div>

        {/* Plinko panel */}
        <div
          className={`flex flex-col items-center justify-center border-l border-slate-800 bg-slate-900/50 transition-all duration-500 ${
            showPlinko ? "w-[540px] opacity-100" : "w-0 opacity-0 overflow-hidden"
          }`}
        >
          {showPlinko && (
            <div className="flex flex-col items-center gap-4 p-6">
              <div className="flex items-start justify-between w-full">
                <div className="text-center flex-1">
                  <h3 className="text-sm font-semibold text-slate-300 mb-0.5">Plinko Mini-Game</h3>
                  <p className="text-xs text-slate-500">
                    {ballCount} ball{ballCount !== 1 ? "s" : ""} · Gold slots send your query
                  </p>
                </div>
                <button
                  onClick={closePlinko}
                  className="flex flex-col items-center gap-0.5 text-slate-500 hover:text-amber-400 transition-colors group ml-2 flex-shrink-0"
                  title="Close and generate response"
                >
                  <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 group-hover:border-amber-500/40 flex items-center justify-center transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-[10px] leading-none">close to generate</span>
                </button>
              </div>
              <PlinkoGame
                ballCount={ballCount}
                onResult={handlePlinkoResult}
                onAllBallsDone={handleAllBallsDone}
              />
              <div className="flex gap-2 text-xs flex-wrap justify-center">
                <span className="px-2 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-500">0x — no send</span>
                <span className="px-2 py-1 rounded-full bg-slate-800 border border-blue-500/30 text-blue-400">2x–5x — no send</span>
                <span className="px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/40 text-amber-400">25x / 100x — sends query!</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
