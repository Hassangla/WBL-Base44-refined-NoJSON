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
  Globe,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

export default function AISettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingHealth, setCheckingHealth] = useState(false);
  const [discoveringModels, setDiscoveringModels] = useState(false);
  const [refreshingProvider, setRefreshingProvider] = useState(null);
  const [editingPricing, setEditingPricing] = useState(null);
  
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);

  // Provider dialog
  const [providerDialogOpen, setProviderDialogOpen] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
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

  const isApiKeySet = (provider) => {
    const explicitFlag = provider?.config?.api_key_present === true || provider?.api_key_set === true;
    const hasKeyValue = !!provider?.config?.api_key || !!provider?.api_key;
    const healthImpliesKey = ['healthy', 'degraded'].includes(provider?.health_status);
    return explicitFlag || hasKeyValue || healthImpliesKey;
  };

  const handleOpenProviderDialog = (provider = null) => {
    setEditingProvider(provider);
    setProviderForm(provider ? {
      name: provider.name || '',
      provider_type: provider.provider_type || 'openai',
      api_key: provider.api_key || '',
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
      toast.error('Name is required');
      return;
    }

    const trimmedKey = providerForm.api_key.trim();
    if (!trimmedKey) {
      toast.error('API key is required');
      return;
    }

    setSaving(true);
    try {
      const dataToSave = {
        ...providerForm,
        config: { 
          ...(editingProvider?.config || {}), 
          api_key: trimmedKey, 
          api_key_present: true 
        },
        api_key_set: !!trimmedKey
      };
      
      let savedProvider;
      if (editingProvider) {
        await base44.entities.AIProvider.update(editingProvider.id, dataToSave);
        savedProvider = { ...editingProvider, ...dataToSave };
        toast.success('Provider updated successfully');
      } else {
        savedProvider = await base44.entities.AIProvider.create(dataToSave);
        toast.success('Provider created successfully');
      }

      // Auto-discover models
      setDiscoveringModels(true);
      try {
        const discoverResult = await base44.functions.invoke('discoverModels', { 
          provider_id: savedProvider.id 
        });
        
        if (discoverResult.data.success && discoverResult.data.new_models > 0) {
          toast.success(`Found ${discoverResult.data.new_models} new models`);
        }
      } catch (error) {
        console.error('Model discovery failed:', error);
      } finally {
        setDiscoveringModels(false);
      }

      await loadData();
      setProviderDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error(error.message || 'Failed to save provider');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckProviderHealth = async (providerId) => {
    setCheckingHealth(true);
    try {
      const result = await base44.functions.invoke('checkProviderHealth', { provider_id: providerId });
      await loadData();
      
      const providerResult = result.data.results[0];
      if (providerResult.status === 'healthy') {
        toast.success(`Healthy - Response time: ${providerResult.response_time_ms}ms`);
      } else {
        toast.error(providerResult.error);
      }
    } catch (error) {
      toast.error('Failed to check health');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleCheckModelHealth = async (modelId) => {
    setCheckingHealth(true);
    try {
      const result = await base44.functions.invoke('checkModelHealth', { model_id: modelId });
      await loadData();
      
      const modelResult = result.data.results[0];
      if (modelResult.status === 'healthy') {
        toast.success(`Healthy - Response time: ${modelResult.response_time_ms}ms`);
      } else {
        toast.error(modelResult.error);
      }
    } catch (error) {
      toast.error('Failed to check health');
    } finally {
      setCheckingHealth(false);
    }
  };

  const handleCheckAllHealth = async () => {
    setCheckingHealth(true);
    try {
      await Promise.all([
        base44.functions.invoke('checkProviderHealth', {}),
        base44.functions.invoke('checkModelHealth', {})
      ]);
      await loadData();
      toast.success('Health checks completed');
    } catch (error) {
      toast.error('Failed to check health');
    } finally {
      setCheckingHealth(false);
    }
  };

  const getHealthBadge = (status, lastCheck) => {
    const statusConfig = {
      healthy: { icon: CheckCircle, color: 'bg-emerald-100 text-emerald-700', label: 'Healthy' },
      degraded: { icon: AlertCircle, color: 'bg-yellow-100 text-yellow-700', label: 'Degraded' },
      unreachable: { icon: XCircle, color: 'bg-red-100 text-red-700', label: 'Unreachable' },
      unchecked: { icon: Clock, color: 'bg-slate-100 text-slate-700', label: 'Unchecked' }
    };

    const config = statusConfig[status] || statusConfig.unchecked;
    const Icon = config.icon;
    const timeAgo = lastCheck ? formatDistanceToNow(new Date(lastCheck), { addSuffix: true }) : null;

    return (
      <div className="flex flex-col gap-1">
        <Badge className={config.color}>
          <Icon className="h-3 w-3 mr-1" />
          {config.label}
        </Badge>
        {timeAgo && <span className="text-xs text-slate-500">{timeAgo}</span>}
      </div>
    );
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
      toast.error('Model ID and name are required');
      return;
    }

    setSaving(true);
    try {
      if (editingModel) {
        await base44.entities.AIModel.update(editingModel.id, modelForm);
        setModels(models.map(m => m.id === editingModel.id ? { ...m, ...modelForm } : m));
        toast.success('Model updated successfully');
      } else {
        const newModel = await base44.entities.AIModel.create(modelForm);
        setModels([...models, newModel]);
        toast.success('Model created successfully');
      }
      setModelDialogOpen(false);
    } catch (error) {
      console.error('Failed to save:', error);
      toast.error('Failed to save model');
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
      toast.success('Provider deleted successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete provider');
    }
  };

  const handleDeleteModel = async (model) => {
    if (!confirm('Delete this model?')) return;
    try {
      await base44.entities.AIModel.delete(model.id);
      setModels(models.filter(m => m.id !== model.id));
      toast.success('Model deleted successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete model');
    }
  };

  const handleRefreshModels = async (providerId) => {
    setRefreshingProvider(providerId);
    try {
      const result = await base44.functions.invoke('discoverModels', { provider_id: providerId });
      
      if (result.data.success) {
        await loadData();
        toast.success(`${result.data.discovered} models found, ${result.data.new_models} new`);
      } else {
        toast.error(result.data.error);
      }
    } catch (error) {
      toast.error('Failed to refresh models');
    } finally {
      setRefreshingProvider(null);
    }
  };

  const handleUpdatePricing = async (modelId, pricing) => {
    try {
      await base44.entities.AIModel.update(modelId, { pricing_json: pricing });
      await loadData();
      toast.success('Pricing updated successfully');
      setEditingPricing(null);
    } catch (error) {
      toast.error('Failed to update pricing');
    }
  };

  const handleCheckAllModelsHealth = async () => {
    setCheckingHealth(true);
    try {
      const result = await base44.functions.invoke('checkModelHealth', {});
      if (result?.data?.success) {
        await loadData();
        toast.success('Model health checks completed');
      } else {
        toast.error(result?.data?.error || 'Health check failed');
      }
    } catch (error) {
      console.error('Health check error:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to check model health');
    }
    setCheckingHealth(false);
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
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handleCheckAllHealth} disabled={checkingHealth}>
              <Activity className="h-4 w-4 mr-2" />
              {checkingHealth ? 'Checking...' : 'Check All Health'}
            </Button>
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
                    <TableHead>API Key</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead>Models</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Concurrency</TableHead>
                    <TableHead className="w-32">Actions</TableHead>
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
                        <TableCell>
                          {isApiKeySet(provider) ? (
                            <span className="text-xs text-slate-500 font-mono">Set</span>
                          ) : (
                            <span className="text-xs text-red-500">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getHealthBadge(provider.health_status, provider.last_health_check)}
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
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleRefreshModels(provider.id)}
                              disabled={refreshingProvider === provider.id}
                              title="Refresh models"
                            >
                              <RefreshCw className={`h-4 w-4 ${refreshingProvider === provider.id ? 'animate-spin' : ''}`} />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleCheckProviderHealth(provider.id)}
                              disabled={checkingHealth}
                              title="Check health"
                            >
                              <Activity className="h-4 w-4" />
                            </Button>
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
          <div className="flex justify-between items-center">
            <Button variant="outline" onClick={handleCheckAllModelsHealth} disabled={checkingHealth}>
              <Activity className="h-4 w-4 mr-2" />
              {checkingHealth ? 'Checking...' : 'Check All Models Health'}
            </Button>
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
                      <TableHead>Pricing ($/1M tokens)</TableHead>
                      <TableHead>Health</TableHead>
                      <TableHead>Web Tools</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-32">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...models].sort((a, b) => {
                      const healthRank = { healthy: 0, degraded: 1, unchecked: 2, unreachable: 3 };
                      const aRank = healthRank[a.health_status] ?? 2;
                      const bRank = healthRank[b.health_status] ?? 2;
                      if (aRank !== bRank) return aRank - bRank;
                      const aProvider = getProvider(a.provider_id);
                      const bProvider = getProvider(b.provider_id);
                      const providerComp = (aProvider?.name || '').localeCompare(bProvider?.name || '');
                      if (providerComp !== 0) return providerComp;
                      return (a.display_name || '').localeCompare(b.display_name || '');
                    }).map(model => {
                      const provider = getProvider(model.provider_id);
                      return (
                        <TableRow key={model.id}>
                          <TableCell className="font-medium">{model.display_name}</TableCell>
                          <TableCell>{provider?.name || 'Unknown'}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded">{model.model_id}</code>
                          </TableCell>
                          <TableCell>
                            {editingPricing?.id === model.id ? (
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="In"
                                  className="w-16 h-7 text-xs"
                                  defaultValue={model.pricing_json?.input || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setEditingPricing({ ...editingPricing, input: val });
                                  }}
                                />
                                <span className="text-xs text-slate-500">/</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="Out"
                                  className="w-16 h-7 text-xs"
                                  defaultValue={model.pricing_json?.output || ''}
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    setEditingPricing({ ...editingPricing, output: val });
                                  }}
                                />
                                <Button
                                  size="sm"
                                  className="h-7"
                                  onClick={() => handleUpdatePricing(model.id, { 
                                    input: editingPricing.input ?? model.pricing_json?.input ?? 0, 
                                    output: editingPricing.output ?? model.pricing_json?.output ?? 0 
                                  })}
                                >
                                  Save
                                </Button>
                              </div>
                            ) : (
                              <div 
                                className="cursor-pointer hover:bg-slate-50 rounded px-2 py-1"
                                onClick={() => setEditingPricing({ id: model.id, input: model.pricing_json?.input, output: model.pricing_json?.output })}
                              >
                                {model.pricing_json?.input !== undefined && model.pricing_json?.output !== undefined ? (
                                  <span className="text-xs">
                                    In: ${model.pricing_json.input.toFixed(2)} / Out: ${model.pricing_json.output.toFixed(2)}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-400">Click to set</span>
                                )}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {getHealthBadge(model.health_status, model.last_health_check)}
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
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                onClick={() => handleCheckModelHealth(model.id)}
                                disabled={checkingHealth}
                              >
                                <Activity className="h-4 w-4" />
                              </Button>
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
          {(() => {
            const fcProvider = providers.find(p => 
              p.provider_type === 'firecrawl' || 
              (p.name && p.name.toLowerCase().includes('firecrawl'))
            );
            const isConfigured = fcProvider && 
              (fcProvider.config?.api_key_present === true || fcProvider.api_key_set || !!fcProvider.config?.api_key);

            return (
              <Card>
                <CardHeader>
                  <CardTitle>Firecrawl Configuration</CardTitle>
                  <CardDescription>Configure Firecrawl for web content retrieval</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <div className="flex items-center gap-2">
                      <Badge className={isConfigured ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}>
                        {isConfigured ? 'Configured' : 'Not Configured'}
                      </Badge>
                      {!isConfigured && (
                        <span className="text-sm text-slate-500">Add a Firecrawl provider below</span>
                      )}
                    </div>
                  </div>

                  {!fcProvider && (
                    <Button 
                      onClick={() => {
                        setProviderForm({
                          name: 'Firecrawl',
                          provider_type: 'firecrawl',
                          api_key: '',
                          is_enabled: true,
                          concurrency_limit: 5
                        });
                        setEditingProvider(null);
                        setProviderDialogOpen(true);
                      }}
                      className="bg-[#002244] hover:bg-[#003366]"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Firecrawl Provider
                    </Button>
                  )}

                  {fcProvider && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <Label>API Key</Label>
                        <span className="text-xs text-slate-500 font-mono">••••••••</span>
                      </div>
                      <Button 
                        variant="outline"
                        onClick={() => handleOpenProviderDialog(fcProvider)}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Firecrawl Settings
                      </Button>
                    </div>
                  )}

                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                    <p className="text-blue-800 font-medium mb-1">What is Firecrawl?</p>
                    <p className="text-blue-700">
                      Firecrawl enables AI retrieval modes to search and scrape web content, 
                      providing additional context for AI-generated answers.
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
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
              <Label htmlFor="api-key">API Key *</Label>
              <Input
                id="api-key"
                type="text"
                value={providerForm.api_key}
                onChange={(e) => setProviderForm({...providerForm, api_key: e.target.value})}
                placeholder="Enter your API key"
                autoComplete="off"
              />
              <p className="text-xs text-slate-500">
                Your API key will be stored securely in the database
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
                  <SelectItem value="firecrawl">Firecrawl</SelectItem>
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