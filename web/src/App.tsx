import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HubView } from "./phases/hub/HubView";
import { WelcomeView } from "./phases/onboarding/WelcomeView";
import { OnboardingView } from "./phases/onboarding/OnboardingView";
import { DiscoveryView } from "./phases/discovery/DiscoveryView";
import { DogDetailView } from "./phases/discovery/DogDetailView";
import { SavedView } from "./phases/discovery/SavedView";
import { MatchView } from "./phases/match/MatchView";
import { CarePlanView } from "./phases/careplan/CarePlanView";
import { PostFosterView } from "./phases/postfoster/PostFosterView";
import { PublicAdoptionView } from "./phases/postfoster/PublicAdoptionView";
import { useFoster } from "./hooks/useFoster";
import { hasOnboarded, journeyHome } from "./lib/foster";
import "./App.css";
import "./pawthway.css";
import "./theme.css";

/** The questionnaire is the front door: nothing else is reachable until it's done. */
const OPEN_ROUTES = ["/welcome", "/onboarding"];

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { foster, loading } = useFoster();
  const { pathname } = useLocation();

  if (loading) return <div className="boot"><span className="boot__paw">🐾</span></div>;
  if (!hasOnboarded(foster) && !OPEN_ROUTES.includes(pathname)) {
    return <Navigate to="/welcome" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        {/* A shared adoption link must open for someone with no Pawthway account. */}
        <Route path="adoption/:id" element={<PublicAdoptionView />} />
        <Route element={<GateOutlet />}>
          <Route index element={<JourneyHome />} />
          <Route path="hub" element={<HubView />} />
          <Route path="welcome" element={<WelcomeView />} />
          <Route path="onboarding" element={<OnboardingView />} />
          <Route path="discovery" element={<DiscoveryView />} />
          <Route path="dog/:id" element={<DogDetailView />} />
          <Route path="saved" element={<SavedView />} />
          <Route path="match" element={<MatchView />} />
          <Route path="care-plan" element={<CarePlanView />} />
          <Route path="post-foster" element={<PostFosterView />} />
        </Route>
      </Route>
    </Routes>
  );
}

/** The journey's entry point sends you to whichever step you're actually on. */
function JourneyHome() {
  const { foster, loading } = useFoster();
  if (loading) return <div className="boot"><span className="boot__paw">🐾</span></div>;
  return <Navigate to={journeyHome(foster?.phase)} replace />;
}

// Split out so the gate can sit inside Layout and still wrap every child route.
import { Outlet } from "react-router-dom";
function GateOutlet() {
  return <OnboardingGate><Outlet /></OnboardingGate>;
}
