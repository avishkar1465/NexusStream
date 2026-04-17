import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { Image as ImageIcon, UploadCloud, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function ImageValidation() {
  const navigate = useNavigate();
  const [imageMode, setImageMode] = useState({
    files: [],
    loading: false,
    error: null
  });

  const handleImageUpload = async () => {
    if (!imageMode.files.length) return;
    
    setImageMode(prev => ({ ...prev, loading: true, error: null }));
    const formData = new FormData();
    Array.from(imageMode.files).forEach(f => {
      formData.append('images', f);
    });

    try {
      await axios.post(`${API_BASE}/validate-image`, formData, { withCredentials: true });
      navigate('/dashboard');
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
                setImageMode(prev => ({ ...prev, files: e.target.files }));
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
      </div>
    </div>
  );
}
