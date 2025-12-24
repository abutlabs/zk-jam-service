import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pipeline } from '@/components/Pipeline';
import { getCurrentSlot, getServiceInfo } from './actions/jam';
import Link from 'next/link';

// Default service ID - can be overridden via env
const SERVICE_ID = process.env.NEXT_PUBLIC_JAM_SERVICE_ID || '99fbfec5';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function DashboardPage() {
  const [slotResult, serviceInfo] = await Promise.all([
    getCurrentSlot(),
    getServiceInfo(SERVICE_ID),
  ]);

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          JAM Service Dashboard
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Visual interface for interacting with JAM (Join-Accumulate Machine) services.
          Submit hash verifications, explore the network, and learn about ZK proofs.
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Network Status */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Network Status</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-green-500 animate-pulse" />
              Connected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-zinc-400">
              Current Slot:{' '}
              <span className="text-white font-mono">
                {slotResult.slot?.toLocaleString() ?? 'Loading...'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Service Info */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Active Service</CardDescription>
            <CardTitle className="text-2xl">
              {serviceInfo?.name ?? 'Unknown'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm">
              <div className="text-zinc-400">
                Version: <span className="text-white">v{serviceInfo?.version}</span>
              </div>
              <div className="text-zinc-400">
                ID: <code className="text-purple-400">{SERVICE_ID}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Quick Actions</CardDescription>
            <CardTitle className="text-2xl">Get Started</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Link
              href="/verify"
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
            >
              Verify Hash
            </Link>
            <Link
              href="/explorer"
              className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-center text-sm font-medium transition-colors"
            >
              Explorer
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>JAM Pipeline</CardTitle>
          <CardDescription>
            How work items flow through the Join-Accumulate Machine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Pipeline />
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle>How JAM Works</CardTitle>
          <CardDescription>
            Understanding the Join-Accumulate Machine architecture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Refine */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/30">
                  Refine
                </Badge>
                <span className="text-sm text-zinc-500">Off-chain</span>
              </div>
              <h3 className="font-semibold">Heavy Computation</h3>
              <p className="text-sm text-zinc-400">
                Runs on a small set of validator cores with up to 6 seconds of compute time.
                Perfect for ZK proof verification, data processing, and complex calculations.
              </p>
              <code className="block text-xs bg-zinc-800 p-2 rounded text-green-400">
                fn refine(payload) → WorkOutput
              </code>
            </div>

            {/* Accumulate */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/30">
                  Accumulate
                </Badge>
                <span className="text-sm text-zinc-500">On-chain</span>
              </div>
              <h3 className="font-semibold">State Updates</h3>
              <p className="text-sm text-zinc-400">
                Runs on all validators with strict time limits (&lt;10ms).
                Updates global state based on refine results.
              </p>
              <code className="block text-xs bg-zinc-800 p-2 rounded text-green-400">
                fn accumulate(results) → StateUpdate
              </code>
            </div>
          </div>

          {/* The breakthrough */}
          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
            <h3 className="font-semibold text-purple-400 mb-2">The Breakthrough</h3>
            <p className="text-sm text-zinc-300">
              <strong>Traditional blockchains:</strong> Every node runs every computation.<br />
              <strong>JAM:</strong> A few nodes compute, everyone else validates.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Service Author */}
      {serviceInfo?.author && (
        <div className="text-center text-sm text-zinc-500">
          Service maintained by <span className="text-zinc-300">{serviceInfo.author}</span>
        </div>
      )}
    </div>
  );
}
