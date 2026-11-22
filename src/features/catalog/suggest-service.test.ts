// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getCatalogProducts } from "./catalog-data";
import { getSuggestions, MAX_SUGGESTIONS } from "./suggest-service";
import type { Product } from "./types";

const products = getCatalogProducts();
const names = (query: string, source: readonly Product[] = products) =>
  getSuggestions(query, source).map((s) => s.name);

describe("getSuggestions theo I/O Matrix của story 7.1", () => {
  it("khớp không dấu: q=ban phim ra đúng Bàn phím cơ KeyPro 75% kèm giá", () => {
    expect(getSuggestions("ban phim", products)).toEqual([
      expect.objectContaining({ name: "Bàn phím cơ KeyPro 75%", price: 1_890_000, inStock: true }),
    ]);
  });

  it("còn hàng trước: q=usb thì Cáp USB-C đứng trước Micro hết hàng", () => {
    const suggestions = getSuggestions("usb", products);
    expect(suggestions.map((s) => [s.name, s.price, s.inStock])).toEqual([
      ["Cáp USB-C bện dù 2m", 150_000, true],
      ["Micro thu âm PodCast USB", 1_150_000, false],
    ]);
  });

  it("cùng điểm, khác tồn kho: q=po thì PowerGo trước Micro hết hàng", () => {
    const suggestions = getSuggestions("po", products);
    expect(suggestions.map((s) => [s.name, s.inStock])).toEqual([
      ["Pin dự phòng PowerGo 20.000mAh", true],
      ["Micro thu âm PodCast USB", false],
    ]);
  });

  it("nhiều hơn 5 sản phẩm: q=on trả đúng 5 gợi ý theo thứ tự spec", () => {
    const keywords = names("on");
    expect(keywords).toHaveLength(MAX_SUGGESTIONS);
    for (const [index, part] of [
      "StudioOne",
      "FitWatch S2",
      "SoundMax Pro",
      "PowerGo",
      "SwiftClick",
    ].entries()) {
      expect(keywords[index]).toContain(part);
    }
  });

  it("không có kết quả: q=xyz trả mảng rỗng", () => {
    expect(getSuggestions("xyz", products)).toEqual([]);
  });

  it.each(["tai(", "usb++", "[a-z", "*"])(
    "ký tự đặc biệt %s được hiểu là chữ thường, không ném lỗi",
    (query) => {
      expect(() => getSuggestions(query, products)).not.toThrow();
      expect(getSuggestions(query, products)).toEqual([]);
    },
  );

  it("ký tự đặc biệt có trong tên vẫn khớp đúng nghĩa đen", () => {
    expect(names("75%")).toEqual(["Bàn phím cơ KeyPro 75%"]);
  });

  it("bằng điểm và cùng còn hàng thì nhiều lượt đánh giá trước", () => {
    const base = products[0];
    const source: Product[] = [
      { ...base, id: "a", slug: "a", name: "Đèn A", rating: 4.5, reviewCount: 10, stock: 3 },
      { ...base, id: "b", slug: "b", name: "Đèn B", rating: 4.5, reviewCount: 99, stock: 3 },
      { ...base, id: "c", slug: "c", name: "Đèn C", rating: 5, reviewCount: 1, stock: 0 },
    ];
    expect(names("den", source)).toEqual(["Đèn B", "Đèn A", "Đèn C"]);
  });

  it("từ khóa chỉ có khoảng trắng trả mảng rỗng", () => {
    expect(getSuggestions("   ", products)).toEqual([]);
  });
});
