import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import SymptomEntry from './pages/SymptomEntry';
import DiagnosisResult from './pages/DiagnosisResult';
import EmergencyView from './pages/EmergencyView';
import HealthTrends from './pages/HealthTrends';
import HospitalDashboard from './pages/HospitalDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import HealthVisualization from './pages/HealthVisualization';
import PatientConsultations from './pages/PatientConsultations';
import DoctorConsultations from './pages/DoctorConsultations';
import AdminConsultations from './pages/AdminConsultations';
import ChatbotPage from './pages/ChatbotPage';
import UserProfile from './pages/UserProfile';
import './index.css';
import AccessibilityProvider from './components/AccessibilityProvider';
import NotificationToast from './components/NotificationToast';

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent"></div></div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const getDefaultRoute = () => {
    if (!user) return '/login';
    switch (user.role) {
      case 'admin': return '/admin';
      case 'doctor': return '/doctor';
      default: return '/dashboard';
    }
  };

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/" element={<Navigate to={getDefaultRoute()} />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route path="/dashboard" element={<PatientDashboard />} />
        <Route path="/symptoms" element={<SymptomEntry />} />
        <Route path="/diagnosis/:id" element={<DiagnosisResult />} />
        <Route path="/emergency/:id" element={<EmergencyView />} />
        <Route path="/health-trends" element={<HealthTrends />} />
        <Route path="/visualization" element={<HealthVisualization />} />
        <Route path="/consultations" element={<ProtectedRoute roles={['patient']}><PatientConsultations /></ProtectedRoute>} />
        <Route path="/profile" element={<UserProfile />} />
        <Route path="/chatbot" element={<ProtectedRoute roles={['patient']}><ChatbotPage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute roles={['admin']}><HospitalDashboard /></ProtectedRoute>} />
        <Route path="/admin/consultations" element={<ProtectedRoute roles={['admin']}><AdminConsultations /></ProtectedRoute>} />
        <Route path="/doctor" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
        <Route path="/doctor/consultations" element={<ProtectedRoute roles={['doctor']}><DoctorConsultations /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AccessibilityProvider>
        <AuthProvider>
          <div id="google_translate_element" style={{ display: 'none' }} />
          <NotificationToast />
          <AppRoutes />
        </AuthProvider>
      </AccessibilityProvider>
    </BrowserRouter>
  );
}
