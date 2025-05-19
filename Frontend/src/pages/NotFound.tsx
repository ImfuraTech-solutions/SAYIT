import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/pages/NotFound.css';

const NotFound: React.FC = () => {
  return (
    <div className="not-found-container">
      <div className="not-found-content">
        <h1 className="not-found-code">404</h1>
        <p className="not-found-title">Page Not Found</p>
        <p className="not-found-message">The page you are looking for doesn't exist or has been moved.</p>
        <Link
          to="/"
          className="not-found-button"
        >
          Return Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;