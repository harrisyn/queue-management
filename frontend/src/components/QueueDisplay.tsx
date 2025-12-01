'use client';

import React, { useEffect, useState } from 'react';
import { useSocket } from '@/hooks/useSocket';
import type { Queue, EntryStatus } from '@/types';

interface QueueDisplayProps {
  queue: Queue;
  onRefresh?: () => void;
}

const QueueDisplay: React.FC<QueueDisplayProps> = ({ queue: initialQueue, onRefresh }) => {
  const [queue, setQueue] = useState(initialQueue);
  const { joinQueue, leaveQueue, onQueueUpdated, onEntryStatusChanged } = useSocket();

  useEffect(() => {
    setQueue(initialQueue);
  }, [initialQueue]);

  useEffect(() => {
    joinQueue(queue.id);

    const unsubUpdate = onQueueUpdated((data) => {
      if (data.queueId === queue.id) {
        onRefresh?.();
      }
    });

    const unsubStatus = onEntryStatusChanged((data) => {
      if (data.queueId === queue.id) {
        setQueue(prev => ({
          ...prev,
          entries: prev.entries?.map(e => 
            e.id === data.entryId ? { ...e, status: data.status as EntryStatus } : e
          ),
        }));
      }
    });

    return () => {
      leaveQueue(queue.id);
      unsubUpdate();
      unsubStatus();
    };
  }, [queue.id, joinQueue, leaveQueue, onQueueUpdated, onEntryStatusChanged, onRefresh]);

  const waiting = queue.entries?.filter(e => e.status === 'WAITING') || [];
  const serving = queue.entries?.filter(e => e.status === 'SERVING') || [];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return { bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', text: 'white' };
      case 'PAUSED': return { bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', text: 'white' };
      default: return { bg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', text: 'white' };
    }
  };

  const statusStyle = getStatusColor(queue.status);

  return (
    <div className="queue-display">
      {/* Header */}
      <div className="queue-header">
        <div className="header-left">
          <div className="queue-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
          <div>
            <h2 className="queue-title">{queue.service?.name || 'Queue'}</h2>
            <span className="queue-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
          </div>
        </div>
        <span className="status-badge" style={{ background: statusStyle.bg, color: statusStyle.text }}>
          <span className="status-dot" />
          {queue.status}
        </span>
      </div>

      {/* Now Serving Section */}
      <div className="section now-serving-section">
        <div className="section-header">
          <h3 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            Now Serving
          </h3>
          <span className="section-count">{serving.length}</span>
        </div>
        
        {serving.length > 0 ? (
          <div className="serving-grid">
            {serving.map(entry => (
              <div key={entry.id} className="serving-card">
                <div className="serving-pulse" />
                <span className="ticket-number">{entry.ticketNumber}</span>
                <span className="customer-name">{entry.user?.firstName} {entry.user?.lastName}</span>
                <span className="serving-label">Being Served</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-serving">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10" />
              <path d="M8 15s1.5 2 4 2 4-2 4-2" />
              <line x1="9" y1="9" x2="9.01" y2="9" />
              <line x1="15" y1="9" x2="15.01" y2="9" />
            </svg>
            <span>No one being served</span>
          </div>
        )}
      </div>

      {/* Waiting List Section */}
      <div className="section waiting-section">
        <div className="section-header">
          <h3 className="section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Waiting
          </h3>
          <span className="section-count waiting-count">{waiting.length}</span>
        </div>

        <div className="waiting-list">
          {waiting.map((entry, index) => (
            <div key={entry.id} className={`waiting-item ${index === 0 ? 'next-up' : ''}`}>
              <span className="position">
                {index === 0 ? (
                  <span className="next-badge">NEXT</span>
                ) : (
                  `#${index + 1}`
                )}
              </span>
              <span className="waiting-ticket">{entry.ticketNumber}</span>
              <span className="waiting-name">{entry.user?.firstName} {entry.user?.lastName}</span>
              {entry.priority > 0 && (
                <span className="priority-badge">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                  </svg>
                  Priority
                </span>
              )}
            </div>
          ))}
          {waiting.length === 0 && (
            <div className="empty-waiting">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <span>Queue is empty - no one waiting!</span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Footer */}
      {queue.stats && (
        <div className="stats-footer">
          <div className="stat-item">
            <div className="stat-icon waiting-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-value">{queue.stats.waiting}</span>
              <span className="stat-label">Waiting</span>
            </div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-icon serving-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-value">{queue.stats.serving}</span>
              <span className="stat-label">Serving</span>
            </div>
          </div>
          <div className="stat-divider" />
          <div className="stat-item">
            <div className="stat-icon served-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div className="stat-content">
              <span className="stat-value">{queue.stats.served}</span>
              <span className="stat-label">Served Today</span>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .queue-display {
          background: white;
          border-radius: 16px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .queue-header {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          color: white;
          padding: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .queue-icon {
          width: 48px;
          height: 48px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .queue-title {
          margin: 0;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .queue-date {
          font-size: 0.8rem;
          opacity: 0.8;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .status-dot {
          width: 8px;
          height: 8px;
          background: currentColor;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .section {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #f1f5f9;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .section-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 600;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .section-count {
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: white;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }

        .waiting-count {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }

        .now-serving-section {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
        }

        .serving-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .serving-card {
          position: relative;
          background: white;
          border: 2px solid #10b981;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          min-width: 160px;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2);
          animation: cardPop 0.3s ease-out;
        }

        @keyframes cardPop {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .serving-pulse {
          position: absolute;
          top: -4px;
          right: -4px;
          width: 12px;
          height: 12px;
          background: #10b981;
          border-radius: 50%;
          animation: pulseDot 1.5s infinite;
        }

        @keyframes pulseDot {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.5); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }

        .ticket-number {
          font-size: 2rem;
          font-weight: 700;
          color: #10b981;
          font-family: 'Courier New', monospace;
        }

        .customer-name {
          font-size: 0.9rem;
          color: #334155;
          font-weight: 500;
        }

        .serving-label {
          font-size: 0.7rem;
          color: #10b981;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-weight: 600;
        }

        .empty-serving,
        .empty-waiting {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          padding: 1.5rem;
          color: #94a3b8;
          text-align: center;
        }

        .waiting-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          max-height: 320px;
          overflow-y: auto;
        }

        .waiting-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.875rem 1rem;
          background: #f8fafc;
          border-radius: 10px;
          transition: all 0.2s;
        }

        .waiting-item:hover {
          background: #f1f5f9;
          transform: translateX(4px);
        }

        .waiting-item.next-up {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #fbbf24;
        }

        .position {
          min-width: 50px;
          font-size: 0.85rem;
          color: #64748b;
          font-weight: 500;
        }

        .next-badge {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.5px;
        }

        .waiting-ticket {
          font-size: 1rem;
          font-weight: 700;
          color: #1e293b;
          background: white;
          padding: 0.25rem 0.6rem;
          border-radius: 6px;
          font-family: 'Courier New', monospace;
          border: 1px solid #e2e8f0;
        }

        .waiting-name {
          flex: 1;
          font-size: 0.9rem;
          color: #475569;
        }

        .priority-badge {
          display: flex;
          align-items: center;
          gap: 0.3rem;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 0.2rem 0.6rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
        }

        .stats-footer {
          display: flex;
          padding: 1.25rem 1.5rem;
          gap: 1rem;
          justify-content: space-around;
          background: #fafbfc;
        }

        .stat-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .waiting-icon {
          background: #fef3c7;
          color: #d97706;
        }

        .serving-icon {
          background: #dbeafe;
          color: #2563eb;
        }

        .served-icon {
          background: #dcfce7;
          color: #16a34a;
        }

        .stat-content {
          display: flex;
          flex-direction: column;
        }

        .stat-value {
          font-size: 1.25rem;
          font-weight: 700;
          color: #1e293b;
        }

        .stat-label {
          font-size: 0.75rem;
          color: #64748b;
        }

        .stat-divider {
          width: 1px;
          background: #e2e8f0;
        }

        @media (max-width: 640px) {
          .queue-header {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .header-left {
            flex-direction: column;
          }

          .stats-footer {
            flex-direction: column;
            gap: 1rem;
          }

          .stat-divider {
            display: none;
          }

          .stat-item {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default QueueDisplay;
