"use client";

import { useState } from "react";
import AppShell from "@/components/app-shell";

type Suggestion = {
  priority: string;
  type: string;
  original: string;
  improved: string;
  reason: string;
};

export default function ResumeOptimizerPage() {
  const [showResult, setShowResult] = useState(false);
  const [jd, setJd] = useState("");

  const mockSuggestions: Suggestion[] = [
    {
      priority: "high",
      type: "量化成果",
      original: "负责前端页面性能优化",
      improved:
        "主导电商核心页面性能优化，首屏加载时间从 3.2s 降至 1.1s，用户跳出率降低 18%",
      reason: "添加具体数据让成果更有说服力",
    },
    {
      priority: "high",
      type: "关键词缺失",
      original: "使用 React 进行前端开发",
      improved:
        "基于 React + TypeScript 技术栈，设计并实现微前端架构，支撑 20+ 子应用独立部署",
      reason: "JD 中要求 TypeScript 和微前端经验",
    },
    {
      priority: "medium",
      type: "措辞优化",
      original: "参与了公司内部组件库的建设",
      improved:
        "主导搭建公司级 React 组件库（60+ 组件），被 8 个业务线采用，开发效率提升 30%",
      reason: "「参与」表述模糊，建议明确角色和量化影响",
    },
  ];

  return (
    <AppShell>
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">🔍 简历优化</h1>
        <p className="text-slate-500 mb-6 text-sm">
          上传简历和目标岗位 JD，Lisa 为你深度诊断并给出优化方案
        </p>

        {!showResult ? (
          <>
            {/* Upload Area */}
            <div
              className="bg-white border-2 border-dashed border-slate-200 rounded-xl p-12 text-center mb-6 cursor-pointer hover:border-emerald-300 transition-colors"
              onClick={() => setShowResult(true)}
            >
              <div className="text-4xl mb-3">📄</div>
              <h3 className="font-semibold mb-1">上传你的简历</h3>
              <p className="text-sm text-slate-400">
                支持 PDF、Word、纯文本 · 也可以选择已有简历
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <button className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg">
                  上传文件
                </button>
                <button className="px-4 py-2 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg border border-slate-200">
                  选择已有简历
                </button>
              </div>
            </div>

            {/* JD Input */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <label className="block text-sm font-semibold mb-2">
                目标岗位 JD（可选）
              </label>
              <textarea
                value={jd}
                onChange={(e) => setJd(e.target.value)}
                placeholder={"粘贴目标岗位的职位描述 (Job Description)..."}
                className="w-full h-28 px-3 py-2 border border-slate-200 rounded-lg text-sm outline-none resize-y focus:border-emerald-500"
              />
            </div>

            <div className="text-center">
              <button
                onClick={() => setShowResult(true)}
                className="px-8 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
              >
                开始分析 →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Score Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 flex items-center gap-8">
              <div className="w-28 h-28 rounded-full border-[5px] border-emerald-200 flex flex-col items-center justify-center shrink-0 relative">
                <span className="text-3xl font-bold text-emerald-600">78</span>
                <span className="text-[10px] text-slate-400">总匹配度</span>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold mb-3">简历诊断结果</h3>
                <ScoreBar label="技能匹配" value={85} />
                <ScoreBar label="经验匹配" value={72} />
                <ScoreBar label="教育匹配" value={90} />
                <ScoreBar label="关键词覆盖" value={65} color="amber" />
                <ScoreBar label="ATS 兼容" value={92} />
              </div>
            </div>

            {/* Suggestions */}
            <h3 className="font-semibold mb-3">📋 优化建议</h3>
            <div className="space-y-3 mb-6">
              {mockSuggestions.map((s, i) => (
                <div
                  key={i}
                  className="bg-white border border-slate-200 rounded-xl p-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        s.priority === "high"
                          ? "bg-red-50 text-red-600"
                          : "bg-amber-50 text-amber-600"
                      }`}
                    >
                      {s.priority === "high" ? "高优" : "中优"}
                    </span>
                    <span className="text-xs font-semibold">{s.type}</span>
                  </div>
                  <div className="text-sm text-slate-400 line-through bg-red-50 rounded-lg px-3 py-2 mb-1.5">
                    {s.original}
                  </div>
                  <div className="text-sm text-emerald-700 font-medium bg-emerald-50 rounded-lg px-3 py-2 mb-1.5">
                    {s.improved}
                  </div>
                  <p className="text-xs text-slate-400">💡 {s.reason}</p>
                </div>
              ))}
            </div>

            {/* Keywords */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">🔑 关键词匹配分析</h3>
              <p className="text-xs text-slate-400 mb-2">✅ 已覆盖</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {[
                  "React",
                  "JavaScript",
                  "CSS",
                  "Git",
                  "Webpack",
                  "Node.js",
                  "性能优化",
                  "组件化",
                ].map((kw) => (
                  <span
                    key={kw}
                    className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200"
                  >
                    {kw}
                  </span>
                ))}
              </div>
              <p className="text-xs text-slate-400 mb-2">
                ❌ 未覆盖 — 建议补充
              </p>
              <div className="flex flex-wrap gap-1.5">
                {["TypeScript", "微前端", "CI/CD", "Docker", "SSR"].map(
                  (kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-full border border-red-200"
                    >
                      {kw}
                    </span>
                  ),
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <button className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
                一键应用全部优化 ✨
              </button>
              <button
                onClick={() => setShowResult(false)}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                重新上传
              </button>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function ScoreBar({
  label,
  value,
  color = "emerald",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  const barColor =
    color === "amber" ? "bg-amber-500" : "bg-emerald-500";
  const textColor =
    color === "amber" ? "text-amber-600" : "text-slate-700";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-slate-500 w-16">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-semibold w-9 text-right ${textColor}`}>
        {value}%
      </span>
    </div>
  );
}
