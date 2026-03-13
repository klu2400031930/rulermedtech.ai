import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const safeGetItem = (key) => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const safeSetItem = (key, value) => {
    try {
        localStorage.setItem(key, value);
    } catch {
        // Storage might be unavailable (private mode, disabled, etc.)
    }
};

const safeRemoveItem = (key) => {
    try {
        localStorage.removeItem(key);
    } catch {
        // Storage might be unavailable (private mode, disabled, etc.)
    }
};

const safeParse = (value) => {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
};

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const token = safeGetItem('token');
        const savedUser = safeGetItem('user');
        const parsedUser = safeParse(savedUser);

        if (token && parsedUser) {
            setUser(parsedUser);
        }

        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const res = await api.post('/auth/login', { email, password });
        const data = res.data;
        safeSetItem('token', data.token);
        safeSetItem('user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const register = async (userData) => {
        const res = await api.post('/auth/register', userData);
        const data = res.data;
        safeSetItem('token', data.token);
        safeSetItem('user', JSON.stringify(data));
        setUser(data);
        return data;
    };

    const updateUser = (data) => {
        if (!data) return;
        if (data.token) {
            safeSetItem('token', data.token);
        }
        safeSetItem('user', JSON.stringify(data));
        setUser(data);
    };

    const logout = () => {
        safeRemoveItem('token');
        safeRemoveItem('user');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, register, logout, updateUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
