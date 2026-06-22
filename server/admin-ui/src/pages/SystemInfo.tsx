import { useState, useEffect } from 'react';
import { api } from '../api';
import { HardDrive, Users, Database, Zap, Trash2 } from 'lucide-react';

export default function SystemInfo() {
  const [disk, setDisk] = useState<any>(null);
  const [online, setOnline] = useState<any>(null);
  const [cacheStats, setCacheStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const loadCache = () => {
    api.getSceneCacheStats().then(setCacheStats).catch(() => {});
  };

  useEffect(() => {
    Promise.all([api.getDiskInfo(), api.getOnlineUsers(), api.getSceneCacheStats()])
      .then(([d, o, c]) => { setDisk(d); setOnline(o); setCacheStats(c); })
      .finally(() => setLoading(false));
  }, []);

  const handleClearCache = async () => {
    if (!confirm('确定清空所有场景缓存？清空后所有用户将重新调用 LLM 生成。')) return;
    setClearing(true);
    try {
      await api.clearSceneCache();
      loadCache();
    } catch (e) {
      alert('清空失败：' + (e as Error).message);
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">加载中…</div>;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
    return (bytes / 1024 / 1024 / 1024).toFixed(1) + ' GB';
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">系统信息</h2>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 硬盘/数据库信息 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2"><HardDrive size={18} /> 存储信息</h3>
          {disk && (
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">数据库文件大小</span>
                  <span className="font-medium">{formatBytes(disk.dbSize)}</span>
                </div>
              </div>
              <div className="text-xs text-gray-500">
                <p>路径：{disk.dbPath}</p>
                <p>备份目录：{disk.backupDir}</p>
              </div>
              {disk.disk && disk.disk.total > 0 && (
                <div className="border-t pt-3 mt-3">
                  <p className="text-sm font-medium mb-2">
                    硬盘容量{disk.disk.drive && <span className="text-gray-500">（{disk.disk.drive}）</span>}
                  </p>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">已用 / 总量</span>
                    <span>
                      {formatBytes(disk.disk.used)} / {formatBytes(disk.disk.total)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${disk.disk.usedPercent}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>使用率 {disk.disk.usedPercent}%</span>
                    <span>可用 {formatBytes(disk.disk.free)}</span>
                  </div>
                </div>
              )}
              <div className="border-t pt-3 mt-3">
                <p className="text-sm font-medium mb-2">系统内存（参考）</p>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600">已用 / 总量</span>
                  <span>{formatBytes(disk.usedMemory)} / {formatBytes(disk.totalMemory)}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${disk.memoryUsagePercent}%` }} />
                </div>
                <p className="text-xs text-gray-500 mt-1">使用率 {disk.memoryUsagePercent}%</p>
              </div>
            </div>
          )}
        </div>

        {/* 在线用户 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Users size={18} /> 在线用户
            <span className="ml-auto bg-green-100 text-green-700 px-2 py-0.5 rounded text-sm">
              {online?.onlineCount || 0} 人在线
            </span>
          </h3>
          {online?.onlineUsers?.length > 0 ? (
            <div className="space-y-2 max-h-96 overflow-auto">
              {online.onlineUsers.map((u: any) => (
                <div key={u.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded">
                  <span className="text-xl">{u.avatar}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{u.nickname}</p>
                    <p className="text-xs text-gray-500">@{u.username}</p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {new Date(u.last_active).toLocaleTimeString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-400 py-8">暂无在线用户</p>
          )}
        </div>
      </div>

      {/* 场景缓存统计 */}
      {cacheStats && (
        <div className="bg-white rounded-xl shadow p-6 mt-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Zap size={18} className="text-amber-500" /> 场景缓存（LLM 调用优化）
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-700 disabled:opacity-50"
            >
              <Trash2 size={14} /> {clearing ? '清空中…' : '清空缓存'}
            </button>
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">已缓存场景</p>
              <p className="text-2xl font-bold text-amber-600">{cacheStats.totalCached || 0}</p>
            </div>
            <div className="bg-green-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">累计命中次数</p>
              <p className="text-2xl font-bold text-green-600">{cacheStats.totalHits || 0}</p>
            </div>
            <div className="bg-blue-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">节省 LLM 调用</p>
              <p className="text-2xl font-bold text-blue-600">{cacheStats.totalHits || 0}</p>
              <p className="text-xs text-gray-500">次（每次约 1-3 秒）</p>
            </div>
          </div>

          {cacheStats.topScenes?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium mb-2">热门场景 Top 20</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left p-2">场景</th>
                      <th className="text-left p-2">难度</th>
                      <th className="text-right p-2">命中次数</th>
                      <th className="text-right p-2">最近命中</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cacheStats.topScenes.map((s: any, i: number) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="p-2">{s.sceneInput}</td>
                        <td className="p-2">
                          <span className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{s.difficulty}</span>
                        </td>
                        <td className="p-2 text-right font-medium text-green-600">{s.hitCount}</td>
                        <td className="p-2 text-right text-xs text-gray-500">
                          {s.lastHitAt ? new Date(s.lastHitAt).toLocaleString('zh-CN') : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {(!cacheStats.topScenes || cacheStats.topScenes.length === 0) && (
            <p className="text-center text-gray-400 py-4 text-sm">
              暂无缓存数据。用户生成场景后，相同输入将被缓存复用。
            </p>
          )}
        </div>
      )}
    </div>
  );
}
