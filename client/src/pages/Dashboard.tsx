import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, ThumbsUp, ThumbsDown, Minus, TrendingUp, UserCheck, Car, Bell } from "lucide-react";
import { DashboardStats } from "@shared/schema";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  const stanceData = stats ? [
    { name: "مؤيد", value: stats.supporters, color: "hsl(var(--chart-2))" },
    { name: "معارض", value: stats.opponents, color: "hsl(var(--chart-1))" },
    { name: "محايد", value: stats.neutral, color: "hsl(var(--chart-3))" },
  ] : [];

  const statCards = [
    {
      title: "إجمالي الناخبين",
      value: stats?.totalVoters || 0,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/10",
      testId: "stat-total",
    },
    {
      title: "المؤيدون",
      value: stats?.supporters || 0,
      icon: ThumbsUp,
      color: "text-chart-2",
      bgColor: "bg-chart-2/10",
      testId: "stat-supporters",
    },
    {
      title: "المعارضون",
      value: stats?.opponents || 0,
      icon: ThumbsDown,
      color: "text-chart-1",
      bgColor: "bg-chart-1/10",
      testId: "stat-opponents",
    },
    {
      title: "المحايدون",
      value: stats?.neutral || 0,
      icon: Minus,
      color: "text-chart-3",
      bgColor: "bg-chart-3/10",
      testId: "stat-neutral",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              </CardHeader>
              <CardContent>
                <div className="h-10 w-16 animate-pulse rounded bg-muted" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">لوحة التحكم</h2>
        <p className="text-muted-foreground">نظرة عامة على بيانات الناخبين</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="hover-elevate" data-testid={stat.testId}>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className={`rounded-lg p-2 ${stat.bgColor}`}>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-foreground">
                  {stat.value.toLocaleString("ar-EG")}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Stance Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">توزيع المواقف السياسية</CardTitle>
          </CardHeader>
          <CardContent>
            {stats && stats.totalVoters > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stanceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.name}: ${entry.value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {stanceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[300px] items-center justify-center">
                <p className="text-muted-foreground">لا توجد بيانات للعرض</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-semibold">الإحصائيات السريعة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">اليوم</p>
                  <p className="text-2xl font-bold">{stats?.todayCount || 0}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">ناخب جديد</p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-chart-2/10 p-2">
                  <Users className="h-5 w-5 text-chart-2" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">المناديب النشطون</p>
                  <p className="text-2xl font-bold">{stats?.representativesCount || 0}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">مندوب</p>
            </div>

            {stats && stats.totalVoters > 0 && (
              <div className="rounded-lg border p-4">
                <p className="mb-2 text-sm font-medium text-muted-foreground">نسبة التأييد</p>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-chart-2"
                    style={{
                      width: `${((stats.supporters / stats.totalVoters) * 100).toFixed(1)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-right text-sm font-bold text-chart-2">
                  {((stats.supporters / stats.totalVoters) * 100).toFixed(1)}%
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Elderly and Gender Statistics */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              كبار السن (60+ عام)
            </CardTitle>
            <div className="rounded-lg bg-orange-500/10 p-2">
              <UserCheck className="h-4 w-4 text-orange-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {(stats?.elderlyCount ?? 0).toLocaleString("ar-EG")}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats && stats.totalVoters > 0 
                ? `${((stats.elderlyCount / stats.totalVoters) * 100).toFixed(1)}% من الإجمالي`
                : ''}
            </p>
            <div className="mt-3 flex justify-between text-sm">
              <span className="text-blue-600">ذكور: {stats?.elderlyMales ?? 0}</span>
              <span className="text-pink-600">إناث: {stats?.elderlyFemales ?? 0}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              السيارات المطلوبة
            </CardTitle>
            <div className="rounded-lg bg-blue-500/10 p-2">
              <Car className="h-4 w-4 text-blue-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-foreground">
              {stats ? Math.ceil(stats.elderlyCount / 4) : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              بمعدل 4 أشخاص لكل سيارة
            </p>
            <div className="mt-3 text-sm text-muted-foreground">
              <Bell className="inline h-3 w-3 ml-1" />
              يحتاجون للمساعدة والتنبيه
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              توزيع الجنس
            </CardTitle>
            <div className="rounded-lg bg-purple-500/10 p-2">
              <Users className="h-4 w-4 text-purple-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-blue-600 font-medium">ذكور</span>
                  <span className="font-bold">{stats?.totalMales || 0}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-blue-500"
                    style={{
                      width: stats && stats.totalVoters > 0 
                        ? `${((stats.totalMales / stats.totalVoters) * 100).toFixed(1)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-pink-600 font-medium">إناث</span>
                  <span className="font-bold">{stats?.totalFemales || 0}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-pink-500"
                    style={{
                      width: stats && stats.totalVoters > 0 
                        ? `${((stats.totalFemales / stats.totalVoters) * 100).toFixed(1)}%`
                        : '0%',
                    }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
