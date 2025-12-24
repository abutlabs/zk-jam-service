'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Pipeline } from '@/components/Pipeline';
import { VerificationHistory } from '@/components/VerificationHistory';
import { computeBlake2sHash, submitHashVerification } from '../actions/jam';
import { addRecord, updateRecord, parsePayload, type VerificationRecord } from '@/lib/history';

// Default service ID
const SERVICE_ID = process.env.NEXT_PUBLIC_JAM_SERVICE_ID || '99fbfec5';

type SubmissionState = 'idle' | 'hashing' | 'submitting' | 'success' | 'error';

interface SubmissionResult {
  hash: string;
  payload: string;
  packageId?: string;
  slot?: number;
  error?: string;
}

export default function VerifyPage() {
  const [preimage, setPreimage] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const [tamper, setTamper] = useState(false);
  const [state, setState] = useState<SubmissionState>('idle');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [pipelineStage, setPipelineStage] = useState<'submit' | 'refine' | 'audit' | 'accumulate' | 'complete' | undefined>();
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0); // Force re-render of history

  const handleComputeHash = async () => {
    if (!preimage) return;
    setState('hashing');
    const computed = await computeBlake2sHash(preimage);
    setHash(computed);
    setState('idle');
  };

  const handleSubmit = async () => {
    if (!preimage) return;

    setState('submitting');
    setPipelineStage('submit');

    // Compute hash first if not done
    const computedHash = hash || await computeBlake2sHash(preimage);
    if (!hash) setHash(computedHash);

    try {
      const submitResult = await submitHashVerification(SERVICE_ID, preimage, tamper);

      // Parse the payload for educational breakdown
      const payloadBreakdown = parsePayload(submitResult.payload);

      // Create history record
      const record = addRecord({
        preimage,
        hash: submitResult.hash,
        payload: submitResult.payload,
        tampered: tamper,
        packageId: submitResult.packageId,
        anchorSlot: submitResult.slot,
        status: submitResult.success ? 'submitted' : 'failed',
        result: tamper ? 'invalid' : 'valid', // Expected result based on tamper flag
        error: submitResult.error,
        payloadBreakdown,
      });

      setCurrentRecordId(record.id);
      setHistoryKey(k => k + 1); // Refresh history display

      setResult({
        hash: submitResult.hash,
        payload: submitResult.payload,
        packageId: submitResult.packageId,
        slot: submitResult.slot,
        error: submitResult.error,
      });

      if (submitResult.success) {
        setState('success');

        // Simulate pipeline progression and update record status
        setPipelineStage('refine');
        updateRecord(record.id, { status: 'refining' });

        setTimeout(() => {
          setPipelineStage('audit');
          updateRecord(record.id, { status: 'auditing' });
          setHistoryKey(k => k + 1);
        }, 2000);

        setTimeout(() => {
          setPipelineStage('accumulate');
          updateRecord(record.id, { status: 'accumulated' });
          setHistoryKey(k => k + 1);
        }, 4000);

        setTimeout(() => {
          setPipelineStage('complete');
          setHistoryKey(k => k + 1);
        }, 6000);
      } else {
        setState('error');
        setPipelineStage(undefined);
      }
    } catch (err) {
      setState('error');
      setResult({
        hash: hash || '',
        payload: '',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      setPipelineStage(undefined);
    }
  };

  const handleReset = () => {
    setPreimage('');
    setHash(null);
    setTamper(false);
    setState('idle');
    setResult(null);
    setPipelineStage(undefined);
    setCurrentRecordId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Hash Verification Demo
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Submit a preimage and its Blake2s-256 hash to the JAM service for verification.
          This demonstrates the Refine → Accumulate pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input Form */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle>Submit Work Item</CardTitle>
            <CardDescription>
              Enter a string to hash and verify on-chain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preimage Input */}
            <div className="space-y-2">
              <Label htmlFor="preimage">Preimage (text to hash)</Label>
              <Input
                id="preimage"
                placeholder="Enter text to hash..."
                value={preimage}
                onChange={(e) => setPreimage(e.target.value)}
                className="bg-zinc-800 border-zinc-700"
                disabled={state === 'submitting'}
              />
            </div>

            {/* Compute Hash Button */}
            <Button
              variant="outline"
              onClick={handleComputeHash}
              disabled={!preimage || state === 'submitting'}
              className="w-full"
            >
              Compute Blake2s-256 Hash
            </Button>

            {/* Hash Display */}
            {hash && (
              <div className="space-y-2">
                <Label>Computed Hash</Label>
                <code className="block bg-zinc-800 p-3 rounded-lg text-sm text-green-400 break-all font-mono">
                  {hash}
                </code>
              </div>
            )}

            {/* Tamper Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 border border-zinc-700">
              <input
                type="checkbox"
                id="tamper"
                checked={tamper}
                onChange={(e) => setTamper(e.target.checked)}
                className="h-4 w-4 rounded border-zinc-600"
                disabled={state === 'submitting'}
              />
              <div>
                <Label htmlFor="tamper" className="text-sm font-medium cursor-pointer">
                  Tamper with hash (for testing)
                </Label>
                <p className="text-xs text-zinc-500">
                  This will intentionally corrupt the hash to test verification failure
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!preimage || state === 'submitting'}
                className="flex-1 bg-purple-600 hover:bg-purple-700"
              >
                {state === 'submitting' ? 'Submitting...' : 'Submit to JAM'}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={state === 'submitting'}
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Result
              {state === 'success' && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                  Submitted
                </Badge>
              )}
              {state === 'error' && (
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                  Error
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Work item submission result
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result && state === 'idle' && (
              <div className="text-center py-12 text-zinc-500">
                Submit a work item to see results
              </div>
            )}

            {state === 'submitting' && (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-zinc-400">Submitting work item...</p>
              </div>
            )}

            {result && state !== 'submitting' && (
              <div className="space-y-4">
                {/* Expected Result */}
                <div className="p-3 rounded-lg bg-zinc-800/50">
                  <Label className="text-zinc-400 text-xs">Expected Outcome</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {tamper ? (
                      <>
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          Invalid
                        </Badge>
                        <span className="text-xs text-zinc-500">Hash was tampered - verification should fail</span>
                      </>
                    ) : (
                      <>
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Valid
                        </Badge>
                        <span className="text-xs text-zinc-500">Hash matches - verification should pass</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Hash */}
                <div>
                  <Label className="text-zinc-400 text-xs">Hash</Label>
                  <code className="block bg-zinc-800 p-2 rounded text-xs text-green-400 break-all font-mono mt-1">
                    {result.hash}
                  </code>
                </div>

                {/* Package ID */}
                {result.packageId && (
                  <div>
                    <Label className="text-zinc-400 text-xs">Package ID</Label>
                    <code className="block bg-zinc-800 p-2 rounded text-xs text-purple-400 break-all font-mono mt-1">
                      {result.packageId}
                    </code>
                  </div>
                )}

                {/* Anchor Slot */}
                {result.slot && (
                  <div>
                    <Label className="text-zinc-400 text-xs">Anchor Slot</Label>
                    <p className="text-white font-mono mt-1">#{result.slot}</p>
                  </div>
                )}

                {/* Error */}
                {result.error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                    <Label className="text-red-400 text-xs">Error</Label>
                    <p className="text-red-300 text-sm mt-1">{result.error}</p>
                  </div>
                )}

                {/* Payload */}
                <details className="text-xs">
                  <summary className="text-zinc-500 cursor-pointer hover:text-zinc-400">
                    View payload hex
                  </summary>
                  <code className="block bg-zinc-800 p-2 rounded text-zinc-400 break-all font-mono mt-2">
                    {result.payload}
                  </code>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
          <CardDescription>
            Track the work item through the JAM pipeline
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Pipeline activeStage={pipelineStage} />
        </CardContent>
      </Card>

      {/* Verification History */}
      <VerificationHistory key={historyKey} maxItems={5} showStats={false} />

      {/* Explanation */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>How Hash Verification Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-zinc-400">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">1.</span>
                <Badge variant="outline">Input</Badge>
              </div>
              <p>
                You provide a preimage (any text) and we compute its Blake2s-256 hash locally.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">2.</span>
                <Badge variant="outline" className="text-purple-400 border-purple-500/30">
                  Refine
                </Badge>
              </div>
              <p>
                The service re-computes the hash on a validator core and compares it to your submitted hash.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">3.</span>
                <Badge variant="outline" className="text-green-400 border-green-500/30">
                  Accumulate
                </Badge>
              </div>
              <p>
                The verification result is written to on-chain storage, updating the count of valid/invalid submissions.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
