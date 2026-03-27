"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import AppShell from "@/components/app-shell";
import {
  getAccessToken,
  interviewApi,
  type InterviewDetail,
  type InterviewFeedback,
} from "@/lib/api";

type Phase = "setup" | "chat" | "feedback";

type ChatMsg = { role: "interviewer" | "candidate"; content: string };

const INTERVIEW_TYPES = [
  { id: "behavioral", icon: "🗣", label: "行为面试", desc: "STAR 法则评估" },
  { id: "technical", icon: "💻", label: "技术面试", desc: "技术原理与方案" },
  { id: "mixed", icon: "📊", label: "综合面试", desc: "行为 + 技术混合" },
  { id: "stress", icon: "⚡", label: "压力面试", desc: "高压追问，锻炼应变" },
];

const DIFFICULTIES = [
  { id: "easy", label: "简单" },
  { id: "medium", label: "中等" },
  { id: "hard", label: "困难" },
];

function detailToMessages(detail: InterviewDetail): ChatMsg[] {
  return detail.messages.map((m) => ({
    role: m.role === "interviewer" ? "interviewer" : "candidate",
    content: m.content,
  }));
}

function countInterviewerRounds(messages: ChatMsg[]): number {
  return messages.filter((m) => m.role === "interviewer").length;
}

export default function MockInterviewPage() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [targetJob, setTargetJob] = useState("前端工程师");
  const [jobDescription, setJobDescription] = useState("");
  const [interviewType, setInterviewType] = useState("behavioral");
  const [difficulty, setDifficulty] = useState("medium");
  const [interviewId, setInterviewId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [feedback, setFeedback] = useState<InterviewFeedback | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function startInterview() {
    if (!getAccessToken()) {
      setInitError("请先登录后再开始模拟面试。");
      return;
    }
    setInitError(null);
    setLoading(true);
    try {
      const detail = await interviewApi.create({
        target_job: targetJob.trim() || "通用岗位",
        type: interviewType,
        difficulty,
        job_description: jobDescription.trim() || undefined,
      });
      setInterviewId(detail.id);
      setMessages(detailToMessages(detail));
      setFeedback(null);
      setDurationSec(null);
      setPhase("chat");
    } catch (e) {
      setInitError(e instanceof Error ? e.message : "创建面试失败");
    } finally {
      setLoading(false);
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading || !interviewId) return;

    setInput("");
    setLoading(true);
    try {
      const detail = await interviewApi.answer(interviewId, text);
      setMessages(detailToMessages(detail));
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          role: "interviewer",
          content:
            e instanceof Error
              ? `抱歉，提交失败：${e.message}`
              : "抱歉，提交失败，请检查网络与后端服务。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function endInterview() {
    if (!interviewId) return;
    setLoading(true);
    try {
      const fb = await interviewApi.end(interviewId);
      setFeedback(fb);
      const detail = await interviewApi.get(interviewId);
      if (detail.duration != null) setDurationSec(detail.duration);
      setPhase("feedback");
    } catch (e) {
      setInitError(e instanceof Error ? e.message : "结束面试失败");
    } finally {
      setLoading(false);
    }
  }

  const questionRound = countInterviewerRounds(messages);

  if (phase === "setup") {
    return (
      <AppShell>
        <div className="max-w-xl mx-auto py-12 px-6">
          <h1 className="text-2xl font-bold mb-2">🎤 模拟面试</h1>
          <p className="text-slate-500 text-sm mb-8">
            Lisa 扮演面试官，基于真实 LLM 对话进行行为 / 技术仿真练习
          </p>

          {initError && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {initError}{" "}
              <Link href="/login" className="font-medium text-emerald-700 underline">
                去登录
              </Link>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <label className="block text-sm font-semibold mb-2">目标岗位</label>
            <input
              type="text"
              value={targetJob}
              onChange={(e) => setTargetJob(e.target.value)}
              placeholder="例如：前端工程师、产品经理"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <label className="block text-sm font-semibold mb-2">
              岗位 JD（可选）
            </label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="粘贴职位描述，便于面试官结合岗位追问"
              rows={4}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none resize-y focus:border-emerald-500"
            />
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <label className="block text-sm font-semibold mb-3">面试类型</label>
            <div className="grid grid-cols-2 gap-2.5">
              {INTERVIEW_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
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

          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-4">
            <label className="block text-sm font-semibold mb-3">难度</label>
            <div className="flex gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg border ${
                    difficulty === d.id
                      ? "border-emerald-500 bg-emerald-50 text-emerald-800"
                      : "border-slate-200 text-slate-600 hover:border-emerald-200"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => void startInterview()}
              disabled={loading}
              className="px-8 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? "准备中…" : "开始面试 →"}
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            <Link href="/interviews" className="text-emerald-600 hover:underline">
              查看历史面试记录
            </Link>
          </p>
        </div>
      </AppShell>
    );
  }

  if (phase === "feedback" && feedback) {
    const mins =
      durationSec != null
        ? `${Math.floor(durationSec / 60)} 分 ${durationSec % 60} 秒`
        : "—";

    const strengths = Array.isArray(feedback.strengths) ? feedback.strengths : [];
    const improvements = Array.isArray(feedback.improvements)
      ? feedback.improvements
      : [];
    const suggestions = Array.isArray(feedback.suggestions)
      ? feedback.suggestions
      : [];
    const topics = Array.isArray(feedback.recommended_topics)
      ? feedback.recommended_topics
      : [];

    return (
      <AppShell>
        <div className="p-8 max-w-3xl">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">📊 面试反馈报告</h1>
            <p className="text-sm text-slate-500 mt-1">
              {INTERVIEW_TYPES.find((t) => t.id === interviewType)?.label ?? interviewType}{" "}
              · {targetJob} · 用时 {mins}
            </p>
            {interviewId && (
              <p className="text-xs text-slate-400 mt-2">
                <Link
                  href={`/mock-interview/${interviewId}/report`}
                  className="text-emerald-600 hover:underline"
                >
                  独立报告页（可收藏链接）
                </Link>
              </p>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 text-center mb-6">
            <div className="text-5xl font-bold text-emerald-600">
              {feedback.overall_score}
            </div>
            <p className="text-sm text-slate-400 mb-5">综合得分</p>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: "内容质量", score: feedback.content_score },
                { label: "逻辑结构", score: feedback.structure_score },
                { label: "表达能力", score: feedback.expression_score },
                { label: "专业深度", score: feedback.professional_score },
                { label: "沟通技巧", score: feedback.communication_score },
              ].map((d) => (
                <div
                  key={d.label}
                  className="bg-slate-50 rounded-lg p-3 text-center"
                >
                  <div className="text-lg font-bold text-emerald-600">{d.score}</div>
                  <div className="text-[10px] text-slate-400">{d.label}</div>
                </div>
              ))}
            </div>
          </div>

          {feedback.summary ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold mb-2">总体评价</h3>
              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                {feedback.summary}
              </p>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">✅ 表现亮点</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {strengths.length === 0 ? (
                  <li className="text-slate-400">暂无</li>
                ) : (
                  strengths.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      {String(s)}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">⚡ 待改进</h3>
              <ul className="space-y-1.5 text-sm text-slate-600">
                {improvements.length === 0 ? (
                  <li className="text-slate-400">暂无</li>
                ) : (
                  improvements.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      {String(s)}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </div>

          {suggestions.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold mb-3">💡 行动建议</h3>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                {suggestions.map((s, i) => (
                  <li key={i}>{String(s)}</li>
                ))}
              </ul>
            </div>
          )}

          {topics.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="text-sm font-semibold mb-3">📚 推荐练习主题</h3>
                <div className="flex flex-wrap gap-2">
                  {topics.map((t, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-800 rounded-full border border-emerald-200"
                    >
                      {String(t)}
                    </span>
                  ))}
                </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                setPhase("setup");
                setMessages([]);
                setInterviewId(null);
                setFeedback(null);
                setInitError(null);
              }}
              className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
            >
              再练一次 🔄
            </button>
            <Link
              href="/interviews"
              className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
            >
              面试记录
            </Link>
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

  return (
    <AppShell>
      <div className="flex flex-col h-screen">
        <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100">
          <div className="flex items-center gap-3 min-w-0">
            <h3 className="text-sm font-semibold shrink-0">🎤 面试进行中</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium truncate max-w-[200px] sm:max-w-md">
              {targetJob}
            </span>
          </div>
          <div className="flex items-center gap-4 shrink-0">
            <span className="text-xs text-slate-400 hidden sm:inline">
              第 {questionRound} 轮对话
            </span>
            <button
              type="button"
              onClick={() => void endInterview()}
              disabled={loading || !interviewId}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-50"
            >
              {loading ? "生成报告中…" : "结束面试"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 max-w-3xl mx-auto w-full space-y-5">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 max-w-[85%] ${
                msg.role === "candidate" ? "ml-auto flex-row-reverse" : ""
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

        <div className="px-6 py-3 bg-white border-t border-slate-100 max-w-3xl mx-auto w-full">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && void send()}
              placeholder="输入你的回答..."
              disabled={loading}
              className="flex-1 bg-transparent text-sm py-2 outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => void send()}
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
