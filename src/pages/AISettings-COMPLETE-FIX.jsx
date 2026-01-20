import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Cpu,
  Plus,
  Edit,
  Trash2,
  Key,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe
} from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function AISettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);

  // Provider dialog
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [isEditingExistingProvider, setIsEditingExistingProvider] = useState(false);
  const [providerForm, setProviderForm] = useState({
    name: '',
    provider_type: 'openai',
    api_key: '',
    is_enabled: true,
    concurrency_limit: 5
  });

  // Model dialog
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState(null);
  const [modelForm, setModelForm] = useState({
    provider_id: '',
    model_id: '',
    display_name: '',
    is_enabled: true,
    supports_web_tooling: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [providersData, modelsData] = await Promise.all([
        base44.entities.AIProvider.list(),
        base44.entities.AIModel.list()
      ]);

      setProviders(providersData);
      setModels(modelsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getProvider = (id) => providers.find(p => p.id === id);

  const handleOpenProviderDialog = (provider = null) => {
    setEditingProvider(provider);
    setIsEditingExistingProvider(!!provider);
    setProviderForm(provider ? {
      name: provider.name || '',
      provider_type: provider.provider_type || 'openai',
      api_key: '', // Always start empty when editing for security - backend doesn't return API keys
      is_enabled: provider.is_enabled !== false,
      concurrency_limit: provider.concurrency_limit || 5
    } : {
      name: '',
      provider_type: 'openai',
      api_key: '',
      is_enabled: true,
      concurrency_limit: 5
    });
    setProviderDialogOpen(true);
  };

  const handleSaveProvider = async () => {
    if (!providerForm.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' });
      return;
    }

    // Only require API key for new providers OR if user is updating it
    if (!editingProvider && !providerForm.api_key.trim()) {
      toast({ title: 'Error', description: 'API key is required for new providers', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      // Prepare data - only include api_key if it's been entered
      const dataToSave = { ...providerForm };
      if (editingProvider && !providerForm.api_key.trim()) {
        // If editing and no new API key entered, don't include it (keep existing)
        delete dataToSave.api_key;
      }

      if (editingProvider) {
        await base44.entities.AIProvider.update(editingProvider.id, dataToSave);
        // Don't update local state with api_key - backend won't return it anyway
        const { api_key, ...updateData } = dataToSave;
        setProviders(providers.map(p => p.id === editingProvider.id ? { 
          ...p, 
          ...updateData
        } : p));
        toast({ title: 'Updated', description: 'Provider updated successfully' });
      } else {
        const newProvider = await base44.entities.AIProvider.create(dataToSave);
        setProviders([...providers, newProvider]);
        toast({ title: 'Created', description: 'Provider created successfully' });
      }
      setProviderDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast({ title: 'Error', description: 'Failed to save provider', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenModelDialog = (model = null) => {
    setEditingModel(model);
    setModelForm(model ? {
      provider_id: model.provider_id || '',
      model_id: model.model_id || '',
      display_name: model.display_name || '',
      is_enabled: model.is_enabled !== false,
      supports_web_tooling: model.supports_web_tooling || false
    } : {
      provider_id: providers[0]?.id || '',
      model_id: '',
      display_name: '',
      is_enabled: true,
      supports_web_tooling: false
    });
    setModelDialogOpen(true);
  };

  const handleSaveModel = async () => {
    if (!modelForm.model_id.trim() || !modelForm.display_name.trim()) {
      toast({ title: 'Error', description: 'Model ID and name are required', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      if (editingModel) {
        await base44.entities.AIModel.update(editingModel.id, modelForm);
        setModels(models.map(m => m.id === editingModel.id ? { ...m, ...modelForm } : m));
        toast({ title: 'Updated', description: 'Model updated successfully' });
      } else {
        const newModel = await base44.entities.AIModel.create(modelForm);
        setModels([...models, newModel]);
        toast({ title: 'Created', description: 'Model created successfully' });
      }
      setModelDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast({ title: 'Error', description: 'Failed to save model', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProvider = async (provider) => {
    if (!confirm('Delete this provider and all its models?')) return;
    try {
      // Delete associated models first
      const providerModels = models.filter(m => m.provider_id === provider.id);
      for (const model of providerModels) {
        await base44.entities.AIModel.delete(model.id);
      }
      await base44.entities.AIProvider.delete(provider.id);
      setProviders(providers.filter(p => p.id !== provider.id));
      setModels(models.filter(m => m.provider_id !== provider.id));
      toast({ title: 'Deleted', description: 'Provider deleted successfully' });
    } catch (error) {
      console.error('Failed to delete:', error);
      toast({ title: 'Error', description: 'Failed to delete provider', variant: 'destructive' });
    }
  };

  const handleDeleteModel = async (model) => {
    if (!confirm('Delete this model?')) return;
    try {
      await base44.entities.AIModel.delete(model.id);
      setModels(models.filter(m => m.id !== model.id));
      toast({ title: 'Deleted', description: 'Model deleted successfully' });
    } catch (error) {
      console.error('Failed to delete:', error);
      toast({ title: 'Error', description: 'Failed to delete model', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">AI Settings</h1>
        <p className="text-slate-500 mt-1">Configure AI providers and models</p>
      </div>

      <Tabs defaultValue="providers">
        <TabsList>
          <TabsTrigger value="providers">Providers ({providers.length})</TabsTrigger>
          <TabsTrigger value="models">Models ({models.length})</TabsTrigger>
          <TabsTrigger value="firecrawl">Firecrawl</TabsTrigger>
        </TabsList>

        <TabsContent value="providers" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenProviderDialog()} className="bg-[#002244] hover:bg-[#003366]">
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : providers.length === 0 ? (
                <div className="p-12 text-center">
                  <Cpu className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No providers configured</h3>
                  <p className="text-slate-500">Add an AI provider to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Provider</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Models</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Concurrency</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providers.map(provider => {
                      const providerModels = models.filter(m => m.provider_id === provider.id);
                      return (
                        <TableRow key={provider.id}>
                          <TableCell className="font-medium">{provider.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{provider.provider_type}</Badge>
                          </TableCell>
                          <TableCell>{providerModels.length}</TableCell>
                          <TableCell>
                            <Badge className={provider.is_enabled 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-700'
                            }>
                              {provider.is_enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell>{provider.concurrency_limit || 5}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenProviderDialog(provider)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteProvider(provider)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
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

        <TabsContent value="models" className="space-y-6 mt-6">
          <div className="flex justify-end">
            <Button onClick={() => handleOpenModelDialog()} disabled={providers.length === 0} className="bg-[#002244] hover:bg-[#003366]">
              <Plus className="h-4 w-4 mr-2" />
              Add Model
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : models.length === 0 ? (
                <div className="p-12 text-center">
                  <Cpu className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No models configured</h3>
                  <p className="text-slate-500">{providers.length === 0 ? 'Add a provider first' : 'Add models to your providers'}</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Model</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model ID</TableHead>
                      <TableHead>Web Tools</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {models.map(model => {
                      const provider = getProvider(model.provider_id);
                      return (
                        <TableRow key={model.id}>
                          <TableCell className="font-medium">{model.display_name}</TableCell>
                          <TableCell>{provider?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">{model.model_id}</code>
                          </TableCell>
                          <TableCell>
                            {model.supports_web_tooling ? (
                              <Badge className="bg-blue-100 text-blue-700">
                                <Globe className="h-3 w-3 mr-1" />
                                Yes
                              </Badge>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={model.is_enabled 
                              ? 'bg-emerald-100 text-emerald-700' 
                              : 'bg-slate-100 text-slate-700'
                            }>
                              {model.is_enabled ? 'Enabled' : 'Disabled'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => handleOpenModelDialog(model)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDeleteModel(model)}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
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

        <TabsContent value="firecrawl" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Firecrawl Configuration</CardTitle>
              <CardDescription>Configure Firecrawl for web content retrieval</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-sm">
                <p className="text-amber-800">
                  Firecrawl API key must be configured in the environment variables (secrets) section of your dashboard.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex items-center gap-2">
                  <Badge className="bg-slate-100 text-slate-700">Not Configured</Badge>
                  <span className="text-sm text-slate-500">Add FIRECRAWL_API_KEY in secrets</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Provider Dialog */}
      <Dialog open={providerDialogOpen} onOpenChange={setProviderDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="provider-name">Name *</Label>
              <Input
                id="provider-name"
                value={providerForm.name}
                onChange={(e) => setProviderForm({...providerForm, name: e.target.value})}
                placeholder="e.g., OpenAI"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-key">
                API Key {!isEditingExistingProvider && '*'}
                {isEditingExistingProvider && (
                  <span className="text-xs text-slate-500 font-normal ml-1">(leave blank to keep existing)</span>
                )}
              </Label>
              <Input
                id="api-key"
                type="password"
                value={providerForm.api_key}
                onChange={(e) => setProviderForm({...providerForm, api_key: e.target.value})}
                placeholder={isEditingExistingProvider ? "Enter new API key to update" : "Enter your API key"}
                autoComplete="off"
              />
              <p className="text-xs text-slate-500">
                {isEditingExistingProvider 
                  ? "API keys are stored securely and never displayed. Enter a new key only if you need to update it."
                  : "Your API key will be encrypted and stored securely"}
              </p>
            </div>
            <div className="space-y-2">
              <Label>Provider Type</Label>
              <Select 
                value={providerForm.provider_type} 
                onValueChange={(v) => setProviderForm({...providerForm, provider_type: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="concurrency">Concurrency Limit</Label>
              <Input
                id="concurrency"
                type="number"
                min="1"
                max="50"
                value={providerForm.concurrency_limit}
                onChange={(e) => setProviderForm({...providerForm, concurrency_limit: parseInt(e.target.value) || 5})}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={providerForm.is_enabled} 
                onCheckedChange={(checked) => setProviderForm({...providerForm, is_enabled: checked})}
              />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setProviderDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveProvider} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingProvider ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Model Dialog */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModel ? 'Edit Model' : 'Add Model'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provider</Label>
              <Select 
                value={modelForm.provider_id} 
                onValueChange={(v) => setModelForm({...modelForm, provider_id: v})}
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
            <div className="space-y-2">
              <Label htmlFor="model-id">Model ID *</Label>
              <Input
                id="model-id"
                value={modelForm.model_id}
                onChange={(e) => setModelForm({...modelForm, model_id: e.target.value})}
                placeholder="e.g., gpt-4o"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name *</Label>
              <Input
                id="display-name"
                value={modelForm.display_name}
                onChange={(e) => setModelForm({...modelForm, display_name: e.target.value})}
                placeholder="e.g., GPT-4o"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={modelForm.supports_web_tooling} 
                onCheckedChange={(checked) => setModelForm({...modelForm, supports_web_tooling: checked})}
              />
              <Label>Supports Web Tooling</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch 
                checked={modelForm.is_enabled} 
                onCheckedChange={(checked) => setModelForm({...modelForm, is_enabled: checked})}
              />
              <Label>Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModelDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveModel} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {editingModel ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}