import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';


import StComplaints from './StComplaints';
import StNotifications from './StNotifications';
import StSubmitComplaint from './StSubmitComplaint';
import StDashboardStats from './StDashboardStats';
import StSettings from './StSettings';
import StProfile from './StProfile';

// Types
interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  preferences: {
    language: string;
    notificationSettings: {
      email: boolean;
      app: boolean;
    };
  };
}

type ActiveView = 'home' | 'complaints' | 'notifications' | 'settings' | 'profile';

const StandardUserDashboard: React.FC = () => {
  const navigate = useNavigate();
  
  // State management
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [activeView, setActiveView] = useState<ActiveView>('home');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if user is authenticated as standard user
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    
    try {
      const parsedUserData = JSON.parse(userData);
      if (parsedUserData.role !== 'citizen') {
        toast.error('Access denied. Standard user account required.');
        navigate('/login');
      }
    } catch (error) {
      console.error('Error parsing user data:', error);
      navigate('/login');
    }
  }, [navigate]);

  // Fetch user profile data
  const fetchUserProfile = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/standarduser/profile');
      
      if (response.data.success) {
        setUserProfile(response.data.data);
      } else {
        setError('Failed to load user profile');
        toast.error('Failed to load user profile');
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError('Failed to load user profile. Please try again.');
      toast.error('Failed to load user profile');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch unread notifications count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get('/api/standarduser/notifications?read=false&limit=1');
      
      if (response.data.success) {
        setUnreadCount(response.data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
      // Don't show error toast for this non-critical operation
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    fetchUserProfile();
    fetchUnreadCount();
  }, [fetchUserProfile, fetchUnreadCount]);

  // Update unread count after notifications are read
  const updateUnreadCount = (newCount: number) => {
    setUnreadCount(newCount);
  };

  // Handle new complaint submission
  const handleNewComplaintClick = () => {
    setShowNewComplaintModal(true);
  };

  // Handle complaint submission success
  const handleComplaintSubmitSuccess = () => {
    setShowNewComplaintModal(false);
    toast.success('Complaint submitted successfully!');
    
    // If we're not already on the complaints view, navigate there
    if (activeView !== 'complaints') {
      setActiveView('complaints');
    }
  };

  // Render active view content
  const renderActiveView = () => {
    switch (activeView) {
      case 'home':
        return <StDashboardStats />;
      case 'complaints':
        return <StComplaints />;
      case 'notifications':
        return <StNotifications onUpdateUnreadCount={updateUnreadCount} />;
      case 'settings':
        return <StSettings userProfile={userProfile} onUpdateProfile={fetchUserProfile} />;
      case 'profile':
        return <StProfile userProfile={userProfile} onUpdateProfile={fetchUserProfile} />;
      default:
        return <StDashboardStats />;
    }
  };

  // Loading state
  if (loading && !userProfile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !userProfile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center p-6 bg-white rounded-lg shadow-md">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold mt-4 text-gray-800">Dashboard Error</h2>
          <p className="mt-2 text-gray-600">{error}</p>
          <button 
            onClick={fetchUserProfile}
            className="mt-6 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white shadow-md hidden md:block">
        <div className="p-6">
          <h1 className="text-xl font-bold text-gray-800">SAYIT Platform</h1>
          <p className="text-sm text-gray-600 mt-1">Standard User Dashboard</p>
        </div>
        
        <div className="px-4 py-2">
          <button
            onClick={handleNewComplaintClick}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors flex items-center justify-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            New Complaint
          </button>
        </div>
        
        <nav className="mt-6">
          <div 
            className={`flex items-center px-4 py-3 cursor-pointer ${activeView === 'home' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveView('home')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            Dashboard
          </div>
          
          <div 
            className={`flex items-center px-4 py-3 cursor-pointer ${activeView === 'complaints' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveView('complaints')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            My Complaints
          </div>
          
          <div 
            className={`flex items-center justify-between px-4 py-3 cursor-pointer ${activeView === 'notifications' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveView('notifications')}
          >
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
            </div>
            {unreadCount > 0 && (
              <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          
          <div 
            className={`flex items-center px-4 py-3 cursor-pointer ${activeView === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveView('settings')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </div>
          
          <div 
            className={`flex items-center px-4 py-3 cursor-pointer ${activeView === 'profile' ? 'bg-blue-50 text-blue-600' : 'text-gray-700 hover:bg-gray-100'}`}
            onClick={() => setActiveView('profile')}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            My Profile
          </div>
        </nav>
        
        <div className="mt-auto p-4 border-t">
          <button
            onClick={() => {
              localStorage.removeItem('token');
              localStorage.removeItem('userData');
              navigate('/login');
            }}
            className="flex items-center text-red-600 hover:text-red-800 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Mobile Navigation Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around py-2 md:hidden z-10">
        <button 
          onClick={() => setActiveView('home')}
          className={`flex flex-col items-center justify-center p-2 ${activeView === 'home' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-xs mt-1">Home</span>
        </button>
        
        <button 
          onClick={() => setActiveView('complaints')}
          className={`flex flex-col items-center justify-center p-2 ${activeView === 'complaints' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-xs mt-1">Complaints</span>
        </button>
        
        <button 
          onClick={handleNewComplaintClick}
          className="flex flex-col items-center justify-center p-2 bg-blue-600 text-white rounded-full shadow-lg -mt-5"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        </button>
        
        <button 
          onClick={() => setActiveView('notifications')}
          className={`flex flex-col items-center justify-center p-2 relative ${activeView === 'notifications' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-500 rounded-full">
              {unreadCount}
            </span>
          )}
          <span className="text-xs mt-1">Alerts</span>
        </button>
        
        <button 
          onClick={() => setActiveView('profile')}
          className={`flex flex-col items-center justify-center p-2 ${activeView === 'profile' ? 'text-blue-600' : 'text-gray-600'}`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-xs mt-1">Profile</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <div className="flex items-center md:hidden">
              {/* Mobile menu button - if needed */}
            </div>
            
            <div className="flex-1 flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-900 md:hidden">
                {activeView === 'home' && 'Dashboard'}
                {activeView === 'complaints' && 'My Complaints'}
                {activeView === 'notifications' && 'Notifications'}
                {activeView === 'settings' && 'Settings'}
                {activeView === 'profile' && 'My Profile'}
              </h1>
              
              {/* User profile info */}
              <div className="ml-auto flex items-center">
                {userProfile && (
                  <div className="flex items-center">
                    <span className="hidden md:block text-sm text-gray-700 mr-4">
                      Welcome, {userProfile.name}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center overflow-hidden">
                      {userProfile.profileImage ? (
                        <img 
                          src={userProfile.profileImage} 
                          alt="Profile" 
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-lg font-medium text-gray-700">
                          {userProfile.name.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        
        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 md:p-8">
          {renderActiveView()}
        </main>
      </div>
      
      {/* New Complaint Modal */}
      {showNewComplaintModal && (
        <StSubmitComplaint
          isOpen={showNewComplaintModal}
          onClose={() => setShowNewComplaintModal(false)}
          onSuccess={handleComplaintSubmitSuccess}
        />
      )}
    </div>
  );
};

export default StandardUserDashboard;