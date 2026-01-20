import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';
import {
  ArrowLeft,
  Calendar,
  Globe,
  FileQuestion,
  Users,
  Brain,
  Play,
  Trash2,
  Download,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BarChart3
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function BatchDetail() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [batch, setBatch] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [economies, setEconomies] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [aiRequests, setAIRequests] = useState([]);
  const [user, setUser] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [runningAI, setRunningAI] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const batchId = new URLSearchParams(window.location.search).get('id');

  useEffect(() => {
    if (batchId) {
      loadData();
    }
  }, [batchId]);

  const loadData = async () => {
    try {
      const [userData, batchData, tasksData, economiesData, questionsData, aiRequestsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Batch.filter({ id: batchId }),
        base44.entities.Task.filter({ batch_id: batchId }),
        base44.entities.Economy.list(),
        base44.entities.Question.list(),
        base44.entities.AIRequest.filter({ batch_id: batchId })
      ]);

      setUser(userData);
      setBatch(batchData[0]);
      setTasks(tasksData);
      setEconomies(economiesData);
      setQuestions(questionsData);
      setAIRequests(aiRequestsData);
    } catch (error) {
      console.error('Failed to load batch:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  const statusCounts = {
    not_started: tasks.filter(t => t.status === 'not_started').length,
    in_progress: tasks.filter(t => t.status === 'in_progress').length,
    submitted: tasks.filter(t => t.status === 'submitted').length,
    returned: tasks.filter(t => t.status === 'returned').length,
    validated: tasks.filter(t => t.status === 'validated').length
  };

  const completionRate = tasks.length > 0 
    ? Math.round((statusCounts.validated / tasks.length) * 100) 
    : 0;

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return;
    try {
      // Delete all related data
      for (const task of tasks) {
        await base44.entities.Task.delete(task.id);
      }
      for (const req of aiRequests) {
        await base44.entities.AIRequest.delete(req.id);
      }
      await base44.entities.Batch.delete(batchId);
      navigate(createPageUrl('Batches'));
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  const handleRunAI = async () => {
    if (!batch.primary_provider_id || !batch.primary_model_id) {
      toast({ 
        title: 'Configuration Error', 
        description: 'Please configure AI provider and model first', 
        variant: 'destructive' 
      });
      return;
    }

    setRunningAI(true);
    try {
      const aiRequest = await base44.entities.AIRequest.create({
        batch_id: batchId,
        scope_json: { scope_type: 'full_batch' },
        provider_id: batch.primary_provider_id,
        model_id: batch.primary_model_id,
        retrieval_method: batch.retrieval_method,
        status: 'queued',
        total_tasks: tasks.length
      });

      // Invoke backend function to process
      base44.functions.invoke('runAIRequest', { ai_request_id: aiRequest.id })
        .catch(err => console.error('AI request processing failed:', err));

      setAIRequests([...aiRequests, aiRequest]);

      // Start polling for updates
      const pollInterval = setInterval(async () => {
        try {
          const [updated] = await base44.entities.AIRequest.filter({ id: aiRequest.id });
          if (updated && (updated.status === 'completed' || updated.status === 'failed')) {
            clearInterval(pollInterval);
            await loadData();
          }
        } catch (error) {
          if (!error.message?.includes('Rate limit') && !error.message?.includes('429')) {
            console.error('Poll failed:', error);
          }
        }
      }, 10000);

      // Clear interval after 5 minutes
      setTimeout(() => clearInterval(pollInterval), 300000);

    } catch (error) {
      console.error('Failed to create AI request:', error);
      toast({ title: 'Error', description: error.message || 'Failed to run AI', variant: 'destructive' });
    } finally {
      setRunningAI(false);
    }
  };

  const getEconomyName = (id) => economies.find(e => e.id === id)?.name || 'Unknown';
  const getQuestionCode = (id) => questions.find(q => q.id === id)?.question_code || 'Unknown';

  const statusColors = {
    not_started: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    submitted: 'bg-amber-100 text-amber-700',
    returned: 'bg-red-100 text-red-700',
    validated: 'bg-emerald-100 text-emerald-700'
  };

  const batchStatusColors = {
    creating: 'bg-amber-100 text-amber-700',
    active: 'bg-emerald-100 text-emerald-700',
    archived: 'bg-slate-100 text-slate-700',
    creation_failed: 'bg-red-100 text-red-700'
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-slate-300" />
        <h2 className="text-xl font-semibold text-slate-900">Batch not found</h2>
        <Link to={createPageUrl('Batches')}>
          <Button variant="link">Return to Batches</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div>
          <Link to={createPageUrl('Batches')} className="inline-flex items-center text-sm text-slate-500 hover:text-slate-700 mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Batches
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{batch.name}</h1>
            <Badge className={batchStatusColors[batch.status]}>
              {batch.status?.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-slate-500 mt-1">
            Created {batch.created_date ? format(new Date(batch.created_date), 'MMM d, yyyy') : 'recently'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRunAI} disabled={runningAI}>
            {runningAI ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Brain className="h-4 w-4 mr-2" />
            )}
            Run AI
          </Button>
          <Link to={createPageUrl(`Exports?batch_id=${batchId}`)}>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </Link>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Batch</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete this batch and all {tasks.length} tasks, responses, AI results, and exports. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="my-4">
                  <p className="text-sm text-slate-500 mb-2">Type DELETE to confirm:</p>
                  <Input
                    value={deleteConfirm}
                    onChange={(e) => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE"
                  />
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setDeleteConfirm('')}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    disabled={deleteConfirm !== 'DELETE'}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Delete Batch
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Globe className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold">{batch.economy_ids?.length || 0}</p>
            <p className="text-sm text-slate-500">Economies</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <FileQuestion className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold">{batch.question_ids?.length || 0}</p>
            <p className="text-sm text-slate-500">Questions</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold">{tasks.length}</p>
            <p className="text-sm text-slate-500">Total Tasks</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">{statusCounts.validated}</p>
            <p className="text-sm text-slate-500">Validated</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold">{batch.reporting_year}</p>
            <p className="text-sm text-slate-500">Year</p>
          </CardContent>
        </Card>
      </div>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Completion Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Validated</span>
              <span className="font-medium">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-3" />
          </div>
          <div className="grid grid-cols-5 gap-2 mt-4">
            {[
              { label: 'Not Started', count: statusCounts.not_started, color: 'bg-slate-500' },
              { label: 'In Progress', count: statusCounts.in_progress, color: 'bg-blue-500' },
              { label: 'Submitted', count: statusCounts.submitted, color: 'bg-amber-500' },
              { label: 'Returned', count: statusCounts.returned, color: 'bg-red-500' },
              { label: 'Validated', count: statusCounts.validated, color: 'bg-emerald-500' }
            ].map(item => (
              <div key={item.label} className="text-center">
                <div className={`h-2 w-full rounded ${item.color} mb-2`} />
                <p className="text-lg font-bold">{item.count}</p>
                <p className="text-xs text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="tasks">
        <TabsList>
          <TabsTrigger value="tasks">Tasks ({tasks.length})</TabsTrigger>
          <TabsTrigger value="ai">AI Requests ({aiRequests.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Economy</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks.slice(0, 20).map(task => (
                    <TableRow key={task.id} className="hover:bg-slate-50">
                      <TableCell>{getEconomyName(task.economy_id)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{getQuestionCode(task.question_id)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[task.status]}>
                          {task.status?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-500">
                        {task.updated_date ? format(new Date(task.updated_date), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`TaskDetail?id=${task.id}`)}>
                          <Button variant="ghost" size="sm">View</Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {tasks.length > 20 && (
                <div className="p-4 text-center border-t">
                  <Link to={createPageUrl(`Tasks?batch_id=${batchId}`)}>
                    <Button variant="link">View all {tasks.length} tasks</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai">
          <Card>
            <CardContent className="p-0">
              {aiRequests.length === 0 ? (
                <div className="p-12 text-center">
                  <Brain className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <h3 className="font-medium text-slate-900">No AI requests yet</h3>
                  <p className="text-sm text-slate-500 mt-1">Run AI to start collecting data</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Request ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aiRequests.map(req => {
                      const duration = req.started_at && req.completed_at 
                        ? Math.round((new Date(req.completed_at) - new Date(req.started_at)) / 1000) 
                        : null;
                      return (
                        <TableRow key={req.id}>
                          <TableCell className="font-mono text-sm">{req.id?.slice(-8)}</TableCell>
                          <TableCell>
                            <Badge className={
                              req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              req.status === 'running' ? 'bg-blue-100 text-blue-700' :
                              req.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {req.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {req.completed_tasks || 0} / {req.total_tasks || 0}
                            {req.failed_tasks > 0 && (
                              <span className="text-red-600 ml-2">({req.failed_tasks} failed)</span>
                            )}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {duration ? `${duration}s` : req.status === 'running' ? 'Running...' : '-'}
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {req.created_date ? format(new Date(req.created_date), 'MMM d, HH:mm') : '-'}
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => setSelectedRequest(req)}>
                              View Details
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* AI Request Details Dialog */}
      {selectedRequest && (
        <AlertDialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
          <AlertDialogContent className="max-w-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>AI Request Details</AlertDialogTitle>
              <AlertDialogDescription>
                Request ID: {selectedRequest.id?.slice(-12)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-500">Status</p>
                  <Badge className={
                    selectedRequest.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                    selectedRequest.status === 'running' ? 'bg-blue-100 text-blue-700' :
                    selectedRequest.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-slate-100 text-slate-700'
                  }>
                    {selectedRequest.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-slate-500">Retrieval Method</p>
                  <p className="font-medium">{selectedRequest.retrieval_method}</p>
                </div>
                <div>
                  <p className="text-slate-500">Total Tasks</p>
                  <p className="font-medium">{selectedRequest.total_tasks}</p>
                </div>
                <div>
                  <p className="text-slate-500">Completed</p>
                  <p className="font-medium">{selectedRequest.completed_tasks || 0}</p>
                </div>
                <div>
                  <p className="text-slate-500">Failed</p>
                  <p className="font-medium text-red-600">{selectedRequest.failed_tasks || 0}</p>
                </div>
                <div>
                  <p className="text-slate-500">Started At</p>
                  <p className="font-medium">
                    {selectedRequest.started_at 
                      ? format(new Date(selectedRequest.started_at), 'MMM d, HH:mm:ss') 
                      : '-'}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Completed At</p>
                  <p className="font-medium">
                    {selectedRequest.completed_at 
                      ? format(new Date(selectedRequest.completed_at), 'MMM d, HH:mm:ss') 
                      : '-'}
                  </p>
                </div>
              </div>
              {selectedRequest.error_text && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                  <p className="text-sm font-medium text-red-900 mb-1">Error</p>
                  <p className="text-sm text-red-700">{selectedRequest.error_text}</p>
                </div>
              )}
            </div>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => setSelectedRequest(null)}>Close</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}