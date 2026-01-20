import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Brain,
  Play,
  Pause,
  X,
  Trash2,
  MoreHorizontal,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';

export default function AIRequests() {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState([]);
  const [batches, setBatches] = useState([]);
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [user, setUser] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');

  const pollingRef = React.useRef(false);
  const cooldownRef = React.useRef(false);

  useEffect(() => {
    loadData();
    
    // Poll for running requests - 15s interval
    const pollInterval = setInterval(async () => {
      if (pollingRef.current || cooldownRef.current) return;
      
      try {
        pollingRef.current = true;
        const runningReqs = requests.filter(r => r.status === 'running');
        if (runningReqs.length > 0) {
          const updated = await base44.entities.AIRequest.filter({ 
            status: 'running' 
          });
          
          // Merge updated records into state without full reload
          setRequests(prev => 
            prev.map(req => {
              const updatedReq = updated.find(u => u.id === req.id);
              return updatedReq || req;
            })
          );
        }
      } catch (error) {
        console.error('Poll failed:', error);
        if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
          cooldownRef.current = true;
          setTimeout(() => { cooldownRef.current = false; }, 30000);
        }
      } finally {
        pollingRef.current = false;
      }
    }, 15000);

    return () => clearInterval(pollInterval);
  }, [requests]);

  const loadData = async () => {
    try {
      const [userData, requestsData, batchesData, providersData, modelsData] = await Promise.all([
        base44.auth.me(),
        base44.entities.AIRequest.list('-created_date', 100),
        base44.entities.Batch.list('-created_date', 100),
        base44.entities.AIProvider.list(),
        base44.entities.AIModel.list()
      ]);

      setUser(userData);
      setRequests(requestsData);
      setBatches(batchesData);
      setProviders(providersData);
      setModels(modelsData);
    } catch (error) {
      console.error('Failed to load data:', error);
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        cooldownRef.current = true;
        setTimeout(() => { cooldownRef.current = false; }, 30000);
      }
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  const getBatch = (id) => batches.find(b => b.id === id);
  const getProvider = (id) => providers.find(p => p.id === id);
  const getModel = (id) => models.find(m => m.id === id);

  const filteredRequests = requests.filter(req => {
    const matchesStatus = statusFilter === 'all' || req.status === statusFilter;
    const matchesBatch = batchFilter === 'all' || req.batch_id === batchFilter;
    return matchesStatus && matchesBatch;
  });

  const handleCancel = async (requestId) => {
    try {
      await base44.entities.AIRequest.update(requestId, { status: 'canceled' });
      setRequests(requests.map(r => r.id === requestId ? { ...r, status: 'canceled' } : r));
    } catch (error) {
      console.error('Failed to cancel request:', error);
    }
  };

  const handleDelete = async (requestId) => {
    if (!confirm('Delete this AI request and all its results?')) return;
    try {
      await base44.entities.AIRequest.delete(requestId);
      setRequests(requests.filter(r => r.id !== requestId));
    } catch (error) {
      console.error('Failed to delete request:', error);
    }
  };

  const statusColors = {
    queued: 'bg-slate-100 text-slate-700',
    running: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700',
    canceled: 'bg-orange-100 text-orange-700',
    paused_model_unavailable: 'bg-amber-100 text-amber-700'
  };

  const statusIcons = {
    queued: Clock,
    running: Loader2,
    completed: CheckCircle2,
    failed: AlertCircle,
    canceled: X,
    paused_model_unavailable: Pause
  };

  const stats = {
    total: requests.length,
    running: requests.filter(r => r.status === 'running').length,
    completed: requests.filter(r => r.status === 'completed').length,
    failed: requests.filter(r => r.status === 'failed').length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">AI Requests</h1>
        <p className="text-slate-500 mt-1">Monitor and manage AI data collection jobs</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Brain className="h-6 w-6 mx-auto mb-2 text-slate-400" />
            <p className="text-2xl font-bold">{stats.total}</p>
            <p className="text-sm text-slate-500">Total Requests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Loader2 className={`h-6 w-6 mx-auto mb-2 text-blue-500 ${stats.running > 0 ? 'animate-spin' : ''}`} />
            <p className="text-2xl font-bold">{stats.running}</p>
            <p className="text-sm text-slate-500">Running</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500" />
            <p className="text-2xl font-bold">{stats.completed}</p>
            <p className="text-sm text-slate-500">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
            <p className="text-2xl font-bold">{stats.failed}</p>
            <p className="text-sm text-slate-500">Failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="canceled">Canceled</SelectItem>
              </SelectContent>
            </Select>

            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Batch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Batches</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-12 text-center">
              <Brain className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No AI requests</h3>
              <p className="text-slate-500">AI requests will appear here when you run AI collection</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Request ID</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map(req => {
                  const batch = getBatch(req.batch_id);
                  const provider = getProvider(req.provider_id);
                  const model = getModel(req.model_id);
                  const StatusIcon = statusIcons[req.status] || Clock;
                  const progress = req.total_tasks > 0 
                    ? Math.round((req.completed_tasks / req.total_tasks) * 100) 
                    : 0;

                  return (
                    <TableRow key={req.id}>
                      <TableCell className="font-mono text-sm">{req.id?.slice(-8)}</TableCell>
                      <TableCell>
                        <Link 
                          to={createPageUrl(`BatchDetail?id=${req.batch_id}`)}
                          className="text-blue-600 hover:underline"
                        >
                          {batch?.name || 'Unknown'}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{model?.display_name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{provider?.name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={statusColors[req.status]}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${req.status === 'running' ? 'animate-spin' : ''}`} />
                            {req.status?.replace('_', ' ')}
                          </Badge>
                          {req.error_text && (
                            <p className="text-xs text-red-600">{req.error_text}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="w-32">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>{req.completed_tasks || 0}/{req.total_tasks || 0}</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {req.created_date ? format(new Date(req.created_date), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {req.status === 'running' && (
                              <DropdownMenuItem onClick={() => handleCancel(req.id)}>
                                <X className="h-4 w-4 mr-2" />
                                Cancel
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(req.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}