/**
 * Shared application header with navigation.
 * Shows admin links only to admin users.
 */

import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface AppHeaderProps {
  /** Current active page for highlighting */
  activePage?: 'home' | 'agents' | 'components' | 'organizations' | 'users';
}

/**
 * Application header with navigation links.
 * Admin-only links (Organizations, Users) are hidden from non-admin users.
 */
export function AppHeader({ activePage }: AppHeaderProps) {
  const { user, logout } = useAuth();

  const getLinkClass = (page: string) => {
    const baseClass = 'text-sm font-medium hover:text-indigo-500';
    return activePage === page
      ? `${baseClass} text-indigo-600`
      : `${baseClass} text-gray-600`;
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link
            to="/"
            className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors"
          >
            Agent-HR
          </Link>
          <nav className="flex items-center gap-6">
            <Link to="/agents" className={getLinkClass('agents')}>
              Agents
            </Link>
            <Link to="/component-registry" className={getLinkClass('components')}>
              Components
            </Link>
            {user?.is_admin && (
              <>
                <Link to="/organizations" className={getLinkClass('organizations')}>
                  Organizations
                </Link>
                <Link to="/users" className={getLinkClass('users')}>
                  Users
                </Link>
              </>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Welcome, {user?.name}
            {user?.is_admin && (
              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                Admin
              </span>
            )}
          </span>
          <button
            onClick={logout}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}
