import { useEffect, useMemo, useState } from "react";
import { authFetch } from "../api";
import { TEAMS } from "../teamData";
import { applyThemeByTeamId } from "../theme";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [favorite, setFavorite] = useState("");
  const [msg, setMsg] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    authFetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setUser(data.user);
          setFavorite(
            data.user.favorite_team_id ? String(data.user.favorite_team_id) : ""
          );
        } else {
          setMsg(data.error || "Unable to load profile");
        }
      })
      .catch((e) => setMsg(String(e)));
  }, []);

  const selectedTeam = useMemo(
    () => TEAMS.find((t) => String(t.id) === String(favorite)) || null,
    [favorite]
  );

  const teamColor = selectedTeam?.primary || "#151922";

  async function save() {
    try {
      setIsSaving(true);
      setMsg("");

      const favorite_team_id = favorite ? Number(favorite) : null;

      const res = await authFetch("/api/me/favorite-team", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ favorite_team_id }),
      });

      const data = await res.json();

      if (!data.ok) {
        setMsg(data.error || "Failed to save changes");
        return;
      }

      setUser(data.user);
      applyThemeByTeamId(data.user.favorite_team_id);
      localStorage.setItem("user", JSON.stringify(data.user));
      setMsg("Saved successfully");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setIsSaving(false);
    }
  }

  function lightenColor(hex, percent) {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);

  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;

  return (
    "#" +
    (
      0x1000000 +
      (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 0 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}





  return (
    <div
      style={{
        maxWidth: 820,
        margin: "24px auto",
        padding: "0 16px",
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            background: `linear-gradient(135deg, ${teamColor} 0%, ${lightenColor(teamColor, -25)} 100%)`,
            color: "#ffffff",
            padding: "28px 28px 24px",
            boxShadow: `0 10px 30px ${teamColor}40`,
          }}
        >
          <div style={{ fontSize: 14, opacity: 0.75, marginBottom: 8 }}>
            Account
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 34,
              lineHeight: 1.1,
              fontWeight: 900,
            }}
          >
            Profile
          </h1>
          <div style={{ marginTop: 10, opacity: 0.82, fontSize: 15 }}>
            Manage your account details and personalize your favorite team theme.
          </div>
        </div>

        {!user && (
          <div style={{ padding: 28 }}>
            <div
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 14,
                padding: 18,
                background: "#f8f8f8",
                color: "#333",
              }}
            >
              Loading profile...
            </div>
          </div>
        )}

        {user && (
          <div
            style={{
              padding: 28,
              display: "grid",
              gap: 22,
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 16,
              }}
            >
              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  padding: 18,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    opacity: 0.55,
                    marginBottom: 8,
                    fontWeight: 700,
                  }}
                >
                  Email
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: "#111111",
                    wordBreak: "break-word",
                  }}
                >
                  {user.email}
                </div>
              </div>

              <div
                style={{
                  border: "1px solid rgba(0,0,0,0.08)",
                  borderRadius: 16,
                  padding: 18,
                  background: "#fafafa",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    opacity: 0.55,
                    marginBottom: 8,
                    fontWeight: 700,
                  }}
                >
                  Current favorite
                </div>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 900,
                    color: teamColor,
                  }}
                >
                  {selectedTeam?.name || "No team selected"}
                </div>
              </div>
            </div>

            <div
              style={{
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 16,
                padding: 20,
                background: "#ffffff",
              }}
            >
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 800,
                  marginBottom: 8,
                  color: "#111111",
                }}
              >
                Favorite team
              </div>

              <div
                style={{
                  fontSize: 14,
                  opacity: 0.72,
                  marginBottom: 14,
                  color: "#111111",
                }}
              >
                Choose a team to personalize the app theme and highlight your
                preference.
              </div>

              <select
                value={favorite}
                onChange={(e) => setFavorite(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "14px 16px",
                  fontSize: 16,
                  borderRadius: 14,
                  border: "1px solid rgba(0,0,0,0.12)",
                  background: "#ffffff",
                  color: "#111111",
                  outline: "none",
                }}
              >
                <option value="">No team selected</option>
                {TEAMS.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </select>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  marginTop: 16,
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn-primary"
                  onClick={save}
                  disabled={isSaving}
                  style={{
                    padding: "12px 20px",
                    borderRadius: 12,
                    fontWeight: 800,
                    opacity: isSaving ? 0.7 : 1,
                    cursor: isSaving ? "default" : "pointer",
                  }}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>

                {msg && (
                  <div
                    style={{
                      fontSize: 14,
                      color: msg.toLowerCase().includes("saved")
                        ? "#127a3d"
                        : "#b42318",
                      fontWeight: 700,
                    }}
                  >
                    {msg}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}