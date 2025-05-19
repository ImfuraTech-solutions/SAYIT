import React, { useState, useEffect } from 'react';
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
  preferences: {
    language: string;
    notificationSettings: {
      email: boolean;
      app: boolean;
    };
  };
}

interface StSettingsProps {
  userProfile: UserProfile | null;
  onUpdateProfile: () => void;
}

const StSettings: React.FC<StSettingsProps> = ({ userProfile, onUpdateProfile }) => {
  // State for settings
  const [settings, setSettings] = useState({
    language: 'en',
    notificationSettings: {
      email: true,
      app: true,
    },
    password: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
    deleteAccount: {
      confirmText: '',
      password: '',
    }
  });
  
  const [loading, setLoading] = useState({
    preferences: false,
    password: false,
    deleteAccount: false,
  });
  
  const [expanded, setExpanded] = useState({
    preferences: true,
    security: false,
    deleteAccount: false,
  });
  
  const [errors, setErrors] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
    deleteAccount: '',
  });

  // Update settings when userProfile changes
  useEffect(() => {
    if (userProfile && userProfile.preferences) {
      setSettings(prevSettings => ({
        ...prevSettings,
        language: userProfile.preferences.language || 'en',
        notificationSettings: {
          email: userProfile.preferences.notificationSettings?.email ?? true,
          app: userProfile.preferences.notificationSettings?.app ?? true,
        }
      }));
    }
  }, [userProfile]);

  // Toggle section expansion
  const toggleSection = (section: 'preferences' | 'security' | 'deleteAccount') => {
    setExpanded(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  // Handle language change
  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSettings({
      ...settings,
      language: e.target.value
    });
  };

  // Handle notification settings change
  const handleNotificationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    
    setSettings({
      ...settings,
      notificationSettings: {
        ...settings.notificationSettings,
        [name]: checked
      }
    });
  };

  // Handle password change inputs
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setSettings({
      ...settings,
      password: {
        ...settings.password,
        [name]: value
      }
    });
    
    // Clear error when typing
    if (errors[name as keyof typeof errors]) {
      setErrors({
        ...errors,
        [name]: ''
      });
    }
  };

  // Handle delete account inputs
  const handleDeleteAccountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setSettings({
      ...settings,
      deleteAccount: {
        ...settings.deleteAccount,
        [name]: value
      }
    });
    
    // Clear error when typing
    if (name === 'password' && errors.deleteAccount) {
      setErrors({
        ...errors,
        deleteAccount: ''
      });
    }
  };

  // Save preferences
  const savePreferences = async () => {
    if (!userProfile) return;
    
    setLoading({ ...loading, preferences: true });
    
    try {
      const response = await axios.put('/api/standarduser/preferences', {
        language: settings.language,
        notificationSettings: settings.notificationSettings
      });
      
      if (response.data.success) {
        toast.success('Preferences updated successfully');
        onUpdateProfile(); // Refresh profile data
      } else {
        toast.error(response.data.message || 'Failed to update preferences');
      }
    } catch (error) {
      console.error('Error updating preferences:', error);
      toast.error('Failed to update preferences. Please try again.');
    } finally {
      setLoading({ ...loading, preferences: false });
    }
  };

  // Change password
  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate password
    let valid = true;
    const newErrors = { ...errors };
    
    if (!settings.password.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
      valid = false;
    }
    
    if (!settings.password.newPassword) {
      newErrors.newPassword = 'New password is required';
      valid = false;
    } else if (settings.password.newPassword.length < 8) {
      newErrors.newPassword = 'Password must be at least 8 characters';
      valid = false;
    }
    
    if (!settings.password.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
      valid = false;
    } else if (settings.password.newPassword !== settings.password.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      valid = false;
    }
    
    if (!valid) {
      setErrors(newErrors);
      return;
    }
    
    setLoading({ ...loading, password: true });
    
    try {
      const response = await axios.put('/api/standarduser/change-password', {
        currentPassword: settings.password.currentPassword,
        newPassword: settings.password.newPassword
      });
      
      if (response.data.success) {
        toast.success('Password changed successfully');
        // Reset password fields
        setSettings({
          ...settings,
          password: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: ''
          }
        });
      } else {
        setErrors({
          ...errors,
          currentPassword: response.data.message || 'Current password is incorrect'
        });
        toast.error(response.data.message || 'Failed to change password');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      
      if (error.response?.data?.message) {
        if (error.response.data.message.includes('current password')) {
          setErrors({
            ...errors,
            currentPassword: error.response.data.message
          });
        } else {
          toast.error(error.response.data.message);
        }
      } else {
        toast.error('Failed to change password. Please try again.');
      }
    } finally {
      setLoading({ ...loading, password: false });
    }
  };

  // Delete account
  const deleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!settings.deleteAccount.password) {
      setErrors({
        ...errors,
        deleteAccount: 'Please enter your password to confirm'
      });
      return;
    }
    
    if (settings.deleteAccount.confirmText !== 'DELETE') {
      setErrors({
        ...errors,
        deleteAccount: 'Please type DELETE to confirm'
      });
      return;
    }
    
    setLoading({ ...loading, deleteAccount: true });
    
    try {
      const response = await axios.post('/api/standarduser/delete-account', {
        password: settings.deleteAccount.password
      });
      
      if (response.data.success) {
        toast.success('Your account has been deleted');
        localStorage.removeItem('token');
        localStorage.removeItem('userData');
        window.location.href = '/';
      } else {
        setErrors({
          ...errors,
          deleteAccount: response.data.message || 'Failed to delete account'
        });
        toast.error(response.data.message || 'Failed to delete account');
      }
    } catch (error: any) {
      console.error('Error deleting account:', error);
      
      if (error.response?.data?.message) {
        setErrors({
          ...errors,
          deleteAccount: error.response.data.message
        });
      } else {
        toast.error('Failed to delete account. Please try again.');
      }
    } finally {
      setLoading({ ...loading, deleteAccount: false });
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
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Account Settings</h2>
      
      {/* Preferences Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div 
          className={`px-6 py-4 flex justify-between items-center cursor-pointer ${expanded.preferences ? 'border-b border-gray-200' : ''}`}
          onClick={() => toggleSection('preferences')}
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-800">Preferences</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 text-gray-500 transform transition-transform ${expanded.preferences ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {expanded.preferences && (
          <div className="px-6 py-4">
            {/* Language Preference */}
            <div className="mb-6">
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Display Language
              </label>
              <select
                id="language"
                name="language"
                value={settings.language}
                onChange={handleLanguageChange}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
                <option value="zh">Chinese (Simplified)</option>
                <option value="ar">Arabic</option>
              </select>
              <p className="mt-1 text-sm text-gray-500">
                This will change the language of the interface.
              </p>
            </div>
            
            {/* Notification Settings */}
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Notification Settings</h4>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    id="email-notifications"
                    name="email"
                    type="checkbox"
                    checked={settings.notificationSettings.email}
                    onChange={handleNotificationChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <label htmlFor="email-notifications" className="block text-sm font-medium text-gray-700">
                      Email Notifications
                    </label>
                    <p className="text-sm text-gray-500">
                      Receive updates about your complaints via email
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    id="app-notifications"
                    name="app"
                    type="checkbox"
                    checked={settings.notificationSettings.app}
                    onChange={handleNotificationChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="ml-3">
                    <label htmlFor="app-notifications" className="block text-sm font-medium text-gray-700">
                      In-App Notifications
                    </label>
                    <p className="text-sm text-gray-500">
                      Receive notifications within the SAYIT platform
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                disabled={loading.preferences}
                onClick={savePreferences}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                  loading.preferences ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {loading.preferences ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : 'Save Preferences'}
              </button>
            </div>
          </div>
        )}
      </div>
      
      {/* Security Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div 
          className={`px-6 py-4 flex justify-between items-center cursor-pointer ${expanded.security ? 'border-b border-gray-200' : ''}`}
          onClick={() => toggleSection('security')}
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-800">Security</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 text-gray-500 transform transition-transform ${expanded.security ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {expanded.security && (
          <div className="px-6 py-4">
            <form onSubmit={changePassword}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700">
                    Current Password
                  </label>
                  <input
                    type="password"
                    name="currentPassword"
                    id="currentPassword"
                    value={settings.password.currentPassword}
                    onChange={handlePasswordChange}
                    className={`mt-1 block w-full shadow-sm sm:text-sm rounded-md ${
                      errors.currentPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {errors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.currentPassword}</p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700">
                    New Password
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    id="newPassword"
                    value={settings.password.newPassword}
                    onChange={handlePasswordChange}
                    className={`mt-1 block w-full shadow-sm sm:text-sm rounded-md ${
                      errors.newPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {errors.newPassword ? (
                    <p className="mt-1 text-sm text-red-600">{errors.newPassword}</p>
                  ) : (
                    <p className="mt-1 text-sm text-gray-500">
                      Password must be at least 8 characters long
                    </p>
                  )}
                </div>
                
                <div>
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                    Confirm New Password
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    id="confirmPassword"
                    value={settings.password.confirmPassword}
                    onChange={handlePasswordChange}
                    className={`mt-1 block w-full shadow-sm sm:text-sm rounded-md ${
                      errors.confirmPassword ? 'border-red-300 focus:ring-red-500 focus:border-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                  />
                  {errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{errors.confirmPassword}</p>
                  )}
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={loading.password}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    loading.password ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {loading.password ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </>
                  ) : 'Change Password'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
      
      {/* Delete Account Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div 
          className={`px-6 py-4 flex justify-between items-center cursor-pointer ${expanded.deleteAccount ? 'border-b border-gray-200' : ''}`}
          onClick={() => toggleSection('deleteAccount')}
        >
          <div className="flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <h3 className="text-lg font-medium text-red-600">Delete Account</h3>
          </div>
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className={`h-5 w-5 text-gray-500 transform transition-transform ${expanded.deleteAccount ? 'rotate-180' : ''}`} 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
        
        {expanded.deleteAccount && (
          <div className="px-6 py-4 bg-red-50">
            <div className="rounded-md bg-red-100 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Warning: This action cannot be undone</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>
                      Deleting your account will permanently remove all your personal information, complaints, and associated data from our system. This action is irreversible.
                    </p>
                  </div>
                </div>
              </div>
            </div>
            
            <form onSubmit={deleteAccount}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="deleteConfirm" className="block text-sm font-medium text-gray-700">
                    To confirm, type "DELETE" in capital letters
                  </label>
                  <input
                    type="text"
                    name="confirmText"
                    id="deleteConfirm"
                    value={settings.deleteAccount.confirmText}
                    onChange={handleDeleteAccountChange}
                    className="mt-1 block w-full shadow-sm sm:text-sm rounded-md border-gray-300 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                <div>
                  <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700">
                    Enter your password
                  </label>
                  <input
                    type="password"
                    name="password"
                    id="deletePassword"
                    value={settings.deleteAccount.password}
                    onChange={handleDeleteAccountChange}
                    className="mt-1 block w-full shadow-sm sm:text-sm rounded-md border-gray-300 focus:ring-red-500 focus:border-red-500"
                  />
                </div>
                
                {errors.deleteAccount && (
                  <p className="text-sm text-red-600">{errors.deleteAccount}</p>
                )}
              </div>
              
              <div className="mt-6 flex justify-end">
                <button
                  type="submit"
                  disabled={loading.deleteAccount || settings.deleteAccount.confirmText !== 'DELETE'}
                  className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 ${
                    (loading.deleteAccount || settings.deleteAccount.confirmText !== 'DELETE') ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {loading.deleteAccount ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : 'Delete Account'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default StSettings;