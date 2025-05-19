import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Layout Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';

// Main Pages
import Home from './pages/Home';
import About from './pages/About';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Register from './pages/Register';
import NotFound from './pages/NotFound';
import FAQ from './pages/FAQ';
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

// Layout component with Navbar and Footer
const Layout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex flex-col min-h-screen">
    <Navbar />
    <main className="flex-grow">
      {children}
    </main>
    <Footer />
  </div>
);

// Dashboard layout (without navbar/footer)
const DashboardLayout = ({ children }: { children: React.ReactNode }) => (
  <>{children}</>
);

const App: React.FC = () => {
  return (
    <Router>
      <ToastContainer position="top-right" autoClose={5000} />
      <Routes>
        {/* Public Routes with Layout */}
        <Route 
          path="/" 
          element={
            <Layout>
              <Home />
            </Layout>
          } 
        />
        <Route 
          path="/about" 
          element={
            <Layout>
              <About />
            </Layout>
          } 
        />
        <Route 
          path="/login" 
          element={
            <Layout>
              <Login />
            </Layout>
          } 
        />
        <Route 
          path="/register" 
          element={
            <Layout>
              <Register />
            </Layout>
          } 
        />        <Route 
          path="/faq" 
          element={
            <Layout>
              <FAQ />
            </Layout>
          } 
        />
        <Route 
          path="/contact" 
          element={
            <Layout>
              <Contact />
            </Layout>
          } 
        />
        <Route 
          path="/staff-login" 
          element={
            <Layout>
              <StaffLogin />
            </Layout>
          } 
        />
        <Route 
          path="/agent-login" 
          element={
            <Layout>
              <AgentLogin />
            </Layout>
          } 
        />        <Route 
          path="/forgot-password" 
          element={
            <Layout>
              <ResetPassword />
            </Layout>
          } 
        />        <Route 
          path="/track-complaint" 
          element={
            <Layout>
              <TrackComplaint />
            </Layout>
          } 
        />
        <Route 
          path="/submit-complaint" 
          element={
            <Layout>
              <ExternalComplaint />
            </Layout>
          } 
        />

        {/* Protected Dashboard Routes - No Layout (they have their own) */}
        <Route 
          path="/standard/*" 
          element={
            <ProtectedRoute 
              element={
                <DashboardLayout>
                  <Suspense fallback={<LoadingFallback />}>
                    <StandardUserDashboard />
                  </Suspense>
                </DashboardLayout>
              } 
            />
          } 
        />
        <Route 
          path="/anonymous/*" 
          element={
            <ProtectedRoute 
              element={
                <DashboardLayout>
                  <Suspense fallback={<LoadingFallback />}>
                    <AnonymousDashboard />
                  </Suspense>
                </DashboardLayout>
              } 
            />
          } 
        />
        <Route 
          path="/agent/*" 
          element={
            <ProtectedRoute 
              element={
                <DashboardLayout>
                  <Suspense fallback={<LoadingFallback />}>
                    <AgentDashboard />
                  </Suspense>
                </DashboardLayout>
              } 
            />
          } 
        />
        <Route 
          path="/admin/*" 
          element={
            <ProtectedRoute 
              element={
                <DashboardLayout>
                  <Suspense fallback={<LoadingFallback />}>
                    <AdminDashboard />
                  </Suspense>
                </DashboardLayout>
              } 
            />
          } 
        />

        {/* 404 Route */}
        <Route 
          path="*" 
          element={
            <Layout>
              <NotFound />
            </Layout>
          } 
        />
      </Routes>
    </Router>
  );
};

export default App;