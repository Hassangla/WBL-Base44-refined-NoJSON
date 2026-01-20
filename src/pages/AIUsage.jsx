import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import {
  Brain,
  DollarSign,
  Zap,
  FileText,
  TrendingUp
} from 'lucide-react';
import { format } from 'date-fns';

const COLORS = ['#002244', '#0066B3', '#F7941D', '#10b981', '#6366f1'];

export default function AIUsage() {
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState([]);
  const [requests, setRequests] = useState([]);
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);
  const [batches, setBatches] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [economies, setEconomies] = useState([]);
  const [questions, setQuestions] = useState([]);

  // Filters
  const [dateRange, setDateRange] = useState('30');
  const [providerFilter, setProviderFilter] = useState('all');
  const [activeView, setActiveView] = useState('overview');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [resultsData, requestsData, providersData, modelsData, batchesData, tasksData, economiesData, questionsData] = await Promise.all([
        base44.entities.AITaskResult.list('-created_date', 500),
        base44.entities.AIRequest.list('-created_date', 100),
        base44.entities.AIProvider.list(),
        base44.entities.AIModel.list(),
        base44.entities.Batch.list(),
        base44.entities.Task.list(),
        base44.entities.Economy.list(),
        base44.entities.Question.list()
      ]);

      setResults(resultsData);
      setRequests(requestsData);
      setProviders(providersData);
      setModels(modelsData);
      setBatches(batchesData);
      setTasks(tasksData);
      setEconomies(economiesData);
      setQuestions(questionsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModel = (id) => models.find(m => m.id === id);
  const getProvider = (id) => providers.find(p => p.id === id);
  const getTask = (id) => tasks.find(t => t.id === id);
  const getEconomy = (id) => economies.find(e => e.id === id);
  const getQuestion = (id) => questions.find(q => q.id === id);

  // Calculate stats
  const totalTokensIn = results.reduce((sum, r) => sum + (r.tokens_in || 0), 0);
  const totalTokensOut = results.reduce((sum, r) => sum + (r.tokens_out || 0), 0);
  const totalCost = results.reduce((sum, r) => sum + (r.cost_estimate || 0), 0);
  const successRate = results.length > 0 
    ? Math.round((results.filter(r => r.status === 'completed').length / results.length) * 100)
    : 0;

  // Chart data - by model
  const modelUsage = models.map(model => ({
    name: model.display_name,
    runs: results.filter(r => r.model_id === model.id).length,
    cost: results.filter(r => r.model_id === model.id).reduce((sum, r) => sum + (r.cost_estimate || 0), 0)
  })).filter(m => m.runs > 0);

  // Chart data - by status
  const statusData = [
    { name: 'Completed', value: results.filter(r => r.status === 'completed').length },
    { name: 'Failed', value: results.filter(r => r.status === 'failed').length },
    { name: 'Format Invalid', value: results.filter(r => r.status === 'format_invalid').length },
    { name: 'Skipped', value: results.filter(r => r.status === 'skipped_dependency').length }
  ].filter(s => s.value > 0);

  // Rollup by Task
  const taskRollups = Object.values(
    results.reduce((acc, result) => {
      const task = getTask(result.task_id);
      const economy = task ? getEconomy(task.economy_id) : null;
      const question = task ? getQuestion(task.question_id) : null;
      
      if (!acc[result.task_id]) {
        acc[result.task_id] = {
          task_id: result.task_id,
          economy_name: economy?.name || 'Unknown',
          question_text: question?.question_text || 'Unknown',
          runs: 0,
          tokens_in: 0,
          tokens_out: 0,
          cost: 0
        };
      }
      acc[result.task_id].runs++;
      acc[result.task_id].tokens_in += result.tokens_in || 0;
      acc[result.task_id].tokens_out += result.tokens_out || 0;
      acc[result.task_id].cost += result.cost_estimate || 0;
      return acc;
    }, {})
  );

  // Rollup by Economy
  const economyRollups = Object.values(
    results.reduce((acc, result) => {
      const task = getTask(result.task_id);
      const economy = task ? getEconomy(task.economy_id) : null;
      const economyName = economy?.name || 'Unknown';
      
      if (!acc[economyName]) {
        acc[economyName] = {
          economy_name: economyName,
          runs: 0,
          tokens_in: 0,
          tokens_out: 0,
          cost: 0
        };
      }
      acc[economyName].runs++;
      acc[economyName].tokens_in += result.tokens_in || 0;
      acc[economyName].tokens_out += result.tokens_out || 0;
      acc[economyName].cost += result.cost_estimate || 0;
      return acc;
    }, {})
  );

  // Rollup by Question
  const questionRollups = Object.values(
    results.reduce((acc, result) => {
      const task = getTask(result.task_id);
      const question = task ? getQuestion(task.question_id) : null;
      const questionCode = question?.question_code || 'Unknown';
      
      if (!acc[questionCode]) {
        acc[questionCode] = {
          question_code: questionCode,
          question_text: question?.question_text || 'Unknown',
          runs: 0,
          tokens_in: 0,
          tokens_out: 0,
          cost: 0
        };
      }
      acc[questionCode].runs++;
      acc[questionCode].tokens_in += result.tokens_in || 0;
      acc[questionCode].tokens_out += result.tokens_out || 0;
      acc[questionCode].cost += result.cost_estimate || 0;
      return acc;
    }, {})
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">AI Usage</h1>
        <p className="text-slate-500 mt-1">Analytics and cost tracking for AI operations</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                <Brain className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{results.length}</p>
                <p className="text-sm text-slate-500">Total Runs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{successRate}%</p>
                <p className="text-sm text-slate-500">Success Rate</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-100 flex items-center justify-center">
                <Zap className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{((totalTokensIn + totalTokensOut) / 1000).toFixed(1)}k</p>
                <p className="text-sm text-slate-500">Total Tokens</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
                <p className="text-sm text-slate-500">Est. Total Cost</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Usage by Model */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Usage by Model</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : modelUsage.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={modelUsage}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="runs" fill="#002244" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : statusData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500">
                No data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={activeView} onValueChange={setActiveView}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="by_task">By Task</TabsTrigger>
          <TabsTrigger value="by_economy">By Economy</TabsTrigger>
          <TabsTrigger value="by_question">By Question</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Recent AI Results</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Model</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Tokens (In/Out)</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Cost</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.slice(0, 20).map(result => {
                      const model = getModel(result.model_id);
                      const provider = getProvider(result.provider_id);

                      return (
                        <TableRow key={result.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium text-sm">{model?.display_name || 'Unknown'}</p>
                              <p className="text-xs text-slate-500">{provider?.name}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              result.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                              result.status === 'failed' ? 'bg-red-100 text-red-700' :
                              result.status === 'format_invalid' ? 'bg-amber-100 text-amber-700' :
                              'bg-slate-100 text-slate-700'
                            }>
                              {result.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {result.tokens_in || 0} / {result.tokens_out || 0}
                          </TableCell>
                          <TableCell className="text-sm">
                            {result.duration_ms ? `${(result.duration_ms / 1000).toFixed(1)}s` : '-'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {result.cost_estimate !== null && result.cost_estimate !== undefined ? `$${result.cost_estimate.toFixed(4)}` : 
                              (result.tokens_in && result.tokens_out && model?.pricing_json?.input && model?.pricing_json?.output) ?
                              `$${((result.tokens_in * model.pricing_json.input / 1000000) + (result.tokens_out * model.pricing_json.output / 1000000)).toFixed(4)}` : 
                              '-'}
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {result.created_date ? format(new Date(result.created_date), 'MMM d, HH:mm') : '-'}
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

        <TabsContent value="by_task" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Task</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Economy</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Tokens In</TableHead>
                    <TableHead>Tokens Out</TableHead>
                    <TableHead>Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {taskRollups.slice(0, 50).map((rollup, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{rollup.economy_name}</TableCell>
                      <TableCell className="max-w-xs truncate">{rollup.question_text}</TableCell>
                      <TableCell>{rollup.runs}</TableCell>
                      <TableCell className="font-mono text-sm">{rollup.tokens_in.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{rollup.tokens_out.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">${rollup.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by_economy" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Economy</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Economy</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Tokens In</TableHead>
                    <TableHead>Tokens Out</TableHead>
                    <TableHead>Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {economyRollups.slice(0, 50).map((rollup, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{rollup.economy_name}</TableCell>
                      <TableCell>{rollup.runs}</TableCell>
                      <TableCell className="font-mono text-sm">{rollup.tokens_in.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{rollup.tokens_out.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">${rollup.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="by_question" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Usage by Question</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Question Code</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Tokens In</TableHead>
                    <TableHead>Tokens Out</TableHead>
                    <TableHead>Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {questionRollups.slice(0, 50).map((rollup, idx) => (
                    <TableRow key={idx}>
                      <TableCell><Badge variant="outline">{rollup.question_code}</Badge></TableCell>
                      <TableCell className="max-w-xs truncate">{rollup.question_text}</TableCell>
                      <TableCell>{rollup.runs}</TableCell>
                      <TableCell className="font-mono text-sm">{rollup.tokens_in.toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-sm">{rollup.tokens_out.toLocaleString()}</TableCell>
                      <TableCell className="font-medium">${rollup.cost.toFixed(4)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}