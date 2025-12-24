import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';

export default function LearnPage() {
  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Learn JAM
        </h1>
        <p className="text-zinc-400 max-w-2xl mx-auto">
          Understanding the Join-Accumulate Machine and how it revolutionizes blockchain computation.
        </p>
      </div>

      {/* What is JAM */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2">Introduction</Badge>
          <CardTitle className="text-2xl">What is JAM?</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-zinc-300">
          <p>
            <strong className="text-white">JAM (Join-Accumulate Machine)</strong> is Polkadot&apos;s next-generation
            execution environment. It fundamentally reimagines how blockchains handle computation by separating
            <em> what</em> gets computed from <em>who</em> computes it.
          </p>
          <div className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700">
            <p className="text-sm">
              <strong className="text-purple-400">The Key Insight:</strong> Not every validator needs to run every computation.
              A small group can compute, and everyone else can verify.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* The Two-Stage Model */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2">Architecture</Badge>
          <CardTitle className="text-2xl">The Two-Stage Model</CardTitle>
          <CardDescription>
            JAM splits execution into two distinct phases
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Refine */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold">
                R
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Refine</h3>
                <p className="text-sm text-zinc-500">Off-chain computation</p>
              </div>
            </div>
            <div className="pl-13 space-y-2 text-sm text-zinc-300">
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Runs on a <strong>small subset</strong> of validator cores (not all validators)</li>
                <li>Up to <strong>6 seconds</strong> of computation time</li>
                <li>Can access external data, perform heavy calculations</li>
                <li>Perfect for: ZK proof verification, data processing, ML inference</li>
                <li>Output is a small, deterministic result</li>
              </ul>
              <code className="block bg-zinc-800 p-3 rounded text-green-400 mt-3">
                fn refine(payload: WorkPayload) → WorkOutput
              </code>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Accumulate */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center text-green-400 font-bold">
                A
              </div>
              <div>
                <h3 className="font-semibold text-white text-lg">Accumulate</h3>
                <p className="text-sm text-zinc-500">On-chain state update</p>
              </div>
            </div>
            <div className="pl-13 space-y-2 text-sm text-zinc-300">
              <ul className="list-disc list-inside space-y-1 pl-4">
                <li>Runs on <strong>all validators</strong></li>
                <li>Strict time limit: <strong>&lt;10 milliseconds</strong></li>
                <li>Takes Refine output as input</li>
                <li>Updates global blockchain state</li>
                <li>Must be deterministic and fast</li>
              </ul>
              <code className="block bg-zinc-800 p-3 rounded text-green-400 mt-3">
                fn accumulate(results: Vec&lt;WorkOutput&gt;) → StateUpdate
              </code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Why This Matters */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2">Benefits</Badge>
          <CardTitle className="text-2xl">Why This Matters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
              <div className="text-2xl">10,000x</div>
              <div className="text-sm text-zinc-400">
                More computation per block compared to traditional execution
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
              <div className="text-2xl">6 seconds</div>
              <div className="text-sm text-zinc-400">
                Per work item in Refine vs ~10ms in traditional blockchains
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
              <div className="text-2xl">Parallel</div>
              <div className="text-sm text-zinc-400">
                Multiple cores process different work items simultaneously
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4 space-y-2">
              <div className="text-2xl">Secure</div>
              <div className="text-sm text-zinc-400">
                Audit stage ensures correctness through validator verification
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* The Pipeline */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2">Flow</Badge>
          <CardTitle className="text-2xl">The Complete Pipeline</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col space-y-4">
            {[
              { step: 1, title: 'Submit', desc: 'User submits a work item (payload) to a service', color: 'bg-blue-500' },
              { step: 2, title: 'Refine', desc: 'A validator core processes the payload (up to 6s)', color: 'bg-purple-500' },
              { step: 3, title: 'Audit', desc: 'Other validators verify the computation is correct', color: 'bg-yellow-500' },
              { step: 4, title: 'Accumulate', desc: 'All validators update state based on results', color: 'bg-green-500' },
            ].map((item, i) => (
              <div key={item.step} className="flex items-start gap-4">
                <div className={`h-8 w-8 rounded-full ${item.color} flex items-center justify-center text-white font-bold text-sm flex-shrink-0`}>
                  {item.step}
                </div>
                <div className="flex-1">
                  <h4 className="font-medium text-white">{item.title}</h4>
                  <p className="text-sm text-zinc-400">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ZK Proofs */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 bg-purple-500/10 text-purple-400 border-purple-500/30">
            Advanced
          </Badge>
          <CardTitle className="text-2xl">ZK Proofs on JAM</CardTitle>
          <CardDescription>
            Why JAM is perfect for zero-knowledge applications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-zinc-300">
          <p>
            Zero-knowledge proofs allow you to prove a statement is true without revealing the underlying data.
            For example: &quot;I know a number that, when hashed, produces this output&quot; without revealing the number.
          </p>

          <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20">
            <h4 className="font-semibold text-purple-400 mb-2">Why JAM + ZK?</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li><strong>Time:</strong> ZK verification takes seconds, and JAM gives you 6 of them</li>
              <li><strong>Cost:</strong> Only a few validators run the verification, not thousands</li>
              <li><strong>Privacy:</strong> Sensitive data never goes on-chain, only the proof</li>
              <li><strong>Scalability:</strong> Verify complex computations without replaying them</li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium text-white">Example: Private Voting</h4>
            <ol className="list-decimal list-inside space-y-1 text-sm text-zinc-400 pl-2">
              <li>User generates a ZK proof: &quot;I&apos;m eligible to vote and my vote is X&quot;</li>
              <li>Refine verifies the proof (takes ~2 seconds)</li>
              <li>Accumulate records the anonymous vote</li>
              <li>No one knows who voted for what, but the tally is correct</li>
            </ol>
          </div>
        </CardContent>
      </Card>

      {/* This Demo */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <Badge variant="outline" className="w-fit mb-2 bg-green-500/10 text-green-400 border-green-500/30">
            Try It
          </Badge>
          <CardTitle className="text-2xl">This Demo: Hash Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-zinc-300">
          <p>
            This service demonstrates JAM&apos;s architecture using a simple hash verification.
            It&apos;s a stepping stone toward full ZK proof verification.
          </p>

          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Current</Badge>
              <span className="text-sm">Hash Verification</span>
            </div>
            <p className="text-sm text-zinc-400">
              Verify that Blake2s-256(preimage) = expected_hash. This proves the Refine → Accumulate
              pipeline works correctly.
            </p>
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-purple-500/30 text-purple-400">Next</Badge>
              <span className="text-sm">ZK Hash Verification</span>
            </div>
            <p className="text-sm text-zinc-400">
              Verify a zkSNARK proof that the submitter knows the preimage, without revealing it.
              The hash becomes a commitment, and the proof shows knowledge.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-2xl">Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <a
              href="https://graypaper.com"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-zinc-800 hover:bg-zinc-700 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-white">JAM Gray Paper</div>
              <p className="text-sm text-zinc-400">The formal specification of JAM</p>
            </a>
            <a
              href="https://wiki.polkadot.network/docs/learn-jam-chain"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-zinc-800 hover:bg-zinc-700 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-white">Polkadot Wiki</div>
              <p className="text-sm text-zinc-400">Learn more about JAM and Polkadot</p>
            </a>
            <a
              href="https://github.com/polkadot-fellows/RFCs"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-zinc-800 hover:bg-zinc-700 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-white">Polkadot RFCs</div>
              <p className="text-sm text-zinc-400">Technical proposals and discussions</p>
            </a>
            <Link
              href="/verify"
              className="block bg-purple-600 hover:bg-purple-700 rounded-lg p-4 transition-colors"
            >
              <div className="font-medium text-white">Try the Demo</div>
              <p className="text-sm text-purple-200">Submit your first hash verification</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
