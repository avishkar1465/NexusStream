import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Film, UploadCloud, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function VideoValidation() {
  const navigate = useNavigate();
  const [videoMode, setVideoMode] = useState({
    files: [],
    loading: false,
    error: null
  });

  const handleVideoUpload = async () => {
    if (!videoMode.files.length) return;
    
    setVideoMode(prev => ({ ...prev, loading: true, error: null }));
    const formData = new FormData();
    Array.from(videoMode.files).forEach(file => {
      formData.append('video', file);
    });

    try {
      await axios.post(`${API_BASE}/validate-video`, formData, { withCredentials: true });
      navigate('/dashboard');
    } catch (err) {
      setVideoMode(prev => ({ 
        ...prev, 
        loading: false, 
        error: err.response?.data?.error || 'Validation failed. Ensure backend is running and valid.'
      }));
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div style={{ marginBottom: '3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          Video <span className="text-gradient">Validation</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Evaluate raw video fidelity by temporally assessing Natural Scene Statistics (NIQE) across frames to detect blur, blockiness, and heavy compression.
        </p>
      </div>

      <div className="panel" style={{ margin: '0 auto' }}>
        <div className="data-decorator">OPT//VID_ANALYZE_NIQE</div>
        <h2 className="panel-header">
          <Film size={24} color="var(--accent-purple)" />
          Video Validation (NIQE Batch)
        </h2>
        
        <div className={`upload-area ${videoMode.files.length ? 'active' : ''}`}>
          <input 
            type="file" 
            multiple
            accept="video/*"
            onChange={(e) => {
              if(e.target.files.length > 0) {
                setVideoMode(prev => ({ ...prev, files: e.target.files }));
              }
            }}
          />
          <UploadCloud className="upload-icon" />
          <h3>Drop video files here (.mp4, .avi, etc)</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {videoMode.files.length ? `${videoMode.files.length} video files selected` : 'or click to browse local storage'}
          </p>
        </div>

        <button 
          className="btn" 
          onClick={handleVideoUpload}
          disabled={!videoMode.files.length || videoMode.loading}
        >
          {videoMode.loading ? (
            <><span className="loader"></span> EXTRACTING_BATCH_FRAMES...</>
          ) : 'RUN VIDEO BATCH'}
        </button>

        {videoMode.error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <AlertTriangle size={18} /> {videoMode.error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
