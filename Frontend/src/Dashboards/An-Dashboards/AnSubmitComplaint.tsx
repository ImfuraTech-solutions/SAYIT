import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

interface Category {
  _id: string;
  name: string;
  description?: string;
}

interface AnSubmitComplaintProps {
  isOpen: boolean;
  onClose: () => void;
}

const AnSubmitComplaint: React.FC<AnSubmitComplaintProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    location: {
      address: '',
      city: '',
      coordinates: { lat: 0, lng: 0 }
    },
    contactInfo: {
      email: '',
      phone: ''
    }
  });
  
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  // Fetch categories when component mounts
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await axios.get('/api/categories');
        
        if (response.data.success) {
          setCategories(response.data.data || []);
        } else {
          toast.error('Failed to load complaint categories');
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Don't show error toast as it's not critical
        setCategories([]);
      }
    };
    
    if (isOpen) {
      fetchCategories();
    }
  }, [isOpen]);
    // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      const parentKey = parent as keyof typeof formData;
      const parentValue = formData[parentKey];
      
      // Ensure parentValue is an object before spreading
      if (parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)) {
        setFormData({
          ...formData,
          [parentKey]: {
            ...parentValue,
            [child]: value
          }
        });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };
  
  // Handle file change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      
      // Validate file size (max 10MB per file)
      const maxSize = 10 * 1024 * 1024; // 10MB
      const oversizedFiles = selectedFiles.filter(file => file.size > maxSize);
      
      if (oversizedFiles.length > 0) {
        toast.error(`Some files exceed the 10MB size limit: ${oversizedFiles.map(f => f.name).join(', ')}`);
        return;
      }
      
      // Limit to 5 files
      if (selectedFiles.length > 5) {
        toast.warning('Maximum 5 files allowed. Only the first 5 will be used.');
      }
      
      setFiles(selectedFiles.slice(0, 5));
    }
  };
  
  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    } else if (formData.title.length < 5) {
      newErrors.title = 'Title must be at least 5 characters';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < 20) {
      newErrors.description = 'Description must be at least 20 characters';
    }
    
    if (!formData.category) {
      newErrors.category = 'Please select a category';
    }
    
    if (formData.contactInfo.email && !/^\S+@\S+\.\S+$/.test(formData.contactInfo.email)) {
      newErrors['contactInfo.email'] = 'Please enter a valid email address';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Submit complaint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('title', formData.title);
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
      
      if (formData.location.address || formData.location.city) {
        formDataToSend.append('location', JSON.stringify(formData.location));
      }
      
      if (formData.contactInfo.email || formData.contactInfo.phone) {
        formDataToSend.append('contactInfo', JSON.stringify(formData.contactInfo));
      }
      
      // Append files
      files.forEach(file => {
        formDataToSend.append('attachments', file);
      });
      
      const response = await axios.post('/api/anonymous/complaints', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        toast.success(response.data.message || 'Complaint submitted successfully!');
        
        // Display tracking ID if provided
        if (response.data.data?.trackingId) {
          toast.info(`Your tracking ID: ${response.data.data.trackingId}`, {
            autoClose: 10000, // Keep open longer
          });
        }
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          category: '',
          location: {
            address: '',
            city: '',
            coordinates: { lat: 0, lng: 0 }
          },
          contactInfo: {
            email: '',
            phone: ''
          }
        });
        setFiles([]);
        
        // Close modal
        onClose();
      }
    } catch (error: any) {
      console.error('Error submitting complaint:', error);
      
      // Show detailed error messages if available
      if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else if (error.response?.data?.errors) {
        // Handle validation errors
        const validationErrors = error.response.data.errors;
        const newErrors: Record<string, string> = {};
        
        validationErrors.forEach((err: any) => {
          newErrors[err.param] = err.msg;
        });
        
        setErrors(newErrors);
        toast.error('Please fix the errors in the form');
      } else {
        toast.error('Failed to submit complaint. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  // No need to render if not open
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-10 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  Submit New Complaint
                </h3>
                <div className="mt-4">
                  <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                      <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        id="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm ${errors.title ? 'border-red-300' : 'border-gray-300'} rounded-md`}
                        placeholder="Brief title for your complaint"
                      />
                      {errors.title && (
                        <p className="mt-1 text-sm text-red-600">{errors.title}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                        Description <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="description"
                        id="description"
                        rows={5}
                        value={formData.description}
                        onChange={handleInputChange}
                        className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm ${errors.description ? 'border-red-300' : 'border-gray-300'} rounded-md`}
                        placeholder="Provide details about your complaint. Include relevant information like dates, locations, and specific issues."
                      ></textarea>
                      {errors.description && (
                        <p className="mt-1 text-sm text-red-600">{errors.description}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                        Category <span className="text-red-500">*</span>
                      </label>
                      <select
                        name="category"
                        id="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm ${errors.category ? 'border-red-300' : 'border-gray-300'} rounded-md`}
                      >
                        <option value="">Select a category</option>
                        {categories.map(category => (
                          <option key={category._id} value={category._id}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      {errors.category && (
                        <p className="mt-1 text-sm text-red-600">{errors.category}</p>
                      )}
                    </div>

                    <div className="mb-4">
                      <label htmlFor="attachments" className="block text-sm font-medium text-gray-700 mb-1">
                        Attachments (Optional, max 5 files, 10MB each)
                      </label>
                      <input
                        type="file"
                        id="attachments"
                        multiple
                        onChange={handleFileChange}
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
                      <p className="mt-1 text-xs text-gray-500">
                        Supported formats: Images (JPG, PNG), Documents (PDF, DOC, DOCX), Videos (MP4)
                      </p>
                    </div>

                    <div className="mb-6">
                      <h4 className="block text-sm font-medium text-gray-700 mb-2">
                        Additional Information (Optional)
                      </h4>
                      
                      <div className="bg-gray-50 p-4 rounded-md">
                        <div className="mb-4">
                          <label htmlFor="location.address" className="block text-sm font-medium text-gray-700 mb-1">
                            Location Details
                          </label>
                          <input
                            type="text"
                            name="location.address"
                            id="location.address"
                            value={formData.location.address}
                            onChange={handleInputChange}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md mb-2"
                            placeholder="Address related to the complaint"
                          />
                          <input
                            type="text"
                            name="location.city"
                            id="location.city"
                            value={formData.location.city}
                            onChange={handleInputChange}
                            className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                            placeholder="City"
                          />
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Contact Information for Updates
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <input
                                type="email"
                                name="contactInfo.email"
                                value={formData.contactInfo.email}
                                onChange={handleInputChange}
                                className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm ${errors['contactInfo.email'] ? 'border-red-300' : 'border-gray-300'} rounded-md`}
                                placeholder="Email"
                              />
                              {errors['contactInfo.email'] && (
                                <p className="mt-1 text-sm text-red-600">{errors['contactInfo.email']}</p>
                              )}
                            </div>
                            <input
                              type="tel"
                              name="contactInfo.phone"
                              value={formData.contactInfo.phone}
                              onChange={handleInputChange}
                              className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                              placeholder="Phone"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            This information will only be used to send you updates about this specific complaint.
                          </p>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : 'Submit Complaint'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnSubmitComplaint;