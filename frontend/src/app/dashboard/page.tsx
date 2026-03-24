"use client";

import Link from "next/link";
import AppShell from "@/components/app-shell";

export default function DashboardPage() {
  return (
    <AppShell>
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">👋 欢迎回来</h1>
        <p className="text-slate-500 mb-8">继续你的求职之旅</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="我的简历" value="3" sub="最近更新 2 天前" />
          <StatCard label="模拟面试" value="7" sub="平均得分 76 分" />
          <StatCard label="优化建议" value="12" sub="已采纳 8 条" />
        </div>

        {/* Quick Actions */}
        <h2 className="text-lg font-semibold mb-3">快速开始</h2>
        <div className="grid grid-cols-3 gap-4 mb-8">
          <QuickAction
            icon="✨"
            title="新建简历"
            desc="对话式创建专业简历"
            href="/resume-builder"
          />
          <QuickAction
            icon="📄"
            title="优化简历"
            desc="上传简历获取 AI 诊断"
            href="/resume-optimizer"
          />
          <QuickAction
            icon="💬"
            title="开始面试"
            desc="AI 面试官一对一练习"
            href="/mock-interview"
          />
        </div>

        {/* Resume list */}
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">我的简历</h2>
          <Link
            href="/resume-builder"
            className="text-sm text-emerald-600 hover:underline"
          >
            + 新建
          </Link>
        </div>
        <div className="flex flex-col gap-3">
          <ResumeRow
            title="前端工程师 - 字节跳动"
            meta="更新于 2026-03-21 · 经典商务模板"
            status="completed"
            score={82}
          />
          <ResumeRow
            title="全栈工程师 - 通用版"
            meta="更新于 2026-03-18 · 技术极客模板"
            status="optimized"
            score={91}
          />
          <ResumeRow
            title="产品经理 - 腾讯"
            meta="更新于 2026-03-15 · 简约现代模板"
            status="draft"
          />
        </div>
      </div>
    </AppShell>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      <p className="text-xs text-emerald-600 mt-0.5">{sub}</p>
    </div>
  );
}

function QuickAction({
  icon,
  title,
  desc,
  href,
}: {
  icon: string;
  title: string;
  desc: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 p-6 bg-white rounded-xl border border-slate-200 text-center hover:border-emerald-300 hover:-translate-y-0.5 hover:shadow-md transition-all"
    >
      <span className="text-2xl">{icon}</span>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-slate-400">{desc}</p>
    </Link>
  );
}

function ResumeRow({
  title,
  meta,
  status,
  score,
}: {
  title: string;
  meta: string;
  status: string;
  score?: number;
}) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    completed: {
      label: "已完成",
      cls: "bg-emerald-50 text-emerald-700",
    },
    optimized: {
      label: "已优化",
      cls: "bg-blue-50 text-blue-700",
    },
    draft: {
      label: "草稿",
      cls: "bg-amber-50 text-amber-700",
    },
  };
  const s = statusMap[status] ?? statusMap.draft;

  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-5 py-4 hover:border-emerald-300 transition-colors cursor-pointer">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-slate-400 mt-0.5">{meta}</p>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${s.cls}`}
        >
          {s.label}
        </span>
        {score != null && (
          <span className="text-sm font-semibold text-emerald-600">
            {score} 分
          </span>
        )}
      </div>
    </div>
  );
}
