import { useState } from 'react';
import { X, LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useUserStore, GUEST_MAX_USAGE } from '@/store/useUserStore';
import { cn } from '@/lib/utils';

const AVATAR_LIST = ['🦊', '🐼', '🐨', '🐰', '🐯', '🦁', '🐸', '🐵', '🦉', '🐧', '🦄', '🐶'];

interface AuthDialogProps {
  open: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
  /** 登录/注册成功后回调 */
  onSuccess?: () => void;
}

/**
 * 可复用的登录/注册弹窗组件
 * 手机端底部抽屉，桌面端居中
 */
export function AuthDialog({ open, onClose, defaultMode = 'login', onSuccess }: AuthDialogProps) {
  const { login, register } = useUserStore();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [account, setAccount] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('🦊');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSubmit = async () => {
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        if (!account || !password) {
          setError('请输入账户和密码');
          setLoading(false);
          return;
        }
        await login(account, password);
      } else {
        if (!username || !email || !password) {
          setError('请填写账户、邮箱和密码');
          setLoading(false);
          return;
        }
        if (!/^[a-zA-Z0-9]{4,20}$/.test(username)) {
          setError('账户名只能用英文或数字，4-20 位');
          setLoading(false);
          return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError('邮箱格式不正确');
          setLoading(false);
          return;
        }
        const nick = nickname || username;
        if (nick.length < 2 || nick.length > 12) {
          setError('昵称需 2-12 个字符');
          setLoading(false);
          return;
        }
        if (password.length < 6 || password.length > 32) {
          setError('密码需 6-32 位');
          setLoading(false);
          return;
        }
        await register(username, email, password, nick, avatar);
      }
      // 成功：清空表单并关闭
      setAccount(''); setEmail(''); setUsername(''); setPassword(''); setNickname(''); setAvatar('🦊');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-background/80 backdrop-blur-sm p-4 sm:items-center"
      onClick={onClose}
    >
      <Card className="max-w-md w-full shadow-soft-lg" onClick={(e) => e.stopPropagation()}>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-xl font-bold">
              {mode === 'login' ? '登录' : '注册'}
            </h3>
            <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-muted-foreground hover:bg-secondary">
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            登录后可无限使用、保存学习记录、获得积分和等级。游客模式最多使用 {GUEST_MAX_USAGE} 次。
          </p>

          {error && (
            <div className="mb-3 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {mode === 'register' && (
              <>
                <div>
                  <p className="mb-1.5 text-xs text-muted-foreground">选择头像</p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto rounded-xl border border-border bg-card p-2">
                    {AVATAR_LIST.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAvatar(a)}
                        className={cn(
                          'grid h-9 w-9 place-items-center rounded-lg text-lg transition-all',
                          avatar === a
                            ? 'bg-primary/20 ring-2 ring-primary'
                            : 'bg-secondary hover:bg-secondary/70',
                        )}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="账户名（英文/数字，4-20 位）"
                  maxLength={20}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="邮箱"
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
                <input
                  type="text"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="昵称（中英文/数字，2-12 字符，可选）"
                  maxLength={12}
                  className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
                />
              </>
            )}
            {mode === 'login' && (
              <input
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="账户名或邮箱"
                className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              />
            )}
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码（6-32 位）"
              maxLength={32}
              className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            />
            <Button
              className="w-full"
              disabled={loading}
              onClick={handleSubmit}
            >
              {loading ? '处理中…' : (mode === 'login' ? '登录' : '注册')}
            </Button>
          </div>

          <div className="mt-4 text-center text-xs text-muted-foreground">
            {mode === 'login' ? (
              <>没有账号？<button onClick={() => { setMode('register'); setError(''); }} className="font-semibold text-primary hover:underline">去注册</button></>
            ) : (
              <>已有账号？<button onClick={() => { setMode('login'); setError(''); }} className="font-semibold text-primary hover:underline">去登录</button></>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
