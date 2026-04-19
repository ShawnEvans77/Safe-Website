import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./Landingpage";
import { SafeCopilot } from "./SafeCopilot";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/chat" element={<SafeCopilot />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
