import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin, Phone, Users as UsersIcon, Calendar } from "lucide-react";
import { Voter } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Voters() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);

  const { data: voters = [], isLoading } = useQuery<Voter[]>({
    queryKey: ["/api/voters"],
  });

  const filteredVoters = voters.filter((voter) => {
    const search = searchTerm.toLowerCase();
    return (
      voter.fullName.toLowerCase().includes(search) ||
      voter.nationalId.includes(search) ||
      voter.familyName.toLowerCase().includes(search) ||
      voter.phoneNumber.includes(search)
    );
  });

  const getStanceBadge = (stance: string) => {
    const variants = {
      supporter: { label: "مؤيد", className: "bg-chart-2 text-white" },
      opponent: { label: "معارض", className: "bg-chart-1 text-white" },
      neutral: { label: "محايد", className: "bg-chart-3 text-white" },
    };
    const config = variants[stance as keyof typeof variants] || variants.neutral;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-full animate-pulse rounded bg-muted" />
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground">قائمة الناخبين</h2>
        <p className="text-muted-foreground">
          إجمالي {voters.length.toLocaleString("ar-EG")} ناخب
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          placeholder="البحث بالاسم، الرقم القومي، العائلة، أو رقم الهاتف..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pr-10"
          data-testid="input-search-voters"
        />
      </div>

      {/* Voters List */}
      <div className="space-y-4">
        {filteredVoters.length === 0 ? (
          <Card>
            <CardContent className="flex h-40 items-center justify-center">
              <p className="text-muted-foreground">لا توجد نتائج</p>
            </CardContent>
          </Card>
        ) : (
          filteredVoters.map((voter) => (
            <Card
              key={voter.id}
              className="hover-elevate cursor-pointer transition-all"
              onClick={() => setSelectedVoter(voter)}
              data-testid={`voter-card-${voter.id}`}
            >
              <CardContent className="p-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  {/* Voter Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-foreground">
                        {voter.fullName}
                      </h3>
                      {getStanceBadge(voter.stance)}
                    </div>
                    
                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <div className="flex items-center gap-2">
                        <UsersIcon className="h-4 w-4" />
                        <span>عائلة {voter.familyName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span dir="ltr">{voter.phoneNumber}</span>
                      </div>
                      {voter.latitude && voter.longitude && (
                        <a
                          href={`https://www.google.com/maps?q=${voter.latitude},${voter.longitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`link-location-${voter.id}`}
                        >
                          <MapPin className="h-4 w-4" />
                          <span>عرض الموقع</span>
                        </a>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {new Date(voter.createdAt).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Representative Info */}
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">المندوب</p>
                      <p className="font-medium text-foreground">
                        {voter.representativeName || voter.representativeId}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Voter Detail Dialog */}
      <Dialog open={!!selectedVoter} onOpenChange={() => setSelectedVoter(null)}>
        <DialogContent className="max-w-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-2xl">تفاصيل الناخب</DialogTitle>
          </DialogHeader>
          {selectedVoter && (
            <div className="space-y-6">
              {/* ID Card Image */}
              {selectedVoter.idCardImageUrl && (
                <div className="overflow-hidden rounded-lg border">
                  <img
                    src={`/api/voters/${selectedVoter.id}/card-image`}
                    alt="بطاقة الناخب"
                    className="h-auto w-full object-contain"
                    data-testid="img-voter-id-card"
                  />
                </div>
              )}

              {/* Voter Information Grid */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">الاسم الكامل</p>
                  <p className="text-lg font-semibold">{selectedVoter.fullName}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">الرقم القومي</p>
                  <p className="text-lg font-semibold" dir="ltr">
                    {selectedVoter.nationalId}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">اسم العائلة</p>
                  <p className="text-lg font-semibold">{selectedVoter.familyName}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">رقم الهاتف</p>
                  <p className="text-lg font-semibold" dir="ltr">
                    {selectedVoter.phoneNumber}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">الموقف السياسي</p>
                  <div>{getStanceBadge(selectedVoter.stance)}</div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">تاريخ التسجيل</p>
                  <p className="text-lg font-semibold">
                    {new Date(selectedVoter.createdAt).toLocaleString("ar-EG")}
                  </p>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">المندوب</p>
                  <p className="text-lg font-semibold">
                    {selectedVoter.representativeName || selectedVoter.representativeId}
                  </p>
                </div>

                {selectedVoter.latitude && selectedVoter.longitude && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">الموقع</p>
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      data-testid="button-view-location"
                    >
                      <a
                        href={`https://www.google.com/maps?q=${selectedVoter.latitude},${selectedVoter.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2"
                      >
                        <MapPin className="h-4 w-4" />
                        <span>عرض على الخريطة</span>
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
