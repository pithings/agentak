/**
 * The service worker. It opens the side panel when the toolbar icon is clicked,
 * and it counts the tools the page in front publishes onto the icon — a mark the
 * panel could not draw, because the point of it is the tab the panel has not
 * been opened on. Everything else the panel does in its own document, and a
 * worker that is asleep must not be part of any of it.
 */
import { watchPageTools } from "./badge.ts";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});

// At the top level, not in a listener: the worker is restarted for every event
// it handles, and a listener registered later would miss the one that woke it.
watchPageTools();
