import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History as HistoryIcon,
  Trash2,
  CheckCircle2,
  BookOpen,
  Play,
  ArrowRight,
  ArrowLeft,
  ChevronsLeft,
  Plus,
  Inbox,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useSessionStore } from '@/store/useSessionStore';
import { useUserStore } from '@/store/useUserStore';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

function formatFullTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return formatFullTime(ts);
}

export default function HistoryPage() {
  const navigate = useNavigate();
  const allEntries = useHistoryStore((s) => s.entries);
  const removeEntry = useHistoryStore((s) => s.removeEntry);
  const clearByUser = useHistoryStore((s) => s.clearByUser);
  const clearGuest = useHistoryStore((s) => s.clearGuest);
  const restoreSession = useSessionStore((s) => s.restoreSession);
  const currentUser = useUserStore((s) => s.currentUser);
  // 按当前用户过滤（游客模式只看 userId=null 的，登录后只看自己的）
  const entries = allEntries.filter((e) =>
    currentUser ? e.userId === currentUser.id : e.userId === null,
  );
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);

  const totalPages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);

  const pageEntries = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return entries.slice(start, start + PAGE_SIZE);
  }, [entries, currentPage]);

  const handleRestore = (entryId: string) => {
    const entry = entries.find((e) => e.id === entryId);
    if (!entry) return;
    restoreSession(entry.session);
    if (entry.practiceDone) {
      navigate('/done');
    } else if (entry.learnedDone) {
      navigate('/practice');
    } else {
      navigate('/scene-result');
    }
  };

  const handleRemove = (id: string) => {
    removeEntry(id);
    // 如果删除后当前页变空，回退一页
    const remaining = entries.length - 1;
    const newTotalPages = Math.max(1, Math.ceil(remaining / PAGE_SIZE));
    if (currentPage > newTotalPages) {
      setPage(newTotalPages);
    }
  };

  const handleClearAll = () => {
    // 只清空当前用户（或游客）的记录，不影响其他用户
    if (currentUser) {
      clearByUser(currentUser.id);
    } else {
      clearGuest();
    }
    setPage(1);
    setConfirmClear(false);
  };

  // 分页器：显示页码 + 当页数 > 3 时显示"第一页"快捷
  const pageNumbers = useMemo(() => {
    const pages: (number | '...')[] = [];
    const showPages = 5;
    if (totalPages <= showPages) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      if (start > 2) pages.push('...');
      for (let i = start; i <= end; i++) pages.push(i);
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  }, [currentPage, totalPages]);

  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        {/* 标题 */}
        <div className="mb-6 animate-fade-up">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-sage-soft text-primary">
                <HistoryIcon className="h-6 w-6" />
              </span>
              <div>
                <h1 className="font-display text-2xl font-bold sm:text-3xl">学习历史</h1>
                <p className="text-sm text-muted-foreground">
                  共 {entries.length} 条记录 · 每页 {PAGE_SIZE} 条
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => navigate('/')} className="h-9">
                <Plus className="h-4 w-4" />
                新场景
              </Button>
              {entries.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setConfirmClear(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  清空
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* 空状态 */}
        {entries.length === 0 ? (
          <Card className="animate-fade-up">
            <CardContent className="flex flex-col items-center gap-4 py-16 text-center">
              <span className="grid h-20 w-20 place-items-center rounded-3xl bg-peach-soft text-4xl">
                <Inbox className="h-10 w-10 text-muted-foreground" />
              </span>
              <div>
                <h2 className="font-display text-xl font-bold">还没有学习记录</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  生成第一个场景后，这里会自动记录你的学习进度
                </p>
              </div>
              <Button size="lg" onClick={() => navigate('/')}>
                去生成一个场景
                <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 列表 */}
            <div className="space-y-3">
              {pageEntries.map((entry, idx) => {
                const progressLabel = entry.practiceDone
                  ? '已完成演练'
                  : entry.learnedDone
                    ? '已学完，待演练'
                    : '未完成学习';
                const progressPercent = entry.practiceDone ? 100 : entry.learnedDone ? 50 : 0;
                return (
                  <div
                    key={entry.id}
                    className="group flex items-center gap-3 sm:gap-4 rounded-2xl border border-border bg-card p-3 sm:p-4 shadow-soft transition-all hover:border-primary/30 hover:shadow-soft-lg animate-fade-up"
                    style={{ animationDelay: `${Math.min(idx * 0.03, 0.3)}s` }}
                  >
                    <button
                      onClick={() => handleRestore(entry.id)}
                      className="flex flex-1 items-center gap-4 text-left"
                    >
                      <span
                        className={cn(
                          'grid h-10 w-10 sm:h-12 sm:w-12 shrink-0 place-items-center rounded-2xl',
                          entry.practiceDone
                            ? 'bg-sage-soft text-primary'
                            : entry.learnedDone
                              ? 'bg-amber-100 text-amber-600'
                              : 'bg-peach-soft text-accent-foreground',
                        )}
                      >
                        {entry.practiceDone ? (
                          <CheckCircle2 className="h-6 w-6" />
                        ) : entry.learnedDone ? (
                          <BookOpen className="h-6 w-6" />
                        ) : (
                          <Play className="h-6 w-6" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate font-display text-base sm:text-lg font-bold">{entry.sceneNameZh}</h3>
                          <Badge variant="muted" className="shrink-0 text-[10px] sm:text-xs">
                            {entry.source === 'route' ? '路线' : entry.source === 'example' ? '推荐' : '自定义'}
                          </Badge>
                          <Badge variant="muted" className="shrink-0 text-[10px] sm:text-xs">
                            {entry.difficulty === 'easy' ? '简单' : entry.difficulty === 'medium' ? '难度' : '复杂'}
                          </Badge>
                        </div>
                        <p className="truncate text-sm text-primary/70">{entry.sceneNameEn}</p>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">{formatFullTime(entry.createdAt)}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(entry.createdAt)}</span>
                        </div>
                        {/* 学习进度条 */}
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 max-w-[120px] sm:w-32 sm:max-w-none overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                entry.practiceDone ? 'bg-primary' : entry.learnedDone ? 'bg-amber-500' : 'bg-muted-foreground/30',
                              )}
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <span
                            className={cn(
                              'text-xs font-semibold',
                              entry.practiceDone ? 'text-primary' : entry.learnedDone ? 'text-amber-600' : 'text-muted-foreground',
                            )}
                          >
                            {progressLabel}
                          </span>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => handleRemove(entry.id)}
                      aria-label="删除记录"
                      className="shrink-0 rounded-lg p-2 text-muted-foreground/50 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* 分页器 */}
            {totalPages > 1 && (
              <div className="mt-8 flex flex-col items-center gap-3">
                <div className="flex items-center gap-1.5">
                  {/* 上一页 */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    disabled={currentPage === 1}
                    onClick={() => setPage(currentPage - 1)}
                    aria-label="上一页"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>

                  {/* 第一页快捷按钮：当当前页 > 3 时显示 */}
                  {currentPage > 3 && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-1 px-3"
                      onClick={() => setPage(1)}
                      title="回到第一页"
                    >
                      <ChevronsLeft className="h-4 w-4" />
                      第一页
                    </Button>
                  )}

                  {/* 页码 */}
                  {pageNumbers.map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === currentPage ? 'default' : 'outline'}
                        size="sm"
                        className="h-9 w-9 p-0 font-semibold"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ),
                  )}

                  {/* 下一页 */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 w-9 p-0"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage(currentPage + 1)}
                    aria-label="下一页"
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  第 {currentPage} / {totalPages} 页 · 共 {entries.length} 条
                </p>
              </div>
            )}
          </>
        )}

        {/* 清空确认弹层 */}
        {confirmClear && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
            onClick={() => setConfirmClear(false)}
          >
            <Card
              className="max-w-sm border-destructive/30 shadow-soft-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-4 sm:p-6">
                <div className="mb-4 flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                    <Trash2 className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-display text-lg font-bold">清空全部历史记录？</h3>
                    <p className="text-sm text-muted-foreground">此操作不可撤销</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmClear(false)}
                  >
                    取消
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleClearAll}
                  >
                    确认清空
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}
