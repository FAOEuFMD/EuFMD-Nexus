import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Layout, RouteGuard } from './components';

// Import pages
import {
  Home,
  Login,
  RMT,
  RMTRiskScores,
  RMTResults,
  RMTData,
  PCP,
  Training,
  DiagnosticSupport,
  EmergencyResponse,
  FastReport,
  GetPrepared,
  Monitoring,
  RISPLanding,
  RISPOutbreak,
  RISPVaccination,
  RISPSurveillance,
  RISPSummary,
  PCPMap,
  GetPreparedWall,
  EmergencyToolbox,
  Vademos,
  ViewPastTrainingData,
  Thrace,

} from './pages';

const AppRouter: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* Public Routes - No authentication required */}
        <Route path="/login" element={<Login />} />
        
        {/* Routes with Layout */}
        <Route path="/" element={<Layout />}>
          {/* Public Pages */}
          <Route 
            index 
            element={
              <RouteGuard requiresAuth={false}>
                <Home />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="getprepared" 
            element={
              <RouteGuard requiresAuth={false}>
                <GetPrepared />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="training" 
            element={
              <RouteGuard requiresAuth={false}>
                <Training />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="monitoring" 
            element={
              <RouteGuard requiresAuth={false}>
                <Monitoring />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="emergency-response" 
            element={
              <RouteGuard requiresAuth={false}>
                <EmergencyResponse />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="fast-report" 
            element={
              <RouteGuard requiresAuth={false}>
                <FastReport />
              </RouteGuard>
            } 
          />
          
          {/* RMT Routes - Public */}
          <Route 
            path="rmt" 
            element={
              <RouteGuard requiresAuth={false}>
                <RMT />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="rmt/risk-scores" 
            element={
              <RouteGuard requiresAuth={false}>
                <RMTRiskScores />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="rmt/results" 
            element={
              <RouteGuard requiresAuth={false}>
                <RMTResults />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="RMT" 
            element={
              <RouteGuard requiresAuth={false}>
                <RMT />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="PCP-fmd-map" 
            element={
              <RouteGuard requiresAuth={false}>
                <PCPMap />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="get-prepared-wall" 
            element={
              <RouteGuard requiresAuth={false}>
                <GetPreparedWall />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="emergency-toolbox" 
            element={
              <RouteGuard requiresAuth={false}>
                <EmergencyToolbox />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="Vademos" 
            element={
              <RouteGuard requiresAuth={false}>
                <Vademos />
              </RouteGuard>
            } 
          />

          <Route 
            path="view-past-training-impact" 
            element={
              <RouteGuard requiresAuth={false}>
                <ViewPastTrainingData />
              </RouteGuard>
            } 
          />


          {/* Admin-only Routes */}
          <Route 
            path="PCP_fmd" 
            element={
              <RouteGuard requiresAdmin={true}>
                <PCP />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="diagnostic-support" 
            element={
              <RouteGuard requiresAdmin={true}>
                <DiagnosticSupport />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="RMTData" 
            element={
              <RouteGuard requiresAdmin={true}>
                <RMTData />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="rmt-data" 
            element={
              <RouteGuard requiresAdmin={true}>
                <RMTData />
              </RouteGuard>
            } 
          />
          


          {/* Authenticated Routes (RISP) */}
          <Route 
            path="risp" 
            element={
              <RouteGuard requiresAuth={true}>
                <RISPLanding />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="risp/outbreak" 
            element={
              <RouteGuard requiresAuth={true}>
                <RISPOutbreak />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="risp/vaccination" 
            element={
              <RouteGuard requiresAuth={true}>
                <RISPVaccination />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="risp/surveillance" 
            element={
              <RouteGuard requiresAuth={true}>
                <RISPSurveillance />
              </RouteGuard>
            } 
          />
          
          <Route 
            path="risp/summary" 
            element={
              <RouteGuard requiresAuth={true}>
                <RISPSummary />
              </RouteGuard>
            } 
          />
          
          {/* Authenticated Routes (Thrace) */}
          <Route 
            path="thrace" 
            element={
              <RouteGuard requiresAuth={true}>
                <Thrace />
              </RouteGuard>
            } 
          />
        </Route>
      </Routes>
    </Router>
  );
};

export default AppRouter;
