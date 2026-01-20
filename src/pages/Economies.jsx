import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Globe,
  Plus,
  Search,
  Edit,
  Upload,
  Download,
  Loader2,
  Check,
  X,
  GitMerge
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function Economies() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deduping, setDeduping] = useState(false);
  const [user, setUser] = useState(null);
  
  const [economies, setEconomies] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  
  const [dedupeDialogOpen, setDedupeDialogOpen] = useState(false);
  const [dedupeReport, setDedupeReport] = useState(null);

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEconomy, setEditingEconomy] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    region: '',
    is_active: true
  });

  useEffect(() => {
    loadUser();
    loadData();
  }, []);

  const loadUser = async () => {
    try {
      const userData = await base44.auth.me();
      setUser(userData);
    } catch (error) {
      console.error('Failed to load user:', error);
    }
  };

  const loadData = async () => {
    try {
      const economiesData = await base44.entities.Economy.list();
      setEconomies(economiesData);
    } catch (error) {
      console.error('Failed to load economies:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEconomies = economies.filter(e => {
    const matchesSearch = 
      e.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.region?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showInactive || e.is_active !== false;
    return matchesSearch && matchesActive;
  });

  const handleOpenEdit = (economy = null) => {
    setEditingEconomy(economy);
    setFormData(economy ? {
      name: economy.name || '',
      code: economy.code || '',
      region: economy.region || '',
      is_active: economy.is_active !== false
    } : {
      name: '',
      code: '',
      region: '',
      is_active: true
    });
    setEditDialogOpen(true);
  };

  const normalizeName = (name) => {
    return name?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    // Check for duplicate name
    const normalizedNewName = normalizeName(formData.name);
    const existingEconomy = economies.find(e => 
      normalizeName(e.name) === normalizedNewName && 
      (!editingEconomy || e.id !== editingEconomy.id)
    );

    if (existingEconomy) {
      toast({ 
        title: 'Duplicate Economy', 
        description: `Economy "${existingEconomy.name}" already exists. Use edit instead.`, 
        variant: 'destructive' 
      });
      return;
    }

    setSaving(true);
    try {
      if (editingEconomy) {
        await base44.entities.Economy.update(editingEconomy.id, formData);
        setEconomies(economies.map(e => e.id === editingEconomy.id ? { ...e, ...formData } : e));
        toast({ title: 'Updated', description: 'Economy updated successfully' });
      } else {
        const newEconomy = await base44.entities.Economy.create(formData);
        setEconomies([...economies, newEconomy]);
        toast({ title: 'Created', description: 'Economy created successfully' });
      }
      setEditDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast({ title: 'Error', description: 'Failed to save economy', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (economy) => {
    try {
      await base44.entities.Economy.update(economy.id, { is_active: !economy.is_active });
      setEconomies(economies.map(e => e.id === economy.id ? { ...e, is_active: !e.is_active } : e));
      toast({ title: 'Updated', description: `Economy ${economy.is_active ? 'deactivated' : 'activated'}` });
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const handleDedupeRun = async (dryRun = false) => {
    setDeduping(true);
    try {
      const { data } = await base44.functions.invoke('dedupeEconomies', { dry_run: dryRun });
      setDedupeReport(data);
      
      if (!dryRun) {
        toast({ 
          title: 'Deduplication Complete', 
          description: `Deactivated ${data.totals.economies_deactivated} duplicates, updated ${data.totals.tasks_updated} tasks` 
        });
        await loadData(); // Reload economies
      } else {
        toast({ 
          title: 'Dry Run Complete', 
          description: 'Review the report to see what would happen' 
        });
      }
      
      setDedupeDialogOpen(true);
    } catch (error) {
      console.error('Deduplication failed:', error);
      toast({ title: 'Error', description: 'Failed to deduplicate economies', variant: 'destructive' });
    } finally {
      setDeduping(false);
    }
  };

  const isAdmin = user?.role === 'admin';
  const regions = [...new Set(economies.map(e => e.region).filter(Boolean))];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Economies</h1>
          <p className="text-slate-500 mt-1">Manage the list of 190 economies</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button 
              variant="outline" 
              onClick={() => handleDedupeRun(true)}
              disabled={deduping}
              className="border-orange-200 text-orange-700 hover:bg-orange-50"
            >
              {deduping ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <GitMerge className="h-4 w-4 mr-2" />}
              Deduplicate
            </Button>
          )}
          <Button variant="outline">
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => handleOpenEdit()} className="bg-[#002244] hover:bg-[#003366]">
            <Plus className="h-4 w-4 mr-2" />
            Add Economy
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
              <Globe className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{economies.filter(e => e.is_active !== false).length}</p>
              <p className="text-sm text-slate-500">Active Economies</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-slate-100 flex items-center justify-center">
              <Globe className="h-6 w-6 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{economies.filter(e => e.is_active === false).length}</p>
              <p className="text-sm text-slate-500">Inactive</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Globe className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{regions.length}</p>
              <p className="text-sm text-slate-500">Regions</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search economies..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={showInactive} 
                onCheckedChange={setShowInactive}
                id="show-inactive"
              />
              <Label htmlFor="show-inactive">Show inactive</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Economies Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Region</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEconomies.map(economy => (
                  <TableRow key={economy.id}>
                    <TableCell className="font-medium">{economy.name}</TableCell>
                    <TableCell>
                      {economy.code ? (
                        <Badge variant="outline">{economy.code}</Badge>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>{economy.region || '-'}</TableCell>
                    <TableCell>
                      <Badge className={economy.is_active !== false 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-100 text-slate-700'
                      }>
                        {economy.is_active !== false ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(economy)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => toggleActive(economy)}
                        >
                          {economy.is_active !== false ? (
                            <X className="h-4 w-4 text-red-500" />
                          ) : (
                            <Check className="h-4 w-4 text-emerald-500" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Summary */}
      <p className="text-sm text-slate-500">
        Showing {filteredEconomies.length} of {economies.length} economies
      </p>

      {/* Deduplication Report Dialog */}
      <Dialog open={dedupeDialogOpen} onOpenChange={setDedupeDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deduplication Report</DialogTitle>
            <DialogDescription>
              {dedupeReport?.dry_run ? 'Preview of changes (no data modified)' : 'Summary of deduplication results'}
            </DialogDescription>
          </DialogHeader>
          {dedupeReport && (
            <div className="space-y-4 py-4">
              {/* Totals */}
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Economies Deactivated</p>
                    <p className="text-2xl font-bold">{dedupeReport.totals.economies_deactivated}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Tasks Updated</p>
                    <p className="text-2xl font-bold">{dedupeReport.totals.tasks_updated}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Batches Updated</p>
                    <p className="text-2xl font-bold">{dedupeReport.totals.batches_updated}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <p className="text-sm text-slate-500">Conflicts</p>
                    <p className="text-2xl font-bold text-orange-600">{dedupeReport.totals.tasks_conflicts}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Groups */}
              {dedupeReport.groups.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">Duplicate Groups ({dedupeReport.groups_processed})</h3>
                  {dedupeReport.groups.map((group, idx) => (
                    <Card key={idx} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-4">
                        <div className="space-y-2">
                          <div>
                            <p className="font-semibold text-sm text-slate-700">Canonical:</p>
                            <p className="text-sm">
                              {group.canonical.name} ({group.canonical.region})
                            </p>
                          </div>
                          <div>
                            <p className="font-semibold text-sm text-slate-700">Duplicates merged:</p>
                            <ul className="text-sm text-slate-600 list-disc list-inside">
                              {group.duplicates.map((dup, i) => (
                                <li key={i}>{dup.name} ({dup.region})</li>
                              ))}
                            </ul>
                          </div>
                          <div className="text-xs text-slate-500">
                            Tasks updated: {group.tasks_updated} | Batches updated: {group.batches_updated}
                            {group.tasks_conflicts.length > 0 && (
                              <span className="text-orange-600"> | Conflicts: {group.tasks_conflicts.length}</span>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {dedupeReport.groups.length === 0 && (
                <p className="text-center text-slate-500 py-8">No duplicates found</p>
              )}
            </div>
          )}
          <DialogFooter>
            {dedupeReport?.dry_run && dedupeReport?.groups.length > 0 && (
              <Button 
                onClick={() => {
                  setDedupeDialogOpen(false);
                  handleDedupeRun(false);
                }}
                className="bg-[#002244] hover:bg-[#003366]"
              >
                Apply Changes
              </Button>
            )}
            <Button variant="outline" onClick={() => setDedupeDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingEconomy ? 'Edit Economy' : 'Add Economy'}</DialogTitle>
            <DialogDescription>
              {editingEconomy ? 'Update economy details' : 'Add a new economy to the system'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                placeholder="e.g., United States"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => setFormData({...formData, code: e.target.value})}
                placeholder="e.g., USA"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="region">Region</Label>
              <Input
                id="region"
                value={formData.region}
                onChange={(e) => setFormData({...formData, region: e.target.value})}
                placeholder="e.g., North America"
                list="regions"
              />
              <datalist id="regions">
                {regions.map(r => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={formData.is_active} 
                onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                id="is-active"
              />
              <Label htmlFor="is-active">Active</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingEconomy ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}