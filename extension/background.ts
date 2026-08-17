/**
 * The service worker. It opens the side panel when the toolbar icon is clicked,
 * and that is the whole of it — the panel does its own work in its own document,
 * and a worker that is asleep must not be part of any of it.
 */
chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);
});
