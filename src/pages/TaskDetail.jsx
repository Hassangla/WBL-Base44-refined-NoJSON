import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  RotateCcw,
  Brain,
  Paperclip,
  MessageSquare,
  History,
  AlertCircle,
  Lock,
  ExternalLink,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export default function TaskDetail() {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [task, setTask] = useState(null);
  const [economy, setEconomy] = useState(null);
  const [question, setQuestion] = useState(null);
  const [group, setGroup] = useState(null);
  const [indicator, setIndicator] = useState(null);
  const [batch, setBatch] = useState(null);
  const [draftResponse, setDraftResponse] = useState(null);
  const [aiResults, setAIResults] = useState([]);
  const [comments, setComments] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ workflow_mode: 'two_step' });

  // Form state
  const [formData, setFormData] = useState({
    answer: '',
    legal_basis: '',
    url: '',
    reforms: '',
    date_of_enactment: '',
    date_of_enforcement: '',
    comments: '',
    flag: 'None',
    match_no_match: 'Unknown'
  });

  const [showAIResults, setShowAIResults] = useState(true);
  const [showPromptForResult, setShowPromptForResult] = useState({});
  const [returnComment, setReturnComment] = useState('');

  const taskId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (taskId) {
      loadData();
    }
  }, [taskId]);

  const loadData = async () => {
    try {
      const [userData, settingsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.AppSettings.filter({ setting_key: 'workflow_mode' })
      ]);
      setUser(userData);
      if (settingsData.length > 0) {
        setSettings({ workflow_mode: settingsData[0].setting_value });
      }

      const [taskData] = await base44.entities.Task.filter({ id: taskId });
      if (!taskData) throw new Error('Task not found');
      setTask(taskData);

      const [economyData, questionData, batchData, draftData, aiResultsData, commentsData, attachmentsData] = await Promise.all([
        base44.entities.Economy.filter({ id: taskData.economy_id }),
        base44.entities.Question.filter({ id: taskData.question_id }),
        base44.entities.Batch.filter({ id: taskData.batch_id }),
        base44.entities.DraftResponse.filter({ task_id: taskId }),
        base44.entities.AITaskResult.filter({ task_id: taskId }),
        base44.entities.TaskValidationComment.filter({ task_id: taskId }),
        base44.entities.Attachment.filter({ task_id: taskId })
      ]);

      setEconomy(economyData[0]);
      setQuestion(questionData[0]);
      setBatch(batchData[0]);
      setDraftResponse(draftData[0]);
      setAIResults(aiResultsData);
      setComments(commentsData);
      setAttachments(attachmentsData);

      if (questionData[0]?.group_id) {
        const [groupData] = await base44.entities.QuestionGroup.filter({ id: questionData[0].group_id });
        setGroup(groupData);
        if (groupData?.indicator_id) {
          const [indicatorData] = await base44.entities.Indicator.filter({ id: groupData.indicator_id });
          setIndicator(indicatorData);
        }
      }

      // Initialize form with draft data
      if (draftData[0]) {
        setFormData({
          answer: draftData[0].answer || '',
          legal_basis: draftData[0].legal_basis || '',
          url: draftData[0].url || '',
          reforms: draftData[0].reforms || '',
          date_of_enactment: draftData[0].date_of_enactment || '',
          date_of_enforcement: draftData[0].date_of_enforcement || '',
          comments: draftData[0].comments || '',
          flag: draftData[0].flag || 'None',
          match_no_match: draftData[0].match_no_match || 'Unknown'
        });
      }
    } catch (error) {
      console.error('Failed to load task:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const isValidator = user?.role === 'admin' || user?.wbl_role === 'validator';
  const isViewer = user?.wbl_role === 'viewer';
  const isTwoStepMode = settings.workflow_mode !== 'single_step';
  const isLocked = task?.dependency_status === 'locked';
  const canEdit = !isViewer && !isLocked && ['not_started', 'in_progress', 'returned'].includes(task?.status);
  const canSubmit = !isViewer && !isLocked && ['in_progress', 'returned'].includes(task?.status);
  const canValidate = isValidator && task?.status === 'submitted';

  const handleSave = async () => {
    setSaving(true);
    try {
      const newStatus = task.status === 'not_started' ? 'in_progress' : task.status;
      
      if (draftResponse) {
        await base44.entities.DraftResponse.update(draftResponse.id, formData);
      } else {
        const newDraft = await base44.entities.DraftResponse.create({
          task_id: taskId,
          ...formData
        });
        setDraftResponse(newDraft);
      }

      if (task.status === 'not_started') {
        await base44.entities.Task.update(taskId, { status: newStatus });
        setTask({ ...task, status: newStatus });
      }

      // Try to create audit log but don't block on failure
      try {
        await base44.entities.AuditLog.create({
          entity_type: 'Task',
          entity_id: taskId,
          action: 'draft_saved',
          after_json: formData,
          actor_id: user.id
        });
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
        toast.warning('Draft saved but audit log failed');
      }

      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      
      toast.success('Draft saved successfully');
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save draft');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.legal_basis || !formData.url) {
      toast.error('Legal Basis and URL are required');
      return;
    }
    setSubmitting(true);
    try {
      await handleSave();
      const newStatus = isTwoStepMode ? 'submitted' : 'validated';
      await base44.entities.Task.update(taskId, { status: newStatus });
      setTask({ ...task, status: newStatus });
      
      if (!isTwoStepMode) {
        await base44.entities.ValidatedResponse.create({
          task_id: taskId,
          snapshot_json: formData,
          validated_by: user.id,
          validated_at: new Date().toISOString()
        });
      }

      try {
        await base44.entities.AuditLog.create({
          entity_type: 'Task',
          entity_id: taskId,
          action: isTwoStepMode ? 'submitted' : 'validated',
          after_json: { status: newStatus },
          actor_id: user.id
        });
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      
      toast.success(isTwoStepMode ? 'Task submitted for validation' : 'Task marked as validated');
    } catch (error) {
      console.error('Failed to submit:', error);
      toast.error('Failed to submit task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      await base44.entities.Task.update(taskId, { status: 'validated' });
      await base44.entities.ValidatedResponse.create({
        task_id: taskId,
        snapshot_json: formData,
        validated_by: user.id,
        validated_at: new Date().toISOString()
      });
      await base44.entities.TaskValidationComment.create({
        task_id: taskId,
        comment_text: 'Approved',
        comment_type: 'approval_note'
      });
      setTask({ ...task, status: 'validated' });

      try {
        await base44.entities.AuditLog.create({
          entity_type: 'Task',
          entity_id: taskId,
          action: 'approved',
          after_json: { status: 'validated' },
          actor_id: user.id
        });
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      
      toast.success('Task validated successfully');
    } catch (error) {
      console.error('Failed to approve:', error);
      toast.error('Failed to approve task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturn = async () => {
    if (!returnComment || returnComment.length < 10) {
      toast.error('Comment must be at least 10 characters');
      return;
    }
    setSubmitting(true);
    try {
      await base44.entities.Task.update(taskId, { status: 'returned' });
      await base44.entities.TaskValidationComment.create({
        task_id: taskId,
        comment_text: returnComment,
        comment_type: 'return_reason'
      });
      setTask({ ...task, status: 'returned' });
      setComments([...comments, { comment_text: returnComment, comment_type: 'return_reason', created_date: new Date().toISOString() }]);
      setReturnComment('');

      try {
        await base44.entities.AuditLog.create({
          entity_type: 'Task',
          entity_id: taskId,
          action: 'returned',
          after_json: { status: 'returned', return_comment: returnComment },
          actor_id: user.id
        });
      } catch (auditError) {
        console.error('Failed to create audit log:', auditError);
      }

      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'], exact: false });
      
      toast.success('Task returned to researcher');
    } catch (error) {
      console.error('Failed to return:', error);
      toast.error('Failed to return task');
    } finally {
      setSubmitting(false);
    }
  };

  const handleApplyAIResult = async (result) => {
    if (!result.output_parsed_json) return;
    
    const parsed = result.output_parsed_json;
    setFormData({
      answer: parsed.answer || formData.answer,
      legal_basis: parsed.legal_basis || formData.legal_basis,
      url: parsed.url || formData.url,
      reforms: parsed.reforms || formData.reforms,
      date_of_enactment: parsed.date_of_enactment || formData.date_of_enactment,
      date_of_enforcement: parsed.date_of_enforcement || formData.date_of_enforcement,
      comments: parsed.comments || formData.comments,
      flag: parsed.flag || formData.flag,
      match_no_match: parsed.match_no_match || formData.match_no_match
    });

    // Update AI result to mark as applied
    await base44.entities.AITaskResult.update(result.id, {
      applied_to_draft_at: new Date().toISOString(),
      applied_to_draft_by: user.id
    });

    toast.success('AI result applied to draft');
  };

  const statusColors = {
    not_started: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    submitted: 'bg-amber-100 text-amber-700',
    returned: 'bg-red-100 text-red-700',
    validated: 'bg-emerald-100 text-emerald-700'
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-900">Task not found</h2>
        <Link to={createPageUrl('Tasks')}>
          <Button variant="link">Return to Tasks</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Link to={createPageUrl('Tasks')} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Tasks
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900">{economy?.name}</h1>
            <Badge className={statusColors[task.status]}>
              {task.status?.replace('_', ' ')}
            </Badge>
            {isLocked && (
              <Badge variant="outline" className="bg-slate-100">
                <Lock className="h-3 w-3 mr-1" />
                Locked
              </Badge>
            )}
          </div>
          <p className="text-slate-500 mt-1">{question?.question_code}</p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
          )}
          {canSubmit && (
            <Button onClick={handleSubmit} disabled={submitting} className="bg-[#002244] hover:bg-[#003366]">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
              {isTwoStepMode ? 'Submit for Validation' : 'Mark as Validated'}
            </Button>
          )}
          {canValidate && (
            <>
              <Button onClick={handleApprove} disabled={submitting} className="bg-emerald-600 hover:bg-emerald-700">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Return
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Return Task</AlertDialogTitle>
                    <AlertDialogDescription>
                      Provide feedback for the researcher (minimum 10 characters required).
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <Textarea
                    value={returnComment}
                    onChange={(e) => setReturnComment(e.target.value)}
                    placeholder="Enter your feedback..."
                    className="min-h-24"
                  />
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReturn} disabled={returnComment.length < 10}>
                      Return Task
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Question Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline">{indicator?.name}</Badge>
                    <Badge variant="secondary">{group?.group_name}</Badge>
                    {group?.subgroup_name && (
                      <Badge variant="secondary">{group.subgroup_name}</Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg">{question?.question_text}</CardTitle>
                </div>
                <Badge variant="outline">{question?.answer_type?.replace('_', ' ')}</Badge>
              </div>
            </CardHeader>
          </Card>

          {/* AI Results */}
          {aiResults.length > 0 && (
            <Card>
              <CardHeader className="cursor-pointer" onClick={() => setShowAIResults(!showAIResults)}>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Brain className="h-5 w-5 text-[#0066B3]" />
                    AI Results ({aiResults.length})
                  </CardTitle>
                  {showAIResults ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                </div>
              </CardHeader>
              {showAIResults && (
                <CardContent>
                  {aiResults.map((result, index) => {
                    const promptVersion = result.economy_context_json?.prompt_version;
                    const isMissingPrompt = result.error_code === 'MISSING_PROMPT';
                    const showPrompt = showPromptForResult[result.id] || false;
                    
                    return (
                    <div key={result.id} className="border rounded-lg p-4 mb-4 last:mb-0">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge className={
                            result.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                            result.status === 'failed' ? 'bg-red-100 text-red-700' :
                            'bg-slate-100 text-slate-700'
                          }>
                            {result.status}
                          </Badge>
                          {isMissingPrompt ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                              Prompt: Missing
                            </Badge>
                          ) : promptVersion?.version_number ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              Prompt: v{promptVersion.version_number}
                            </Badge>
                          ) : null}
                          <span className="text-sm text-slate-500">
                            {result.created_date ? format(new Date(result.created_date), 'MMM d, HH:mm') : '-'}
                          </span>
                        </div>
                        {result.status === 'completed' && !isViewer && canEdit && (
                          <Button size="sm" variant="outline" onClick={() => handleApplyAIResult(result)}>
                            Apply to Draft
                          </Button>
                        )}
                      </div>
                      {isMissingPrompt && (
                        <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                          {result.error_text}
                        </div>
                      )}
                      {result.status !== 'completed' && !isMissingPrompt && (
                        <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded space-y-2">
                          <div className="text-sm text-red-900 font-medium">Failure Details</div>
                          <div className="text-sm text-red-700 space-y-1">
                            <div><span className="font-medium">Status:</span> {result.status}</div>
                            {result.error_code && (
                              <div><span className="font-medium">Error code:</span> {result.error_code}</div>
                            )}
                            {result.error_text && (
                              <div><span className="font-medium">Error:</span> {result.error_text}</div>
                            )}
                          </div>
                          {result.output_raw_text && (
                            <details className="mt-2">
                              <summary className="text-xs text-red-800 cursor-pointer hover:underline">
                                Show raw model output
                              </summary>
                              <pre className="mt-2 p-2 bg-white border border-red-200 rounded text-xs overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap font-mono">
                                {result.output_raw_text || '(none)'}
                              </pre>
                            </details>
                          )}
                        </div>
                      )}
                      {result.output_parsed_json && (
                        <div className="space-y-2 text-sm">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-slate-500">Answer</p>
                              <p className="font-medium">{result.output_parsed_json.answer || '-'}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Legal Basis</p>
                              <p className="font-medium truncate">{result.output_parsed_json.legal_basis || '-'}</p>
                            </div>
                          </div>
                          {result.output_parsed_json.url && (
                            <div>
                              <p className="text-slate-500">URL</p>
                              <a href={result.output_parsed_json.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                                {result.output_parsed_json.url.substring(0, 50)}...
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                      {(result.prompt_rendered_text || promptVersion?.question_prompt_text) && (
                        <div className="mt-3 border-t pt-3 space-y-2">
                          {promptVersion?.question_prompt_text && (
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => setShowPromptForResult(prev => ({ ...prev, [`${result.id}_question`]: !showPromptForResult[`${result.id}_question`] }))}
                              >
                                {showPromptForResult[`${result.id}_question`] ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                {showPromptForResult[`${result.id}_question`] ? 'Hide' : 'View'} Question Prompt (Question Library)
                              </Button>
                              {showPromptForResult[`${result.id}_question`] && (
                                <pre className="mt-2 p-3 bg-blue-50 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto border border-blue-200">
                                  {promptVersion.question_prompt_text}
                                </pre>
                              )}
                            </div>
                          )}
                          {result.prompt_rendered_text && (
                            <div>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-xs"
                                onClick={() => setShowPromptForResult(prev => ({ ...prev, [result.id]: !showPrompt }))}
                              >
                                {showPrompt ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                                {showPrompt ? 'Hide' : 'View'} Full Prompt (Complete)
                              </Button>
                              {showPrompt && (
                                <pre className="mt-2 p-3 bg-slate-50 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto border">
                                  {result.prompt_rendered_text}
                                </pre>
                              )}
                            </div>
                          )}
                          {!promptVersion?.question_prompt_text && result.prompt_rendered_text && (
                            <p className="text-xs text-slate-500 italic">Question prompt snapshot not recorded for this run.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  })}
                </CardContent>
              )}
            </Card>
          )}

          {/* Draft Response Form */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Response</CardTitle>
              <CardDescription>
                {canEdit ? 'Edit the draft response below' : 'View the response below'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Answer */}
              <div className="space-y-2">
                <Label htmlFor="answer">Answer *</Label>
                {question?.answer_type === 'boolean_yesno' ? (
                  <Select 
                    value={formData.answer} 
                    onValueChange={(v) => setFormData({...formData, answer: v})}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select answer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                      <SelectItem value="N/A">N/A</SelectItem>
                    </SelectContent>
                  </Select>
                ) : question?.answer_type === 'integer' ? (
                  <Input
                    id="answer"
                    type="number"
                    value={formData.answer}
                    onChange={(e) => setFormData({...formData, answer: e.target.value})}
                    disabled={!canEdit}
                  />
                ) : (
                  <Input
                    id="answer"
                    value={formData.answer}
                    onChange={(e) => setFormData({...formData, answer: e.target.value})}
                    disabled={!canEdit}
                  />
                )}
              </div>

              {/* Legal Basis */}
              <div className="space-y-2">
                <Label htmlFor="legal_basis">Legal Basis *</Label>
                <Textarea
                  id="legal_basis"
                  value={formData.legal_basis}
                  onChange={(e) => setFormData({...formData, legal_basis: e.target.value})}
                  disabled={!canEdit}
                  placeholder="Enter legal citation(s)"
                  className="min-h-20"
                />
              </div>

              {/* URL */}
              <div className="space-y-2">
                <Label htmlFor="url">URL *</Label>
                <Input
                  id="url"
                  value={formData.url}
                  onChange={(e) => setFormData({...formData, url: e.target.value})}
                  disabled={!canEdit}
                  placeholder="https://..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reforms */}
                <div className="space-y-2">
                  <Label>Reforms</Label>
                  <Select 
                    value={formData.reforms} 
                    onValueChange={(v) => setFormData({...formData, reforms: v})}
                    disabled={!canEdit}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>None</SelectItem>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Flag */}
                <div className="space-y-2">
                  <Label>Flag</Label>
                  <Select 
                    value={formData.flag} 
                    onValueChange={(v) => setFormData({...formData, flag: v})}
                    disabled={!canEdit && !isValidator}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="None">None</SelectItem>
                      <SelectItem value="Needs follow-up">Needs follow-up</SelectItem>
                      <SelectItem value="Source missing">Source missing</SelectItem>
                      <SelectItem value="Ambiguous law">Ambiguous law</SelectItem>
                      <SelectItem value="Conflicting sources">Conflicting sources</SelectItem>
                      <SelectItem value="Translation needed">Translation needed</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Date of Enactment */}
                <div className="space-y-2">
                  <Label htmlFor="date_of_enactment">Date of Enactment</Label>
                  <Input
                    id="date_of_enactment"
                    type="date"
                    value={formData.date_of_enactment}
                    onChange={(e) => setFormData({...formData, date_of_enactment: e.target.value})}
                    disabled={!canEdit}
                  />
                </div>

                {/* Date of Enforcement */}
                <div className="space-y-2">
                  <Label htmlFor="date_of_enforcement">Date of Enforcement</Label>
                  <Input
                    id="date_of_enforcement"
                    type="date"
                    value={formData.date_of_enforcement}
                    onChange={(e) => setFormData({...formData, date_of_enforcement: e.target.value})}
                    disabled={!canEdit}
                  />
                </div>
              </div>

              {/* Comments */}
              <div className="space-y-2">
                <Label htmlFor="comments">Comments</Label>
                <Textarea
                  id="comments"
                  value={formData.comments}
                  onChange={(e) => setFormData({...formData, comments: e.target.value})}
                  disabled={!canEdit}
                  placeholder="Additional notes..."
                  className="min-h-20"
                />
              </div>

              {/* Match/NoMatch */}
              <div className="space-y-2">
                <Label>Match/NoMatch</Label>
                <Select 
                  value={formData.match_no_match} 
                  onValueChange={(v) => setFormData({...formData, match_no_match: v})}
                  disabled={!canEdit && !isValidator}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unknown">Unknown</SelectItem>
                    <SelectItem value="Match">Match</SelectItem>
                    <SelectItem value="NoMatch">NoMatch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Task Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-500">Task Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs text-slate-500">Batch</p>
                <Link to={createPageUrl(`BatchDetail?id=${batch?.id}`)} className="text-sm font-medium text-blue-600 hover:underline">
                  {batch?.name}
                </Link>
              </div>
              <div>
                <p className="text-xs text-slate-500">Reporting Year</p>
                <p className="text-sm font-medium">{batch?.reporting_year || 2026}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">As-of Date</p>
                <p className="text-sm font-medium">{batch?.as_of_date || '-'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-xs text-slate-500">Last Updated</p>
                <p className="text-sm font-medium">
                  {task.updated_date ? format(new Date(task.updated_date), 'MMM d, yyyy HH:mm') : '-'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Validation Comments */}
          {comments.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Validation Comments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-48">
                  <div className="space-y-3">
                    {comments.map((comment, index) => (
                      <div key={index} className={`p-3 rounded-lg text-sm ${
                        comment.comment_type === 'return_reason' ? 'bg-red-50 border border-red-200' :
                        comment.comment_type === 'approval_note' ? 'bg-emerald-50 border border-emerald-200' :
                        'bg-slate-50'
                      }`}>
                        <p className="text-slate-700">{comment.comment_text}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {comment.created_date ? format(new Date(comment.created_date), 'MMM d, HH:mm') : '-'}
                        </p>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Attachments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Paperclip className="h-4 w-4" />
                Attachments ({attachments.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {attachments.length === 0 ? (
                <p className="text-sm text-slate-500">No attachments</p>
              ) : (
                <div className="space-y-2">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 p-2 rounded border">
                      <Paperclip className="h-4 w-4 text-slate-400" />
                      <span className="text-sm truncate flex-1">{att.file_name}</span>
                    </div>
                  ))}
                </div>
              )}
              {canEdit && (
                <Button variant="outline" size="sm" className="w-full mt-3">
                  <Paperclip className="h-4 w-4 mr-2" />
                  Upload File
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}