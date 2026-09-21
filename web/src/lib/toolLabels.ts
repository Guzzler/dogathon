/**
 * Fosters shouldn't have to read `generate_adoption_profile` to follow what the
 * assistant is doing. Each tool gets a plain-language pair: what it's doing now,
 * and what it did once it's finished.
 *
 * Anything missing falls back to a de-snaked version of the function name, so a
 * new tool degrades to "Running get widget" rather than breaking the UI.
 */
interface Label {
  running: string;
  done: string;
  icon: string;
}

const LABELS: Record<string, Label> = {
  get_foster: { running: "Looking up your details", done: "Read your details", icon: "👤" },
  record_swipe: { running: "Saving your choice", done: "Saved your choice", icon: "❤️" },
  update_checklist: { running: "Updating your checklist", done: "Updated your checklist", icon: "✅" },

  list_dogs: { running: "Searching available dogs", done: "Searched available dogs", icon: "🔎" },
  get_dog: { running: "Looking up the dog's record", done: "Read the dog's record", icon: "🐕" },
  update_dog: { running: "Updating the dog's record", done: "Updated the dog's record", icon: "🐕" },

  get_care_log: { running: "Reading your care log", done: "Read your care log", icon: "📔" },
  log_care_entry: { running: "Adding to your care log", done: "Added to your care log", icon: "📔" },
  get_care_checklist: { running: "Checking your care tasks", done: "Checked your care tasks", icon: "✅" },

  generate_adoption_profile: { running: "Gathering everything for the profile", done: "Gathered profile details", icon: "✨" },
  send_adoption_profile_to_shelter: { running: "Sending the profile to the shelter", done: "Sent the profile to the shelter", icon: "📤" },
  withdraw_adoption_profile: { running: "Withdrawing the write-up", done: "Withdrew the write-up", icon: "↩️" },

  fetch_url: { running: "Reading a web page", done: "Read a web page", icon: "🌐" },
  calculate: { running: "Working out the numbers", done: "Worked out the numbers", icon: "🧮" },
};

function humanize(name: string) {
  const words = name.replace(/_/g, " ").trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function toolLabel(name: string, status: "running" | "done" | "error" | "pending_approval") {
  const entry = LABELS[name];
  if (!entry) {
    const fallback = humanize(name);
    return { text: status === "running" || status === "pending_approval" ? fallback : fallback, icon: "🔧" };
  }
  return {
    text: status === "done" ? entry.done : entry.running,
    icon: entry.icon,
  };
}

/** Short human sentence for the approval modal — what this action will actually do. */
export function toolConsequence(name: string): string {
  switch (name) {
    case "update_dog":
      return "This updates the dog's record at the shelter.";
    case "record_swipe":
      return "This saves or passes on the dog, the same as a swipe. It doesn't apply to foster it.";
    case "send_adoption_profile_to_shelter":
      return "This sends the adoption profile to the shelter. They'll see it right away.";
    case "withdraw_adoption_profile":
      return "This replaces the write-up on the shelter's copy with a note saying you withdrew it, and why. It doesn't change the dog's status.";
    default:
      return "This makes a change that other people can see.";
  }
}
