import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './app.css';

// Main Pages
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import FAQ from './pages/FAQ';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import TrackComplaint from './pages/TrackComplaint';
import ExternalComplaint from './pages/ExternalComplaint';

// Auth Pages
import StaffLogin from './pages/StaffLogin';
import AgentLogin from './pages/AgentLogin';
import ResetPassword from './pages/Reset-password';

// Lazily loaded dashboard components
const StandardUserDashboard = lazy(() => import('./Dashboards/St-Dashboards/st-main-dashboard'));
const AnonymousDashboard = lazy(() => import('./Dashboards/An-Dashboards/An-Main-Dashboard'));
const AgentDashboard = lazy(() => import('./Dashboards/Ag-Dashboards/Ag-main-dashboard'));
const AdminDashboard = lazy(() => import('./Dashboards/Ad-Dashboards/Ad-main-dashboard'));

// Protected route component
const ProtectedRoute = ({ element }: { element: React.ReactNode }) => {
  const token = localStorage.getItem('token');
  return token ? <>{element}</> : <Navigate to="/login" />;
};

// Loading component for Suspense
const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center">
    <div className="flex flex-col items-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
      <p className="mt-4 text-gray-600">Loading...</p>
    </div>
  </div>
);

import Navbar from './components/Navbar';
import Footer from './components/Footer';

// ScrollToTop component
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App: React.FC = () => {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={5000} />
      <ScrollToTop />
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />        <Route path="/about" element={<About />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/staff-login" element={<StaffLogin />} />
        <Route path="/agent-login" element={<AgentLogin />} />
        <Route path="/forgot-password" element={<ResetPassword />} />
        <Route path="/track-complaint" element={<TrackComplaint />} />
        <Route path="/submit-complaint" element={<ExternalComplaint />} />
        {/* Protected Dashboard Routes */}
        <Route 
          path="/standard/*" 
          element={
            <ProtectedRoute 
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <StandardUserDashboard />
                </Suspense>
              } 
            />
          } 
        />
        <Route 
          path="/anonymous/*" 
          element={
            <ProtectedRoute 
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <AnonymousDashboard />
                </Suspense>
              } 
            />
          } 
        />
        <Route 
          path="/agent/*" 
          element={
            <ProtectedRoute 
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <AgentDashboard />
                </Suspense>
              } 
            />
          } 
        />
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute 
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <AdminDashboard />
                </Suspense>
              } 
            />
          } 
        />
        {/* 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </Router>
  );
};

export default App;