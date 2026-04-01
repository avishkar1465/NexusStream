import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import TextValidation from './pages/TextValidation';
import ImageValidation from './pages/ImageValidation';
import AudioValidation from './pages/AudioValidation';
import VideoValidation from './pages/VideoValidation';
import { Cpu } from 'lucide-react';

function App() {
  return (
    <Router>
      <div className="container">
        <Navbar />

        <div style={{ flex: '1 0 auto' }}>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/text-validation" element={<TextValidation />} />
            <Route path="/image-validation" element={<ImageValidation />} />
            <Route path="/audio-validation" element={<AudioValidation />} />
            <Route path="/video-validation" element={<VideoValidation />} />
          </Routes>
        </div>
        
        <footer style={{ marginTop: '4rem', paddingBottom: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Cpu size={14} style={{ verticalAlign: 'middle', marginRight: '0.5rem' }} />
          Neural Model Endpoints Active • Node.js Engine • React Dashboard
        </footer>
      </div>
    </Router>
  );
}

export default App;
