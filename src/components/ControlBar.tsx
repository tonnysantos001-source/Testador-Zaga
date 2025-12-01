import { Play, Square, Settings, Download } from 'lucide-react';
import './ControlBar.css';

interface ControlBarProps {
    onStart: () => void;
    onSettings: () => void;
    onDownload: () => void;
    isRunning: boolean;
    hasLiveCards: boolean;
}

export default function ControlBar({ onStart, onSettings, onDownload, isRunning, hasLiveCards }: ControlBarProps) {
    return (
        <div className="control-bar">
            <button
                className={`control-btn start-btn ${isRunning ? 'running' : ''}`}
                onClick={onStart}
                title={isRunning ? 'Stop testing' : 'Start testing'}
            >
                {isRunning ? <Square size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                <span>{isRunning ? 'Stop' : 'Start'}</span>
            </button>

            <button
                className="control-btn download-btn"
                onClick={onDownload}
                disabled={!hasLiveCards}
                title="Download approved cards"
            >
                <Download size={20} />
                <span>Download</span>
            </button>

            <button
                className="control-btn settings-btn"
                onClick={onSettings}
                title="Settings"
            >
                <Settings size={20} />
            </button>
        </div>
    );
}
