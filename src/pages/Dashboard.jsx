import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
  ArrowRight,
  Plus,
  TrendingUp,
  Globe,
  FileQuestion
} from 'lucide-react';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({
    totalBatches: 0,
    activeBatches: 0,
    totalTasks: 0,
    notStarted: 0,
    inProgress: 0,
    submitted: 0,
    validated: 0,
    returned: 0,
    myTasks: 0,
    economies: 0,
    questions: 0
  });
  const [recentBatches, setRecentBatches] = useState([]);
  const [myRecentTasks, setMyRecentTasks] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);

      const [batches, tasks, economies, questions] = await Promise.all([
        base44.entities.Batch.list('-created_date', 100),
        base44.entities.Task.list('-updated_date', 500),
        base44.entities.Economy.filter({ is_active: true }),
        base44.entities.Question.filter({ is_active: true })
      ]);

      const activeBatches = batches.filter(b => b.status === 'active');
      const myTasks = tasks.filter(t => 
        t.current_researcher_id === userData.id || 
        t.current_validator_id === userData.id
      );

      setStats({
        totalBatches: batches.length,
        activeBatches: activeBatches.length,
        totalTasks: tasks.length,
        notStarted: tasks.filter(t => t.status === 'not_started').length,
        inProgress: tasks.filter(t => t.status === 'in_progress').length,
        submitted: tasks.filter(t => t.status === 'submitted').length,
        validated: tasks.filter(t => t.status === 'validated').length,
        returned: tasks.filter(t => t.status === 'returned').length,
        myTasks: myTasks.length,
        economies: economies.length,
        questions: questions.length
      });

      setRecentBatches(batches.slice(0, 5));
      setMyRecentTasks(myTasks.slice(0, 5));
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, trend, subtitle }) => (
    <Card className="relative overflow-hidden hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">{title}</p>
            <p className="text-3xl font-bold text-slate-900 mt-1">
              {loading ? <Skeleton className="h-9 w-16" /> : value.toLocaleString()}
            </p>
            {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
          </div>
          <div className={`p-3 rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
        {trend && (
          <div className="flex items-center mt-3 text-sm text-emerald-600">
            <TrendingUp className="h-4 w-4 mr-1" />
            {trend}
          </div>
        )}
      </CardContent>
    </Card>
  );

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

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
            Welcome back{user ? `, ${user.full_name?.split(' ')[0]}` : ''}
          </h1>
          <p className="text-slate-500 mt-1">
            Here's an overview of your WBL research activities
          </p>
        </div>
        <Link to={createPageUrl('BatchWizard')}>
          <Button className="bg-[#002244] hover:bg-[#003366]">
            <Plus className="h-4 w-4 mr-2" />
            New Research Batch
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Batches"
          value={stats.activeBatches}
          icon={FolderKanban}
          color="bg-[#002244]"
          subtitle={`${stats.totalBatches} total`}
        />
        <StatCard
          title="Total Tasks"
          value={stats.totalTasks}
          icon={ListTodo}
          color="bg-[#0066B3]"
        />
        <StatCard
          title="Validated"
          value={stats.validated}
          icon={CheckCircle2}
          color="bg-emerald-500"
        />
        <StatCard
          title="My Assigned Tasks"
          value={stats.myTasks}
          icon={Clock}
          color="bg-[#F7941D]"
        />
      </div>

      {/* Task Status Breakdown */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Task Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { label: 'Not Started', value: stats.notStarted, color: 'bg-slate-500' },
              { label: 'In Progress', value: stats.inProgress, color: 'bg-blue-500' },
              { label: 'Submitted', value: stats.submitted, color: 'bg-amber-500' },
              { label: 'Returned', value: stats.returned, color: 'bg-red-500' },
              { label: 'Validated', value: stats.validated, color: 'bg-emerald-500' },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 rounded-lg bg-slate-50">
                <div className={`h-2 w-full rounded-full ${item.color} mb-3`} />
                <p className="text-2xl font-bold text-slate-900">
                  {loading ? <Skeleton className="h-8 w-12 mx-auto" /> : item.value}
                </p>
                <p className="text-sm text-slate-500">{item.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Batches */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">Recent Batches</CardTitle>
            <Link to={createPageUrl('Batches')}>
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : recentBatches.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <FolderKanban className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No batches created yet</p>
                <Link to={createPageUrl('BatchWizard')}>
                  <Button variant="link" className="mt-2">Create your first batch</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {recentBatches.map(batch => (
                  <Link 
                    key={batch.id} 
                    to={createPageUrl(`BatchDetail?id=${batch.id}`)}
                    className="block"
                  >
                    <div className="p-4 rounded-lg border hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-slate-900">{batch.name}</p>
                          <p className="text-sm text-slate-500">
                            Year {batch.reporting_year} • {batch.economy_ids?.length || 0} economies
                          </p>
                        </div>
                        <Badge className={batchStatusColors[batch.status]}>
                          {batch.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Recent Tasks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-lg">My Recent Tasks</CardTitle>
            <Link to={createPageUrl('Tasks')}>
              <Button variant="ghost" size="sm">
                View all <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : myRecentTasks.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <ListTodo className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No tasks assigned to you</p>
              </div>
            ) : (
              <div className="space-y-3">
                {myRecentTasks.map(task => (
                  <Link 
                    key={task.id} 
                    to={createPageUrl(`TaskDetail?id=${task.id}`)}
                    className="block"
                  >
                    <div className="p-4 rounded-lg border hover:border-blue-200 hover:bg-blue-50/50 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-slate-900 truncate">
                            Task #{task.id?.slice(-6)}
                          </p>
                          <p className="text-sm text-slate-500 truncate">
                            Economy ID: {task.economy_id?.slice(-6)}
                          </p>
                        </div>
                        <Badge className={statusColors[task.status]}>
                          {task.status?.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-lg bg-slate-100 text-center">
          <Globe className="h-6 w-6 mx-auto mb-2 text-slate-600" />
          <p className="text-xl font-bold text-slate-900">{stats.economies}</p>
          <p className="text-sm text-slate-500">Economies</p>
        </div>
        <div className="p-4 rounded-lg bg-slate-100 text-center">
          <FileQuestion className="h-6 w-6 mx-auto mb-2 text-slate-600" />
          <p className="text-xl font-bold text-slate-900">{stats.questions}</p>
          <p className="text-sm text-slate-500">Questions</p>
        </div>
        <div className="p-4 rounded-lg bg-amber-50 text-center">
          <AlertCircle className="h-6 w-6 mx-auto mb-2 text-amber-600" />
          <p className="text-xl font-bold text-amber-900">{stats.submitted}</p>
          <p className="text-sm text-amber-700">Awaiting Validation</p>
        </div>
        <div className="p-4 rounded-lg bg-red-50 text-center">
          <Clock className="h-6 w-6 mx-auto mb-2 text-red-600" />
          <p className="text-xl font-bold text-red-900">{stats.returned}</p>
          <p className="text-sm text-red-700">Returned</p>
        </div>
      </div>
    </div>
  );
}