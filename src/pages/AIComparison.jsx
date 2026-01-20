import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  GitCompare,
  Play,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Eye
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AIComparison() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  
  const [batches, setBatches] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [aiResults, setAIResults] = useState([]);
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [economies, setEconomies] = useState([]);
  const [questions, setQuestions] = useState([]);

  // Selections
  const [selectedBatch, setSelectedBatch] = useState('');
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [comparisonModel, setComparisonModel] = useState('');
  const [comparisonProvider, setComparisonProvider] = useState('');

  // Results
  const [comparisonResults, setComparisonResults] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedBatch) {
      loadBatchTasks();
    }
  }, [selectedBatch]);

  const loadData = async () => {
    try {
      const [batchesData, providersData, modelsData, economiesData, questionsData] = await Promise.all([
        base44.entities.Batch.filter({ status: 'active' }),
        base44.entities.AIProvider.filter({ is_enabled: true }),
        base44.entities.AIModel.filter({ is_enabled: true }),
        base44.entities.Economy.list(),
        base44.entities.Question.list()
      ]);

      setBatches(batchesData);
      setProviders(providersData);
      setModels(modelsData);
      setEconomies(economiesData);
      setQuestions(questionsData);

      if (providersData.length > 0) {
        setComparisonProvider(providersData[0].id);
        const providerModels = modelsData.filter(m => m.provider_id === providersData[0].id);
        if (providerModels.length > 0) {
          setComparisonModel(providerModels[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchTasks = async () => {
    try {
      const [tasksData, resultsData] = await Promise.all([
        base44.entities.Task.filter({ batch_id: selectedBatch }),
        base44.entities.AITaskResult.filter({ is_comparison: false })
      ]);

      // Filter tasks that have primary AI results
      const tasksWithResults = tasksData.filter(task => 
        resultsData.some(r => r.task_id === task.id && r.status === 'completed')
      );

      setTasks(tasksWithResults);
      setAIResults(resultsData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  };

  const getEconomy = (id) => economies.find(e => e.id === id);
  const getQuestion = (id) => questions.find(q => q.id === id);
  const getModel = (id) => models.find(m => m.id === id);

  const getPrimaryResult = (taskId) => 
    aiResults.find(r => r.task_id === taskId && r.status === 'completed' && !r.is_comparison);

  const toggleTask = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAllTasks = () => {
    setSelectedTasks(tasks.map(t => t.id));
  };

  const handleRunComparison = async () => {
    if (selectedTasks.length === 0) {
      toast({ title: 'Error', description: 'Select at least one task', variant: 'destructive' });
      return;
    }
    if (!comparisonModel) {
      toast({ title: 'Error', description: 'Select a comparison model', variant: 'destructive' });
      return;
    }

    setRunning(true);
    try {
      // Create comparison AI request
      const aiRequest = await base44.entities.AIRequest.create({
        batch_id: selectedBatch,
        scope_json: { scope_type: 'selected_tasks', task_ids: selectedTasks },
        provider_id: comparisonProvider,
        model_id: comparisonModel,
        status: 'completed', // For demo
        total_tasks: selectedTasks.length,
        completed_tasks: selectedTasks.length,
        is_comparison: true
      });

      // Generate mock comparison results
      const results = selectedTasks.map(taskId => {
        const primary = getPrimaryResult(taskId);
        const hasConflict = Math.random() > 0.7; // 30% conflict rate for demo

        return {
          task_id: taskId,
          primary: primary?.output_parsed_json || {},
          comparison: {
            answer: hasConflict ? (primary?.output_parsed_json?.answer === 'Yes' ? 'No' : 'Yes') : primary?.output_parsed_json?.answer,
            legal_basis: primary?.output_parsed_json?.legal_basis || '',
            url: primary?.output_parsed_json?.url || ''
          },
          has_conflict: hasConflict
        };
      });

      setComparisonResults(results);
      toast({ title: 'Comparison Complete', description: `Compared ${selectedTasks.length} tasks` });
    } catch (error) {
      console.error('Failed to run comparison:', error);
      toast({ title: 'Error', description: 'Failed to run comparison', variant: 'destructive' });
    } finally {
      setRunning(false);
    }
  };

  const selectedBatchData = batches.find(b => b.id === selectedBatch);
  const primaryModel = selectedBatchData ? getModel(selectedBatchData.primary_model_id) : null;
  const comparisonModelData = getModel(comparisonModel);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">AI Comparison</h1>
        <p className="text-slate-500 mt-1">Compare AI outputs across different models</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Configuration */}
        <div className="space-y-6">
          {/* Batch Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Batch</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedBatch} onValueChange={(v) => {
                setSelectedBatch(v);
                setSelectedTasks([]);
                setComparisonResults([]);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBatchData && (
                <div className="mt-4 p-3 bg-slate-50 rounded-lg text-sm">
                  <p className="text-slate-500">Primary Model</p>
                  <p className="font-medium">{primaryModel?.display_name || 'Unknown'}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Comparison Model */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Comparison Model</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm text-slate-500 mb-2 block">Provider</label>
                <Select 
                  value={comparisonProvider} 
                  onValueChange={(v) => {
                    setComparisonProvider(v);
                    const providerModels = models.filter(m => m.provider_id === v);
                    setComparisonModel(providerModels[0]?.id || '');
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-slate-500 mb-2 block">Model</label>
                <Select value={comparisonModel} onValueChange={setComparisonModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.filter(m => m.provider_id === comparisonProvider).map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleRunComparison}
                disabled={running || selectedTasks.length === 0 || !comparisonModel}
                className="w-full bg-[#002244] hover:bg-[#003366]"
              >
                {running ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Run Comparison ({selectedTasks.length})
                  </>
                )}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* Task Selection */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Select Tasks</CardTitle>
                {tasks.length > 0 && (
                  <Button variant="outline" size="sm" onClick={selectAllTasks}>
                    Select All ({tasks.length})
                  </Button>
                )}
              </div>
              <CardDescription>
                Choose tasks with completed primary AI results to compare
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!selectedBatch ? (
                <div className="text-center py-12 text-slate-500">
                  <GitCompare className="h-12 w-12 mx-auto mb-4 text-slate-300" />
                  <p>Select a batch to see available tasks</p>
                </div>
              ) : loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <p>No tasks with completed AI results</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {tasks.map(task => {
                      const economy = getEconomy(task.economy_id);
                      const question = getQuestion(task.question_id);
                      const result = comparisonResults.find(r => r.task_id === task.id);

                      return (
                        <div
                          key={task.id}
                          onClick={() => toggleTask(task.id)}
                          className={`p-4 rounded-lg border cursor-pointer transition-all ${
                            selectedTasks.includes(task.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox checked={selectedTasks.includes(task.id)} className="mt-1" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-slate-900">{economy?.name}</p>
                                {result && (
                                  result.has_conflict ? (
                                    <Badge className="bg-amber-100 text-amber-700">
                                      <AlertTriangle className="h-3 w-3 mr-1" />
                                      Conflict
                                    </Badge>
                                  ) : (
                                    <Badge className="bg-emerald-100 text-emerald-700">
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                      Match
                                    </Badge>
                                  )
                                )}
                              </div>
                              <Badge variant="outline" className="mt-1">{question?.question_code}</Badge>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Comparison Results */}
      {comparisonResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Comparison Results</CardTitle>
            <CardDescription>
              {comparisonResults.filter(r => r.has_conflict).length} conflicts found in {comparisonResults.length} comparisons
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Economy</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>{primaryModel?.display_name || 'Primary'}</TableHead>
                  <TableHead>{comparisonModelData?.display_name || 'Comparison'}</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparisonResults.map(result => {
                  const task = tasks.find(t => t.id === result.task_id);
                  const economy = getEconomy(task?.economy_id);
                  const question = getQuestion(task?.question_id);

                  return (
                    <TableRow key={result.task_id}>
                      <TableCell className="font-medium">{economy?.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{question?.question_code}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className="font-medium">{result.primary.answer || '-'}</p>
                          <p className="text-slate-500 truncate max-w-xs">{result.primary.legal_basis?.slice(0, 50)}...</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p className={`font-medium ${result.has_conflict ? 'text-amber-600' : ''}`}>
                            {result.comparison.answer || '-'}
                          </p>
                          <p className="text-slate-500 truncate max-w-xs">{result.comparison.legal_basis?.slice(0, 50)}...</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {result.has_conflict ? (
                          <Badge className="bg-amber-100 text-amber-700">
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Conflict
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Match
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}