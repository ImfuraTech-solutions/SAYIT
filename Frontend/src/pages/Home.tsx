import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/pages/Home.css';
import WomanSendingComplaint from '../assets/Woman-sending-complaint.jpg';
import WomanResponseHappy from '../assets/Woman happy to recieve responce.jpg';
import RwandaTransparency from '../assets/Rwanda transparecny icon image.jpeg';
import AgentResponse from '../assets/agent-giving response.jpg';
import PeopleDiscussing from '../assets/people discussing om how to create nice service.jpg';
import SayitLogo from '../assets/Sayit-logo.png';

const Home: React.FC = () => {
  // Stats with animation
  const [stats] = useState({
    complaintsResolved: 5430,
    agenciesParticipating: 142,
    averageResponseTime: '3.5 days',
    userSatisfaction: '92%'
  });
  
  const [animatedStats, setAnimatedStats] = useState({
    complaintsResolved: 0,
    agenciesParticipating: 0,
    averageResponseTime: '0',
    userSatisfaction: '0%'
  });

  const [isVisible, setIsVisible] = useState({
    hero: false,
    howItWorks: false,
    stats: false,
    features: false,
    cta: false
  });

  // Animation for counting up stats
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.id;
          setIsVisible(prev => ({ ...prev, [sectionId]: true }));
        }
      });
    }, { threshold: 0.2 });

    const sections = document.querySelectorAll('.animate-on-scroll');
    sections.forEach(section => {
      observer.observe(section);
    });

    return () => sections.forEach(section => observer.unobserve(section));
  }, []);

  // Animate stats when the stats section becomes visible
  useEffect(() => {
    if (isVisible.stats) {
      const duration = 2000; // ms
      const steps = 50;
      const stepTime = duration / steps;
      
      let currentStep = 0;
      
      const interval = setInterval(() => {
        currentStep += 1;
        const progress = currentStep / steps;
        
        setAnimatedStats({
          complaintsResolved: Math.floor(stats.complaintsResolved * progress),
          agenciesParticipating: Math.floor(stats.agenciesParticipating * progress),
          averageResponseTime: `${(parseFloat(stats.averageResponseTime) * progress).toFixed(1)} days`,
          userSatisfaction: `${Math.floor(parseInt(stats.userSatisfaction) * progress)}%`
        });
        
        if (currentStep >= steps) clearInterval(interval);
      }, stepTime);
      
      return () => clearInterval(interval);
    }
  }, [isVisible.stats, stats]);

  return (
    <main className="home-page">
      {/* Hero Section */}
      <section id="hero" className={`hero-section animate-on-scroll ${isVisible.hero ? 'visible' : ''}`}>
        <div className="hero-container">
          <div className="hero-content">
            <h1 className="hero-title">
              Your Voice <span className="text-accent">Matters</span>
            </h1>
            <p className="hero-description">
              SAYIT is a secure platform that connects Rwandan citizens with government agencies to address concerns, submit complaints, and track resolutions transparently.
            </p>
            <div className="hero-buttons">
              <Link 
                to="/submit-complaint" 
                className="hero-button primary"
              >
                Submit Complaint
              </Link>
              <Link
                to="/track-complaint" 
                className="hero-button secondary"
              >
                Track Status
              </Link>
            </div>
          </div>
          <div className="hero-image">
            <img 
              src={WomanSendingComplaint} 
              alt="Woman submitting a complaint" 
              className="hero-main-image"
            />
            <div className="floating-image image-1">
              <img src={SayitLogo} alt="SAYIT Logo" />
            </div>
            <div className="floating-image image-2">
              <img src={RwandaTransparency} alt="Rwanda Transparency" />
            </div>
          </div>
        </div>
        <div className="hero-wave">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,149.3C960,160,1056,160,1152,144C1248,128,1344,96,1392,80L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="howItWorks" className={`how-it-works-section animate-on-scroll ${isVisible.howItWorks ? 'visible' : ''}`}>
        <div className="how-it-works-container">
          <h2>How SAYIT <span className="text-accent">Works</span></h2>
          
          <div className="how-it-works-grid">
            <div className="how-it-works-card">
              <div className="how-it-works-image">
                <img src={WomanSendingComplaint} alt="Submit a complaint" />
              </div>
              <div className="how-it-works-number">
                1
              </div>
              <h3>Submit</h3>
              <p>
                File your complaint through our secure platform. Choose between standard or anonymous submissions.
              </p>
            </div>
            
            <div className="how-it-works-card">
              <div className="how-it-works-image">
                <img src={AgentResponse} alt="Agent reviewing complaint" />
              </div>
              <div className="how-it-works-number">
                2
              </div>
              <h3>Track</h3>
              <p>
                Monitor the status of your complaint with your unique tracking ID. Get updates throughout the process.
              </p>
            </div>
            <div className="how-it-works-card">
              <div className="how-it-works-image">
                <img src={WomanResponseHappy} alt="Resolved complaint" />
              </div>
              <div className="how-it-works-number">
                3
              </div>
              <h3>Resolve</h3>
              <p>
                Receive a resolution from the appropriate agency. Provide feedback on the handling of your case.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="stats" className={`stats-section animate-on-scroll ${isVisible.stats ? 'visible' : ''}`}>
        <div className="stats-wave-top">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fillOpacity="1" d="M0,192L48,197.3C96,203,192,213,288,218.7C384,224,480,224,576,202.7C672,181,768,139,864,122.7C960,107,1056,117,1152,133.3C1248,149,1344,171,1392,181.3L1440,192L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"></path>
          </svg>
        </div>
        <div className="stats-container">
          <h2>Making an <span className="text-accent">Impact</span></h2>
          
          <div className="stats-grid">
            <div className="stat-item">
              <div className="stat-number">{animatedStats.complaintsResolved}</div>
              <div className="stat-label">Complaints Resolved</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-number">{animatedStats.agenciesParticipating}</div>
              <div className="stat-label">Participating Agencies</div>
            </div>
            
            <div className="stat-item">
              <div className="stat-number">{animatedStats.averageResponseTime}</div>
              <div className="stat-label">Avg. Response Time</div>
            </div>
            <div className="stat-item">
              <div className="stat-number">{animatedStats.userSatisfaction}</div>
              <div className="stat-label">User Satisfaction</div>
            </div>
          </div>
        </div>
        <div className="stats-wave-bottom">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320">
            <path fill="#ffffff" fillOpacity="1" d="M0,96L48,112C96,128,192,160,288,160C384,160,480,128,576,122.7C672,117,768,139,864,149.3C960,160,1056,160,1152,144C1248,128,1344,96,1392,80L1440,64L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          </svg>
        </div>
      </section>

      {/* Feature Highlights */}
      <section id="features" className={`features-section animate-on-scroll ${isVisible.features ? 'visible' : ''}`}>
        <div className="features-container">
          <h2>Why Choose <span className="text-accent">SAYIT</span></h2>
          
          <div className="features-grid">
            <div className="feature-item fade-in">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="feature-content">
                <h3>Security & Privacy</h3>
                <p>
                  Your information is protected with industry-standard encryption and privacy controls.
                </p>
              </div>
            </div>
            <div className="feature-item fade-in">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              </div>
              <div className="feature-content">
                <h3>Transparency</h3>
                <p>
                  Track your complaint at every stage, with clear visibility into the resolution process.
                </p>
              </div>
            </div>
            
            <div className="feature-item fade-in">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="feature-content">
                <h3>Anonymous Reporting</h3>
                <p>
                  Submit concerns anonymously while still being able to track resolution progress.
                </p>
              </div>
            </div>
            <div className="feature-item fade-in">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="feature-content">
                <h3>Efficient Processing</h3>
                <p>
                  Smart routing ensures your complaint reaches the right department quickly.
                </p>
              </div>
            </div>
            
            <div className="feature-item fade-in">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="feature-content">
                <h3>Timely Responses</h3>
                <p>
                  Agencies have set response times to ensure your concerns are addressed promptly.
                </p>
              </div>
            </div>
            
            <div className="feature-item fade-in">
              <div className="feature-icon">
                <svg xmlns="http://www.w3.org/2000/svg" className="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="feature-content">
                <h3>Accountability</h3>
                <p>
                  Public agencies are held accountable through transparent performance metrics.
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="features-image">
          <img src={PeopleDiscussing} alt="People discussing service improvement" />
          <div className="features-circle"></div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className={`cta-section animate-on-scroll ${isVisible.cta ? 'visible' : ''}`}>
        <div className="cta-container">
          <h2>Ready to Make Your <span className="text-accent">Voice Heard?</span></h2>
          <p>
            Join thousands of Rwandan citizens who have successfully resolved their concerns through the SAYIT platform.
          </p>
          <div className="cta-buttons">
            <Link 
              to="/register" 
              className="cta-button primary"
            >
              Create an Account
            </Link>
            <Link 
              to="/submit/anonymous" 
              className="cta-button secondary"
            >
              Submit Anonymously
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;