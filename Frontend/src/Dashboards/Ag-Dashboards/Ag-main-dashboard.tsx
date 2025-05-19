import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';

import AgDashboardStats from './AgDashboardStats';
import AgComplaints from './AgComplaints';
import AgProfile from './AgProfile';
import AgNotifications from './AgNotifications';
import AgFeedbacks from './AgFeedbacks';

// Types
interface AgentProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  agency: {
    _id: string;
    name: string;
    logo?: string;
    description?: string;
  };
  position?: string;
  employeeId?: string;
  department?: string;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
  relatedTo?: {
    type: string;
    id: string;
  };
}

type ActiveView = 'home' | 'complaints' | 'notifications' | 'settings' | 'profile' | 'feedbacks';

const AgentDashboard: React.FC = () => {
  // State
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [agentProfile, setAgentProfile] = useState<AgentProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  
  const navigate = useNavigate();

  // Fetch agent profile
  const fetchAgentProfile = useCallback(async () => {
    try {
      const response = await axios.get('/api/agent/profile');
      if (response.data.success) {
        setAgentProfile(response.data.data);
      } else {
        setError('Failed to load agent profile');
        toast.error('Failed to load your profile');
      }
    } catch (error) {
      console.error('Error fetching agent profile:', error);
      setError('Could not load agent profile. Please try again later.');
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

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await axios.get('/api/agent/notifications');
      if (response.data.success) {
        setNotifications(response.data.data);
        
        // Count unread notifications
        const unreadCount = response.data.data.filter(
          (notification: Notification) => !notification.isRead
        ).length;
        setUnreadNotificationsCount(unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  }, []);
  
  // Initialize dashboard
  useEffect(() => {
    fetchAgentProfile();
    fetchNotifications();
    
    // Set up notification polling (every 2 minutes)
    const notificationInterval = setInterval(fetchNotifications, 120000);
    
    return () => {
      clearInterval(notificationInterval);
    };
  }, [fetchAgentProfile, fetchNotifications]);

  // Mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await axios.put(`/api/agent/notifications/${notificationId}/read`);
      fetchNotifications(); // Refresh notifications
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Handle read all notifications
  const markAllNotificationsAsRead = async () => {
    try {
      await axios.put('/api/agent/notifications/read-all');
      fetchNotifications(); // Refresh notifications
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark notifications as read');
    }
  };

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
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center max-w-md p-8 bg-white shadow-md rounded-lg">
          <svg className="h-16 w-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h2 className="mt-4 text-xl font-bold text-gray-800">Error Loading Dashboard</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top navigation */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <img
                  className="h-8 w-auto"
                  src="/logo.png"
                  alt="SAYIT Logo"
                />
                <span className="ml-2 text-xl font-semibold text-gray-800">SAYIT</span>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => handleViewChange('home')}
                  className={`${
                    activeView === 'home'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Dashboard
                </button>
                <button
                  onClick={() => handleViewChange('complaints')}
                  className={`${
                    activeView === 'complaints'
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Complaints
                </button>
              </div>
            </div>
            
            {/* Right side navigation items */}
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              {/* Notifications dropdown */}
              <div className="ml-3 relative">
                <button
                  onClick={() => handleViewChange('notifications')}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 relative"
                >
                  <span className="sr-only">View notifications</span>
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadNotificationsCount > 0 && (
                    <span className="absolute top-0 right-0 block h-5 w-5 rounded-full bg-red-500 text-white text-xs font-medium flex items-center justify-center transform -translate-y-1/2 translate-x-1/2">
                      {unreadNotificationsCount}
                    </span>
                  )}
                </button>
              </div>
              
              {/* Profile dropdown */}
              <div className="ml-3 relative">
                <div>
                  <button
                    onClick={() => handleViewChange('profile')}
                    className="max-w-xs bg-white flex items-center text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100">
                      {agentProfile?.profileImage ? (
                        <img
                          className="h-full w-full object-cover"
                          src={agentProfile.profileImage}
                          alt={`${agentProfile.name}'s profile`}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-blue-500 text-white">
                          {agentProfile?.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </div>
              
              {/* Settings button */}
              <div className="ml-3 relative">
                <button
                  onClick={() => handleViewChange('settings')}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Settings</span>
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
              </div>
              
              {/* Logout button */}
              <div className="ml-3 relative">
                <button
                  onClick={handleLogout}
                  className="p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <span className="sr-only">Logout</span>
                  <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Mobile menu button */}
            <div className="-mr-2 flex items-center sm:hidden">
              <button
                onClick={toggleMobileMenu}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              >
                <span className="sr-only">{isMobileMenuOpen ? 'Close main menu' : 'Open main menu'}</span>
                {/* Icon when menu is closed */}
                <svg
                  className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`}
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
                  className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`}
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
        <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} sm:hidden`}>
          <div className="pt-2 pb-3 space-y-1">
            <button
              onClick={() => handleViewChange('home')}
              className={`${
                activeView === 'home'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
            >
              Dashboard
            </button>
            <button
              onClick={() => handleViewChange('complaints')}
              className={`${
                activeView === 'complaints'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
            >
              Complaints
            </button>
            <button
              onClick={() => handleViewChange('notifications')}
              className={`${
                activeView === 'notifications'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left flex items-center justify-between`}
            >
              <span>Notifications</span>
              {unreadNotificationsCount > 0 && (
                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-xs">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => handleViewChange('settings')}
              className={`${
                activeView === 'settings'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
            >
              Settings
            </button>
            <button
              onClick={() => handleViewChange('profile')}
              className={`${
                activeView === 'profile'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
            >
              Profile
            </button>
            <button
              onClick={() => handleViewChange('feedbacks')}
              className={`${
                activeView === 'feedbacks'
                  ? 'bg-blue-50 border-blue-500 text-blue-700'
                  : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
              } block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left`}
            >
              Feedbacks
            </button>
            <button
              onClick={handleLogout}
              className="border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800 block pl-3 pr-4 py-2 border-l-4 text-base font-medium w-full text-left"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Agency information panel */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-12 w-12 rounded-md overflow-hidden bg-gray-100">
              {agentProfile?.agency?.logo ? (
                <img 
                  src={agentProfile.agency.logo}
                  alt={`${agentProfile.agency.name} Logo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-blue-200 text-blue-700 font-semibold">
                  {agentProfile?.agency?.name.charAt(0).toUpperCase() || 'A'}
                </div>
              )}
            </div>
            <div className="ml-4">
              <h2 className="text-xl font-semibold text-gray-800">{agentProfile?.agency?.name}</h2>
              <p className="text-sm text-gray-500">
                {agentProfile?.position || 'Agent'} • {agentProfile?.department || 'General Department'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {activeView === 'home' && <AgDashboardStats agentProfile={agentProfile} />}
        {activeView === 'complaints' && <AgComplaints agentProfile={agentProfile} />}
        {activeView === 'notifications' && (
          <AgNotifications 
            notifications={notifications}
            markAsRead={markNotificationAsRead}
            markAllAsRead={markAllNotificationsAsRead}
            refreshNotifications={fetchNotifications}
          />
        )}
        {activeView === 'profile' && <AgProfile agentProfile={agentProfile} onUpdateProfile={fetchAgentProfile} />}
        {activeView === 'feedbacks' && <AgFeedbacks />}
      </div>
    </div>
  );
};

export default AgentDashboard;