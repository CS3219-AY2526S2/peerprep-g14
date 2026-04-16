import React, { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface AuthContextType {
    isAuthenticated: boolean;
    userRole: string | null;
    userId: string | null;
    isLoading: boolean;
    login: (userId: string, role: string) => void;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [userId, setUserId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const queryClient = useQueryClient();

    useEffect(() => {
        const verifySession = async () => {
            try {
                const response = await fetch('/api/auth/verify', {
                    method: 'GET',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    credentials: 'include', // Ensure cookies are sent
                });

                if (response.ok) {
                    const data = await response.json();
                    setIsAuthenticated(true);
                    setUserId(data.userId);
                    setUserRole(data.role);
                } else {
                    setIsAuthenticated(false);
                    setUserId(null);
                    setUserRole(null);
                }
            } catch (error) {
                console.error('Session verification failed:', error);
                setIsAuthenticated(false);
                setUserId(null);
                setUserRole(null);
            } finally {
                setIsLoading(false);
            }
        };

        verifySession();
    }, []);

    const login = (userId: string, role: string) => {
        setIsAuthenticated(true);
        setUserId(userId);
        setUserRole(role);
    };

    const logout = async () => {
        try {
            await fetch('/api/auth/logout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                credentials: 'include',
            });
            // Clear state only after successful external logout
            setIsAuthenticated(false);
            setUserId(null);
            setUserRole(null);
            queryClient.clear();
            localStorage.clear();
        } catch (error) {
            console.error('Failed to clear cookies on logout:', error);
            // On failure, we should probably still log them out locally to prevent them from being stuck
            setIsAuthenticated(false);
            setUserId(null);
            setUserRole(null);
            queryClient.clear();
            localStorage.clear();
        }
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, userRole, userId, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
