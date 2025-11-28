import { Editor } from "./Editor";

declare const acquireVsCodeApi: any;

(function () {
  const vscode = acquireVsCodeApi();
  const toolbar = document.querySelector("#toolbar") as HTMLElement;
  const content = document.querySelector("#content") as HTMLElement;
  const properties = document.querySelector("#properties") as HTMLElement;
  const sprightEditor = new Editor(
    toolbar,
    content,
    properties,
    (state: any) => vscode.setState(state),
    (message: any) => vscode.postMessage(message)
  );

  const hideProperties = () => { sprightEditor.hideProperties(); };
  window.addEventListener("resize", hideProperties);
  window.addEventListener("click", hideProperties);

  window.addEventListener("message", (event) => {
    sprightEditor.onMessage(event.data);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape") {
      hideProperties();
    }
    else if (event.ctrlKey && event.code === "KeyF") {
      hideProperties();
      sprightEditor.focusFilter();
    }
  });

  window.addEventListener("wheel", (event) => {
    if (event.ctrlKey) sprightEditor.changeZoom(-Math.sign(event.deltaY));
  });

  window.addEventListener("scroll", (event) => {
    sprightEditor.onScrolled();
  });

  // Webviews are normally torn down when not visible and re-created when they become visible again.
  // State lets us save information across these re-loads
  const state = vscode.getState();
  if (state) sprightEditor.restoreState(state);
})();
