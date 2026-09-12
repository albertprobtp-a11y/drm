import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { LoginPage } from "./routes/sender/LoginPage";
import { RegisterPage } from "./routes/sender/RegisterPage";
import { DashboardPage } from "./routes/sender/DashboardPage";
import { DocumentDetailPage } from "./routes/sender/DocumentDetailPage";
import { AnalyticsPage } from "./routes/sender/AnalyticsPage";
import { ViewerPage } from "./routes/viewer/ViewerPage";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/viewer/:shareId" element={<ViewerPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/documents/:documentId" element={<DocumentDetailPage />} />
            <Route path="/shares/:shareId/analytics" element={<AnalyticsPage />} />
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
