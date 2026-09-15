import React, { createContext, useContext, useState, useEffect } from 'react';

// Simplified to 3 roles: citizen | officer | admin
// Legacy roles (reviewer, district_admin, state_admin) are kept for DB compat
export type UserRole = 'citizen' | 'officer' | 'admin' | 'reviewer' | 'district_admin' | 'state_admin';

export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  phone_number?: string;
  created_at?: string;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  isLoading: boolean;
  /** True if the current user is an officer OR admin (or legacy officer roles) */
  isOfficerOrAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('civicsense_token');
    const storedUser = localStorage.getItem('civicsense_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse stored user', e);
      }
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('civicsense_token', newToken);
    localStorage.setItem('civicsense_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('civicsense_token');
    localStorage.removeItem('civicsense_user');
  };

  const OFFICER_ROLES: UserRole[] = ['officer', 'admin', 'reviewer', 'district_admin', 'state_admin'];
  const isOfficerOrAdmin = user ? OFFICER_ROLES.includes(user.role) : false;

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isLoading, isOfficerOrAdmin }}>
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
