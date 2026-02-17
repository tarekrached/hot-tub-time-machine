/** @jsxImportSource https://esm.sh/react@18.3.1 */
import React, { useState, useEffect } from "https://esm.sh/react@18.3.1";
import type { MaintenanceEvent, MaintenanceType } from "../../shared/types.ts";
import { MAINTENANCE_LABELS } from "../../shared/types.ts";
import { SODIUM_BROMIDE_OZ, timeSinceLabel } from "../../shared/chemistry.ts";

interface Props {
  onLogged: () => void;
}

export default function MaintenanceLog({ onLogged }: Props) {
  const [events, setEvents] = useState<MaintenanceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showReminder, setShowReminder] = useState(false);
  const [notes, setNotes] = useState("");
  const [activeType, setActiveType] = useState<MaintenanceType | null>(null);

  const loadEvents = () => {
    fetch("/api/maintenance")
      .then((r) => r.json())
      .then((data) => {
        setEvents(data);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleLog = async (eventType: MaintenanceType) => {
    if (eventType === "drain_refill") {
      setActiveType(eventType);
      setShowReminder(true);
      return;
    }
    setActiveType(eventType);
  };

  const confirmLog = async () => {
    if (!activeType) return;
    await fetch("/api/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: activeType,
        notes: notes || undefined,
      }),
    });
    setActiveType(null);
    setShowReminder(false);
    setNotes("");
    loadEvents();
    onLogged();
  };

  const cancelLog = () => {
    setActiveType(null);
    setShowReminder(false);
    setNotes("");
  };

  const maintTypes: MaintenanceType[] = ["filter_change", "water_change", "drain_refill"];

  return (
    <div className="maintenance">
      <h2>Maintenance</h2>

      <div className="maint-actions">
        {maintTypes.map((mt) => (
          <button
            key={mt}
            className="btn btn-action"
            onClick={() => handleLog(mt)}
          >
            Log {MAINTENANCE_LABELS[mt]}
          </button>
        ))}
      </div>

      {/* Confirmation / notes for non-drain_refill */}
      {activeType && !showReminder && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Log {MAINTENANCE_LABELS[activeType]}?</h3>
            <textarea
              className="notes-input"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={cancelLog}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmLog}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Drain & Refill reminder */}
      {showReminder && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Drain & Refill Reminder</h3>
            <div className="reminder-card">
              <p>After refilling, don't forget:</p>
              <ol>
                <li>
                  <strong>Add sodium bromide</strong> - ~{SODIUM_BROMIDE_OZ} oz for
                  your 330 gallon tub
                </li>
                <li>
                  <strong>Shock with bleach</strong> to activate the bromide bank
                </li>
                <li>
                  <strong>Balance water</strong> - test TA, then pH, then calcium
                </li>
              </ol>
            </div>
            <textarea
              className="notes-input"
              placeholder="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
            <div className="btn-row">
              <button className="btn btn-secondary" onClick={cancelLog}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={confirmLog}>
                Confirm & Log
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <p>No maintenance events logged yet.</p>
        </div>
      ) : (
        <div className="history-list">
          {events.map((e) => (
            <div key={e.id} className="history-item">
              <div className="history-header" style={{ cursor: "default" }}>
                <span className="history-date">
                  {new Date(e.created_at + "Z").toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="history-tests">
                  {MAINTENANCE_LABELS[e.event_type]}
                </span>
                <span className="history-arrow">
                  {timeSinceLabel(e.created_at)}
                </span>
              </div>
              {e.notes && (
                <div className="history-detail" style={{ padding: "8px 16px" }}>
                  <p className="history-notes">{e.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
