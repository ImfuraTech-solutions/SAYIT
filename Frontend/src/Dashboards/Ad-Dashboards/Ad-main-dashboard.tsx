import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

import AdDashboardStats from './AdDashboardStats';
import AdStaffManagement from './AdStaffManagement';
import AdAgencyManagement from './AdAgencyManagement';
import AdAgentManagement from './AdAgentManagement';
import AdUserManagement from './AdUserManagement';
import AdCategoryManagement from './AdCategoryManagement';

// Types
interface AdminProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
  profileImage?: string;
  lastLogin?: string;
}

type ActiveView = 
  | 'dashboard' 
  | 'staff' 
  | 'agencies' 
  | 'agents' 
  | 'users' 
  | 'categories';

const AdminDashboard: React.FC = () => {
  // State
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  
  const navigate = useNavigate();

  // Fetch admin profile
  const fetchAdminProfile = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/profile');
      if (response.data.success) {
        setAdminProfile(response.data.data);
      } else {
        setError('Failed to load admin profile');
        toast.error('Failed to load your profile');
      }
    } catch (error) {
      console.error('Error fetching admin profile:', error);
      setError('Could not load admin profile. Please try again later.');
      toast.error('Session expired or invalid. Please login again.');
      
      // Redirect to login after a short delay
      setTimeout(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        navigate('/login');
      }, 3000);
    } finally {
      setIsLoading(false);
    }
  }, [navigate]);
  
  // Initialize dashboard
  useEffect(() => {
    fetchAdminProfile();
  }, [fetchAdminProfile]);

  // Handle view change
  const handleViewChange = (view: ActiveView) => {
    setActiveView(view);
    setIsMobileMenuOpen(false); // Close mobile menu when view changes
  };

  // Toggle mobile menu
  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
    toast.info('You have been logged out');
  };
  if (isLoading) {
    return (
      <div className="admin-loading-container">
        <div className="admin-loading-content">
          <div className="admin-loading-spinner"></div>
          <p className="admin-loading-text">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-container">
        <div className="admin-error-content">
          <svg className="admin-error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="admin-error-title">Error Loading Dashboard</h2>
          <p className="admin-error-message">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="admin-error-button"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="admin-dashboard">
      {/* Top navigation */}
      <nav className="admin-nav">
        <div className="admin-nav-container">
          <div className="admin-nav-flex">
            <div className="admin-logo-section">
              <div className="admin-logo-container">
                <img
                  className="admin-logo"
                  src="/logo.png"
                  alt="SAYIT Logo"
                />
                <span className="admin-logo-text">SAYIT</span>
              </div>
              <div className="admin-nav-links">
                <button
                  onClick={() => handleViewChange('dashboard')}
                  className={`admin-nav-link ${
                    activeView === 'dashboard'
                      ? 'admin-nav-link-active'
                      : 'admin-nav-link-inactive'
                  }`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleViewChange('staff')}
                  className={`admin-nav-link ${
                    activeView === 'staff'
                      ? 'admin-nav-link-active'
                      : 'admin-nav-link-inactive'
                  }`}
                >
                  Staff
                </button>
                <button
                  onClick={() => handleViewChange('agencies')}
                  className={`admin-nav-link ${
                    activeView === 'agencies'
                      ? 'admin-nav-link-active'
                      : 'admin-nav-link-inactive'
                  }`}
                >
                  Agencies
                </button>
                <button
                  onClick={() => handleViewChange('agents')}
                  className={`admin-nav-link ${
                    activeView === 'agents'
                      ? 'admin-nav-link-active'
                      : 'admin-nav-link-inactive'
                  }`}
                >
                  Agents
                </button>
                <button
                  onClick={() => handleViewChange('users')}
                  className={`admin-nav-link ${
                    activeView === 'users'
                      ? 'admin-nav-link-active'
                      : 'admin-nav-link-inactive'
                  }`}
                >
                  Users
                </button>
                <button
                  onClick={() => handleViewChange('categories')}
                  className={`admin-nav-link ${
                    activeView === 'categories'
                      ? 'admin-nav-link-active'
                      : 'admin-nav-link-inactive'
                  }`}
                >
                  Categories
                </button>
              </div>
            </div>
              {/* Right side navigation items */}
            <div className="admin-nav-right">              
              {/* Profile info */}
              <div className="admin-profile-section">
                <div className="admin-profile-container">
                  <div className="admin-profile-image-container">
                    {adminProfile?.profileImage ? (
                      <img
                        className="admin-profile-image"
                        src={adminProfile.profileImage}
                        alt={`${adminProfile.name}'s profile`}
                      />
                    ) : (
                      <div className="admin-profile-initial">
                        {adminProfile?.name?.charAt(0).toUpperCase() || 'A'}
                      </div>
                    )}
                  </div>
                  <span className="admin-profile-name">{adminProfile?.name || 'Admin'}</span>
                </div>
              </div>
              
              {/* Logout button */}
              <div className="admin-logout-section">
                <button
                  onClick={handleLogout}
                  className="admin-logout-button"
                >
                  <span className="sr-only">Logout</span>
                  <svg className="admin-logout-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
              {/* Mobile menu button */}
            <div className="admin-mobile-menu-button-container">
              <button
                onClick={toggleMobileMenu}
                className="admin-mobile-menu-button"
              >
                <span className="sr-only">{isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
                {/* Icon when menu is closed */}
                <svg
                  className={`admin-mobile-menu-icon ${isMobileMenuOpen ? 'hidden' : 'block'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
                {/* Icon when menu is open */}
                <svg
                  className={`admin-mobile-menu-icon ${isMobileMenuOpen ? 'block' : 'hidden'}`}
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
          {/* Mobile menu */}
        <div className={`admin-mobile-menu ${isMobileMenuOpen ? 'block' : 'hidden'}`}>
          <div className="admin-mobile-menu-links">
            <button
              onClick={() => handleViewChange('dashboard')}
              className={`admin-mobile-menu-link ${
                activeView === 'dashboard'
                  ? 'admin-mobile-menu-link-active'
                  : 'admin-mobile-menu-link-inactive'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleViewChange('staff')}
              className={`admin-mobile-menu-link ${
                activeView === 'staff'
                  ? 'admin-mobile-menu-link-active'
                  : 'admin-mobile-menu-link-inactive'
              }`}
            >
              Staff Management
            </button>
            <button
              onClick={() => handleViewChange('agencies')}
              className={`admin-mobile-menu-link ${
                activeView === 'agencies'
                  ? 'admin-mobile-menu-link-active'
                  : 'admin-mobile-menu-link-inactive'
              }`}
            >              Agency Management
            </button>
            <button
              onClick={() => handleViewChange('agents')}
              className={`admin-mobile-menu-link ${
                activeView === 'agents'
                  ? 'admin-mobile-menu-link-active'
                  : 'admin-mobile-menu-link-inactive'
              }`}
            >
              Agent Management
            </button>
            <button
              onClick={() => handleViewChange('users')}
              className={`admin-mobile-menu-link ${
                activeView === 'users'
                  ? 'admin-mobile-menu-link-active'
                  : 'admin-mobile-menu-link-inactive'
              }`}
            >
              User Management
            </button>
            <button
              onClick={() => handleViewChange('categories')}
              className={`admin-mobile-menu-link ${
                activeView === 'categories'
                  ? 'admin-mobile-menu-link-active'
                  : 'admin-mobile-menu-link-inactive'
              }`}
            >
              Category Management
            </button>
            <button
              onClick={handleLogout}
              className="admin-mobile-menu-link admin-mobile-menu-link-inactive"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>      {/* Admin info panel */}
      <div className="admin-info-panel">
        <div className="admin-info-container">
          <div className="admin-info-flex">
            <div className="admin-info-image-container">
              {adminProfile?.profileImage ? (
                <img 
                  src={adminProfile.profileImage}
                  alt={`${adminProfile.name} Profile`}
                  className="admin-info-image"
                />
              ) : (
                <div className="admin-info-initial">
                  {adminProfile?.name?.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
            </div>
            <div className="admin-info-details">
              <h2 className="admin-info-name">{adminProfile?.name || 'Admin'}</h2>
              <p className="admin-info-meta">
                {adminProfile?.role || 'Administrator'} • Last login: {adminProfile?.lastLogin ? new Date(adminProfile.lastLogin).toLocaleDateString() : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="admin-main-content">
        {activeView === 'dashboard' && <AdDashboardStats adminProfile={adminProfile} />}
        {activeView === 'staff' && <AdStaffManagement adminProfile={adminProfile} />}
        {activeView === 'agencies' && <AdAgencyManagement adminProfile={adminProfile} />}
        {activeView === 'agents' && <AdAgentManagement adminProfile={adminProfile} />}
        {activeView === 'users' && <AdUserManagement adminProfile={adminProfile} />}
        {activeView === 'categories' && <AdCategoryManagement adminProfile={adminProfile} />}
      </div>
    </div>
  );
};

export default AdminDashboard;