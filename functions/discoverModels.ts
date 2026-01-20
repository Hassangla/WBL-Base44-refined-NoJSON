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

    const provider = await base44.asServiceRole.entities.AIProvider.filter({ id: provider_id });
    if (!provider || provider.length === 0) {
      return Response.json({ error: 'Provider not found' }, { status: 404 });
    }

    const providerData = provider[0];
    const providerApiKey = providerData.config?.api_key || providerData.api_key;
    const models = [];

    try {
      if (providerData.provider_type === 'openai') {
        const response = await fetch('https://api.openai.com/v1/models', {
          headers: {
            'Authorization': `Bearer ${providerApiKey}`
          }
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const data = await response.json();
        const chatModels = data.data.filter(m => 
          m.id.includes('gpt') || m.id.includes('o1') || m.id.includes('o3')
        );

        // OpenAI pricing (as of 2026-01)
        const pricingMap = {
          'gpt-4o': { input: 2.50, output: 10.00 },
          'gpt-4o-mini': { input: 0.150, output: 0.600 },
          'gpt-4-turbo': { input: 10.00, output: 30.00 },
          'gpt-4': { input: 30.00, output: 60.00 },
          'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
          'o1-preview': { input: 15.00, output: 60.00 },
          'o1-mini': { input: 3.00, output: 12.00 },
          'o1': { input: 15.00, output: 60.00 }
        };

        for (const model of chatModels) {
          const baseModelId = model.id.split('-2')[0]; // Handle dated versions
          const pricing = pricingMap[baseModelId] || pricingMap[model.id] || {};
          
          models.push({
            provider_id: provider_id,
            model_id: model.id,
            display_name: model.id,
            is_enabled: true,
            supports_web_tooling: model.id.includes('gpt-4') || model.id.includes('o1'),
            pricing_json: pricing,
            last_refreshed_at: new Date().toISOString()
          });
        }
      } else if (providerData.provider_type === 'anthropic') {
        // Anthropic doesn't have a models list endpoint, use known models
        const knownModels = [
          { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', web: true, pricing: { input: 3.00, output: 15.00 } },
          { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', web: true, pricing: { input: 0.80, output: 4.00 } },
          { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', web: true, pricing: { input: 15.00, output: 75.00 } },
          { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet', web: true, pricing: { input: 3.00, output: 15.00 } },
          { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', web: true, pricing: { input: 0.25, output: 1.25 } }
        ];

        // Verify API key works
        const testResponse = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': providerApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Hi' }]
          })
        });

        if (!testResponse.ok) {
          throw new Error(`Anthropic API error: ${testResponse.status}`);
        }

        for (const model of knownModels) {
          models.push({
            provider_id: provider_id,
            model_id: model.id,
            display_name: model.name,
            is_enabled: true,
            supports_web_tooling: model.web,
            pricing_json: model.pricing,
            last_refreshed_at: new Date().toISOString()
          });
        }
      } else if (providerData.provider_type === 'google') {
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + providerApiKey);

        if (!response.ok) {
          throw new Error(`Google API error: ${response.status}`);
        }

        const data = await response.json();
        const chatModels = data.models?.filter(m => 
          m.name.includes('gemini') && m.supportedGenerationMethods?.includes('generateContent')
        ) || [];

        // Google Gemini pricing (as of 2026-01, per million tokens)
        const pricingMap = {
          'gemini-2.0-flash-exp': { input: 0, output: 0 },
          'gemini-1.5-pro': { input: 1.25, output: 5.00 },
          'gemini-1.5-flash': { input: 0.075, output: 0.30 },
          'gemini-1.0-pro': { input: 0.50, output: 1.50 }
        };

        for (const model of chatModels) {
          const modelId = model.name.replace('models/', '');
          const baseModelId = modelId.split('-').slice(0, 4).join('-'); // Handle versioned IDs
          const pricing = pricingMap[baseModelId] || pricingMap[modelId] || {};
          
          models.push({
            provider_id: provider_id,
            model_id: modelId,
            display_name: model.displayName || modelId,
            is_enabled: true,
            supports_web_tooling: modelId.includes('pro'),
            pricing_json: pricing,
            last_refreshed_at: new Date().toISOString()
          });
        }
      }

      // Save discovered models
      const existingModels = await base44.asServiceRole.entities.AIModel.filter({ provider_id });
      const existingModelIds = new Set(existingModels.map(m => m.model_id));

      const newModels = models.filter(m => !existingModelIds.has(m.model_id));
      
      if (newModels.length > 0) {
        await base44.asServiceRole.entities.AIModel.bulkCreate(newModels);
      }

      return Response.json({
        success: true,
        discovered: models.length,
        new_models: newModels.length,
        models: models
      });

    } catch (error) {
      return Response.json({
        success: false,
        error: error.message,
        models: []
      });
    }

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});