"use client";

import React, { useEffect, useState } from "react";
import { Settings } from "lucide-react";

type Prefs = {
  emailNotifications?: boolean;
  inAppNotifications?: boolean;
  sweepNotifications?: boolean;
  claimNotifications?: boolean;
  yieldNotifications?: boolean;
  milestoneNotifications?: boolean;
};

export default function SettingsClient() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/notifications/preferences", {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setPrefs(data);
        }
      } catch (e) {
        // ignore for now
      }
    };
    load();
  }, []);

  const toggle = (key: keyof Prefs) => {
    setPrefs((p) => (p ? { ...p, [key]: !p[key] } : p));
  };

  const save = async () => {
    if (!prefs) return;
    setSaving(true);
    try {
      await fetch("/notifications/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
    } catch (e) {
      // ignore
    }
    setSaving(false);
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-linear-to-b from-[#063d3d] to-[#0a6f6f] flex items-center justify-center text-[#5de0e0]">
          <Settings size={20} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white m-0">Settings</h1>
          <p className="text-[#5e8c96] text-sm m-0">
            Manage your account preferences
          </p>
        </div>
      </div>

      <div className="bg-linear-to-b from-[rgba(6,18,20,0.45)] to-[rgba(4,12,14,0.35)] border border-[rgba(8,120,120,0.06)] rounded-2xl p-8">
        <h2 className="text-lg font-semibold text-white mb-4">Notifications</h2>
        <div className="flex flex-col gap-4 text-left max-w-xl mx-auto">
          <label className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">Email Notifications</div>
              <div className="text-sm text-[#5e8c96]">
                Receive emails about important account events
              </div>
            </div>
            <input
              type="checkbox"
              checked={!!prefs?.emailNotifications}
              onChange={() => toggle("emailNotifications")}
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">In-app Notifications</div>
              <div className="text-sm text-[#5e8c96]">
                Show notifications inside the app
              </div>
            </div>
            <input
              type="checkbox"
              checked={!!prefs?.inAppNotifications}
              onChange={() => toggle("inAppNotifications")}
            />
          </label>

          <label className="flex items-center justify-between">
            <div>
              <div className="text-white font-medium">
                Goal Milestone Notifications
              </div>
              <div className="text-sm text-[#5e8c96]">
                Receive celebratory messages when goals reach 25%, 50%, 75%, and
                100%
              </div>
            </div>
            <input
              type="checkbox"
              checked={!!prefs?.milestoneNotifications}
              onChange={() => toggle("milestoneNotifications")}
            />
          </label>

          <div className="text-right">
            <button
              className="px-4 py-2 rounded bg-[#06b6b6] text-black font-semibold"
              onClick={save}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Preferences"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
