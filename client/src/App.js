import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import Layout from "./Layout";
import RequireAuth from "./RequireAuth";

import Results from "./pages/Results";
import Teams from "./pages/Teams";
import RealTime from "./pages/RealTime";
import Profile from "./pages/Profile";

import { useEffect } from "react";
import { applyThemeByTeamId } from "./theme";

export default function App() {
  useEffect(() => {
  const userStr = localStorage.getItem("user");
  if (!userStr) return;
  const user = JSON.parse(userStr);
  applyThemeByTeamId(user.favorite_team_id);
}, []);
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login onLoggedIn={() => {}} />} />

        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/results" replace />} />
            <Route path="/results" element={<Results />} />
            <Route path="/teams" element={<Teams />} />
            <Route path="/realtime" element={<RealTime />} />
            <Route path="/profile" element={<Profile />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}