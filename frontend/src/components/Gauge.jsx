import React from 'react';

const Gauge = ({ 
  value, 
  min = 0, 
  max = 100, 
  label = "Quality Score", 
  invert = false, // true if lower is better
  unit = "",
  levels = [], // [{ label: "Optimal", range: "< 60", color: "..." }]
  bands = null, // [{ label: "Critical", min: 0, max: 2, color: "..." }]
}) => {
  // Normalize value between 0 and 1
  const normalizedValue = Math.min(Math.max((value - min) / (max - min), 0), 1);
  
  // Angle for the needle (from -90 to 90 degrees)
  const angle = (normalizedValue * 180) - 90;
  
  // Color calculation
  const defaultVisualValue = invert ? 1 - normalizedValue : normalizedValue;
  const defaultColor =
    defaultVisualValue > 0.7 ? 'var(--accent-cyan)' :
    defaultVisualValue > 0.4 ? '#FFCC00' :
    'var(--accent-magenta)';

  const matchedBand = Array.isArray(bands)
    ? bands.find((band) => {
        const minValue = band.min ?? Number.NEGATIVE_INFINITY;
        const maxValue = band.max ?? Number.POSITIVE_INFINITY;
        const includeMax = band.includeMax ?? false;
        return value >= minValue && (includeMax ? value <= maxValue : value < maxValue);
      })
    : null;

  const color = matchedBand?.color || defaultColor;
  const statusLabel = matchedBand?.label?.toUpperCase() || (
    (invert ? (normalizedValue < 0.3) : (normalizedValue > 0.7)) ? 'OPTIMAL' : 
    (invert ? (normalizedValue < 0.6) : (normalizedValue > 0.4)) ? 'STABLE' : 'CRITICAL'
  );

  return (
    <div className="gauge-wrapper">
      <div className="gauge-main-content">
        <div className="gauge-container">
          <svg viewBox="0 0 100 55" className="gauge-svg">
            {/* Background Arc */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="8"
              strokeLinecap="round"
            />
            
            {/* Active Arc */}
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray="125.6"
              strokeDashoffset={125.6 * (1 - normalizedValue)}
              style={{ transition: 'stroke-dashoffset 1s ease-out, stroke 1s ease-out' }}
            />

            {/* Needle */}
            <g transform={`rotate(${angle}, 50, 50)`}>
              <line 
                x1="50" y1="50" x2="50" y2="15" 
                stroke="#FFF" 
                strokeWidth="2" 
                strokeLinecap="round" 
                style={{ transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />
              <circle cx="50" cy="50" r="3" fill="#FFF" />
            </g>
          </svg>
          
          <div className="gauge-info">
            <div className="gauge-value" style={{ color }}>
              {value.toFixed(1)}{unit}
            </div>
            <div className="gauge-label">{label}</div>
          </div>
        </div>
        
        <div className="gauge-status" style={{ background: `${color}22`, borderColor: color }}>
          {statusLabel}
        </div>
      </div>

      {levels && levels.length > 0 && (
        <div className="gauge-legend">
          <div className="legend-header">Score Guide</div>
          {levels.map((lvl, i) => (
            <div key={i} className="legend-item">
              <span className="legend-dot" style={{ backgroundColor: lvl.color }}></span>
              <span className="legend-text">
                <span className="legend-label">{lvl.label}</span>
                <span className="legend-range">{lvl.range}</span>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Gauge;
