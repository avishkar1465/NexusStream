import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Search, ShoppingCart, Store, Tag } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const API_BASE = 'http://localhost:5000';

export default function MarketplacePage() {
  const { user } = useAuth();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [purchasingId, setPurchasingId] = useState(null);

  const loadListings = async (searchText = query, showLoader = true) => {
    if (!user) {
      setLoading(false);
      return;
    }

    if (showLoader) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/marketplace/listings`, {
        withCredentials: true,
        params: searchText ? { q: searchText } : {},
      });
      setListings(res.data.listings || []);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to load marketplace.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings('', true);
  }, [user]);

  const handleSearch = async (event) => {
    event.preventDefault();
    await loadListings(query, true);
  };

  const purchaseListing = async (listing) => {
    setPurchasingId(listing.id);
    try {
      await axios.post(`${API_BASE}/marketplace/purchase`, {
        listing_id: listing.id,
      }, { withCredentials: true });
      await loadListings(query, false);
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to purchase dataset.');
    } finally {
      setPurchasingId(null);
    }
  };

  if (!user) {
    return (
      <div className="panel" style={{ maxWidth: '720px', margin: '0 auto', textAlign: 'center' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>Marketplace</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
          Sign in to view validated datasets available for sale.
        </p>
        <Link to="/auth" className="btn" style={{ width: 'auto', textDecoration: 'none' }}>LOGIN</Link>
      </div>
    );
  }

  return (
    <div style={{ paddingBottom: '4rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>
          Dataset <span className="text-gradient">Marketplace</span>
        </h1>
        <p style={{ color: 'var(--text-muted)', maxWidth: '680px', margin: '0 auto' }}>
          Browse public validated datasets, search across modalities, and purchase instantly with a single click.
        </p>
      </div>

      <div className="panel" style={{ marginBottom: '2rem' }}>
        <div className="panel-header"><Search size={22} color="var(--accent-cyan)" /> Search Datasets</div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title, seller, modality, or description"
            style={{
              flex: '1 1 320px',
              padding: '0.95rem 1rem',
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              color: 'var(--text-main)',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <button className="btn" type="submit" style={{ width: 'auto' }}>
            SEARCH
          </button>
        </form>
      </div>

      <div className="panel">
        <div className="panel-header"><Store size={22} color="var(--accent-cyan)" /> Public Listings</div>
        {loading ? (
          <div style={{ color: 'var(--text-muted)' }}>Loading listings...</div>
        ) : error ? (
          <div style={{ color: 'var(--accent-magenta)' }}>{error}</div>
        ) : !listings.length ? (
          <div style={{ color: 'var(--text-muted)' }}>No matching datasets found.</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {listings.map(listing => (
              <div key={listing.id} className="history-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{listing.title}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      Seller: {listing.seller} • {listing.modality} • {listing.delivery_type || 'dataset'} • {listing.source_count} file{listing.source_count === 1 ? '' : 's'} • {listing.purchases_count} purchase{listing.purchases_count === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div className="status-pill" style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
                    <Tag size={14} /> ${listing.price} {listing.currency}
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', marginTop: '0.85rem' }}>{listing.description}</p>
                <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem' }}>
                  <div className="metric-card">
                    <div className="metric-label">Quality</div>
                    <div className="metric-value">{listing.quality_percent ?? 0}%</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Score</div>
                    <div className="metric-value">{listing.score_snapshot ?? '--'}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Metric</div>
                    <div className="metric-value">{listing.metric_snapshot || '--'}</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-label">Delivery</div>
                    <div className="metric-value">{listing.delivery_type || 'dataset'}</div>
                  </div>
                </div>
                <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  {listing.is_owner ? (
                    <div className="status-pill" style={{ borderColor: '#FFCC00', color: '#FFCC00' }}>
                      YOUR LISTING
                    </div>
                  ) : listing.is_purchased ? (
                    <div className="status-pill" style={{ borderColor: 'var(--accent-cyan)', color: 'var(--accent-cyan)' }}>
                      PURCHASED
                    </div>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => purchaseListing(listing)}
                      disabled={purchasingId === listing.id}
                      style={{ width: 'auto', display: 'flex', alignItems: 'center', gap: '0.45rem' }}
                    >
                      <ShoppingCart size={16} />
                      {purchasingId === listing.id ? 'PURCHASING...' : 'PURCHASE'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
