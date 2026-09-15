import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

interface User {
  id: number;
  username: string;
  email: string;
  role: string;  // 'citizen', 'officer', 'district_admin', 'state_admin'
  phone_number?: string;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, email: string, password: string, role: string, phoneNumber?: string) => Promise<User>;
  logout: () => void;
  simulateRole: (role: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (token) {
        try {
          const response = await api.get("/api/auth/me");
          setUser(response.data);
        } catch (error) {
          console.error("Failed to authenticate token, logging out.", error);
          logout();
        }
      }
      setLoading(false);
    };
    fetchMe();
  }, [token]);

  const login = async (username: string, password: string): Promise<User> => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("username", username);
      params.append("password", password);
      
      const response = await api.post("/api/auth/login", params, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" }
      });
      
      const { access_token, user: loggedUser } = response.data;
      localStorage.setItem("token", access_token);
      setToken(access_token);
      setUser(loggedUser);
      setLoading(false);
      return loggedUser;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string, role: string, phoneNumber?: string): Promise<User> => {
    setLoading(true);
    try {
      const response = await api.post("/api/auth/register", {
        username,
        email,
        password,
        role,
        phone_number: phoneNumber
      });
      setLoading(false);
      return response.data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const simulateRole = (role: string) => {
    if (!user) {
      // Mock user for simulation
      const mockUser: User = {
        id: 999,
        username: `simulated_${role}`,
        email: `${role}@civicsense.gov.in`,
        role: role,
        created_at: new Date().toISOString()
      };
      setUser(mockUser);
    } else {
      setUser({ ...user, role });
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, simulateRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
