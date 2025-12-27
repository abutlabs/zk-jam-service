'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getHistory, clearHistory, getStats, type VerificationRecord } from '@/lib/history';
import { cn } from '@/lib/utils';

interface VerificationHistoryProps {
  filterSlot?: number;
  maxItems?: number;
  showStats?: boolean;
}

export function VerificationHistory({ filterSlot, maxItems = 10, showStats = true }: VerificationHistoryProps) {
  const [history, setHistory] = useState<VerificationRecord[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [stats, setStats] = useState({ total: 0, valid: 0, invalid: 0, pending: 0, failed: 0 });

  useEffect(() => {
    const loadHistory = () => {
      let records = getHistory();
      if (filterSlot !== undefined) {
        records = records.filter(r => r.anchorSlot === filterSlot);
      }
      setHistory(records.slice(0, maxItems));
      setStats(getStats());
    };

    loadHistory();
    // Refresh every 5 seconds
    const interval = setInterval(loadHistory, 5000);
    return () => clearInterval(interval);
  }, [filterSlot, maxItems]);

  const handleClear = () => {
    if (confirm('Clear all verification history?')) {
      clearHistory();
      setHistory([]);
      setStats({ total: 0, valid: 0, invalid: 0, pending: 0, failed: 0 });
    }
  };

  const getStatusColor = (status: VerificationRecord['status']) => {
    switch (status) {
      case 'accumulated':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'failed':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'pending':
      case 'submitted':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'refining':
      case 'auditing':
        return 'bg-pink-50 text-[#E6007A] border-pink-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const getResultColor = (result?: VerificationRecord['result']) => {
    switch (result) {
      case 'valid':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'invalid':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'error':
        return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      default:
        return 'bg-gray-50 text-gray-600 border-gray-200';
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (history.length === 0) {
    return (
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-[#1a1a1a]">Verification History</CardTitle>
          <CardDescription className="text-gray-500">
            Track your hash verification submissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-gray-400">
            <div className="text-4xl mb-4">📋</div>
            <p>No verifications yet</p>
            <p className="text-sm mt-2">Submit a hash verification to see it here</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-clean">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[#1a1a1a]">Verification History</CardTitle>
            <CardDescription className="text-gray-500">
              Track your hash verification submissions
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="border-gray-200 text-gray-600 hover:text-[#1a1a1a] hover:bg-gray-50"
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats */}
        {showStats && (
          <div className="grid grid-cols-5 gap-2 mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-[#1a1a1a]">{stats.total}</div>
              <div className="text-xs text-gray-500">Total</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-green-700">{stats.valid}</div>
              <div className="text-xs text-green-600">Valid</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-red-700">{stats.invalid}</div>
              <div className="text-xs text-red-600">Invalid</div>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-yellow-700">{stats.pending}</div>
              <div className="text-xs text-yellow-600">Pending</div>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-2 text-center">
              <div className="text-lg font-bold text-gray-600">{stats.failed}</div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
          </div>
        )}

        {/* History List */}
        <div className="space-y-2">
          {history.map((record) => (
            <div
              key={record.id}
              className={cn(
                'bg-white rounded-lg border transition-all cursor-pointer',
                expandedId === record.id ? 'border-[#E6007A]/50 shadow-sm' : 'border-gray-200 hover:border-gray-300'
              )}
            >
              {/* Collapsed Header */}
              <div
                className="p-4 flex items-center justify-between"
                onClick={() => setExpandedId(expandedId === record.id ? null : record.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Status Icon */}
                  <div className={cn(
                    'h-10 w-10 rounded-full flex items-center justify-center text-lg',
                    record.result === 'valid' ? 'bg-green-100 text-green-700' :
                    record.result === 'invalid' ? 'bg-red-100 text-red-700' :
                    record.status === 'failed' ? 'bg-red-100 text-red-700' :
                    'bg-pink-100 text-[#E6007A]'
                  )}>
                    {record.result === 'valid' ? '✓' :
                     record.result === 'invalid' ? '✗' :
                     record.status === 'failed' ? '!' :
                     record.tampered ? '🔧' : '📤'}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-[#1a1a1a] truncate max-w-48">
                        {record.preimage.length > 24
                          ? record.preimage.slice(0, 24) + '...'
                          : record.preimage}
                      </span>
                      {record.tampered && (
                        <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                          Tampered
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                      <span>{formatDate(record.timestamp)}</span>
                      <span>{formatTime(record.timestamp)}</span>
                      {record.anchorSlot && (
                        <>
                          <span>•</span>
                          <span>Slot #{record.anchorSlot}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={cn('text-xs', getStatusColor(record.status))}>
                    {record.status}
                  </Badge>
                  <span className={cn(
                    'text-lg text-gray-400 transition-transform',
                    expandedId === record.id ? 'rotate-180' : ''
                  )}>
                    ▼
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedId === record.id && (
                <div className="px-4 pb-4 space-y-4">
                  <Separator className="bg-gray-200" />

                  {/* Result */}
                  {record.result && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-20">Result:</span>
                      <Badge variant="outline" className={cn('text-sm', getResultColor(record.result))}>
                        {record.result === 'valid' ? '✓ Hash Verified' :
                         record.result === 'invalid' ? '✗ Hash Mismatch' :
                         'Error'}
                      </Badge>
                    </div>
                  )}

                  {/* Preimage */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Preimage (input text)</div>
                    <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-sm text-[#1a1a1a] break-all">
                      {record.preimage}
                    </code>
                  </div>

                  {/* Hash */}
                  <div>
                    <div className="text-xs text-gray-500 mb-1">Blake2s-256 Hash</div>
                    <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-xs text-green-700 break-all font-mono">
                      {record.hash}
                    </code>
                  </div>

                  {/* Payload Breakdown */}
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-3">
                    <div className="text-xs font-medium text-[#E6007A]">Payload Breakdown (what was sent to JAM)</div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">Expected Hash (bytes 0-31)</div>
                      <code className="block bg-white border border-gray-200 p-2 rounded text-xs text-yellow-700 break-all font-mono">
                        {record.payloadBreakdown.expectedHash}
                      </code>
                      {record.tampered && (
                        <div className="text-xs text-yellow-600 mt-1">
                          ⚠️ This hash was intentionally modified to test failure
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 mb-1">Preimage (bytes 32+)</div>
                      <code className="block bg-white border border-gray-200 p-2 rounded text-xs text-blue-700 break-all font-mono">
                        {record.payloadBreakdown.preimageHex}
                      </code>
                    </div>

                    <div className="text-xs text-gray-600 bg-white border border-gray-200 p-2 rounded">
                      <strong className="text-[#1a1a1a]">How it works:</strong> The service receives this payload, splits it at byte 32,
                      re-hashes the preimage using Blake2s-256, and compares to the expected hash.
                      {record.tampered
                        ? ' Since the hash was tampered, they won\'t match → Invalid'
                        : ' If they match → Valid'}
                    </div>
                  </div>

                  {/* Package ID */}
                  {record.packageId && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Package ID</div>
                      <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-xs text-[#E6007A] break-all font-mono">
                        {record.packageId}
                      </code>
                    </div>
                  )}

                  {/* Error */}
                  {record.error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-xs text-red-600 font-medium mb-1">Error</div>
                      <p className="text-sm text-red-700">{record.error}</p>
                    </div>
                  )}

                  {/* Full Payload */}
                  <details className="text-xs">
                    <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                      View full payload hex
                    </summary>
                    <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-gray-600 break-all font-mono mt-2">
                      {record.payload}
                    </code>
                  </details>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
