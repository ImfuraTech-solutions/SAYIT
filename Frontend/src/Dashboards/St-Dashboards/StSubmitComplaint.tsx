import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

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
}

interface StSubmitComplaintProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const StSubmitComplaint: React.FC<StSubmitComplaintProps> = ({ isOpen, onClose, onSuccess }) => {
  // Form data state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    preferredAgency: '',
    isPublic: false,
    location: {
      address: '',
      city: '',
      coordinates: { lat: 0, lng: 0 }
    },
    urgencyLevel: 'normal' // low, normal, high
  });
    // Other state management
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [agencies, setAgencies] = useState<Agency[]>([]);  const [loading, setLoading] = useState<boolean>(false);
  const [showLocationPicker] = useState<boolean>(false);
  const [useCurrentLocation, setUseCurrentLocation] = useState<boolean>(false);
  
  const modalRef = useRef<HTMLDivElement>(null);

  // Fetch categories and agencies
  useEffect(() => {
    if (isOpen) {
      // Fetch categories
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
          // Don't show error toast for non-critical feature
        }
      };
      
      // Fetch agencies
      const fetchAgencies = async () => {
        try {
          const response = await axios.get('/api/agencies');
          
          if (response.data.success) {
            setAgencies(response.data.data || []);
          } else {
            toast.error('Failed to load agencies');
          }
        } catch (error) {
          console.error('Error fetching agencies:', error);
          // Don't show error toast for non-critical feature
        }
      };
      
      fetchCategories();
      fetchAgencies();
    }
  }, [isOpen]);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  // Handle escape key press
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen, onClose]);

  // Get user's current location
  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({
            ...prev,
            location: {
              ...prev.location,
              coordinates: { lat: latitude, lng: longitude }
            }
          }));
          
          // Try to get address from coordinates using reverse geocoding
          fetchAddressFromCoordinates(latitude, longitude);
          
          setUseCurrentLocation(true);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Could not get your current location. Please enter it manually.');
          setUseCurrentLocation(false);
        }
      );
    } else {
      toast.error('Geolocation is not supported by your browser');
      setUseCurrentLocation(false);
    }
  };
  // Fetch address from coordinates using reverse geocoding
  const fetchAddressFromCoordinates = async (latitude: number, longitude: number) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );
      
      if (response.data.results && response.data.results.length > 0) {
        const addressComponents = response.data.results[0].address_components;
        const formattedAddress = response.data.results[0].formatted_address;
        
        // Extract city from address components
        let city = '';
        for (let component of addressComponents) {
          if (component.types.includes('locality')) {
            city = component.long_name;
            break;
          }
        }
        
        setFormData(prev => ({
          ...prev,
          location: {
            ...prev.location,
            address: formattedAddress,
            city: city
          }
        }));
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      // Silently fail, user can enter address manually
    }
  };
  // Handle input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      const parentKey = parent as keyof typeof formData;
      const parentValue = formData[parentKey];
      
      if (parentValue && typeof parentValue === 'object' && !Array.isArray(parentValue)) {
        setFormData((prevData) => ({
          ...prevData,
          [parentKey]: {
            ...parentValue,
            [child]: value,
          },
        }));
      }
    } else {
      setFormData((prevData) => ({
        ...prevData,
        [name]: value,
      }));
    }
    
    // Clear error for this field
    if (errors[name]) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        [name]: '',
      }));
    }
  };

  // Handle checkbox change
  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: checked,
    }));
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
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit complaint
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
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
      formDataToSend.append('isPublic', String(formData.isPublic));
      formDataToSend.append('urgencyLevel', formData.urgencyLevel);
      
      if (formData.preferredAgency) {
        formDataToSend.append('preferredAgency', formData.preferredAgency);
      }
      
      if (formData.location.address || formData.location.city || 
          (useCurrentLocation && formData.location.coordinates.lat !== 0)) {
        formDataToSend.append('location', JSON.stringify(formData.location));
      }
      
      // Append files
      files.forEach(file => {
        formDataToSend.append('attachments', file);
      });
      
      const response = await axios.post('/api/standarduser/complaints', formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        toast.success('Complaint submitted successfully!');
        
        // Reset form
        setFormData({
          title: '',
          description: '',
          category: '',
          preferredAgency: '',
          isPublic: false,
          location: {
            address: '',
            city: '',
            coordinates: { lat: 0, lng: 0 }
          },
          urgencyLevel: 'normal'
        });
        setFiles([]);
        
        // Call onSuccess callback
        onSuccess();
      } else {
        toast.error(response.data.message || 'Error submitting complaint');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center bg-black bg-opacity-50">
      <div 
        className="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl mx-4"
        ref={modalRef}
      >
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-b">
          <h2 className="text-xl font-bold text-gray-800">Submit New Complaint</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            aria-label="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-6">
          {/* Basic Information */}
          <div className="space-y-6">
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm rounded-md ${
                  errors.title ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Brief title for your complaint"
              />
              {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                rows={5}
                value={formData.description}
                onChange={handleInputChange}
                className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm rounded-md ${
                  errors.description ? 'border-red-300' : 'border-gray-300'
                }`}
                placeholder="Provide detailed information about your complaint"
              />
              {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                <select
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  className={`shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm rounded-md ${
                    errors.category ? 'border-red-300' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a category</option>
                  {categories.map(category => (
                    <option key={category._id} value={category._id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category}</p>}
              </div>

              <div>
                <label htmlFor="preferredAgency" className="block text-sm font-medium text-gray-700 mb-1">
                  Preferred Agency (Optional)
                </label>
                <select
                  id="preferredAgency"
                  name="preferredAgency"
                  value={formData.preferredAgency}
                  onChange={handleInputChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  <option value="">Select an agency (optional)</option>
                  {agencies.map(agency => (
                    <option key={agency._id} value={agency._id}>
                      {agency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="urgencyLevel" className="block text-sm font-medium text-gray-700 mb-1">
                  Urgency Level
                </label>
                <select
                  id="urgencyLevel"
                  name="urgencyLevel"
                  value={formData.urgencyLevel}
                  onChange={handleInputChange}
                  className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                >
                  <option value="low">Low - Can be addressed when resources are available</option>
                  <option value="normal">Normal - Requires standard attention</option>
                  <option value="high">High - Requires prompt attention</option>
                </select>
              </div>
              
              <div className="flex items-center">
                <input
                  id="isPublic"
                  name="isPublic"
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={handleCheckboxChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="isPublic" className="ml-2 block text-sm text-gray-900">
                  Make this complaint publicly visible (anonymously)
                </label>
                <span 
                  className="ml-1 text-gray-500 cursor-help"
                  title="Public complaints help raise awareness. Your personal information remains confidential."
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center">
                <label className="block text-sm font-medium text-gray-700">
                  Location Information
                </label>
                <button
                  type="button"
                  onClick={getCurrentLocation}
                  className="text-sm text-blue-600 hover:text-blue-500"
                >
                  Use Current Location
                </button>
              </div>
              
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="location.address" className="block text-xs text-gray-500">
                    Address
                  </label>
                  <input
                    type="text"
                    id="location.address"
                    name="location.address"
                    value={formData.location.address}
                    onChange={handleInputChange}
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="Street address"
                  />
                </div>
                
                <div>
                  <label htmlFor="location.city" className="block text-xs text-gray-500">
                    City
                  </label>
                  <input
                    type="text"
                    id="location.city"
                    name="location.city"
                    value={formData.location.city}
                    onChange={handleInputChange}
                    className="mt-1 shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="City"
                  />
                </div>
              </div>
              
              {useCurrentLocation && formData.location.coordinates.lat !== 0 && (
                <p className="mt-2 text-xs text-green-600">
                  Current location coordinates captured successfully
                </p>
              )}
              
              {showLocationPicker && (
                <div className="mt-4 border border-gray-200 rounded-md p-2">
                  {/* Map component would go here if we had one */}
                  <p className="text-sm text-gray-600">
                    Please click on the map to select your location or enter the address manually above.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Attachments (Optional, max 5 files, 10MB each)
              </label>
              <input
                type="file"
                id="attachments"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {files.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500">Selected files:</p>
                  <ul className="list-disc pl-5 text-xs text-gray-500">
                    {files.map((file, index) => (
                      <li key={index}>
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Submit button */}
          <div className="mt-8 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Submitting...
                </>
              ) : 'Submit Complaint'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StSubmitComplaint;