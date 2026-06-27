import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Save,
  Check,
  ArrowRight,
  RotateCcw,
  Clock,
  Plus,
  Pencil,
  Trash2,
  X,
  GripVertical,
  Route as RouteIcon,
  Crown,
  Settings2,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useRouteStore } from '@/store/useRouteStore';
import { useTierStore } from '@/store/useTierStore';
import { useUserStore } from '@/store/useUserStore';
import { DEFAULT_ROUTE_NODES } from '@/lib/examples';
import { TIER_CONFIGS, getTierName } from '@/lib/tiers';
import type { RouteNode } from '@/lib/types';
import { cn } from '@/lib/utils';

// 可选 emoji
const NODE_EMOJIS = ['⏰', '🪥', '🍳', '👕', '🎒', '🏫', '😴', '🥞', '🧸', '🌳', '🍪', '🛁', '📖', '🚗', '🛒', '🍽️', '🎮', '🏃', '🌙', '⭐'];
const ROUTE_ICONS = ['🎒', '🌳', '⭐', '🌙', '🚗', '🏠', '🎉', '📚'];

function makeNodeId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function emptyNode(): RouteNode {
  return {
    id: makeNodeId(),
    nameZh: '',
    nameEn: '',
    desc: '',
    time: '08:00',
    emoji: '⭐',
  };
}

export default function DailyRoute() {
  const navigate = useNavigate();
  const routes = useRouteStore((s) => s.routes);
  const activeRouteId = useRouteStore((s) => s.activeRouteId);
  const setActiveRoute = useRouteStore((s) => s.setActiveRoute);
  const resetRoute = useRouteStore((s) => s.resetRoute);
  const addRoute = useRouteStore((s) => s.addRoute);
  const updateRouteMeta = useRouteStore((s) => s.updateRouteMeta);
  const updateRouteNodes = useRouteStore((s) => s.updateRouteNodes);
  const deleteRoute = useRouteStore((s) => s.deleteRoute);

  const currentUser = useUserStore((s) => s.currentUser);
  const tierInfo = useTierStore();

  const activeRoute = routes.find((r) => r.id === activeRouteId) || routes[0];

  const [editMode, setEditMode] = useState(false);
  // 每个节点的难度选择（按节点索引存储），默认 easy
  const [nodeDifficulty, setNodeDifficulty] = useState<Record<number, 'easy' | 'medium' | 'hard'>>({});
  const [editingNodes, setEditingNodes] = useState<RouteNode[]>([]);
  const [saved, setSaved] = useState(false);
  // 路线元信息编辑
  const [showMetaEditor, setShowMetaEditor] = useState(false);
  const [metaName, setMetaName] = useState('');
  const [metaIcon, setMetaIcon] = useState('⭐');
  // 新建路线
  const [showCreator, setShowCreator] = useState(false);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState('⭐');

  // 进入编辑模式时，复制当前节点
  useEffect(() => {
    if (editMode && activeRoute) {
      setEditingNodes(activeRoute.nodes.map((n) => ({ ...n })));
    }
  }, [editMode, activeRouteId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 路线数量限制
  const maxRoutes = currentUser ? tierInfo.maxRoutes : TIER_CONFIGS.free.maxRoutes;
  const canCreateRoute = currentUser
    ? routes.length < maxRoutes
    : false; // 游客不可新建
  const canEditRoute = currentUser
    ? tierInfo.tier !== 'free'
    : false; // 免费用户不可编辑

  if (!activeRoute) {
    return (
      <PageShell>
        <div className="mx-auto max-w-md py-20 text-center">
          <p className="text-muted-foreground">暂无路线</p>
          <Button className="mt-4" onClick={() => navigate('/')}>返回首页</Button>
        </div>
      </PageShell>
    );
  }

  const handleSaveNodes = () => {
    const cleaned = editingNodes
      .filter((n) => n.nameZh.trim())
      .map((n) => ({ ...n, nameZh: n.nameZh.trim(), nameEn: n.nameEn.trim(), desc: n.desc.trim() }));
    if (cleaned.length === 0) {
      alert('至少保留一个节点');
      return;
    }
    updateRouteNodes(activeRoute.id, cleaned);
    setEditMode(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditingNodes([]);
  };

  const handleResetActive = () => {
    if (!activeRoute.isPreset) return;
    if (confirm(`恢复「${activeRoute.name}」为默认节点？当前修改将丢失。`)) {
      resetRoute();
    }
  };

  const handleAddNode = () => {
    setEditingNodes([...editingNodes, emptyNode()]);
  };

  const handleRemoveNode = (idx: number) => {
    setEditingNodes(editingNodes.filter((_, i) => i !== idx));
  };

  const handleNodeChange = (idx: number, patch: Partial<RouteNode>) => {
    setEditingNodes(editingNodes.map((n, i) => (i === idx ? { ...n, ...patch } : n)));
  };

  const handleMoveNode = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= editingNodes.length) return;
    const next = [...editingNodes];
    [next[idx], next[target]] = [next[target], next[idx]];
    setEditingNodes(next);
  };

  const handleOpenMetaEditor = () => {
    setMetaName(activeRoute.name);
    setMetaIcon(activeRoute.icon);
    setShowMetaEditor(true);
  };

  const handleSaveMeta = () => {
    if (!metaName.trim()) {
      alert('路线名称不能为空');
      return;
    }
    updateRouteMeta(activeRoute.id, { name: metaName.trim(), icon: metaIcon });
    setShowMetaEditor(false);
  };

  const handleCreateRoute = () => {
    if (!newName.trim()) {
      alert('请输入路线名称');
      return;
    }
    addRoute(newName.trim(), newIcon, [DEFAULT_ROUTE_NODES[0]]);
    setShowCreator(false);
    setNewName('');
    setNewIcon('⭐');
    setEditMode(true);
  };

  const handleDeleteRoute = () => {
    if (activeRoute.isPreset) return;
    if (confirm(`删除路线「${activeRoute.name}」？此操作不可撤销。`)) {
      deleteRoute(activeRoute.id);
    }
  };

  const startFromNode = (node: RouteNode, difficulty: 'easy' | 'medium' | 'hard' = 'easy') => {
    if (!editMode) {
      // 非编辑模式才跳转生成，带上难度参数
      navigate(`/scene-result?from=route&scene=${encodeURIComponent(node.nameZh)}&difficulty=${difficulty}`);
    }
  };

  return (
    <PageShell>
      <div className="mx-auto max-w-3xl">
        {/* 标题 */}
        <div className="mb-6 text-center animate-fade-up">
          <Badge variant="peach" className="mb-3 gap-1.5">
            <RouteIcon className="h-3.5 w-3.5" />
            每日路线
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-4xl">把英语嵌入孩子的一天</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            每个生活节点都是一个英语表达机会。围绕孩子的一天安排学习场景，让英语自然发生在生活里。
          </p>
        </div>

        {/* 路线切换 + 新建 */}
        <div className="mb-6 animate-fade-up" style={{ animationDelay: '0.06s' }}>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              我的路线（{routes.length}/{maxRoutes}）
            </span>
            <div className="flex items-center gap-2">
              {canCreateRoute ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCreator(true)}
                  disabled={routes.length >= maxRoutes}
                  className="gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建路线
                </Button>
              ) : !currentUser ? (
                <Button size="sm" variant="outline" onClick={() => navigate('/')} className="gap-1">
                  <Crown className="h-3.5 w-3.5" />
                  登录后解锁
                </Button>
              ) : (
                <Button size="sm" variant="outline" onClick={() => navigate('/upgrade')} className="gap-1">
                  <Crown className="h-3.5 w-3.5" />
                  升级解锁更多路线
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {routes.map((r) => {
              const active = r.id === activeRouteId;
              return (
                <button
                  key={r.id}
                  onClick={() => {
                    setActiveRoute(r.id);
                    setEditMode(false);
                  }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-all',
                    active
                      ? 'border-primary bg-primary text-primary-foreground shadow-soft'
                      : 'border-border bg-card text-foreground hover:border-primary/40',
                  )}
                >
                  <span>{r.icon}</span>
                  <span>{r.name}</span>
                  <span className="text-[10px] sm:text-xs opacity-70">{r.nodes.length}</span>
                  {r.isPreset && (
                    <span className="rounded-full bg-secondary/60 px-1.5 py-0.5 text-[9px] sm:text-[10px]">预置</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 当前路线信息 + 操作 */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="flex items-center gap-2">
            <span className="text-2xl">{activeRoute.icon}</span>
            <div>
              <h2 className="font-display text-xl font-bold">{activeRoute.name}</h2>
              <p className="text-xs text-muted-foreground">
                {activeRoute.isPreset ? '预置路线 · ' : '自建路线 · '}
                {activeRoute.nodes.length} 个节点
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!canEditRoute && currentUser && (
              <Badge variant="muted" className="gap-1 text-[10px] sm:text-xs">
                <Crown className="h-3 w-3" />
                升级后可编辑
              </Badge>
            )}
            {canEditRoute && !editMode && (
              <>
                <Button size="sm" variant="outline" onClick={handleOpenMetaEditor} className="gap-1">
                  <Settings2 className="h-3.5 w-3.5" />
                  路线信息
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditMode(true)} className="gap-1">
                  <Pencil className="h-3.5 w-3.5" />
                  编辑节点
                </Button>
                {!activeRoute.isPreset && (
                  <Button size="sm" variant="outline" onClick={handleDeleteRoute} className="gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                    删除
                  </Button>
                )}
              </>
            )}
            {canEditRoute && editMode && (
              <>
                <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                  取消
                </Button>
                <Button size="sm" onClick={handleSaveNodes} className="gap-1">
                  {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  {saved ? '已保存' : '保存节点'}
                </Button>
              </>
            )}
            {activeRoute.isPreset && !editMode && (
              <Button size="sm" variant="ghost" onClick={handleResetActive} className="gap-1">
                <RotateCcw className="h-3.5 w-3.5" />
                恢复默认
              </Button>
            )}
          </div>
        </div>

        {/* 时间轴 / 编辑模式 */}
        {!editMode ? (
          <div className="relative animate-fade-up" style={{ animationDelay: '0.12s' }}>
            {/* 竖线 */}
            <div className="absolute left-[23px] top-4 bottom-4 w-0.5 bg-gradient-to-b from-peach via-sage to-primary/40 sm:left-[31px]" />
            <div className="space-y-4">
              {activeRoute.nodes.map((node, i) => (
                <div
                  key={node.id}
                  className="relative flex gap-4 animate-fade-up"
                  style={{ animationDelay: `${0.14 + i * 0.05}s` }}
                >
                  <div className="relative z-10 shrink-0">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border-2 border-border bg-card text-xl sm:text-2xl shadow-soft sm:h-16 sm:w-16">
                      {node.emoji}
                    </div>
                  </div>
                  <Card className="flex-1 transition-all hover:shadow-soft-lg">
                    <CardContent className="flex flex-col gap-3 p-4 sm:p-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-display text-lg font-bold">{node.nameZh}</h3>
                          {node.nameEn && (
                            <span className="text-sm font-medium text-primary/80">{node.nameEn}</span>
                          )}
                          <Badge variant="muted" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {node.time}
                          </Badge>
                        </div>
                        {node.desc && (
                          <p className="mt-1 text-sm text-muted-foreground">{node.desc}</p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 shrink-0 sm:flex-row sm:items-center">
                        {/* 难度选择：手机端紧凑三按钮，平板/桌面端带标签 */}
                        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5">
                          {(['easy', 'medium', 'hard'] as const).map((d) => (
                            <button
                              key={d}
                              onClick={() => setNodeDifficulty((prev) => ({ ...prev, [i]: d }))}
                              className={cn(
                                'rounded-md px-2 py-1 text-xs font-semibold transition-colors',
                                (nodeDifficulty[i] || 'easy') === d
                                  ? 'bg-primary text-primary-foreground shadow-soft'
                                  : 'text-muted-foreground hover:text-foreground',
                              )}
                            >
                              {d === 'easy' ? '简单' : d === 'medium' ? '中等' : '复杂'}
                            </button>
                          ))}
                        </div>
                        <Button
                          variant="soft"
                          size="sm"
                          className="shrink-0"
                          onClick={() => startFromNode(node, nodeDifficulty[i] || 'easy')}
                        >
                          学这个
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* 编辑模式 */
          <div className="space-y-3 animate-fade-up">
            {editingNodes.map((node, i) => (
              <Card key={node.id}>
                <CardContent className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col items-center gap-1 pt-2">
                      <button
                        onClick={() => handleMoveNode(i, -1)}
                        disabled={i === 0}
                        className="rounded p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                        title="上移"
                      >
                        <GripVertical className="h-3.5 w-3.5 rotate-180" />
                      </button>
                      <button
                        onClick={() => handleMoveNode(i, 1)}
                        disabled={i === editingNodes.length - 1}
                        className="rounded p-0.5 text-muted-foreground hover:bg-secondary disabled:opacity-30"
                        title="下移"
                      >
                        <GripVertical className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
                        <select
                          value={node.emoji}
                          onChange={(e) => handleNodeChange(i, { emoji: e.target.value })}
                          className="rounded-lg border border-border bg-card px-2 py-1.5 text-lg"
                        >
                          {NODE_EMOJIS.map((em) => (
                            <option key={em} value={em}>{em}</option>
                          ))}
                        </select>
                        <input
                          value={node.nameZh}
                          onChange={(e) => handleNodeChange(i, { nameZh: e.target.value })}
                          placeholder="中文名（如：起床）"
                          className="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
                        />
                        <input
                          value={node.time}
                          onChange={(e) => handleNodeChange(i, { time: e.target.value })}
                          placeholder="07:00"
                          className="w-20 rounded-lg border border-border bg-card px-2 py-1.5 text-sm outline-none focus:border-primary"
                        />
                        <button
                          onClick={() => handleRemoveNode(i)}
                          className="rounded-lg p-1.5 text-destructive hover:bg-destructive/10"
                          title="删除节点"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <input
                        value={node.nameEn}
                        onChange={(e) => handleNodeChange(i, { nameEn: e.target.value })}
                        placeholder="英文名（如：Waking Up）"
                        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
                      />
                      <input
                        value={node.desc}
                        onChange={(e) => handleNodeChange(i, { desc: e.target.value })}
                        placeholder="描述（如：叫醒孩子，开启新的一天）"
                        className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-sm outline-none focus:border-primary"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Button variant="outline" onClick={handleAddNode} className="w-full gap-1 border-dashed">
              <Plus className="h-4 w-4" />
              添加节点
            </Button>
          </div>
        )}

        {/* 底部操作 */}
        <div className="mt-6 sm:mt-8 flex justify-center gap-3 animate-fade-up" style={{ animationDelay: '0.4s' }}>
          <Button variant="outline" onClick={() => navigate('/')}>
            返回首页
          </Button>
        </div>

        {/* 权益提示 */}
        {currentUser && tierInfo.tier === 'free' && (
          <Card className="mt-6 border-peach/30 bg-peach-soft/20">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-3">
                <Crown className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">免费版仅可查看预置路线</p>
                  <p className="text-xs text-muted-foreground">
                    升级 Plus 可编辑路线节点 + 新建最多 {TIER_CONFIGS.plus.maxRoutes} 条路线；Pro 支持最多 {TIER_CONFIGS.pro.maxRoutes} 条
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => navigate('/upgrade')}>
                  升级
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* 路线信息编辑弹窗 */}
      {showMetaEditor && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowMetaEditor(false)}
        >
          <Card className="max-w-md w-full shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">编辑路线信息</h3>
                <button onClick={() => setShowMetaEditor(false)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">路线图标</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ROUTE_ICONS.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setMetaIcon(ic)}
                        className={cn(
                          'grid h-10 w-10 place-items-center rounded-lg text-xl transition-all',
                          metaIcon === ic ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary hover:bg-secondary/70',
                        )}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">路线名称</p>
                  <input
                    value={metaName}
                    onChange={(e) => setMetaName(e.target.value)}
                    maxLength={12}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                    placeholder="如：放学后、假期、外出日"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowMetaEditor(false)}>
                    取消
                  </Button>
                  <Button className="flex-1" onClick={handleSaveMeta}>
                    保存
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 新建路线弹窗 */}
      {showCreator && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
          onClick={() => setShowCreator(false)}
        >
          <Card className="max-w-md w-full shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-display text-lg font-bold">新建路线</h3>
                <button onClick={() => setShowCreator(false)} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                当前方案 {getTierName(tierInfo.tier)} · 可创建路线 {routes.length}/{maxRoutes}
              </p>
              <div className="space-y-4">
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">路线图标</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ROUTE_ICONS.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setNewIcon(ic)}
                        className={cn(
                          'grid h-10 w-10 place-items-center rounded-lg text-xl transition-all',
                          newIcon === ic ? 'bg-primary/20 ring-2 ring-primary' : 'bg-secondary hover:bg-secondary/70',
                        )}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">路线名称</p>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={12}
                    className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                    placeholder="如：放学后、假期、外出日"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCreator(false)}>
                    取消
                  </Button>
                  <Button className="flex-1" onClick={handleCreateRoute}>
                    创建并编辑
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </PageShell>
  );
}
