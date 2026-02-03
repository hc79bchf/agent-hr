/**
 * Types for the component library feature.
 */

/**
 * Library component type.
 */
export type LibraryComponentType = 'skill' | 'mcp_tool' | 'memory';

/**
 * Author information.
 */
export interface AuthorInfo {
  id: string;
  name: string;
  email: string;
}

/**
 * A component in the central library.
 */
export interface LibraryComponent {
  id: string;
  type: LibraryComponentType;
  name: string;
  description: string | null;
  content: string | null;
  config: Record<string, unknown>;
  source_path: string | null;
  author_id: string;
  author: AuthorInfo | null;
  tags: string[];
  usage_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Request to create a library component.
 */
export interface LibraryComponentCreate {
  type: LibraryComponentType;
  name: string;
  description?: string | null;
  content?: string | null;
  config?: Record<string, unknown>;
  tags?: string[];
}

/**
 * Request to update a library component.
 */
export interface LibraryComponentUpdate {
  name?: string;
  description?: string | null;
  content?: string | null;
  config?: Record<string, unknown>;
  tags?: string[];
}

/**
 * List response for library components.
 */
export interface LibraryComponentListResponse {
  data: LibraryComponent[];
  total: number;
}

/**
 * Query parameters for listing library components.
 */
export interface LibraryListParams {
  type?: LibraryComponentType;
  search?: string;
  tag?: string;
  author_id?: string;
  skip?: number;
  limit?: number;
}

/**
 * A reference linking an agent to a library component.
 */
export interface AgentLibraryRef {
  id: string;
  agent_id: string;
  library_component_id: string;
  library_component: LibraryComponent | null;
  added_at: string;
  added_by: string | null;
}

/**
 * List response for agent library refs.
 */
export interface AgentLibraryRefsResponse {
  data: AgentLibraryRef[];
  total: number;
}

/**
 * Request to add a library component to an agent.
 */
export interface AgentLibraryRefCreate {
  library_component_id: string;
}

/**
 * Request to publish a component to the library.
 */
export interface PublishToLibraryRequest {
  name?: string;
  description?: string;
  tags?: string[];
}

/**
 * Response after publishing a component to the library.
 */
export interface PublishToLibraryResponse {
  library_component: LibraryComponent;
  message: string;
}

/**
 * Request to create multiple library components at once.
 */
export interface LibraryComponentBatchCreate {
  components: LibraryComponentCreate[];
}

/**
 * Information about a failed component creation.
 */
export interface LibraryComponentBatchFailure {
  name: string;
  error: string;
}

/**
 * Response for batch component creation.
 */
export interface LibraryComponentBatchResponse {
  created: LibraryComponent[];
  failed: LibraryComponentBatchFailure[];
  total_created: number;
  total_failed: number;
}
