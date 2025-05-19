import React from 'react';
import '../styles/pages/Terms.css';

const Terms: React.FC = () => {
  return (
    <div className="terms-container">
      <h1>Terms of Service</h1>
      
      <section>
        <h2>1. Acceptance of Terms</h2>
        <p>By accessing and using the SAYIT platform, you agree to be bound by these Terms of Service and all applicable laws and regulations.</p>
      </section>

      <section>
        <h2>2. Platform Purpose</h2>
        <p>SAYIT is a citizen complaint management platform designed for Rwanda, providing a secure way to submit complaints, feedback, and inquiries to government agencies and organizations.</p>
      </section>

      <section>
        <h2>3. User Accounts</h2>
        <p>Users may access the platform through various authentication methods:</p>
        <ul>
          <li>Standard user accounts</li>
          <li>Staff member accounts (administrators, supervisors, moderators, analysts)</li>
          <li>Agency representative accounts</li>
          <li>Anonymous access via temporary codes</li>
        </ul>
      </section>

      <section>
        <h2>4. User Responsibilities</h2>
        <p>Users agree to:</p>
        <ul>
          <li>Provide accurate and truthful information</li>
          <li>Maintain the confidentiality of their account credentials</li>
          <li>Use the platform in a lawful and respectful manner</li>
          <li>Not misuse or attempt to compromise platform security</li>
        </ul>
      </section>

      <section>
        <h2>5. Complaint Submission</h2>
        <p>When submitting complaints, users must:</p>
        <ul>
          <li>Provide accurate information about the incident or issue</li>
          <li>Submit appropriate and relevant media attachments only</li>
          <li>Respect the privacy and rights of others</li>
          <li>Not submit false or malicious complaints</li>
        </ul>
      </section>

      <section>
        <h2>6. Privacy and Data Protection</h2>
        <p>We are committed to protecting user privacy and handling data in accordance with applicable laws and regulations. For detailed information, please refer to our Privacy Policy.</p>
      </section>

      <section>
        <h2>7. Platform Access and Availability</h2>
        <p>While we strive to maintain continuous platform availability, we do not guarantee uninterrupted access. We reserve the right to modify or terminate services with appropriate notice.</p>
      </section>

      <section>
        <h2>8. Modifications to Terms</h2>
        <p>We reserve the right to modify these terms at any time. Users will be notified of significant changes, and continued use of the platform constitutes acceptance of modified terms.</p>
      </section>

      <section>
        <h2>9. Contact Information</h2>
        <p>For questions about these terms, please contact: mfurayves25@gmail.com</p>
      </section>
    </div>
  );
};

export default Terms;
