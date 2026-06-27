import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Crown, Sparkles, Zap, ArrowLeft, Loader2, Star } from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useUserStore } from '@/store/useUserStore';
import { useTierStore } from '@/store/useTierStore';
import { api, checkBackend, isAuthError } from '@/lib/api';
import { TIER_CONFIGS, TIER_ORDER, formatPrice, yearlyPerMonth, yearlyDiscount } from '@/lib/tiers';
import type { Tier } from '@/lib/tiers';
import { cn } from '@/lib/utils';

export default function Upgrade() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.currentUser);
  const refreshMe = useUserStore((s) => s.refreshMe);
  const tierInfo = useTierStore((s) => s);
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const [upgrading, setUpgrading] = useState<Tier | null>(null);
  const [downgrading, setDowngrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    tierInfo.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTier = currentUser?.tier || tierInfo.tier || 'free';

  const handleUpgrade = async (targetTier: 'plus' | 'pro') => {
    if (!currentUser) {
      navigate('/');
      return;
    }
    setUpgrading(targetTier);
    setError(null);
    setSuccess(null);
    try {
      const backendUp = await checkBackend();
      if (!backendUp) {
        setError('后台服务未启动，无法升级');
        return;
      }
      // 占位：未来接入支付，当前直接升级（365 天有效期）
      await api.upgradeTier(targetTier, 365);
      await refreshMe();
      await tierInfo.refresh();
      setSuccess(`恭喜！已升级为 ${TIER_CONFIGS[targetTier].nameZh}，有效期 365 天`);
    } catch (err) {
      if (isAuthError(err)) return; // 登录已过期，静默处理
      setError(err instanceof Error ? err.message : '升级失败');
    } finally {
      setUpgrading(null);
    }
  };

  // 取消订阅：降级为免费版（对齐 FAQ"可以随时取消"的承诺）
  const handleDowngrade = async () => {
    if (!currentUser) return;
    setDowngrading(true);
    setError(null);
    setSuccess(null);
    try {
      const backendUp = await checkBackend();
      if (!backendUp) {
        setError('后台服务未启动，无法取消');
        return;
      }
      await api.downgradeTier();
      await refreshMe();
      await tierInfo.refresh();
      setSuccess('已取消订阅，降级为免费版。已生成的内容和星星保留。');
    } catch (err) {
      if (isAuthError(err)) return;
      setError(err instanceof Error ? err.message : '取消失败');
    } finally {
      setDowngrading(false);
    }
  };

  return (
    <PageShell showHome={false}>
      <div className="mx-auto max-w-5xl">
        {/* 返回 */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>

        {/* 标题 */}
        <div className="mb-8 text-center animate-fade-up">
          <Badge variant="sage" className="mb-3 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            选择适合的方案
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-4xl">升级解锁更多可能</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            从免费开始，随时升级。Plus 适合日常学习，Pro 适合深度练习。
          </p>
          {currentUser && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-sm">
              <span>当前方案：</span>
              <Badge variant="peach" className="gap-1">
                {TIER_CONFIGS[currentTier as Tier]?.badge} {TIER_CONFIGS[currentTier as Tier]?.nameZh}
              </Badge>
              {tierInfo.totalGenLimit > 0 && (
                <span className="text-muted-foreground">
                  · 已用 {tierInfo.totalGenCount}/{tierInfo.totalGenLimit} 次
                </span>
              )}
              {tierInfo.monthlyGenLimit > 0 && (
                <span className="text-muted-foreground">
                  · 本月 {tierInfo.monthlyGenCount}/{tierInfo.monthlyGenLimit} 次
                </span>
              )}
            </div>
          )}
        </div>

        {/* 计费切换 */}
        <div className="mb-8 flex justify-center animate-fade-up" style={{ animationDelay: '0.06s' }}>
          <div className="inline-flex items-center gap-1 rounded-2xl border border-border bg-card p-1">
            <button
              onClick={() => setBilling('monthly')}
              className={cn(
                'rounded-xl px-5 py-2 text-sm font-semibold transition-all',
                billing === 'monthly' ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              按月付费
            </button>
            <button
              onClick={() => setBilling('yearly')}
              className={cn(
                'rounded-xl px-5 py-2 text-sm font-semibold transition-all',
                billing === 'yearly' ? 'bg-primary text-primary-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              按年付费
              <span className="ml-1.5 rounded-full bg-amber-400 px-1.5 py-0.5 text-[10px] sm:text-xs text-white">
                省 26%
              </span>
            </button>
          </div>
        </div>

        {/* 三档定价卡 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-5 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          {TIER_ORDER.map((tierKey) => {
            const cfg = TIER_CONFIGS[tierKey];
            const isCurrent = currentTier === tierKey;
            const isPlusOrPro = tierKey === 'plus' || tierKey === 'pro';
            const price = billing === 'yearly' ? cfg.priceYearly : cfg.priceMonthly;
            const discount = billing === 'yearly' && isPlusOrPro ? yearlyDiscount(cfg.priceYearly, cfg.priceMonthly) : 0;

            return (
              <Card
                key={tierKey}
                className={cn(
                  'relative flex flex-col transition-all',
                  cfg.highlight && 'border-primary shadow-soft-lg md:scale-105',
                  isCurrent && 'ring-2 ring-primary/40',
                )}
              >
                {cfg.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="gap-1 bg-primary text-primary-foreground text-[9px] sm:text-xs">
                      <Star className="h-2.5 w-2.5 fill-current sm:h-3 sm:w-3" /> <span className="hidden sm:inline">最受欢迎</span><span className="sm:hidden">热门</span>
                    </Badge>
                  </div>
                )}
                {tierKey === 'pro' && (
                  <div className="absolute -top-3 right-2 sm:right-3">
                    <Badge variant="peach" className="gap-1 text-[9px] sm:text-xs">
                      <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3" /> <span className="hidden sm:inline">最佳价值</span><span className="sm:hidden">超值</span>
                    </Badge>
                  </div>
                )}
                <CardContent className="flex flex-1 flex-col p-2.5 sm:p-6">
                  {/* 头部 */}
                  <div className="mb-2 sm:mb-4">
                    <div className="flex items-center gap-1 sm:gap-2">
                      <span className="text-xl sm:text-3xl">{cfg.badge}</span>
                      <h3 className="font-display text-sm font-bold sm:text-2xl">{cfg.nameZh}</h3>
                    </div>
                    <p className="mt-0.5 text-[10px] text-muted-foreground sm:mt-1 sm:text-sm">{cfg.nameEn}</p>
                  </div>

                  {/* 价格 */}
                  <div className="mb-3 sm:mb-5">
                    {price === 0 ? (
                      <p className="font-display text-lg font-bold sm:text-3xl sm:font-bold text-gray-700">免费</p>
                    ) : (
                      <>
                        <div className="flex items-baseline gap-0.5 sm:gap-1">
                          <span className="font-display text-lg font-bold sm:text-3xl sm:font-bold">{formatPrice(price)}</span>
                          <span className="text-[10px] text-muted-foreground sm:text-sm">/{billing === 'yearly' ? '年' : '月'}</span>
                        </div>
                        {billing === 'yearly' && (
                          <p className="mt-0.5 text-[10px] text-amber-600 sm:mt-1 sm:text-xs">
                            约 {yearlyPerMonth(cfg.priceYearly)}/月 · 省 {discount}%
                          </p>
                        )}
                      </>
                    )}
                  </div>

                  {/* 权益列表 */}
                  <ul className="mb-4 flex-1 space-y-1.5 sm:mb-6 sm:space-y-2.5">
                    {cfg.benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-1 text-[10px] sm:gap-2 sm:text-sm">
                        <Check className={cn('mt-0.5 h-2.5 w-2.5 shrink-0 sm:h-4 sm:w-4', cfg.color)} />
                        <span className="text-foreground/90">{b}</span>
                      </li>
                    ))}
                  </ul>

                  {/* 按钮 */}
                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full h-8 text-[10px] sm:h-10 sm:text-sm">
                      当前方案
                    </Button>
                  ) : tierKey === 'free' ? (
                    <Button variant="outline" className="w-full h-8 text-[10px] sm:h-10 sm:text-sm" onClick={() => navigate('/')}>
                      开始使用
                    </Button>
                  ) : (
                    <Button
                      variant={cfg.highlight ? 'default' : 'soft'}
                      className="w-full gap-1 h-8 text-[10px] sm:h-10 sm:gap-1.5 sm:text-sm"
                      onClick={() => handleUpgrade(tierKey)}
                      disabled={upgrading !== null}
                    >
                      {upgrading === tierKey ? (
                        <><Loader2 className="h-3 w-3 animate-spin sm:h-4 sm:w-4" /> <span className="sm:hidden">中…</span><span className="hidden sm:inline">升级中…</span></>
                      ) : (
                        <>
                          {tierKey === 'pro' && <Crown className="h-3 w-3 sm:h-4 sm:w-4" />}
                          {tierKey === 'plus' && <Zap className="h-3 w-3 sm:h-4 sm:w-4" />}
                          <span className="sm:hidden">升级</span>
                          <span className="hidden sm:inline">升级到 {cfg.nameZh}</span>
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 消息提示 */}
        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive animate-fade-up">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-6 rounded-2xl border border-primary/30 bg-sage-soft/30 p-4 text-center text-sm text-primary animate-fade-up">
            <Check className="mr-1 inline h-4 w-4" />
            {success}
          </div>
        )}

        {/* 对比说明 */}
        <Card className="mt-8 animate-fade-up" style={{ animationDelay: '0.16s' }}>
          <CardContent className="p-4 sm:p-5">
            <h3 className="mb-4 font-display text-lg font-bold">方案对比</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium text-muted-foreground">功能</th>
                    <th className="py-2 text-center font-medium">免费版</th>
                    <th className="py-2 text-center font-medium text-blue-600">Plus</th>
                    <th className="py-2 text-center font-medium text-purple-600">Pro</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: '场景生成', free: '6 次终身', plus: '90 次/月', pro: '150 次/月' },
                    { label: '每日路线', free: '2 条预置', plus: '最多 3 条', pro: '最多 5 条' },
                    { label: '编辑/新建路线', free: '—', plus: '✓', pro: '✓' },
                    { label: '丰富对话细节', free: '—', plus: '—', pro: '✓' },
                    { label: '积分兑换奖励', free: '—', plus: '—', pro: '✓' },
                    { label: '场景缓存复用', free: '—', plus: '✓', pro: '✓' },
                    { label: '完整学习闭环', free: '✓', plus: '✓', pro: '✓' },
                    { label: '听示范跟读', free: '✓', plus: '✓', pro: '✓' },
                  ].map((row) => (
                    <tr key={row.label} className="border-b last:border-0">
                      <td className="py-2.5 font-medium">{row.label}</td>
                      <td className="py-2.5 text-center text-muted-foreground">{row.free}</td>
                      <td className="py-2.5 text-center text-blue-600">{row.plus}</td>
                      <td className="py-2.5 text-center text-purple-600 font-semibold">{row.pro}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* 取消订阅入口（仅 Plus/Pro 用户可见，对齐 FAQ"可以随时取消"承诺） */}
        {currentUser && currentTier !== 'free' && (
          <Card className="mt-6 border-border/60 animate-fade-up">
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div>
                <h4 className="font-semibold">取消订阅</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  取消后立即降级为免费版，已生成的学习内容和星星/等级保留，不受影响。
                </p>
              </div>
              <Button
                variant="outline"
                className="shrink-0 border-destructive/40 text-destructive hover:bg-destructive/5"
                onClick={handleDowngrade}
                disabled={downgrading || upgrading !== null}
              >
                {downgrading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> 取消中…</>
                ) : (
                  '取消订阅'
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* FAQ */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Card className="border-border/60">
            <CardContent className="p-4 sm:p-5">
              <h4 className="mb-2 font-semibold">次数用完了怎么办？</h4>
              <p className="text-sm text-muted-foreground">
                免费用户终身 6 次，用完需升级。Plus/Pro 用户每月 1 号重置次数，未用完的次数不累积。
              </p>
            </CardContent>
          </Card>
          <Card className="border-border/60">
            <CardContent className="p-4 sm:p-5">
              <h4 className="mb-2 font-semibold">可以随时取消吗？</h4>
              <p className="text-sm text-muted-foreground">
                可以。到期后自动降级为免费版，已生成的学习内容不受影响，星星和等级保留。
              </p>
            </CardContent>
          </Card>
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          * 价格为演示用占位，正式上线前可能调整。当前升级为测试功能，不产生真实扣费。
        </p>
      </div>
    </PageShell>
  );
}
