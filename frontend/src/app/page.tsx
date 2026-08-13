'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Zap,
  QrCode,
  Monitor,
  MapPin,
  BarChart3,
  Shield,
  ArrowRight,
  Bell,
  Ticket,
  Users,
  TrendingUp,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import DashboardPage from '@/components/pages/DashboardPage';
import { Button, Icon } from '@/components/ui';

// ============================================================================
// SAAS LANDING PAGE
// ============================================================================

function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Zap,
      title: 'Real-time Updates',
      description: 'Live position and wait-time updates powered by WebSockets — no page refresh needed.',
    },
    {
      icon: QrCode,
      title: 'QR Code Check-in',
      description: 'Scan and join a queue in seconds, right from a browser. No app to install.',
    },
    {
      icon: Monitor,
      title: 'Live Display Boards',
      description: 'Purpose-built TV displays show queue status and who’s being served, in real time.',
    },
    {
      icon: MapPin,
      title: 'Multi-location',
      description: 'Manage every branch and location from a single dashboard.',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Track wait times, peak hours, and throughput to plan staffing.',
    },
    {
      icon: Shield,
      title: 'Workspace Isolation',
      description: 'Every organization gets its own subdomain and role-scoped access — your data stays yours.',
    },
  ];

  const steps = [
    { num: '01', title: 'Create a location', desc: 'Set up your first location in minutes.' },
    { num: '02', title: 'Configure services', desc: 'Define the services and service points customers can queue for.' },
    { num: '03', title: 'Share a join link or QR code', desc: 'Customers join from any browser — no app required.' },
    { num: '04', title: 'Manage the queue live', desc: 'Call the next customer, track wait times, keep everyone informed.' },
  ];

  return (
    <div style={styles.page}>
      {/* Background Elements */}
      <div style={styles.bgGradient} />
      <div style={styles.bgGrid} />
      <div style={styles.glowOrb1} />
      <div style={styles.glowOrb2} />

      {/* Navigation */}
      <nav style={{
        ...styles.nav,
        ...(isScrolled ? styles.navScrolled : {}),
      }}>
        <div style={styles.navContent}>
          <Link href="/" style={styles.logo}>
            <Icon icon={Building2} size={26} color="#2dd4bf" />
            <span style={styles.logoText}>QueueFlow</span>
          </Link>

          <div style={styles.navLinks}>
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#how-it-works" style={styles.navLink}>How it Works</a>
          </div>

          <div style={styles.navActions}>
            <Link href="/login" style={styles.loginBtn}>
              Sign In
            </Link>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">Get Started Free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section style={styles.hero}>
        <div style={styles.heroContent}>
          <div style={styles.heroBadge}>
            <span style={styles.badgeDot} />
            <span>A subdomain workspace for every organization</span>
          </div>

          <h1 style={styles.heroTitle}>
            Transform Your
            <br />
            <span style={styles.accentText}>Queue Experience</span>
          </h1>

          <p style={styles.heroSubtitle}>
            The modern queue management system that reduces wait times,
            improves customer satisfaction, and gives you real-time insights
            into your operations.
          </p>

          <div style={styles.heroCtas}>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">
                <span>Start Free</span>
                <Icon icon={ArrowRight} size={18} />
              </Button>
            </Link>
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
                  <div style={styles.sidebarItem}><Icon icon={BarChart3} size={14} /> Overview</div>
                  <div style={{ ...styles.sidebarItem, ...styles.sidebarItemActive }}><Icon icon={Users} size={14} /> Queues</div>
                  <div style={styles.sidebarItem}><Icon icon={MapPin} size={14} /> Locations</div>
                  <div style={styles.sidebarItem}><Icon icon={TrendingUp} size={14} /> Analytics</div>
                </div>
                <div style={styles.mockupMain}>
                  <div style={styles.queueCard}>
                    <div style={styles.queueHeader}>
                      <span style={styles.queueHeaderLabel}><Icon icon={Stethoscope} size={14} /> General Consultation</span>
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
                      <span style={styles.queueHeaderLabel}><Icon icon={Syringe} size={14} /> Vaccination</span>
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
              <div style={styles.ticketHeader}><Icon icon={Ticket} size={13} color="rgba(255,255,255,0.8)" /> Your Ticket</div>
              <div style={styles.ticketNumber}>A-024</div>
              <div style={styles.ticketInfo}>Position: #3 &bull; ~8 min</div>
            </div>

            {/* Floating notification */}
            <div style={styles.floatingNotification}>
              <Icon icon={Bell} size={22} color="#2dd4bf" />
              <div>
                <strong>You&apos;re next!</strong>
                <p style={styles.notifText}>Please proceed to Counter 2</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" style={styles.featuresSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>Features</span>
          <h2 style={styles.sectionTitle}>
            Everything you need to
            <br />
            <span style={styles.accentText}>manage queues effectively</span>
          </h2>
          <p style={styles.sectionSubtitle}>
            From simple check-ins to multi-location operations, QueueFlow has you covered.
          </p>
        </div>

        <div style={styles.featuresGrid}>
          {features.map((feature, i) => (
            <div key={i} style={styles.featureCard}>
              <div style={styles.featureIcon}>
                <Icon icon={feature.icon} size={24} color="#2dd4bf" />
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
            <span style={styles.accentText}>four simple steps</span>
          </h2>
        </div>

        <div style={styles.stepsGrid}>
          {steps.map((step) => (
            <div key={step.num} style={styles.stepCard}>
              <div style={styles.stepNumber}>{step.num}</div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section style={styles.ctaSection}>
        <div style={styles.ctaCard}>
          <h2 style={styles.ctaTitle}>
            Ready to get started?
          </h2>
          <p style={styles.ctaSubtitle}>
            Create your workspace in minutes &mdash; no credit card required.
          </p>
          <div style={styles.ctaButtons}>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">Get Started Free</Button>
            </Link>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <Button variant="secondary" size="lg">Sign In</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerBrand}>
            <Link href="/" style={styles.footerLogo}>
              <Icon icon={Building2} size={22} color="#2dd4bf" />
              <span style={styles.logoText}>QueueFlow</span>
            </Link>
            <p style={styles.footerDesc}>
              Modern queue management for modern businesses.
            </p>
          </div>

          <div style={styles.footerLinks}>
            <a href="#features" style={styles.footerLink}>Features</a>
            <a href="#how-it-works" style={styles.footerLink}>How it Works</a>
            <Link href="/join" style={styles.footerLink}>Public join pages</Link>
            <Link href="/login" style={styles.footerLink}>Sign in</Link>
          </div>
        </div>

        <div style={styles.footerBottom}>
          <p>&copy; 2026 QueueFlow. All rights reserved.</p>
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
    background: 'radial-gradient(ellipse at 50% 0%, rgba(20, 184, 166, 0.15) 0%, transparent 60%), radial-gradient(ellipse at 100% 50%, rgba(13, 148, 136, 0.1) 0%, transparent 50%)',
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
    background: 'radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, transparent 70%)',
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
    background: 'radial-gradient(circle, rgba(13, 148, 136, 0.25) 0%, transparent 70%)',
    filter: 'blur(80px)',
    animation: 'pulse 10s ease-in-out infinite reverse',
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
    background: 'rgba(20, 184, 166, 0.1)',
    border: '1px solid rgba(20, 184, 166, 0.2)',
    borderRadius: '50px',
    fontSize: '0.85rem',
    color: '#5eead4',
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
  accentText: {
    color: '#2dd4bf',
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
    background: 'rgba(20, 184, 166, 0.2)',
    color: '#5eead4',
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
  queueHeaderLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
  },
  queueBadge: {
    background: 'rgba(20, 184, 166, 0.2)',
    color: '#5eead4',
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
    background: '#14b8a6',
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
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
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
    border: '1px solid rgba(20, 184, 166, 0.3)',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    animation: 'float 5s ease-in-out infinite reverse',
  },
  notifText: {
    fontSize: '0.75rem',
    color: 'rgba(255,255,255,0.6)',
    margin: '0.125rem 0 0',
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
    background: 'rgba(20, 184, 166, 0.1)',
    border: '1px solid rgba(20, 184, 166, 0.2)',
    borderRadius: '50px',
    fontSize: '0.85rem',
    color: '#5eead4',
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
    marginBottom: '1.25rem',
    background: 'rgba(20, 184, 166, 0.1)',
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
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: '1.5rem',
    maxWidth: '1200px',
    margin: '0 auto',
    flexWrap: 'wrap',
  },
  stepCard: {
    position: 'relative',
    background: 'rgba(255,255,255,0.03)',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.05)',
    padding: '2rem',
    width: '250px',
    textAlign: 'center',
  },
  stepNumber: {
    fontSize: '2rem',
    fontWeight: 800,
    color: '#2dd4bf',
    marginBottom: '1rem',
  },
  stepTitle: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: 'white',
    marginBottom: '0.75rem',
  },
  stepDesc: {
    fontSize: '0.88rem',
    color: 'rgba(255,255,255,0.5)',
    lineHeight: 1.6,
    margin: 0,
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
    background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.2) 0%, rgba(13, 148, 136, 0.1) 100%)',
    borderRadius: '24px',
    border: '1px solid rgba(20, 184, 166, 0.2)',
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
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '2rem',
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
    gap: '2rem',
    flexWrap: 'wrap',
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
