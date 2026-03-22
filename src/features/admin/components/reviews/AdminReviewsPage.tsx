 "use client";

import React, { useEffect, useState } from "react";
import styles from "./AdminReviewsPage.module.css";
import DataLoadingOverlay from "@/components/shared/DataLoadingOverlay";
import ConfirmActionDialog from "@/components/shared/ConfirmActionDialog";

type ReviewStatus = "PENDING" | "APPROVED" | "HIDDEN";

type AdminReviewListItemDto = {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  status: ReviewStatus;
  createdAt: string;
  productName: string;
  userName: string | null;
};

type AdminReviewListResponseDto = {
  data: AdminReviewListItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

const PAGE_SIZE = 20;

const AdminReviewsPage: React.FC = () => {
  const [reviews, setReviews] = useState<AdminReviewListItemDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [ratingFilter, setRatingFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ReviewStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [showLoadingOverlay, setShowLoadingOverlay] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    type: "HIDE" | "SHOW" | "DELETE";
    review: AdminReviewListItemDto;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      const start = performance.now();

      try {
        const params = new URLSearchParams({
          page: String(page),
          pageSize: String(PAGE_SIZE),
        });
        if (ratingFilter !== "all") {
          params.set("rating", String(ratingFilter));
        }
        if (statusFilter !== "all") {
          params.set("status", statusFilter);
        }
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const res = await fetch(`/api/admin/reviews?${params.toString()}`);
        if (!res.ok) {
          const json = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(json?.error ?? "Không thể tải danh sách đánh giá.");
        }

        const json = (await res.json()) as AdminReviewListResponseDto;
        if (!cancelled) {
          setReviews(json.data);
          setTotalPages(json.totalPages);
        }
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Không thể tải danh sách đánh giá.",
          );
        }
      } finally {
        const elapsed = performance.now() - start;
        const minDelay = 1200;
        const remaining = Math.max(minDelay - elapsed, 0);
        setTimeout(() => {
          if (!cancelled) {
            setIsLoading(false);
            setShowLoadingOverlay(false);
          }
        }, remaining);
      }
    };

    setShowLoadingOverlay(true);
    void fetchData();

    return () => {
      cancelled = true;
    };
  }, [page, ratingFilter, statusFilter, search]);

  const refresh = () => {
    setPage(1);
    setShowLoadingOverlay(true);
  };

  const handleStatusChange = async (
    review: AdminReviewListItemDto,
    nextStatus: ReviewStatus,
  ) => {
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Không thể cập nhật trạng thái đánh giá.");
      }
      refresh();
    } catch (e) {
      console.error("[AdminReviewsPage] update status failed:", e);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (review: AdminReviewListItemDto) => {
    try {
      const res = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(json?.error ?? "Không thể xóa đánh giá.");
      }
      refresh();
    } catch (e) {
      console.error("[AdminReviewsPage] delete failed:", e);
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <div className={styles["admin-reviews-page"]}>
      <div className={styles["admin-reviews-page__header"]}>
        <h1 className={styles["admin-reviews-page__title"]}>
          Quản lý đánh giá sản phẩm
        </h1>
      </div>

      <div className={styles["admin-reviews-page__filters"]}>
        <input
          type="text"
          placeholder="Tìm theo sản phẩm / người dùng / nội dung..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          value={ratingFilter}
          onChange={(e) =>
            setRatingFilter(
              e.target.value === "all" ? "all" : Number(e.target.value),
            )
          }
        >
          <option value="all">Tất cả số sao</option>
          <option value="5">5 sao</option>
          <option value="4">4 sao</option>
          <option value="3">3 sao</option>
          <option value="2">2 sao</option>
          <option value="1">1 sao</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as ReviewStatus | "all")
          }
        >
          <option value="all">Tất cả trạng thái</option>
          <option value="PENDING">Chờ duyệt</option>
          <option value="APPROVED">Hiển thị</option>
          <option value="HIDDEN">Ẩn</option>
        </select>
      </div>

      <div className={styles["admin-reviews-page__table-wrapper"]}>
        {showLoadingOverlay && (
          <DataLoadingOverlay
            isActive={showLoadingOverlay}
            title="Đang tải danh sách đánh giá"
            subtitle="Đức Uy Audio đang tổng hợp phản hồi của khách hàng..."
            bottomText="Vui lòng chờ trong giây lát."
          />
        )}

        {error && !isLoading && (
          <p style={{ color: "var(--danger)" }}>{error}</p>
        )}

        {!isLoading && !error && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th>Ngày</th>
                <th>Sản phẩm</th>
                <th>Người dùng</th>
                <th>Đánh giá</th>
                <th>Trạng thái</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr key={review.id}>
                  <td>{new Date(review.createdAt).toLocaleString("vi-VN")}</td>
                  <td>{review.productName}</td>
                  <td>{review.userName ?? "Ẩn danh"}</td>
                  <td>
                    {review.rating}★{" "}
                    {review.title ? `- ${review.title}` : ""}
                  </td>
                  <td>{review.status}</td>
                  <td>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({
                          type:
                            review.status === "HIDDEN" ? "SHOW" : "HIDE",
                          review,
                        })
                      }
                    >
                      {review.status === "HIDDEN" ? "Hiển thị" : "Ẩn"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPendingAction({ type: "DELETE", review })
                      }
                    >
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {reviews.length === 0 && (
                <tr>
                  <td colSpan={6}>Chưa có đánh giá nào.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {pendingAction && (
        <ConfirmActionDialog
          isOpen={true}
          title={
            pendingAction.type === "DELETE"
              ? "Xóa đánh giá?"
              : pendingAction.type === "HIDE"
                ? "Ẩn đánh giá?"
                : "Hiển thị đánh giá?"
          }
          description={
            pendingAction.type === "DELETE"
              ? "Hành động này sẽ xóa vĩnh viễn đánh giá khỏi hệ thống."
              : "Bạn có chắc chắn muốn thay đổi trạng thái hiển thị của đánh giá này?"
          }
          confirmLabel={
            pendingAction.type === "DELETE"
              ? "Xóa"
              : pendingAction.type === "HIDE"
                ? "Ẩn"
                : "Hiển thị"
          }
          onCancel={() => setPendingAction(null)}
          onConfirm={() => {
            if (!pendingAction) return;
            if (pendingAction.type === "DELETE") {
              void handleDelete(pendingAction.review);
            } else {
              const nextStatus: ReviewStatus =
                pendingAction.type === "HIDE" ? "HIDDEN" : "APPROVED";
              void handleStatusChange(pendingAction.review, nextStatus);
            }
          }}
        />
      )}
    </div>
  );
};

export default AdminReviewsPage;

