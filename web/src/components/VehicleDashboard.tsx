"use client";

import { useEffect, useState, useCallback } from "react";
import type { TeslaVehicle, TeslaVehicleData } from "@/lib/tesla";

type VehicleWithData = TeslaVehicle & { data: TeslaVehicleData | null };

const COMMANDS = [
  { id: "door_lock", label: "Lock", icon: "🔒" },
  { id: "door_unlock", label: "Unlock", icon: "🔓" },
  { id: "auto_conditioning_start", label: "Climate On", icon: "❄️" },
  { id: "auto_conditioning_stop", label: "Climate Off", icon: "🌡️" },
  { id: "charge_start", label: "Start Charge", icon: "⚡" },
  { id: "charge_stop", label: "Stop Charge", icon: "🔋" },
  { id: "honk_horn", label: "Honk", icon: "📯" },
  { id: "flash_lights", label: "Flash", icon: "💡" },
];

export default function VehicleDashboard() {
  const [vehicles, setVehicles] = useState<VehicleWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleWithData | null>(null);
  const [commandLoading, setCommandLoading] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ msg: string; ok: boolean } | null>(null);

  const fetchVehicles = useCallback(async () => {
    try {
      const res = await fetch("/api/tesla/vehicles");
      if (res.ok) {
        const data = await res.json();
        setVehicles(data);
        if (data.length > 0 && !selectedVehicle) setSelectedVehicle(data[0]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedVehicle]);

  useEffect(() => {
    fetchVehicles();
    const id = setInterval(fetchVehicles, 30000);
    return () => clearInterval(id);
  }, [fetchVehicles]);

  async function runCommand(vehicleId: string, command: string, body?: object) {
    setCommandLoading(command);
    try {
      const res = await fetch("/api/tesla/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, command, body }),
      });
      const data = await res.json();
      const msg = data.error ?? (data.response?.result ? "Command sent" : (data.response?.reason ?? "Done"));
      setNotification({ msg, ok: res.ok && !data.error });
    } catch {
      setNotification({ msg: "Command failed", ok: false });
    } finally {
      setCommandLoading(null);
      setTimeout(() => setNotification(null), 3000);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const v = selectedVehicle;
  const d = v?.data;

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`fixed top-4 right-4 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 ${notification.ok ? "bg-green-900 text-green-300 border border-green-700" : "bg-red-900 text-red-300 border border-red-700"}`}>
          {notification.msg}
        </div>
      )}

      {/* Vehicle selector */}
      {vehicles.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {vehicles.map((veh) => (
            <button
              key={veh.id}
              onClick={() => setSelectedVehicle(veh)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedVehicle?.id === veh.id ? "bg-red-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800"}`}
            >
              {veh.display_name}
            </button>
          ))}
        </div>
      )}

      {v && (
        <>
          {/* Vehicle header */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white text-xl font-bold">{v.display_name}</h2>
                <p className="text-zinc-500 text-sm">{v.vin}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${v.state === "online" ? "bg-green-950 text-green-400 border border-green-800" : "bg-zinc-800 text-zinc-500"}`}>
                {v.state}
              </span>
            </div>

            {d ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Stat label="Battery" value={`${d.charge_state.battery_level}%`} sub={d.charge_state.charging_state} />
                <Stat label="Range" value={`${Math.round(d.charge_state.battery_level * 3.2)} mi`} sub="estimated" />
                <Stat label="Inside" value={`${Math.round(d.climate_state.inside_temp * 9/5 + 32)}°F`} sub={d.climate_state.is_climate_on ? "climate on" : "climate off"} />
                <Stat label="Outside" value={`${Math.round(d.climate_state.outside_temp * 9/5 + 32)}°F`} sub="ambient" />
              </div>
            ) : (
              <p className="text-zinc-500 text-sm">Vehicle is {v.state} — data unavailable</p>
            )}
          </div>

          {/* Lock status */}
          {d && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <StatusCard label="Doors" value={d.vehicle_state.locked ? "Locked" : "Unlocked"} ok={d.vehicle_state.locked} />
              <StatusCard label="Sentry" value={d.vehicle_state.sentry_mode ? "Active" : "Off"} ok={d.vehicle_state.sentry_mode} />
              <StatusCard label="Odometer" value={`${Math.round(d.vehicle_state.odometer).toLocaleString()} mi`} ok={null} />
            </div>
          )}

          {/* Commands */}
          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <h3 className="text-white font-semibold mb-4">Controls</h3>
            {v.state !== "online" && (
              <p className="text-zinc-500 text-sm mb-4">Vehicle must be online to send commands. Commands may wake the vehicle.</p>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {COMMANDS.map((cmd) => (
                <button
                  key={cmd.id}
                  onClick={() => runCommand(String(v.id), cmd.id)}
                  disabled={commandLoading !== null}
                  className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 border border-zinc-700 rounded-xl p-4 text-center transition-colors group"
                >
                  <div className="text-2xl mb-2">{commandLoading === cmd.id ? "⏳" : cmd.icon}</div>
                  <div className="text-white text-sm font-medium">{cmd.label}</div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {vehicles.length === 0 && (
        <div className="text-center py-16 text-zinc-500">
          No vehicles found on this Tesla account.
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <p className="text-white font-bold text-xl">{value}</p>
      <p className="text-zinc-600 text-xs mt-1 capitalize">{sub}</p>
    </div>
  );
}

function StatusCard({ label, value, ok }: { label: string; value: string; ok: boolean | null }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
      <span className="text-zinc-400 text-sm">{label}</span>
      <span className={`text-sm font-medium ${ok === true ? "text-green-400" : ok === false ? "text-red-400" : "text-zinc-300"}`}>
        {value}
      </span>
    </div>
  );
}
