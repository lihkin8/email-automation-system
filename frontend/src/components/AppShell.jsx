import React, { useContext, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  Menu,
  Moon,
  Send,
  Settings,
  Sparkles,
  Sun,
  Users,
} from "lucide-react";

import { AuthContext } from "@/components/RequireAuth";
import { logout } from "@/lib/api";
import { useTheme } from "@/lib/theme";
import { useAction } from "@/lib/useAction";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/templates", label: "Templates", icon: Mail },
  { to: "/campaigns", label: "Campaigns", icon: Send },
  { to: "/onboarding", label: "Onboarding", icon: ListChecks },
  { to: "/settings", label: "Settings", icon: Settings },
];

const ROUTE_LABELS = {
  "": "Dashboard",
  contacts: "Contacts",
  import: "Import",
  templates: "Templates",
  campaigns: "Campaigns",
  onboarding: "Onboarding",
  settings: "Settings",
};

function buildCrumbs(pathname) {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs = [{ label: "Dashboard", to: "/" }];
  let acc = "";
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ label: ROUTE_LABELS[seg] ?? seg, to: acc });
  }
  return crumbs;
}

export default function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) ?? {};
  const { resolvedTheme, setTheme } = useTheme();

  const crumbs = useMemo(() => buildCrumbs(location.pathname), [location.pathname]);

  const { run: doLogout, isPending: loggingOut } = useAction(logout, {
    loading: "Signing out...",
    success: "Signed out",
    onSuccess: () => navigate("/login", { replace: true }),
  });

  const initials = (user?.name || user?.email || "U")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur md:px-6">
          {/* Mobile hamburger — hidden on md+ where sidebar is visible */}
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 md:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <div className="flex h-14 items-center gap-2 border-b border-border px-4">
                <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold tracking-tight">
                  Email Automation
                </span>
              </div>
              <nav className="flex flex-col gap-1 p-2">
                {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
                  <SheetClose asChild key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                        )
                      }
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{label}</span>
                    </NavLink>
                  </SheetClose>
                ))}
              </nav>
            </SheetContent>
          </Sheet>

          <Breadcrumb>
            <BreadcrumbList>
              {crumbs.map((c, idx) => {
                const last = idx === crumbs.length - 1;
                return (
                  <React.Fragment key={c.to}>
                    <BreadcrumbItem>
                      {last ? (
                        <BreadcrumbPage>{c.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink asChild>
                          <NavLink to={c.to}>{c.label}</NavLink>
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                    {!last && <BreadcrumbSeparator />}
                  </React.Fragment>
                );
              })}
            </BreadcrumbList>
          </Breadcrumb>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`}
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full p-1 pr-2 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label="Account menu"
                >
                  <Avatar className="h-7 w-7">
                    {user?.avatar_url ? (
                      <AvatarImage src={user.avatar_url} alt={user.name ?? user.email} />
                    ) : null}
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[140px] truncate text-xs font-medium text-muted-foreground sm:inline">
                    {user?.name || user?.email || "Account"}
                  </span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {user?.name || "Account"}
                    </span>
                    {user?.email ? (
                      <span className="truncate text-xs font-normal normal-case tracking-normal text-muted-foreground">
                        {user.email}
                      </span>
                    ) : null}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    navigate("/settings");
                  }}
                >
                  <Settings />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => {
                    e.preventDefault();
                    if (!loggingOut) doLogout();
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="mx-auto w-full max-w-6xl"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}

function Sidebar({ collapsed, onToggle }) {
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-card md:flex",
        collapsed ? "w-[68px]" : "w-60"
      )}
    >
      <div
        className={cn(
          "flex h-14 items-center border-b border-border px-3",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          {!collapsed ? (
            <span className="text-sm font-semibold tracking-tight">
              Email Automation
            </span>
          ) : null}
        </div>
        {!collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onToggle}
            aria-label="Collapse sidebar"
          >
            <ChevronsLeft className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <nav className="flex flex-1 flex-col gap-1 p-2">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
                  collapsed && "justify-center px-0"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed ? <span>{label}</span> : null}
            </NavLink>
          );
          if (collapsed) {
            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>

      {collapsed ? (
        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-full text-muted-foreground"
            onClick={onToggle}
            aria-label="Expand sidebar"
          >
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      ) : null}
    </aside>
  );
}
