import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Home,
  LogOut,
  History as HistoryIcon,
  Award,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Crown,
  Gift,
  GraduationCap,
  Route as RouteIcon,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserStore } from '@/store/useUserStore';
import { useTierStore } from '@/store/useTierStore';
import { usePointsStore, DIFFICULTY_STARS } from '@/store/usePointsStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import {
  LEVELS,
  getLevelByStars,
  getNextLevel,
  starsToNextLevel,
  levelProgress,
} from '@/lib/levels';
import { getTierName, getTierBadge } from '@/lib/tiers';
import { cn } from '@/lib/utils';

function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Profile() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.currentUser);
  const logout = useUserStore((s) => s.logout);
  const allRecords = usePointsStore((s) => s.records);
  const allHistoryEntries = useHistoryStore((s) => s.entries);
  const tierInfo = useTierStore();

  // 进入页面时刷新 tier 信息
  useEffect(() => {
    if (currentUser) {
      tierInfo.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // 未登录：引导登录
  if (!currentUser) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-20 text-center animate-fade-up">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-peach-soft text-4xl">
            👤
          </span>
          <h2 className="font-display text-2xl font-bold">还未登录</h2>
          <p className="text-muted-foreground">
            登录后可查看你的积分、等级、勋章和学习记录，还能无限使用场景生成。
          </p>
          <Button size="lg" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" />
            返回首页登录
          </Button>
        </div>
      </PageShell>
    );
  }

  // 当前用户的积分和历史记录
  const records = allRecords
    .filter((r) => r.userId === currentUser.id)
    .sort((a, b) => b.earnedAt - a.earnedAt);
  const totalStars = records.reduce((sum, r) => sum + r.stars, 0);
  const historyEntries = allHistoryEntries.filter((e) => e.userId === currentUser.id);

  const currentLevel = getLevelByStars(totalStars);
  const nextLevel = getNextLevel(currentLevel.level);
  const remainStars = starsToNextLevel(totalStars);
  const progress = levelProgress(totalStars);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        {/* 用户信息卡 */}
        <Card className="overflow-hidden border-primary/20 shadow-soft-lg animate-fade-up">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-sage-soft to-peach-soft text-5xl">
                  {currentUser.avatar}
                </span>
                <div>
                  <h1 className="font-display text-2xl font-bold">{currentUser.nickname}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">
                    @{currentUser.username} · {currentUser.email}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge variant="sage" className="gap-1">
                      <span className="text-base">{currentLevel.badge}</span>
                      Lv.{currentLevel.level} {currentLevel.title}
                    </Badge>
                    <button
                      onClick={() => navigate('/upgrade')}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors',
                        tierInfo.tier === 'pro'
                          ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                          : tierInfo.tier === 'plus'
                            ? 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                            : 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100',
                      )}
                    >
                      <span>{getTierBadge(tierInfo.tier)}</span>
                      {getTierName(tierInfo.tier)}
                      {tierInfo.tier !== 'free' && (
                        <ChevronRight className="h-3 w-3" />
                      )}
                    </button>
                    {tierInfo.tier === 'free' && (
                      <button
                        onClick={() => navigate('/upgrade')}
                        className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100"
                      >
                        <Crown className="h-3 w-3" />
                        升级解锁更多
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
                <LogOut className="h-4 w-4" />
                退出登录
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 功能入口 */}
        <div className="mt-6 grid grid-cols-2 gap-3 animate-fade-up sm:grid-cols-4" style={{ animationDelay: '0.06s' }}>
          {/* 升级方案 */}
          <button
            onClick={() => navigate('/upgrade')}
            className={cn(
              'group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft-lg',
              tierInfo.tier === 'pro'
                ? 'border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50'
                : tierInfo.tier === 'plus'
                  ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50'
                  : 'border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50',
            )}
          >
            <span className={cn(
              'grid h-10 w-10 place-items-center rounded-xl text-xl',
              tierInfo.tier === 'pro' ? 'bg-purple-100' : tierInfo.tier === 'plus' ? 'bg-blue-100' : 'bg-amber-100',
            )}>
              {getTierBadge(tierInfo.tier)}
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold">{getTierName(tierInfo.tier)}</p>
              <p className="text-[11px] text-muted-foreground">
                {tierInfo.tier === 'free' ? '升级解锁更多权益' : '查看/管理订阅'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* 积分兑换奖励 */}
          <button
            onClick={() => navigate('/rewards')}
            className={cn(
              'group flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft-lg',
              tierInfo.tier === 'pro'
                ? 'border-purple-200 bg-purple-50/50'
                : 'border-border bg-card',
            )}
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-rose-100 text-xl">
              <Gift className="h-5 w-5 text-rose-600" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold">积分兑换</p>
              <p className="text-[11px] text-muted-foreground">
                {tierInfo.tier === 'pro' ? '用星星换奖励' : 'Pro 专属'}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* 学习中心 */}
          <button
            onClick={() => navigate('/learn-center')}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-sage-soft text-xl">
              <GraduationCap className="h-5 w-5 text-primary" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold">学习中心</p>
              <p className="text-[11px] text-muted-foreground">单词·口语·写作·测验</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>

          {/* 每日路线 */}
          <button
            onClick={() => navigate('/daily-route')}
            className="group flex flex-col items-start gap-2 rounded-2xl border border-border bg-card p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft-lg"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-peach-soft text-xl">
              <RouteIcon className="h-5 w-5 text-accent-foreground" />
            </span>
            <div className="flex-1">
              <p className="font-display text-sm font-bold">每日路线</p>
              <p className="text-[11px] text-muted-foreground">把英语嵌入一天</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        {/* 当前方案额度信息 */}
        {tierInfo.tier !== 'free' && (
          <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.08s' }}>
            <CardContent className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{getTierBadge(tierInfo.tier)}</span>
                  <div>
                    <p className="text-sm font-semibold">{getTierName(tierInfo.tier)} · 当前额度</p>
                    <p className="text-xs text-muted-foreground">
                      场景生成：{tierInfo.getRemainingText()}
                      {tierInfo.tierExpireAt && (
                        <> · 到期 {formatFullTime(tierInfo.tierExpireAt)}</>
                      )}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/upgrade')} className="gap-1">
                  管理订阅
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 积分 + 等级概览 */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3 animate-fade-up" style={{ animationDelay: '0.08s' }}>
          {/* 总星数 */}
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-amber-700">
                <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                <span className="text-sm font-semibold">总星数</span>
              </div>
              <p className="mt-2 font-display text-4xl font-bold text-amber-700">
                {totalStars}
                <span className="ml-1 text-lg text-amber-500">⭐</span>
              </p>
              <p className="mt-1 text-xs text-amber-600/70">
                共完成 {records.length} 个场景
              </p>
            </CardContent>
          </Card>

          {/* 当前等级 */}
          <Card className="border-primary/20 bg-gradient-to-br from-sage-soft/40 to-peach-soft/30">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-primary">
                <Award className="h-5 w-5" />
                <span className="text-sm font-semibold">当前等级</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold">
                <span className="mr-1">{currentLevel.badge}</span>
                Lv.{currentLevel.level}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{currentLevel.title}</p>
            </CardContent>
          </Card>

          {/* 距离下一级 */}
          <Card className={cn(nextLevel ? 'border-purple-200 bg-purple-50/50' : 'border-border bg-card')}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-purple-700">
                <TrendingUp className="h-5 w-5" />
                <span className="text-sm font-semibold">{nextLevel ? '距离下一级' : '已满级'}</span>
              </div>
              {nextLevel ? (
                <>
                  <p className="mt-2 font-display text-3xl font-bold text-purple-700">
                    {remainStars}
                    <span className="ml-1 text-base text-purple-500">⭐</span>
                  </p>
                  <p className="mt-1 text-xs text-purple-600/70">
                    即将解锁「{nextLevel.title}」{nextLevel.badge}
                  </p>
                </>
              ) : (
                <p className="mt-2 font-display text-2xl font-bold text-purple-700">
                  已达最高等级 💎
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 等级进度条 */}
        <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.12s' }}>
          <CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span className="font-display font-bold">等级进度</span>
              </div>
              <span className="text-sm font-semibold text-primary">{progress}%</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Lv.{currentLevel.level} {currentLevel.badge} {currentLevel.title}（{currentLevel.minStars}⭐）
              </span>
              {nextLevel ? (
                <span>
                  Lv.{nextLevel.level} {nextLevel.badge} {nextLevel.title}（{nextLevel.minStars}⭐）
                </span>
              ) : (
                <span>已满级 🎉</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 等级勋章墙 */}
        <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.16s' }}>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Award className="h-4 w-4 text-primary" />
              <h3 className="font-display font-bold">勋章墙</h3>
              <Badge variant="muted" className="text-[10px]">
                {currentLevel.level}/{LEVELS.length} 已解锁
              </Badge>
            </div>
            <div className="grid grid-cols-5 gap-3 sm:grid-cols-10">
              {LEVELS.map((lv) => {
                const unlocked = totalStars >= lv.minStars;
                const isCurrent = lv.level === currentLevel.level;
                return (
                  <div
                    key={lv.level}
                    className={cn(
                      'flex flex-col items-center gap-1 rounded-2xl border p-2 text-center transition-all',
                      isCurrent && 'border-primary bg-primary/5 shadow-soft',
                      unlocked && !isCurrent && 'border-sage/30 bg-sage-soft/20',
                      !unlocked && 'border-border bg-muted/30 opacity-40',
                    )}
                    title={unlocked ? `${lv.title}（${lv.minStars}⭐）` : `需 ${lv.minStars}⭐ 解锁`}
                  >
                    <span className={cn('text-2xl', !unlocked && 'grayscale')}>{lv.badge}</span>
                    <span className="text-[10px] font-semibold">Lv.{lv.level}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 积分记录 */}
        <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                <h3 className="font-display font-bold">积分记录</h3>
              </div>
              <Badge variant="muted" className="text-[10px]">
                共 {records.length} 条
              </Badge>
            </div>
            {records.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span className="grid h-14 w-14 place-items-center rounded-2xl bg-peach-soft text-2xl">
                  🌟
                </span>
                <p className="text-sm text-muted-foreground">
                  还没有积分记录。完成一个完整的学习闭环（学习+演练）即可获得星数！
                </p>
                <Button size="sm" onClick={() => navigate('/')}>
                  去学习一个场景
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {records.slice(0, 20).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-secondary/30"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-xl">
                      ⭐
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate font-semibold">{r.sceneNameZh}</h4>
                        <Badge variant="muted" className="shrink-0 text-[10px]">
                          {r.difficulty === 'easy' ? '简单' : r.difficulty === 'medium' ? '难度' : '复杂'}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{formatFullTime(r.earnedAt)}</p>
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold text-amber-600">
                      +{r.stars}
                    </span>
                  </div>
                ))}
                {records.length > 20 && (
                  <p className="pt-2 text-center text-xs text-muted-foreground">
                    仅显示最近 20 条，共 {records.length} 条记录
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 我的学习历史 */}
        <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.24s' }}>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-primary" />
                <h3 className="font-display font-bold">我的学习历史</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/history')} className="gap-1">
                查看全部
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {historyEntries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                还没有学习记录
              </p>
            ) : (
              <div className="space-y-2">
                {historyEntries.slice(0, 5).map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span
                      className={cn(
                        'grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold',
                        e.practiceDone
                          ? 'bg-sage-soft text-primary'
                          : e.learnedDone
                            ? 'bg-amber-100 text-amber-600'
                            : 'bg-peach-soft text-accent-foreground',
                      )}
                    >
                      {e.practiceDone ? '✓' : e.learnedDone ? '½' : '·'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold">{e.sceneNameZh}</h4>
                      <p className="truncate text-xs text-muted-foreground">
                        {e.practiceDone ? '已完成演练' : e.learnedDone ? '已学完，待演练' : '未完成学习'} · {formatFullTime(e.createdAt)}
                      </p>
                    </div>
                    <Badge variant="muted" className="shrink-0 text-[10px]">
                      {e.difficulty === 'easy' ? '简单' : e.difficulty === 'medium' ? '难度' : '复杂'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 积分规则说明 */}
        <Card className="mt-4 border-peach/30 bg-peach-soft/20 animate-fade-up" style={{ animationDelay: '0.28s' }}>
          <CardContent className="p-5">
            <div className="mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent-foreground" />
            <h3 className="font-display font-bold">积分规则</h3>
            </div>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              <li>· 完成完整学习闭环（学习 + 测验 + 对话演练）后一次性发放星数</li>
              <li>· 简单场景 +{DIFFICULTY_STARS.easy}⭐ · 难度场景 +{DIFFICULTY_STARS.medium}⭐ · 复杂场景 +{DIFFICULTY_STARS.hard}⭐</li>
              <li>· 同一场景只计一次最高分，重复练习不会重复获得</li>
              <li>· 星数累积可解锁更高等级和勋章</li>
            </ul>
          </CardContent>
        </Card>

        {/* 底部操作 */}
        <div className="mt-6 flex justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.32s' }}>
          <Button variant="outline" onClick={() => navigate('/')}>
            <Home className="h-4 w-4" />
            返回首页
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
