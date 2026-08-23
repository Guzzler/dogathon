import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HubView } from "./phases/hub/HubView";
import { WelcomeView } from "./phases/onboarding/WelcomeView";
import { OnboardingView } from "./phases/onboarding/OnboardingView";
import { DiscoveryView } from "./phases/discovery/DiscoveryView";
import { DogDetailView } from "./phases/discovery/DogDetailView";
import { SavedView } from "./phases/discovery/SavedView";
import { MatchView } from "./phases/match/MatchView";
import { MatchChatView } from "./phases/match/MatchChatView";
import { CarePlanView } from "./phases/careplan/CarePlanView";
import { PostFosterView } from "./phases/postfoster/PostFosterView";
import { PublicAdoptionView } from "./phases/postfoster/PublicAdoptionView";
import { SignInView } from "./phases/auth/SignInView";
import { DemoIntroView, demoIntroSeen } from "./phases/auth/DemoIntroView";
import { useSession } from "./hooks/useSession";
import { useFoster } from "./hooks/useFoster";
import { hasOnboarded, journeyHome } from "./lib/foster";
import "./App.css";
import "./pawthway.css";
import "./theme.css";

/** The questionnaire is the front door: nothing else is reachable until it's done. */
const OPEN_ROUTES = ["/welcome", "/onboarding"];

const Boot = () => <div className="boot"><span className="boot__paw">🐾</span></div>;

/**
 * Sits in front of the onboarding gate: the app needs to know *whose* journey it's loading
 * before it can ask whether that journey has started.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const session = useSession();
  if (session.kind === "loading") return <Boot />;
  if (session.kind === "signedOut") return <SignInView />;
  return <>{children}</>;
}

function DemoIntroGate({ children }: { children: React.ReactNode }) {
  if (!demoIntroSeen()) return <DemoIntroView />;
  return <>{children}</>;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { foster, loading } = useFoster();
  const { pathname } = useLocation();

  if (loading) return <Boot />;
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
          <Route path="match/chat" element={<MatchChatView />} />
          <Route path="care-plan" element={<CarePlanView />} />
          {/* Journal & Emergency are routes, not local state, so the app tab bar can carry them. */}
          <Route path="care-plan/:tab" element={<CarePlanView />} />
          <Route path="post-foster" element={<PostFosterView />} />
        </Route>
      </Route>
    </Routes>
  );
}

/**
 * The journey's entry point sends you to whichever step you're actually on:
 * onboarding once and only once, then Match or Care Plan if a dog is already
 * spoken for, otherwise Discovery.
 */
function JourneyHome() {
  const { foster, loading } = useFoster();
  if (loading) return <Boot />;
  // Checked here rather than leaning on the gate's redirect, so a new visitor
  // goes straight to Welcome instead of bouncing through /discovery first.
  if (!hasOnboarded(foster)) return <Navigate to="/welcome" replace />;
  return <Navigate to={journeyHome(foster?.phase)} replace />;
}

// Split out so the gate can sit inside Layout and still wrap every child route.
import { Outlet } from "react-router-dom";
function GateOutlet() {
  return <AuthGate><DemoIntroGate><OnboardingGate><Outlet /></OnboardingGate></DemoIntroGate></AuthGate>;
}
