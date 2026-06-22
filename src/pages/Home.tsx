import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, ArrowRight, Route as RouteIcon, Wand2, Loader2, AlertCircle, History, Trash2, CheckCircle2, BookOpen, Play, LogIn, X, RefreshCw, Crown } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EXAMPLE_SCENES, pickRandomScenes } from '@/lib/examples';
import { generateSceneContent } from '@/lib/llm';
import { useSessionStore } from '@/store/useSessionStore';
import { useRouteStore } from '@/store/useRouteStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useUserStore } from '@/store/useUserStore';
import { useTierStore } from '@/store/useTierStore';
import { getTierName, getTierBadge } from '@/lib/tiers';
import { isAuthError } from '@/lib/api';
import type { ExampleScene, Difficulty } from '@/lib/types';
import { cn } from '@/lib/utils';
import { AVATAR_LIST } from '@/lib/avatars';

// 难度选项配置
const DIFFICULTY_OPTIONS: Array<{
  value: Difficulty;
  label: string;
  desc: string;
}> = [
  { value: 'easy', label: '简单', desc: '3-5岁 · 短句基础词' },
  { value: 'medium', label: '难度', desc: '5-7岁 · 中等词汇' },
  { value: 'hard', label: '复杂', desc: '7-10岁 · 长句丰富词' },
];

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const d = new Date(ts);
  return `${d.getMonth() + 1}-${d.getDate().toString().padStart(2, '0')}`;
}

export default function Home() {
  const navigate = useNavigate();
  const createSession = useSessionStore((s) => s.createSession);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const setGenerating = useSessionStore((s) => s.setGenerating);
  const generating = useSessionStore((s) => s.generating);
  const route = useRouteStore((s) => s.route);
  const allHistoryEntries = useHistoryStore((s) => s.entries);
  const removeHistoryEntry = useHistoryStore((s) => s.removeEntry);
  const clearGuest = useHistoryStore((s) => s.clearGuest);
  const currentUser = useUserStore((s) => s.currentUser);
  const guestUsageCount = useUserStore((s) => s.guestUsageCount);
  const guestMaxUsage = useUserStore((s) => s.guestMaxUsage);
  const canGuestUse = useUserStore((s) => s.canGuestUse());
  const incrementGuestUsage = useUserStore((s) => s.incrementGuestUsage);
  const register = useUserStore((s) => s.register);
  const login = useUserStore((s) => s.login);
  // 会员等级 + 生成额度
  const tierInfo = useTierStore();
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  // 登录后刷新 tier 信息
  useEffect(() => {
    if (currentUser) {
      tierInfo.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);
  // 按当前用户过滤历史记录（游客模式只看 userId=null 的，登录后只看自己的）
  const historyEntries = allHistoryEntries.filter((e) =>
    currentUser ? e.userId === currentUser.id : e.userId === null,
  );
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  // 登录/注册表单
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authAccount, setAuthAccount] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authUsername, setAuthUsername] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authNickname, setAuthNickname] = useState('');
  const [authAvatar, setAuthAvatar] = useState('🦊');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  // 推荐场景：随机展示 6 个，刷新时重新随机
  const [sceneSeed, setSceneSeed] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const randomScenes = useMemo(() => pickRandomScenes(6), [sceneSeed]);
  const handleRefreshScenes = () => setSceneSeed((s) => s + 1);

  // 处理登录
  const handleAuth = async () => {
    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        if (!authAccount || !authPassword) {
          setAuthError('请输入账户和密码');
          setAuthLoading(false);
          return;
        }
        await login(authAccount, authPassword);
      } else {
        // 注册校验
        if (!authUsername || !authEmail || !authPassword) {
          setAuthError('请填写账户、邮箱和密码');
          setAuthLoading(false);
          return;
        }
        // 账户名：仅英文/数字，4-20 位
        if (!/^[a-zA-Z0-9]{4,20}$/.test(authUsername)) {
          setAuthError('账户名只能用英文或数字，4-20 位');
          setAuthLoading(false);
          return;
        }
        // 邮箱格式
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(authEmail)) {
          setAuthError('邮箱格式不正确');
          setAuthLoading(false);
          return;
        }
        // 昵称：2-12 个字符（中英文数字均可）
        const nickname = authNickname || authUsername;
        if (nickname.length < 2 || nickname.length > 12) {
          setAuthError('昵称需 2-12 个字符');
          setAuthLoading(false);
          return;
        }
        // 密码：6-32 位
        if (authPassword.length < 6 || authPassword.length > 32) {
          setAuthError('密码需 6-32 位');
          setAuthLoading(false);
          return;
        }
        await register(authUsername, authEmail, authPassword, nickname, authAvatar);
      }
      // 登录/注册成功，清空游客数据
      clearGuest();
      setShowUserMenu(false);
      setAuthAccount(''); setAuthEmail(''); setAuthUsername(''); setAuthPassword(''); setAuthNickname(''); setAuthAvatar('🦊');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setAuthLoading(false);
    }
  };

  const startGenerate = async (sceneInput: string, source: 'input' | 'example' | 'route') => {
    const text = sceneInput.trim();
    if (!text) return;
    // 游客模式：使用次数检查
    if (!currentUser) {
      if (!canGuestUse) {
        setShowLoginPrompt(true);
        return;
      }
    } else {
      // 登录用户：tier 额度检查
      if (!tierInfo.canGenerate) {
        setShowUpgradePrompt(true);
        return;
      }
    }
    setError(null);
    setGenerating(true);
    try {
      const content = await generateSceneContent(text, difficulty);
      // 登录用户：增加 tier 计数（后端会再次校验，超限则抛错）
      if (currentUser) {
        try {
          const ok = await tierInfo.incrGenCount();
          // incrGenCount 返回 false 表示登录已过期（onUnauthorized 已清除 currentUser）
          // 静默处理，不显示错误，UI 会自动切换到游客模式
          if (!ok) {
            setGenerating(false);
            return;
          }
        } catch (err) {
          // 登录已过期：静默处理（onUnauthorized 已清除 currentUser）
          if (isAuthError(err)) {
            setGenerating(false);
            return;
          }
          // 后端判定超限
          setGenerating(false);
          setShowUpgradePrompt(true);
          throw err;
        }
      }
      createSession({ sceneInput: text, source, content, difficulty });
      // 游客模式增加使用次数
      if (!currentUser) {
        incrementGuestUsage();
      }
      navigate('/scene-result');
    } catch (err) {
      // 登录已过期：静默处理（onUnauthorized 已清除 currentUser，UI 切换到游客模式）
      if (isAuthError(err)) {
        setGenerating(false);
        return;
      }
      setError(err instanceof Error ? err.message : '生成失败，请重试');
    } finally {
      setGenerating(false);
    }
  };

  const handleExample = (ex: ExampleScene) => {
    startGenerate(ex.prompt, 'example');
  };

  const handleRestoreHistory = (entryId: string) => {
    const entry = historyEntries.find((e) => e.id === entryId);
    if (!entry) return;
    restoreSession(entry.session);
    // 根据学习进度跳转到合适页面
    if (entry.practiceDone) {
      navigate('/done');
    } else if (entry.learnedDone) {
      navigate('/practice');
    } else {
      navigate('/scene-result');
    }
  };

  return (
    <PageShell showHome={false}>
      {/* 游客状态条（登录用户在导航栏显示，无需重复） */}
      {!currentUser && (
        <div className="mx-auto flex max-w-4xl items-center justify-end gap-2 pt-2">
          <Badge variant="muted" className="gap-1">
            游客模式 · {guestUsageCount}/{guestMaxUsage} 次
          </Badge>
          <button
            onClick={() => setShowUserMenu(true)}
            className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <LogIn className="h-3.5 w-3.5" />
            登录
          </button>
        </div>
      )}

      {/* Hero */}
      <section className="mx-auto max-w-3xl text-center animate-fade-up">
        <Badge variant="sage" className="mb-4 gap-1.5 px-3 py-1 text-xs sm:mb-5 sm:px-4 sm:py-1.5 sm:text-sm">
          <Sparkles className="h-3.5 w-3.5" />
          家庭亲子共学 · 今日从一个生活场景开始
        </Badge>
        <h1 className="font-display text-2xl font-bold leading-tight text-balance sm:text-4xl sm:text-5xl">
          把今天生活里发生的一件事，
          <br className="hidden sm:block" />
          变成孩子<span className="text-primary">马上能说</span>的英语
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground text-balance sm:mt-5 sm:text-lg">
          孩子正在吃黄瓜、正在刷牙、正要出门上学——
          选一个刚发生的真实场景，我们一起把它变成几句能听、能说、能练的英语。
        </p>
      </section>

      {/* 临时场景输入 */}
      <section className="mx-auto mt-6 max-w-4xl animate-fade-up sm:mt-10" style={{ animationDelay: '0.08s' }}>
        <Card className="overflow-hidden border-primary/20 shadow-soft-lg">
          <CardContent className="p-4 sm:p-7">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-9 w-9 place-items-center rounded-2xl bg-peach-soft text-xl">✍️</span>
              <div>
                <h2 className="font-display text-base font-bold sm:text-lg">刚刚发生了什么？</h2>
                <p className="text-xs text-muted-foreground sm:text-sm">把孩子正在做的事写下来，AI 会生成几句亲子英语</p>
              </div>
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="例如：孩子正在吃黄瓜 / 孩子不想穿外套 / 孩子在玩积木……"
              className="min-h-[96px] text-base"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  startGenerate(input, 'input');
                }
              }}
            />
            {/* 难易度选择（紧凑分段控件） */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">难度</span>
              <div className="inline-flex rounded-full border border-border bg-muted/40 p-0.5">
                {DIFFICULTY_OPTIONS.map((opt) => {
                  const active = difficulty === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDifficulty(opt.value)}
                      disabled={generating}
                      title={opt.desc}
                      className={cn(
                        'rounded-full px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50 sm:px-4 sm:py-2',
                        active
                          ? 'bg-primary text-primary-foreground shadow-soft'
                          : 'text-muted-foreground hover:text-foreground',
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {DIFFICULTY_OPTIONS.find((o) => o.value === difficulty)?.desc}
              </span>
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="hidden text-xs text-muted-foreground sm:inline">⌘/Ctrl + Enter 快速生成</span>
              {/* 移动端：次数提示独占一行（避免在按钮旁换行） */}
              {currentUser && (
                <button
                  onClick={() => navigate('/upgrade')}
                  className="flex items-center gap-1.5 self-start px-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:hidden"
                  title="查看升级方案"
                >
                  <span
                    className={cn(
                      'h-2 w-2 shrink-0 rounded-full',
                      tierInfo.tier === 'pro'
                        ? 'bg-purple-500'
                        : tierInfo.tier === 'plus'
                          ? 'bg-blue-500'
                          : 'bg-amber-500',
                    )}
                  />
                  <span>{tierInfo.getRemainingText()}</span>
                </button>
              )}
              <div className="flex items-center gap-2">
                {/* 平板/桌面端：次数提示在按钮旁 */}
                {currentUser && (
                  <button
                    onClick={() => navigate('/upgrade')}
                    className="hidden h-11 items-center gap-1.5 px-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:flex"
                    title="查看升级方案"
                  >
                    <span
                      className={cn(
                        'h-2 w-2 shrink-0 rounded-full',
                        tierInfo.tier === 'pro'
                          ? 'bg-purple-500'
                          : tierInfo.tier === 'plus'
                            ? 'bg-blue-500'
                            : 'bg-amber-500',
                      )}
                    />
                    <span>{tierInfo.getRemainingText()}</span>
                  </button>
                )}
                <Button
                  size="lg"
                  onClick={() => startGenerate(input, 'input')}
                  disabled={!input.trim() || generating}
                  className="flex-1 sm:flex-none sm:min-w-[180px]"
                >
                  {generating ? (
                    <>
                      <Loader2 className="animate-spin" />
                      正在生成…
                    </>
                  ) : (
                    <>
                      <Wand2 />
                      生成英语内容
                    </>
                  )}
                </Button>
              </div>
            </div>
            {error && (
              <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* 每日路线入口 */}
      <section className="mx-auto mt-6 max-w-4xl animate-fade-up" style={{ animationDelay: '0.12s' }}>
        <button
          onClick={() => navigate('/daily-route')}
          className="group flex w-full flex-col gap-2 rounded-3xl border-2 border-dashed border-border bg-card/50 p-4 text-left transition-all hover:border-primary/40 hover:bg-card sm:flex-row sm:items-center sm:gap-4 sm:p-5"
        >
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage-soft text-2xl">
            🗓️
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <RouteIcon className="h-4 w-4 shrink-0 text-primary" />
              <h3 className="font-display font-bold whitespace-nowrap">每日路线</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              把英语嵌入孩子的一天：起床 · 刷牙 · 早餐 · 出门 · 上学
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Badge variant="muted" className="whitespace-nowrap">{route.nodes.length} 个生活节点</Badge>
            <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </div>
        </button>
      </section>

      {/* 学习历史 */}
      {historyEntries.length > 0 && (
        <section className="mx-auto mt-6 sm:mt-10 max-w-4xl animate-fade-up" style={{ animationDelay: '0.14s' }}>
          <div className="mb-4 flex items-end justify-between">
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" />
              <div>
                <h2 className="font-display text-xl font-bold">继续学习</h2>
                <p className="text-sm text-muted-foreground">点开即可回到上次的场景</p>
              </div>
            </div>
            {historyEntries.length > 6 && (
              <button
                onClick={() => navigate('/history')}
                className="group flex items-center gap-1 text-sm font-semibold text-primary transition-colors hover:text-primary/80"
              >
                查看全部 {historyEntries.length} 条
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-3">
            {historyEntries.slice(0, 6).map((entry) => {
              const progressLabel = entry.practiceDone
                ? '已完成'
                : entry.learnedDone
                  ? '待演练'
                  : '未完成';
              const timeStr = formatRelativeTime(entry.createdAt);
              const diffLabel = entry.difficulty === 'easy' ? '简单' : entry.difficulty === 'medium' ? '难度' : '复杂';
              return (
                <div
                  key={entry.id}
                  className="group relative flex flex-col gap-1.5 rounded-xl border border-border bg-card p-3 shadow-soft transition-all hover:border-primary/30 hover:shadow-soft-lg sm:gap-2 sm:rounded-2xl sm:p-4"
                >
                  <button
                    onClick={() => handleRestoreHistory(entry.id)}
                    className="flex flex-1 flex-col gap-1.5 text-left sm:gap-2"
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-sage-soft text-primary sm:h-9 sm:w-9 sm:rounded-2xl">
                        {entry.practiceDone ? (
                          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : entry.learnedDone ? (
                          <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        ) : (
                          <Play className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        )}
                      </span>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge variant="muted" className="text-[10px] sm:text-xs">
                          {entry.source === 'route' ? '路线' : entry.source === 'example' ? '推荐' : '自定义'}
                        </Badge>
                      </div>
                    </div>
                    <h3 className="truncate font-display text-sm font-bold leading-tight sm:text-base">{entry.sceneNameZh}</h3>
                    <p className="truncate text-xs text-primary/70">{entry.sceneNameEn}</p>
                    <div className="mt-auto flex items-center gap-1 text-[10px] text-muted-foreground sm:text-[11px]">
                      <span className={entry.practiceDone ? 'text-primary' : entry.learnedDone ? 'text-amber-600' : ''}>
                        {progressLabel}
                      </span>
                      <span>·</span>
                      <span>{timeStr}</span>
                    </div>
                  </button>
                  <button
                    onClick={() => removeHistoryEntry(entry.id)}
                    aria-label="删除记录"
                    className="absolute right-1.5 top-1.5 rounded-lg p-1 text-muted-foreground/40 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 推荐场景 */}
      <section className="mx-auto mt-8 sm:mt-12 max-w-4xl animate-fade-up" style={{ animationDelay: '0.16s' }}>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="font-display text-2xl font-bold">试试这些生活场景</h2>
            <p className="text-sm text-muted-foreground">点一个场景，马上开始今天的学习</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshScenes}
            disabled={generating}
            className="gap-1.5"
            title="换一批场景"
          >
            <RefreshCw className="h-4 w-4" />
            换一批
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
          {randomScenes.map((ex, i) => (
            <button
              key={ex.id}
              onClick={() => handleExample(ex)}
              disabled={generating}
              className="group relative flex flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left shadow-soft transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-soft-lg disabled:opacity-50 sm:gap-3 sm:rounded-3xl sm:p-5"
              style={{ animationDelay: `${0.2 + i * 0.04}s` }}
            >
              <div className="flex items-start justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-peach-soft to-sage-soft text-xl sm:h-12 sm:w-12 sm:text-2xl">
                  {ex.emoji}
                </span>
                <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold sm:text-lg">{ex.nameZh}</h3>
                <p className="text-xs font-medium text-primary/80 sm:text-sm">{ex.nameEn}</p>
                <p className="mt-0.5 text-xs text-muted-foreground sm:mt-1 sm:text-sm">{ex.hint}</p>
              </div>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          共 {EXAMPLE_SCENES.length} 个生活场景，每次随机展示 6 个
        </p>
      </section>

      {/* 登录/注册弹窗 */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowUserMenu(false)}
        >
          <Card className="max-w-md w-full shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-xl font-bold">
                  {authMode === 'login' ? '登录' : '注册'}
                </h3>
                <button onClick={() => setShowUserMenu(false)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                登录后可无限使用、保存学习记录、获得积分和等级。游客模式最多使用 {guestMaxUsage} 次。
              </p>

              {authError && (
                <div className="mb-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
                  {authError}
                </div>
              )}

              <div className="space-y-3">
                {authMode === 'register' && (
                  <>
                    {/* 头像选择 */}
                    <div>
                      <p className="mb-1.5 text-xs text-muted-foreground">选择头像</p>
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto rounded-xl border border-border bg-card p-2">
                        {AVATAR_LIST.map((a) => (
                          <button
                            key={a}
                            type="button"
                            onClick={() => setAuthAvatar(a)}
                            className={cn(
                              'grid h-9 w-9 place-items-center rounded-lg text-lg transition-all',
                              authAvatar === a
                                ? 'bg-primary/20 ring-2 ring-primary'
                                : 'bg-secondary hover:bg-secondary/70',
                            )}
                          >
                            {a}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="text"
                      value={authUsername}
                      onChange={(e) => setAuthUsername(e.target.value)}
                      placeholder="账户名（英文/数字，4-20 位）"
                      maxLength={20}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="邮箱"
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                    <input
                      type="text"
                      value={authNickname}
                      onChange={(e) => setAuthNickname(e.target.value)}
                      placeholder="昵称（中英文/数字，2-12 字符，可选）"
                      maxLength={12}
                      className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                    />
                  </>
                )}
                {authMode === 'login' && (
                  <input
                    type="text"
                    value={authAccount}
                    onChange={(e) => setAuthAccount(e.target.value)}
                    placeholder="账户名或邮箱"
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                )}
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  placeholder="密码（6-32 位）"
                  maxLength={32}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAuth(); }}
                />
                <Button
                  className="w-full"
                  disabled={authLoading}
                  onClick={handleAuth}
                >
                  {authLoading ? '处理中…' : (authMode === 'login' ? '登录' : '注册')}
                </Button>
              </div>

              <div className="mt-4 text-center text-xs text-muted-foreground">
                {authMode === 'login' ? (
                  <>没有账号？<button onClick={() => { setAuthMode('register'); setAuthError(''); }} className="font-semibold text-primary hover:underline">去注册</button></>
                ) : (
                  <>已有账号？<button onClick={() => { setAuthMode('login'); setAuthError(''); }} className="font-semibold text-primary hover:underline">去登录</button></>
                )}
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/70">
                需要后台服务支持，请确保 server 已启动
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 游客次数用尽提示 */}
      {showLoginPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowLoginPrompt(false)}
        >
          <Card className="max-w-md w-full border-peach/30 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 text-center sm:p-6">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-peach-soft text-3xl">🔒</span>
              <h3 className="mb-2 font-display text-xl font-bold">游客体验次数已用完</h3>
              <p className="mb-5 text-sm text-muted-foreground">
                你已经体验了 {guestMaxUsage} 次场景生成。登录后可无限使用，并保存学习记录和积分。
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowLoginPrompt(false)}>
                  稍后再说
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowLoginPrompt(false);
                    setShowUserMenu(true);
                  }}
                >
                  <LogIn className="h-4 w-4" />
                  立即登录
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 升级提示弹窗（登录用户额度用尽） */}
      {showUpgradePrompt && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowUpgradePrompt(false)}
        >
          <Card className="max-w-md w-full border-purple/30 shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 text-center sm:p-6">
              <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-3xl bg-purple-100 text-3xl">
                {getTierBadge(tierInfo.tier)}
              </span>
              <h3 className="mb-2 font-display text-xl font-bold">
                {getTierName(tierInfo.tier)}额度已用完
              </h3>
              <p className="mb-2 text-sm text-muted-foreground">
                当前方案：{tierInfo.getRemainingText()}
              </p>
              <p className="mb-5 text-sm text-muted-foreground">
                升级到更高级方案，解锁更多场景生成次数、每日路线、丰富对话细节等专属权益。
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowUpgradePrompt(false)}>
                  稍后再说
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => {
                    setShowUpgradePrompt(false);
                    navigate('/upgrade');
                  }}
                >
                  <Crown className="h-4 w-4" />
                  查看升级方案
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
