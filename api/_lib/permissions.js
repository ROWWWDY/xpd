const ROLES = {
  owner: [
    'view_applications',
    'decide_applications',
    'delete_applications',
    'manage_invites',
    'manage_sync',
    'manage_admins',
    'view_security_log'
  ],
  coordinator: [
    'view_applications',
    'decide_applications',
    'manage_invites'
  ],
  reviewer: [
    'view_applications',
    'decide_applications'
  ]
};

function capabilitiesFor(permRole) {
  return ROLES[permRole] || [];
}

function can(permRole, capability) {
  return capabilitiesFor(permRole).includes(capability);
}

module.exports = { ROLES, capabilitiesFor, can };
