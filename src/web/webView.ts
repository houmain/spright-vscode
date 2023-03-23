import { SprightEditor } from "./sprightEditor";

declare const acquireVsCodeApi: any;

(function () {
  const vscode = acquireVsCodeApi();
  const content = document.querySelector("#content") as HTMLElement;
  const sprightEditor = new SprightEditor(
    content,
    (state: any) => vscode.setState(state),
    (message: any) => vscode.postMessage(message)
  );

  window.addEventListener("message", (event) => {
    sprightEditor.onMessage(event.data);
  });

  window.addEventListener("wheel", (event) => {
    if (event.ctrlKey)
      sprightEditor.onZoom(-Math.sign(event.deltaY));
  });

  // Webviews are normally torn down when not visible and re-created when they become visible again.
  // State lets us save information across these re-loads
  const state = vscode.getState();
  if (state) sprightEditor.restoreState(state);
})();
