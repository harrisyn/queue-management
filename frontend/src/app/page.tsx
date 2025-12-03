'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import DashboardPage from '@/components/pages/DashboardPage';

// ============================================================================
// SAAS LANDING PAGE - Modern, Professional, Stunning
// ============================================================================

function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-rotate testimonials
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTestimonial(prev => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const testimonials = [
    {
      quote: "QueueFlow reduced our patient wait times by 45% in the first month. The real-time updates keep everyone informed.",
      author: "Dr. Sarah Chen",
      role: "Chief Medical Officer",
      company: "Metro Health Center",
      avatar: "SC",
    },
    {
      quote: "Finally, a queue system that just works. Our customers love the SMS notifications and QR check-in.",
      author: "James Wilson",
      role: "Operations Director",
      company: "TechServe Inc",
      avatar: "JW",
    },
    {
      quote: "The analytics dashboard gives us insights we never had before. We've optimized our staffing completely.",
      author: "Maria Rodriguez",
      role: "Branch Manager",
      company: "First National Bank",
      avatar: "MR",
    },
  ];

  const features = [
    {
      icon: "⚡",
      title: "Real-time Updates",
      description: "Customers receive instant notifications about their queue position and estimated wait time.",
      gradient: "linear-gradient(135deg, #6366f1, #8b5cf6)",
    },
    {
      icon: "📱",
      title: "QR Code Check-in",
      description: "Scan and join queues in seconds. No app download required - works in any browser.",
      gradient: "linear-gradient(135deg, #ec4899, #f43f5e)",
    },
    {
      icon: "📊",
      title: "Analytics Dashboard",
      description: "Deep insights into wait times, peak hours, and staff performance to optimize operations.",
      gradient: "linear-gradient(135deg, #10b981, #14b8a6)",
    },
    {
      icon: "🔔",
      title: "Smart Notifications",
      description: "SMS, email, and push notifications keep customers informed even when they step away.",
      gradient: "linear-gradient(135deg, #f59e0b, #f97316)",
    },
    {
      icon: "🏢",
      title: "Multi-location",
      description: "Manage multiple branches from a single dashboard with location-specific settings.",
      gradient: "linear-gradient(135deg, #3b82f6, #6366f1)",
    },
    {
      icon: "🔒",
      title: "Enterprise Security",
      description: "Bank-grade encryption, HIPAA compliant, with role-based access control.",
      gradient: "linear-gradient(135deg, #8b5cf6, #a855f7)",
    },
  ];

  const stats = [
    { value: "50K+", label: "Customers Served Daily" },
    { value: "45%", label: "Average Wait Time Reduction" },
    { value: "99.9%", label: "Uptime Guarantee" },
    { value: "4.9★", label: "Customer Rating" },
  ];

  return (
    <div style={styles.page}>
      {/* Background Elements */}
      <div style={styles.bgGradient} />
      <div style={styles.bgGrid} />
      <div style={styles.glowOrb1} />
      <div style={styles.glowOrb2} />
      <div style={styles.glowOrb3} />

      {/* Navigation */}
      <nav style={{
        ...styles.nav,
        ...(isScrolled ? styles.navScrolled : {}),
      }}>
        <div style={styles.navContent}>
          <Link href="/" style={styles.logo}>
            <span style={styles.logoIcon}>🏥</span>
            <span style={styles.logoText}>QueueFlow</span>
          </Link>

          <div style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#how-it-works" style={styles.navLink}>How it Works</a>
            <a href="#testimonials" style={styles.navLink}>Testimonials</a>
            <a href="#pricing" style={styles.navLink}>Pricing</a>
          </div>

          <div style={styles.navActions}>
            <Link href="/login" style={styles.loginBtn}>
              Sign In
            </Link>
            <Link href="/register" style={styles.ctaBtn}>
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section ref={heroRef} style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>
            <span style={styles.badgeDot} />
            <span>Now with AI-powered wait time predictions</span>
          </div>

          <h1 style={styles.heroTitle}>
            Transform Your
            <br />
            <span style={styles.gradientText}>Queue Experience</span>
          </h1>

          <p style={styles.heroSubtitle}>
            The modern queue management system that reduces wait times,
            improves customer satisfaction, and gives you real-time insights
            into your operations.
          </p>

          <div style={styles.heroCtas}>
            <Link href="/register" style={styles.primaryCta}>
              <span>Start Free Trial</span>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Link>
            <a href="#demo" style={styles.secondaryCta}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              <span>Watch Demo</span>
            </a>
          </div>

          <div style={styles.heroTrust}>
            <span style={styles.trustLabel}>Trusted by 500+ organizations</span>
            <div style={styles.trustLogos}>
              {['🏥', '🏦', '🏛️', '🏪', '🎓'].map((emoji, i) => (
                <div key={i} style={styles.trustLogo}>{emoji}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Hero Visual */}
        <div style={styles.heroVisual}>
          <div style={styles.mockupContainer}>
            {/* Dashboard Mockup */}
            <div style={styles.dashboardMockup}>
              <div style={styles.mockupHeader}>
                <div style={styles.mockupDots}>
                  <span style={{ ...styles.mockupDot, background: '#ef4444' }} />
                  <span style={{ ...styles.mockupDot, background: '#f59e0b' }} />
                  <span style={{ ...styles.mockupDot, background: '#10b981' }} />
                </div>
                <span style={styles.mockupTitle}>QueueFlow Dashboard</span>
              </div>
              <div style={styles.mockupContent}>
                <div style={styles.mockupSidebar}>
                  <div style={styles.sidebarItem}>📊 Overview</div>
                  <div style={{ ...styles.sidebarItem, ...styles.sidebarItemActive }}>👥 Queues</div>
                  <div style={styles.sidebarItem}>📍 Locations</div>
                  <div style={styles.sidebarItem}>📈 Analytics</div>
                </div>
                <div style={styles.mockupMain}>
                  <div style={styles.queueCard}>
                    <div style={styles.queueHeader}>
                      <span>🏥 General Consultation</span>
                      <span style={styles.queueBadge}>12 waiting</span>
                    </div>
                    <div style={styles.queueProgress}>
                      <div style={{ ...styles.queueProgressBar, width: '65%' }} />
                    </div>
                    <div style={styles.queueStats}>
                      <span>Avg wait: 8 min</span>
                      <span>Next: A-024</span>
                    </div>
                  </div>
                  <div style={styles.queueCard}>
                    <div style={styles.queueHeader}>
                      <span>💉 Vaccination</span>
                      <span style={styles.queueBadge}>5 waiting</span>
                    </div>
                    <div style={styles.queueProgress}>
                      <div style={{ ...styles.queueProgressBar, width: '30%' }} />
                    </div>
                    <div style={styles.queueStats}>
                      <span>Avg wait: 3 min</span>
                      <span>Next: V-089</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Floating ticket */}
            <div style={styles.floatingTicket}>
              <div style={styles.ticketHeader}>🎫 Your Ticket</div>
              <div style={styles.ticketNumber}>A-024</div>
              <div style={styles.ticketInfo}>Position: #3 • ~8 min</div>
            </div>

            {/* Floating notification */}
            <div style={styles.floatingNotification}>
              <span style={styles.notifIcon}>🔔</span>
              <div>
                <strong>You&apos;re next!</strong>
                <p style={styles.notifText}>Please proceed to Counter 2</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section style={styles.statsSection}>
        <div style={styles.statsGrid}>
          {stats.map((stat, i) => (
            <div key={i} style={styles.statCard}>
              <div style={styles.statValue}>{stat.value}</div>
              <div style={styles.statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={styles.featuresSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>Features</span>
          <h2 style={styles.sectionTitle}>
            Everything you need to
            <br />
            <span style={styles.gradientText}>manage queues effectively</span>
          </h2>
          <p style={styles.sectionSubtitle}>
            From simple check-ins to complex multi-location operations,
            QueueFlow has you covered.
          </p>
        </div>

        <div style={styles.featuresGrid}>
          {features.map((feature, i) => (
            <div key={i} style={styles.featureCard}>
              <div style={{ ...styles.featureIcon, background: feature.gradient }}>
                {feature.icon}
              </div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" style={styles.howSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>How it Works</span>
          <h2 style={styles.sectionTitle}>
            Get started in
            <br />
            <span style={styles.gradientText}>three simple steps</span>
          </h2>
        </div>

        <div style={styles.stepsGrid}>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>01</div>
            <h3 style={styles.stepTitle}>Create Your Organization</h3>
            <p style={styles.stepDesc}>
              Sign up in under 2 minutes. Add your locations, services, and team members.
            </p>
          </div>
          <div style={styles.stepConnector}>
            <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
              <path d="M0 12H55M55 12L45 2M55 12L45 22" stroke="url(#stepGrad)" strokeWidth="2"/>
              <defs>
                <linearGradient id="stepGrad" x1="0" y1="12" x2="60" y2="12">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#a855f7"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>02</div>
            <h3 style={styles.stepTitle}>Set Up Your Queues</h3>
            <p style={styles.stepDesc}>
              Configure queue types, time slots, and notification preferences for each service.
            </p>
          </div>
          <div style={styles.stepConnector}>
            <svg width="60" height="24" viewBox="0 0 60 24" fill="none">
              <path d="M0 12H55M55 12L45 2M55 12L45 22" stroke="url(#stepGrad2)" strokeWidth="2"/>
              <defs>
                <linearGradient id="stepGrad2" x1="0" y1="12" x2="60" y2="12">
                  <stop stopColor="#a855f7"/>
                  <stop offset="1" stopColor="#ec4899"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div style={styles.stepCard}>
            <div style={styles.stepNumber}>03</div>
            <h3 style={styles.stepTitle}>Start Serving</h3>
            <p style={styles.stepDesc}>
              Customers scan your QR code, join the queue, and get real-time updates.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" style={styles.testimonialsSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>Testimonials</span>
          <h2 style={styles.sectionTitle}>
            Loved by teams
            <br />
            <span style={styles.gradientText}>around the world</span>
          </h2>
        </div>

        <div style={styles.testimonialCard}>
          <div style={styles.testimonialQuote}>
            &ldquo;{testimonials[activeTestimonial].quote}&rdquo;
          </div>
          <div style={styles.testimonialAuthor}>
            <div style={styles.testimonialAvatar}>
              {testimonials[activeTestimonial].avatar}
            </div>
            <div>
              <strong style={styles.authorName}>{testimonials[activeTestimonial].author}</strong>
              <span style={styles.authorRole}>
                {testimonials[activeTestimonial].role}, {testimonials[activeTestimonial].company}
              </span>
            </div>
          </div>
          <div style={styles.testimonialDots}>
            {testimonials.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveTestimonial(i)}
                style={{
                  ...styles.testimonialDot,
                  ...(i === activeTestimonial ? styles.testimonialDotActive : {}),
                }}
              />
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaCard}>
          <h2 style={styles.ctaTitle}>
            Ready to transform your queue experience?
          </h2>
          <p style={styles.ctaSubtitle}>
            Join 500+ organizations already using QueueFlow.
            Start your free trial today — no credit card required.
          </p>
          <div style={styles.ctaButtons}>
            <Link href="/register" style={styles.ctaPrimary}>
              Get Started Free
            </Link>
            <Link href="/login" style={styles.ctaSecondary}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerBrand}>
            <Link href="/" style={styles.footerLogo}>
              <span style={styles.logoIcon}>🏥</span>
              <span style={styles.logoText}>QueueFlow</span>
            </Link>
            <p style={styles.footerDesc}>
              Modern queue management for modern businesses.
            </p>
          </div>

          <div style={styles.footerLinks}>
            <div style={styles.footerCol}>
              <h4 style={styles.footerColTitle}>Product</h4>
              <a href="#features" style={styles.footerLink}>Features</a>
              <a href="#pricing" style={styles.footerLink}>Pricing</a>
              <a href="#" style={styles.footerLink}>Integrations</a>
            </div>
            <div style={styles.footerCol}>
              <h4 style={styles.footerColTitle}>Company</h4>
              <a href="#" style={styles.footerLink}>About</a>
              <a href="#" style={styles.footerLink}>Blog</a>
              <a href="#" style={styles.footerLink}>Careers</a>
            </div>
            <div style={styles.footerCol}>
              <h4 style={styles.footerColTitle}>Support</h4>
              <a href="#" style={styles.footerLink}>Documentation</a>
              <a href="#" style={styles.footerLink}>Contact</a>
              <a href="#" style={styles.footerLink}>Status</a>
            </div>
          </div>
        </div>

        <div style={styles.footerBottom}>
          <p>© 2024 QueueFlow. All rights reserved.</p>
          <div style={styles.footerLegal}>
            <a href="#" style={styles.footerLink}>Privacy</a>
            <a href="#" style={styles.footerLink}>Terms</a>
          </div>
        </div>
      </footer>

      <style>{animations}</style>
    </div>
  );
}

// ============================================================================
// ANIMATIONS
// ============================================================================

const animations = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
  }
  @keyframes pulse {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.05); }
  }
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(20px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes gradientShift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
`;

// ============================================================================
// STYLES
// ============================================================================

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#0a0a0f',
    color: 'white',
    position: 'relative',
    overflow: 'hidden',
  },
  bgGradient: {
    position: 'fixed',
    inset: 0,
    background: 'radial-gradient(ellipse at 50% 0%, rgba(99, 102, 241, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 100% 50%, rgba(139, 92, 246, 0.1) 0%, transparent 50%), radial-gradient(ellipse at 0% 100%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)',
    zIndex: 0,
  },
  bgGrid: {
    position: 'fixed',
    inset: 0,
    backgroundImage: `linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)`,
    backgroundSize: '64px 64px',
    zIndex: 0,
  },
  glowOrb1: {
    position: 'fixed',
    top: '-10%',
    right: '20%',
    width: '600px',
    height: '600px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(99, 102, 241, 0.3) 0%, transparent 70%)',
    filter: 'blur(80px)',
    animation: 'pulse 8s ease-in-out infinite',
    zIndex: 0,
  },
  glowOrb2: {
    position: 'fixed',
    bottom: '10%',
    left: '-10%',
    width: '500px',
    height: '500px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(139, 92, 246, 0.25) 0%, transparent 70%)',
    filter: 'blur(80px)',
    animation: 'pulse 10s ease-in-out infinite reverse',
    zIndex: 0,
  },
  glowOrb3: {
    position: 'fixed',
    top: '50%',
    right: '-5%',
    width: '400px',
    height: '400px',
    borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%)',
    filter: 'blur(60px)',
    animation: 'float 12s ease-in-out infinite',
    zIndex: 0,
  },

  // Navigation
  nav: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '1.25rem 2rem',
    transition: 'all 0.3s ease',
  },
  navScrolled: {
    background: 'rgba(10, 10, 15, 0.9)',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    padding: '1rem 2rem',
  },
  navContent: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
  },
  logoIcon: {
    fontSize: '1.75rem',
  },
  logoText: {
    fontSize: '1.35rem',
    fontWeight: 700,
    color: 'white',
  },
  navLinks: {
    display: 'flex',
    gap: '2rem',
  },
  navLink: {
    color: 'rgba(255,255,255,0.7)',
    textDecoration: 'none',
    fontSize: '0.95rem',
    transition: 'color 0.2s',
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  loginBtn: {
    color: 'rgba(255,255,255,0.8)',
    textDecoration: 'none',
    fontSize: '0.95rem',
    fontWeight: 500,
    padding: '0.5rem 1rem',
  },
  ctaBtn: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    textDecoration: 'none',
    padding: '0.625rem 1.25rem',
    borderRadius: '10px',
    fontSize: '0.95rem',
    fontWeight: 600,
    boxShadow: '0 4px 15px rgba(99, 102, 241, 0.4)',
    transition: 'all 0.2s',
  },

  // Hero
  hero: {
    position: 'relative',
    zIndex: 1,
    minHeight: '100vh',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4rem',
    alignItems: 'center',
    padding: '8rem 4rem 4rem',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  heroContent: {
    maxWidth: '600px',
  },
  heroBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.5rem 1rem',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '50px',
    fontSize: '0.85rem',
    color: '#a5b4fc',
    marginBottom: '1.5rem',
  },
  badgeDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    animation: 'pulse 2s infinite',
  },
  heroTitle: {
    fontSize: '3.75rem',
    fontWeight: 800,
    lineHeight: 1.1,
    marginBottom: '1.5rem',
    color: 'white',
  },
  gradientText: {
    background: 'linear-gradient(135deg, #6366f1, #a855f7, #ec4899)',
    backgroundSize: '200% 200%',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    animation: 'gradientShift 5s ease infinite',
  },
  heroSubtitle: {
    fontSize: '1.2rem',
    lineHeight: 1.7,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '2.5rem',
  },
  heroCtas: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '3rem',
  },
  primaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 2rem',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '12px',
    fontSize: '1.05rem',
    fontWeight: 600,
    boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
    transition: 'all 0.2s',
  },
  secondaryCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '1rem 2rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '12px',
    fontSize: '1.05rem',
    fontWeight: 500,
    transition: 'all 0.2s',
  },
  heroTrust: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  trustLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
  },
  trustLogos: {
    display: 'flex',
    gap: '0.5rem',
  },
  trustLogo: {
    width: '40px',
    height: '40px',
    borderRadius: '10px',
    background: 'rgba(255,255,255,0.05)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
  },
  heroVisual: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockupContainer: {
    position: 'relative',
    width: '100%',
    maxWidth: '600px',
  },
  dashboardMockup: {
    background: 'rgba(15, 15, 25, 0.9)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.1)',
    overflow: 'hidden',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
  },
  mockupHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
    padding: '0.75rem 1rem',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
  },
  mockupDots: {
    display: 'flex',
    gap: '6px',
  },
  mockupDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  mockupTitle: {
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.5)',
  },
  mockupContent: {
    display: 'flex',
    minHeight: '300px',
  },
  mockupSidebar: {
    width: '140px',
    borderRight: '1px solid rgba(255,255,255,0.05)',
    padding: '1rem 0.5rem',
  },
  sidebarItem: {
    padding: '0.5rem 0.75rem',
    borderRadius: '8px',
    fontSize: '0.8rem',
    color: 'rgba(255,255,255,0.5)',
    marginBottom: '0.25rem',
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  sidebarItemActive: {
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
  },
  mockupMain: {
    flex: 1,
    padding: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  queueCard: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '10px',
    padding: '0.875rem',
    border: '1px solid rgba(255,255,255,0.05)',
  },
  queueHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '0.5rem',
    fontSize: '0.85rem',
    color: 'white',
  },
  queueBadge: {
    background: 'rgba(99, 102, 241, 0.2)',
    color: '#a5b4fc',
    padding: '0.2rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.7rem',
  },
  queueProgress: {
    height: '4px',
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginBottom: '0.5rem',
  },
  queueProgressBar: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #a855f7)',
    borderRadius: '2px',
  },
  queueStats: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.4)',
  },
  floatingTicket: {
    position: 'absolute',
    bottom: '-20px',
    left: '-40px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    borderRadius: '12px',
    padding: '1rem 1.25rem',
    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
    animation: 'float 4s ease-in-out infinite',
  },
  ticketHeader: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '0.25rem',
  },
  ticketNumber: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: 'white',
    fontFamily: 'monospace',
  },
  ticketInfo: {
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.7)',
  },
  floatingNotification: {
    position: 'absolute',
    top: '20%',
    right: '-30px',
    background: 'rgba(15, 15, 25, 0.95)',
    borderRadius: '12px',
    padding: '0.875rem 1rem',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    animation: 'float 5s ease-in-out infinite reverse',
  },
  notifIcon: {
    fontSize: '1.5rem',
  },
  notifText: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    margin: '0.125rem 0 0',
  },

  // Stats
  statsSection: {
    position: 'relative',
    zIndex: 1,
    padding: '4rem 2rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    borderBottom: '1px solid rgba(255,255,255,0.05)',
    background: 'rgba(255,255,255,0.01)',
  },
  statsGrid: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '2rem',
  },
  statCard: {
    textAlign: 'center',
  },
  statValue: {
    fontSize: '2.5rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '0.5rem',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.95rem',
  },

  // Features
  featuresSection: {
    position: 'relative',
    zIndex: 1,
    padding: '6rem 2rem',
  },
  sectionHeader: {
    textAlign: 'center',
    maxWidth: '600px',
    margin: '0 auto 4rem',
  },
  sectionBadge: {
    display: 'inline-block',
    padding: '0.375rem 1rem',
    background: 'rgba(99, 102, 241, 0.1)',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    borderRadius: '50px',
    fontSize: '0.85rem',
    color: '#a5b4fc',
    marginBottom: '1.25rem',
  },
  sectionTitle: {
    fontSize: '2.5rem',
    fontWeight: 800,
    lineHeight: 1.2,
    color: 'white',
    marginBottom: '1rem',
  },
  sectionSubtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  featureCard: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '2rem',
    transition: 'all 0.3s ease',
  },
  featureIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.5rem',
    marginBottom: '1.25rem',
  },
  featureTitle: {
    fontSize: '1.2rem',
    fontWeight: 600,
    color: 'white',
    marginBottom: '0.75rem',
  },
  featureDesc: {
    fontSize: '0.95rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    margin: 0,
  },

  // How it Works
  howSection: {
    position: 'relative',
    zIndex: 1,
    padding: '6rem 2rem',
    background: 'rgba(255,255,255,0.01)',
  },
  stepsGrid: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    maxWidth: '1200px',
    margin: '0 auto',
    flexWrap: 'wrap',
  },
  stepCard: {
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '2rem',
    width: '280px',
    textAlign: 'center',
  },
  stepNumber: {
    fontSize: '3rem',
    fontWeight: 800,
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    marginBottom: '1rem',
  },
  stepTitle: {
    fontSize: '1.15rem',
    fontWeight: 600,
    color: 'white',
    marginBottom: '0.75rem',
  },
  stepDesc: {
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    margin: 0,
  },
  stepConnector: {
    color: 'rgba(255,255,255,0.2)',
  },

  // Testimonials
  testimonialsSection: {
    position: 'relative',
    zIndex: 1,
    padding: '6rem 2rem',
  },
  testimonialCard: {
    maxWidth: '700px',
    margin: '0 auto',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '24px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '3rem',
    textAlign: 'center',
  },
  testimonialQuote: {
    fontSize: '1.35rem',
    lineHeight: 1.6,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '2rem',
    fontStyle: 'italic',
  },
  testimonialAuthor: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  testimonialAvatar: {
    width: '50px',
    height: '50px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontWeight: 600,
  },
  authorName: {
    display: 'block',
    color: 'white',
  },
  authorRole: {
    display: 'block',
    fontSize: '0.9rem',
    color: 'rgba(255,255,255,0.5)',
  },
  testimonialDots: {
    display: 'flex',
    justifyContent: 'center',
    gap: '0.5rem',
  },
  testimonialDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'rgba(255,255,255,0.2)',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    transition: 'all 0.2s',
  },
  testimonialDotActive: {
    background: '#6366f1',
    width: '24px',
    borderRadius: '4px',
  },

  // CTA
  ctaSection: {
    position: 'relative',
    zIndex: 1,
    padding: '6rem 2rem',
  },
  ctaCard: {
    maxWidth: '800px',
    margin: '0 auto',
    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)',
    borderRadius: '24px',
    border: '1px solid rgba(99, 102, 241, 0.2)',
    padding: '4rem',
    textAlign: 'center',
  },
  ctaTitle: {
    fontSize: '2.25rem',
    fontWeight: 800,
    color: 'white',
    marginBottom: '1rem',
  },
  ctaSubtitle: {
    fontSize: '1.1rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '2rem',
    lineHeight: 1.6,
  },
  ctaButtons: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  ctaPrimary: {
    padding: '1rem 2.5rem',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '12px',
    fontSize: '1.05rem',
    fontWeight: 600,
    boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
  },
  ctaSecondary: {
    padding: '1rem 2.5rem',
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: 'white',
    textDecoration: 'none',
    borderRadius: '12px',
    fontSize: '1.05rem',
    fontWeight: 500,
  },

  // Footer
  footer: {
    position: 'relative',
    zIndex: 1,
    borderTop: '1px solid rgba(255,255,255,0.05)',
    padding: '4rem 2rem 2rem',
  },
  footerContent: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '3rem',
  },
  footerBrand: {
    maxWidth: '280px',
  },
  footerLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    marginBottom: '1rem',
  },
  footerDesc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '0.9rem',
    lineHeight: 1.6,
    margin: 0,
  },
  footerLinks: {
    display: 'flex',
    gap: '4rem',
  },
  footerCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  footerColTitle: {
    color: 'white',
    fontWeight: 600,
    marginBottom: '0.5rem',
  },
  footerLink: {
    color: 'rgba(255,255,255,0.5)',
    textDecoration: 'none',
    fontSize: '0.9rem',
    transition: 'color 0.2s',
  },
  footerBottom: {
    maxWidth: '1200px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: '2rem',
    borderTop: '1px solid rgba(255,255,255,0.05)',
    fontSize: '0.85rem',
    color: 'rgba(255,255,255,0.4)',
  },
  footerLegal: {
    display: 'flex',
    gap: '1.5rem',
  },
};

// ============================================================================
// MAIN EXPORT
// ============================================================================

export default function Home() {
  const { isAuthenticated, loading } = useAuthContext();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0a0a0f',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  // If authenticated, show dashboard
  if (isAuthenticated) {
    return <DashboardPage />;
  }

  // Otherwise show landing page
  return <LandingPage />;
}
