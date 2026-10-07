import "@/App.css";
import { useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import Layout from "@/components/Layout";
import Login from "@/pages/Login";
import Pending from "@/pages/Pending";
import Dashboard from "@/pages/Dashboard";
import POS from "@/pages/POS";
import Caja from "@/pages/Caja";
import Inventario from "@/pages/Inventario";
import Ventas from "@/pages/Ventas";
import Alertas from "@/pages/Alertas";
import Usuarios from "@/pages/Usuarios";

const Loader = () => (
  <div className="min-h-screen grid place-items-center" data-testid="app-loader">
    <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
  </div>
);

function AuthCallback() {
  const done = useRef(false);
  const navigate = useNavigate();
  const { setUser } = useAuth();
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    const sid = new URLSearchParams(window.location.hash.slice(1)).get("session_id");
    api.post("/auth/session", { session_id: sid })
      .then(({ data }) => { setUser(data); navigate("/", { replace: true }); })
      .catch(() => navigate("/login", { replace: true }));
  }, [navigate, setUser]);
  return <Loader />;
}

function RequireAuth() {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user) return <Navigate to="/login" replace />;
  if (!user.permissions.length) return <Pending />;
  return <Layout><Outlet /></Layout>;
}

function Guard({ perm, children }) {
  const { can } = useAuth();
  return can(perm) ? children : <Navigate to="/" replace />;
}

function Home() {
  const { can } = useAuth();
  return <Navigate to={can("dashboard") ? "/dashboard" : "/pos"} replace />;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth />}>
        <Route path="/" element={<Home />} />
        <Route path="/dashboard" element={<Guard perm="dashboard"><Dashboard /></Guard>} />
        <Route path="/pos" element={<Guard perm="pos"><POS /></Guard>} />
        <Route path="/caja" element={<Guard perm="caja"><Caja /></Guard>} />
        <Route path="/inventario" element={<Guard perm="productos"><Inventario /></Guard>} />
        <Route path="/ventas" element={<Guard perm="ventas"><Ventas /></Guard>} />
        <Route path="/alertas" element={<Guard perm="alertas"><Alertas /></Guard>} />
        <Route path="/usuarios" element={<Guard perm="usuarios"><Usuarios /></Guard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}
