"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "@/components/app-shell";
import {
  chatStream,
  getAccessToken,
  resumeApi,
  type ResumeDetail,
} from "@/lib/api";

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
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [preview, setPreview] = useState<ResumeDetail | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<"classic" | "modern">("classic");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!getAccessToken()) {
        setInitError("请先登录后再使用简历生成（数据会保存到你的账户）。");
        return;
      }
      try {
        const r = await resumeApi.create({ title: "新建简历" });
        if (!cancelled) {
          setResumeId(r.id);
          setPreview(r);
        }
      } catch (e) {
        if (!cancelled) {
          setInitError(
            e instanceof Error ? e.message : "创建简历失败，请检查后端与登录状态",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncPreview = useCallback(async (rid: string, cid: string) => {
    try {
      const r = await resumeApi.syncConversation(rid, cid);
      setPreview(r);
    } catch {
      /* 抽取失败时保留上一次预览 */
    }
  }, []);

  async function send() {
    const text = input.trim();
    if (!text || loading || !resumeId) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setLoading(true);

    let metaCid: string | null = null;

    try {
      let aiContent = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      for await (const ev of chatStream({
        message: text,
        conversationType: "resume_build",
        conversationId: conversationId ?? undefined,
        resumeId,
      })) {
        if (ev.e === "token") {
          aiContent += ev.t;
          setMessages((prev) => {
            const copy = [...prev];
            copy[copy.length - 1] = { role: "assistant", content: aiContent };
            return copy;
          });
        } else if (ev.e === "meta") {
          metaCid = ev.conversation_id;
          setConversationId(ev.conversation_id);
        }
      }

      if (metaCid) {
        await syncPreview(resumeId, metaCid);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        {
          role: "assistant",
          content:
            "抱歉，连接出现了问题。请确认已登录，且后端 `uvicorn` 已启动、已配置 LLM API Key。",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function downloadPdf() {
    if (!resumeId) return;
    try {
      const blob = await resumeApi.exportPdf(resumeId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `resume-${resumeId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert(e instanceof Error ? e.message : "导出失败（WeasyPrint 在 Windows 上需安装 GTK 等依赖）");
    }
  }

  const progress = computeProgress(preview);

  return (
    <AppShell>
      <div className="flex h-screen">
        <div className="flex-1 flex flex-col border-r border-slate-200 min-w-0">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-100">
            <h2 className="text-sm font-semibold">📝 新建简历</h2>
            <div className="flex items-center gap-1">
              <span className="text-xs text-slate-400 mr-2">进度</span>
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div
                  key={i}
                  className={`w-7 h-1 rounded-full ${
                    i <= progress ? "bg-emerald-600" : "bg-slate-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {initError && (
            <div className="mx-6 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {initError}{" "}
              <Link href="/login" className="font-medium text-emerald-700 underline">
                去登录
              </Link>
            </div>
          )}

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex gap-3 max-w-[85%] ${
                  msg.role === "user" ? "ml-auto flex-row-reverse" : ""
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

          <div className="px-6 py-3 bg-white border-t border-slate-100">
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-4 py-1">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
                placeholder={
                  resumeId ? "输入你的回答..." : "正在初始化简历..."
                }
                disabled={!resumeId || !!initError}
                className="flex-1 bg-transparent text-sm py-2 outline-none disabled:opacity-50"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !resumeId || !!initError}
                className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                ↑
              </button>
            </div>
          </div>
        </div>

        <div className="w-[22rem] bg-slate-100 flex flex-col shrink-0 max-md:hidden">
          <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-slate-100 gap-2">
            <h3 className="text-xs font-semibold text-slate-600 shrink-0">
              实时预览
            </h3>
            <select
              value={templateId}
              onChange={(e) =>
                setTemplateId(e.target.value as "classic" | "modern")
              }
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="classic">经典商务</option>
              <option value="modern">简约现代（同 classic 渲染）</option>
            </select>
            <button
              type="button"
              onClick={downloadPdf}
              disabled={!resumeId}
              className="text-xs text-white bg-emerald-600 px-3 py-1.5 rounded-lg hover:bg-emerald-700 disabled:opacity-50 shrink-0"
            >
              导出 PDF
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5 flex justify-center">
            <ResumePaper preview={preview} templateId={templateId} />
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function computeProgress(p: ResumeDetail | null): number {
  if (!p) return 0;
  let n = 0;
  const bi = p.basic_info || {};
  if (bi.name) n += 1;
  if (p.target_job) n += 1;
  const edu = p.sections.find((s) => s.type === "education");
  const exp = p.sections.find((s) => s.type === "experience");
  const proj = p.sections.find((s) => s.type === "project");
  const sk = p.sections.find((s) => s.type === "skill");
  const items = (c: Record<string, unknown> | undefined, key: string) => {
    const v = c?.[key];
    return Array.isArray(v) && v.length > 0;
  };
  if (edu && items(edu.content as Record<string, unknown>, "items")) n += 1;
  if (exp && items(exp.content as Record<string, unknown>, "items")) n += 1;
  if (proj && items(proj.content as Record<string, unknown>, "items")) n += 1;
  if (sk && items(sk.content as Record<string, unknown>, "categories")) n += 1;
  return Math.min(6, n);
}

function ResumePaper({
  preview,
  templateId,
}: {
  preview: ResumeDetail | null;
  templateId: string;
}) {
  if (!preview) {
    return (
      <div className="w-full max-w-[340px] bg-white rounded shadow-lg p-7 text-xs text-slate-400 text-center">
        正在加载简历…
      </div>
    );
  }

  const bi = preview.basic_info || {};
  const name = String(bi.name || "姓名");
  const job = preview.target_job || "求职意向";
  const contact = [bi.phone, bi.email, bi.city].filter(Boolean).join(" · ");

  return (
    <div
      className={`w-full max-w-[340px] bg-white rounded shadow-lg p-7 text-xs leading-relaxed ${
        templateId === "modern" ? "font-sans" : "font-serif"
      }`}
    >
      <div className="text-xl font-bold mb-0.5">{name}</div>
      <div className="text-emerald-600 text-sm mb-1">{job}</div>
      {contact ? (
        <div className="text-slate-400 text-[11px] mb-3">{contact}</div>
      ) : (
        <div className="text-slate-300 text-[11px] mb-3">联系方式待补充</div>
      )}
      {preview.summary ? (
        <p className="text-slate-600 text-[11px] mb-3 leading-relaxed">
          {preview.summary}
        </p>
      ) : null}

      {preview.sections
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((sec) => (
          <PreviewSection key={sec.id} sec={sec} />
        ))}

      {preview.sections.length === 0 && (
        <>
          <SectionTitle>教育背景</SectionTitle>
          <Placeholder>对话采集后将显示在此</Placeholder>
          <SectionTitle>工作经历</SectionTitle>
          <Placeholder>对话采集后将显示在此</Placeholder>
        </>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 border-b border-emerald-600 pb-0.5 mb-2 mt-2">
      {children}
    </div>
  );
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="border border-dashed border-slate-200 rounded-lg p-4 text-center text-slate-400 text-[11px] mb-2">
      {children}
    </div>
  );
}

function PreviewSection({ sec }: { sec: ResumeDetail["sections"][number] }) {
  const c = sec.content as Record<string, unknown>;

  return (
    <div className="mb-2">
      <SectionTitle>{sec.title}</SectionTitle>

      {sec.type === "education" && (
        <EducationPreview content={c} />
      )}
      {sec.type === "experience" && (
        <ExperiencePreview content={c} />
      )}
      {sec.type === "project" && <ProjectPreview content={c} />}
      {sec.type === "skill" && <SkillPreview content={c} />}
      {![
        "education",
        "experience",
        "project",
        "skill",
      ].includes(sec.type) && (
        <pre className="text-[10px] text-slate-500 whitespace-pre-wrap font-sans">
          {JSON.stringify(c, null, 2)}
        </pre>
      )}
    </div>
  );
}

function EducationPreview({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<Record<string, unknown>>) || [];
  if (!items.length) return <Placeholder>待采集</Placeholder>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="font-semibold">
            {String(it.school || "")} · {String(it.major || "")}
          </div>
          <div className="text-slate-400 text-[11px]">
            {String(it.degree || "")} · {String(it.start_date || "")} -{" "}
            {String(it.end_date || "")}
            {it.gpa ? ` · GPA ${String(it.gpa)}` : ""}
          </div>
        </div>
      ))}
    </div>
  );
}

function ExperiencePreview({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<Record<string, unknown>>) || [];
  if (!items.length) return <Placeholder>待采集</Placeholder>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="font-semibold">
            {String(it.company || "")} — {String(it.title || "")}
          </div>
          <div className="text-slate-400 text-[11px]">
            {String(it.location || "")} · {String(it.start_date || "")} -{" "}
            {String(it.end_date || "")}
          </div>
          <ul className="list-disc pl-4 mt-1 text-[11px] text-slate-600">
            {((it.bullets as string[]) || []).map((b, j) => (
              <li key={j}>{b}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ProjectPreview({ content }: { content: Record<string, unknown> }) {
  const items = (content.items as Array<Record<string, unknown>>) || [];
  if (!items.length) return <Placeholder>待采集</Placeholder>;
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i}>
          <div className="font-semibold">
            {String(it.name || "")} · {String(it.role || "")}
          </div>
          <div className="text-slate-400 text-[11px]">
            {String(it.start_date || "")} - {String(it.end_date || "")}
          </div>
          {it.description ? (
            <p className="text-[11px] text-slate-600 mt-1">
              {String(it.description)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function SkillPreview({ content }: { content: Record<string, unknown> }) {
  const cats = (content.categories as Array<Record<string, unknown>>) || [];
  if (!cats.length) return <Placeholder>待采集</Placeholder>;
  return (
    <div className="space-y-1">
      {cats.map((cat, i) => (
        <div key={i}>
          <div className="font-semibold text-[11px]">{String(cat.name)}</div>
          <div className="text-[11px] text-slate-600">
            {((cat.skills as Array<Record<string, unknown>>) || [])
              .map((s) => String(s.name || ""))
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      ))}
    </div>
  );
}
