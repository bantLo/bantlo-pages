import { useNavigate } from 'react-router-dom';
import NeoButton from './NeoButton';

export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate();

  const handleBack = () => {
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <NeoButton onClick={handleBack} style={{ padding: '0.4rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span>←</span> Back
    </NeoButton>
  );
}
