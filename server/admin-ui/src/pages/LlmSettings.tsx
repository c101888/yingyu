import { useState, useEffect } from 'react';
import { api } from '../api';
import { Save, Plus, Trash2, Edit2, X, RefreshCw, Zap, Activity, AlertCircle, CheckCircle2, Power } from 'lucide-react';

type Mode = 'failover' | 'loadbalance';

interface Provider {
  id: string;
  name: string;
  base_url: string;
  api_key: string;
  model: string;
  priority: number;
  is_active: number;
  max_concurrency: number;
  fail_count: number;
  cooldown_until: number;
  last_used_at: number | null;
  last_error: string | null;
  created_at: number;
}

const emptyForm = {
  name: '',
  baseUrl: '',
  apiKey: '',
  model: '',
  priority: 1,
  maxConcurrency: 5,
  isActive: true,
};

export default function LlmSettings() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [mode, setMode] = useState<Mode>('failover');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [testing, setTesting] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const data = await api.getLlmProviders();
      setProviders(data.providers);
      setMode(data.mode);
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3500); };

  const handleModeChange = async (newMode: Mode) => {
    try {
      await api.setLlmMode(newMode);
      setMode(newMode);
      showMsg(`✅ 已切换为${newMode === 'failover' ? '顺序轮切' : '并发分流'}模式`);
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '切换失败'));
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.baseUrl || !form.apiKey || !form.model) {
      showMsg('❌ 所有字段必填');
      return;
    }
    try {
      const payload = {
        name: form.name,
        baseUrl: form.baseUrl,
        apiKey: form.apiKey,
        model: form.model,
        priority: form.priority,
        maxConcurrency: form.maxConcurrency,
        isActive: form.isActive,
      };
      if (editingId) {
        await api.updateLlmProvider(editingId, payload);
        showMsg('✅ 已更新');
      } else {
        await api.createLlmProvider(payload);
        showMsg('✅ 已创建');
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm);
      loadData();
    } catch (err) {
      showMsg('❌ ' + (err instanceof Error ? err.message : '保存失败'));
    }
  };

  const handleEdit = (p: Provider) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      baseUrl: p.base_url,
      apiKey: '', // 编辑时不预填 api_key（后端脱敏了）
      model: p.model,
      priority: p.priority,
      maxConcurrency: p.max_concurrency,
      isActive: p.is_active === 1,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除该 LLM 配置？')) return;
    try {
      await api.deleteLlmProvider(id);
      showMsg('✅ 已删除');
      loadData();
    } catch (err) {
      showMsg('❌ 删除失败');
    }
  };

  const handleToggleActive = async (p: Provider) => {
    try {
      await api.updateLlmProvider(p.id, { isActive: p.is_active !== 1 });
      loadData();
    } catch (err) {
      showMsg('❌ 切换失败');
    }
  };

  const handleReset = async (id: string) => {
    try {
      await api.resetLlmProvider(id);
      showMsg('✅ 已重置故障状态');
      loadData();
    } catch (err) {
      showMsg('❌ 重置失败');
    }
  };

  const handleTest = async (id: string) => {
    setTesting(id);
    try {
      const res: any = await api.testLlmProvider(id);
      if (res.success) {
        showMsg(`✅ 连接成功 · ${res.elapsed}ms · HTTP ${res.status}`);
      } else {
        showMsg(`❌ 连接失败 · HTTP ${res.status} · ${res.error || ''}`);
      }
    } catch (err) {
      showMsg('❌ 测试失败');
    } finally {
      setTesting(null);
    }
  };

  // 判断 provider 状态
  const getStatus = (p: Provider) => {
    if (p.is_active !== 1) return { label: '已禁用', color: 'bg-gray-100 text-gray-500', icon: Power };
    if (p.cooldown_until > Date.now()) return { label: '冷却中', color: 'bg-orange-100 text-orange-700', icon: AlertCircle };
    if (p.fail_count > 0) return { label: `故障 ${p.fail_count}/3`, color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle };
    return { label: '正常', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
  };

  if (loading) return <div className="text-center py-12 text-gray-500">加载中…</div>;

  return (
    <div>
      <h2 className="text-2xl font-bold mb-2">LLM 大模型设置</h2>
      <p className="text-sm text-gray-500 mb-6">配置多个大模型，支持顺序轮切（故障自动切换）或并发分流（负载均衡）两种模式。</p>

      {msg && <div className="bg-blue-50 text-blue-700 p-3 rounded-lg mb-4">{msg}</div>}

      {/* 模式切换 */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <h3 className="font-semibold mb-3 flex items-center gap-2"><Activity size={18} /> 调度模式</h3>
        <p className="text-sm text-gray-500 mb-4">
          两种模式互斥，可随时切换。当前模式：
          <span className={`ml-1 font-semibold ${mode === 'failover' ? 'text-blue-600' : 'text-purple-600'}`}>
            {mode === 'failover' ? '顺序轮切' : '并发分流'}
          </span>
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <button
            onClick={() => handleModeChange('failover')}
            className={`text-left p-4 rounded-lg border-2 transition-all ${
              mode === 'failover' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw size={18} className={mode === 'failover' ? 'text-blue-600' : 'text-gray-400'} />
              <span className="font-semibold">顺序轮切（failover）</span>
            </div>
            <p className="text-xs text-gray-600">
              按 priority 顺序调用，当前模型故障（5xx/超时/429）自动切换到下一个。适合单模型够用、需要容灾的场景。
            </p>
          </button>
          <button
            onClick={() => handleModeChange('loadbalance')}
            className={`text-left p-4 rounded-lg border-2 transition-all ${
              mode === 'loadbalance' ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <Zap size={18} className={mode === 'loadbalance' ? 'text-purple-600' : 'text-gray-400'} />
              <span className="font-semibold">并发分流（loadbalance）</span>
            </div>
            <p className="text-xs text-gray-600">
              按各模型 max_concurrency 限制并发，超出分配给其他可用模型。适合高并发、多模型分摊负载的场景。
            </p>
          </button>
        </div>
      </div>

      {/* Provider 列表 */}
      <div className="bg-white rounded-xl shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">模型配置列表（{providers.length}）</h3>
          <button
            onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}
            className="flex items-center gap-1 bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
          >
            <Plus size={16} /> 新增模型
          </button>
        </div>

        {providers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p>暂无模型配置</p>
            <p className="text-xs mt-1">点击右上角"新增模型"添加第一个 LLM 配置</p>
          </div>
        ) : (
          <div className="space-y-3">
            {providers.map((p) => {
              const status = getStatus(p);
              return (
                <div key={p.id} className={`border rounded-lg p-4 ${p.is_active !== 1 ? 'opacity-60' : ''}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-semibold text-gray-900">{p.name}</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">#{p.priority}</span>
                        <span className={`px-2 py-0.5 rounded text-xs flex items-center gap-1 ${status.color}`}>
                          <status.icon size={12} /> {status.label}
                        </span>
                        {mode === 'loadbalance' && (
                          <span className="px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700">
                            并发上限 {p.max_concurrency}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 space-y-0.5">
                        <p>模型：{p.model}</p>
                        <p className="truncate">Base URL：{p.base_url}</p>
                        <p>API Key：{p.api_key || '（未设置）'}</p>
                        {p.last_used_at && (
                          <p>最后使用：{new Date(p.last_used_at).toLocaleString('zh-CN')}</p>
                        )}
                        {p.cooldown_until > Date.now() && (
                          <p className="text-orange-600">
                            冷却至 {new Date(p.cooldown_until).toLocaleTimeString('zh-CN')}
                          </p>
                        )}
                        {p.last_error && (
                          <p className="text-red-500 truncate">最近错误：{p.last_error}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => handleTest(p.id)}
                        disabled={testing === p.id}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
                      >
                        {testing === p.id ? '测试中…' : '测试'}
                      </button>
                      <button
                        onClick={() => handleToggleActive(p)}
                        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                      >
                        {p.is_active === 1 ? '禁用' : '启用'}
                      </button>
                      <button
                        onClick={() => handleEdit(p)}
                        className="text-xs px-2 py-1 rounded bg-blue-100 text-blue-700 hover:bg-blue-200 flex items-center gap-1"
                      >
                        <Edit2 size={12} /> 编辑
                      </button>
                      {(p.fail_count > 0 || p.cooldown_until > 0) && (
                        <button
                          onClick={() => handleReset(p.id)}
                          className="text-xs px-2 py-1 rounded bg-orange-100 text-orange-700 hover:bg-orange-200"
                        >
                          重置
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 hover:bg-red-200 flex items-center gap-1"
                      >
                        <Trash2 size={12} /> 删除
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 新增/编辑表单 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg">{editingId ? '编辑模型' : '新增模型'}</h3>
              <button onClick={() => setShowForm(false)}><X size={20} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600 mb-1">名称</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：火山 GLM 主力" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Base URL</label>
                <input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="https://ark.cn-beijing.volces.com/api/coding/v3" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  API Key {editingId && <span className="text-gray-400">（留空表示不修改）</span>}
                </label>
                <input type="password" value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="输入 API Key" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">模型名称</label>
                <input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="glm-5.2" className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">优先级（1=主，2=次…）</label>
                  <input type="number" min={1} value={form.priority}
                    onChange={(e) => setForm({ ...form, priority: parseInt(e.target.value) || 1 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">最大并发（loadbalance 用）</label>
                  <input type="number" min={1} value={form.maxConcurrency}
                    onChange={(e) => setForm({ ...form, maxConcurrency: parseInt(e.target.value) || 5 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
                启用
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowForm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg">取消</button>
              <button onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center justify-center gap-1">
                <Save size={16} /> {editingId ? '保存修改' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
