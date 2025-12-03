import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Shield, LogOut } from 'lucide-react';
import CardInput from './components/CardInput';
import ControlBar from './components/ControlBar';
import StatsDisplay from './components/StatsDisplay';
import ResultsPanel from './components/ResultsPanel';
import ProgressTracker from './components/ProgressTracker';
import SettingsModal from './components/SettingsModal';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import { useCardTester } from './hooks/useCardTester';
import { useAuth } from './contexts/AuthContext';
import './App.css';
import { parseCardLine } from './utils/cardParser';

function Dashboard() {
  const [cardData, setCardData] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'all' | 'live' | 'die' | 'unknown'>('all');

  // Settings State (Gateway agora é automático via Supabase)
  const [minAmount, setMinAmount] = useState(0.50);
  const [maxAmount, setMaxAmount] = useState(2.00);
  const [minDelay, setMinDelay] = useState(1);
  const [maxDelay, setMaxDelay] = useState(3);
  const [proxyUrl, setProxyUrl] = useState('');

  const { signOut } = useAuth();

  const {
    isRunning,
    stats,
    results,
    currentCard,
    startTesting,
    stopTesting,
    downloadLive,
    hasLiveCards
  } = useCardTester();



  // ... imports

  const handleStart = () => {
    if (!isRunning) {
      if (!cardData.trim()) {
        alert('Por favor, insira alguns cartões para testar');
        return;
      }

      // Processa e formata os cartões usando o parser inteligente
      const rawLines = cardData.split('\n').filter(line => line.trim());
      const formattedCards: string[] = [];

      rawLines.forEach(line => {
        const parsed = parseCardLine(line);
        if (parsed) {
          // Formata para o padrão esperado: PAN|MES|ANO|CVV|HOLDER
          formattedCards.push(`${parsed.number}|${parsed.month}|${parsed.year}|${parsed.cvv}|${parsed.holder || ''}`);
        }
      });

      if (formattedCards.length === 0) {
        alert('Nenhum cartão válido encontrado. Verifique o formato.');
        return;
      }

      // Gateway URL agora vem automaticamente do Supabase (APPMAX_API_URL)
      startTesting(formattedCards, {
        minAmount,
        maxAmount,
        minDelay,
        maxDelay,
        proxyUrl
      });
    } else {
      stopTesting();
    }
  };

  const handleSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleLogout = async () => {
    if (confirm('Tem certeza que deseja sair?')) {
      await signOut();
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="logo-section">
            <div className="logo-icon">
              <Shield size={28} />
            </div>
            <div className="header-text">
              <h1 className="app-title">
                <span className="text-gradient">Checker Zaga</span>
              </h1>
              <p className="app-tagline">Advanced Card Validation</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <ControlBar
              onStart={handleStart}
              onSettings={handleSettings}
              onDownload={downloadLive}
              isRunning={isRunning}
              hasLiveCards={hasLiveCards}
            />
            <button
              onClick={handleLogout}
              className="logout-button"
              title="Sair"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="main-grid">
          <div className="grid-left">
            <CardInput value={cardData} onChange={setCardData} />
          </div>
          <div className="grid-right">
            <ProgressTracker
              isRunning={isRunning}
              total={stats.total}
              processed={stats.processed}
              currentCard={currentCard}
              speed={stats.speed}
            />
            <StatsDisplay
              {...stats}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
            />
            <ResultsPanel
              results={results}
              filter={activeFilter}
            />
          </div>
        </div>
      </main>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        minAmount={minAmount}
        onMinAmountChange={setMinAmount}
        maxAmount={maxAmount}
        onMaxAmountChange={setMaxAmount}
        minDelay={minDelay}
        onMinDelayChange={setMinDelay}
        maxDelay={maxDelay}
        onMaxDelayChange={setMaxDelay}
        proxyUrl={proxyUrl}
        onProxyUrlChange={setProxyUrl}
      />
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export default App;
