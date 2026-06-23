import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  startRecognition,
  recognitionSupported,
  getScoreLabel,
  type RecognitionResult,
} from '@/lib/speechRecognition';
import { cn } from '@/lib/utils';

interface RepeatButtonProps {
  text: string;          // 需要跟读的英文
  lang?: string;         // 识别语言，默认 en-US
  size?: 'sm' | 'default' | 'icon';
  variant?: 'default' | 'accent' | 'soft' | 'outline' | 'ghost' | 'peach';
  className?: string;
  onScored?: (result: RecognitionResult) => void;  // 评分完成回调
}

type Status = 'idle' | 'preparing' | 'recording' | 'processing' | 'done' | 'error';

// 跟读按钮：录音 → 语音识别 → 评分
export function RepeatButton({
  text,
  lang = 'en-US',
  size = 'sm',
  variant = 'outline',
  className,
  onScored,
}: RepeatButtonProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const stopFnRef = useRef<(() => void) | null>(null);
  const processingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preparingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supported = recognitionSupported();

  // 卸载时清理：避免离开页面后残留识别实例
  useEffect(() => {
    return () => {
      if (processingTimerRef.current) clearTimeout(processingTimerRef.current);
      if (preparingTimerRef.current) clearTimeout(preparingTimerRef.current);
      stopFnRef.current?.();
      stopFnRef.current = null;
    };
  }, []);

  const clearProcessingTimer = () => {
    if (processingTimerRef.current) {
      clearTimeout(processingTimerRef.current);
      processingTimerRef.current = null;
    }
  };

  const clearPreparingTimer = () => {
    if (preparingTimerRef.current) {
      clearTimeout(preparingTimerRef.current);
      preparingTimerRef.current = null;
    }
  };

  const handleStart = useCallback(() => {
    if (!supported) {
      setStatus('error');
      setErrorMsg('当前浏览器不支持语音识别，请使用 Chrome');
      return;
    }

    // 先停止任何残留实例（自己或别的按钮的）
    stopFnRef.current?.();
    stopFnRef.current = null;
    clearProcessingTimer();
    clearPreparingTimer();

    setStatus('preparing');
    setResult(null);
    setErrorMsg('');

    // preparing 兜底：6 秒后还在 preparing 说明插件 start 卡住了，强制进入录音状态
    // 让用户至少能点"停止录音"恢复
    preparingTimerRef.current = setTimeout(() => {
      preparingTimerRef.current = null;
      setStatus((s) => (s === 'preparing' ? 'recording' : s));
    }, 6000);

    const stop = startRecognition(text, {
      lang,
      onStart: () => {
        // 录音真正开始（原生平台收到 listeningState=started 或 start() resolve，或 Web 收到 onstart）
        clearPreparingTimer();
        setStatus((s) => (s === 'preparing' ? 'recording' : s));
      },
      onResult: (r) => {
        clearProcessingTimer();
        clearPreparingTimer();
        setResult(r);
        setStatus('done');
        onScored?.(r);
      },
      onError: (msg) => {
        clearProcessingTimer();
        clearPreparingTimer();
        setErrorMsg(msg);
        setStatus('error');
      },
      onEnd: () => {
        clearProcessingTimer();
        clearPreparingTimer();
        // 兜底：onEnd 触发但既无 onResult 也无 onError，强制回到 idle 而不是卡在 preparing/processing
        setStatus((s) => {
          if (s === 'preparing' || s === 'recording' || s === 'processing') {
            return 'idle';
          }
          return s;
        });
      },
    });
    stopFnRef.current = stop;
  }, [text, lang, supported, onScored]);

  const handleStop = useCallback(() => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    clearPreparingTimer();
    setStatus('processing');
    // 超时保护：触发 stop 后如果 8 秒内 onResult/onError/onEnd 都没回调，强制重置
    clearProcessingTimer();
    processingTimerRef.current = setTimeout(() => {
      processingTimerRef.current = null;
      setStatus((s) => {
        if (s === 'processing') {
          setErrorMsg('识别超时，请再次点击跟读');
          return 'error';
        }
        return s;
      });
    }, 8000);
  }, []);

  // 取消按钮：在 preparing/recording 状态下都可调用，立即放弃识别回到 idle
  const handleCancel = useCallback(() => {
    stopFnRef.current?.();
    stopFnRef.current = null;
    clearPreparingTimer();
    clearProcessingTimer();
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
  }, []);

  const handleReset = useCallback(() => {
    clearProcessingTimer();
    clearPreparingTimer();
    stopFnRef.current?.();
    stopFnRef.current = null;
    setStatus('idle');
    setResult(null);
    setErrorMsg('');
  }, []);

  // 评分结果展示
  if (status === 'done' && result) {
    const label = getScoreLabel(result.score);
    return (
      <div className="flex flex-col items-stretch gap-1.5">
        <div
          className={cn(
            'flex items-center gap-2 rounded-xl border-2 px-3 py-1.5 text-sm font-bold',
            result.score >= 75 ? 'border-primary/40 bg-sage-soft/40 text-primary' :
            result.score >= 60 ? 'border-amber-300 bg-amber-50 text-amber-700' :
            'border-destructive/30 bg-destructive/5 text-destructive',
          )}
        >
          <span>{label.emoji}</span>
          <span>{label.label}</span>
          <span className="ml-auto">{result.score} 分</span>
        </div>
        <div className="text-[11px] text-muted-foreground">
          识别：{result.transcript || '（未识别到内容）'}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={handleReset}
        >
          再读一次
        </Button>
      </div>
    );
  }

  // 错误展示
  if (status === 'error') {
    return (
      <div className="flex flex-col items-stretch gap-1">
        <div className="rounded-xl border-2 border-destructive/30 bg-destructive/5 px-3 py-1.5 text-xs text-destructive">
          {errorMsg}
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={handleReset}
        >
          重试
        </Button>
      </div>
    );
  }

  // 准备中：已点击但录音还没真正开始（原生权限弹窗/插件初始化）
  // 改为可点击的"取消"按钮，避免任何情况下用户被卡死
  if (status === 'preparing') {
    return (
      <Button
        type="button"
        variant="soft"
        size={size}
        onClick={handleCancel}
        className={cn('gap-1.5', className)}
        title="点击取消"
      >
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {size !== 'icon' && <span>准备录音…点击取消</span>}
      </Button>
    );
  }

  // 录音中
  if (status === 'recording') {
    return (
      <Button
        type="button"
        variant="default"
        size={size}
        onClick={handleStop}
        className={cn('gap-1.5 ring-4 ring-ring/30 animate-pulse', className)}
      >
        <Square className="h-3.5 w-3.5 fill-current" />
        {size !== 'icon' && <span>停止录音</span>}
      </Button>
    );
  }

  // 处理中
  if (status === 'processing') {
    return (
      <Button type="button" variant="soft" size={size} disabled className={cn('gap-1.5', className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {size !== 'icon' && <span>识别中…</span>}
      </Button>
    );
  }

  // 待录音
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleStart}
      disabled={!supported}
      title={supported ? '点击跟读' : '当前浏览器不支持语音识别'}
      className={cn('gap-1.5', className)}
    >
      <Mic className="h-3.5 w-3.5" />
      {size !== 'icon' && <span>跟读</span>}
    </Button>
  );
}
