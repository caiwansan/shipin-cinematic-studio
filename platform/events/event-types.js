"use strict";
// ============================================================
// Platform Event Types — unified event definitions for all Runtimes
// ARCH-001-D: Platform Event Review — unified event model
// ARCH-002: All events carry PlatformContext
// ============================================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformEventCategory = void 0;
/**
 * Standard platform event type categories.
 * All Runtimes must use these canonical event names.
 */
var PlatformEventCategory;
(function (PlatformEventCategory) {
    PlatformEventCategory["Created"] = "Created";
    PlatformEventCategory["Loaded"] = "Loaded";
    PlatformEventCategory["Validated"] = "Validated";
    PlatformEventCategory["Updated"] = "Updated";
    PlatformEventCategory["Deleted"] = "Deleted";
    PlatformEventCategory["Started"] = "Started";
    PlatformEventCategory["Completed"] = "Completed";
    PlatformEventCategory["Failed"] = "Failed";
    PlatformEventCategory["Disposed"] = "Disposed";
    PlatformEventCategory["Cancelled"] = "Cancelled";
    PlatformEventCategory["Published"] = "Published";
    PlatformEventCategory["Archived"] = "Archived";
})(PlatformEventCategory || (exports.PlatformEventCategory = PlatformEventCategory = {}));
