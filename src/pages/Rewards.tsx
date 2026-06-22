import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Star,
  Crown,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Gift,
  History as HistoryIcon,
  ArrowLeft,
  Award,
  X,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useUserStore } from '@/store/useUserStore';
import { api, isAuthError } from '@/lib/api';
import {
  getLevelByStars,
  getNextLevel,
  starsToNextLevel,
  levelProgress,
} from '@/lib/levels';
import { cn } from '@/lib/utils';

// 奖励项类型（与后端 RewardItem 对应）
interface RewardItem {
  id: string;
  name: string;
  description: string;
  starCost: number;
  icon: string;
  isPreset: boolean;
  sortOrder: number;
}

// 兑换记录类型（与后端 RedemptionItem 对应）
interface RedemptionItem {
  id: string;
  rewardName: string;
  starsSpent: number;
  redeemedAt: number;
}

// 表单数据
interface RewardForm {
  name: string;
  description: string;
  starCost: string;
  icon: string;
}

// 空表单
const EMPTY_FORM: RewardForm = {
  name: '',
  description: '',
  starCost: '',
  icon: '🎁',
};

// 可选图标
const ICON_OPTIONS = ['🎁', '🧸', '🍦', '🎮', '📚', '🎨', '⚽', '🎬', '🍕', '🛒', '🎈', '⭐'];

// 格式化时间
function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Rewards() {
  const navigate = useNavigate();
  const currentUser = useUserStore((s) => s.currentUser);
  const refreshMe = useUserStore((s) => s.refreshMe);

  // 数据状态
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [totalStars, setTotalStars] = useState(0);
  const [canRedeem, setCanRedeem] = useState(false);
  const [redemptions, setRedemptions] = useState<RedemptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // 家长管理区状态
  const [manageOpen, setManageOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<RewardItem | null>(null);
  const [form, setForm] = useState<RewardForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isPro = currentUser?.tier === 'pro';

  // 显示 toast（3 秒后自动消失）
  const showToast = (type: 'success' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  // 加载数据
  const loadData = async () => {
    setLoading(true);
    try {
      const [rewardsRes, redemptionsRes] = await Promise.all([
        api.getRewards(),
        api.getRedemptions(),
      ]);
      setRewards(rewardsRes.rewards);
      setTotalStars(rewardsRes.totalStars);
      setCanRedeem(rewardsRes.canRedeem);
      setRedemptions(redemptionsRes.redemptions);
    } catch (err) {
      if (isAuthError(err)) return; // 登录已过期，静默处理
      showToast('error', err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    if (!isPro) {
      setLoading(false);
      return;
    }
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro]);

  // 兑换奖励
  const handleRedeem = async (reward: RewardItem) => {
    setRedeemingId(reward.id);
    try {
      const res = await api.redeemReward(reward.id);
      showToast('success', res.message || `兑换成功！消耗 ${res.starsSpent} ⭐`);
      // 刷新奖励数据 + 用户信息
      await Promise.all([loadData(), refreshMe()]);
    } catch (err) {
      if (isAuthError(err)) return; // 登录已过期，静默处理
      showToast('error', err instanceof Error ? err.message : '兑换失败');
    } finally {
      setRedeemingId(null);
    }
  };

  // 开始新增
  const handleStartAdd = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  // 开始编辑
  const handleStartEdit = (reward: RewardItem) => {
    setEditing(reward);
    setForm({
      name: reward.name,
      description: reward.description,
      starCost: String(reward.starCost),
      icon: reward.icon || '🎁',
    });
    setShowForm(true);
  };

  // 取消表单
  const handleCancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  // 保存（新增或更新）
  const handleSave = async () => {
    const name = form.name.trim();
    const starCostNum = parseInt(form.starCost, 10);
    if (!name) {
      showToast('error', '请输入奖励名称');
      return;
    }
    if (!starCostNum || starCostNum <= 0) {
      showToast('error', '请输入有效的星数');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name,
        description: form.description.trim(),
        starCost: starCostNum,
        icon: form.icon || '🎁',
      };
      if (editing) {
        await api.updateReward(editing.id, payload);
        showToast('success', '奖励已更新');
      } else {
        await api.createReward(payload);
        showToast('success', '奖励已创建');
      }
      setShowForm(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      await loadData();
    } catch (err) {
      if (isAuthError(err)) return; // 登录已过期，静默处理
      showToast('error', err instanceof Error ? err.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 删除奖励
  const handleDelete = async (reward: RewardItem) => {
    if (!window.confirm(`确定删除「${reward.name}」？`)) return;
    setDeletingId(reward.id);
    try {
      await api.deleteReward(reward.id);
      showToast('success', '奖励已删除');
      await loadData();
    } catch (err) {
      if (isAuthError(err)) return; // 登录已过期，静默处理
      showToast('error', err instanceof Error ? err.message : '删除失败');
    } finally {
      setDeletingId(null);
    }
  };

  // 等级信息
  const currentLevel = getLevelByStars(totalStars);
  const nextLevel = getNextLevel(currentLevel.level);
  const remainStars = starsToNextLevel(totalStars);
  const progress = levelProgress(totalStars);

  // 非 Pro 用户：显示升级引导
  if (!isPro) {
    return (
      <PageShell showHome={false}>
        <div className="mx-auto max-w-2xl">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> 返回
          </Button>

          <Card className="overflow-hidden border-primary/20 shadow-soft-lg animate-fade-up">
            <CardContent className="p-5 text-center sm:p-8">
              <span className="mx-auto grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-purple-100 to-pink-100 text-5xl">
                👑
              </span>
              <Badge variant="peach" className="mt-5 gap-1">
                <Crown className="h-3.5 w-3.5" /> Pro 专属功能
              </Badge>
              <h1 className="mt-4 font-display text-2xl font-bold sm:text-4xl">积分兑换奖励</h1>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">
                用学习攒下的星星兑换真实奖励，让孩子更有动力坚持每日英语练习。这是 Pro 会员专属功能。
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { icon: '🎁', title: '自定义奖励', desc: '家长可设置专属奖励' },
                  { icon: '⭐', title: '星星兑换', desc: '用积分兑换心仪奖励' },
                  { icon: '📊', title: '兑换记录', desc: '查看完整兑换历史' },
                ].map((f) => (
                  <div key={f.title} className="rounded-2xl border border-border bg-card p-4 text-left">
                    <span className="text-2xl">{f.icon}</span>
                    <h3 className="mt-1 font-semibold">{f.title}</h3>
                    <p className="text-xs text-muted-foreground">{f.desc}</p>
                  </div>
                ))}
              </div>

              <Button size="lg" className="mt-8 gap-2" onClick={() => navigate('/upgrade')}>
                <Crown className="h-4 w-4" />
                了解 Pro
              </Button>
            </CardContent>
          </Card>
        </div>
      </PageShell>
    );
  }

  // Pro 用户主界面
  return (
    <PageShell showHome={false}>
      <div className="mx-auto max-w-5xl">
        {/* 返回 */}
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4 gap-1.5">
          <ArrowLeft className="h-4 w-4" /> 返回
        </Button>

        {/* 标题 */}
        <div className="mb-8 text-center animate-fade-up">
          <Badge variant="peach" className="mb-3 gap-1.5">
            <Crown className="h-3.5 w-3.5" /> Pro 专属
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-4xl">积分兑换奖励</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            用学习攒下的星星兑换奖励，让坚持变成惊喜。
          </p>
        </div>

        {/* 顶部：总星数 + 等级信息 */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 animate-fade-up" style={{ animationDelay: '0.06s' }}>
          {/* 总星数 */}
          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 text-amber-700">
                <Star className="h-5 w-5 fill-amber-400 text-amber-500" />
                <span className="text-sm font-semibold">总星数</span>
              </div>
              <p className="mt-2 font-display text-3xl font-bold text-amber-700 sm:text-4xl">
                {totalStars}
                <span className="ml-1 text-lg text-amber-500">⭐</span>
              </p>
              <p className="mt-1 text-xs text-amber-600/70">可兑换奖励</p>
            </CardContent>
          </Card>

          {/* 当前等级 */}
          <Card className="border-primary/20 bg-gradient-to-br from-sage-soft/40 to-peach-soft/30">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 text-primary">
                <Award className="h-5 w-5" />
                <span className="text-sm font-semibold">当前等级</span>
              </div>
              <p className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                <span className="mr-1">{currentLevel.badge}</span>
                Lv.{currentLevel.level}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{currentLevel.title}</p>
            </CardContent>
          </Card>

          {/* 距离下一级 */}
          <Card className={cn(nextLevel ? 'border-purple-200 bg-purple-50/50' : 'border-border bg-card')}>
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-2 text-purple-700">
                <Sparkles className="h-5 w-5" />
                <span className="text-sm font-semibold">{nextLevel ? '距离下一级' : '已满级'}</span>
              </div>
              {nextLevel ? (
                <>
                  <p className="mt-2 font-display text-2xl font-bold sm:text-3xl text-purple-700">
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
        <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-4 sm:p-5">
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
          </CardContent>
        </Card>

        {/* Toast 提示 */}
        {toast && (
          <div
            className={cn(
              'mt-4 rounded-2xl border p-4 text-center text-sm animate-fade-up',
              toast.type === 'success'
                ? 'border-primary/30 bg-sage-soft/30 text-primary'
                : 'border-destructive/30 bg-destructive/5 text-destructive',
            )}
          >
            {toast.type === 'success' ? (
              <Check className="mr-1 inline h-4 w-4" />
            ) : (
              <AlertCircle className="mr-1 inline h-4 w-4" />
            )}
            {toast.message}
          </div>
        )}

        {/* 奖励列表 */}
        <div className="mt-8 animate-fade-up" style={{ animationDelay: '0.14s' }}>
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl font-bold">奖励列表</h2>
            </div>
            <Badge variant="muted" className="text-[10px] sm:text-xs">
              共 {rewards.length} 项
            </Badge>
          </div>

          {loading ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm">加载中…</p>
            </div>
          ) : rewards.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-peach-soft text-2xl">
                  🎁
                </span>
                <p className="mt-3 text-sm text-muted-foreground">
                  还没有奖励。家长可以在下方管理区添加奖励。
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3">
              {rewards.map((reward) => {
                const canAfford = totalStars >= reward.starCost;
                const need = reward.starCost - totalStars;
                const isRedeeming = redeemingId === reward.id;
                const isDeleting = deletingId === reward.id;
                return (
                  <Card key={reward.id} className="flex flex-col transition-all">
                    <CardContent className="flex flex-1 flex-col p-4 sm:p-5">
                      {/* 头部：图标 + 预设标签 + 管理按钮 */}
                      <div className="mb-3 flex items-start justify-between">
                        <span className="grid h-12 w-12 sm:h-14 sm:w-14 place-items-center rounded-2xl bg-gradient-to-br from-sage-soft to-peach-soft text-2xl sm:text-3xl">
                          {reward.icon || '🎁'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {reward.isPreset && (
                            <Badge variant="sage" className="text-[10px] sm:text-xs">预设</Badge>
                          )}
                          {manageOpen && (
                            <>
                              <button
                                onClick={() => handleStartEdit(reward)}
                                className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-foreground transition-colors hover:bg-secondary"
                                title="编辑"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(reward)}
                                disabled={isDeleting}
                                className="grid h-11 w-11 place-items-center rounded-2xl border border-border bg-card text-destructive transition-colors hover:bg-destructive/5 disabled:opacity-50"
                                title="删除"
                              >
                                {isDeleting ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* 名称 + 描述 */}
                      <h3 className="font-display text-lg font-bold">{reward.name}</h3>
                      {reward.description && (
                        <p className="mt-1 flex-1 text-sm text-muted-foreground line-clamp-2">
                          {reward.description}
                        </p>
                      )}

                      {/* 星数成本 */}
                      <div className="mt-3 flex items-center gap-1.5 text-amber-700">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-500" />
                        <span className="font-display text-lg font-bold">{reward.starCost}</span>
                        <span className="text-xs text-muted-foreground">星</span>
                      </div>

                      {/* 兑换按钮 */}
                      <Button
                        className="mt-4 gap-1.5"
                        disabled={!canAfford || isRedeeming || !canRedeem}
                        onClick={() => handleRedeem(reward)}
                      >
                        {isRedeeming ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" /> 兑换中…
                          </>
                        ) : canAfford ? (
                          <>
                            <Gift className="h-4 w-4" /> 立即兑换
                          </>
                        ) : (
                          <>还需 {need} ⭐</>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* 家长管理区（可折叠） */}
        <Card className="mt-8 animate-fade-up" style={{ animationDelay: '0.18s' }}>
          <CardContent className="p-4 sm:p-5">
            <button
              onClick={() => setManageOpen((v) => !v)}
              className="flex w-full items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-peach-soft text-lg">
                  👨‍👩‍👧
                </span>
                <div className="text-left">
                  <h3 className="font-display font-bold">家长管理区</h3>
                  <p className="text-xs text-muted-foreground">添加、编辑或删除奖励</p>
                </div>
              </div>
              {manageOpen ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>

            {manageOpen && (
              <div className="mt-5 animate-fade-in">
                {/* 新增按钮（表单未显示时） */}
                {!showForm && (
                  <Button variant="soft" className="w-full gap-1.5" onClick={handleStartAdd}>
                    <Plus className="h-4 w-4" /> 新增奖励
                  </Button>
                )}

                {/* 内联表单 */}
                {showForm && (
                  <div className="rounded-2xl border border-border bg-card p-4 animate-fade-up">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-display font-bold">
                        {editing ? '编辑奖励' : '新增奖励'}
                      </h4>
                      <button
                        onClick={handleCancelForm}
                        className="grid h-11 w-11 place-items-center rounded-2xl text-muted-foreground transition-colors hover:bg-secondary"
                        title="取消"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      {/* 名称 */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          奖励名称 <span className="text-destructive">*</span>
                        </label>
                        <Input
                          placeholder="例如：看一集动画片"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          maxLength={40}
                        />
                      </div>

                      {/* 描述 */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          描述（可选）
                        </label>
                        <Textarea
                          placeholder="奖励的详细说明"
                          value={form.description}
                          onChange={(e) => setForm({ ...form, description: e.target.value })}
                          maxLength={120}
                          className="min-h-[72px]"
                        />
                      </div>

                      {/* 星数成本 */}
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-muted-foreground">
                          所需星数 <span className="text-destructive">*</span>
                        </label>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          placeholder="例如：30"
                          value={form.starCost}
                          onChange={(e) => setForm({ ...form, starCost: e.target.value })}
                        />
                      </div>

                      {/* 图标选择 */}
                      <div>
                        <label className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                          图标
                        </label>
                        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                          {ICON_OPTIONS.map((icon) => (
                            <button
                              key={icon}
                              type="button"
                              onClick={() => setForm({ ...form, icon })}
                              className={cn(
                                'grid h-11 w-11 place-items-center rounded-2xl border-2 text-xl transition-all',
                                form.icon === icon
                                  ? 'border-primary bg-primary/5 shadow-soft'
                                  : 'border-border bg-card hover:bg-secondary',
                              )}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex gap-2 pt-1">
                        <Button
                          className="flex-1 gap-1.5"
                          onClick={handleSave}
                          disabled={saving}
                        >
                          {saving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" /> 保存中…
                            </>
                          ) : (
                            <>
                              <Check className="h-4 w-4" /> 保存
                            </>
                          )}
                        </Button>
                        <Button variant="outline" onClick={handleCancelForm} disabled={saving}>
                          取消
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 兑换历史 */}
        <Card className="mt-4 animate-fade-up" style={{ animationDelay: '0.22s' }}>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <HistoryIcon className="h-4 w-4 text-primary" />
                <h3 className="font-display font-bold">兑换历史</h3>
              </div>
              <Badge variant="muted" className="text-[10px] sm:text-xs">
                共 {redemptions.length} 条
              </Badge>
            </div>

            {redemptions.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-peach-soft text-xl">
                  📜
                </span>
                <p className="text-sm text-muted-foreground">还没有兑换记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {redemptions.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-border bg-card p-2.5 sm:p-3 transition-colors hover:bg-secondary/30"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-xl">
                      ⭐
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold">{r.rewardName}</h4>
                      <p className="text-xs text-muted-foreground">{formatFullTime(r.redeemedAt)}</p>
                    </div>
                    <span className="shrink-0 font-display text-lg font-bold text-amber-600">
                      -{r.starsSpent}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
