import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Download,
  FileSpreadsheet,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';

const INDICATORS = [
  'Safety', 'Childcare', 'Mobility', 'Workplace', 'Pay',
  'Marriage', 'Parenthood', 'Entrepreneurship', 'Assets', 'Pensions'
];

export default function Exports() {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [batches, setBatches] = useState([]);
  const [exports, setExports] = useState([]);
  const [economies, setEconomies] = useState([]);

  // Filter state
  const [selectedBatches, setSelectedBatches] = useState([]);
  const [selectedEconomies, setSelectedEconomies] = useState([]);
  const [selectedIndicators, setSelectedIndicators] = useState([...INDICATORS]);
  const [statusFilter, setStatusFilter] = useState('validated');
  const [matchFilter, setMatchFilter] = useState('all');
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [exportType, setExportType] = useState('standard');

  const urlParams = new URLSearchParams(window.location.search);
  const initialBatchId = urlParams.get('batch_id');

  useEffect(() => {
    if (initialBatchId) {
      setSelectedBatches([initialBatchId]);
    }
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [batchesData, exportsData, economiesData] = await Promise.all([
        base44.entities.Batch.list('-created_date'),
        base44.entities.Export.list('-created_date', 20),
        base44.entities.Economy.filter({ is_active: true })
      ]);

      setBatches(batchesData);
      setExports(exportsData);
      setEconomies(economiesData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateExport = async () => {
    if (selectedBatches.length === 0) {
      toast.error('Please select at least one batch');
      return;
    }

    setGenerating(true);
    try {
      // Fetch data for export - ALL selected batches
      const allTasks = [];
      for (const batchId of selectedBatches) {
        const batchTasks = await base44.entities.Task.filter({ batch_id: batchId });
        allTasks.push(...batchTasks);
      }

      const [economiesData, questionsData, draftsData, aiResultsData, commentsData] = await Promise.all([
        base44.entities.Economy.list(),
        base44.entities.Question.list(),
        base44.entities.DraftResponse.list('-created_date', 10000),
        base44.entities.AITaskResult.list('-completed_at', 10000),
        base44.entities.TaskValidationComment.list('-created_date', 10000)
      ]);

      // Build maps for efficient lookup
      const draftsByTask = new Map();
      draftsData.forEach(d => draftsByTask.set(d.task_id, d));

      const aiResultsByTask = new Map();
      aiResultsData.forEach(r => {
        if (r.status === 'completed' && !aiResultsByTask.has(r.task_id)) {
          aiResultsByTask.set(r.task_id, r);
        }
      });

      const commentsByTask = new Map();
      commentsData.forEach(c => {
        if (!commentsByTask.has(c.task_id)) {
          commentsByTask.set(c.task_id, []);
        }
        commentsByTask.get(c.task_id).push(c);
      });

      // Build export data
      const exportData = allTasks.map(task => {
        const economy = economiesData.find(e => e.id === task.economy_id);
        const question = questionsData.find(q => q.id === task.question_id);
        const draft = draftsByTask.get(task.id);
        const aiResult = aiResultsByTask.get(task.id);

        // Prefer AI result, fallback to draft
        let answer = '';
        let legalBasis = '';
        let url = '';
        let comments = '';

        if (aiResult?.output_parsed_json) {
          answer = aiResult.output_parsed_json.answer ?? '';
          legalBasis = aiResult.output_parsed_json.legal_basis || '';
          url = aiResult.output_parsed_json.url || '';
          comments = aiResult.output_parsed_json.comments || '';
        } else if (aiResult?.output_raw_text) {
          // If the AI didn't return structured fields, export the raw output verbatim
          // instead of silently dropping it.
          answer = aiResult.output_raw_text;
        } else if (draft) {
          answer = draft.answer ?? '';
          legalBasis = draft.legal_basis || '';
          url = draft.url || '';
          comments = draft.comments || '';
        }

        // If no comments from draft/AI, get from validation comments
        if (!comments) {
          const taskComments = commentsByTask.get(task.id) || [];
          const returnComment = taskComments.find(c => c.comment_type === 'return_reason');
          if (returnComment) {
            comments = returnComment.comment_text;
          } else if (taskComments.length > 0) {
            comments = taskComments[0].comment_text;
          }
        }

        return {
          Economy: economy?.name || '',
          'Question Code': question?.question_code || '',
          Question: question?.question_text || '',
          Answer: answer,
          'Legal Basis': legalBasis,
          URL: url,
          Comments: comments,
          Status: task.status || ''
        };
      });

      // Generate file based on format
      if (exportFormat === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Export');
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        
        const blob = new Blob([wbout], { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${Date.now()}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      } else {
        // TSV format
        const headers = Object.keys(exportData[0] || {}).join('\t');
        const rows = exportData.map(row => Object.values(row).join('\t'));
        const tsvContent = [headers, ...rows].join('\n');
        
        const blob = new Blob([tsvContent], { type: 'text/tab-separated-values' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `export_${Date.now()}.tsv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(url), 1000);
      }

      const exportRecord = await base44.entities.Export.create({
        filter_json: {
          batch_ids: selectedBatches,
          economy_ids: selectedEconomies.length > 0 ? selectedEconomies : null,
          indicators: selectedIndicators,
          status: statusFilter,
          match_no_match: matchFilter
        },
        format: exportFormat,
        export_type: exportType,
        status: 'completed',
        row_count: exportData.length
      });

      setExports([exportRecord, ...exports]);
      toast.success(`Export downloaded successfully (${exportData.length} rows)`);
    } catch (error) {
      console.error('Failed to generate export:', error);
      toast.error('Failed to generate export');
    } finally {
      setGenerating(false);
    }
  };

  const toggleBatch = (batchId) => {
    setSelectedBatches(prev =>
      prev.includes(batchId)
        ? prev.filter(id => id !== batchId)
        : [...prev, batchId]
    );
  };

  const toggleIndicator = (indicator) => {
    setSelectedIndicators(prev =>
      prev.includes(indicator)
        ? prev.filter(i => i !== indicator)
        : [...prev, indicator]
    );
  };

  const statusColors = {
    queued: 'bg-slate-100 text-slate-700',
    processing: 'bg-blue-100 text-blue-700',
    completed: 'bg-emerald-100 text-emerald-700',
    failed: 'bg-red-100 text-red-700'
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Exports</h1>
        <p className="text-slate-500 mt-1">Generate and download data exports</p>
      </div>

      <Tabs defaultValue="create">
        <TabsList>
          <TabsTrigger value="create">Create Export</TabsTrigger>
          <TabsTrigger value="history">Export History ({exports.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="create" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Configuration */}
            <div className="lg:col-span-2 space-y-6">
              {/* Batch Selection */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Select Batches *</CardTitle>
                  <CardDescription>Choose one or more batches to export</CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-48 border rounded-lg">
                    <div className="p-4 space-y-2">
                      {loading ? (
                        Array(3).fill(0).map((_, i) => (
                          <Skeleton key={i} className="h-12 w-full" />
                        ))
                      ) : batches.length === 0 ? (
                        <p className="text-sm text-slate-500 text-center py-4">No batches available</p>
                      ) : (
                        batches.map(batch => (
                          <div
                            key={batch.id}
                            onClick={() => toggleBatch(batch.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                              selectedBatches.includes(batch.id)
                                ? 'border-blue-500 bg-blue-50'
                                : 'hover:border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            <Checkbox checked={selectedBatches.includes(batch.id)} />
                            <div className="flex-1">
                              <p className="font-medium text-slate-900">{batch.name}</p>
                              <p className="text-xs text-slate-500">
                                Year {batch.reporting_year} • {batch.economy_ids?.length || 0} economies
                              </p>
                            </div>
                            <Badge variant={batch.status === 'active' ? 'default' : 'secondary'}>
                              {batch.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>

              {/* Indicators */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Indicators</CardTitle>
                  <CardDescription>Select indicators to include</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                    {INDICATORS.map(indicator => (
                      <div
                        key={indicator}
                        onClick={() => toggleIndicator(indicator)}
                        className={`p-2 rounded-lg border cursor-pointer transition-all text-center text-sm ${
                          selectedIndicators.includes(indicator)
                            ? 'border-blue-500 bg-blue-50'
                            : 'hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Checkbox 
                          checked={selectedIndicators.includes(indicator)} 
                          className="mx-auto mb-1"
                        />
                        <span>{indicator}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Filters */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="validated">Validated Only</SelectItem>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="all">All</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Match/NoMatch</Label>
                      <Select value={matchFilter} onValueChange={setMatchFilter}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All</SelectItem>
                          <SelectItem value="Match">Match Only</SelectItem>
                          <SelectItem value="NoMatch">NoMatch Only</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Format</Label>
                      <Select value={exportFormat} onValueChange={setExportFormat}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
                          <SelectItem value="tsv">TSV (.tsv)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Summary & Action */}
            <div>
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-lg">Export Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Batches</span>
                      <span className="font-medium">{selectedBatches.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Indicators</span>
                      <span className="font-medium">{selectedIndicators.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Status Filter</span>
                      <Badge variant="secondary">{statusFilter}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500">Format</span>
                      <Badge variant="outline">{exportFormat.toUpperCase()}</Badge>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button 
                    onClick={handleGenerateExport}
                    disabled={generating || selectedBatches.length === 0}
                    className="w-full bg-[#002244] hover:bg-[#003366]"
                  >
                    {generating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Generate Export
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-6">
          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : exports.length === 0 ? (
                <div className="p-12 text-center">
                  <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No exports yet</h3>
                  <p className="text-slate-500">Generate your first export to see it here</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50">
                      <TableHead>Export ID</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Format</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Rows</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map(exp => (
                      <TableRow key={exp.id}>
                        <TableCell className="font-mono text-sm">{exp.id?.slice(-8)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{exp.export_type}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{exp.format?.toUpperCase()}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[exp.status]}>
                            {exp.status === 'processing' && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                            {exp.status === 'completed' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                            {exp.status === 'failed' && <AlertCircle className="h-3 w-3 mr-1" />}
                            {exp.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{exp.row_count || '-'}</TableCell>
                        <TableCell className="text-slate-500 text-sm">
                          {exp.created_date ? format(new Date(exp.created_date), 'MMM d, HH:mm') : '-'}
                        </TableCell>
                        <TableCell>
                          {exp.status === 'completed' && (
                            <Button variant="ghost" size="icon">
                              <Download className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}