import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';

// Pages
import Overview from './pages/Overview';
import MerchantPolicies from './pages/MerchantPolicies';
import AiBuyer from './pages/AiBuyer';
import Decisions from './pages/Decisions';
import DecisionDetail from './pages/DecisionDetail';
import FailureCenter from './pages/FailureCenter';
import ChaosControl from './pages/ChaosControl';
import AuditLedger from './pages/AuditLedger';
import Evaluation from './pages/Evaluation';
import DemoMode from './pages/DemoMode';

function App() {
  return (
    <Router>
      <AppShell>
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/policies" element={<MerchantPolicies />} />
          <Route path="/buyer" element={<AiBuyer />} />
          <Route path="/decisions" element={<Decisions />} />
          <Route path="/decisions/:id" element={<DecisionDetail />} />
          <Route path="/failures" element={<FailureCenter />} />
          <Route path="/chaos" element={<ChaosControl />} />
          <Route path="/audit" element={<AuditLedger />} />
          <Route path="/evaluation" element={<Evaluation />} />
          <Route path="/demo" element={<DemoMode />} />
        </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
