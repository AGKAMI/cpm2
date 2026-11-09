/** VANTA GARAGE — central configuration UI.
 * /store/admin/config
 * Admin key-value editor for system settings.
 */

"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { StoreShell } from "@/components/StoreShell";
import { PageHeading } from "@/components/PageHeading";
import { Button } from "@/components/ui/Button";
import { Field, TextInput } from "@/components/ui/Field";

type ConfigEntry = {
  key: string;
  value: string;
  type: string;
  isSensitive: boolean;
  updatedAt: string;
};

export default function ConfigPage() {
  const [config, setConfig] = useState<ConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    try {
      setLoading(true);
      // Fetch known config keys — Nemotron's API returns individual keys
      const keys = [
        "currency.default",
        "payment.eft.instructions",
        "payment.payfast.enabled",
        "appointment.missed.limit",
        "notification.email.enabled",
        "notification.whatsapp.enabled",
        "store.maintenance.mode",
        "store.business.hours",
      ];
      const entries: ConfigEntry[] = [];
      for (const key of keys) {
        try {
          const res = await fetch(`/api/store/admin/config/${key}`);
          if (res.ok) {
            const data = await res.json();
            entries.push({
              key,
              value: data.value,
              type: data.type ?? "string",
              isSensitive: data.isSensitive ?? false,
              updatedAt: data.updatedAt ?? "",
            });
          }
        } catch {
          // Key may not exist yet — skip
        }
      }
      setConfig(entries);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }

  async function saveConfig(key: string, value: string) {
    try {
      const res = await fetch(`/api/store/admin/config/${key}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value, type: "string", isSensitive: false }),
      });
      if (!res.ok) throw new Error("Failed to save config");
      setMsg(`Saved ${key}`);
      setEditingKey(null);
      setEditValue("");
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save config.");
    }
  }

  async function deleteConfig(key: string) {
    if (!window.confirm(`Delete config key "${key}"?`)) return;
    try {
      const res = await fetch(`/api/store/admin/config/${key}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete config");
      setMsg(`Deleted ${key}`);
      await loadConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete config.");
    }
  }

  if (loading) {
    return (
      <StoreShell>
        <PageHeading folio="CF" title="Store Configuration" backHref="/store/admin" />
        <p className="text-muted-foreground">Loading config…</p>
      </StoreShell>
    );
  }

  return (
    <StoreShell>
      <PageHeading folio="CF" title="Store Configuration" backHref="/store/admin" />

      {error && (
        <p className="mb-4 rounded-md border border-destructive bg-destructive px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      {msg && (
        <p className="mb-4 rounded-md border border-primary bg-primary px-3 py-2 text-xs text-primary">
          {msg}
        </p>
      )}

      <div className="mb-6">
        <h3 className="text-xs font-semibold text-foreground uppercase tracking-[0.15em] mb-3">
          System Settings
        </h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Edit system configuration values. Changes take effect immediately.
          Sensitive values (API keys, secrets) are stored but never returned
          to the frontend.
        </p>
        <div className="space-y-3">
          {config.map((entry) => (
            <ConfigRow
              key={entry.key}
              entry={entry}
              isEditing={editingKey === entry.key}
              onEdit={() => {
                setEditingKey(entry.key);
                setEditValue(entry.value);
              }}
              onSave={(value) => saveConfig(entry.key, value)}
              onDelete={deleteConfig}
            />
          ))}
          {config.length === 0 && (
            <p className="text-muted-foreground text-center py-8">
              No configuration keys found. Add keys via the admin API.
            </p>
          )}
        </div>
      </div>

      {editingKey && (
        <ModalEdit
          key={editingKey}
          entry={config.find((c) => c.key === editingKey)!}
          value={editValue}
          onValueChange={setEditValue}
          onSave={async () => {
            if (editingKey) await saveConfig(editingKey, editValue);
          }}
          onCancel={() => {
            setEditingKey(null);
            setEditValue("");
          }}
        />
      )}
    </StoreShell>
  );
}

function ConfigRow({
  entry,
  isEditing,
  onEdit,
  onSave,
  onDelete,
}: {
  entry: ConfigEntry;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (value: string) => void;
  onDelete: (key: string) => void;
}) {
  return (
    <article className="panel rounded-xl border border-border p-4">
      <div className="flex items-baseline justify-between mb-2">
        <span
          className={`text-xs font-mono text-foreground ${
            entry.isSensitive ? "text-destructive" : ""
          }`}
        >
          {entry.key}
        </span>
        <span className="text-[10px] text-muted-foreground">
          {entry.type}{entry.isSensitive ? " • sensitive" : ""}
        </span>
      </div>
      {isEditing ? (
        <div className="flex gap-2">
          <TextInput
            value={entry.value}
            onChange={(e) => onSave(e.target.value)}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => onSave(entry.value)}>
            Save
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit()}>
            Cancel
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-foreground break-all">
            {entry.isSensitive ? "••••••••" : entry.value}
          </p>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={() => onDelete(entry.key)}>
              Delete
            </Button>
          </div>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground mt-1">
        Updated {new Date(entry.updatedAt || Date.now()).toLocaleDateString()}
      </p>
    </article>
  );
}

function ModalEdit({
  entry,
  value,
  onValueChange,
  onSave,
  onCancel,
}: {
  entry: ConfigEntry;
  value: string;
  onValueChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="panel rounded-xl border border-border p-6 w-full max-w-md">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          Edit {entry.key}
        </h3>
        <Field label="Value" hint={entry.type}>
          <TextInput
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            className="flex-1"
          />
        </Field>
        <div className="flex gap-2 mt-4">
          <Button variant="primary" onClick={onSave}>
            Save
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
