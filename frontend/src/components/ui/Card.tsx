'use client';

import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, className = '', children, ...rest }, ref) => {
    const classes = ['card', hoverable ? 'card-hover' : '', className]
      .filter(Boolean)
      .join(' ');

    return (
      <div {...rest} ref={ref} className={classes}>
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
