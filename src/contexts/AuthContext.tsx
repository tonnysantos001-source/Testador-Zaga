import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import type { User, Session, AuthError, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '../utils/supabase';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signUp: (email: string, password: string) => Promise<{ error: AuthError | null }>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Configuração de timeout de inatividade (30 minutos)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos em ms
const USER_CHECK_INTERVAL = 5 * 60 * 1000; // Verificar a cada 5 minutos se o usuário ainda existe

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // Refs para timers
    const inactivityTimer = useRef<number | null>(null);
    const userCheckTimer = useRef<number | null>(null);

    // Função para verificar se o usuário ainda existe no banco
    const checkUserExists = useCallback(async (userId: string): Promise<boolean> => {
        try {
            // Adicionar timeout de 5 segundos
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);

            const { data, error } = await supabase.auth.getUser();
            clearTimeout(timeoutId);

            if (error || !data.user) {
                console.warn('Usuário não encontrado ou erro ao verificar:', error);
                return false;
            }

            return data.user.id === userId;
        } catch (err) {
            console.error('Erro ao verificar existência do usuário:', err);
            // Em caso de erro, assumir que o usuário existe para não travar
            return true;
        }
    }, []);

    // Função de logout com limpeza de timers
    const signOut = useCallback(async () => {
        // Limpar timers
        if (inactivityTimer.current) {
            clearTimeout(inactivityTimer.current);
        }
        if (userCheckTimer.current) {
            clearInterval(userCheckTimer.current);
        }

        await supabase.auth.signOut();
        setUser(null);
        setSession(null);
    }, []);

    // Resetar timer de inatividade
    const resetInactivityTimer = useCallback(() => {
        // Limpar timer anterior
        if (inactivityTimer.current) {
            clearTimeout(inactivityTimer.current);
        }

        // Criar novo timer (somente se houver sessão ativa)
        if (session) {
            inactivityTimer.current = setTimeout(async () => {
                console.log('⏰ Sessão expirada por inatividade (30 minutos)');
                await signOut();
                // Opcional: Mostrar mensagem ao usuário
                alert('Sua sessão expirou por inatividade. Por favor, faça login novamente.');
            }, INACTIVITY_TIMEOUT);
        }
    }, [session, signOut]);

    // Monitorar atividade do usuário
    useEffect(() => {
        if (!session) return;

        const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];

        const handleActivity = () => {
            resetInactivityTimer();
        };

        // Adicionar listeners
        events.forEach(event => {
            window.addEventListener(event, handleActivity);
        });

        // Iniciar timer
        resetInactivityTimer();

        return () => {
            // Remover listeners
            events.forEach(event => {
                window.removeEventListener(event, handleActivity);
            });

            // Limpar timer
            if (inactivityTimer.current) {
                clearTimeout(inactivityTimer.current);
            }
        };
    }, [session, resetInactivityTimer]);

    // Verificar periodicamente se o usuário ainda existe
    useEffect(() => {
        if (!user?.id || !session) return;

        // Verificação inicial
        checkUserExists(user.id).then(exists => {
            if (!exists) {
                console.warn('⚠️ Usuário foi removido do sistema. Fazendo logout...');
                signOut();
            }
        });

        // Verificação periódica
        userCheckTimer.current = setInterval(async () => {
            const exists = await checkUserExists(user.id);
            if (!exists) {
                console.warn('⚠️ Usuário foi removido do sistema. Fazendo logout...');
                await signOut();
            }
        }, USER_CHECK_INTERVAL);

        return () => {
            if (userCheckTimer.current) {
                clearInterval(userCheckTimer.current);
            }
        };
    }, [user?.id, session, checkUserExists, signOut]);

    useEffect(() => {
        // Get initial session - SIMPLIFICADO para não travar
        supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
            // NÃO verificar se usuário existe aqui para evitar travamento
            // Apenas setar a sessão se existir
            if (session?.user) {
                setSession(session);
                setUser(session.user);
            } else {
                setSession(null);
                setUser(null);
            }
            // SEMPRE finalizar loading
            setLoading(false);
        }).catch((err) => {
            console.error('Auth initialization error:', err);
            setSession(null);
            setUser(null);
            setLoading(false);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
            console.log('🔐 Auth event:', event);

            // Se o evento é SIGNED_OUT ou TOKEN_REFRESHED com falha
            if (event === 'SIGNED_OUT') {
                setSession(null);
                setUser(null);
            } else if (session?.user) {
                // Verificar se o usuário ainda existe
                const exists = await checkUserExists(session.user.id);
                if (exists) {
                    setSession(session);
                    setUser(session.user);
                } else {
                    console.warn('Usuário não existe mais. Fazendo logout...');
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                }
            } else {
                setSession(null);
                setUser(null);
            }

            setLoading(false);
        });

        return () => subscription.unsubscribe();
    }, [checkUserExists]);

    const signIn = async (email: string, password: string) => {
        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: undefined, // No email confirmation
            },
        });
        return { error };
    };

    const value = {
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}
