'use client';

import React, { useEffect, useState, useRef } from 'react';
import { QrCode, Lightbulb } from 'lucide-react';
import api from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Icon } from '@/components/ui';

interface Location {
  id: string;
  name: string;
  publicCode?: string;
}

export default function AdminQRPage() {
  const { user, isAdmin } = useAuthContext();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrSize, setQrSize] = useState(256);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isAdmin) {
      loadLocations();
    } else {
      setLoading(false);
    }
  }, [isAdmin, user]);

  const loadLocations = async () => {
    // No organization on this account (e.g. a superadmin). Never guess an
    // org - render the empty state instead of leaking another tenant's data.
    const orgId = user?.organizationId;
    if (!orgId) {
      setLocations([]);
      setLoading(false);
      return;
    }
    try {
      const locs = await api.getLocations(orgId);
      setLocations(locs.filter((l: Location) => l.publicCode));
      if (locs.length > 0 && locs[0].publicCode) {
        setSelectedLocation(locs.find((l: Location) => l.publicCode) || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedLocation?.publicCode) {
      generateQR();
    }
  }, [selectedLocation, qrSize]);

  const generateQR = async () => {
    if (!selectedLocation?.publicCode || !canvasRef.current) return;

    const joinUrl = `${window.location.origin}/join/${selectedLocation.publicCode}`;
    
    // Use a simple QR code library or API
    // For simplicity, we'll use the QR Server API
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(joinUrl)}&format=png&margin=10`;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      canvas.width = qrSize;
      canvas.height = qrSize;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, qrSize, qrSize);
      ctx.drawImage(img, 0, 0, qrSize, qrSize);
    };
    img.src = qrUrl;
  };

  const downloadQR = () => {
    if (!canvasRef.current || !selectedLocation) return;
    
    const link = document.createElement('a');
    link.download = `qr-${selectedLocation.publicCode}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  const printQR = () => {
    if (!canvasRef.current || !selectedLocation) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const joinUrl = `${window.location.origin}/join/${selectedLocation.publicCode}`;
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Code - ${selectedLocation.name}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 2rem;
            text-align: center;
          }
          h1 { font-size: 2rem; margin-bottom: 0.5rem; color: #111827; }
          p { color: #6b7280; margin-bottom: 2rem; }
          img { max-width: 300px; border: 1px solid #e5e7eb; border-radius: 12px; }
          .url { margin-top: 1rem; font-family: monospace; color: #14b8a6; }
        </style>
      </head>
      <body>
        <h1>${selectedLocation.name}</h1>
        <p>Scan to join the queue</p>
        <img src="${canvasRef.current.toDataURL('image/png')}" alt="QR Code" />
        <div class="url">${joinUrl}</div>
        <script>window.onload = () => { window.print(); }</script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div style={{ padding: 20 }}>Admins only</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ padding: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>
            QR Code Generator
          </h1>
          <p style={{ color: '#6b7280' }}>
            Generate and print QR codes for your locations. Customers can scan to join queues instantly.
          </p>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" />
          </div>
        ) : locations.length === 0 ? (
          <div style={emptyState}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <Icon icon={QrCode} size={48} color="#14b8a6" strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
              No locations with public codes
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              First, assign public codes to your locations in the Locations settings.
            </p>
            <a href="/admin/locations" style={linkButton}>
              Go to Locations →
            </a>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            {/* Left: Settings */}
            <div style={settingsCard}>
              <h2 style={cardTitle}>Settings</h2>

              <div style={formField}>
                <label style={labelStyle}>Select Location</label>
                <select
                  value={selectedLocation?.id || ''}
                  onChange={(e) => {
                    const loc = locations.find(l => l.id === e.target.value);
                    setSelectedLocation(loc || null);
                  }}
                  style={selectStyle}
                >
                  {locations.map(loc => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.publicCode})
                    </option>
                  ))}
                </select>
              </div>

              <div style={formField}>
                <label style={labelStyle}>QR Code Size</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[128, 256, 512].map(size => (
                    <button
                      key={size}
                      onClick={() => setQrSize(size)}
                      style={{
                        ...sizeButton,
                        background: qrSize === size ? '#14b8a6' : 'white',
                        color: qrSize === size ? 'white' : '#374151',
                        borderColor: qrSize === size ? '#14b8a6' : '#e5e7eb',
                      }}
                    >
                      {size}px
                    </button>
                  ))}
                </div>
              </div>

              {selectedLocation && (
                <div style={urlBox}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                    Join URL
                  </label>
                  <code style={codeStyle}>
                    {window.location.origin}/join/{selectedLocation.publicCode}
                  </code>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button onClick={downloadQR} style={actionButton}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  Download
                </button>
                <button onClick={printQR} style={actionButton}>
                  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a2 2 0 002 2h6a2 2 0 002-2v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a2 2 0 00-2-2H7a2 2 0 00-2 2zm8 0H7v3h6V4zm0 8H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  Print
                </button>
              </div>
            </div>

            {/* Right: Preview */}
            <div style={previewCard}>
              <h2 style={cardTitle}>Preview</h2>
              {selectedLocation ? (
                <div style={{ textAlign: 'center' }}>
                  <div style={qrContainer}>
                    <canvas ref={canvasRef} style={{ maxWidth: '100%', borderRadius: '0.5rem' }} />
                  </div>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '1rem' }}>
                    {selectedLocation.name}
                  </p>
                </div>
              ) : (
                <p style={{ color: '#9ca3af', textAlign: 'center' }}>Select a location to generate QR code</p>
              )}
            </div>
          </div>
        )}

        {/* Tips */}
        <div style={tipsCard}>
          <Icon icon={Lightbulb} size={22} color="#92400e" />
          <div>
            <h3 style={{ fontWeight: 600, color: '#92400e', marginBottom: '0.25rem' }}>Tips for using QR codes</h3>
            <ul style={{ color: '#a16207', fontSize: '0.875rem', margin: 0, paddingLeft: '1.25rem' }}>
              <li>Print and display at your entrance or reception desk</li>
              <li>Use larger sizes (512px) for better scannability from a distance</li>
              <li>Test the QR code with your phone before printing</li>
              <li>Consider adding your logo or branding around the QR code</li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Styles
const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem',
  background: 'white',
  borderRadius: '1rem',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderColor: '#e5e7eb',
};

const linkButton: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.625rem 1.25rem',
  background: '#14b8a6',
  color: 'white',
  borderRadius: '0.5rem',
  textDecoration: 'none',
  fontWeight: 600,
};

const settingsCard: React.CSSProperties = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e5e7eb',
};

const previewCard: React.CSSProperties = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e5e7eb',
};

const cardTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#111827',
  marginBottom: '1rem',
};

const formField: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
  marginBottom: '1rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
};

const selectStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  fontSize: '0.9375rem',
  background: '#f9fafb',
  color: '#111827',
};

const sizeButton: React.CSSProperties = {
  padding: '0.5rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.875rem',
  transition: 'all 0.2s',
};

const urlBox: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  padding: '0.75rem',
  background: '#f9fafb',
  borderRadius: '0.5rem',
  marginTop: '1rem',
};

const codeStyle: React.CSSProperties = {
  fontSize: '0.8125rem',
  fontFamily: 'monospace',
  color: '#14b8a6',
  wordBreak: 'break-all',
};

const actionButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.625rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#374151',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const qrContainer: React.CSSProperties = {
  display: 'inline-block',
  padding: '1rem',
  background: 'white',
  borderRadius: '0.75rem',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
};

const tipsCard: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  padding: '1.25rem',
  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  borderRadius: '1rem',
  border: '1px solid #fcd34d',
  marginTop: '2rem',
};
