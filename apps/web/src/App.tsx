import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/AppShell';

import Overview from './pages/Overview';
import MerchantPolicies from './pages/MerchantPolicies';
import AiBuyer from './pages/AiBuyer';
import Decisions from './pages/Decisions';
import DecisionDetail from './pages/DecisionDetail';
import FailureCenter from './pages/FailureCenter';
import AuditLedger from './pages/AuditLedger';

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
          <Route path="/audit" element={<AuditLedger />} />
        </Routes>
      </AppShell>
    </Router>
  );
}

export default App;
