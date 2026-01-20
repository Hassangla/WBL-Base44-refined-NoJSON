import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle } from 'lucide-react';

export default function ModelSelector({ 
  providerId, 
  value, 
  onChange, 
  showHealthStatus = true,
  disabled = false 
}) {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadModels();
  }, [providerId]);

  const loadModels = async () => {
    if (!providerId) {
      setModels([]);
      setLoading(false);
      return;
    }

    try {
      const allModels = await base44.entities.AIModel.filter({ 
        provider_id: providerId,
        is_enabled: true 
      });
      setModels(allModels);
    } catch (error) {
      console.error('Failed to load models:', error);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  const getHealthyModels = () => {
    if (!showHealthStatus) return models;
    return models.filter(m => 
      m.health_status === 'healthy' || 
      m.health_status === 'unchecked' || 
      m.health_status === 'degraded'
    );
  };

  const healthyModels = getHealthyModels();

  if (loading) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Loading models..." />
        </SelectTrigger>
      </Select>
    );
  }

  if (!providerId) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Select a provider first" />
        </SelectTrigger>
      </Select>
    );
  }

  if (healthyModels.length === 0) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="No healthy models available" />
        </SelectTrigger>
      </Select>
    );
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select model" />
      </SelectTrigger>
      <SelectContent>
        {healthyModels.map(model => (
          <SelectItem key={model.id} value={model.id}>
            <div className="flex items-center gap-2">
              <span>{model.display_name}</span>
              {showHealthStatus && model.health_status === 'healthy' && (
                <CheckCircle className="h-3 w-3 text-emerald-600" />
              )}
              {showHealthStatus && model.health_status === 'degraded' && (
                <AlertCircle className="h-3 w-3 text-yellow-600" />
              )}
              {model.supports_web_tooling && (
                <Badge variant="outline" className="text-xs">Web</Badge>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}