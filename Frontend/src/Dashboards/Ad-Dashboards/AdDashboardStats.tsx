import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale,
} from 'chart.js';
import { Bar, Line, Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  RadialLinearScale
);

// Types
interface AdminProfile {
  _id: string;
  name: string;
  email: string;
  role: string;
  profileImage?: string;
  lastLogin?: string;
}

interface DashboardStatsProps {
  adminProfile: AdminProfile | null;
}

interface DashboardStats {
  userStats: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    userGrowthByMonth: { month: string; count: number }[];
  };
  complaintStats: {
    totalComplaints: number;
    openComplaints: number;
    resolvedComplaints: number;
    averageResolutionTime: number; // in days
    complaintsByCategory: { category: string; count: number }[];
    complaintsByAgency: { agency: string; count: number }[];
    complaintTrendByMonth: { month: string; count: number }[];
  };
  staffStats: {
    totalStaff: number;
    activeStaff: number;
    staffByRole: { role: string; count: number }[];
  };
  agencyStats: {
    totalAgencies: number;
    activeAgencies: number;
    topPerformingAgencies: { name: string; resolutionRate: number }[];
  };
  feedbackStats: {
    averageSatisfactionScore: number;
    feedbackCount: number;
    feedbackByRating: { rating: number; count: number }[];
  };
}

const AdDashboardStats: React.FC<DashboardStatsProps> = ({ adminProfile }) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('month');

  // Fetch dashboard stats with admin identifier for audit purposes
  const fetchDashboardStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Include admin ID as a query parameter for audit logging
      const response = await axios.get(`/api/admin/dashboard/stats`, {
        params: {
          timeRange: timeRange,
          adminId: adminProfile?._id, // Use admin ID for tracking who viewed the dashboard
        },
      });

      if (response.data.success) {
        setStats(response.data.data);
      } else {
        setError('Failed to load dashboard statistics');
        toast.error('Failed to load statistics');
      }
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      setError('An error occurred while fetching dashboard statistics');
      toast.error('Error loading dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [timeRange, adminProfile]);

  // Initialize dashboard stats
  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Display admin info in header
  const renderAdminInfo = () => {
    if (!adminProfile) return null;

    return (
      <div className="text-sm text-gray-500 mb-2">
        <span className="font-medium">Viewed by:</span> {adminProfile.name} •
        <span className="ml-1 text-gray-400">
          Last refresh: {new Date().toLocaleTimeString()}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading statistics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Error loading dashboard statistics</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <button 
              onClick={() => fetchDashboardStats()} // Use the fetchDashboardStats function directly
              className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-6 bg-gray-50 rounded-md">
        <svg className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No statistics available</h3>
        <p className="mt-1 text-sm text-gray-500">No data has been recorded yet or there was an issue processing the data.</p>
      </div>
    );
  }

  // Prepare chart data
  const userGrowthChartData = {
    labels: stats.userStats.userGrowthByMonth.map(item => item.month),
    datasets: [
      {
        label: 'New Users',
        data: stats.userStats.userGrowthByMonth.map(item => item.count),
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
    ],
  };

  const complaintTrendChartData = {
    labels: stats.complaintStats.complaintTrendByMonth.map(item => item.month),
    datasets: [
      {
        label: 'Complaints',
        data: stats.complaintStats.complaintTrendByMonth.map(item => item.count),
        backgroundColor: 'rgba(255, 99, 132, 0.5)',
        borderColor: 'rgb(255, 99, 132)',
        borderWidth: 1,
        tension: 0.1,
      },
    ],
  };

  const complaintsByCategoryChartData = {
    labels: stats.complaintStats.complaintsByCategory.map(item => item.category),
    datasets: [
      {
        label: 'Complaints by Category',
        data: stats.complaintStats.complaintsByCategory.map(item => item.count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(54, 162, 235, 0.6)',
          'rgba(255, 206, 86, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(199, 199, 199, 0.6)',
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)',
          'rgba(255, 159, 64, 1)',
          'rgba(199, 199, 199, 1)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const feedbackRatingChartData = {
    labels: stats.feedbackStats.feedbackByRating.map(item => `${item.rating} Star${item.rating !== 1 ? 's' : ''}`),
    datasets: [
      {
        label: 'Feedback Distribution',
        data: stats.feedbackStats.feedbackByRating.map(item => item.count),
        backgroundColor: [
          'rgba(255, 99, 132, 0.6)',
          'rgba(255, 159, 64, 0.6)',
          'rgba(255, 206, 86, 0.6)', 
          'rgba(75, 192, 192, 0.6)',
          'rgba(54, 162, 235, 0.6)',
        ],
        borderColor: [
          'rgb(255, 99, 132)',
          'rgb(255, 159, 64)',
          'rgb(255, 206, 86)',
          'rgb(75, 192, 192)',
          'rgb(54, 162, 235)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const staffRoleChartData = {
    labels: stats.staffStats.staffByRole.map(item => item.role.charAt(0).toUpperCase() + item.role.slice(1)),
    datasets: [
      {
        label: 'Staff by Role',
        data: stats.staffStats.staffByRole.map(item => item.count),
        backgroundColor: [
          'rgba(54, 162, 235, 0.6)',
          'rgba(75, 192, 192, 0.6)',
          'rgba(153, 102, 255, 0.6)',
          'rgba(255, 159, 64, 0.6)',
        ],
        borderColor: [
          'rgb(54, 162, 235)',
          'rgb(75, 192, 192)',
          'rgb(153, 102, 255)',
          'rgb(255, 159, 64)',
        ],
        borderWidth: 1,
      },
    ],
  };

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="bg-white p-4 shadow rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Dashboard Overview</h2>
            {renderAdminInfo()} {/* Display admin information */}
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setTimeRange('week')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                timeRange === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Week
            </button>
            <button
              onClick={() => setTimeRange('month')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                timeRange === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setTimeRange('year')}
              className={`px-3 py-1 rounded-md text-sm font-medium ${
                timeRange === 'year'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Year
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100 text-blue-500">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="font-semibold text-gray-400 text-sm uppercase">Users</h2>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-gray-900">{stats.userStats.totalUsers}</p>
                <span className="text-sm ml-2 text-green-500 font-medium">
                  {stats.userStats.newUsersThisMonth > 0 && (
                    <>+{stats.userStats.newUsersThisMonth} this month</>
                  )}
                </span>
              </div>
              <p className="text-sm text-gray-500">
                {stats.userStats.activeUsers} active ({Math.round((stats.userStats.activeUsers / stats.userStats.totalUsers) * 100)}%)
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100 text-red-500">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="font-semibold text-gray-400 text-sm uppercase">Complaints</h2>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-gray-900">{stats.complaintStats.totalComplaints}</p>
                <span className="text-sm ml-2 font-medium">
                  <span className="text-yellow-500">{stats.complaintStats.openComplaints} open</span>
                </span>
              </div>
              <p className="text-sm text-gray-500">
                Avg. resolution: {stats.complaintStats.averageResolutionTime.toFixed(1)} days
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100 text-green-500">
              <svg className="h-8 w-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div className="ml-4">
              <h2 className="font-semibold text-gray-400 text-sm uppercase">Satisfaction</h2>
              <div className="flex items-center">
                <p className="text-2xl font-bold text-gray-900">
                  {stats.feedbackStats.averageSatisfactionScore.toFixed(1)}/5.0
                </p>
              </div>
              <p className="text-sm text-gray-500">
                Based on {stats.feedbackStats.feedbackCount} ratings
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-4">User Growth Trend</h3>
          <div className="h-72">
            <Bar 
              data={userGrowthChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Complaint Trend</h3>
          <div className="h-72">
            <Line 
              data={complaintTrendChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'top',
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Complaints by Category</h3>
          <div className="h-72">
            <Doughnut 
              data={complaintsByCategoryChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Feedback Ratings</h3>
          <div className="h-72">
            <Doughnut 
              data={feedbackRatingChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                },
              }}
            />
          </div>
        </div>

        <div className="bg-white p-4 shadow rounded-lg">
          <h3 className="text-lg font-medium text-gray-800 mb-4">Staff by Role</h3>
          <div className="h-72">
            <Doughnut 
              data={staffRoleChartData} 
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    position: 'right',
                  },
                },
              }}
            />
          </div>
        </div>
      </div>

      {/* Top performing agencies */}
      <div className="bg-white p-4 shadow rounded-lg">
        <h3 className="text-lg font-medium text-gray-800 mb-4">Top Performing Agencies</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Agency Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Resolution Rate
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {stats.agencyStats.topPerformingAgencies.map((agency, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    #{index + 1}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {agency.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center">
                      <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div 
                          className="bg-green-600 h-2.5 rounded-full" 
                          style={{ width: `${agency.resolutionRate}%` }}
                        ></div>
                      </div>
                      <span className="ml-2">{agency.resolutionRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdDashboardStats;