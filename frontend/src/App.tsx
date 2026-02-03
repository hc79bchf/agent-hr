/**
 * Main App component with routing configuration.
 */

import { Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts';
import { AdminRoute, ProtectedRoute } from './components';
import { WelcomePage, AgentList, AgentDetail, Login, Register, SkillsPage, ToolsPage, MemoryPage, OrganizationsPage, UsersPage, ComponentRegistryPage, ApiDocsPage } from './pages';

/**
 * TanStack Query client instance.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
});

/**
 * Root application component.
 * Sets up auth provider, query client, and routing.
 */
function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />

          {/* Agents list as explicit route */}
          <Route
            path="/agents"
            element={
              <ProtectedRoute>
                <AgentList />
              </ProtectedRoute>
            }
          />

          {/* Agent detail page */}
          <Route
            path="/agents/:id"
            element={
              <ProtectedRoute>
                <AgentDetail />
              </ProtectedRoute>
            }
          />

          {/* Agent skills page */}
          <Route
            path="/agents/:id/skills"
            element={
              <ProtectedRoute>
                <SkillsPage />
              </ProtectedRoute>
            }
          />

          {/* Agent MCP tools page */}
          <Route
            path="/agents/:id/tools"
            element={
              <ProtectedRoute>
                <ToolsPage />
              </ProtectedRoute>
            }
          />

          {/* Agent memory page */}
          <Route
            path="/agents/:id/memory"
            element={
              <ProtectedRoute>
                <MemoryPage />
              </ProtectedRoute>
            }
          />

          {/* Organizations page (admin only) */}
          <Route
            path="/organizations"
            element={
              <AdminRoute>
                <OrganizationsPage />
              </AdminRoute>
            }
          />

          {/* Users management page (admin only) */}
          <Route
            path="/users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />

          {/* Component Registry page */}
          <Route
            path="/component-registry"
            element={
              <ProtectedRoute>
                <ComponentRegistryPage />
              </ProtectedRoute>
            }
          />

          {/* API Documentation page */}
          <Route
            path="/api-docs"
            element={
              <ProtectedRoute>
                <ApiDocsPage />
              </ProtectedRoute>
            }
          />

          {/* Catch-all redirect to welcome page */}
          <Route
            path="*"
            element={
              <ProtectedRoute>
                <WelcomePage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
