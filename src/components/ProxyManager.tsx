import { useState, useEffect } from 'react';
import { proxyManager, getProxyStats } from '../utils/proxyManager';
import type { ProxyConfig } from '../utils/proxyManager';

export const ProxyManager = () => {
    const [proxies, setProxies] = useState<ProxyConfig[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [newProxy, setNewProxy] = useState({
        url: '',
        name: '',
        priority: 2,
    });
    const [showHelp, setShowHelp] = useState(false);

    useEffect(() => {
        refreshProxies();
    }, []);

    const refreshProxies = () => {
        setProxies(proxyManager.getAllProxies());
        setStats(getProxyStats());
    };

    const handleAddProxy = () => {
        if (!newProxy.url || !newProxy.name) {
            alert('Por favor, preencha URL e nome do proxy');
            return;
        }

        proxyManager.addProxy(newProxy.url, newProxy.name, newProxy.priority);
        setNewProxy({ url: '', name: '', priority: 2 });
        refreshProxies();
    };

    const handleRemoveProxy = (url: string) => {
        if (confirm('Tem certeza que deseja remover este proxy?')) {
            proxyManager.removeProxy(url);
            refreshProxies();
        }
    };

    const handleResetStats = (url: string) => {
        proxyManager.resetProxyStats(url);
        refreshProxies();
    };

    const handleHealthCheck = async () => {
        await proxyManager.checkProxiesHealth();
        refreshProxies();
    };

    return (
        <div className="proxy-manager">
            <div className="proxy-header">
                <h2>⚡ Gerenciador de Proxies</h2>
                <button
                    className="help-button"
                    onClick={() => setShowHelp(!showHelp)}
                >
                    {showHelp ? '❌ Fechar Ajuda' : '❓ Como Usar'}
                </button>
            </div>

            {showHelp && (
                <div className="proxy-help">
                    <h3>🚀 O que são Proxies?</h3>
                    <p>
                        Proxies são servidores intermediários que fazem requisições por você,
                        ajudando a evitar bloqueios e distribuir tráfego.
                    </p>

                    <h4>⚠️ IMPORTANTE:</h4>
                    <ul>
                        <li><strong>Proxies são OPCIONAIS</strong> - O sistema funciona perfeitamente sem eles</li>
                        <li>Você precisa contratar um serviço de proxy externo (pago ou gratuito)</li>
                        <li>Após contratar, adicione a URL e credenciais aqui</li>
                    </ul>

                    <h4>🌐 Serviços Recomendados:</h4>

                    <div className="proxy-services">
                        <div className="service">
                            <h5>🟢 ScraperAPI (Recomendado)</h5>
                            <p>Site: <a href="https://www.scraperapi.com" target="_blank">scraperapi.com</a></p>
                            <p>Preço: A partir de $49/mês (1000 chamadas grátis)</p>
                            <p>Formato: <code>http://scraperapi:SUA_CHAVE@proxy-server.scraperapi.com:8001</code></p>
                        </div>

                        <div className="service">
                            <h5>🟢 Bright Data (Profissional)</h5>
                            <p>Site: <a href="https://brightdata.com" target="_blank">brightdata.com</a></p>
                            <p>Preço: A partir de $500/mês</p>
                            <p>Formato: <code>http://usuario:senha@brd.superproxy.io:22225</code></p>
                        </div>

                        <div className="service">
                            <h5>🟡 ProxyScrape (Básico)</h5>
                            <p>Site: <a href="https://proxyscrape.com" target="_blank">proxyscrape.com</a></p>
                            <p>Preço: Planos grátis disponíveis</p>
                            <p>Formato: <code>http://ip:porta</code></p>
                        </div>

                        <div className="service">
                            <h5>🟡 WebShare (Budget)</h5>
                            <p>Site: <a href="https://www.webshare.io" target="_blank">webshare.io</a></p>
                            <p>Preço: A partir de $2.99/mês</p>
                            <p>Formato: <code>http://usuario:senha@proxy.webshare.io:porta</code></p>
                        </div>
                    </div>

                    <h4>📝 Como Adicionar:</h4>
                    <ol>
                        <li>Escolha um serviço acima e crie uma conta</li>
                        <li>Copie a URL do proxy fornecida pelo serviço</li>
                        <li>Cole no campo "URL do Proxy" abaixo</li>
                        <li>Dê um nome descritivo (ex: "ScraperAPI Principal")</li>
                        <li>Defina prioridade: 1=Alta, 2=Média, 3=Baixa</li>
                        <li>Clique em "Adicionar Proxy"</li>
                    </ol>
                </div>
            )}

            {stats && (
                <div className="proxy-stats">
                    <div className="stat">
                        <span className="label">Total:</span>
                        <span className="value">{stats.total}</span>
                    </div>
                    <div className="stat">
                        <span className="label">Ativos:</span>
                        <span className="value success">{stats.active}</span>
                    </div>
                    <div className="stat">
                        <span className="label">Inativos:</span>
                        <span className="value error">{stats.inactive}</span>
                    </div>
                    <div className="stat">
                        <span className="label">Taxa de Sucesso:</span>
                        <span className="value">{stats.successRate}</span>
                    </div>
                </div>
            )}

            <div className="add-proxy">
                <h3>➕ Adicionar Novo Proxy</h3>
                <div className="form-group">
                    <input
                        type="text"
                        placeholder="URL do Proxy (ex: http://proxy.com:8080)"
                        value={newProxy.url}
                        onChange={(e) => setNewProxy({ ...newProxy, url: e.target.value })}
                    />
                    <input
                        type="text"
                        placeholder="Nome (ex: ScraperAPI Principal)"
                        value={newProxy.name}
                        onChange={(e) => setNewProxy({ ...newProxy, name: e.target.value })}
                    />
                    <select
                        value={newProxy.priority}
                        onChange={(e) => setNewProxy({ ...newProxy, priority: parseInt(e.target.value) })}
                    >
                        <option value={1}>Prioridade Alta</option>
                        <option value={2}>Prioridade Média</option>
                        <option value={3}>Prioridade Baixa</option>
                    </select>
                    <button onClick={handleAddProxy}>Adicionar</button>
                </div>
            </div>

            <div className="proxy-list">
                <div className="list-header">
                    <h3>📋 Proxies Configurados ({proxies.length})</h3>
                    <button onClick={handleHealthCheck}>🔍 Testar Todos</button>
                </div>

                {proxies.length === 0 ? (
                    <div className="empty-state">
                        <p>✅ Nenhum proxy configurado - Sistema funcionando em modo direto</p>
                        <p style={{ fontSize: '0.9em', opacity: 0.7 }}>
                            Adicione proxies acima se quiser rotação automática de IPs
                        </p>
                    </div>
                ) : (
                    <table>
                        <thead>
                            <tr>
                                <th>Status</th>
                                <th>Nome</th>
                                <th>URL</th>
                                <th>Prioridade</th>
                                <th>Sucessos</th>
                                <th>Falhas</th>
                                <th>Tempo Resp.</th>
                                <th>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {proxies.map((proxy) => (
                                <tr key={proxy.url} className={proxy.isActive ? 'active' : 'inactive'}>
                                    <td>
                                        {proxy.isActive ? (
                                            <span className="status-badge success">✓ Ativo</span>
                                        ) : (
                                            <span className="status-badge error">✗ Inativo</span>
                                        )}
                                    </td>
                                    <td>{proxy.name}</td>
                                    <td className="url-cell">{proxy.url}</td>
                                    <td>
                                        {proxy.priority === 1 && '🔴 Alta'}
                                        {proxy.priority === 2 && '🟡 Média'}
                                        {proxy.priority === 3 && '🟢 Baixa'}
                                    </td>
                                    <td className="success">{proxy.successCount}</td>
                                    <td className="error">{proxy.failCount}</td>
                                    <td>{proxy.responseTime ? `${proxy.responseTime}ms` : '-'}</td>
                                    <td className="actions">
                                        <button onClick={() => handleResetStats(proxy.url)} title="Resetar estatísticas">
                                            🔄
                                        </button>
                                        <button onClick={() => handleRemoveProxy(proxy.url)} title="Remover">
                                            🗑️
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <style>{`
        .proxy-manager {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 24px;
          margin: 20px 0;
        }

        .proxy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .proxy-header h2 {
          margin: 0;
          color: #fff;
        }

        .help-button {
          background: rgba(74, 144, 226, 0.2);
          border: 1px solid rgba(74, 144, 226, 0.5);
          color: #4a90e2;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .help-button:hover {
          background: rgba(74, 144, 226, 0.3);
          border-color: #4a90e2;
        }

        .proxy-help {
          background: rgba(74, 144, 226, 0.1);
          border: 1px solid rgba(74, 144, 226, 0.3);
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }

        .proxy-help h3 {
          color: #4a90e2;
          margin-top: 0;
        }

        .proxy-help h4 {
          color: #fff;
          margin-top: 16px;
        }

        .proxy-help ul {
          margin: 10px 0;
          padding-left: 20px;
        }

        .proxy-help li {
          margin: 8px 0;
          color: rgba(255, 255, 255, 0.9);
        }

        .proxy-services {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin: 16px 0;
        }

        .service {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 16px;
        }

        .service h5 {
          margin: 0 0 8px 0;
          color: #fff;
        }

        .service p {
          margin: 6px 0;
          font-size: 0.9em;
          color: rgba(255, 255, 255, 0.8);
        }

        .service a {
          color: #4a90e2;
          text-decoration: none;
        }

        .service code {
          background: rgba(0, 0, 0, 0.3);
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 0.85em;
          display: block;
          margin-top: 4px;
          overflow-x: auto;
        }

        .proxy-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .stat {
          background: rgba(255, 255, 255, 0.08);
          padding: 16px;
          border-radius: 8px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .stat .label {
          color: rgba(255, 255, 255, 0.6);
          font-size: 0.9em;
        }

        .stat .value {
          color: #fff;
          font-size: 1.5em;
          font-weight: bold;
        }

        .add-proxy {
          margin: 24px 0;
        }

        .add-proxy h3 {
          color: #fff;
          margin-bottom: 12px;
        }

        .form-group {
          display: grid;
          grid-template-columns: 2fr 1.5fr 1fr 0.8fr;
          gap: 12px;
        }

        .form-group input,
        .form-group select {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          padding: 10px;
          border-radius: 6px;
        }

        .form-group button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: #fff;
          padding: 10px 20px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: bold;
        }

        .form-group button:hover {
          opacity: 0.9;
        }

        .proxy-list {
          margin-top: 24px;
        }

        .list-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .list-header h3 {
          color: #fff;
          margin: 0;
        }

        .list-header button {
          background: rgba(76, 175, 80, 0.2);
          border: 1px solid rgba(76, 175, 80, 0.5);
          color: #4caf50;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
        }

        .empty-state {
          text-align: center;
          padding: 40px;
          color: rgba(255, 255, 255, 0.6);
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 12px;
          text-align: left;
        }

        td {
          padding: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.8);
        }

        tr.active {
          background: rgba(76, 175, 80, 0.05);
        }

        tr.inactive {
          background: rgba(244, 67, 54, 0.05);
          opacity: 0.6;
        }

        .status-badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.85em;
          font-weight: bold;
        }

        .status-badge.success {
          background: rgba(76, 175, 80, 0.2);
          color: #4caf50;
        }

        .status-badge.error {
          background: rgba(244, 67, 54, 0.2);
          color: #f44336;
        }

        .url-cell {
          font-family: monospace;
          font-size: 0.85em;
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .actions button {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #fff;
          padding: 6px 10px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 1.1em;
        }

        .actions button:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .success {
          color: #4caf50;
        }

        .error {
          color: #f44336;
        }
      `}</style>
        </div>
    );
};
