import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface NeoButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  to?: string;
  variant?: 'primary' | 'danger' | 'default' | '';
  className?: string;
}

export default function NeoButton({ to, onClick, variant = 'default', className = '', children, ...props }: NeoButtonProps) {
  const navigate = useNavigate();
  const [animating, setAnimating] = useState(false);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (animating) {
      e.preventDefault();
      return;
    }
    
    const isSubmit = props.type === 'submit';
    const form = isSubmit ? (e.target as HTMLElement).closest('form') : null;

    // We only intercept if it's meant to navigate, submit, or actively holds an onClick
    if (to || onClick || isSubmit) {
      if (to || isSubmit) e.preventDefault(); 
      setAnimating(true);
      
      setTimeout(() => {
        setAnimating(false);
        if (onClick) onClick(e);
        if (to) {
          navigate(to);
        } else if (isSubmit && form) {
          form.requestSubmit();
        }
      }, 150); // 150ms allows the physical mechanical CSS compression to be visibly registered
    }
  };

  let variantClass = '';
  if (variant === 'primary') variantClass = 'np-button-primary';
  if (variant === 'danger') variantClass = 'np-button-danger';

  return (
    <button 
      onClick={handleClick} 
      className={`np-button ${variantClass} ${className} ${animating ? 'np-animating' : ''}`}
      {...props}
    >
      {children}
    </button>
  );
}
