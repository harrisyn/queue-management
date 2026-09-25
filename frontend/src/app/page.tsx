'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  Zap,
  QrCode,
  Monitor,
  BarChart3,
  ArrowRight,
  Stethoscope,
  Landmark,
  ShoppingBag,
  GraduationCap,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import DashboardPage from '@/components/pages/DashboardPage';
import { Button, Icon } from '@/components/ui';
import { APP_NAME } from '@/lib/appConfig';

// ============================================================================
// REVEAL-ON-SCROLL HOOK
// ============================================================================

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -5% 0px' }
    );
    observer.observe(node);

    // Safety net: a section that never crosses the intersection threshold
    // (e.g. a renderer that paints the full page at once, no incremental
    // scroll) must not stay invisible forever — content correctness beats
    // the reveal flourish.
    const fallback = window.setTimeout(() => setVisible(true), 1200);

    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, []);

  return { ref, visible };
}

// ============================================================================
// SPLIT-FLAP TICKET DISPLAY (the hero's signature element)
// ============================================================================

function SplitFlap({ value, delay = 0 }: { value: string; delay?: number }) {
  const chars = value.split('');
  return (
    <div style={flapStyles.row}>
      {chars.map((char, i) => (
        <span
          key={i}
          style={{
            ...flapStyles.char,
            ...(char === '-' || char === ' ' ? flapStyles.charDivider : {}),
            animationDelay: `${delay + i * 90}ms`,
          }}
          className="qfl-flap-char"
        >
          {char}
        </span>
      ))}
    </div>
  );
}

// ============================================================================
// LANDING PAGE
// ============================================================================

function LandingPage() {
  const [isScrolled, setIsScrolled] = useState(false);
  const featuresReveal = useReveal<HTMLDivElement>();
  const stepsReveal = useReveal<HTMLDivElement>();
  const ctaReveal = useReveal<HTMLDivElement>();

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 24);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const features = [
    {
      icon: Zap,
      title: 'Live position, not a guess',
      description: 'Every customer sees exactly where they stand in line, updating in real time — no refreshing, no wondering.',
    },
    {
      icon: QrCode,
      title: 'Join with a scan',
      description: 'One QR code at the door. Customers join from their own phone in seconds — nothing to download.',
    },
    {
      icon: Monitor,
      title: 'A screen that calls the room',
      description: 'Put a display at the counter. It announces who’s being served, automatically, so no one has to shout a number.',
    },
    {
      icon: BarChart3,
      title: 'Numbers your team can act on',
      description: 'Wait times, peak hours, throughput by location — enough signal to staff the next shift correctly.',
    },
  ];

  const steps = [
    { num: '01', title: 'Set up a location', desc: 'Add your first branch and you’re ready to configure it.' },
    { num: '02', title: 'Define your services', desc: `Tell ${APP_NAME} what people are waiting for, and where.` },
    { num: '03', title: 'Share the join link', desc: 'A QR code or URL — customers join from any browser.' },
    { num: '04', title: 'Run the queue live', desc: 'Call the next customer, watch wait times drop.' },
  ];

  const industries = [
    { icon: Stethoscope, label: 'Clinics & hospitals' },
    { icon: Landmark, label: 'Government offices' },
    { icon: ShoppingBag, label: 'Retail & banking' },
    { icon: GraduationCap, label: 'Schools & campuses' },
  ];

  return (
    <div style={styles.page}>
      {/* Navigation */}
      <nav style={{ ...styles.nav, ...(isScrolled ? styles.navScrolled : {}) }} className="qfl-nav">
        <div style={styles.navContent}>
          <Link href="/" style={styles.logo}>
            <div style={styles.logoMark}>
              <Icon icon={Building2} size={18} color="#ffffff" />
            </div>
            <span style={styles.logoText}>{APP_NAME}</span>
          </Link>

          <div className="qfl-nav-links">
            <a href="#features" style={styles.navLink}>Features</a>
            <a href="#how-it-works" style={styles.navLink}>How it works</a>
          </div>

          <div style={styles.navActions} className="qfl-nav-actions">
            <Link href="/login" style={styles.loginBtn}>Sign in</Link>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="md">Get started free</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section style={styles.hero} className="qfl-hero">
        <div style={styles.heroContent}>
          <span style={styles.eyebrow}>QUEUE MANAGEMENT, MADE VISIBLE</span>

          <h1 style={styles.heroTitle}>
            Turn any line
            <br />
            into a number
            <br />
            <span style={styles.heroTitleMuted}>people can watch.</span>
          </h1>

          <p style={styles.heroSubtitle}>
            {APP_NAME} replaces the waiting room with a live queue your customers
            can follow from their phone — real position, real wait time, one QR
            code to join.
          </p>

          <div style={styles.heroCtas}>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">
                <span>Start free</span>
                <Icon icon={ArrowRight} size={18} />
              </Button>
            </Link>
            <a href="#how-it-works" style={styles.heroSecondaryLink}>See how it works</a>
          </div>
        </div>

        <div style={styles.heroVisual}>
          <div style={styles.board}>
            <div style={styles.boardLabel}>
              <span style={styles.boardLabelDot} />
              NOW SERVING
            </div>
            <SplitFlap value="A-024" delay={150} />
            <div style={styles.boardStats}>
              <span>12 waiting</span>
              <span style={styles.boardStatsDivider}>&bull;</span>
              <span>avg. wait 8 min</span>
            </div>
          </div>
          <p style={styles.heroVisualCaption}>Live on every screen the moment it changes.</p>
        </div>
      </section>

      {/* Industries strip */}
      <section style={styles.industries}>
        <p style={styles.industriesLabel}>Built for anywhere people wait</p>
        <div style={styles.industriesRow}>
          {industries.map((ind) => (
            <div key={ind.label} style={styles.industryItem}>
              <Icon icon={ind.icon} size={18} color="#5B6472" />
              <span>{ind.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={styles.featuresSection}>
        <div
          ref={featuresReveal.ref}
          style={{
            ...styles.sectionHeader,
            opacity: featuresReveal.visible ? 1 : 0,
            transform: featuresReveal.visible ? 'translateY(0)' : 'translateY(16px)',
          }}
          className="qfl-transition"
        >
          <span style={styles.sectionBadge}>Features</span>
          <h2 style={styles.sectionTitle}>Everything a queue actually needs</h2>
          <p style={styles.sectionSubtitle}>
            No bloat, no busywork — just the parts that make a line shorter and calmer.
          </p>
        </div>

        <div
          style={{
            ...styles.featuresGrid,
            opacity: featuresReveal.visible ? 1 : 0,
            transform: featuresReveal.visible ? 'translateY(0)' : 'translateY(16px)',
          }}
          className="qfl-transition qfl-features-grid"
        >
          {features.map((feature) => (
            <div key={feature.title} style={styles.featureCard} className="qfl-feature-card">
              <div style={styles.featureIcon}>
                <Icon icon={feature.icon} size={22} color="#0d9488" />
              </div>
              <h3 style={styles.featureTitle}>{feature.title}</h3>
              <p style={styles.featureDesc}>{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" style={styles.howSection}>
        <div style={styles.sectionHeader}>
          <span style={styles.sectionBadge}>How it works</span>
          <h2 style={styles.sectionTitle}>Four steps, then you&apos;re live</h2>
        </div>

        <div
          ref={stepsReveal.ref}
          style={{
            ...styles.stepsRow,
            opacity: stepsReveal.visible ? 1 : 0,
            transform: stepsReveal.visible ? 'translateY(0)' : 'translateY(16px)',
          }}
          className="qfl-transition qfl-steps-row"
        >
          {steps.map((step, i) => (
            <div key={step.num} style={styles.stepItem} className="qfl-step-item">
              <div style={styles.stepNumberRow}>
                <span style={styles.stepNumber}>{step.num}</span>
                {i < steps.length - 1 && <span style={styles.stepLine} className="qfl-step-line" />}
              </div>
              <h3 style={styles.stepTitle}>{step.title}</h3>
              <p style={styles.stepDesc}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={styles.ctaSection}>
        <div
          ref={ctaReveal.ref}
          style={{
            ...styles.ctaCard,
            opacity: ctaReveal.visible ? 1 : 0,
            transform: ctaReveal.visible ? 'translateY(0)' : 'translateY(16px)',
          }}
          className="qfl-transition"
        >
          <div style={styles.ctaFlap}>
            <SplitFlap value="00" />
          </div>
          <h2 style={styles.ctaTitle}>Ready when you are.</h2>
          <p style={styles.ctaSubtitle}>
            Create your workspace in minutes &mdash; no credit card required.
          </p>
          <div style={styles.ctaButtons}>
            <Link href="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" size="lg">Get started free</Button>
            </Link>
            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button style={styles.ctaGhostBtn}>Sign in</button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
          <div style={styles.footerBrand}>
            <Link href="/" style={styles.footerLogo}>
              <div style={styles.logoMarkSmall}>
                <Icon icon={Building2} size={15} color="#ffffff" />
              </div>
              <span style={styles.footerLogoText}>{APP_NAME}</span>
            </Link>
            <p style={styles.footerDesc}>Queue management for places where people wait.</p>
          </div>

          <div style={styles.footerLinks}>
            <a href="#features" style={styles.footerLink}>Features</a>
            <a href="#how-it-works" style={styles.footerLink}>How it works</a>
            <Link href="/join" style={styles.footerLink}>Public join pages</Link>
            <Link href="/login" style={styles.footerLink}>Sign in</Link>
          </div>
        </div>

        <div style={styles.footerBottom}>
          <p>&copy; 2026 {APP_NAME}. All rights reserved.</p>
        </div>
      </footer>

      <style>{landingStyles}</style>
    </div>
  );
}

// ============================================================================
// STYLES — tokens
// ============================================================================

const palette = {
  bg: '#FAFAF8',
  surface: '#FFFFFF',
  ink: '#0B0F14',
  inkMuted: '#5B6472',
  inkFaint: '#8A93A0',
  border: '#E7E5E1',
  teal: '#0d9488',
  tealSoft: '#EAF6F4',
  board: '#10131A',
  boardChar: '#161B24',
  amber: '#f59e0b',
};

const flapStyles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    gap: '0.4rem',
  },
  char: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2.75rem',
    height: '3.75rem',
    background: palette.boardChar,
    borderRadius: '8px',
    fontFamily: 'var(--font-mono)',
    fontSize: '2.25rem',
    fontWeight: 700,
    color: '#F5F7F5',
    position: 'relative',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.4)',
  },
  charDivider: {
    background: 'transparent',
    boxShadow: 'none',
    width: '1.25rem',
    color: palette.inkFaint,
  },
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: palette.bg,
    color: palette.ink,
  },

  // Nav
  nav: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    padding: '1.5rem 2rem',
    transition: 'all 250ms ease',
  },
  navScrolled: {
    background: 'rgba(250, 250, 248, 0.85)',
    backdropFilter: 'blur(16px)',
    borderBottom: `1px solid ${palette.border}`,
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
    gap: '0.6rem',
    textDecoration: 'none',
  },
  logoMark: {
    width: '30px',
    height: '30px',
    borderRadius: '8px',
    background: palette.teal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: '1.15rem',
    fontWeight: 700,
    letterSpacing: '-0.01em',
    color: palette.ink,
  },
  navLink: {
    color: palette.inkMuted,
    textDecoration: 'none',
    fontSize: '0.925rem',
    fontWeight: 500,
  },
  navActions: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.25rem',
  },
  loginBtn: {
    color: palette.ink,
    textDecoration: 'none',
    fontSize: '0.925rem',
    fontWeight: 600,
  },

  // Hero
  hero: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 0.9fr',
    gap: '3rem',
    alignItems: 'center',
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '9.5rem 2rem 7rem',
  },
  heroContent: {
    maxWidth: '620px',
  },
  eyebrow: {
    display: 'inline-block',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: palette.teal,
    marginBottom: '1.5rem',
  },
  heroTitle: {
    fontSize: 'clamp(2.75rem, 5.2vw, 4.5rem)',
    fontWeight: 700,
    lineHeight: 1.05,
    letterSpacing: '-0.02em',
    color: palette.ink,
    marginBottom: '1.75rem',
  },
  heroTitleMuted: {
    color: palette.inkFaint,
  },
  heroSubtitle: {
    fontSize: '1.2rem',
    lineHeight: 1.65,
    color: palette.inkMuted,
    marginBottom: '2.5rem',
    maxWidth: '520px',
  },
  heroCtas: {
    display: 'flex',
    alignItems: 'center',
    gap: '1.75rem',
  },
  heroSecondaryLink: {
    fontSize: '0.95rem',
    fontWeight: 600,
    color: palette.ink,
    textDecoration: 'underline',
    textUnderlineOffset: '3px',
    textDecorationColor: palette.border,
  },
  heroVisual: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1rem',
  },
  board: {
    background: palette.board,
    borderRadius: '20px',
    padding: '2rem 2.25rem',
    boxShadow: '0 30px 60px -20px rgba(11, 15, 20, 0.35)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.25rem',
    width: '100%',
    maxWidth: '360px',
  },
  boardLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.12em',
    color: palette.amber,
  },
  boardLabelDot: {
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    background: palette.amber,
  },
  boardStats: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.8rem',
    color: 'rgba(245, 247, 245, 0.55)',
  },
  boardStatsDivider: {
    opacity: 0.5,
  },
  heroVisualCaption: {
    fontSize: '0.85rem',
    color: palette.inkFaint,
  },

  // Industries strip
  industries: {
    maxWidth: '1280px',
    margin: '0 auto',
    padding: '0 2rem 6rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '1.5rem',
  },
  industriesLabel: {
    fontSize: '0.85rem',
    color: palette.inkFaint,
    fontWeight: 500,
  },
  industriesRow: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '2.5rem',
  },
  industryItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.9rem',
    color: palette.inkMuted,
    fontWeight: 500,
  },

  // Features
  featuresSection: {
    padding: '2rem 2rem 7rem',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  sectionHeader: {
    textAlign: 'center',
    maxWidth: '580px',
    margin: '0 auto 3.5rem',
  },
  sectionBadge: {
    display: 'inline-block',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.75rem',
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: palette.teal,
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
    fontWeight: 700,
    letterSpacing: '-0.015em',
    lineHeight: 1.2,
    color: palette.ink,
    marginBottom: '0.75rem',
  },
  sectionSubtitle: {
    fontSize: '1.05rem',
    color: palette.inkMuted,
    lineHeight: 1.6,
  },
  featuresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1.25rem',
  },
  featureCard: {
    background: palette.surface,
    borderRadius: '16px',
    border: `1px solid ${palette.border}`,
    padding: '1.75rem',
  },
  featureIcon: {
    width: '44px',
    height: '44px',
    borderRadius: '11px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1.25rem',
    background: palette.tealSoft,
  },
  featureTitle: {
    fontSize: '1.05rem',
    fontWeight: 600,
    color: palette.ink,
    marginBottom: '0.5rem',
    letterSpacing: '-0.005em',
  },
  featureDesc: {
    fontSize: '0.9rem',
    color: palette.inkMuted,
    lineHeight: 1.6,
    margin: 0,
  },

  // How it works
  howSection: {
    padding: '2rem 2rem 7rem',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  stepsRow: {
    display: 'flex',
    gap: '0',
    maxWidth: '1100px',
    margin: '0 auto',
  },
  stepItem: {
    flex: 1,
    paddingRight: '1.5rem',
  },
  stepNumberRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  },
  stepNumber: {
    fontFamily: 'var(--font-mono)',
    fontSize: '0.9rem',
    fontWeight: 700,
    color: palette.teal,
    background: palette.tealSoft,
    borderRadius: '8px',
    padding: '0.35rem 0.6rem',
    flexShrink: 0,
  },
  stepLine: {
    height: '1px',
    background: palette.border,
    flex: 1,
  },
  stepTitle: {
    fontSize: '1rem',
    fontWeight: 600,
    color: palette.ink,
    marginBottom: '0.5rem',
  },
  stepDesc: {
    fontSize: '0.875rem',
    color: palette.inkMuted,
    lineHeight: 1.6,
    margin: 0,
  },

  // CTA
  ctaSection: {
    padding: '0 2rem 7rem',
    maxWidth: '1280px',
    margin: '0 auto',
  },
  ctaCard: {
    maxWidth: '860px',
    margin: '0 auto',
    background: palette.board,
    borderRadius: '28px',
    padding: '4rem 3rem',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaFlap: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '2rem',
    opacity: 0.5,
    transform: 'scale(0.6)',
  },
  ctaTitle: {
    fontSize: 'clamp(2rem, 3.5vw, 2.5rem)',
    fontWeight: 700,
    letterSpacing: '-0.015em',
    color: '#ffffff',
    marginBottom: '0.75rem',
  },
  ctaSubtitle: {
    fontSize: '1.05rem',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: '2.25rem',
    lineHeight: 1.6,
  },
  ctaButtons: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  ctaGhostBtn: {
    padding: '0.75rem 1.5rem',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.2)',
    background: 'transparent',
    color: '#ffffff',
    fontSize: '1rem',
    fontWeight: 600,
  },

  // Footer
  footer: {
    borderTop: `1px solid ${palette.border}`,
    padding: '3.5rem 2rem 2rem',
  },
  footerContent: {
    maxWidth: '1280px',
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: '2rem',
    marginBottom: '2.5rem',
  },
  footerBrand: {
    maxWidth: '280px',
  },
  footerLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
    marginBottom: '0.75rem',
  },
  logoMarkSmall: {
    width: '24px',
    height: '24px',
    borderRadius: '6px',
    background: palette.teal,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLogoText: {
    fontSize: '1rem',
    fontWeight: 700,
    color: palette.ink,
  },
  footerDesc: {
    color: palette.inkMuted,
    fontSize: '0.875rem',
    lineHeight: 1.6,
    margin: 0,
  },
  footerLinks: {
    display: 'flex',
    gap: '2rem',
    flexWrap: 'wrap',
  },
  footerLink: {
    color: palette.inkMuted,
    textDecoration: 'none',
    fontSize: '0.875rem',
    fontWeight: 500,
  },
  footerBottom: {
    maxWidth: '1280px',
    margin: '0 auto',
    paddingTop: '1.5rem',
    borderTop: `1px solid ${palette.border}`,
    fontSize: '0.8rem',
    color: palette.inkFaint,
  },
};

// ============================================================================
// SCOPED CSS — flap animation, hover, responsive
// ============================================================================

const landingStyles = `
  @keyframes qfl-flap-in {
    from { transform: rotateX(-100deg); opacity: 0.15; }
    to { transform: rotateX(0deg); opacity: 1; }
  }
  .qfl-flap-char {
    animation: qfl-flap-in 520ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
    transform-style: preserve-3d;
  }
  .qfl-transition {
    transition: opacity 550ms ease, transform 550ms ease;
  }
  .qfl-feature-card {
    transition: border-color 200ms ease, transform 200ms ease;
  }
  .qfl-feature-card:hover {
    border-color: #0d9488;
    transform: translateY(-2px);
  }
  a:hover.qfl-nolink {}
  .qfl-nav-links a:hover,
  .qfl-footer-link:hover {
    color: #0B0F14;
  }

  .qfl-nav-links {
    display: flex;
    gap: 2rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .qfl-flap-char { animation: none; opacity: 1; transform: none; }
    .qfl-transition { transition: none; }
  }

  @media (max-width: 900px) {
    .qfl-nav-links { display: none; }
  }

  @media (max-width: 480px) {
    .qfl-nav { padding: 1rem 1.25rem !important; }
    .qfl-nav-actions { gap: 0.6rem !important; }
    .qfl-nav-actions .btn { padding: 0.6rem 0.9rem !important; font-size: 0.85rem !important; }
  }

  @media (max-width: 860px) {
    .qfl-hero {
      grid-template-columns: 1fr !important;
      padding-top: 7.5rem !important;
      text-align: center;
    }
    .qfl-hero > div:first-child {
      max-width: 100% !important;
      margin: 0 auto;
    }
  }

  @media (max-width: 760px) {
    .qfl-features-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .qfl-steps-row { flex-direction: column !important; gap: 2rem !important; }
    .qfl-step-line { display: none; }
  }

  @media (max-width: 480px) {
    .qfl-features-grid { grid-template-columns: 1fr !important; }
  }
`;

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
        background: '#FAFAF8',
      }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (isAuthenticated) {
    return <DashboardPage />;
  }

  return <LandingPage />;
}
