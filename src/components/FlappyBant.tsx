import { useEffect, useRef, useState } from 'react';
import NeoButton from './NeoButton';

interface FlappyBantProps {
  onClose: () => void;
}

export default function FlappyBant({ onClose }: FlappyBantProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'OVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(Number(localStorage.getItem('flappy_high_score') || 0));

  // Game Constants
  const GRAVITY = 0.28;
  const JUMP = -6.2;
  const PIPE_SPEED = 2.2;
  const PIPE_SPAWN_RATE = 130; 
  const PIPE_GAP = 240; 

  // Mutable Game Refs
  const bird = useRef({ y: 300, v: 0, r: 12 });
  const pipes = useRef<any[]>([]);
  const frameId = useRef<number>(0);
  const count = useRef(0);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'START' | 'PLAYING' | 'OVER'>(gameState);
  const [isShaking, setIsShaking] = useState(false);

  // Sync state to ref for animation loop stability
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  const resizeCanvas = () => {
    if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
    }
  };

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  const resetGame = () => {
    bird.current = { y: window.innerHeight / 2, v: 0, r: 12 };
    pipes.current = [];
    count.current = 0;
    scoreRef.current = 0;
    setScore(0);
    setGameState('PLAYING');
  };

  const jump = () => {
    if (gameStateRef.current === 'START') resetGame();
    else if (gameStateRef.current === 'PLAYING') bird.current.v = JUMP;
    else if (gameStateRef.current === 'OVER') resetGame();
  };

  const update = () => {
    if (gameStateRef.current !== 'PLAYING') return;

    // Physics
    bird.current.v += GRAVITY;
    bird.current.y += bird.current.v;

    // Collision - Ground/Ceiling
    if (bird.current.y + bird.current.r > window.innerHeight || bird.current.y - bird.current.r < 0) {
      handleGameOver();
    }

    // Pipe Spawning
    count.current++;
    if (count.current % PIPE_SPAWN_RATE === 0) {
      const h = Math.random() * (window.innerHeight - PIPE_GAP - 100) + 50;
      pipes.current.push({ x: window.innerWidth, h, passed: false });
    }

    // Pipe Logic
    pipes.current.forEach((p) => {
      p.x -= PIPE_SPEED;

      // Score Detection
      if (!p.passed && p.x + 60 < window.innerWidth / 2 - bird.current.r) {
        p.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
      }

      // Collision Detection
      const birdX = window.innerWidth / 2;
      const birdY = bird.current.y;
      const birdR = bird.current.r;
      
      const inPipeX = birdX + birdR > p.x && birdX - birdR < p.x + 60;
      const hitTop = inPipeX && birdY - birdR < p.h;
      const hitBottom = inPipeX && birdY + birdR > p.h + PIPE_GAP;

      if (hitTop || hitBottom) {
        handleGameOver();
      }
    });

    // Cleanup Pipes
    if (pipes.current.length > 0 && pipes.current[0].x < -100) {
      pipes.current.shift();
    }
  };

  const handleGameOver = () => {
    if (gameStateRef.current === 'OVER') return;
    
    setGameState('OVER');
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 200);
    
    // Use the latest score from Ref to avoid closure staleness
    const currentScore = scoreRef.current;
    const currentHigh = Number(localStorage.getItem('flappy_high_score') || 0);

    if (currentScore > currentHigh) {
      setHighScore(currentScore);
      localStorage.setItem('flappy_high_score', currentScore.toString());
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    // Camera Shake Logic
    if (isShaking) {
      ctx.save();
      ctx.translate(Math.random() * 8 - 4, Math.random() * 8 - 4);
    }

    // Background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    // Grid (Neo Design)
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for(let i=0; i<window.innerWidth; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, window.innerHeight); ctx.stroke(); }
    for(let i=0; i<window.innerHeight; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(window.innerWidth, i); ctx.stroke(); }

    // Pipes
    ctx.fillStyle = '#00b772'; // --text-accent
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 3;
    pipes.current.forEach(p => {
      // Top Pipe
      ctx.fillRect(p.x, 0, 60, p.h);
      ctx.strokeRect(p.x, 0, 60, p.h);
      
      // Bottom Pipe
      ctx.fillRect(p.x, p.h + PIPE_GAP, 60, window.innerHeight - (p.h + PIPE_GAP));
      ctx.strokeRect(p.x, p.h + PIPE_GAP, 60, window.innerHeight - (p.h + PIPE_GAP));
      
      // Pipe Lips (Neo Stylized)
      ctx.fillRect(p.x - 5, p.h - 10, 70, 10);
      ctx.strokeRect(p.x - 5, p.h - 10, 70, 10);
      ctx.fillRect(p.x - 5, p.h + PIPE_GAP, 70, 10);
      ctx.strokeRect(p.x - 5, p.h + PIPE_GAP, 70, 10);
    });

    // Bird (Stylized bantLo Square)
    const birdX = window.innerWidth / 2;
    ctx.save();
    ctx.translate(birdX, bird.current.y);
    ctx.rotate(Math.min(Math.PI/4, Math.max(-Math.PI/4, bird.current.v * 0.05)));
    
    // Outer Border
    ctx.fillStyle = 'white';
    ctx.fillRect(-bird.current.r, -bird.current.r, bird.current.r*2, bird.current.r*2);
    ctx.strokeRect(-bird.current.r, -bird.current.r, bird.current.r*2, bird.current.r*2);
    
    // Logo Inner
    ctx.fillStyle = '#00b772';
    ctx.fillRect(-bird.current.r + 4, -bird.current.r + 4, bird.current.r*2 - 8, bird.current.r*2 - 8);
    
    ctx.restore();
    if (isShaking) ctx.restore();
  };

  useEffect(() => {
    const loop = () => {
      update();
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) draw(ctx);
      }
      frameId.current = requestAnimationFrame(loop);
    };
    frameId.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId.current);
  }, []); // Run once, use refs/sync for variables

  return (
    <div 
      style={{ 
        position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', 
        zIndex: 10000, 
        backgroundColor: 'black',
        overflow: 'hidden',
        touchAction: 'none'
      }}
      onClick={jump}
    >
      <canvas ref={canvasRef} />
      
      {/* HUD */}
      {gameState === 'PLAYING' && (
        <div style={{ position: 'absolute', top: '2rem', left: 0, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
          <p style={{ margin: 0, fontSize: '3rem', fontWeight: 900, color: 'white', textShadow: '4px 4px 0px #00b772' }}>{score}</p>
          <p style={{ margin: 0, fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>High Score: {highScore}</p>
        </div>
      )}

      {gameState === 'START' && (
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', width: '80%' }}>
          <h1 className="np-title" style={{ fontSize: '2.5rem', marginBottom: '1.5rem', border: 'none' }}>FLAPPY<br/><span style={{ color: 'var(--text-accent)' }}>BANT</span></h1>
          <p className="np-text-muted" style={{ marginBottom: '2rem' }}>TAP ANYWHERE TO JUMP</p>
          <NeoButton onClick={jump} variant="primary" style={{ width: '100%' }}>START GAME</NeoButton>
          <NeoButton onClick={onClose} style={{ width: '100%', marginTop: '1rem', border: 'none' }}>EXIT</NeoButton>
        </div>
      )}

      {gameState === 'OVER' && (
        <div 
          style={{ 
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
            backdropFilter: 'blur(10px) brightness(0.35)',
            transition: 'backdrop-filter 0.5s ease',
            zIndex: 10001
          }}
        >
          <div style={{ textAlign: 'center', width: '80%', maxWidth: '400px' }}>
            <h1 className="np-title" style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-danger)', border: 'none', fontWeight: 900 }}>CRASHED!</h1>
            <div className="np-section" style={{ borderStyle: 'dotted', marginBottom: '2rem', background: '#000', border: '2px solid #333', boxShadow: '12px 12px 0px rgba(0,0,0,0.8)' }}>
              <p style={{ margin: 0, fontSize: '1.2rem', color: 'white' }}>Final Score: <strong>{score}</strong></p>
              <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.7rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Best Protocol Run: {highScore}</p>
              {score >= highScore && score > 0 && <p style={{ color: 'var(--text-accent)', fontSize: '0.8rem', marginTop: '0.75rem', fontWeight: 'bold' }}>NEW SYSTEM RECORD! 🏆</p>}
            </div>
            <NeoButton onClick={resetGame} variant="primary" style={{ width: '100%', height: '3.5rem', fontSize: '1rem' }}>RETRY MISSION</NeoButton>
            <NeoButton onClick={onClose} style={{ width: '100%', marginTop: '1rem', border: 'none', color: 'var(--text-secondary)' }}>EXIT TO DASHBOARD</NeoButton>
          </div>
        </div>
      )}

      <div style={{ position: 'absolute', bottom: '2rem', width: '100%', textAlign: 'center', pointerEvents: 'none', opacity: 0.3 }}>
        <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'white' }}>Protocol v1.9.1 / Easter Egg</p>
      </div>
    </div>
  );
}
