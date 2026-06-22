import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  CheckCircle2,
  Home,
  RotateCcw,
  CalendarClock,
  Sparkles,
  BookOpen,
  MessageCircle,
  Heart,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getSceneEmoji } from '@/components/SceneIllustration';
import { useSessionStore } from '@/store/useSessionStore';
import { useUserStore } from '@/store/useUserStore';
import { usePointsStore } from '@/store/usePointsStore';
import { getLevelByStars, getNextLevel } from '@/lib/levels';

export default function Done() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const resetPractice = useSessionStore((s) => s.resetPractice);
  const clearSession = useSessionStore((s) => s.clearSession);
  const currentUser = useUserStore((s) => s.currentUser);
  const award = usePointsStore((s) => s.award);
  const hasAwarded = usePointsStore((s) => s.hasAwarded);
  const userRecords = usePointsStore((s) => s.records);
  // 本次获得的星数（null 表示未发放/已领过/游客）
  const [earnedStars, setEarnedStars] = useState<number | null>(null);

  // 进入完成页时发放积分（仅登录用户、完成闭环、未领过）
  useEffect(() => {
    if (!session || !currentUser) return;
    // 必须完成学习 + 演练
    if (!session.learnedDone || !session.practiceDone) return;
    // 已领过则不再发放
    if (hasAwarded(session.id)) return;
    const stars = award({
      userId: currentUser.id,
      sessionId: session.id,
      sceneNameZh: session.content.sceneNameZh,
      difficulty: session.difficulty || 'easy',
    });
    if (stars > 0) {
      setEarnedStars(stars);
    }
  }, [session, currentUser, award, hasAwarded]);

  // 当前用户的总星数和等级（用于显示升级提示）
  const totalStars = currentUser
    ? userRecords
        .filter((r) => r.userId === currentUser.id)
        .reduce((sum, r) => sum + r.stars, 0)
    : 0;
  const currentLevel = getLevelByStars(totalStars);
  const nextLevel = getNextLevel(currentLevel.level);

  if (!session) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-24 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-peach-soft text-4xl">
            🤔
          </span>
          <h2 className="font-display text-2xl font-bold">还没有学习记录</h2>
          <p className="text-muted-foreground">会话已失效，请回到首页重新开始。</p>
          <Button asChild size="lg">
            <Link to="/">
              <Home className="h-4 w-4" />
              返回场景首页
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }

  const { content, learnedDone, practiceDone } = session;
  const difficulty = session.difficulty || 'easy';
  // 防御：确保数组字段存在
  const coreSentences = Array.isArray(content.coreSentences) ? content.coreSentences : [];
  const dialogueLen = Array.isArray(content.dialogue) ? content.dialogue.length : 0;
  // 按难度决定展示的句子数量（与学习页一致）
  const sentenceShowCount = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : coreSentences.length;
  const shownSentences = coreSentences.slice(0, sentenceShowCount);
  // 测验检验的句子数（与 quiz.ts 一致）
  const quizSentenceCount = difficulty === 'easy' ? 2 : difficulty === 'medium' ? 3 : 4;
  const diffLabel = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '难度' : '复杂';

  const handlePracticeAgain = () => {
    resetPractice();
    navigate('/practice');
  };

  const handleHome = () => {
    clearSession();
    navigate('/');
  };

  return (
    <PageShell step={4} showHome={false}>
      <div className="mx-auto max-w-2xl">
        {/* 完成庆祝 */}
        <div className="text-center animate-pop-in">
          <div className="relative mx-auto mb-5 h-20 w-20 sm:h-28 sm:w-28">
            <div className="absolute inset-0 animate-pulse-ring rounded-full bg-primary/20" />
            <div className="absolute inset-2 animate-bounce-soft rounded-full bg-gradient-to-br from-sage-soft to-peach-soft" />
            <div className="absolute inset-0 grid place-items-center text-4xl sm:text-6xl">🎉</div>
          </div>
          <Badge variant="sage" className="mb-3 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            今日完成
          </Badge>
          <h1 className="font-display text-2xl font-bold sm:text-4xl">今天的学习完成啦！</h1>
          <p className="mx-auto mt-3 max-w-md text-muted-foreground text-balance">
            孩子已经学过、练过「{content.sceneNameZh}」，接下来可以在真实生活里用起来。
          </p>
        </div>

        {/* 今日场景 */}
        <Card className="mt-8 overflow-hidden border-primary/20 animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">今日场景</p>
                <h2 className="font-display text-xl font-bold sm:text-2xl">{content.sceneNameZh}</h2>
                <p className="font-medium text-primary/80">{content.sceneNameEn}</p>
              </div>
              <span className="text-4xl sm:text-5xl">{getSceneEmoji(content.sceneNameEn, content.sceneNameZh)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 积分获得提示（仅登录用户、本次新获得时显示） */}
        {earnedStars !== null && currentUser && (
          <Card className="mt-4 overflow-hidden border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 animate-pop-in">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-3xl">
                  ⭐
                </span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display text-lg font-bold text-amber-700">
                      获得 {earnedStars} 颗星！
                    </h3>
                    <Badge variant="muted" className="bg-amber-100 text-amber-700">
                      {diffLabel}场景
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm text-amber-600/80">
                    累计 {totalStars}⭐ · 当前 Lv.{currentLevel.level} {currentLevel.title} {currentLevel.badge}
                    {nextLevel && ` · 距离下一级还需 ${nextLevel.minStars - totalStars}⭐`}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-amber-300 text-amber-700 hover:bg-amber-100"
                  onClick={() => navigate('/profile')}
                >
                  查看
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 游客模式提示（游客完成闭环但无法获得积分） */}
        {!currentUser && (
          <Card className="mt-4 border-peach/30 bg-peach-soft/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-2xl">💡</span>
                <p className="flex-1 text-muted-foreground">
                  登录后完成学习可获得星数和等级勋章，还能保存学习记录。
                </p>
                <Button variant="outline" size="sm" onClick={() => navigate('/')}>
                  去登录
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 完成状态 */}
        <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3 animate-fade-up" style={{ animationDelay: '0.14s' }}>
          <StatusCard
            icon={BookOpen}
            title="已学习"
            desc="听过词汇和句子"
            done={learnedDone}
          />
          <StatusCard
            icon={MessageCircle}
            title="已练习"
            desc={`完成 ${dialogueLen} 轮对话演练`}
            done={practiceDone}
          />
          <StatusCard
            icon={Heart}
            title="待使用"
            desc="在生活中用一次"
            done={false}
            pending
          />
        </div>

        {/* 复习与迁移提示 */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 animate-fade-up" style={{ animationDelay: '0.18s' }}>
          <Card className="border-peach/30 bg-peach-soft/30">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-accent-foreground" />
                <h3 className="font-display font-bold">明天复习一次</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                次日和孩子再过一遍这几句，巩固记忆。不用重新生成，直接「再练一次」即可。
              </p>
            </CardContent>
          </Card>
          <Card className="border-sage/30 bg-sage-soft/30">
            <CardContent className="p-4 sm:p-5">
              <div className="mb-2 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-display font-bold">七天后用到生活里</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                一周后，当孩子再遇到「{content.sceneNameZh}」时，试着用英语聊两句。把学过的真正用出来。
              </p>
            </CardContent>
          </Card>
        </div>

        {/* 学过的句子回顾 */}
        <Card className="mt-6 animate-fade-up" style={{ animationDelay: '0.22s' }}>
          <CardContent className="p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-display font-bold">今天学过的句子</h3>
              <Badge variant="muted" className="text-[10px] sm:text-xs">
                {diffLabel} · {shownSentences.length} 句
              </Badge>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              共学习 {shownSentences.length} 句，其中测验检验了 {Math.min(quizSentenceCount, shownSentences.length)} 句
            </p>
            <div className="space-y-2">
              {shownSentences.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                  <span className="font-medium text-foreground">{s.en}</span>
                  <span className="text-muted-foreground">— {s.zh}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* 操作按钮 */}
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row animate-fade-up" style={{ animationDelay: '0.26s' }}>
          <Button variant="outline" size="lg" onClick={handleHome} className="w-full sm:w-auto sm:min-w-[160px]">
            <Home className="h-4 w-4" />
            返回首页
          </Button>
          <Button size="lg" onClick={handlePracticeAgain} className="w-full sm:w-auto sm:min-w-[180px]">
            <RotateCcw className="h-4 w-4" />
            再练一次
          </Button>
        </div>
      </div>
    </PageShell>
  );
}

function StatusCard({
  icon: Icon,
  title,
  desc,
  done,
  pending,
}: {
  icon: typeof BookOpen;
  title: string;
  desc: string;
  done: boolean;
  pending?: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-2xl border-2 p-4 transition-colors ${
        done
          ? 'border-primary/40 bg-sage-soft/40'
          : pending
            ? 'border-peach/40 bg-peach-soft/30'
            : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl ${
            done ? 'bg-primary text-primary-foreground' : 'bg-peach-soft text-accent-foreground'
          }`}
        >
          {done ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
        </span>
        <span className="font-display font-bold">{title}</span>
      </div>
      <p className="text-xs text-muted-foreground">{desc}</p>
    </div>
  );
}
