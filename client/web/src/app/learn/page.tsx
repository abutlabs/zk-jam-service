import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function LearnPage() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-8 space-y-8 max-w-4xl">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="section-title">
          Learn JAM
        </h1>
        <p className="section-description max-w-2xl mx-auto">
          Understanding the Join-Accumulate Machine and how it revolutionizes blockchain computation.
        </p>
      </div>

      {/* What is JAM */}
      <Card className="card-clean">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 badge-default">Introduction</Badge>
          <CardTitle className="text-2xl text-[#1a1a1a]">What is JAM?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-600">
          <p>
            <strong className="text-[#1a1a1a]">JAM (Join-Accumulate Machine)</strong> is Polkadot&apos;s next-generation
            execution environment. It fundamentally reimagines how blockchains handle computation by separating
            <em> what</em> gets computed from <em>who</em> computes it.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-sm">
              <strong className="text-[#E6007A]">The Key Insight:</strong> Not every validator needs to run every computation.
              A small group can compute, and everyone else can verify.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* The Two-Stage Model */}
      <Card className="card-clean">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 badge-default">Architecture</Badge>
          <CardTitle className="text-2xl text-[#1a1a1a]">The Two-Stage Model</CardTitle>
          <CardDescription className="text-gray-500">
            JAM splits execution into two distinct phases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Refine */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-pink-50 border border-pink-200 flex items-center justify-center text-[#E6007A] font-bold">
                R
              </div>
              <div>
                <h3 className="font-semibold text-[#1a1a1a] text-lg">Refine</h3>
                <p className="text-sm text-gray-500">Off-chain computation</p>
              </div>
            </div>
            <div className="pl-13 space-y-2 text-sm text-gray-600">
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Runs on a <strong className="text-[#1a1a1a]">small subset</strong> of validator cores (not all validators)</li>
                <li>Up to <strong className="text-[#1a1a1a]">6 seconds</strong> of computation time</li>
                <li>Can access external data, perform heavy calculations</li>
                <li>Perfect for: ZK proof verification, data processing, ML inference</li>
                <li>Output is a small, deterministic result</li>
              </ul>
              <code className="code-block text-[#1a1a1a] mt-3">
                fn refine(payload: WorkPayload) → WorkOutput
              </code>
            </div>
          </div>

          <Separator className="bg-gray-200" />

          {/* Accumulate */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-50 border border-green-200 flex items-center justify-center text-green-700 font-bold">
                A
              </div>
              <div>
                <h3 className="font-semibold text-[#1a1a1a] text-lg">Accumulate</h3>
                <p className="text-sm text-gray-500">On-chain state update</p>
              </div>
            </div>
            <div className="pl-13 space-y-2 text-sm text-gray-600">
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Runs on <strong className="text-[#1a1a1a]">all validators</strong></li>
                <li>Strict time limit: <strong className="text-[#1a1a1a]">&lt;10 milliseconds</strong></li>
                <li>Takes Refine output as input</li>
                <li>Updates global blockchain state</li>
                <li>Must be deterministic and fast</li>
              </ul>
              <code className="code-block text-[#1a1a1a] mt-3">
                fn accumulate(results: Vec&lt;WorkOutput&gt;) → StateUpdate
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Why This Matters */}
      <Card className="card-clean">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 badge-default">Benefits</Badge>
          <CardTitle className="text-2xl text-[#1a1a1a]">Why This Matters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
              <div className="text-2xl font-bold text-[#1a1a1a]">10,000x</div>
              <div className="text-sm text-gray-500">
                More computation per block compared to traditional execution
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
              <div className="text-2xl font-bold text-[#1a1a1a]">6 seconds</div>
              <div className="text-sm text-gray-500">
                Compute budget per work item (vs ~10ms limit on traditional chains)
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
              <div className="text-2xl font-bold text-[#1a1a1a]">Parallel</div>
              <div className="text-sm text-gray-500">
                Multiple cores process different work items simultaneously
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-200">
              <div className="text-2xl font-bold text-[#1a1a1a]">Secure</div>
              <div className="text-sm text-gray-500">
                Audit stage ensures correctness through validator verification
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Pipeline */}
      <Card className="card-clean">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 badge-default">Flow</Badge>
          <CardTitle className="text-2xl text-[#1a1a1a]">The Complete Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-4">
            {[
              { step: 1, title: 'Submit', desc: 'User submits a work item (payload) to a service', color: 'bg-[#1a1a1a]' },
              { step: 2, title: 'Refine', desc: 'A validator core processes the payload (up to 6s)', color: 'bg-[#E6007A]' },
              { step: 3, title: 'Audit', desc: 'Other validators verify the computation is correct', color: 'bg-yellow-500' },
              { step: 4, title: 'Accumulate', desc: 'All validators update state based on results', color: 'bg-green-500' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className={`h-8 w-8 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {item.step}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-[#1a1a1a]">{item.title}</h4>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ZK Proofs */}
      <Card className="card-clean">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 badge-pink">
            Advanced
          </Badge>
          <CardTitle className="text-2xl text-[#1a1a1a]">ZK Proofs on JAM</CardTitle>
          <CardDescription className="text-gray-500">
            Why JAM is perfect for zero-knowledge applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-600">
          <p>
            Zero-knowledge proofs allow you to prove a statement is true without revealing the underlying data.
            For example: &quot;I know a number that, when hashed, produces this output&quot; without revealing the number.
          </p>

          <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
            <h4 className="font-semibold text-[#E6007A] mb-2">Why JAM + ZK?</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong className="text-[#1a1a1a]">Time:</strong> ZK verification takes seconds, and JAM gives you 6 of them</li>
              <li><strong className="text-[#1a1a1a]">Cost:</strong> Only a few validators run the verification, not thousands</li>
              <li><strong className="text-[#1a1a1a]">Privacy:</strong> Sensitive data never goes on-chain, only the proof</li>
              <li><strong className="text-[#1a1a1a]">Scalability:</strong> Verify complex computations without replaying them</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-[#1a1a1a]">Example: Private Voting</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-gray-500 pl-2">
              <li>User generates a ZK proof: &quot;I&apos;m eligible to vote and my vote is X&quot;</li>
              <li>Refine verifies the proof (takes ~2 seconds)</li>
              <li>Accumulate records the anonymous vote</li>
              <li>No one knows who voted for what, but the tally is correct</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* This Demo */}
      <Card className="card-clean">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 badge-success">
            Try It
          </Badge>
          <CardTitle className="text-2xl text-[#1a1a1a]">This Demo: Hash Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-gray-600">
          <p>
            This service demonstrates JAM&apos;s architecture using a simple hash verification.
            It&apos;s a stepping stone toward full ZK proof verification.
          </p>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="badge-default">Current</Badge>
              <span className="text-sm text-[#1a1a1a]">Hash Verification</span>
            </div>
            <p className="text-sm text-gray-500">
              Verify that Blake2s-256(preimage) = expected_hash. This proves the Refine → Accumulate
              pipeline works correctly.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3 border border-gray-200">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="badge-pink">Next</Badge>
              <span className="text-sm text-[#1a1a1a]">ZK Hash Verification</span>
            </div>
            <p className="text-sm text-gray-500">
              Verify a zkSNARK proof that the submitter knows the preimage, without revealing it.
              The hash becomes a commitment, and the proof shows knowledge.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="card-clean">
        <CardHeader>
          <CardTitle className="text-2xl text-[#1a1a1a]">Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="https://graypaper.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-[#1a1a1a]">JAM Gray Paper</div>
              <p className="text-sm text-gray-500">The formal specification of JAM</p>
            </a>
            <a
              href="https://wiki.polkadot.network/docs/learn-jam-chain"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-[#1a1a1a]">Polkadot Wiki</div>
              <p className="text-sm text-gray-500">Learn more about JAM and Polkadot</p>
            </a>
            <a
              href="https://github.com/polkadot-fellows/RFCs"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-[#1a1a1a]">Polkadot RFCs</div>
              <p className="text-sm text-gray-500">Technical proposals and discussions</p>
            </a>
            <Link
              href="/verify"
              className="block bg-[#1a1a1a] hover:bg-[#333] rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-white">Try the Demo</div>
              <p className="text-sm text-white/70">Submit your first hash verification</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
