"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/app-shell";
import { resumeApi, type OptimizeAnalysis, type ResumeListItem } from "@/lib/api";

export default function ResumeOptimizerPage() {
  const [jd, setJd] = useState("");
  const [resumes, setResumes] = useState<ResumeListItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [analysis, setAnalysis] = useState<OptimizeAnalysis | null>(null);
  const [appliedIndexes, setAppliedIndexes] = useState<number[]>([]);
  const [applyReport, setApplyReport] = useState<{
    mode: "single" | "all" | "high" | "rollback";
    appliedCount: number;
    atsBefore: number | null;
    atsAfter: number | null;
  } | null>(null);
  const [ats, setAts] = useState<{
    score: number;
    issues: string[];
    suggestions: string[];
  } | null>(null);
  const [parsedJd, setParsedJd] = useState<{
    target_job: string;
    skills: string[];
    years_requirement: string;
    education_requirement: string;
    keywords: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const items = await resumeApi.list();
        if (cancelled) return;
        setResumes(items);
        if (!selectedResumeId && items.length > 0) setSelectedResumeId(items[0].id);
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "加载简历列表失败");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const score = analysis?.overall_score ?? null;
  const suggestions = analysis?.suggestions ?? [];
  const keywordsCovered = analysis?.keywords?.covered ?? [];
  const keywordsMissing = analysis?.keywords?.missing ?? [];

  const dimensionRows = useMemo(() => {
    const dimensions = analysis?.dimensions ?? {};
    const pick = (k: string) => {
      const v = dimensions?.[k];
      const s = typeof v?.score === "number" ? v.score : 0;
      return { score: Math.max(0, Math.min(100, s)) };
    };
    return [
      { label: "技能匹配", v: pick("skill_match") },
      { label: "经验匹配", v: pick("experience_match") },
      { label: "教育匹配", v: pick("education_match") },
      { label: "关键词覆盖", v: pick("keyword_coverage"), color: "amber" as const },
      { label: "ATS 兼容", v: pick("ats_compatibility") },
    ];
  }, [analysis]);

  async function onImportFile(file: File) {
    if (!file) return;
    setError(null);
    setImporting(true);
    try {
      const created = await resumeApi.importFile(file);
      const items = await resumeApi.list();
      setResumes(items);
      setSelectedResumeId(created.id);
      setAnalysis(null);
      setAts(null);
      setParsedJd(null);
      setAppliedIndexes([]);
      setApplyReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "导入失败");
    } finally {
      setImporting(false);
    }
  }

  async function analyze() {
    if (!selectedResumeId) {
      setError("请先选择或导入一份简历");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      if (jd.trim()) {
        const parsed = await resumeApi.parseJd({ job_description: jd.trim() });
        setParsedJd(parsed);
      } else {
        setParsedJd(null);
      }
      const res = await resumeApi.optimize(selectedResumeId, {
        job_description: jd.trim() ? jd : undefined,
      });
      setAnalysis(res);
      setAppliedIndexes([]);
      setApplyReport(null);
      const atsRes = await resumeApi.atsCheck(selectedResumeId, jd.trim() ? jd : undefined);
      setAts(atsRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "分析失败");
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyAll() {
    if (!selectedResumeId || !analysis) return;
    setError(null);
    setApplying(true);
    try {
      const atsBefore = ats?.score ?? null;
      await resumeApi.applyOptimizations(selectedResumeId, analysis.suggestions);
      const items = await resumeApi.list();
      setResumes(items);
      const atsRes = await resumeApi.atsCheck(selectedResumeId, jd.trim() ? jd : undefined);
      setAts(atsRes);
      setAppliedIndexes(analysis.suggestions.map((_, i) => i));
      setApplyReport({
        mode: "all",
        appliedCount: analysis.suggestions.length,
        atsBefore,
        atsAfter: atsRes.score,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "应用失败");
    } finally {
      setApplying(false);
    }
  }

  async function applyHighPriority() {
    if (!selectedResumeId || !analysis) return;
    const high = analysis.suggestions.filter(
      (s) => String(s.priority || "").toLowerCase() === "high",
    );
    if (high.length === 0) {
      setError("当前没有高优先级建议可应用");
      return;
    }
    setError(null);
    setApplying(true);
    try {
      const atsBefore = ats?.score ?? null;
      await resumeApi.applyOptimizations(selectedResumeId, high);
      const atsRes = await resumeApi.atsCheck(selectedResumeId, jd.trim() ? jd : undefined);
      setAts(atsRes);

      const highSet = new Set(
        analysis.suggestions
          .map((s, i) => ({ s, i }))
          .filter(({ s }) => String(s.priority || "").toLowerCase() === "high")
          .map(({ i }) => i),
      );
      setAppliedIndexes((prev) => Array.from(new Set([...prev, ...highSet])));
      setApplyReport({
        mode: "high",
        appliedCount: high.length,
        atsBefore,
        atsAfter: atsRes.score,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "高优应用失败");
    } finally {
      setApplying(false);
    }
  }

  async function applyOne(index: number) {
    if (!selectedResumeId || !analysis) return;
    if (appliedIndexes.includes(index)) return;
    const target = analysis.suggestions[index];
    if (!target) return;
    setError(null);
    setApplying(true);
    try {
      const atsBefore = ats?.score ?? null;
      await resumeApi.applyOptimizations(selectedResumeId, [target]);
      const atsRes = await resumeApi.atsCheck(selectedResumeId, jd.trim() ? jd : undefined);
      setAts(atsRes);
      setAppliedIndexes((prev) => [...prev, index]);
      setApplyReport({
        mode: "single",
        appliedCount: 1,
        atsBefore,
        atsAfter: atsRes.score,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "单条应用失败");
    } finally {
      setApplying(false);
    }
  }

  async function rollbackLastOptimization() {
    if (!selectedResumeId) return;
    setError(null);
    setApplying(true);
    try {
      const atsBefore = ats?.score ?? null;
      await resumeApi.rollbackLastOptimization(selectedResumeId);
      const atsRes = await resumeApi.atsCheck(selectedResumeId, jd.trim() ? jd : undefined);
      setAts(atsRes);
      setAppliedIndexes([]);
      setApplyReport({
        mode: "rollback",
        appliedCount: 0,
        atsBefore,
        atsAfter: atsRes.score,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "撤销失败");
    } finally {
      setApplying(false);
    }
  }

  return (
    <AppShell>
      <div className="p-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-1">🔍 简历优化</h1>
        <p className="text-slate-500 mb-6 text-sm">
          上传简历和目标岗位 JD，Lisa 为你深度诊断并给出优化方案
        </p>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Resume select + import */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-[220px] flex-1">
              <label className="block text-sm font-semibold mb-2">
                选择已有简历
              </label>
              <select
                value={selectedResumeId}
                onChange={(e) => setSelectedResumeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white"
              >
                {resumes.length === 0 ? (
                  <option value="">暂无简历，请先导入</option>
                ) : (
                  resumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} {r.target_job ? `· ${r.target_job}` : ""}
                    </option>
                  ))
                )}
              </select>
              <p className="text-xs text-slate-400 mt-2">
                你也可以先去「简历生成」创建一份草稿，再回来优化
              </p>
            </div>

            <div className="min-w-[240px]">
              <label className="block text-sm font-semibold mb-2">
                上传简历文件
              </label>
              <label className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 cursor-pointer">
                {importing ? "正在导入…" : "上传 PDF / Word / 文本"}
                <input
                  type="file"
                  accept=".pdf,.docx,.txt,.md"
                  className="hidden"
                  disabled={importing}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onImportFile(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
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

        {parsedJd && (
          <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
            <h3 className="font-semibold mb-3">🧠 JD 结构化解析</h3>
            <div className="text-sm text-slate-600 grid gap-2">
              <p>
                <span className="text-slate-400">岗位：</span>
                {parsedJd.target_job || "未识别"}
              </p>
              <p>
                <span className="text-slate-400">经验要求：</span>
                {parsedJd.years_requirement || "未明确"}
              </p>
              <p>
                <span className="text-slate-400">学历要求：</span>
                {parsedJd.education_requirement || "未明确"}
              </p>
              <div>
                <p className="text-slate-400 mb-1">技能关键词：</p>
                <div className="flex flex-wrap gap-1.5">
                  {parsedJd.skills.length === 0 ? (
                    <span className="text-xs text-slate-400">暂无</span>
                  ) : (
                    parsedJd.skills.map((kw) => (
                      <span
                        key={kw}
                        className="px-2.5 py-1 text-xs bg-slate-100 text-slate-700 rounded-full border border-slate-200"
                      >
                        {kw}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="text-center mb-8">
          <button
            onClick={() => void analyze()}
            disabled={analyzing || importing}
            className="px-8 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
          >
            {analyzing ? "分析中…" : "开始分析 →"}
          </button>
        </div>

        {analysis && (
          <>
            {/* Score Overview */}
            <div className="bg-white border border-slate-200 rounded-xl p-6 mb-6 flex items-center gap-8">
              <div className="w-28 h-28 rounded-full border-[5px] border-emerald-200 flex flex-col items-center justify-center shrink-0 relative">
                <span className="text-3xl font-bold text-emerald-600">
                  {score ?? 0}
                </span>
                <span className="text-[10px] text-slate-400">总匹配度</span>
              </div>
              <div className="flex-1 space-y-2">
                <h3 className="font-semibold mb-3">简历诊断结果</h3>
                {dimensionRows.map((row) => (
                  <ScoreBar
                    key={row.label}
                    label={row.label}
                    value={row.v.score}
                    color={row.color}
                  />
                ))}
              </div>
            </div>

            {/* Suggestions */}
            <h3 className="font-semibold mb-3">📋 优化建议</h3>
            <div className="space-y-3 mb-6">
              {suggestions.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-5 text-sm text-slate-500">
                  暂无可展示的建议（可能是解析失败或简历内容较少）。你可以补充 JD 后重试。
                </div>
              ) : (
                suggestions.map((s, i) => (
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
                    <div className="mt-3">
                      <button
                        onClick={() => void applyOne(i)}
                        disabled={applying || appliedIndexes.includes(i)}
                        className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        {appliedIndexes.includes(i) ? "已应用" : "应用此条"}
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Keywords */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
              <h3 className="font-semibold mb-3">🔑 关键词匹配分析</h3>
              <p className="text-xs text-slate-400 mb-2">✅ 已覆盖</p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {keywordsCovered.length === 0 ? (
                  <span className="text-xs text-slate-400">暂无</span>
                ) : (
                  keywordsCovered.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 text-xs bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200"
                    >
                      {kw}
                    </span>
                  ))
                )}
              </div>
              <p className="text-xs text-slate-400 mb-2">
                ❌ 未覆盖 — 建议补充
              </p>
              <div className="flex flex-wrap gap-1.5">
                {keywordsMissing.length === 0 ? (
                  <span className="text-xs text-slate-400">暂无</span>
                ) : (
                  keywordsMissing.map((kw) => (
                    <span
                      key={kw}
                      className="px-2.5 py-1 text-xs bg-red-50 text-red-600 rounded-full border border-red-200"
                    >
                      {kw}
                    </span>
                  ))
                )}
              </div>
            </div>

            {/* ATS */}
            {ats && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">🧾 ATS 兼容性检测</h3>
                  <span
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                      ats.score >= 85
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : ats.score >= 70
                          ? "bg-amber-50 text-amber-700 border border-amber-200"
                          : "bg-red-50 text-red-700 border border-red-200"
                    }`}
                  >
                    {ats.score}/100
                  </span>
                </div>

                {ats.issues.length > 0 && (
                  <>
                    <p className="text-xs text-slate-400 mb-2">发现问题</p>
                    <ul className="text-sm text-slate-600 list-disc pl-5 mb-4 space-y-1">
                      {ats.issues.map((it, i) => (
                        <li key={i}>{it}</li>
                      ))}
                    </ul>
                  </>
                )}

                <p className="text-xs text-slate-400 mb-2">建议</p>
                <ul className="text-sm text-slate-600 list-disc pl-5 space-y-1">
                  {ats.suggestions.map((it, i) => (
                    <li key={i}>{it}</li>
                  ))}
                </ul>
              </div>
            )}

            {applyReport && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 mb-6">
                <h3 className="font-semibold mb-2">✅ 应用结果</h3>
                <p className="text-sm text-slate-600">
                  {applyReport.mode === "rollback"
                    ? "已撤销最近一次优化应用。"
                    : `本次${
                        applyReport.mode === "all"
                          ? "批量应用"
                          : applyReport.mode === "high"
                            ? "高优先级应用"
                            : "单条应用"
                      }已完成，应用建议 ${applyReport.appliedCount} 条。`}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  ATS 分数变化：
                  {applyReport.atsBefore ?? "-"} → {applyReport.atsAfter ?? "-"}
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => void applyAll()}
                disabled={applying || suggestions.length === 0}
                className="px-5 py-2.5 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {applying ? "应用中…" : "一键应用全部优化 ✨"}
              </button>
              <button
                onClick={() => void applyHighPriority()}
                disabled={applying || suggestions.length === 0}
                className="px-5 py-2.5 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg border border-emerald-200 hover:bg-emerald-100 disabled:opacity-50"
              >
                仅应用高优建议
              </button>
              <button
                onClick={() => void rollbackLastOptimization()}
                disabled={applying}
                className="px-5 py-2.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-lg border border-amber-200 hover:bg-amber-100 disabled:opacity-50"
              >
                撤销最近一次应用
              </button>
              <button
                onClick={() => {
                  setAnalysis(null);
                  setAts(null);
                  setParsedJd(null);
                  setAppliedIndexes([]);
                  setApplyReport(null);
                }}
                className="px-5 py-2.5 text-sm font-medium text-slate-600 bg-white rounded-lg border border-slate-200 hover:bg-slate-50"
              >
                重新分析
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
  color?: "emerald" | "amber";
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
