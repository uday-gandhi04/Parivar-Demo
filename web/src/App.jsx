import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './lib/theme.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import { Layout } from './components/Layout.jsx';
import { LoginPage } from './pages/LoginPage.jsx';
import { AboutPage } from './pages/AboutPage.jsx';
import { DirectoryPage } from './pages/DirectoryPage.jsx';
import { GraphPage } from './pages/GraphPage.jsx';
import { ExplorePage } from './pages/ExplorePage.jsx';
import { ProfilePage } from './pages/ProfilePage.jsx';
import { NotFoundPage } from './pages/NotFoundPage.jsx';
import Contributors from './pages/Contributors';

function Spinner() {
  return (
    <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '100vh' }}>
      <div className="spinner-border text-secondary" role="status">
        <span className="visually-hidden">Loading…</span>
      </div>
    </div>
  );
}

function AuthGate({ children }) {
  const { member, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!member) return <Navigate to="/login" replace />;
  return children;
}

export function App() {
  return (
    <ThemeProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route element={<AuthGate><Layout /></AuthGate>}>
              <Route index element={<Navigate to="/directory" replace />} />
              <Route path="directory" element={<DirectoryPage />} />
              <Route path="graph" element={<GraphPage />} />
              <Route path="explore" element={<ExplorePage />} />
              <Route path=":mid" element={<ProfilePage />} />
              <Route path="/contributors" element={<Contributors />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
