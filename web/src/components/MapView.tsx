import { useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { AnimatePresence, motion } from "motion/react";
import { dogPhoto, type RichDog } from "../lib/dog";
import { distanceMi } from "../lib/matching";

/** Single paw, drawn rather than the two-paw 🐾 emoji. */
const PAW = `<svg viewBox="0 0 100 100" width="22" height="22" aria-hidden>
  <ellipse cx="35" cy="30" rx="11" ry="14" fill="var(--coral)"/>
  <ellipse cx="65" cy="30" rx="11" ry="14" fill="var(--coral)"/>
  <ellipse cx="16" cy="52" rx="10" ry="12.5" fill="var(--coral)" transform="rotate(-20 16 52)"/>
  <ellipse cx="84" cy="52" rx="10" ry="12.5" fill="var(--coral)" transform="rotate(20 84 52)"/>
  <path d="M50 48c13.5 0 23.5 10.5 23.5 21.5C73.5 79 65 84 50 84s-23.5-5-23.5-14.5C26.5 58.5 36.5 48 50 48Z" fill="var(--coral)"/>
</svg>`;

const pinIcon = (n: number, sel: boolean) =>
  L.divIcon({
    className: "pin",
    html: `<div class="pin-in" data-sel="${sel}">${PAW}${n ? `<span class="pin-badge">${n}</span>` : ""}</div>`,
    iconSize: [46, 46], iconAnchor: [23, 23],
  });

const meIcon = L.divIcon({ className: "pin", html: `<div class="me-dot"></div>`, iconSize: [16, 16], iconAnchor: [8, 8] });

/** Leaflet caches the container size; the sheet below the map changes it, so re-measure. */
function KeepSized() {
  const map = useMap();
  useEffect(() => {
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [map]);
  return null;
}

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: .8 }); }, [center[0], center[1], zoom]); // eslint-disable-line
  return null;
}

type SortKey = "match" | "near" | "easy" | "small";
const SORTS: { k: SortKey; l: string }[] = [
  { k: "match", l: "Best match" }, { k: "near", l: "Nearby" },
  { k: "easy", l: "First-time friendly" }, { k: "small", l: "Small" },
];

export default function MapView({ dogs, me, scoreOf, onOpen }: {
  dogs: RichDog[];
  me: { lat: number; lng: number };
  scoreOf: (d: RichDog) => number;
  onOpen: (id: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("match");

  // Derived from the dogs, not from the SHELTERS constant — real orgs aren't in that list,
  // and iterating it would leave every genuine shelter without a pin.
  const shelters = useMemo(() => {
    const by = new Map<string, { shelter: RichDog["shelter"]; dogs: RichDog[] }>();
    dogs.forEach(d => {
      const hit = by.get(d.shelter.id);
      if (hit) hit.dogs.push(d);
      else by.set(d.shelter.id, { shelter: d.shelter, dogs: [d] });
    });
    return [...by.values()].map(({ shelter, dogs }) => ({
      ...shelter, dogs, miles: distanceMi(me, shelter),
    }));
  }, [dogs, me]);

  // A shelter can vanish between renders (filters, a new roster) — don't assume it's there.
  const selS = sel ? shelters.find(s => s.id === sel) ?? null : null;

  const list = useMemo(() => {
    let out = selS ? selS.dogs : dogs;
    // Deliberately excludes unknowns: a "first-time friendly" filter should be conservative,
    // and leaving a dog out is not a claim about it.
    if (!selS && sort === "easy") out = out.filter(d => d.energyLevel <= 2 && d.good_with_kids === true);
    if (!selS && sort === "small") out = out.filter(d => d.size === "small");
    const copy = [...out];
    if (sort === "near") copy.sort((a, b) => distanceMi(me, a.shelter) - distanceMi(me, b.shelter));
    else copy.sort((a, b) => scoreOf(b) - scoreOf(a));
    return copy;
  }, [dogs, selS, sort, me]); // eslint-disable-line

  const center: [number, number] = selS ? [selS.lat, selS.lng] : [me.lat, me.lng];

  return (
    <div style={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
      <div style={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0 }}>
        <MapContainer center={[me.lat, me.lng]} zoom={13} zoomControl={false} style={{ position: "absolute", inset: 0 }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='&copy; OpenStreetMap &copy; CARTO'
          />
          <KeepSized />
          <Recenter center={center} zoom={selS ? 14 : 13} />
          <Marker position={[me.lat, me.lng]} icon={meIcon} />
          {shelters.map(s => (
            <Marker key={s.id} position={[s.lat, s.lng]} icon={pinIcon(s.dogs.length, sel === s.id)}
              eventHandlers={{ click: () => setSel(sel === s.id ? null : s.id) }} />
          ))}
        </MapContainer>

        <AnimatePresence>
          {!sel && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              style={{ position: "absolute", top: 10, left: 0, right: 0, display: "grid", placeItems: "center", zIndex: 500, pointerEvents: "none" }}>
              <div className="chip" style={{ background: "rgba(255,255,255,.94)", boxShadow: "var(--shadow)", fontSize: 12, padding: "8px 14px" }}>
                Tap a pin to see that shelter's dogs
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div style={{
        background: "#fff", borderRadius: "26px 26px 0 0", boxShadow: "0 -8px 30px rgba(87,62,48,.15)",
        padding: "12px 0 max(12px,env(safe-area-inset-bottom))", zIndex: 600, flexShrink: 0, minWidth: 0,
      }}>
        <div style={{ padding: "0 20px", display: "flex", alignItems: "center", gap: 9 }}>
          <h3 style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selS ? selS.name : "Dogs you might love"}
          </h3>
          <span className="sp" />
          {selS
            ? <button className="chip coral" style={{ fontWeight: 800 }} onClick={() => setSel(null)}>✕ All shelters</button>
            : <span className="muted" style={{ fontWeight: 700 }}>{list.length}</span>}
        </div>
        {selS && <div className="muted" style={{ padding: "3px 20px 0" }}>{selS.miles.toFixed(1)} mi · {selS.address}</div>}

        {!selS && (
          <div style={{ display: "flex", gap: 7, overflowX: "auto", padding: "11px 20px 0", scrollbarWidth: "none", minWidth: 0 }}>
            {SORTS.map(s => (
              <button key={s.k} onClick={() => setSort(s.k)} className={`chip ${sort === s.k ? "coral" : ""}`}
                style={{ flexShrink: 0, fontWeight: 800, border: sort === s.k ? "1.5px solid var(--coral)" : "1.5px solid transparent" }}>
                {s.l}
              </button>
            ))}
          </div>
        )}

        {list.length === 0 ? (
          <p className="muted" style={{ padding: "20px 20px 10px" }}>No dogs match that filter right now.</p>
        ) : (
          <div style={{ display: "flex", gap: 12, overflowX: "auto", padding: "13px 20px 2px", scrollbarWidth: "none", minWidth: 0 }}>
            {list.map(d => (
              <button key={d.id} onClick={() => onOpen(d.id)} style={{ flexShrink: 0, width: 108, textAlign: "left" }}>
                <div style={{
                  position: "relative", width: 108, height: 108, borderRadius: 17, overflow: "hidden",
                  background: `var(--cream-2) url(${dogPhoto(d, 300, 300)}) center/cover`,
                }}>
                  <span style={{
                    position: "absolute", top: 6, right: 6, padding: "3px 7px", borderRadius: 100,
                    background: "rgba(255,255,255,.94)", fontSize: 10.5, fontWeight: 800, color: "var(--ink)",
                  }}>{scoreOf(d)}%</span>
                </div>
                <div style={{ fontWeight: 800, fontSize: 14, marginTop: 7 }}>{d.name}</div>
                <div className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.breed}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
