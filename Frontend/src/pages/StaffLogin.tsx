import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/pages/StaffLogin.css';

const StaffLogin: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check if staff is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    
    if (token && userDataStr) {
      const userData = JSON.parse(userDataStr);
      
      // Check if user is a staff member with one of the valid roles
      if (userData && ['admin', 'supervisor', 'moderator', 'analyst'].includes(userData.role)) {
        navigate('/admin'); // Redirect to admin dashboard
      }
    }
  }, [navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.email) {
      errors.email = 'Email is required';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    if (!formData.password) {
      errors.password = 'Password is required';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please correct the errors in the form');
      return;
    }

    try {
      setIsLoading(true);
      
      // Make API call to staff login endpoint
      const response = await axios.post('/api/auth/staff/login', {
        email: formData.email,
        password: formData.password
      });

      if (response.data.success) {
        const { token, staff } = response.data.data;
        
        // Store token and staff data
        localStorage.setItem('token', token);
        localStorage.setItem('userData', JSON.stringify({
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          profileImage: staff.profileImage
        }));
        
        // Show success message
        toast.success(`Welcome back, ${staff.name}`);
        
        // Redirect based on staff role
        if (staff.role === 'admin') {
          navigate('/admin');
        } else if (staff.role === 'supervisor') {
          navigate('/supervisor');
        } else {
          navigate('/staff-dashboard');
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = 
          error.response?.data?.message || 
          'Login failed. Please check your credentials.';
        
        // Check for specific error types
        if (error.response?.status === 401) {
          setFormErrors({
            password: 'Invalid credentials'
          });
        } else if (error.response?.status === 403) {
          setFormErrors({
            email: 'Your account is inactive. Please contact an administrator.'
          });
        }
        
        toast.error(errorMessage);
      } else {
        toast.error('Login failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="staff-login-container">
      <div className="staff-login-form-container">
        <div className="staff-login-title">
          <h1>Staff Portal</h1>
          <p>
            Sign in to access the staff dashboard
          </p>
        </div>
        
        <div className="staff-login-form-wrapper">
          <form onSubmit={handleSubmit} className="staff-login-form">
            {/* Email Field */}
            <div className="staff-login-form-group">
              <label htmlFor="email" className="staff-login-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`staff-login-input ${formErrors.email ? 'staff-login-input-error' : ''}`}
                placeholder="Enter your email"
              />
              {formErrors.email && (
                <p className="staff-login-error">{formErrors.email}</p>
              )}
            </div>
            
            {/* Password Field */}
            <div className="staff-login-form-group">
              <div className="staff-login-form-header">
                <label htmlFor="password" className="staff-login-label">
                  Password
                </label>
                <Link to="/staff/forgot-password" className="staff-login-forgot-link">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`staff-login-input ${formErrors.password ? 'staff-login-input-error' : ''}`}
                placeholder="Enter your password"
              />
              {formErrors.password && (
                <p className="staff-login-error">{formErrors.password}</p>
              )}
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="staff-login-submit"
            >
              {isLoading ? (
                <span className="staff-login-spinner">
                  <svg className="staff-login-spinner-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="staff-login-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="staff-login-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign In'
              )}
            </button>
          </form>
        </div>
        
        {/* Back to main login */}
        <div className="staff-login-footer">
          <Link to="/login" className="staff-login-back-link">
            ← Back to User Login
          </Link>
        </div>
      </div>
      
      <div className="staff-login-info">
        <p>This portal is restricted to authorized staff only.</p>
        <p className="staff-login-info-secondary">
          If you need access, please contact your system administrator.
        </p>
      </div>
    </div>
  );
};

export default StaffLogin;