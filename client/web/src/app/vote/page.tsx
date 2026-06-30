'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useService } from '@/contexts/ServiceContext';
import { submitVote, getVoteTally } from '../actions/jam';

const MEMBERS = 16; // demo eligibility set size (Merkle depth 4)

type Msg = { kind: 'ok' | 'err' | 'info'; text: string };

export default function VotePage() {
  const { selectedService } = useService();
  const serviceId = selectedService?.id || '';

  const [voter, setVoter] = useState(0);
  const [vote, setVote] = useState<0 | 1>(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<Msg | null>(null);
  const [tally, setTally] = useState<{ yes: number; no: number; total: number } | null>(null);

  const refresh = useCallback(async () => {
    if (!serviceId) return;
    const t = await getVoteTally(serviceId);
    if (!t.error) setTally({ yes: t.yes, no: t.no, total: t.total });
  }, [serviceId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function cast() {
    if (!serviceId) {
      setMsg({ kind: 'err', text: 'Select the voting service (top-right) first.' });
      return;
    }
    setBusy(true);
    setMsg({ kind: 'info', text: 'Generating a zero-knowledge proof of eligibility…' });
    const r = await submitVote(serviceId, voter, vote);
    if (r.success) {
      setMsg({
        kind: 'ok',
        text: `Vote accepted (verdict: ${r.verdict}). If this member already voted, the tally stays put — the nullifier blocks double-voting on-chain.`,
      });
      await refresh();
    } else {
      setMsg({ kind: 'err', text: r.error || 'Vote failed.' });
    }
    setBusy(false);
  }

  const total = tally?.total ?? 0;
  const yes = tally?.yes ?? 0;
  const no = tally?.no ?? 0;
  const yesPct = total ? Math.round((yes / total) * 100) : 0;

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="section-title">Anonymous Voting</h1>
        <p className="section-description max-w-2xl mx-auto">
          Prove you belong to the eligibility set and cast a ballot — <strong>without revealing
          which member you are</strong>. A zero-knowledge proof is verified on-chain in{' '}
          <code className="font-mono text-sm">refine</code>, and a one-time nullifier prevents
          double-voting in <code className="font-mono text-sm">accumulate</code>. The chain only
          ever sees the tally and spent nullifiers — never your identity.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="card-clean">
          <CardHeader>
            <CardTitle>Cast a vote</CardTitle>
            <CardDescription>
              Pick an eligible member and a choice (demo set: {MEMBERS} members).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Eligible member</label>
              <select
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-mono"
                value={voter}
                onChange={(e) => setVoter(Number(e.target.value))}
                disabled={busy}
              >
                {Array.from({ length: MEMBERS }, (_, i) => (
                  <option key={i} value={i}>
                    Member #{i}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                On-chain this is hidden — the proof shows only that <em>some</em> member voted.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Choice</label>
              <div className="flex gap-3">
                <Button
                  variant={vote === 1 ? 'default' : 'outline'}
                  onClick={() => setVote(1)}
                  disabled={busy}
                >
                  Yes
                </Button>
                <Button
                  variant={vote === 0 ? 'default' : 'outline'}
                  onClick={() => setVote(0)}
                  disabled={busy}
                >
                  No
                </Button>
              </div>
            </div>

            <Button className="w-full" onClick={cast} disabled={busy || !serviceId}>
              {busy ? 'Proving…' : 'Cast anonymous vote'}
            </Button>

            {msg && (
              <p
                className={
                  msg.kind === 'ok'
                    ? 'text-sm text-green-600'
                    : msg.kind === 'err'
                    ? 'text-sm text-red-600'
                    : 'text-sm text-gray-500'
                }
              >
                {msg.text}
              </p>
            )}
            {!serviceId && (
              <p className="text-sm text-gray-500">
                Select the voting service (top-right) to begin.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="card-clean">
          <CardHeader>
            <CardTitle>Live tally</CardTitle>
            <CardDescription>Read directly from on-chain service storage.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>Total votes</span>
              <span className="font-mono">{total}</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-gray-100">
              <div className="h-full bg-[#E6007A]" style={{ width: `${yesPct}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span>Yes</span>
              <span className="font-mono">
                {yes} ({yesPct}%)
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>No</span>
              <span className="font-mono">
                {no} ({total ? 100 - yesPct : 0}%)
              </span>
            </div>
            <Button variant="outline" onClick={refresh} disabled={!serviceId}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
