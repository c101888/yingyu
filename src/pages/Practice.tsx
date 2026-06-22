import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Volume2,
  Mic,
  ArrowRight,
  PartyPopper,
  RotateCcw,
  Play,
  BookOpen,
  Target,
  Lightbulb,
  Sparkles,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SpeakButton } from '@/components/SpeakButton';
import { useSessionStore } from '@/store/useSessionStore';
import { speak, stopSpeaking } from '@/lib/voice';
import { cn } from '@/lib/utils';

export default function Practice() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const setPracticeRound = useSessionStore((s) => s.setPracticeRound);
  const markPracticeDone = useSessionStore((s) => s.markPracticeDone);
  const resetPractice = useSessionStore((s) => s.resetPractice);
  const [round, setRound] = useState(session?.practiceRound ?? 0);
  const [childSpoken, setChildSpoken] = useState(false);
  const [playingDemo, setPlayingDemo] = useState(false);
  const [spokenCount, setSpokenCount] = useState(0); // 累计跟读次数

  useEffect(() => {
    return () => stopSpeaking();
  }, []);

  const content = session?.content;
  const dialogue = Array.isArray(content?.dialogue) ? content!.dialogue : [];
  const vocab = Array.isArray(content?.vocab) ? content!.vocab : [];
  const total = dialogue.length;
  const current = dialogue[round];

  // 从当前对话中提取关键词汇，作为本轮重点提示（必须在条件 return 之前调用）
  const roundKeywords = useMemo(() => {
    if (!current) return [];
    const words = new Set<string>();
    const parentWords = (current.parent || '').toLowerCase().match(/[a-z]+/g) || [];
    const childWords = (current.child || '').toLowerCase().match(/[a-z]+/g) || [];
    [...parentWords, ...childWords].forEach((w) => words.add(w));
    return vocab.filter((v) => words.has(String(v.word || '').toLowerCase()));
  }, [current, vocab]);

  if (!session) {
    return <MissingSession />;
  }

  // 对话为空或轮次越界时提示重新生成，避免访问 undefined 字段白屏
  if (total === 0 || !current) {
    return (
      <PageShell step={3}>
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-24 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-peach-soft text-4xl">
            🤔
          </span>
          <h2 className="font-display text-2xl font-bold">对话内容不完整</h2>
          <p className="text-muted-foreground">当前场景没有可演练的对话，请返回重新生成。</p>
          <Button asChild size="lg">
            <Link to="/scene-result">
              <Volume2 className="h-4 w-4" />
              返回场景内容
            </Link>
          </Button>
        </div>
      </PageShell>
    );
  }
  const isLast = round >= total - 1;
  const progress = ((round + (childSpoken ? 1 : 0)) / total) * 100;

  const playDemo = () => {
    // 依次播放家长台词 + 孩子回应
    setPlayingDemo(true);
    speak(current.parent, {
      rate: 0.9,
      onend: () => {
        speak(current.child, {
          rate: 0.9,
          onend: () => setPlayingDemo(false),
          onerror: () => setPlayingDemo(false),
        });
      },
      onerror: () => setPlayingDemo(false),
    });
  };

  const handleChildRead = () => {
    speak(current.child, { rate: 0.85, onend: () => {
      setChildSpoken(true);
      setSpokenCount((c) => c + 1);
    }, onerror: () => {
      setChildSpoken(true);
      setSpokenCount((c) => c + 1);
    } });
  };

  const handleNext = () => {
    if (isLast) {
      markPracticeDone();
      navigate('/done');
    } else {
      const next = round + 1;
      setRound(next);
      setPracticeRound(next);
      setChildSpoken(false);
    }
  };

  const handleRestart = () => {
    resetPractice();
    setRound(0);
    setChildSpoken(false);
    setSpokenCount(0);
  };

  return (
    <PageShell step={3}>
      <div className="mx-auto max-w-3xl">
        {/* 标题 + 进度 */}
        <div className="mb-6 text-center animate-fade-up">
          <Badge variant="peach" className="mb-3 gap-1.5">
            <Play className="h-3.5 w-3.5" />
            角色演练 · 大声说出来
          </Badge>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{content.sceneNameZh}</h1>
          <p className="mt-2 text-muted-foreground">
            家长说家长的，孩子说孩子的。不用完美，敢说、能跟上就很棒！
          </p>
        </div>

        {/* 演练进度条 */}
        <div className="mb-6 animate-fade-up" style={{ animationDelay: '0.04s' }}>
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>演练进度</span>
            <span>{round + 1} / {total} 轮 · 跟读 {spokenCount} 次</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 演练准备：重点词汇速览 */}
        {round === 0 && vocab.length > 0 && (
          <Card className="mb-6 border-primary/15 bg-sage-soft/20 animate-fade-up" style={{ animationDelay: '0.08s' }}>
            <CardContent className="p-5">
              <div className="mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                <span className="font-display text-sm font-bold">演练前速览：本场景重点词汇</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {vocab.map((v) => (
                  <div
                    key={v.word}
                    className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5"
                  >
                    <SpeakButton text={v.word} variant="ghost" size="icon" className="h-6 w-6 p-0" />
                    <span className="font-display text-sm font-bold">{v.word}</span>
                    <span className="text-xs text-muted-foreground">{v.meaningZh}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                💡 先听一遍这些词，演练时会更有信心
              </p>
            </CardContent>
          </Card>
        )}

        {/* 本轮重点提示 */}
        {roundKeywords.length > 0 && (
          <div className="mb-4 flex items-center gap-2 rounded-2xl bg-peach-soft/30 px-4 py-2.5 text-sm animate-fade-up" style={{ animationDelay: '0.1s' }}>
            <Target className="h-4 w-4 shrink-0 text-accent-foreground/70" />
            <span className="text-muted-foreground">本轮重点：</span>
            {roundKeywords.map((v, i) => (
              <span key={v.word} className="font-display font-bold text-foreground">
                {v.word}{i < roundKeywords.length - 1 ? ' ·' : ''}
              </span>
            ))}
          </div>
        )}

        {/* 对话舞台 */}
        <Card className="overflow-hidden border-primary/20 shadow-soft-lg animate-fade-up" style={{ animationDelay: '0.12s' }}>
          <CardContent className="p-4 sm:p-6 sm:p-8">
            {/* 轮次标记 */}
            <div className="mb-4 flex items-center justify-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {round + 1}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">第 {round + 1} 轮对话</span>
            </div>

            {/* 家长台词 */}
            <div className="flex justify-start animate-fade-up">
              <div className="flex max-w-[85%] items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach-soft text-2xl shadow-soft">
                  👩
                </span>
                <div className="rounded-3xl rounded-tl-md border border-border bg-card px-3 py-2 sm:px-5 sm:py-3 shadow-soft">
                  <span className="mb-1 block text-xs font-bold text-accent-foreground/70">家长 Parent</span>
                  <p className="font-display text-base sm:text-lg font-bold text-foreground">{current.parent}</p>
                  <p className="text-sm text-muted-foreground">{current.parentZh}</p>
                  <SpeakButton text={current.parent} variant="ghost" size="sm" label="听家长" className="mt-2 h-8" />
                </div>
              </div>
            </div>

            {/* 孩子回应 */}
            <div className="mt-4 flex justify-end animate-fade-up" style={{ animationDelay: '0.15s' }}>
              <div className="flex max-w-[85%] items-start gap-3">
                <div
                  className={cn(
                    'rounded-3xl rounded-tr-md border-2 px-3 py-2 sm:px-5 sm:py-3 shadow-soft transition-colors',
                    childSpoken
                      ? 'border-primary/40 bg-sage-soft/40'
                      : 'border-primary bg-primary/5',
                  )}
                >
                  <span className="mb-1 block text-right text-xs font-bold text-primary/70">孩子 Child</span>
                  <p className="text-right font-display text-base sm:text-lg font-bold text-foreground">{current.child}</p>
                  <p className="text-right text-sm text-muted-foreground">{current.childZh}</p>
                  <div className="mt-2 flex justify-end gap-1.5">
                    <SpeakButton text={current.child} variant="soft" size="sm" label="听示范" className="h-8" />
                    <Button
                      variant={childSpoken ? 'ghost' : 'default'}
                      size="sm"
                      className="h-8"
                      onClick={handleChildRead}
                    >
                      <Mic className="h-3.5 w-3.5" />
                      {childSpoken ? '再说一次' : '跟读'}
                    </Button>
                  </div>
                </div>
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-sage-soft text-2xl shadow-soft">
                  🧒
                </span>
              </div>
            </div>

            {/* 整轮示范 */}
            <div className="mt-6 flex justify-center animate-fade-up" style={{ animationDelay: '0.2s' }}>
              <Button variant="outline" onClick={playDemo} disabled={playingDemo} className="gap-2">
                <Volume2 className={cn(playingDemo && 'animate-pulse')} />
                {playingDemo ? '正在播放整轮示范…' : '播放整轮示范'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 操作栏 */}
        <div className="mt-6 flex flex-col items-center gap-3 animate-fade-up" style={{ animationDelay: '0.24s' }}>
          <p className="text-sm text-muted-foreground">
            {childSpoken ? '说得不错！继续下一轮吧' : '让孩子试着跟读这句，然后进入下一轮'}
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="ghost" onClick={() => navigate('/learn')}>
              <BookOpen className="h-4 w-4" />
              返回最小学习
            </Button>
            <Button variant="ghost" onClick={handleRestart}>
              <RotateCcw className="h-4 w-4" />
              重新开始
            </Button>
            <Button
              size="lg"
              onClick={handleNext}
              className="sm:min-w-[180px]"
            >
              {isLast ? (
                <>
                  <PartyPopper />
                  完成演练
                </>
              ) : (
                <>
                  下一轮
                  <ArrowRight />
                </>
              )}
            </Button>
          </div>
        </div>

        {/* 学习小贴士 */}
        <div className="mt-8 flex items-start gap-3 rounded-2xl border border-primary/15 bg-sage-soft/20 p-4 text-sm animate-fade-up" style={{ animationDelay: '0.28s' }}>
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div>
            <p className="font-display font-bold text-foreground">小贴士</p>
            <ul className="mt-1 space-y-1 text-muted-foreground">
              <li>· 孩子跟读时不必追求完美发音，敢开口就是进步</li>
              <li>· 可以多播放几遍整轮示范，让孩子熟悉节奏</li>
              <li>· 家长也可以用夸张的语气说家长台词，增加趣味</li>
            </ul>
          </div>
        </div>

        {/* 完成预览 */}
        {isLast && (
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-primary animate-fade-up" style={{ animationDelay: '0.3s' }}>
            <Sparkles className="h-4 w-4" />
            <span>完成本轮后，将解锁今日学习成就！</span>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function MissingSession() {
  return (
    <PageShell>
      <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-24 text-center">
        <span className="grid h-20 w-20 place-items-center rounded-3xl bg-peach-soft text-4xl">
          🤔
        </span>
        <h2 className="font-display text-2xl font-bold">还没有学习内容</h2>
        <p className="text-muted-foreground">会话已失效，请回到首页重新开始。</p>
        <Button asChild size="lg">
          <Link to="/">
            <Volume2 className="h-4 w-4" />
            返回场景首页
          </Link>
        </Button>
      </div>
    </PageShell>
  );
}
