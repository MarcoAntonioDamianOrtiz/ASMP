// Export config
export { auth, db, googleProvider, writeBatch } from './config';

// Export types
export type {
  FirebaseUser,
  FirebaseGroup,
  FirebaseAlert,
  FirebaseUbicacion,
  GroupInvitation,
  UnifiedGroup
} from './types';

// Export users functions
export {
  getUsers,
  getUserByEmail,
  createUser,
  updateUserStatus,
  subscribeToUsers,
  setUserOffline
} from './users';

// Export groups functions
export {
  getGroups,
  getUserGroups,
  createGroup,
  deleteGroup,
  subscribeToUserGroups,
  deleteUserGroup
} from './groups';

// Export alerts functions
export {
  getGroupAlerts,
  subscribeToGroupAlerts,
  resolveGroupAlert,
  createTestAlert,
  getGroupAlertStats
} from './alerts';

// Export locations functions
export {
  updateUserLocation,
  getGroupMembersLocations,
  subscribeToGroupLocations,
  activateMemberCircle,
  deactivateMemberCircle,
  getMyLocation,
  subscribeToMyLocation,
  cleanupUserLocation,
  getMemberCircleStatus,
  cleanupOrphanedLocations,
  cleanupInactiveLocations
} from './locations';

// Export invitations functions
export {
  inviteToGroup,
  respondToInvitation,
  getUserInvitations,
  subscribeToUserInvitations,
  removeMemberFromGroup
} from './invitations';

// Export autoSync functions
export {
  createAutoSyncGroup,
  addMemberAutoSync,
  removeMemberAutoSync,
  subscribeToUserGroupsAutoSync,
  migrateExistingGroupsToAutoSync,
  checkAutoSyncHealth,
  forceSyncGroup,
  setupMobileToWebSync
} from './autoSync';

// Export cleanup & diagnostic functions
export {
  cleanupDuplicateUsers,
  diagnoseLocationIssues,
  autoFixLocationIssues
} from './cleanup';