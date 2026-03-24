"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import AppShell from "@/components/app-shell";

type Message = { role: "interviewer" | "candidate"; content: string };

const INTERVIEW_TYPES = [
  { id: "behavioral", icon: "🗣", label: "行为面试", desc: "STAR 法则评估" },
  { id: "technical", icon: "💻", label: "技术面试", desc: "技术原理与方案" },
  { id: "mixed", icon: "📊", label: "综合面试", desc: "行为 + 技术混合" },
  { id: "stress", icon: "⚡", label: "压力面试", desc: "高压追问，锻炼应变" },
];

export default function MockInterviewPage() {
  const [phase, setPhase] = useState<"setup" | "chat" | "feedback">("setup");
  const [targetJob, setTargetJob] = useState("前端工程师 - 字节跳动");
  const [interviewType, setInterviewType] = useState("behavioral");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [questionNum, setQuestionNum] = useState(1);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startInterview() {
    setMessages([
      {
        role: "interviewer",
        content: `你好，我是今天的面试官。欢迎来到${targetJob.split(" - ")[1] || "我们公司"}的面试。\n\n请先做一个简单的自我介绍吧。`,
      },
    ]);
    setPhase("chat");
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    setLoading(true);

    const newMessages: Message[] = [
      ...messages,
      { role: "candidate", content: text },
    ];
    setMessages(newMessages);

    await new Promise((r) => setTimeout(r, 1500));

    const followUps = [
      "谢谢你的回答。你提到了性能优化，能具体聊聊你是怎么发现、分析和解决性能问题的吗？",
      "不错。在这个过程中，你是如何与团队协作的？遇到了哪些分歧，怎么解决的？",
      "很好。如果给你重新做一次的机会，你会有什么不同的做法？",
      "最后一个问题：你对未来 2-3 年的职业规划是什么？为什么选择我们这个岗位？",
    ];

    const nextQ = followUps[Math.min(questionNum - 1, followUps.length - 1)];
    setMessages([...newMessages, { role: "interviewer", content: nextQ }]);
    setQuestionNum((n) => n + 1);
    setLoading(false);
  }

  if (phase === "setup") {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto py-12 px-6">
          <h1 className="text-2xl font-bold mb-2">🎤 模拟面试</h1>
          <p className="text-slate-500 text-sm mb-8">
            选择面试参数，Lisa 将扮演面试官与你进行仿真面试
          </p>

          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <label className="block text-sm font-semibold mb-2">
              目标岗位
            </label>
            <input
              type="text"
              value={targetJob}
              onChange={(e) => setTargetJob(e.target.value)}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <label className="block text-sm font-semibold mb-3">
              面试类型
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              {INTERVIEW_TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setInterviewType(t.id)}
                  className={`text-left p-3.5 rounded-xl border transition-colors ${
                    interviewType === t.id
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 hover:border-emerald-300"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {t.icon} {t.label}
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              onClick={startInterview}
              className="px-8 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            >
              开始面试 →
            </button>
          </div>
        </div>
      </AppShell>
    );
  }

  if (phase === "feedback") {
    return (
      <AppShell>
        <div className="p-8 max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">📊 面试反馈报告</h1>
            <p className="text-sm text-slate-500 mt-1">
              行为面试 · {targetJob} · 用时 12 分钟
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center mb-6">
            <div className="text-5xl font-bold text-emerald-600">76</div>
            <p className="text-sm text-slate-400 mb-5">综合得分</p>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "内容质量", score: 82 },
                { label: "逻辑结构", score: 70 },
                { label: "表达能力", score: 85 },
                { label: "专业深度", score: 68 },
                { label: "沟通技巧", score: 75 },
              ].map((d) => (
                <div
                  key={d.label}
                  className="bg-slate-50 rounded-lg p-3 text-center"
                >
                  <div className="text-lg font-bold text-emerald-600">
                    {d.score}
                  </div>
                  <div className="text-[10px] text-slate-400">{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">✅ 表现亮点</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  性能优化案例完整，包含全流程
                </li>
                <li className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  善于使用具体数据量化成果
                </li>
                <li className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                  表达清晰自然
                </li>
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">⚡ 待改进</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                <li className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  建议使用 STAR 框架组织回答
                </li>
                <li className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  技术深度可以再挖掘
                </li>
                <li className="flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                  缺少对业务影响的描述
                </li>
              </ul>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setPhase("setup");
                setMessages([]);
                setQuestionNum(1);
              }}
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            >
              再练一次 🔄
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              返回工作台
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  // Chat phase
  return (
    <AppShell>
      <div className="flex flex-col h-screen">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-semibold">🎤 行为面试进行中</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium">
              {targetJob}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-400">
              第 {questionNum}/8 题
            </span>
            <button
              onClick={() => setPhase("feedback")}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
            >
              结束面试
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 max-w-3xl mx-auto w-full space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 max-w-[85%] ${
                msg.role === "candidate"
                  ? "ml-auto flex-row-reverse"
                  : ""
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 ${
                  msg.role === "interviewer"
                    ? "bg-slate-200 text-slate-600"
                    : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {msg.role === "interviewer" ? "👔" : "我"}
              </div>
              <div
                className={`px-4 py-2.5 rounded-xl text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "interviewer"
                    ? "bg-white border border-slate-200"
                    : "bg-emerald-600 text-white"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs">
                👔
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-sm text-slate-400">
                面试官正在思考...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-3 bg-white border-t border-slate-100 max-w-3xl mx-auto w-full">
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
    </AppShell>
  );
}
