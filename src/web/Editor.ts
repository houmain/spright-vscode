
import * as utils from "./utils";
import { Config, Input as ConfigInput, Sprite as ConfigSprite } from "./Config";
import { Description, Input, Sprite } from "./Description";

const zoomLevels = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 8, 10];

type Options = {
  zoomLevel: number;
  filter?: string;
  showId: boolean;
  showRect: boolean;
  showPivot: boolean;
  showTrimmedRect: boolean;
  showInputTitle: boolean;
};

type State = {
  config: string;
  description: Description;
  options: Options;
  scrollX: number;
  scrollY: number;
};

function isSequenceFilename(filename: string) {
  return filename.indexOf('{') != -1;
}

export class Editor {
  private config: Config;
  private description: Description;
  private options: Options;
  private filter!: HTMLInputElement;
  private zoom!: HTMLSelectElement;
  private cachedElements: Map<any, HTMLElement> = new Map();
  private cachedElementsNew: Map<any, HTMLElement> = new Map();
  private onFilterChangedTimeout?: number;
  private onScrollTimeout?: number;

  constructor(
    private toolbar: HTMLElement,
    private content: HTMLElement,
    private properties: HTMLElement,
    private updateState: any,
    private postMessage: any
  ) {
    this.config = new Config("");
    this.description = {} as Description;
    this.options = {
      showId: true,
      showRect: true,
      showInputTitle: true,
      zoomLevel: 2,
    } as Options;

    const html = this.content.parentElement!.parentElement!;
    utils.addDoubleClickHandler(html, () => {
      this.hideProperties();
      this.postMessage({ type: "openDocument" });
    });
    this.rebuildToolbar();

    this.properties.addEventListener("click", (e: MouseEvent) => { e.stopPropagation(); });
    this.properties.addEventListener("dblclick", (e: MouseEvent) => { e.stopPropagation(); });
    this.properties.addEventListener("wheel", (e: WheelEvent) => { e.stopPropagation(); });

    this.postMessage({ type: "initialized" });
  }

  private applyZoom() {
    this.hideProperties();
    this.content.style.setProperty("--zoom", this.options.zoomLevel.toString());
    this.zoom.selectedIndex = zoomLevels.indexOf(this.options.zoomLevel);
  }

  public focusFilter() {
    this.filter.focus();
    this.filter.select();
  }

  public changeZoom(direction: number) {
    let n = zoomLevels.indexOf(this.options.zoomLevel);
    if (n == -1) n = 2;
    if (n > 0 && direction == -1) --n;
    if (n < zoomLevels.length - 1 && direction == 1) ++n;
    this.options.zoomLevel = zoomLevels[n];
    this.applyZoom();
    this.onStateChanged();
  }

  public onMessage(message: any) {
    switch (message.type) {
      case "setConfig":
        this.setConfig(message.config, message.description);
        return;
    }
  }

  private async updateConfig(forceRefresh?: boolean) {
    this.config.updateSource();

    const result = this.postMessage({
      type: "updateConfig",
      config: this.config.source,
    });
    if (forceRefresh)
      this.config.source = "";

    return result;
  }

  public setConfig(config: string, description: any) {
    if (config === this.config.source)
      return;

    const begin = Date.now();
    try {
      this.config = new Config(config);
      this.description = description;
    } catch {
      return this.showError("Parsing configuration failed");
    }
    const duration = (Date.now() - begin) / 1000.0;
    console.log("Updating configuration took", duration, "seconds");

    this.rebuildView();
    this.onStateChanged();
  }

  private showError(message: string) {
    this.content.innerHTML = `<div class='error'>${message}</div>`;
  }

  public onStateChanged() {
    this.content.style.setProperty("--sprite-rect-color",
      this.options.showRect ? "red" : "transparent");

    this.updateState({
      config: this.config.source,
      description: this.description,
      options: this.options,
      scrollX: window.scrollX,
      scrollY: window.scrollY,
    } as State);
  }

  public onScrolled() {
    if (this.onScrollTimeout) window.clearTimeout(this.onScrollTimeout);
    this.onScrollTimeout = window.setTimeout(() => this.onStateChanged(), 500);
  }

  public onFilterChanged() {
    if (this.onFilterChangedTimeout) window.clearTimeout(this.onFilterChangedTimeout);
    this.onFilterChangedTimeout = window.setTimeout(() => {
      const value = this.filter.value.toLocaleLowerCase().trim();
      this.options.filter = (value === "" ? undefined : value);
      this.onStateChanged();
      this.rebuildView();
    }, 200);
  }

  public restoreState(state: State) {
    this.config = new Config(state.config);
    this.description = state.description;
    this.options = state.options;
    this.applyZoom();
    this.rebuildToolbar();
    this.rebuildView();
    window.scrollTo(state.scrollX, state.scrollY);
  }

  private refreshDescription(force?: boolean) {
    if (force)
      this.config.source = "";

    this.postMessage({
      type: "refreshDescription",
      describeOnlyInput: !(
        this.options.showPivot || this.options.showTrimmedRect
      ),
    });
  }

  private cacheElement(key: any, element: HTMLElement) {
    this.cachedElementsNew.set(key, element);
  }

  private tryGetCachedElement(key: any) {
    const element = this.cachedElements.get(key);
    if (element) {
      this.cachedElements.delete(key);
      this.cacheElement(key, element);
    }
    return element;
  }

  private rebuildToolbar() {
    const itemsDiv = utils.createElement("div", "items");

    const buildButton = utils.appendElement(itemsDiv, "button", "build");
    buildButton.innerText = "build";
    utils.addClickHandler(buildButton, () => {
      this.postMessage({
        type: "build",
      });
    });

    const completeButton = utils.appendElement(itemsDiv, "button", "auto");
    completeButton.innerText = "auto";
    utils.addClickHandler(completeButton, () => {
      this.postMessage({
        type: "autocomplete",
      });
    });

    this.zoom = utils.appendSelect(itemsDiv, "zoom", "  Zoom:");
    for (const level of zoomLevels)
      utils.appendOption(this.zoom, level.toString(), Math.round(level * 100) + "%");
    utils.addChangeHandler(this.zoom, (value: string) => {
      this.options.zoomLevel = Number(value);
      this.applyZoom();
      this.onStateChanged();
    });
    this.applyZoom();

    const showLabel = utils.appendElement(itemsDiv, "label", "show-label");
    showLabel.innerText = "  Show:";

    const showInputTitle = utils.appendCheckbox(itemsDiv, "show-input", "input");
    showInputTitle.checked = this.options.showInputTitle;
    utils.addClickHandler(showInputTitle, () => {
      this.options.showInputTitle = showInputTitle.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showId = utils.appendCheckbox(itemsDiv, "show-id", "id");
    showId.checked = this.options.showId;
    utils.addClickHandler(showId, () => {
      this.options.showId = showId.checked;
      this.onStateChanged();
      this.rebuildView();
    });

    const showRect = utils.appendCheckbox(itemsDiv, "show-rect", "rect");
    showRect.checked = this.options.showRect;
    utils.addClickHandler(showRect, () => {
      this.options.showRect = showRect.checked;
      this.onStateChanged();
    });

    const showPivot = utils.appendCheckbox(itemsDiv, "show-pivot", "pivot");
    showPivot.checked = this.options.showPivot;
    utils.addClickHandler(showPivot, () => {
      this.options.showPivot = showPivot.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    const showTrimmedRect = utils.appendCheckbox(itemsDiv, "show-trimmed-rect", "trimmed-rect");
    showTrimmedRect.checked = this.options.showTrimmedRect;
    utils.addClickHandler(showTrimmedRect, () => {
      this.options.showTrimmedRect = showTrimmedRect.checked;
      this.onStateChanged();
      this.refreshDescription(true);
    });

    this.filter = utils.appendTextbox(itemsDiv, "filter", "  Filter:");
    this.filter.type = "search";
    this.filter.addEventListener("input", () => { this.onFilterChanged(); });
    this.filter.value = this.options.filter || "";

    utils.replaceOrAppendChild(this.toolbar, itemsDiv);
  }

  private matchesFilter(value: string) {
    return (!this.options.filter || value.toLowerCase().includes(this.options.filter));
  }

  public hideProperties() {
    this.properties.style.visibility = "hidden";
  }

  private showProperties(event: MouseEvent, title: string) {
    const offX = 20;
    const offY = 10;
    const width = this.properties.getBoundingClientRect().width;
    const left = event.clientX + window.scrollX + (event.clientX + width > window.innerWidth ? -width - offX : offX);
    const top = event.clientY + window.scrollY + offY;
    this.properties.style.visibility = "visible";
    this.properties.style.left = left + "px";
    this.properties.style.top = top + "px";

    const titleLabel = utils.createElement("label", "title");
    titleLabel.textContent = title;
    utils.replaceOrAppendChild(this.properties, titleLabel);
  }

  private rebuildInputProperties(input: Input, configInput: ConfigInput) {
    const currentInputType = this.config.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");
    const typeSelect = utils.appendSelect(itemsDiv, "type", "Type");
    const types = [
      ["sprite", "Single Sprite"],
      ["atlas", "Atlas"],
      ["grid", "Grid (Cell-Size)"],
      ["grid-cells", "Grid (Cell-Count)"]
    ];
    for (const type of types)
      utils.appendOption(typeSelect, type[0], type[1], type[0] == currentInputType);

    utils.addChangeHandler(typeSelect, async (type: string) => {
      this.config.replaceInputType(configInput, type);
      await this.updateConfig(true);
      this.rebuildInputProperties(input, configInput);
    });

    if (currentInputType === "grid") {
      const gridSize = this.config.getPropertyParameters(configInput, "grid");
      utils.appendPointEditor(itemsDiv, "cell-size", "Cell-Size").setMin(1).setValue(gridSize?.at(0), gridSize?.at(1));
      utils.appendPointEditor(itemsDiv, "grid-offset", "Grid-Offset").setMin(0);
      utils.appendPointEditor(itemsDiv, "grid-spacing", "Grid-Spacing").setMin(0);
    }
    else if (currentInputType === "grid-cells") {
      utils.appendPointEditor(itemsDiv, "cell-count", "Cell-Count").setMin(1);
    }

    if (currentInputType !== "sprite")
      utils.appendSpinbox(itemsDiv, "max-sprites", "Max. Sprites").setMin(0);

    if (currentInputType !== "sprite" || isSequenceFilename(input.filename)) {
      utils.appendElement(itemsDiv, "div", "dummy");
      const autoButton = utils.appendElement(itemsDiv, "button", "auto");
      autoButton.innerText = "auto";
      utils.addClickHandler(autoButton, () => {
        this.postMessage({
          type: "autocomplete",
          pattern: input.filename,
        });
      });
    }
    utils.replaceOrAppendChild(this.properties, itemsDiv);
  }

  private rebuildSpriteProperties(sprite: Sprite, configSprite: ConfigSprite, configInput: ConfigInput) {
    const currentInputType = this.config.getInputType(configInput);
    const itemsDiv = utils.createElement("div", "items");

    const idInput = utils.appendTextbox(itemsDiv, "sprite-id", "ID");
    idInput.value = this.config.getSubjectParameter(configSprite, 0);
    idInput.addEventListener("input", () => {
      this.config.replaceSpriteId(configSprite, idInput.value);
      return this.updateConfig(true);
    });

    if (currentInputType == "grid") {
      utils.appendPointEditor(itemsDiv, "sprite-span", "Cell-Span").setMin(0);
    }
    else if (currentInputType == "atlas") {
      const x = sprite.sourceRect.x;
      const y = sprite.sourceRect.y;
      const w = sprite.sourceRect.w;
      const h = sprite.sourceRect.h;
      utils.appendPointEditor(itemsDiv, "sprite-position", "Position").setMin(0).setValue(x, y);
      utils.appendPointEditor(itemsDiv, "sprite-size", "Size").setMin(1).setValue(w, h);
    }
    const px = sprite.pivot?.x;
    const py = sprite.pivot?.y;
    utils.appendPointEditor(itemsDiv, "sprite-pivot", "Pivot").setValue(px, py);
    utils.replaceOrAppendChild(this.properties, itemsDiv);
    idInput.focus();
  }

  private rebuildView() {
    const begin = Date.now();
    const inputsDiv = utils.createElement("div", "inputs");

    let inputIndex = 0;
    for (const input of this.description.inputs) {
      const configInput = this.config.inputs[inputIndex++];

      if (configInput?.sprites.length == 0 && input.sourceSprites.length == 0)
        continue;

      if (!this.matchesFilter(input.filename))
        continue;

      const inputDiv = utils.appendElement(inputsDiv, "div", "input");

      if (configInput)
        utils.addClickHandler(inputDiv, (event: MouseEvent) => {
          this.showProperties(event, "Input");
          this.rebuildInputProperties(input, configInput);
        });
      utils.addDoubleClickHandler(inputDiv, () => {
        this.hideProperties();
        this.postMessage({
          type: "selectLine",
          lineNo: configInput.lineNo,
          columnNo: this.config.getParameterColumn(configInput),
        });
      });

      if (this.options.showInputTitle) {
        const titleDiv = utils.appendElement(inputDiv, "div", "title");
        const textDiv = utils.appendElement(titleDiv, "div", "text");
        textDiv.innerText = input.filename;
      }
      else {
        inputDiv.title = input.filename;
      }

      if (input.sourceSprites.length > 0) {
        const sourcesDiv = this.createSourceDiv(input, configInput);
        inputDiv.appendChild(sourcesDiv);
      }
    }

    this.cachedElements = this.cachedElementsNew;
    this.cachedElementsNew = new Map();

    utils.replaceOrAppendChild(this.content, inputsDiv);
    const duration = (Date.now() - begin) / 1000.0;
    console.log("Rebuilding view took", duration, "seconds");
  }

  private createSourceDiv(input: Input, configInput?: ConfigInput): HTMLElement {
    let spriteIndex = 0;
    const sourcesDiv = utils.createElement("div", "sources");
    for (const sourceSprites of input.sourceSprites) {
      const source = this.description.sources[sourceSprites.sourceIndex];
      const sourceDiv = utils.appendElement(sourcesDiv, "div", "source");
      const sourceFrameDiv = utils.appendElement(sourceDiv, "div", "frame");

      let sourceImageDiv = this.tryGetCachedElement(source.filename);
      if (!sourceImageDiv) {
        sourceImageDiv = utils.createElement("div", "image");
        this.cacheElement(source.filename, sourceImageDiv!);
        utils.addVisibilityHandler(sourceImageDiv, () => {
          sourceImageDiv!.style.setProperty("--filename", `url('${source.uri}'`);
        });
      }
      sourceFrameDiv.appendChild(sourceImageDiv);
      sourceImageDiv!.style.setProperty("--width", source.width + "px");
      sourceImageDiv!.style.setProperty("--height", source.height + "px");

      const spritesDiv = utils.appendElement(sourceFrameDiv, "div", "sprites");
      for (const index of sourceSprites.spriteIndices) {
        const sprite = this.description.sprites[index];
        const configSprite = configInput?.sprites[spriteIndex++];

        if (this.options.showTrimmedRect && sprite.trimmedSourceRect) {
          utils.appendRect(spritesDiv, sprite.trimmedSourceRect, "trimmed-rect");
        }

        const spriteDiv = utils.appendRect(
          spritesDiv,
          sprite.sourceRect,
          "sprite"
        );
        spriteDiv.title = sprite.id;

        if (this.options.showPivot &&
          sprite.pivot &&
          sprite.trimmedSourceRect &&
          sprite.rect &&
          sprite.trimmedRect) {
          const rx = sprite.trimmedSourceRect.x +
            (sprite.rect.x - sprite.trimmedRect.x);
          const ry = sprite.trimmedSourceRect.y +
            (sprite.rect.y - sprite.trimmedRect.y);
          const pivotDiv = utils.appendElement(spritesDiv, "div", "pivot");
          pivotDiv.style.setProperty("--x", rx + sprite.pivot.x + "px");
          pivotDiv.style.setProperty("--y", ry + sprite.pivot.y + "px");
        }
        if (this.options.showId) {
          const textDiv = utils.appendElement(spriteDiv, "div", "text");
          textDiv.innerText = sprite.id;
        }

        if (configSprite) {
          utils.addClickHandler(spriteDiv, (event: MouseEvent) => {
            this.showProperties(event, "Sprite");
            this.rebuildSpriteProperties(sprite, configSprite, configInput);
          });
          utils.addDoubleClickHandler(spriteDiv, () => {
            this.hideProperties();
            this.postMessage({
              type: "selectLine",
              lineNo: configSprite.lineNo,
              columnNo: this.config.getParameterColumn(configSprite),
            });
          });
        }
      }
    }
    return sourcesDiv;
  }
}
