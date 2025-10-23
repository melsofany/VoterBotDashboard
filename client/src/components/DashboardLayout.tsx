import { Link, useLocation } from "wouter";
import { Home, Users, BarChart3, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const [location] = useLocation();

  const navItems = [
    { path: "/", icon: Home, label: "الرئيسية" },
    { path: "/voters", icon: Users, label: "الناخبون" },
    { path: "/representatives", icon: UserCheck, label: "المناديب" },
    { path: "/analytics", icon: BarChart3, label: "التحليلات" },
  ];

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-foreground">
                  حملة المرشح علاء سليمان الحديوي
                </h1>
                <p className="text-sm text-muted-foreground">
                  نظام إدارة بيانات الناخبين
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content with Bottom Navigation */}
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-6">
        {children}
      </main>

      {/* Bottom Navigation for Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card md:hidden">
        <div className="grid grid-cols-4 gap-1 p-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  className="flex h-14 w-full flex-col gap-1"
                  data-testid={`nav-${item.label}`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="text-xs">{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <nav className="fixed right-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 border-l bg-card p-4 md:block">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.path;
            return (
              <Link key={item.path} href={item.path}>
                <Button
                  variant={isActive ? "default" : "ghost"}
                  className="w-full justify-start gap-3"
                  data-testid={`nav-${item.label}`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Button>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop content wrapper */}
      <div className="hidden md:block md:mr-64" />
    </div>
  );
}
