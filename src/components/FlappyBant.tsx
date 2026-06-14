import { useEffect, useRef, useState } from 'react';
import NeoButton from './NeoButton';

interface FlappyBantProps {
  onClose: () => void;
}

// dynamic synthesizer helper using Web Audio API for retro arcade sound effects
class SoundEffects {
  private ctx: AudioContext | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playJump() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(160, t);
      osc.frequency.exponentialRampToValueAtTime(550, t + 0.1);
      
      gain.gain.setValueAtTime(0.12, t);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.1);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.1);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  playScore() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'square';
      osc.frequency.setValueAtTime(523.25, t); // C5
      osc.frequency.setValueAtTime(659.25, t + 0.08); // E5
      
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.setValueAtTime(0.06, t + 0.08);
      gain.gain.linearRampToValueAtTime(0.01, t + 0.18);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.18);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }

  playCrash() {
    try {
      this.init();
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, t);
      osc.frequency.linearRampToValueAtTime(40, t + 0.35);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.35);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start(t);
      osc.stop(t + 0.35);
    } catch (e) {
      console.warn('Audio error:', e);
    }
  }
}

const sfx = new SoundEffects();

export default function FlappyBant({ onClose }: FlappyBantProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'OVER'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(Number(localStorage.getItem('flappy_high_score') || 0));

  // Game Dimensions (Fixed logical resolution for consistency)
  const GAME_WIDTH = 480;
  const GAME_HEIGHT = 800;

  // Game Constants (Calibrated for fixed 480x800 resolution)
  const GRAVITY = 0.28;
  const JUMP = -6.2;
  const PIPE_SPEED = 2.5;
  const PIPE_SPAWN_RATE = 110; 
  const PIPE_GAP = 160; 

  // Mutable Game Refs
  const bird = useRef({ y: 400, v: 0, r: 12 });
  const pipes = useRef<any[]>([]);
  const frameId = useRef<number>(0);
  const timeSinceLastSpawn = useRef(0);
  const scoreRef = useRef(0);
  const gameStateRef = useRef<'START' | 'PLAYING' | 'OVER'>(gameState);
  
  // Game loop timing & physics accumulator
  const lastTime = useRef<number | null>(null);
  const physicsAccumulator = useRef(0);
  const PHYSICS_TS = 16.6667; // 60 FPS target physics step (16.67ms)

  // Camera Shake & Particle system state
  const [isShaking, setIsShaking] = useState(false);
  const bgOffset = useRef(0);
  const bgParticles = useRef<{ x: number; y: number; size: number; speed: number; alpha: number }[]>([]);
  const trail = useRef<{ x: number; y: number; size: number; alpha: number }[]>([]);

  // Sync state to ref for animation loop stability
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    scoreRef.current = score;
  }, [score]);

  // Initialize background star particles on mount
  useEffect(() => {
    const list = [];
    for (let i = 0; i < 30; i++) {
      list.push({
        x: Math.random() * GAME_WIDTH,
        y: Math.random() * GAME_HEIGHT,
        size: Math.random() * 2 + 1,
        speed: Math.random() * 0.4 + 0.1,
        alpha: Math.random() * 0.5 + 0.3
      });
    }
    bgParticles.current = list;
  }, []);

  const resetGame = () => {
    bird.current = { y: GAME_HEIGHT / 2, v: 0, r: 12 };
    pipes.current = [];
    trail.current = [];
    timeSinceLastSpawn.current = 0;
    scoreRef.current = 0;
    lastTime.current = null;
    physicsAccumulator.current = 0;
    setScore(0);
    setGameState('PLAYING');
  };

  const jump = () => {
    if (gameStateRef.current === 'START') {
      sfx.playJump();
      resetGame();
    } else if (gameStateRef.current === 'PLAYING') {
      bird.current.v = JUMP;
      sfx.playJump();
    } else if (gameStateRef.current === 'OVER') {
      sfx.playJump();
      resetGame();
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const update = (dt: number) => {
    // Parallax background & particles update independent of playing status to keep the UI alive
    bgOffset.current = (bgOffset.current + PIPE_SPEED * 0.25 * dt) % 40;
    bgParticles.current.forEach(p => {
      p.x -= p.speed * dt;
      if (p.x < -10) {
        p.x = GAME_WIDTH + 10;
        p.y = Math.random() * GAME_HEIGHT;
      }
    });

    if (gameStateRef.current !== 'PLAYING') return;

    // Add glowing trail particle
    trail.current.push({
      x: GAME_WIDTH / 2,
      y: bird.current.y,
      size: bird.current.r * 0.8,
      alpha: 0.6
    });

    // Update trail particles
    trail.current.forEach(t => {
      t.x -= PIPE_SPEED * dt;
      t.alpha -= 0.04 * dt;
    });
    trail.current = trail.current.filter(t => t.alpha > 0 && t.x > -50);

    // Physics
    bird.current.v += GRAVITY * dt;
    bird.current.y += bird.current.v * dt;

    // Collision - Ground/Ceiling
    if (bird.current.y + bird.current.r > GAME_HEIGHT || bird.current.y - bird.current.r < 0) {
      handleGameOver();
    }

    // Pipe Spawning
    timeSinceLastSpawn.current += dt;
    if (timeSinceLastSpawn.current >= PIPE_SPAWN_RATE) {
      timeSinceLastSpawn.current = 0;
      const h = Math.random() * (GAME_HEIGHT - PIPE_GAP - 250) + 100;
      pipes.current.push({ x: GAME_WIDTH, h, passed: false });
    }

    // Pipe Logic
    pipes.current.forEach((p) => {
      p.x -= PIPE_SPEED * dt;

      // Score Detection
      const birdX = GAME_WIDTH / 2;
      if (!p.passed && p.x + 60 < birdX - bird.current.r) {
        p.passed = true;
        scoreRef.current += 1;
        setScore(scoreRef.current);
        sfx.playScore();
      }

      // Collision Detection
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
    sfx.playCrash();
    setIsShaking(true);
    setTimeout(() => setIsShaking(false), 200);
    
    const currentScore = scoreRef.current;
    const currentHigh = Number(localStorage.getItem('flappy_high_score') || 0);

    if (currentScore > currentHigh) {
      setHighScore(currentScore);
      localStorage.setItem('flappy_high_score', currentScore.toString());
    }
  };

  const draw = (ctx: CanvasRenderingContext2D) => {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Camera Shake Logic
    if (isShaking) {
      ctx.save();
      ctx.translate(Math.random() * 12 - 6, Math.random() * 12 - 6);
    }

    // Background
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Parallax background particles
    bgParticles.current.forEach(p => {
      ctx.fillStyle = `rgba(0, 255, 102, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Parallax background grid
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.05)';
    ctx.lineWidth = 1.5;
    for (let i = -bgOffset.current; i < GAME_WIDTH + 40; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, GAME_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < GAME_HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(GAME_WIDTH, i);
      ctx.stroke();
    }

    // Draw bird trail
    trail.current.forEach(p => {
      ctx.fillStyle = `rgba(0, 255, 102, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pipes (Neo styled with neon green gradient & border highlight)
    pipes.current.forEach(p => {
      const grad = ctx.createLinearGradient(p.x, 0, p.x + 60, 0);
      grad.addColorStop(0, '#005c36');
      grad.addColorStop(0.3, '#00ff66');
      grad.addColorStop(1, '#003d24');

      ctx.fillStyle = grad;
      ctx.strokeStyle = '#00ff66';
      ctx.lineWidth = 2.5;
      
      // Top Pipe
      ctx.fillRect(p.x, 0, 60, p.h);
      ctx.strokeRect(p.x, -5, 60, p.h + 5);
      
      // Bottom Pipe
      ctx.fillRect(p.x, p.h + PIPE_GAP, 60, GAME_HEIGHT - (p.h + PIPE_GAP));
      ctx.strokeRect(p.x, p.h + PIPE_GAP, 60, GAME_HEIGHT - (p.h + PIPE_GAP) + 5);
      
      // Pipe Lips (Slightly wider)
      const lipGrad = ctx.createLinearGradient(p.x - 5, 0, p.x + 65, 0);
      lipGrad.addColorStop(0, '#007042');
      lipGrad.addColorStop(0.3, '#00ff66');
      lipGrad.addColorStop(1, '#004d2d');
      
      ctx.fillStyle = lipGrad;
      
      // Top Pipe Lip
      ctx.fillRect(p.x - 5, p.h - 18, 70, 18);
      ctx.strokeRect(p.x - 5, p.h - 18, 70, 18);
      
      // Bottom Pipe Lip
      ctx.fillRect(p.x - 5, p.h + PIPE_GAP, 70, 18);
      ctx.strokeRect(p.x - 5, p.h + PIPE_GAP, 70, 18);
    });

    // Bird (Stylized bantLo Square with neon glow and wing flapping)
    const birdX = GAME_WIDTH / 2;
    ctx.save();
    ctx.translate(birdX, bird.current.y);
    const rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 6, bird.current.v * 0.06));
    ctx.rotate(rotation);
    
    // Shadow glow
    ctx.shadowColor = '#00ff66';
    ctx.shadowBlur = 15;
    
    // Outer Border (Neon Green/White)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#00ff66';
    ctx.lineWidth = 3;
    
    // Rounded body
    const size = bird.current.r * 2;
    ctx.beginPath();
    ctx.roundRect(-bird.current.r, -bird.current.r, size, size, 6);
    ctx.fill();
    ctx.stroke();
    
    // Eye
    ctx.shadowBlur = 0; 
    ctx.fillStyle = '#0a0a0a';
    ctx.beginPath();
    ctx.arc(bird.current.r * 0.3, -bird.current.r * 0.3, 3.5, 0, Math.PI * 2);
    ctx.fill();
    
    // Flapping Wing
    const wingOffset = Math.sin(Date.now() * 0.015) * 3;
    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.roundRect(-bird.current.r * 0.8, -bird.current.r * 0.2 + wingOffset, bird.current.r * 0.8, bird.current.r * 0.6, 3);
    ctx.fill();
    ctx.stroke();
    
    ctx.restore();
    if (isShaking) ctx.restore();
  };

  useEffect(() => {
    let active = true;
    const loop = (timestamp: number) => {
      if (!active) return;

      if (lastTime.current === null) {
        lastTime.current = timestamp;
      }
      const dtMs = timestamp - lastTime.current;
      lastTime.current = timestamp;

      // Cap delta time to prevent spiral of death
      const clampedDtMs = Math.min(100, dtMs);
      physicsAccumulator.current += clampedDtMs;

      // Run fixed timestep logic
      while (physicsAccumulator.current >= PHYSICS_TS) {
        update(1.0);
        physicsAccumulator.current -= PHYSICS_TS;
      }

      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) draw(ctx);
      }
      frameId.current = requestAnimationFrame(loop);
    };
    frameId.current = requestAnimationFrame(loop);
    return () => {
      active = false;
      cancelAnimationFrame(frameId.current);
    };
  }, []);

  return (
    <div 
      style={{ 
        position: 'fixed', top: 0, left: 0, 
        width: '100%', 
        height: '100dvh', 
        zIndex: 10000, 
        backgroundColor: '#050505',
        overflow: 'hidden',
        touchAction: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}
      onTouchStart={(e) => {
        if (!(e.target as HTMLElement).closest('button')) {
          e.preventDefault();
          jump();
        }
      }}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button')) {
          jump();
        }
      }}
    >
      {/* Centered Arcade Window */}
      <div 
        style={{ 
          position: 'relative', 
          width: 'min(100vw, 480px, calc(100dvh * 0.6))', 
          height: 'min(100dvh, 800px, calc(100vw / 0.6))', 
          border: '4px solid #333', 
          boxShadow: '0 0 40px rgba(0, 255, 102, 0.15)',
          background: 'black',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          overflow: 'hidden'
        }}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button')) {
            e.stopPropagation();
          }
        }}
      >
        <canvas 
          ref={canvasRef} 
          width={GAME_WIDTH}
          height={GAME_HEIGHT}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
        
        {/* HUD */}
        {gameState === 'PLAYING' && (
          <div style={{ position: 'absolute', top: '2rem', left: 0, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
            <p style={{ margin: 0, fontSize: '3.5rem', fontWeight: 900, color: 'white', textShadow: '4px 4px 0px #00ff66' }}>{score}</p>
            <p style={{ margin: 0, fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>High Score: {highScore}</p>
          </div>
        )}

        {gameState === 'START' && (
          <div 
            style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              backdropFilter: 'blur(8px) brightness(0.5)',
              zIndex: 10001
            }}
          >
            <div style={{ textAlign: 'center', width: '85%', maxWidth: '380px' }}>
              <h1 className="np-title" style={{ fontSize: '3rem', marginBottom: '0.5rem', border: 'none', fontWeight: 900, letterSpacing: '-2px', textShadow: '0 0 15px rgba(0, 255, 102, 0.2)' }}>FLAPPY<br/><span style={{ color: 'var(--text-accent)' }}>BANT</span></h1>
              <p className="np-text-muted" style={{ marginBottom: '2.5rem', fontSize: '0.8rem', letterSpacing: '1.5px' }}>TAP OR PRESS SPACE TO JUMP</p>
              
              <div className="np-section" style={{ borderStyle: 'solid', borderWidth: '3px', marginBottom: '2rem', background: '#000', borderColor: 'var(--border-color)', boxShadow: '8px 8px 0px rgba(0, 255, 102, 0.3)' }}>
                <p style={{ margin: 0, fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Current Record</p>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '1.8rem', fontWeight: 900, color: 'white' }}>{highScore}</p>
              </div>

              <NeoButton 
                onClick={(e) => { e.stopPropagation(); resetGame(); }} 
                variant="primary" 
                style={{ width: '100%', height: '3.5rem', fontSize: '1.1rem', borderColor: 'var(--text-accent)', color: '#000', backgroundColor: 'var(--text-accent)' }}
              >
                START GAME
              </NeoButton>
              <NeoButton 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                style={{ width: '100%', marginTop: '1rem', border: '2px solid #333', color: 'var(--text-secondary)' }}
              >
                EXIT
              </NeoButton>
            </div>
          </div>
        )}

        {gameState === 'OVER' && (
          <div 
            style={{ 
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
              display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center',
              backdropFilter: 'blur(12px) brightness(0.4)',
              transition: 'backdrop-filter 0.5s ease',
              zIndex: 10001
            }}
          >
            <div style={{ textAlign: 'center', width: '85%', maxWidth: '380px' }}>
              <h1 className="np-title" style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--text-danger)', border: 'none', fontWeight: 900, textShadow: '0 0 10px rgba(255, 51, 102, 0.3)' }}>CRASHED!</h1>
              <div className="np-section" style={{ borderStyle: 'solid', borderWidth: '3px', marginBottom: '2rem', background: '#000', borderColor: 'var(--border-color)', boxShadow: '8px 8px 0px rgba(255, 51, 102, 0.5)' }}>
                <p style={{ margin: 0, fontSize: '1.2rem', color: 'white', fontWeight: 700 }}>Final Score: <strong style={{ color: 'var(--text-accent)' }}>{score}</strong></p>
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Best Protocol Run: {highScore}</p>
                {score >= highScore && score > 0 && <p style={{ color: 'var(--text-accent)', fontSize: '0.8rem', marginTop: '0.75rem', fontWeight: 'bold' }}>NEW SYSTEM RECORD! 🏆</p>}
              </div>
              <NeoButton 
                onClick={(e) => { e.stopPropagation(); resetGame(); }} 
                variant="primary" 
                style={{ width: '100%', height: '3.5rem', fontSize: '1rem', borderColor: 'var(--text-accent)', color: '#000', backgroundColor: 'var(--text-accent)' }}
              >
                RETRY MISSION
              </NeoButton>
              <NeoButton 
                onClick={(e) => { e.stopPropagation(); onClose(); }} 
                style={{ width: '100%', marginTop: '1rem', border: '2px solid #333', color: 'var(--text-secondary)' }}
              >
                EXIT TO DASHBOARD
              </NeoButton>
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: '2rem', width: '100%', textAlign: 'center', pointerEvents: 'none', opacity: 0.3 }}>
          <p style={{ fontSize: '0.6rem', textTransform: 'uppercase', color: 'white' }}>Protocol v1.9.14 / Easter Egg</p>
        </div>
      </div>
    </div>
  );
}
