/**
 * Authentication context provider.
 * Manages auth state and provides login/logout/register functions.
 * Includes auto-logout on token expiration and inactivity.
 */

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  useEffect,
  useRef,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authService } from '../services';
import {
  hasToken,
  getToken,
  isTokenExpired,
  isInactive,
  updateLastActivity,
  clearLastActivity,
} from '../lib/token';
import type { User, LoginRequest, RegisterRequest } from '../types';

/**
 * Interval for checking token expiration and inactivity (1 minute).
 */
const AUTO_LOGOUT_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Auth context value type.
 */
interface AuthContextValue {
  /** Current authenticated user, or null if not authenticated. */
  user: User | null;
  /** Whether the user is authenticated. */
  isAuthenticated: boolean;
  /** Whether the auth state is loading. */
  isLoading: boolean;
  /** Login with email and password. */
  login: (data: LoginRequest) => Promise<void>;
  /** Logout the current user. */
  logout: () => void;
  /** Register a new user. */
  register: (data: RegisterRequest) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Auth provider props.
 */
interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component.
 * Wraps the app and provides auth state and functions.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient();
  const logoutTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch current user if token exists
  const {
    data: user,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['currentUser'],
    queryFn: authService.getCurrentUser,
    enabled: hasToken(),
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const logout = useCallback(() => {
    authService.logout();
    clearLastActivity();
    // Clear the user cache - setQueryData is sufficient, no need to invalidate
    queryClient.setQueryData(['currentUser'], null);
  }, [queryClient]);

  const login = useCallback(
    async (data: LoginRequest): Promise<void> => {
      await authService.login(data);
      updateLastActivity();
      // Refetch current user after login
      await refetch();
    },
    [refetch]
  );

  // Auto logout on token expiration or inactivity
  useEffect(() => {
    if (!user) return;

    const checkAutoLogout = () => {
      const token = getToken();

      // Check token expiration
      if (isTokenExpired(token)) {
        console.log('Auto logout: Token expired');
        logout();
        return;
      }

      // Check inactivity
      if (isInactive()) {
        console.log('Auto logout: User inactive for too long');
        logout();
        return;
      }
    };

    // Initial check
    checkAutoLogout();

    // Set up periodic check
    const intervalId = setInterval(checkAutoLogout, AUTO_LOGOUT_CHECK_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [user, logout]);

  // Track user activity
  useEffect(() => {
    if (!user) return;

    const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    const handleActivity = () => {
      updateLastActivity();
    };

    // Initialize last activity
    updateLastActivity();

    // Add event listeners
    activityEvents.forEach((event) => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      activityEvents.forEach((event) => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [user]);

  // Clean up timeout ref on unmount
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
      }
    };
  }, []);

  const register = useCallback(
    async (data: RegisterRequest): Promise<User> => {
      return authService.register(data);
    },
    []
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      register,
    }),
    [user, isLoading, login, logout, register]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Hook to access auth context.
 * Must be used within an AuthProvider.
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
