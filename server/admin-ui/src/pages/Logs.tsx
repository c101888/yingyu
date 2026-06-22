import { useState, useEffect } from 'react';
import { api } from '../api';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function Logs() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    api.getLogs(page, 50).then(setData).finally(() => setLoading(false));
  }, [page]);

  const actionLabel: Record<string, string> = {
    edit_user: '编辑用户',
    delete_user: '删除用户',
    adjust_stars: '调整积分',
    set_vip: '设置 VIP',
    update_llm_config: '更新 LLM 配置',
  };

  if (loading) return <div className="text-center py-12 text-gray-500">加载中…</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">操作日志</h2>
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">管理员</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">目标</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">详情</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data?.logs?.map((log: any) => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700">
                    {actionLabel[log.action] || log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm">{log.admin_username || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{log.target_type} / {log.target_id?.slice(0, 8)}</td>
                <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{log.detail || '-'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{new Date(log.created_at).toLocaleString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 flex items-center gap-1">
            <ChevronLeft size={16} /> 上一页
          </button>
          <span className="px-4 py-1.5 text-sm">{page} / {data.totalPages}</span>
          <button onClick={() => setPage(p => Math.min(data.totalPages, p + 1))} disabled={page === data.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 flex items-center gap-1">
            下一页 <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
