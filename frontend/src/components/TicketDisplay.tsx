'use client';

import React from 'react';
import type { QueueEntry, Service } from '@/types';

interface TicketDisplayProps {
  entry: QueueEntry;
  service?: Service;
  position?: number;
  qrData?: string;
}

const TicketDisplay: React.FC<TicketDisplayProps> = ({ entry, service, position }) => {
  const getStatusInfo = (status: string) => {
    const statusMap: Record<string, { color: string; bg: string; label: string; icon: string }> = {
      WAITING: { color: '#d97706', bg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', label: 'Waiting', icon: '⏳' },
      SERVING: { color: '#16a34a', bg: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)', label: 'Now Serving', icon: '🔔' },
      SERVED: { color: '#2563eb', bg: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)', label: 'Served', icon: '✓' },
      CANCELLED: { color: '#dc2626', bg: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)', label: 'Cancelled', icon: '✕' },
      NO_SHOW: { color: '#64748b', bg: 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)', label: 'No Show', icon: '?' },
    };
    return statusMap[status] || { color: '#64748b', bg: '#f1f5f9', label: status, icon: '•' };
  };

  const statusInfo = getStatusInfo(entry.status);

  return (
    <div className="ticket-display">
      {/* Header */}
      <div className="ticket-header">
        <div className="ticket-brand">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>Your Ticket</span>
        </div>
        <span className="status-badge" style={{ background: statusInfo.bg, color: statusInfo.color }}>
          {statusInfo.icon} {statusInfo.label}
        </span>
      </div>

      {/* Ticket Number */}
      <div className="ticket-number-section">
        <div className="ticket-number">{entry.ticketNumber}</div>
        {service && <div className="service-name">{service.name}</div>}
      </div>

      {/* Position (when waiting) */}
      {entry.status === 'WAITING' && position && (
        <div className="position-section">
          <div className="position-card">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div className="position-content">
              <span className="position-label">Your Position</span>
              <span className="position-value">#{position}</span>
            </div>
          </div>
          <div className="wait-estimate">
            Estimated wait: ~{position * 5} minutes
          </div>
        </div>
      )}

      {/* Now Serving Alert */}
      {entry.status === 'SERVING' && (
        <div className="serving-alert">
          <div className="serving-pulse" />
          <div className="serving-content">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span>It&apos;s your turn!</span>
            <p>Please proceed to the counter</p>
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="info-section">
        <div className="info-row">
          <span className="info-label">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Joined
          </span>
          <span className="info-value">{new Date(entry.joinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        {entry.calledAt && (
          <div className="info-row">
            <span className="info-label">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              Called
            </span>
            <span className="info-value">{new Date(entry.calledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        )}
      </div>

      <style jsx>{`
        .ticket-display {
          background: white;
          border-radius: 20px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.12);
          overflow: hidden;
          max-width: 380px;
          margin: 0 auto;
          animation: ticketPop 0.4s ease-out;
        }

        @keyframes ticketPop {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .ticket-header {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          color: white;
          padding: 1.25rem 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .ticket-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .ticket-number-section {
          padding: 2.5rem 1.5rem;
          text-align: center;
          border-bottom: 2px dashed #e2e8f0;
          position: relative;
          background: linear-gradient(180deg, #fafafa 0%, white 100%);
        }

        .ticket-number-section::before,
        .ticket-number-section::after {
          content: '';
          position: absolute;
          width: 20px;
          height: 20px;
          background: #f1f5f9;
          border-radius: 50%;
          bottom: -10px;
        }

        .ticket-number-section::before {
          left: -10px;
        }

        .ticket-number-section::after {
          right: -10px;
        }

        .ticket-number {
          font-size: 4rem;
          font-weight: 800;
          color: #1e1b4b;
          font-family: 'Courier New', monospace;
          line-height: 1;
          letter-spacing: -2px;
        }

        .service-name {
          margin-top: 0.75rem;
          font-size: 1.1rem;
          color: #64748b;
          font-weight: 500;
        }

        .position-section {
          padding: 1.5rem;
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
        }

        .position-card {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }

        .position-card svg {
          color: #d97706;
        }

        .position-content {
          display: flex;
          flex-direction: column;
        }

        .position-label {
          font-size: 0.8rem;
          color: #64748b;
          font-weight: 500;
        }

        .position-value {
          font-size: 1.75rem;
          font-weight: 700;
          color: #d97706;
        }

        .wait-estimate {
          margin-top: 0.75rem;
          text-align: center;
          font-size: 0.85rem;
          color: #92400e;
        }

        .serving-alert {
          position: relative;
          padding: 2rem 1.5rem;
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          text-align: center;
          overflow: hidden;
        }

        .serving-pulse {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200px;
          height: 200px;
          background: rgba(16, 185, 129, 0.2);
          border-radius: 50%;
          transform: translate(-50%, -50%);
          animation: pulse 2s ease-out infinite;
        }

        @keyframes pulse {
          0% { transform: translate(-50%, -50%) scale(0.8); opacity: 1; }
          100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
        }

        .serving-content {
          position: relative;
          z-index: 1;
          color: #16a34a;
        }

        .serving-content svg {
          margin-bottom: 0.5rem;
        }

        .serving-content span {
          display: block;
          font-size: 1.5rem;
          font-weight: 700;
        }

        .serving-content p {
          margin: 0.5rem 0 0;
          font-size: 0.9rem;
          opacity: 0.8;
        }

        .info-section {
          padding: 1.25rem 1.5rem;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 0;
          border-bottom: 1px solid #f1f5f9;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.85rem;
          color: #64748b;
        }

        .info-value {
          font-size: 0.9rem;
          font-weight: 600;
          color: #1e293b;
        }
      `}</style>
    </div>
  );
};

export default TicketDisplay;
