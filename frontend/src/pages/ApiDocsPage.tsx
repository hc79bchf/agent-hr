/**
 * ApiDocsPage component.
 * Interactive Swagger UI documentation for Agent-HR APIs.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { useAuth } from '../contexts/AuthContext';

/**
 * API configuration.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';
const OPENAPI_URL = `${API_BASE_URL}/api/openapi.json`;

/**
 * ApiDocsPage component.
 * Displays interactive API documentation using Swagger UI.
 */
export function ApiDocsPage() {
  const { user, logout } = useAuth();
  const [spec, setSpec] = useState<object | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch OpenAPI spec
  useEffect(() => {
    const fetchSpec = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await fetch(OPENAPI_URL);
        if (!response.ok) {
          throw new Error(`Failed to fetch API spec: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        setSpec(data);
      } catch (err) {
        console.error('Error fetching OpenAPI spec:', err);
        setError(err instanceof Error ? err.message : 'Failed to load API documentation');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSpec();
  }, []);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-3xl font-bold text-gray-900 hover:text-indigo-600 transition-colors">Agent-HR</Link>
            <nav className="flex items-center gap-6">
              <Link
                to="/agents"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Agents
              </Link>
              <Link
                to="/component-registry"
                className="text-sm font-medium text-gray-600 hover:text-indigo-500"
              >
                Components
              </Link>
              {user?.is_admin && (
                <>
                  <Link
                    to="/organizations"
                    className="text-sm font-medium text-gray-600 hover:text-indigo-500"
                  >
                    Organizations
                  </Link>
                  <Link
                    to="/users"
                    className="text-sm font-medium text-gray-600 hover:text-indigo-500"
                  >
                    Users
                  </Link>
                </>
              )}
              <Link
                to="/api-docs"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                API Docs
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Welcome, {user?.name}</span>
            <button
              onClick={logout}
              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="mb-6 flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">API Documentation</h2>
            <p className="mt-1 text-sm text-gray-500">
              Interactive documentation for all Agent-HR API endpoints
            </p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${API_BASE_URL}/api/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Open in New Tab
            </a>
            <a
              href={`${API_BASE_URL}/api/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Swagger UI
            </a>
            <a
              href={OPENAPI_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              <svg className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download OpenAPI
            </a>
          </div>
        </div>

        {/* API Stats */}
        {spec && !isLoading && (
          <div className="mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-indigo-600">
                {Object.keys((spec as { paths?: Record<string, unknown> }).paths || {}).length}
              </div>
              <div className="text-sm text-gray-500">Endpoints</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-green-600">
                {String((spec as { info?: { version?: string } }).info?.version || 'N/A')}
              </div>
              <div className="text-sm text-gray-500">API Version</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-purple-600">
                {Object.keys((spec as { components?: { schemas?: Record<string, unknown> } }).components?.schemas || {}).length}
              </div>
              <div className="text-sm text-gray-500">Schemas</div>
            </div>
            <div className="bg-white rounded-lg shadow p-4">
              <div className="text-2xl font-bold text-orange-600">
                {((spec as { tags?: unknown[] }).tags || []).length}
              </div>
              <div className="text-sm text-gray-500">Tags/Categories</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            <span className="ml-3 text-gray-600">Loading API documentation...</span>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <div className="flex">
              <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading API documentation</h3>
                <p className="mt-1 text-sm text-red-700">{error}</p>
                <p className="mt-2 text-sm text-red-600">
                  Make sure the backend server is running at <code className="bg-red-100 px-1 rounded">{API_BASE_URL}</code>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Swagger UI */}
        {spec && !isLoading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <style>{`
              .swagger-ui .topbar { display: none; }
              .swagger-ui .info { margin: 20px 0; }
              .swagger-ui .info .title { font-size: 1.5rem; }
              .swagger-ui .opblock-tag { font-size: 1.1rem; font-weight: 600; }
              .swagger-ui .opblock { border-radius: 8px; margin-bottom: 8px; }
              .swagger-ui .opblock .opblock-summary { padding: 12px; }
              .swagger-ui .btn { border-radius: 6px; }
              .swagger-ui .btn.execute { background-color: #4f46e5; border-color: #4f46e5; }
              .swagger-ui .btn.execute:hover { background-color: #4338ca; }
              .swagger-ui section.models { border-radius: 8px; }
              .swagger-ui section.models .model-container { margin: 8px 0; }
              .swagger-ui .model-box { border-radius: 4px; }
              .swagger-ui input[type=text], .swagger-ui textarea { border-radius: 6px; }
              .swagger-ui select { border-radius: 6px; }
            `}</style>
            <SwaggerUI
              spec={spec}
              docExpansion="list"
              defaultModelsExpandDepth={1}
              filter={true}
              showExtensions={true}
              showCommonExtensions={true}
              tryItOutEnabled={true}
            />
          </div>
        )}
      </main>
    </div>
  );
}

export default ApiDocsPage;
