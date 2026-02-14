import { NavLink, Outlet, useNavigate } from "react-router-dom";

export default function Layout() {
  const navigate = useNavigate();

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  }

  const linkStyle = ({ isActive }) => ({
    padding: "10px 12px",
    borderRadius: 8,
    textDecoration: "none",
    color: "black",
    background: isActive ? "#eaeaea" : "transparent",
  });

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: 16,
          borderBottom: "1px solid #ddd",
        }}
      >
        <div style={{ fontWeight: 700 }}>F1PS</div>

        <nav style={{ display: "flex", gap: 8 }}>
          <NavLink to="/results" style={linkStyle}>Results</NavLink>
          <NavLink to="/teams" style={linkStyle}>Teams</NavLink>
          <NavLink to="/realtime" style={linkStyle}>Real time</NavLink>
          <NavLink to="/profile" style={linkStyle}>Profile</NavLink>
        </nav>

        <button onClick={logout}>Logout</button>
      </header>

      <main style={{ padding: 16 }}>
        <Outlet />
      </main>
    </div>
  );
}