import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { DailyRoute, RouteNode, RouteDefinition } from '@/lib/types';
import { DEFAULT_ROUTE_NODES, WEEKEND_ROUTE_NODES } from '@/lib/examples';

// 预置路线 ID 固定，便于跨设备识别
export const PRESET_ROUTE_IDS = {
  weekday: 'preset-weekday',
  weekend: 'preset-weekend',
};

// 默认预置路线（2 条）
export function buildPresetRoutes(): RouteDefinition[] {
  const now = Date.now();
  return [
    {
      id: PRESET_ROUTE_IDS.weekday,
      name: '上学日',
      icon: '🎒',
      nodes: DEFAULT_ROUTE_NODES,
      isPreset: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: PRESET_ROUTE_IDS.weekend,
      name: '周末',
      icon: '🌳',
      nodes: WEEKEND_ROUTE_NODES,
      isPreset: true,
      createdAt: now,
      updatedAt: now,
    },
  ];
}

interface RouteState {
  // 多路线
  routes: RouteDefinition[];
  activeRouteId: string;
  // 兼容旧字段：当前激活路线的 DailyRoute 视图
  route: DailyRoute;
  // 切换激活路线
  setActiveRoute: (id: string) => void;
  // 保存当前激活路线的节点（编辑用）
  saveRoute: (nodes: RouteNode[]) => void;
  // 重置当前激活路线为默认（仅预置路线有效）
  resetRoute: () => void;
  // 新建路线（返回新路线 id，失败返回 null）
  addRoute: (name: string, icon: string, nodes?: RouteNode[]) => string | null;
  // 修改路线元信息（名称、图标）
  updateRouteMeta: (id: string, meta: { name?: string; icon?: string }) => void;
  // 修改任意路线的节点
  updateRouteNodes: (id: string, nodes: RouteNode[]) => void;
  // 删除路线（预置路线不可删除）
  deleteRoute: (id: string) => boolean;
  // 重置全部为预置（管理用）
  resetAll: () => void;
}

function deriveRoute(routes: RouteDefinition[], activeId: string): DailyRoute {
  const active = routes.find((r) => r.id === activeId) || routes[0];
  if (!active) return { nodes: DEFAULT_ROUTE_NODES, updatedAt: Date.now() };
  return { nodes: active.nodes, updatedAt: active.updatedAt };
}

export const useRouteStore = create<RouteState>()(
  persist(
    (set, get) => ({
      routes: buildPresetRoutes(),
      activeRouteId: PRESET_ROUTE_IDS.weekday,
      route: { nodes: DEFAULT_ROUTE_NODES, updatedAt: Date.now() },

      setActiveRoute: (id) => {
        const { routes } = get();
        if (!routes.some((r) => r.id === id)) return;
        set({ activeRouteId: id, route: deriveRoute(routes, id) });
      },

      saveRoute: (nodes) => {
        const { routes, activeRouteId } = get();
        const now = Date.now();
        const next = routes.map((r) =>
          r.id === activeRouteId ? { ...r, nodes, updatedAt: now } : r,
        );
        set({ routes: next, route: { nodes, updatedAt: now } });
      },

      resetRoute: () => {
        const { routes, activeRouteId } = get();
        const active = routes.find((r) => r.id === activeRouteId);
        if (!active || !active.isPreset) return;
        const defaultNodes =
          active.id === PRESET_ROUTE_IDS.weekend
            ? WEEKEND_ROUTE_NODES
            : DEFAULT_ROUTE_NODES;
        const now = Date.now();
        const next = routes.map((r) =>
          r.id === activeRouteId ? { ...r, nodes: defaultNodes, updatedAt: now } : r,
        );
        set({ routes: next, route: { nodes: defaultNodes, updatedAt: now } });
      },

      addRoute: (name, icon, nodes) => {
        const { routes } = get();
        const now = Date.now();
        const id = `user-${now}-${Math.random().toString(36).slice(2, 8)}`;
        const newRoute: RouteDefinition = {
          id,
          name: name.trim() || '新路线',
          icon: icon || '⭐',
          nodes: nodes && nodes.length > 0 ? nodes : [DEFAULT_ROUTE_NODES[0]],
          isPreset: false,
          createdAt: now,
          updatedAt: now,
        };
        set({
          routes: [...routes, newRoute],
          activeRouteId: id,
          route: { nodes: newRoute.nodes, updatedAt: now },
        });
        return id;
      },

      updateRouteMeta: (id, meta) => {
        const { routes, activeRouteId } = get();
        const now = Date.now();
        const next = routes.map((r) =>
          r.id === id
            ? {
                ...r,
                name: meta.name !== undefined ? meta.name : r.name,
                icon: meta.icon !== undefined ? meta.icon : r.icon,
                updatedAt: now,
              }
            : r,
        );
        set({ routes: next, route: deriveRoute(next, activeRouteId) });
      },

      updateRouteNodes: (id, nodes) => {
        const { routes, activeRouteId } = get();
        const now = Date.now();
        const next = routes.map((r) =>
          r.id === id ? { ...r, nodes, updatedAt: now } : r,
        );
        set({ routes: next, route: deriveRoute(next, activeRouteId) });
      },

      deleteRoute: (id) => {
        const { routes, activeRouteId } = get();
        const target = routes.find((r) => r.id === id);
        if (!target || target.isPreset) return false;
        const next = routes.filter((r) => r.id !== id);
        if (next.length === 0) return false; // 至少保留一条
        const newActiveId = activeRouteId === id ? next[0].id : activeRouteId;
        set({
          routes: next,
          activeRouteId: newActiveId,
          route: deriveRoute(next, newActiveId),
        });
        return true;
      },

      resetAll: () => {
        const presets = buildPresetRoutes();
        set({
          routes: presets,
          activeRouteId: PRESET_ROUTE_IDS.weekday,
          route: { nodes: DEFAULT_ROUTE_NODES, updatedAt: Date.now() },
        });
      },
    }),
    {
      name: 'family-eng-route',
      version: 2,
      // 迁移：旧版本只有 route 字段，新版本初始化预置路线
      migrate: (_persisted: unknown, version: number) => {
        const presets = buildPresetRoutes();
        if (version < 2) {
          // 旧版本：忽略旧 route，使用预置路线
          return {
            routes: presets,
            activeRouteId: PRESET_ROUTE_IDS.weekday,
            route: { nodes: DEFAULT_ROUTE_NODES, updatedAt: Date.now() },
          };
        }
        return _persisted as RouteState;
      },
    },
  ),
);
