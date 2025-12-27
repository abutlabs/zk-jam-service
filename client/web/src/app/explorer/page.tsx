'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerificationHistory } from '@/components/VerificationHistory';
import { getHistory, getStats, getRecordsBySlot, type VerificationRecord } from '@/lib/history';
import { useService } from '@/contexts/ServiceContext';
import Link from 'next/link';

interface NetworkData {
  currentSlot: number | null;
  serviceInfo: {
    name: string;
    version: string;
    author: string;
  } | null;
  loading: boolean;
  error?: string;
}

export default function ExplorerPage() {
  const { selectedService } = useService();
  const [networkData, setNetworkData] = useState<NetworkData>({
    currentSlot: null,
    serviceInfo: null,
    loading: true,
  });
  const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0, pending: 0, failed: 0 });
  const [recentSlots, setRecentSlots] = useState<number[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [slotRecords, setSlotRecords] = useState<VerificationRecord[]>([]);
  const [historyKey, setHistoryKey] = useState(0);

  const serviceId = selectedService?.id || '';

  // Fetch network data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const url = serviceId ? `/api/network?serviceId=${serviceId}` : '/api/network';
        const response = await fetch(url);
        if (response.ok) {
          const data = await response.json();
          setNetworkData({
            currentSlot: data.currentSlot,
            serviceInfo: data.serviceInfo || (selectedService ? {
              name: selectedService.name,
              version: selectedService.version || '',
              author: selectedService.author || '',
            } : null),
            loading: false,
          });
          if (data.currentSlot) {
            setRecentSlots(
              Array.from({ length: 10 }, (_, i) => data.currentSlot - i).filter(s => s > 0)
            );
          }
        } else {
          throw new Error('Failed to fetch');
        }
      } catch {
        // Fallback: try to get from history's anchor slots
        const history = getHistory();
        const slots = [...new Set(history.map(r => r.anchorSlot).filter(Boolean))] as number[];
        slots.sort((a, b) => b - a);
        setRecentSlots(slots.slice(0, 10));
        setNetworkData(prev => ({ ...prev, loading: false, error: 'Network unavailable' }));
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 6000); // Refresh every 6 seconds (slot time)
    return () => clearInterval(interval);
  }, [serviceId, selectedService]);

  // Update stats from local history
  useEffect(() => {
    const updateStats = () => {
      setStats(getStats());
    };
    updateStats();
    const interval = setInterval(updateStats, 2000);
    return () => clearInterval(interval);
  }, [historyKey]);

  // Get records for selected slot
  useEffect(() => {
    if (selectedSlot !== null) {
      setSlotRecords(getRecordsBySlot(selectedSlot));
    }
  }, [selectedSlot, historyKey]);

  // Get slots that have verifications
  const history = getHistory();
  const slotsWithVerifications = new Set(history.map(r => r.anchorSlot).filter(Boolean));

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="section-title">
          Service Explorer
        </h1>
        <p className="section-description max-w-2xl mx-auto">
          Explore the JAM network state, view recent blocks, and track your verification history.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Current Slot */}
        <Card className="card-clean">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-500">Current Slot</CardDescription>
            <CardTitle className="text-2xl font-mono text-[#1a1a1a]">
              {networkData.loading ? (
                <span className="text-gray-400">Loading...</span>
              ) : networkData.currentSlot ? (
                `#${networkData.currentSlot.toLocaleString()}`
              ) : (
                <span className="text-gray-400">---</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Service */}
        <Card className="card-clean">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-500">Active Service</CardDescription>
            <CardTitle className="text-lg truncate text-[#1a1a1a]">
              {networkData.serviceInfo?.name ?? 'zk-jam-service'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <code className="text-xs text-[#E6007A]">{serviceId || 'No service selected'}</code>
          </CardContent>
        </Card>

        {/* Total Verifications */}
        <Card className="card-clean">
          <CardHeader className="pb-2">
            <CardDescription className="text-gray-500">Total Submissions</CardDescription>
            <CardTitle className="text-2xl font-mono text-[#1a1a1a]">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        {/* Valid */}
        <Card className="bg-green-50 border-green-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-600">Valid</CardDescription>
            <CardTitle className="text-2xl font-mono text-green-700">{stats.valid}</CardTitle>
          </CardHeader>
        </Card>

        {/* Invalid */}
        <Card className="bg-red-50 border-red-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-600">Invalid</CardDescription>
            <CardTitle className="text-2xl font-mono text-red-700">{stats.invalid}</CardTitle>
          </CardHeader>
        </Card>

        {/* Pending */}
        <Card className="bg-yellow-50 border-yellow-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-600">Pending</CardDescription>
            <CardTitle className="text-2xl font-mono text-yellow-700">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Slots with Verification Indicators */}
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-[#1a1a1a]">Recent Slots</CardTitle>
          <CardDescription className="text-gray-500">
            Click a slot to see verifications submitted at that block. Highlighted slots contain your submissions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {recentSlots.length > 0 ? (
              recentSlots.map((slot) => {
                const hasVerifications = slotsWithVerifications.has(slot);
                const isSelected = selectedSlot === slot;
                const recordsCount = getRecordsBySlot(slot).length;

                return (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(isSelected ? null : slot)}
                    className={`
                      relative rounded-lg p-4 text-center transition-all
                      ${isSelected
                        ? 'bg-[#1a1a1a] text-white ring-2 ring-[#1a1a1a]'
                        : hasVerifications
                          ? 'bg-pink-50 border-2 border-[#E6007A]/50 hover:border-[#E6007A]'
                          : 'bg-gray-50 hover:bg-gray-100 border border-gray-200'
                      }
                    `}
                  >
                    {hasVerifications && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-[#E6007A] text-white rounded-full flex items-center justify-center text-xs font-bold">
                        {recordsCount}
                      </div>
                    )}
                    <div className={`text-xs mb-1 ${isSelected ? 'text-white/60' : 'text-gray-500'}`}>Slot</div>
                    <div className={`font-mono text-lg ${isSelected ? 'text-white' : 'text-[#1a1a1a]'}`}>#{slot}</div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8 text-gray-500">
                {networkData.loading ? 'Loading slots...' : 'No slots available'}
              </div>
            )}
          </div>

          {/* Selected Slot Details */}
          {selectedSlot !== null && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-[#1a1a1a]">
                  Slot #{selectedSlot} Verifications
                </h3>
                <Badge variant="outline" className="badge-default">
                  {slotRecords.length} submission{slotRecords.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {slotRecords.length > 0 ? (
                <div className="space-y-2">
                  {slotRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          h-8 w-8 rounded-full flex items-center justify-center text-sm
                          ${record.result === 'valid' ? 'bg-green-100 text-green-700' :
                            record.result === 'invalid' ? 'bg-red-100 text-red-700' :
                            'bg-gray-100 text-gray-600'}
                        `}>
                          {record.result === 'valid' ? '✓' : record.result === 'invalid' ? '✗' : '?'}
                        </div>
                        <div>
                          <div className="font-mono text-sm text-[#1a1a1a] truncate max-w-48">
                            {record.preimage.length > 20 ? record.preimage.slice(0, 20) + '...' : record.preimage}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.tampered && (
                          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                            Tampered
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs ${
                          record.result === 'valid' ? 'bg-green-50 text-green-700 border-green-200' :
                          record.result === 'invalid' ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {record.result ?? record.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-gray-500">
                  No verifications found for this slot
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Full Verification History */}
      <VerificationHistory key={historyKey} maxItems={20} showStats={true} />

      {/* Service Info */}
      {networkData.serviceInfo && (
        <Card className="card-clean">
          <CardHeader>
            <CardTitle className="text-[#1a1a1a]">Service Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-gray-500 mb-1">Name</div>
                <div className="font-medium text-[#1a1a1a]">{networkData.serviceInfo.name}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Version</div>
                <div className="font-medium text-[#1a1a1a]">v{networkData.serviceInfo.version}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Author</div>
                <div className="font-medium text-[#1a1a1a]">{networkData.serviceInfo.author}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex justify-center gap-4">
        <Link
          href="/verify"
          className="btn-primary"
        >
          Submit Verification
        </Link>
        <Button
          variant="outline"
          onClick={() => {
            setHistoryKey(k => k + 1);
            window.location.reload();
          }}
          className="border-gray-200 text-gray-600 hover:text-[#1a1a1a] hover:bg-gray-50"
        >
          Refresh Data
        </Button>
      </div>

      {/* Network Error */}
      {networkData.error && (
        <div className="text-center text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          {networkData.error}. Showing local history only.
        </div>
      )}
    </div>
  );
}
