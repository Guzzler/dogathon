import { useMyShelters } from "../../hooks/useStaffShelters";

/**
 * RS-2's whole job: prove a staff member reaches a shelter surface that knows who they are.
 * No application list, no dog editing yet -- that's RS-5 and RS-6.
 */
export function ShelterHomeView() {
  const shelters = useMyShelters();
  return (
    <div className="screen shelter__home">
      <div className="pad shelter__header">
        <h1>Shelter dashboard</h1>
        <p className="muted">
          Signed in as staff at {shelters.map((s) => s.name).join(", ")}.
        </p>
      </div>
      <div className="pad">
        <p className="muted">Applications and roster tools are coming soon.</p>
      </div>
    </div>
  );
}
