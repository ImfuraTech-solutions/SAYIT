import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Types
interface Complaint {
  _id: string;
  title: string;
  description: string;
  trackingId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  category: {
    _id: string;
    name: string;
  };
  agency?: {
    _id: string;
    name: string;
    shortName?: string;
  };
  attachments?: {
    url: string;
    originalName: string;
    fileType: string;
    resourceType: string;
  }[];
}

interface Response {
  _id: string;
  content: string;
  userType: string;
  createdAt: string;
  staff?: {
    _id: string;
    name: string;
  };
  attachments?: {
    url: string;
    originalName: string;
    fileType: string;
  }[];
  statusChange?: {
    oldStatus: string;
    newStatus: string;
  };
}

interface Feedback {
  satisfactionLevel: number;
  comment: string;
  responseTimeRating: number;
  staffProfessionalismRating: number;
  resolutionSatisfactionRating: number;
  communicationRating: number;
  wouldRecommend: boolean;
  isPublic: boolean;
}

// ViewResponse Modal Component
const ViewResponseModal: React.FC<{
  complaintId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ complaintId, isOpen, onClose, onSuccess }) => {
  const [content, setContent] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!content.trim()) {
      toast.error('Please enter your response');
      return;
    }

    setLoading(true);
    
    try {
      const formData = new FormData();
      formData.append('content', content);
      
      // Append files if any
      files.forEach(file => {
        formData.append('attachments', file);
      });

      const response = await axios.post(
        `/api/anonymous/complaints/${complaintId}/responses`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      if (response.data.success) {
        toast.success('Response submitted successfully');
        setContent('');
        setFiles([]);
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error submitting response:', error);
      toast.error('Failed to submit response');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      // Validate file size (max 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = selectedFiles.filter(file => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        toast.error(`Some files exceed the 10MB size limit`);
        return;
      }
      
      // Limit to 3 files as per the backend route
      if (selectedFiles.length > 3) {
        toast.warning('Maximum 3 files allowed. Only the first 3 will be used.');
      }
      
      setFiles(selectedFiles.slice(0, 3));
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-800 bg-opacity-75 flex items-center justify-center">
      <div className="relative bg-white rounded-lg w-full max-w-lg mx-4 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Add Response</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
              Your Response <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Type your response here..."
              required
            />
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Attachments (Optional, max 3 files, 10MB each)
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              multiple
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {files.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500">Selected files:</p>
                <ul className="list-disc pl-5 text-xs text-gray-500">
                  {files.map((file, index) => (
                    <li key={index}>{file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Response'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// SendFeedback Modal Component
const SendFeedbackModal: React.FC<{
  complaintId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ complaintId, isOpen, onClose, onSuccess }) => {
  const [feedback, setFeedback] = useState<Feedback>({
    satisfactionLevel: 3,
    comment: '',
    responseTimeRating: 3,
    staffProfessionalismRating: 3,
    resolutionSatisfactionRating: 3,
    communicationRating: 3,
    wouldRecommend: true,
    isPublic: true
  });
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFeedback(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFeedback(prev => ({
      ...prev,
      [name]: checked
    }));
  };

  const handleRatingChange = (name: string, value: number) => {
    setFeedback(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const response = await axios.post('/api/feedback', {
        complaintId,
        ...feedback
      });

      if (response.data.success) {
        toast.success('Feedback submitted successfully! Thank you for your input.');
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast.error('Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  // Star Rating Component
  const StarRating: React.FC<{ name: string, value: number, onChange: (name: string, value: number) => void }> = ({ name, value, onChange }) => (
    <div className="flex items-center">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(name, star)}
          className="focus:outline-none"
          aria-label={`${star} star${star !== 1 ? 's' : ''}`}
        >
          <svg 
            className={`w-8 h-8 ${star <= value ? 'text-yellow-400' : 'text-gray-300'}`} 
            fill="currentColor" 
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-800 bg-opacity-75 flex items-center justify-center">
      <div className="relative bg-white rounded-lg w-full max-w-xl mx-4 p-6 shadow-xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Submit Feedback</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Overall Satisfaction */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Overall Satisfaction
            </label>
            <StarRating 
              name="satisfactionLevel" 
              value={feedback.satisfactionLevel} 
              onChange={handleRatingChange} 
            />
          </div>
          
          {/* Comment */}
          <div>
            <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
              Additional Comments
            </label>
            <textarea
              id="comment"
              name="comment"
              value={feedback.comment}
              onChange={handleInputChange}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Please share your experience and any suggestions for improvement"
            />
          </div>
          
          {/* Rating Categories */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-700">Please rate the following:</h4>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">Response Time</label>
              <StarRating 
                name="responseTimeRating" 
                value={feedback.responseTimeRating} 
                onChange={handleRatingChange} 
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">Staff Professionalism</label>
              <StarRating 
                name="staffProfessionalismRating" 
                value={feedback.staffProfessionalismRating} 
                onChange={handleRatingChange} 
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">Resolution Satisfaction</label>
              <StarRating 
                name="resolutionSatisfactionRating" 
                value={feedback.resolutionSatisfactionRating} 
                onChange={handleRatingChange} 
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-700 mb-1">Communication Quality</label>
              <StarRating 
                name="communicationRating" 
                value={feedback.communicationRating} 
                onChange={handleRatingChange} 
              />
            </div>
          </div>
          
          {/* Would Recommend */}
          <div>
            <div className="flex items-center">
              <input
                id="wouldRecommend"
                name="wouldRecommend"
                type="checkbox"
                checked={feedback.wouldRecommend}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="wouldRecommend" className="ml-2 block text-sm text-gray-700">
                I would recommend this service to others
              </label>
            </div>
          </div>
          
          {/* Make Public */}
          <div>
            <div className="flex items-center">
              <input
                id="isPublic"
                name="isPublic"
                type="checkbox"
                checked={feedback.isPublic}
                onChange={handleCheckboxChange}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-700">
                Make my feedback public (anonymous)
              </label>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Public feedback helps others understand the quality of service provided.
              Your identity remains anonymous.
            </p>
          </div>
          
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loading ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main AnComplaints Component
const AnComplaints: React.FC = () => {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);
  const [complaintResponses, setComplaintResponses] = useState<Response[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setError] = useState('');
  
  // Modals state
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1
  });

  // Fetch complaints list
  const fetchComplaints = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/anonymous/complaints?page=${pagination.page}&limit=${pagination.limit}`);
      
      if (response.data.success) {
        setComplaints(response.data.data || []);
        setPagination({
          ...pagination,
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 1
        });
      } else {
        setError('Failed to fetch complaints');
      }
    } catch (error) {
      console.error('Error fetching complaints:', error);
      // Don't show error toast - we'll display empty state instead
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit]);

  // Fetch complaint details with responses
  const fetchComplaintDetails = async (complaintId: string) => {
    setLoading(true);
    try {
      const response = await axios.get(`/api/anonymous/complaints/${complaintId}`);
      
      if (response.data.success) {
        setSelectedComplaint(response.data.data.complaint);
        setComplaintResponses(response.data.data.responses || []);
      } else {
        toast.error('Failed to fetch complaint details');
      }
    } catch (error) {
      console.error('Error fetching complaint details:', error);
      toast.error('Failed to load complaint details');
    } finally {
      setLoading(false);
    }
  };

  // Initial data loading
  useEffect(() => {
    fetchComplaints();
  }, [fetchComplaints]);

  // Handle viewing a complaint
  const handleViewComplaint = (complaint: Complaint) => {
    fetchComplaintDetails(complaint._id);
  };

  // Handle page change
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get status badge styling
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'under_review': return 'bg-blue-100 text-blue-800';
      case 'assigned': return 'bg-indigo-100 text-indigo-800';
      case 'in_progress': return 'bg-purple-100 text-purple-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      case 'closed': return 'bg-gray-100 text-gray-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format status text
  const formatStatus = (status: string) => {
    return status
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Handle response modal
  const handleOpenResponseModal = () => {
    setShowResponseModal(true);
  };

  // Handle feedback modal
  const handleOpenFeedbackModal = () => {
    setShowFeedbackModal(true);
  };

  // Handle response submission success
  const handleResponseSuccess = () => {
    if (selectedComplaint) {
      fetchComplaintDetails(selectedComplaint._id);
    }
  };

  // Handle back to list
  const handleBackToList = () => {
    setSelectedComplaint(null);
    setComplaintResponses([]);
  };

  return (
    <div className="bg-white shadow-md rounded-lg overflow-hidden">
      {loading && !selectedComplaint ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : complaints.length === 0 ? (
        <div className="text-center py-16 px-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No complaints found</h3>
          <p className="mt-1 text-sm text-gray-500">
            You haven't submitted any complaints yet.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('open-complaint-form'))}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Submit a complaint
            </button>
          </div>
        </div>
      ) : selectedComplaint ? (
        // Complaint Detail View
        <div>
          {/* Complaint Header */}
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
            <div>
              <div className="flex items-center">
                <button 
                  onClick={handleBackToList}
                  className="mr-2 p-1 rounded-full hover:bg-gray-100"
                  aria-label="Back to list"
                >
                  <svg className="h-5 w-5 text-gray-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                </button>
                <h2 className="text-xl font-semibold text-gray-800">{selectedComplaint.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                <span className="text-sm text-gray-500">
                  Tracking ID: {selectedComplaint.trackingId}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getStatusBadgeClass(selectedComplaint.status)}`}>
                  {formatStatus(selectedComplaint.status)}
                </span>
                <span className="text-sm text-gray-500">
                  Submitted: {formatDate(selectedComplaint.createdAt)}
                </span>
              </div>
            </div>
          </div>
          
          {/* Complaint Body */}
          <div className="p-6">
            {/* Complaint Details */}
            <div className="mb-8">
              <div className="mb-4">
                <h3 className="text-base font-medium text-gray-700 mb-2">Description</h3>
                <div className="bg-gray-50 p-4 rounded-md whitespace-pre-wrap text-gray-800">
                  {selectedComplaint.description}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Category</h4>
                  <p className="mt-1">{selectedComplaint.category?.name || 'Uncategorized'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Agency</h4>
                  <p className="mt-1">{selectedComplaint.agency?.name || 'Unassigned'}</p>
                </div>
                
                <div>
                  <h4 className="text-sm font-medium text-gray-500">Last Updated</h4>
                  <p className="mt-1">{formatDate(selectedComplaint.updatedAt)}</p>
                </div>
              </div>
              
              {/* Complaint Attachments */}
              {selectedComplaint.attachments && selectedComplaint.attachments.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-base font-medium text-gray-700 mb-2">Attachments</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {selectedComplaint.attachments.map((attachment, index) => (
                      <div key={index} className="border rounded p-3 flex flex-col">
                        {attachment.resourceType === 'image' ? (
                          <div className="h-32 mb-2 bg-gray-100 flex items-center justify-center overflow-hidden">
                            <img 
                              src={attachment.url} 
                              alt={attachment.originalName}
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-32 mb-2 bg-gray-100 text-gray-400 flex flex-col items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs mt-1">{attachment.fileType.split('/')[1]?.toUpperCase()}</span>
                          </div>
                        )}
                        <a 
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:text-blue-800 truncate"
                          title={attachment.originalName}
                        >
                          {attachment.originalName}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            {/* Responses Section */}
            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-medium">Responses</h3>
                <div className="space-x-3">
                  <button
                    onClick={handleOpenResponseModal}
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                    Add Response
                  </button>
                  
                  {['resolved', 'closed'].includes(selectedComplaint.status) && (
                    <button
                      onClick={handleOpenFeedbackModal}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Send Feedback
                    </button>
                  )}
                </div>
              </div>
              
              {complaintResponses.length > 0 ? (
                <div className="space-y-6">
                  {complaintResponses.map((response) => (
                    <div 
                      key={response._id} 
                      className={`p-4 rounded-lg ${
                        response.userType === 'anonymous_user' ? 'bg-blue-50 ml-6' :
                        response.userType === 'system' ? 'bg-gray-50' : 'bg-green-50'
                      }`}
                    >
                      <div className="flex justify-between mb-2">
                        <span className="font-medium">
                          {response.userType === 'anonymous_user' ? 'You' : 
                           response.userType === 'system' ? 'System' :
                           response.staff?.name || 'Staff'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {formatDate(response.createdAt)}
                        </span>
                      </div>
                      
                      {response.statusChange ? (
                        // Status change notification
                        <div className="text-sm">
                          <span className="font-medium">Status changed: </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(response.statusChange.oldStatus)}`}>
                            {formatStatus(response.statusChange.oldStatus)}
                          </span>
                          <span className="mx-2">→</span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(response.statusChange.newStatus)}`}>
                            {formatStatus(response.statusChange.newStatus)}
                          </span>
                        </div>
                      ) : (
                        // Regular response
                        <div className="text-sm whitespace-pre-wrap">
                          {response.content}
                        </div>
                      )}
                      
                      {/* Response attachments if any */}
                      {response.attachments && response.attachments.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {response.attachments.map((attachment, index) => (
                            <a 
                              key={index}
                              href={attachment.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs bg-white border border-gray-200 rounded px-2 py-1 inline-flex items-center text-blue-600 hover:text-blue-800"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                              </svg>
                              {attachment.originalName}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 bg-gray-50 rounded-md">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No responses yet</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    There are no responses to this complaint yet. Check back later or add your own response.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        // Complaints List View
        <div>
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">Your Complaints</h3>
            <p className="mt-1 text-sm text-gray-500">
              View and manage all your submitted complaints
            </p>
          </div>
          
          <ul className="divide-y divide-gray-200">
            {complaints.map((complaint) => (
              <li 
                key={complaint._id} 
                onClick={() => handleViewComplaint(complaint)} 
                className="hover:bg-gray-50 cursor-pointer"
              >
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-blue-600 truncate">
                      {complaint.title}
                    </p>
                    <div className="ml-2 flex-shrink-0 flex">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeClass(complaint.status)}`}>
                        {formatStatus(complaint.status)}
                      </span>
                    </div>
                  </div>
                  <div className="mt-2 sm:flex sm:justify-between">
                    <div className="sm:flex">
                      <p className="flex items-center text-sm text-gray-500">
                        <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        {complaint.category?.name || 'Uncategorized'}
                      </p>
                      {complaint.agency && (
                        <p className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0 sm:ml-6">
                          <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          {complaint.agency.name}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                      <svg className="flex-shrink-0 mr-1.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p>
                        <time dateTime={complaint.createdAt}>{formatDate(complaint.createdAt)}</time>
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center text-xs text-gray-500">
                    <span className="truncate">ID: {complaint.trackingId}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          
          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> to{' '}
                    <span className="font-medium">
                      {Math.min(pagination.page * pagination.limit, pagination.total)}
                    </span>{' '}
                    of <span className="font-medium">{pagination.total}</span> complaints
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => handlePageChange(Math.max(1, pagination.page - 1))}
                      disabled={pagination.page === 1}
                      className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                        pagination.page === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                    
                    {Array.from({ length: pagination.pages }, (_, i) => i + 1)
                      .filter(page => 
                        page === 1 || 
                        page === pagination.pages || 
                        (page >= pagination.page - 1 && page <= pagination.page + 1)
                      )
                      .map((page, index, array) => {
                        const showEllipsisBefore = index > 0 && page - array[index - 1] > 1;
                        
                        return (
                          <React.Fragment key={page}>
                            {showEllipsisBefore && (
                              <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                ...
                              </span>
                            )}
                            <button
                              onClick={() => handlePageChange(page)}
                              aria-current={pagination.page === page ? 'page' : undefined}
                              className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                pagination.page === page
                                  ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                                  : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </button>
                          </React.Fragment>
                        );
                      })}
                      
                    <button
                      onClick={() => handlePageChange(Math.min(pagination.pages, pagination.page + 1))}
                      disabled={pagination.page === pagination.pages}
                      className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                        pagination.page === pagination.pages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Response Modal */}
      {showResponseModal && selectedComplaint && (
        <ViewResponseModal
          complaintId={selectedComplaint._id}
          isOpen={showResponseModal}
          onClose={() => setShowResponseModal(false)}
          onSuccess={handleResponseSuccess}
        />
      )}
      
      {/* Feedback Modal */}
      {showFeedbackModal && selectedComplaint && (
        <SendFeedbackModal
          complaintId={selectedComplaint._id}
          isOpen={showFeedbackModal}
          onClose={() => setShowFeedbackModal(false)}
          onSuccess={() => toast.success('Thank you for your feedback!')}
        />
      )}
    </div>
  );
};

export default AnComplaints;