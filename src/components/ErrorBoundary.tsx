import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

// 全局错误边界：捕获渲染异常，避免整页白屏
// 触发场景：localStorage 旧数据结构不完整、字段类型异常等
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(err: unknown): State {
    return {
      hasError: true,
      message: err instanceof Error ? err.message : '未知错误',
    };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    // 输出到控制台便于排查
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }

  handleReset = () => {
    // 清除所有持久化的本地数据，再刷新页面
    // 必须全部清除，否则损坏的 store 数据会导致崩溃循环
    try {
      localStorage.removeItem('family-eng-session');
      localStorage.removeItem('family-eng-route');
      localStorage.removeItem('family-eng-user');
      localStorage.removeItem('family-eng-points');
      localStorage.removeItem('family-eng-history');
    } catch {
      // 忽略
    }
    this.setState({ hasError: false, message: '' });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-5 px-6 py-24 text-center">
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-destructive/10 text-4xl">
            😵
          </span>
          <h1 className="font-display text-2xl font-bold">页面出错了</h1>
          <p className="text-sm text-muted-foreground">
            可能是本地缓存的数据结构不兼容。点击下方按钮清除缓存并重新开始，通常就能恢复。
          </p>
          <pre className="max-w-full overflow-auto rounded-2xl bg-muted p-3 text-left text-xs text-muted-foreground">
            {this.state.message}
          </pre>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, message: '' })}
              className="rounded-2xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-muted"
            >
              再试一次
            </button>
            <button
              onClick={this.handleReset}
              className="rounded-2xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
            >
              清除缓存并重置
            </button>
          </div>
          <a href="/" className="mt-2 text-xs text-muted-foreground underline">
            返回首页
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
