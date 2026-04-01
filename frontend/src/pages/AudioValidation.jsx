import React, { useState } from 'react';
import axios from 'axios';
import { Volume2, UploadCloud, CheckCircle, AlertTriangle, Activity } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function AudioValidation() {
  const [audioMode, setAudioMode] = useState({
    file: null,
    loading: false,
    result: null,
    error: null
  });

  const handleAudioUpload = async () => {
    if (!audioMode.file) return;
    
    setAudioMode(prev => ({ ...prev, loading: true, error: null, result: null }));
    const formData = new FormData();
    formData.append('audio', audioMode.file);

    try {
      const res = await axios.post(`${API_BASE}/validate-audio`, formData);
      setAudioMode(prev => ({ ...prev, loading: false, result: res.data }));
    } catch (err) {
      setAudioMode(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.response?.data?.error || 'Validation failed. Ensure backend is running.'
      }));
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          Audio <span className="text-gradient">Validation</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Evaluate deep audio features using DNSMOS (Deep Noise Suppression MOS) to filter out static, poor recording equipment, and background noise.
        </p>
      </div>

      <div className="panel" style={{ margin: '0 auto' }}>
        <div className="data-decorator">OPT//AUD_ANALYZE_DNSMOS</div>
        <h2 className="panel-header">
          <Volume2 size={24} color="var(--accent-cyan)" />
          Audio Validation (DNSMOS)
        </h2>
        
        <div className={`upload-area ${audioMode.file ? 'active' : ''}`}>
          <input 
            type="file" 
            accept="audio/*"
            onChange={(e) => {
              if(e.target.files.length > 0) {
                setAudioMode(prev => ({ ...prev, file: e.target.files[0], result: null }));
              }
            }}
          />
          <UploadCloud className="upload-icon" />
          <h3>Drop audio file here</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {audioMode.file ? audioMode.file.name : 'or click to browse local storage'}
          </p>
        </div>

        <button 
          className="btn" 
          onClick={handleAudioUpload}
          disabled={!audioMode.file || audioMode.loading}
        >
          {audioMode.loading ? (
            <><span className="loader"></span> ANALYZING_WAVEFORM...</>
          ) : 'INITIATE VALIDATION'}
        </button>

        {audioMode.error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <AlertTriangle size={18} /> {audioMode.error}
            </div>
          </div>
        )}

        {audioMode.result && (
          <div className="result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: audioMode.result.status ? 'var(--accent-cyan)' : 'var(--accent-magenta)' }}>
              {audioMode.result.status ? <CheckCircle size={20} /> : <AlertTriangle size={20} />} 
              <span className="font-mono">{audioMode.result.result.toUpperCase()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Model Target</span>
              <span className="stat-value">DNSMOS (P.808 mapping)</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Background Noise Quality</span>
              <span className="stat-value">{audioMode.result.scores.background_noise.toFixed(2)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Speech Quality (SIG)</span>
              <span className="stat-value">{audioMode.result.scores.speech_quality.toFixed(2)}</span>
            </div>
            <div className="stat-row" style={{ marginTop: '1rem' }}>
              <span className="stat-label" style={{ fontSize: '1.2rem', color: '#fff' }}>Overall Quality</span>
              <span className="stat-value highlight">{audioMode.result.scores.overall_quality.toFixed(2)}</span>
            </div>
            
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Activity size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/>
              DNSMOS scores range from 1 to 5. Higher scores indicate superior perceptual audio clarity.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
