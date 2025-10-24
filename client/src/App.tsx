import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import Voters from "@/pages/Voters";
import Representatives from "@/pages/Representatives";
import Analytics from "@/pages/Analytics";
import Login from "@/pages/Login";
import TelegramMiniApp from "@/pages/TelegramMiniApp";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function ProtectedRoute({ component: Component }: { component: () => JSX.Element }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading } = useQuery({
    queryKey: ['/api/me'],
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation('/login');
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/telegram-mini-app" component={TelegramMiniApp} />
      <Route path="/">
        <ProtectedRoute component={() => (
          <DashboardLayout>
            <Dashboard />
          </DashboardLayout>
        )} />
      </Route>
      <Route path="/voters">
        <ProtectedRoute component={() => (
          <DashboardLayout>
            <Voters />
          </DashboardLayout>
        )} />
      </Route>
      <Route path="/representatives">
        <ProtectedRoute component={() => (
          <DashboardLayout>
            <Representatives />
          </DashboardLayout>
        )} />
      </Route>
      <Route path="/analytics">
        <ProtectedRoute component={() => (
          <DashboardLayout>
            <Analytics />
          </DashboardLayout>
        )} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
