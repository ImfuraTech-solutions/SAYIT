import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AnComplaints from './AnComplaints';
import AnSubmitComplaint from './AnSubmitComplaint';
import AnNotifications from './AnNotifications';

const AnonymousDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'complaints' | 'notifications'>('complaints');
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [showNewComplaintModal, setShowNewComplaintModal] = useState(false);

  // Check if user is authenticated as anonymous user
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('userData');
    
    if (!token || !userData) {
      navigate('/login');
      return;
    }
    
    const parsedUserData = JSON.parse(userData);
    if (parsedUserData.role !== 'anonymous_user') {
      navigate('/login');
    }
  }, [navigate]);

  // Fetch unread notifications count
  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await axios.get('/api/anonymous/notifications/unread-count');
      if (response.data.success) {
        setUnreadCount(response.data.data.count || 0);
      }
    } catch (error) {
      console.error('Error fetching unread notifications count:', error);
    }
  }, []);

  // Initial data loading
  useEffect(() => {
    fetchUnreadCount();
    
    // Check for updates every 60 seconds
    const updateCheckInterval = setInterval(() => {
      fetchUnreadCount();
    }, 60000);
    
    return () => {
      clearInterval(updateCheckInterval);
    };
  }, [fetchUnreadCount]);

  // Update unread count after notifications are read
  const updateUnreadCount = (newCount: number) => {
    setUnreadCount(newCount);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Anonymous User Portal</h1>
          <div className="flex space-x-4">
            <button 
              onClick={() => setShowNewComplaintModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              New Complaint
            </button>
            <div className="relative">
              <button
                onClick={() => setActiveTab('notifications')}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('complaints')}
              className={`${
                activeTab === 'complaints'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm`}
            >
              My Complaints
            </button>
            <button
              onClick={() => setActiveTab('notifications')}
              className={`${
                activeTab === 'notifications'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap pb-4 px-1 border-b-2 font-medium text-sm flex items-center`}
            >
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {unreadCount}
                </span>
              )}
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === 'complaints' && (
          <AnComplaints />
        )}

        {activeTab === 'notifications' && (
          <AnNotifications onUpdateUnreadCount={updateUnreadCount} />
        )}
      </main>

      {/* New Complaint Modal */}
      {showNewComplaintModal && (
        <AnSubmitComplaint 
          isOpen={showNewComplaintModal} 
          onClose={() => setShowNewComplaintModal(false)} 
        />
      )}
    </div>
  );
};

export default AnonymousDashboard;