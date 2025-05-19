import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'react-toastify';
import '../styles/pages/Register.css';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    address: {
      street: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Rwanda'
    },
    language: 'en', // Default language
  });

  // Rwanda provinces and districts
  const provinces = [
    {
      name: 'Kigali',
      districts: ['Nyarugenge', 'Gasabo', 'Kicukiro']
    },
    {
      name: 'Eastern Province',
      districts: ['Bugesera', 'Gatsibo', 'Kayonza', 'Kirehe', 'Ngoma', 'Nyagatare', 'Rwamagana']
    },
    {
      name: 'Northern Province',
      districts: ['Burera', 'Gakenke', 'Gicumbi', 'Musanze', 'Rulindo']
    },
    {
      name: 'Southern Province',
      districts: ['Gisagara', 'Huye', 'Kamonyi', 'Muhanga', 'Nyamagabe', 'Nyanza', 'Nyaruguru', 'Ruhango']
    },
    {
      name: 'Western Province',
      districts: ['Karongi', 'Ngororero', 'Nyabihu', 'Nyamasheke', 'Rubavu', 'Rusizi', 'Rutsiro']
    }
  ];

  const [addressExpanded, setAddressExpanded] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [selectedProvince, setSelectedProvince] = useState('');
  const [availableDistricts, setAvailableDistricts] = useState<string[]>([]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name.includes('.')) {
      // For nested fields like address.street
      const [parent, child] = name.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...(prev[parent as keyof typeof prev] as any),
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }

    // Clear error when user types
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const provinceName = e.target.value;
    setSelectedProvince(provinceName);

    // Update address.state with selected province
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        state: provinceName
      }
    }));

    // Update available districts based on province selection
    const province = provinces.find(p => p.name === provinceName);
    setAvailableDistricts(province ? province.districts : []);

    // Reset city (district) selection
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address,
        city: ''
      }
    }));

    // Clear error when user selects
    if (formErrors['address.state']) {
      setFormErrors(prev => ({
        ...prev,
        'address.state': ''
      }));
    }
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      language: e.target.value
    }));
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    // Name validation
    if (!formData.name.trim()) {
      errors.name = 'Name is required';
    }
    
    // Email validation
    if (!formData.email.trim()) {
      errors.email = 'Email is required';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      errors.email = 'Please enter a valid email address';
    }
    
    // Phone validation (required for Rwanda)
    if (!formData.phone) {
      errors.phone = 'Phone number is required';
    } else if (!/^(07\d{8}|(\+?250)?7\d{8})$/.test(formData.phone.replace(/\s+/g, ''))) {
      errors.phone = 'Please enter a valid Rwandan phone number (e.g., 07X XXX XXXX or +250 7XX XXX XXX)';
    }
    
    // Password validation
    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = 'Password must contain at least one uppercase letter, one lowercase letter, and one number';
    }
    
    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    
    // Address validations (only if address section is expanded)
    if (addressExpanded) {
      if (!formData.address.street.trim()) {
        errors['address.street'] = 'Street address is required';
      }
      
      if (!formData.address.city.trim()) {
        errors['address.city'] = 'District is required';
      }
      
      if (!formData.address.state.trim()) {
        errors['address.state'] = 'Province is required';
      }
      
      if (!formData.address.postalCode.trim()) {
        errors['address.postalCode'] = 'Postal code is required';
      }
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
      
      // API call to register user
      const response = await axios.post('/api/standarduser/register', {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        password: formData.password,
        address: addressExpanded ? formData.address : undefined,
        language: formData.language
      });
      
      if (response.data.success) {
        toast.success('Registration successful! Please check your email to verify your account.');
        navigate('/login', { state: { email: formData.email } });
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
        
        // Check for specific errors like email already in use
        if (error.response?.status === 409) {
          setFormErrors({
            email: 'This email is already registered. Please use a different email or try to login.'
          });
        }
        
        toast.error(errorMessage);
      } else {
        toast.error('Registration failed. Please try again later.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="register-container">
      <div className="register-form-container">
        <div className="register-title">
          <h1>Create an Account</h1>
          <p>Join SAYIT Rwanda to submit and track complaints effectively</p>
        </div>
        
        <form onSubmit={handleSubmit} className="register-form">
          {/* Basic Information */}
          <div className="register-section">
            <h2 className="register-section-title">Basic Information</h2>
            
            <div className="register-form-group">
              <label htmlFor="name" className="register-label">
                Full Name <span className="required">*</span>
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`register-input ${formErrors.name ? 'register-input-error' : ''}`}
                placeholder="e.g., Uwimana Jean"
              />
              {formErrors.name && (
                <p className="register-error">{formErrors.name}</p>
              )}
            </div>

            <div className="register-form-group">
              <label htmlFor="email" className="register-label">
                Email Address <span className="required">*</span>
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className={`register-input ${formErrors.email ? 'register-input-error' : ''}`}
                placeholder="e.g., uwimana.jean@example.com"
              />
              {formErrors.email && (
                <p className="register-error">{formErrors.email}</p>
              )}
            </div>

            <div className="register-form-group">
              <label htmlFor="phone" className="register-label">
                Phone Number <span className="required">*</span>
              </label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className={`register-input ${formErrors.phone ? 'register-input-error' : ''}`}
                placeholder="e.g., 078 123 4567"
              />
              {formErrors.phone && (
                <p className="register-error">{formErrors.phone}</p>
              )}
              <p className="register-hint">
                Enter a Rwandan phone number starting with 07 or +250
              </p>
            </div>

            <div className="register-form-group">
              <label htmlFor="language" className="register-label">
                Preferred Language
              </label>
              <select 
                id="language"
                name="language"
                value={formData.language}
                onChange={handleLanguageChange}
                className="register-input"
              >
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="rw">Kinyarwanda</option>
              </select>
            </div>
          </div>
          
          {/* Password Section */}
          <div className="register-section">
            <h2 className="register-section-title">Security</h2>
            
            <div className="register-form-group">
              <label htmlFor="password" className="register-label">
                Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className={`register-input ${formErrors.password ? 'register-input-error' : ''}`}
                placeholder="Create a strong password"
              />
              {formErrors.password && (
                <p className="register-error">{formErrors.password}</p>
              )}
              <p className="register-hint">
                Password must be at least 8 characters and include uppercase, lowercase, and numbers
              </p>
            </div>

            <div className="register-form-group">
              <label htmlFor="confirmPassword" className="register-label">
                Confirm Password <span className="required">*</span>
              </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className={`register-input ${formErrors.confirmPassword ? 'register-input-error' : ''}`}
                placeholder="Confirm your password"
              />
              {formErrors.confirmPassword && (
                <p className="register-error">{formErrors.confirmPassword}</p>
              )}
            </div>
          </div>
          
          {/* Address Section (Expandable) */}
          <div className="register-section">
            <button
              type="button"
              className="register-expand-button"
              onClick={() => setAddressExpanded(!addressExpanded)}
            >
              <span>{addressExpanded ? 'Hide' : 'Add'} Location Information</span>
              <svg
                className={`register-expand-icon ${addressExpanded ? 'register-expand-icon-open' : ''}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            
            {addressExpanded && (
              <div className="register-expanded-section">
                <div className="register-form-group">
                  <label htmlFor="street" className="register-label">
                    Street Address <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="street"
                    name="address.street"
                    value={formData.address.street}
                    onChange={handleInputChange}
                    className={`register-input ${formErrors['address.street'] ? 'register-input-error' : ''}`}
                    placeholder="e.g., KN 5 Ave"
                  />
                  {formErrors['address.street'] && (
                    <p className="register-error">{formErrors['address.street']}</p>
                  )}
                </div>
                
                <div className="register-form-row">
                  <div className="register-form-group">
                    <label htmlFor="province" className="register-label">
                      Province <span className="required">*</span>
                    </label>
                    <select
                      id="province"
                      name="province"
                      value={selectedProvince}
                      onChange={handleProvinceChange}
                      className={`register-input ${formErrors['address.state'] ? 'register-input-error' : ''}`}
                    >
                      <option value="">-- Select Province --</option>
                      {provinces.map(province => (
                        <option key={province.name} value={province.name}>
                          {province.name}
                        </option>
                      ))}
                    </select>
                    {formErrors['address.state'] && (
                      <p className="register-error">{formErrors['address.state']}</p>
                    )}
                  </div>
                  
                  <div className="register-form-group">
                    <label htmlFor="district" className="register-label">
                      District <span className="required">*</span>
                    </label>
                    <select
                      id="district"
                      name="address.city"
                      value={formData.address.city}
                      onChange={handleInputChange}
                      disabled={!selectedProvince}
                      className={`register-input ${formErrors['address.city'] ? 'register-input-error' : ''}`}
                    >
                      <option value="">-- Select District --</option>
                      {availableDistricts.map(district => (
                        <option key={district} value={district}>
                          {district}
                        </option>
                      ))}
                    </select>
                    {formErrors['address.city'] && (
                      <p className="register-error">{formErrors['address.city']}</p>
                    )}
                  </div>
                </div>
                
                <div className="register-form-row">
                  <div className="register-form-group">
                    <label htmlFor="postalCode" className="register-label">
                      Postal Code <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="postalCode"
                      name="address.postalCode"
                      value={formData.address.postalCode}
                      onChange={handleInputChange}
                      className={`register-input ${formErrors['address.postalCode'] ? 'register-input-error' : ''}`}
                      placeholder="e.g., 00000"
                    />
                    {formErrors['address.postalCode'] && (
                      <p className="register-error">{formErrors['address.postalCode']}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="register-submit"
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </button>
          
          <div className="register-footer">
            <p>
              Already have an account?{' '}
              <Link to="/login" className="register-link">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
      
      <div className="register-info">
        <p>
          By registering, you agree to our{' '}
          <Link to="/terms" className="register-link">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link to="/privacy" className="register-link">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;