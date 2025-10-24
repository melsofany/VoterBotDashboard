import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, ThumbsUp, ThumbsDown, Minus, Calendar, Plus, Edit, Trash2 } from "lucide-react";
import { RepresentativePerformance } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

export default function Representatives() {
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingRep, setEditingRep] = useState<RepresentativePerformance | null>(null);
  const [deletingRep, setDeletingRep] = useState<RepresentativePerformance | null>(null);
  const [formData, setFormData] = useState({ userId: "", name: "" });

  const { data: representatives = [], isLoading } = useQuery<RepresentativePerformance[]>({
    queryKey: ["/api/representatives"],
  });

  const addMutation = useMutation({
    mutationFn: async (data: { userId: string; name?: string }) => {
      return await apiRequest("POST", "/api/representatives", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/representatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "تم الإضافة بنجاح",
        description: "تم إضافة المندوب الجديد",
      });
      setIsAddOpen(false);
      setFormData({ userId: "", name: "" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الإضافة",
        description: error.message || "حدث خطأ أثناء إضافة المندوب",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { userId: string; name: string }) => {
      return await apiRequest("PUT", `/api/representatives/${data.userId}`, { name: data.name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/representatives"] });
      toast({
        title: "تم التحديث بنجاح",
        description: "تم تحديث بيانات المندوب",
      });
      setEditingRep(null);
      setFormData({ userId: "", name: "" });
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في التحديث",
        description: error.message || "حدث خطأ أثناء تحديث المندوب",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return await apiRequest("DELETE", `/api/representatives/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/representatives"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف المندوب",
      });
      setDeletingRep(null);
    },
    onError: (error: any) => {
      toast({
        title: "خطأ في الحذف",
        description: error.message || "حدث خطأ أثناء حذف المندوب",
        variant: "destructive",
      });
    },
  });

  const handleAdd = () => {
    addMutation.mutate({
      userId: formData.userId,
      name: formData.name || undefined,
    });
  };

  const handleEdit = () => {
    if (!editingRep) return;
    updateMutation.mutate({
      userId: editingRep.userId,
      name: formData.name,
    });
  };

  const handleDelete = () => {
    if (!deletingRep) return;
    deleteMutation.mutate(deletingRep.userId);
  };

  const openEditDialog = (rep: RepresentativePerformance) => {
    setEditingRep(rep);
    setFormData({ userId: rep.userId, name: rep.name || "" });
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">المناديب</h2>
          <p className="text-muted-foreground">
            إجمالي {representatives.length.toLocaleString("ar-EG")} مندوب
          </p>
        </div>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-rep">
              <Plus className="ml-2 h-4 w-4" />
              إضافة مندوب
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>إضافة مندوب جديد</DialogTitle>
              <DialogDescription>
                أدخل معرف المندوب (Telegram User ID) والاسم (اختياري)
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="userId" data-testid="label-userId">معرف المندوب *</Label>
                <Input
                  id="userId"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  placeholder="مثال: 123456789"
                  data-testid="input-userId"
                />
                <p className="text-xs text-muted-foreground">
                  يمكن معرفة User ID من خلال @userinfobot في تيليجرام
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name" data-testid="label-name">الاسم (اختياري)</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="مثال: أحمد محمد"
                  data-testid="input-name"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={handleAdd}
                disabled={!formData.userId || addMutation.isPending}
                data-testid="button-confirm-add"
              >
                {addMutation.isPending ? "جاري الإضافة..." : "إضافة"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingRep} onOpenChange={(open) => !open && setEditingRep(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل بيانات المندوب</DialogTitle>
            <DialogDescription>
              تحديث اسم المندوب (معرف المندوب لا يمكن تغييره)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>معرف المندوب</Label>
              <Input value={formData.userId} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-name" data-testid="label-edit-name">الاسم</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="مثال: أحمد محمد"
                data-testid="input-edit-name"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleEdit}
              disabled={!formData.name || updateMutation.isPending}
              data-testid="button-confirm-edit"
            >
              {updateMutation.isPending ? "جاري التحديث..." : "تحديث"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingRep} onOpenChange={(open) => !open && setDeletingRep(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف المندوب "{deletingRep?.name || deletingRep?.userId}" نهائياً.
              هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(rep)}
                      data-testid={`button-edit-${rep.userId}`}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingRep(rep)}
                      data-testid={`button-delete-${rep.userId}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardTitle>
                <Badge variant="outline" className="text-xs w-fit">
                  ID: {rep.userId}
                </Badge>
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
