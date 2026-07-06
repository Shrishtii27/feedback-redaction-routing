import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Database, 
  Activity, 
  RefreshCw, 
  Trash2, 
  Play, 
  Terminal, 
  Lock, 
  Eye, 
  EyeOff, 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  ShieldAlert, 
  ShieldCheck, 
  User, 
  Clock, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Brain, 
  Tag, 
  ArrowRight, 
  CheckCircle2,
  Server
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces mapping to backend models
interface PiiItem {
  type: 'EMAIL' | 'PHONE' | 'CREDIT_CARD' | 'HEALTH_ID' | 'NAME' | 'ADDRESS';
  value: string;
  method: 'regex' | 'ai';
}

interface FeedbackEntry {
  submissionId: string;
  clientName: string;
  originalText: string;
  originalTextSummary: string;
  redactedText: string;
  sentiment: 'Positive' | 'Negative' | 'Neutral';
  sentimentScore: number; // Scale: -1.0 to 1.0
  destinationDatabase: 'Priority Support Database' | 'Marketing Database';
  piiDetected: PiiItem[];
  timestamp: string;
}

interface TelemetryStats {
  totalSubmissions: number;
  priorityCount: number;
  marketingCount: number;
  totalRedactions: number;
  piiTypeCounts: Record<string, number>;
}

// Preset templates exactly from target app
const PLAYGROUND_PRESETS = [
  {
    id: "template-1",
    name: "Fintech Charge Dispute (Visa CC)",
    text: "I was double charged on my visa 4111111111111111! This transaction on July 1st is completely wrong. Refund me at customer.service@finance.com or reach out to Johnathan Doe immediately.",
    clientName: "iOS App",
    iconType: "shield-alert"
  },
  {
    id: "template-2",
    name: "Healthcare Appointment (MRN Leak)",
    text: "Dr. Gregory House did a wonderful job with my diagnostic today. My health ID is MRN-9988-1234. Please send my medical record to patient-support@medcare.org. Many thanks!",
    clientName: "Web Portal",
    iconType: "shield-check"
  },
  {
    id: "template-3",
    name: "Standard Positive Review (No PII)",
    text: "The payment gateway is incredibly fast and intuitive. I am happy with how security-conscious this fintech portal feels.",
    clientName: "Web Portal",
    iconType: "user"
  },
  {
    id: "template-4",
    name: "Malformed Payload (Empty Ingress)",
    text: "   ",
    clientName: "Android App",
    iconType: "alert-circle"
  }
];

export default function App() {
  // Main state matching target app variables
  const [feedbackText, setFeedbackText] = useState("");
  const [clientName, setClientName] = useState("Web Portal");
  const [history, setHistory] = useState<FeedbackEntry[]>([]);
  const [stats, setStats] = useState<TelemetryStats>({
    totalSubmissions: 0,
    priorityCount: 0,
    marketingCount: 0,
    totalRedactions: 0,
    piiTypeCounts: {}
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<FeedbackEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Sync statistics and history logs from API endpoints
  const syncTelemetry = async () => {
    try {
      const [statsRes, historyRes] = await Promise.all([
        fetch("/api/feedback/stats"),
        fetch("/api/feedback/history")
      ]);
      if (statsRes.ok && historyRes.ok) {
        const statsData = await statsRes.json();
        const historyData = await historyRes.json();
        setStats(statsData);
        setHistory(historyData.data || []);
      }
    } catch (err) {
      console.error("Error synchronizing stats/history with backend:", err);
    }
  };

  useEffect(() => {
    syncTelemetry();
  }, []);

  // Submit Inbound Ingestion Pipeline POST request
  const handleRunPipeline = async () => {
    setError(null);
    setResult(null);

    // Basic frontend verification (exactly as target app)
    if (!feedbackText || feedbackText.trim().length < 3) {
      setError("Validation failed: feedbackText is empty or malformed");
      return;
    }

    setIsProcessing(true);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedbackText, clientName })
      });

      if (!response.ok) {
        const errorBody = await response.json();
        setError(errorBody.error || "A bad request occurred on ingestion validation.");
        setIsProcessing(false);
        return;
      }

      const body = await response.json();
      if (body.status === "success" && body.data) {
        setResult(body.data);
        await syncTelemetry();
      }
    } catch (err) {
      console.error("Pipeline request errored out:", err);
      setError("Internal network connection timeout or bad gateway error.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Clear simulated database stores
  const handlePurgeDatabases = async () => {
    if (!window.confirm("Are you sure you want to clear all simulated databases? This is irreversible.")) {
      return;
    }
    try {
      const response = await fetch("/api/feedback/clear", { method: "POST" });
      if (response.ok) {
        setHistory([]);
        setResult(null);
        setError(null);
        setStats({
          totalSubmissions: 0,
          priorityCount: 0,
          marketingCount: 0,
          totalRedactions: 0,
          piiTypeCounts: {}
        });
      }
    } catch (err) {
      console.error("Failed to clear simulated database stores:", err);
    }
  };

  // Reset inputs
  const handleResetSandbox = () => {
    setFeedbackText("");
    setClientName("Web Portal");
    setResult(null);
    setError(null);
  };

  // Helper to render template icons
  const renderPresetIcon = (iconType: string, isSelected: boolean) => {
    const classVal = `w-4 h-4 mt-0.5 shrink-0 ${isSelected ? "text-amber-500" : "text-slate-600"}`;
    switch (iconType) {
      case "shield-alert":
        return <ShieldAlert className={classVal} />;
      case "shield-check":
        return <ShieldCheck className={classVal} />;
      case "user":
        return <User className={classVal} />;
      default:
        return <AlertCircle className={classVal} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-900/50 selection:text-indigo-100 pb-16">
      
      {/* Top Banner Rail */}
      <div className="bg-slate-900/90 border-b border-slate-800 text-slate-400 text-center py-2 px-4 text-xs font-mono flex items-center justify-center gap-2">
        <Shield className="w-4 h-4 text-emerald-400 drop-shadow-[0_0_4px_rgba(52,211,153,0.5)]" />
        <span>STATELESS COMPLIANCE PIPELINE ACTIVE // SECURE EPHEMERAL INGRESS GATEWAY</span>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 pb-4 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)] animate-pulse" />
              <span className="text-[10px] font-mono uppercase font-bold tracking-widest text-slate-500">
                Microservice.Feedback.Redactor v2.0.4
              </span>
              <span className="bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1">
                <Server className="w-3 h-3 text-blue-400" />
                PORT 3000
              </span>
            </div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-slate-200 uppercase mt-2">
              Feedback Redaction & Routing
            </h1>
            <p className="text-slate-400 mt-1 text-xs max-w-3xl leading-relaxed">
              Processes raw user submissions using strict Regex checks, secondary Gemini 3.5 Flash semantic safety-nets, and sentiment scoring. Routes HIPAA/PCI compliance files directly to appropriate database systems.
            </p>
          </div>

          <div className="shrink-0 flex items-center gap-2">
            <button 
              onClick={syncTelemetry}
              className="p-2 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
              title="Manual Sync Telemetry"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <a 
              href="https://ai.studio/build" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-slate-100 hover:bg-white text-slate-950 text-xs font-mono uppercase font-bold px-4 py-2 rounded flex items-center gap-1.5 transition shadow-[0_0_15px_rgba(255,255,255,0.1)] cursor-pointer"
            >
              <span>AI Studio Build</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Telemetry Stats Rows (L5) */}
        <TelemetryStatsRow stats={stats} />

        {/* Console Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          
          {/* Left Panel: Ingestion Sandbox Console */}
          <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-xl flex flex-col h-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-200 flex items-center">
                <Activity className="w-4 h-4 text-amber-500 mr-2 animate-pulse" />
                <span>Ingestion & Sandbox Console</span>
              </h3>
              <button 
                onClick={handleResetSandbox}
                className="text-[10px] font-mono uppercase tracking-widest text-slate-500 hover:text-slate-300 flex items-center transition cursor-pointer"
                title="Clear Sandbox"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                <span>Reset Input</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 mb-4 leading-relaxed">
              Select a clinical or financial test scenario, or write raw custom submission payload text into the container below.
            </p>

            {/* Presets Grid */}
            <div className="grid grid-cols-1 gap-2 mb-5">
              {PLAYGROUND_PRESETS.map((preset) => {
                const isSelected = feedbackText === preset.text;
                return (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setFeedbackText(preset.text);
                      setClientName(preset.clientName);
                    }}
                    className={`text-left p-3 rounded-lg border text-xs transition duration-200 flex items-start gap-2.5 cursor-pointer ${
                      isSelected 
                        ? 'border-amber-500/50 bg-slate-950 text-slate-100' 
                        : 'border-slate-800/60 bg-slate-950/40 text-slate-400 hover:bg-slate-950 hover:border-slate-700'
                    }`}
                  >
                    {renderPresetIcon(preset.iconType, isSelected)}
                    <div>
                      <div className="font-semibold text-slate-300">{preset.name}</div>
                      <div className="text-slate-500 mt-0.5 line-clamp-1 italic">
                        "{preset.text}"
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Form Inputs */}
            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-1.5">
                  Ingestion Ingress / Client Channel
                </label>
                <select
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-mono"
                >
                  <option value="Web Portal">Web Portal (Default)</option>
                  <option value="iOS App">iOS Mobile App</option>
                  <option value="Android App">Android Mobile App</option>
                  <option value="Email Ingest">Email Ingestion Daemon</option>
                  <option value="API Integration Gateway">Third-Party Partner API Gateway</option>
                </select>
              </div>

              <div className="flex-1 flex flex-col">
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest">
                    Feedback Submission Text
                  </label>
                  <span className="text-[10px] font-mono text-slate-600">
                    {feedbackText.length} CHARS
                  </span>
                </div>
                <textarea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  placeholder="Type feedback containing sensitive information to see the automatic sanitizing scanner in action..."
                  className="w-full flex-1 min-h-[140px] text-xs bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 resize-none font-mono leading-relaxed"
                />
              </div>

              {/* Ingress Button */}
              <button
                onClick={handleRunPipeline}
                disabled={isProcessing}
                className={`w-full py-2.5 rounded text-xs font-mono font-bold uppercase tracking-widest transition flex items-center justify-center gap-2 cursor-pointer ${
                  isProcessing 
                    ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-800" 
                    : "bg-slate-100 text-slate-950 hover:bg-white shadow-[0_0_15px_rgba(255,255,255,0.05)] active:scale-[0.98]"
                }`}
              >
                {isProcessing ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-slate-600 border-t-slate-200 rounded-full animate-spin" />
                    <span>RUNNING PIPELINE...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Run Ingestion Pipeline</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Panel: Pipeline Inspection Results */}
          <div className="h-full">
            <PipelineInspector result={result} error={error} isProcessing={isProcessing} />
          </div>
        </div>

        {/* Database Logs Section */}
        <DatabaseLogs history={history} onClearDb={handlePurgeDatabases} />

        {/* Footer */}
        <div className="mt-12 flex flex-col md:flex-row md:items-center justify-between text-slate-500 text-xs border-t border-slate-800 pt-6 gap-4 font-mono uppercase tracking-wider">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-slate-600" />
            <span>Built using Vite + Express backend and Node.js typescript bundling.</span>
          </div>
          <div>
            <span>Stateless microservice deployment design • AntiGravity IDE Verified • 2026</span>
          </div>
        </div>

      </div>
    </div>
  );
}

// Telemetry Stats Row Component (L5)
interface StatsProps {
  stats: TelemetryStats;
}

function TelemetryStatsRow({ stats }: StatsProps) {
  const marketingPct = stats.totalSubmissions > 0 
    ? Math.round((stats.marketingCount / stats.totalSubmissions) * 100) 
    : 0;
  
  const priorityPct = stats.totalSubmissions > 0 
    ? Math.round((stats.priorityCount / stats.totalSubmissions) * 100) 
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      
      {/* Submissions Logged Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Submissions Logged
          </p>
          <h3 className="text-3xl font-display font-light text-slate-200 mt-2">
            {stats.totalSubmissions}
            <span className="text-xs font-mono text-slate-600 ml-1">REQS</span>
          </h3>
          <p className="text-[10px] text-emerald-400 font-mono uppercase tracking-wide flex items-center mt-2.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5 animate-pulse" />
            Active Stateless Queue
          </p>
        </div>
        <div className="p-2.5 bg-slate-950/60 text-slate-400 rounded-lg border border-slate-800">
          <Activity className="w-5 h-5 text-blue-400" />
        </div>
      </motion.div>

      {/* Total PII Scrubbed Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
        className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Total PII Scrubbed
          </p>
          <h3 className="text-3xl font-display font-light text-amber-500 mt-2">
            {stats.totalRedactions}
            <span className="text-xs font-mono text-slate-600 ml-1">SCANS</span>
          </h3>
          <p className="text-[10px] text-slate-400 font-mono uppercase tracking-wide mt-2.5 flex items-center gap-1">
            <Activity className="w-3 h-3 text-amber-400 animate-pulse" />
            Hybrid Regex & AI
          </p>
        </div>
        <div className="p-2.5 bg-slate-950/60 text-slate-400 rounded-lg border border-slate-800">
          <Lock className="w-5 h-5 text-amber-500" />
        </div>
      </motion.div>

      {/* Marketing DB Route Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Marketing DB Route
          </p>
          <h3 className="text-3xl font-display font-light text-emerald-400 mt-2">
            {stats.marketingCount}
            <span className="text-xs font-mono text-slate-600 ml-1">FILES</span>
          </h3>
          <div className="w-24 bg-slate-950/60 border border-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${marketingPct}%` }} />
          </div>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter mt-1">
            {marketingPct}% SUCCESS ROUTED
          </p>
        </div>
        <div className="p-2.5 bg-slate-950/60 text-slate-400 rounded-lg border border-slate-800">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
        </div>
      </motion.div>

      {/* Priority Support Route Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
        className="bg-slate-900/40 p-5 rounded-xl border border-slate-800/80 flex items-center justify-between"
      >
        <div>
          <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
            Priority Support Route
          </p>
          <h3 className="text-3xl font-display font-light text-rose-500 mt-2">
            {stats.priorityCount}
            <span className="text-xs font-mono text-slate-600 ml-1">ALERTS</span>
          </h3>
          <div className="w-24 bg-slate-950/60 border border-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
            <div className="bg-rose-500 h-full rounded-full" style={{ width: `${priorityPct}%` }} />
          </div>
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-tighter mt-1">
            {priorityPct}% HIGH-SLA NEGATIVE
          </p>
        </div>
        <div className="p-2.5 bg-slate-950/60 text-slate-400 rounded-lg border border-slate-800">
          <ShieldAlert className="w-5 h-5 text-rose-500" />
        </div>
      </motion.div>

    </div>
  );
}

// Pipeline Inspection Panel Component (G5)
interface InspectorProps {
  result: FeedbackEntry | null;
  error: string | null;
  isProcessing: boolean;
}

function PipelineInspector({ result, error, isProcessing }: InspectorProps) {
  
  // Custom theme background mapping for categories
  const getBadgeColors = (type: string) => {
    switch (type.toUpperCase()) {
      case 'CREDIT_CARD':
        return "bg-orange-950/40 text-orange-400 border-orange-900/60";
      case 'EMAIL':
        return "bg-blue-950/40 text-blue-400 border-blue-900/60";
      case 'PHONE':
        return "bg-teal-950/40 text-teal-400 border-teal-900/60";
      case 'HEALTH_ID':
        return "bg-purple-950/40 text-purple-400 border-purple-900/60";
      case 'NAME':
        return "bg-pink-950/40 text-pink-400 border-pink-900/60";
      case 'ADDRESS':
        return "bg-amber-950/40 text-amber-400 border-amber-900/60";
      default:
        return "bg-slate-950/40 text-slate-400 border-slate-800";
    }
  };

  if (isProcessing) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center min-h-[500px] h-full shadow-xl">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-24 h-24 border-4 border-slate-800 border-t-amber-500 rounded-full animate-spin" />
          <div className="absolute w-16 h-16 border-4 border-slate-950 border-t-emerald-400 rounded-full animate-spin animate-reverse" />
          <Shield className="w-8 h-8 text-amber-500 animate-pulse" />
        </div>
        <h4 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-200">
          Scrubbing & Evaluating Submission
        </h4>
        <p className="text-xs font-mono text-slate-500 mt-2 text-center max-w-sm leading-relaxed">
          Applying high-performance regex scrubbers followed by a secondary Open Source LLM / Heuristic safety-net...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-rose-950/80 flex flex-col items-center justify-center min-h-[500px] h-full shadow-xl">
        <AlertCircle className="w-12 h-12 text-rose-500 mb-4 animate-bounce" />
        <h4 className="text-sm font-mono uppercase tracking-wider font-bold text-rose-400">
          Pipeline Execution Halted
        </h4>
        <div className="bg-slate-950 border border-rose-900/60 rounded-lg p-4 mt-3 max-w-md w-full">
          <p className="text-xs font-mono text-rose-500 leading-relaxed">
            [ERROR 400 - BAD REQUEST]<br />
            {error}
          </p>
        </div>
        <p className="text-xs text-slate-400 mt-4 text-center max-w-sm leading-relaxed">
          The validation engine successfully blocked this empty or malformed payload to protect downstream servers from processing invalid files.
        </p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="bg-slate-900 p-6 rounded-xl border border-slate-800/80 flex flex-col items-center justify-center min-h-[500px] h-full text-center shadow-xl">
        <div className="p-4 bg-slate-950/60 rounded-full border border-slate-800/80 mb-4">
          <Terminal className="w-8 h-8 text-slate-500" />
        </div>
        <h4 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-300">
          Pipeline Awaiting Ingestion
        </h4>
        <p className="text-xs text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
          No feedback has been submitted in this session yet. Choose a template or type in a custom query on the left to start the pipeline.
        </p>
        <div className="mt-8 w-full max-w-md border border-dashed border-slate-800 rounded-xl p-4 bg-slate-950/30">
          <h5 className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-4">
            Microservice Processing Order
          </h5>
          <div className="space-y-3.5 text-left text-xs font-mono">
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px]">1</span>
              <span className="font-medium text-slate-400">Schema Validation Check</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px]">2</span>
              <span className="font-medium text-slate-400">Regex-based PII Scrub (Card, Email, Phone, ID)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px]">3</span>
              <span className="font-medium text-slate-400">Gemini/OS LLM AI Semantic Guard (Names/Addresses)</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-5 h-5 rounded bg-slate-950 border border-slate-800 text-slate-400 flex items-center justify-center font-bold text-[10px]">4</span>
              <span className="font-medium text-slate-400">Sentiment & Dynamic Database Router</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const regexItems = result.piiDetected.filter(x => x.method === 'regex');
  const aiItems = result.piiDetected.filter(x => x.method === 'ai');

  return (
    <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-xl flex flex-col h-full shadow-xl space-y-6">
      
      {/* Header Info */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-200 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>Compliance Audit Pipeline Inspector</span>
          </h3>
          <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase">
            Ingestion Trace: {result.submissionId}
          </p>
        </div>
        <span className="text-[9px] font-mono bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 px-2 py-0.5 rounded uppercase font-bold">
          200 OK
        </span>
      </div>

      {/* Step 2: Regex Scrubber */}
      <div className="relative pl-7 border-l border-slate-800 space-y-2">
        <div className="absolute -left-[4.5px] top-0.5 w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
        <div className="flex justify-between items-start">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-amber-500">
            Step 2: Deterministic Regex Scrubber
          </h4>
          <span className="text-[9px] font-mono bg-amber-950/30 text-amber-400 font-bold px-2 py-0.5 rounded border border-amber-900/50">
            {regexItems.length} DETECTED
          </span>
        </div>
        <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
          Heuristics scrubbed emails, credentials, credit cards, and static keys instantly:
        </p>
        {regexItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {regexItems.map((item, idx) => (
              <span key={idx} className={`text-[9px] px-2 py-0.5 rounded border font-mono flex items-center gap-1.5 ${getBadgeColors(item.type)}`}>
                <Tag className="w-3 h-3 shrink-0 text-slate-400" />
                {item.type}: {item.value.replace(/./g, (char, index) => (index > 3 && index < item.value.length - 4) ? "*" : char)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-mono text-slate-600 italic">
            No hard patterns matching regular expressions detected.
          </p>
        )}
      </div>

      {/* Step 3: AI Cognitive Scrubber */}
      <div className="relative pl-7 border-l border-slate-800 space-y-2">
        <div className="absolute -left-[4.5px] top-0.5 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
        <div className="flex justify-between items-start">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Step 3: Gemini AI Cognitive Scrubber</span>
          </h4>
          <span className="text-[9px] font-mono bg-indigo-950/30 text-indigo-400 font-bold px-2 py-0.5 rounded border border-indigo-900/50">
            {aiItems.length} DETECTED
          </span>
        </div>
        <p className="text-[11px] font-mono text-slate-500 leading-relaxed">
          Contextual model redaction for Patient/Doctor Names, Hospital Entities, and Addresses:
        </p>
        {aiItems.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {aiItems.map((item, idx) => (
              <span key={idx} className={`text-[9px] px-2 py-0.5 rounded border font-mono flex items-center gap-1.5 ${getBadgeColors(item.type)}`}>
                <Brain className="w-3 h-3 shrink-0 text-slate-400" />
                {item.type}: {item.value}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs font-mono text-slate-600 italic">
            No additional contextual names/addresses identified by AI.
          </p>
        )}
      </div>

      {/* Final Redacted Output Box */}
      <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-850 mt-2">
        <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-widest mb-2">
          Final Redacted Output (Stored in Cloud)
        </div>
        <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-xs text-slate-300 leading-relaxed font-mono select-all">
          {result.redactedText}
        </div>
      </div>

      {/* Step 4: Sentiment Score */}
      <div className="relative pl-7 border-l border-slate-800 space-y-2">
        <div className="absolute -left-[4.5px] top-0.5 w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
        <div className="flex justify-between items-start">
          <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
            Step 4: Sentiment Analysis
          </h4>
          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
            result.sentiment === 'Positive' 
              ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" 
              : result.sentiment === 'Negative' 
                ? "bg-rose-950/30 text-rose-400 border-rose-900/50" 
                : "bg-slate-950 text-slate-400 border-slate-850"
          }`}>
            {result.sentiment.toUpperCase()}
          </span>
        </div>
        
        {/* Slider bar */}
        <div className="mt-2 flex items-center gap-4">
          <div className="flex-1 font-mono">
            <div className="flex justify-between text-[10px] text-slate-500 mb-1.5">
              <span>Angry (-1.0)</span>
              <span className="text-slate-300">Score: {result.sentimentScore.toFixed(2)}</span>
              <span>Happy (1.0)</span>
            </div>
            <div className="w-full bg-slate-950 border border-slate-850 h-2.5 rounded-full overflow-hidden relative">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  result.sentiment === 'Positive' 
                    ? "bg-emerald-500" 
                    : result.sentiment === 'Negative' 
                      ? "bg-rose-500" 
                      : "bg-slate-500"
                }`}
                style={{ width: `${((result.sentimentScore + 1) / 2) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Step 5: Database Routing Ingress */}
      <div className="relative pl-7">
        <div className="absolute -left-[4.5px] top-0.5 w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)] animate-pulse" />
        <h4 className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500">
          Step 5: Database Routing Ingress
        </h4>
        <div className="mt-3 flex items-center justify-between gap-2 p-3.5 rounded-xl border bg-slate-950/30 border-slate-850">
          <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">
            Sanitized Submission routed to:
          </div>
          <div className="flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-slate-600 animate-pulse" />
            <span className={`text-[10px] font-mono uppercase tracking-wide font-bold px-3 py-1.5 rounded border flex items-center gap-1.5 ${
              result.destinationDatabase === 'Priority Support Database' 
                ? "bg-rose-950/40 border-rose-900/60 text-rose-400" 
                : "bg-emerald-950/40 border-emerald-900/60 text-emerald-400"
            }`}>
              {result.destinationDatabase}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}

// Database Logs View Component (Y5)
interface DBLogsProps {
  history: FeedbackEntry[];
  onClearDb: () => void;
}

function DatabaseLogs({ history, onClearDb }: DBLogsProps) {
  const [activeTab, setActiveTab] = useState<'priority' | 'marketing'>('priority');
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const priorityEntries = history.filter(x => x.destinationDatabase === 'Priority Support Database');
  const marketingEntries = history.filter(x => x.destinationDatabase === 'Marketing Database');

  const filteredEntries = (activeTab === 'priority' ? priorityEntries : marketingEntries).filter(entry => 
    `${entry.originalText} ${entry.redactedText} ${entry.submissionId} ${entry.clientName}`
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  const getPiiBadgeColors = (type: string) => {
    switch (type.toUpperCase()) {
      case 'CREDIT_CARD':
        return "bg-orange-950/40 text-orange-400 border-orange-900/60";
      case 'EMAIL':
        return "bg-blue-950/40 text-blue-400 border-blue-900/60";
      case 'PHONE':
        return "bg-teal-950/40 text-teal-400 border-teal-900/60";
      case 'HEALTH_ID':
        return "bg-purple-950/40 text-purple-400 border-purple-900/60";
      case 'NAME':
        return "bg-pink-950/40 text-pink-400 border-pink-900/60";
      case 'ADDRESS':
        return "bg-amber-950/40 text-amber-400 border-amber-900/60";
      default:
        return "bg-slate-950 text-slate-400 border-slate-850";
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800/80 p-6 rounded-xl mt-6 shadow-xl">
      
      {/* DB Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-5 mb-5 gap-4">
        <div>
          <h3 className="text-sm font-mono uppercase tracking-wider font-bold text-slate-200 flex items-center">
            <Database className="w-4 h-4 text-indigo-400 mr-2" />
            <span>Downstream Distributed Databases (Simulated)</span>
          </h3>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wide mt-1">
            Scrubbed feed automatically segmented into distinct databases based on sentiment scores.
          </p>
        </div>
        <button
          onClick={onClearDb}
          className="text-[10px] font-mono uppercase tracking-widest text-rose-400 hover:text-rose-300 flex items-center gap-1.5 transition bg-rose-950/30 hover:bg-rose-950/60 px-3 py-1.5 rounded border border-rose-900/60 cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Purge Databases</span>
        </button>
      </div>

      {/* Tabs and Search Filtering */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        
        {/* Database Switcher Tabs */}
        <div className="flex bg-slate-950/60 border border-slate-850 p-1 rounded-lg">
          <button
            onClick={() => { setActiveTab('priority'); setExpandedId(null); }}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'priority' 
                ? "bg-slate-900 border border-slate-800 text-rose-400 shadow-sm" 
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
            <span>Priority Support Database</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
              activeTab === 'priority' ? "bg-rose-950/60 text-rose-400 border border-rose-900/40" : "bg-slate-900 text-slate-500"
            }`}>
              {priorityEntries.length}
            </span>
          </button>
          
          <button
            onClick={() => { setActiveTab('marketing'); setExpandedId(null); }}
            className={`px-4 py-2 text-xs font-mono font-bold uppercase rounded transition flex items-center gap-2 cursor-pointer ${
              activeTab === 'marketing' 
                ? "bg-slate-900 border border-slate-800 text-emerald-400 shadow-sm" 
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            <span>Marketing Database</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded ${
              activeTab === 'marketing' ? "bg-emerald-950/60 text-emerald-400 border border-emerald-900/40" : "bg-slate-900 text-slate-500"
            }`}>
              {marketingEntries.length}
            </span>
          </button>
        </div>

        {/* Database Search Box */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab === 'priority' ? 'Priority' : 'Marketing'} database...`}
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono"
          />
        </div>
      </div>

      {/* Logs Table Output */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-16 text-slate-500 text-xs italic font-mono border border-dashed border-slate-800 rounded-xl">
            No compliance files found matching active filters in simulated database partition.
          </div>
        ) : (
          filteredEntries.map((entry) => {
            const isExpanded = expandedId === entry.submissionId;
            return (
              <div 
                key={entry.submissionId}
                className="bg-slate-950 border border-slate-850 hover:border-slate-800 rounded-xl overflow-hidden transition"
              >
                {/* Summary Row */}
                <div 
                  onClick={() => toggleExpand(entry.submissionId)}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded shrink-0 border ${
                      activeTab === 'priority' ? "bg-rose-950/30 border-rose-900/40 text-rose-400" : "bg-emerald-950/30 border-emerald-900/40 text-emerald-400"
                    }`}>
                      <Database className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-bold text-slate-400">{entry.submissionId}</span>
                        <span className="text-[10px] text-slate-500 font-mono">[{entry.clientName}]</span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1 line-clamp-1 italic leading-normal">
                        "{entry.redactedText}"
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3.5 self-end sm:self-auto">
                    <div className="text-right">
                      <span className={`text-[9px] font-mono uppercase tracking-wider px-2 py-0.5 rounded border ${
                        entry.sentiment === 'Positive' 
                          ? "bg-emerald-950/30 text-emerald-400 border-emerald-900/50" 
                          : entry.sentiment === 'Negative' 
                            ? "bg-rose-950/30 text-rose-400 border-rose-900/50" 
                            : "bg-slate-950 text-slate-400 border-slate-850"
                      }`}>
                        SENTIMENT: {entry.sentiment} ({entry.sentimentScore.toFixed(1)})
                      </span>
                      <div className="text-[10px] text-slate-500 font-mono mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        <span>{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                  </div>
                </div>

                {/* Collapsible Detail Panel */}
                {isExpanded && (
                  <div className="p-4 border-t border-slate-850 bg-slate-950/30 space-y-4 text-xs font-mono">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Left: Original Payload */}
                      <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                          Original Submission Ingress
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-850 text-slate-400 leading-relaxed font-mono whitespace-pre-wrap select-all">
                          {entry.originalText}
                        </div>
                      </div>

                      {/* Right: Sanitized output */}
                      <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-1.5">
                          Sanitized Microservice Storage
                        </div>
                        <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-emerald-400 leading-relaxed font-mono whitespace-pre-wrap select-all">
                          {entry.redactedText}
                        </div>
                      </div>
                    </div>

                    {/* Bottom Details (PII checklist + SLA label) */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-4 border-t border-slate-800/60">
                      <div>
                        <div className="text-[10px] font-mono font-bold uppercase tracking-widest text-slate-500 mb-2">
                          Scrubbed Items Audit Trail ({entry.piiDetected.length})
                        </div>
                        {entry.piiDetected.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {entry.piiDetected.map((item, idx) => (
                              <span key={idx} className={`px-2 py-1 rounded border font-mono text-[9px] flex items-center gap-1 ${getPiiBadgeColors(item.type)}`}>
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-bold">{item.type}</span>
                                <span className="text-slate-500">({item.method})</span>
                                <span>:</span>
                                <span className="font-semibold">{item.value}</span>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500 italic">
                            No sensitive data found / No redaction needed.
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 self-start md:self-center">
                        {activeTab === 'priority' ? (
                          <div className="bg-rose-950/30 text-rose-400 border border-rose-900/50 px-3 py-2 rounded font-mono uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
                            <span>SLA ALERT: HIGH PRIORITY TRIAGE PENDING</span>
                          </div>
                        ) : (
                          <div className="bg-emerald-950/30 text-emerald-400 border border-emerald-900/50 px-3 py-2 rounded font-mono uppercase tracking-wide text-[10px] flex items-center gap-1.5">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                            <span>READY: ROUTED TO MARKETING STREAM</span>
                          </div>
                        )}
                      </div>
                    </div>

                  </div>
                )}

              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
