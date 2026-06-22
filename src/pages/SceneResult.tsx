import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  RefreshCw,
  BookOpen,
  MessageCircle,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  Loader2,
  ArrowRight,
  Volume2,
  AlertCircle,
  Play,
  Square,
  Wand2,
  Crown,
  RotateCcw,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SceneIllustration, getSceneEmoji } from '@/components/SceneIllustration';
import { SpeakButton } from '@/components/SpeakButton';
import { useSessionStore } from '@/store/useSessionStore';
import { useUserStore } from '@/store/useUserStore';
import { generateSceneContent, enrichSceneContent } from '@/lib/llm';
import type { EnrichMode } from '@/lib/llm';
import { speak, stopSpeaking } from '@/lib/voice';
import { cn } from '@/lib/utils';
import type { Mastery } from '@/lib/types';

const MASTERY_OPTIONS: Array<{
  value: Exclude<Mastery, null>;
  label: string;
  desc: string;
  icon: typeof CheckCircle2;
  next: 'learn' | 'practice';
}> = [
  {
    value: 'need-learn',
    label: '孩子需要先学',
    desc: '从词汇和句子开始，先听懂再说',
    icon: BookOpen,
    next: 'learn',
  },
  {
    value: 'known',
    label: '孩子已经会了',
    desc: '直接进入角色演练，开口说出来',
    icon: CheckCircle2,
    next: 'practice',
  },
  {
    value: 'unsure',
    label: '不太确定',
    desc: '先简单学一下，再去演练更踏实',
    icon: HelpCircle,
    next: 'learn',
  },
];

export default function SceneResult() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const session = useSessionStore((s) => s.session);
  const createSession = useSessionStore((s) => s.createSession);
  const setMastery = useSessionStore((s) => s.setMastery);
  const setContent = useSessionStore((s) => s.setContent);
  const [regenerating, setRegenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);

  // 丰富对话细节（Pro 专属功能）
  const currentUser = useUserStore((s) => s.currentUser);
  const isPro = currentUser?.tier === 'pro';
  const [showEnrichDialog, setShowEnrichDialog] = useState(false);
  const [enrichHint, setEnrichHint] = useState('');
  const [enriching, setEnriching] = useState(false);
  const [enrichError, setEnrichError] = useState<string | null>(null);

  // 学习互动追踪
  const [listenedWords, setListenedWords] = useState<Set<string>>(new Set());
  const [listenedSentences, setListenedSentences] = useState<Set<number>>(new Set());
  const [seqPlaying, setSeqPlaying] = useState<'vocab' | 'sentences' | null>(null);
  const [currentSeqIdx, setCurrentSeqIdx] = useState(-1);
  const cancelRef = useRef(false);

  const fromRoute = params.get('from') === 'route';
  const routeScene = params.get('scene') || '';

  // 从每日路线进入：生成对应场景内容
  useEffect(() => {
    if (fromRoute && routeScene && (!session || session.sceneInput !== routeScene)) {
      setLoading(true);
      setLoadError(null);
      // 路线场景默认用 easy 难度（路线节点不带难度）
      generateSceneContent(routeScene, 'easy')
        .then((content) => {
          createSession({ sceneInput: routeScene, source: 'route', content, difficulty: 'easy' });
        })
        .catch((err) => {
          setLoadError(err instanceof Error ? err.message : '生成失败');
        })
        .finally(() => setLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromRoute, routeScene]);

  // 组件卸载时停止语音
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      stopSpeaking();
    };
  }, []);

  // 顺序播放：依次朗读词汇或句子
  const playSequence = useCallback(async (
    type: 'vocab' | 'sentences',
    items: Array<{ text: string; key: string | number }>,
  ) => {
    if (seqPlaying === type) {
      // 正在播放则停止
      cancelRef.current = true;
      stopSpeaking();
      setSeqPlaying(null);
      setCurrentSeqIdx(-1);
      return;
    }
    cancelRef.current = false;
    setSeqPlaying(type);
    for (let i = 0; i < items.length; i++) {
      if (cancelRef.current) break;
      setCurrentSeqIdx(i);
      const item = items[i];
      await new Promise<void>((resolve) => {
        let resolved = false;
        const done = () => {
          if (!resolved) {
            resolved = true;
            resolve();
          }
        };
        speak(item.text, {
          rate: 0.85,
          onend: done,
          onerror: done,
        });
        // 兜底超时（防止 onend 不触发）
        setTimeout(done, 5000);
      });
      // 标记已听
      if (!cancelRef.current) {
        if (type === 'vocab') {
          setListenedWords((prev) => new Set(prev).add(String(item.key)));
        } else {
          setListenedSentences((prev) => new Set(prev).add(Number(item.key)));
        }
      }
    }
    if (!cancelRef.current) {
      setCurrentSeqIdx(-1);
      setSeqPlaying(null);
    }
  }, [seqPlaying]);

  // 路线生成失败
  if (loadError && !session) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 py-24 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-destructive/10 text-4xl">
            😢
          </span>
          <h2 className="font-display text-2xl font-bold">生成失败了</h2>
          <p className="text-muted-foreground">{loadError}</p>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => navigate('/')}>返回首页</Button>
            <Button onClick={() => window.location.reload()}>重试</Button>
          </div>
        </div>
      </PageShell>
    );
  }

  // 会话缺失且非路线加载中
  if (!session && !loading) {
    return <MissingSession />;
  }

  if (loading || !session) {
    return (
      <PageShell>
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-24 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-lg font-semibold">正在生成「{routeScene}」的英语内容…</p>
          <p className="text-sm text-muted-foreground">AI 正在把生活场景变成孩子能学的英语</p>
        </div>
      </PageShell>
    );
  }

  const { content } = session;
  const vocab = Array.isArray(content.vocab) ? content.vocab : [];
  const coreSentences = Array.isArray(content.coreSentences) ? content.coreSentences : [];
  const dialogue = Array.isArray(content.dialogue) ? content.dialogue : [];

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      // 重新生成时沿用当前会话的难度
      const newContent = await generateSceneContent(session.sceneInput, session.difficulty || 'easy');
      setContent(newContent);
      // 重置互动追踪
      setListenedWords(new Set());
      setListenedSentences(new Set());
    } catch (err) {
      setRegenError(err instanceof Error ? err.message : '重新生成失败，请再试一次');
    } finally {
      setRegenerating(false);
    }
  };

  const handleChoose = (option: (typeof MASTERY_OPTIONS)[number]) => {
    setMastery(option.value);
    navigate(option.next === 'learn' ? '/learn' : '/practice');
  };

  // 丰富对话细节：Pro 权限校验 + 调用 LLM 重新生成
  const handleOpenEnrich = () => {
    if (!isPro) {
      setEnrichError('「丰富对话细节」是 Pro 专属功能，升级 Pro 后即可自由调整对话场景与细节。');
      setShowEnrichDialog(true);
      return;
    }
    setEnrichError(null);
    setShowEnrichDialog(true);
  };

  const handleEnrich = async (mode: EnrichMode) => {
    const hint = enrichHint.trim();
    if (!hint) {
      setEnrichError('请输入想要补充或调整的细节说明');
      return;
    }
    setEnriching(true);
    setEnrichError(null);
    try {
      const newContent = await enrichSceneContent(
        session.sceneInput,
        session.difficulty || 'easy',
        content,
        hint,
        mode,
      );
      setContent(newContent);
      setShowEnrichDialog(false);
      setEnrichHint('');
      // 重置互动追踪
      setListenedWords(new Set());
      setListenedSentences(new Set());
    } catch (err) {
      setEnrichError(err instanceof Error ? err.message : '丰富对话细节失败，请再试一次');
    } finally {
      setEnriching(false);
    }
  };

  const handleMarkWordListened = (word: string) => {
    setListenedWords((prev) => new Set(prev).add(word));
  };
  const handleMarkSentenceListened = (i: number) => {
    setListenedSentences((prev) => new Set(prev).add(i));
  };

  // 互动进度
  const vocabProgress = vocab.length > 0 ? listenedWords.size / vocab.length : 0;
  const sentenceProgress = coreSentences.length > 0 ? listenedSentences.size / coreSentences.length : 0;
  const overallProgress = (vocabProgress + sentenceProgress) / 2;
  const hasEngaged = listenedWords.size > 0 || listenedSentences.size > 0;

  return (
    <PageShell step={1}>
      <div className="mx-auto max-w-3xl">
        {/* 场景标题 */}
        <div className="mb-6 text-center animate-fade-up">
          <Badge variant="sage" className="mb-3 gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            场景已就绪
          </Badge>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{content.sceneNameZh}</h1>
          <p className="mt-1 text-lg font-medium text-primary/80">{content.sceneNameEn}</p>
        </div>

        {/* 场景插画 */}
        <div className="animate-fade-up" style={{ animationDelay: '0.06s' }}>
          <SceneIllustration
            key={content.sceneNameEn}
            sceneNameEn={content.sceneNameEn}
            sceneNameZh={content.sceneNameZh}
            emoji={getSceneEmoji(content.sceneNameEn, content.sceneNameZh)}
            size="lg"
          />
        </div>

        {/* 学习引导 */}
        <div className="mt-6 animate-fade-up" style={{ animationDelay: '0.08s' }}>
          <Card className="border-primary/20 bg-sage-soft/20">
            <CardContent className="flex items-start gap-3 p-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-peach-soft text-lg">
                💡
              </span>
              <div className="flex-1 text-sm">
                <p className="font-semibold text-foreground">先浏览一遍，再决定怎么学</p>
                <p className="mt-0.5 text-muted-foreground">
                  点「听」让孩子先听一遍发音，或点「顺序播放」连续听完。浏览后选择下方适合孩子的学习方式。
                </p>
                {hasEngaged && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary transition-all duration-500"
                        style={{ width: `${overallProgress * 100}%` }}
                      />
                    </div>
                    <span className="text-xs font-semibold text-primary">
                      已浏览 {Math.round(overallProgress * 100)}%
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 核心词汇 */}
        <Section
          title="核心词汇"
          icon="🔤"
          delay={0.1}
          progress={vocab.length > 0 ? `${listenedWords.size}/${vocab.length} 已听` : null}
          action={
            vocab.length > 0 && (
              <Button
                variant={seqPlaying === 'vocab' ? 'default' : 'soft'}
                size="sm"
                className="h-8"
                onClick={() =>
                  playSequence(
                    'vocab',
                    vocab.map((v) => ({ text: v.word, key: v.word })),
                  )
                }
              >
                {seqPlaying === 'vocab' ? (
                  <><Square className="h-3 w-3" /> 停止</>
                ) : (
                  <><Play className="h-3 w-3" /> 顺序播放</>
                )}
              </Button>
            )
          }
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {vocab.map((v, i) => {
              const listened = listenedWords.has(v.word);
              const isCurrent = seqPlaying === 'vocab' && currentSeqIdx === i;
              return (
                <div
                  key={v.word}
                  className={cn(
                    'flex flex-col gap-1 rounded-2xl border p-4 text-center shadow-soft transition-all',
                    isCurrent
                      ? 'border-primary bg-sage-soft/50 ring-2 ring-primary/30'
                      : listened
                        ? 'border-primary/30 bg-sage-soft/20'
                        : 'border-border bg-card',
                  )}
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="font-display text-lg font-bold text-foreground">{v.word}</span>
                    {listened && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  {v.ipa && <span className="text-xs text-muted-foreground">{v.ipa}</span>}
                  <span className="text-sm font-medium text-primary">{v.meaningZh}</span>
                  <SpeakButton
                    text={v.word}
                    variant="ghost"
                    size="sm"
                    label="听"
                    className="mt-1 h-8"
                    onSpeak={() => handleMarkWordListened(v.word)}
                  />
                </div>
              );
            })}
          </div>
        </Section>

        {/* 核心句子 */}
        <Section
          title="核心句子"
          icon="💬"
          delay={0.14}
          progress={coreSentences.length > 0 ? `${listenedSentences.size}/${coreSentences.length} 已听` : null}
          action={
            coreSentences.length > 0 && (
              <Button
                variant={seqPlaying === 'sentences' ? 'default' : 'soft'}
                size="sm"
                className="h-8"
                onClick={() =>
                  playSequence(
                    'sentences',
                    coreSentences.map((s, i) => ({ text: s.en, key: i })),
                  )
                }
              >
                {seqPlaying === 'sentences' ? (
                  <><Square className="h-3 w-3" /> 停止</>
                ) : (
                  <><Play className="h-3 w-3" /> 顺序播放</>
                )}
              </Button>
            )
          }
        >
          <div className="space-y-2.5">
            {coreSentences.map((s, i) => {
              const listened = listenedSentences.has(i);
              const isCurrent = seqPlaying === 'sentences' && currentSeqIdx === i;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border p-4 shadow-soft transition-all',
                    isCurrent
                      ? 'border-primary bg-sage-soft/50 ring-2 ring-primary/30'
                      : listened
                        ? 'border-primary/30 bg-sage-soft/20'
                        : 'border-border bg-card',
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sage-soft text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-base font-bold text-foreground">{s.en}</p>
                      {listened && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{s.zh}</p>
                  </div>
                  <SpeakButton
                    text={s.en}
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onSpeak={() => handleMarkSentenceListened(i)}
                  />
                </div>
              );
            })}
          </div>
        </Section>

        {/* 对话预览（带音频） */}
        <Section
          title="对话预览"
          icon="🎭"
          delay={0.18}
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={handleOpenEnrich}
              disabled={enriching}
              title={isPro ? '丰富或调整对话细节' : 'Pro 专属功能'}
            >
              {enriching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : isPro ? (
                <Wand2 className="h-3.5 w-3.5" />
              ) : (
                <Crown className="h-3.5 w-3.5 text-amber-500" />
              )}
              丰富对话细节
            </Button>
          }
        >
          <div className="space-y-3">
            {dialogue.map((d) => (
              <div key={d.round} className="space-y-1.5 rounded-2xl border border-border bg-card p-3 shadow-soft">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 shrink-0 rounded-full bg-peach-soft px-2 py-0.5 text-xs font-bold text-accent-foreground">
                    家长
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{d.parent}</p>
                    <p className="text-xs text-muted-foreground">{d.parentZh}</p>
                  </div>
                  <SpeakButton text={d.parent} variant="ghost" size="icon" className="shrink-0 h-8 w-8" />
                </div>
                <div className="flex items-start gap-2 pl-6">
                  <span className="mt-0.5 shrink-0 rounded-full bg-sage-soft px-2 py-0.5 text-xs font-bold text-primary">
                    孩子
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{d.child}</p>
                    <p className="text-xs text-muted-foreground">{d.childZh}</p>
                  </div>
                  <SpeakButton text={d.child} variant="ghost" size="icon" className="shrink-0 h-8 w-8" />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* 掌握判断 */}
        <div className="mt-10 animate-fade-up" style={{ animationDelay: '0.22s' }}>
          <Card className="border-primary/20 bg-card/80 shadow-soft-lg">
            <CardContent className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-xl font-bold">孩子对这些内容熟悉吗？</h2>
                  <p className="text-sm text-muted-foreground">
                    {hasEngaged
                      ? '根据刚才的浏览，选一个适合的下一步'
                      : '先浏览上方内容，或直接选一个开始'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="shrink-0"
                >
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  重新生成
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {MASTERY_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const active = session.mastery === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleChoose(opt)}
                      className={`group flex flex-col gap-2 rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-soft ${
                        active
                          ? 'border-primary bg-sage-soft/50'
                          : 'border-border bg-card hover:border-primary/40'
                      }`}
                    >
                      <Icon className={`h-6 w-6 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="font-display font-bold">{opt.label}</span>
                      <span className="text-xs text-muted-foreground">{opt.desc}</span>
                      <span className="mt-1 flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        {opt.next === 'learn' ? '去学习' : '去演练'}
                        <ArrowRight className="h-3 w-3" />
                      </span>
                    </button>
                  );
                })}
              </div>
              {regenError && (
                <div className="mt-3 flex items-start gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{regenError}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 快捷入口 */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center animate-fade-up" style={{ animationDelay: '0.26s' }}>
          <Button variant="outline" size="lg" onClick={() => navigate('/learn')}>
            <BookOpen />
            开始最小学习
          </Button>
          <Button variant="accent" size="lg" onClick={() => navigate('/practice')}>
            <MessageCircle />
            直接角色演练
          </Button>
        </div>

        {/* 丰富对话细节弹窗 */}
        {showEnrichDialog && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
            onClick={() => !enriching && setShowEnrichDialog(false)}
          >
            <Card
              className="w-full max-w-md animate-fade-up border-border bg-card shadow-soft-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <CardContent className="p-5 max-h-[85vh] overflow-y-auto">
                <div className="mb-3 flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary">
                    {isPro ? <Wand2 className="h-4 w-4" /> : <Crown className="h-4 w-4 text-amber-500" />}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-display text-lg font-bold">丰富对话细节</h3>
                    <p className="text-xs text-muted-foreground">
                      {isPro
                        ? '告诉 AI 你想增加或调整哪些细节，重新生成对话'
                        : 'Pro 专属功能 · 升级后可自由调节对话场景与细节'}
                    </p>
                  </div>
                  {!isPro && (
                    <Badge variant="outline" className="gap-1 border-amber-400 text-amber-600">
                      <Crown className="h-3 w-3" /> Pro
                    </Badge>
                  )}
                </div>

                {isPro ? (
                  <>
                    <textarea
                      value={enrichHint}
                      onChange={(e) => setEnrichHint(e.target.value)}
                      placeholder="例如：增加点餐时孩子犹豫不决的细节；把对话场景改在咖啡厅；让家长多鼓励孩子开口…"
                      maxLength={300}
                      rows={4}
                      className="w-full resize-none rounded-xl border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                      disabled={enriching}
                    />
                    <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>支持增/减细节、调整场景、改变语气等</span>
                      <span>{enrichHint.length}/300</span>
                    </div>
                    {enrichError && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                        <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{enrichError}</span>
                      </div>
                    )}
                    {/* 两种模式说明 */}
                    <div className="mt-3 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">两种生成方式：</p>
                      <p className="mt-1">· <span className="font-medium text-primary">丰富当前对话</span>：保留原对话，在其上增加新轮次和细节</p>
                      <p>· <span className="font-medium text-primary">重新生成</span>：完全重新生成全部对话</p>
                    </div>
                    <div className="mt-3 flex flex-col gap-2">
                      <Button
                        className="gap-1.5"
                        onClick={() => handleEnrich('enrich')}
                        disabled={enriching || !enrichHint.trim()}
                      >
                        {enriching ? (
                          <><Loader2 className="h-4 w-4 animate-spin" /> 生成中…</>
                        ) : (
                          <><Wand2 className="h-4 w-4" /> 丰富当前对话（推荐）</>
                        )}
                      </Button>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => {
                            setShowEnrichDialog(false);
                            setEnrichHint('');
                            setEnrichError(null);
                          }}
                          disabled={enriching}
                        >
                          取消
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1 gap-1.5"
                          onClick={() => handleEnrich('regenerate')}
                          disabled={enriching || !enrichHint.trim()}
                        >
                          {enriching ? (
                            <><Loader2 className="h-4 w-4 animate-spin" /></>
                          ) : (
                            <><RotateCcw className="h-4 w-4" /> 重新生成</>
                          )}
                        </Button>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {enrichError && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-700">
                        <Crown className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{enrichError}</span>
                      </div>
                    )}
                    <div className="rounded-xl border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                      <p className="font-medium text-foreground">Pro 会员可享受：</p>
                      <ul className="mt-1.5 space-y-1 text-xs">
                        <li>· 自定义增减对话细节，让场景更贴合孩子</li>
                        <li>· 调整对话场景、语气、角色情绪</li>
                        <li>· 场景生成 150 次/月 + 每日路线 5 条</li>
                      </ul>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => {
                          setShowEnrichDialog(false);
                          setEnrichError(null);
                        }}
                      >
                        稍后再说
                      </Button>
                      <Button
                        className="flex-1 gap-1.5 bg-amber-500 hover:bg-amber-600"
                        onClick={() => {
                          setShowEnrichDialog(false);
                          setEnrichError(null);
                          navigate('/upgrade');
                        }}
                      >
                        <Crown className="h-4 w-4" /> 了解 Pro
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function Section({
  title,
  icon,
  delay,
  progress,
  action,
  children,
}: {
  title: string;
  icon: string;
  delay: number;
  progress?: string | null;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-xl">{icon}</span>
        <h2 className="font-display text-xl font-bold">{title}</h2>
        {progress && (
          <span className="text-xs font-medium text-primary">{progress}</span>
        )}
        {action && <div className="ml-auto">{action}</div>}
      </div>
      {children}
    </section>
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
        <p className="text-muted-foreground">
          会话已失效，请回到首页选择或输入一个生活场景，重新开始今天的学习。
        </p>
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
