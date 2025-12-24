'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { VerificationHistory } from '@/components/VerificationHistory';
import { getHistory, getStats, getRecordsBySlot, type VerificationRecord } from '@/lib/history';
import Link from 'next/link';

// Default service ID
const SERVICE_ID = process.env.NEXT_PUBLIC_JAM_SERVICE_ID || '99fbfec5';

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

  // Fetch network data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/network');
        if (response.ok) {
          const data = await response.json();
          setNetworkData({
            currentSlot: data.currentSlot,
            serviceInfo: data.serviceInfo,
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
  }, []);

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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Service Explorer
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Explore the JAM network state, view recent blocks, and track your verification history.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {/* Current Slot */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Current Slot</CardDescription>
            <CardTitle className="text-2xl font-mono">
              {networkData.loading ? (
                <span className="text-zinc-500">Loading...</span>
              ) : networkData.currentSlot ? (
                `#${networkData.currentSlot.toLocaleString()}`
              ) : (
                <span className="text-zinc-500">---</span>
              )}
            </CardTitle>
          </CardHeader>
        </Card>

        {/* Service */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Active Service</CardDescription>
            <CardTitle className="text-lg truncate">
              {networkData.serviceInfo?.name ?? 'zk-jam-service'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <code className="text-xs text-purple-400">{SERVICE_ID}</code>
          </CardContent>
        </Card>

        {/* Total Verifications */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Total Submissions</CardDescription>
            <CardTitle className="text-2xl font-mono">{stats.total}</CardTitle>
          </CardHeader>
        </Card>

        {/* Valid */}
        <Card className="bg-green-500/10 border-green-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-green-400/70">Valid</CardDescription>
            <CardTitle className="text-2xl font-mono text-green-400">{stats.valid}</CardTitle>
          </CardHeader>
        </Card>

        {/* Invalid */}
        <Card className="bg-red-500/10 border-red-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-red-400/70">Invalid</CardDescription>
            <CardTitle className="text-2xl font-mono text-red-400">{stats.invalid}</CardTitle>
          </CardHeader>
        </Card>

        {/* Pending */}
        <Card className="bg-yellow-500/10 border-yellow-500/30">
          <CardHeader className="pb-2">
            <CardDescription className="text-yellow-400/70">Pending</CardDescription>
            <CardTitle className="text-2xl font-mono text-yellow-400">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Recent Slots with Verification Indicators */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Recent Slots</CardTitle>
          <CardDescription>
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
                        ? 'bg-purple-600 ring-2 ring-purple-400'
                        : hasVerifications
                          ? 'bg-purple-500/20 border-2 border-purple-500/50 hover:border-purple-400'
                          : 'bg-zinc-800 hover:bg-zinc-700 border border-zinc-700'
                      }
                    `}
                  >
                    {hasVerifications && (
                      <div className="absolute -top-1 -right-1 h-5 w-5 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold">
                        {recordsCount}
                      </div>
                    )}
                    <div className="text-xs text-zinc-500 mb-1">Slot</div>
                    <div className="font-mono text-lg text-white">#{slot}</div>
                  </button>
                );
              })
            ) : (
              <div className="col-span-full text-center py-8 text-zinc-500">
                {networkData.loading ? 'Loading slots...' : 'No slots available'}
              </div>
            )}
          </div>

          {/* Selected Slot Details */}
          {selectedSlot !== null && (
            <div className="mt-6 p-4 bg-zinc-800/50 rounded-lg border border-purple-500/30">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-purple-400">
                  Slot #{selectedSlot} Verifications
                </h3>
                <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                  {slotRecords.length} submission{slotRecords.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {slotRecords.length > 0 ? (
                <div className="space-y-2">
                  {slotRecords.map((record) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          h-8 w-8 rounded-full flex items-center justify-center text-sm
                          ${record.result === 'valid' ? 'bg-green-500/20 text-green-400' :
                            record.result === 'invalid' ? 'bg-red-500/20 text-red-400' :
                            'bg-zinc-700 text-zinc-400'}
                        `}>
                          {record.result === 'valid' ? '✓' : record.result === 'invalid' ? '✗' : '?'}
                        </div>
                        <div>
                          <div className="font-mono text-sm text-white truncate max-w-48">
                            {record.preimage.length > 20 ? record.preimage.slice(0, 20) + '...' : record.preimage}
                          </div>
                          <div className="text-xs text-zinc-500">
                            {new Date(record.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {record.tampered && (
                          <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                            Tampered
                          </Badge>
                        )}
                        <Badge variant="outline" className={`text-xs ${
                          record.result === 'valid' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                          record.result === 'invalid' ? 'bg-red-500/10 text-red-400 border-red-500/30' :
                          'bg-zinc-500/10 text-zinc-400 border-zinc-500/30'
                        }`}>
                          {record.result ?? record.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-zinc-500">
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
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Service Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Name</div>
                <div className="font-medium">{networkData.serviceInfo.name}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Version</div>
                <div className="font-medium">v{networkData.serviceInfo.version}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Author</div>
                <div className="font-medium">{networkData.serviceInfo.author}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex justify-center gap-4">
        <Link
          href="/verify"
          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
        >
          Submit Verification
        </Link>
        <Button
          variant="outline"
          onClick={() => {
            setHistoryKey(k => k + 1);
            window.location.reload();
          }}
        >
          Refresh Data
        </Button>
      </div>

      {/* Network Error */}
      {networkData.error && (
        <div className="text-center text-sm text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          {networkData.error}. Showing local history only.
        </div>
      )}
    </div>
  );
}
