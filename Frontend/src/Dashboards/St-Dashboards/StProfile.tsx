import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

// Types
interface UserProfile {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  profileImage?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  preferences?: {
    language: string;
    notificationSettings: {
      email: boolean;
      app: boolean;
    };
  };
}

interface StProfileProps {
  userProfile: UserProfile | null;
  onUpdateProfile: () => void;
}

const StProfile: React.FC<StProfileProps> = ({ userProfile, onUpdateProfile }) => {
  // Form state
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    name: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: ''
    }
  });
  
  // Other state
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data when userProfile changes
  useEffect(() => {
    if (userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: {
          street: userProfile.address?.street || '',
          city: userProfile.address?.city || '',
          state: userProfile.address?.state || '',
          postalCode: userProfile.address?.postalCode || '',
          country: userProfile.address?.country || ''
        }
      });
      
      // Set image preview if profile image exists
      if (userProfile.profileImage) {
        setImagePreview(userProfile.profileImage);
      }
    }
  }, [userProfile]);

  // Handle input change
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      const [parent, child] = name.split('.');
      setFormData((prevData) => ({
        ...prevData,
        [parent]: {
          ...(prevData[parent as keyof typeof prevData] as Record<string, unknown>),
          [child]: value,
        },
      }));
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
    if (isEditing && userProfile) {
      setFormData({
        name: userProfile.name || '',
        phone: userProfile.phone || '',
        address: {
          street: userProfile.address?.street || '',
          city: userProfile.address?.city || '',
          state: userProfile.address?.state || '',
          postalCode: userProfile.address?.postalCode || '',
          country: userProfile.address?.country || ''
        }
      });
      
      // Reset image preview
      if (userProfile.profileImage) {
        setImagePreview(userProfile.profileImage);
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
      
      // Address fields
      if (formData.address) {
        if (formData.address.street) {
          profileFormData.append('address.street', formData.address.street);
        }
        if (formData.address.city) {
          profileFormData.append('address.city', formData.address.city);
        }
        if (formData.address.state) {
          profileFormData.append('address.state', formData.address.state);
        }
        if (formData.address.postalCode) {
          profileFormData.append('address.postalCode', formData.address.postalCode);
        }
        if (formData.address.country) {
          profileFormData.append('address.country', formData.address.country);
        }
      }
      
      // Add profile image if selected
      if (profileImage) {
        profileFormData.append('profileImage', profileImage);
      }
      
      const response = await axios.put('/api/standarduser/profile', profileFormData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      
      if (response.data.success) {
        toast.success('Profile updated successfully!');
        setIsEditing(false);
        onUpdateProfile(); // Refresh the user profile data
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

  if (!userProfile) {
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
          <h2 className="text-xl font-bold text-gray-800">My Profile</h2>
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
                      {userProfile.name.charAt(0).toUpperCase()}
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
                  userProfile.name
                )}
              </h3>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
              
              <p className="text-gray-600 mt-1">{userProfile.email}</p>
            </div>
          </div>
          
          {/* Contact Information */}
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
                    {userProfile.phone || 'Not provided'}
                  </p>
                )}
              </div>
              
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address
                </label>
                <p className="text-gray-600">
                  {userProfile.email}
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Verified
                  </span>
                </p>
                <p className="text-xs text-gray-500 mt-1">To change your email, please contact support</p>
              </div>
            </div>
          </div>
          
          {/* Address Information */}
          <div>
            <h4 className="text-lg font-semibold text-gray-800 mb-4">Address</h4>
            
            {isEditing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label htmlFor="street" className="block text-sm font-medium text-gray-700 mb-1">
                    Street Address
                  </label>
                  <input
                    type="text"
                    name="address.street"
                    id="street"
                    value={formData.address?.street || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Street Address"
                  />
                </div>
                
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    name="address.city"
                    id="city"
                    value={formData.address?.city || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="City"
                  />
                </div>
                
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
                    State / Province
                  </label>
                  <input
                    type="text"
                    name="address.state"
                    id="state"
                    value={formData.address?.state || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="State / Province"
                  />
                </div>
                
                <div>
                  <label htmlFor="postalCode" className="block text-sm font-medium text-gray-700 mb-1">
                    Postal / ZIP Code
                  </label>
                  <input
                    type="text"
                    name="address.postalCode"
                    id="postalCode"
                    value={formData.address?.postalCode || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Postal / ZIP Code"
                  />
                </div>
                
                <div>
                  <label htmlFor="country" className="block text-sm font-medium text-gray-700 mb-1">
                    Country
                  </label>
                  <input
                    type="text"
                    name="address.country"
                    id="country"
                    value={formData.address?.country || ''}
                    onChange={handleInputChange}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                    placeholder="Country"
                  />
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 p-4 rounded-lg">
                {userProfile.address && (
                  Object.values(userProfile.address).some(val => val && val.trim() !== '') ? (
                    <address className="not-italic text-gray-600">
                      {userProfile.address.street && (
                        <p>{userProfile.address.street}</p>
                      )}
                      {(userProfile.address.city || userProfile.address.state || userProfile.address.postalCode) && (
                        <p>
                          {userProfile.address.city && `${userProfile.address.city}, `}
                          {userProfile.address.state && `${userProfile.address.state} `}
                          {userProfile.address.postalCode && userProfile.address.postalCode}
                        </p>
                      )}
                      {userProfile.address.country && (
                        <p>{userProfile.address.country}</p>
                      )}
                    </address>
                  ) : (
                    <p className="text-gray-500 italic">No address information provided</p>
                  )
                )}
              </div>
            )}
          </div>
          
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
        
        {/* User Activity Stats */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Member Since</p>
              <p className="text-lg font-medium text-gray-800">
                {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Complaints Submitted</p>
              <p className="text-lg font-medium text-gray-800">0</p>
            </div>
            
            <div className="bg-white p-4 rounded-lg shadow-sm">
              <p className="text-sm text-gray-500">Account Status</p>
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
            <h5 className="text-sm font-medium text-blue-800">Data Privacy Notice</h5>
            <div className="mt-1 text-sm text-blue-700">
              <p>Your personal information is securely stored and only used to provide you with SAYIT services. For more information, please refer to our <a href="#" className="font-medium underline">Privacy Policy</a>.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StProfile;