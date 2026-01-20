import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Library,
  Plus,
  Search,
  Edit,
  History,
  FileText,
  Upload,
  Download,
  Loader2,
  ChevronRight,
  Save,
  AlertCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function QuestionLibrary() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importRows, setImportRows] = useState([]);
  
  const [questions, setQuestions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [indicators, setIndicators] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [promptVersions, setPromptVersions] = useState([]);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [indicatorFilter, setIndicatorFilter] = useState('all');
  const [pillarFilter, setPillarFilter] = useState('all');

  // Selected question
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [editingPrompt, setEditingPrompt] = useState('');
  const [promptChangeNote, setPromptChangeNote] = useState('');
  const [showPromptHistory, setShowPromptHistory] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [questionsData, groupsData, indicatorsData, pillarsData, promptsData] = await Promise.all([
        base44.entities.Question.list(),
        base44.entities.QuestionGroup.list(),
        base44.entities.Indicator.list(),
        base44.entities.Pillar.list(),
        base44.entities.QuestionPromptVersion.list('-created_date')
      ]);

      setQuestions(questionsData);
      setGroups(groupsData);
      setIndicators(indicatorsData);
      setPillars(pillarsData);
      setPromptVersions(promptsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGroup = (id) => groups.find(g => g.id === id);
  const getIndicator = (id) => indicators.find(i => i.id === id);
  const getPillar = (id) => pillars.find(p => p.id === id);

  const getActivePrompt = (questionId) => 
    promptVersions.find(p => p.question_id === questionId && p.is_active);

  const getPromptHistory = (questionId) =>
    promptVersions.filter(p => p.question_id === questionId).sort((a, b) => b.version_number - a.version_number);

  const filteredQuestions = questions.filter(q => {
    const group = getGroup(q.group_id);
    const indicator = group ? getIndicator(group.indicator_id) : null;
    const pillar = group ? getPillar(group.pillar_id) : null;

    const matchesSearch = 
      q.question_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      q.question_code?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesIndicator = indicatorFilter === 'all' || indicator?.id === indicatorFilter;
    const matchesPillar = pillarFilter === 'all' || pillar?.id === pillarFilter;

    return matchesSearch && matchesIndicator && matchesPillar;
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    const ac = (a?.question_code ?? "").toString().trim().toUpperCase();
    const bc = (b?.question_code ?? "").toString().trim().toUpperCase();
    return ac.localeCompare(bc, undefined, { numeric: true, sensitivity: "base" });
  });

  const handleSelectQuestion = (question) => {
    setSelectedQuestion(question);
    const activePrompt = getActivePrompt(question.id);
    setEditingPrompt(activePrompt?.prompt_text || '');
    setPromptChangeNote('');
  };

  const handleSavePrompt = async () => {
    if (!selectedQuestion || !editingPrompt.trim()) return;
    
    setSaving(true);
    try {
      // Deactivate current active prompt
      const activePrompt = getActivePrompt(selectedQuestion.id);
      if (activePrompt) {
        await base44.entities.QuestionPromptVersion.update(activePrompt.id, { is_active: false });
      }

      // Create new version
      const history = getPromptHistory(selectedQuestion.id);
      const newVersion = await base44.entities.QuestionPromptVersion.create({
        question_id: selectedQuestion.id,
        version_number: (history.length > 0 ? Math.max(...history.map(h => h.version_number)) : 0) + 1,
        prompt_text: editingPrompt,
        change_note: promptChangeNote || 'Updated prompt',
        is_active: true
      });

      setPromptVersions([newVersion, ...promptVersions.map(p => 
        p.id === activePrompt?.id ? { ...p, is_active: false } : p
      )]);

      toast({ title: 'Saved', description: 'Prompt version saved successfully' });
      setPromptChangeNote('');
    } catch (error) {
      console.error('Failed to save prompt:', error);
      toast({ title: 'Error', description: 'Failed to save prompt', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.tsv,.xlsx';
    input.onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setImporting(true);
      try {
        const rows = await parseFile(file);
        setImportRows(rows);
        
        // Call backend with dry_run
        const { data } = await base44.functions.invoke('importQuestionLibrary', { dry_run: true, rows });
        
        setImportPreview(data);
        setImportDialogOpen(true);
      } catch (error) {
        console.error('Import failed:', error);
        toast({ title: 'Error', description: error.message || 'Failed to parse file', variant: 'destructive' });
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const parseFile = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('No sheets found in file');
      }

      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        throw new Error('No data found in spreadsheet');
      }

      // Normalize headers and filter empty rows
      const rows = rawRows
        .map(row => {
          const normalized = {};
          for (const [key, value] of Object.entries(row)) {
            normalized[key.toLowerCase().trim()] = value;
          }
          return normalized;
        })
        .filter(row => row.question_code && row.question_code.trim());

      if (rows.length === 0) {
        throw new Error('No valid rows with question_code found');
      }

      return rows;
    } catch (error) {
      console.error('Parse error:', error);
      throw new Error(`Parse error: ${error.message}`);
    }
  };

  const handleApplyImport = async () => {
    if (!importPreview || !importRows.length) return;

    setImporting(true);
    try {
      const { data } = await base44.functions.invoke('importQuestionLibrary', { dry_run: false, rows: importRows });
      
      toast({ 
        title: 'Import Complete', 
        description: `Created ${data.summary.questions_created} questions, updated ${data.summary.questions_updated}` 
      });
      
      setImportDialogOpen(false);
      await loadData();
    } catch (error) {
      console.error('Import failed:', error);
      toast({ title: 'Error', description: 'Import failed', variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Question Library</h1>
          <p className="text-slate-500 mt-1">Manage questions and AI prompts</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleImportClick} disabled={importing}>
            {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
            Import
          </Button>
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search questions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
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
            <Select value={pillarFilter} onValueChange={setPillarFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Pillar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pillars</SelectItem>
                {pillars.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Questions ({sortedQuestions.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-20 w-full" />
                ))}
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="p-4 space-y-2">
                  {sortedQuestions.map(question => {
                    const group = getGroup(question.group_id);
                    const indicator = group ? getIndicator(group.indicator_id) : null;
                    const hasPrompt = !!getActivePrompt(question.id);

                    return (
                      <div
                        key={question.id}
                        onClick={() => handleSelectQuestion(question)}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedQuestion?.id === question.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="outline">{question.question_code}</Badge>
                              <Badge variant="secondary">{indicator?.name}</Badge>
                              {!hasPrompt && (
                                <Badge className="bg-amber-100 text-amber-700">No Prompt</Badge>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 line-clamp-2">{question.question_text}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
                              <span>{question.answer_type?.replace('_', ' ')}</span>
                              {group && <span>• {group.group_name}</span>}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400 flex-shrink-0" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Question Detail / Prompt Editor */}
        <Card>
          {selectedQuestion ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Prompt Editor</CardTitle>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setShowPromptHistory(true)}
                  >
                    <History className="h-4 w-4 mr-2" />
                    History
                  </Button>
                </div>
                <CardDescription>
                  <Badge variant="outline" className="mr-2">{selectedQuestion.question_code}</Badge>
                  {selectedQuestion.question_text}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Prompt Text</Label>
                  <Textarea
                    value={editingPrompt}
                    onChange={(e) => setEditingPrompt(e.target.value)}
                    placeholder="Enter the AI prompt for this question..."
                    className="min-h-[300px] font-mono text-sm"
                  />
                  <p className="text-xs text-slate-500">
                    Available tokens: {'{economy_name}'}, {'{country}'}, {'{jurisdiction}'}, {'{year}'}, {'{as_of_date}'}, {'{question_text}'}, {'{indicator}'}, {'{pillar}'}
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Change Note</Label>
                  <Input
                    value={promptChangeNote}
                    onChange={(e) => setPromptChangeNote(e.target.value)}
                    placeholder="Describe what changed..."
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handleSavePrompt}
                  disabled={saving || !editingPrompt.trim()}
                  className="w-full bg-[#002244] hover:bg-[#003366]"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save New Version
                    </>
                  )}
                </Button>
              </CardFooter>
            </>
          ) : (
            <CardContent className="p-12 text-center">
              <Library className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-lg font-medium text-slate-900 mb-2">Select a question</h3>
              <p className="text-slate-500">Choose a question from the list to edit its AI prompt</p>
            </CardContent>
          )}
        </Card>
      </div>

      {/* Import Preview Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import Preview</DialogTitle>
            <DialogDescription>
              Review the changes before applying
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4 py-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Groups Created</p>
                    <p className="text-xl font-bold">{importPreview.summary.groups_created}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Questions Created</p>
                    <p className="text-xl font-bold text-emerald-600">{importPreview.summary.questions_created}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Questions Updated</p>
                    <p className="text-xl font-bold text-blue-600">{importPreview.summary.questions_updated}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Prompts Created</p>
                    <p className="text-xl font-bold">{importPreview.summary.prompt_versions_created}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Valid Rows</p>
                    <p className="text-xl font-bold">{importPreview.summary.rows_valid}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-slate-500">Errors</p>
                    <p className="text-xl font-bold text-red-600">{importPreview.summary.rows_invalid}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Errors */}
              {importPreview.errors.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    Errors ({importPreview.errors.length})
                  </h3>
                  <ScrollArea className="max-h-60 border rounded-lg">
                    <div className="p-3 space-y-2">
                      {importPreview.errors.slice(0, 10).map((err, idx) => (
                        <div key={idx} className="text-sm bg-red-50 border-l-2 border-red-500 p-2 rounded">
                          <span className="font-medium">Row {err.row}</span>
                          {err.question_code && <span className="text-slate-600"> ({err.question_code})</span>}
                          : {err.message}
                        </div>
                      ))}
                      {importPreview.errors.length > 10 && (
                        <p className="text-xs text-slate-500 text-center pt-2">
                          ...and {importPreview.errors.length - 10} more errors
                        </p>
                      )}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {importPreview.summary.rows_valid > 0 && (
                <p className="text-sm text-slate-600">
                  {importPreview.summary.rows_valid} valid row{importPreview.summary.rows_valid !== 1 ? 's' : ''} ready to import
                </p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
            {importPreview?.summary.rows_valid > 0 && (
              <Button 
                onClick={handleApplyImport}
                disabled={importing}
                className="bg-[#002244] hover:bg-[#003366]"
              >
                {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Apply Import
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Prompt History Sheet */}
      <Sheet open={showPromptHistory} onOpenChange={setShowPromptHistory}>
        <SheetContent className="w-full sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Prompt History</SheetTitle>
            <SheetDescription>
              {selectedQuestion?.question_code} - Version history
            </SheetDescription>
          </SheetHeader>
          <ScrollArea className="h-[calc(100vh-120px)] mt-6">
            <div className="space-y-4">
              {selectedQuestion && getPromptHistory(selectedQuestion.id).map((version, index) => (
                <div 
                  key={version.id}
                  className={`p-4 rounded-lg border ${version.is_active ? 'border-blue-500 bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">v{version.version_number}</Badge>
                      {version.is_active && <Badge className="bg-emerald-100 text-emerald-700">Active</Badge>}
                    </div>
                    <span className="text-xs text-slate-500">
                      {version.created_date ? format(new Date(version.created_date), 'MMM d, yyyy HH:mm') : '-'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{version.change_note}</p>
                  <pre className="text-xs bg-slate-100 p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {version.prompt_text?.slice(0, 200)}...
                  </pre>
                </div>
              ))}
              {selectedQuestion && getPromptHistory(selectedQuestion.id).length === 0 && (
                <div className="text-center py-8 text-slate-500">
                  No prompt versions yet
                </div>
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}