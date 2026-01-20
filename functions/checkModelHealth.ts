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

    const { model_id } = await req.json();

    const models = model_id
      ? await base44.asServiceRole.entities.AIModel.filter({ id: model_id })
      : await base44.asServiceRole.entities.AIModel.filter({ is_enabled: true });

    const results = [];

    for (const model of models) {
      const providers = await base44.asServiceRole.entities.AIProvider.filter({ id: model.provider_id });
      if (providers.length === 0) {
        results.push({ model_id: model.id, status: 'unreachable', error: 'Provider not found' });
        continue;
      }

      const provider = providers[0];
      const providerApiKey = provider.config?.api_key || provider.api_key;
      if (!providerApiKey) {
        await base44.asServiceRole.entities.AIModel.update(model.id, {
          health_status: 'unreachable',
          health_error: 'Provider has no API key',
          last_health_check: new Date().toISOString()
        });
        results.push({ model_id: model.id, status: 'unreachable', error: 'No API key' });
        continue;
      }

      const startTime = Date.now();
      let status = 'healthy';
      let error = null;

      try {
        if (provider.provider_type === 'openai') {
          // Helper to detect GPT-5 models
          const isGpt5Model = (modelId) => {
            return /^gpt-?5(\b|[-_])/i.test((modelId ?? '').trim());
          };

          // Build request body with correct token parameter
          const body = {
            model: model.model_id,
            messages: [{ role: 'user', content: 'test' }]
          };

          if (isGpt5Model(model.model_id)) {
            body.max_completion_tokens = 16; // must be >= 16
          } else {
            body.max_tokens = 16;
          }

          const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${providerApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) {
            const errorData = await response.json();
            status = 'unreachable';
            error = errorData.error?.message || `HTTP ${response.status}`;
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
              model: model.model_id,
              max_tokens: 5,
              messages: [{ role: 'user', content: 'test' }]
            }),
            signal: AbortSignal.timeout(15000)
          });

          if (!response.ok) {
            const errorData = await response.json();
            status = 'unreachable';
            error = errorData.error?.message || `HTTP ${response.status}`;
          }
        } else if (provider.provider_type === 'google') {
          const geminiModelPath = (modelId) => {
            const id = (modelId ?? '').trim();
            if (!id) return id;
            return id.startsWith('models/') ? id : `models/${id}`;
          };

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/${geminiModelPath(model.model_id)}:generateContent?key=${providerApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: 'test' }] }],
                generationConfig: { maxOutputTokens: 16 }
              }),
              signal: AbortSignal.timeout(15000)
            }
          );

          if (!response.ok) {
            status = 'unreachable';
            error = `HTTP ${response.status}`;
          }
        }

        const responseTime = Date.now() - startTime;

        if (status === 'healthy' && responseTime > 8000) {
          status = 'degraded';
          error = 'Slow response time';
        }

        await base44.asServiceRole.entities.AIModel.update(model.id, {
          health_status: status,
          health_error: error,
          response_time_ms: responseTime,
          last_health_check: new Date().toISOString()
        });

        results.push({ model_id: model.id, status, response_time_ms: responseTime, error });

      } catch (err) {
        await base44.asServiceRole.entities.AIModel.update(model.id, {
          health_status: 'unreachable',
          health_error: err.message,
          last_health_check: new Date().toISOString()
        });
        results.push({ model_id: model.id, status: 'unreachable', error: err.message });
      }
    }

    return Response.json({ success: true, results });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});