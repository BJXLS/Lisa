"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/app-shell";
import { getAccessToken, interviewApi, type InterviewListItem } from "@/lib/api";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  in_progress: { text: "进行中", cls: "bg-amber-50 text-amber-800" },
  completed: { text: "已完成", cls: "bg-emerald-50 text-emerald-800" },
  abandoned: { text: "已放弃", cls: "bg-slate-100 text-slate-600" },
};

const TYPE_LABEL: Record<string, string> = {
  behavioral: "行为",
  technical: "技术",
  mixed: "综合",
  stress: "压力",
};

export default function InterviewsPage() {
  const [items, setItems] = useState<InterviewListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      if (!getAccessToken()) {
        setError("请先登录后查看面试记录");
        return;
      }
      try {
        const list = await interviewApi.list();
        if (!cancelled) setItems(list);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell>
      <div className="p-8 max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">📋 面试记录</h1>
            <p className="text-sm text-slate-500">
              查看历史模拟面试，已结束的会话可打开反馈报告
            </p>
          </div>
          <Link
            href="/mock-interview"
            className="text-sm font-medium text-white bg-emerald-600 px-4 py-2 rounded-lg hover:bg-emerald-700"
          >
            新建面试
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}{" "}
            <Link href="/login" className="font-medium text-emerald-700 underline">
              去登录
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {items.length === 0 && !error && (
            <div className="text-center text-sm text-slate-400 py-12 border border-dashed border-slate-200 rounded-xl">
              暂无记录，去{" "}
              <Link href="/mock-interview" className="text-emerald-600 underline">
                模拟面试
              </Link>{" "}
              开始第一场吧
            </div>
          )}
          {items.map((row) => {
            const st = STATUS_LABEL[row.status] ?? STATUS_LABEL.in_progress;
            const typeShort = TYPE_LABEL[row.type] ?? row.type;
            return (
              <div
                key={row.id}
                className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-4"
              >
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold truncate">{row.target_job}</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {typeShort} ·{" "}
                    {new Date(row.started_at).toLocaleString("zh-CN", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${st.cls}`}
                  >
                    {st.text}
                  </span>
                  {row.status === "completed" ? (
                    <Link
                      href={`/mock-interview/${row.id}/report`}
                      className="text-xs font-medium text-emerald-700 hover:underline"
                    >
                      查看报告
                    </Link>
                  ) : (
                    <Link
                      href="/mock-interview"
                      className="text-xs text-slate-500 hover:text-emerald-600"
                    >
                      继续
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
