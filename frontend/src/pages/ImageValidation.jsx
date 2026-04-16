import React, { useState } from 'react';
import axios from 'axios';
import { Image as ImageIcon, UploadCloud, CheckCircle, AlertTriangle, Database } from 'lucide-react';
import Gauge from '../components/Gauge';

const API_BASE = 'http://localhost:5000';

export default function ImageValidation() {
  const [imageMode, setImageMode] = useState({
    files: [],
    loading: false,
    result: null,
    error: null
  });

  const handleImageUpload = async () => {
    if (!imageMode.files.length) return;
    
    setImageMode(prev => ({ ...prev, loading: true, error: null, result: null }));
    const formData = new FormData();
    Array.from(imageMode.files).forEach(f => {
      formData.append('images', f);
    });

    try {
      const res = await axios.post(`${API_BASE}/validate-image`, formData, { withCredentials: true });
      const taskId = res.data.task_id;
      
      const pollTimer = setInterval(async () => {
        try {
          const statusRes = await axios.get(`${API_BASE}/task-status/${taskId}`, { withCredentials: true });
          const state = statusRes.data.state;
          if (state === 'SUCCESS') {
            clearInterval(pollTimer);
            setImageMode(prev => ({ ...prev, loading: false, result: statusRes.data.result }));
          } else if (state === 'FAILURE') {
            clearInterval(pollTimer);
            setImageMode(prev => ({ ...prev, loading: false, error: statusRes.data.error || 'Validation failed.' }));
          }
        } catch (e) {
          clearInterval(pollTimer);
          setImageMode(prev => ({ ...prev, loading: false, error: 'Error polling task status.' }));
        }
      }, 2000);

    } catch (err) {
      setImageMode(prev => ({ 
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
          Image <span className="text-gradient">Validation</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Evaluate perceptual image quality natively using BRISQUE Natural Scene Statistics without a reference image.
        </p>
      </div>

      <div className="panel" style={{ margin: '0 auto' }}>
        <div className="data-decorator">OPT//IMG_ANALYZE_BRISQUE</div>
        <h2 className="panel-header">
          <ImageIcon size={24} color="var(--accent-cyan)" />
          Image Validation (BRISQUE)
        </h2>
        
        <div className={`upload-area ${imageMode.files.length > 0 ? 'active' : ''}`}>
          <input 
            type="file" 
            multiple
            accept="image/*"
            onChange={(e) => {
              if(e.target.files.length > 0) {
                setImageMode(prev => ({ ...prev, files: e.target.files, result: null }));
              }
            }}
          />
          <UploadCloud className="upload-icon" />
          <h3>Drop Images here</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {imageMode.files.length > 0 
              ? `${imageMode.files.length} images selected based on spatial stats` 
              : 'Supports batched Natural Scene Statistics modeling'}
          </p>
        </div>

        <button 
          className="btn" 
          onClick={handleImageUpload}
          disabled={!imageMode.files.length || imageMode.loading}
        >
          {imageMode.loading ? (
            <><span className="loader"></span> EXTRACTING_FEATURES...</>
          ) : 'RUN BATCH VALIDATION'}
        </button>

        {imageMode.error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <AlertTriangle size={18} /> {imageMode.error}
            </div>
          </div>
        )}

        {imageMode.result && (
          <div className="result-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--accent-cyan)' }}>
              <CheckCircle size={20} /> <span className="font-mono">BATCH PROCESSING DONE</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Total Images Scored</span>
              <span className="stat-value">{imageMode.result.results.total_images}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Dataset Mean Score</span>
              <span className="stat-value">{imageMode.result.results.dataset_mean.toFixed(2)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Best Score (Lowest)</span>
              <span className="stat-value" style={{color: '#00ffaa'}}>{imageMode.result.results.best_score.toFixed(2)}</span>
            </div>
            <div className="stat-row">
              <span className="stat-label">Worst Score (Highest)</span>
              <span className="stat-value" style={{color: 'var(--accent-magenta)'}}>{imageMode.result.results.worst_score.toFixed(2)}</span>
            </div>
            
            <div style={{ marginTop: '1rem', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <Database size={14} style={{verticalAlign: 'middle', marginRight: '4px'}}/>
              Lower BRISQUE score corresponds to superior perceptual image quality.
            </div>

            <Gauge 
              value={imageMode.result.results.dataset_mean} 
              min={0} 
              max={100} 
              label="BRISQUE Mean" 
              invert={true} 
              levels={[
                { label: 'Optimal', range: '< 30', color: 'var(--accent-cyan)' },
                { label: 'Stable', range: '30 - 50', color: '#FFCC00' },
                { label: 'Critical', range: '> 50', color: 'var(--accent-magenta)' }
              ]}
            />
          </div>
        )}
      </div>
    </div>
  );
}
