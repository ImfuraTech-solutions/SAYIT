import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/pages/Reset-password.css';

// Password strength meter component
const PasswordStrengthMeter = ({ password }: { password: string }) => {
  const calculateStrength = (password: string): number => {
    let strength = 0;
    
    // Length check
    if (password.length >= 8) strength++;
    
    // Contains lowercase
    if (/[a-z]/.test(password)) strength++;
    
    // Contains uppercase
    if (/[A-Z]/.test(password)) strength++;
    
    // Contains number
    if (/\d/.test(password)) strength++;
    
    // Contains special character
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    return strength;
  };
  
  const strength = calculateStrength(password);
  
  const getStrengthLabel = (): string => {
    switch (strength) {
      case 0: return "Very Weak";
      case 1: return "Weak";
      case 2: return "Fair";
      case 3: return "Good";
      case 4: return "Strong";
      case 5: return "Very Strong";
      default: return "";
    }
  };
  
  const getStrengthClass = (): string => {
    switch (strength) {
      case 0: return "strength-meter-fill-very-weak";
      case 1: return "strength-meter-fill-weak";
      case 2: return "strength-meter-fill-fair";
      case 3: return "strength-meter-fill-good";
      case 4: return "strength-meter-fill-strong";
      case 5: return "strength-meter-fill-very-strong";
      default: return "";
    }
  };
  
  return (
    <div className="strength-meter">
      <div className="strength-meter-bar">
        <div 
          className={`strength-meter-fill ${getStrengthClass()}`} 
          style={{ width: `${strength * 20}%` }}
        ></div>
      </div>
      {password && (
        <p className="strength-meter-label">{getStrengthLabel()}</p>
      )}
    </div>
  );
};

const ResetPassword: React.FC = () => {
  // State management for multi-step form
  const [step, setStep] = useState<number>(1);
  const [email, setEmail] = useState<string>('');
  const [accessCode, setAccessCode] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [userType, setUserType] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  const [resetComplete, setResetComplete] = useState<boolean>(false);
  const [codeVerified, setCodeVerified] = useState<boolean>(false);

  const navigate = useNavigate();
  const location = useLocation();
  
  // Check for email in URL query parameters
  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const emailParam = queryParams.get('email');
    const userTypeParam = queryParams.get('userType');
    
    if (emailParam) {
      setEmail(emailParam);
    }
    
    if (userTypeParam) {
      setUserType(userTypeParam);
    }
  }, [location]);

  // Validation functions
  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setErrors(prev => ({ ...prev, email: 'Email is required' }));
      return false;
    }
    
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      setErrors(prev => ({ ...prev, email: 'Please enter a valid email address' }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, email: '' }));
    return true;
  };

  const validateAccessCode = (): boolean => {
    if (!accessCode.trim()) {
      setErrors(prev => ({ ...prev, accessCode: 'Access code is required' }));
      return false;
    }
    
    const accessCodeRegex = /^SAY\d{9}$/;
    if (!accessCodeRegex.test(accessCode)) {
      setErrors(prev => (
        { ...prev, accessCode: 'Invalid format. Code should be "SAY" followed by 9 digits' }
      ));
      return false;
    }
    
    setErrors(prev => ({ ...prev, accessCode: '' }));
    return true;
  };

  const validatePassword = (): boolean => {
    if (!newPassword) {
      setErrors(prev => ({ ...prev, newPassword: 'Password is required' }));
      return false;
    }
    
    if (newPassword.length < 8) {
      setErrors(prev => ({ ...prev, newPassword: 'Password must be at least 8 characters long' }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, newPassword: '' }));
    return true;
  };

  const validateConfirmPassword = (): boolean => {
    if (!confirmPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Please confirm your password' }));
      return false;
    }
    
    if (confirmPassword !== newPassword) {
      setErrors(prev => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      return false;
    }
    
    setErrors(prev => ({ ...prev, confirmPassword: '' }));
    return true;
  };

  // Handle requesting an access code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail()) {
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/admin/request-access-code', {
        email,
        userType
      });

      if (response.data.success) {
        toast.success('If your email is registered, you will receive an access code shortly');
        setStep(2);
      }
    } catch (error: any) {
      console.error('Error requesting access code:', error);
      toast.error(error.response?.data?.message || 'Failed to request access code');
    } finally {
      setLoading(false);
    }
  };

  // Handle verifying an access code
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail() || !validateAccessCode()) {
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/admin/verify-access-code', {
        email,
        accessCode
      });

      if (response.data.success) {
        toast.success('Access code verified successfully');
        setCodeVerified(true);
        setStep(3);
      }
    } catch (error: any) {
      console.error('Error verifying access code:', error);
      toast.error(error.response?.data?.message || 'Invalid or expired access code');
      setErrors(prev => ({ ...prev, accessCode: 'Invalid or expired access code' }));
    } finally {
      setLoading(false);
    }
  };

  // Handle password reset submission
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail() || !validateAccessCode() || !validatePassword() || !validateConfirmPassword()) {
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post('/api/admin/reset-password-with-code', {
        email,
        accessCode,
        newPassword
      });

      if (response.data.success) {
        toast.success('Password reset successfully');
        setResetComplete(true);
        
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          navigate('/login', { state: { email } });
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.response?.data?.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };
  // Step 1: Request access code
  const renderStep1 = () => (
    <div className="form-section">
      <form onSubmit={handleRequestCode}>
        <div className="form-field">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`form-input ${errors.email ? 'form-input-error' : ''}`}
            placeholder="Enter your email address"
            autoComplete="email"
          />
          {errors.email && <p className="error-text">{errors.email}</p>}
        </div>

        {userType && (
          <div className="alert alert-info">
            <p className="alert-info-text">
              Password reset for <strong>{userType}</strong> account
            </p>
          </div>
        )}

        <div className="form-field">
          <button
            type="submit"
            disabled={loading}
            className="form-button"
          >
            {loading ? (
              <div className="button-loading">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </div>
            ) : (
              'Request Access Code'
            )}
          </button>
        </div>
      </form>
    </div>
  );
  // Step 2: Verify access code
  const renderStep2 = () => (
    <div className="form-section">
      <form onSubmit={handleVerifyCode}>
        <div className="form-field">
          <label htmlFor="email" className="form-label">
            Email Address
          </label>
          <div className="flex items-center">
            <input
              id="email"
              type="email"
              value={email}
              readOnly
              className="form-input form-input-readonly"
            />
            <button
              type="button"
              onClick={() => setStep(1)}
              className="ml-2 p-2 form-button-link"
              title="Change email"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
            </button>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="accessCode" className="form-label">
            Access Code
          </label>
          <input
            id="accessCode"
            name="accessCode"
            type="text"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className={`form-input ${errors.accessCode ? 'form-input-error' : ''}`}
            placeholder="Enter access code (e.g. SAY123456789)"
          />
          {errors.accessCode && <p className="error-text">{errors.accessCode}</p>}
          
          <p className="hint-text">
            Enter the access code sent to your email. It starts with "SAY" followed by 9 digits.
          </p>
        </div>

        <div className="form-field">
          <button
            type="submit"
            disabled={loading}
            className="form-button"
          >
            {loading ? (
              <div className="button-loading">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </div>
            ) : (
              'Verify Code'
            )}
          </button>
        </div>

        <div className="form-footer">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="form-button-secondary"
          >
            ← Back
          </button>
          
          <button
            type="button"
            onClick={handleRequestCode}
            className="form-button-link"
          >
            Didn't receive a code? Send again
          </button>
        </div>
      </form>
    </div>
  );
  // Step 3: Set new password
  const renderStep3 = () => (
    <div className="form-section">
      <form onSubmit={handleResetPassword}>
        <div className="form-field">
          <div className="alert alert-success alert-with-icon">
            <svg xmlns="http://www.w3.org/2000/svg" className="alert-icon alert-icon-success" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <p className="alert-success-text">
              Access code verified successfully
            </p>
          </div>
        </div>

        <div className="form-field">
          <label htmlFor="newPassword" className="form-label">
            New Password
          </label>
          <input
            id="newPassword"
            name="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={`form-input ${errors.newPassword ? 'form-input-error' : ''}`}
            placeholder="Enter new password"
            autoComplete="new-password"
          />
          {errors.newPassword ? (
            <p className="error-text">{errors.newPassword}</p>
          ) : (
            <PasswordStrengthMeter password={newPassword} />
          )}
        </div>

        <div className="form-field">
          <label htmlFor="confirmPassword" className="form-label">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`form-input ${errors.confirmPassword ? 'form-input-error' : ''}`}
            placeholder="Confirm new password"
            autoComplete="new-password"
          />
          {errors.confirmPassword && <p className="error-text">{errors.confirmPassword}</p>}
        </div>

        <div className="form-field">
          <button
            type="submit"
            disabled={loading}
            className="form-button"
          >
            {loading ? (
              <div className="button-loading">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Resetting Password...
              </div>
            ) : (
              'Reset Password'
            )}
          </button>
        </div>

        <div className="form-footer">
          <button
            type="button"
            onClick={() => setStep(2)}
            className="form-button-secondary"
          >
            ← Back to Access Code
          </button>
        </div>
      </form>
    </div>
  );
  // Success screen after password reset
  const renderSuccessScreen = () => (
    <div className="success-container">
      <div className="success-icon-container">
        <svg className="success-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h3 className="success-title">Password reset successful</h3>
      <p className="success-message">
        Your password has been successfully reset. You will be redirected to the login page shortly.
      </p>
      <div>
        <button
          onClick={() => navigate('/login', { state: { email } })}
          className="success-button"
        >
          Go to Login
        </button>
      </div>
    </div>
  );
  // Step indicator component
  const StepIndicator = () => (
    <div className="step-indicator">
      <div className="step-indicator-container">
        {[1, 2, 3].map((stepNum) => (
          <React.Fragment key={stepNum}>
            <div className="flex items-center relative">
              <div 
                className={`step-circle ${step >= stepNum 
                  ? "step-circle-active" 
                  : "step-circle-inactive"
                }`}
              >
                {stepNum === 1 && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="step-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                  </svg>
                )}
                {stepNum === 2 && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="step-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                )}
                {stepNum === 3 && (
                  <svg xmlns="http://www.w3.org/2000/svg" className="step-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                )}
              </div>
              <div className="step-label">
                {stepNum === 1 ? "Email" : stepNum === 2 ? "Access Code" : "New Password"}
              </div>
            </div>
            {stepNum < 3 && (
              <div className={`step-line ${step > stepNum ? "step-line-active" : "step-line-inactive"}`}></div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );  return (
    <div className="reset-password-container">
      <div className="reset-password-header">
        <h2 className="reset-password-title">Reset your password</h2>
        <p className="reset-password-subtitle">
          Follow these steps to securely reset your SAYIT account password
        </p>
      </div>

      <div className="reset-password-form-container">
        <div className="reset-password-form-card">
          {resetComplete ? (
            renderSuccessScreen()
          ) : (
            <>
              <StepIndicator />
              
              {step === 1 && renderStep1()}
              {step === 2 && renderStep2()}
              {step === 3 && codeVerified && renderStep3()}
            </>
          )}
        </div>
        
        <div className="reset-password-return-link">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="reset-password-return-button"
          >
            Return to login
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;