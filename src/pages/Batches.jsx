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
  Plus,
  Search,
  Filter,
  Calendar,
  Users,
  Globe,
  ChevronRight,
  FolderKanban,
  MoreHorizontal,
  Trash2,
  Eye
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';

export default function Batches() {
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [user, setUser] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [userData, batchesData] = await Promise.all([
        base44.auth.me(),
        base44.entities.Batch.list('-created_date', 100)
      ]);
      setUser(userData);
      setBatches(batchesData);
    } catch (error) {
      console.error('Failed to load batches:', error);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = user?.role === 'admin';

  const filteredBatches = batches.filter(batch => {
    const matchesSearch = batch.name?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusColors = {
    creating: 'bg-amber-100 text-amber-700 border-amber-200',
    active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    archived: 'bg-slate-100 text-slate-700 border-slate-200',
    creation_failed: 'bg-red-100 text-red-700 border-red-200'
  };

  const handleDelete = async (batchId) => {
    if (!confirm('Are you sure you want to delete this batch? This will delete all associated tasks, responses, AI results, and exports. Type DELETE to confirm.')) {
      return;
    }
    try {
      await base44.entities.Batch.delete(batchId);
      setBatches(batches.filter(b => b.id !== batchId));
    } catch (error) {
      console.error('Failed to delete batch:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Research Batches</h1>
          <p className="text-slate-500 mt-1">Manage your WBL research batches</p>
        </div>
        <Link to={createPageUrl('BatchWizard')}>
          <Button className="bg-[#002244] hover:bg-[#003366]">
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search batches..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="creating">Creating</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
                <SelectItem value="creation_failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Batches Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredBatches.length === 0 ? (
            <div className="p-12 text-center">
              <FolderKanban className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">No batches found</h3>
              <p className="text-slate-500 mb-4">
                {searchTerm || statusFilter !== 'all' 
                  ? 'Try adjusting your filters'
                  : 'Create your first research batch to get started'}
              </p>
              {!searchTerm && statusFilter === 'all' && (
                <Link to={createPageUrl('BatchWizard')}>
                  <Button className="bg-[#002244] hover:bg-[#003366]">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Batch
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead>Batch Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Economies</TableHead>
                    <TableHead>Questions</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBatches.map(batch => (
                    <TableRow 
                      key={batch.id} 
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => window.location.href = createPageUrl(`BatchDetail?id=${batch.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-[#002244] flex items-center justify-center">
                            <FolderKanban className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{batch.name}</p>
                            <p className="text-sm text-slate-500">ID: {batch.id?.slice(-8)}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[batch.status]}>
                          {batch.status?.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-slate-400" />
                          <span>{batch.reporting_year || 2026}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-slate-400" />
                          <span>{batch.economy_ids?.length || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span>{batch.question_ids?.length || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-slate-500">
                          {batch.created_date ? format(new Date(batch.created_date), 'MMM d, yyyy') : '-'}
                        </span>
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
                              <Link to={createPageUrl(`BatchDetail?id=${batch.id}`)}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(batch.id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Batch
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Footer */}
      {!loading && filteredBatches.length > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {filteredBatches.length} batch{filteredBatches.length !== 1 ? 'es' : ''}</span>
          <span>
            {batches.filter(b => b.status === 'active').length} active • {' '}
            {batches.filter(b => b.status === 'archived').length} archived
          </span>
        </div>
      )}
    </div>
  );
}