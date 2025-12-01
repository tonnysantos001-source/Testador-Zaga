import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Mail, Lock, AlertCircle, UserPlus, LogIn } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { isSupabaseConfigured } from '../utils/supabase';
import './Login.css';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signIn, signUp } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        if (!isSupabaseConfigured) {
            setError('Application not configured. Please set VITE_SUPABASE_URL in your environment.');
            setLoading(false);
            return;
        }

        try {
            const { error } = isLogin
                ? await signIn(email, password)
                : await signUp(email, password);

            if (error) {
                setError(error.message);
            } else {
                if (isLogin) {
                    navigate('/');
                } else {
                    // For sign up, we might want to show a success message or auto-login
                    // Supabase auto-logins after signup by default if email confirmation is off
                    navigate('/');
                }
            }
        } catch (err) {
            setError('An unexpected error occurred.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-background">
                <div className="gradient-orb orb-1"></div>
                <div className="gradient-orb orb-2"></div>
                <div className="gradient-orb orb-3"></div>
            </div>

            <div className="login-card">
                <div className="login-header">
                    <div className="logo-container">
                        <Shield className="logo-icon" size={48} />
                    </div>
                    <h1 className="login-title">
                        <span className="text-gradient">Checker Zaga</span>
                    </h1>
                    <p className="login-subtitle">Sistema de Validação de Cartões</p>
                </div>

                <form onSubmit={handleSubmit} className="login-form">
                    {error && (
                        <div className="error-message">
                            <AlertCircle size={18} />
                            <span>{error}</span>
                        </div>
                    )}

                    {!isSupabaseConfigured && !error && (
                        <div className="error-message" style={{ borderColor: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>
                            <AlertCircle size={18} />
                            <span>App not configured (Missing Env Vars)</span>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="email">
                            <Mail size={18} />
                            <span>Email</span>
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="seu@email.com"
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="password">
                            <Lock size={18} />
                            <span>Senha</span>
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="login-button"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="spinner-small"></span>
                                <span>{isLogin ? 'Entrando...' : 'Criando conta...'}</span>
                            </>
                        ) : (
                            <>
                                {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                                <span>{isLogin ? 'Entrar' : 'Criar Conta'}</span>
                            </>
                        )}
                    </button>
                </form>

                <div className="login-footer">
                    <p style={{ marginBottom: '1rem' }}>
                        {isLogin ? 'Não tem uma conta?' : 'Já tem uma conta?'}
                    </p>
                    <button
                        type="button"
                        className="text-gradient"
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontSize: '0.95rem',
                            fontWeight: 600,
                            textDecoration: 'underline'
                        }}
                        onClick={() => {
                            setIsLogin(!isLogin);
                            setError('');
                        }}
                    >
                        {isLogin ? 'Criar nova conta' : 'Voltar para Login'}
                    </button>
                </div>
            </div>
        </div>
    );
}
