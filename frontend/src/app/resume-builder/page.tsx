"use client";

import { useState, useRef, useEffect } from "react";
import AppShell from "@/components/app-shell";
import { chatStream } from "@/lib/api";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const INITIAL_MSG: Message = {
  role: "assistant",
  content:
    "你好！我是 Lisa，你的简历助手 🙌\n\n我会通过对话帮你创建一份专业简历。首先，你想应聘什么岗位呢？",
};

export default function ResumeBuilderPage() {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    try {
      let aiContent = "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "" },
      ]);

      for await (const chunk of chatStream(text, "resume_build")) {
        aiContent += chunk;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: aiContent };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content: "抱歉，连接出现了问题。请检查后端服务是否正常运行。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="flex h-screen">
        {/* Chat Panel */}
        <div className="flex-1 flex flex-col border-r border-slate-200">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100">
            <h2 className="text-sm font-semibold">📝 新建简历</h2>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 mr-2">进度</span>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className={`w-7 h-1 rounded-full ${
                    i <= 2
                      ? "bg-emerald-600"
                      : i === 3
                        ? "bg-emerald-300 animate-pulse"
                        : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === "user"
                    ? "ml-auto flex-row-reverse"
                    : ""
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                    msg.role === "assistant"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {msg.role === "assistant" ? "L" : "我"}
                </div>
                <div
                  className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "assistant"
                      ? "bg-white border border-slate-200"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-3 bg-white border-t border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder="输入你的回答..."
                className="flex-1 bg-transparent text-sm py-2 outline-none"
              />
              <button
                onClick={send}
                disabled={loading}
                className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="w-96 bg-slate-100 flex flex-col shrink-0">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-600">实时预览</h3>
            <button className="text-xs text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700">
              导出 PDF
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 flex justify-center">
            <div className="w-full max-w-[340px] bg-white rounded shadow-lg p-7 text-xs leading-relaxed">
              <div className="text-xl font-bold mb-0.5 font-serif">张明</div>
              <div className="text-emerald-600 text-sm mb-1">前端工程师</div>
              <div className="text-slate-400 text-[11px] mb-4">
                138xxxx1234 · zhangming@email.com · 北京
              </div>

              <ResumeSection title="教育背景">
                <p className="font-semibold">北京大学 · 计算机科学与技术</p>
                <p className="text-slate-400">
                  硕士 · 2020.09 - 2023.06 · GPA 3.8/4.0
                </p>
              </ResumeSection>

              <ResumeSection title="工作经历">
                <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400">
                  💬 正在对话采集中...
                  <br />
                  <span className="text-[10px]">
                    回答 Lisa 的问题，内容将实时更新
                  </span>
                </div>
              </ResumeSection>

              <ResumeSection title="技能特长">
                <div className="border border-dashed border-slate-200 rounded-lg p-3 text-center text-slate-300 text-[10px]">
                  待采集
                </div>
              </ResumeSection>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ResumeSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-600 pb-0.5 mb-2">
        {title}
      </div>
      {children}
    </div>
  );
}
