// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import type { Order } from "@/features/orders/types";
import { GET } from "./route";

vi.mock("@/features/inventory/server", async () => {
  const { createInventoryService } = await import("@/features/inventory/inventory-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  const { getCatalogProducts } = await import("@/features/catalog/catalog-data");
  const repository = createInMemoryOrderRepository();
  // Cáp USB-C còn hàng ở Tồn gốc nhưng đã bị đơn confirmed lấy hết: gợi ý phải theo Tồn hiện tại.
  const cable = getCatalogProducts().find((p) => p.name.startsWith("Cáp USB-C"))!;
  await repository.save({
    id: "SL-1",
    status: "confirmed",
    items: [{ productId: cable.id, quantity: cable.stock }],
  } as unknown as Order);
  return {
    inventoryService: createInventoryService({ repository, getBaseProducts: getCatalogProducts }),
  };
});

const suggest = (q: string) =>
  GET(new NextRequest(`http://x/api/products/suggest?q=${encodeURIComponent(q)}`));

describe("GET /api/products/suggest", () => {
  it("200 và gợi ý theo thứ tự spec cho q=po", async () => {
    const res = await suggest("po");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions.map((s: { name: string }) => s.name)).toEqual([
      "Pin dự phòng PowerGo 20.000mAh",
      "Micro thu âm PodCast USB",
    ]);
    expect(Object.keys(body.suggestions[0]).sort()).toEqual(["inStock", "name", "price", "slug"]);
  });

  it("dùng Tồn hiện tại: Cáp USB-C hết hàng sau đơn confirmed", async () => {
    const body = await (await suggest("cap usb")).json();
    expect(body.suggestions).toEqual([
      expect.objectContaining({ name: "Cáp USB-C bện dù 2m", inStock: false }),
    ]);
  });

  it.each(["tai(", "(.*.*)*!"])("200 và danh sách rỗng với ký tự đặc biệt %s", async (q) => {
    const res = await suggest(q);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it("400 VALIDATION_ERROR khi từ khóa quá ngắn (1 ký tự)", async () => {
    const res = await suggest("a");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("chấp nhận đúng 2 ký tự và đúng 50 ký tự", async () => {
    expect((await suggest("po")).status).toBe(200);
    expect((await suggest("a".repeat(50))).status).toBe(200);
  });

  it("400 VALIDATION_ERROR khi từ khóa quá dài (51 ký tự)", async () => {
    const res = await suggest("a".repeat(51));
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("400 khi thiếu tham số q hoặc chỉ có khoảng trắng", async () => {
    expect((await GET(new NextRequest("http://x/api/products/suggest"))).status).toBe(400);
    expect((await suggest("   ")).status).toBe(400);
  });
});
