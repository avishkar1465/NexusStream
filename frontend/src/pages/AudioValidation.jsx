import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Volume2, UploadCloud, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function AudioValidation() {
  const navigate = useNavigate();
  const [audioMode, setAudioMode] = useState({
    files: [],
    loading: false,
    error: null
  });

  const handleAudioUpload = async () => {
    if (!audioMode.files.length) return;
    
    setAudioMode(prev => ({ ...prev, loading: true, error: null }));
    const formData = new FormData();
    Array.from(audioMode.files).forEach(file => {
      formData.append('audio', file);
    });

    try {
      await axios.post(`${API_BASE}/validate-audio`, formData, { withCredentials: true });
      navigate('/dashboard');
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
          Audio Validation (DNSMOS Batch)
        </h2>
        
        <div className={`upload-area ${audioMode.files.length ? 'active' : ''}`}>
          <input 
            type="file" 
            multiple
            accept="audio/*"
            onChange={(e) => {
              if(e.target.files.length > 0) {
                setAudioMode(prev => ({ ...prev, files: e.target.files }));
              }
            }}
          />
          <UploadCloud className="upload-icon" />
          <h3>Drop audio files here</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {audioMode.files.length ? `${audioMode.files.length} audio files selected` : 'or click to browse local storage'}
          </p>
        </div>

        <button 
          className="btn" 
          onClick={handleAudioUpload}
          disabled={!audioMode.files.length || audioMode.loading}
        >
          {audioMode.loading ? (
            <><span className="loader"></span> ANALYZING_AUDIO_BATCH...</>
          ) : 'RUN AUDIO BATCH'}
        </button>

        {audioMode.error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <AlertTriangle size={18} /> {audioMode.error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
