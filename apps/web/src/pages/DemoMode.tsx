import { useState } from 'react';
import { Play, ArrowRight, ArrowLeft, RefreshCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SCENES = [
  { id: 1, title: 'Compile Policy', desc: 'Translating natural language constraints into executable graphs.', path: '/policies' },
  { id: 2, title: 'AI Buyer Intent', desc: 'Simulating a buyer requesting a massive 20% discount.', path: '/buyer', action: 'Buy laptop with 20% discount' },
  { id: 3, title: 'Policy Gate Block', desc: 'AI recommends the discount. Deterministic Policy Gate blocks execution.', path: '/decisions' },
  { id: 4, title: 'Valid Purchase', desc: 'Buyer requests a normal purchase. Policy allows it.', path: '/buyer', action: 'Buy the best laptop' },
  { id: 5, title: 'Razorpay Test Execution', desc: 'Transaction successfully executed against Razorpay Sandbox.', path: '/decisions' },
  { id: 6, title: 'Chaos: Inventory Mutation', desc: 'Inject race condition. Set stock to 0 right before next purchase.', path: '/chaos' },
  { id: 7, title: 'JIT Re-validation Block', desc: 'AI proposes purchase, but JIT guard detects 0 inventory at the last millisecond.', path: '/decisions' },
  { id: 8, title: 'Chaos: Razorpay Timeout', desc: 'Network failure during execution. System transitions to EXECUTION_UNKNOWN.', path: '/failures' },
  { id: 9, title: 'Audit Verification', desc: 'Immutable ledger proves what happened and why.', path: '/audit' }
];

export default function DemoMode() {
  const [scene, setScene] = useState(1);
  const navigate = useNavigate();

  const handleRunScene = () => {
    const current = SCENES[scene - 1];
    navigate(current.path);
  };

  const handleReset = async () => {
    await fetch('http://localhost:3001/api/chaos/reset', { method: 'POST' });
    setScene(1);
  };

  return (
    <div className="flex flex-col items-center justify-center h-full max-w-4xl mx-auto text-center space-y-8 animate-in zoom-in-95 duration-500">
      
      <div className="space-y-4">
        <h1 className="text-4xl font-display font-bold text-primary flex items-center justify-center">
          <Play className="mr-4" size={40} fill="currentColor" />
          Cinematic Walkthrough
        </h1>
        <p className="text-lg text-text-muted max-w-2xl mx-auto leading-relaxed">
          Follow this guided sequence to demonstrate the core architecture of PolicyShield during the Razorpay 5-minute video.
        </p>
      </div>

      <div className="w-full bg-surface/30 border border-border rounded-xl p-8 relative overflow-hidden">
         <div className="absolute top-0 left-0 h-1 bg-primary transition-all duration-300" style={{ width: `${(scene / SCENES.length) * 100}%`}}></div>
         
         <div className="flex justify-between text-xs font-mono text-text-muted mb-8 uppercase tracking-widest">
           <span>Scene {scene} of {SCENES.length}</span>
           <span>{SCENES[scene-1].path}</span>
         </div>

         <h2 className="text-3xl font-display font-medium text-text-main mb-4">
           {SCENES[scene-1].title}
         </h2>
         <p className="text-text-muted text-lg">
           {SCENES[scene-1].desc}
         </p>

         {SCENES[scene-1].action && (
           <div className="mt-6 inline-block bg-background border border-border rounded-lg px-4 py-3 font-mono text-sm text-emerald-400">
             &gt; {SCENES[scene-1].action}
           </div>
         )}
      </div>

      <div className="flex items-center space-x-6">
        <button 
          onClick={() => setScene(s => Math.max(1, s - 1))}
          disabled={scene === 1}
          className="flex items-center text-text-muted hover:text-text-main disabled:opacity-30 transition-colors"
        >
          <ArrowLeft size={20} className="mr-2" /> Previous
        </button>
        
        <button 
          onClick={handleRunScene}
          className="flex items-center bg-primary text-background hover:bg-primary-hover px-8 py-4 rounded-full font-bold text-lg shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all transform hover:scale-105"
        >
          <Play size={20} fill="currentColor" className="mr-2" /> 
          Go to Scene
        </button>

        <button 
          onClick={() => setScene(s => Math.min(SCENES.length, s + 1))}
          disabled={scene === SCENES.length}
          className="flex items-center text-text-muted hover:text-text-main disabled:opacity-30 transition-colors"
        >
          Next <ArrowRight size={20} className="ml-2" />
        </button>
      </div>

      <button onClick={handleReset} className="text-text-muted hover:text-rose-400 text-sm flex items-center mt-12 transition-colors">
        <RefreshCcw size={14} className="mr-2" /> Reset Demo State
      </button>

    </div>
  );
}
