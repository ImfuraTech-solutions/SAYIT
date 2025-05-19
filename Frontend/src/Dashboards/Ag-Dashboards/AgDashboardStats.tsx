import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { format, parseISO } from 'date-fns';

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

interface ComplaintStats {
  total: number;
  pending: number;
  inProgress: number;
  resolved: number;
  closed: number;
  rejected: number;
}

interface TimelineItem {
  date: string;
  count: number;
}

interface AgDashboardStatsProps {
  agentProfile: AgentProfile | null;
}

const AgDashboardStats: React.FC<AgDashboardStatsProps> = ({ agentProfile }) => {
  // Stats state
  const [stats, setStats] = useState<ComplaintStats>({
    total: 0,
    pending: 0,
    inProgress: 0,
    resolved: 0,
    closed: 0,
    rejected: 0
  });
  
  const [recentComplaints, setRecentComplaints] = useState<any[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [performanceRating, setPerformanceRating] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter' | 'year'>('week');

  // Fetch dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    if (!agentProfile) return;
    
    setLoading(true);
    
    try {
      const response = await axios.get(`/api/agent/dashboard/stats?timeRange=${timeRange}`);
      
      if (response.data.success) {
        setStats(response.data.data.stats);
        setRecentComplaints(response.data.data.recentComplaints || []);
        setUpcomingDeadlines(response.data.data.upcomingDeadlines || []);
        setTimeline(response.data.data.timeline || []);
        setPerformanceRating(response.data.data.performanceRating || 0);
      } else {
        toast.error('Failed to load dashboard statistics');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      toast.error('Could not load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [agentProfile, timeRange]);

  // Load data when component mounts or time range changes
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Get status color class
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'under_review': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format status for display
  const formatStatus = (status: string): string => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Calculate urgency color
  const getUrgencyColor = (days: number): string => {
    if (days < 0) return 'text-red-600'; // Overdue
    if (days < 2) return 'text-orange-500'; // Very urgent
    if (days < 5) return 'text-yellow-500'; // Urgent
    return 'text-green-500'; // Normal
  };

  // Get performance rating color
  const getPerformanceColor = (rating: number): string => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-blue-600';
    if (rating >= 2.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading && !stats.total) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome message */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold text-gray-800">
          Welcome back, {agentProfile?.name.split(' ')[0] || 'Agent'}
        </h1>
        <p className="mt-1 text-gray-600">
          Here's an overview of complaints assigned to you and your agency's performance
        </p>
        
        {/* Time range selector */}
        <div className="mt-4 flex justify-end">
          <div className="relative inline-block w-48">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="block appearance-none w-full bg-white border border-gray-300 hover:border-gray-400 px-4 py-2 pr-8 rounded shadow leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
              <option value="quarter">Last 3 months</option>
              <option value="year">Last 12 months</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
              <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">Total Assigned</h2>
              <p className="text-3xl font-semibold text-gray-800">{stats.total}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Pending</span>
              <span className="font-medium text-gray-800">{stats.pending}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-yellow-500 h-2 rounded-full" 
                style={{ width: `${stats.total ? (stats.pending / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">Resolved</h2>
              <p className="text-3xl font-semibold text-gray-800">{stats.resolved + stats.closed}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Resolution Rate</span>
              <span className="font-medium text-gray-800">
                {stats.total ? Math.round(((stats.resolved + stats.closed) / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${stats.total ? ((stats.resolved + stats.closed) / stats.total) * 100 : 0}%` }}
              ></div>
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="text-sm font-medium text-gray-600">In Progress</h2>
              <p className="text-3xl font-semibold text-gray-800">{stats.inProgress}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Performance Rating</span>
              <div className="flex items-center">
                <span className={`font-medium ${getPerformanceColor(performanceRating)}`}>
                  {performanceRating.toFixed(1)}
                </span>
                <svg className={`h-4 w-4 ml-1 ${getPerformanceColor(performanceRating)}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118l-2.8-2.034c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
              <div 
                className={`h-2 rounded-full ${
                  performanceRating >= 4.5 ? 'bg-green-500' :
                  performanceRating >= 3.5 ? 'bg-blue-500' :
                  performanceRating >= 2.5 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${(performanceRating / 5) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Complaints timeline chart */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Complaint Activity</h2>
        
        {timeline.length > 0 ? (
          <div className="h-64">
            <div className="flex h-full items-end">
              {timeline.map((item, index) => (
                <div 
                  key={index}
                  className="flex flex-col items-center flex-1"
                >
                  <div 
                    className="w-full bg-blue-500 rounded-t"
                    style={{ 
                      height: `${(item.count / Math.max(...timeline.map(i => i.count), 1)) * 100}%`,
                      minHeight: item.count > 0 ? '20px' : '4px',
                      backgroundColor: item.count > 0 ? '#3B82F6' : '#E5E7EB'
                    }}
                  ></div>
                  <div className="text-xs text-gray-500 mt-2 -rotate-45 origin-top-left">
                    {format(new Date(item.date), 'MMM d')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <svg className="h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2">No activity data available for this period</p>
          </div>
        )}
      </div>

      {/* Recent complaints and Upcoming deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent complaints */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Recent Complaints</h2>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {recentComplaints.length > 0 ? (
              recentComplaints.map((complaint) => (
                <div key={complaint._id} className="px-6 py-4 hover:bg-gray-50">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-medium text-gray-800 line-clamp-1">{complaint.title}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        #{complaint.complaintNumber} • {format(new Date(complaint.createdAt), 'MMM d, yyyy')}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                      {formatStatus(complaint.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 line-clamp-2">{complaint.description}</p>
                </div>
              ))
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="mt-2">No recent complaints to display</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Upcoming deadlines */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">Upcoming Deadlines</h2>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-96 overflow-y-auto">
            {upcomingDeadlines.length > 0 ? (
              upcomingDeadlines.map((complaint) => {
                const deadlineDate = parseISO(complaint.expectedResolutionDate);
                const today = new Date();
                const daysLeft = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isOverdue = daysLeft < 0;
                
                return (
                  <div key={complaint._id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-medium text-gray-800 line-clamp-1">{complaint.title}</h3>
                        <p className="text-xs text-gray-500 mt-1">
                          #{complaint.complaintNumber}
                        </p>
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(complaint.status)}`}>
                        {formatStatus(complaint.status)}
                      </span>
                    </div>
                    
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center">
                        <svg className="h-4 w-4 text-gray-500 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-gray-600">
                          Due {format(deadlineDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                      
                      <div className={`text-xs font-medium ${getUrgencyColor(daysLeft)}`}>
                        {isOverdue ? (
                          <span className="inline-flex items-center">
                            <svg className="h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            Overdue by {Math.abs(daysLeft)} day{Math.abs(daysLeft) !== 1 ? 's' : ''}
                          </span>
                        ) : (
                          <span>{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-8 text-center text-gray-500">
                <svg className="mx-auto h-12 w-12 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="mt-2">No upcoming deadlines</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status breakdown */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Complaint Status Breakdown</h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
          <div className="bg-yellow-50 p-4 rounded-lg">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-yellow-700">{stats.pending}</span>
              <span className="text-sm text-yellow-600 mt-1">Pending</span>
            </div>
          </div>
          
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-blue-700">{stats.inProgress}</span>
              <span className="text-sm text-blue-600 mt-1">In Progress</span>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-green-700">{stats.resolved}</span>
              <span className="text-sm text-green-600 mt-1">Resolved</span>
            </div>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-gray-700">{stats.closed}</span>
              <span className="text-sm text-gray-600 mt-1">Closed</span>
            </div>
          </div>
          
          <div className="bg-red-50 p-4 rounded-lg">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-red-700">{stats.rejected}</span>
              <span className="text-sm text-red-600 mt-1">Rejected</span>
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-purple-700">{stats.total}</span>
              <span className="text-sm text-purple-600 mt-1">Total</span>
            </div>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <button
            onClick={() => (window as any).dispatchEvent(new CustomEvent('view-pending-complaints'))}
            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-800">View Pending Complaints</h3>
              <p className="text-xs text-gray-500 mt-1">Complaints awaiting your action</p>
            </div>
          </button>
          
          <button
            onClick={() => (window as any).dispatchEvent(new CustomEvent('view-overdue-complaints'))}
            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-3 rounded-full bg-red-100 text-red-600">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-800">View Overdue Items</h3>
              <p className="text-xs text-gray-500 mt-1">Complaints past due date</p>
            </div>
          </button>
          
          <button
            onClick={() => (window as any).dispatchEvent(new CustomEvent('view-resolved-complaints'))}
            className="flex items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-800">View Resolved Issues</h3>
              <p className="text-xs text-gray-500 mt-1">Successfully handled complaints</p>
            </div>
          </button>
        </div>
      </div>

      {/* Performance tips */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">Performance Tips</h3>
            <div className="mt-2 text-sm text-blue-700">
              <ul className="list-disc pl-5 space-y-1">
                <li>Respond to new complaints within 24 hours</li>
                <li>Update complaint status regularly to keep citizens informed</li>
                <li>Prioritize complaints that are approaching their deadline</li>
                <li>Follow up with resolved complaints to ensure citizen satisfaction</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgDashboardStats;