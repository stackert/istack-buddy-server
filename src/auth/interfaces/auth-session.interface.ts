export interface AuthSession {
  id: string;
  userId: string;
  jwtToken: string;
  groupPermissionChain: string[];
  userPermissionChain: string[];
  groupMemberships: string[];
  initialAccessTime: Date;
  lastAccessTime: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface AuthSessionQueryResult {
  id: string;
  user_id: string;
  jwt_token: string;
  group_permission_chain: any;
  user_permission_chain: any;
  group_memberships: any;
  initial_access_time: string;
  last_access_time: string;
  created_at: string;
  updated_at: string;
}
