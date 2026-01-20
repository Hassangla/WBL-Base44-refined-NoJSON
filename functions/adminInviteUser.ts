import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function resolveAuth(base44: any) {
  const svc = base44?.asServiceRole ?? base44;
  return {
    auth: svc?.auth ?? base44?.auth,
    svc,
    entities: (svc?.entities ?? base44?.entities)
  };
}

function resolveInvite(auth: any) {
  if (!auth) return null;
  return (
    auth.inviteUser ||
    auth.admin?.inviteUser ||
    auth.users?.inviteUser ||
    null
  );
}

async function isAdminOrSubAdmin(base44, authUser) {
  if (!authUser) return false;
  if (authUser.role === 'admin') return true;

  const id = authUser.id;
  const email = authUser.email;

  try {
    const users = id
      ? await base44.asServiceRole.entities.User.filter({ id })
      : (email ? await base44.asServiceRole.entities.User.filter({ email }) : []);
    return users?.[0]?.wbl_role === 'sub_admin';
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!(await isAdminOrSubAdmin(base44, user))) {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const { email, role, wbl_role } = await req.json();

    if (!email) {
      return Response.json({ error: 'Email is required' }, { status: 400 });
    }

    // Enforce: Sub-Admin must be system Admin
    const effectiveRole = (wbl_role === 'sub_admin') ? 'admin' : (role || 'user');

    // Safe auth resolution
    const { auth, entities } = resolveAuth(base44);
    const inviteFn = resolveInvite(auth);

    if (!inviteFn) {
      return Response.json({ 
        error: 'Invitation not supported in this runtime: no inviteUser method available on auth client.' 
      }, { status: 500 });
    }

    // Invite user with fallback signature detection
    try {
      try {
        await inviteFn({ email, role: effectiveRole });
      } catch (e) {
        await inviteFn(email, effectiveRole);
      }
    } catch (inviteError) {
      console.error('Invite error:', inviteError);
      return Response.json({ error: inviteError.message || 'Failed to invite user' }, { status: 500 });
    }

    // Try to update wbl_role and role if user exists
    try {
      const users = await entities.User.filter({ email });
      if (users.length > 0) {
        await entities.User.update(users[0].id, { 
          role: effectiveRole,
          wbl_role 
        });
      }
    } catch (err) {
      console.log('Could not set wbl_role yet:', err.message);
    }

    return Response.json({ success: true });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});