import {
  type RouteConfig,
  index,
  layout,
  route,
} from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    index("routes/_layout._index.tsx"),
    route("test", "routes/_layout.test.tsx"),
    layout("routes/_layout.settings.tsx", [
      route("settings", "routes/_layout.settings._index.tsx"),
      route("settings/log", "routes/_layout.settings.log.tsx"),
      route("settings/maintenance", "routes/_layout.settings.maintenance.tsx"),
      route("settings/reference", "routes/_layout.settings.reference.tsx"),
    ]),
  ]),
] satisfies RouteConfig;
