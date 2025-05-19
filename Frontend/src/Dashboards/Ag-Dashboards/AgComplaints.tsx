import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { debounce } from 'lodash';
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

interface Complaint {
  _id: string;
  title: string;
  description: string;
  category: {
    _id: string;
    name: string;
    icon?: string;
    color?: string;
  };
  location: {
    address?: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
    area?: string;
  };
  status: ComplaintStatus;
  priority: ComplaintPriority;
  attachments?: string[];
  submissionType: ComplaintSubmissionType;
  trackingId: string;
  assignedTo?: {
    agencyId: string;
    agencyName: string;
  };
  responses: Response[];
  submittedBy?: {
    userId: string;
    name: string;
    anonymous: boolean;
  };
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  internalNotes?: string;
  tags?: string[];
}

interface Response {
  _id: string;
  content: string;
  attachments?: string[];
  respondedBy: {
    userId: string;
    name: string;
    userType: 'staff' | 'agent' | 'user' | 'system';
  };
  isPublic: boolean;
  createdAt: string;
}

type ComplaintStatus = 'new' | 'assigned' | 'in_progress' | 'pending_info' | 'resolved' | 'closed' | 'reopened';
type ComplaintPriority = 'low' | 'medium' | 'high' | 'urgent';
type ComplaintSubmissionType = 'web' | 'mobile' | 'phone' | 'email' | 'in_person';

interface AgComplaintsProps {
  agentProfile: AgentProfile | null;
}

const statusLabels: Record<ComplaintStatus, string> = {
  new: 'New',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  pending_info: 'Pending Info',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened'
};

const priorityLabels: Record<ComplaintPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent'
};

const statusColors: Record<ComplaintStatus, string> = {
  new: 'bg-blue-100 text-blue-800',
  assigned: 'bg-yellow-100 text-yellow-800',
  in_progress: 'bg-purple-100 text-purple-800',
  pending_info: 'bg-orange-100 text-orange-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-gray-100 text-gray-800',
  reopened: 'bg-red-100 text-red-800'
};

const priorityColors: Record<ComplaintPriority, string> = {
  low: 'bg-gray-100 text-gray-800',
  medium: 'bg-blue-100 text-blue-800',
  high: 'bg-orange-100 text-orange-800',
  urgent: 'bg-red-100 text-red-800'
};

const AgComplaints: React.FC<AgComplaintsProps> = ({ agentProfile }) => {
  // State
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [currentComplaint, setCurrentComplaint] = useState<Complaint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showResponseModal, setShowResponseModal] = useState<boolean>(false);
  const [showUpdateModal, setShowUpdateModal] = useState<boolean>(false);
  
  // Form state
  const [responseContent, setResponseContent] = useState<string>('');
  const [isResponsePublic, setIsResponsePublic] = useState<boolean>(true);
  const [responseAttachments, setResponseAttachments] = useState<File[]>([]);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<ComplaintPriority | 'all'>('all');
  const [dateRangeFilter, setDateRangeFilter] = useState<{startDate: string, endDate: string} | null>(null);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const limit = 10;

  // Fetch complaints for the agent's agency
  const fetchComplaints = useCallback(async () => {
    if (!agentProfile?.agency._id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Construct query params
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', limit.toString());
      params.append('agencyId', agentProfile.agency._id);
      
      if (searchTerm) params.append('search', searchTerm);
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (priorityFilter !== 'all') params.append('priority', priorityFilter);
      if (dateRangeFilter) {
        params.append('startDate', dateRangeFilter.startDate);
        params.append('endDate', dateRangeFilter.endDate);
      }
      
      params.append('sort', sortBy);

      const response = await axios.get(`/api/complaints?${params.toString()}`);
      
      if (response.data.success) {
        setComplaints(response.data.data);
        setTotalPages(response.data.pagination.totalPages || 1);
      } else {
        setError('Failed to fetch complaints');
        toast.error('Could not load complaints');
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
      setError('An error occurred while fetching complaints');
      toast.error('Failed to load complaints');
    } finally {
      setIsLoading(false);
    }
  }, [agentProfile, currentPage, limit, searchTerm, statusFilter, priorityFilter, dateRangeFilter, sortBy]);

  // Fetch single complaint with full details
  const fetchComplaintDetails = async (complaintId: string) => {
    try {
      const response = await axios.get(`/api/complaints/${complaintId}`);
      
      if (response.data.success) {
        setCurrentComplaint(response.data.data);
      } else {
        toast.error('Could not load complaint details');
      }
    } catch (error) {
      console.error('Error fetching complaint details:', error);
      toast.error('Failed to load complaint details');
    }
  };

  // Initialize component
  useEffect(() => {
    if (agentProfile) {
      fetchComplaints();
    }
  }, [agentProfile, fetchComplaints]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setSearchTerm(term);
      setCurrentPage(1);
    }, 500),
    []
  );

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    debouncedSearch(e.target.value);
  };

  // Filter and sort handlers
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as ComplaintStatus | 'all');
    setCurrentPage(1);
  };

  const handlePriorityFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPriorityFilter(e.target.value as ComplaintPriority | 'all');
    setCurrentPage(1);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'newest' | 'oldest' | 'priority');
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setDateRangeFilter(null);
    setSortBy('newest');
    setCurrentPage(1);
  };

  // Modal handlers
  const openDetailModal = async (complaint: Complaint) => {
    await fetchComplaintDetails(complaint._id);
    setShowDetailModal(true);
  };

  const openResponseModal = async (complaint: Complaint) => {
    await fetchComplaintDetails(complaint._id);
    setShowResponseModal(true);
    setResponseContent('');
    setIsResponsePublic(true);
    setResponseAttachments([]);
  };

  const openUpdateModal = async (complaint: Complaint) => {
    await fetchComplaintDetails(complaint._id);
    setShowUpdateModal(true);
  };

  const closeAllModals = () => {
    setShowDetailModal(false);
    setShowResponseModal(false);
    setShowUpdateModal(false);
    setCurrentComplaint(null);
  };

  // Response handlers
  const handleResponseContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setResponseContent(e.target.value);
  };

  const handleResponsePublicToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsResponsePublic(e.target.checked);
  };

  const handleResponseAttachmentsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setResponseAttachments(filesArray);
    }
  };

  // Submit response to complaint
  const submitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentComplaint || !responseContent.trim()) {
      toast.error('Please enter a response');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('content', responseContent);
      formData.append('isPublic', isResponsePublic.toString());
      
      responseAttachments.forEach(file => {
        formData.append('attachments', file);
      });
      
      const response = await axios.post(
        `/api/complaints/${currentComplaint._id}/responses`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data.success) {
        toast.success('Response added successfully');
        closeAllModals();
        fetchComplaints();
      } else {
        toast.error(response.data.message || 'Failed to add response');
      }
    } catch (error: any) {
      console.error('Error adding response:', error);
      toast.error(error.response?.data?.message || 'An error occurred while adding the response');
    } finally {
      setIsLoading(false);
    }
  };

  // Update complaint status/priority
  const updateComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!currentComplaint) return;
    
    setIsLoading(true);
    
    try {
      const response = await axios.put(`/api/complaints/${currentComplaint._id}`, {
        status: currentComplaint.status,
        priority: currentComplaint.priority,
        internalNotes: currentComplaint.internalNotes
      });
      
      if (response.data.success) {
        toast.success('Complaint updated successfully');
        closeAllModals();
        fetchComplaints();
      } else {
        toast.error(response.data.message || 'Failed to update complaint');
      }
    } catch (error: any) {
      console.error('Error updating complaint:', error);
      toast.error(error.response?.data?.message || 'An error occurred while updating the complaint');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle status change in update modal
  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!currentComplaint) return;
    
    setCurrentComplaint({
      ...currentComplaint,
      status: e.target.value as ComplaintStatus
    });
  };

  // Handle priority change in update modal
  const handlePriorityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (!currentComplaint) return;
    
    setCurrentComplaint({
      ...currentComplaint,
      priority: e.target.value as ComplaintPriority
    });
  };

  // Handle internal notes change in update modal
  const handleInternalNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!currentComplaint) return;
    
    setCurrentComplaint({
      ...currentComplaint,
      internalNotes: e.target.value
    });
  };

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 sm:px-6 mt-4">
        <div className="flex flex-1 justify-between sm:hidden">
          <button
            onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className={`relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
              currentPage === 1 
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Previous
          </button>
          <button
            onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className={`relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium ${
              currentPage === totalPages
                ? 'text-gray-300 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-50'
            }`}
          >
            Next
          </button>
        </div>
        <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-gray-700">
              Showing page <span className="font-medium">{currentPage}</span> of{' '}
              <span className="font-medium">{totalPages}</span>
            </p>
          </div>
          <div>
            <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
              <button
                onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                  currentPage === 1
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-50'
                } focus:z-20`}
              >
                <span className="sr-only">Previous</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                </svg>
              </button>
              
              {/* Page buttons */}
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                // Show first, last, current and neighboring pages
                let pageNum;
                if (totalPages <= 5) {
                  // If we have 5 pages or less, show all
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  // If we're near the start
                  pageNum = i + 1;
                  if (i === 4) pageNum = totalPages;
                } else if (currentPage >= totalPages - 2) {
                  // If we're near the end
                  pageNum = totalPages - 4 + i;
                  if (i === 0) pageNum = 1;
                } else {
                  // We're in the middle
                  pageNum = currentPage - 2 + i;
                  if (i === 0) pageNum = 1;
                  if (i === 4) pageNum = totalPages;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                      currentPage === pageNum
                        ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                        : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${
                  currentPage === totalPages
                    ? 'text-gray-300 cursor-not-allowed'
                    : 'text-gray-500 hover:bg-gray-50'
                } focus:z-20`}
              >
                <span className="sr-only">Next</span>
                <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </button>
            </nav>
          </div>
        </div>
      </div>
    );
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy h:mm a');
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Complaints Dashboard</h2>
            {agentProfile && (
              <p className="text-sm text-gray-500 mt-1">
                Agency: {agentProfile.agency.name} • Agent: {agentProfile.name}
              </p>
            )}
          </div>
          
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search complaints..."
                className="px-4 py-2 border border-gray-300 rounded-md w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                onChange={handleSearchChange}
              />
              <svg
                className="absolute right-3 top-2.5 h-5 w-5 text-gray-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={handleStatusFilterChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="assigned">Assigned</option>
              <option value="in_progress">In Progress</option>
              <option value="pending_info">Pending Info</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
              <option value="reopened">Reopened</option>
            </select>
            
            <select
              value={priorityFilter}
              onChange={handlePriorityFilterChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
            
            <select
              value={sortBy}
              onChange={handleSortChange}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="priority">Priority (High to Low)</option>
            </select>
            
            <button
              onClick={clearFilters}
              className="px-3 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="flex justify-center my-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 p-4 rounded-md mb-6">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <button 
                  onClick={() => fetchComplaints()}
                  className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )}

        {!isLoading && !error && (
          <>
            {complaints.length > 0 ? (
              <div className="overflow-x-auto mt-4">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tracking ID
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Title
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Category
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Priority
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date Submitted
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {complaints.map((complaint) => (
                      <tr key={complaint._id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {complaint.trackingId}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {complaint.title}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <span className="inline-flex items-center">
                            {complaint.category.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[complaint.status]}`}>
                            {statusLabels[complaint.status]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${priorityColors[complaint.priority]}`}>
                            {priorityLabels[complaint.priority]}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(complaint.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => openDetailModal(complaint)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              View
                            </button>
                            <button
                              onClick={() => openResponseModal(complaint)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Respond
                            </button>
                            <button
                              onClick={() => openUpdateModal(complaint)}
                              className="text-purple-600 hover:text-purple-900"
                            >
                              Update
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-10">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">No complaints found</h3>
                <p className="mt-1 text-sm text-gray-500">
                  {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your search or filter to find what you\'re looking for.'
                    : 'There are no complaints assigned to your agency yet.'}
                </p>
                {(searchTerm || statusFilter !== 'all' || priorityFilter !== 'all') && (
                  <button
                    onClick={clearFilters}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-500"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            )}
            
            {renderPagination()}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && currentComplaint && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 max-h-[80vh] overflow-y-auto">
                <div className="sm:flex sm:items-start">
                  <div className="w-full">
                    <div className="flex justify-between">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">{currentComplaint.title}</h3>
                      <span className="text-xs text-gray-500">#{currentComplaint.trackingId}</span>
                    </div>
                    
                    <div className="mt-4 grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-xs font-medium text-gray-500">STATUS</h4>
                        <span className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[currentComplaint.status]}`}>
                          {statusLabels[currentComplaint.status]}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500">PRIORITY</h4>
                        <span className={`mt-1 px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${priorityColors[currentComplaint.priority]}`}>
                          {priorityLabels[currentComplaint.priority]}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500">CATEGORY</h4>
                        <p className="mt-1 text-sm text-gray-900">{currentComplaint.category.name}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500">SUBMITTED ON</h4>
                        <p className="mt-1 text-sm text-gray-900">{formatDate(currentComplaint.createdAt)}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500">SUBMITTED BY</h4>
                        <p className="mt-1 text-sm text-gray-900">
                          {currentComplaint.submittedBy?.anonymous 
                            ? 'Anonymous User' 
                            : (currentComplaint.submittedBy?.name || 'Unknown')}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-medium text-gray-500">LOCATION</h4>
                        <p className="mt-1 text-sm text-gray-900">
                          {currentComplaint.location?.address || 'No specific location provided'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-xs font-medium text-gray-500">DESCRIPTION</h4>
                      <div className="mt-1 prose prose-sm max-w-none text-gray-900">
                        <p className="whitespace-pre-line">{currentComplaint.description}</p>
                      </div>
                    </div>
                    
                    {currentComplaint.attachments && currentComplaint.attachments.length > 0 && (
                      <div className="mt-4">
                        <h4 className="text-xs font-medium text-gray-500">ATTACHMENTS</h4>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {currentComplaint.attachments.map((attachment, index) => (
                            <a
                              key={index}
                              href={attachment}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center px-2.5 py-1.5 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                            >
                              <svg className="h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              Attachment {index + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {currentComplaint.internalNotes && (
                      <div className="mt-4">
                        <h4 className="text-xs font-medium text-gray-500">INTERNAL NOTES</h4>
                        <div className="mt-1 p-3 bg-yellow-50 border border-yellow-100 rounded-md">
                          <p className="text-sm text-gray-800 whitespace-pre-line">{currentComplaint.internalNotes}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="mt-6">
                      <h4 className="text-xs font-medium text-gray-500">RESPONSES</h4>
                      {currentComplaint.responses && currentComplaint.responses.length > 0 ? (
                        <div className="mt-1 space-y-4">
                          {currentComplaint.responses.map((response) => (
                            <div key={response._id} className="p-4 border rounded-md">
                              <div className="flex justify-between items-start">
                                <div className="flex items-center">
                                  <span className="font-medium text-sm">{response.respondedBy.name}</span>
                                  <span className="ml-2 text-xs text-gray-500">
                                    {response.respondedBy.userType === 'staff' ? 'Staff' : 
                                     response.respondedBy.userType === 'agent' ? 'Agent' : 
                                     response.respondedBy.userType === 'system' ? 'System' : 'User'}
                                  </span>
                                  {!response.isPublic && (
                                    <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                                      Internal
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs text-gray-500">{formatDate(response.createdAt)}</span>
                              </div>
                              <div className="mt-2 text-sm text-gray-700 whitespace-pre-line">
                                {response.content}
                              </div>
                              {response.attachments && response.attachments.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {response.attachments.map((attachment, index) => (
                                    <a
                                      key={index}
                                      href={attachment}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded text-gray-700 bg-white hover:bg-gray-50"
                                    >
                                      Attachment {index + 1}
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="mt-1 text-sm text-gray-500">No responses yet.</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={closeAllModals}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeAllModals();
                    openResponseModal(currentComplaint);
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Respond
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Response Modal */}
      {showResponseModal && currentComplaint && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={submitResponse}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Add Response</h3>
                      <div className="mt-1 text-sm text-gray-500 flex items-center justify-between">
                        <span>Complaint: {currentComplaint.title}</span>
                        <span className="text-xs">#{currentComplaint.trackingId}</span>
                      </div>
                      <div className="mt-4">
                        <label htmlFor="responseContent" className="block text-sm font-medium text-gray-700">
                          Response Content
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="responseContent"
                            name="responseContent"
                            rows={5}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Enter your response..."
                            value={responseContent}
                            onChange={handleResponseContentChange}
                            required
                          />
                        </div>
                      </div>
                      <div className="mt-4">
                        <label htmlFor="responseAttachments" className="block text-sm font-medium text-gray-700">
                          Attachments (Optional)
                        </label>
                        <div className="mt-1">
                          <input
                            type="file"
                            id="responseAttachments"
                            name="responseAttachments"
                            multiple
                            onChange={handleResponseAttachmentsChange}
                            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                        </div>
                      </div>
                      <div className="mt-4 flex items-start">
                        <div className="flex items-center h-5">
                          <input
                            id="isResponsePublic"
                            name="isResponsePublic"
                            type="checkbox"
                            checked={isResponsePublic}
                            onChange={handleResponsePublicToggle}
                            className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                          />
                        </div>
                        <div className="ml-3 text-sm">
                          <label htmlFor="isResponsePublic" className="font-medium text-gray-700">
                            Visible to Complainant
                          </label>
                          <p className="text-gray-500">
                            Make this response visible to the person who submitted the complaint. 
                            If unchecked, the response will only be visible internally.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isLoading || !responseContent.trim()}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${
                      isLoading || !responseContent.trim()
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500'
                    } sm:ml-3 sm:w-auto sm:text-sm`}
                  >
                    {isLoading ? 'Sending...' : 'Send Response'}
                  </button>
                  <button
                    type="button"
                    onClick={closeAllModals}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Update Status Modal */}
      {showUpdateModal && currentComplaint && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={closeAllModals}></div>
            <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <form onSubmit={updateComplaint}>
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-green-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">Update Complaint Status</h3>
                      <div className="mt-1 text-sm text-gray-500 flex items-center justify-between">
                        <span>Complaint: {currentComplaint.title}</span>
                        <span className="text-xs">#{currentComplaint.trackingId}</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                            Status
                          </label>
                          <select
                            id="status"
                            name="status"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={currentComplaint.status}
                            onChange={handleStatusChange}
                          >
                            <option value="new">New</option>
                            <option value="assigned">Assigned</option>
                            <option value="in_progress">In Progress</option>
                            <option value="pending_info">Pending Info</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                            <option value="reopened">Reopened</option>
                          </select>
                        </div>
                        <div>
                          <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                            Priority
                          </label>
                          <select
                            id="priority"
                            name="priority"
                            className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
                            value={currentComplaint.priority}
                            onChange={handlePriorityChange}
                          >
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                            <option value="urgent">Urgent</option>
                          </select>
                        </div>
                      </div>
                      <div className="mt-4">
                        <label htmlFor="internalNotes" className="block text-sm font-medium text-gray-700">
                          Internal Notes (Only visible to staff/agents)
                        </label>
                        <div className="mt-1">
                          <textarea
                            id="internalNotes"
                            name="internalNotes"
                            rows={4}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="Add any internal notes about this complaint..."
                            value={currentComplaint.internalNotes || ''}
                            onChange={handleInternalNotesChange}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 ${
                      isLoading
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500'
                    } sm:ml-3 sm:w-auto sm:text-sm`}
                  >
                    {isLoading ? 'Updating...' : 'Update Status'}
                  </button>
                  <button
                    type="button"
                    onClick={closeAllModals}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgComplaints;