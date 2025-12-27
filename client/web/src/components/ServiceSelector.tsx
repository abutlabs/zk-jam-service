'use client';

import { useState } from 'react';
import { useService } from '@/contexts/ServiceContext';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function ServiceSelector() {
  const {
    services,
    selectedService,
    isLoading,
    error,
    selectService,
    addCustomService,
    refreshServices,
  } = useService();

  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customId, setCustomId] = useState('');
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  const handleAddCustom = async () => {
    if (!customId.trim()) return;

    setIsAddingCustom(true);
    const success = await addCustomService(customId.trim());
    setIsAddingCustom(false);

    if (success) {
      setCustomId('');
      setShowAddCustom(false);
    }
  };

  // Status indicator
  const StatusIndicator = () => {
    if (isLoading) {
      return (
        <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
      );
    }
    if (error || !selectedService) {
      return (
        <div className="h-2 w-2 rounded-full bg-red-500" />
      );
    }
    return (
      <div className="h-2 w-2 rounded-full bg-green-500" />
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIndicator />
        <span className="text-gray-500">Connecting...</span>
      </div>
    );
  }

  if (error && services.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIndicator />
        <button
          onClick={() => refreshServices()}
          className="text-gray-500 hover:text-[#1a1a1a] transition-colors"
        >
          Disconnected - Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <StatusIndicator />

      <Select
        value={selectedService?.id || ''}
        onValueChange={(value) => {
          if (value === '__add_custom__') {
            setShowAddCustom(true);
          } else {
            selectService(value);
          }
        }}
      >
        <SelectTrigger
          className={cn(
            'w-[180px] border-gray-200 bg-white text-sm',
            'hover:border-gray-300 focus:ring-gray-300',
            'transition-all duration-200'
          )}
        >
          <SelectValue placeholder="Select service...">
            {selectedService && (
              <span className="flex items-center gap-2">
                <span className="text-gray-400 font-mono text-xs">
                  {selectedService.id.slice(0, 4)}...
                </span>
                <span className="truncate text-[#1a1a1a]">{selectedService.name}</span>
              </span>
            )}
          </SelectValue>
        </SelectTrigger>

        <SelectContent className="bg-white border-gray-200 shadow-lg">
          <SelectGroup>
            <SelectLabel className="text-gray-400 text-xs uppercase tracking-wider">Services</SelectLabel>
            {services.map((service) => (
              <SelectItem
                key={service.id}
                value={service.id}
                className="focus:bg-gray-100 cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <span className="text-gray-400 font-mono text-xs">
                    {service.id.slice(0, 4)}...
                  </span>
                  <span>{service.name}</span>
                  {service.version && (
                    <span className="text-gray-400 text-xs">v{service.version}</span>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>

          <SelectSeparator className="bg-gray-200" />

          <SelectGroup>
            <SelectItem
              value="__add_custom__"
              className="focus:bg-gray-100 text-[#E6007A] cursor-pointer"
            >
              + Add custom service
            </SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      {/* Custom service ID modal */}
      {showAddCustom && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white border border-gray-200 rounded-lg p-6 w-96 shadow-xl">
            <h3 className="text-[#1a1a1a] font-semibold text-lg mb-2">Add Custom Service</h3>
            <p className="text-gray-500 text-sm mb-4">
              Enter the 8-character hex service ID from the chain
            </p>

            <Input
              value={customId}
              onChange={(e) => setCustomId(e.target.value)}
              placeholder="e.g., 8a851331"
              className="bg-white border-gray-200 text-[#1a1a1a] font-mono mb-4 focus:border-gray-400 focus:ring-gray-200"
              maxLength={8}
            />

            {error && (
              <p className="text-red-600 text-sm mb-4 bg-red-50 p-2 rounded-lg border border-red-200">{error}</p>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowAddCustom(false);
                  setCustomId('');
                }}
                className="border-gray-200 text-gray-600 hover:text-[#1a1a1a] hover:bg-gray-50"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddCustom}
                disabled={!customId.trim() || isAddingCustom}
                className="bg-[#1a1a1a] hover:bg-[#333] text-white"
              >
                {isAddingCustom ? 'Adding...' : 'Add Service'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
