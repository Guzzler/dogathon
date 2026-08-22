import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { HubView } from "./phases/hub/HubView";
import { OnboardingView } from "./phases/onboarding/OnboardingView";
import { DiscoveryView } from "./phases/discovery/DiscoveryView";
import { MatchView } from "./phases/match/MatchView";
import { CarePlanView } from "./phases/careplan/CarePlanView";
import { PostFosterView } from "./phases/postfoster/PostFosterView";
import "./App.css";
import "./pawthway.css";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HubView />} />
        <Route path="onboarding" element={<OnboardingView />} />
        <Route path="discovery" element={<DiscoveryView />} />
        <Route path="match" element={<MatchView />} />
        <Route path="care-plan" element={<CarePlanView />} />
        <Route path="post-foster" element={<PostFosterView />} />
      </Route>
    </Routes>
  );
}
