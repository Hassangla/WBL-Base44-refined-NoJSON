import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  MoreHorizontal,
  Brain,
  Eye,
  Flag,
  User,
  X
} from 'lucide-react';
import { format } from 'date-fns';

const PAGE_SIZE = 50;

export default function Tasks() {
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [economies, setEconomies] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [batches, setBatches] = useState([]);
  const [user, setUser] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [economyFilter, setEconomyFilter] = useState('all');
  const [indicatorFilter, setIndicatorFilter] = useState('all');
  const [batchFilter, setBatchFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');
  const [flagFilter, setFlagFilter] = useState('all');
  const [matchFilter, setMatchFilter] = useState('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);

  // Selection
  const [selectedTasks, setSelectedTasks] = useState([]);

  // URL params
  const urlParams = new URLSearchParams(window.location.search);
  const initialBatchId = urlParams.get('batch_id');

  useEffect(() => {
    if (initialBatchId) {
      setBatchFilter(initialBatchId);
    }
    loadData();
    
    // Refetch every 15 seconds to show live updates
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [userData, tasksData, economiesData, questionsData, groupsData, indicatorsData, batchesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Task.list('-updated_date', 500),
        base44.entities.Economy.list(),
        base44.entities.Question.list(),
        base44.entities.QuestionGroup.list(),
        base44.entities.Indicator.list(),
        base44.entities.Batch.list()
      ]);

      setUser(userData);
      setTasks(tasksData);
      setEconomies(economiesData);
      setQuestions(questionsData);
      setGroups(groupsData);
      setIndicators(indicatorsData);
      setBatches(batchesData);
    } catch (error) {
      console.error('Failed to load tasks:', error);
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
      question?.question_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      question?.question_text?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    const matchesEconomy = economyFilter === 'all' || task.economy_id === economyFilter;
    const matchesIndicator = indicatorFilter === 'all' || indicator?.id === indicatorFilter;
    const matchesBatch = batchFilter === 'all' || task.batch_id === batchFilter;
    const matchesAssignee = assigneeFilter === 'all' || 
      (assigneeFilter === 'mine' && (task.current_researcher_id === user?.id || task.current_validator_id === user?.id)) ||
      task.current_researcher_id === assigneeFilter;

    return matchesSearch && matchesStatus && matchesEconomy && matchesIndicator && matchesBatch && matchesAssignee;
  });

  const totalPages = Math.ceil(filteredTasks.length / PAGE_SIZE);
  const paginatedTasks = filteredTasks.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const statusColors = {
    not_started: 'bg-slate-100 text-slate-700',
    in_progress: 'bg-blue-100 text-blue-700',
    submitted: 'bg-amber-100 text-amber-700',
    returned: 'bg-red-100 text-red-700',
    validated: 'bg-emerald-100 text-emerald-700'
  };

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setEconomyFilter('all');
    setIndicatorFilter('all');
    setBatchFilter('all');
    setAssigneeFilter('all');
    setFlagFilter('all');
    setMatchFilter('all');
    setCurrentPage(1);
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    economyFilter !== 'all',
    indicatorFilter !== 'all',
    batchFilter !== 'all',
    assigneeFilter !== 'all',
    flagFilter !== 'all',
    matchFilter !== 'all'
  ].filter(Boolean).length;

  const toggleTaskSelection = (taskId) => {
    setSelectedTasks(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };

  const selectAllVisible = () => {
    setSelectedTasks(paginatedTasks.map(t => t.id));
  };

  const clearSelection = () => {
    setSelectedTasks([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Tasks</h1>
          <p className="text-slate-500 mt-1">Manage research tasks across all batches</p>
        </div>
        {selectedTasks.length > 0 && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{selectedTasks.length} selected</Badge>
            <Button variant="outline" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button size="sm" className="bg-[#002244]">
              <Brain className="h-4 w-4 mr-2" />
              Run AI for Selected
            </Button>
          </div>
        )}
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={assigneeFilter === 'mine' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAssigneeFilter(assigneeFilter === 'mine' ? 'all' : 'mine')}
          className={assigneeFilter === 'mine' ? 'bg-[#002244]' : ''}
        >
          <User className="h-4 w-4 mr-2" />
          My Tasks
        </Button>
        <Button
          variant={statusFilter === 'in_progress' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === 'in_progress' ? 'all' : 'in_progress')}
          className={statusFilter === 'in_progress' ? 'bg-blue-600' : ''}
        >
          In Progress
        </Button>
        <Button
          variant={statusFilter === 'submitted' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === 'submitted' ? 'all' : 'submitted')}
          className={statusFilter === 'submitted' ? 'bg-amber-600' : ''}
        >
          Awaiting Validation
        </Button>
        <Button
          variant={statusFilter === 'returned' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter(statusFilter === 'returned' ? 'all' : 'returned')}
          className={statusFilter === 'returned' ? 'bg-red-600' : ''}
        >
          Returned
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="pl-9"
              />
            </div>

            <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setCurrentPage(1); }}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="not_started">Not Started</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="returned">Returned</SelectItem>
                <SelectItem value="validated">Validated</SelectItem>
              </SelectContent>
            </Select>

            <Select value={economyFilter} onValueChange={(v) => { setEconomyFilter(v); setCurrentPage(1); }}>
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

            <Select value={batchFilter} onValueChange={(v) => { setBatchFilter(v); setCurrentPage(1); }}>
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

          {activeFilterCount > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <Badge variant="secondary">
                <Filter className="h-3 w-3 mr-1" />
                {activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active
              </Badge>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tasks Table */}
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
              <ListTodo className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No tasks found</h3>
              <p className="text-slate-500">
                {activeFilterCount > 0 ? 'Try adjusting your filters' : 'Create a batch to generate tasks'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectedTasks.length === paginatedTasks.length && paginatedTasks.length > 0}
                        onCheckedChange={(checked) => checked ? selectAllVisible() : clearSelection()}
                      />
                    </TableHead>
                    <TableHead>Economy</TableHead>
                    <TableHead>Question</TableHead>
                    <TableHead>Indicator</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Match</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTasks.map(task => {
                    const economy = getEconomy(task.economy_id);
                    const question = getQuestion(task.question_id);
                    const group = question ? getGroup(question.group_id) : null;
                    const indicator = group ? getIndicator(group.indicator_id) : null;

                    return (
                      <TableRow 
                        key={task.id} 
                        className="cursor-pointer hover:bg-slate-50"
                        onClick={() => window.location.href = createPageUrl(`TaskDetail?id=${task.id}`)}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedTasks.includes(task.id)}
                            onCheckedChange={() => toggleTaskSelection(task.id)}
                          />
                        </TableCell>
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
                          <Badge className={statusColors[task.status]}>
                            {task.status?.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            task.dependency_status === 'locked' ? 'bg-slate-100' : ''
                          }>
                            {task.dependency_status === 'locked' ? 'N/A' : 'Unknown'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {task.updated_date ? format(new Date(task.updated_date), 'MMM d, HH:mm') : '-'}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link to={createPageUrl(`TaskDetail?id=${task.id}`)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Brain className="h-4 w-4 mr-2" />
                                Run AI
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, filteredTasks.length)} of {filteredTasks.length} tasks
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}