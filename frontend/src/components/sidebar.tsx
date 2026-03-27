"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", icon: "📊", label: "工作台" },
  { href: "/resume-builder", icon: "📝", label: "简历生成" },
  { href: "/resume-optimizer", icon: "🔍", label: "简历优化" },
  { href: "/mock-interview", icon: "🎤", label: "模拟面试" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0">
      <div className="px-5 py-5 border-b border-slate-100">
        <Link href="/" className="text-xl font-bold text-emerald-700 tracking-tight">
          Lisa
        </Link>
        <p className="text-xs text-slate-400 mt-0.5">智能求职助手</p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <p className="px-2 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          主菜单
        </p>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.href ||
            (item.href === "/mock-interview" &&
              pathname?.startsWith("/mock-interview"));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm mb-0.5 transition-colors ${
                active
                  ? "bg-emerald-50 text-emerald-700 font-medium"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-slate-100">
        <p className="px-2 mb-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          我的
        </p>
        <Link
          href="#"
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
        >
          <span className="text-base">📁</span> 简历库
        </Link>
        <Link
          href="/interviews"
          className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 ${
            pathname === "/interviews"
              ? "bg-emerald-50 text-emerald-700 font-medium"
              : "text-slate-600"
          }`}
        >
          <span className="text-base">📋</span> 面试记录
        </Link>
      </div>
    </aside>
  );
}
