import { Config } from "./Config";
import { Description, Rect } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

function appendElement(parent: HTMLElement, type: string, className: string) {
  const div = document.createElement(type);
  div.className = className;
  parent.appendChild(div);
  return div;
}

function appendRect(parent: HTMLElement, rect: Rect, className: string) {
  const rectDiv = appendElement(parent, "div", className);
  rectDiv.style.setProperty("--rect_x", rect.x + "px");
  rectDiv.style.setProperty("--rect_y", rect.y + "px");
  rectDiv.style.setProperty("--rect_w", rect.w + "px");
  rectDiv.style.setProperty("--rect_h", rect.h + "px");
  return rectDiv;
}

function appendCheckbox(parent: HTMLElement, className: string, text: string) {
  const input = appendElement(parent, "input", className) as HTMLInputElement;
  input.id = "checkbox-" + className;
  input.type = "checkbox";
  const label = appendElement(parent, "label", className) as HTMLLabelElement;
  label.htmlFor = input.id;
  label.textContent = text;
  return input;
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

export class Editor {
  private config: Config;
  private description: Description;
  private zoomLevel = 2;
  private applyZoom?: () => void;
  private zoom!: HTMLSelectElement;
  private showId!: HTMLInputElement;
  private showPivot!: HTMLInputElement;
  private showTrimmedRect!: HTMLInputElement;

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {
    this.config = new Config("");
    this.description = {} as Description;
    this.rebuildToolbar();

    const html = this.content.parentElement!.parentElement!;
    addDoubleClickHandler(html, () => {
      this.postMessage({ type: "openDocument" });
    });
  }

  updateZoomSelection() {
    this.zoom.selectedIndex = zoomLevels.indexOf(this.zoomLevel);
  }

  applyZoomSelection() {
    this.zoomLevel = zoomLevels[this.zoom.selectedIndex];
    if (this.applyZoom) this.applyZoom();
  }

  onZoom(direction: number) {
    let n = zoomLevels.indexOf(this.zoomLevel);
    if (n == -1) n = 2;
    if (n > 0 && direction == -1) --n;
    if (n < zoomLevels.length - 1 && direction == 1) ++n;
    this.zoomLevel = zoomLevels[n];
    if (this.applyZoom) this.applyZoom();
    this.updateZoomSelection();
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

  private refreshDescription() {
    this.postMessage({
      type: "refreshDescription",
      describeOnlyInput: !(
        this.showPivot.checked || this.showTrimmedRect.checked
      ),
    });
  }

  private rebuildToolbar() {
    const itemsDiv = document.createElement("div");
    itemsDiv.className = "items";

    const buildButton = appendElement(itemsDiv, "button", "build");
    buildButton.innerText = "build";
    addClickHandler(buildButton, () => {
      this.postMessage({
        type: "build",
      });
    });

    const completeButton = appendElement(itemsDiv, "button", "auto");
    completeButton.innerText = "auto";
    addClickHandler(completeButton, () => {
      this.postMessage({
        type: "autocomplete",
      });
    });

    const zoomLabel = appendElement(itemsDiv, "label", "zoom-label");
    zoomLabel.innerText = "  Zoom:";
    const zoom = appendElement(itemsDiv, "select", "zoom") as HTMLSelectElement;
    for (const level of zoomLevels) {
      const option = appendElement(zoom, "option", "zoom") as HTMLOptionElement;
      option.value = level.toString();
      option.text = Math.round(level * 100) + "%";
    }
    zoom.addEventListener("change", () => {
      this.applyZoomSelection();
    });
    this.zoom = zoom;
    this.updateZoomSelection();

    const showLabel = appendElement(itemsDiv, "label", "show-label");
    showLabel.innerText = "  Show:";

    this.showId = appendCheckbox(itemsDiv, "show-id", "id");
    this.showId.checked = true;
    this.showTrimmedRect = appendCheckbox(
      itemsDiv,
      "show-trimmed-rect",
      "trimmed-rect"
    );
    this.showPivot = appendCheckbox(itemsDiv, "show-pivot", "pivot");
    addClickHandler(this.showId, () => this.rebuildView());
    addClickHandler(this.showTrimmedRect, () => this.refreshDescription());
    addClickHandler(this.showPivot, () => this.refreshDescription());

    this.toolbar.innerHTML = "";
    this.toolbar.appendChild(itemsDiv);
  }

  private rebuildView() {
    const inputsDiv = document.createElement("div");
    inputsDiv.className = "inputs";
    this.applyZoom = () => {
      inputsDiv.style.setProperty("--zoom", this.zoomLevel.toString());
    };
    this.applyZoom();

    let inputIndex = 0;
    for (const input of this.description.inputs) {
      const configInput = this.config.inputs[inputIndex++];

      if (configInput?.sprites.length == 0 && input.sources.length == 0)
        continue;

      const inputDiv = appendElement(inputsDiv, "div", "input");
      const titleDiv = appendElement(inputDiv, "div", "title");

      if (configInput) {
        addDoubleClickHandler(inputDiv, () => {
          this.postMessage({
            type: "selectLine",
            lineNo: configInput.lineNo,
            columnNo: this.config.getParameterColumn(configInput),
          });
        });

        const autoButton = appendElement(titleDiv, "button", "auto");
        autoButton.innerText = "auto";
        addClickHandler(autoButton, () => {
          this.postMessage({
            type: "autocomplete",
            pattern: input.filename,
          });
        });
      }

      const textDiv = appendElement(titleDiv, "div", "text");
      textDiv.innerText = input.filename;

      if (input.sources.length > 0) {
        let spriteIndex = 0;
        const sourcesDiv = appendElement(inputDiv, "div", "sources");
        for (const inputSource of input.sources) {
          const source = this.description.sources[inputSource.index];
          const sourceDiv = appendElement(sourcesDiv, "div", "source");

          const spritesFrameDiv = appendElement(sourceDiv, "div", "frame");
          const spritesDiv = appendElement(spritesFrameDiv, "div", "sprites");
          spritesDiv.style.setProperty("--filename", `url('${source.uri}'`);
          spritesDiv.style.setProperty("--width", source.width + "px");
          spritesDiv.style.setProperty("--height", source.height + "px");

          for (const index of inputSource.spriteIndices) {
            const sprite = this.description.sprites[index];
            const configSprite = configInput?.sprites[spriteIndex++];

            if (this.showTrimmedRect.checked && sprite.trimmedSourceRect) {
              appendRect(spritesDiv, sprite.trimmedSourceRect, "trimmed-rect");
            }

            const spriteDiv = appendRect(
              spritesDiv,
              sprite.sourceRect,
              "sprite"
            );

            if (
              this.showPivot.checked &&
              sprite.pivot &&
              sprite.trimmedSourceRect &&
              sprite.rect &&
              sprite.trimmedRect
            ) {
              const rx =
                sprite.trimmedSourceRect.x +
                (sprite.rect.x - sprite.trimmedRect.x);
              const ry =
                sprite.trimmedSourceRect.y +
                (sprite.rect.y - sprite.trimmedRect.y);
              const pivotDiv = appendElement(spritesDiv, "div", "pivot");
              pivotDiv.style.setProperty("--x", rx + sprite.pivot.x + "px");
              pivotDiv.style.setProperty("--y", ry + sprite.pivot.y + "px");
            }
            if (this.showId.checked) {
              const textDiv = appendElement(spriteDiv, "div", "text");
              textDiv.innerText = sprite.id;
            }

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
    }

    this.content.innerHTML = "";
    this.content.appendChild(inputsDiv);
  }
}
