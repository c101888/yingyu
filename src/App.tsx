import { useEffect } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "@/pages/Home";
import DailyRoute from "@/pages/DailyRoute";
import SceneResult from "@/pages/SceneResult";
import Learn from "@/pages/Learn";
import Practice from "@/pages/Practice";
import Done from "@/pages/Done";
import HistoryPage from "@/pages/HistoryPage";
import Profile from "@/pages/Profile";
import Upgrade from "@/pages/Upgrade";
import Rewards from "@/pages/Rewards";
import LearnCenter from "@/pages/LearnCenter";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useUserStore } from "@/store/useUserStore";

export default function App() {
  const currentUser = useUserStore((s) => s.currentUser);
  const refreshMe = useUserStore((s) => s.refreshMe);

  // 应用启动时：如果有登录用户，验证 token 是否仍然有效
  // token 过期会清除 currentUser，避免"登录已过期"错误在操作时才暴露
  useEffect(() => {
    if (currentUser) {
      refreshMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/daily-route" element={<DailyRoute />} />
          <Route path="/scene-result" element={<SceneResult />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/done" element={<Done />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/upgrade" element={<Upgrade />} />
          <Route path="/rewards" element={<Rewards />} />
          <Route path="/learn-center" element={<LearnCenter />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
