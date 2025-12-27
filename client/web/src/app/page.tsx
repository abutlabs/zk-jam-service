'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Pipeline } from '@/components/Pipeline';
import { getCurrentSlot } from './actions/jam';
import { useService } from '@/contexts/ServiceContext';
import Link from 'next/link';

export default function DashboardPage() {
  const { selectedService, isLoading: serviceLoading } = useService();
  const [currentSlot, setCurrentSlot] = useState<number | null>(null);
  const [slotLoading, setSlotLoading] = useState(true);

  useEffect(() => {
    const fetchSlot = async () => {
      const result = await getCurrentSlot();
      setCurrentSlot(result.slot);
      setSlotLoading(false);
    };
    fetchSlot();
    const interval = setInterval(fetchSlot, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-10">
      {/* Hero Section */}
      <div className="hero-section rounded-2xl p-8 md:p-12 text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white border border-gray-200 text-[#E6007A] text-sm font-medium">
          <span className="h-2 w-2 rounded-full bg-[#E6007A] animate-pulse" />
          A Web3 Foundation Grant
        </div>
        <h1 className="section-title">
          ZK JAM Service
        </h1>
        <p className="section-description max-w-2xl mx-auto">
          Zero-knowledge proof verification on JAM (Join-Accumulate Machine).
          Submit work items, explore the network, and learn about ZK proofs.
        </p>
        <div className="flex justify-center gap-4 pt-4">
          <Link href="/verify" className="btn-primary">
            Start Verifying
            <span>→</span>
          </Link>
          <Link
            href="/learn"
            className="bg-white border border-gray-200 text-[#1a1a1a] px-6 py-3 rounded-full font-medium transition-all duration-200 hover:border-gray-300 hover:shadow-sm inline-flex items-center gap-2"
          >
            Learn More
          </Link>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Network Status */}
        <Card className="card-clean">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-500 uppercase text-xs tracking-wider">Network Status</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-3 text-[#1a1a1a]">
              <span className={`h-3 w-3 rounded-full ${currentSlot ? 'bg-green-500' : 'bg-yellow-500'} ${currentSlot ? '' : 'animate-pulse'}`} />
              {slotLoading ? 'Connecting...' : currentSlot ? 'Connected' : 'Offline'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-gray-500">
              Current Slot:{' '}
              <span className="text-[#1a1a1a] font-mono">
                {slotLoading ? '...' : currentSlot?.toLocaleString() ?? '---'}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Service Info */}
        <Card className="card-clean">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-500 uppercase text-xs tracking-wider">Active Service</CardDescription>
            <CardTitle className="text-2xl text-[#1a1a1a]">
              {serviceLoading ? 'Loading...' : selectedService?.name ?? 'No service selected'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-sm">
              <div className="text-gray-500">
                Version: <span className="text-[#1a1a1a]">{selectedService?.version ? `v${selectedService.version}` : '---'}</span>
              </div>
              <div className="text-gray-500">
                ID: <code className="text-[#E6007A] font-mono">{selectedService?.id ?? '---'}</code>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="card-clean">
          <CardHeader className="pb-3">
            <CardDescription className="text-gray-500 uppercase text-xs tracking-wider">Quick Actions</CardDescription>
            <CardTitle className="text-2xl text-[#1a1a1a]">Get Started</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-3">
            <Link
              href="/verify"
              className="flex-1 bg-[#1a1a1a] hover:bg-[#333] text-white px-4 py-2.5 rounded-lg text-center text-sm font-medium transition-all duration-200"
            >
              Verify Hash
            </Link>
            <Link
              href="/explorer"
              className="flex-1 bg-white hover:bg-gray-50 border border-gray-200 text-[#1a1a1a] px-4 py-2.5 rounded-lg text-center text-sm font-medium transition-all duration-200"
            >
              Explorer
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Visualization */}
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-[#1a1a1a]">JAM Pipeline</CardTitle>
          <CardDescription className="text-gray-500">
            How work items flow through the Join-Accumulate Machine
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Pipeline />
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-[#1a1a1a]">How JAM Works</CardTitle>
          <CardDescription className="text-gray-500">
            Understanding the Join-Accumulate Machine architecture
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Refine */}
            <div className="space-y-3 p-5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2">
                <Badge className="badge-pink">
                  Refine
                </Badge>
                <span className="text-sm text-gray-500">Off-chain</span>
              </div>
              <h3 className="font-semibold text-[#1a1a1a]">Heavy Computation</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Runs on a small set of validator cores with up to 6 seconds of compute time.
                Perfect for ZK proof verification, data processing, and complex calculations.
              </p>
              <code className="code-block text-[#1a1a1a]">
                fn refine(payload) → WorkOutput
              </code>
            </div>

            {/* Accumulate */}
            <div className="space-y-3 p-5 rounded-xl bg-gray-50 border border-gray-200">
              <div className="flex items-center gap-2">
                <Badge className="badge-success">
                  Accumulate
                </Badge>
                <span className="text-sm text-gray-500">On-chain</span>
              </div>
              <h3 className="font-semibold text-[#1a1a1a]">State Updates</h3>
              <p className="text-sm text-gray-500 leading-relaxed">
                Runs on all validators with strict time limits (&lt;10ms).
                Updates global state based on refine results.
              </p>
              <code className="code-block text-[#1a1a1a]">
                fn accumulate(results) → StateUpdate
              </code>
            </div>
          </div>

          {/* The breakthrough */}
          <div className="bg-pink-50 rounded-xl p-5 border border-pink-200">
            <h3 className="font-semibold text-[#E6007A] mb-2">The Breakthrough</h3>
            <p className="text-sm text-gray-600 leading-relaxed">
              <strong className="text-[#1a1a1a]">Traditional blockchains:</strong> Every node runs every computation.<br />
              <strong className="text-[#1a1a1a]">JAM:</strong> A few nodes compute, everyone else validates.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Service Author */}
      {selectedService?.author && (
        <div className="text-center text-sm text-gray-400 pb-8">
          Service maintained by <span className="text-gray-600">{selectedService.author}</span>
        </div>
      )}
    </div>
  );
}
