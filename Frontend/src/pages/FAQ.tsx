import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/pages/FAQ.css';

interface FAQItem {
  id: number;
  question: string;
  answer: string;
  category: string;
}

const FAQ: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // FAQ data
  const faqItems: FAQItem[] = [
    {
      id: 1,
      question: "How do I submit a complaint?",
      answer: "You can submit a complaint by clicking on 'Submit Complaint' at the top of the page. You'll have options to submit as a registered user or anonymously. Fill in the required details, attach any supporting documents, and submit the form. You'll receive a tracking ID to monitor your complaint's status.",
      category: "submission"
    },
    {
      id: 2,
      question: "Can I submit a complaint anonymously?",
      answer: "Yes, SAYIT allows for anonymous submissions. Select the 'Submit Anonymously' option on the complaint submission page. You'll still receive a tracking ID and access code that allows you to check the status of your complaint without revealing your identity.",
      category: "submission"
    },
    {
      id: 3,
      question: "How do I track the status of my complaint?",
      answer: "You can track your complaint by clicking on the 'Track Complaint' link in the navigation menu. Enter your tracking ID (and access code if submitted anonymously). The system will display the current status, assigned agency, and any responses to your complaint.",
      category: "tracking"
    },
    {
      id: 4,
      question: "How long does it take to get a response?",
      answer: "Response times vary depending on the nature and complexity of your complaint. Generally, agencies aim to acknowledge complaints within 48 hours and provide initial responses within 5-7 business days. More complex issues may take longer to resolve fully.",
      category: "process"
    },
    {
      id: 5,
      question: "What should I do if I'm not satisfied with the resolution?",
      answer: "If you're not satisfied with the resolution, you can submit a feedback form explaining your concerns. You can also request an escalation through your dashboard (for registered users) or by using your tracking ID (for anonymous submissions). A senior staff member will review your case.",
      category: "process"
    },
    {
      id: 6,
      question: "How do I create an account?",
      answer: "Click on the 'Register' link in the top navigation bar. Fill in your details, verify your email address, and set a secure password. Once registered, you can log in to submit complaints, track their progress, and receive notifications.",
      category: "account"
    },
    {
      id: 7,
      question: "Is my personal information secure?",
      answer: "Yes, SAYIT takes data security very seriously. We use industry-standard encryption and security practices to protect your information. Personal data is only shared with the relevant agencies needed to address your complaint. You can read our full privacy policy for more details.",
      category: "privacy"
    },
    {
      id: 8,
      question: "Which agencies are available on SAYIT?",
      answer: "SAYIT partners with various government departments and agencies at local, state, and federal levels. The specific agencies available depend on your location and the nature of your complaint. When you submit a complaint, the system will help direct it to the appropriate authority.",
      category: "general"
    },
    {
      id: 9,
      question: "Can I upload documents with my complaint?",
      answer: "Yes, you can upload supporting documents such as photos, receipts, previous correspondence, or any other relevant evidence when submitting your complaint. We accept PDF, JPG, PNG, and DOC formats up to 10MB per file, with a maximum of 5 files per submission.",
      category: "submission"
    },
    {
      id: 10,
      question: "What happens after I submit my complaint?",
      answer: "After submission, your complaint is reviewed and assigned to the appropriate agency. You'll receive a confirmation email with your tracking ID. The agency will investigate your complaint and respond through the platform. You'll be notified of any updates or when a response is available.",
      category: "process"
    }
  ];

  // Filter faq items based on category and search term
  const filteredFAQs = faqItems.filter((item) => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
    const matchesSearch = 
      item.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Toggle FAQ item expansion
  const toggleExpand = (id: number) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
    }
  };

  // Categories for the filter
  const categories = [
    { id: 'all', name: 'All Questions' },
    { id: 'submission', name: 'Complaint Submission' },
    { id: 'tracking', name: 'Tracking & Updates' },
    { id: 'process', name: 'Complaint Process' },
    { id: 'account', name: 'Account & Registration' },
    { id: 'privacy', name: 'Privacy & Security' },
    { id: 'general', name: 'General Information' }
  ];

  return (
    <div className="faq-container">
      {/* Header */}
      <div className="faq-header">
        <h1 className="faq-title">Frequently Asked Questions</h1>
        <p className="faq-subtitle">
          Find answers to the most common questions about using the SAYIT platform
        </p>
      </div>
      
      {/* Search */}
      <div className="faq-search">
        <span className="faq-search-icon">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" width="20" height="20">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          type="text"
          placeholder="Search for answers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="faq-search-input"
        />
      </div>
      
      {/* Category Filters */}
      <div className="faq-filters">
        <div className="faq-filter-container">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`faq-filter-button ${activeCategory === category.id ? 'faq-filter-active' : ''}`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* FAQ Items */}
      <div className="faq-list">
        {filteredFAQs.length > 0 ? (
          filteredFAQs.map((faq) => (
            <div 
              key={faq.id} 
              className={`faq-item ${expandedId === faq.id ? 'faq-item-expanded' : ''}`}
            >
              <button 
                onClick={() => toggleExpand(faq.id)}
                className="faq-question"
              >
                <span>{faq.question}</span>
                <span className="faq-icon">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                    width="20"
                    height="20"
                  >
                    {expandedId === faq.id ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    )}
                  </svg>
                </span>
              </button>
              {expandedId === faq.id && (
                <div className="faq-answer">
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="faq-empty">
            <p>No results found for "{searchTerm}". Please try another search term.</p>
          </div>
        )}
      </div>
      
      {/* More Help Section */}
      <div className="faq-more-help">
        <h2 className="faq-more-help-title">Need More Help?</h2>
        <p className="faq-more-help-text">
          Can't find the answer you're looking for? Please contact our support team.
        </p>
        <div className="faq-more-help-buttons">
          <Link to="/contact" className="faq-contact-button">
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQ;