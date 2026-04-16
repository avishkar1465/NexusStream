import React, { useState } from 'react';
import axios from 'axios';
import { Film, UploadCloud, CheckCircle, AlertTriangle, MonitorPlay } from 'lucide-react';
import Gauge from '../components/Gauge';

const API_BASE = 'http://localhost:5000';

export default function VideoValidation() {
  const [videoMode, setVideoMode] = useState({
    file: null,
    loading: false,
    result: null,
    error: null
  });

  const handleVideoUpload = async () => {
    if (!videoMode.file) return;
    
    setVideoMode(prev => ({ ...prev, loading: true, error: null, result: null }));
    const formData = new FormData();
    formData.append('video', videoMode.file);

    try {
      const res = await axios.post(`${API_BASE}/validate-video`, formData, { withCredentials: true });
      const taskId = res.data.task_id;
      
      const pollTimer = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE}/task-status/${taskId}`, { withCredentials: true });
          const state = statusRes.data.state;
          if (state === 'SUCCESS') {
            clearInterval(pollTimer);
            setVideoMode(prev => ({ ...prev, loading: false, result: statusRes.data.result }));
          } else if (state === 'FAILURE') {
            clearInterval(pollTimer);
            setVideoMode(prev => ({ ...prev, loading: false, error: statusRes.data.error || 'Validation failed.' }));
          }
        } catch (e) {
          clearInterval(pollTimer);
          setVideoMode(prev => ({ ...prev, loading: false, error: 'Error polling task status.' }));
        }
      }, 2000);

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
          Video Validation (NIQE)
        </h2>
        
        <div className={`upload-area ${videoMode.file ? 'active' : ''}`}>
          <input 
            type="file" 
            accept="video/*"
            onChange={(e) => {
              if(e.target.files.length > 0) {
                setVideoMode(prev => ({ ...prev, file: e.target.files[0], result: null }));
              }
            }}
          />
          <UploadCloud className="upload-icon" />
          <h3>Drop video file here (.mp4, .avi, etc)</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {videoMode.file ? videoMode.file.name : 'or click to browse local storage'}
          </p>
        </div>

        <button 
          className="btn" 
          onClick={handleVideoUpload}
          disabled={!videoMode.file || videoMode.loading}
        >
          {videoMode.loading ? (
            <><span className="loader"></span> EXTRACTING_NSS_FRAMES...</>
          ) : 'INITIATE VALIDATION'}
        </button>

        {videoMode.error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <AlertTriangle size={18} /> {videoMode.error}
            </div>
          </div>
        )}

        {videoMode.result && (
          <div className="result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: videoMode.result.status ? 'var(--accent-cyan)' : 'var(--accent-magenta)' }}>
              {videoMode.result.status ? <CheckCircle size={20} /> : <AlertTriangle size={20} />} 
              <span className="font-mono">{videoMode.result.result.toUpperCase()}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Model Target</span>
              <span className="stat-value">Temporal NIQE (PyIQA)</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Frames Analyzed</span>
              <span className="stat-value">{videoMode.result.scores.frames_analyzed}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Average Score (Mean)</span>
              <span className="stat-value">{videoMode.result.scores.niqe_mean.toFixed(2)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Peak Distortion (Worst)</span>
              <span className="stat-value" style={{color: 'var(--accent-magenta)'}}>{videoMode.result.scores.niqe_worst.toFixed(2)}</span>
            </div>
            <div className="stat-row" style={{ marginTop: '1rem' }}>
              <span className="stat-label" style={{ fontSize: '1.2rem', color: '#fff' }}>85th Percentile Score</span>
              <span className="stat-value highlight">{videoMode.result.scores.niqe_p85.toFixed(2)}</span>
            </div>
            
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <MonitorPlay size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/>
              Lower NIQE score corresponds to superior perceptual visual quality.
            </div>

            <Gauge 
              value={videoMode.result.scores.niqe_p85} 
              min={0} 
              max={15} 
              label="NIQE (p85)" 
              invert={true} 
              levels={[
                { label: 'Optimal', range: '< 5.0', color: 'var(--accent-cyan)' },
                { label: 'Stable', range: '5.0 - 7.5', color: '#FFCC00' },
                { label: 'Critical', range: '> 7.5', color: 'var(--accent-magenta)' }
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
