import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Users, Settings, Database, HardDrive, ScrollText, LogOut, Menu, X } from 'lucide-react';

const navItems = [
  { to: '/', label: '仪表盘', icon: LayoutDashboard, end: true },
  { to: '/users', label: '用户管理', icon: Users },
  { to: '/llm', label: 'LLM 设置', icon: Settings },
  { to: '/backups', label: '数据库备份', icon: Database },
  { to: '/system', label: '系统信息', icon: HardDrive },
  { to: '/logs', label: '操作日志', icon: ScrollText },
];

export default function Layout() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser, setAdminUser] = useState<any>(null);

  useEffect(() => {
    const u = localStorage.getItem('admin_user');
    if (!u || !localStorage.getItem('admin_token')) {
      navigate('/login');
      return;
    }
    setAdminUser(JSON.parse(u));
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    navigate('/login');
  };

  if (!adminUser) return null;

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* 侧边栏 */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gray-900 text-white transform transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-6">
          <div className="flex items-center gap-2 mb-8">
            <span className="text-2xl">👑</span>
            <span className="font-bold text-lg">管理后台</span>
          </div>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setSidebarOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                    isActive ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'
                  }`
                }
              >
                <item.icon size={18} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-800">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">{adminUser.avatar}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{adminUser.nickname}</p>
              <p className="text-xs text-gray-400 truncate">{adminUser.email}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white"
          >
            <LogOut size={16} />
            退出登录
          </button>
        </div>
      </aside>

      {/* 遮罩 */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-4 lg:px-8 py-4 flex items-center justify-between">
          <button className="lg:hidden" onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
          <h1 className="text-lg font-semibold text-gray-900">家庭英语学习管理后台</h1>
          <div className="w-8 lg:hidden" />
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
