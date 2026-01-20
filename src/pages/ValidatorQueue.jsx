import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
  Search,
  CheckSquare,
  AlertCircle,
  ChevronRight,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';

export default function ValidatorQueue() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [economies, setEconomies] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [batches, setBatches] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [economyFilter, setEconomyFilter] = useState('all');
  const [indicatorFilter, setIndicatorFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [tasksData, economiesData, questionsData, groupsData, indicatorsData, batchesData] = await Promise.all([
        base44.entities.Task.filter({ status: 'submitted' }),
        base44.entities.Economy.list(),
        base44.entities.Question.list(),
        base44.entities.QuestionGroup.list(),
        base44.entities.Indicator.list(),
        base44.entities.Batch.list()
      ]);

      setTasks(tasksData);
      setEconomies(economiesData);
      setQuestions(questionsData);
      setGroups(groupsData);
      setIndicators(indicatorsData);
      setBatches(batchesData);
    } catch (error) {
      console.error('Failed to load queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEconomy = (id) => economies.find(e => e.id === id);
  const getQuestion = (id) => questions.find(q => q.id === id);
  const getGroup = (id) => groups.find(g => g.id === id);
  const getIndicator = (id) => indicators.find(i => i.id === id);
  const getBatch = (id) => batches.find(b => b.id === id);

  const filteredTasks = tasks.filter(task => {
    const economy = getEconomy(task.economy_id);
    const question = getQuestion(task.question_id);
    const group = question ? getGroup(question.group_id) : null;
    const indicator = group ? getIndicator(group.indicator_id) : null;

    const matchesSearch = 
      economy?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question?.question_code?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEconomy = economyFilter === 'all' || task.economy_id === economyFilter;
    const matchesIndicator = indicatorFilter === 'all' || indicator?.id === indicatorFilter;
    const matchesBatch = batchFilter === 'all' || task.batch_id === batchFilter;

    return matchesSearch && matchesEconomy && matchesIndicator && matchesBatch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Validator Queue</h1>
        <p className="text-slate-500 mt-1">Review and validate submitted tasks</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-amber-100 flex items-center justify-center">
              <CheckSquare className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tasks.length}</p>
              <p className="text-sm text-slate-500">Awaiting Review</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {filteredTasks.filter(t => {
                  // Check for NoMatch would require draft data
                  return false;
                }).length}
              </p>
              <p className="text-sm text-slate-500">NoMatch Items</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
              <CheckSquare className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{batches.filter(b => b.status === 'active').length}</p>
              <p className="text-sm text-slate-500">Active Batches</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={economyFilter} onValueChange={setEconomyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Economy" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Economies</SelectItem>
                {economies.slice(0, 50).map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={indicatorFilter} onValueChange={setIndicatorFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Indicator" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Indicators</SelectItem>
                {indicators.map(i => (
                  <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={batchFilter} onValueChange={setBatchFilter}>
              <SelectTrigger>
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

      {/* Queue Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-12 text-center">
              <CheckSquare className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Queue is empty</h3>
              <p className="text-slate-500">
                No tasks awaiting validation
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Economy</TableHead>
                  <TableHead>Question</TableHead>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Batch</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map(task => {
                  const economy = getEconomy(task.economy_id);
                  const question = getQuestion(task.question_id);
                  const group = question ? getGroup(question.group_id) : null;
                  const indicator = group ? getIndicator(group.indicator_id) : null;
                  const batch = getBatch(task.batch_id);

                  return (
                    <TableRow 
                      key={task.id} 
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => window.location.href = createPageUrl(`TaskDetail?id=${task.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-slate-900">{economy?.name || 'Unknown'}</p>
                          <p className="text-xs text-slate-500">{economy?.region}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xs">
                          <Badge variant="outline" className="mb-1">
                            {question?.question_code || 'Unknown'}
                          </Badge>
                          <p className="text-sm text-slate-600 truncate">
                            {question?.question_text}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{indicator?.name || '-'}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-slate-600">{batch?.name || '-'}</span>
                      </TableCell>
                      <TableCell className="text-slate-500 text-sm">
                        {task.updated_date ? format(new Date(task.updated_date), 'MMM d, HH:mm') : '-'}
                      </TableCell>
                      <TableCell>
                        <Link to={createPageUrl(`TaskDetail?id=${task.id}`)}>
                          <Button variant="ghost" size="icon">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      {!loading && filteredTasks.length > 0 && (
        <p className="text-sm text-slate-500">
          Showing {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''} awaiting validation
        </p>
      )}
    </div>
  );
}