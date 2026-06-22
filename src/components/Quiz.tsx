import { useState, useMemo, useCallback } from 'react';
import { Check, X, Repeat, ChevronRight, Headphones, Eye, Type, ArrowLeftRight, PencilLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SpeakButton } from '@/components/SpeakButton';
import { cn } from '@/lib/utils';
import { generateQuiz, QUIZ_TYPE_LABELS } from '@/lib/quiz';
import type { SceneContent, Difficulty } from '@/lib/types';

interface QuizProps {
  content: SceneContent;
  difficulty?: Difficulty;
  onComplete: (score: number, total: number) => void;
  onQuestionsReady?: (count: number) => void;
}

export function Quiz({ content, difficulty = 'easy', onComplete, onQuestionsReady }: QuizProps) {
  const questions = useMemo(() => {
    const qs = generateQuiz(content, difficulty);
    // 通知父组件实际题数
    if (onQuestionsReady) onQuestionsReady(qs.length);
    return qs;
  }, [content, difficulty, onQuestionsReady]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({}); // questionId -> optionId
  const [showResult, setShowResult] = useState<Record<string, boolean>>({}); // questionId -> 是否已作答
  const [playedAudios, setPlayedAudios] = useState<Set<string>>(new Set()); // 已播放的听题
  const [finished, setFinished] = useState(false);

  const current = questions[currentIdx];
  const total = questions.length;
  const correctCount = useMemo(() => {
    return questions.filter((q) => answers[q.id] === q.correctId).length;
  }, [questions, answers]);

  const handleAnswer = useCallback((questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    setShowResult((prev) => ({ ...prev, [questionId]: true }));
  }, []);

  const handleNext = useCallback(() => {
    if (currentIdx < total - 1) {
      setCurrentIdx((i) => i + 1);
    } else {
      setFinished(true);
      onComplete(correctCount, total);
    }
  }, [currentIdx, total, correctCount, onComplete]);

  const handleRestart = useCallback(() => {
    setAnswers({});
    setShowResult({});
    setPlayedAudios(new Set());
    setFinished(false);
    setCurrentIdx(0);
  }, []);

  const handleMarkPlayed = useCallback((qid: string) => {
    setPlayedAudios((prev) => new Set(prev).add(qid));
  }, []);

  if (total === 0) {
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6 text-center text-muted-foreground">
          没有可测验的内容
        </CardContent>
      </Card>
    );
  }

  // 完成页：显示得分
  if (finished) {
    const percentage = Math.round((correctCount / total) * 100);
    const isGood = percentage >= 60;
    return (
      <Card className="border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <span className={cn(
              'grid h-20 w-20 place-items-center rounded-3xl text-4xl',
              isGood ? 'bg-sage-soft' : 'bg-peach-soft',
            )}>
              {isGood ? '🎉' : '💪'}
            </span>
            <div>
              <h3 className="font-display text-2xl font-bold">
                {isGood ? '太棒了！' : '继续加油！'}
              </h3>
              <p className="mt-1 text-muted-foreground">
                答对 <b className="text-primary">{correctCount}</b> / {total} 题，正确率 {percentage}%
              </p>
            </div>
            {/* 得分进度环 */}
            <div className="relative h-24 w-24">
              <svg className="h-full w-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8" className="text-muted" />
                <circle
                  cx="50" cy="50" r="42" fill="none" stroke="currentColor" strokeWidth="8"
                  strokeLinecap="round"
                  className="text-primary transition-all duration-700"
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  strokeDashoffset={`${2 * Math.PI * 42 * (1 - correctCount / total)}`}
                />
              </svg>
              <span className="absolute inset-0 grid place-items-center font-display text-xl font-bold text-primary">
                {percentage}%
              </span>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleRestart}>
                <Repeat className="h-4 w-4" />
                再做一次
              </Button>
              <Button onClick={handleNext}>
                <ChevronRight className="h-4 w-4" />
                完成测验
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const currentAnswer = answers[current.id] || null;
  const currentShowResult = showResult[current.id] || false;
  const userCorrect = currentShowResult && currentAnswer === current.correctId;
  const isListenType = current.type === 'listen_word' || current.type === 'listen_sentence'
    || current.type === 'fill_blank' || current.type === 'listen_pick' || current.type === 'spell_word';
  const hasPlayed = playedAudios.has(current.id);

  // 题型图标
  const TypeIcon = current.type === 'fill_blank' || current.type === 'spell_word'
    ? PencilLine
    : current.type === 'word_order'
      ? ArrowLeftRight
      : current.type === 'listen_pick'
        ? Type
        : isListenType ? Headphones : Eye;

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 sm:p-6">
        {/* 题目进度条 */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted-foreground">
            <span>第 {currentIdx + 1} / {total} 题</span>
            <span>已答对 {correctCount} 题</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
              style={{ width: `${((currentIdx + (currentShowResult ? 1 : 0)) / total) * 100}%` }}
            />
          </div>
        </div>

        {/* 题型标签 */}
        <div className="mb-3 flex items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-peach-soft/50 px-3 py-1 text-xs font-bold text-accent-foreground/80">
            <TypeIcon className="h-3 w-3" />
            {QUIZ_TYPE_LABELS[current.type]}
          </span>
        </div>

        {/* 题目区 */}
        <div className="mb-5">
          {(current.type === 'listen_word' || current.type === 'listen_sentence') && (
            // 听题类型：先听再看词
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-sage-soft/30 p-5">
              <p className="text-sm text-muted-foreground">{current.prompt}</p>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">听到的是：</span>
                {hasPlayed ? (
                  <span className="font-display text-xl font-bold text-primary">
                    {current.displayText}
                  </span>
                ) : (
                  <span className="font-display text-xl font-bold text-muted-foreground/50">❓</span>
                )}
                <SpeakButton
                  text={current.audioText}
                  variant="default"
                  size="sm"
                  label="播放"
                  onSpeak={() => handleMarkPlayed(current.id)}
                />
              </div>
            </div>
          )}

          {(current.type === 'zh_to_en_word' || current.type === 'zh_to_en_sentence') && (
            // 看题类型：显示中文
            <div className="flex flex-col items-center gap-3 rounded-2xl bg-sage-soft/30 p-5">
              <p className="text-sm text-muted-foreground">{current.prompt}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">中文：</span>
                <span className="font-display text-xl font-bold text-foreground">
                  {current.displayZh}
                </span>
              </div>
            </div>
          )}

          {current.type === 'fill_blank' && (
            // 短语填空题：听句子，选缺失的单词
            <FillBlankQuestion
              question={current}
              hasPlayed={hasPlayed}
              onPlayed={() => handleMarkPlayed(current.id)}
              selected={currentAnswer}
              showResult={currentShowResult}
              userCorrect={userCorrect}
              onAnswer={(optId) => handleAnswer(current.id, optId)}
            />
          )}

          {current.type === 'word_order' && (
            // 单词排序题
            <WordOrderQuestion
              question={current}
              showResult={currentShowResult}
              onAnswer={(optId) => handleAnswer(current.id, optId)}
            />
          )}

          {current.type === 'listen_pick' && (
            // 听音选词题
            <ListenPickQuestion
              question={current}
              hasPlayed={hasPlayed}
              onPlayed={() => handleMarkPlayed(current.id)}
              selected={currentAnswer}
              showResult={currentShowResult}
              userCorrect={userCorrect}
              onAnswer={(optId) => handleAnswer(current.id, optId)}
            />
          )}

          {current.type === 'spell_word' && (
            // 字母拼写题
            <SpellWordQuestion
              question={current}
              hasPlayed={hasPlayed}
              onPlayed={() => handleMarkPlayed(current.id)}
              selected={currentAnswer}
              showResult={currentShowResult}
              onAnswer={(optId) => handleAnswer(current.id, optId)}
            />
          )}
        </div>

        {/* 选项区（仅选择题类型显示） */}
        {(current.type === 'listen_word' || current.type === 'listen_sentence'
          || current.type === 'zh_to_en_word' || current.type === 'zh_to_en_sentence'
          || current.type === 'listen_pick') && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            {current.options.map((opt) => {
              const selected = currentAnswer === opt.id;
              const correct = opt.isCorrect;
              return (
                <button
                  key={opt.id}
                  disabled={currentShowResult}
                  onClick={() => handleAnswer(current.id, opt.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-2xl border-2 p-4 transition-all',
                    !currentShowResult && 'hover:border-primary/40 hover:bg-sage-soft/30',
                    currentShowResult && userCorrect && correct && 'border-primary bg-sage-soft/50',
                    currentShowResult && !userCorrect && selected && 'border-destructive/40 bg-destructive/5',
                    currentShowResult && !userCorrect && !selected && 'border-border opacity-60',
                    currentShowResult && userCorrect && !correct && 'border-border opacity-60',
                    !currentShowResult && 'border-border bg-card',
                  )}
                >
                  <span className="text-2xl">💡</span>
                  <span className="font-display font-bold text-center">{opt.text}</span>
                  {currentShowResult && userCorrect && correct && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                      <Check className="h-3 w-3" /> 答对了
                    </span>
                  )}
                  {currentShowResult && !userCorrect && selected && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-destructive">
                      <X className="h-3 w-3" /> 选错了
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 作答反馈 + 下一题 */}
        {currentShowResult && (
          <div className={cn(
            'mt-4 flex items-center gap-2 rounded-2xl p-3 text-sm',
            userCorrect ? 'bg-sage-soft/40' : 'bg-destructive/5 text-destructive',
          )}>
            {userCorrect ? (
              <Check className="h-5 w-5 shrink-0 text-primary" />
            ) : (
              <X className="h-5 w-5 shrink-0" />
            )}
            <span>
              {userCorrect ? (
                <>答对了！</>
              ) : (
                <>
                  正确答案是「<b className="text-primary">
                    {current.type === 'fill_blank' && current.blankAnswer}
                    {current.type === 'word_order' && current.wordOrderAnswer}
                    {current.type === 'spell_word' && current.spellFullWord}
                    {(current.type === 'listen_word' || current.type === 'listen_sentence'
                      || current.type === 'zh_to_en_word' || current.type === 'zh_to_en_sentence'
                      || current.type === 'listen_pick') && current.options.find((o) => o.isCorrect)?.text}
                  </b>」
                </>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-8"
              onClick={handleNext}
            >
              {currentIdx < total - 1 ? '下一题' : '查看成绩'}
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ 短语填空题子组件 ============
function FillBlankQuestion({
  question, hasPlayed, onPlayed, selected, showResult, userCorrect, onAnswer,
}: {
  question: import('@/lib/quiz').QuizQuestion;
  hasPlayed: boolean;
  onPlayed: () => void;
  selected: string | null;
  showResult: boolean;
  userCorrect: boolean;
  onAnswer: (optId: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-sage-soft/30 p-5">
      <p className="text-sm text-muted-foreground">{question.prompt}</p>
      <div className="flex items-center gap-3">
        <SpeakButton
          text={question.audioText}
          variant="default"
          size="sm"
          label="播放"
          onSpeak={onPlayed}
        />
      </div>
      {hasPlayed && (
        <div className="text-center">
          <p className="font-display text-lg font-bold text-foreground">
            {question.blankSentence}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{question.displayZh}</p>
          <p className="mt-1 text-xs text-primary">{question.blankHint}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {question.options.map((opt) => {
          const isSelected = selected === opt.id;
          const correct = opt.isCorrect;
          return (
            <button
              key={opt.id}
              disabled={showResult}
              onClick={() => onAnswer(opt.id)}
              className={cn(
                'rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all',
                !showResult && 'hover:border-primary/40 hover:bg-sage-soft/30',
                showResult && userCorrect && correct && 'border-primary bg-sage-soft/50',
                showResult && !userCorrect && isSelected && 'border-destructive/40 bg-destructive/5',
                showResult && !isSelected && 'border-border opacity-60',
                !showResult && 'border-border bg-card',
              )}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ 单词排序题子组件 ============
function WordOrderQuestion({
  question, showResult, onAnswer,
}: {
  question: import('@/lib/quiz').QuizQuestion;
  showResult: boolean;
  onAnswer: (optId: string) => void;
}) {
  const [arranged, setArranged] = useState<string[]>([]);
  const words = question.wordOrderWords || [];

  const handleAdd = (word: string, idx: number) => {
    if (showResult) return;
    if (arranged.includes(word + '_' + idx)) return;
    const newItem = word + '_' + idx;
    const newArranged = [...arranged, newItem];
    setArranged(newArranged);
    // 检查是否完成
    if (newArranged.length === words.length) {
      const userSentence = newArranged.map((w) => w.split('_')[0]).join(' ');
      const isCorrect = userSentence === question.wordOrderAnswer;
      onAnswer(isCorrect ? 'correct' : 'wrong');
    }
  };

  const handleRemove = (item: string) => {
    if (showResult) return;
    setArranged(arranged.filter((a) => a !== item));
  };

  const reset = () => {
    setArranged([]);
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-sage-soft/30 p-5">
      <p className="text-sm text-muted-foreground">{question.prompt}</p>
      <div className="text-center">
        <p className="text-xs text-muted-foreground">中文：</p>
        <p className="font-display text-lg font-bold text-foreground">{question.displayZh}</p>
      </div>

      {/* 已排序区域 */}
      <div className="min-h-[60px] w-full rounded-xl border-2 border-dashed border-border bg-card p-3">
        <div className="flex flex-wrap gap-2">
          {arranged.length === 0 ? (
            <span className="text-sm text-muted-foreground">点击下方单词排列成句</span>
          ) : (
            arranged.map((item) => {
              const word = item.split('_')[0];
              return (
                <button
                  key={item}
                  disabled={showResult}
                  onClick={() => handleRemove(item)}
                  className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
                >
                  {word}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* 待选单词 */}
      <div className="flex flex-wrap justify-center gap-2">
        {words.map((word, idx) => {
          const used = arranged.includes(word + '_' + idx);
          return (
            <button
              key={idx}
              disabled={used || showResult}
              onClick={() => handleAdd(word, idx)}
              className={cn(
                'rounded-lg border-2 px-3 py-1.5 text-sm font-bold transition-all',
                used
                  ? 'border-border bg-muted opacity-40'
                  : 'border-primary/40 bg-card hover:bg-sage-soft/30',
              )}
            >
              {word}
            </button>
          );
        })}
      </div>

      {arranged.length > 0 && !showResult && (
        <Button variant="ghost" size="sm" onClick={reset} className="text-xs">
          重新排列
        </Button>
      )}
    </div>
  );
}

// ============ 听音选词题子组件 ============
function ListenPickQuestion({
  question, hasPlayed, onPlayed, selected, showResult, userCorrect, onAnswer,
}: {
  question: import('@/lib/quiz').QuizQuestion;
  hasPlayed: boolean;
  onPlayed: () => void;
  selected: string | null;
  showResult: boolean;
  userCorrect: boolean;
  onAnswer: (optId: string) => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-sage-soft/30 p-5">
      <p className="text-sm text-muted-foreground">{question.prompt}</p>
      <div className="flex items-center gap-3">
        <SpeakButton
          text={question.audioText}
          variant="default"
          size="sm"
          label="播放"
          onSpeak={onPlayed}
        />
      </div>
      {hasPlayed && (
        <p className="text-xs text-muted-foreground">中文释义：{question.displayZh}</p>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {question.options.map((opt) => {
          const isSelected = selected === opt.id;
          const correct = opt.isCorrect;
          return (
            <button
              key={opt.id}
              disabled={showResult}
              onClick={() => onAnswer(opt.id)}
              className={cn(
                'rounded-xl border-2 px-3 py-2 text-sm font-bold transition-all',
                !showResult && 'hover:border-primary/40 hover:bg-sage-soft/30',
                showResult && userCorrect && correct && 'border-primary bg-sage-soft/50',
                showResult && !userCorrect && isSelected && 'border-destructive/40 bg-destructive/5',
                showResult && !isSelected && 'border-border opacity-60',
                !showResult && 'border-border bg-card',
              )}
            >
              {opt.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============ 字母拼写题子组件 ============
function SpellWordQuestion({
  question, hasPlayed, onPlayed, selected, showResult, onAnswer,
}: {
  question: import('@/lib/quiz').QuizQuestion;
  hasPlayed: boolean;
  onPlayed: () => void;
  selected: string | null;
  showResult: boolean;
  onAnswer: (optId: string) => void;
}) {
  const [inputs, setInputs] = useState<string[]>([]);
  const blanks = question.spellBlanks || [];
  const fullWord = question.spellFullWord || '';

  // 初始化输入框
  useState(() => {
    setInputs(blanks.map(() => ''));
  });

  const handleInput = (idx: number, value: string) => {
    if (showResult) return;
    const newInputs = [...inputs];
    newInputs[idx] = value.toLowerCase().slice(-1); // 只取最后一个字符
    setInputs(newInputs);

    // 所有空格都填完时自动判定
    if (newInputs.every((v) => v.length > 0)) {
      const userAnswer = newInputs.join('');
      const correctAnswer = blanks.map((i) => fullWord[i]).join('');
      onAnswer(userAnswer === correctAnswer ? 'correct' : 'wrong');
    }
  };

  const correctAnswer = blanks.map((i) => fullWord[i]).join('');

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-sage-soft/30 p-5">
      <p className="text-sm text-muted-foreground">{question.prompt}</p>
      <div className="flex items-center gap-3">
        <SpeakButton
          text={question.audioText}
          variant="default"
          size="sm"
          label="听单词"
          onSpeak={onPlayed}
        />
      </div>
      {hasPlayed && (
        <>
          <p className="text-xs text-muted-foreground">中文释义：{question.displayZh}</p>
          <div className="flex items-center gap-1.5">
            {question.spellHint?.split('').map((c, i) => (
              <span
                key={i}
                className={cn(
                  'grid h-10 w-10 place-items-center rounded-lg border-2 font-display text-lg font-bold',
                  blanks.includes(i)
                    ? 'border-primary bg-card'
                    : 'border-border bg-muted text-muted-foreground',
                )}
              >
                {c}
              </span>
            ))}
          </div>
          {/* 输入框 */}
          <div className="flex gap-2">
            {blanks.map((_, idx) => (
              <input
                key={idx}
                type="text"
                value={inputs[idx] || ''}
                onChange={(e) => handleInput(idx, e.target.value)}
                disabled={showResult}
                maxLength={1}
                className={cn(
                  'h-11 w-11 rounded-lg border-2 text-center font-display text-lg font-bold uppercase outline-none',
                  showResult
                    ? (inputs[idx] === correctAnswer[idx]
                      ? 'border-primary bg-sage-soft/50 text-primary'
                      : 'border-destructive/40 bg-destructive/5 text-destructive')
                    : 'border-primary focus:bg-sage-soft/30',
                )}
              />
            ))}
          </div>
          {showResult && selected === 'wrong' && (
            <p className="text-xs text-destructive">
              正确答案：{correctAnswer.split('').join(' ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
