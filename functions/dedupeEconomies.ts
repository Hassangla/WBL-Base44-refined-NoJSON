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

    const { dry_run = false } = await req.json().catch(() => ({}));

    // Load all economies
    const allEconomies = await base44.asServiceRole.entities.Economy.list('-created_date', 10000);

    // Normalize name helper
    const normalizeName = (name) => {
      return name?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
    };

    // Group economies by normalized name
    const groups = {};
    for (const economy of allEconomies) {
      const normalized = normalizeName(economy.name);
      if (!groups[normalized]) {
        groups[normalized] = [];
      }
      groups[normalized].push(economy);
    }

    // Process only groups with duplicates
    const duplicateGroups = Object.entries(groups).filter(([_, economies]) => economies.length > 1);

    const processedGroups = [];
    let totalEconomiesDeactivated = 0;
    let totalTasksUpdated = 0;
    let totalTasksConflicts = 0;
    let totalBatchesUpdated = 0;

    for (const [normalizedName, economies] of duplicateGroups) {
      // Load all tasks for reference counting
      const allTasks = await base44.asServiceRole.entities.Task.filter({}, '-created_date', 100000);
      
      // Count references for each economy
      const referenceCounts = {};
      for (const economy of economies) {
        referenceCounts[economy.id] = allTasks.filter(t => t.economy_id === economy.id).length;
      }

      // Choose canonical: highest task count, then is_active, then earliest created_date, then lowest id
      const canonical = economies.reduce((best, current) => {
        const bestRefs = referenceCounts[best.id] || 0;
        const currentRefs = referenceCounts[current.id] || 0;

        if (currentRefs > bestRefs) return current;
        if (currentRefs < bestRefs) return best;

        // Tie: prefer is_active
        const bestActive = best.is_active !== false;
        const currentActive = current.is_active !== false;
        if (currentActive && !bestActive) return current;
        if (!currentActive && bestActive) return best;

        // Tie: prefer earliest created_date
        const bestDate = new Date(best.created_date);
        const currentDate = new Date(current.created_date);
        if (currentDate < bestDate) return current;
        if (currentDate > bestDate) return best;

        // Tie: prefer lowest id
        return current.id < best.id ? current : best;
      });

      const duplicates = economies.filter(e => e.id !== canonical.id);

      let tasksUpdated = 0;
      const tasksConflicts = [];

      // Update Tasks
      for (const duplicate of duplicates) {
        const tasksToUpdate = allTasks.filter(t => t.economy_id === duplicate.id);

        for (const task of tasksToUpdate) {
          // Check for collision
          const collision = allTasks.find(t =>
            t.batch_id === task.batch_id &&
            t.question_id === task.question_id &&
            t.economy_id === canonical.id
          );

          if (collision) {
            tasksConflicts.push({
              duplicate_task_id: task.id,
              canonical_task_id: collision.id,
              batch_id: task.batch_id,
              question_id: task.question_id
            });
          } else {
            if (!dry_run) {
              await base44.asServiceRole.entities.Task.update(task.id, { economy_id: canonical.id });
            }
            tasksUpdated++;
          }
        }
      }

      // Update Batches
      const allBatches = await base44.asServiceRole.entities.Batch.filter({}, '-created_date', 10000);
      let batchesUpdated = 0;

      for (const batch of allBatches) {
        if (!batch.economy_ids || !Array.isArray(batch.economy_ids)) continue;

        let modified = false;
        const updatedEconomyIds = [...batch.economy_ids];

        for (const duplicate of duplicates) {
          if (updatedEconomyIds.includes(duplicate.id)) {
            // Replace duplicate with canonical and deduplicate
            const newIds = updatedEconomyIds
              .map(id => id === duplicate.id ? canonical.id : id)
              .filter((id, index, arr) => arr.indexOf(id) === index); // dedupe

            if (JSON.stringify(newIds) !== JSON.stringify(batch.economy_ids)) {
              if (!dry_run) {
                await base44.asServiceRole.entities.Batch.update(batch.id, { economy_ids: newIds });
              }
              modified = true;
            }
          }
        }

        if (modified) batchesUpdated++;
      }

      // Deactivate duplicates
      if (!dry_run) {
        for (const duplicate of duplicates) {
          await base44.asServiceRole.entities.Economy.update(duplicate.id, { is_active: false });
        }
      }

      processedGroups.push({
        name_normalized: normalizedName,
        canonical: {
          id: canonical.id,
          name: canonical.name,
          region: canonical.region
        },
        duplicates: duplicates.map(d => ({
          id: d.id,
          name: d.name,
          region: d.region,
          deactivated: !dry_run
        })),
        tasks_updated: tasksUpdated,
        tasks_conflicts: tasksConflicts,
        batches_updated: batchesUpdated
      });

      totalEconomiesDeactivated += duplicates.length;
      totalTasksUpdated += tasksUpdated;
      totalTasksConflicts += tasksConflicts.length;
      totalBatchesUpdated += batchesUpdated;
    }

    return Response.json({
      dry_run,
      groups_processed: duplicateGroups.length,
      groups: processedGroups,
      totals: {
        economies_deactivated: totalEconomiesDeactivated,
        tasks_updated: totalTasksUpdated,
        tasks_conflicts: totalTasksConflicts,
        batches_updated: totalBatchesUpdated
      }
    });

  } catch (error) {
    console.error('Deduplication error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});