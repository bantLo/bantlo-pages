import { Link } from 'react-router-dom';

export default function Logo() {
  return (
    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {/* Temporary Brutalist SVG Logo placeholder */}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="var(--bg-surface)" xmlns="http://www.w3.org/2000/svg" style={{ border: '2px solid var(--border-color)', display: 'block' }}>
        <path d="M12 4L4 20h16L12 4z" fill="var(--text-accent)" />
        <rect x="10" y="10" width="4" height="6" fill="var(--bg-dark)" />
      </svg>
      {/* Heavy stylized text mapping the Accent visual layout */}
      <h1 className="np-title" style={{ margin: 0, border: 'none', fontSize: '1.75rem', fontWeight: 900, textTransform: 'none', letterSpacing: '-1.5px', paddingBottom: 0 }}>
        <span style={{ color: 'var(--text-primary)' }}>bant</span>
        <span style={{ color: 'var(--text-accent)' }}>Lo</span>
      </h1>
    </Link>
  );
}
