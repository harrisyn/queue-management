'use client';

import React, { useState } from 'react';
import api from '@/api/client';
import type { Queue } from '@/types';

interface QueueControlProps {
  queue: Queue;
  onUpdate: () => void;
}

const QueueControl: React.FC<QueueControlProps> = ({ queue, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleCallNext = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      await api.callNext(queue.id);
      setSuccess('Next customer called!');
      setTimeout(() => setSuccess(null), 3000);
      onUpdate();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to call next');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkServed = async (entryId: string) => {
    setLoading(true);
    setError(null);
    try {
      await api.markServed(queue.id, entryId);
      setSuccess('Customer marked as served!');
      setTimeout(() => setSuccess(null), 3000);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (entryId: string) => {
    if (!window.confirm('Are you sure you want to cancel this entry?')) return;
    setLoading(true);
    setError(null);
    try {
      await api.cancelEntry(queue.id, entryId);
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const serving = queue.entries?.filter(e => e.status === 'SERVING') || [];
  const waiting = queue.entries?.filter(e => e.status === 'WAITING') || [];

  return (
    <div className="queue-control">
      {/* Header */}
      <div className="control-header">
        <div className="header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </div>
        <h3>Queue Control</h3>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {success}
        </div>
      )}

      {/* Call Next Button */}
      <button 
        onClick={handleCallNext} 
        disabled={loading || waiting.length === 0}
        className={`call-next-btn ${loading ? 'loading' : ''}`}
      >
        {loading ? (
          <>
            <div className="btn-spinner" />
            Processing...
          </>
        ) : (
          <>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Call Next Customer
          </>
        )}
        {waiting.length > 0 && !loading && (
          <span className="waiting-badge">{waiting.length} waiting</span>
        )}
      </button>

      {/* Currently Serving */}
      {serving.length > 0 && (
        <div className="section">
          <h4 className="section-title">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Currently Serving
          </h4>
          {serving.map(entry => (
            <div key={entry.id} className="serving-card">
              <div className="serving-info">
                <span className="serving-ticket">{entry.ticketNumber}</span>
                <span className="serving-name">{entry.user?.firstName} {entry.user?.lastName}</span>
              </div>
              <button 
                onClick={() => handleMarkServed(entry.id)} 
                className="btn-served"
                disabled={loading}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Complete
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Waiting List Preview */}
      <div className="section">
        <h4 className="section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Up Next
          <span className="count-badge">{waiting.length}</span>
        </h4>
        <div className="waiting-preview">
          {waiting.slice(0, 5).map((entry, index) => (
            <div key={entry.id} className={`waiting-card ${index === 0 ? 'first' : ''}`}>
              <div className="waiting-left">
                <span className="waiting-position">#{index + 1}</span>
                <div className="waiting-info">
                  <span className="waiting-ticket">{entry.ticketNumber}</span>
                  <span className="waiting-name">{entry.user?.firstName} {entry.user?.lastName}</span>
                </div>
              </div>
              <button 
                onClick={() => handleCancel(entry.id)} 
                className="btn-cancel"
                disabled={loading}
                title="Cancel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {waiting.length === 0 && (
            <div className="empty-state">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 16s-1.5-2-4-2-4 2-4 2" />
                <line x1="9" y1="9" x2="9.01" y2="9" />
                <line x1="15" y1="9" x2="15.01" y2="9" />
              </svg>
              <span>No customers waiting</span>
            </div>
          )}
          {waiting.length > 5 && (
            <div className="more-waiting">
              + {waiting.length - 5} more in queue
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .queue-control {
          background: white;
          border-radius: 16px;
          padding: 0;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
          overflow: hidden;
          animation: slideIn 0.4s ease-out;
        }

        @keyframes slideIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .control-header {
          background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
          color: white;
          padding: 1.25rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .header-icon {
          width: 40px;
          height: 40px;
          background: rgba(255, 255, 255, 0.15);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          backdrop-filter: blur(10px);
        }

        .control-header h3 {
          margin: 0;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .alert {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.875rem 1.25rem;
          margin: 1rem 1.25rem 0;
          border-radius: 10px;
          font-size: 0.9rem;
          font-weight: 500;
          animation: fadeIn 0.3s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .alert-error {
          background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
          color: #dc2626;
          border: 1px solid #fecaca;
        }

        .alert-success {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          color: #16a34a;
          border: 1px solid #bbf7d0;
        }

        .call-next-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          width: calc(100% - 2.5rem);
          margin: 1.25rem;
          padding: 1rem 1.5rem;
          font-size: 1.1rem;
          font-weight: 600;
          background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s;
          box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
          position: relative;
          overflow: hidden;
        }

        .call-next-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }

        .call-next-btn:active:not(:disabled) {
          transform: translateY(0);
        }

        .call-next-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
          transform: none;
        }

        .call-next-btn.loading {
          background: linear-gradient(135deg, #94a3b8 0%, #64748b 100%);
          box-shadow: 0 4px 15px rgba(100, 116, 139, 0.3);
        }

        .btn-spinner {
          width: 20px;
          height: 20px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .waiting-badge {
          position: absolute;
          top: -8px;
          right: -8px;
          background: #f59e0b;
          color: white;
          padding: 0.25rem 0.6rem;
          border-radius: 20px;
          font-size: 0.7rem;
          font-weight: 600;
          box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);
        }

        .section {
          padding: 1.25rem;
          border-top: 1px solid #f1f5f9;
        }

        .section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin: 0 0 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .count-badge {
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
          color: white;
          padding: 0.15rem 0.5rem;
          border-radius: 20px;
          font-size: 0.75rem;
          margin-left: auto;
        }

        .serving-card {
          background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
          border: 1px solid #bbf7d0;
          border-radius: 12px;
          padding: 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: pulse 2s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.3); }
          50% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
        }

        .serving-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .serving-ticket {
          font-size: 1.25rem;
          font-weight: 700;
          color: #16a34a;
          font-family: 'Courier New', monospace;
        }

        .serving-name {
          font-size: 0.9rem;
          color: #166534;
        }

        .btn-served {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: linear-gradient(135deg, #10b981 0%, #059669 100%);
          color: white;
          border: none;
          padding: 0.6rem 1rem;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-served:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
        }

        .btn-served:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .waiting-preview {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .waiting-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          background: #f8fafc;
          border-radius: 10px;
          transition: all 0.2s;
        }

        .waiting-card:hover {
          background: #f1f5f9;
        }

        .waiting-card.first {
          background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
          border: 1px solid #fbbf24;
        }

        .waiting-left {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .waiting-position {
          font-size: 0.8rem;
          color: #64748b;
          font-weight: 500;
          min-width: 30px;
        }

        .waiting-info {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }

        .waiting-ticket {
          font-size: 0.9rem;
          font-weight: 700;
          color: #1e293b;
          font-family: 'Courier New', monospace;
        }

        .waiting-name {
          font-size: 0.8rem;
          color: #64748b;
        }

        .btn-cancel {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: transparent;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          color: #94a3b8;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-cancel:hover:not(:disabled) {
          background: #fef2f2;
          border-color: #fecaca;
          color: #ef4444;
        }

        .btn-cancel:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
          padding: 1.5rem;
          color: #94a3b8;
          text-align: center;
        }

        .more-waiting {
          text-align: center;
          padding: 0.5rem;
          color: #64748b;
          font-size: 0.85rem;
          font-style: italic;
        }
      `}</style>
    </div>
  );
};

export default QueueControl;
