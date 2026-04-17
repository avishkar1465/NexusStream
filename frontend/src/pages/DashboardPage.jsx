import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CheckCircle, Clock3, Database, Store, UploadCloud, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PublishListingModal from '../components/PublishListingModal';
import ValidationInsightsModal from '../components/ValidationInsightsModal';
import { formatIstTimestamp } from '../utils/time';

const API_BASE = 'http://localhost:5000';

function statusColor(status) {
  if (status === 'validated') return 'var(--accent-cyan)';
  if (status === 'processing') return '#FFCC00';
  if (status === 'failed') return 'var(--accent-magenta)';
  return 'var(--accent-magenta)';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState({ summary: null, jobs: [], marketplace: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [selectedJob, setSelectedJob] = useState(null);
  const [publishJob, setPublishJob] = useState(null);
  const [publishError, setPublishError] = useState(null);

  const activeJobs = useMemo(
    () => dashboard.jobs.filter((job) => job.status === 'processing'),
    [dashboard.jobs]
  );

  const loadDashboard = async (showLoader = false) => {
    if (!user) {
      setLoading(false);
      return;
    }
    if (showLoader) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/dashboard`, { withCredentials: true });
      setDashboard(res.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard(true);
  }, [user]);

  useEffect(() => {
    if (!activeJobs.length) return undefined;
    const timer = window.setInterval(() => {
      loadDashboard(false);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [activeJobs.length]);

  const publishListing = async (job, payload) => {
    if (!job) {
      setPublishError('No validation job selected for publishing.');
      return;
    }

    setPublishingId(job.id);
    setPublishError(null);
    try {
      await axios.post(
        `${API_BASE}/marketplace/publish`,
        {
          job_id: job.id,
          title: payload.title,
          price: payload.price,
          description: payload.description,
        },
        { withCredentials: true }
      );
      setPublishJob(null);
      await loadDashboard(false);
    } catch (err) {
      setPublishError(err.response?.data?.error || 'Unable to publish listing.');
    } finally {
      setPublishingId(null);
    }
  };

  if (!user) {
    return (
      <div className="panel" style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Sign in to view your validation history and background job results.
        </p>
        <Link to="/auth" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
          LOGIN
        </Link>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '1rem',
          alignItems: 'center',
          flexWrap: 'wrap',
          marginBottom: '2rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>
            Validation <span className="text-gradient">Dashboard</span>
          </h1>
          <p style={{ color: 'var(--text-muted)', maxWidth: '720px' }}>
            Job history is now stored per user, and completed background validations will show back up
            here even after you close and reopen the app.
          </p>
        </div>
      </div>

      {error && (
        <div className="result-card" style={{ borderColor: 'var(--accent-magenta)', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--accent-magenta)' }}>{error}</div>
        </div>
      )}

      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="panel">
          <div className="panel-header">
            <Database size={20} color="var(--accent-cyan)" /> Summary
          </div>
          {loading && !dashboard.summary ? (
            <div style={{ color: 'var(--text-muted)' }}>Loading summary...</div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                gap: '1rem',
              }}
            >
              <div className="summary-card">
                <div className="summary-value">{dashboard.summary?.total_jobs || 0}</div>
                <div className="summary-label">Total Jobs</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{dashboard.summary?.validated_jobs || 0}</div>
                <div className="summary-label">Validated</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{dashboard.summary?.processing_jobs || 0}</div>
                <div className="summary-label">Processing</div>
              </div>
              <div className="summary-card">
                <div className="summary-value">{dashboard.summary?.listed_jobs || 0}</div>
                <div className="summary-label">Listed</div>
              </div>
            </div>
          )}
        </div>

        <div className="panel">
          <div className="panel-header">
            <UploadCloud size={20} color="var(--accent-purple)" /> New Validation
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Link to="/text-validation" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
              TEXT
            </Link>
            <Link to="/image-validation" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
              IMAGE
            </Link>
            <Link to="/audio-validation" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
              AUDIO
            </Link>
            <Link to="/video-validation" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
              VIDEO
            </Link>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
            Submit files, let the workers run in the background, and come back here for the final
            result.
          </p>
        </div>
      </div>

      <div className="panel" style={{ marginBottom: '2rem' }}>
        <div className="panel-header">
          <Clock3 size={20} color="#FFCC00" /> Validation History
        </div>
        {!dashboard.jobs.length && !loading ? (
          <div style={{ color: 'var(--text-muted)' }}>No validations yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {dashboard.jobs.map((job) => (
              <div key={job.id} className="history-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{job.display_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {job.modality} | {job.source_count} file{job.source_count > 1 ? 's' : ''} |{' '}
                      {formatIstTimestamp(job.created_at)}
                    </div>
                  </div>
                  <div
                    className="status-pill"
                    style={{ borderColor: statusColor(job.status), color: statusColor(job.status) }}
                  >
                    {job.status_label}
                  </div>
                </div>

                {job.error && (
                  <div
                    style={{
                      color: 'var(--accent-magenta)',
                      marginTop: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                    }}
                  >
                    <XCircle size={16} /> {job.error}
                  </div>
                )}

                {job.score_snapshot !== null && job.score_snapshot !== undefined && (
                  <div
                    style={{
                      marginTop: '1rem',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                      gap: '0.75rem',
                    }}
                  >
                    <div className="metric-card">
                      <div className="metric-label">Score</div>
                      <div className="metric-value">{job.score_snapshot}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Metric</div>
                      <div className="metric-value">{job.metric_snapshot}</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Quality</div>
                      <div className="metric-value">{job.quality_percent}%</div>
                    </div>
                    <div className="metric-card">
                      <div className="metric-label">Suggested Price</div>
                      <div className="metric-value">${job.suggested_price ?? '--'}</div>
                    </div>
                  </div>
                )}

                {job.result?.summary && (
                  <div style={{ marginTop: '0.85rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {job.result.summary.total_files ? `Files processed: ${job.result.summary.total_files}` : null}
                    {job.result.summary.accepted_files !== undefined
                      ? ` | Accepted: ${job.result.summary.accepted_files}`
                      : null}
                  </div>
                )}

                <div
                  style={{
                    marginTop: '1rem',
                    display: 'flex',
                    gap: '0.75rem',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                  }}
                >
                  {(job.status === 'validated' || job.status === 'rejected') && !!job.result && (
                    <button className="btn" onClick={() => setSelectedJob(job)} style={{ width: 'auto' }}>
                      VIEW INSIGHTS
                    </button>
                  )}
                  {job.status === 'validated' && !job.listing && (
                    <button
                      className="btn"
                      onClick={() => {
                        setPublishError(null);
                        setPublishJob(job);
                      }}
                      disabled={publishingId === job.id}
                      style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                      <Store size={16} /> {publishingId === job.id ? 'PUBLISHING...' : 'PUBLISH'}
                    </button>
                  )}
                  {job.listing && (
                    <div
                      style={{
                        color: 'var(--accent-cyan)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                      }}
                    >
                      <CheckCircle size={16} /> Listed as {job.listing.delivery_type || 'dataset'} for $
                      {job.listing.price}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel">
        <div className="panel-header">
          <Store size={20} color="var(--accent-cyan)" /> Marketplace Preview
        </div>
        {!dashboard.marketplace.length ? (
          <div style={{ color: 'var(--text-muted)' }}>No active listings yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {dashboard.marketplace.map((listing) => (
              <div key={listing.id} className="history-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    flexWrap: 'wrap',
                  }}
                >
                  <div>
                    <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{listing.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Seller: {listing.seller} | {listing.modality} | {listing.delivery_type || 'dataset'}
                    </div>
                  </div>
                  <div
                    className="status-pill"
                    style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}
                  >
                    ${listing.price} {listing.currency}
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.85rem' }}>{listing.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>
      <PublishListingModal
        job={publishJob}
        loading={publishingId === publishJob?.id}
        error={publishError}
        onClose={() => {
          setPublishError(null);
          setPublishJob(null);
        }}
        onSubmit={(payload) => publishListing(publishJob, payload)}
      />
      <ValidationInsightsModal job={selectedJob} onClose={() => setSelectedJob(null)} />
    </div>
  );
}
