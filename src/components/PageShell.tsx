import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, History, User, GraduationCap } from 'lucide-react';
import { VoicePicker } from '@/components/VoicePicker';
import { useUserStore } from '@/store/useUserStore';
import { useTierStore } from '@/store/useTierStore';
import { getTierName } from '@/lib/tiers';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: React.ReactNode;
  showHome?: boolean;
  showHistory?: boolean;
  showProfile?: boolean;
  showLearnCenter?: boolean;
  step?: number; // 当前步骤 1-4（结果/学习/演练/完成）
  className?: string;
}

// 顶部步骤指示（从场景生成结果页起的四步闭环）
const STEPS = ['生成内容', '最小学习', '角色演练', '今日完成'];

// tier 对应的导航徽章样式（仅 plus/pro 显示名称，free 不显示）
function tierBadgeStyle(tier: 'free' | 'plus' | 'pro'): string {
  if (tier === 'pro') return 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100';
  if (tier === 'plus') return 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100';
  return 'border-border bg-card text-foreground hover:bg-secondary';
}

// 移动端底部 Tab 配置
const MOBILE_TABS = [
  { to: '/', label: '首页', icon: Home, match: (p: string) => p === '/' },
  { to: '/learn-center', label: '学习', icon: GraduationCap, match: (p: string) => p === '/learn-center' },
  { to: '/history', label: '历史', icon: History, match: (p: string) => p === '/history' },
  { to: '/profile', label: '我的', icon: User, match: (p: string) => p === '/profile' },
];

export function PageShell({ children, showHome = true, showHistory = true, showProfile = true, showLearnCenter = true, step, className }: PageShellProps) {
  const currentUser = useUserStore((s) => s.currentUser);
  const tierInfo = useTierStore();
  const location = useLocation();

  // 登录后刷新 tier 信息（用于首页生成按钮旁显示剩余次数）
  useEffect(() => {
    if (currentUser) {
      tierInfo.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  const tier = currentUser?.tier || 'free';
  const badgeStyle = tierBadgeStyle(tier);

  return (
    <div className="safe-x flex min-h-screen flex-col bg-warm-gradient">
      <header className="safe-top sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="container flex h-14 items-center justify-between gap-2 sm:h-16 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 font-display text-base font-bold text-foreground sm:text-lg">
            <span className="grid h-8 w-8 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-soft sm:h-9 sm:w-9">
              🏡
            </span>
            <span className="hidden sm:inline">家庭场景英语</span>
          </Link>

          {/* 桌面端：完整导航 */}
          <div className="hidden items-center gap-3 sm:flex">
            <VoicePicker />
            {showLearnCenter && (
              <Link
                to="/learn-center"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                title="学习中心"
              >
                <GraduationCap className="h-5 w-5" />
              </Link>
            )}
            {showHistory && (
              <Link
                to="/history"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                title="学习历史"
              >
                <History className="h-5 w-5" />
              </Link>
            )}
            {showProfile && (
              currentUser ? (
                <Link
                  to="/profile"
                  className={cn(
                    'flex h-11 items-center gap-1.5 rounded-full border px-2 transition-colors',
                    badgeStyle,
                  )}
                  title={`${currentUser.nickname}${tier !== 'free' ? ` · ${getTierName(tier)}` : ''} · 进入用户中心`}
                >
                  <span className="text-base leading-none">{currentUser.avatar}</span>
                  {/* 仅 plus/pro 显示特权名称，free 不显示；不显示特权图标 */}
                  {tier !== 'free' && (
                    <span className="pr-1 text-xs font-semibold">{getTierName(tier)}</span>
                  )}
                </Link>
              ) : (
                <Link
                  to="/profile"
                  className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                  title="用户中心"
                >
                  <User className="h-5 w-5" />
                </Link>
              )
            )}
            {showHome && (
              <Link
                to="/"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                title="返回首页"
              >
                <Home className="h-5 w-5" />
              </Link>
            )}
          </div>

          {/* 移动端：仅保留用户头像/登录入口（其余导航移到底部 Tab Bar） */}
          <div className="flex items-center gap-2 sm:hidden">
            {showProfile && (
              currentUser ? (
                <Link
                  to="/profile"
                  className={cn(
                    'flex h-10 items-center gap-1.5 rounded-full border px-2 transition-colors',
                    badgeStyle,
                  )}
                  title={`${currentUser.nickname} · 进入用户中心`}
                >
                  <span className="text-base leading-none">{currentUser.avatar}</span>
                  {tier !== 'free' && (
                    <span className="pr-1 text-xs font-semibold">{getTierName(tier)}</span>
                  )}
                </Link>
              ) : (
                <Link
                  to="/profile"
                  className="grid h-10 w-10 place-items-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                  title="用户中心"
                >
                  <User className="h-5 w-5" />
                </Link>
              )
            )}
          </div>
        </div>

        {step !== undefined && (
          <div className="container pb-3">
            <div className="flex items-center gap-1.5">
              {STEPS.map((label, i) => {
                const idx = i + 1;
                const active = idx === step;
                const done = idx < step;
                return (
                  <div key={label} className="flex flex-1 items-center gap-1.5">
                    <div
                      className={cn(
                        'flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-colors',
                        active && 'bg-primary text-primary-foreground shadow-soft',
                        done && 'bg-sage-soft text-primary',
                        !active && !done && 'bg-muted text-muted-foreground',
                      )}
                    >
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-white/30 text-[10px]">
                        {done ? '✓' : idx}
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                    </div>
                    {idx < STEPS.length && (
                      <div className={cn('h-px flex-1', done ? 'bg-primary/40' : 'bg-border')} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className={cn('container flex-1 py-6 sm:py-12', className)}>{children}</main>

      <footer className="container hidden py-8 text-center text-xs text-muted-foreground sm:block">
        把家庭生活里的真实场景，变成孩子马上能学、能说、能用的英语。
      </footer>

      {/* 移动端底部 Tab Bar（固定底部，适配 safe-area） */}
      <nav className="safe-bottom sticky bottom-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-md sm:hidden">
        <div className="container grid grid-cols-4">
          {MOBILE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.match(location.pathname);
            // 当 PageShell 关闭了某个入口时，对应 Tab 仍可点击跳转，但不显示激活态
            const visible =
              (tab.to === '/' && showHome) ||
              (tab.to === '/learn-center' && showLearnCenter) ||
              (tab.to === '/history' && showHistory) ||
              (tab.to === '/profile' && showProfile) ||
              tab.to === '/';
            if (!visible) {
              // 入口被关闭时占位，保持 4 列布局对齐
              return <div key={tab.to} className="h-14" aria-hidden />;
            }
            return (
              <Link
                key={tab.to}
                to={tab.to}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors',
                  isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className={cn('h-5 w-5', isActive && 'scale-110')} />
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
