import { useState, useEffect } from 'react';
import { api } from '../api';
import { Database, Plus, HardDrive } from 'lucide-react';

export default function Backups() {
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState('');

  const load = () => {
    setLoading(true);
    api.getBackups().then((data) => setBackups(data.backups)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    setCreating(true);
    try {
      await api.createBackup();
      setMsg('✅ 备份创建成功');
      load();
      setTimeout(() => setMsg(''), 3000);
    } catch (err) {
      setMsg('❌ ' + (err instanceof Error ? err.message : '备份失败'));
    } finally {
      setCreating(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">数据库备份</h2>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          <Plus size={16} /> {creating ? '备份中…' : '立即备份'}
        </button>
      </div>

      {msg && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4">{msg}</div>}

      <div className="bg-white rounded-xl shadow p-4 mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <HardDrive size={16} />
          <span>定时备份：每天凌晨 3:00 自动执行，保留最近 30 天的备份</span>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">备份文件</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">大小</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">备份时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">加载中…</td></tr>
            ) : backups.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-500">暂无备份</td></tr>
            ) : (
              backups.map((b) => (
                <tr key={b.name} className="hover:bg-gray-50">
                  <td className="px-4 py-3 flex items-center gap-2">
                    <Database size={16} className="text-gray-400" />
                    <span className="text-sm font-mono">{b.name}</span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{formatSize(b.size)}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {new Date(b.createdAt).toLocaleString('zh-CN')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
