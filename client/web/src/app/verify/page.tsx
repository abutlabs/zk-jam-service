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
import { useService } from '@/contexts/ServiceContext';

type SubmissionState = 'idle' | 'hashing' | 'submitting' | 'success' | 'error';

interface SubmissionResult {
  hash: string;
  payload: string;
  packageId?: string;
  slot?: number;
  error?: string;
}

export default function VerifyPage() {
  const { selectedService } = useService();
  const [preimage, setPreimage] = useState('');
  const [hash, setHash] = useState<string | null>(null);
  const [tamper, setTamper] = useState(false);
  const [state, setState] = useState<SubmissionState>('idle');
  const [result, setResult] = useState<SubmissionResult | null>(null);
  const [pipelineStage, setPipelineStage] = useState<'submit' | 'refine' | 'audit' | 'accumulate' | 'complete' | undefined>();
  const [currentRecordId, setCurrentRecordId] = useState<string | null>(null);
  const [historyKey, setHistoryKey] = useState(0); // Force re-render of history

  const serviceId = selectedService?.id || '';

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
      const submitResult = await submitHashVerification(serviceId, preimage, tamper);

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
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="section-title">
          Hash Verification
        </h1>
        <p className="section-description max-w-2xl mx-auto">
          Submit a preimage and its Blake2s-256 hash to the JAM service for verification.
          This demonstrates the Refine → Accumulate pipeline.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Form */}
        <Card className="card-clean">
          <CardHeader>
            <CardTitle className="text-[#1a1a1a]">Submit Work Item</CardTitle>
            <CardDescription className="text-gray-500">
              Enter a string to hash and verify on-chain
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Preimage Input */}
            <div className="space-y-2">
              <Label htmlFor="preimage" className="text-gray-600">Preimage (text to hash)</Label>
              <Input
                id="preimage"
                placeholder="Enter text to hash..."
                value={preimage}
                onChange={(e) => setPreimage(e.target.value)}
                className="bg-white border-gray-200 text-[#1a1a1a] focus:border-gray-400 focus:ring-gray-200"
                disabled={state === 'submitting'}
              />
            </div>

            {/* Compute Hash Button */}
            <Button
              variant="outline"
              onClick={handleComputeHash}
              disabled={!preimage || state === 'submitting'}
              className="w-full border-gray-200 text-gray-600 hover:text-[#1a1a1a] hover:bg-gray-50 hover:border-gray-300"
            >
              Compute Blake2s-256 Hash
            </Button>

            {/* Hash Display */}
            {hash && (
              <div className="space-y-2">
                <Label className="text-gray-600">Computed Hash</Label>
                <code className="block bg-gray-100 border border-gray-200 p-3 rounded-lg text-sm text-green-700 break-all font-mono">
                  {hash}
                </code>
              </div>
            )}

            {/* Tamper Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
              <input
                type="checkbox"
                id="tamper"
                checked={tamper}
                onChange={(e) => setTamper(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 bg-white accent-[#E6007A]"
                disabled={state === 'submitting'}
              />
              <div>
                <Label htmlFor="tamper" className="text-sm font-medium cursor-pointer text-[#1a1a1a]">
                  Tamper with hash (for testing)
                </Label>
                <p className="text-xs text-gray-500">
                  This will intentionally corrupt the hash to test verification failure
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSubmit}
                disabled={!preimage || state === 'submitting' || !serviceId}
                className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white"
              >
                {state === 'submitting' ? 'Submitting...' : !serviceId ? 'Select a service' : 'Submit to JAM'}
              </Button>
              <Button
                variant="outline"
                onClick={handleReset}
                disabled={state === 'submitting'}
                className="border-gray-200 text-gray-600 hover:text-[#1a1a1a] hover:bg-gray-50"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <Card className="card-clean">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#1a1a1a]">
              Result
              {state === 'success' && (
                <Badge className="badge-success">
                  Submitted
                </Badge>
              )}
              {state === 'error' && (
                <Badge className="badge-error">
                  Error
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-gray-500">
              Work item submission result
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!result && state === 'idle' && (
              <div className="text-center py-12 text-gray-400">
                Submit a work item to see results
              </div>
            )}

            {state === 'submitting' && (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-2 border-[#1a1a1a] border-t-transparent rounded-full mx-auto mb-4" />
                <p className="text-gray-500">Submitting work item...</p>
              </div>
            )}

            {result && state !== 'submitting' && (
              <div className="space-y-4">
                {/* Expected Result */}
                <div className="p-3 rounded-lg bg-gray-50 border border-gray-200">
                  <Label className="text-gray-500 text-xs">Expected Outcome</Label>
                  <div className="flex items-center gap-2 mt-1">
                    {tamper ? (
                      <>
                        <Badge className="badge-error">
                          Invalid
                        </Badge>
                        <span className="text-xs text-gray-500">Hash was tampered - verification should fail</span>
                      </>
                    ) : (
                      <>
                        <Badge className="badge-success">
                          Valid
                        </Badge>
                        <span className="text-xs text-gray-500">Hash matches - verification should pass</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Hash */}
                <div>
                  <Label className="text-gray-500 text-xs">Hash</Label>
                  <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-xs text-green-700 break-all font-mono mt-1">
                    {result.hash}
                  </code>
                </div>

                {/* Package ID */}
                {result.packageId && (
                  <div>
                    <Label className="text-gray-500 text-xs">Package ID</Label>
                    <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-xs text-[#E6007A] break-all font-mono mt-1">
                      {result.packageId}
                    </code>
                  </div>
                )}

                {/* Anchor Slot */}
                {result.slot && (
                  <div>
                    <Label className="text-gray-500 text-xs">Anchor Slot</Label>
                    <p className="text-[#1a1a1a] font-mono mt-1">#{result.slot}</p>
                  </div>
                )}

                {/* Error */}
                {result.error && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200">
                    <Label className="text-red-600 text-xs">Error</Label>
                    <p className="text-red-700 text-sm mt-1">{result.error}</p>
                  </div>
                )}

                {/* Payload */}
                <details className="text-xs">
                  <summary className="text-gray-500 cursor-pointer hover:text-gray-700">
                    View payload hex
                  </summary>
                  <code className="block bg-gray-100 border border-gray-200 p-2 rounded text-gray-600 break-all font-mono mt-2">
                    {result.payload}
                  </code>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization */}
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-[#1a1a1a]">Pipeline Status</CardTitle>
          <CardDescription className="text-gray-500">
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
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-[#1a1a1a]">How Hash Verification Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-gray-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg text-[#1a1a1a]">1.</span>
                <Badge variant="outline" className="badge-default">Input</Badge>
              </div>
              <p>
                You provide a preimage (any text) and we compute its Blake2s-256 hash locally.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg text-[#1a1a1a]">2.</span>
                <Badge className="badge-pink">
                  Refine
                </Badge>
              </div>
              <p>
                The service re-computes the hash on a validator core and compares it to your submitted hash.
              </p>
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg text-[#1a1a1a]">3.</span>
                <Badge className="badge-success">
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
