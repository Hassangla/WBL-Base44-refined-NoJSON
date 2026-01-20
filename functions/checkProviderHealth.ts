import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

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

    const { provider_id } = await req.json();

    const providers = provider_id 
      ? await base44.asServiceRole.entities.AIProvider.filter({ id: provider_id })
      : await base44.asServiceRole.entities.AIProvider.filter({ is_enabled: true });

    const results = [];

    for (const provider of providers) {
      const providerApiKey = provider.config?.api_key || provider.api_key;
      if (!providerApiKey) {
        await base44.asServiceRole.entities.AIProvider.update(provider.id, {
          health_status: 'unreachable',
          health_error: 'No API key configured',
          last_health_check: new Date().toISOString(),
          config: { ...(provider.config || {}), api_key_present: false }
        });
        results.push({ provider_id: provider.id, status: 'unreachable', error: 'No API key' });
        continue;
      }

      const startTime = Date.now();
      let status = 'healthy';
      let error = null;

      try {
        if (provider.provider_type === 'openai') {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: { 'Authorization': `Bearer ${providerApiKey}` },
            signal: AbortSignal.timeout(10000)
          });
          
          if (!response.ok) {
            status = 'unreachable';
            error = `HTTP ${response.status}`;
          }
        } else if (provider.provider_type === 'anthropic') {
          const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'x-api-key': providerApiKey,
              'anthropic-version': '2023-06-01',
              'content-type': 'application/json'
            },
            body: JSON.stringify({
              model: 'claude-3-haiku-20240307',
              max_tokens: 5,
              messages: [{ role: 'user', content: 'test' }]
            }),
            signal: AbortSignal.timeout(10000)
          });

          if (!response.ok) {
            status = 'unreachable';
            error = `HTTP ${response.status}`;
          }
        } else if (provider.provider_type === 'google') {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${providerApiKey}`,
            { signal: AbortSignal.timeout(10000) }
          );

          if (!response.ok) {
            status = 'unreachable';
            error = `HTTP ${response.status}`;
          }
        }

        const responseTime = Date.now() - startTime;
        
        if (status === 'healthy' && responseTime > 5000) {
          status = 'degraded';
          error = 'Slow response time';
        }

        await base44.asServiceRole.entities.AIProvider.update(provider.id, {
          health_status: status,
          health_error: error,
          response_time_ms: responseTime,
          last_health_check: new Date().toISOString(),
          config: { ...(provider.config || {}), api_key: providerApiKey, api_key_present: true }
        });

        results.push({ provider_id: provider.id, status, response_time_ms: responseTime, error });

      } catch (err) {
        await base44.asServiceRole.entities.AIProvider.update(provider.id, {
          health_status: 'unreachable',
          health_error: err.message,
          last_health_check: new Date().toISOString()
        });
        results.push({ provider_id: provider.id, status: 'unreachable', error: err.message });
      }
    }

    return Response.json({ success: true, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});