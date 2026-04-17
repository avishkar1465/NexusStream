import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { CheckCircle2, Download, FolderOpen, Package, ShoppingBag, Store, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { formatIstTimestamp } from '../utils/time';

const API_BASE = 'http://localhost:5000';

function deliveryIcon(deliveryType) {
  return deliveryType === 'folder' ? <FolderOpen size={16} /> : <Package size={16} />;
}

function relationMeta(dataset) {
  if (dataset.relation === 'published') {
    return `Published ${formatIstTimestamp(dataset.created_at)}`;
  }
  return `Purchased ${formatIstTimestamp(dataset.purchased_at || dataset.created_at)}`;
}

function DatasetSection({
  title,
  icon,
  emptyMessage,
  datasets,
  downloadingId,
  onDownload,
}) {
  return (
    <div className="panel">
      <div className="panel-header">
        {icon} {title}
      </div>
      {!datasets.length ? (
        <div style={{ color: 'var(--text-muted)' }}>{emptyMessage}</div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {datasets.map((dataset) => (
            <div key={`${dataset.relation}-${dataset.id}`} className="history-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{dataset.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                    {dataset.seller ? `Seller: ${dataset.seller} | ` : ''}
                    {dataset.modality} | {dataset.delivery_type || 'dataset'} | {dataset.source_count} file
                    {dataset.source_count === 1 ? '' : 's'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    {relationMeta(dataset)}
                  </div>
                </div>
                <div className="status-pill" style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
                  <Tag size={14} /> ${dataset.price} {dataset.currency}
                </div>
              </div>

              <p style={{ color: 'var(--text-muted)', marginTop: '0.85rem' }}>{dataset.description}</p>

              <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.75rem' }}>
                <div className="metric-card">
                  <div className="metric-label">Quality</div>
                  <div className="metric-value">{dataset.quality_percent ?? 0}%</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Score</div>
                  <div className="metric-value">{dataset.score_snapshot ?? '--'}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Metric</div>
                  <div className="metric-value">{dataset.metric_snapshot || '--'}</div>
                </div>
                <div className="metric-card">
                  <div className="metric-label">Delivery</div>
                  <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {deliveryIcon(dataset.delivery_type)}
                    {dataset.delivery_type || 'dataset'}
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="status-pill" style={{ borderColor: '#FFCC00', color: '#FFCC00' }}>
                  <CheckCircle2 size={14} /> {dataset.relation === 'published' ? 'YOU PUBLISHED THIS' : 'YOU OWN THIS'}
                </div>
                <button
                  className="btn"
                  onClick={() => onDownload(dataset)}
                  disabled={downloadingId === dataset.id}
                  style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <Download size={16} />
                  {downloadingId === dataset.id ? 'DOWNLOADING...' : 'DOWNLOAD'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MyDatasetsPage() {
  const { user } = useAuth();
  const [published, setPublished] = useState([]);
  const [purchased, setPurchased] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  const loadDatasets = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/marketplace/my-datasets`, {
        withCredentials: true,
      });
      setPublished(res.data.published || []);
      setPurchased(res.data.purchased || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load your datasets.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDatasets();
  }, [user]);

  const handleDownload = async (dataset) => {
    setDownloadingId(dataset.id);
    try {
      const response = await axios.get(`${API_BASE}${dataset.download_url}`, {
        withCredentials: true,
        responseType: 'blob',
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?"?([^\";]+)"?/i);
      const fallbackName = dataset.download_name || `${dataset.title || 'dataset'}.${dataset.download_kind === 'zip' ? 'zip' : 'txt'}`;
      const fileName = fileNameMatch?.[1] || fallbackName;

      const objectUrl = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to download dataset.');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!user) {
    return (
      <div className="panel" style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>My Datasets</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Sign in to access the datasets you published and the datasets you purchased.
        </p>
        <Link to="/auth" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>
          LOGIN
        </Link>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          My <span className="text-gradient">Datasets</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '720px', margin: '0 auto' }}>
          View everything you have published to the marketplace and everything you have purchased, then download it again whenever you need it.
        </p>
      </div>

      {error && (
        <div className="result-card" style={{ borderColor: 'var(--accent-magenta)', marginBottom: '1.5rem' }}>
          <div style={{ color: 'var(--accent-magenta)' }}>{error}</div>
        </div>
      )}

      {loading ? (
        <div className="panel" style={{ color: 'var(--text-muted)' }}>
          Loading your datasets...
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '2rem' }}>
          <DatasetSection
            title="Published By You"
            icon={<Store size={22} color="var(--accent-cyan)" />}
            emptyMessage="You have not published any datasets yet."
            datasets={published}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
          <DatasetSection
            title="Purchased By You"
            icon={<ShoppingBag size={22} color="#FFCC00" />}
            emptyMessage="You have not purchased any datasets yet."
            datasets={purchased}
            downloadingId={downloadingId}
            onDownload={handleDownload}
          />
        </div>
      )}
    </div>
  );
}
