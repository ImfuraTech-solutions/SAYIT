import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SayitLogo from '../assets/Sayit-logo.png';
import '../styles/components/Navbar.css';

const Navbar: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  
  // Check if user is logged in
  const token = localStorage.getItem('token');
  const userDataStr = localStorage.getItem('userData');
  const userData = userDataStr ? JSON.parse(userDataStr) : null;
  const userRole = userData?.role;
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('userData');
    navigate('/login');
  };
  
  // Determine dashboard URL based on user role
  const getDashboardUrl = () => {
    switch(userRole) {
      case 'standard_user': return '/standard';
      case 'anonymous_user': return '/anonymous';
      case 'agent': return '/agent';
      case 'admin': return '/admin';
      case 'staff': return '/staff';
      default: return '/';
    }
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-content">
          <div className="navbar-left">
            <div className="navbar-logo">
              <Link to="/">
                <img 
                  src={SayitLogo} 
                  alt="SAYIT Logo" 
                />
              </Link>
            </div>
            <div className="navbar-links">
              <Link 
                to="/" 
                className="navbar-link"
              >
                Home
              </Link>
              <Link 
                to="/about" 
                className="navbar-link"
              >
                About
              </Link>              <Link 
                to="/contact" 
                className="navbar-link"
              >
                Contact
              </Link>
              <Link 
                to="/track-complaint" 
                className="navbar-link highlight"
              >
                Track Complaint
              </Link>
              <Link 
                to="/submit-complaint" 
                className="navbar-link action-link"
              >
                Submit Complaint
              </Link>
            </div>
          </div>
            <div className="navbar-right">
            {token ? (
              <div className="navbar-buttons">
                <Link 
                  to={getDashboardUrl()} 
                  className="navbar-button navbar-button-filled"
                >
                  Dashboard
                </Link>
                <button
                  onClick={handleLogout}
                  className="navbar-button navbar-button-outline"
                  style={{ backgroundColor: '#ef4444', color: 'white', border: 'none' }}
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="navbar-buttons">
                <Link 
                  to="/login" 
                  className="navbar-button navbar-button-filled"
                >
                  Login
                </Link>
                <Link 
                  to="/register"
                  className="navbar-button navbar-button-outline"
                >
                  Register
                </Link>
                <div className="navbar-dropdown">
                  <button className="navbar-dropdown-button">
                    Staff Portals
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <div className="navbar-dropdown-menu">
                    <Link to="/staff-login" className="navbar-dropdown-item">Staff Login</Link>
                    <Link to="/agent-login" className="navbar-dropdown-item">Agent Login</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="navbar-toggle"
            aria-expanded={isOpen}
          >
            <span className="sr-only">Open main menu</span>
            {!isOpen ? (
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            ) : (
              <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={isOpen ? "navbar-mobile-menu" : "navbar-mobile-menu-hidden"}>
        <div className="navbar-mobile-links">
          <Link 
            to="/"
            className="navbar-mobile-link"
          >
            Home
          </Link>
          <Link 
            to="/about"
            className="navbar-mobile-link"
          >
            About
          </Link>
          <Link 
            to="/contact"
            className="navbar-mobile-link"
          >
            Contact
          </Link>
          <Link 
            to="/track"
            className="navbar-mobile-link"
          >
            Track Complaint
          </Link>
        </div>
        <div className="navbar-mobile-user">          {token ? (
            <div className="navbar-mobile-buttons">
              <Link
                to={getDashboardUrl()}
                className="navbar-mobile-button navbar-button-filled"
              >
                Dashboard
              </Link>
              <button
                onClick={handleLogout}
                className="navbar-mobile-button"
                style={{ backgroundColor: '#ef4444', color: 'white' }}
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="navbar-mobile-buttons">
              <Link
                to="/login"
                className="navbar-mobile-button navbar-button-filled"
              >
                Login
              </Link>
              <Link
                to="/register"
                className="navbar-mobile-button navbar-button-outline"
              >
                Register
              </Link>
              <div className="navbar-mobile-divider"></div>
              <p className="navbar-mobile-subtitle">Staff Portals:</p>
              <Link
                to="/staff-login"
                className="navbar-mobile-button navbar-button-outline"
              >
                Staff Login
              </Link>
              <Link
                to="/agent-login"
                className="navbar-mobile-button navbar-button-outline"
              >
                Agent Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;