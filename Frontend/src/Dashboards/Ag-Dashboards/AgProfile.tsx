import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

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

interface AgProfileProps {
  agentProfile: AgentProfile | null;
  onUpdateProfile: () => void;
}

const AgProfile: React.FC<AgProfileProps> = ({ agentProfile, onUpdateProfile }) => {
  // Form state
  const [formData, setFormData] = useState<Partial<AgentProfile>>({
    name: '',
    phone: '',
    position: '',
    department: ''
  });
  
  // Other state
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data when agentProfile changes
  useEffect(() => {
    if (agentProfile) {
      setFormData({
        name: agentProfile.name || '',
        phone: agentProfile.phone || '',
        position: agentProfile.position || '',
        department: agentProfile.department || ''
      });
      
      // Set image preview if profile image exists
      if (agentProfile.profileImage) {
        setImagePreview(agentProfile.profileImage);
      }
    }
  }, [agentProfile]);

  // Handle input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors((prevErrors) => ({
        ...prevErrors,
        [name]: '',
      }));
    }
  };

  // Handle profile image selection
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate file type
      if (!file.type.match(/^image\/(jpeg|png|jpg)$/)) {
        toast.error('Please select a valid image file (JPEG, PNG)');
        return;
      }
      
      // Validate file size (max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size must be less than 5MB');
        return;
      }
      
      setProfileImage(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Toggle edit mode
  const toggleEditMode = () => {
    setIsEditing(!isEditing);
    
    // Reset form when cancelling
    if (isEditing && agentProfile) {
      setFormData({
        name: agentProfile.name || '',
        phone: agentProfile.phone || '',
        position: agentProfile.position || '',
        department: agentProfile.department || ''
      });
      
      // Reset image preview
      if (agentProfile.profileImage) {
        setImagePreview(agentProfile.profileImage);
      } else {
        setImagePreview(null);
      }
      
      setProfileImage(null);
      setErrors({});
    }
  };

  // Validate form data
  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (formData.phone && !/^\+?[0-9\s-()]{7,20}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Update profile
  const updateProfile = async () => {
    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    
    setLoading(true);
    
    try {
      // Create form data for multipart request
      const profileFormData = new FormData();
      profileFormData.append('name', formData.name || '');
      
      if (formData.phone) {
        profileFormData.append('phone', formData.phone);
      }
      
      if (formData.position) {
        profileFormData.append('position', formData.position);
      }
      
      if (formData.department) {
        profileFormData.append('department', formData.department);
      }
      
      // Add profile image if selected
      if (profileImage) {
        profileFormData.append('profileImage', profileImage);
      }
      
      const response = await axios.put('/api/agent/profile', profileFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        onUpdateProfile(); // Refresh the agent profile data
      } else {
        toast.error(response.data.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      
      if (error.response?.data?.errors) {
        // Handle validation errors from API
        const apiErrors = error.response.data.errors;
        const formattedErrors: Record<string, string> = {};
        
        apiErrors.forEach((err: any) => {
          formattedErrors[err.param] = err.msg;
        });
        
        setErrors(formattedErrors);
        toast.error('Please correct the errors in the form');
      } else if (error.response?.data?.message) {
        toast.error(error.response.data.message);
      } else {
        toast.error('Failed to update profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!agentProfile) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">Agent Profile</h2>
          <button
            type="button"
            onClick={toggleEditMode}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              isEditing 
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>
        </div>
        
        {/* Profile Content */}
        <div className="p-6">
          {/* Profile Image Section */}
          <div className="flex flex-col sm:flex-row items-center mb-8">
            <div className="relative">
              <div className="h-32 w-32 rounded-full bg-gray-200 overflow-hidden border-4 border-white shadow-md">
                {imagePreview ? (
                  <img 
                    src={imagePreview} 
                    alt="Profile Preview" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-blue-100 text-blue-600">
                    <span className="text-4xl font-semibold">
                      {agentProfile.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              
              {isEditing && (
                <button
                  type="button"
                  onClick={triggerFileInput}
                  className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full shadow-md hover:bg-blue-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
              )}
              
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageChange}
                accept="image/jpeg, image/png"
                className="hidden"
              />
            </div>
            
            <div className="mt-4 sm:mt-0 sm:ml-8 text-center sm:text-left">
              <h3 className="text-2xl font-bold text-gray-800">
                {isEditing ? (
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className={`block w-full px-3 py-2 border ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-lg`}
                    placeholder="Your Name"
                  />
                ) : (
                  agentProfile.name
                )}
              </h3>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
              
              <p className="text-gray-600 mt-1">{agentProfile.email}</p>
              <p className="mt-2 inline-flex items-center text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded-md">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                {agentProfile.agency?.name}
              </p>
            </div>
          </div>
          
          {/* Agent Information */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Contact Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                {isEditing ? (
                  <div>
                    <input
                      type="tel"
                      name="phone"
                      id="phone"
                      value={formData.phone || ''}
                      onChange={handleInputChange}
                      className={`block w-full px-3 py-2 border ${
                        errors.phone ? 'border-red-300' : 'border-gray-300'
                      } rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                      placeholder="Phone Number"
                    />
                    {errors.phone && (
                      <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600">
                    {agentProfile.phone || 'Not provided'}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <p className="text-gray-600">
                  {agentProfile.email}
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Verified
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">To change your email, please contact agency admin</p>
              </div>
            </div>
          </div>
          
          {/* Agency Position Information */}
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Position Information</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                  Job Title / Position
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="position"
                    id="position"
                    value={formData.position || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Position / Job Title"
                  />
                ) : (
                  <p className="text-gray-600">
                    {agentProfile.position || 'Not specified'}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    name="department"
                    id="department"
                    value={formData.department || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Department"
                  />
                ) : (
                  <p className="text-gray-600">
                    {agentProfile.department || 'Not specified'}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
                  Employee ID
                </label>
                <p className="text-gray-600">
                  {agentProfile.employeeId || 'Not provided'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Contact agency admin to update employee ID</p>
              </div>
              
              <div>
                <label htmlFor="agency" className="block text-sm font-medium text-gray-700 mb-1">
                  Agency
                </label>
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-8 w-8 rounded overflow-hidden bg-gray-100 mr-2">
                    {agentProfile.agency?.logo ? (
                      <img 
                        src={agentProfile.agency.logo}
                        alt={`${agentProfile.agency.name} Logo`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-blue-200 text-blue-700 font-semibold">
                        {agentProfile.agency?.name.charAt(0).toUpperCase() || 'A'}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-600">
                    {agentProfile.agency?.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Agency Description */}
          {agentProfile.agency?.description && (
            <div className="mb-8">
              <h4 className="text-lg font-semibold text-gray-800 mb-2">About {agentProfile.agency.name}</h4>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-gray-600">{agentProfile.agency.description}</p>
              </div>
            </div>
          )}
          
          {/* Save Button */}
          {isEditing && (
            <div className="mt-8 flex justify-end">
              <button
                type="button"
                onClick={toggleEditMode}
                className="mr-3 px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={updateProfile}
                disabled={loading}
                className={`px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  loading ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
        
        {/* Agent Activity Stats */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Agent Statistics</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Agent Since</p>
              <p className="text-lg font-medium text-gray-800">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Complaints Handled</p>
              <p className="text-lg font-medium text-gray-800">--</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Status</p>
              <div className="flex items-center">
                <span className="inline-block h-3 w-3 rounded-full bg-green-500 mr-2"></span>
                <p className="text-lg font-medium text-gray-800">Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Data Privacy Notice */}
      <div className="mt-6 bg-blue-50 border-l-4 border-blue-400 p-4 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h5 className="text-sm font-medium text-blue-800">Agent Privacy Notice</h5>
            <div className="mt-1 text-sm text-blue-700">
              <p>Your profile information is shared with your agency administrators and citizens who view your responses to their complaints. Please ensure all information is professional and accurate.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AgProfile;