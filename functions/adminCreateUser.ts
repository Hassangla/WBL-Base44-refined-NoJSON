import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function resolveAuth(base44: any) {
  const svc = base44?.asServiceRole ?? base44;
  return {
    auth: svc?.auth ?? base44?.auth,
    svc,
    entities: (svc?.entities ?? base44?.entities)
  };
}

function resolveCreateUser(auth: any) {
  if (!auth) return null;
  return (
    auth.admin?.createUser ||
    auth.createUser ||
    auth.users?.createUser ||
    auth.signUp ||
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

    const { email, password, role, wbl_role, full_name } = await req.json();

    if (!email || !password) {
      return Response.json({ error: 'Email and password are required' }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Enforce: Sub-Admin must be system Admin
    const effectiveRole = (wbl_role === 'sub_admin') ? 'admin' : (role || 'user');

    // Safe auth resolution
    const { auth, entities } = resolveAuth(base44);
    const createFn = resolveCreateUser(auth);

    if (!createFn) {
      return Response.json({ 
        error: 'Manual user creation is not supported in this runtime: no createUser/signUp method available on auth client. Use invitations instead.' 
      }, { status: 500 });
    }

    // Create user with fallback signatures
    let mode = 'created';
    try {
      try {
        await createFn({ email, password, role: effectiveRole });
      } catch (e) {
        await createFn(email, password);
      }
    } catch (authError) {
      console.error('Auth error:', authError);
      return Response.json({ error: authError.message || 'Failed to create user' }, { status: 500 });
    }

    // Update or create User entity with role and wbl_role
    try {
      const users = await entities.User.filter({ email });
      if (users.length > 0) {
        await entities.User.update(users[0].id, { 
          role: effectiveRole,
          wbl_role: wbl_role || 'researcher',
          full_name: full_name || users[0].full_name
        });
      } else {
        await entities.User.create({
          email,
          role: effectiveRole,
          wbl_role: wbl_role || 'researcher',
          full_name: full_name || email.split('@')[0]
        });
      }
    } catch (err) {
      console.error('Failed to update User entity:', err);
    }

    return Response.json({ success: true, mode });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});