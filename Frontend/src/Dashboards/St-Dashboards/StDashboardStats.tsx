import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

// Types
interface DashboardStats {
  totalComplaints: number;
  pendingComplaints: number;
  resolvedComplaints: number;
  closedComplaints: number;
  rejectedComplaints: number;
  complaintsByStatus: Record<string, number>;
  complaintsByCategory: Record<string, number>;
  complaintsTrend: {
    labels: string[];
    data: number[];
  };
  averageResolutionTime: number; // in days
  feedbackStats: {
    satisfactionAverage: number;
    totalFeedbacks: number;
  };
}

const StDashboardStats: React.FC = () => {
  // State
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  // Fetch dashboard statistics
  const fetchDashboardStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await axios.get(`/api/standarduser/dashboard/stats?timeRange=${timeRange}`);
      
      if (response.data.success) {
        setStats(response.data.data);
      } else {
        setError('Failed to load dashboard statistics');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('Could not load dashboard statistics. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  // Load data on component mount and when timeRange changes
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Chart options and configurations
  const statusChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          boxWidth: 12,
          padding: 15
        }
      },
      title: {
        display: true,
        text: 'Complaints by Status',
        font: {
          size: 16
        }
      }
    },
    maintainAspectRatio: false
  };

  // Helper for status colors
  const getStatusColor = (status: string): string => {
    switch (status.toLowerCase()) {
      case 'pending': return '#FBBF24'; // Amber-400
      case 'in_progress': return '#8B5CF6'; // Violet-500
      case 'under_review': return '#3B82F6'; // Blue-500
      case 'resolved': return '#10B981'; // Emerald-500  
      case 'closed': return '#6B7280'; // Gray-500
      case 'rejected': return '#EF4444'; // Red-500
      case 'assigned': return '#8B5CF6'; // Violet-500
      default: return '#CBD5E1'; // Slate-300
    }
  };

  // Prepare data for status doughnut chart
  const prepareStatusChartData = () => {
    if (!stats) return null;

    const statuses = Object.keys(stats.complaintsByStatus);
    const counts = Object.values(stats.complaintsByStatus);
    const backgroundColors = statuses.map(status => getStatusColor(status));

    // Format status labels to be more readable
    const formattedLabels = statuses.map(status => 
      status.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    );

    return {
      labels: formattedLabels,
      datasets: [
        {
          data: counts,
          backgroundColor: backgroundColors,
          borderColor: backgroundColors.map(color => color),
          borderWidth: 1
        }
      ]
    };
  };

  // Prepare data for category bar chart
  const prepareCategoryChartData = () => {
    if (!stats) return null;

    const categories = Object.keys(stats.complaintsByCategory);
    const counts = Object.values(stats.complaintsByCategory);
    
    // If there are more than 7 categories, group the smallest ones as "Others"
    let processedCategories = [...categories];
    let processedCounts = [...counts];
    
    if (categories.length > 7) {
      // Sort categories by count
      const categoryData = categories.map((category, index) => ({
        category,
        count: counts[index]
      }));
      
      categoryData.sort((a, b) => b.count - a.count);
      
      // Take top 6 categories
      const topCategories = categoryData.slice(0, 6);
      
      // Sum up the rest as "Others"
      const otherCategories = categoryData.slice(6);
      const othersSum = otherCategories.reduce((sum, item) => sum + item.count, 0);
      
      processedCategories = topCategories.map(item => item.category);
      processedCounts = topCategories.map(item => item.count);
      
      processedCategories.push('Others');
      processedCounts.push(othersSum);
    }
    
    return {
      labels: processedCategories,
      datasets: [
        {
          label: 'Number of Complaints',
          data: processedCounts,
          backgroundColor: '#60A5FA', // Blue-400
          borderColor: '#2563EB', // Blue-600
          borderWidth: 1
        }
      ]
    };
  };

  // Prepare data for complaints trend line chart
  const prepareTrendChartData = () => {
    if (!stats) return null;

    return {
      labels: stats.complaintsTrend.labels,
      datasets: [
        {
          label: 'Complaints',
          data: stats.complaintsTrend.data,
          borderColor: '#3B82F6', // Blue-500
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true,
          tension: 0.3
        }
      ]
    };
  };

  // Trend chart options
  const trendChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Complaints Over Time',
        font: {
          size: 16
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    },
    maintainAspectRatio: false
  };

  // Category chart options
  const categoryChartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Complaints by Category',
        font: {
          size: 16
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    },
    maintainAspectRatio: false
  };

  // Format time values to be more readable
  const formatTime = (days: number): string => {
    if (days < 1) {
      const hours = Math.round(days * 24);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    
    if (days === 1) return '1 day';
    return `${days.toFixed(1)} days`;
  };

  if (loading && !stats) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Error Loading Dashboard</h3>
          <p className="mt-1 text-gray-500">{error}</p>
          <button
            onClick={() => fetchDashboardStats()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // For empty state
  if (stats && stats.totalComplaints === 0) {
    return (
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-4 text-lg font-semibold text-gray-900">Welcome to Your Dashboard</h3>
          <p className="mt-2 text-gray-600">You haven't submitted any complaints yet.</p>
          <p className="mt-1 text-gray-600">When you do, you'll see statistics and insights here.</p>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('create-complaint'))}
            className="mt-6 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg className="h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Submit Your First Complaint
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="bg-white p-4 rounded-lg shadow-md">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-800">Dashboard Overview</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">View data for:</span>
            <div className="inline-flex rounded-md shadow-sm">
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium rounded-l-md ${
                  timeRange === 'week'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } border border-gray-300`}
                onClick={() => setTimeRange('week')}
              >
                Week
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium ${
                  timeRange === 'month'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } border-t border-b border-gray-300`}
                onClick={() => setTimeRange('month')}
              >
                Month
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-sm font-medium rounded-r-md ${
                  timeRange === 'year'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                } border border-gray-300`}
                onClick={() => setTimeRange('year')}
              >
                Year
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Complaints</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.totalComplaints || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100 text-yellow-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Pending/In Progress</p>
              <p className="text-2xl font-semibold text-gray-900">
                {(stats?.pendingComplaints || 0) + (stats?.complaintsByStatus?.in_progress || 0)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Resolved</p>
              <p className="text-2xl font-semibold text-gray-900">{stats?.resolvedComplaints || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-gray-100 text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Resolution Time</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.averageResolutionTime !== undefined ? formatTime(stats.averageResolutionTime) : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Trend chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="h-80">
            {stats && prepareTrendChartData() ? (
              <Line 
                options={trendChartOptions} 
                data={prepareTrendChartData()!} 
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">No trend data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Status chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="h-80">
            {stats && prepareStatusChartData() ? (
              <Doughnut 
                options={statusChartOptions} 
                data={prepareStatusChartData()!}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">No status data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Category chart */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="h-80">
            {stats && prepareCategoryChartData() ? (
              <Bar 
                options={categoryChartOptions} 
                data={prepareCategoryChartData()!}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <p className="text-gray-500">No category data available</p>
              </div>
            )}
          </div>
        </div>

        {/* Satisfaction widget */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <div className="flex flex-col h-80">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Feedback Summary</h3>
            
            {stats && stats.feedbackStats.totalFeedbacks > 0 ? (
              <>
                <div className="flex flex-col items-center justify-center flex-grow">
                  <div className="mb-6 text-center">
                    <p className="text-sm text-gray-500 mb-1">Overall Satisfaction</p>
                    <div className="flex items-center justify-center">
                      {[1, 2, 3, 4, 5].map(star => (
                        <svg
                          key={star}
                          className={`w-8 h-8 ${
                            star <= Math.round(stats.feedbackStats.satisfactionAverage)
                              ? 'text-yellow-400'
                              : 'text-gray-300'
                          }`}
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                      ))}
                    </div>
                    <p className="text-3xl font-bold mt-2">
                      {stats.feedbackStats.satisfactionAverage.toFixed(1)}
                      <span className="text-gray-500 text-lg">/5</span>
                    </p>
                  </div>

                  <div className="w-full">
                    <div className="text-center mb-2">
                      <p className="text-sm text-gray-500">Based on {stats.feedbackStats.totalFeedbacks} feedbacks</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-center mt-4">
                  <p className="text-sm text-gray-600">
                    Thank you for your feedback! It helps us improve our service.
                  </p>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center flex-grow text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                <p className="text-gray-600 mb-2">No feedback data available yet</p>
                <p className="text-sm text-gray-500">
                  Once your complaints are resolved, you can provide feedback on the service you received.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StDashboardStats;