import { useEffect, useState } from "react";
import { authFetch } from "../api";
import { TEAMS } from "../teamData";
import { applyThemeByTeamId } from "../theme";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [favorite, setFavorite] = useState("");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    authFetch("/api/me")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setUser(data.user);
          setFavorite(data.user.favorite_team_id ? String(data.user.favorite_team_id) : "");
        } else {
          setMsg(data.error || "Ne mogu da učitam profil");
        }
      })
      .catch((e) => setMsg(String(e)));
  }, []);

  async function save() {
    setMsg("");
    const favorite_team_id = favorite ? Number(favorite) : null;

    const res = await authFetch("/api/me/favorite-team", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite_team_id }),
    });
    const data = await res.json();
    if (!data.ok) {
      setMsg(data.error || "Greška pri snimanju");
      return;
    }

    setUser(data.user);
    applyThemeByTeamId(data.user.favorite_team_id);
    localStorage.setItem("user", JSON.stringify(data.user));
    setMsg("Sačuvano ✅");
  }

  return (
    <div style={{ maxWidth: 520 }}>
      <h2>Profile</h2>

      {!user && <p>Loading...</p>}

      {user && (
        <>
          <p>Email: <b>{user.email}</b></p>

          <label>Favorite team</label>
          <select
            value={favorite}
            onChange={(e) => setFavorite(e.target.value)}
            style={{ display: "block", marginTop: 6, padding: 10, width: "100%" }}
          >
            <option value="">(No option selected)</option>
            {TEAMS.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </select>

          <button className="btn-primary" onClick={save} style={{ marginTop: 12 }}>
              Save
          </button>

          {msg && <div style={{ marginTop: 12 }}>{msg}</div>}
        </>
      )}
    </div>
  );
}