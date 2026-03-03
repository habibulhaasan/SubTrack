rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function isSignedIn() {
      return request.auth != null;
    }

    // Checks the users/{uid} doc for role == 'superadmin'
    function isSuperAdmin() {
      return isSignedIn()
        && exists(/databases/$(database)/documents/users/$(request.auth.uid))
        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.get('role', '') == 'superadmin';
    }

    // Checks membership doc: must exist and have role == 'admin'
    function isOrgAdmin(orgId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid))
        && get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('role', '') == 'admin';
    }

    // Checks membership doc: must exist and approved == true
    function isOrgMember(orgId) {
      return isSignedIn()
        && exists(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid))
        && get(/databases/$(database)/documents/organizations/$(orgId)/members/$(request.auth.uid)).data.get('approved', false) == true;
    }

    // ── Users collection ───────────────────────────────────────────────────
    match /users/{userId} {
      // Any signed-in user can read user docs (needed to show names/profiles)
      allow read:   if isSignedIn();
      // Only the user themselves can create their own doc
      allow create: if isSignedIn() && request.auth.uid == userId;
      // User can update their own doc; superadmin can update any
      allow update: if isSignedIn() && (request.auth.uid == userId || isSuperAdmin());
      allow delete: if isSuperAdmin();
    }

    // ── Organizations ──────────────────────────────────────────────────────
    match /organizations/{orgId} {
      // Members, admins, creator, or superadmin can read
      allow read: if isSignedIn() && (
        request.auth.uid == resource.data.get('createdBy', '')
        || isOrgMember(orgId)
        || isOrgAdmin(orgId)
        || isSuperAdmin()
      );
      // Any signed-in user can create an org
      allow create: if isSignedIn();
      // Only org admin or superadmin can update/delete
      allow update: if isOrgAdmin(orgId) || isSuperAdmin();
      allow delete: if isSuperAdmin();

      // ── Members subcollection ─────────────────────────────────────────
      match /members/{memberId} {
        // A member can read their own doc; admin or superadmin can read all
        allow read: if isSignedIn() && (
          request.auth.uid == memberId
          || isOrgAdmin(orgId)
          || isSuperAdmin()
        );
        // A member can join (create their own doc); admin or superadmin can add any
        allow create: if isSignedIn() && (
          request.auth.uid == memberId
          || isOrgAdmin(orgId)
          || isSuperAdmin()
        );
        // Admin/superadmin can update any field; member can update own non-privileged fields
        allow update: if isOrgAdmin(orgId) || isSuperAdmin()
          || (
            isSignedIn()
            && request.auth.uid == memberId
            && !request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'approved'])
          );
        allow delete: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Payments / Investments subcollection ──────────────────────────
      match /investments/{paymentId} {
        allow read:   if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow create: if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow update: if isOrgAdmin(orgId) || isSuperAdmin();
        allow delete: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Expenses ──────────────────────────────────────────────────────
      match /expenses/{expenseId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Deployments ───────────────────────────────────────────────────
      match /deployments/{deploymentId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Income ────────────────────────────────────────────────────────
      match /income/{incomeId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Special Subscriptions ─────────────────────────────────────────
      match /specialSubscriptions/{subId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Distribution History ───────────────────────────────────────────
      match /distributionHistory/{entryId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Charity Records ────────────────────────────────────────────────
      match /charityRecords/{recordId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Investment Portfolio ───────────────────────────────────────────
      match /portfolio/{itemId} {
        allow read:  if isOrgMember(orgId) || isOrgAdmin(orgId) || isSuperAdmin();
        allow write: if isOrgAdmin(orgId) || isSuperAdmin();
      }

      // ── Notifications ─────────────────────────────────────────────────
      match /notifications/{notifId} {
        // Members read their own notifications; admins read all
        allow read:   if isSignedIn() && (
          resource.data.get('userId', '') == request.auth.uid
          || isOrgAdmin(orgId)
          || isSuperAdmin()
        );
        // Members can mark their own as read; admins can update any
        allow update: if isSignedIn() && (
          resource.data.get('userId', '') == request.auth.uid
          || isOrgAdmin(orgId)
          || isSuperAdmin()
        );
        // Members delete their own; admins delete any
        allow delete: if isSignedIn() && (
          resource.data.get('userId', '') == request.auth.uid
          || isOrgAdmin(orgId)
          || isSuperAdmin()
        );
        // Only admin or superadmin can create notifications
        allow create: if isOrgAdmin(orgId) || isSuperAdmin();
      }
    }

    // ── Invite links ───────────────────────────────────────────────────────
    match /invites/{inviteId} {
      // Anyone can read invite links (needed for join flow without auth)
      allow read: if true;
      // Org admin or superadmin can create invite links
      allow create: if isSignedIn() && (
        isOrgAdmin(request.resource.data.get('orgId', ''))
        || isSuperAdmin()
      );
      // Org admin or superadmin can delete
      allow delete: if isSignedIn() && (
        isOrgAdmin(resource.data.get('orgId', ''))
        || isSuperAdmin()
      );
      allow update: if false;
    }

    // ── Platform-wide settings (superadmin only) ───────────────────────────
    match /platform/{docId} {
      allow read:  if isSignedIn();
      allow write: if isSuperAdmin();
    }
  }
}
