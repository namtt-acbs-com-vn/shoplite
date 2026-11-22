import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Suggestion } from "@/features/catalog/suggest-service";
import { SearchSuggestions } from "./search-suggestions";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const USB: Suggestion[] = [
  { slug: "cap-usb-c", name: "Cáp USB-C bện dù 2m", price: 150_000, inStock: true },
  { slug: "micro-podcast", name: "Micro thu âm PodCast USB", price: 1_150_000, inStock: false },
];

const fetchMock = vi.fn();

function respond(status: number, body: unknown) {
  fetchMock.mockResolvedValue({ ok: status < 400, status, json: async () => body });
}

function renderBox() {
  render(<SearchSuggestions defaultValue="" inputClassName="" />);
  return screen.getByRole("combobox", { name: "Từ khóa tìm kiếm" });
}

describe("<SearchSuggestions />", () => {
  beforeEach(() => {
    push.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gõ usb thấy Cáp trước Micro, Micro có nhãn Hết hàng", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    await user.type(renderBox(), "usb");

    const options = await screen.findAllByRole("option");
    expect(fetchMock).toHaveBeenCalledWith("/api/products/suggest?q=usb", expect.anything());
    expect(options[0]).toHaveTextContent("Cáp USB-C bện dù 2m");
    expect(options[0]).not.toHaveTextContent("Hết hàng");
    expect(options[1]).toHaveTextContent("Micro thu âm PodCast USB");
    expect(within(options[1]).getByText("Hết hàng")).toBeVisible();
  });

  it("dưới 2 ký tự không gọi API và không hiện danh sách", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    await user.type(renderBox(), "u");

    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("↓ rồi Enter mở trang sản phẩm được chọn", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    const input = renderBox();
    await user.type(input, "usb");
    await screen.findAllByRole("option");

    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(push).toHaveBeenCalledWith("/products/micro-podcast");
  });

  it("bấm chuột vào gợi ý mở trang sản phẩm đó", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    await user.type(renderBox(), "usb");

    await user.click(await screen.findByRole("option", { name: /Cáp USB-C/ }));
    expect(push).toHaveBeenCalledWith("/products/cap-usb-c");
  });

  it("Enter khi chưa chọn gợi ý không mở sản phẩm và đóng danh sách", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    await user.type(renderBox(), "usb");
    await screen.findByRole("listbox");

    await user.keyboard("{Enter}");
    expect(push).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("chờ 300 ms sau lần gõ cuối mới gọi API, chỉ một lần cho từ khóa cuối", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    await user.type(renderBox(), "usb");

    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock).toHaveBeenCalledWith("/api/products/suggest?q=usb", expect.anything());
  });

  it("Esc đóng danh sách", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    await user.type(renderBox(), "usb");
    await screen.findByRole("listbox");

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("không có kết quả thì ghi Không tìm thấy sản phẩm phù hợp", async () => {
    respond(200, { suggestions: [] });
    const user = userEvent.setup();
    await user.type(renderBox(), "xyz");

    expect(await screen.findByText("Không tìm thấy sản phẩm phù hợp")).toBeVisible();
  });

  it("xóa bớt xuống dưới 2 ký tự rồi gõ lại thì không hiện gợi ý cũ", async () => {
    respond(200, { suggestions: USB });
    const user = userEvent.setup();
    const input = renderBox();
    await user.type(input, "usb");
    await screen.findByRole("listbox");

    fetchMock.mockReturnValue(new Promise(() => {}));
    await user.clear(input);
    await user.type(input, "ta");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("API trả lỗi thì không hiện danh sách", async () => {
    respond(400, { error: { code: "VALIDATION_ERROR", message: "x" } });
    const user = userEvent.setup();
    await user.type(renderBox(), "usb");

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});
