import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function Users() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    setLoading(true);
    api.getUsers(page, 20, search).then(setData).finally(() => setLoading(false));
  }, [page, search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const statusLabel = (status: string) => {
    const map: Record<string, { text: string; color: string }> = {
      active: { text: '正常', color: 'bg-green-100 text-green-700' },
      frozen: { text: '已冻结', color: 'bg-red-100 text-red-700' },
      deleted: { text: '已删除', color: 'bg-gray-100 text-gray-500' },
    };
    return map[status] || { text: status, color: 'bg-gray-100' };
  };

  // tier 显示
  const tierLabel = (tier: string, expireAt: number | null) => {
    const map: Record<string, { text: string; color: string }> = {
      free: { text: '普通', color: 'bg-gray-100 text-gray-600' },
      plus: { text: 'Plus', color: 'bg-blue-100 text-blue-700' },
      pro: { text: 'Pro', color: 'bg-purple-100 text-purple-700' },
    };
    const info = map[tier] || map.free;
    return (
      <div className="flex flex-col gap-0.5">
        <span className={`px-2 py-0.5 rounded text-xs inline-block w-fit ${info.color}`}>{info.text}</span>
        {expireAt && tier !== 'free' && (
          <span className="text-[10px] text-gray-400">
            {new Date(expireAt).toLocaleDateString('zh-CN')}
          </span>
        )}
      </div>
    );
  };

  if (loading) return <div className="text-center py-12 text-gray-500">加载中…</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">用户管理</h2>
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="搜索账户/邮箱/昵称"
            className="px-4 py-2 border border-gray-300 rounded-lg w-64"
          />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-1">
            <Search size={16} /> 搜索
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">用户</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">邮箱</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">星数</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">权益</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">注册时间</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.users.map((u: any) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{u.avatar}</span>
                    <div>
                      <p className="font-medium text-gray-900">{u.nickname}</p>
                      <p className="text-xs text-gray-500">{u.username}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role === 'admin' ? '管理员' : '用户'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs ${statusLabel(u.status).color}`}>
                    {statusLabel(u.status).text}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-yellow-600">⭐ {u.total_stars}</td>
                <td className="px-4 py-3 text-sm">
                  {tierLabel(u.tier || 'free', u.tier_expire_at)}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {new Date(u.created_at).toLocaleDateString('zh-CN')}
                </td>
                <td className="px-4 py-3">
                  <Link to={`/users/${u.id}`} className="text-blue-600 hover:underline text-sm">详情</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 分页 */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 flex items-center gap-1"
          >
            <ChevronLeft size={16} /> 上一页
          </button>
          <span className="px-4 py-1.5 text-sm">{page} / {data.totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
            disabled={page === data.totalPages}
            className="px-3 py-1.5 border border-gray-300 rounded-lg disabled:opacity-50 flex items-center gap-1"
          >
            下一页 <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
