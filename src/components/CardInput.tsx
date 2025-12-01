import { Upload, X } from 'lucide-react';
import './CardInput.css';

interface CardInputProps {
  value: string;
  onChange: (value: string) => void;
}

export default function CardInput({ value, onChange }: CardInputProps) {
  const lineCount = value.split('\n').filter(line => line.trim()).length;

  const handleClear = () => {
    onChange('');
  };

  return (
    <div className="card-input-container glass">
      <div className="card-input-header">
        <div className="header-info">
          <Upload size={16} />
          <span>Card List</span>
          {lineCount > 0 && (
            <span className="card-count">{lineCount} cards loaded</span>
          )}
        </div>
        {lineCount > 0 && (
          <button className="clear-btn" onClick={handleClear} title="Clear all">
            <X size={16} />
          </button>
        )}
      </div>
      <textarea
        className="card-input"
        placeholder="Paste your card list here (one per line)&#10;&#10;Format: 4552250055368XX3|08|2026|113&#10;&#10;Supports large lists (500-1000+ cards)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
      />
    </div>
  );
}

