import { Link } from "react-router-dom";

export function ShelterNotStaffView() {
  return (
    <div className="screen shelter__message pad">
      <h1>This is the shelter side of Pawthway.</h1>
      <p className="muted">Your account isn't on a shelter's staff list.</p>
      <Link className="btn outline" to="/">Back to Pawthway</Link>
    </div>
  );
}

export function ShelterErrorView() {
  return (
    <div className="screen shelter__message pad">
      <h1>Something went wrong.</h1>
      <p className="muted">Couldn't check your shelter access. Check your connection and try again.</p>
      {/* A full reload re-runs the onSnapshot subscription from scratch, which is simpler and
          just as correct as threading a retry callback through the gate for a state this rare. */}
      <button className="btn outline" onClick={() => window.location.reload()}>Retry</button>
    </div>
  );
}
