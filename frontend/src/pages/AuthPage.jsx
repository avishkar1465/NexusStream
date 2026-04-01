import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, User, Lock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  const { checkAuth } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const endpoint = isLogin ? '/login' : '/register';
      const payload = { username, password };

      await axios.post(`${API_BASE}${endpoint}`, payload);
      
      if (!isLogin) {
        // Auto-login after successful registration
        await axios.post(`${API_BASE}/login`, payload);
      }
      
      // Update our global user context before navigating
      await checkAuth();
      
      // Success. Navigate away
      navigate('/text-validation');
      
    } catch (err) {
      setError(err.response?.data?.error || "Connection error. Ensure the backend is active.");
    } finally {
      if(isLogin || !isLogin) {
         setLoading(false);
      }
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <div className="panel" style={{ maxWidth: '450px', width: '100%', padding: '3rem 2.5rem' }}>
        <div className="data-decorator" style={{ writingMode: 'horizontal-tb', right: '10px', top: '10px', letterSpacing: '2px' }}>
          {isLogin ? 'AUTH//LOGIN_SEQ' : 'AUTH//REGISTER_SEQ'}
        </div>
        
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <ShieldAlert size={48} color={isLogin ? "var(--accent-cyan)" : "var(--accent-magenta)"} style={{ marginBottom: '1rem', filter: `drop-shadow(0 0 10px ${isLogin ? 'var(--glow-cyan)' : 'var(--glow-magenta)'})` }} />
          <h2 style={{ fontSize: '2rem' }}>
            {isLogin ? 'System Login' : 'Create Identity'}
          </h2>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {isLogin ? 'Enter your credentials to access the terminal' : 'Register a new node on the network'}
          </p>
        </div>

        {error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)', padding: '0.75rem', marginTop: 0, marginBottom: '1.5rem'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem'}}>
              <AlertTriangle size={18} /> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="input-group">
            <User className="input-icon" size={20} />
            <input 
              type="text" 
              placeholder="Username" 
              required 
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>
          
          <div className="input-group">
            <Lock className="input-icon" size={20} />
            <input 
              type="password" 
              placeholder="Passkey" 
              required 
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button type="submit" className="btn" disabled={loading} style={{ 
            marginTop: '1rem', 
            borderColor: isLogin ? 'var(--accent-cyan)' : 'var(--accent-magenta)'
          }}>
            {loading ? <span className="loader"></span> : (isLogin ? 'INITIATE LOGIN' : 'INITIALIZE NODE')}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>
            {isLogin ? "Don't have access? " : "Already registered? "}
          </span>
          <button 
            type="button"
            onClick={() => {
              setIsLogin(!isLogin);
              setError(null);
            }}
            style={{ 
              background: 'none', 
              border: 'none', 
              color: isLogin ? 'var(--accent-magenta)' : 'var(--accent-cyan)', 
              cursor: 'pointer', 
              fontFamily: 'inherit',
              textDecoration: 'underline'
            }}
          >
            {isLogin ? 'CREATE IDENTITY' : 'ACCESS TERMINAL'}
          </button>
        </div>
        
        <style>{`
          .input-group {
            position: relative;
            width: 100%;
          }
          .input-icon {
            position: absolute;
            left: 1rem;
            top: 50%;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
          }
          .input-group input {
            width: 100%;
            padding: 1rem 1rem 1rem 3rem;
            background: rgba(0,0,0,0.3);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            color: var(--text-main);
            font-family: 'JetBrains Mono', monospace;
            transition: all 0.3s;
          }
          .input-group input:focus {
            outline: none;
            border-color: var(--text-main);
            background: rgba(0, 240, 255, 0.05);
          }
          .input-group input::placeholder {
            color: var(--text-muted);
            opacity: 0.5;
          }
        `}</style>
      </div>
    </div>
  );
}
