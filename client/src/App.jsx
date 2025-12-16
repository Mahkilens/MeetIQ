import { Navigate, Route, Routes } from "react-router-dom";
import Header from "./components/Header.jsx";
import UploadMeetingPage from "./pages/UploadMeetingPage.jsx";
import ResultsPage from "./pages/ResultsPage.jsx";

export default function App() {
  return (
    <div className="min-h-dvh bg-gradient-to-b from-slate-50 to-white text-slate-900">
      <Header />
      <Routes>
        <Route path="/" element={<UploadMeetingPage />} />
        <Route path="/results/:id" element={<ResultsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}
