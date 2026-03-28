import { useNavigate } from 'react-router-dom';

export default function BackButton({ fallback = '/' }: { fallback?: string }) {
  const navigate = useNavigate();

  const handleBack = () => {
    // If the user arrived directly to this page, window.history.length is often 1 or 2.
    // React Router's -1 pops the internal state safely. If it fails, we catch it or we use fallback.
    // A more bulletproof way is to always try -1, but if state is empty, route to fallback.
    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate(fallback);
    }
  };

  return (
    <button onClick={handleBack} className="np-button" style={{ padding: '0.4rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span>←</span> Back
    </button>
  );
}
