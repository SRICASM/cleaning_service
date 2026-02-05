import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');

      if (storedToken) {
        try {
          let response;
          // Determine which endpoint to call based on user type
          if (userType === 'EMPLOYEE') {
            response = await axios.get(`${API}/auth/employee/me`, {
              headers: { Authorization: `Bearer ${storedToken}` }
            });
          } else {
            // Default to customer/admin endpoint
            response = await axios.get(`${API}/auth/me`, {
              headers: { Authorization: `Bearer ${storedToken}` }
            });
          }

          setUser(response.data);
          setToken(storedToken);
        } catch (error) {
          console.error("Session restore failed", error);
          localStorage.removeItem('token');
          localStorage.removeItem('userType');
          setToken(null);
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, []);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('userType', 'CUSTOMER'); // Assume customer/admin
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const register = async (name, email, password, phone, address, city, postalCode) => {
    const response = await axios.post(`${API}/auth/register`, {
      name,
      email,
      password,
      phone,
      address,
      city,
      postal_code: postalCode
    });
    const { token: newToken, user: userData } = response.data;
    localStorage.setItem('token', newToken);
    localStorage.setItem('userType', 'CUSTOMER');
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('userType');
    setToken(null);
    setUser(null);
  };

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${token}`
  });

  const otpLogin = (authData) => {
    const { access_token, refresh_token, user: userData } = authData;
    localStorage.setItem('token', access_token);
    localStorage.setItem('refresh_token', refresh_token);
    localStorage.setItem('userType', 'EMPLOYEE');
    setToken(access_token);
    setUser(userData);
    return userData;
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated: !!user,
      token,
      loading,
      login,
      otpLogin,
      register,
      logout,
      getAuthHeaders,
      setUser
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
