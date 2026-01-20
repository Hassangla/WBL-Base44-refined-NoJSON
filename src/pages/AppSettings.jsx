import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Settings,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function AppSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [settings, setSettings] = useState({
    workflow_mode: 'two_step',
    default_reporting_year: '2026',
    default_as_of_date: '2026-10-01',
    session_timeout_hours: '8',
    max_attachment_size_mb: '25',
    allow_viewer_cost_data: 'false',
    allow_viewer_draft_export: 'false',
    allow_viewer_comparison: 'true'
  });

  const [hasPendingTasks, setHasPendingTasks] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const [settingsData, tasksData] = await Promise.all([
        base44.entities.AppSettings.list(),
        base44.entities.Task.filter({ status: 'submitted' })
      ]);

      setHasPendingTasks(tasksData.length > 0);

      const settingsMap = {};
      settingsData.forEach(s => {
        settingsMap[s.setting_key] = s.setting_value;
      });
      
      setSettings(prev => ({
        ...prev,
        ...settingsMap
      }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const existingSettings = await base44.entities.AppSettings.list();
      
      for (const [key, value] of Object.entries(settings)) {
        const existing = existingSettings.find(s => s.setting_key === key);
        if (existing) {
          await base44.entities.AppSettings.update(existing.id, { setting_value: value });
        } else {
          await base44.entities.AppSettings.create({
            setting_key: key,
            setting_value: value,
            setting_type: 'string'
          });
        }
      }

      toast({ title: 'Saved', description: 'Settings saved successfully' });
    } catch (error) {
      console.error('Failed to save:', error);
      toast({ title: 'Error', description: 'Failed to save settings', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-500 mt-1">Configure global application settings</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-[#002244] hover:bg-[#003366]">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Workflow Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Workflow Configuration</CardTitle>
            <CardDescription>Configure validation workflow mode</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Workflow Mode</Label>
              <Select 
                value={settings.workflow_mode} 
                onValueChange={(v) => setSettings({...settings, workflow_mode: v})}
                disabled={hasPendingTasks}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="two_step">Two-Step Validation</SelectItem>
                  <SelectItem value="single_step">Single-Step Validation</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Two-step: Researcher → Validator review → Approved<br/>
                Single-step: Researcher can directly validate
              </p>
              {hasPendingTasks && (
                <div className="flex items-center gap-2 text-amber-600 text-sm mt-2">
                  <AlertCircle className="h-4 w-4" />
                  Cannot change while tasks are pending validation
                </div>
              )}
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="font-medium">Current Mode Features</h4>
              {settings.workflow_mode === 'two_step' ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Researchers submit tasks for validation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Validators approve or return with comments</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Validator Queue visible in navigation</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Researchers can directly validate tasks</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Researchers can override Match/NoMatch</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Validator Queue hidden from navigation</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Default Values */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Default Values</CardTitle>
            <CardDescription>Configure default batch settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="default-year">Default Reporting Year</Label>
              <Select 
                value={settings.default_reporting_year} 
                onValueChange={(v) => setSettings({...settings, default_reporting_year: v})}
              >
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
              <Label htmlFor="default-date">Default As-of Date</Label>
              <Input
                id="default-date"
                type="date"
                value={settings.default_as_of_date}
                onChange={(e) => setSettings({...settings, default_as_of_date: e.target.value})}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Session Timeout (hours)</Label>
              <Select 
                value={settings.session_timeout_hours} 
                onValueChange={(v) => setSettings({...settings, session_timeout_hours: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 hours</SelectItem>
                  <SelectItem value="8">8 hours</SelectItem>
                  <SelectItem value="12">12 hours</SelectItem>
                  <SelectItem value="24">24 hours</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Max Attachment Size</Label>
              <Select 
                value={settings.max_attachment_size_mb} 
                onValueChange={(v) => setSettings({...settings, max_attachment_size_mb: v})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 MB</SelectItem>
                  <SelectItem value="25">25 MB</SelectItem>
                  <SelectItem value="50">50 MB</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Viewer Permissions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Viewer Permissions</CardTitle>
            <CardDescription>Configure what Viewers can access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Allow Viewers to see AI cost data</p>
                <p className="text-xs text-slate-500">Show cost estimates in AI Usage page</p>
              </div>
              <Switch 
                checked={settings.allow_viewer_cost_data === 'true'} 
                onCheckedChange={(checked) => setSettings({...settings, allow_viewer_cost_data: String(checked)})}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Allow Viewers to export draft data</p>
                <p className="text-xs text-slate-500">Include draft responses in exports</p>
              </div>
              <Switch 
                checked={settings.allow_viewer_draft_export === 'true'} 
                onCheckedChange={(checked) => setSettings({...settings, allow_viewer_draft_export: String(checked)})}
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Allow Viewers to see comparison results</p>
                <p className="text-xs text-slate-500">Show AI comparison data</p>
              </div>
              <Switch 
                checked={settings.allow_viewer_comparison === 'true'} 
                onCheckedChange={(checked) => setSettings({...settings, allow_viewer_comparison: String(checked)})}
              />
            </div>
          </CardContent>
        </Card>

        {/* WBL Report Cycles */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">WBL Report Cycles</CardTitle>
            <CardDescription>Reference data for validation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              {[
                { cycle: '2026', start: 'Oct 2, 2024', end: 'Oct 1, 2025' },
                { cycle: '2025', start: 'Oct 2, 2023', end: 'Oct 1, 2024' },
                { cycle: '2024', start: 'Oct 2, 2022', end: 'Oct 1, 2023' },
                { cycle: '2023', start: 'Oct 2, 2021', end: 'Oct 1, 2022' },
                { cycle: '2022', start: 'Oct 2, 2020', end: 'Oct 1, 2021' },
                { cycle: '2021', start: 'Sep 2, 2019', end: 'Oct 1, 2020' },
                { cycle: '2020', start: 'Jun 1, 2018', end: 'Sep 1, 2019' }
              ].map(({ cycle, start, end }) => (
                <div key={cycle} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="font-medium">WBL {cycle}</span>
                  <span className="text-slate-500">{start} - {end}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}