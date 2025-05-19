import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faSearch, faSpinner, faCheckCircle, 
  faClock, faExclamationCircle, faTimesCircle, 
  faFileAlt, faUser, faCalendarAlt, faTag, faBuilding, faTasks,
  faPaperPlane
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import { format } from 'date-fns';
import '../styles/pages/TrackComplaint.css';

// Define types
interface ComplaintAttachment {
  url: string;
  originalName: string;
  fileType: string;
}

interface ComplaintResponse {
  _id: string;
  content: string;
  createdAt: string;
  responseFrom: string;
}

interface Complaint {
  _id: string;
  title: string;
  description: string;
  submissionType: string;
  status: string;
  priority: string;
  trackingId: string;
  category: {
    _id: string;
    name: string;
  };
  agency?: {
    _id: string;
    name: string;
  };
  location?: {
    address: string;
    district: string;
    sector: string;
  };
  createdAt: string;
  updatedAt: string;
  attachments?: ComplaintAttachment[];
  responses?: ComplaintResponse[];
}

const TrackComplaint: React.FC = () => {
  const [trackingId, setTrackingId] = useState<string>('');
  const [complaint, setComplaint] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Function to fetch complaint by tracking ID
  const fetchComplaint = async () => {
    if (!trackingId.trim()) {
      setError('Please enter a tracking ID');
      return;
    }

    setLoading(true);
    setError(null);
    setComplaint(null);

    try {
      // Try to fetch from the public tracking endpoint
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/track/${trackingId.trim()}`);
      
      if (response.data && response.data.success) {
        setComplaint(response.data.data);
      } else {
        setError('Unable to find complaint with that tracking ID');
      }
    } catch (err) {
      console.error('Error fetching complaint:', err);
      setError('Failed to fetch complaint. Please check your tracking ID and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get status badge based on complaint status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="status-badge pending"><FontAwesomeIcon icon={faClock} /> Pending</span>;
      case 'under_review':
        return <span className="status-badge under-review"><FontAwesomeIcon icon={faFileAlt} /> Under Review</span>;
      case 'assigned':
        return <span className="status-badge assigned"><FontAwesomeIcon icon={faUser} /> Assigned</span>;
      case 'in_progress':
        return <span className="status-badge in-progress"><FontAwesomeIcon icon={faTasks} /> In Progress</span>;
      case 'resolved':
        return <span className="status-badge resolved"><FontAwesomeIcon icon={faCheckCircle} /> Resolved</span>;
      case 'closed':
        return <span className="status-badge closed"><FontAwesomeIcon icon={faTimesCircle} /> Closed</span>;
      case 'rejected':
        return <span className="status-badge rejected"><FontAwesomeIcon icon={faExclamationCircle} /> Rejected</span>;
      default:
        return <span className="status-badge unknown">{status}</span>;
    }
  };

  return (
    <div className="track-complaint-container">
      <div className="track-complaint-header">
        <h1>Track Your Complaint</h1>
        <p className="subtitle">Enter your complaint tracking ID to view its current status and details</p>
      </div>

      <div className="track-complaint-form">
        <div className="search-container">
          <input
            type="text"
            value={trackingId}
            onChange={(e) => setTrackingId(e.target.value)}
            placeholder="Enter tracking ID (e.g., SAY-2023-12345)"
            className="tracking-input"
          />
          <button 
            onClick={fetchComplaint} 
            className="track-button"
            disabled={loading}
          >
            {loading ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <><FontAwesomeIcon icon={faSearch} /> Track</>
            )}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {complaint && (
          <div className="complaint-details">
            <div className="complaint-header">
              <div className="complaint-title">
                <h2>{complaint.title}</h2>
                <div className="tracking-id-container">
                  Tracking ID: <span className="tracking-id">{complaint.trackingId}</span>
                </div>
              </div>
              <div className="status-container">
                {getStatusBadge(complaint.status)}
              </div>
            </div>

            <div className="complaint-meta">
              <div className="meta-item">
                <FontAwesomeIcon icon={faCalendarAlt} />
                <span>Submitted on {format(new Date(complaint.createdAt), 'MMM d, yyyy')}</span>
              </div>
              <div className="meta-item">
                <FontAwesomeIcon icon={faTag} />
                <span>Category: {complaint.category?.name || 'Uncategorized'}</span>
              </div>
              {complaint.agency && (
                <div className="meta-item">
                  <FontAwesomeIcon icon={faBuilding} />
                  <span>Agency: {complaint.agency.name}</span>
                </div>
              )}
            </div>

            <div className="complaint-description">
              <h3>Description</h3>
              <p>{complaint.description}</p>
            </div>

            {complaint.location && (
              <div className="complaint-location">
                <h3>Location</h3>
                <p>
                  {[
                    complaint.location.address,
                    complaint.location.sector,
                    complaint.location.district
                  ].filter(Boolean).join(', ')}
                </p>
              </div>
            )}

            {complaint.responses && complaint.responses.length > 0 && (
              <div className="complaint-responses">
                <h3>Responses</h3>
                {complaint.responses.map((response) => (
                  <div key={response._id} className="response-item">
                    <div className="response-header">
                      <span className="response-from">{response.responseFrom}</span>
                      <span className="response-date">{format(new Date(response.createdAt), 'MMM d, yyyy')}</span>
                    </div>
                    <p className="response-content">{response.content}</p>
                  </div>
                ))}
              </div>
            )}

            {complaint.attachments && complaint.attachments.length > 0 && (
              <div className="complaint-attachments">
                <h3>Attachments</h3>
                <div className="attachments-list">
                  {complaint.attachments.map((attachment, index) => (
                    <a 
                      key={index} 
                      href={attachment.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="attachment-link"
                    >
                      {attachment.originalName || `Attachment ${index + 1}`}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>      <div className="track-complaint-info">
        <div className="info-card">
          <h3>How to Use This Page</h3>
          <p>When you submit a complaint through SAYIT, you receive a unique tracking ID. Enter this ID above to check your complaint's current status.</p>
        </div>
        
        <div className="info-card">
          <h3>Status Meanings</h3>
          <ul className="status-list">
            <li><span className="status-dot pending"></span> <b>Pending</b>: Your complaint has been received but not yet reviewed.</li>
            <li><span className="status-dot under-review"></span> <b>Under Review</b>: Your complaint is being reviewed by our staff.</li>
            <li><span className="status-dot assigned"></span> <b>Assigned</b>: Your complaint has been assigned to the appropriate agency.</li>
            <li><span className="status-dot in-progress"></span> <b>In Progress</b>: The agency is actively working on your complaint.</li>
            <li><span className="status-dot resolved"></span> <b>Resolved</b>: Your complaint has been resolved.</li>
            <li><span className="status-dot closed"></span> <b>Closed</b>: Your complaint case has been closed.</li>
            <li><span className="status-dot rejected"></span> <b>Rejected</b>: Your complaint could not be processed.</li>
          </ul>
        </div>
      </div>
      
      <div className="track-complaint-cta">
        <h3>Need to submit a new complaint?</h3>
        <p>You can submit a complaint without needing to create an account or log in.</p>
        <Link to="/submit-complaint" className="cta-button">
          <FontAwesomeIcon icon={faPaperPlane} /> Submit a Complaint
        </Link>
      </div>
    </div>
  );
};

export default TrackComplaint;
