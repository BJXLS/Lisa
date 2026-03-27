"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import {
  getAccessToken,
  interviewApi,
  type InterviewDetail,
  type InterviewFeedback,
} from "@/lib/api";

const TYPE_LABEL: Record<string, string> = {
  behavioral: "行为面试",
  technical: "技术面试",
  mixed: "综合面试",
  stress: "压力面试",
};

function FeedbackView({
  detail,
  feedback,
}: {
  detail: InterviewDetail;
  feedback: InterviewFeedback;
}) {
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
  const durationSec = detail.duration;
  const mins =
    durationSec != null
      ? `${Math.floor(durationSec / 60)} 分 ${durationSec % 60} 秒`
      : "—";

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold">📊 面试反馈报告</h1>
        <p className="text-sm text-slate-500 mt-1">
          {TYPE_LABEL[detail.type] ?? detail.type} · {detail.target_job} · 用时{" "}
          {mins}
        </p>
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
            <div key={d.label} className="bg-slate-50 rounded-lg p-3 text-center">
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
        <Link
          href="/mock-interview"
          className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
        >
          再练一次
        </Link>
        <Link
          href="/interviews"
          className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          面试记录
        </Link>
      </div>
    </div>
  );
}

export default function InterviewReportPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [detail, setDetail] = useState<InterviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!getAccessToken()) {
        setError("请先登录");
        return;
      }
      try {
        const d = await interviewApi.get(id);
        if (!cancelled) setDetail(d);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <AppShell>
      {error && (
        <div className="p-8 max-w-xl mx-auto">
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}{" "}
            <Link href="/login" className="underline font-medium">
              去登录
            </Link>
          </div>
        </div>
      )}
      {!error && !detail && (
        <div className="p-8 text-center text-slate-500 text-sm">加载中…</div>
      )}
      {detail && detail.feedback && (
        <FeedbackView detail={detail} feedback={detail.feedback} />
      )}
      {detail && !detail.feedback && detail.status === "completed" && (
        <div className="p-8 max-w-xl mx-auto text-center text-slate-600 text-sm">
          面试已结束，但未找到反馈记录。
        </div>
      )}
      {detail &&
        detail.status === "in_progress" &&
        !detail.feedback && (
        <div className="p-8 max-w-xl mx-auto text-center">
          <p className="text-slate-600 text-sm mb-4">该面试尚未结束。</p>
          <Link
            href="/mock-interview"
            className="text-emerald-600 text-sm font-medium hover:underline"
          >
            返回模拟面试继续作答
          </Link>
        </div>
      )}
    </AppShell>
  );
}
