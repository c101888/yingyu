import { useState, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Home,
} from 'lucide-react';
import { PageShell } from '@/components/PageShell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpeakButton } from '@/components/SpeakButton';
import { RepeatButton } from '@/components/RepeatButton';
import { Quiz } from '@/components/Quiz';
import { useSessionStore } from '@/store/useSessionStore';
import { cn } from '@/lib/utils';

export default function Learn() {
  const navigate = useNavigate();
  const session = useSessionStore((s) => s.session);
  const markLearnedDone = useSessionStore((s) => s.markLearnedDone);
  const [readWords, setReadWords] = useState<Set<string>>(new Set());
  const [readSentences, setReadSentences] = useState<Set<number>>(new Set());
  const [quizDone, setQuizDone] = useState(false);
  const [quizScore, setQuizScore] = useState<{ score: number; total: number } | null>(null);
  const [quizCount, setQuizCount] = useState<number>(0);
  const handleQuestionsReady = useCallback((count: number) => setQuizCount(count), []);

  if (!session) {
    return <MissingSession />;
  }

  const { content } = session;
  const difficulty = session.difficulty || 'easy';
  // 防御：确保数组字段存在
  const vocab = Array.isArray(content.vocab) ? content.vocab : [];
  const coreSentences = Array.isArray(content.coreSentences) ? content.coreSentences : [];

  // 按难度决定展示的句子数量：简单4句 / 难度6句 / 复杂全部
  const sentenceShowCount = difficulty === 'easy' ? 4 : difficulty === 'medium' ? 6 : coreSentences.length;
  const shownSentences = coreSentences.slice(0, sentenceShowCount);

  // 测验题数提示（实际题数由 Quiz 组件回调给出，0 时回退到难度上限）
  const quizCountHint = quizCount > 0 ? quizCount : (difficulty === 'easy' ? 8 : difficulty === 'medium' ? 12 : 16);
  const diffLabel = difficulty === 'easy' ? '简单' : difficulty === 'medium' ? '难度' : '复杂';

  const markReadWord = (word: string) => {
    setReadWords((prev) => new Set(prev).add(word));
  };
  const markReadSentence = (i: number) => {
    setReadSentences((prev) => new Set(prev).add(i));
  };

  const vocabDone = vocab.length > 0 && readWords.size >= vocab.length;
  const sentenceDone = coreSentences.length > 0 ? readSentences.size >= 1 : true;
  const allRead = vocabDone && sentenceDone;
  const canFinish = allRead && quizDone;

  const handleFinish = () => {
    markLearnedDone();
    navigate('/practice');
  };

  return (
    <PageShell step={2}>
      <div className="mx-auto max-w-3xl">
        {/* 标题 */}
        <div className="mb-6 text-center animate-fade-up">
          <Badge variant="peach" className="mb-3 gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            最小学习 · 轻松几步就学会
          </Badge>
          <h1 className="font-display text-3xl font-bold sm:text-4xl">{content.sceneNameZh}</h1>
          <p className="mt-2 text-muted-foreground">
            先听懂、再跟读，最后做一个小任务。家长可以陪孩子一起完成。
          </p>
        </div>

        {/* 步骤1：词汇听与跟读 */}
        <LearnSection step={1} title="听一听，读一读这些词" delay={0.08}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {vocab.map((v) => {
              const done = readWords.has(v.word);
              return (
                <div
                  key={v.word}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border-2 p-4 transition-colors',
                    done ? 'border-primary/40 bg-sage-soft/40' : 'border-border bg-card',
                  )}
                >
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-peach-soft to-sage-soft text-xl">
                    🔤
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold">{v.word}</span>
                      {done && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-xs text-muted-foreground">{v.ipa}</span>
                    <p className="text-sm font-medium text-primary">{v.meaningZh}</p>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <SpeakButton
                      text={v.word}
                      variant="soft"
                      size="sm"
                      label="听"
                      className="h-10 px-3"
                    />
                    <RepeatButton
                      text={v.word}
                      size="sm"
                      variant={done ? 'ghost' : 'outline'}
                      className="h-10 px-3"
                      onScored={() => markReadWord(v.word)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </LearnSection>

        {/* 步骤2：核心句子听与跟读 */}
        <LearnSection step={2} title="听一听，读一读这些句子" delay={0.14}>
          <div className="space-y-3">
            {shownSentences.map((s, i) => {
              const done = readSentences.has(i);
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center gap-3 rounded-2xl border-2 p-4 transition-colors',
                    done ? 'border-primary/40 bg-sage-soft/40' : 'border-border bg-card',
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-sage-soft text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-display text-sm sm:text-base font-bold">{s.en}</p>
                      {done && <CheckCircle2 className="h-4 w-4 text-primary" />}
                    </div>
                    <p className="text-sm text-muted-foreground">{s.zh}</p>
                  </div>
                  <div className="flex gap-1.5">
                    <SpeakButton text={s.en} variant="soft" size="icon" className="h-10 w-10" />
                    <RepeatButton
                      text={s.en}
                      size="icon"
                      variant={done ? 'ghost' : 'outline'}
                      className="h-10 w-10"
                      onScored={() => markReadSentence(i)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </LearnSection>

        {/* 步骤3：小任务（多题多题型测验） */}
        <LearnSection step={3} title="小测验：检验学习成果" delay={0.2}>
          {quizDone && quizScore ? (
            <div className="mb-3 flex items-center gap-2 rounded-2xl bg-sage-soft/40 p-3 text-sm">
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
              <span>
                测验完成！答对 <b className="text-primary">{quizScore.score}</b> / {quizScore.total} 题
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-8"
                onClick={() => { setQuizDone(false); setQuizScore(null); }}
              >
                重做测验
              </Button>
            </div>
          ) : (
            <p className="mb-3 text-sm text-muted-foreground">
              当前难度「{diffLabel}」共约 {quizCountHint} 题，4 种题型：听词选义、听句选义、看中文选英文词、看中文选英文句
            </p>
          )}
          {!quizDone && (
            <Quiz
              content={content}
              difficulty={difficulty}
              onQuestionsReady={handleQuestionsReady}
              onComplete={(score, total) => {
                setQuizScore({ score, total });
                setQuizDone(true);
              }}
            />
          )}
        </LearnSection>

        {/* 完成进入演练 */}
        <div className="mt-8 flex flex-col items-center gap-3 animate-fade-up" style={{ animationDelay: '0.26s' }}>
          <p className="text-sm text-muted-foreground">
            {canFinish
              ? '太棒了！准备好和孩子一起演练了吗？'
              : '完成听读和小任务后，就可以进入演练了'}
          </p>
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={() => navigate('/scene-result')}>
              返回内容
            </Button>
            <Button size="lg" onClick={handleFinish} disabled={!canFinish} className="sm:min-w-[180px]">
              进入角色演练
              <ArrowRight />
            </Button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function LearnSection({
  step,
  title,
  delay,
  children,
}: {
  step: number;
  title: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 animate-fade-up" style={{ animationDelay: `${delay}s` }}>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground shadow-soft">
          {step}
        </span>
        <h2 className="font-display text-xl font-bold">{title}</h2>
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
