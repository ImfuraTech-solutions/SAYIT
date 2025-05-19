import React from 'react';
import { Link } from 'react-router-dom';
import '../styles/pages/About.css';

const About: React.FC = () => {
  return (
    <main className="about-page">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-container">
          <h1>About SAYIT</h1>
          <p>
            Empowering Rwandan citizens and creating accountability in government through transparent complaint resolution.
          </p>
        </div>
      </section>
      
      {/* Mission Section */}
      <section className="about-mission">
        <div className="about-mission-container">
          <div className="about-mission-content">
            <div className="about-mission-text">
              <h2>Our Mission</h2>
              <p>
                SAYIT was founded with a clear mission: to create a bridge between citizens and Rwanda's government agencies that fosters transparency, accountability, and efficient resolution of public concerns.
              </p>
              <p>
                We believe that every voice deserves to be heard, and that technology can play a crucial role in improving how citizens interact with public institutions.
              </p>
              <p>
                By providing a secure, accessible platform that connects people directly with the appropriate agencies, we aim to transform the traditional complaint management process into one that is responsive, efficient, and fair for all Rwandans.
              </p>
            </div>
            <div className="about-mission-image">
              <img 
                src="/images/mission-illustration.svg" 
                alt="SAYIT mission illustration" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="about-values">
        <div className="about-values-container">
          <h2>Our Core Values</h2>
          
          <div className="about-values-grid">
            <div className="about-value-card">
              <div className="about-value-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <h3>Transparency</h3>
              <p>
                We believe in open processes where citizens can track their complaints from submission to resolution.
              </p>
            </div>
            
            <div className="about-value-card">
              <div className="about-value-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <h3>Security</h3>
              <p>
                Protecting user data and providing options for anonymous reporting are fundamental to our platform.
              </p>
            </div>
            
            <div className="about-value-card">
              <div className="about-value-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3>Accountability</h3>
              <p>
                We hold agencies to clear standards of performance and response times to ensure effective resolution.
              </p>
            </div>
            
            <div className="about-value-card">
              <div className="about-value-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
              </div>
              <h3>Accessibility</h3>
              <p>
                Our platform is designed to be accessible to all Rwandan citizens, regardless of technical ability or background.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How We Work Section */}
      <section className="about-how-we-work">
        <div className="about-how-we-work-container">
          <h2>How We Work</h2>
          
          <div className="about-how-we-work-grid">
            <div className="about-how-we-work-item">
              <div className="about-how-we-work-number">1</div>
              <h3>Secure Complaint Collection</h3>
              <p>
                We provide multiple secure channels for citizens to submit their complaints, with options for standard or anonymous reporting.
              </p>
            </div>
            <div className="about-how-we-work-item">
              <div className="about-how-we-work-number">2</div>
              <h3>Smart Assignment</h3>
              <p>
                Our system analyzes each complaint and automatically routes it to the appropriate Rwandan government agency or department for efficient handling.
              </p>
            </div>
            
            <div className="about-how-we-work-item">
              <div className="about-how-we-work-number">3</div>
              <h3>Transparent Resolution</h3>
              <p>
                Citizens can track their complaint's progress at every stage, with clear communication about actions taken and resolution status.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Partners & Agencies Section */}
      <section className="about-partners">
        <div className="about-partners-container">
          <h2>Our Partners</h2>
          <p className="about-partners-description">
            We collaborate with all Rwandan government agencies and government offices committed to improving public services and citizen experience.
          </p>
          
          <div className="about-partners-content">
            <div className="about-partners-text">
              <p>
                SAYIT serves as a unified platform connecting citizens with various government entities across Rwanda, including ministries, districts, sectors, and specialized agencies. Our collaborative approach ensures that citizen complaints are directed to the right authorities for prompt resolution.
              </p>
              <p>
                Through these partnerships, we aim to enhance service delivery, improve governance, and strengthen the relationship between citizens and their government.
              </p>
            </div>
            <div className="about-partners-image">
              <img 
                src="/images/rwanda-flag.jpg" 
                alt="Rwanda Government Partnership" 
              />
            </div>
          </div>
        </div>
      </section>

      {/* Impact Section - New modern section */}
      <section className="about-impact">
        <div className="about-impact-container">
          <h2>Our Impact</h2>
          
          <div className="about-impact-stats">
            <div className="about-impact-stat">
              <span className="about-impact-number">98%</span>
              <span className="about-impact-label">Complaint Resolution Rate</span>
            </div>
            <div className="about-impact-stat">
              <span className="about-impact-number">24h</span>
              <span className="about-impact-label">Average Response Time</span>
            </div>
            <div className="about-impact-stat">
              <span className="about-impact-number">30+</span>
              <span className="about-impact-label">Government Agencies Connected</span>
            </div>
          </div>
          
          <div className="about-impact-testimonial">
            <blockquote>
              "SAYIT has transformed how we handle citizen feedback, making our services more responsive and accountable to the people we serve."
            </blockquote>
            <cite>— Government Agency Representative</cite>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="about-cta">
        <div className="about-cta-container">
          <h2>Join the Movement for Better Governance in Rwanda</h2>
          <p>
            Be part of a system that values citizen input and works towards meaningful improvements in public services.
          </p>
          <div className="about-cta-buttons">
            <Link 
              to="/register" 
              className="about-cta-button primary"
            >
              Create an Account
            </Link>
            <Link 
              to="/contact" 
              className="about-cta-button secondary"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default About;