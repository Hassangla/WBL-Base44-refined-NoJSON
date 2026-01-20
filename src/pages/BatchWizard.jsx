import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Globe,
  FileQuestion,
  Users,
  Play,
  Search,
  X,
  Calendar,
  Brain,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ModelSelector from '../components/ModelSelector';

const STEPS = [
  { id: 1, title: 'Select Economies', icon: Globe },
  { id: 2, title: 'Select Indicators', icon: FileQuestion },
  { id: 3, title: 'Select Questions', icon: FileQuestion },
  { id: 4, title: 'Assign & Configure', icon: Users }
];

const INDICATORS = [
  'Safety', 'Childcare', 'Mobility', 'Workplace', 'Pay',
  'Marriage', 'Parenthood', 'Entrepreneurship', 'Assets', 'Pensions'
];

const PILLARS = ['Legal frameworks', 'Supportive frameworks'];

export default function BatchWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Data
  const [economies, setEconomies] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [providers, setProviders] = useState([]);
  const [models, setModels] = useState([]);

  // Selections
  const [batchName, setBatchName] = useState('');
  const [selectedEconomies, setSelectedEconomies] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState([]);
  const [selectedPillars, setSelectedPillars] = useState([...PILLARS]);
  const [selectAllQuestions, setSelectAllQuestions] = useState(true);
  const [selectedQuestions, setSelectedQuestions] = useState([]);
  const [selectedResearchers, setSelectedResearchers] = useState([]);
  const [selectedValidators, setSelectedValidators] = useState([]);
  const [reportingYear, setReportingYear] = useState(2026);
  const [asOfDate, setAsOfDate] = useState('2026-10-01');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [retrievalMethod, setRetrievalMethod] = useState('none');
  const [autoRunAI, setAutoRunAI] = useState(true);

  // Filters
  const [economySearch, setEconomySearch] = useState('');
  const [questionSearch, setQuestionSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [economiesData, questionsData, groupsData, indicatorsData, providersData, modelsData] = await Promise.all([
        base44.entities.Economy.filter({ is_active: true }),
        base44.entities.Question.filter({ is_active: true }),
        base44.entities.QuestionGroup.list(),
        base44.entities.Indicator.filter({ is_enabled: true }),
        base44.entities.AIProvider.filter({ is_enabled: true }),
        base44.entities.AIModel.filter({ is_enabled: true })
      ]);

      setEconomies(economiesData);
      setQuestions(questionsData);
      setGroups(groupsData);
      setIndicators(indicatorsData);
      setProviders(providersData);
      setModels(modelsData);

      if (providersData.length > 0) {
        setSelectedProvider(providersData[0].id);
        const providerModels = modelsData.filter(m => m.provider_id === providersData[0].id);
        if (providerModels.length > 0) {
          setSelectedModel(providerModels[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEconomies = economies.filter(e =>
    e.name?.toLowerCase().includes(economySearch.toLowerCase()) ||
    e.code?.toLowerCase().includes(economySearch.toLowerCase())
  );

  const filteredQuestions = questions.filter(q => {
    const group = groups.find(g => g.id === q.group_id);
    const indicator = indicators.find(i => i.id === group?.indicator_id);
    
    const matchesSearch = q.question_text?.toLowerCase().includes(questionSearch.toLowerCase()) ||
      q.question_code?.toLowerCase().includes(questionSearch.toLowerCase());
    const matchesIndicator = selectedIndicators.length === 0 || 
      selectedIndicators.includes(indicator?.name);
    
    return matchesSearch && matchesIndicator;
  });

  const toggleEconomy = (economyId) => {
    setSelectedEconomies(prev =>
      prev.includes(economyId)
        ? prev.filter(id => id !== economyId)
        : [...prev, economyId]
    );
  };

  const selectAllEconomies = () => {
    setSelectedEconomies(filteredEconomies.map(e => e.id));
  };

  const clearEconomies = () => {
    setSelectedEconomies([]);
  };

  const toggleIndicator = (indicator) => {
    setSelectedIndicators(prev =>
      prev.includes(indicator)
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator]
    );
  };

  const toggleQuestion = (questionId) => {
    setSelectedQuestions(prev =>
      prev.includes(questionId)
        ? prev.filter(id => id !== questionId)
        : [...prev, questionId]
    );
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return selectedEconomies.length > 0;
      case 2: return selectedIndicators.length > 0 && selectedPillars.length > 0;
      case 3: return selectAllQuestions || selectedQuestions.length > 0;
      case 4: return batchName.trim() && selectedProvider && selectedModel;
      default: return false;
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const questionIds = selectAllQuestions 
        ? questions.filter(q => {
            const group = groups.find(g => g.id === q.group_id);
            const indicator = indicators.find(i => i.id === group?.indicator_id);
            return selectedIndicators.includes(indicator?.name);
          }).map(q => q.id)
        : selectedQuestions;

      const batch = await base44.entities.Batch.create({
        name: batchName,
        reporting_year: reportingYear,
        as_of_date: asOfDate,
        primary_provider_id: selectedProvider,
        primary_model_id: selectedModel,
        retrieval_method: retrievalMethod,
        auto_run_on_create: autoRunAI,
        status: 'creating',
        economy_ids: selectedEconomies,
        question_ids: questionIds,
        researcher_ids: selectedResearchers,
        validator_ids: selectedValidators
      });

      // Create tasks for each economy-question combination
      const tasks = [];
      for (const economyId of selectedEconomies) {
        for (const questionId of questionIds) {
          tasks.push({
            batch_id: batch.id,
            economy_id: economyId,
            question_id: questionId,
            status: 'not_started',
            current_researcher_id: selectedResearchers[0] || null
          });
        }
      }

      // Bulk create tasks
      if (tasks.length > 0) {
        await base44.entities.Task.bulkCreate(tasks);
      }

      // Update batch status
      await base44.entities.Batch.update(batch.id, { status: 'active' });

      navigate(createPageUrl(`BatchDetail?id=${batch.id}`));
    } catch (error) {
      console.error('Failed to create batch:', error);
      setCreating(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search economies..."
                  value={economySearch}
                  onChange={(e) => setEconomySearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Button variant="outline" onClick={selectAllEconomies}>
                Select All ({filteredEconomies.length})
              </Button>
              <Button variant="outline" onClick={clearEconomies}>
                Clear
              </Button>
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500">
              <Badge variant="secondary">{selectedEconomies.length} selected</Badge>
            </div>

            <ScrollArea className="h-[400px] border rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 p-4">
                {loading ? (
                  Array(12).fill(0).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))
                ) : (
                  filteredEconomies.map(economy => (
                    <div
                      key={economy.id}
                      onClick={() => toggleEconomy(economy.id)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all',
                        selectedEconomies.includes(economy.id)
                          ? 'border-blue-500 bg-blue-50'
                          : 'hover:border-slate-300 hover:bg-slate-50'
                      )}
                    >
                      <Checkbox checked={selectedEconomies.includes(economy.id)} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 truncate">{economy.name}</p>
                        {economy.region && (
                          <p className="text-xs text-slate-500">{economy.region}</p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label className="text-base font-semibold mb-4 block">Indicators</Label>
              <p className="text-sm text-slate-500 mb-4">Select the indicators to include in this batch</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {INDICATORS.map(indicator => (
                  <div
                    key={indicator}
                    onClick={() => toggleIndicator(indicator)}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-all text-center',
                      selectedIndicators.includes(indicator)
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <Checkbox 
                      checked={selectedIndicators.includes(indicator)} 
                      className="mx-auto mb-2"
                    />
                    <p className="font-medium text-sm">{indicator}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-semibold mb-4 block">Pillars</Label>
              <div className="grid grid-cols-2 gap-4">
                {PILLARS.map(pillar => (
                  <div
                    key={pillar}
                    onClick={() => setSelectedPillars(prev =>
                      prev.includes(pillar) ? prev.filter(p => p !== pillar) : [...prev, pillar]
                    )}
                    className={cn(
                      'p-4 rounded-lg border cursor-pointer transition-all',
                      selectedPillars.includes(pillar)
                        ? 'border-blue-500 bg-blue-50'
                        : 'hover:border-slate-300 hover:bg-slate-50'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Checkbox checked={selectedPillars.includes(pillar)} />
                      <span className="font-medium">{pillar}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Switch
                  checked={selectAllQuestions}
                  onCheckedChange={setSelectAllQuestions}
                />
                <Label>Include all questions for selected indicators</Label>
              </div>
              {!selectAllQuestions && (
                <Badge variant="secondary">{selectedQuestions.length} selected</Badge>
              )}
            </div>

            {!selectAllQuestions && (
              <>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search questions..."
                    value={questionSearch}
                    onChange={(e) => setQuestionSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>

                <ScrollArea className="h-[350px] border rounded-lg">
                  <div className="p-4 space-y-2">
                    {[...filteredQuestions].sort((a, b) => {
                      const ac = (a?.question_code ?? "").toString().trim().toUpperCase();
                      const bc = (b?.question_code ?? "").toString().trim().toUpperCase();
                      return ac.localeCompare(bc, undefined, { numeric: true, sensitivity: "base" });
                    }).map(question => {
                      const group = groups.find(g => g.id === question.group_id);
                      return (
                        <div
                          key={question.id}
                          onClick={() => toggleQuestion(question.id)}
                          className={cn(
                            'p-3 rounded-lg border cursor-pointer transition-all',
                            selectedQuestions.includes(question.id)
                              ? 'border-blue-500 bg-blue-50'
                              : 'hover:border-slate-300 hover:bg-slate-50'
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <Checkbox checked={selectedQuestions.includes(question.id)} className="mt-1" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-slate-900">{question.question_text}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-xs">{question.question_code}</Badge>
                                {group && (
                                  <Badge variant="secondary" className="text-xs">{group.group_name}</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="batchName">Batch Name *</Label>
                <Input
                  id="batchName"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="e.g., WBL 2026 - Europe"
                />
              </div>

              <div className="space-y-2">
                <Label>Reporting Year</Label>
                <Select value={reportingYear.toString()} onValueChange={(v) => setReportingYear(parseInt(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>As-of Date</Label>
                <Input
                  type="date"
                  value={asOfDate}
                  onChange={(e) => setAsOfDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>AI Provider *</Label>
                <Select value={selectedProvider} onValueChange={(v) => {
                  setSelectedProvider(v);
                  const providerModels = models.filter(m => m.provider_id === v);
                  setSelectedModel(providerModels[0]?.id || '');
                }}>
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
                <Label>AI Model *</Label>
                <ModelSelector
                  providerId={selectedProvider}
                  value={selectedModel}
                  onChange={setSelectedModel}
                  showHealthStatus={true}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label className="text-base font-medium">Retrieval / Online Search</Label>

                <div className="p-4 rounded-lg border space-y-3">
                  <p className="text-xs text-slate-500">
                    Choose how the AI can retrieve web evidence (optional). Only one method can be active.
                  </p>

                  <Select value={retrievalMethod} onValueChange={setRetrievalMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select retrieval method" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (no web retrieval)</SelectItem>
                      <SelectItem value="provider_native_only">Provider-native web search (OpenAI)</SelectItem>
                      <SelectItem value="firecrawl_preferred">Firecrawl preferred (fallback allowed)</SelectItem>
                      <SelectItem value="firecrawl_only">Firecrawl only (required)</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="text-xs text-slate-500 space-y-1">
                    <p><b>Provider-native</b>: model may use built-in web search tools.</p>
                    <p><b>Firecrawl</b>: system fetches web evidence via Firecrawl and appends it to the prompt.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Auto-run AI after creation</p>
                  <p className="text-sm text-slate-500">
                    Automatically start AI data collection for all tasks
                  </p>
                </div>
                <Switch checked={autoRunAI} onCheckedChange={setAutoRunAI} />
              </div>
            </div>

            {/* Summary */}
            <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
              <h4 className="font-semibold text-blue-900 mb-3">Batch Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-blue-600">Economies</p>
                  <p className="font-bold text-blue-900">{selectedEconomies.length}</p>
                </div>
                <div>
                  <p className="text-blue-600">Indicators</p>
                  <p className="font-bold text-blue-900">{selectedIndicators.length}</p>
                </div>
                <div>
                  <p className="text-blue-600">Questions</p>
                  <p className="font-bold text-blue-900">
                    {selectAllQuestions 
                      ? filteredQuestions.length 
                      : selectedQuestions.length}
                  </p>
                </div>
                <div>
                  <p className="text-blue-600">Total Tasks</p>
                  <p className="font-bold text-blue-900">
                    {selectedEconomies.length * (selectAllQuestions ? filteredQuestions.length : selectedQuestions.length)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Create Research Batch</h1>
        <p className="text-slate-500 mt-1">Set up a new batch of research tasks</p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div className={cn(
                'h-10 w-10 rounded-full flex items-center justify-center transition-all',
                currentStep > step.id 
                  ? 'bg-emerald-500 text-white'
                  : currentStep === step.id
                    ? 'bg-[#002244] text-white'
                    : 'bg-slate-100 text-slate-400'
              )}>
                {currentStep > step.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <step.icon className="h-5 w-5" />
                )}
              </div>
              <span className={cn(
                'hidden md:block text-sm font-medium',
                currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'
              )}>
                {step.title}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn(
                'flex-1 h-1 mx-4 rounded',
                currentStep > step.id ? 'bg-emerald-500' : 'bg-slate-200'
              )} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{STEPS[currentStep - 1].title}</CardTitle>
          <CardDescription>
            {currentStep === 1 && 'Choose the economies to include in this research batch'}
            {currentStep === 2 && 'Select which indicators and pillars to research'}
            {currentStep === 3 && 'Choose specific questions or include all for selected indicators'}
            {currentStep === 4 && 'Configure batch settings and AI parameters'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {renderStep()}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => currentStep === 1 ? navigate(createPageUrl('Batches')) : setCurrentStep(currentStep - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? 'Cancel' : 'Back'}
          </Button>
          
          {currentStep < 4 ? (
            <Button
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
              className="bg-[#002244] hover:bg-[#003366]"
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={!canProceed() || creating}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Create Batch
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}