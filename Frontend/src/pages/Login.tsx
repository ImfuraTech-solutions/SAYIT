import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/pages/Login.css';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'standard' | 'anonymous'>('standard');
  const [isLoading, setIsLoading] = useState(false);

  // Standard user login state
  const [standardLoginData, setStandardLoginData] = useState({
    email: '',
    password: ''
  });
  // Anonymous user login state
  const [accessCode, setAccessCode] = useState('');
  const [showGenerateCode, setShowGenerateCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState('');

  // Handle standard user login form input changes
  const handleStandardInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStandardLoginData({
      ...standardLoginData,
      [e.target.name]: e.target.value
    });
  };

  // Handle standard user login form submission
  const handleStandardLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!standardLoginData.email || !standardLoginData.password) {
      toast.error('Please provide both email and password');
      return;
    }

    try {
      setIsLoading(true);
      
      // Make API call to login endpoint
      const response = await axios.post('/api/auth/login', {
        email: standardLoginData.email,
        password: standardLoginData.password,
        userType: 'standard_user'
      });

      if (response.data.success) {
        // Store token and user data
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('userData', JSON.stringify(response.data.data.user));
        
        // Show success message
        toast.success('Login successful, redirecting to dashboard...');
        
        // Redirect to standard user dashboard
        navigate('/standard');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = 
          error.response?.data?.message || 
          'Login failed. Please check your credentials.';
        toast.error(errorMessage);
      } else {
        toast.error('Login failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle anonymous user login (verify access code)
  const handleAnonymousLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!accessCode) {
      toast.error('Please enter an access code');
      return;
    }

    try {
      setIsLoading(true);
      
      // Make API call to verify access code
      const response = await axios.post('/api/anonymous/verify', { 
        accessCode 
      });

      if (response.data.success) {
        // Store token and anonymous user data
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('userData', JSON.stringify({
          role: 'anonymous_user',
          accessCode: response.data.data.accessCode,
          expiresAt: response.data.data.expiresAt
        }));
        
        toast.success('Access code verified, redirecting to dashboard...');
        
        // Redirect to anonymous user portal
        navigate('/anonymous');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = 
          error.response?.data?.message || 
          'Verification failed. Please check your access code.';
        toast.error(errorMessage);
      } else {
        toast.error('Verification failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Generate anonymous access code
  const generateAccessCode = async () => {
    try {
      setIsLoading(true);
      
      // API call to generate new access code
      const response = await axios.post('/api/anonymous/generate');
        if (response.data.success) {
        setGeneratedCode(response.data.data.accessCode);
        
        // Store token and anonymous user data
        localStorage.setItem('token', response.data.data.token);
        localStorage.setItem('userData', JSON.stringify({
          role: 'anonymous_user',
          accessCode: response.data.data.accessCode,
          expiresAt: response.data.data.expiresAt
        }));
        
        toast.success('Access code generated successfully!');
      }
    } catch (error) {
      toast.error('Failed to generate access code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Login with generated code
  const loginWithGeneratedCode = () => {
    // Already have the token, just redirect to dashboard
    navigate('/anonymous');
  };

  return (
    <div className="login-container">
      <div className="login-form-container">
        <div className="login-logo">
          <h1 className="text-2xl font-bold">Login to SAYIT</h1>
        </div>
        <p className="text-center" style={{ marginBottom: '1rem', color: '#6b7280' }}>
          Choose your login method below
        </p>

        {/* Login Type Tabs */}
        <div className="login-tabs">
          <button
            className={`login-tab ${activeTab === 'standard' ? 'active' : ''}`}
            onClick={() => setActiveTab('standard')}
          >
            Standard User
          </button>
          <button
            className={`login-tab ${activeTab === 'anonymous' ? 'active' : ''}`}
            onClick={() => setActiveTab('anonymous')}
          >
            Anonymous User
          </button>
        </div>

        {/* Standard User Login Form */}
        {activeTab === 'standard' && (
          <form onSubmit={handleStandardLogin} className="login-form">
            <div className="login-form-group">
              <label htmlFor="email" className="login-label">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={standardLoginData.email}
                onChange={handleStandardInputChange}
                className="login-input"
                placeholder="Enter your email"
                required
              />
            </div>
            <div className="login-form-group">
              <div className="login-forgot-password">
                <label htmlFor="password" className="login-label">
                  Password
                </label>
                <Link to="/forgot-password" className="login-forgot-password">
                  Forgot Password?
                </Link>
              </div>
              <input
                type="password"
                id="password"
                name="password"
                value={standardLoginData.password}
                onChange={handleStandardInputChange}
                className="login-input"
                placeholder="Enter your password"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="login-submit"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
            <div className="login-footer">
              <span>Don't have an account?</span>{' '}
              <Link to="/register">
                Register
              </Link>
            </div>
          </form>
        )}

        {/* Anonymous User Login Form */}
        {activeTab === 'anonymous' && !showGenerateCode && !generatedCode && (
          <form onSubmit={handleAnonymousLogin} className="login-form">
            <div className="login-form-group">
              <label htmlFor="accessCode" className="login-label">
                Access Code
              </label>
              <input
                type="text"
                id="accessCode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value)}
                className="login-input"
                placeholder="Enter your access code"
                required
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="login-submit"
              style={{ marginBottom: '1rem' }}
            >
              {isLoading ? 'Verifying...' : 'Verify Access Code'}
            </button>
            <div className="login-footer">
              <button
                type="button"
                onClick={() => setShowGenerateCode(true)}
                style={{ color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Don't have an access code? Generate one
              </button>
            </div>
          </form>
        )}

        {/* Generate Access Code Section */}
        {activeTab === 'anonymous' && showGenerateCode && !generatedCode && (
          <div className="login-form">
            <p style={{ marginBottom: '1.5rem', color: '#374151' }}>
              Generate an anonymous access code to submit and track complaints without revealing your identity. 
              <strong style={{ display: 'block', marginTop: '0.5rem' }}>
                Please save your access code securely - you'll need it to check for updates and responses.
              </strong>
            </p>
            <button
              onClick={generateAccessCode}
              disabled={isLoading}
              className="login-submit"
            >
              {isLoading ? 'Generating...' : 'Generate Access Code'}
            </button>
            <button
              type="button"
              onClick={() => setShowGenerateCode(false)}
              className="login-footer"
              style={{ marginTop: '1rem', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}
            >
              Back to Access Code Login
            </button>
          </div>
        )}

        {/* Display Generated Access Code */}
        {activeTab === 'anonymous' && generatedCode && (
          <div className="login-form">
            <div className="login-code-container">
              <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: '#047857', marginBottom: '0.5rem' }}>Access Code Generated!</h3>
              <div className="login-code-display">
                <p>{generatedCode}</p>
              </div>
              <p className="login-code-info">
                <strong>Important:</strong> Save this access code in a secure place. You will need it to check your complaint status and responses.
              </p>
            </div>
            
            <button
              onClick={loginWithGeneratedCode}
              className="login-code-button"
            >
              Continue to Anonymous Dashboard
            </button>
            
            <div style={{ marginTop: '1rem', textAlign: 'center' }}>
              <button
                type="button"                onClick={() => {
                  setGeneratedCode('');
                  setShowGenerateCode(false);
                }}
                style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                Back to Login
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Help Text */}
      <div style={{ maxWidth: '28rem', width: '100%', margin: '2rem auto 0', textAlign: 'center' }}>
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          Need help? <Link to="/contact" style={{ color: '#2563eb', textDecoration: 'none' }}>Contact Support</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;