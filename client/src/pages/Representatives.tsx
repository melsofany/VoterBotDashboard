import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ThumbsUp, ThumbsDown, Minus, Calendar } from "lucide-react";
import { RepresentativePerformance } from "@shared/schema";

export default function Representatives() {
  const { data: representatives = [], isLoading } = useQuery<RepresentativePerformance[]>({
    queryKey: ["/api/representatives"],
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-48 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">المناديب</h2>
        <p className="text-muted-foreground">
          إجمالي {representatives.length.toLocaleString("ar-EG")} مندوب
        </p>
      </div>

      {/* Representatives Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {representatives.length === 0 ? (
          <Card className="md:col-span-2 lg:col-span-3">
            <CardContent className="flex h-40 items-center justify-center">
              <p className="text-muted-foreground">لا يوجد مناديب حالياً</p>
            </CardContent>
          </Card>
        ) : (
          representatives.map((rep) => (
            <Card
              key={rep.userId}
              className="hover-elevate"
              data-testid={`rep-card-${rep.userId}`}
            >
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="text-lg">{rep.name || `مندوب ${rep.userId}`}</span>
                  <Badge variant="outline" className="text-xs">
                    ID: {rep.userId}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Total Voters */}
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">إجمالي الناخبين</p>
                      <p className="text-2xl font-bold">{rep.votersCount}</p>
                    </div>
                  </div>
                </div>

                {/* Stance Breakdown */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ThumbsUp className="h-4 w-4 text-chart-2" />
                      <span className="text-muted-foreground">مؤيد</span>
                    </div>
                    <span className="font-semibold text-chart-2">
                      {rep.supportersCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <ThumbsDown className="h-4 w-4 text-chart-1" />
                      <span className="text-muted-foreground">معارض</span>
                    </div>
                    <span className="font-semibold text-chart-1">
                      {rep.opponentsCount}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Minus className="h-4 w-4 text-chart-3" />
                      <span className="text-muted-foreground">محايد</span>
                    </div>
                    <span className="font-semibold text-chart-3">
                      {rep.neutralCount}
                    </span>
                  </div>
                </div>

                {/* Last Active */}
                {rep.lastActiveAt && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>
                      آخر نشاط:{" "}
                      {new Date(rep.lastActiveAt).toLocaleDateString("ar-EG")}
                    </span>
                  </div>
                )}

                {/* Performance Indicator */}
                {rep.votersCount > 0 && (
                  <div className="rounded-lg border bg-muted/50 p-3">
                    <p className="mb-2 text-xs font-medium text-muted-foreground">
                      نسبة التأييد
                    </p>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-background">
                      <div
                        className="h-full bg-chart-2"
                        style={{
                          width: `${((rep.supportersCount / rep.votersCount) * 100).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-right text-sm font-bold text-chart-2">
                      {((rep.supportersCount / rep.votersCount) * 100).toFixed(1)}%
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
