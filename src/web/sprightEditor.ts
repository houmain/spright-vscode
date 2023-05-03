import { Config } from "./Config";
import { Description } from "./Description";

function appendElement(parent: HTMLElement, type: string, className: string) {
  const div = document.createElement(type);
  div.className = className;
  parent.appendChild(div);
  return div;
}

function addClickHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("click", (ev: MouseEvent) => {
    func();
    ev.stopPropagation();
  });
}

function addDoubleClickHandler(element: HTMLElement, func: () => void) {
  element.addEventListener("dblclick", (ev: MouseEvent) => {
    func();
    ev.stopPropagation();
  });
}

type State = {
  config: string;
  description: Description;
};

export class SprightEditor {
  private config: Config;
  private description: Description;
  private zoom = 2;
  private applyZoom?: () => void;

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {
    this.config = new Config("");
    this.description = {} as Description;
    this.rebuildToolbar();
  }

  onZoom(direction: number) {
    const levels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
    let n = levels.indexOf(this.zoom);
    if (n == -1) n = 2;
    if (n > 0 && direction == -1) --n;
    if (n < levels.length - 1 && direction == 1) ++n;
    this.zoom = levels[n];
    if (this.applyZoom) this.applyZoom();
  }

  onMessage(message: any) {
    switch (message.type) {
      case "setConfig":
        this.setConfig(message.config, message.description);
        return;
    }
  }

  setConfig(config: string, description: any) {
    const state: State = {
      config,
      description,
    };
    this.updateState(state);
    this.restoreState(state);
  }

  private showError(message: string) {
    this.content.innerHTML = `<div class='error'>${message}</div>`;
  }

  restoreState(state: State) {
    try {
      this.config = new Config(state.config);
      this.description = state.description;
    } catch {
      return this.showError("Parsing configuration failed");
    }
    this.rebuildView();
  }

  private rebuildToolbar() {
    const itemsDiv = document.createElement("div");
    itemsDiv.className = "items";

    const refreshButton = appendElement(itemsDiv, "button", "refresh");
    refreshButton.innerText = "auto";
    addClickHandler(refreshButton, () => {
      this.postMessage({
        type: "autocomplete",
      });
    });

    const zoomLabel = appendElement(itemsDiv, "label", "zoom-label");
    zoomLabel.innerText = "Zoom:";
    const zoom = appendElement(itemsDiv, "select", "zoom") as HTMLSelectElement;
    for (let i = 1; i <= 4; ++i) {
      const option = appendElement(zoom, "option", "zoom") as HTMLOptionElement;
      option.value = i.toString();
      option.text = i * 100 + "%";
    }
    this.toolbar.innerHTML = "";
    this.toolbar.appendChild(itemsDiv);
  }

  private rebuildView() {
    const inputsDiv = document.createElement("div");
    inputsDiv.className = "inputs";
    this.applyZoom = () => {
      inputsDiv.style.setProperty("--zoom", this.zoom.toString());
    };
    this.applyZoom();

    let inputIndex = 0;
    for (const input of this.description.inputs) {
      const configInput = this.config.inputs[inputIndex++];
      const inputDiv = appendElement(inputsDiv, "div", "input");

      if (configInput)
        addDoubleClickHandler(inputDiv, () => {
          this.postMessage({
            type: "selectLine",
            lineNo: configInput.lineNo,
            columnNo: this.config.getParameterColumn(configInput),
          });
        });

      const titleDiv = appendElement(inputDiv, "div", "title");

      const refreshButton = appendElement(titleDiv, "button", "refresh");
      refreshButton.innerText = "auto";
      addClickHandler(refreshButton, () => {
        this.postMessage({
          type: "autocomplete",
          filename: input.filename,
        });
      });

      const textDiv = appendElement(titleDiv, "div", "text");
      textDiv.innerText = input.filename;

      let spriteIndex = 0;
      const sourcesDiv = appendElement(inputDiv, "div", "sources");
      for (const index of input.sourceIndices) {
        const source = this.description.sources[index];
        const sourceDiv = appendElement(sourcesDiv, "div", "source");

        if (source.filename !== input.filename) {
          const textDiv = appendElement(sourceDiv, "div", "text");
          textDiv.innerText = source.filename;
        }
        const spritesFrameDiv = appendElement(sourceDiv, "div", "frame");
        const spritesDiv = appendElement(spritesFrameDiv, "div", "sprites");
        spritesDiv.style.setProperty("--filename", `url('${source.uri}'`);
        spritesDiv.style.setProperty("--width", source.width + "px");
        spritesDiv.style.setProperty("--height", source.height + "px");

        for (const index of source.spriteIndices) {
          const sprite = this.description.sprites[index];
          const configSprite = configInput?.sprites[spriteIndex++];
          const spriteDiv = appendElement(spritesDiv, "div", "sprite");
          const rect = sprite.trimmedSourceRect
            ? sprite.trimmedSourceRect
            : sprite.sourceRect;
          spriteDiv.style.setProperty("--rect_x", rect.x + "px");
          spriteDiv.style.setProperty("--rect_y", rect.y + "px");
          spriteDiv.style.setProperty("--rect_w", rect.w + "px");
          spriteDiv.style.setProperty("--rect_h", rect.h + "px");

          if (sprite.pivot) {
            const pivotDiv = appendElement(spritesDiv, "div", "pivot");
            pivotDiv.style.setProperty("--x", rect.x + sprite.pivot.x + "px");
            pivotDiv.style.setProperty("--y", rect.y + sprite.pivot.y + "px");
          }
          const textDiv = appendElement(spriteDiv, "div", "text");
          textDiv.innerText = sprite.id;

          if (configSprite)
            addDoubleClickHandler(spriteDiv, () => {
              this.postMessage({
                type: "selectLine",
                lineNo: configSprite.lineNo,
                columnNo: this.config.getParameterColumn(configSprite),
              });
            });
        }
      }
    }

    this.content.innerHTML = "";
    this.content.appendChild(inputsDiv);
  }
}
