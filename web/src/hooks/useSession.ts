import { useEffect, useState } from "react";
import { getSession, subscribeSession, type Session } from "../lib/session";

export function useSession(): Session {
  const [session, set] = useState<Session>(getSession);
  useEffect(() => subscribeSession(set), []);
  return session;
}
