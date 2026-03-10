export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: {
    code: string;
    message: string;
  };
}

export type PermissionType = 'LOCATION' | 'PHOTO';
export type PermissionStatus = 'GRANTED' | 'DENIED' | 'LIMITED';
export type PermissionScope = 'ALWAYS' | 'IN_USE' | 'SELECTED' | 'NONE';

export interface UserPermission {
  permissionType: PermissionType;
  status: PermissionStatus;
  grantedScope: PermissionScope;
}
