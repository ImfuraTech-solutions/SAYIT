import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format } from 'date-fns';

// Notification type definition based on StandardUserNotification model
interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'complaint_update' | 'response_received' | 'system' | 'agency_update';
  read: boolean;
  priority: 'low' | 'normal' | 'high';
  createdAt: string;
  actions?: {
    label: string;
    url: string;
  }[];
  relatedId?: string;
  onModel?: 'Complaint' | 'Response' | 'Agency';
}

// Props for the component
interface StNotificationsProps {
  onUpdateUnreadCount: (count: number) => void;
}

// Filter options
type FilterOption = 'all' | 'unread' | 'complaint_update' | 'response_received' | 'system' | 'agency_update';

const StNotifications: React.FC<StNotificationsProps> = ({ onUpdateUnreadCount }) => {
  // State variables
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterOption>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [markAllLoading, setMarkAllLoading] = useState(false);

  // Fetch notifications based on filters
  const fetchNotifications = useCallback(async (resetPage = false) => {
    const currentPage = resetPage ? 1 : page;
    let endpoint = `/api/standarduser/notifications?page=${currentPage}&limit=10`;
    
    // Apply filters
    if (activeFilter === 'unread') {
      endpoint += '&read=false';
    } else if (activeFilter !== 'all') {
      endpoint += `&type=${activeFilter}`;
    }
    
    try {
      setLoading(true);
      const response = await axios.get(endpoint);
      
      if (response.data.success) {
        // If resetting page or first page, replace notifications
        // Otherwise append to existing notifications for pagination
        if (resetPage || currentPage === 1) {
          setNotifications(response.data.data.notifications);
        } else {
          setNotifications(prev => [...prev, ...response.data.data.notifications]);
        }
        
        // Update unread count in parent component
        onUpdateUnreadCount(response.data.data.unreadCount);
        
        // Check if there are more notifications to load
        setHasMore(response.data.data.notifications.length === 10);
        
        if (resetPage) {
          setPage(1);
        }
      } else {
        setError('Failed to load notifications');
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setError('Failed to load notifications. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [page, activeFilter, onUpdateUnreadCount]);

  // Initial load
  useEffect(() => {
    fetchNotifications(true);
  }, [activeFilter, fetchNotifications]);

  // Mark a notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await axios.patch(`/api/standarduser/notifications/${notificationId}/read`);
      
      if (response.data.success) {
        // Update local state to mark notification as read
        setNotifications(prev => 
          prev.map(notification => 
            notification._id === notificationId 
              ? { ...notification, read: true } 
              : notification
          )
        );
        
        // Update unread count
        onUpdateUnreadCount(response.data.data.unreadCount);
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Failed to mark notification as read');
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      setMarkAllLoading(true);
      const response = await axios.patch('/api/standarduser/notifications/mark-all-read');
      
      if (response.data.success) {
        // Update local state to mark all notifications as read
        setNotifications(prev => 
          prev.map(notification => ({ ...notification, read: true }))
        );
        
        // Update unread count
        onUpdateUnreadCount(0);
        toast.success('All notifications marked as read');
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Failed to mark all notifications as read');
    } finally {
      setMarkAllLoading(false);
    }
  };

  // Load more notifications (pagination)
  const loadMoreNotifications = () => {
    setPage(prev => prev + 1);
  };

  // Handle notification click - mark as read and follow action if available
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsRead(notification._id);
    }
    
    // If there's only one action, follow it automatically
    if (notification.actions && notification.actions.length === 1) {
      window.location.href = notification.actions[0].url;
    }
  };

  // Get appropriate color based on notification priority
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-red-500';
      case 'normal':
        return 'border-blue-500';
      case 'low':
        return 'border-gray-400';
      default:
        return 'border-gray-300';
    }
  };

  // Get appropriate icon based on notification type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'complaint_update':
        return (
          <div className="p-2 rounded-full bg-blue-100 text-blue-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        );
      case 'response_received':
        return (
          <div className="p-2 rounded-full bg-green-100 text-green-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        );
      case 'agency_update':
        return (
          <div className="p-2 rounded-full bg-purple-100 text-purple-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
        );
      default: // 'system' and fallback
        return (
          <div className="p-2 rounded-full bg-gray-100 text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  // Format notification date
  const formatNotificationDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      const now = new Date();
      
      // If today, show time
      if (date.toDateString() === now.toDateString()) {
        return format(date, 'h:mm a');
      }
      
      // If this year, show month and day
      if (date.getFullYear() === now.getFullYear()) {
        return format(date, 'MMM d');
      }
      
      // Otherwise show full date
      return format(date, 'MMM d, yyyy');
    } catch (error) {
      return 'Unknown date';
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4 sm:mb-0">Notifications</h2>
        
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 text-sm rounded-full ${
              activeFilter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter('unread')}
            className={`px-3 py-1.5 text-sm rounded-full ${
              activeFilter === 'unread' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Unread
          </button>
          <button
            onClick={() => setActiveFilter('complaint_update')}
            className={`px-3 py-1.5 text-sm rounded-full ${
              activeFilter === 'complaint_update' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Complaints
          </button>
          <button
            onClick={() => setActiveFilter('response_received')}
            className={`px-3 py-1.5 text-sm rounded-full ${
              activeFilter === 'response_received' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Responses
          </button>
          <button
            onClick={() => setActiveFilter('system')}
            className={`px-3 py-1.5 text-sm rounded-full ${
              activeFilter === 'system' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            System
          </button>
        </div>
      </div>

      {/* Mark All as Read button */}
      <div className="mb-4">
        <button
          onClick={markAllAsRead}
          disabled={markAllLoading || notifications.every(n => n.read)}
          className={`text-sm py-1 px-3 border rounded ${
            markAllLoading || notifications.every(n => n.read)
              ? 'border-gray-200 text-gray-400 cursor-not-allowed'
              : 'border-blue-500 text-blue-500 hover:bg-blue-50'
          }`}
        >
          {markAllLoading ? 'Processing...' : 'Mark all as read'}
        </button>
      </div>

      {/* Notifications list */}
      <div className="bg-white rounded-lg shadow overflow-hidden flex-grow">
        {loading && page === 1 ? (
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-3 text-gray-600">Loading notifications...</p>
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="mt-3 text-gray-600">{error}</p>
            <button
              onClick={() => fetchNotifications(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            <p className="mt-3 text-lg font-medium text-gray-900">No notifications</p>
            <p className="mt-1 text-gray-500">
              {activeFilter !== 'all' 
                ? 'Try changing your filter to see more notifications' 
                : 'You don\'t have any notifications yet'}
            </p>
          </div>
        ) : (
          <div>
            <ul className="divide-y divide-gray-200">
              {notifications.map(notification => (
                <li 
                  key={notification._id} 
                  onClick={() => handleNotificationClick(notification)}
                  className={`p-4 hover:bg-gray-50 cursor-pointer transition-colors border-l-4 ${getPriorityColor(notification.priority)} ${!notification.read ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-start">
                    <div className="flex-shrink-0 mr-3">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between">
                        <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-600'}`}>
                          {notification.title}
                        </p>
                        <p className="text-xs text-gray-500 whitespace-nowrap ml-2">
                          {formatNotificationDate(notification.createdAt)}
                        </p>
                      </div>
                      <p className={`text-sm mt-1 ${!notification.read ? 'text-gray-800' : 'text-gray-500'}`}>
                        {notification.message}
                      </p>
                      
                      {/* Action buttons */}
                      {notification.actions && notification.actions.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {notification.actions.map((action, index) => (
                            <a
                              key={index}
                              href={action.url}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!notification.read) {
                                  markAsRead(notification._id);
                                }
                              }}
                              className="text-sm px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-md text-gray-700 transition-colors inline-block"
                            >
                              {action.label}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                    
                    {/* Unread indicator */}
                    {!notification.read && (
                      <span className="flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full"></span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            
            {/* Load more button */}
            {hasMore && (
              <div className="p-4 text-center">
                <button
                  onClick={loadMoreNotifications}
                  disabled={loading}
                  className="text-blue-600 hover:text-blue-800 font-medium text-sm disabled:text-gray-400"
                >
                  {loading ? (
                    <>
                      <span className="inline-block animate-spin h-4 w-4 border-t-2 border-blue-600 border-r-2 rounded-full mr-2"></span>
                      Loading...
                    </>
                  ) : (
                    'Load more'
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default StNotifications;