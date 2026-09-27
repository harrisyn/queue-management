'use client';

import React from 'react';

export interface UsageBarProps {
  label: string;
  current: number;
  limit: number | null;
}

export const UsageBar: React.FC<UsageBarProps> = ({ label, current, limit }) => {
  const percentage = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, (current / limit) * 100);
  // Full is normal (a one-location plan with one location); only over is a problem.
  const tone = limit === null || percentage < 80 ? 'ok' : limit !== null && current > limit ? 'error' : 'warning';

  return (
    <div className="usage-bar">
      <div className="usage-bar-header">
        <span className="usage-bar-label">{label}</span>
        <span className="usage-bar-value">
          {current}
          {limit !== null ? ` / ${limit}` : ' used'}
        </span>
      </div>
      {limit !== null && (
        <div className="usage-bar-track">
          <div className={`usage-bar-fill usage-bar-fill-${tone}`} style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  );
};

export default UsageBar;
