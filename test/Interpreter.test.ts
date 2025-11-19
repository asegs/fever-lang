import {describe} from "node:test";
import {testAllStatements} from "./RecordBehavior.ts";
import {expect, it} from "vitest";

describe('no regressions', () => {
    it('should not have any regressions from previous behavior', () => {
        const regressions = testAllStatements();
        expect(regressions).length(0)
    });
})