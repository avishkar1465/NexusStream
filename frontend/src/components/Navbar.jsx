import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Activity, Download, LayoutDashboard, Store, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const getLinkClass = (path) => {
    return location.pathname === path ? "nav-link active" : "nav-link";
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <header className="header" style={{ marginBottom: '3rem' }}>
      <Link to="/" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="header-logo">
          <Activity className="logo-icon" size={32} />
          <span>Nexus<span className="text-gradient">Stream</span></span>
        </div>
      </Link>
      
      <nav className="nav-shell">
        <div className="nav-links-row">
          <Link to="/text-validation" className={getLinkClass("/text-validation")}>TEXT</Link>
          <Link to="/image-validation" className={getLinkClass("/image-validation")}>IMAGE</Link>
          <Link to="/audio-validation" className={getLinkClass("/audio-validation")}>AUDIO</Link>
          <Link to="/video-validation" className={getLinkClass("/video-validation")}>VIDEO</Link>
          <Link to="/dashboard" className={getLinkClass("/dashboard")} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <LayoutDashboard size={15} /> DASHBOARD
          </Link>
          <Link to="/marketplace" className={getLinkClass("/marketplace")} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Store size={15} /> MARKET
          </Link>
          <Link to="/my-datasets" className={getLinkClass("/my-datasets")} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Download size={15} /> MY DATASETS
          </Link>
        </div>
        <div className="nav-meta-row">
          <div className="font-mono" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <span style={{ color: 'var(--accent-cyan)' }}>SYS.STATUS:</span> ONLINE_
          </div>
        
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={16} /> {user.username}
              </span>
              <button onClick={handleLogout} className="btn" style={{ padding: '0.5rem 1rem', borderColor: 'var(--accent-magenta)', color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
                LOGOUT <LogOut size={14} />
              </button>
            </div>
          ) : (
            <Link to="/auth" className="btn" style={{ padding: '0.5rem 1.5rem', textDecoration: 'none', width: 'auto' }}>
              LOGIN
            </Link>
          )}
        </div>
      </nav>
      
      <style>{`
        .nav-shell {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 0.9rem;
          max-width: 760px;
        }
        .nav-links-row {
          display: flex;
          gap: 1.1rem;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .nav-meta-row {
          display: flex;
          gap: 1rem;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
        }
        .nav-link {
          color: var(--text-main);
          font-family: 'JetBrains Mono', monospace;
          text-decoration: none;
          font-size: 0.9rem;
          transition: all 0.3s;
          padding: 0.35rem 0.45rem;
          border-bottom: 2px solid transparent;
        }
        .nav-link:hover {
          color: var(--accent-cyan);
          text-shadow: 0 0 10px var(--glow-cyan);
        }
        .nav-link.active {
          color: var(--accent-cyan);
          border-bottom: 2px solid var(--accent-cyan);
        }
        @media (max-width: 960px) {
          .nav-shell {
            align-items: stretch;
            width: 100%;
          }
          .nav-links-row, .nav-meta-row {
            justify-content: flex-start;
          }
        }
      `}</style>
    </header>
  );
}
