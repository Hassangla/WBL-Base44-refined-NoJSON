import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

function normalizeUsage(usage, data) {
  let tokensIn = 0;
  let tokensOut = 0;

  if (usage) {
    // Responses API format
    if (usage.input_tokens !== undefined) {
      tokensIn = usage.input_tokens;
      tokensOut = usage.output_tokens || 0;
    }
    // Chat Completions format
    else if (usage.prompt_tokens !== undefined) {
      tokensIn = usage.prompt_tokens;
      tokensOut = usage.completion_tokens || 0;
    }
  }

  return { tokensIn, tokensOut };
}

function extractOpenAIResponseText(data) {
  if (!data) return '';

  // Some OpenAI Responses payloads include a convenience field
  if (typeof data.output_text === 'string' && data.output_text.trim().length > 0) {
    return data.output_text;
  }

  const outputs = Array.isArray(data.output) ? data.output : [];
  const messageItems = outputs.filter((item) => item?.type === 'message');

  const texts = [];

  for (const msg of messageItems) {
    const parts = Array.isArray(msg?.content) ? msg.content : [];
    for (const part of parts) {
      if (typeof part?.text === 'string') texts.push(part.text);
    }
  }

  // If no message items found, as a last resort, scan all outputs for any content.text
  if (texts.length === 0) {
    for (const item of outputs) {
      const parts = Array.isArray(item?.content) ? item.content : [];
      for (const part of parts) {
        if (typeof part?.text === 'string') texts.push(part.text);
      }
    }
  }

  return texts.join('\n').trim();
}

function repairJsonString(raw) {
  let s = raw.trim();
  
  // Strip markdown code fences
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  
  // Replace smart quotes with standard quotes
  s = s.replace(/[""]/g, '"').replace(/['']/g, "'");
  
  // Remove trailing commas before } or ]
  s = s.replace(/,(\s*[}\]])/g, '$1');
  
  return s;
}

function extractJsonObject(raw) {
  if (!raw) return null;
  
  const s = raw.trim();
  const first = s.indexOf('{');
  if (first === -1) return null;
  
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  
  for (let i = first; i < s.length; i++) {
    const char = s[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') {
        braceCount--;
        if (braceCount === 0) {
          return s.slice(first, i + 1);
        }
      }
    }
  }
  
  return null;
}

function tryParseJsonObject(raw) {
  if (!raw) return null;

  const repaired = repairJsonString(raw);

  // Attempt direct parse
  try { return JSON.parse(repaired); } catch {}

  // Fallback: extract balanced JSON object
  const extracted = extractJsonObject(repaired);
  if (extracted) {
    try { return JSON.parse(extracted); } catch {}
  }

  return null;
}

// Parse a simple key/value plain-text template (NOT JSON), e.g.
// Answer: Yes
// Legal basis: ...
// URL: ...
function tryParseKeyValueTemplate(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Do not mutate the stored raw output; only clean for parsing.
  let s = raw.trim();
  // Strip common markdown code fences if present.
  s = s.replace(/^```[a-zA-Z0-9_-]*\s*/m, '').replace(/\s*```\s*$/m, '').trim();

  const keyMap = {
    answer: ['answer'],
    legal_basis: ['legal_basis', 'legal basis', 'legal citation', 'citation'],
    url: ['url', 'link', 'source url', 'source'],
    reforms: ['reforms', 'recent reforms'],
    date_of_enactment: ['date_of_enactment', 'date of enactment', 'enactment date'],
    date_of_enforcement: ['date_of_enforcement', 'date of enforcement', 'effective date', 'enforcement date'],
    comments: ['comments', 'notes', 'context'],
    flag: ['flag', 'flags', 'issue', 'issues']
  };

  const aliasToKey = new Map();
  for (const [key, aliases] of Object.entries(keyMap)) {
    for (const a of aliases) aliasToKey.set(a.toLowerCase(), key);
  }

  const lines = s.split(/\r?\n/);
  const out = {};

  let currentKey = null;
  let currentVal = [];

  const flush = () => {
    if (!currentKey) return;
    const v = currentVal.join('\n').trim();
    if (v.length > 0) out[currentKey] = v;
    currentKey = null;
    currentVal = [];
  };

  const makeKeyRegex = () => {
    const allAliases = Array.from(aliasToKey.keys())
      .sort((a, b) => b.length - a.length)
      .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .join('|');
    // Allows optional bullets and flexible separators
    return new RegExp(`^\\s*(?:[-*]\\s*)?(${allAliases})\\s*[:\\-]\\s*(.*)$`, 'i');
  };

  const keyRegex = makeKeyRegex();

  for (const line of lines) {
    const m = line.match(keyRegex);
    if (m) {
      flush();
      const alias = (m[1] || '').toLowerCase();
      currentKey = aliasToKey.get(alias) || null;
      currentVal = [m[2] ?? ''];
    } else if (currentKey) {
      currentVal.push(line);
    }
  }
  flush();

  // If we found at least one meaningful field, treat as structured.
  if (Object.keys(out).length === 0) return null;

  // Ensure required keys exist (empty if missing) so downstream UI logic is stable.
  const required = ['answer', 'legal_basis', 'url', 'reforms', 'date_of_enactment', 'date_of_enforcement', 'comments', 'flag'];
  for (const k of required) {
    if (!(k in out)) out[k] = '';
  }

  return out;
}

function tryParseStructuredOutput(raw) {
  // First try JSON (backwards compatible)
  const json = tryParseJsonObject(raw);
  if (json) return json;
  // Then try the plain-text template
  return tryParseKeyValueTemplate(raw);
}

function normalizeAIOutput(output) {
  if (!output || typeof output !== 'object') return output;
  
  // Ensure all required fields exist
  const normalized = {
    answer: output.answer ?? '',
    legal_basis: output.legal_basis ?? '',
    url: output.url ?? '',
    reforms: output.reforms ?? '',
    date_of_enactment: output.date_of_enactment ?? '',
    date_of_enforcement: output.date_of_enforcement ?? '',
    comments: output.comments ?? '',
    flag: output.flag ?? 'None'
  };
  
  // Normalize answer casing for booleans
  if (typeof normalized.answer === 'string') {
    const lower = normalized.answer.toLowerCase();
    if (lower === 'yes') normalized.answer = 'Yes';
    else if (lower === 'no') normalized.answer = 'No';
    else if (lower === 'n/a' || lower === 'na') normalized.answer = 'N/A';
  }
  
  // Normalize reforms
  if (typeof normalized.reforms === 'string') {
    const lower = normalized.reforms.toLowerCase();
    if (lower === 'yes') normalized.reforms = 'Yes';
    else if (lower === 'no') normalized.reforms = 'No';
    else if (lower === 'n/a' || lower === 'na' || lower === 'unknown') normalized.reforms = '';
  }
  
  // Normalize dates: N/A, Unknown, etc. → ''
  if (typeof normalized.date_of_enactment === 'string') {
    const lower = normalized.date_of_enactment.toLowerCase();
    if (lower === 'n/a' || lower === 'unknown' || lower === 'na') {
      normalized.date_of_enactment = '';
    } else if (normalized.date_of_enactment.includes('T')) {
      // Extract date portion from timestamp
      normalized.date_of_enactment = normalized.date_of_enactment.split('T')[0];
    }
  }
  
  if (typeof normalized.date_of_enforcement === 'string') {
    const lower = normalized.date_of_enforcement.toLowerCase();
    if (lower === 'n/a' || lower === 'unknown' || lower === 'na') {
      normalized.date_of_enforcement = '';
    } else if (normalized.date_of_enforcement.includes('T')) {
      // Extract date portion from timestamp
      normalized.date_of_enforcement = normalized.date_of_enforcement.split('T')[0];
    }
  }
  
  // Normalize flag
  if (typeof normalized.flag === 'string') {
    const lower = normalized.flag.toLowerCase();
    if (lower === 'n/a' || lower === 'na' || lower === 'none' || lower === 'no issues') {
      normalized.flag = 'None';
    }
  }
  
  return normalized;
}

function validateAIOutput(output, question) {
  const errors = [];
  
  // Must be object
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return { valid: false, errors: ['Output must be a JSON object'] };
  }
  
  // Required fields
  const requiredFields = ['answer', 'legal_basis', 'url', 'reforms', 'date_of_enactment', 'date_of_enforcement', 'comments', 'flag'];
  for (const field of requiredFields) {
    if (!(field in output)) {
      errors.push(`Missing required field: ${field}`);
    }
  }
  
  // Validate answer based on answer_type
  if (question.answer_type === 'boolean_yesno') {
    const validValues = ['Yes', 'No', 'N/A'];
    if (!validValues.includes(output.answer)) {
      errors.push(`answer must be "Yes", "No", or "N/A" for boolean questions`);
    }
  } else if (question.answer_type === 'integer') {
    const isValid = typeof output.answer === 'number' || 
                    (typeof output.answer === 'string' && /^-?\d+$/.test(output.answer)) ||
                    output.answer === 'N/A';
    if (!isValid) {
      errors.push(`answer must be a number for integer questions`);
    }
  } else if (question.answer_type === 'text') {
    if (typeof output.answer !== 'string') {
      errors.push(`answer must be a string for text questions`);
    }
  } else if (question.answer_type === 'single_select') {
    if (typeof output.answer !== 'string') {
      errors.push(`answer must be a string for single_select questions`);
    }
  } else if (question.answer_type === 'multi_select') {
    const isValid = Array.isArray(output.answer) || typeof output.answer === 'string';
    if (!isValid) {
      errors.push(`answer must be an array or string for multi_select questions`);
    }
  }
  
  // Validate dates
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (output.date_of_enactment && output.date_of_enactment !== '' && output.date_of_enactment !== null) {
    if (!dateRegex.test(output.date_of_enactment)) {
      errors.push(`date_of_enactment must be in YYYY-MM-DD format`);
    }
  }
  if (output.date_of_enforcement && output.date_of_enforcement !== '' && output.date_of_enforcement !== null) {
    if (!dateRegex.test(output.date_of_enforcement)) {
      errors.push(`date_of_enforcement must be in YYYY-MM-DD format`);
    }
  }
  
  // Validate reforms
  if (output.reforms && output.reforms !== '' && output.reforms !== null) {
    const validReforms = ['Yes', 'No'];
    if (!validReforms.includes(output.reforms)) {
      errors.push(`reforms must be "Yes" or "No"`);
    }
  }
  
  // Validate flag
  const validFlags = ['None', 'Needs follow-up', 'Source missing', 'Ambiguous law', 'Conflicting sources', 'Translation needed', 'Other'];
  if (output.flag && !validFlags.includes(output.flag)) {
    errors.push(`flag must be one of: ${validFlags.join(', ')}`);
  }
  
  return { valid: errors.length === 0, errors };
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

    const { ai_request_id } = await req.json();

    if (!ai_request_id) {
      return Response.json({ error: 'ai_request_id is required' }, { status: 400 });
    }

    // Fetch AI request
    const aiRequests = await base44.asServiceRole.entities.AIRequest.filter({ id: ai_request_id });
    if (aiRequests.length === 0) {
      return Response.json({ error: 'AI request not found' }, { status: 404 });
    }

    const aiRequest = aiRequests[0];

    // Validate provider and model
    const providers = await base44.asServiceRole.entities.AIProvider.filter({ id: aiRequest.provider_id });
    if (providers.length === 0) {
      await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
        status: 'failed',
        error_text: 'Provider not found',
        completed_at: new Date().toISOString()
      });
      return Response.json({ error: 'Provider not found' }, { status: 400 });
    }

    const provider = providers[0];
    const providerApiKey = provider.config?.api_key || provider.api_key;
    if (!providerApiKey) {
      await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
        status: 'failed',
        error_text: 'Provider API key not configured',
        completed_at: new Date().toISOString()
      });
      return Response.json({ error: 'Provider API key not configured' }, { status: 400 });
    }

    const models = await base44.asServiceRole.entities.AIModel.filter({ id: aiRequest.model_id });
    if (models.length === 0) {
      await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
        status: 'failed',
        error_text: 'Model not found',
        completed_at: new Date().toISOString()
      });
      return Response.json({ error: 'Model not found' }, { status: 400 });
    }

    const model = models[0];

    // Update status to running
    await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
      status: 'running',
      started_at: new Date().toISOString()
    });

    // Fetch batch and tasks
    const batches = await base44.asServiceRole.entities.Batch.filter({ id: aiRequest.batch_id });
    if (batches.length === 0) {
      await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
        status: 'failed',
        error_text: 'Batch not found',
        completed_at: new Date().toISOString()
      });
      return Response.json({ error: 'Batch not found' }, { status: 404 });
    }

    const batch = batches[0];
    const tasks = await base44.asServiceRole.entities.Task.filter({ batch_id: batch.id });

    let completed = 0;
    let failed = 0;

    // Process each task
    for (const task of tasks) {
      try {
        const startTime = Date.now();

        // Fetch economy and question
        const [economies, questions] = await Promise.all([
          base44.asServiceRole.entities.Economy.filter({ id: task.economy_id }),
          base44.asServiceRole.entities.Question.filter({ id: task.question_id })
        ]);

        if (economies.length === 0 || questions.length === 0) {
          await base44.asServiceRole.entities.AITaskResult.create({
            ai_request_id: ai_request_id,
            task_id: task.id,
            provider_id: provider.id,
            model_id: model.id,
            retrieval_method: aiRequest.retrieval_method,
            status: 'failed',
            error_text: 'Economy or question not found',
            error_code: 'MISSING_DATA',
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          });
          failed++;
          continue;
        }

        const economy = economies[0];
        const question = questions[0];

        // Retrieve question-specific prompt
        const promptVersions = await base44.asServiceRole.entities.QuestionPromptVersion.filter({ 
          question_id: question.id 
        });
        
        let selectedPrompt = null;
        if (promptVersions.length > 0) {
          const activePrompts = promptVersions.filter(p => p.is_active === true);
          if (activePrompts.length > 0) {
            selectedPrompt = activePrompts.sort((a, b) => b.version_number - a.version_number)[0];
          } else {
            selectedPrompt = promptVersions.sort((a, b) => b.version_number - a.version_number)[0];
          }
        }

        // Treat as missing if prompt_text is blank
        const promptTextValid = selectedPrompt?.prompt_text && selectedPrompt.prompt_text.trim().length > 0;
        
        // Hard fail if no prompt exists or is blank
        if (!selectedPrompt || !promptTextValid) {
          await base44.asServiceRole.entities.AITaskResult.create({
            ai_request_id: ai_request_id,
            task_id: task.id,
            provider_id: provider.id,
            model_id: model.id,
            retrieval_method: aiRequest.retrieval_method,
            status: 'failed',
            error_text: `Missing question prompt from Question Library (QuestionPromptVersion.prompt_text is empty or not found). AI execution blocked.`,
            error_code: 'MISSING_PROMPT',
            prompt_rendered_text: '',
            prompt_version_id: null,
            started_at: new Date().toISOString(),
            completed_at: new Date().toISOString()
          });
          failed++;
          
          const currentError = await base44.asServiceRole.entities.AIRequest.filter({ id: ai_request_id });
          const existingError = currentError[0]?.error_text || '';
          await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
            error_text: existingError ? 
              `${existingError}\nMissing or empty prompt for question_code=${question.question_code} (task_id=${task.id})` :
              `Missing or empty prompt for question_code=${question.question_code} (task_id=${task.id})`
          });

          try {
            await base44.asServiceRole.entities.AuditLog.create({
              entity_type: 'Task',
              entity_id: task.id,
              action: 'ai_run_failed_missing_prompt',
              after_json: { 
                ai_request_id: ai_request_id, 
                question_id: question.id, 
                question_code: question.question_code, 
                reason: 'missing_or_empty_question_prompt' 
              },
              actor_id: aiRequest.created_by
            });
          } catch (auditError) {
            console.error('Failed to create audit log:', auditError);
          }

          continue;
        }

        // Firecrawl web retrieval
        let webEvidence = '';
        if (aiRequest.retrieval_method && 
            (aiRequest.retrieval_method === 'firecrawl_preferred' || aiRequest.retrieval_method === 'firecrawl_only')) {
          try {
            const firecrawlProviders = await base44.asServiceRole.entities.AIProvider.filter({ 
              provider_type: 'firecrawl',
              is_enabled: true 
            });
            
            if (firecrawlProviders.length === 0) {
              const fcByName = await base44.asServiceRole.entities.AIProvider.filter({ is_enabled: true });
              const fcProvider = fcByName.find(p => p.name && p.name.toLowerCase().includes('firecrawl'));
              if (fcProvider) firecrawlProviders.push(fcProvider);
            }

            if (firecrawlProviders.length > 0) {
              const firecrawlProvider = firecrawlProviders[0];
              const firecrawlApiKey = firecrawlProvider.config?.api_key || firecrawlProvider.api_key;
              
              if (firecrawlApiKey) {
                const searchQuery = `${economy.name} ${question.question_text} legal basis`;
                const fcResponse = await fetch('https://api.firecrawl.dev/v1/search', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${firecrawlApiKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    query: searchQuery,
                    limit: 3,
                    scrapeOptions: { formats: ['markdown'] }
                  }),
                  signal: AbortSignal.timeout(30000)
                });

                if (fcResponse.ok) {
                  const fcData = await fcResponse.json();
                  if (fcData.data && fcData.data.length > 0) {
                    webEvidence = '\n\n--- Web Evidence from Firecrawl ---\n';
                    fcData.data.forEach((result, idx) => {
                      webEvidence += `\nSource ${idx + 1}: ${result.url || ''}\n${result.markdown || result.content || ''}\n`;
                    });
                  }
                } else if (aiRequest.retrieval_method === 'firecrawl_only') {
                  throw new Error(`Firecrawl search failed: HTTP ${fcResponse.status}`);
                }
              } else if (aiRequest.retrieval_method === 'firecrawl_only') {
                throw new Error('Firecrawl API key not configured');
              }
            } else if (aiRequest.retrieval_method === 'firecrawl_only') {
              throw new Error('Firecrawl provider not configured');
            }
          } catch (fcError) {
            console.error('Firecrawl error:', fcError);
            if (aiRequest.retrieval_method === 'firecrawl_only') {
              throw fcError;
            }
          }
        }

        // Load additional context for prompt substitution
        let groupData = null, indicatorData = null, pillarData = null;
        if (question.group_id) {
          const groups = await base44.asServiceRole.entities.QuestionGroup.filter({ id: question.group_id });
          groupData = groups[0];
          if (groupData?.indicator_id) {
            const indicators = await base44.asServiceRole.entities.Indicator.filter({ id: groupData.indicator_id });
            indicatorData = indicators[0];
          }
          if (groupData?.pillar_id) {
            const pillars = await base44.asServiceRole.entities.Pillar.filter({ id: groupData.pillar_id });
            pillarData = pillars[0];
          }
        }

        // Build final prompt: Question Library prompt is PRIMARY
        // Substitute variables in question prompt
        let questionPromptBase = selectedPrompt.prompt_text;
        questionPromptBase = questionPromptBase.replace(/{economy_name}/g, economy.name);
        questionPromptBase = questionPromptBase.replace(/{country}/g, economy.name);
        questionPromptBase = questionPromptBase.replace(/{jurisdiction}/g, economy.name);
        questionPromptBase = questionPromptBase.replace(/{year}/g, batch.reporting_year?.toString() || '2026');
        questionPromptBase = questionPromptBase.replace(/{as_of_date}/g, batch.as_of_date || '');
        questionPromptBase = questionPromptBase.replace(/{question_text}/g, question.question_text);
        questionPromptBase = questionPromptBase.replace(/{indicator}/g, indicatorData?.name || '');
        questionPromptBase = questionPromptBase.replace(/{pillar}/g, pillarData?.name || '');
        questionPromptBase = questionPromptBase.replace(/{group}/g, groupData?.group_name || '');
        questionPromptBase = questionPromptBase.replace(/{subgroup}/g, groupData?.subgroup_name || '');

        // System appendix (context + output format requirements)
        const systemAppendix = `
Economy: ${economy.name}
Question: ${question.question_text}
Question Code: ${question.question_code}
Answer Type: ${question.answer_type}
Reporting Year: ${batch.reporting_year}
As-of Date: ${batch.as_of_date || 'Not specified'}

Return your response in plain text using this template (NOT JSON). Keep each field on its own line:

Answer: <Yes/No/N/A for boolean questions, number for integer, text otherwise>
Legal basis: <legal citation or statute name>
URL: <URL to the legal source>
Reforms: <Yes/No if there were recent reforms>
Date of enactment: <YYYY-MM-DD if available>
Date of enforcement: <YYYY-MM-DD if available>
Comments: <additional context or notes>
Flag: <None or a specific flag if issues found>

Do not wrap the response in markdown or code fences.`;

        const retrievedEvidence = webEvidence || '';

        const prompt = questionPromptBase.trim() + "\n\n--- SYSTEM CONTEXT & OUTPUT FORMAT (AUTO) ---\n" + systemAppendix + retrievedEvidence;

        let output_raw = '';
        let output_parsed = null;
        let status = 'completed';
        let error_text = null;
        let error_code = null;
        let tokens_in = 0;
        let tokens_out = 0;
        // True only when we successfully extracted structured fields (JSON or template)
        // and they passed schema validation. Raw output is always stored verbatim.
        let schema_validation_passed = false;

        // Call AI provider
        if (provider.provider_type === 'openai') {
          const enableProviderNativeWebSearch = aiRequest.retrieval_method === 'provider_native_only';

          const requestBody = {
            model: model.model_id,
            input: prompt,
            max_output_tokens: 1000
          };

          // Only add web search if explicitly enabled
          if (enableProviderNativeWebSearch) {
            requestBody.tools = [{ type: 'web_search' }];
            requestBody.tool_choice = 'auto';
            requestBody.max_tool_calls = 10;
          }

          const response = await fetch('https://api.openai.com/v1/responses', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${providerApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(120000) // 2 min timeout
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
          }

          const data = await response.json();
          output_raw = extractOpenAIResponseText(data);
          const normalized = normalizeUsage(data.usage, data);
          tokens_in = normalized.tokensIn;
          tokens_out = normalized.tokensOut;

          if (!output_raw || output_raw.trim().length === 0) {
            status = 'format_invalid';
            error_code = 'PARSE_ERROR';
            error_text = 'Empty response text extracted from OpenAI Responses output[] (no message content found).';
          } else {
            // Do not require JSON. Attempt to parse structured output (JSON or template) but accept raw output regardless.
            output_parsed = tryParseStructuredOutput(output_raw);

            if (output_parsed) {
              output_parsed = normalizeAIOutput(output_parsed);
              const validation = validateAIOutput(output_parsed, question);
              schema_validation_passed = validation.valid;
              // Keep the run "completed" even if schema is imperfect; raw output is still stored.
              if (!validation.valid) {
                error_text = validation.errors.join('; ');
                error_code = 'SCHEMA_INVALID';
              }
            }
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
              max_tokens: 1000,
              messages: [{ role: 'user', content: prompt }]
            }),
            signal: AbortSignal.timeout(120000)
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error?.message || `HTTP ${response.status}`);
          }

          const data = await response.json();
          output_raw = data.content[0].text;
          const normalized = normalizeUsage(data.usage, data);
          tokens_in = normalized.tokensIn;
          tokens_out = normalized.tokensOut;

          output_parsed = tryParseStructuredOutput(output_raw);

          if (output_parsed) {
            output_parsed = normalizeAIOutput(output_parsed);
            const validation = validateAIOutput(output_parsed, question);
            schema_validation_passed = validation.valid;
            if (!validation.valid) {
              error_text = validation.errors.join('; ');
              error_code = 'SCHEMA_INVALID';
            }
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
                 contents: [{ parts: [{ text: prompt }] }],
                 generationConfig: { maxOutputTokens: 1000 }
               }),
               signal: AbortSignal.timeout(120000)
             }
           );

           if (!response.ok) {
             const errorData = await response.json();
             const errorMessage = errorData.error?.message || `HTTP ${response.status}`;

             // Detect quota exhaustion
             if (errorMessage.includes('Quota exceeded') || 
                 errorMessage.includes('limit: 0') || 
                 errorMessage.includes('generate_content_free_tier_requests') ||
                 errorMessage.includes('RESOURCE_EXHAUSTED')) {
               const quotaError = new Error(errorMessage);
               quotaError.isQuotaExhausted = true;
               throw quotaError;
             }

             throw new Error(errorMessage);
           }

           const data = await response.json();

           // Safe text extraction from Gemini response (try multiple paths)
           let extractedText = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';
           if (!extractedText) {
             extractedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
           }
           if (!extractedText) {
             extractedText = data.candidates?.[0]?.content?.text || '';
           }
           if (!extractedText) {
             extractedText = data.candidates?.[0]?.output || '';
           }
           extractedText = extractedText.trim();

           // If no text extracted but response exists, store full response for debugging
           if (!extractedText && data && typeof data === 'object') {
             output_raw = JSON.stringify(data);
             status = 'format_invalid';
             error_code = 'PARSE_ERROR';
             error_text = 'Gemini response contained no extractable text; stored full response JSON in output_raw_text for debugging.';
           } else if (extractedText) {
             output_raw = extractedText;
             // schema_validation_passed is defined outside the provider switch
             output_parsed = tryParseStructuredOutput(output_raw);
             if (output_parsed) {
               output_parsed = normalizeAIOutput(output_parsed);
               const validation = validateAIOutput(output_parsed, question);
               schema_validation_passed = validation.valid;
               if (!validation.valid) {
                 error_text = validation.errors.join('; ');
                 error_code = 'SCHEMA_INVALID';
               }
             }

           } else {
             output_raw = '';
             status = 'format_invalid';
             error_code = 'PARSE_ERROR';
             error_text = 'Gemini response was empty or invalid';
           }

           tokens_in = data.usageMetadata?.promptTokenCount ?? 0;
           const candidatesTokens = data.usageMetadata?.candidatesTokenCount ?? 0;
           const totalTokens = data.usageMetadata?.totalTokenCount ?? 0;
           tokens_out = candidatesTokens > 0 ? candidatesTokens : Math.max(0, totalTokens - tokens_in);
          } else {
          status = 'failed';
          error_text = 'Unsupported provider type';
          error_code = 'UNSUPPORTED_PROVIDER';
          }

        const duration_ms = Date.now() - startTime;

        // Calculate cost
        const cost_estimate = (tokens_in * (model.pricing_json?.input || 0) / 1000000) +
                              (tokens_out * (model.pricing_json?.output || 0) / 1000000);

        // Save result
        await base44.asServiceRole.entities.AITaskResult.create({
          ai_request_id: ai_request_id,
          task_id: task.id,
          provider_id: provider.id,
          model_id: model.id,
          retrieval_method: aiRequest.retrieval_method,
          prompt_version_id: selectedPrompt.id,
          prompt_rendered_text: prompt,
          economy_context_json: { 
            economy_id: economy.id,
            economy_name: economy.name,
            prompt_version: {
              id: selectedPrompt.id,
              version_number: selectedPrompt.version_number,
              created_at: selectedPrompt.created_date || null,
              is_active: selectedPrompt.is_active === true,
              question_prompt_text: questionPromptBase.trim()
            }
          },
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: duration_ms,
          retry_count: 0,
          output_raw_text: output_raw,
          output_parsed_json: output_parsed,
          schema_validation_passed: schema_validation_passed,
          tokens_in: tokens_in,
          tokens_out: tokens_out,
          cost_estimate: cost_estimate,
          cost_currency: 'USD',
          status: status,
          error_text: error_text,
          error_code: error_code
        });

        if (status === 'completed') {
          completed++;
          // Update task status to in_progress if not already further along
          if (task.status === 'not_started') {
            await base44.asServiceRole.entities.Task.update(task.id, { status: 'in_progress' });
          }
        } else if (status === 'format_invalid') {
          failed++;
          // Do NOT create/update DraftResponse for invalid outputs
        } else {
          failed++;
        }

      } catch (error) {
        const isQuotaExhausted = error.isQuotaExhausted === true;
        
        await base44.asServiceRole.entities.AITaskResult.create({
          ai_request_id: ai_request_id,
          task_id: task.id,
          provider_id: provider.id,
          model_id: model.id,
          retrieval_method: aiRequest.retrieval_method,
          status: 'failed',
          error_text: error.message,
          error_code: isQuotaExhausted ? 'PROVIDER_QUOTA_EXCEEDED' : 'API_ERROR',
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString()
        });
        failed++;
      }

      // Update progress
      await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
        completed_tasks: completed + failed,
        failed_tasks: failed
      });
    }

    // Check if all tasks failed with quota exhaustion
    const allTaskResults = await base44.asServiceRole.entities.AITaskResult.filter({ ai_request_id });
    const quotaExhaustedCount = allTaskResults.filter(t => t.error_code === 'PROVIDER_QUOTA_EXCEEDED').length;
    const allQuotaExhausted = quotaExhaustedCount > 0 && quotaExhaustedCount === allTaskResults.length;

    // Mark as completed
    await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
      status: allQuotaExhausted ? 'failed' : 'completed',
      completed_at: new Date().toISOString(),
      completed_tasks: completed + failed,
      failed_tasks: failed,
      error_text: allQuotaExhausted ? 'Gemini quota exhausted or unavailable for this project/key. Provider cannot run.' : null
    });

    return Response.json({
      success: true,
      completed: completed,
      failed: failed,
      total: tasks.length
    });

  } catch (error) {
    console.error('AI request failed:', error);
    
    // Mark request as failed
    try {
      const { ai_request_id } = await req.json();
      if (ai_request_id) {
        await base44.asServiceRole.entities.AIRequest.update(ai_request_id, {
          status: 'failed',
          error_text: error.message,
          completed_at: new Date().toISOString()
        });
      }
    } catch (updateError) {
      console.error('Failed to update request status:', updateError);
    }
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});