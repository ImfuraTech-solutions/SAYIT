import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/pages/AgentLogin.css';

const AgentLogin: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Check if agent is already logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const userDataStr = localStorage.getItem('userData');
    
    if (token && userDataStr) {
      const userData = JSON.parse(userDataStr);
      
      // Check if user is an agent
      if (userData && userData.role === 'agent') {
        navigate('/agent'); // Redirect to agent dashboard
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
      
      // Make API call to agent login endpoint
      const response = await axios.post('/api/auth/agent/login', {
        email: formData.email,
        password: formData.password
      });

      if (response.data.success) {
        const { token, agent } = response.data.data;
        
        // Store token and agent data
        localStorage.setItem('token', token);
        localStorage.setItem('userData', JSON.stringify({
          id: agent._id,
          name: agent.name,
          email: agent.email,
          role: 'agent',
          agencyId: agent.agencyId,
          profileImage: agent.profileImage,
          position: agent.position,
          department: agent.department
        }));
        
        // Show success message
        toast.success(`Welcome back, ${agent.name}`);
        
        // Update login timestamp silently in the background
        axios.post('/api/agent/update-login', {}, {
          headers: { Authorization: `Bearer ${token}` }
        }).catch(err => console.error('Failed to update login timestamp', err));
        
        // Redirect to agent dashboard
        navigate('/agent');
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
            email: 'Your account is inactive. Please contact your agency administrator.'
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
    <div className="agent-login-container">
      <div className="agent-login-form-container">
        <div className="agent-login-title">
          <h1>Agency Portal</h1>
          <p>
            Sign in to access the agency dashboard
          </p>
        </div>
        
        <div className="agent-login-form-wrapper">
          <form onSubmit={handleSubmit} className="agent-login-form">
            {/* Email Field */}
            <div className="agent-login-form-group">
              <label htmlFor="email" className="agent-login-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`agent-login-input ${formErrors.email ? 'agent-login-input-error' : ''}`}
                placeholder="Enter your email"
              />
              {formErrors.email && (
                <p className="agent-login-error">{formErrors.email}</p>
              )}
            </div>
            
            {/* Password Field */}
            <div className="agent-login-form-group">
              <div className="agent-login-form-header">
                <label htmlFor="password" className="agent-login-label">
                  Password
                </label>
                <Link to="/agent/forgot-password" className="agent-login-forgot-link">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`agent-login-input ${formErrors.password ? 'agent-login-input-error' : ''}`}
                placeholder="Enter your password"
              />
              {formErrors.password && (
                <p className="agent-login-error">{formErrors.password}</p>
              )}
            </div>
            
            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="agent-login-submit"
            >
              {isLoading ? (
                <span className="agent-login-spinner">
                  <svg className="agent-login-spinner-svg" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="agent-login-spinner-circle" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="agent-login-spinner-path" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        <div className="agent-login-footer">
          <Link to="/login" className="agent-login-back-link">
            ← Back to User Login
          </Link>
        </div>
      </div>
      
      <div className="agent-login-info">
        <p>This portal is for authorized agency representatives only.</p>
        <p className="agent-login-info-secondary">
          If you're having trouble accessing your account, please contact your agency administrator.
        </p>
      </div>
    </div>
  );
};

export default AgentLogin;