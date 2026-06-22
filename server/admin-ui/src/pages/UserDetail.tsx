import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, Save, Lock, Star, Snowflake, Trash2, Crown, Calendar } from 'lucide-react';

type Tier = 'free' | 'plus' | 'pro';

// 快捷到期选项
const QUICK_OPTIONS = [
  { label: '试用 3 天', days: 3 },
  { label: '1 个月', days: 30 },
  { label: '1 季度', days: 90 },
  { label: '1 年', days: 365 },
];

// tier 显示信息
const TIER_INFO: Record<Tier, { label: string; color: string; bg: string }> = {
  free: { label: '普通用户', color: 'text-gray-700', bg: 'bg-gray-100' },
  plus: { label: 'Plus 用户', color: 'text-blue-700', bg: 'bg-blue-100' },
  pro: { label: 'Pro 用户', color: 'text-purple-700', bg: 'bg-purple-100' },
};

export default function UserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({ nickname: '', avatar: '', status: '', role: '' });
  const [newPassword, setNewPassword] = useState('');
  const [starsDelta, setStarsDelta] = useState(0);
  const [starsReason, setStarsReason] = useState('');
  const [msg, setMsg] = useState('');

  // 用户权益状态
  const [tier, setTier] = useState<Tier>('free');
  const [expireAt, setExpireAt] = useState<number | null>(null);
  // 自定义日期字符串（yyyy-MM-dd）
  const [customDate, setCustomDate] = useState('');
  // 当前选中的快捷选项（用于高亮）
  const [selectedQuick, setSelectedQuick] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getUser(id).then((u) => {
      setUser(u);
      setEditing({ nickname: u.nickname, avatar: u.avatar, status: u.status, role: u.role });
      setTier(u.tier || 'free');
      setExpireAt(u.tier_expire_at || null);
      if (u.tier_expire_at) {
        const d = new Date(u.tier_expire_at);
        setCustomDate(d.toISOString().slice(0, 10));
      }
    }).finally(() => setLoading(false));
  }, [id]);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000); };

  const handleSave = async () => {
    try {
      await api.updateUser(id!, editing);
      showMsg('✅ 保存成功');
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '保存失败'));
    }
  };

  const handlePassword = async () => {
    if (!newPassword || newPassword.length < 6) { showMsg('密码至少 6 位'); return; }
    try {
      await api.updateUserPassword(id!, newPassword);
      setNewPassword('');
      showMsg('✅ 密码已修改');
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '修改失败'));
    }
  };

  const handleStars = async () => {
    try {
      const res = await api.adjustStars(id!, starsDelta, starsReason);
      setUser({ ...user, total_stars: res.totalStars });
      setStarsDelta(0); setStarsReason('');
      showMsg(`✅ 积分已调整，当前 ${res.totalStars} 星`);
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '调整失败'));
    }
  };

  const handleFreeze = async () => {
    const newStatus = user.status === 'frozen' ? 'active' : 'frozen';
    if (!confirm(`确定要${newStatus === 'frozen' ? '冻结' : '解冻'}该用户吗？`)) return;
    try {
      await api.updateUser(id!, { status: newStatus });
      setUser({ ...user, status: newStatus });
      setEditing({ ...editing, status: newStatus });
      showMsg(`✅ 已${newStatus === 'frozen' ? '冻结' : '解冻'}`);
    } catch (err) {
      showMsg('❌ 操作失败');
    }
  };

  const handleDelete = async () => {
    if (!confirm('确定要删除该用户吗？此操作不可恢复（软删除）。')) return;
    try {
      await api.deleteUser(id!);
      navigate('/users');
    } catch (err) {
      showMsg('❌ 删除失败');
    }
  };

  // 选择快捷选项
  const handleQuickSelect = (days: number) => {
    setSelectedQuick(days);
    const newExpire = Date.now() + days * 86400000;
    setExpireAt(newExpire);
    setCustomDate(new Date(newExpire).toISOString().slice(0, 10));
  };

  // 自定义日期变更
  const handleCustomDate = (dateStr: string) => {
    setCustomDate(dateStr);
    setSelectedQuick(null);
    if (dateStr) {
      // 当天 23:59:59 到期
      const d = new Date(dateStr);
      d.setHours(23, 59, 59, 0);
      setExpireAt(d.getTime());
    } else {
      setExpireAt(null);
    }
  };

  // 切换 tier
  const handleTierChange = (newTier: Tier) => {
    setTier(newTier);
    if (newTier === 'free') {
      setExpireAt(null);
      setCustomDate('');
      setSelectedQuick(null);
    } else if (!expireAt) {
      // 默认 1 个月
      handleQuickSelect(30);
    }
  };

  // 保存权益
  const handleSaveTier = async () => {
    try {
      if (tier !== 'free' && !expireAt) {
        showMsg('❌ Plus/Pro 必须设置到期时间');
        return;
      }
      const res = await api.setTier(id!, tier, expireAt);
      setUser({ ...user, tier: res.tier, tier_expire_at: res.tierExpireAt });
      showMsg(`✅ 用户权益已设置为 ${TIER_INFO[tier].label}`);
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '设置失败'));
    }
  };

  if (loading) return <div className="text-center py-12 text-gray-500">加载中…</div>;
  if (!user) return <div className="text-center py-12 text-red-500">用户不存在</div>;

  return (
    <div>
      <button onClick={() => navigate('/users')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft size={18} /> 返回用户列表
      </button>

      {msg && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4">{msg}</div>}

      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <span className="text-5xl">{user.avatar}</span>
          <div>
            <h2 className="text-2xl font-bold">{user.nickname}</h2>
            <p className="text-gray-500">@{user.username} · {user.email}</p>
          </div>
        </div>

        {/* 基本信息 */}
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Save size={16} /> 基本信息</h3>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm text-gray-600 mb-1">昵称</label>
            <input value={editing.nickname} onChange={(e) => setEditing({ ...editing, nickname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">头像 emoji</label>
            <input value={editing.avatar} onChange={(e) => setEditing({ ...editing, avatar: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">角色</label>
            <select value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">状态</label>
            <select value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg">
              <option value="active">正常</option>
              <option value="frozen">冻结</option>
            </select>
          </div>
        </div>
        <button onClick={handleSave} className="bg-blue-600 text-white px-4 py-2 rounded-lg">保存修改</button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 修改密码 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Lock size={16} /> 修改密码</h3>
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="输入新密码（至少 6 位）" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3" />
          <button onClick={handlePassword} className="bg-gray-800 text-white px-4 py-2 rounded-lg">修改密码</button>
        </div>

        {/* 调整积分 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Star size={16} /> 调整积分</h3>
          <p className="text-sm text-gray-500 mb-3">当前：⭐ {user.total_stars}</p>
          <input type="number" value={starsDelta} onChange={(e) => setStarsDelta(parseInt(e.target.value) || 0)}
            placeholder="正数增加，负数减少" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2" />
          <input value={starsReason} onChange={(e) => setStarsReason(e.target.value)}
            placeholder="调整原因" className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3" />
          <button onClick={handleStars} className="bg-yellow-500 text-white px-4 py-2 rounded-lg">调整积分</button>
        </div>

        {/* 用户权益设置（替代原 VIP 设置） */}
        <div className="bg-white rounded-xl shadow p-6 md:col-span-2">
          <h3 className="font-semibold mb-3 flex items-center gap-2"><Crown size={16} /> 用户权益设置</h3>
          <p className="text-sm text-gray-500 mb-4">
            当前：
            <span className={`ml-1 px-2 py-0.5 rounded text-xs font-semibold ${TIER_INFO[tier].bg} ${TIER_INFO[tier].color}`}>
              {TIER_INFO[tier].label}
            </span>
            {expireAt && (
              <span className="ml-2 text-gray-500">
                · 到期 {new Date(expireAt).toLocaleDateString('zh-CN')}
                {tier !== 'free' && (
                  <span className="ml-1 text-xs">
                    （剩余 {Math.max(0, Math.ceil((expireAt - Date.now()) / 86400000))} 天）
                  </span>
                )}
              </span>
            )}
          </p>

          {/* tier 选择 */}
          <div className="mb-4">
            <label className="block text-sm text-gray-600 mb-2">权益等级</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(TIER_INFO) as Tier[]).map((t) => (
                <button
                  key={t}
                  onClick={() => handleTierChange(t)}
                  className={`px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                    tier === t
                      ? `border-current ${TIER_INFO[t].bg} ${TIER_INFO[t].color}`
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {TIER_INFO[t].label}
                </button>
              ))}
            </div>
          </div>

          {/* 到期时间（free 不显示） */}
          {tier !== 'free' && (
            <>
              <div className="mb-4">
                <label className="block text-sm text-gray-600 mb-2 flex items-center gap-1">
                  <Calendar size={14} /> 到期时间（必选）
                </label>
                {/* 快捷选项 */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {QUICK_OPTIONS.map((opt) => (
                    <button
                      key={opt.days}
                      onClick={() => handleQuickSelect(opt.days)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                        selectedQuick === opt.days
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* 自定义日期 */}
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customDate}
                    onChange={(e) => handleCustomDate(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <span className="text-xs text-gray-500">当天 23:59:59 到期</span>
                </div>
              </div>
            </>
          )}

          <button onClick={handleSaveTier} className="bg-purple-600 text-white px-4 py-2 rounded-lg">
            保存权益设置
          </button>
        </div>

        {/* 危险操作 */}
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-600"><Trash2 size={16} /> 危险操作</h3>
          <div className="space-y-2">
            <button onClick={handleFreeze}
              className="flex items-center gap-2 bg-orange-100 text-orange-700 px-4 py-2 rounded-lg w-full">
              <Snowflake size={16} />
              {user.status === 'frozen' ? '解冻用户' : '冻结用户'}
            </button>
            <button onClick={handleDelete}
              className="flex items-center gap-2 bg-red-100 text-red-700 px-4 py-2 rounded-lg w-full">
              <Trash2 size={16} /> 删除用户
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
