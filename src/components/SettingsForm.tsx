"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { encodeAvatar, fallbackAvatar, parseAvatar, type AvatarSpec } from "@/lib/avatar-icons";
import { AvatarPicker } from "@/components/AvatarPicker";
import { Button, ErrorText, Hint, Input, Label, TextArea } from "@/components/ui";
import { useSignOut } from "@/components/Sidebar";
import { BIO_MAX_LENGTH, DISPLAY_NAME_MAX_LENGTH, PIN_MAX_LENGTH, PIN_MIN_LENGTH } from "@/lib/validation";

interface SettingsFormProps {
  initial: { username: string; displayName: string; bio: string; profileImage: string | null };
}

export function SettingsForm({ initial }: SettingsFormProps) {
  const router = useRouter();
  const { signOut } = useSignOut();
  const [username, setUsername] = useState(initial.username);
  const [displayName, setDisplayName] = useState(initial.displayName);
  const [bio, setBio] = useState(initial.bio);
  const [avatar, setAvatar] = useState<AvatarSpec>(parseAvatar(initial.profileImage) ?? fallbackAvatar(initial.username));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, displayName, bio, profileImage: encodeAvatar(avatar) }),
      });
      const data = (await res.json()) as { error?: string; user?: { username: string } };
      if (!res.ok) throw new Error(data.error ?? "Could not save");
      setMessage("Saved.");
      router.refresh();
      if (data.user && data.user.username !== initial.username) {
        router.push(`/u/${data.user.username}`);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function changePin(e: React.FormEvent) {
    e.preventDefault();
    setPinBusy(true);
    setPinError(null);
    setPinMessage(null);
    try {
      const res = await fetch("/api/profile/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPin, newPin }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Could not change PIN");
      setPinMessage("PIN updated. Other devices have been signed out.");
      setCurrentPin("");
      setNewPin("");
    } catch (err) {
      setPinError((err as Error).message);
    } finally {
      setPinBusy(false);
    }
  }

  return (
    <div className="space-y-10 px-4 py-6 md:px-5">
      <form onSubmit={save} className="space-y-6">
        <div>
          <Label>Avatar</Label>
          <AvatarPicker value={avatar} onChange={setAvatar} />
        </div>

        <div>
          <Label htmlFor="displayName">Display name</Label>
          <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value.slice(0, DISPLAY_NAME_MAX_LENGTH))} required />
        </div>

        <div>
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            autoCapitalize="none"
            spellCheck={false}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))}
            required
          />
          <Hint>Changing this changes your profile link and what you sign in with.</Hint>
        </div>

        <div>
          <Label htmlFor="bio">Bio</Label>
          <TextArea id="bio" rows={3} value={bio} onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX_LENGTH))} placeholder="A little about you (optional)" />
          <Hint className="text-right tabular-nums">
            {bio.length}/{BIO_MAX_LENGTH}
          </Hint>
        </div>

        <ErrorText>{error}</ErrorText>
        {message && <p className="text-sm text-success">{message}</p>}

        <Button type="submit" loading={saving}>
          Save changes
        </Button>
      </form>

      <form onSubmit={changePin} className="space-y-4 border-t border-border pt-8">
        <h2 className="font-semibold">Change PIN</h2>
        <p className="text-sm text-fg-muted">{PIN_MIN_LENGTH} to {PIN_MAX_LENGTH} digits. Obvious PINs like 1234 or a year are rejected.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="currentPin">Current PIN</Label>
            <Input
              id="currentPin"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
              className="tracking-[0.4em]"
            />
          </div>
          <div>
            <Label htmlFor="newPin">New PIN</Label>
            <Input
              id="newPin"
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, PIN_MAX_LENGTH))}
              className="tracking-[0.4em]"
            />
          </div>
        </div>
        <ErrorText>{pinError}</ErrorText>
        {pinMessage && <p className="text-sm text-success">{pinMessage}</p>}
        <Button type="submit" variant="secondary" loading={pinBusy} disabled={currentPin.length < PIN_MIN_LENGTH || newPin.length < PIN_MIN_LENGTH}>
          Update PIN
        </Button>
      </form>

      <div className="border-t border-border pt-8">
        <h2 className="font-semibold">Session</h2>
        <p className="mt-1 text-sm text-fg-muted">Sign out of this device. Your posts, likes and score stay put.</p>
        <Button type="button" variant="secondary" className="mt-3" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </div>
  );
}
