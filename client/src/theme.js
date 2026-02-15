import { TEAMS } from "./teamData";

function isLight(hex) {
  // hex: #RRGGBB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // relative luminance (simple)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.7;
}

export function applyThemeByTeamId(teamId) {
  const root = document.documentElement;

  const team = TEAMS.find((t) => t.id === teamId);
  if (!team) {
    // default
    root.style.setProperty("--primary", "#111827");
    root.style.setProperty("--secondary", "#F3F4F6");
    root.style.setProperty("--accent", "#60A5FA");
    root.style.setProperty("--bg", "#FFFFFF");
    root.style.setProperty("--text", "#111111");
    root.style.setProperty("--card", "#FFFFFF");
    return;
  }

  root.style.setProperty("--primary", team.primary);
  root.style.setProperty("--secondary", team.secondary);
  root.style.setProperty("--accent", team.accent || team.secondary);

  // background + text: stabilno čitljivo
  root.style.setProperty("--bg", team.secondary === "#FFFFFF" ? "#FFFFFF" : "#0B0B0B");
  const textOnPrimary = isLight(team.primary) ? "#111111" : "#FFFFFF";
  root.style.setProperty("--textOnPrimary", textOnPrimary);

  // card background
  root.style.setProperty("--card", "#FFFFFF");
  root.style.setProperty("--text", "#111111");
}