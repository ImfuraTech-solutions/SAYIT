import React from 'react';
import '../styles/pages/Privacy.css';

const Privacy: React.FC = () => {
  return (
    <div className="privacy-container">
      <h1>Privacy Policy</h1>

      <section>
        <h2>1. Introduction</h2>
        <p>SAYIT is committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, and protect your data when you use our platform.</p>
      </section>

      <section>
        <h2>2. Information We Collect</h2>
        <p>We may collect the following types of information:</p>
        <ul>
          <li>Personal identification information (name, email, phone number)</li>
          <li>Complaint details and related media attachments</li>
          <li>Authentication and account information</li>
          <li>Usage data and platform interaction records</li>
          <li>Communications between users and agency representatives</li>
        </ul>
      </section>

      <section>
        <h2>3. Anonymous Submissions</h2>
        <p>For users choosing anonymous submission:</p>
        <ul>
          <li>No personal identification information is required</li>
          <li>Temporary access codes are provided for complaint tracking</li>
          <li>Submitted information is handled with enhanced privacy measures</li>
        </ul>
      </section>

      <section>
        <h2>4. How We Use Your Information</h2>
        <p>Your information is used for:</p>
        <ul>
          <li>Processing and managing complaints</li>
          <li>Communication regarding complaint status</li>
          <li>Platform administration and improvement</li>
          <li>Security and fraud prevention</li>
          <li>Legal compliance and reporting</li>
        </ul>
      </section>

      <section>
        <h2>5. Data Protection Measures</h2>
        <p>We protect your data through:</p>
        <ul>
          <li>Encryption of sensitive information</li>
          <li>Secure file storage with access controls</li>
          <li>JWT-based authentication</li>
          <li>Regular security audits</li>
          <li>Strict access controls and user permissions</li>
        </ul>
      </section>

      <section>
        <h2>6. Data Sharing</h2>
        <p>Your information may be shared with:</p>
        <ul>
          <li>Relevant government agencies handling your complaint</li>
          <li>Authorized platform administrators and moderators</li>
          <li>Legal authorities when required by law</li>
        </ul>
      </section>

      <section>
        <h2>7. User Rights</h2>
        <p>You have the right to:</p>
        <ul>
          <li>Access your personal information</li>
          <li>Request corrections to your data</li>
          <li>Delete your account and associated data</li>
          <li>Opt out of non-essential communications</li>
        </ul>
      </section>

      <section>
        <h2>8. Cookies and Tracking</h2>
        <p>We use cookies and similar technologies for:</p>
        <ul>
          <li>Authentication and security</li>
          <li>Platform functionality</li>
          <li>User experience improvement</li>
        </ul>
      </section>

      <section>
        <h2>9. Changes to Privacy Policy</h2>
        <p>We may update this privacy policy periodically. Users will be notified of significant changes affecting their rights or our data handling practices.</p>
      </section>

      <section>
        <h2>10. Contact Information</h2>
        <p>For privacy-related inquiries, please contact: mfurayves25@gmail.com</p>
      </section>
    </div>
  );
};

export default Privacy;
