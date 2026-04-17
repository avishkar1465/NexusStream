import React, { useEffect, useState } from 'react';
import { AlertTriangle, FolderOpen, Package, Tag, X } from 'lucide-react';

function listingDeliveryType(job) {
  if (!job) return 'file';
  if (['image_batch', 'audio_batch', 'video_batch'].includes(job.modality) || job.source_count > 1) {
    return 'folder';
  }
  return 'file';
}

export default function PublishListingModal({ job, loading, error, onClose, onSubmit }) {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [localError, setLocalError] = useState('');

  useEffect(() => {
    if (!job) return;
    const deliveryType = listingDeliveryType(job);
    setTitle(job.display_name || '');
    setPrice(job.suggested_price != null ? String(job.suggested_price) : '');
    setDescription(
      `Validated ${job.modality} dataset published as a ${deliveryType} from ${job.source_count} uploaded file${job.source_count > 1 ? 's' : ''}.`
    );
    setLocalError('');
  }, [job]);

  if (!job) return null;

  const deliveryType = listingDeliveryType(job);

  const handleSubmit = (event) => {
    if (event) event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedPrice = price.trim();

    if (!trimmedTitle) {
      setLocalError('Dataset name is required.');
      return;
    }
    if (!trimmedPrice) {
      setLocalError('Cost is required.');
      return;
    }

    setLocalError('');
    onSubmit({
      title: trimmedTitle,
      price: trimmedPrice,
      description: description.trim(),
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-shell" onClick={(event) => event.stopPropagation()} style={{ maxWidth: '640px' }}>
        <div className="modal-header">
          <div>
            <div className="legend-header" style={{ marginBottom: '0.35rem' }}>Publish Dataset</div>
            <h2 style={{ fontSize: '1.8rem' }}>{job.display_name}</h2>
            <p style={{ color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              Configure the marketplace listing before publishing.
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: 'grid', gap: '1rem', marginBottom: '1.25rem' }}>
          <div className="metric-card" style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div className="metric-label">Publish Format</div>
              <div className="metric-value" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {deliveryType === 'folder' ? <FolderOpen size={18} /> : <Package size={18} />}
                {deliveryType.toUpperCase()}
              </div>
            </div>
            <div>
              <div className="metric-label">Suggested Price</div>
              <div className="metric-value">${job.suggested_price ?? '--'}</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
          {(localError || error) && (
            <div className="result-card" style={{ marginTop: 0, borderColor: 'var(--accent-magenta)', padding: '0.85rem 1rem' }}>
              <div style={{ color: 'var(--accent-magenta)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={16} />
                {localError || error}
              </div>
            </div>
          )}

          <label style={{ display: 'grid', gap: '0.5rem' }}>
            <span className="metric-label">Dataset Name</span>
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (localError) setLocalError('');
              }}
              placeholder="Marketplace listing title"
              style={inputStyle}
            />
          </label>

          <label style={{ display: 'grid', gap: '0.5rem' }}>
            <span className="metric-label">Cost (USD)</span>
            <div style={{ position: 'relative' }}>
              <Tag size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(event) => {
                  setPrice(event.target.value);
                  if (localError) setLocalError('');
                }}
                placeholder="0.00"
                style={{ ...inputStyle, paddingLeft: '2.6rem' }}
              />
            </div>
          </label>

          <label style={{ display: 'grid', gap: '0.5rem' }}>
            <span className="metric-label">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '120px' }}
            />
          </label>

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            <button type="button" className="btn" onClick={onClose} style={{ width: 'auto', borderColor: 'var(--border-color)' }}>
              CANCEL
            </button>
            <button type="button" className="btn" disabled={loading} onClick={handleSubmit} style={{ width: 'auto' }}>
              {loading ? 'PUBLISHING...' : 'CONFIRM PUBLISH'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%',
  padding: '0.95rem 1rem',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid var(--border-color)',
  borderRadius: '8px',
  color: 'var(--text-main)',
  fontFamily: 'JetBrains Mono, monospace',
};
