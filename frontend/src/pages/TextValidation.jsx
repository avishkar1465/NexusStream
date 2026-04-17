import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { FileText, UploadCloud, AlertTriangle } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function TextValidation() {
  const navigate = useNavigate();
  const [textMode, setTextMode] = useState({
    file: null,
    loading: false,
    error: null
  });

  const handleTextUpload = async () => {
    if (!textMode.file) return;
    
    setTextMode(prev => ({ ...prev, loading: true, error: null }));
    const formData = new FormData();
    formData.append('file', textMode.file);

    try {
      await axios.post(`${API_BASE}/validate-text`, formData, { withCredentials: true });
      navigate('/dashboard');
    } catch (err) {
      setTextMode(prev => ({ 
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
          Text <span className="text-gradient">Validation</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
          Analyze text datasets using GPT-2 Perplexity metrics to ensure high-quality, human-like density.
        </p>
      </div>

      <div className="panel" style={{ margin: '0 auto' }}>
        <div className="data-decorator">OPT//TEXT_ANALYZE_GPT2</div>
        <h2 className="panel-header">
          <FileText size={24} color="var(--accent-purple)" />
          Text Validation (Perplexity)
        </h2>
        
        <div className={`upload-area ${textMode.file ? 'active' : ''}`}>
          <input 
            type="file" 
            accept=".txt"
            onChange={(e) => {
              if(e.target.files.length > 0) {
                setTextMode(prev => ({ ...prev, file: e.target.files[0] }));
              }
            }}
          />
          <UploadCloud className="upload-icon" />
          <h3>Drop .txt file here</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', fontSize: '0.9rem' }}>
            {textMode.file ? textMode.file.name : 'or click to browse local storage'}
          </p>
        </div>

        <button 
          className="btn" 
          onClick={handleTextUpload}
          disabled={!textMode.file || textMode.loading}
        >
          {textMode.loading ? (
            <><span className="loader"></span> ANALYZING_SEQUENCE...</>
          ) : 'INITIATE VALIDATION'}
        </button>

        {textMode.error && (
          <div className="result-card" style={{borderColor: 'var(--accent-magenta)'}}>
            <div style={{color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem'}}>
              <AlertTriangle size={18} /> {textMode.error}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
