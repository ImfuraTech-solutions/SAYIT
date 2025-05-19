import React, { useState } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import '../styles/pages/Contact.css';

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  category: string;
}

interface FormErrors {
  [key: string]: string;
}

const Contact: React.FC = () => {
  const [formData, setFormData] = useState<ContactFormData>({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    category: 'general_inquiry'
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [referenceId, setReferenceId] = useState<string>('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    // Name validation
    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }
    
    // Phone validation (required for Rwanda)
    if (!formData.phone) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(07\d{8}|(\+?250)?7\d{8})$/.test(formData.phone.replace(/\s+/g, ''))) {
      newErrors.phone = 'Please enter a valid Rwandan phone number (e.g., 07X XXX XXXX or +250 7XX XXX XXX)';
    }
    
    // Subject validation
    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    } else if (formData.subject.trim().length > 150) {
      newErrors.subject = 'Subject cannot exceed 150 characters';
    }
    
    // Message validation
    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message should be at least 10 characters';
    } else if (formData.message.trim().length > 2000) {
      newErrors.message = 'Message cannot exceed 2000 characters';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Please correct the errors in the form');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // API call to send contact message - matches the backend route
      const response = await axios.post('/api/contact', formData);
      
      if (response.data.success) {
        setIsSubmitted(true);
        setReferenceId(response.data.reference || '');
        toast.success('Your message has been sent successfully! We will get back to you soon.');
        
        // Reset form
        setFormData({
          name: '',
          email: '',
          phone: '',
          subject: '',
          message: '',
          category: 'general_inquiry'
        });
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || 'Failed to send your message. Please try again later.';
        toast.error(errorMessage);
      } else {
        toast.error('Failed to send your message. Please try again later.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="contact-container">
      <section className="contact-hero">
        <h1>Contact Us</h1>
        <p>
          Have questions or feedback? We're here to help. Reach out to our team using the form below.
        </p>
      </section>

      <section className="contact-content">
        <div className="contact-grid">
          <div className="contact-info">
            <div className="contact-section">
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="contact-detail">
                <h3>Email Us</h3>
                <p><a href="mailto:support@sayit.rw">support@sayit.rw</a></p>
                <p className="text-sm text-gray-500">We aim to respond within 24 hours</p>
              </div>
            </div>

            <div className="contact-section">
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
              </div>
              <div className="contact-detail">
                <h3>Call Us</h3>
                <p><a href="tel:+250780123456">+250 780 123 456</a></p>
                <p className="text-sm text-gray-500">Mon-Fri, 8am-5pm</p>
              </div>
            </div>

            <div className="contact-section">
              <div className="contact-icon">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="contact-detail">
                <h3>Visit Us</h3>
                <p>KN 5 Ave<br/>Kiyovu, Nyarugenge<br/>Kigali, Rwanda</p>
              </div>
            </div>
            
            <div className="contact-map">
              {/* Google Maps iframe for Kigali location */}
              <iframe 
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d63799.41807620931!2d30.03390275!3d-1.94415445!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x19dca4258ed8e797%3A0xf32b36a5411d0bc8!2sKigali%2C%20Rwanda!5e0!3m2!1sen!2sus!4v1653389089301!5m2!1sen!2sus" 
                width="100%" 
                height="100%" 
                style={{ border: 0 }} 
                allowFullScreen={true} 
                loading="lazy"
                title="SAYIT Rwanda Office Location"
              ></iframe>
            </div>
          </div>

          <div className="contact-form-container">
            <h2>Send us a message</h2>
            {isSubmitted ? (
              <div className="text-center py-8 register-feedback">
                <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-16 w-16 text-green-500 rwanda-green" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-4 text-xl font-bold text-gray-900">Thank you!</h3>
                <p className="mt-2 text-gray-600">
                  Your message has been received. We'll be in touch shortly.
                </p>
                {referenceId && (
                  <p className="mt-2 font-semibold">
                    Your reference ID: <span className="rwanda-blue">{referenceId}</span>
                  </p>
                )}
                <button
                  className="contact-button mt-6"
                  onClick={() => setIsSubmitted(false)}
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="contact-form">
                <div className="contact-form-row">
                  <div className="contact-form-group">
                    <label htmlFor="name" className="contact-label">
                      Your Name <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`contact-input ${errors.name ? 'contact-input-error' : ''}`}
                      placeholder="e.g., Uwimana Jean"
                    />
                    {errors.name && <div className="contact-error">{errors.name}</div>}
                  </div>

                  <div className="contact-form-group">
                    <label htmlFor="email" className="contact-label">
                      Email Address <span className="required">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className={`contact-input ${errors.email ? 'contact-input-error' : ''}`}
                      placeholder="e.g., uwimana.jean@example.com"
                    />
                    {errors.email && <div className="contact-error">{errors.email}</div>}
                  </div>
                </div>

                <div className="contact-form-row">
                  <div className="contact-form-group">
                    <label htmlFor="phone" className="contact-label">
                      Phone Number <span className="required">*</span>
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      name="phone"
                      value={formData.phone}
                      onChange={handleInputChange}
                      className={`contact-input ${errors.phone ? 'contact-input-error' : ''}`}
                      placeholder="e.g., 078 123 4567"
                    />
                    {errors.phone && <div className="contact-error">{errors.phone}</div>}
                    <p className="contact-hint">
                      Enter a Rwandan phone number starting with 07 or +250
                    </p>
                  </div>

                  <div className="contact-form-group">
                    <label htmlFor="category" className="contact-label">
                      Inquiry Type
                    </label>
                    <select
                      id="category"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className="contact-input"
                    >
                      <option value="general_inquiry">General Inquiry</option>
                      <option value="technical_support">Technical Support</option>
                      <option value="feedback">Feedback</option>
                      <option value="complaint">Complaint Issues</option>
                      <option value="partnership">Partnership Opportunity</option>
                    </select>
                  </div>
                </div>

                <div className="contact-form-group">
                  <label htmlFor="subject" className="contact-label">
                    Subject <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="subject"
                    name="subject"
                    value={formData.subject}
                    onChange={handleInputChange}
                    className={`contact-input ${errors.subject ? 'contact-input-error' : ''}`}
                    placeholder="How can we help you?"
                  />
                  {errors.subject && <div className="contact-error">{errors.subject}</div>}
                </div>

                <div className="contact-form-group">
                  <label htmlFor="message" className="contact-label">
                    Your Message <span className="required">*</span>
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={formData.message}
                    onChange={handleInputChange}
                    className={`contact-textarea ${errors.message ? 'contact-input-error' : ''}`}
                    placeholder="Please provide details about your inquiry..."
                    rows={5}
                  ></textarea>
                  {errors.message && <div className="contact-error">{errors.message}</div>}
                  <p className="contact-hint">
                    {2000 - formData.message.length} characters remaining
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="contact-button"
                >
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="contact-faq">
        <div className="contact-faq-container">
          <h2>Frequently Asked Questions</h2>
          <div className="contact-faq-grid">
            <div className="contact-faq-item">
              <h3 className="contact-faq-question">How quickly will I receive a response?</h3>
              <p className="contact-faq-answer">
                We aim to respond to all inquiries within 24 business hours. For urgent matters, we recommend calling our support line directly.
              </p>
            </div>
            
            <div className="contact-faq-item">
              <h3 className="contact-faq-question">Can I track the status of my complaint?</h3>
              <p className="contact-faq-answer">
                Yes! Once you submit a complaint through our platform, you'll receive a unique tracking code that you can use to monitor the progress of your case.
              </p>
            </div>
            
            <div className="contact-faq-item">
              <h3 className="contact-faq-question">Is my information kept confidential?</h3>
              <p className="contact-faq-answer">
                Absolutely. We take privacy seriously and adhere to strict confidentiality protocols in accordance with Rwandan data protection laws. Your information is securely stored and only accessed by authorized personnel.
              </p>
            </div>
            
            <div className="contact-faq-item">
              <h3 className="contact-faq-question">Which government agencies are currently using SAYIT?</h3>
              <p className="contact-faq-answer">
                SAYIT Rwanda currently partners with various ministries and agencies including the Rwanda Development Board (RDB), Rwanda Utilities Regulatory Authority (RURA), and local district offices. Government agencies interested in joining our platform can select "Partnership Opportunity" when contacting us.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Contact;
