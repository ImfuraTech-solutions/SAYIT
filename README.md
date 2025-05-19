# SAYIT Platform

## Overview
SAYIT is a comprehensive citizen complaint management platform designed for Rwanda, providing a secure and accessible way for citizens to submit complaints, feedback, and inquiries to government agencies and organizations.

## Key Features

### Multi-user Authentication System
- **Standard Users**: Regular citizens with personal accounts
- **Staff Members**: Platform administrators with role-based permissions (admins, supervisors, moderators, analysts)
- **Agency Representatives**: Government officials with agency-specific access
- **Anonymous Users**: Temporary access via unique codes for privacy concerns

### Complaint Management
- Submit complaints with rich media attachments (images, videos, audio)
- Track complaint status and receive updates
- Communicate directly with agency representatives
- Anonymous submission option for sensitive matters

### Security Features
- JWT-based authentication with proper signing
- Token blacklisting for secure logout
- Rate limiting to prevent abuse
- Password hashing with bcrypt
- HTTPS and secure headers

### Accessibility & Usability
- Mobile-responsive design
- Optimized for low-bandwidth connections
- Multi-language support
- User-friendly interface for all technical skill levels

## Platform Architecture

### Frontend
- React/TypeScript application
- Responsive design with modern UI components
- Optimized asset delivery for various network conditions

### Backend
- Node.js Express API server
- MongoDB database for flexible data storage
- JWT authentication system
- Cloudinary integration for media storage

## API Endpoints

### Public Routes
- `/api/auth/standard-login` - Login for standard users
- `/api/auth/staff-login` - Login for staff members (with role verification)
- `/api/auth/agent-login` - Login for agency representatives
- `/api/auth/anonymous-login` - Login with temporary access code
- `/api/auth/request-password-reset` - Request password reset email
- `/api/auth/reset-password/:token` - Reset password with token
- `/api/complaints/submit` - Submit a new complaint (authenticated or anonymous)
- `/api` - Platform info and API status

### Protected Routes
- `/api/auth/verify-auth` - Verify authentication status
- `/api/auth/generate-anonymous-code` - Create new anonymous access codes (staff only)
- `/api/auth/logout` - Secure logout
- `/api/complaints/me` - View user's complaints
- `/api/complaints/:id` - View specific complaint details
- `/api/complaints/:id/respond` - Add response to a complaint

### Administrative Routes
- `/api/admin/complaints` - Manage all complaints
- `/api/admin/users` - User management
- `/api/admin/agencies` - Agency management
- `/api/admin/analytics` - Platform analytics and reporting

## Security Model

### Role-Based Access Control
- **Administrators**: Complete platform access and configuration
- **Supervisors**: Team and case management
- **Moderators**: Content oversight and compliance
- **Analysts**: Data analysis and reporting
- **Agency Representatives**: Access to agency-specific complaints
- **Standard Users**: Personal complaint management
- **Anonymous Users**: Limited submission and tracking capabilities

### Data Protection
- All sensitive data encrypted at rest
- Secure file storage with access controls
- PII (Personally Identifiable Information) protection
- Comprehensive audit logging

## Deployment

The platform consists of two main components:
1. **Backend**: Node.js/Express API server with MongoDB database
2. **Frontend**: React/TypeScript single-page application

Both can be deployed separately or as a single unit, with static frontend assets served by the backend when in production mode.

## Development Status

SAYIT is currently under active development with a focus on:
- Enhancing mobile responsiveness
- Adding additional language support
- Implementing advanced analytics
- Expanding agency integration capabilities

## Contact

For more information about SAYIT, please contact 
mfurayves25@gmail.com