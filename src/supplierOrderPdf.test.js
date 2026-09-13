import test from "node:test";
import assert from "node:assert/strict";
import { VIMALUX_ORDER_BLUE } from "./supplierOrderPdf.js";

test("partner order PDFs use the standard VIMALUX blue", () => {
  assert.deepEqual(VIMALUX_ORDER_BLUE, [15, 111, 174]);
});
