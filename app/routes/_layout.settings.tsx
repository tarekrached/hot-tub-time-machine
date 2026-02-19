import { NavLink, Outlet } from "react-router";
import styles from "~/styles/settings.module.css";

export default function SettingsLayout() {
  return (
    <div className={styles.settings}>
      <nav className={styles.subTabs}>
        <NavLink
          to="/settings/log"
          className={({ isActive }) =>
            `${styles.subTab} ${isActive ? styles.subTabActive : ""}`
          }
        >
          Log
        </NavLink>
        <NavLink
          to="/settings/maintenance"
          className={({ isActive }) =>
            `${styles.subTab} ${isActive ? styles.subTabActive : ""}`
          }
        >
          Maintenance
        </NavLink>
        <NavLink
          to="/settings/reference"
          className={({ isActive }) =>
            `${styles.subTab} ${isActive ? styles.subTabActive : ""}`
          }
        >
          Reference
        </NavLink>
      </nav>
      <div className={styles.subContent}>
        <Outlet />
      </div>
    </div>
  );
}
