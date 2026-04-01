import React from 'react';
import { Link } from 'react-router-dom';
import { Database, Zap, Shield, Cpu, ArrowRight } from 'lucide-react';

export default function LandingPage() {
  return (
    <div style={{ paddingBottom: '4rem' }}>
      {/* Hero Section */}
      <div style={{ textAlign: 'center', margin: '4rem 0 6rem 0' }}>
        <div style={{ display: 'inline-block', marginBottom: '1.5rem', padding: '0.5rem 1rem', background: 'rgba(0, 240, 255, 0.1)', border: '1px solid var(--accent-cyan)', borderRadius: '50px', color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono', fontSize: '0.85rem' }}>
          <Zap size={14} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
          NEXUS_STREAM_OS v4.2 ONLINE
        </div>
        <h1 style={{ fontSize: '4.5rem', lineHeight: '1.1', marginBottom: '1.5rem' }}>
          The Future of <span className="text-gradient">Data Quality</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.3rem', maxWidth: '700px', margin: '0 auto 3rem auto', lineHeight: '1.6' }}>
          Autonomous multi-modal data validation. Empowering the decentralized economy with research-backed metrics to secure the ultimate data marketplace.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem' }}>
          <Link to="/auth" className="btn" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.5rem', width: 'auto' }}>
            START PLATFORM <ArrowRight size={18} />
          </Link>
          <Link to="/text-validation" className="btn" style={{ textDecoration: 'none', background: 'transparent', borderColor: 'var(--border-color)', width: 'auto' }}>
            TEST DEMO
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '6rem' }}>
        <div className="panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ background: 'var(--glow-cyan)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <Cpu size={32} color="var(--accent-cyan)" />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Deep-Feature Metrics</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Evaluate data using robust neural models like Strided-Context GPT2 Perplexity and BRISQUE Natural Scene Statistics.
          </p>
        </div>
        <div className="panel" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ background: 'var(--glow-magenta)', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
            <Shield size={32} color="var(--accent-magenta)" />
          </div>
          <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Sybil Resistance</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: '1.6' }}>
            Instantly detect adversarial noise, bot-generated garbage, and corrupted modal inputs without human oversight.
          </p>
        </div>
      </div>
      
      {/* Visual Data Flow Section */}
      <div className="panel" style={{ padding: '4rem 2rem', border: '1px solid var(--accent-purple)' }}>
        <div className="data-decorator">SYS//ARCH_TOPOLOGY</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '2rem' }}>
          <div style={{ flex: '1 1 400px' }}>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Enterprise-Grade <span style={{ color: 'var(--accent-purple)' }}>Scaling</span></h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', lineHeight: '1.6', marginBottom: '2rem' }}>
              Designed for high-throughput batch validation. NexusStream enables scalable ingestion pipelines securely processing thousands of text blobs and images in real-time.
            </p>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <Link to="/image-validation" className="btn" style={{ textDecoration: 'none', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', width: 'auto' }}>
                IMAGE
              </Link>
              <Link to="/audio-validation" className="btn" style={{ textDecoration: 'none', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', width: 'auto' }}>
                AUDIO
              </Link>
              <Link to="/video-validation" className="btn" style={{ textDecoration: 'none', borderColor: 'var(--accent-purple)', color: 'var(--accent-purple)', width: 'auto' }}>
                VIDEO
              </Link>
            </div>
          </div>
          <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
            <Database size={150} color="var(--accent-purple)" style={{ opacity: 0.8, filter: 'drop-shadow(0 0 30px rgba(157, 0, 255, 0.4))' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
