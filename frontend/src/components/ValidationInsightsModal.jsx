import React from 'react';
import { CheckCircle, AlertTriangle, Database, MonitorPlay, Volume2, X } from 'lucide-react';
import Gauge from './Gauge';
import { formatIstTimestamp } from '../utils/time';

function textInsights(job) {
  const summary = job?.result?.summary || {};
  const result = job?.result?.result || {};
  const files = job?.result?.files || [];
  const perplexity = Number(
    summary.average_perplexity ?? result.perplexity ?? 0
  );

  return (
    <>
      <div className="result-card" style={{ marginTop: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            marginBottom: '1rem',
            color: job.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
          }}
        >
          {job.status === 'validated' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span className="font-mono">
            {job.status === 'validated' ? 'VALIDATION COMPLETE' : 'VALIDATION REJECTED'}
          </span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Model Target</span>
          <span className="stat-value">GPT-2 (Strided Context)</span>
        </div>
        <div className="stat-row">
          <span className="stat-label">Metric</span>
          <span className="stat-value">Exp Neg-Log-Likelihood</span>
        </div>
        {summary.total_files ? (
          <div className="stat-row">
            <span className="stat-label">Accepted Files</span>
            <span className="stat-value">
              {summary.accepted_files} / {summary.total_files}
            </span>
          </div>
        ) : null}
        <div className="stat-row" style={{ marginTop: '1rem' }}>
          <span className="stat-label" style={{ fontSize: '1.2rem', color: '#fff' }}>
            {files.length > 1 ? 'Average Perplexity' : 'Perplexity Score'}
          </span>
          <span className="stat-value highlight">{perplexity.toFixed(2)}</span>
        </div>
        <div
          style={{
            marginTop: '1rem',
            padding: '0.75rem',
            background: 'rgba(255,255,255,0.05)',
            borderRadius: '4px',
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
          }}
        >
          {perplexity < 60
            ? 'Optimal human-like textual density detected.'
            : 'High perplexity: possible bot-generated or anomalous text structure.'}
        </div>
        <Gauge
          value={perplexity}
          min={0}
          max={200}
          label="Perplexity"
          invert={true}
          levels={[
            { label: 'Optimal', range: '< 60', color: 'var(--accent-cyan)' },
            { label: 'Stable', range: '60 - 100', color: '#FFCC00' },
            { label: 'Critical', range: '> 100', color: 'var(--accent-magenta)' },
          ]}
        />
        {!!files.length && files.length > 1 && (
          <div style={{ marginTop: '1.5rem' }}>
            <div className="legend-header" style={{ marginBottom: '0.75rem' }}>
              Per File Breakdown
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {files.map((file, index) => (
                <div key={`${file.filename}-${index}`} className="metric-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                    <div className="metric-value" style={{ marginTop: 0 }}>
                      {file.filename}
                    </div>
                    <div
                      className="status-pill"
                      style={{
                        borderColor:
                          file.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                        color:
                          file.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                      }}
                    >
                      {String(file.status || '').toUpperCase()}
                    </div>
                  </div>
                  <div style={{ marginTop: '0.65rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    Perplexity {Number(file.perplexity || 0).toFixed(2)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function imageInsights(job) {
  const results = job?.result?.result?.results || {};

  return (
    <div className="result-card" style={{ marginTop: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          color: job.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
        }}
      >
        {job.status === 'validated' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
        <span className="font-mono">BATCH PROCESSING DONE</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Total Images Scored</span>
        <span className="stat-value">{results.total_images}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Dataset Mean Score</span>
        <span className="stat-value">{Number(results.dataset_mean || 0).toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Best Score (Lowest)</span>
        <span className="stat-value" style={{ color: '#00ffaa' }}>
          {Number(results.best_score || 0).toFixed(2)}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Worst Score (Highest)</span>
        <span className="stat-value" style={{ color: 'var(--accent-magenta)' }}>
          {Number(results.worst_score || 0).toFixed(2)}
        </span>
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Database size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
        Lower BRISQUE score corresponds to superior perceptual image quality.
      </div>
      <Gauge
        value={Number(results.dataset_mean || 0)}
        min={0}
        max={100}
        label="BRISQUE Mean"
        invert={true}
        levels={[
          { label: 'Optimal', range: '< 30', color: 'var(--accent-cyan)' },
          { label: 'Stable', range: '30 - 50', color: '#FFCC00' },
          { label: 'Critical', range: '> 50', color: 'var(--accent-magenta)' },
        ]}
      />
    </div>
  );
}

function audioInsights(job) {
  const summary = job?.result?.summary || {};
  const files = job?.result?.files || [];
  const overall = Number(summary.average_overall_quality || 0);

  return (
    <div className="result-card" style={{ marginTop: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          color: job.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
        }}
      >
        {job.status === 'validated' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
        <span className="font-mono">
          {job.status === 'validated' ? 'AUDIO BATCH ACCEPTED' : 'AUDIO BATCH REVIEWED'}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Model Target</span>
        <span className="stat-value">DNSMOS (P.808 mapping)</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Average Background Noise</span>
        <span className="stat-value">{Number(summary.average_background_noise || 0).toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Average Speech Quality</span>
        <span className="stat-value">{Number(summary.average_speech_quality || 0).toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Accepted Files</span>
        <span className="stat-value">
          {summary.accepted_files} / {summary.total_files}
        </span>
      </div>
      <div className="stat-row" style={{ marginTop: '1rem' }}>
        <span className="stat-label" style={{ fontSize: '1.2rem', color: '#fff' }}>
          Average Overall Quality
        </span>
        <span className="stat-value highlight">{overall.toFixed(2)}</span>
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <Volume2 size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
        DNSMOS scores range from 1 to 5. Higher scores indicate superior perceptual audio clarity.
      </div>
      <Gauge
        value={overall}
        min={1}
        max={5}
        label="Overall Quality"
        invert={false}
        bands={[
          { label: 'Critical', min: 0, max: 2, color: 'var(--accent-magenta)' },
          { label: 'Stable', min: 2, max: 3, color: '#FFCC00' },
          { label: 'Good', min: 3, max: 5, includeMax: true, color: 'var(--accent-cyan)' },
        ]}
        levels={[
          { label: 'Good', range: '>= 3.0', color: 'var(--accent-cyan)' },
          { label: 'Stable', range: '2.0 - 2.99', color: '#FFCC00' },
          { label: 'Critical', range: '< 2.0', color: 'var(--accent-magenta)' },
        ]}
      />

      {!!files.length && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="legend-header" style={{ marginBottom: '0.75rem' }}>
            Per File Breakdown
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {files.map((file, index) => (
              <div key={`${file.filename}-${index}`} className="metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="metric-value" style={{ marginTop: 0 }}>
                    {file.filename}
                  </div>
                  <div
                    className="status-pill"
                    style={{
                      borderColor:
                        file.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                      color:
                        file.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                    }}
                  >
                    {file.status.toUpperCase()}
                  </div>
                </div>
                <div style={{ marginTop: '0.65rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Overall {Number(file.scores?.overall_quality || 0).toFixed(2)} | Speech{' '}
                  {Number(file.scores?.speech_quality || 0).toFixed(2)} | Background{' '}
                  {Number(file.scores?.background_noise || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function videoInsights(job) {
  const summary = job?.result?.summary || {};
  const files = job?.result?.files || [];
  const p85 = Number(summary.average_niqe_p85 || 0);

  return (
    <div className="result-card" style={{ marginTop: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          marginBottom: '1rem',
          color: job.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
        }}
      >
        {job.status === 'validated' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
        <span className="font-mono">
          {job.status === 'validated' ? 'VIDEO BATCH ACCEPTED' : 'VIDEO BATCH REVIEWED'}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Model Target</span>
        <span className="stat-value">Temporal NIQE (PyIQA)</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Frames Analyzed</span>
        <span className="stat-value">{summary.frames_analyzed}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Average NIQE Mean</span>
        <span className="stat-value">{Number(summary.average_niqe_mean || 0).toFixed(2)}</span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Worst Peak Distortion</span>
        <span className="stat-value" style={{ color: 'var(--accent-magenta)' }}>
          {Number(summary.worst_peak_distortion || 0).toFixed(2)}
        </span>
      </div>
      <div className="stat-row">
        <span className="stat-label">Accepted Files</span>
        <span className="stat-value">
          {summary.accepted_files} / {summary.total_files}
        </span>
      </div>
      <div className="stat-row" style={{ marginTop: '1rem' }}>
        <span className="stat-label" style={{ fontSize: '1.2rem', color: '#fff' }}>
          Average NIQE p85
        </span>
        <span className="stat-value highlight">{p85.toFixed(2)}</span>
      </div>
      <div style={{ marginTop: '1rem', fontSize: '0.75rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <MonitorPlay size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
        Lower NIQE score corresponds to superior perceptual visual quality.
      </div>
      <Gauge
        value={p85}
        min={0}
        max={15}
        label="NIQE (p85)"
        invert={true}
        levels={[
          { label: 'Optimal', range: '< 5.0', color: 'var(--accent-cyan)' },
          { label: 'Stable', range: '5.0 - 7.5', color: '#FFCC00' },
          { label: 'Critical', range: '> 7.5', color: 'var(--accent-magenta)' },
        ]}
      />

      {!!files.length && (
        <div style={{ marginTop: '1.5rem' }}>
          <div className="legend-header" style={{ marginBottom: '0.75rem' }}>
            Per File Breakdown
          </div>
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            {files.map((file, index) => (
              <div key={`${file.filename}-${index}`} className="metric-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div className="metric-value" style={{ marginTop: 0 }}>
                    {file.filename}
                  </div>
                  <div
                    className="status-pill"
                    style={{
                      borderColor:
                        file.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                      color:
                        file.status === 'validated' ? 'var(--accent-cyan)' : 'var(--accent-magenta)',
                    }}
                  >
                    {file.status.toUpperCase()}
                  </div>
                </div>
                <div style={{ marginTop: '0.65rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  p85 {Number(file.scores?.niqe_p85 || 0).toFixed(2)} | Mean{' '}
                  {Number(file.scores?.niqe_mean || 0).toFixed(2)} | Worst{' '}
                  {Number(file.scores?.niqe_worst || 0).toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function renderInsights(job) {
  if (!job) return null;
  if (job.modality === 'text' || job.modality === 'text_batch') return textInsights(job);
  if (job.modality === 'image_batch') return imageInsights(job);
  if (job.modality === 'audio_batch') return audioInsights(job);
  if (job.modality === 'video_batch') return videoInsights(job);
  return (
    <div className="result-card" style={{ marginTop: 0, color: 'var(--text-muted)' }}>
      No insights available for this job yet.
    </div>
  );
}

export default function ValidationInsightsModal({ job, onClose }) {
  if (!job) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div className="legend-header" style={{ marginBottom: '0.35rem' }}>
              Validation Insights
            </div>
            <h2 style={{ fontSize: '1.8rem' }}>{job.display_name}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {job.modality} | submitted {formatIstTimestamp(job.created_at)}
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{renderInsights(job)}</div>
      </div>
    </div>
  );
}
