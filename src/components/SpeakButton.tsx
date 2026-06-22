import { useState, useCallback } from 'react';
import { Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { speak, speechSupported } from '@/lib/voice';
import { cn } from '@/lib/utils';

interface SpeakButtonProps {
  text: string;
  label?: string;
  variant?: 'default' | 'accent' | 'soft' | 'outline' | 'ghost' | 'peach';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  className?: string;
  rate?: number;
  onSpeak?: () => void;
}

// 可复用的"听一听"按钮：点击朗读英文，朗读中显示状态，失败不阻断
export function SpeakButton({
  text,
  label = '听一听',
  variant = 'soft',
  size = 'default',
  className,
  rate,
  onSpeak,
}: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  const handleSpeak = useCallback(() => {
    if (!speechSupported()) return;
    onSpeak?.();
    speak(text, {
      rate,
      onstart: () => setSpeaking(true),
      onend: () => setSpeaking(false),
      onerror: () => setSpeaking(false),
    });
  }, [text, rate, onSpeak]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleSpeak}
      className={cn(speaking && 'ring-4 ring-ring/30', className)}
    >
      {speaking ? (
        <Loader2 className="animate-spin" />
      ) : (
        <Volume2 className={cn(speaking && 'animate-pulse')} />
      )}
      {size !== 'icon' && <span>{speaking ? '播放中…' : label}</span>}
    </Button>
  );
}
