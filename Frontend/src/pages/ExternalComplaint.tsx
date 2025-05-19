import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPaperPlane, faSpinner, faCheck, 
  faExclamationTriangle, 
  faTimes, faFileAlt, faPlus 
} from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import '../styles/pages/ExternalComplaint.css';

// Types
interface Category {
  _id: string;
  name: string;
  description?: string;
}

interface Agency {
  _id: string;
  name: string;
  shortName?: string;
  description?: string;
  logo?: string;
}

interface UploadedFile {
  file: File;
  preview: string;
  name: string;
}

interface SuccessData {
  trackingId: string;
  title: string;
  category: string;
  agency: string;
  status: string;
  createdAt: string;
}

const ExternalComplaint: React.FC = () => {  // Form state
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [agencyId, setAgencyId] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [contactMethod, setContactMethod] = useState<'email' | 'phone' | 'none'>('none');
  const [location, setLocation] = useState<{
    address: string;
    district: string;
    sector: string;
  }>({
    address: '',
    district: '',
    sector: ''
  });
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState<string>('');
  // UI state
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [loadingAgencies, setLoadingAgencies] = useState<boolean>(true);
  // Fetch categories and agencies on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch categories and agencies in parallel
        const [categoriesResponse, agenciesResponse] = await Promise.all([
          axios.get(`${import.meta.env.VITE_API_URL}/api/complaints/categories`),
          axios.get(`${import.meta.env.VITE_API_URL}/api/external/agencies`)
        ]);
        
        if (categoriesResponse.data && categoriesResponse.data.success) {
          setCategories(categoriesResponse.data.data);
        }
        
        if (agenciesResponse.data && agenciesResponse.data.success) {
          setAgencies(agenciesResponse.data.data);
        }
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load necessary data. Please refresh the page.');
      } finally {
        setLoadingCategories(false);
        setLoadingAgencies(false);
      }
    };

    fetchData();
  }, []);

  // Handle file uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map(file => ({
        file,
        preview: URL.createObjectURL(file),
        name: file.name
      }));
      
      // Limit to 5 files maximum
      const updatedFiles = [...files, ...newFiles].slice(0, 5);
      setFiles(updatedFiles);
    }
  };

  // Remove file from list
  const removeFile = (index: number) => {
    const updatedFiles = [...files];
    URL.revokeObjectURL(updatedFiles[index].preview);
    updatedFiles.splice(index, 1);
    setFiles(updatedFiles);
  };

  // Handle tag input
  const addTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  // Remove tag from list
  const removeTag = (index: number) => {
    const updatedTags = [...tags];
    updatedTags.splice(index, 1);
    setTags(updatedTags);
  };

  // Handle tag input key press (add on Enter)
  const handleTagKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!title.trim()) {
      setError('Please enter a title for your complaint');
      return;
    }
    
    if (!description.trim()) {
      setError('Please provide a description of your complaint');
      return;
    }
    
    if (!categoryId) {
      setError('Please select a category');
      return;
    }
    
    if (contactMethod === 'email' && !email.trim()) {
      setError('Please provide an email address for contact');
      return;
    }
    
    if (contactMethod === 'phone' && !phone.trim()) {
      setError('Please provide a phone number for contact');
      return;
    }
    
    // Log the selected agency for debugging
    if (agencyId) {
      console.log('Selected agency ID:', agencyId);
      const selectedAgency = agencies.find(agency => agency._id === agencyId);
      console.log('Selected agency:', selectedAgency?.name);
    } else {
      console.log('No agency selected, will use default agency for category');
    }
    
    // Start loading state
    setLoading(true);
    setError(null);
    
    // Create form data for multipart upload (files + json data)
    const formData = new FormData();
      // Add basic fields
    formData.append('title', title);
    formData.append('description', description);
    formData.append('category', categoryId);
    if (agencyId) {
      formData.append('agency', agencyId);
    }
    
    // Add contact info
    const contactInfo = {
      email: contactMethod === 'email' ? email : '',
      phone: contactMethod === 'phone' ? phone : '',
      preferredMethod: contactMethod
    };
    formData.append('contactInfo', JSON.stringify(contactInfo));
    
    // Add location if any fields are filled
    if (location.address || location.district || location.sector) {
      formData.append('location', JSON.stringify(location));
    }
    
    // Add tags
    if (tags.length > 0) {
      formData.append('tags', tags.join(','));
    }
    
    // Add files
    files.forEach(fileItem => {
      formData.append('attachments', fileItem.file);
    });
    
    try {
      // Submit the external complaint
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/external/complaints`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      
      if (response.data && response.data.success) {
        setSuccess(true);
        setSuccessData(response.data.data);
          // Reset form fields
        setTitle('');
        setDescription('');
        setCategoryId('');
        setAgencyId(''); // Reset agency selection
        setEmail('');
        setPhone('');
        setContactMethod('none');
        setLocation({ address: '', district: '', sector: '' });
        setTags([]);
        
        // Clean up file previews and reset files
        files.forEach(fileItem => URL.revokeObjectURL(fileItem.preview));
        setFiles([]);
      }
    } catch (err: any) {
      console.error('Error submitting complaint:', err);
      setError(
        err.response?.data?.message || 
        'Failed to submit your complaint. Please try again later.'
      );
    } finally {
      setLoading(false);
    }
  };
    // Reset the form to submit another complaint
  const resetForm = () => {
    setSuccess(false);
    setSuccessData(null);
    // Ensure all form fields are reset
    setTitle('');
    setDescription('');
    setCategoryId('');
    setAgencyId(''); // Reset agency selection
    setEmail('');
    setPhone('');
    setContactMethod('none');
    setLocation({ address: '', district: '', sector: '' });
    setTags([]);
    
    // Clean up file previews and reset files
    files.forEach(fileItem => URL.revokeObjectURL(fileItem.preview));
    setFiles([]);
  };

  // Show success message after submission
  if (success && successData) {
    return (
      <div className="external-complaint-container">
        <div className="success-container">
          <div className="success-icon">
            <FontAwesomeIcon icon={faCheck} />
          </div>
          
          <h1>Complaint Submitted Successfully!</h1>
          
          <div className="tracking-info">
            <p className="tracking-label">Your Tracking ID:</p>
            <p className="tracking-id">{successData.trackingId}</p>
            <p className="tracking-instruction">
              Please save this tracking ID to check the status of your complaint later.
            </p>
          </div>
          
          <div className="complaint-summary">
            <h3>Complaint Summary:</h3>
            <div className="summary-item">
              <span>Title:</span>
              <p>{successData.title}</p>
            </div>
            <div className="summary-item">
              <span>Category:</span>
              <p>{successData.category}</p>
            </div>            <div className="summary-item">
                <span>Assigned Agency:</span>
                <p>{successData.agency || 'No agency assigned yet'}</p>
                {!successData.agency && (
                  <div className="agency-note">
                    Your complaint will be assigned to an appropriate agency shortly.
                  </div>
                )}
              </div>
            <div className="summary-item">
              <span>Status:</span>
              <p className="status-badge">{successData.status}</p>
            </div>
            <div className="summary-item">
              <span>Submitted:</span>
              <p>{new Date(successData.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
            {contactMethod === 'email' && (
            <div className="email-notification">
              <p>
                <FontAwesomeIcon icon={faCheck} /> A confirmation email with your tracking information 
                has been sent to <strong>{email}</strong>
              </p>
            </div>
          )}
          
          {contactMethod === 'phone' && (
            <div className="phone-notification">
              <p>
                <FontAwesomeIcon icon={faCheck} /> We will contact you at <strong>{phone}</strong> with any updates
              </p>
            </div>
          )}
          
          <div className="action-buttons">
            <button 
              className="track-button"
              onClick={() => window.location.href = '/track-complaint'}
            >
              Track Complaint Status
            </button>
            <button 
              className="submit-another-button"
              onClick={resetForm}
            >
              Submit Another Complaint
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="external-complaint-container">
      <div className="external-complaint-header">
        <h1>Submit a Complaint</h1>
        <p className="subtitle">
          Submit your complaint anonymously without creating an account
        </p>
      </div>
      
      {error && (
        <div className="error-message">
          <FontAwesomeIcon icon={faExclamationTriangle} />
          <span>{error}</span>
          <button onClick={() => setError(null)} className="dismiss-button">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="external-complaint-form">
        {/* Title */}
        <div className="form-group">
          <label htmlFor="title">
            Complaint Title <span className="required">*</span>
          </label>
          <input
            type="text"
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter a brief title for your complaint"
            className="form-control"
            maxLength={100}
            required
          />
          <div className="char-count">{title.length}/100</div>
        </div>
        
        {/* Category */}
        <div className="form-group">
          <label htmlFor="category">
            Category <span className="required">*</span>
          </label>
          <select
            id="category"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="form-control"
            required
            disabled={loadingCategories}
          >
            <option value="">Select a category</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.name}
              </option>
            ))}
          </select>
          {loadingCategories && <div className="loading-text">Loading categories...</div>}
        </div>
        
        {/* Agency */}
        <div className="form-group">
          <label htmlFor="agency">
            Agency to Report To
          </label>
          <select
            id="agency"
            value={agencyId}
            onChange={(e) => setAgencyId(e.target.value)}
            className="form-control"
            disabled={loadingAgencies}
          >
            <option value="">Select an agency (or leave blank for automatic assignment)</option>
            {agencies.map((agency) => (
              <option key={agency._id} value={agency._id}>
                {agency.name} {agency.shortName ? `(${agency.shortName})` : ''}
              </option>
            ))}
          </select>
          {loadingAgencies && <div className="loading-text">Loading agencies...</div>}
          <div className="form-help-text">
            If left blank, the complaint will be assigned to the default agency for the selected category
          </div>
        </div>
        
        {/* Description */}
        <div className="form-group">
          <label htmlFor="description">
            Description <span className="required">*</span>
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Please provide a detailed description of your complaint"
            className="form-control"
            rows={6}
            maxLength={2000}
            required
          />
          <div className="char-count">{description.length}/2000</div>
        </div>
        
        {/* Contact Information */}
        <div className="form-section">
          <h3>Contact Information</h3>
          <p className="section-help">
            Your contact information is optional. If provided, we'll update you on your complaint status.
          </p>
          
          <div className="contact-preferences">
            <div className="radio-group">
              <input
                type="radio"
                id="contact-none"
                name="contact-method"
                value="none"
                checked={contactMethod === 'none'}
                onChange={() => setContactMethod('none')}
              />
              <label htmlFor="contact-none">No contact (anonymous)</label>
            </div>
            
            <div className="radio-group">
              <input
                type="radio"
                id="contact-email"
                name="contact-method"
                value="email"
                checked={contactMethod === 'email'}
                onChange={() => setContactMethod('email')}
              />
              <label htmlFor="contact-email">Email</label>
            </div>
            
            <div className="radio-group">
              <input
                type="radio"
                id="contact-phone"
                name="contact-method"
                value="phone"
                checked={contactMethod === 'phone'}
                onChange={() => setContactMethod('phone')}
              />
              <label htmlFor="contact-phone">Phone</label>
            </div>
          </div>
          
          {contactMethod === 'email' && (
            <div className="form-group">
              <label htmlFor="email">Email Address <span className="required">*</span></label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                className="form-control"
                required
              />
            </div>
          )}
          
          {contactMethod === 'phone' && (
            <div className="form-group">
              <label htmlFor="phone">Phone Number <span className="required">*</span></label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="form-control"
                required
              />
            </div>
          )}
        </div>
        
        {/* Location Information */}
        <div className="form-section">
          <h3>Location Information</h3>
          <p className="section-help">Help us locate where the issue occurred</p>
          
          <div className="form-group">
            <label htmlFor="address">Address</label>
            <input
              type="text"
              id="address"
              value={location.address}
              onChange={(e) => setLocation({ ...location, address: e.target.value })}
              placeholder="Street address or landmark"
              className="form-control"
            />
          </div>
          
          <div className="form-row">
            <div className="form-group half">
              <label htmlFor="sector">Sector</label>
              <input
                type="text"
                id="sector"
                value={location.sector}
                onChange={(e) => setLocation({ ...location, sector: e.target.value })}
                placeholder="Sector"
                className="form-control"
              />
            </div>
            
            <div className="form-group half">
              <label htmlFor="district">District</label>
              <input
                type="text"
                id="district"
                value={location.district}
                onChange={(e) => setLocation({ ...location, district: e.target.value })}
                placeholder="District"
                className="form-control"
              />
            </div>
          </div>
        </div>
        
        {/* File Attachments */}
        <div className="form-section">
          <h3>Attachments</h3>
          <p className="section-help">
            Add up to 5 files to support your complaint (photos, documents, etc.)
          </p>
          
          <div className="file-upload-container">
            <label className="file-upload-label">
              <input
                type="file"
                onChange={handleFileChange}
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                disabled={files.length >= 5}
                className="file-input"
              />
              <FontAwesomeIcon icon={faPlus} />
              <span>Add Files</span>
            </label>
            
            <div className="upload-limit-text">
              {files.length}/5 files added
            </div>
          </div>
          
          {files.length > 0 && (
            <div className="file-preview-container">
              {files.map((fileItem, index) => (
                <div key={index} className="file-preview-item">
                  <div className="file-preview-content">
                    {fileItem.file.type.startsWith('image/') ? (
                      <img src={fileItem.preview} alt="Preview" className="file-preview-image" />
                    ) : (
                      <div className="file-preview-document">
                        <FontAwesomeIcon icon={faFileAlt} />
                      </div>
                    )}
                  </div>
                  <div className="file-preview-details">
                    <div className="file-preview-name" title={fileItem.name}>
                      {fileItem.name.length > 20
                        ? `${fileItem.name.substring(0, 17)}...`
                        : fileItem.name}
                    </div>
                    <div className="file-preview-size">
                      {(fileItem.file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="file-remove-button"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Tags */}
        <div className="form-section">
          <h3>Tags</h3>
          <p className="section-help">
            Add relevant tags to help categorize your complaint (optional)
          </p>
          
          <div className="tag-input-container">
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyPress={handleTagKeyPress}
              placeholder="Type a tag and press Enter"
              className="tag-input"
            />
            <button
              type="button"
              onClick={addTag}
              className="tag-add-button"
              disabled={!tagInput.trim()}
            >
              Add
            </button>
          </div>
          
          {tags.length > 0 && (
            <div className="tags-container">
              {tags.map((tag, index) => (
                <div key={index} className="tag-item">
                  <span>{tag}</span>
                  <button
                    type="button"
                    onClick={() => removeTag(index)}
                    className="tag-remove-button"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Submit Button */}
        <div className="form-actions">
          <button
            type="submit"
            className="submit-button"
            disabled={loading}
          >
            {loading ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Submitting...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faPaperPlane} /> Submit Complaint
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ExternalComplaint;
