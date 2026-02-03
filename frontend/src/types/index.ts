/**
 * Re-export all types from a single entry point.
 */

// Auth types
export type {
  User,
  RegisterRequest,
  LoginRequest,
  TokenResponse,
} from './auth';

// Agent types
export type {
  AgentStatus,
  Agent,
  AgentCreate,
  AgentUpdate,
  AgentListResponse,
  AgentListParams,
} from './agent';

// Version types
export type {
  ChangeType,
  AgentVersion,
  VersionListResponse,
  VersionListParams,
  DiffChangeType,
  ComponentDiff,
  VersionSummary,
  DiffSummary,
  VersionCompareResponse,
} from './version';

// Component types
export type {
  ComponentType,
  Component,
  ComponentUpdate,
  ComponentEditResponse,
  MemoryComponentType,
  ComponentFolder,
  ComponentInFolder,
  ComponentFolderDetail,
  FoldersByType,
} from './component';

// Library types
export type {
  LibraryComponentType,
  LibraryComponent,
  LibraryComponentCreate,
  LibraryComponentUpdate,
  LibraryComponentListResponse,
  LibraryListParams,
  LibraryComponentBatchCreate,
  LibraryComponentBatchFailure,
  LibraryComponentBatchResponse,
  AgentLibraryRef,
  AgentLibraryRefsResponse,
  AgentLibraryRefCreate,
  PublishToLibraryRequest,
  PublishToLibraryResponse,
  AuthorInfo,
} from './library';

// Deployment types
export type {
  DeploymentStatus,
  ContainerStatus,
  Deployment,
  DeployRequest,
  DeployResponse,
  DeploymentListResponse,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  WebSocketMessageType,
  WebSocketMessage,
} from './deployment';

// Memory types
export type {
  MemoryType,
  SuggestionStatus,
  MemoryCreate,
  MemoryUpdate,
  Memory,
  MemoryResponse,
  MemorySuggestion,
  MemorySuggestionReview,
  MemorySuggestionListResponse,
  WorkingMemoryState,
  WorkingMemoryItem,
  WorkingMemoryInject,
} from './memory';

export { MEMORY_TYPE_INFO, CREATABLE_MEMORY_TYPES } from './memory';

// Grant and access request types
export type {
  ComponentAccessLevel,
  RequestStatus,
  ComponentGrant,
  ComponentGrantCreate,
  ComponentGrantUpdate,
  ComponentGrantListResponse,
  ComponentAccessRequest,
  ComponentAccessRequestCreate,
  ComponentAccessRequestResolve,
  ComponentAccessRequestListResponse,
  AccessRequestListParams,
} from './grants';

// Component registry types
export type {
  RegistryComponentType,
  ComponentVisibility,
  UserInfo,
  ComponentRegistryEntry,
  ComponentRegistryCreate,
  ComponentRegistryUpdate,
  ComponentOwnershipUpdate,
  ComponentRegistryListResponse,
  ComponentRegistryListParams,
  ComponentSnapshot,
  ComponentSnapshotCreate,
  ComponentSnapshotListResponse,
} from './componentRegistry';

/**
 * Common API error response format.
 */
export interface ApiError {
  detail: string;
}

/**
 * Generic paginated response.
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
}
