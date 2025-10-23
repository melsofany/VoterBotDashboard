import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Voter, DashboardStats } from "@shared/schema";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { TrendingUp, Users, MapPin } from "lucide-react";

export default function Analytics() {
  const { data: voters = [], isLoading: loadingVoters } = useQuery<Voter[]>({
    queryKey: ["/api/voters"],
  });

  const { data: stats, isLoading: loadingStats } = useQuery<DashboardStats>({
    queryKey: ["/api/stats"],
  });

  // Group voters by family
  const familyData = voters.reduce((acc, voter) => {
    const family = voter.familyName;
    if (!acc[family]) {
      acc[family] = { supporters: 0, opponents: 0, neutral: 0, total: 0 };
    }
    acc[family].total++;
    if (voter.stance === "supporter") acc[family].supporters++;
    if (voter.stance === "opponent") acc[family].opponents++;
    if (voter.stance === "neutral") acc[family].neutral++;
    return acc;
  }, {} as Record<string, { supporters: number; opponents: number; neutral: number; total: number }>);

  const topFamilies = Object.entries(familyData)
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([name, data]) => ({
      name,
      ...data,
    }));

  // Group voters by date
  const dateData = voters.reduce((acc, voter) => {
    const date = new Date(voter.createdAt).toLocaleDateString("ar-EG");
    if (!acc[date]) {
      acc[date] = 0;
    }
    acc[date]++;
    return acc;
  }, {} as Record<string, number>);

  const dailyData = Object.entries(dateData)
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .slice(-14)
    .map(([date, count]) => ({
      date,
      count,
    }));

  if (loadingVoters || loadingStats) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-96 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">التحليلات المتقدمة</h2>
        <p className="text-muted-foreground">تحليل شامل لبيانات الناخبين</p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">متوسط الناخبين لكل عائلة</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {Object.keys(familyData).length > 0
                ? (voters.length / Object.keys(familyData).length).toFixed(1)
                : 0}
            </div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">عدد العائلات</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{Object.keys(familyData).length}</div>
          </CardContent>
        </Card>

        <Card className="hover-elevate">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">الناخبون مع المواقع</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {voters.filter((v) => v.latitude && v.longitude).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Daily Collection Trend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">اتجاه جمع البيانات اليومي</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="count"
                  name="عدد الناخبين"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[300px] items-center justify-center">
              <p className="text-muted-foreground">لا توجد بيانات للعرض</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top Families */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">أكبر 10 عائلات</CardTitle>
        </CardHeader>
        <CardContent>
          {topFamilies.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topFamilies}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="supporters" name="مؤيد" fill="hsl(var(--chart-2))" />
                <Bar dataKey="opponents" name="معارض" fill="hsl(var(--chart-1))" />
                <Bar dataKey="neutral" name="محايد" fill="hsl(var(--chart-3))" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-[400px] items-center justify-center">
              <p className="text-muted-foreground">لا توجد بيانات للعرض</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
