import { useState, useEffect } from 'react';
import { api } from '../api';
import { Users, BookOpen, Star, TrendingUp, UserPlus, Activity, Server, Database, Globe, Cpu, CreditCard, Mail, HardDrive, Bell, CheckCircle2, XCircle, Clock } from 'lucide-react';

interface SystemStatus {
  system: { online: boolean; uptime: number; memoryUsed: number; memoryTotal: number; nodeVersion: string };
  database: { online: boolean; latency?: number; error?: string };
  backend: { online: boolean; port: number };
  api: { online: boolean; onlineUsers: number };
  llm: { online: boolean; providerCount: number; activeCount: number; healthyCount: number; mode: string };
  frontend: { online: boolean; note: string };
  payment: { online: boolean; note: string };
  email: { online: boolean; note: string };
  storage: { online: boolean; note: string };
  push: { online: boolean; note: string };
  timestamp: number;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return `${d}天 ${h}小时`;
  if (h > 0) return `${h}小时 ${m}分钟`;
  return `${m}分钟`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function Dashboard() {
  const [data, setData] = useState<any>(null);
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.getDashboard(),
      api.getSystemStatus().catch(() => null),
    ]).then(([d, s]) => {
      setData(d);
      setStatus(s as SystemStatus | null);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-500">加载中…</div>;
  if (!data) return <div className="text-center py-12 text-red-500">加载失败</div>;

  const stats = [
    { label: '总用户数', value: data.users.total, icon: Users, color: 'bg-blue-500' },
    { label: '活跃用户', value: data.users.active, icon: Activity, color: 'bg-green-500' },
    { label: '今日新增', value: data.users.todayNew, icon: UserPlus, color: 'bg-purple-500' },
    { label: '冻结用户', value: data.users.frozen, icon: Users, color: 'bg-gray-500' },
    { label: '学习总会话', value: data.sessions.total, icon: BookOpen, color: 'bg-indigo-500' },
    { label: '今日会话', value: data.sessions.today, icon: TrendingUp, color: 'bg-orange-500' },
    { label: '总星数', value: data.totalStars, icon: Star, color: 'bg-yellow-500' },
  ];

  // 系统状态项配置
  const statusItems = status ? [
    {
      key: 'system',
      label: '系统运行',
      icon: Server,
      online: status.system.online,
      detail: status.system.online
        ? `运行 ${formatUptime(status.system.uptime)} · Node ${status.system.nodeVersion} · 内存 ${formatBytes(status.system.memoryUsed)}`
        : '未运行',
    },
    {
      key: 'database',
      label: '数据库',
      icon: Database,
      online: status.database.online,
      detail: status.database.online
        ? `SQLite · 响应 ${status.database.latency}ms`
        : `错误：${status.database.error || '未知'}`,
    },
    {
      key: 'backend',
      label: '后端服务',
      icon: Cpu,
      online: status.backend.online,
      detail: status.backend.online ? `Express · 端口 ${status.backend.port}` : '未运行',
    },
    {
      key: 'api',
      label: 'API 接口',
      icon: Globe,
      online: status.api.online,
      detail: status.api.online ? `在线用户 ${status.api.onlineUsers}` : '未运行',
    },
    {
      key: 'llm',
      label: 'LLM 大模型',
      icon: Activity,
      online: status.llm.online,
      detail: status.llm.online
        ? `${status.llm.mode === 'failover' ? '顺序轮切' : '并发分流'} · 健康 ${status.llm.healthyCount}/${status.llm.activeCount}（共 ${status.llm.providerCount}）`
        : `无可用 provider（共 ${status.llm.providerCount} 配置）`,
    },
    {
      key: 'frontend',
      label: '前端服务',
      icon: Globe,
      online: status.frontend.online,
      detail: status.frontend.note,
    },
    {
      key: 'payment',
      label: '支付接口',
      icon: CreditCard,
      online: status.payment.online,
      detail: status.payment.note,
    },
    {
      key: 'email',
      label: '邮件服务',
      icon: Mail,
      online: status.email.online,
      detail: status.email.note,
    },
    {
      key: 'storage',
      label: '对象存储',
      icon: HardDrive,
      online: status.storage.online,
      detail: status.storage.note,
    },
    {
      key: 'push',
      label: '推送服务',
      icon: Bell,
      online: status.push.online,
      detail: status.push.note,
    },
  ] : [];

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">数据概览</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-xl shadow p-5">
            <div className={`w-10 h-10 rounded-lg ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="text-white" size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-sm text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* 系统状态模块 */}
      {status && (
        <>
          <h2 className="text-2xl font-bold mb-4">系统状态</h2>
          <div className="bg-white rounded-xl shadow p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Clock size={14} />
                更新于 {new Date(status.timestamp).toLocaleString('zh-CN')}
              </p>
              <span className="text-xs text-gray-400">刷新页面可更新状态</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {statusItems.map((item) => (
                <div
                  key={item.key}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    item.online ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                    item.online ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    <item.icon size={18} className={item.online ? 'text-green-600' : 'text-gray-400'} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`text-sm font-semibold ${item.online ? 'text-gray-900' : 'text-gray-500'}`}>
                        {item.label}
                      </span>
                      {item.online ? (
                        <CheckCircle2 size={14} className="text-green-500 shrink-0" />
                      ) : (
                        <XCircle size={14} className="text-gray-400 shrink-0" />
                      )}
                    </div>
                    <p className={`text-xs ${item.online ? 'text-gray-600' : 'text-gray-400'}`}>
                      {item.detail}
                    </p>
                    {!item.online && (
                      <p className="text-[10px] text-gray-400 mt-0.5">未上线</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
