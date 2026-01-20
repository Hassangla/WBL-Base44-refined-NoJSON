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

    const { dry_run = false, rows = [] } = await req.json();

    // Load reference tables
    const [indicators, pillars, questionGroups, questions, promptVersions] = await Promise.all([
      base44.asServiceRole.entities.Indicator.list('-created_date', 10000),
      base44.asServiceRole.entities.Pillar.list('-created_date', 10000),
      base44.asServiceRole.entities.QuestionGroup.list('-created_date', 10000),
      base44.asServiceRole.entities.Question.list('-created_date', 10000),
      base44.asServiceRole.entities.QuestionPromptVersion.list('-created_date', 10000)
    ]);

    // Build lookup maps
    const indicatorByName = {};
    for (const ind of indicators) {
      indicatorByName[ind.name.toLowerCase().trim()] = ind;
    }

    const pillarByName = {};
    for (const pil of pillars) {
      pillarByName[pil.name.toLowerCase().trim()] = pil;
    }

    const groupByKey = {};
    for (const grp of questionGroups) {
      const key = `${grp.indicator_id}|${grp.pillar_id}|${grp.group_name}|${grp.subgroup_name || ''}`;
      groupByKey[key] = grp;
    }

    const questionByCode = {};
    for (const q of questions) {
      questionByCode[q.question_code.toLowerCase().trim()] = q;
    }

    // Helper: parse JSON field
    const parseJSON = (value, fieldName, defaultValue = null) => {
      if (!value || value === '') return defaultValue;
      if (typeof value === 'object') return value;
      try {
        return JSON.parse(value);
      } catch {
        throw new Error(`Invalid JSON in ${fieldName}`);
      }
    };

    // Helper: parse boolean
    const parseBool = (value) => {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number') return value === 1;
      if (typeof value === 'string') {
        const v = value.toLowerCase().trim();
        return v === 'true' || v === '1' || v === 'yes';
      }
      return false;
    };

    const validAnswerTypes = ['boolean_yesno', 'integer', 'text', 'single_select', 'multi_select'];

    const errors = [];
    const actions = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        // Validate required fields
        if (!row.question_code || !row.question_code.trim()) {
          errors.push({ row: rowNum, question_code: '', message: 'question_code is required' });
          continue;
        }
        if (!row.indicator || !row.indicator.trim()) {
          errors.push({ row: rowNum, question_code: row.question_code, message: 'indicator is required' });
          continue;
        }
        if (!row.pillar || !row.pillar.trim()) {
          errors.push({ row: rowNum, question_code: row.question_code, message: 'pillar is required' });
          continue;
        }
        if (!row.group || !row.group.trim()) {
          errors.push({ row: rowNum, question_code: row.question_code, message: 'group is required' });
          continue;
        }
        if (!row.question_text || !row.question_text.trim()) {
          errors.push({ row: rowNum, question_code: row.question_code, message: 'question_text is required' });
          continue;
        }
        if (!row.answer_type || !row.answer_type.trim()) {
          errors.push({ row: rowNum, question_code: row.question_code, message: 'answer_type is required' });
          continue;
        }

        // Validate indicator and pillar exist
        const indicator = indicatorByName[row.indicator.toLowerCase().trim()];
        if (!indicator) {
          errors.push({ row: rowNum, question_code: row.question_code, message: `Indicator not found: ${row.indicator}` });
          continue;
        }

        const pillar = pillarByName[row.pillar.toLowerCase().trim()];
        if (!pillar) {
          errors.push({ row: rowNum, question_code: row.question_code, message: `Pillar not found: ${row.pillar}` });
          continue;
        }

        // Validate answer_type
        if (!validAnswerTypes.includes(row.answer_type)) {
          errors.push({ row: rowNum, question_code: row.question_code, message: `Invalid answer_type: ${row.answer_type}` });
          continue;
        }

        // Parse JSON fields
        let options_json = null;
        let normalization_rule_json = null;
        let export_rule_json = {};
        let dependency_rule_json = null;

        try {
          options_json = parseJSON(row.options_json, 'options_json', null);
          normalization_rule_json = parseJSON(row.normalization_rule_json, 'normalization_rule_json', null);
          export_rule_json = parseJSON(row.export_rule_json, 'export_rule_json', {});
          dependency_rule_json = parseJSON(row.dependency_rule_json, 'dependency_rule_json', null);
        } catch (e) {
          errors.push({ row: rowNum, question_code: row.question_code, message: e.message });
          continue;
        }

        // Validate options_json for select types
        if ((row.answer_type === 'single_select' || row.answer_type === 'multi_select')) {
          if (!options_json || !Array.isArray(options_json)) {
            errors.push({ row: rowNum, question_code: row.question_code, message: 'options_json must be an array for select types' });
            continue;
          }
        }

        // Ensure QuestionGroup exists
        const groupKey = `${indicator.id}|${pillar.id}|${row.group.trim()}|${row.subgroup?.trim() || ''}`;
        let group = groupByKey[groupKey];

        if (!group) {
          // Create group action
          actions.push({
            type: 'create_group',
            data: {
              indicator_id: indicator.id,
              pillar_id: pillar.id,
              group_name: row.group.trim(),
              subgroup_name: row.subgroup?.trim() || null,
              display_order: 0
            }
          });
          // Create placeholder for lookup
          group = {
            id: `temp_${groupKey}`,
            indicator_id: indicator.id,
            pillar_id: pillar.id,
            group_name: row.group.trim(),
            subgroup_name: row.subgroup?.trim() || null
          };
          groupByKey[groupKey] = group;
        }

        // Ensure Question exists
        const questionCode = row.question_code.trim();
        const existingQuestion = questionByCode[questionCode.toLowerCase()];

        const questionData = {
          question_code: questionCode,
          group_id: group.id,
          question_text: row.question_text.trim(),
          answer_type: row.answer_type,
          options_json,
          normalization_rule_json,
          export_rule_json,
          dependency_rule_json,
          legal_basis_optional: parseBool(row.legal_basis_optional),
          is_active: row.is_active !== undefined ? parseBool(row.is_active) : true
        };

        if (existingQuestion) {
          actions.push({
            type: 'update_question',
            question_id: existingQuestion.id,
            question_code: questionCode,
            data: questionData
          });
        } else {
          actions.push({
            type: 'create_question',
            question_code: questionCode,
            data: questionData
          });
        }

        // Handle prompt version
        if (row.prompt_text && row.prompt_text.trim()) {
          const qId = existingQuestion?.id || `temp_${questionCode}`;
          actions.push({
            type: 'create_prompt_version',
            question_id: qId,
            question_code: questionCode,
            data: {
              prompt_text: row.prompt_text.trim(),
              change_note: row.prompt_change_note?.trim() || 'Imported prompt'
            }
          });
        }

      } catch (e) {
        errors.push({ row: rowNum, question_code: row.question_code || '', message: e.message });
      }
    }

    // Summary
    const summary = {
      rows_received: rows.length,
      rows_valid: rows.length - errors.length,
      rows_invalid: errors.length,
      groups_created: actions.filter(a => a.type === 'create_group').length,
      questions_created: actions.filter(a => a.type === 'create_question').length,
      questions_updated: actions.filter(a => a.type === 'update_question').length,
      prompt_versions_created: actions.filter(a => a.type === 'create_prompt_version').length
    };

    // If dry run, return preview
    if (dry_run) {
      return Response.json({
        success: true,
        dry_run: true,
        summary,
        errors: errors.slice(0, 50) // Return first 50 errors
      });
    }

    // Apply changes
    const createdGroupIds = {};
    const createdQuestionIds = {};

    // 1. Create groups
    for (const action of actions.filter(a => a.type === 'create_group')) {
      const newGroup = await base44.asServiceRole.entities.QuestionGroup.create(action.data);
      const key = `${action.data.indicator_id}|${action.data.pillar_id}|${action.data.group_name}|${action.data.subgroup_name || ''}`;
      createdGroupIds[key] = newGroup.id;
    }

    // 2. Create/update questions
    for (const action of actions.filter(a => a.type === 'create_question' || a.type === 'update_question')) {
      let finalData = { ...action.data };

      // Resolve group_id if it was temp
      if (finalData.group_id.startsWith('temp_')) {
        const groupKey = finalData.group_id.replace('temp_', '');
        finalData.group_id = createdGroupIds[groupKey] || groupByKey[groupKey]?.id;
      }

      if (action.type === 'create_question') {
        const newQuestion = await base44.asServiceRole.entities.Question.create(finalData);
        createdQuestionIds[action.question_code] = newQuestion.id;
      } else {
        await base44.asServiceRole.entities.Question.update(action.question_id, finalData);
      }
    }

    // 3. Create prompt versions
    for (const action of actions.filter(a => a.type === 'create_prompt_version')) {
      let questionId = action.question_id;

      // Resolve question_id if it was temp
      if (questionId.startsWith('temp_')) {
        const code = questionId.replace('temp_', '');
        questionId = createdQuestionIds[code] || questionByCode[code.toLowerCase()]?.id;
      }

      if (!questionId) continue;

      // Deactivate current active prompt
      const activePrompts = promptVersions.filter(p => p.question_id === questionId && p.is_active);
      for (const ap of activePrompts) {
        await base44.asServiceRole.entities.QuestionPromptVersion.update(ap.id, { is_active: false });
      }

      // Determine version number
      const existingVersions = promptVersions.filter(p => p.question_id === questionId);
      const maxVersion = existingVersions.length > 0 ? Math.max(...existingVersions.map(v => v.version_number)) : 0;

      await base44.asServiceRole.entities.QuestionPromptVersion.create({
        question_id: questionId,
        version_number: maxVersion + 1,
        prompt_text: action.data.prompt_text,
        change_note: action.data.change_note,
        is_active: true
      });
    }

    return Response.json({
      success: true,
      dry_run: false,
      summary,
      errors: errors.slice(0, 50)
    });

  } catch (error) {
    console.error('Import error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});