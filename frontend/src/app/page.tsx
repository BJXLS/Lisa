import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-200">
        <span className="text-xl font-bold text-emerald-700 tracking-tight">
          Lisa
        </span>
        <div className="flex gap-3">
          <Link
            href="/login"
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            登录
          </Link>
          <Link
            href="/login?tab=register"
            className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            免费注册
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 mb-6 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-200">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
          AI 驱动的求职助手
        </div>
        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-5">
          遇见{" "}
          <span className="text-emerald-600">Lisa</span>
          <br />
          你的智能求职伙伴
        </h1>
        <p className="text-lg text-slate-500 max-w-lg mb-8 leading-relaxed">
          通过自然对话生成专业简历，AI 深度优化匹配岗位需求，模拟真实面试场景助你斩获心仪 Offer。
        </p>
        <div className="flex gap-3">
          <Link
            href="/resume-builder"
            className="px-6 py-3 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            开始制作简历 →
          </Link>
          <Link
            href="/dashboard"
            className="px-6 py-3 text-sm font-medium text-slate-700 bg-white rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            进入工作台
          </Link>
        </div>
      </main>

      {/* Features */}
      <section className="py-20 px-6">
        <h2 className="text-3xl font-bold text-center mb-3">MVP 核心功能</h2>
        <p className="text-center text-slate-500 mb-12">
          三大核心场景，覆盖求职关键环节
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          <FeatureCard
            icon="📝"
            title="对话式简历生成"
            desc="像聊天一样告诉 Lisa 你的经历，AI 自动整理为专业简历"
            href="/resume-builder"
          />
          <FeatureCard
            icon="🔍"
            title="智能简历优化"
            desc="上传简历和 JD，从 7 个维度分析并给出优化建议"
            href="/resume-optimizer"
          />
          <FeatureCard
            icon="🎤"
            title="AI 模拟面试"
            desc="AI 面试官仿真面试，结束后生成详细评分与改进方案"
            href="/mock-interview"
          />
        </div>
      </section>
    </div>
  );
}

function FeatureCard({
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
      className="flex flex-col gap-4 p-7 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:-translate-y-1 hover:shadow-lg transition-all"
    >
      <span className="text-3xl">{icon}</span>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
    </Link>
  );
}
